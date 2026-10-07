import { chromium } from './runtime/node_modules/playwright/index.mjs';
import { observeCombined, compactCall } from './observe-combined.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const own = path.dirname(fileURLToPath(import.meta.url)), [id, build, mode = 'timing'] = process.argv.slice(2);
assert(/^[a-z0-9-]+$/.test(id ?? '') && /^[a-z0-9-]+$/.test(build ?? ''));
assert(['timing', 'profile'].includes(mode));
const windowReceipt = JSON.parse(readFileSync(path.join(own, 'device-window.json')));
assert(Date.now() < Date.parse(windowReceipt.expiresUtc), 'A0 device window expired; preserve its priority');
const run = path.join(own, 'runs', id); mkdirSync(run);
const browser = await chromium.launch({ headless: true,
  executablePath: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
await context.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
await context.addInitScript(observeCombined);
const page = await context.newPage(), errors = [], populations = [];
page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const entry = '/src/qa/combined-scene/index.html', cdp = await context.newCDPSession(page);
const state = () => page.evaluate(() => JSON.parse(document.getElementById('facts').textContent));
const rendered = () => page.waitForFunction(() => {
  const s = JSON.parse(document.getElementById('facts').textContent);
  return s.diagnostics?.rendered?.frameVersion === s.diagnostics?.frameVersion
    && s.diagnostics?.rendered?.fixtureDigest === s.facts?.fixtureDigest;
});
async function click(id) { await page.evaluate(id => document.getElementById(id).click(), id); }
async function seek(tick) {
  await page.evaluate(tick => { document.getElementById('tick').value = String(tick); document.getElementById('seek').click(); }, tick);
  await rendered(); const s = await state(); assert.equal(s.clock.tick, tick); assert.deepEqual(s.facts.errors, []); return s;
}
async function collect(name, action) {
  const before = await page.evaluate(() => ({ at: performance.now(), calls: window.__rdTrace.calls.length, events: window.__rdTrace.renderEvents.length, clears: window.__rdTrace.nativeClears, draws: window.__rdTrace.draws }));
  const nativeBefore = (await state()).diagnostics?.submittedFrames ?? 0;
  await action();
  const after = await page.evaluate(() => ({ at: performance.now(), calls: window.__rdTrace.calls.slice(), events: window.__rdTrace.renderEvents.slice(), clears: window.__rdTrace.nativeClears, draws: window.__rdTrace.draws }));
  const final = await state();
  populations.push({ name, wallMs: after.at - before.at, nativeSubmitsBefore: nativeBefore,
    observedNativeClearPasses: after.clears - before.clears, observedNativeDraws: after.draws - before.draws,
    nativeSubmitsAfter: final.diagnostics?.submittedFrames ?? 0, distinctRenderEvents: after.events.slice(before.events),
    calls: after.calls.slice(before.calls).map(compactCall), final: { tick: final.clock.tick, device: final.diagnostics?.device,
      resolution: final.diagnostics?.resolution, sourceDigest: final.facts?.fixtureDigest,
      rendered: final.diagnostics?.rendered, liveHosts: final.liveHosts } });
}
try {
  const response = await page.goto('http://127.0.0.1:5280' + entry);
  const htmlSha = createHash('sha256').update(await response.body()).digest('hex');
  assert.equal(htmlSha, createHash('sha256').update(readFileSync(path.join(own, 'builds', build, entry))).digest('hex'));
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('Bereit'));
  await page.evaluate(() => window.__rdInstallUI());
  await click('mount'); await rendered();
  const environment = await state();
  if (mode === 'profile') {
    await seek(300); await page.evaluate(() => window.__rdObserveCache());
    await cdp.send('Performance.enable'); await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
    const anchorMetrics = (await cdp.send('Performance.getMetrics')).metrics;
    const anchorNow = await page.evaluate(() => performance.now());
    await cdp.send('Profiler.start');
    await collect('profile-running-changing-direction', async () => {
      await click('play'); await page.waitForFunction(() => window.__rdTrace.calls.filter(c => c.kind === 'running').length >= 24, undefined, { timeout: 90_000 });
      await click('pause'); await rendered();
    });
    await collect('profile-warm-unchanged', async () => { const tick = (await state()).clock.tick; for (let i = 0; i < 6; i++) await seek(tick); });
    await collect('profile-transitions', async () => { for (const tick of [600, 960, 120, 1260]) await seek(tick); });
    const { profile } = await cdp.send('Profiler.stop');
    writeFileSync(path.join(run, 'cpu.cpuprofile'), JSON.stringify(profile), { flag: 'wx' });
    writeFileSync(path.join(run, 'profile-anchor.json'), JSON.stringify({ anchorMetrics, anchorNow,
      cache: await page.evaluate(() => ({ gets: window.__rdTrace.cacheGets, hits: window.__rdTrace.cacheHits, clears: window.__rdTrace.cacheClears })) }, null, 2), { flag: 'wx' });
  } else {
    await collect('cold-first-wet-refresh', async () => {
      for (let i = 0; i < 4; i++) { if (i) { await click('dispose'); await click('mount'); await rendered(); } await seek(240); await seek(300); }
    });
    await collect('warm-identical-tick', async () => { for (let i = 0; i < 12; i++) await seek(300); });
    await collect('continuous-changing-direction', async () => {
      await click('play'); await page.waitForFunction(() => window.__rdTrace.calls.filter(c => c.kind === 'running').length >= 24, undefined, { timeout: 90_000 });
      await click('pause'); await rendered();
    });
    for (const [name, ticks] of [['roof-opening', [420, 600]], ['owner-rotation', [780, 960]],
      ['backward-seek', [300, 120]], ['source-reload', [1140, 1260]]]) {
      await collect(name, async () => { for (let i = 0; i < 3; i++) for (const tick of ticks) await seek(tick); });
    }
    await seek(300); await page.locator('canvas').screenshot({ path: path.join(run, 'same-tick-color.png') });
    const imageState = await state(); writeFileSync(path.join(run, 'same-tick-binding.json'), JSON.stringify(imageState, null, 2), { flag: 'wx' });
  }
  await click('dispose'); const cleanup = await state();
  assert.deepEqual(cleanup.liveHosts, { renderers: 0, renderloops: 0, hostListeners: 0 });
  assert.equal(cleanup.mounts, 0); assert.deepEqual(errors, []);
  const report = { runId: id, build, mode, browser: browser.version(), node: process.version, windowReceipt,
    environment: { backend: environment.diagnostics.backend, device: environment.diagnostics.device,
      resolution: environment.diagnostics.resolution, colorSpace: environment.diagnostics.colorSpace,
      toneMapping: environment.diagnostics.toneMapping, exposure: environment.diagnostics.exposure,
      viewport: { width: 1400, height: 1000 }, dpr: 1, htmlSha256: htmlSha }, populations, cleanup, errors,
    qualification: 'EXCLUSIVE_DEVICE_COST_DIAGNOSTIC_NOT_PRODUCT_RELEASE', productIntegrated: false,
    method: 'Existing UI handlers/timer; work spans end after final full facts DOM write. Wall spans include observation waits and native frame/layout scheduling. Clean timing has no CPU profiler or cache hooks. Native submits are actual renderer submissions with draw-call observations; compositor present cadence and GPU duration are not measured.' };
  writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ runId: id, mode, populations: populations.map(p => ({ name: p.name, calls: p.calls.length, wallMs: p.wallMs })) }));
} finally { await context.close(); await browser.close(); }
