import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Leaf build only. HEAD must separately add the real root entry after the candidate commit.
export default defineConfig({ root: fileURLToPath(new URL('../../', import.meta.url)), publicDir: 'fixtures', cacheDir: 'reports/RD-40/.vite',
  build: { emptyOutDir: false, rolldownOptions: { input: {
    rd40: fileURLToPath(new URL('../../src/tools/variant-gallery/index.html', import.meta.url)),
  } } } });
