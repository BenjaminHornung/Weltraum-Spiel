import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { captureBrowserScreenshot, createBrowserRunDirectory } from './capture-admission.mjs';
import { loadInventory, loadReplay } from '../../src/runner/assets';
import { fixtureRevision, getFixtureDigest } from '../../src/contracts/fixture';
import { sampleScenario } from '../../src/contracts/scenario';

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
  const directory = createBrowserRunDirectory(`${run}/browser/${runId()}/RUN03`);
  const image = `${directory}/webgl2.png`; await captureBrowserScreenshot(image, (path) => page.locator('canvas').screenshot({ path }));
  const png = readFileSync(image); const imageResolution = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  const cssBounds = (await page.locator('canvas').boundingBox())!;
  const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  // Playwright 1.61.1 enclosingIntRect rounds document-space edges, not element size.
  const x = cssBounds.x + scroll.x; const y = cssBounds.y + scroll.y;
  expect(imageResolution).toEqual({ width: Math.ceil(x + cssBounds.width - 1e-3) - Math.floor(x + 1e-3),
    height: Math.ceil(y + cssBounds.height - 1e-3) - Math.floor(y + 1e-3) });
  writeFileSync(`${directory}/functional.json`, JSON.stringify({ status: 'PASS', qualification: 'HEADLESS-DIAGNOSTIC-NOT-TARGET-GPU-OR-PERFORMANCE',
    state, browser: { executable: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe', version: browser.version() },
    bindings, media: { path: image, sha256: hash(png), imageResolution, cssBounds, documentPosition: { x, y }, captureScale: 'CSS-pixels-at-DPR-1' }, errors, productIntegrated: false }, null, 2), { flag: 'wx' });
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
  const directory = createBrowserRunDirectory(`${run}/browser/${runId()}/RUN04`);
  writeFileSync(`${directory}/lifecycle.json`, JSON.stringify({ status: 'PASS', cycles, planned: 20, observed: 20, failed: 0,
    baselineCanvasListeners: baseline, finalCanvasListeners: await listenerCount(), serviceCleanup: 'Caller must stop only its managed service; browser test does not own it',
    qualification: 'HEADLESS-DIAGNOSTIC-NOT-TARGET-GPU-OR-PERFORMANCE', productIntegrated: false }, null, 2), { flag: 'wx' });
});

async function renderedState(page: Page, tick: number) {
  await page.waitForFunction((tick) => {
    const state = JSON.parse(document.getElementById('facts')!.textContent!);
    return state.diagnostics?.rendered?.tick === tick && state.diagnostics.rendered.fixtureDigest === state.diagnostics.fixtureDigest;
  }, tick);
  return JSON.parse((await page.locator('#facts').textContent())!);
}

test('RUN03 critical F00/F01/F04/F05 optimized pause/seek/reset/source-revision replay', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on('pageerror', (error) => { errors.push(error.message); });
  const publicRoot = new URL('http://127.0.0.1:5280/');
  const localFetch: typeof fetch = async (input) => new Response(readFileSync(new URL(`../../fixtures${new URL(String(input)).pathname}`, import.meta.url)));
  const inventory = await loadInventory(publicRoot, localFetch);
  const directory = createBrowserRunDirectory(`${run}/browser/${runId()}/RUN03-REPLAY`);
  const states: unknown[] = []; const media: unknown[] = [];
  await page.goto('/src/runner/index.html'); await expect(page.locator('#status')).toContainText('Ready');
  for (const scenarioId of ['F00-CONTROL-REPLAY', 'F01-HVP-COAST-REPLAY', 'F04-DETACH-REPLAY', 'F05-CUTOUT-REPLAY']) {
    const replay = await loadReplay(inventory, scenarioId, publicRoot, localFetch);
    await page.getByLabel('Scenario', { exact: true }).selectOption(scenarioId);
    await page.getByRole('button', { name: 'Mount', exact: true }).click(); await renderedState(page, 0);
    await page.getByLabel('Pause', { exact: true }).check();
    await expect.poll(async () => (await renderedState(page, 0)).diagnostics.frame.paused).toBe(true);
    const paused = (await renderedState(page, 0)).diagnostics.frame;
    await page.getByRole('button', { name: 'Advance 60 ticks', exact: true }).click();
    await expect(page.locator('#status')).toContainText('Advanced'); expect((await renderedState(page, 0)).diagnostics.frame).toEqual(paused);
    const ticks = scenarioId === 'F04-DETACH-REPLAY'
      ? [0, ...replay.scenario.snapshots.flatMap((snapshot) => [snapshot.tick - 1, snapshot.tick]), 1559, 1560, 1559, 0]
      : [0, 120, 240, 900, 1560, 0];
    for (const [step, tick] of ticks.entries()) {
      await page.getByLabel('Seek tick', { exact: true }).fill(String(tick)); await page.getByRole('button', { name: 'Seek', exact: true }).click();
      const state = await renderedState(page, tick); const sample = sampleScenario(replay.scenario, tick, true);
      expect(state.execution).toBe('OPTIMIZED-DIAGNOSTIC-NOT-BENCHMARK'); expect(state.diagnostics.webgl2).toBe(true);
      expect(state.diagnostics.frame).toEqual(sample.frame); expect(state.diagnostics.resetTick).toBe(sample.resetTick);
      expect(state.diagnostics.fixtureDigest).toBe(getFixtureDigest(sample.fixture)); expect(state.scenarioDigest).toBe(replay.scenarioDigest);
      expect(state.diagnostics.sourceRevision).toBe(fixtureRevision(sample.fixture));
      expect(state.diagnostics.payloadBindings).toEqual(sample.fixture.payloads.map(({ id, byteLength, sha256 }) => ({ id, byteLength, sha256 })));
      const meshes = sample.fixture.objects.flatMap((owner) => owner.meshes);
      expect(state.diagnostics.rendererInfo.geometries).toBe(meshes.length);
      const triangles = meshes.reduce((sum, mesh) => sum + sample.fixture.payloads.find((payload) => payload.id === mesh.indices)!.length / 3, 0);
      expect(state.facts.logicalCosts['effect-0-triangles'].value).toBe(triangles);
      expect(state.liveHosts).toEqual({ renderers: 1, renderloops: 1, hostListeners: 2 }); expect(await page.locator('canvas').count()).toBe(1);
      expect(state.diagnostics.gpuMs).not.toHaveProperty('value'); expect(state.diagnostics.nativeGpuBytes).not.toHaveProperty('value');
      const image = `${directory}/${scenarioId}-${step}-${tick}.png`;
      await captureBrowserScreenshot(image, (path) => page.locator('canvas').screenshot({ path }));
      states.push({ state, expectedOwners: sample.fixture.objects.map(({ ownerId, sourceNamespace, sourceRevision, frame }) => ({ ownerId, sourceNamespace, sourceRevision, frame })),
        ownerVerification: 'Real CPU Three projection checked in focused unit test; browser binds complete snapshot and actual renderer geometry counts' });
      const png = readFileSync(image); media.push({ path: image, sha256: hash(png), width: png.readUInt32BE(16), height: png.readUInt32BE(20) });
    }
    await page.getByRole('button', { name: 'Reset', exact: true }).click(); await expect(page.locator('#status')).toContainText('Reset to initial');
    expect((await renderedState(page, 0)).diagnostics.frame).toEqual(sampleScenario(replay.scenario, 0, false).frame);
    await page.getByRole('button', { name: 'Dispose', exact: true }).click(); await expect(page.locator('#facts')).toHaveAttribute('data-mounts', '0');
    const cleanup = JSON.parse((await page.locator('#facts').textContent())!).cleanup;
    expect(cleanup).toEqual({ disposed: true, geometries: 0, textures: 0, programs: 0, liveHosts: { renderers: 0, renderloops: 0, hostListeners: 0 } });
  }
  expect(errors).toEqual([]);
  writeFileSync(`${directory}/replay.json`, JSON.stringify({ status: 'PASS', states, media, errors, browserVersion: browser.version(),
    qualification: 'OPTIMIZED-HEADLESS-FUNCTIONAL-NOT-TARGET-GPU-ART-OR-PERFORMANCE', productIntegrated: false }, null, 2), { flag: 'wx' });
});

test('RUN03 missing WebGL2 fails explicitly before any renderer/loop, no hidden fallback', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl2') { return null; }
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.goto('/src/runner/index.html'); await expect(page.locator('#status')).toContainText('Ready');
  await page.getByRole('button', { name: 'Mount', exact: true }).click(); await expect(page.locator('#status')).toContainText('UNSUPPORTED: WebGL2 required');
  const state = JSON.parse((await page.locator('#facts').textContent())!);
  expect(state.mounts).toBe(0); expect(state.liveHosts).toEqual({ renderers: 0, renderloops: 0, hostListeners: 0 });
  const directory = createBrowserRunDirectory(`${run}/browser/${runId()}/RUN03-MISSING-WEBGL2`);
  writeFileSync(`${directory}/capability.json`, JSON.stringify({ status: 'PASS', state, message: await page.locator('#status').textContent(),
    qualification: 'CONTROLLED-REQUIRED-CAPABILITY-DENIAL-ON-REAL-OPTIMIZED-PAGE', productIntegrated: false }, null, 2), { flag: 'wx' });
});

test('RUN03 timer unavailable has no value; real context loss is visible and owned disposal releases resources', async ({ page }) => {
  await page.addInitScript(() => {
    const getExtension = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function(this: WebGL2RenderingContext, name: string) {
      if (name === 'EXT_disjoint_timer_query_webgl2') { return null; }
      return Reflect.apply(getExtension, this, [name]);
    } as typeof getExtension;
  });
  await page.goto('/src/runner/index.html'); await expect(page.locator('#status')).toContainText('Ready');
  await page.getByRole('button', { name: 'Mount', exact: true }).click(); const before = await renderedState(page, 0);
  expect(before.diagnostics.timerQueryAvailable).toBe(false); expect(before.diagnostics.gpuMs.status).toBe('unsupported');
  expect(before.diagnostics.gpuMs).not.toHaveProperty('value'); expect(before.diagnostics.nativeGpuBytes).not.toHaveProperty('value');
  const lossSupported = await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2')!; const extension = gl.getExtension('WEBGL_lose_context');
    if (!extension) { return false; }
    extension.loseContext(); return true;
  });
  test.skip(!lossSupported, 'NOT_RUN: controlled real context loss requires WEBGL_lose_context');
  await expect(page.locator('#status')).toContainText('WebGL context lost; no hidden restore/fallback');
  expect(await page.evaluate(() => document.querySelector('canvas')!.getContext('webgl2')!.isContextLost())).toBe(true);
  await page.getByRole('button', { name: 'Dispose', exact: true }).click(); await expect(page.locator('#facts')).toHaveAttribute('data-mounts', '0');
  const after = JSON.parse((await page.locator('#facts').textContent())!);
  expect(after.cleanup).toEqual({ disposed: true, geometries: 0, textures: 0, programs: 0, liveHosts: { renderers: 0, renderloops: 0, hostListeners: 0 } });
  const directory = createBrowserRunDirectory(`${run}/browser/${runId()}/RUN03-TIMER-CONTEXT-LOSS`);
  writeFileSync(`${directory}/capability-loss.json`, JSON.stringify({ status: 'PASS', before, after,
    qualification: 'REAL-WEBGL2-CONTROLLED-TIMER-DENIAL-AND-CONTEXT-LOSS-NOT-PERFORMANCE', productIntegrated: false }, null, 2), { flag: 'wx' });
});
