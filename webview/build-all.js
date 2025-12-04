import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { mkdirSync, existsSync } from 'fs';

const commonConfig = {
  plugins: [react(), viteSingleFile()],
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined
      }
    },
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000
  }
};

async function buildAll() {
  console.log('Building webview...\n');

  // Ensure dist directory exists
  if (!existsSync('dist')) {
    mkdirSync('dist');
  }

  // Build complete app (main)
  console.log('🏗️  Building webview app...');
  await build({
    ...commonConfig,
    build: {
      ...commonConfig.build,
      outDir: 'dist'
    }
  });

  console.log('\n✅ Webview built successfully!');
  console.log('📁 Files in dist/:');
  console.log('   - index.html (webview app)');
}

buildAll().catch(console.error);
