import { test as base, expect, chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';
import type { ProbeReport } from '../../src/experiments/renderer-probe';

const url = '/src/experiments/renderer-probe/index.html';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const test = base.extend({
  context: async ({}, use, info) => {
    const runId = process.env.HESTIA_RD_BROWSER_RUN_ID!;
    expect(runId).toMatch(/^[a-z0-9-]+$/);
    const profile = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10/browser/${runId}/profiles/${hash(Buffer.from(info.title)).slice(0, 16)}`;
    assertIsolation({ task: 'RD-10', runRoot: profile });
    expect(existsSync(profile), 'Never reuse an existing browser profile').toBe(false);
    mkdirSync(profile, { recursive: true });
    const context = await chromium.launchPersistentContext(profile, { executablePath: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe',
      headless: true, viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, baseURL: 'http://127.0.0.1:5280' });
    try { await use(context); } finally { await context.close(); } // Only this explicitly owned fresh profile/context.
  },
});

test('CAP01 missing/null/rejected WebGPU is visibly unsupported/failed, never WebGPU success', async ({ context }) => {
  for (const fault of ['missing', 'null-adapter', 'rejected-device']) {
    const page = await context.newPage();
    await page.addInitScript((kind) => {
      Object.defineProperty(navigator, 'gpu', { configurable: true, value: kind === 'missing' ? undefined
        : { requestAdapter: async () => kind === 'null-adapter' ? null : { features: new Set(), requestDevice: async () => { throw new Error('controlled device init rejected'); } } } });
    }, fault);
    await page.goto(url); await expect(page.locator('#status')).toContainText('Ready');
    await page.getByRole('button', { name: 'Probe WebGPU', exact: true }).click();
    await expect(page.locator('#status')).toContainText(fault === 'rejected-device' ? 'FAILED' : 'UNSUPPORTED');
    const report = JSON.parse((await page.locator('#capability').textContent())!);
    expect(report.backend).not.toBe('Native-WebGPU'); expect(report.submissions).toBe(0);
    if (fault === 'rejected-device') { expect(report.reason).toContain('controlled device init rejected'); }
    await page.getByRole('button', { name: 'Close probe', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.close();
  }
});

test('CAP02 absent timer/identity cannot fabricate GPU duration, bytes or target qualification', async ({ page }) => {
  await page.addInitScript(() => {
    const prototype = WebGL2RenderingContext.prototype as unknown as { getExtension(name: string): unknown };
    const extension = prototype.getExtension;
    prototype.getExtension = function(name: string) {
      if (name === 'WEBGL_debug_renderer_info' || name === 'EXT_disjoint_timer_query_webgl2') { return null; }
      return extension.call(this, name);
    };
  });
  await page.goto(url); await expect(page.locator('#status')).toContainText('Ready');
  await page.getByRole('button', { name: 'Probe WebGL2', exact: true }).click();
  await expect(page.locator('#status')).toContainText('SUPPORTED');
  const report = JSON.parse((await page.locator('#capability').textContent())!);
  expect(report.identity.status).toBe('unknown'); expect(report.targetQualified).toBe(false);
  expect(report.metrics.gpuMs).not.toHaveProperty('value'); expect(report.metrics.nativeGpuBytes).not.toHaveProperty('value');
  await page.getByRole('button', { name: 'Close probe', exact: true }).click(); await expect(page.locator('canvas')).toHaveCount(0);
});

test('CAP03 real open/close uses task-local requests and no guarded persistence; selected product lock bytes unchanged', async ({ page }) => {
  const productLock = new URL('../../../../apps/weltraum-browser/package-lock.json', import.meta.url);
  const before = hash(readFileSync(productLock)); const requests: string[] = []; const blocked: string[] = [];
  page.on('request', (request) => { requests.push(request.url()); });
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:5280') { blocked.push(route.request().url()); await route.abort(); }
    else { await route.continue(); }
  });
  await page.addInitScript(() => {
    const writes: string[] = [];
    Object.defineProperty(window, '__RD10Writes', { value: writes });
    Storage.prototype.setItem = function(key: string) { writes.push(`storage:${key}`); throw new Error('Forbidden persistence'); };
    IDBFactory.prototype.open = function() { writes.push('indexedDB'); throw new Error('Forbidden database'); };
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register = async () => { writes.push('serviceWorker'); throw new Error('Forbidden service worker'); }; }
  });
  await page.goto(url); await expect(page.locator('#status')).toContainText('Ready');
  expect(await page.evaluate(() => 'TestBridge' in window)).toBe(false);
  for (let cycle = 0; cycle < 4; cycle += 1) {
    await page.getByRole('button', { name: 'Probe WebGL2', exact: true }).click();
    await expect(page.locator('#status')).toContainText('SUPPORTED');
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.getByRole('button', { name: 'Close probe', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(0); await expect(page.locator('#capability')).toHaveAttribute('data-mounts', '0');
  }
  expect(await page.evaluate(() => (window as unknown as { __RD10Writes: string[] }).__RD10Writes)).toEqual([]);
  expect(blocked).toEqual([]); expect(requests.length).toBeGreaterThan(0); expect(hash(readFileSync(productLock))).toBe(before);
  // Guarded own-document APIs/selected byte bindings, NOT an exhaustive global configuration audit.
});

test('NATIVE01 actual native initialization and bounded submission, with truthful mode availability and captures', async ({ page }, info) => {
  const errors: string[] = []; const requests: string[] = [];
  page.on('pageerror', (error) => { errors.push(String(error)); });
  page.on('request', (request) => { requests.push(request.url()); });
  await page.goto(url); await expect(page.locator('#status')).toContainText('Ready');
  const html = await (await page.request.get(url)).body();
  const buildClass = process.env.HESTIA_RD10_BUILD_CLASS;
  if (buildClass === 'DEV') { expect(html.toString()).toContain('/@vite/client'); }
  else { expect(html.toString()).not.toContain('/@vite/client'); expect(html.toString()).toContain('/assets/'); }
  const reports: ProbeReport[] = [];
  for (const mode of ['WebGL2', 'WebGPU']) {
    await page.getByRole('button', { name: `Probe ${mode}`, exact: true }).click();
    await expect(page.locator('#status')).toContainText(/SUPPORTED|UNSUPPORTED|FAILED/);
    const report: ProbeReport = JSON.parse((await page.locator('#capability').textContent())!); reports.push(report);
    expect(report.experimentId).toBe('RD-10'); expect(report.fixtureId).toBe('F00-CONTROL');
    expect(report.fixtureDigest).toMatch(/^[a-f0-9]{64}$/); expect(report.sourceRevision).toBe(report.frame.sourceRevision);
    expect(report.targetQualified).toBe(false); expect(report.productIntegrated).toBe(false);
    if (report.status === 'supported') { expect(report.backend).toBe(mode === 'WebGL2' ? 'Native-WebGL2' : 'Native-WebGPU'); expect(report.submissions).toBe(1); }
    else { expect(report.backend).not.toBe('Native-WebGPU'); expect(report.reason).not.toBe(''); }
    expect(report.metrics.gpuMs).not.toHaveProperty('value'); expect(report.metrics.nativeGpuBytes).not.toHaveProperty('value');
    const capture = info.outputPath(`${mode.toLowerCase()}-${buildClass?.toLowerCase()}.png`);
    await page.screenshot({ path: capture, fullPage: true }); await info.attach(`${mode} ${buildClass} diagnostic`, { path: capture, contentType: 'image/png' });
    await page.getByRole('button', { name: 'Close probe', exact: true }).click(); await expect(page.locator('canvas')).toHaveCount(0);
    const disposed = JSON.parse((await page.locator('#capability').textContent())!);
    expect(disposed.disposed).toBe(true); expect(Object.values(disposed.liveOwned)).toEqual([0, 0, 0, 0, 0]);
    await expect(page.locator('#capability')).toHaveAttribute('data-mounts', '0');
  }
  expect(errors).toEqual([]); expect(requests.every((request) => new URL(request).origin === 'http://127.0.0.1:5280')).toBe(true);
  const evidence = { buildClass, phase: buildClass === 'DEV' ? 'PHASE1-UNQUALIFIED-DIAGNOSTIC' : 'PHASE2',
    url: new URL(url, 'http://127.0.0.1:5280').href, htmlSha256: hash(html), browserVersion: page.context().browser()?.version() ?? 'unknown',
    viewport: page.viewportSize(), dpr: await page.evaluate(() => devicePixelRatio), counts: { planned: 2, observed: 2, failed: reports.filter((report) => report.status === 'failed').length,
      unsupported: reports.filter((report) => report.status === 'unsupported').length, skipped: 0 }, reports, errors, requests, productIntegrated: false };
  const file = info.outputPath('native-capability-diagnostic.json'); writeFileSync(file, JSON.stringify(evidence, null, 2), { flag: 'wx' });
  await info.attach('native capability evidence', { path: file, contentType: 'application/json' });
});
