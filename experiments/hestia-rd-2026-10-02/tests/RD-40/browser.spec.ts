import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { canonicalJson } from '../../src/contracts/validation';
import { createRunResult } from '../../src/contracts/result';
import type { GalleryState } from '../../src/tools/variant-gallery/session';
import type { SourceBinding } from '../../src/tools/variant-gallery/source';
import { nativeCanvasCapture } from './native-canvas-capture';

// Phase1: COMPILED ONLY. HEAD must supply fresh wiring/build/freeze receipt AND a new browser grant.
type HeadReceipt = { phase: 'RD40-PHASE2'; productIntegrated: false; entryWired: true; port5280Released: true;
  sourceCommit: string; sourceTree: string; sourceBytesDigest: string; buildDigest: string;
  buildRoot: string; entrySha256: string; shared18: readonly { path: string; sha256: string }[] };
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
let receipt: HeadReceipt;
async function facts(page: Page) {
  const text = await page.locator('#facts').textContent(); expect(text?.trim(), 'Actual DOM facts JSON must be nonempty').toBeTruthy();
  return JSON.parse(text!) as { state: GalleryState; source: SourceBinding; owners: { registeredMounts: number; c0: { renderers: number; renderloops: number }; rd11: { renderers: number; renderloops: number } } };
}
async function ready(page: Page) {
  await expect(page.locator('#status')).toHaveAttribute('data-status', 'READY');
  await expect(page.locator('#step')).toBeEnabled(); const value = await facts(page); expect(value.state.busy).toBe(false);
  expect(value.state.submission!.backend.actual).toBe(value.state.submission!.backend.requested); return value;
}
async function seek(page: Page, tick: number) { await page.getByLabel('Seek tick', { exact: true }).fill(String(tick)); await page.getByRole('button', { name: 'Seek', exact: true }).click(); await expect(page.locator('#facts')).toHaveAttribute('data-tick', String(tick)); await ready(page); }
async function scene(page: Page, fixture: string) { await page.getByRole('combobox', { name: 'Fixture', exact: true }).selectOption(fixture); return ready(page); }
async function screenshot(page: Page, info: TestInfo, name: string, viewportOnly = false) {
  const bytes = viewportOnly ? await nativeCanvasCapture(page, info, name, receipt) : await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
  const value = await facts(page); await writeFile(info.outputPath(`${name}.json`), JSON.stringify({ productIntegrated: false, pngSha256: sha(bytes), state: value.state, source: value.source, head: receipt }, null, 2), { flag: 'wx' }); return bytes;
}
test.beforeAll(async () => {
  expect(process.env.HESTIA_RD40_PHASE2_BROWSER_GRANTED, 'NEW grant required; phase1 cannot execute browser').toBe('1');
  const file = process.env.HESTIA_RD40_HEAD_RECEIPT; expect(file).toMatch(/^C:[/\\]IFI_SourceCode[/\\]/i);
  const bytes = await readFile(file!); expect(sha(bytes)).toBe(process.env.HESTIA_RD40_HEAD_RECEIPT_SHA256); receipt = JSON.parse(bytes.toString()) as HeadReceipt;
  expect(receipt).toMatchObject({ phase: 'RD40-PHASE2', productIntegrated: false, entryWired: true, port5280Released: true });
  expect(receipt.sourceCommit).toMatch(/^[a-f0-9]{40}$/); expect(receipt.sourceTree).toMatch(/^[a-f0-9]{40}$/);
  expect(receipt.sourceBytesDigest).toMatch(/^[a-f0-9]{64}$/); expect(receipt.buildDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(receipt.buildRoot).toMatch(/^C:[/\\]IFI_SourceCode[/\\]/i); expect(receipt.shared18).toHaveLength(18);
  const lab = fileURLToPath(new URL('../../', import.meta.url));
  for (const row of receipt.shared18) { expect(sha(await readFile(path.join(lab, row.path)))).toBe(row.sha256); }
  expect(sha(await readFile(path.join(receipt.buildRoot, 'src/tools/variant-gallery/index.html')))).toBe(receipt.entrySha256);
});
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 }); await page.goto('/');
  expect(await page.evaluate(() => 'TestBridge' in window)).toBe(false);
  const response = page.waitForResponse((value) => value.url().endsWith('/src/tools/variant-gallery/index.html'));
  await page.getByRole('link', { name: 'RD40 variant gallery', exact: true }).click(); expect(sha(await (await response).body())).toBe(receipt.entrySha256);
  const value = await ready(page); expect(value.source.sourceBytesDigest).toBe(receipt.sourceBytesDigest);
  expect(await page.evaluate(() => 'TestBridge' in window)).toBe(false);
});
test.afterEach(async ({ page }, info) => {
  if (await page.locator('#dispose').count()) {
    await page.locator('#dispose').click(); await expect(page.locator('#status')).toContainText('disposed');
    const value = await facts(page); expect(value.owners.registeredMounts).toBe(0);
    expect(value.owners.c0).toMatchObject({ renderers: 0, renderloops: 0 }); expect(value.owners.rd11).toMatchObject({ renderers: 0, renderloops: 0 });
    await writeFile(info.outputPath('original-native-cleanup.json'), JSON.stringify({ productIntegrated: false, sourceCommit: receipt.sourceCommit,
      owners: value.owners, state: value.state, runtimeDisposedBeforeContextClose: true }, null, 2), { flag: 'wx' });
  }
});
test('UI40 actual paused nonzero A/B/A, snapshot/reset boundaries and backward seek', async ({ page }, info) => {
  await scene(page, 'F04-DETACH');
  const download = page.waitForEvent('download'); await page.locator('#inputs').click(); const input = JSON.parse(await readFile(await (await download).path(), 'utf8')) as { 'original.json': { snapshots: { tick: number }[]; keyframes: { type: string; tick: number }[] } };
  const scenario = input['original.json']; const tick = Math.max(19, scenario.snapshots[0]!.tick, scenario.keyframes.find((item) => item.type === 'ResetLab')?.tick ?? 0);
  await seek(page, tick); const original = (await facts(page)).state.comparison;
  await screenshot(page, info, 'ui40-a-snapshot');
  await page.locator('#switch-b').click(); const b = await ready(page); expect(b.state.selection!.variant).toBe('C1'); expect(b.state.comparison).toEqual(original);
  await screenshot(page, info, 'ui40-b-snapshot'); await page.locator('#switch-a').click(); const a = await ready(page); expect(a.state.comparison).toEqual(original);
  await seek(page, 7); expect((await facts(page)).state.comparison!.resetTick).not.toBe(original!.resetTick);
  await page.locator('#step').click(); await expect(page.locator('#facts')).toHaveAttribute('data-tick', '8');
  await page.locator('#play').click(); await expect.poll(async () => (await facts(page)).state.comparison!.frame.tick).toBeGreaterThan(8);
  await page.locator('#pause').click(); await ready(page); const paused = (await facts(page)).state.comparison!.frame.tick;
  await page.waitForTimeout(100); expect((await facts(page)).state.comparison!.frame.tick).toBe(paused);
  await page.locator('#reset').click(); await expect(page.locator('#facts')).toHaveAttribute('data-tick', '0'); expect((await ready(page)).state.comparison!.frame.paused).toBe(true);
});
test('UI41 missing media and latest selection owns one actual renderer, C2 success never means WebGL2', async ({ page }, info) => {
  expect(await page.locator('#references li').count()).toBe(7); expect(await page.locator('#concepts [data-availability="MISSING_AT_PIN"]').count()).toBe(6);
  expect(await page.locator('#concepts [data-availability="LFS_POINTER_ONLY"]').count()).toBe(5); expect(await page.locator('img,iframe').count()).toBe(0);
  for (let index = 0; index < 10; index++) { await page.locator(index % 2 === 0 ? '#switch-b' : '#switch-a').click(); }
  const value = await ready(page); expect(value.state.selection!.variant).toBe('fixture-control'); expect(value.owners.registeredMounts).toBe(1);
  expect(value.owners.c0.renderloops + value.owners.rd11.renderloops).toBe(1);
  await page.locator('#b-variant').selectOption('C2'); await page.locator('#switch-b').click();
  await expect.poll(async () => page.locator('#status').getAttribute('data-status')).toMatch(/READY|ERROR/);
  const result = await facts(page);
  if (result.state.status === 'READY') { expect(result.state.submission!.backend.actual).toBe('webgpu'); }
  else { expect(result.state.comparison).toBeNull(); expect(await page.locator('#export-pair').isDisabled()).toBe(true); }
  await screenshot(page, info, 'ui41-c2-outcome');
});
test('UI42 keyboard does not leak from text input; Escape restores opener; narrow layout', async ({ page }, info) => {
  await seek(page, 19); await page.locator('#seek').focus(); await page.keyboard.press('Space');
  expect((await facts(page)).state.comparison!.frame.paused).toBe(true); expect((await facts(page)).state.comparison!.frame.tick).toBe(19);
  const opener = page.getByRole('button', { name: 'View RR-01 source notes' }); await opener.click(); await expect(page.locator('#overlay')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#overlay')).not.toBeVisible(); await expect(opener).toBeFocused();
  await page.setViewportSize({ width: 375, height: 812 }); await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await screenshot(page, info, 'ui42-narrow');
});
test('UI41 CONTROLLED denied WebGPU keeps actual C0 UI but cannot claim C2→C1 success', async ({ page }, info) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }); });
  await page.reload(); await ready(page); await page.locator('#b-variant').selectOption('C2'); await page.locator('#switch-b').click();
  await expect(page.locator('#status')).toHaveAttribute('data-status', 'ERROR'); await expect(page.locator('#status')).toContainText(/UNSUPPORTED/);
  expect((await facts(page)).state.comparison).toBeNull(); await expect(page.locator('#export-pair')).toBeDisabled();
  await expect.poll(async () => (await facts(page)).owners.registeredMounts).toBe(0); await screenshot(page, info, 'ui41-controlled-denied-c2');
});
test('UI43 actual byte-bound pair stable export and negative stale/missing/source bindings', async ({ page, browser }, info) => {
  const executable = process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH; expect(executable).toMatch(/^C:\\IFI_SourceCode\\/i);
  await scene(page, 'F04-DETACH'); await page.locator('#viewport').selectOption('640,360,1'); await ready(page); await seek(page, 19);
  await expect(page.locator('#export-pair')).toBeDisabled();
  for (const slot of ['A', 'B'] as const) {
    await page.locator(`#switch-${slot.toLowerCase()}`).click(); await ready(page); const f = await facts(page); const state = f.state;
    const download = page.waitForEvent('download'); await page.locator('#inputs').click(); const inputs = JSON.parse(await readFile(await (await download).path(), 'utf8')) as Record<string, unknown>;
    const image = await screenshot(page, info, `ui43-${slot.toLowerCase()}-viewport`, true);
    const missing = { status: 'not-run', unit: 'ms', reason: 'Functional browser image capture, no GPU/performance sampling grant' } as const;
    const run = createRunResult({ schema: 'hestia-rd-result-v1', runId: `RD40-UI43-${slot}`, scenarioId: state.comparison!.scenarioId,
      scenarioDigest: state.comparison!.effectiveScenarioDigest, variantId: state.selection!.variant, fixtureDigest: state.comparison!.fixtureDigest,
      sourceRefs: state.comparison!.sourceRefs, buildDigest: receipt.buildDigest, lockDigest: f.source.lockDigest, sourceDigest: f.source.sourceDigest, sourceBytesDigest: f.source.sourceBytesDigest,
      browser: { executable: executable!.replaceAll('\\', '/'), version: browser.version() }, device: { id: 'HEAD-FUNCTIONAL-IMAGE', description: 'Functional browser capture; native driver metadata not measured', driver: missing },
      backend: state.submission!.backend.label, runClass: 'image-motion', temperature: 'warm', samples: { planned: 1, observed: 1, skipped: 0, failed: 0, skippedReasons: [] },
      rawDataPaths: [`ui43-${slot.toLowerCase()}-viewport.json`], errors: [], metrics: { cpuMs: missing, gpuMs: missing, frameMs: missing, uploadBytes: missing, cpuBytes: missing, gpuBytes: missing },
      media: [{ path: 'image.png', sha256: sha(image), kind: 'image' }], gates: [{ id: 'QUALIFIED-NATIVE-BENCHMARK', status: 'NOT_RUN', reason: 'Functional capture only' }], productIntegrated: false });
    const files = { 'run.json': Buffer.from(canonicalJson(run)), 'image.png': image, 'original.json': Buffer.from(canonicalJson(inputs['original.json'])),
      'effective.json': Buffer.from(canonicalJson(inputs['effective.json'])), 'fixture.json': Buffer.from(canonicalJson(inputs['fixture.json'])) };
    const sidecar = { schema: 'rd40-comparison-binding-v1', productIntegrated: false,
      runtime: { selection: state.selection, comparison: state.comparison, backend: state.submission!.backend, quality: state.submission!.quality,
        source: { sourceDigest: f.source.sourceDigest, sourceBytesDigest: f.source.sourceBytesDigest, lockDigest: f.source.lockDigest } },
      provenance: { sourceCommit: receipt.sourceCommit, sourceTree: receipt.sourceTree, buildDigest: receipt.buildDigest },
      files: Object.fromEntries(['run', 'image', 'original', 'effective', 'fixture'].map((key) => { const name = `${key}.${key === 'image' ? 'png' : 'json'}`; return [key, { path: name, sha256: sha(files[name as keyof typeof files]) }]; })) };
    const uploads = Object.entries(files).map(([name, buffer]) => ({ name, mimeType: name.endsWith('.png') ? 'image/png' : 'application/json', buffer }));
    await page.locator('#evidence-slot').selectOption(slot);
    if (slot === 'A') {
      const wrong = structuredClone(sidecar); wrong.runtime.comparison!.frame = { ...wrong.runtime.comparison!.frame, sourceRevision: 9999 };
      await page.locator('#evidence-files').setInputFiles([...uploads, { name: 'capture.binding.json', mimeType: 'application/json', buffer: Buffer.from(canonicalJson(wrong)) }]); await page.locator('#bind').click();
      await expect(page.locator('#evidence-status')).toContainText('mismatch'); await expect(page.locator('#export-pair')).toBeDisabled();
    }
    const binding = Buffer.from(canonicalJson(sidecar)); await writeFile(info.outputPath(`ui43-${slot}-binding.json`), binding, { flag: 'wx' });
    await page.locator('#evidence-files').setInputFiles([...uploads, { name: 'capture.binding.json', mimeType: 'application/json', buffer: binding }]); await page.locator('#bind').click(); await expect(page.locator('#evidence-status')).toContainText(`${slot} bound`);
  }
  await expect(page.locator('#export-pair')).toBeEnabled();
  const exported: string[] = [];
  for (let index = 0; index < 2; index++) { const event = page.waitForEvent('download'); await page.locator('#export-pair').click(); exported.push(await readFile(await (await event).path(), 'utf8')); }
  expect(exported[0]).toBe(exported[1]); const pair = JSON.parse(exported[0]!) as { pairHash: string }; expect(pair.pairHash).toMatch(/^[a-f0-9]{64}$/);
  await page.locator('#step').click(); await ready(page); await expect(page.locator('#export-pair')).toBeDisabled();
});
