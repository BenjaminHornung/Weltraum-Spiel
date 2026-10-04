import { defineConfig } from 'vitest/config';

// Default Vitest stubs CSS even with ?raw; these source-binding checks need the actual owned CSS bytes.
export default defineConfig({ cacheDir: 'reports/RD-40/.vite', test: {
  include: ['tests/RD-40/unit.test.ts', 'tests/RD-40/repair.test.ts'], fileParallelism: false, maxWorkers: 1, testTimeout: 30_000, cache: false,
  css: { include: [/variant-gallery\/style\.css\?raw/] },
} });
