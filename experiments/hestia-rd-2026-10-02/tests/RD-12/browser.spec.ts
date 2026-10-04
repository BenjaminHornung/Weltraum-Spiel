import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadInventory, loadReplay } from '../../src/runner/assets';
import { sampleScenario } from '../../src/contracts/scenario';
import { getFixtureDigest, fixtureRevision } from '../../src/contracts/fixture';
import type { BabylonDiagnostics } from '../../src/experiments/babylon';
import { VISUAL_ORACLE_V1 } from '../../reports/RD-12/oracle';
import { requireQualifiedParityV2 } from '../../reports/RD-12/qualification-v2';

// AUTHORED/COMPILED ONLY in phase1. Run against the admitted optimized build,
// never Vite dev, and only AFTER HEAD actual wiring/new freeze/GPU lease.
const entry = '/src/experiments/babylon/index.html';
type Observed = { status: string; diagnostic: BabylonDiagnostics | null; mounts: number; owned: Record<string, number> };
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function observed(page: Page): Promise<Observed> { return JSON.parse(await page.locator('#facts').innerText()); }
async function submitted(page: Page, tick: number) {
  await expect.poll(async () => {
    const state = await observed(page); const d = state.diagnostic; const r = d?.rendered;
    return Boolean(d && !d.terminal && !d.disposed && r && r.tick === tick && r.fixtureDigest === d.fixtureDigest && r.cameraId === d.frame.cameraId
      && r.projectionGeneration === d.projectionGeneration && r.presentationGeneration === d.presentationGeneration);
  }, { timeout: 30_000 }).toBe(true);
  await expect(page.locator('#status')).toContainText('SUBMITTED'); await expect(page.locator('#status')).not.toContainText('awaiting'); return (await observed(page)).diagnostic!;
}
async function mount(page: Page, mode: string, scenario: string) {
  await page.locator('#preset').selectOption(mode); await page.locator('#scenario').selectOption(scenario); await page.locator('#mount').click(); return submitted(page, 0);
}
async function seek(page: Page, value: number) { await page.locator('#tick').fill(String(value)); await page.locator('#seek').click(); return submitted(page, value); }
async function capture(page: Page, info: TestInfo, id: string) {
  const before = await observed(page); const image = await page.locator('#view').screenshot(); const after = await observed(page);
  expect(after.diagnostic?.rendered).toEqual(before.diagnostic?.rendered);
  await info.attach(`${id}.png`, { body: image, contentType: 'image/png' });
  await info.attach(`${id}.json`, { body: Buffer.from(JSON.stringify({ before, after, screenshotSha256: sha(image), productIntegrated: false }, null, 2)), contentType: 'application/json' }); return image;
}
const fixtures = new URL('../../fixtures/', import.meta.url); const root = new URL('http://127.0.0.1:5280/');
const localFetch: typeof fetch = async (input) => new Response(readFileSync(new URL(new URL(String(input)).pathname.slice(1), fixtures)));
async function source(id: string) { return loadReplay(await loadInventory(root, localFetch), id, root, localFetch); }

for (const mode of ['C3', 'C4']) {
  for (const scenario of ['F01-HVP-COAST-REPLAY', 'F04-DETACH-REPLAY', 'F06-MATERIAL-REPLAY']) {
    test(`BAB01 native ${mode} ${scenario} normal visible flow, cold local-only stock shaders, camera/snapshot/reset/backseek/resize/screenshot`, async ({ page }, info) => {
      const requests: string[] = []; const errors: string[] = []; page.on('request', (request) => requests.push(request.url())); page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(entry); expect(await page.evaluate(() => 'TestBridge' in window)).toBe(false);
      const data = await source(scenario); let d = await mount(page, mode, scenario); expect(d.backend.actual).toBe(mode === 'C3' ? 'webgl2' : 'webgpu');
      expect(d.camera.controlsAttached).toBe(false); expect(d.productIntegrated).toBe(false);
      for (const value of [0, ...data.scenario.snapshots.flatMap((s) => [s.tick - 1, s.tick]), 1559, 1560, 1559, 0]) {
        const previous = d.projectionGeneration; d = await seek(page, value); const sample = sampleScenario(data.scenario, value, true);
        expect(d.fixtureDigest).toBe(getFixtureDigest(sample.fixture)); expect(d.sourceRevision).toBe(fixtureRevision(sample.fixture)); expect(d.frame).toEqual(sample.frame); expect(d.resetTick).toBe(sample.resetTick);
        expect(d.buffers.map((buffer) => [buffer.ownerId, buffer.sourceRevision, buffer.materialId])).toEqual(sample.fixture.objects.flatMap((owner) => owner.meshes.map((mesh) => [owner.ownerId, owner.sourceRevision, mesh.materialId])));
        if (value < 1559 && data.scenario.snapshots.some((snapshot) => snapshot.tick === value)) { expect(d.projectionGeneration).toBeGreaterThan(previous); }
        await capture(page, info, `${mode}-${scenario}-tick-${value}-generation-${d.projectionGeneration}`);
      }
      const camera = data.initialFixture.cameras.at(-1)!; const generation = d.projectionGeneration; await page.locator('#camera').selectOption(camera.id); d = await submitted(page, 0);
      expect(d.camera.id).toBe(camera.id); expect(d.camera.position).toEqual(camera.positionMeters); expect(d.camera.fovDegrees).toBeCloseTo(camera.verticalFovDegrees, 9); expect(d.projectionGeneration).toBe(generation);
      await page.locator('#tick').fill(''); await page.locator('#seek').click(); await expect(page.locator('#validation')).toContainText('Tick'); expect((await observed(page)).diagnostic!.frame.tick).toBe(0);
      await page.locator('#viewport').selectOption('640x360'); await page.locator('#dpr').selectOption('2'); await page.locator('#resize').click(); d = await submitted(page, 0);
      expect(d.resolution).toEqual({ width: 640, height: 360, dpr: 2, bufferWidth: 1280, bufferHeight: 720 }); await capture(page, info, `${mode}-${scenario}-resized`);
      await page.locator('#reset').click(); d = await submitted(page, 0); expect(d.frame).toEqual(sampleScenario(data.scenario, 0, true).frame);
      const origin = new URL(page.url()).origin; expect(requests.filter((url) => new URL(url).origin !== origin)).toEqual([]); expect(requests.filter((url) => /glslang|twgsl|cdn|\.wasm(?:\?|$)/i.test(url))).toEqual([]); expect(errors).toEqual([]);
      await info.attach(`${mode}-${scenario}-cold-requests.json`, { body: Buffer.from(JSON.stringify({ requests, errors, driverCold: 'NOT_RUN', productIntegrated: false }, null, 2)), contentType: 'application/json' });
      await page.locator('#dispose').click(); await expect.poll(async () => (await observed(page)).owned).toEqual({ engines: 0, renderloops: 0, listeners: 0, pendingNativeInitializations: 0 }); expect((await observed(page)).mounts).toBe(0);
    });
  }
  test(`BAB03 native ${mode} 20 owned teardown cycles; no released-VRAM assertion`, async ({ page }, info) => {
    await page.goto(entry); const cycles: unknown[] = [];
    for (let cycle = 0; cycle < 20; cycle += 1) {
      await mount(page, mode, 'F04-DETACH-REPLAY'); await page.locator('#dispose').click();
      await expect.poll(async () => (await observed(page)).owned).toEqual({ engines: 0, renderloops: 0, listeners: 0, pendingNativeInitializations: 0 });
      const state = await observed(page); expect(state.mounts).toBe(0); cycles.push({ cycle, state });
    }
    await info.attach(`${mode}-native20-logical-ownership.json`, { body: Buffer.from(JSON.stringify({ cycles, nativeMemory: 'UNSUPPORTED', productIntegrated: false })), contentType: 'application/json' });
  });
  test(`BAB04 native ${mode} owned context/device loss preserves terminal reason and prohibits READY resurrection`, async ({ page }) => {
    await page.goto(`${entry}?testBridge=1`); await mount(page, mode, 'F04-DETACH-REPLAY');
    await page.evaluate(() => (window as any).TestBridge.loseOwnedDevice()); await expect(page.locator('#status')).toContainText('TERMINAL');
    await expect.poll(async () => (await observed(page)).owned.engines).toBe(0); const first = (await observed(page)).diagnostic!.terminal;
    await page.waitForTimeout(100); expect((await observed(page)).diagnostic!.terminal).toBe(first); expect((await observed(page)).diagnostic!.disposed).toBe(true); await expect(page.locator('#status')).not.toContainText('SUBMITTED');
  });
  test(`BAB01 native ${mode} mapped-buffer qualification is separate from retained CPU attributes`, async ({ page }, info) => {
    await page.goto(`${entry}?testBridge=1`); await mount(page, mode, 'F04-DETACH-REPLAY');
    const proof = await page.evaluate(() => (window as any).TestBridge.nativeBufferInspection()); await info.attach(`${mode}-native-buffer-inspection.json`, { body: Buffer.from(JSON.stringify(proof)), contentType: 'application/json' });
    // Deliberately FAILS qualification until actual native readback is provided;
    // no silent skip/green and no reinterpretation of SDK-retained CPU arrays.
    expect(proof.status, proof.reason).toBe('PASS_NATIVE_READBACK');
  });
}

async function roi(page: Page, png: Buffer, rect: readonly number[]): Promise<number[]> {
  return page.evaluate(async ({ png64, rect }) => {
    const bytes = Uint8Array.from(atob(png64), (value) => value.charCodeAt(0)); const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height); const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0); bitmap.close();
    const [x, y, width, height] = rect; return Array.from(context.getImageData(Math.round(x * canvas.width), Math.round(y * canvas.height), Math.floor(width * canvas.width), Math.floor(height * canvas.height)).data);
  }, { png64: png.toString('base64'), rect });
}
for (const mode of ['C3', 'C4']) {
  for (const region of VISUAL_ORACLE_V1.regions) {
    test(`BAB02 native ${mode} ${region.id} meaningful full-resolution material/depth ROI positive/restoration AND deliberate fault control; NOT C0 parity`, async ({ page }, info) => {
      await page.goto(`${entry}?testBridge=1`); await mount(page, mode, region.scenario);
      if (region.camera !== 'fixture-first-camera') { await page.locator('#camera').selectOption(region.camera); await submitted(page, 0); }
      const reference = await capture(page, info, `${mode}-${region.id}-original`);
      await page.evaluate((fault) => (window as any).TestBridge.visualFault(fault), region.fault); await submitted(page, 0); const fault = await capture(page, info, `${mode}-${region.id}-deliberate-fault`);
      await page.evaluate(() => (window as any).TestBridge.visualFault('none')); await submitted(page, 0); const restored = await capture(page, info, `${mode}-${region.id}-restored`);
      const result = requireQualifiedParityV2(await roi(page, reference, region.rect), await roi(page, restored, region.rect), await roi(page, fault, region.rect));
      await info.attach(`${mode}-${region.id}-oracle.json`, { body: Buffer.from(JSON.stringify({ result, region, crossEngineParity: 'NOT_RUN', productIntegrated: false })), contentType: 'application/json' });
    });
  }
}
