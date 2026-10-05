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
    rd12: fileURLToPath(new URL('./src/experiments/babylon/index.html', import.meta.url)),
    rd13: fileURLToPath(new URL('./src/experiments/voxel-rays/index.html', import.meta.url)),
    rd21: fileURLToPath(new URL('./src/experiments/foliage-wind/index.html', import.meta.url)),
    rd31: fileURLToPath(new URL('./src/experiments/rain/index.html', import.meta.url)),
    rd14: fileURLToPath(new URL('./src/experiments/material-light/index.html', import.meta.url)),
    rd15: fileURLToPath(new URL('./src/experiments/camera-occlusion/index.html', import.meta.url)),
    rd32: fileURLToPath(new URL('./src/experiments/wet-surface/index.html', import.meta.url)),
    rd40: fileURLToPath(new URL('./src/tools/variant-gallery/index.html', import.meta.url)),
    rd41: fileURLToPath(new URL('./src/tools/foliage-workbench/index.html', import.meta.url)),
    rd42: fileURLToPath(new URL('./src/tools/weather-workbench/index.html', import.meta.url)),
    rd43: fileURLToPath(new URL('./src/tools/asset-inspector/index.html', import.meta.url)),
    rd51: fileURLToPath(new URL('./src/qa/combined-scene/index.html', import.meta.url)),
  } } } });
