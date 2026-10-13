import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { verifyBuild, fileBinding, hash } from './bindings.mjs';

const build = verifyBuild();
const { createPipe } = await import('../dist/src/pipe.js');
const f = JSON.parse(readFileSync(new URL('../fixtures/cases.json', import.meta.url)));
const start = process.hrtime.bigint();
const config = { ...structuredClone(f.pipeDefaults), binding: { ...f.binding }, contentsML: [1000, 0], valveQ16: 0, pumpHead: 0, leakML: 100 };
const pipe = createPipe(config), samples = [], visibleProjection = process.argv.includes('--show-projection');
for (let tick = 1; tick <= 120; tick++) {
  const result = pipe.step(tick, f.binding);
  assert.equal(result.contentsML.reduce((a, b) => a + b, 0) + result.ledger.leakedML, 1000);
  if (tick === 1) assert.deepEqual(result.contentsML, [900, 0]);
  if (tick === 2) assert.deepEqual(result.contentsML, [811, 0]);
  if ([1, 2, 120].includes(tick)) samples.push({ tick, contentsML: result.contentsML, lastLeakML: result.lastLeakML, balance: result.balance,
    projectionParticleCount: visibleProjection && result.lastLeakML > 0 ? 8 : 0 });
}
console.log(JSON.stringify({ schema: 'fluid-run/v1', domain: 'tank-pump-valve-leak', status: 'PASS', codeOracle: 'PASS',
  environment: 'LOCAL_WINDOWS_ISOLATED', reference: 'NOT_RUN', productIntegration: 'NO', actualAdapter: 'NOT_REQUESTED_CPU_ONLY', gpuTimer: 'NOT_REQUESTED',
  sourceDigest: build.sourceDigest, outputDigest: build.outputDigest, input: fileBinding('fixtures/cases.json'), ticks: 120, allocatedTanks: 2,
  authorityDigest: 'sha256:' + hash(JSON.stringify(pipe.checkpoint())), presentation: visibleProjection ? 'SYNTHETIC_COUNT_ONLY_NO_RENDERER' : 'NO_PARTICLES', samples,
  diagnosticWallMs: Number(process.hrtime.bigint() - start) / 1e6, hostLoad: 'UNCONTROLLED_CONCURRENT_SESSIONS; timing is not a benchmark' }));
