import { chromium } from './runtime/node_modules/playwright/index.mjs';
import { observeNative } from './observe-native.mjs';
import { Quaternion, Vector3 } from './runtime/node_modules/three/build/three.module.js';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const own = path.dirname(fileURLToPath(import.meta.url)), [id, build] = process.argv.slice(2);
assert(/^[a-z0-9-]+$/.test(id ?? '') && /^[a-z0-9-]+$/.test(build ?? ''));
const windowReceipt = JSON.parse(readFileSync(path.join(own, 'device-window.json')));
assert(Date.now() < Date.parse(windowReceipt.expiresUtc), 'Preserve A0 priority: window expired');
const run = path.join(own, 'runs', id); mkdirSync(run);
const browser = await chromium.launch({ headless: true, executablePath: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
await context.route('**/favicon.ico', r => r.fulfill({ status: 204 })); await context.addInitScript(observeNative);
const page = await context.newPage(), errors = [], cases = [], evidence = {};
page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const read = () => page.evaluate(() => window.TestBridge.read());
async function ready() {
  await page.waitForFunction(() => { const status = document.getElementById('status').textContent;
    return status.includes('Host render submitted') || status.startsWith('FAIL'); });
  const s = await read(); assert.equal(s.hidden, false, JSON.stringify(s));
  assert(s.diagnostics.host.submittedFrames > 0 && s.diagnostics.host.rendered);
  assert.deepEqual(s.facts.errors, []); return s;
}
async function action(button) {
  const before = await read(), submits = before.diagnostics.host?.submittedFrames ?? 0;
  await page.evaluate(id => document.getElementById(id).click(), button);
  await page.waitForFunction(() => !document.getElementById('remount').disabled);
  const state = await ready();
  if (button !== 'remount') assert(state.diagnostics.host.submittedFrames > submits);
  return state;
}
async function mount(fixture, variant = 'rays-no-ao') {
  await page.selectOption('#fixture', fixture); await page.selectOption('#variant', variant); return action('remount');
}
async function seek(tick) { await page.fill('#tick', String(tick)); return action('seek'); }
async function test(name, fn) {
  try { await fn(); cases.push({ name, status: 'PASS' }); }
  catch (error) { cases.push({ name, status: 'FAIL', reason: String(error) }); }
}
async function disposed() {
  await page.evaluate(() => document.getElementById('dispose').click());
  await page.waitForFunction(() => !document.getElementById('remount').disabled && document.getElementById('status').textContent.includes('Disposed'));
  return page.evaluate(() => ({ bridge: window.TestBridge.read(), native: window.__rdNative }));
}
try {
  const response = await page.goto('http://127.0.0.1:5280/src/experiments/voxel-rays/index.html?testBridge=1');
  assert.equal(createHash('sha256').update(await response.body()).digest('hex'),
    createHash('sha256').update(readFileSync(path.join(own, 'builds', build, 'src/experiments/voxel-rays/index.html'))).digest('hex'));
  await page.waitForFunction(() => !document.getElementById('remount').disabled);
  await test('visible F00 actual native compile/link/draw smoke', async () => {
    const state = await ready(), native = await page.evaluate(() => window.__rdNative);
    evidence.visibleSmoke = { state, compiled: native.compiled, linked: native.linked, draws: native.draws };
    assert(native.compiled.some(s => s.ok && s.code.includes('traceVisibleVoxels')));
    assert(native.compiled.filter(s => s.code.includes('traceVisibleVoxels')).every(s => s.ok));
    assert(native.linked.every(p => p.ok)); assert(native.draws.some(d => d.linkedProgram));
  });
  await test('RAY01 original: 12 native analytical cases and 5 actual fault controls', async () => {
    await mount('F00-CONTROL-REPLAY'); const result = evidence.ray01 = await page.evaluate(() => window.TestBridge.probeCases());
    assert.equal(result.results.length, 12); for (const { id, result: r } of result.results) assert.equal(r.status, 'PASS', id + ': ' + JSON.stringify(r));
    for (const r of result.faults) assert.equal(r.status, 'FAIL', JSON.stringify(r));
  });
  await test('RAY02 original tick90 invocation preserved', async () => {
    const before = await mount('F06-MATERIAL-REPLAY'), after = await seek(90);
    const result = await page.evaluate(() => window.TestBridge.probeEdit('material-room'));
    evidence.ray02Original = { before, after, result };
    assert.notEqual(after.facts.fixtureDigest, before.facts.fixtureDigest, 'Original tick90 precedes actual snapshot tick360');
    assert.equal(result.positive.status, 'PASS', JSON.stringify(result.positive));
    assert.equal(result.stale.status, 'FAIL'); assert.equal(result.proxy.status, 'FAIL');
  });
  await test('source-corrected RAY02 supplement: actual tick360 edit, stale upload, actual attachment depth', async () => {
    const before = await mount('F06-MATERIAL-REPLAY'), after = await seek(360);
    const result = await page.evaluate(() => window.TestBridge.probeEdit('material-room'));
    evidence.ray02Corrected = { before, after, result };
    assert.notEqual(after.facts.fixtureDigest, before.facts.fixtureDigest);
    assert.equal(result.positive.status, 'PASS', JSON.stringify(result.positive));
    assert.equal(result.stale.status, 'FAIL'); assert.equal(result.proxy.status, 'FAIL');
  });
  await test('RAY03 original tick60/120 invocation preserved', async () => {
    await mount('F04-DETACH-REPLAY'); await seek(60); const before = await page.evaluate(() => window.TestBridge.volumes());
    await seek(120); const result = await page.evaluate(async () => ({ volumes: window.TestBridge.volumes(),
      inside: await window.TestBridge.probe('fragment-wood', [.9375, 1.0625, .3125], [0, 1, 0]) }));
    evidence.ray03Original = { before, result }; assert.equal(result.inside.status, 'PASS', JSON.stringify(result));
    assert(result.inside.expected.t > 0, 'Original inside input must have a positive exit distance');
    const a = before.find(v => v.source.regionId === 'fragment-wood'), b = result.volumes.find(v => v.source.regionId === 'fragment-wood');
    assert.deepEqual(b.source.sourceIds, a.source.sourceIds); assert.equal(b.source.ownerId, a.source.ownerId);
  });
  await test('source-corrected RAY03 supplement: detached360 to rotated720; native inside-volume', async () => {
    await mount('F04-DETACH-REPLAY'); await seek(360); const before = await page.evaluate(() => window.TestBridge.volumes());
    await seek(720);
    const dir = path.join(own, 'reproduction/package-01/fixtures/F04-DETACH/snapshots/r2-rotate');
    const fixture = JSON.parse(readFileSync(path.join(dir, 'manifest.json'))), region = fixture.voxelRegions.find(r => r.id === 'fragment-wood');
    const owner = fixture.objects.find(o => o.ownerId === region.ownerId), payload = fixture.payloads.find(p => p.id === region.occupancyPayload);
    const bytes = readFileSync(path.join(dir, payload.path)), slot = bytes.findIndex(v => v !== 0), [sx, sy] = region.dimensions;
    assert(slot >= 0); const cell = [slot % sx, Math.floor(slot / sx) % sy, Math.floor(slot / (sx * sy))];
    const local = cell.map((n, a) => region.originMeters[a] + (n + .5) * fixture.quantumMeters);
    const rotation = new Quaternion(...owner.frame.rotationXyzw), rootRotation = new Quaternion(...fixture.frame.rotationXyzw);
    const origin = new Vector3(...local).applyQuaternion(rotation).add(new Vector3(...owner.frame.originMeters))
      .applyQuaternion(rootRotation).add(new Vector3(...fixture.frame.originMeters)).toArray();
    const direction = new Vector3(0, 1, 0).applyQuaternion(rotation).applyQuaternion(rootRotation).normalize().toArray();
    const result = await page.evaluate(async ({ origin, direction }) => ({ volumes: window.TestBridge.volumes(),
      inside: await window.TestBridge.probe('fragment-wood', origin, direction) }), { origin, direction });
    evidence.ray03Corrected = { before, authoritativeInput: { cell, local, origin, direction, payloadSha256: payload.sha256 }, result };
    assert.equal(result.inside.status, 'PASS', JSON.stringify(result));
    assert.equal(result.inside.expected.status, 'hit', 'Inside-volume control must actually hit');
    assert(result.inside.expected.t > 0, 'Inside-volume control needs a positive exit distance');
    const a = before.find(v => v.source.regionId === 'fragment-wood'), b = result.volumes.find(v => v.source.regionId === 'fragment-wood');
    assert.deepEqual(a.source.sourceIds, b.source.sourceIds); assert.equal(a.source.ownerId, b.source.ownerId);
  });
  await test('RAY04 original format admission failure retires old projection and explicit remount recovers', async () => {
    await mount('F00-CONTROL-REPLAY'); const failure = await page.evaluate(async () => { try { await window.TestBridge.failReplacement(); } catch (e) { return String(e); } });
    assert.match(failure, /RGBA8UI|format/i);
    await page.waitForFunction(() => window.TestBridge.read().diagnostics.terminal.disposed && document.getElementById('viewport').hidden);
    evidence.format = { failure, state: await read() }; await mount('F00-CONTROL-REPLAY');
  });
  await test('original selected F01 numeric solid/depth control and native proxy fault', async () => {
    await mount('F01-HVP-COAST-REPLAY'); const result = await page.evaluate(async () => {
      const d = [3, -1.75, 4], direction = d.map(v => v / Math.hypot(...d));
      return { state: window.TestBridge.read(), positive: await window.TestBridge.probe('coast-crop', [-2, 1.25, -6], direction),
        proxy: await window.TestBridge.probe('coast-crop', [-2, 1.25, -6], direction, 'proxy-depth') };
    }); evidence.f01 = result;
    assert.equal(result.state.diagnostics.host.frame.cameraId, 'C02-SHORE');
    assert(result.state.facts.unsupportedFeatures.includes('selected-f01-not-full-parity'));
    assert.equal(result.positive.status, 'PASS', JSON.stringify(result.positive)); assert.equal(result.proxy.status, 'FAIL');
    assert.equal(result.positive.device.classification, 'hardware-candidate');
    assert.equal(result.positive.expected.status, 'hit'); assert(result.positive.observed.attachmentDepth > 0);
  });
  await test('ordinary dispose native ownership control', async () => {
    await mount('F00-CONTROL-REPLAY', 'greedy-no-ao'); evidence.ordinaryDispose = await disposed();
    assert.equal(evidence.ordinaryDispose.bridge.hidden, true);
    assert(Object.values(evidence.ordinaryDispose.native.live).every(n => n === 0), 'Native objects remain after ordinary complete disposal');
  });
  for (const fault of ['compile', 'link']) await test('post-allocation ' + fault + ' failure: hidden terminal, no READY, idempotent dispose', async () => {
    await mount('F00-CONTROL-REPLAY', 'greedy-no-ao');
    await page.evaluate(f => { window.__rdNative.inject = f; }, fault);
    await page.selectOption('#variant', 'rays-no-ao'); await page.evaluate(() => document.getElementById('remount').click());
    await page.waitForFunction(() => !document.getElementById('remount').disabled && document.getElementById('status').textContent.startsWith('FAIL'));
    const failed = await page.evaluate(() => ({ bridge: window.TestBridge.read(), status: document.getElementById('status').textContent, native: window.__rdNative }));
    const first = await disposed(), second = await disposed(); evidence[fault] = { failed, first, second };
    assert.equal(failed.bridge.hidden, true); assert.equal(failed.bridge.diagnostics.terminal.disposed, true);
    assert(failed.native.events.some(e => e.injected && Object.values(e.live).some(n => n > 0)), 'Fault must occur after actual native allocations');
    assert(Object.values(second.native.live).every(n => n === 0), 'Owned native handles retained after failure disposal');
    assert.deepEqual(first.native.live, second.native.live); await mount('F00-CONTROL-REPLAY');
  });
  // Pixel comparisons are observations; only a faithful candidate may enter a cost A/B.
  const comparisons = [];
  for (const fixture of ['F00-CONTROL-REPLAY', 'F01-HVP-COAST-REPLAY']) {
    for (const variant of ['greedy-no-ao', 'rays-no-ao']) {
      const state = await mount(fixture, variant); const file = fixture + '-' + variant + '.png';
      await page.locator('#viewport').screenshot({ path: path.join(run, file) });
      comparisons.push({ fixture, variant, file, state });
    }
  }
  evidence.comparisons = comparisons;
  await test('original normal controls: actual Greedy, seek/reset/resize/dispose and no TestBridge', async () => {
    await page.goto('http://127.0.0.1:5280/src/experiments/voxel-rays/index.html');
    await page.waitForFunction(() => !document.getElementById('remount').disabled && document.getElementById('status').textContent.includes('Host render submitted'));
    assert.equal(await page.evaluate(() => Object.hasOwn(window, 'TestBridge')), false);
    await page.selectOption('#variant', 'greedy-no-ao'); await page.selectOption('#fixture', 'F03-SHELTER-REPLAY');
    await page.click('#remount'); await page.waitForFunction(() => !document.getElementById('remount').disabled);
    for (const button of ['seek', 'reset', 'pause', 'step']) {
      await page.fill('#tick', '120'); await page.click('#' + button);
      await page.waitForFunction(() => !document.getElementById('remount').disabled);
    }
    await page.selectOption('#resolution', '960x540'); await page.waitForFunction(() => !document.getElementById('remount').disabled);
    await page.selectOption('#dpr', '2'); await page.waitForFunction(() => !document.getElementById('remount').disabled);
    await page.click('#dispose'); await page.waitForFunction(() => !document.getElementById('remount').disabled);
    assert.equal(await page.locator('#viewport').isVisible(), false);
    evidence.normal = { status: await page.locator('#status').textContent(), facts: await page.locator('#facts').textContent(), native: await page.evaluate(() => window.__rdNative) };
  });
} finally {
  const native = await page.evaluate(() => window.__rdNative).catch(() => null);
  const report = { runId: id, build, windowReceipt, browser: browser.version(), node: process.version, cases, evidence, errors,
    native, productIntegrated: false, art: 'PENDING_OWNER', originalPopulationsPreserved: { native: '0/6', supplement: '2/4' } };
  writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await context.close(); await browser.close();
  process.exitCode = cases.some(c => c.status === 'FAIL') ? 1 : 0;
  console.log(JSON.stringify({ runId: id, cases: cases.map(({ name, status, reason }) => ({ name, status, reason })), nativeRemainingBeforePageClose: native?.live }));
}
