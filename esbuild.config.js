const { build } = require('esbuild');

(async () => {
  await build({
    bundle: false,
    entryPoints: ['./src/extension.ts'],
    external: ['vscode'],
    format: 'cjs',
    outdir: 'dist',
    platform: 'node',
    sourcemap: true
  });
})();
