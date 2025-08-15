import { build } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

const commonConfig = {
  plugins: [react(), viteSingleFile()],
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
  },
};

async function buildAll() {
  console.log('Building all HTML files...\n');

  // Ensure dist directory exists
  if (!existsSync('dist')) {
    mkdirSync('dist');
  }

  // Build complete app (main)
  console.log('🏗️  Building complete app...');
  await build({
    ...commonConfig,
    build: {
      ...commonConfig.build,
      outDir: 'dist',
    },
  });

  // Build tabs only
  console.log('🏗️  Building tabs only...');
  await build({
    ...commonConfig,
    build: {
      ...commonConfig.build,
      rollupOptions: {
        ...commonConfig.build.rollupOptions,
        input: resolve(process.cwd(), 'tabs.html'),
      },
      outDir: 'dist-temp-tabs',
    },
  });
  copyFileSync('dist-temp-tabs/tabs.html', 'dist/tabs.html');

  // Build preview only
  console.log('🏗️  Building preview only...');
  await build({
    ...commonConfig,
    build: {
      ...commonConfig.build,
      rollupOptions: {
        ...commonConfig.build.rollupOptions,
        input: resolve(process.cwd(), 'preview.html'),
      },
      outDir: 'dist-temp-preview',
    },
  });
  copyFileSync('dist-temp-preview/preview.html', 'dist/preview.html');

  // Build tracer only
  console.log('🏗️  Building tracer only...');
  await build({
    ...commonConfig,
    build: {
      ...commonConfig.build,
      rollupOptions: {
        ...commonConfig.build.rollupOptions,
        input: resolve(process.cwd(), 'tracer.html'),
      },
      outDir: 'dist-temp-tracer',
    },
  });
  copyFileSync('dist-temp-tracer/tracer.html', 'dist/tracer.html');

  // Clean up temp directories
  console.log('🧹 Cleaning up...');
  const { rmSync } = await import('fs');
  rmSync('dist-temp-tabs', { recursive: true, force: true });
  rmSync('dist-temp-preview', { recursive: true, force: true });
  rmSync('dist-temp-tracer', { recursive: true, force: true });

  console.log('\n✅ All HTML files built successfully!');
  console.log('📁 Files in dist/:');
  console.log('   - index.html (complete app)');
  console.log('   - tabs.html (tabs only)');
  console.log('   - preview.html (preview only)');
  console.log('   - tracer.html (tracer only)');
}

buildAll().catch(console.error);