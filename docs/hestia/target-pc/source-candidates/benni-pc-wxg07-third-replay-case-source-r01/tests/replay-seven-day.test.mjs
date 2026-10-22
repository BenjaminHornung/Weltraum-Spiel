import test from 'node:test';
import assert from 'node:assert/strict';
import {loadFixture} from '../src/fixture.mjs';
import {encodeCheckpoint, decodeCheckpoint, digest, CatchUp} from '../src/checkpoint.mjs';

test('one-hour checkpoint plus seven-day tail equals full replay canonical bytes', (t) => {
  assert.equal(process.versions.node, '22.23.2');
  const {model, initial, binding, profile, grid} = loadFixture(32);
  const hour = 3600 * 120;
  const tail = 7 * 24 * hour;
  const target = hour + tail;
  assert.equal(grid.cells.length, 6144);
  assert.equal(profile.channels.length, 2);
  assert.equal(model.dtTicks, 72000);
  const frozenInitial = encodeCheckpoint(model, initial, binding);
  const prefix = model.replay(initial, hour);
  assert.equal(prefix.tick, hour);
  const checkpoint = encodeCheckpoint(model, prefix, binding);
  const restored = decodeCheckpoint(model, checkpoint, binding);
  assert.equal(restored.tick, hour);
  assert.equal(restored.steps, 6);
  assert.deepEqual(encodeCheckpoint(model, restored, binding), checkpoint);

  const job = new CatchUp(model, checkpoint, binding, target);
  let result = job.read();
  let pumps = 0;
  while (result.status === 'Pending') {
    assert.equal(result.targetTick, target);
    assert.ok(result.completedTick >= hour && result.completedTick < target);
    assert.equal(result.checkpoint, undefined);
    assert.ok(pumps < 8, 'seven-day tail exceeds fixed pump count');
    result = job.pump(127);
    pumps++;
  }
  assert.equal(result.status, 'Ready');
  assert.equal(result.tick, target);
  const final = decodeCheckpoint(model, result.checkpoint, binding);
  assert.equal(final.tick, target);
  assert.equal(final.steps - restored.steps, 1008);
  const full = model.replay(initial, target);
  assert.equal(full.tick, target);
  const expected = encodeCheckpoint(model, full, binding);
  assert.deepEqual(result.checkpoint, expected);
  assert.notDeepEqual(result.checkpoint, checkpoint);
  assert.deepEqual(encodeCheckpoint(model, initial, binding), frozenInitial);
  assert.equal(prefix.steps + (final.steps - restored.steps) + full.steps, 2028);
  t.diagnostic(JSON.stringify({n: 32, cells: grid.cells.length, channels: 2,
    checkpointTick: restored.tick, tailTicks: tail, targetTick: target,
    prefixSteps: prefix.steps, tailSteps: final.steps - restored.steps,
    fullSteps: full.steps, totalSteps: 2028, pumps, status: result.status,
    canonicalBytes: expected.length, finalDigest: digest(expected),
    initialDigest: digest(frozenInitial), wrongCheckpointRejected: true}));
});
