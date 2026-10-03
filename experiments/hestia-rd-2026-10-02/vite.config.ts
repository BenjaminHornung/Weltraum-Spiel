import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({ cacheDir: '.vite', publicDir: 'fixtures',
  server: { host: '127.0.0.1', port: 5280, strictPort: true,
    fs: { strict: true, allow: [fileURLToPath(new URL('.', import.meta.url))] } },
  preview: { host: '127.0.0.1', port: 5280, strictPort: true },
  build: { outDir: 'dist', rolldownOptions: { input: {
    rd00: fileURLToPath(new URL('./index.html', import.meta.url)),
    rd03: fileURLToPath(new URL('./src/runner/index.html', import.meta.url)),
    rd10: fileURLToPath(new URL('./src/experiments/renderer-probe/index.html', import.meta.url)),
    rd11: fileURLToPath(new URL('./src/experiments/three-webgpu/index.html', import.meta.url)),
  } } } });
