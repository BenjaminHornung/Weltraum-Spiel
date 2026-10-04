import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({cacheDir:'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/repair-36ba3cf3-20261004-a/cache/vite',
  publicDir:'fixtures',build:{outDir:'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/repair-36ba3cf3-20261004-a/build-cpu',emptyOutDir:false,
    rolldownOptions:{input:fileURLToPath(new URL('../../../src/experiments/voxel-rays/index.html',import.meta.url))}}});
