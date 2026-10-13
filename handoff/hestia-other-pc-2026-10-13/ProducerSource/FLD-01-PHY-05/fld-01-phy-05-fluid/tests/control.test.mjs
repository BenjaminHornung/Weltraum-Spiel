import test from 'node:test';
import assert from 'node:assert/strict';
import { threefry2x32, q16Smoothstep, normalizeIdentity } from '../inputs/plt/src/numerics.mjs';
import { createUniverseClock, advanceUniverseTicks, UNIVERSE_TICKS_PER_SECOND } from '../inputs/plt/snapshot/time.mjs';

test('unchanged frozen PLT published RNG vector and tick control', () => {
  assert.deepEqual(threefry2x32([0, 0], [0, 0]), [0x6b200159, 0x99ba4efe]);
  assert.equal(q16Smoothstep(32768), 32768);
  assert.equal(normalizeIdentity('e\u0301'), '\u00e9');
  assert.equal(UNIVERSE_TICKS_PER_SECOND, 120);
  assert.deepEqual(advanceUniverseTicks(createUniverseClock(0), 120), { tick: 120, epochSeconds: 1 });
  assert.throws(() => createUniverseClock(NaN));
  assert.throws(() => advanceUniverseTicks(createUniverseClock(Number.MAX_SAFE_INTEGER), 1));
});
