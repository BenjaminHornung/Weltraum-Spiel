import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const launcher = fileURLToPath(new URL('../../reports/RD-12/phase2-launch.mjs', import.meta.url));
const source = readFileSync(launcher, 'utf8');
const boundary = source.indexOf('const accepted = new Set();');
assert(boundary > 0, 'Evaluate the actual owning footer, never a mirrored algorithm');
const footer = source.slice(boundary);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
console.log(`CPU_ONLY_ACTUAL_FOOTER source=${sha(Buffer.from(source))}; no launcher import/native execution`);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

function control() {
  const job = deferred(), receipt = deferred();
  const requests = new Map(), runs = [], errors = [], events = [];
  const bindings = [{ path: 'CONTROLLED_CPU_ONLY', sha256: 'mock' }];
  let interval, deadline, stop = false, exitCode = 0;
  const sandbox = {
    assert, Buffer, sha, commands: 'C:/IFI_SourceCode/CONTROLLED_CPU_ONLY',
    ownBindings: () => bindings,
    existsSync: (file) => { assert(file.endsWith('/launcher/stop.json')); return stop; },
    readdirSync: (directory) => { assert(directory.endsWith('/launcher')); return [...requests.keys()]; },
    json: (file) => requests.get(file.slice(file.lastIndexOf('/') + 1)),
    fresh: (file, data) => { errors.push({ file, data }); events.push('owned-error-receipt'); },
    console: { log: () => {}, error: () => {} },
    process: {
      get exitCode() { return exitCode; },
      set exitCode(value) { exitCode = value; events.push(`exit:${value}`); },
    },
    setInterval: (callback, delay) => { assert.equal(delay, 200); interval = { callback, active: true }; return interval; },
    clearInterval: (handle) => { assert.equal(handle, interval); interval.active = false; },
    setTimeout: (callback, delay) => { assert.equal(delay, 7_200_000); deadline = { callback, active: true }; return deadline; },
    clearTimeout: (handle) => { assert.equal(handle, deadline); deadline.active = false; },
    run: async (...args) => { runs.push(args); await job.promise; await receipt.promise; events.push('owned-job-receipt'); },
  };
  runInNewContext(footer, sandbox, { filename: launcher, timeout: 1_000 });
  return {
    job, receipt, runs, errors, events,
    get active() { return interval.active; },
    get deadlineActive() { return deadline.active; },
    get exitCode() { return exitCode; },
    request(label) {
      requests.set(`request-${label}.json`, { label, config: 'reports/RD-12/native-functional-v2.config.ts',
        ownBindingsSha256: sha(Buffer.from(JSON.stringify(bindings))) });
    },
    stop() { stop = true; },
    poll() { if (interval.active) { return interval.callback(); } },
    expire() { if (deadline.active) { deadline.active = false; deadline.callback(); } },
  };
}

test('idle deadline stops control immediately with nonzero status', async () => {
  const clock = control(); clock.expire();
  assert.equal(clock.active, false); assert.equal(clock.exitCode, 1);
  clock.request('later'); await clock.poll(); assert.equal(clock.runs.length, 0);
});

test('busy deadline stays latched through owned receipt and rejects later requests', async () => {
  const clock = control(); clock.request('first'); const pending = clock.poll();
  assert.equal(clock.runs.length, 1); clock.expire(); clock.request('later');
  await clock.poll(); assert.equal(clock.runs.length, 1); assert.equal(clock.exitCode, 0);
  clock.job.resolve(); await Promise.resolve();
  await clock.poll(); assert.equal(clock.runs.length, 1); assert.equal(clock.active, true);
  assert.deepEqual(clock.events, [], 'Do not exit before the owned job receipt settles');
  clock.receipt.resolve(); await pending;
  assert.equal(clock.active, false, 'Busy expiry must not be forgotten');
  assert.equal(clock.exitCode, 1); assert.deepEqual(clock.events, ['owned-job-receipt', 'exit:1']);
  await clock.poll(); assert.equal(clock.runs.length, 1);
});

test('expired job rejection persists error receipt then closes in finally', async () => {
  const clock = control(); clock.request('first'); const pending = clock.poll();
  clock.expire(); clock.request('later'); await clock.poll();
  assert.equal(clock.runs.length, 1); clock.job.reject(new Error('controlled owned job rejection')); await pending;
  assert.equal(clock.errors.length, 1); assert.match(clock.errors[0].data.error, /controlled owned job rejection/);
  assert.equal(clock.active, false, 'Throw path must also honor latched expiry');
  assert.equal(clock.exitCode, 1); assert.deepEqual(clock.events, ['owned-error-receipt', 'exit:1']);
  await clock.poll(); assert.equal(clock.runs.length, 1);
});

test('cooperative stop waits for owned receipt then closes normally without extra work', async () => {
  const clock = control(); clock.request('first'); const pending = clock.poll();
  clock.stop(); clock.request('later'); await clock.poll(); assert.equal(clock.runs.length, 1);
  clock.job.resolve(); clock.receipt.resolve(); await pending;
  await clock.poll(); assert.equal(clock.active, false); assert.equal(clock.deadlineActive, false);
  assert.equal(clock.exitCode, 0); clock.expire(); await clock.poll();
  assert.equal(clock.exitCode, 0); assert.equal(clock.runs.length, 1);
  assert.deepEqual(clock.events, ['owned-job-receipt']);
});
