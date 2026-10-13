import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { root, verifyBuild, fileBinding, hash } from './bindings.mjs';

const build = verifyBuild();
const { createBasin } = await import('../dist/src/basin.js');
const f = JSON.parse(readFileSync(new URL('../fixtures/cases.json', import.meta.url)));
const start = process.hrtime.bigint();
const config = { ...structuredClone(f.basinDefaults), binding: { ...f.binding } };
const basin = createBasin(config), samples = [];
for (let tick = 1; tick <= f.dam.endTick; tick++) {
  const events = tick === f.dam.openingTick ? [f.dam.event] : [];
  const result = basin.step(tick, basin.snapshot().binding, events);
  assert.equal(result.volumesML.reduce((a, b) => a + b, 0), 800);
  if (tick === 3) assert.deepEqual(result.volumesML, [800, 0, 0]);
  if (tick === 4) assert.deepEqual(result.volumesML, [700, 100, 0]);
  if (tick === 5) assert.deepEqual(result.volumesML, [600, 175, 25]);
  if ([3, 4, 5, f.dam.endTick].includes(tick)) samples.push({ tick, volumesML: result.volumesML, balance: result.balance });
}
const final = basin.snapshot(); assert.ok(final.volumesML[2] > 0);
console.log(JSON.stringify({ schema: 'fluid-run/v1', domain: 'dam-basin', status: 'PASS', codeOracle: 'PASS',
  environment: 'LOCAL_WINDOWS_ISOLATED', reference: 'NOT_RUN', productIntegration: 'NO', actualAdapter: 'NOT_REQUESTED_CPU_ONLY', gpuTimer: 'NOT_REQUESTED',
  sourceDigest: build.sourceDigest, outputDigest: build.outputDigest, input: fileBinding('fixtures/cases.json'), ticks: 180, allocatedCells: 3,
  authorityDigest: 'sha256:' + hash(JSON.stringify(basin.checkpoint())), samples,
  diagnosticWallMs: Number(process.hrtime.bigint() - start) / 1e6, hostLoad: 'UNCONTROLLED_CONCURRENT_SESSIONS; timing is not a benchmark' }));
