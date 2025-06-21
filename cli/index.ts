#!/usr/bin/env node

import { createYojanConfig } from '../init/index.js';
// import { buildSomething } from '../core/build/build';
// import { devServer } from '../core/dev/dev';

const command = process.argv[2];

switch (command) {
  case 'init':
    createYojanConfig();
    break;
  case 'build':
    // buildSomething();
    break;
  case 'dev':
    // devServer();
    break;
  default:
    console.log(` Unknown command: ${command}`);
    process.exit(1);
}

