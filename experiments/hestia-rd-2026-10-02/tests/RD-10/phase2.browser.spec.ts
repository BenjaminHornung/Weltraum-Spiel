// Reuse all four original browser oracles without changing their historical source bytes.
import './browser.spec';
import { test as base, chromium, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';
import { admitFreshArtifact } from './phase2-artifacts';
import type { ProbeReport } from '../../src/experiments/renderer-probe';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const url = '/src/experiments/renderer-probe/index.html';
base.beforeEach(async ({ context }, info) => {
  const guarded = new WeakSet<Page>();
  function guard(page: Page) {
    if (guarded.has(page)) { return; } guarded.add(page);
    const capture = page.screenshot.bind(page);
    page.screenshot = async (options) => {
      if (!options?.path) { return capture(options); }
      const target = admitFreshArtifact(options.path, info.outputDir); // Actual child leaf BEFORE screenshot mutation.
      const record = { point: 'PREWRITE-ADMITTED', path: target, owner: info.outputDir, at: new Date().toISOString(), existed: false };
      const result = await capture({ ...options, path: target });
      const sidecar = admitFreshArtifact(`${target}.admission.json`, info.outputDir);
      writeFileSync(sidecar, JSON.stringify({ ...record, imageSha256: hash(result), imageBytes: result.length,
        source: 'Playwright screenshot API; task-owned fresh context only', productIntegrated: false }, null, 2), { flag: 'wx' });
      return result;
    };
  }
  context.on('page', guard);
  for (const page of context.pages()) { guard(page); } // Admission on this known owned context, NOT a cleanup sweep.
});
const test = base.extend({
  context: async ({}, use, info) => {
    const run = process.env.HESTIA_RD_BROWSER_RUN_ID!; expect(run).toMatch(/^[a-z0-9-]+$/);
    const profile = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10/browser/${run}/profiles/${hash(Buffer.from(info.title)).slice(0, 16)}`;
    assertIsolation({ task: 'RD-10', runRoot: profile }); expect(existsSync(profile)).toBe(false); mkdirSync(profile, { recursive: true });
    const context = await chromium.launchPersistentContext(profile, { executablePath: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe',
      headless: true, viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, baseURL: 'http://127.0.0.1:5280' });
    try { await use(context); } finally { await context.close(); }
  },
});

test('CAP01_PHASE2 first compile reason survives actual queued native WebGL cleanup loss', async ({ page }, info) => {
  await page.addInitScript(() => {
    const stats = { lossEvents: 0, lossCalls: 0 };
    Object.defineProperty(window, '__RD10CleanupStats', { value: stats });
    const prototype = WebGL2RenderingContext.prototype;
    const parameter = prototype.getShaderParameter;
    prototype.getShaderParameter = function(shader, name) { return name === this.COMPILE_STATUS ? false : parameter.call(this, shader, name); };
    prototype.getShaderInfoLog = function() { return 'phase2 controlled first compile failure'; };
    const extensions = prototype as unknown as { getExtension(name: string): unknown };
    const extension = extensions.getExtension;
    extensions.getExtension = function(this: WebGL2RenderingContext, name: string) {
      const result = extension.call(this, name);
      if (name !== 'WEBGL_lose_context' || !result) { return result; }
      const actual = result as WEBGL_lose_context; const canvas = this.canvas;
      canvas.addEventListener('webglcontextlost', () => { stats.lossEvents += 1; });
      return { loseContext: () => { stats.lossCalls += 1; actual.loseContext(); } };
    };
  });
  await page.goto(url); await expect(page.locator('#status')).toContainText('Ready');
  await page.getByRole('button', { name: 'Probe WebGL2', exact: true }).click();
  await expect(page.locator('#status')).toContainText(/FAILED|UNSUPPORTED/);
  const first: ProbeReport = JSON.parse((await page.locator('#capability').textContent())!);
  if (first.status === 'unsupported') { test.skip(true, `WebGL2 unavailable: ${first.reason}; deterministic original unit16 retains this repair oracle`); }
  expect(first.reason).toBe('Error: Shader compile failed: phase2 controlled first compile failure');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __RD10CleanupStats: { lossEvents: number } }).__RD10CleanupStats.lossEvents)).toBeGreaterThan(0);
  const after: ProbeReport = JSON.parse((await page.locator('#capability').textContent())!);
  expect(after.status).toBe('failed'); expect(after.reason).toBe(first.reason); expect(after.submissions).toBe(0);
  expect(Object.values(after.liveOwned)).toEqual([0, 0, 0, 0, 0]);
  const stats = await page.evaluate(() => (window as unknown as { __RD10CleanupStats: { lossEvents: number; lossCalls: number } }).__RD10CleanupStats);
  expect(stats.lossCalls).toBe(1);
  await page.screenshot({ path: info.outputPath('first-failure-optimized.png'), fullPage: true });
  const record = admitFreshArtifact(info.outputPath('first-failure.json'), info.outputDir);
  writeFileSync(record, JSON.stringify({ first, after, stats, qualification: 'CONTROLLED-COMPILE-FAULT-ACTUAL-NATIVE-CLEANUP-NOT-PERFORMANCE', productIntegrated: false }, null, 2), { flag: 'wx' });
  await page.getByRole('button', { name: 'Close probe', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0); await expect(page.locator('#capability')).toHaveAttribute('data-mounts', '0');
});

test('CAP03_PHASE2 close aborts awaited device init and destroys a late task-local device without success', async ({ page }, info) => {
  await page.addInitScript(() => {
    const state = { requested: 0, destroyed: 0, release: () => {} };
    Object.defineProperty(window, '__RD10Abort', { value: state });
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({ features: new Set(),
      requestDevice: () => { state.requested += 1; return new Promise((resolve) => { state.release = () => { resolve({ destroy: () => { state.destroyed += 1; } }); }; }); } }) } });
  });
  await page.goto(url); await expect(page.locator('#status')).toContainText('Ready');
  await page.getByRole('button', { name: 'Probe WebGPU', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __RD10Abort: { requested: number } }).__RD10Abort.requested)).toBe(1);
  await expect(page.locator('#status')).toContainText('INITIALIZING');
  await page.getByRole('button', { name: 'Close probe', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0); await expect(page.locator('#capability')).toHaveAttribute('data-mounts', '0');
  await page.evaluate(() => { (window as unknown as { __RD10Abort: { release(): void } }).__RD10Abort.release(); });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __RD10Abort: { destroyed: number } }).__RD10Abort.destroyed)).toBe(1);
  const report: ProbeReport = JSON.parse((await page.locator('#capability').textContent())!);
  expect(report.status).not.toBe('supported'); expect(report.submissions).toBe(0); expect(report.disposed).toBe(true);
  expect(Object.values(report.liveOwned)).toEqual([0, 0, 0, 0, 0]);
  const record = admitFreshArtifact(info.outputPath('abort-late-device.json'), info.outputDir);
  writeFileSync(record, JSON.stringify({ report, requested: 1, destroyed: 1,
    qualification: 'TASK-LOCAL-DEVICE-DOUBLE-ON-REAL-OPTIMIZED-PAGE-NOT-NATIVE-GPU-PROOF', productIntegrated: false }, null, 2), { flag: 'wx' });
});
