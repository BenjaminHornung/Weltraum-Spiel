import { chromium } from './runtime/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const own = path.dirname(fileURLToPath(import.meta.url)), id = process.argv[2] ?? 'package-smoke-02', run = path.join(own, 'runs', id);
mkdirSync(run); // fresh evidence only
const browser = await chromium.launch({ headless: true,
  executablePath: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
// Browser-added optional favicon is absent in the original archive; preserve the first 404 run.
await context.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
const page = await context.newPage(), errors = [], pages = [];
page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const hash = b => createHash('sha256').update(b).digest('hex');
try {
  for (const [route, button, status] of [
    ['/src/qa/combined-scene/index.html', '#mount', 'Kombinierte Strecke aktiv'],
    ['/src/tools/foliage-workbench/index.html', '#preview', ''],
    ['/src/tools/weather-workbench/index.html', '#mount', ''],
    ['/src/tools/asset-inspector/index.html', '#mount', ''],
  ]) {
    const response = await page.goto('http://127.0.0.1:5280' + route);
    assert.equal(response.status(), 200);
    const body = await response.body();
    assert.equal(hash(body), hash(readFileSync(path.join(own, 'reproduction/package-01/dist', route))));
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('Bereit'));
    await page.waitForFunction(selector => !document.querySelector(selector)?.disabled, button);
    await page.locator(button).click();
    if (status) await page.waitForFunction(s => document.getElementById('status').textContent === s, status);
    await page.waitForFunction(() => {
      const s = JSON.parse(document.getElementById('facts').textContent);
      const d = s.diagnostics ?? s.host;
      return d?.submittedFrames > 0 && d.rendered;
    });
    const state = await page.locator('#facts').textContent();
    assert.equal(await page.evaluate(() => Object.hasOwn(window, 'TestBridge')), false);
    assert.equal(await page.locator('canvas').count(), 1);
    const name = route.split('/').at(-2);
    await page.locator('canvas').screenshot({ path: path.join(run, name + '.png') });
    writeFileSync(path.join(run, name + '.json'), state + '\n', { flag: 'wx' });
    pages.push({ route, htmlSha256: hash(body), status: await page.locator('#status').textContent(), observed: true });
    await page.locator('#dispose').click();
  }
  assert.deepEqual(errors, []);
  writeFileSync(path.join(run, 'report.json'), JSON.stringify({ runId: id, browser: browser.version(), optionalFaviconSuppressed: true,
    playwright: JSON.parse(readFileSync(path.join(own, 'runtime/node_modules/playwright/package.json'))).version,
    sourceState: 'ORIGINAL_PACKAGE_UNCOMMITTED_HASH_BOUND', executionAnchor: '16a5d29a5cddea372abae139da618aa000a058be',
    publishedCommit: 'ebb913d133f4109a8898e70e9b0889edcc2d7662', manifestSha256: '254a797d75646c8f390832483dfabb05bb291c0bd84ace1c33e55f5156ddc170',
    pages, errors, productIntegrated: false, qualification: 'FUNCTIONAL_SMOKE_ONLY' }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ pages: pages.length, errors, browser: browser.version() }));
} finally { await context.close(); await browser.close(); }
