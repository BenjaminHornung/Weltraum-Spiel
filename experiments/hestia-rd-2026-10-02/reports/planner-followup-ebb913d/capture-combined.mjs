import { chromium } from './runtime/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const own = path.dirname(fileURLToPath(import.meta.url)), [id, build] = process.argv.slice(2);
assert(/^[a-z0-9-]+$/.test(id ?? '') && /^[a-z0-9-]+$/.test(build ?? ''));
const windowReceipt = JSON.parse(readFileSync(path.join(own, 'device-window.json')));
assert(Date.now() < Date.parse(windowReceipt.expiresUtc), 'Preserve A0 priority');
const run = path.join(own, 'runs', id); mkdirSync(run);
const browser = await chromium.launch({ headless: true, executablePath: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1,
  recordVideo: { dir: run, size: { width: 1400, height: 1000 } } });
await context.route('**/favicon.ico', r => r.fulfill({ status: 204 }));
const page = await context.newPage(), observations = [], errors = [];
page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const rendered = () => page.waitForFunction(() => { const s = JSON.parse(document.getElementById('facts').textContent);
  return s.diagnostics?.rendered?.frameVersion === s.diagnostics?.frameVersion && s.diagnostics?.rendered?.fixtureDigest === s.facts?.fixtureDigest; });
try {
  await page.goto('http://127.0.0.1:5280/src/qa/combined-scene/index.html');
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('Bereit'));
  await page.click('#mount'); await rendered();
  for (const tick of [300, 420, 600, 960, 1260, 1500, 300]) {
    await page.fill('#tick', String(tick)); await page.click('#seek'); await rendered();
    await page.locator('#viewMode').selectOption(tick === 420 || tick === 600 ? 'wetness' : 'color'); await rendered();
    const state = JSON.parse(await page.locator('#facts').textContent());
    assert.equal(state.clock.tick, tick); assert.deepEqual(state.facts.errors, []);
    const filename = 'tick-' + tick + '-' + (observations.length + 1) + '.png';
    const png = await page.locator('canvas').screenshot({ path: path.join(run, filename) });
    observations.push({ ...state, capture: { filename, bytes: png.length, sha256: createHash('sha256').update(png).digest('hex'),
      width: png.readUInt32BE(16), height: png.readUInt32BE(20) } });
  }
  await page.click('#play');
  await page.waitForFunction(() => JSON.parse(document.getElementById('facts').textContent).clock.tick >= 330);
  await page.click('#pause'); await rendered(); observations.push(JSON.parse(await page.locator('#facts').textContent()));
  await page.click('#dispose'); const cleanup = JSON.parse(await page.locator('#facts').textContent());
  assert.deepEqual(cleanup.liveHosts, { renderers: 0, renderloops: 0, hostListeners: 0 }); assert.deepEqual(errors, []);
  writeFileSync(path.join(run, 'report.json'), JSON.stringify({ runId: id, build, windowReceipt, observations, cleanup, errors,
    currentExposureModel: 'current-exposure-analytic; reset-at-snapshot; current exposure applied to bounded history, not stored prior poses or Save wetness',
    camera: 'Fixed preset corridor only; freelook/hysteresis/product camera-shadow integration remain unqualified',
    video: 'Actual running UI capture; not a realtime throughput or human ART pass', art: 'PENDING_OWNER', productIntegrated: false }, null, 2) + '\n', { flag: 'wx' });
} finally { await context.close(); await browser.close(); }
console.log(JSON.stringify({ runId: id, observations: observations.length, errors }));
