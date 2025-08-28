/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const { build } = require('esbuild');
const esbuildPluginPino = require('esbuild-plugin-pino');

(async () => {
  await build({
    bundle: true,
    entryPoints: ['./src/extension.ts'],
    external: ['vscode'],
    format: 'cjs',
    keepNames: true,
    loader: { '.node': 'file' },
    logOverride: {
      'unsupported-dynamic-import': 'error'
    },
    minify: true,
    outdir: 'dist',
    platform: 'node',
    plugins: [esbuildPluginPino({ transports: ['pino-pretty'] })],
    supported: { 'dynamic-import': false }
  });
})();
