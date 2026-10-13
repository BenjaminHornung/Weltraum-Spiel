import test from 'node:test';
import assert from 'node:assert/strict';
import { createBasin } from '../dist/src/basin.js';
import { createPipe } from '../dist/src/pipe.js';
import { caveCounterexample } from '../dist/src/cave.js';

const binding = { owner: 'synthetic:fluid', revision: 0, digest: 'fixture:baseline' };
const basinConfig = () => ({ width: 2, height: 1, capacityML: 1000, floorML: [0, 0], volumesML: [800, 0],
  obstacles: ['open', 'open'], binding, maxEdgeML: 100, sources: [], drains: [], maxCells: 256, maxEvents: 64 });
const pipeConfig = () => ({ capacitiesML: [1000, 1000], contentsML: [800, 0], binding,
  pumpHead: 65536, valveQ16: 65536, maxFlowML: 100, leakML: 0, maxEvents: 64 });

test('independent two-cell transfer vector: 800/0 becomes 700/100 with zero ledger error', () => {
  const basin = createBasin(basinConfig());
  const result = basin.step(1, binding);
  assert.deepEqual(result.volumesML, [700, 100]);
  assert.equal(result.balance.errorML, 0);
});
test('independent pipe debit vector: 100 ml moves between tanks without particles', () => {
  const pipe = createPipe(pipeConfig());
  assert.deepEqual(pipe.step(1, binding).contentsML, [700, 100]);
});
test('closed stacked cave has a genuine projection counterexample', () => {
  const result = caveCounterexample();
  assert.equal(result.status, 'UNSUPPORTED');
  assert.deepEqual(result.columnTotalsA, result.columnTotalsB);
  assert.notDeepEqual(result.chamberVolumesA, result.chamberVolumesB);
  assert.equal(result.allocatedCells, 0);
});

export { binding, basinConfig, pipeConfig };
