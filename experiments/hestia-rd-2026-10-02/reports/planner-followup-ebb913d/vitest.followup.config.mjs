import { defineConfig } from './runtime/node_modules/vitest/dist/config.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
const own = path.dirname(fileURLToPath(import.meta.url)), lab = path.resolve(own, '../..'), deps = path.join(own, 'runtime/node_modules');
const runId = process.env.HESTIA_FOLLOWUP_RUN_ID;
if (!/^[a-z0-9-]+$/.test(runId ?? '')) throw Error('Set a fresh HESTIA_FOLLOWUP_RUN_ID');
if (existsSync(path.join(own, 'runs', runId + '.json'))) throw Error('Preserve prior single-file run; choose a fresh ID');
const run = path.join(own, 'runs', runId); mkdirSync(run); // EEXIST preserves every prior run.
export default defineConfig({ root: lab, cacheDir: path.join(own, 'runtime/vitest-cache'), resolve: { alias: {
  three: path.join(deps, 'three/build/three.module.js'), vitest: path.join(deps, 'vitest/dist/index.js') } },
  test: { include: ['tests/RD-32/unit.test.ts', 'tests/RD-51/unit.test.ts', 'tests/RD-13/unit.test.ts', 'reports/planner-followup-ebb913d/followup.test.ts'],
    fileParallelism: false, maxWorkers: 1, testTimeout: 120_000, cache: false,
    reporters: ['default', ['json', { outputFile: path.join(run, 'report.json') }]] } });
