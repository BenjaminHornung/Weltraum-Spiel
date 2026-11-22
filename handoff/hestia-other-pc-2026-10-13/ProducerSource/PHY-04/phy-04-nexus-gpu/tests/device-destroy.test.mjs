import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { runBoundNexus } from '../src/browser-runner.mjs';

// Exercise the production runner up to its verified WASM module boundary.
// The adapter double never opens a device or runs a solver.
function boundCall(runFixture) {
  const bytes = Uint8Array.of(1, 2, 3);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return {
    lease: { task: 'PHY-04', runnerId: 'adapter-unit-test', slotGranted: true },
    bindings: {
      status: 'PASS',
      wasm: { path: 'fixture.wasm', sha256 },
      module: { path: 'fixture.mjs', sha256 },
      shaders: [{ path: 'fixture.spv', sha256 }]
    },
    fetchBytes: async () => bytes,
    loadModule: async () => ({ default: async () => {}, run_fixture: runFixture })
  };
}

test('ordinary runs omit the destroy tick and retain their readback result', async () => {
  let called = false;
  const args = boundCall(async (_lease, count, _zero, _geometry, _velocities, tick) => {
    called = true;
    assert.equal(tick, undefined);
    return new Float32Array(6 + count * 6);
  });
  const result = await runBoundNexus(args);
  assert.equal(called, true);
  assert.equal(result.deviceLoss, 'NOT_RUN');
  assert.equal(result.rows.length, 10);
});

test('a controlled destroy reaches the harness and preserves its unconfirmed response', async () => {
  let called = false;
  const reason = 'DEVICE_DESTROY_REQUESTED_DEVICELOSS_ACK_NOT_PROVEN';
  const args = boundCall(async (_lease, count, _zero, _geometry, _velocities, tick) => {
    called = true;
    assert.equal(count, 10);
    assert.equal(tick, 5);
    throw reason; // wasm-bindgen rejects with a string for JsValue::from_str.
  });
  await assert.rejects(runBoundNexus({ ...args, destroyAtTick: 5 }), error => error === reason);
  assert.equal(called, true);
});

test('a successful pose readback cannot satisfy a requested destroy', async () => {
  const args = boundCall(async () => new Float32Array(66));
  await assert.rejects(runBoundNexus({ ...args, destroyAtTick: 5 }), /DESTROY_RETURNED_READBACK/);
});

test('loss and unrelated harness failures retain their original reason', async () => {
  for (const reason of ['DEVICE_LOST:Unknown:adapter reset', new Error('dispatch failed')]) {
    const args = boundCall(async () => { throw reason; });
    await assert.rejects(runBoundNexus({ ...args, destroyAtTick: 5 }), error => error === reason);
  }
});

test('invalid or unleased destroy requests stop before fetching any bound bytes', async () => {
  const args = boundCall(() => assert.fail('unexpected module invocation'));
  args.fetchBytes = () => assert.fail('unexpected asset fetch');
  for (const destroyAtTick of [0, 4, 6, null, '5', NaN]) {
    await assert.rejects(runBoundNexus({ ...args, destroyAtTick }), /INVALID_DESTROY_FIXTURE/);
  }
  await assert.rejects(runBoundNexus({ ...args, count: 100, destroyAtTick: 5 }), /INVALID_DESTROY_FIXTURE/);
  await assert.rejects(runBoundNexus({ ...args, lease: undefined, destroyAtTick: 5 }), /SLOT_REQUIRED/);
});
