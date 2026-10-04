import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Build-only phase1 config. No development/preview server or root wiring.
export default defineConfig({ cacheDir: process.env.HESTIA_RD12_COMMAND_ROOT + '/vite-cache', publicDir: 'fixtures',
  build: { rolldownOptions: { input: { rd12: fileURLToPath(new URL('../../src/experiments/babylon/index.html', import.meta.url)) } } } });
