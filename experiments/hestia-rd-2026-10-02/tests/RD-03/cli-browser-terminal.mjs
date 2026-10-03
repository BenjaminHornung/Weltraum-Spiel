import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { runLab, parseRunArgs } from '../../scripts/run-lab.mjs';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';

const [kind, id] = process.argv.slice(2);
assert.ok(['missing-webgl2', 'context-loss', 'abort'].includes(kind));
assert.match(id, /^phase2-a-cli-[a-z0-9-]+$/);
const directory = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-03/evidence/${id}`;
assertIsolation({ task: 'RD-03', runRoot: directory });
const options = parseRunArgs(['evidence', '--experiment', 'RD-03', '--variant', 'fixture-control', '--fixture', 'F00-CONTROL',
  '--scenario', 'F00-CONTROL-REPLAY', '--run', id, '--samples', kind === 'context-loss' ? '2' : '3']);
const launch = chromium.launchPersistentContext; let context; let beforeClose; let abortProbe; let abortState;
// Test-only interposition on this invocation's own real Chromium context. CLI code, quality and assets stay unchanged.
chromium.launchPersistentContext = async function(...args) {
  context = await Reflect.apply(launch, this, args);
  if (kind === 'missing-webgl2') {
    await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        if (type === 'webgl2') { return null; }
        return Reflect.apply(getContext, this, [type, ...args]);
      };
    });
  } else if (kind === 'context-loss') {
    await context.addInitScript(() => {
      Object.defineProperty(window, '__RD03LossProbe', { value: { invoked: false, supported: false } });
      document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.querySelector('canvas');
        canvas.addEventListener('three-lab-rendered', () => {
          const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
          window.__RD03LossProbe.supported = Boolean(extension);
          if (extension) { window.__RD03LossProbe.invoked = true; extension.loseContext(); }
        }, { once: true });
      }, { once: true });
    });
  } else {
    context.on('page', (page) => {
      abortProbe = (async () => {
        await page.waitForFunction(() => {
          const facts = document.getElementById('facts');
          return facts && JSON.parse(facts.textContent).diagnostics?.submittedFrames > 0;
        }, null, { timeout: 15000 });
        abortState = JSON.parse(await page.locator('#facts').textContent());
        process.emit('SIGINT'); // Controlled handler invocation after real rendering, not an OS-console signal claim.
      })();
      void abortProbe.catch(() => {});
    });
  }
  const close = context.close;
  context.close = async function(...args) {
    try {
      const page = this.pages().find((page) => page.url().startsWith('http://127.0.0.1:5280/src/runner/index.html'));
      if (page) {
        beforeClose = { message: await page.locator('#status').textContent(), facts: await page.locator('#facts').textContent(),
          loss: kind === 'context-loss' ? await page.evaluate(() => window.__RD03LossProbe) : undefined };
      }
    } finally { await Reflect.apply(close, this, args); }
  };
  return context;
};
try {
  assert.equal(await runLab(options), 1);
  if (abortProbe) { await abortProbe; }
  const terminal = JSON.parse(readFileSync(`${directory}/terminal.json`, 'utf8'));
  assert.equal(terminal.status, { 'missing-webgl2': 'UNSUPPORTED', 'context-loss': 'FAILED', abort: 'ABORTED' }[kind]);
  assert.equal(terminal.samples.planned, options.samples);
  assert.equal(terminal.samples.observed + terminal.samples.skipped, options.samples);
  assert.equal(terminal.cleanup.ownedBrowserClosed, true); assert.equal(terminal.cleanup.nativeViteLoaderClosed, true);
  assert.equal(context.pages().length, 0); assert.equal(terminal.productIntegrated, false);
  if (kind === 'context-loss') { assert.deepEqual(beforeClose.loss, { invoked: true, supported: true }); }
  if (kind === 'abort') { assert.equal(abortState.diagnostics.webgl2, true); assert.ok(abortState.diagnostics.submittedFrames > 0); }
  writeFileSync(`${directory}/terminal-probe.json`, JSON.stringify({ status: 'PASS', kind, terminal, beforeClose, abortState,
    qualification: 'CONTROLLED-FAULT-ON-REAL-OPTIMIZED-CLI-BROWSER-NOT-HARDWARE-OR-PERFORMANCE', productIntegrated: false }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ status: 'PASS', kind, terminal: terminal.status, samples: terminal.samples, ownedContextClosed: true, productIntegrated: false }));
} finally {
  chromium.launchPersistentContext = launch;
  if (context?.pages().length) { await context.close(); }
}
