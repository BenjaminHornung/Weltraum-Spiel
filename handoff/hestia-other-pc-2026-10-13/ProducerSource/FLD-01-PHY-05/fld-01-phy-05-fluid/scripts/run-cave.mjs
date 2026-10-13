import assert from 'node:assert/strict';
import { verifyBuild, hash } from './bindings.mjs';

const build = verifyBuild();
const { caveCounterexample, inspectCave } = await import('../dist/src/cave.js');
const counterexample = caveCounterexample();
const evaluated = [];
const projected = [];
for (const volumes of [counterexample.chamberVolumesA, counterexample.chamberVolumesB]) {
  const columns = new Map();
  counterexample.topology.chambers.forEach((chamber, i) => {
    const key = chamber.address.x + ':' + chamber.address.z;
    columns.set(key, (columns.get(key) ?? 0) + volumes[i]);
  });
  projected.push([...columns.entries()].sort());
  evaluated.push(inspectCave({ solidRoofs: counterexample.topology.solidRoofs,
    chambers: counterexample.topology.chambers.map((chamber, i) => ({ ...chamber, volumeML: volumes[i] })) }));
}
assert.deepEqual(counterexample.columnTotalsA, counterexample.columnTotalsB);
assert.deepEqual(projected[0], projected[1]);
assert.notDeepEqual(counterexample.chamberVolumesA, counterexample.chamberVolumesB);
assert.ok(evaluated.every(x => x.status === 'UNSUPPORTED' && x.allocatedCells === 0));
console.log(JSON.stringify({ schema: 'fluid-run/v1', domain: 'sealed-stacked-cave', status: 'UNSUPPORTED', codeOracle: 'PASS',
  environment: 'LOCAL_WINDOWS_ISOLATED', reference: 'NOT_RUN', productIntegration: 'NO', actualAdapter: 'NOT_REQUESTED_CPU_ONLY', gpuTimer: 'NOT_REQUESTED',
  sourceDigest: build.sourceDigest, outputDigest: build.outputDigest, counterexampleDigest: 'sha256:' + hash(JSON.stringify(counterexample)),
  counterexample, evaluated, projected, remaining: 'Separate conservative 3D/pressure resolver required before this domain can own water quantities' }));
