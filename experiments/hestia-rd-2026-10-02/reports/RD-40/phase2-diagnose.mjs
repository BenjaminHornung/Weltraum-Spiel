import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fresh, inventory, regular, receiptHash, receiptPath, start, tree, chrome, sha, json } from './phase2.mjs';
import { environment } from './phase1.mjs';

// Diagnostic only: no retry of the acceptance suite and no injected READY/facts/test state.
const root = fresh(process.argv[2]); const admitted = inventory(root); Object.assign(process.env, environment(root));
const began = new Date().toISOString(); let browser; let context; let page; const errors = [];
const inspect = () => page.locator('#facts').evaluate((output) => ({ innerText: output.innerText, textContent: output.textContent,
  value: output.value, detailsOpen: output.closest('details').open, renderedStatus: document.getElementById('status').dataset.status }));
try {
  browser = await chromium.launch({ executablePath: chrome, headless: true }); context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page = await context.newPage(); page.on('pageerror', (error) => { errors.push(String(error)); });
  const response = await page.goto('http://127.0.0.1:5280/');
  if (sha(await response.body()) !== admitted.receipt.builtFiles.find((row) => row.path === 'index.html').sha256) { throw new Error('Root body changed'); }
  const entry = page.waitForResponse((value) => value.url().endsWith('/src/tools/variant-gallery/index.html'));
  await page.getByRole('link', { name: 'RD40 variant gallery', exact: true }).click();
  if (sha(await (await entry).body()) !== admitted.receipt.entrySha256) { throw new Error('Gallery body changed'); }
  await page.waitForFunction(() => document.getElementById('status').dataset.status === 'READY', undefined, { timeout: 15_000 });
  const collapsed = await inspect(); const facts = JSON.parse(collapsed.value);
  if (collapsed.innerText !== '' || collapsed.detailsOpen || facts.state.status !== 'READY' || facts.source.sourceBytesDigest !== admitted.receipt.sourceBytesDigest) { throw new Error('Reported collapsed-output cause not reproduced'); }
  if (await page.evaluate(() => 'TestBridge' in window)) { throw new Error('Unexpected TestBridge'); }
  const png = await page.screenshot({ fullPage: true }); writeFileSync(path.join(root, 'diagnostic-collapsed-ready.png'), png, { flag: 'wx' });
  json(path.join(root, 'diagnostic-collapsed-ready.json'), { classification: 'ACTUAL-NATIVE-DIAGNOSTIC-NOT-UI40-43-ACCEPTANCE',
    sourceCommit: start, sourceTree: tree, buildDigest: admitted.receipt.buildDigest, pngSha256: sha(png), facts, collapsed });
  await page.getByText('Actual frame, source, backend and requested / observed quality', { exact: true }).click();
  const expanded = await inspect();
  if (!expanded.detailsOpen || JSON.stringify(JSON.parse(expanded.innerText)) !== JSON.stringify(JSON.parse(expanded.value))) { throw new Error('Actual disclosure did not expose identical facts'); }
  json(path.join(root, 'collapsed-facts-reproduction.json'), { classification: 'ACTUAL-DOM-DISCLOSURE-DIAGNOSTIC-NOT-ORIGINAL-ORACLE-RETRY',
    sourceCommit: start, sourceTree: tree, buildDigest: admitted.receipt.buildDigest, receiptPath, receiptSha256: receiptHash,
    collapsed, expanded, nativeBrowserVersion: browser.version(), pageErrors: errors,
    conclusion: 'Private browser facts readers use innerText while the native details element is collapsed; value/textContent contain actual matching facts. No source/runtime patch or protected test change made.' });
} catch (error) {
  const bytes = Buffer.from(`${error.stack ?? String(error)}\n`); writeFileSync(path.join(root, 'diagnostic-error.log'), bytes, { flag: 'wx' }); process.exitCode = 1;
} finally {
  try {
    if (page && await page.locator('#dispose').count()) {
      await page.locator('#dispose').click(); await page.waitForFunction(() => document.getElementById('status').textContent.includes('disposed'));
      const after = await inspect(); const value = JSON.parse(after.value);
      if (value.owners.registeredMounts !== 0 || value.owners.c0.renderers !== 0 || value.owners.c0.renderloops !== 0 || value.owners.rd11.renderers !== 0 || value.owners.rd11.renderloops !== 0) { throw new Error('Owned runtime cleanup not zero'); }
      json(path.join(root, 'diagnostic-runtime-cleanup.json'), { sourceCommit: start, owners: value.owners, state: value.state, runtimeDisposedBeforeContextClose: true, ownedContextOnly: true });
    }
  } finally { await context?.close(); await browser?.close(); }
  regular(chrome);
  json(path.join(root, 'diagnostic-command.json'), { binary: process.execPath, args: process.argv.slice(1), cwd: process.cwd(), began, ended: new Date().toISOString(),
    exitCode: process.exitCode ?? 0, sourceCommit: start, sourceTree: tree, buildDigest: admitted.receipt.buildDigest, browserExecutable: chrome,
    browserExecutableSha256: sha(readFileSync(chrome)), sourceReceiptSha256: receiptHash, contextClosed: true, browserClosed: true, acceptanceRerun: false });
}
console.log(JSON.stringify({ root, exitCode: process.exitCode ?? 0, acceptance: 'FAIL-PROTECTED-ORACLE-BLOCKER', diagnosticOnly: true, productIntegrated: false }));
