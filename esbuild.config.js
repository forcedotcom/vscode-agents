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
