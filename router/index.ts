#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { Plugin } from 'vite'
import micromatch from 'micromatch'

interface Route {
  path: string
  importPath: string
  type?: 'ssr' | 'ssg' | 'isr' | 'csr'
  absolutePath?: string
  extraFields: Record<string, string | null>
}

interface YojanConfig {
  ssrImportType: 'lazy' | 'static' | 'default'
  isrImportType: 'lazy' | 'static' | 'default'
  csrImportType: 'lazy' | 'static' | 'default'
  ssgImportType: 'lazy' | 'static' | 'default'
  includeRenderingType: boolean
  fileLocation: string
  csr: string
  ssr: string
  ssg: string
  isr: string
  absoluteLocationForAll: boolean
  absoluteLocation: Partial<Record<'ssg' | 'ssr' | 'isr' | 'csr', boolean>>
  extraField: string[]
  staticImportForExtraField: Record<string, boolean>
  groupingAllowedInDynamicRoutes: boolean
  excludeFiles: string[]
  includeFiles: string[]
  router: {
    file: string
  }
  projectType?: 'js' | 'ts'
  logLevel?: 'verbose' | 'warn' | 'errorOnly' | 'silent'
  regeneration?: {
    mode: 'watch' | 'build' | 'dev-once' | 'interval' | 'file-modified'
    intervalMs?: number
  }
}

type LogLevel = 'verbose' | 'warn' | 'errorOnly' | 'silent'

function createLogger (level: LogLevel = 'warn') {
  const noop = () => {}

  return {
    verbose:
      level === 'verbose'
        ? (...args: any[]) => console.log('[yojan-router] 🔍', ...args)
        : noop,
    info: ['verbose'].includes(level)
      ? (...args: any[]) => console.info('[yojan-router] ℹ️', ...args)
      : noop,
    warn: ['verbose', 'warn'].includes(level)
      ? (...args: any[]) => console.warn('[yojan-router] ⚠️', ...args)
      : noop,
    error: ['verbose', 'warn', 'errorOnly'].includes(level)
      ? (...args: any[]) => console.error('[yojan-router] ❌', ...args)
      : noop
  }
}

let logger = createLogger('warn')

let cachedConfig: YojanConfig | null = null
let lastConfigContent: string | null = null

function getDefaultConfig (projectType: 'js' | 'ts' = 'ts'): YojanConfig {
  return {
    ssrImportType: 'static',
    isrImportType: 'static',
    csrImportType: 'lazy',
    ssgImportType: 'static',
    includeRenderingType: true,
    fileLocation: '.',
    csr: 'default',
    ssr: 'getServerSideProps',
    ssg: 'getStaticProps',
    isr: 'getISRProps',
    absoluteLocationForAll: false,
    absoluteLocation: {},
    extraField: [],
    staticImportForExtraField: {},
    groupingAllowedInDynamicRoutes: false,
    excludeFiles: [],
    includeFiles: ['src/pages'],
    router: {
      file: 'generated.routes'
    },
    projectType,
    logLevel: 'warn',
    regeneration: { mode: 'watch' }
  }
}

function ensureYojanConfig (root: string): YojanConfig {
  const configPath = path.join(root, '.yojanrc.json')
  const tsconfigPath = path.join(root, 'tsconfig.json')
  const isTS = fs.existsSync(tsconfigPath)

  if (
    lastConfigContent &&
    fs.readFileSync(configPath, 'utf-8') === lastConfigContent
  ) {
    return cachedConfig!
  }

  let raw = ''
  if (!fs.existsSync(configPath)) {
    logger.warn('  .yojanrc.json not found, using default configuration.')
    return getDefaultConfig(isTS ? 'ts' : 'js')
  }

  try {
    raw = fs.readFileSync(configPath, 'utf-8')
    lastConfigContent = raw
    const userConfig = JSON.parse(raw)
    const defaultConfig = getDefaultConfig(isTS ? 'ts' : 'js')

    const merged: YojanConfig = {
      ...defaultConfig,
      ...userConfig,
      absoluteLocation: {
        ...defaultConfig.absoluteLocation,
        ...userConfig.absoluteLocation
      },
      staticImportForExtraField: {
        ...defaultConfig.staticImportForExtraField,
        ...userConfig.staticImportForExtraField
      },
      projectType: userConfig.projectType || defaultConfig.projectType,
      logLevel: userConfig.logLevel || defaultConfig.logLevel,
      regeneration: userConfig.regeneration || defaultConfig.regeneration
    }

    if (!Array.isArray(merged.includeFiles) || !merged.fileLocation) {
      throw new Error('Invalid .yojanrc.json config: missing required fields')
    }

    cachedConfig = merged

    logger.verbose('[yojan-router] ⚙️ Routes generated with config:', {
      absoluteLocationForAll: cachedConfig.absoluteLocationForAll,
      absoluteLocation: cachedConfig.absoluteLocation,
      routerFile: cachedConfig.router?.file,
      fileLocation: cachedConfig.fileLocation,
      includeFiles: cachedConfig.includeFiles,
      excludeFiles: cachedConfig.excludeFiles,
      extraField: cachedConfig.extraField
    })

    return merged
  } catch (err: any) {
    console.error('[yojan-router] ❌ Failed to load .yojanrc.json.')
    console.error(err.message)

    // if (cachedConfig) {
    //   console.warn('[yojan-router] ⚠️ Using last known valid config.')
    //   return cachedConfig
    // }

    // console.warn('[yojan-router] ⚠️ Using default config as fallback.')
    // return getDefaultConfig(isTS ? 'ts' : 'js')
    throw new Error(
      '[yojan-router] ❌ Failed to load .yojanrc.json. Please check the file format.'
    )
  }
}

function isWatchedFile (
  file: string,
  config: YojanConfig,
  root: string
): boolean {
  const relativePath = path.relative(root, file).replace(/\\/g, '/')
  return (
    micromatch.isMatch(relativePath, config.includeFiles) &&
    !micromatch.isMatch(relativePath, config.excludeFiles)
  )
}

function detectExport (code: string, name: string): boolean {
  if (name === 'default') {
    return /export\s+default\s+/.test(code)
  }
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(
    `export\\s+(const|let|var|function|async function)\\s+${escaped}\\s*(=|\\()`,
    'm'
  )
  return regex.test(code)
}

function detectRouteType (
  code: string,
  config: YojanConfig
): 'ssr' | 'ssg' | 'isr' | 'csr' {
  const hasDefault = detectExport(code, config.csr)
  const hasSSR = detectExport(code, config.ssr)
  const hasSSG = detectExport(code, config.ssg)
  const hasISR = detectExport(code, config.isr)

  const typesFound = [hasSSR, hasSSG, hasISR].filter(Boolean).length

  if (!hasDefault) {
    throw new Error('❌ File must export a default component.')
  }

  if (typesFound > 1) {
    throw new Error(
      '❌ A route file cannot have more than one rendering type (ssr, ssg, isr).'
    )
  }

  if (hasISR) return 'isr'
  if (hasSSR) return 'ssr'
  if (hasSSG) return 'ssg'
  return 'csr'
}

export function toRoute (
  filePath: string,
  baseDir: string,
  outFilePath: string,
  rootDir: string,
  config: YojanConfig
): Route {
  const code = fs.readFileSync(filePath, 'utf-8')
  const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/')
  let routePath = '/' + relPath.replace(/\.(tsx|jsx|ts|js)$/, '')

  if (config.groupingAllowedInDynamicRoutes) {
    routePath = routePath.replace(/\(([^)]+)\)/g, '') // remove (group)
  }

  if (routePath.endsWith('/index')) {
    routePath = routePath.replace(/\/index$/, '')
  }

  routePath = routePath.replace(/\[([^\]]+)\]/g, ':$1')
  routePath = routePath.replace(/\/+/g, '/') // clean up double slashes

  const importPath = path
    .relative(path.dirname(outFilePath), filePath)
    .replace(/\.(tsx|jsx|ts|js)$/, '')
    .replace(/\\/g, '/')
  const absolutePath = path.resolve(rootDir, filePath).replace(/\\/g, '/')
  const type = detectRouteType(code, config)

  const extraFields: Record<string, string | null> = {}
  for (const field of config.extraField) {
    extraFields[field] = detectExport(code, field) ? field : null
  }

  return {
    path: routePath,
    importPath: importPath.startsWith('.') ? importPath : './' + importPath,
    absolutePath:
      config.absoluteLocationForAll || config.absoluteLocation?.[type]
        ? absolutePath
        : undefined,
    type,
    extraFields
  }
}

function scanRoutes (
  includeDirs: string[],
  excludePatterns: string[],
  root: string,
  outFilePath: string,
  config: YojanConfig
): Route[] {
  const routes: Route[] = []
  const routePaths = new Map<string, string>() // path => file

  for (const dir of includeDirs) {
    const absDir = path.resolve(root, dir)
    if (!fs.existsSync(absDir)) continue

    const walk = (dirPath: string) => {
      for (const file of fs.readdirSync(dirPath)) {
        const full = path.join(dirPath, file)
        const stat = fs.statSync(full)
        const rel = path.relative(root, full).replace(/\\/g, '/')
        if (micromatch.isMatch(rel, excludePatterns)) continue

        if (stat.isDirectory()) {
          walk(full)
        } else if (/\.(tsx|jsx|ts|js)$/.test(file)) {
          try {
            const route = toRoute(full, absDir, outFilePath, root, config)

            // ✅ Normalize empty path to '/'
            if (route.path.trim() === '') {
              route.path = '/'
            }

            // 🛑 Check for duplicates
            if (routePaths.has(route.path)) {
              const existingFile = routePaths.get(route.path)
              throw new Error(
                `[yojan-router] ❌ Duplicate route path detected: "${route.path}"\n  → ${existingFile}\n  → ${full}`
              )
            }

            routePaths.set(route.path, full)
            routes.push(route)
          } catch (e: any) {
            throw new Error(
              ` "${full}": ${e.message}`
            )
          }
        }
      }
    }

    walk(absDir)
  }

  return routes
}

export function generateRoutesFile (
  routes: Route[],
  outFile: string,
  config: YojanConfig
) {
  const importStatements = ['import { lazy } from "react";']
  const routeEntries: string[] = []
  logger.info('routes are generated , total routes = ', routes.length)

  routes.forEach((route, i) => {
    const importName = `Page${i}`
    const useAbs =
      config.absoluteLocationForAll ||
      (!!config.absoluteLocation &&
        config.absoluteLocation[route.type!] === true)

    const impPath = route.importPath
    const importMode = config[`${route.type}ImportType` as keyof YojanConfig]

    const entryFields: string[] = [`path: "${route.path}"`]
    if (config.includeRenderingType) entryFields.push(`type: "${route.type}"`)
    if (route.absolutePath)
      entryFields.push(`absolutePath: "${route.absolutePath}"`)

    if (importMode === 'lazy') {
      entryFields.push(`component: lazy(() => import("${impPath}"))`)
    } else {
      importStatements.push(`import ${importName} from "${impPath}";`)
      entryFields.push(`component: ${importName}`)
    }

    for (const [field, exportName] of Object.entries(route.extraFields)) {
      if (!exportName) continue
      const staticImp = config.staticImportForExtraField[field]
      const localName = `${field}_${i}`

      if (staticImp) {
        importStatements.push(
          `import { ${field} as ${localName} } from "${impPath}";`
        )
        entryFields.push(`${field}: ${localName}`)
      } else {
        entryFields.push(
          `${field}: () => import("${impPath}").then(m => m.${field})`
        )
      }
    }

    routeEntries.push(`  { ${entryFields.join(', ')} }`)
  })

  const finalCode =
    `// 🔒 AUTO-GENERATED FILE. DO NOT MODIFY.\n` +
    importStatements.join('\n') +
    `\n\nexport const routes = [\n${routeEntries.join(',\n')}\n];\n`

  fs.writeFileSync(outFile, finalCode, 'utf-8')
}

export default function yojanRouter (): Plugin {
  let outFilePath = ''
  let config: YojanConfig
  let configPath: string = ''
  let regenTimer: ReturnType<typeof setInterval> | null = null
  let lastAppliedHandlers: (() => void) | null = null

  const resolveOutFilePath = (root: string, config: YojanConfig): string => {
    const ext = config.projectType === 'js' ? 'js' : 'ts'
    const fileName = config.router?.file || 'generated.routes'
    const baseDir = path.resolve(root, config.fileLocation || '.')
    const fullPath = path.resolve(baseDir, `${fileName}.${ext}`)

    const normalize = (p: string) => path.resolve(p).replace(/\\/g, '/')
    if (!normalize(fullPath).startsWith(normalize(root))) {
      logger.warn(
        `Unsafe output path (${fullPath}) — falling back to ./${fileName}.${ext}`
      )
      return path.resolve(root, `${fileName}.${ext}`)
    }
    return fullPath
  }

  const regen = (root: string) => {
    try {
      try {
        config = ensureYojanConfig(root)
        logger = createLogger(config.logLevel || 'warn')
      } catch (configErr: any) {
        logger?.error?.(
          `[yojan-router] ❌ Failed to load config: ${configErr.message}`
        )
        return
      }

      outFilePath = resolveOutFilePath(root, config)

      const routes = scanRoutes(
        config.includeFiles,
        config.excludeFiles,
        root,
        outFilePath,
        config
      )

      fs.mkdirSync(path.dirname(outFilePath), { recursive: true })
      generateRoutesFile(routes, outFilePath, config)

      logger.info(`[yojan-router] ✅ Routes regenerated (${routes.length})`)
    } catch (err: any) {
      logger.error(
        `[yojan-router] 🔁 Route regeneration failed: ${err.message}`
      )
    }
  }

  let regenPending = false
  const debounceDelay = 300

  const debounceRegen = (root: string) => {
    if (regenPending) return
    regenPending = true
    setTimeout(() => {
      regen(root)
      regenPending = false
    }, debounceDelay)
  }

  const expandIncludeGlob = (pattern: string) => {
    // If it's a directory or doesn't have an extension, treat it as a folder
    return pattern.endsWith('/') || !path.extname(pattern)
      ? pattern.replace(/\/?$/, '/**')
      : pattern
  }

  const isWatchedFile = (
    file: string,
    config: YojanConfig,
    root: string,
    outFile?: string
  ): boolean => {
    const normalized = path.relative(root, file).replace(/\\/g, '/')

    if (outFile && path.resolve(file) === path.resolve(outFile)) return false

    const includePatterns = config.includeFiles.map(expandIncludeGlob)
    const excludePatterns = config.excludeFiles // assume already-globbed

    const matched = micromatch.isMatch(normalized, includePatterns)
    const excluded = micromatch.isMatch(normalized, excludePatterns)

    // console.log(
    //   `[yojan-router] 🔍 ${normalized} | include match=${matched} | exclude match=${excluded}`
    // )

    return matched && !excluded
  }

  return {
    name: 'yojan-router',

    configResolved (resolvedConfig) {
      try {
        configPath = path.resolve(resolvedConfig.root, '.yojanrc.json')
        config = ensureYojanConfig(resolvedConfig.root)
        logger = createLogger(config.logLevel || 'warn')
        outFilePath = resolveOutFilePath(resolvedConfig.root, config)

        const routes = scanRoutes(
          config.includeFiles,
          config.excludeFiles,
          resolvedConfig.root,
          outFilePath,
          config
        )
        generateRoutesFile(routes, outFilePath, config)
      } catch (err: any) {
        console.error(
          `[yojan-router] ❌ Failed during configResolved: ${err.message}`
        )
      }
    },

    configureServer (server) {
      const root = server.config.root

      const safeReloadConfig = () => {
        try {
          config = ensureYojanConfig(root)
          logger = createLogger(config.logLevel || 'warn')
          return true
        } catch (err: any) {
          console.error(
            `[yojan-router] ❌ Failed to reload config: ${err.message}`
          )
          return false
        }
      }

      const applyRegenerationMode = () => {
        if (regenTimer) clearInterval(regenTimer)
        if (lastAppliedHandlers) lastAppliedHandlers()

        const isConfigChange = (file: string) =>
          path.resolve(file) === path.resolve(configPath)

        const addHandler = (event: 'add' | 'unlink' | 'change') => {
          const handler = (file: string) => {
            // console.log(
            //   isConfigChange(file),
            //   'iam handling',
            //   isWatchedFile(file, config, root, outFilePath),
            //   file
            // )
            if (isConfigChange(file)) return
            if (isWatchedFile(file, config, root, outFilePath)) {
              debounceRegen(root)
            }
          }
          server.watcher.on(event, handler)
          return () => server.watcher.off(event, handler)
        }

        const unbinds: (() => void)[] = []

        switch (config.regeneration?.mode) {
          case 'interval':
            regenTimer = setInterval(
              () => debounceRegen(root),
              config.regeneration.intervalMs || 3000
            )
            break
          case 'dev-once':
            debounceRegen(root)
            break
          case 'watch':
            unbinds.push(
              addHandler('add'),
              addHandler('unlink'),
              addHandler('change')
            )
            break
          case 'file-modified':
            unbinds.push(addHandler('change'))
            break
        }

        lastAppliedHandlers = () => unbinds.forEach(fn => fn())
      }

      server.watcher.add(configPath)

      if (!safeReloadConfig()) return

      // ✅ Watch includeFolders directly
      // Explicitly watch include base dirs
      // for (const pattern of config.includeFiles) {
      //   const base = pattern.split('/')[0] // crude top-level dir
      //   const abs = path.resolve(root, base)
      //   if (fs.existsSync(abs)) server.watcher.add(abs)
      // }

      applyRegenerationMode()
      console.log(outFilePath)

      server.watcher.on('change', file => {
        if (path.resolve(file) === path.resolve(configPath)) {
          logger.info('.yojanrc.json updated, reloading config')
          lastConfigContent = null
          cachedConfig = null

          if (safeReloadConfig()) {
            debounceRegen(root)
            applyRegenerationMode()
          }
        } else if (isWatchedFile(file, config, root, outFilePath)) {
          debounceRegen(root)
        }
      })
    },

    closeBundle () {
      if (regenTimer) clearInterval(regenTimer)
      if (lastAppliedHandlers) lastAppliedHandlers()
    }
  }
}
