import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({ cacheDir: 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/phase1-d17d9704-20261004-a/cache/vite',
  publicDir: 'fixtures', build: { outDir: 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/phase1-d17d9704-20261004-a/build',
    emptyOutDir: false, rolldownOptions: { input: fileURLToPath(new URL('../../src/experiments/voxel-rays/index.html', import.meta.url)) } } });
