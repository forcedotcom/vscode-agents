const { build } = require('esbuild');

(async () => {
  await build({
    bundle: false,
    entryPoints: ['./src/extension.ts'],
    format: 'cjs',
    outdir: 'dist',
    platform: 'node',
    sourcemap: true
  });
})();
