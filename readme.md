# 🛣️ yojan-router — Dynamic Route Generator for Vite Projects

`yojan-router` is a powerful Vite plugin that scans your source files (like `src/pages`) and auto-generates a route map. It supports SSR, SSG, ISR, CSR distinctions, route grouping (Next.js-style), regeneration modes, and much more — all through a simple `.yojanrc.json` file.

---

## ✨ Features

- ✅ File-based routing
- ⚡ Auto route regeneration (watch, interval, file-modified, or once)
- 🧩 Grouped dynamic routes like `(admin)/dashboard`
- 🔁 Static/lazy/dynamic import strategies
- 🚀 SSR / CSR / SSG / ISR export detection
- 🔍 Custom export fields
- 📂 Customizable output directory and filename
- 📣 Fine-grained logging with log levels

---

## 📦 Installation

```bash
npm add -D yojan
```

---

## ⚙️ Usage

Add `yojan-router` to your Vite config:

```ts
// vite.config.ts
import yojanRouter from 'yojan/router'

export default {
  plugins: [yojanRouter()]
}
```

---

## 🗃️ Example Folder Structure

```
src/pages/
  ├── index.tsx        → "/"
  ├── about.tsx        → "/about"
  ├── [user].tsx       → "/:user"
  ├── (admin)/home.tsx → "/admin/home" (if grouping enabled)
```

---

## 📁 Output Example

```ts
export const routes = [
  {
    path: "/",
    importPath: "./src/pages/index",
    type: "csr", // or ssr/ssg/isr
    absolutePath: "/abs/path/to/src/pages/index.tsx"
  },
  ...
]
```

---

## 📋 Configuration — `.yojanrc.json`

Create a `.yojanrc.json` at your project root:
and customize yojanrc json file as required
or do 
# npx yojan init

```json
{
  "ssrImportType": "static",
  "isrImportType": "static",
  "csrImportType": "lazy",
  "ssgImportType": "static",
  "includeRenderingType": true,
  "fileLocation": ".",
  "csr": "default",
  "ssr": "getServerSideProps",
  "ssg": "getStaticProps",
  "isr": "getISRProps",
  "absoluteLocationForAll": false,
  "absoluteLocation": {},
  "extraField": [],
  "staticImportForExtraField": {},
  "groupingAllowedInDynamicRoutes": false,
  "excludeFiles": [],
  "includeFiles": ["src/pages"],
  "router": {
    "file": "generated.routes"
  },
  "logLevel": "warn",
  "regeneration": {
    "mode": "watch"
  }
}
```

---

## 🔍 Configuration Field Details

### Rendering Mode Detection

Defines how to detect rendering type from exports:

```json
"ssr": "getServerSideProps",
"ssg": "getStaticProps",
"isr": "getISRProps",
"csr": "default"
```

---

### Import Type for Routes

Control how route components are imported:

```json
"ssrImportType": "static",   // static | lazy
"ssgImportType": "static",
"isrImportType": "static",
"csrImportType": "lazy"
```

---

### fileLocation

it tells where generated routes file will be stored ,directory of that

### Extra Field Detection

Attach custom export info to routes:

```json
"extraField": ["auth", "middleware"],
"staticImportForExtraField": {
  "auth": true,
  "middleware": false
}
```

---

### Absolute Path Handling

Control whether `absolutePath` is included in output:

```json
"absoluteLocationForAll": false,
"absoluteLocation": {
  "ssr": true
}
```

---

### Grouping in Dynamic Routes

Enables Next.js-style folder grouping:

```
src/pages/(admin)/dashboard.tsx → /dashboard
```

```json
"groupingAllowedInDynamicRoutes": true
```

---

### Route Generation Settings

```json

 fileLocation -  it tells where generated routes file will be stored ,directory of that
"fileLocation": ".",              // Output directory
"router": {
  "file": "generated.routes"      // Filename (.ts or .js based on projectType)
}
```

---

### Regeneration Modes

```json
"regeneration": {
  "mode": "watch" // 'watch' | 'build' | 'dev-once' | 'interval' | 'file-modified'
}
```

| Mode            | Description                               |
|----------------|-------------------------------------------|
| `watch`         | Watch for file creation/deletion/changes |
| `interval`      | Regenerate on a timer                    |  you nedd intervalMs here 
like 


 "regeneration": {
    "mode": "interval",
    "intervalMs": 3000
  }
| `file-modified` | React only to file content changes       |
| `dev-once`      | Run once when dev server starts          |

---

### Logging

```json
"logLevel": "warn" // 'verbose' | 'warn' | 'errorOnly' | 'silent'
```

---

## excludeFiles: [],
   includeFiles: ['src/pages'],
   exclude the file of regenerated routes location if it is inside the includeFilesLocation
   like inside pages
   # excludeFiles: ['**/src/pages/generated.routes.js/ts']

## includeFiles: [],
    it include the routes from the location given for includefiles,
    here you don't need to write like /** ,it will take after that location by default ,so just pass project folder
    if src/pages and if file is like  src/pages/about/index.jsx
    then route would be /about
    if file is like  src/pages/about/me.jsx
    then route would be /about/me

## 🧾 License

MIT

---

Built with 💛 by Shivpujan Kumar

> Keywords: vite, vite-plugin, vite-router, dynamic routes, ssr, ssg, csr, isr, yojan, react, file-based routing
