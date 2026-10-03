import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { admit, directory, git, lab } from '../../reports/RD-11/run.mjs';
import { compareRoi, requireNativeFeatures, ROIS } from '../../reports/RD-11/oracle';
import { loadInventory, loadReplay } from '../../src/runner/assets';
import { getFixtureDigest, fixtureRevision } from '../../src/contracts/fixture';
import { sampleScenario } from '../../src/contracts/scenario';
import { UNSUPPORTED_FEATURES } from '../../src/experiments/three-webgpu/projection';

// Ready Phase 2 oracle, NOT executed by Phase 1. Caller must bind a NEW HEAD snapshot
// and fresh task root before the Playwright config/SDK writes anything.
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const entry = '/src/experiments/three-webgpu/index.html';
const runId = process.env.HESTIA_RD_BROWSER_RUN_ID ?? 'UNBOUND';
const owner = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/browser/${runId}`;
const caseRoot = () => path.join(owner, 'cases', hash(Buffer.from(test.info().title)).slice(0, 12));
const publicRoot = new URL('http://127.0.0.1:5280/');
const localFetch: typeof fetch = async (input) => new Response(readFileSync(new URL(`../../fixtures${new URL(String(input)).pathname}`, import.meta.url)));
test.beforeAll(() => {
  expect(runId).toMatch(/^[a-z0-9-]+$/);
  const freezePath = process.env.HESTIA_RD11_PHASE2_SNAPSHOT!; const expected = process.env.HESTIA_RD11_PHASE2_SNAPSHOT_SHA256;
  expect(freezePath).toMatch(/^C:\/IFI_SourceCode\/Temp\/Hestia-RD-2026-10-02-runs\/HEAD\//);
  expect(path.basename(freezePath).toUpperCase()).not.toBe('CURRENT_FREEZE.JSON');
  const bytes = readFileSync(freezePath); expect(hash(bytes)).toBe(expected);
  const snapshot = JSON.parse(bytes.toString()); expect(snapshot.productIntegrated).toBe(false);
  expect(snapshot.start).toMatch(/^[0-9a-f]{40}$/); expect(snapshot.tree).toMatch(/^[0-9a-f]{40}$/);
  expect(snapshot.start).not.toBe('e42bf9e771e651306b6cece5e4116d4e4e25af9c');
  expect(execFileSync(git, ['rev-parse', 'HEAD'], { cwd: lab, encoding: 'utf8' }).trim()).toBe(snapshot.start);
  expect(execFileSync(git, ['rev-parse', 'HEAD^{tree}'], { cwd: lab, encoding: 'utf8' }).trim()).toBe(snapshot.tree);
  expect(snapshot.frozenFiles).toHaveLength(18);
  for (const row of snapshot.frozenFiles) { expect(hash(readFileSync(path.join(lab, row.path)))).toBe(row.sha256); }
  expect(process.env.HESTIA_RD11_OPTIMIZED_BUILD).toMatch(/^C:\/IFI_SourceCode\//);
});
function save(name: string, data: unknown) {
  const file = path.join(caseRoot(), name); admit(file, { owner }); directory(path.dirname(file), owner); admit(file, { owner });
  writeFileSync(file, JSON.stringify(data, null, 2), { flag: 'wx' });
}
async function capture(page: Page, name: string) {
  const file = path.join(caseRoot(), name); admit(file, { owner }); directory(path.dirname(file), owner); admit(file, { owner });
  await page.locator('#view').screenshot({ path: file }); const png = readFileSync(file);
  return { path: file, sha256: hash(png), png, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}
async function pixels(page: Page, png: Uint8Array, rect: readonly [number, number, number, number]) {
  return page.evaluate(async ({ base64, rect }) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)); const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(32, 32); const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, rect[0] * bitmap.width, rect[1] * bitmap.height, rect[2] * bitmap.width, rect[3] * bitmap.height, 0, 0, 32, 32);
    bitmap.close(); return Array.from(context.getImageData(0, 0, 32, 32).data);
  }, { base64: Buffer.from(png).toString('base64'), rect });
}
async function state(page: Page) { return JSON.parse((await page.locator('#facts').textContent())!); }
async function rendered(page: Page, tick: number) {
  await page.waitForFunction((tick) => {
    const data = JSON.parse(document.getElementById('facts')!.textContent!); const diagnostic = data.diagnostics;
    return diagnostic?.rendered?.tick === tick && diagnostic.rendered.fixtureDigest === diagnostic.fixtureDigest
      && (diagnostic.projectionGeneration === undefined || diagnostic.rendered.projectionGeneration === diagnostic.projectionGeneration);
  }, tick); return state(page);
}
async function mount(page: Page, mode: 'C1' | 'C2', scenario = 'F01-HVP-COAST-REPLAY', bridge = false) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const response = await page.goto(`${entry}?mode=${mode}&scenario=${scenario}${bridge ? '&testBridge=1' : ''}`);
  const built = readFileSync(path.join(process.env.HESTIA_RD11_OPTIMIZED_BUILD!, entry.slice(1))); expect(hash(await response!.body())).toBe(hash(built));
  await expect(page.locator('#status')).toContainText('Ready');
  expect(await page.evaluate(() => 'TestBridge' in window)).toBe(bridge); await page.getByRole('button', { name: 'Mount', exact: true }).click();
  await expect(page.locator('#status')).toContainText(/Mounted|UNSUPPORTED|FAILED|Terminal/);
  const message = (await page.locator('#status').textContent())!;
  if (/UNSUPPORTED/.test(message)) { save(`${mode}-${scenario}-unsupported.json`, { message, state: await state(page), productIntegrated: false }); return undefined; }
  expect(message).toContain('Mounted'); const observed = await rendered(page, 0);
  expect(observed.execution).toBe('OPTIMIZED-DIAGNOSTIC-NOT-BENCHMARK'); expect(observed.diagnostics.backend.actual).toBe(mode === 'C1' ? 'webgl2' : 'webgpu');
  expect(observed.diagnostics.backend.fallbackObserved).toBe(false); return observed;
}
async function close(page: Page) {
  await page.getByRole('button', { name: 'Dispose', exact: true }).click(); await expect(page.locator('#facts')).toHaveAttribute('data-mounts', '0');
  expect((await state(page)).liveHosts).toEqual({ renderers: 0, renderloops: 0, abortListeners: 0 });
}

for (const mode of ['C1', 'C2'] as const) {
  test(`REN11 ${mode} REAL optimized async/backend/quality/source gate (unsupported affects only this mode)`, async ({ page, browser }) => {
    const observed = await mount(page, mode); test.skip(!observed, `UNSUPPORTED ${mode}; no fallback success`);
    expect(observed.productIntegrated).toBe(false); expect(observed.diagnostics.submittedFrames).toBeGreaterThan(0);
    expect(observed.diagnostics.quality.requested).toEqual({ samples: 4, outputBufferType: 'HalfFloatType' });
    expect(observed.diagnostics.gpuMs).not.toHaveProperty('value'); expect(observed.diagnostics.nativeGpuBytes).not.toHaveProperty('value');
    const image = await capture(page, `REN11-${mode}/native.png`); const { png, ...media } = image;
    save(`REN11-${mode}/native.json`, { status: 'PASS', state: observed, media, browser: browser.version(), qualification: 'OPTIMIZED-FUNCTIONAL-NOT-TARGET-GPU-PERFORMANCE-ART', productIntegrated: false }); await close(page);
  });

  test(`REN13 ${mode} REAL F04/F06 moving-owner/opening/source/reset/backseek geometry products`, async ({ page }) => {
    test.setTimeout(180_000); const inventory = await loadInventory(publicRoot, localFetch); const observations: unknown[] = [];
    for (const id of ['F04-DETACH-REPLAY', 'F06-MATERIAL-REPLAY']) {
      const data = await loadReplay(inventory, id, publicRoot, localFetch); const mounted = await mount(page, mode, id); test.skip(!mounted, `UNSUPPORTED ${mode}`);
      await page.getByLabel('Pause', { exact: true }).check();
      for (const tick of [0, ...data.scenario.snapshots.flatMap((snapshot) => [snapshot.tick - 1, snapshot.tick]), 1559, 1560, 1559, 0]) {
        await page.getByLabel('Seek tick', { exact: true }).fill(String(tick)); await page.getByRole('button', { name: 'Seek', exact: true }).click();
        const observed = await rendered(page, tick); const sample = sampleScenario(data.scenario, tick, true);
        expect(observed.diagnostics.fixtureDigest).toBe(getFixtureDigest(sample.fixture)); expect(observed.diagnostics.sourceRevision).toBe(fixtureRevision(sample.fixture));
        expect(observed.diagnostics.frame).toEqual(sample.frame); expect(observed.diagnostics.resetTick).toBe(sample.resetTick);
        expect(observed.diagnostics.payloadBindings).toEqual(sample.fixture.payloads.map(({ id, byteLength, sha256 }) => ({ id, byteLength, sha256 })));
        expect(observed.diagnostics.owners.map(({ ownerId, sourceNamespace, sourceRevision, position, rotation }: any) => ({ ownerId, sourceNamespace, sourceRevision, position, rotation })))
          .toEqual(sample.fixture.objects.map((owner) => ({ ownerId: owner.ownerId, sourceNamespace: owner.sourceNamespace, sourceRevision: owner.sourceRevision, position: owner.frame.originMeters, rotation: owner.frame.rotationXyzw })));
        const image = await capture(page, `REN13-${mode}/${id}-${observations.length}-${tick}.png`); const { png, ...media } = image; observations.push({ observed, media });
      }
      await page.getByRole('button', { name: 'Reset', exact: true }).click(); expect((await rendered(page, 0)).diagnostics.frame).toEqual(sampleScenario(data.scenario, 0, false).frame); await close(page);
    }
    save(`REN13-${mode}/replay.json`, { observations, qualification: 'REAL-RENDERER-SOURCE-PRODUCTS; GPU-BUFFER-READBACK-NOT-RUN', productIntegrated: false });
  });
}

test('REN12 REAL C0/C1/C2 fixed-camera material/depth/baked-AO ROI parity; native shadow/AO missing gates stay rejected', async ({ page }) => {
  test.setTimeout(180_000); const sets: { mode: string; png: Uint8Array; state: any }[] = []; const observations: unknown[] = [];
  await page.setViewportSize({ width: 1400, height: 1000 }); await page.goto('/src/runner/index.html?scenario=F01-HVP-COAST-REPLAY');
  await expect(page.locator('#status')).toContainText('Ready'); await page.getByRole('button', { name: 'Mount', exact: true }).click();
  const c0 = await rendered(page, 0); const controlImage = await capture(page, 'REN12/C0-C01-EYE.png'); sets.push({ mode: 'C0', png: controlImage.png, state: c0 });
  await page.getByRole('button', { name: 'Dispose', exact: true }).click();
  for (const mode of ['C1', 'C2'] as const) {
    const observed = await mount(page, mode); if (!observed) { continue; }
    expect(observed.diagnostics.frame.cameraId).toBe('C01-EYE'); expect(observed.diagnostics.fixtureDigest).toBe(c0.diagnostics.fixtureDigest);
    expect(observed.diagnostics.toneMapping).toBe(c0.diagnostics.toneMapping); expect(observed.diagnostics.exposure).toBe(c0.diagnostics.exposure);
    const image = await capture(page, `REN12/${mode}-C01-EYE.png`); sets.push({ mode, png: image.png, state: observed }); await close(page);
  }
  for (const [referenceMode, candidateMode, axis] of [['C0', 'C1', 'C0-C1'], ['C1', 'C2', 'C1-C2']] as const) {
    const reference = sets.find((entry) => entry.mode === referenceMode); const candidate = sets.find((entry) => entry.mode === candidateMode);
    if (!reference || !candidate) { observations.push({ axis, status: 'NOT_RUN', reason: 'Affected backend unavailable' }); continue; }
    for (const roi of ROIS) { observations.push({ axis, roi, ...compareRoi(await pixels(page, reference.png, roi.rect), await pixels(page, candidate.png, roi.rect), axis) }); }
  }
  expect(() => requireNativeFeatures(UNSUPPORTED_FEATURES, ['native-pcf-shadow-parity', 'native-ao-recompute-parity'])).toThrow(/UNSUPPORTED/);
  save('REN12/parity.json', { observations, nativeShadow: 'UNSUPPORTED', nativeAoRecompute: 'UNSUPPORTED', states: sets.map(({ mode, state }) => ({ mode, state })), productIntegrated: false });
});

test('REN12 controlled vertex-color omission on REAL optimized page fails same frozen AO/shader oracle', async ({ page }) => {
  const observed = await mount(page, 'C1', 'F01-HVP-COAST-REPLAY', true); test.skip(!observed, 'UNSUPPORTED C1');
  const good = await capture(page, 'REN12-NEGATIVE/with-baked-ao.png');
  await page.evaluate(() => (window as unknown as { TestBridge: { omitVertexColors(): void } }).TestBridge.omitVertexColors());
  await page.waitForFunction(() => JSON.parse(document.getElementById('facts')!.textContent!).diagnostics.owners.every((owner: any) => owner.meshes.every((mesh: any) => mesh.material.vertexColors === false)));
  // A submitted frame, not an elapsed timer, must follow the changed material graph.
  await page.getByLabel('Seek tick', { exact: true }).fill('1'); await page.getByRole('button', { name: 'Seek', exact: true }).click(); await rendered(page, 1);
  const bad = await capture(page, 'REN12-NEGATIVE/missing-baked-ao.png'); const roi = ROIS.find((entry) => entry.id === 'coast-baked-ao')!;
  const awaitedGood = await pixels(page, good.png, roi.rect); const awaitedBad = await pixels(page, bad.png, roi.rect);
  expect(() => compareRoi(awaitedGood, awaitedBad, 'C1-C2')).toThrow(/parity rejected/i);
  save('REN12-NEGATIVE/rejection.json', { qualification: 'CONTROLLED-MATERIAL-OMISSION-ON-REAL-RENDERER-NOT-SUPPORTED-PROFILE', goodSha: good.sha256, badSha: bad.sha256, state: await state(page), productIntegrated: false }); await close(page);
});

test('REN14 REAL C1 native loss/resize/fresh-canvas teardown; controlled missing capability is separate', async ({ page }) => {
  const observed = await mount(page, 'C1', 'F04-DETACH-REPLAY'); test.skip(!observed, 'UNSUPPORTED C1');
  await page.getByRole('button', { name: 'Resize 640×360 DPR2', exact: true }).click(); await expect(page.locator('#status')).toContainText('Resize applied');
  expect((await state(page)).diagnostics.resolution).toEqual({ width: 640, height: 360, dpr: 2, bufferWidth: 1280, bufferHeight: 720 });
  const canLose = await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2')!; const extension = gl.getExtension('WEBGL_lose_context');
    if (!extension) { return false; } extension.loseContext(); return true;
  }); test.skip(!canLose, 'NOT_RUN native context loss extension absent');
  await expect(page.locator('#status')).toContainText('device/context lost'); await expect(page.locator('#facts')).toHaveAttribute('data-mounts', '0');
  const closed = await state(page); expect(closed.liveHosts).toEqual({ renderers: 0, renderloops: 0, abortListeners: 0 });
  save('REN14/native-loss.json', { observed, closed, qualification: 'ACTUAL-WEBGL-CONTEXT-LOSS-REQUEST-ON-TASK-CANVAS', productIntegrated: false });
});

test('REN14 REAL C2 owned native device.lost destruction/resize/terminal teardown (not a device double)', async ({ page }) => {
  const observed = await mount(page, 'C2', 'F04-DETACH-REPLAY', true); test.skip(!observed, 'UNSUPPORTED C2');
  await page.getByRole('button', { name: 'Resize 640×360 DPR2', exact: true }).click(); await expect(page.locator('#status')).toContainText('Resize applied');
  expect((await state(page)).diagnostics.resolution).toEqual({ width: 640, height: 360, dpr: 2, bufferWidth: 1280, bufferHeight: 720 });
  await page.evaluate(() => (window as unknown as { TestBridge: { loseOwnedDevice(): void } }).TestBridge.loseOwnedDevice());
  await expect(page.locator('#status')).toContainText(/WebGPU device lost.*destroyed/);
  await expect(page.locator('#facts')).toHaveAttribute('data-mounts', '0');
  const closed = await state(page); expect(closed.liveHosts).toEqual({ renderers: 0, renderloops: 0, abortListeners: 0 });
  save('REN14/native-device-loss.json', { observed, closed, qualification: 'ACTUAL-OWNED-GPUDEVICE-DESTROY-AND-NATIVE-DEVICE.LOST-PROMISE; NO-RECOVERY', productIntegrated: false });
});

test('REN11/14 controlled WebGPU denial visibly rejects fallback/async init; never native GPU success', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }); });
  await page.goto(`${entry}?mode=C2&scenario=F04-DETACH-REPLAY`); await expect(page.locator('#status')).toContainText('Ready');
  await page.getByRole('button', { name: 'Mount', exact: true }).click(); await expect(page.locator('#status')).toContainText(/UNSUPPORTED.*C2.*webgl2.*fallback|FAILED/);
  expect((await state(page)).mounts).toBe(0); save('REN11-NEGATIVE/denial.json', { state: await state(page), message: await page.locator('#status').textContent(), qualification: 'CONTROLLED-API-DENIAL-NOT-NATIVE-WEBGPU', productIntegrated: false });
});
