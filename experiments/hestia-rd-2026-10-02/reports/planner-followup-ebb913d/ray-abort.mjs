import { chromium } from './runtime/node_modules/playwright/index.mjs';
import { observeNative } from './observe-native.mjs';
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
const entry = 'reports/planner-followup-ebb913d/native-abort.html';
const browser = await chromium.launch({ headless: true,
  executablePath: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe' });
const context = await browser.newContext(); await context.addInitScript(observeNative);
await context.route('**/favicon.ico', r => r.fulfill({ status: 204 }));
const cases = [], evidence = {};
try {
  for (const mode of ['ready', 'during-init', 'before-init']) {
    const page = await context.newPage();
    try {
      const response = await page.goto('http://127.0.0.1:5280/' + entry);
      assert.equal(createHash('sha256').update(await response.body()).digest('hex'),
        createHash('sha256').update(readFileSync(path.join(own, 'builds', build, entry))).digest('hex'));
      await page.waitForFunction(() => typeof window.FollowupAbortProbe === 'function');
      const result = evidence[mode] = await page.evaluate(m => window.FollowupAbortProbe(m), mode);
      if (mode === 'ready') {
        assert.equal(result.before.state.hidden, false); assert(result.before.native.draws.some(d => d.linkedProgram));
        assert.equal(result.immediate.terminal.disposed, true, 'Direct Abort must immediately retire the terminal');
        assert.equal(result.immediate.hidden, true, 'Direct Abort must immediately hide the canvas');
        assert.equal(result.afterAbort.state.diagnostics.host, null);
        assert(Object.values(result.afterAbort.native.live).every(n => n === 0), 'Native handles remain before explicit dispose');
        assert.deepEqual(result.afterExplicitDispose.native.live, result.afterAbort.native.live);
      } else {
        assert.match(result.initRejected, /Abort|abort/); assert.equal(result.hidden, true);
        assert(Object.values(result.native.live).every(n => n === 0));
        if (mode === 'during-init') assert(Object.values(result.native.created).some(n => n > 0));
      }
      cases.push({ mode, status: 'PASS' });
    } catch (error) { cases.push({ mode, status: 'FAIL', reason: String(error) }); }
    finally { await page.close(); }
  }
} finally {
  await context.close(); await browser.close();
  writeFileSync(path.join(run, 'report.json'), JSON.stringify({ runId: id, build, windowReceipt,
    browser: browser.version(), node: process.version, cases, evidence, productIntegrated: false }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ runId: id, cases })); process.exitCode = cases.some(c => c.status === 'FAIL') ? 1 : 0;
}
