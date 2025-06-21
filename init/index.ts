// File: packages/core/init/init.ts
import fs from 'fs';
import path from 'path';

const DEFAULT_CONFIG ={
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
    logLevel: 'warn',
    regeneration: { mode: 'watch' }
  }
function detectProjectType(): 'ts' | 'js' {
  if (fs.existsSync('tsconfig.json')) return 'ts';
  if (fs.existsSync('jsconfig.json')) return 'js';
  return 'js';
}

// function updateIncludeConfig(configFilePath: string, includeDir: string) {
//   let config: any = {};
//   if (fs.existsSync(configFilePath)) {
//     config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
//   }

//   if (!Array.isArray(config.include)) config.include = [];

//   if (!config.include.includes(includeDir)) {
//     config.include.push(includeDir);
//     fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf8');
//     console.log(`[yojan:init] Updated ${configFilePath} includes with "${includeDir}"`);
//   }
// }

export function createYojanConfig(force = false) {
  const configPath = path.resolve('.yojanrc.json');

  if (fs.existsSync(configPath) && !force) {
    console.log('[yojan:init] .yojanrc.json already exists');
    return;
  }

  const projectType = detectProjectType();
  const routerFile = `generated.routes.${projectType}`;

  const config = {
    ...DEFAULT_CONFIG,
    router: {
      file: routerFile.replace(/\.[tj]s$/, '') // Strip extension from value
    },
    projectType
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('[yojan:init] ✅ Created .yojanrc.json');

  const outDirPath = path.resolve(config.fileLocation);
  if (!fs.existsSync(outDirPath)) fs.mkdirSync(outDirPath);

  const configFile = projectType === 'ts' ? 'tsconfig.json' : 'jsconfig.json';
  // updateIncludeConfig(configFile, config.fileLocation);
}

// To be used by plugin auto install or CLI
