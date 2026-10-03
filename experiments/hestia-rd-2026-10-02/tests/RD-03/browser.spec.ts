import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';

const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-03';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const runId = () => process.env.HESTIA_RD_BROWSER_RUN_ID!;

test('RUN03 REAL optimized WebGL2 backend/source/image/DPR/resolution/timer bindings', async ({ page, browser }) => {
  const errors: string[] = []; page.on('pageerror', (error) => { errors.push(error.message); });
  const html = readFileSync(new URL('../../dist/src/runner/index.html', import.meta.url));
  const response = await page.goto('/src/runner/index.html?scenario=F00-CONTROL-REPLAY&fixture=F00-CONTROL&variant=fixture-control');
  expect(hash(await response!.body())).toBe(hash(html));
  await expect(page.locator('#status')).toContainText('Ready');
  expect(await page.evaluate(() => 'TestBridge' in window)).toBe(false);
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  await expect(page.locator('#facts')).toHaveAttribute('data-mounts', '1');
  await expect.poll(async () => JSON.parse((await page.locator('#facts').textContent())!).diagnostics.submittedFrames).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Advance 60 ticks', exact: true }).click();
  await expect(page.locator('#facts')).toHaveAttribute('data-tick', '60');
  await page.getByLabel('Pause').check(); await page.getByRole('button', { name: 'Advance 60 ticks', exact: true }).click();
  await expect(page.locator('#facts')).toHaveAttribute('data-tick', '60');
  const state = JSON.parse((await page.locator('#facts').textContent())!);
  expect(state.diagnostics.backend).toBe('Three-WebGLRenderer-WebGL2'); expect(state.diagnostics.webgl2).toBe(true);
  expect(state.diagnostics.fixtureDigest).toBe('378513d00d5f2a11f569ff0748d4e42ac1832674104febd052070f0fd258b81d');
  expect(state.scenarioDigest).toBe('24de3e02b3c7d2cf38f0f1dbf0b5f82a5107bc2507118726b5c081b3d05bf878');
  expect(state.diagnostics.resolution).toEqual({ width: 1280, height: 720, dpr: 1, bufferWidth: 1280, bufferHeight: 720 });
  expect(state.diagnostics.rendererInfo.geometries).toBeGreaterThan(0);
  expect(typeof state.diagnostics.timerQueryAvailable).toBe('boolean');
  expect(state.diagnostics.gpuMs).not.toHaveProperty('value'); expect(state.diagnostics.nativeGpuBytes).not.toHaveProperty('value');
  expect(state.productIntegrated).toBe(false);
  const bindings: { path: string; sha256: string }[] = [];
  for (const name of ['inventory.json', 'F00-CONTROL/manifest.json', 'F00-CONTROL/scenario.json']) {
    const bytes = readFileSync(new URL(`../../fixtures/${name}`, import.meta.url));
    expect(hash(await (await page.request.get(`/${name}`)).body())).toBe(hash(bytes)); bindings.push({ path: name, sha256: hash(bytes) });
  }
  const manifest = JSON.parse(readFileSync(new URL('../../fixtures/F00-CONTROL/manifest.json', import.meta.url), 'utf8'));
  for (const payload of manifest.payloads) {
    const url = `/F00-CONTROL/${payload.path}`; const bytes = await (await page.request.get(url)).body();
    expect(bytes.byteLength).toBe(payload.byteLength); expect(hash(bytes)).toBe(payload.sha256); bindings.push({ path: url, sha256: hash(bytes) });
  }
  const directory = `${run}/browser/${runId()}/RUN03`; assertIsolation({ task: 'RD-03', runRoot: directory }); mkdirSync(directory, { recursive: true });
  const image = `${directory}/webgl2.png`; await page.locator('canvas').screenshot({ path: image });
  const png = readFileSync(image); const imageResolution = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  const cssBounds = (await page.locator('canvas').boundingBox())!;
  expect(imageResolution).toEqual({ width: Math.round(cssBounds.width), height: Math.round(cssBounds.height) });
  writeFileSync(`${directory}/functional.json`, JSON.stringify({ status: 'PASS', qualification: 'HEADLESS-DIAGNOSTIC-NOT-TARGET-GPU-OR-PERFORMANCE',
    state, browser: { executable: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe', version: browser.version() },
    bindings, media: { path: image, sha256: hash(png), imageResolution, cssBounds, captureScale: 'CSS-pixels-at-DPR-1' }, errors, productIntegrated: false }, null, 2), { flag: 'wx' });
  await page.getByRole('button', { name: 'Dispose', exact: true }).click();
  await expect(page.locator('#facts')).toHaveAttribute('data-mounts', '0'); expect(errors).toEqual([]);
});

test('RUN04 20 REAL mount/dispose renderer/texture/listener cycles, one canvas, no surviving loops', async ({ page }) => {
  await page.addInitScript(() => {
    const listeners = new Map<EventTarget, { type: string; listener: EventListenerOrEventListenerObject | null; capture: boolean }[]>();
    const add = EventTarget.prototype.addEventListener; const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (this instanceof HTMLCanvasElement) {
        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
        const entries = listeners.get(this) ?? [];
        if (!entries.some((entry) => entry.type === type && entry.listener === listener && entry.capture === capture)) { entries.push({ type, listener, capture }); }
        listeners.set(this, entries);
      }
      return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      listeners.set(this, (listeners.get(this) ?? []).filter((entry) => entry.type !== type || entry.listener !== listener || entry.capture !== capture));
      return remove.call(this, type, listener, options);
    };
    Object.defineProperty(window, '__RD03CanvasListeners', { value: () => [...listeners.values()].flat().map((entry) => entry.type) });
  });
  await page.goto('/src/runner/index.html'); await expect(page.locator('#status')).toContainText('Ready');
  const listenerCount = () => page.evaluate(() => (window as unknown as { __RD03CanvasListeners: () => string[] }).__RD03CanvasListeners());
  const baseline = await listenerCount(); const cycles: unknown[] = [];
  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.getByRole('button', { name: 'Mount', exact: true }).click(); await expect(page.locator('#facts')).toHaveAttribute('data-mounts', '1');
    await page.getByRole('button', { name: 'Advance 60 ticks', exact: true }).click();
    await page.getByRole('button', { name: 'Dispose', exact: true }).click(); await expect(page.locator('#facts')).toHaveAttribute('data-mounts', '0');
    const state = JSON.parse((await page.locator('#facts').textContent())!);
    expect(state.cleanup).toEqual({ disposed: true, geometries: 0, textures: 0, programs: 0, liveHosts: { renderers: 0, renderloops: 0, hostListeners: 0 } });
    expect(await listenerCount()).toEqual(baseline); expect(await page.locator('canvas').count()).toBe(1); cycles.push(state.cleanup);
  }
  const directory = `${run}/browser/${runId()}/RUN04`; assertIsolation({ task: 'RD-03', runRoot: directory }); mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/lifecycle.json`, JSON.stringify({ status: 'PASS', cycles, planned: 20, observed: 20, failed: 0,
    baselineCanvasListeners: baseline, finalCanvasListeners: await listenerCount(), serviceCleanup: 'Caller must stop only its managed service; browser test does not own it',
    qualification: 'HEADLESS-DIAGNOSTIC-NOT-TARGET-GPU-OR-PERFORMANCE', productIntegrated: false }, null, 2), { flag: 'wx' });
});
