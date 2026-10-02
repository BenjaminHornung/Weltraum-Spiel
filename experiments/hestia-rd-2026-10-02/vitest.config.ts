import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/**/unit.test.ts'],
  fileParallelism: false, maxWorkers: 1, testTimeout: 30_000,
  cache: false } });
