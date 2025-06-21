// import { Plugin } from 'vite';
// import path from 'path';
export * from './router';
export * from './cli'
export * from './init';

// export default function yojanFramework(): Plugin {
//   return {
//     name: 'yojan-framework',
//     config: () => ({
//       resolve: {
//         alias: {
//           '@': path.resolve(process.cwd(), 'src'),
//         },
//       },
//     }),
//     configureServer(server) {
//       console.log('[yojan] Dev server is running...');
//     },
//     buildStart() {
//       console.log('[yojan] Starting production build...');
//     },
//   };
// }
// export * from './router/index.js';
