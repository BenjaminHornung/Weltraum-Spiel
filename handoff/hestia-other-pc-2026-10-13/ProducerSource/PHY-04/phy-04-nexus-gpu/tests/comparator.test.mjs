import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from '../src/fixtures.mjs';
import { runComparator } from '../src/rapier-comparator.mjs';
test('actual .21 migration2 sourcefork satisfies finite CPU motion, mass, query and geometry controls', () => {
  for (const count of [10,100,1000]) {
    for (const scenario of ['freefall','zeroGravity']) assert.equal(runComparator(makeFixture(count,scenario)).status,'PASS');
  }
  assert.equal(runComparator(makeFixture(10,'dynamicGeometry')).geometryChanged,true);
});
test('invalid comparator inputs fail before native world creation', () => {
  assert.throws(() => runComparator({...makeFixture(10),dt:NaN}));
  assert.throws(() => runComparator({...makeFixture(10),count:11}));
});
