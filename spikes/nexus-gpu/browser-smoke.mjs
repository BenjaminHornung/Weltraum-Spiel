// Execute the built PHY-04 harness on an allocated Chromium software-WebGPU runner.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';

const [web, output, runnerId, referencePath] = process.argv.slice(2);
if (!web || !output || !runnerId || !referencePath || !process.env.CHROMIUM_BIN) {
  throw Error('Use CHROMIUM_BIN=/path/to/chromium node browser-smoke.mjs WEB_DIRECTORY RECEIPT ALLOCATED_RUNNER_ID R05_REFERENCE_JSON');
}
const handoff = new URL('../../handoff/hestia-other-pc-2026-10-13/ProducerSource/', import.meta.url);
const app = new URL('../../apps/weltraum-browser/package.json', import.meta.url);
const { chromium } = createRequire(app)('playwright');
const referenceBytes = await readFile(referencePath);
const reference = JSON.parse(referenceBytes);
assert.equal(reference.wasmSha256, 'f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb');
assert.equal(reference.glueSha256, '3352d74638111c659bf50566af2be3f151040b1cd6a22310542ce3c5c46d2fea');
const files = new Map();
const build = JSON.parse(await readFile(path.join(web, 'bindings.json')));
for (const file of [build.module, build.wasm, ...build.shaders]) {
  const bytes = await readFile(path.join(web, file.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  files.set('/web/' + file.path, bytes);
}
files.set('/web/bindings.json', Buffer.from(JSON.stringify(build)));
for (const [url, source] of [
  ['/src/browser-runner.mjs', 'PHY-04/phy-04-nexus-gpu/src/browser-runner.mjs'],
  ['/src/fixtures.mjs', 'PHY-04/phy-04-nexus-gpu/src/fixtures.mjs'],
  ['/snapshot/plt/src/numerics.mjs', 'PLT-01-02/plt-01-02-numerics/src/numerics.mjs'],
]) files.set(url, await readFile(new URL(source, handoff)));

const types = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = createServer((request, response) => {
  if (request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Hestia PHY-04</title>');
    return;
  }
  const bytes = files.get(request.url);
  if (!bytes) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': types[path.extname(request.url)] ?? 'application/octet-stream' }).end(bytes);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
let page;
const report = { runnerId, softwareWebGpuRequested: true, referenceDevice: false, wasm: build.wasm,
  referenceSha256: createHash('sha256').update(referenceBytes).digest('hex'), events: [], runs: [] };
const persist = () => writeFile(output, JSON.stringify(report, null, 2) + '\n');
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN, headless: true,
    args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  report.chromium = browser.version();
  page = await browser.newPage();
  page.on('pageerror', error => report.events.push(String(error)));
  page.on('console', message => { if (report.events.length < 100) report.events.push(message.type() + ': ' + message.text()); });
  await page.addInitScript(() => {
    // Observe the adapter used by the actual WASM requestDevice call.
    window.phy04Adapters = [];
    window.phy04Losses = [];
    const original = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = function (...args) {
      const { vendor, architecture, description, isFallbackAdapter } = this.info;
      window.phy04Adapters.push({ vendor, architecture, description, isFallbackAdapter });
      const deviceRequest = original.apply(this, args);
      window.phy04Losses.push(deviceRequest.then(device => device.lost).then(info => info.reason, () => 'request-failed'));
      return deviceRequest;
    };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async () => {
    const { runBoundNexus } = await import('/src/browser-runner.mjs');
    const bindings = await (await fetch('/web/bindings.json')).json();
    window.runNexus = args => runBoundNexus({ ...args, bindings, fetchBytes: async file => {
      const response = await fetch('/web/' + file);
      if (!response.ok) throw Error(file + ': ' + response.status);
      return response.arrayBuffer();
    } });
  });
  const lease = { runnerId, task: 'PHY-04', slotGranted: true };
  for (const [count, scenario] of [[10, 'zeroGravity'], [10, 'freefall'], [10, 'dynamicGeometry'],
    [100, 'zeroGravity'], [100, 'freefall'], [1000, 'zeroGravity'], [1000, 'freefall'], [10, 'zeroGravity']]) {
    if (report.runs.length === 7) {
      report.deviceLoss = await page.evaluate(async lease => {
        const start = window.phy04Losses.length;
        let rejection;
        try { await window.runNexus({ count: 10, scenario: 'zeroGravity', destroyAtTick: 5, lease }); }
        catch (error) { rejection = String(error); }
        const loss = window.phy04Losses[start];
        const reason = loss && await Promise.race([loss, new Promise(resolve => setTimeout(() => resolve('timeout'), 5000))]);
        return { rejection, reason };
      }, lease);
      await persist();
      assert.equal(report.deviceLoss.reason, 'destroyed');
      assert.match(report.deviceLoss.rejection, /DEVICE_DESTROY_REQUESTED_DEVICELOSS_ACK_NOT_PROVEN/);
    }
    const { positions, velocities, ...run } = await page.evaluate(async ({ count, scenario, lease }) => {
      const { makeFixture } = await import('/src/fixtures.mjs');
      const fixture = makeFixture(count, scenario);
      const offset = window.phy04Adapters.length;
      const result = await window.runNexus({ count, scenario, lease });
      const { rows, ...timing } = result;
      let maxPositionError = 0;
      let maxVelocityError = 0;
      for (const body of rows) for (let axis = 0; axis < 3; axis++) {
        maxPositionError = Math.max(maxPositionError, Math.abs(body.position[axis] - body.oracle.position[axis]));
        maxVelocityError = Math.max(maxVelocityError, Math.abs(body.velocity[axis] - body.oracle.velocity[axis]));
      }
      return { ...timing, positions: rows.map(row => row.position), velocities: rows.map(row => row.velocity),
        adapters: window.phy04Adapters.slice(offset), rows: rows.length, maxPositionError, maxVelocityError,
        positionTolerance: Math.abs(fixture.gravity[1]) * fixture.dt ** 2 * fixture.steps / 2 + 0.003, velocityTolerance: 0.0002 };
    }, { count, scenario, lease });
    const cpu = reference.matrix.find(row => row.count === count && row.scenario === scenario);
    assert.equal(run.fixtureSha256, cpu.fixtureSha256);
    assert.equal(cpu.rows.length, run.rows);
    let maxR05PositionDelta = 0;
    let maxR05VelocityDelta = 0;
    for (const body of cpu.rows) for (let axis = 0; axis < 3; axis++) {
      maxR05PositionDelta = Math.max(maxR05PositionDelta, Math.abs(positions[body.id][axis] - body.position[axis]));
      maxR05VelocityDelta = Math.max(maxR05VelocityDelta, Math.abs(velocities[body.id][axis] - body.velocity[axis]));
    }
    run.rapierR05 = { maxR05PositionDelta, maxR05VelocityDelta };
    report.runs.push(run);
    await persist();
    assert.equal(run.rows, count);
    assert.ok(run.adapters.length, 'the harness must request a WebGPU device');
    assert.ok(run.maxPositionError <= run.positionTolerance, 'analytical position bound');
    assert.ok(run.maxVelocityError <= run.velocityTolerance, 'analytical velocity bound');
  }
  report.freshDeviceAfterLoss = true;
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  report.requestedDeviceAdapters = await page?.evaluate(() => window.phy04Adapters).catch(() => undefined);
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await persist();
}
