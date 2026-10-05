import { defineConfig } from 'vitest/config';
export default defineConfig({cacheDir:'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/phase2-16a5d29a-20261004-a/cache/vitest',
 test:{include:['tests/RD-13/*.test.ts'],maxWorkers:1,fileParallelism:false,testTimeout:60000}});
