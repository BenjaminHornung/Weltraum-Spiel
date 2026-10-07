import { chromium } from './runtime/node_modules/playwright/index.mjs';
import { observeNative } from './observe-native.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const own = path.dirname(fileURLToPath(import.meta.url)), run = path.join(own, 'runs/ray-original-red-01'); mkdirSync(run);
const browser = await chromium.launch({ headless: true, executablePath: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
await context.route('**/favicon.ico', r => r.fulfill({ status: 204 })); await context.addInitScript(observeNative);
const page = await context.newPage(), errors = []; page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
try {
  await page.goto('http://127.0.0.1:5280/src/experiments/voxel-rays/index.html?testBridge=1');
  await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('FAIL'));
  const result = await page.evaluate(() => ({ status: document.getElementById('status').textContent,
    state: window.TestBridge.read(), native: window.__rdNative }));
  for (const shader of result.native.compiled) shader.sha256 = createHash('sha256').update(shader.code).digest('hex');
  writeFileSync(path.join(run, 'report.json'), JSON.stringify({ runId: 'ray-original-red-01', source: 'immutable original ZIP',
    manifestSha256: '254a797d75646c8f390832483dfabb05bb291c0bd84ace1c33e55f5156ddc170', result, errors,
    productIntegrated: false }, null, 2) + '\n', { flag: 'wx' });
  assert(result.native.compiled.some(s => !s.ok && /sample/.test(s.log) && s.code.includes('uvec4 sample=sourceCell(cell)')));
  assert.equal(result.state.hidden, true); assert.equal(result.state.diagnostics.terminal.disposed, true);
  assert.equal(result.native.draws.filter(d => d.linkedProgram).length, 0);
  console.log(JSON.stringify({ reproduced: true, status: result.status, nativeCreated: result.native.created, nativeRemaining: result.native.live }));
} finally { await context.close(); await browser.close(); }
