import { defineConfig } from 'vitest/config';

// Execution budget v2 only: frozen v1 oracle performs millions of individual
// F01 assertions. Original shared-budget timeout receipts remain evidence.
// No numeric/visual acceptance threshold or SDK 15s deadline is changed.
export default defineConfig({ cacheDir: process.env.HESTIA_RD12_COMMAND_ROOT + '/vitest-cache',
  test: { include: ['tests/RD-12/unit.test.ts', 'tests/RD-12/ownership.unit.test.ts', 'tests/RD-12/repair.unit.test.ts', 'tests/RD-12/native-config.unit.test.ts'], fileParallelism: false, maxWorkers: 1, testTimeout: 120_000, cache: false } });
