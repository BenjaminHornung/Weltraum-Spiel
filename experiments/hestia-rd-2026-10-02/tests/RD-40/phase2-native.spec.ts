import { test, expect, type Browser, type Download, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../../src/contracts/validation';
import { createRunResult } from '../../src/contracts/result';
import type { GalleryState } from '../../src/tools/variant-gallery/session';
import type { SourceBinding } from '../../src/tools/variant-gallery/source';
import { nativeCanvasCapture } from './native-canvas-capture';

const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
type Facts = { productIntegrated: false; state: GalleryState; source: SourceBinding; owners: {
  registeredMounts: number; c0: { renderers: number; renderloops: number }; rd11: { renderers: number; renderloops: number } } };
type Receipt = { sourceCommit: string; sourceTree: string; sourceBytesDigest: string; buildDigest: string; entrySha256: string };
type Upload = { name: string; mimeType: string; buffer: Buffer };
type Inputs = Record<'original.json' | 'effective.json' | 'fixture.json', unknown>;
type ReadProbe = { names: string[]; release?: () => void };
let receipt: Receipt;
const pageErrors = new WeakMap<Page, string[]>();

async function facts(page: Page): Promise<Facts> {
  const text = await page.locator('#facts').textContent(); expect(text?.trim(), 'Actual DOM facts JSON must be nonempty').toBeTruthy();
  return JSON.parse(text!) as Facts;
}
async function ready(page: Page) {
  await expect(page.locator('#status')).toHaveAttribute('data-status', 'READY'); await expect(page.locator('#step')).toBeEnabled();
  const value = await facts(page); expect(value.state.busy).toBe(false); expect(value.state.comparison!.frame.paused).toBe(true);
  expect(value.state.submission!.backend.actual).toBe(value.state.submission!.backend.requested);
  expect(value.source.sourceBytesDigest).toBe(receipt.sourceBytesDigest); expect(value.productIntegrated).toBe(false);
  return value;
}
async function open(page: Page, wait = true) {
  await page.goto('/'); expect(await page.evaluate(() => 'TestBridge' in window)).toBe(false);
  const response = page.waitForResponse((value) => value.url().endsWith('/src/tools/variant-gallery/index.html'));
  await page.getByRole('link', { name: 'RD40 variant gallery', exact: true }).click();
  expect(sha(await (await response).body())).toBe(receipt.entrySha256);
  expect(await page.evaluate(() => 'TestBridge' in window)).toBe(false); if (wait) { await ready(page); }
}
async function seek(page: Page, tick: number) {
  await page.locator('#seek').fill(String(tick)); await page.locator('#seek-go').click();
  await expect(page.locator('#facts')).toHaveAttribute('data-tick', String(tick)); return ready(page);
}
async function save(info: TestInfo, name: string, bytes: Uint8Array | string) { await writeFile(info.outputPath(name), bytes, { flag: 'wx' }); }
async function capture(page: Page, info: TestInfo, name: string, classification: string, canvasOnly = false) {
  const before = await facts(page);
  const bytes = canvasOnly ? await nativeCanvasCapture(page, info, name, receipt) : await page.screenshot({ fullPage: true });
  const after = await facts(page); expect(after.state.comparison).toEqual(before.state.comparison);
  if (!canvasOnly) { await save(info, `${name}.png`, bytes); }
  await save(info, `${name}.json`, JSON.stringify({ productIntegrated: false, classification,
    pngSha256: sha(bytes), sourceCommit: receipt.sourceCommit, sourceTree: receipt.sourceTree, buildDigest: receipt.buildDigest, facts: after }, null, 2));
  return { bytes, facts: after };
}
async function downloaded(download: Download, info: TestInfo, name: string) {
  const file = await download.path(); expect(file).toMatch(/^C:[/\\]IFI_SourceCode[/\\]/i);
  const bytes = await readFile(file); await save(info, name, bytes); return bytes;
}
async function inputs(page: Page, info: TestInfo, name: string) {
  const event = page.waitForEvent('download'); await page.locator('#inputs').click();
  return JSON.parse((await downloaded(await event, info, name)).toString()) as Inputs;
}
async function bundle(page: Page, browser: Browser, info: TestInfo, name: string) {
  const value = await ready(page); const input = await inputs(page, info, `${name}-inputs.json`);
  const image = await capture(page, info, `${name}-viewport`, 'ACTUAL-OPTIMIZED-NATIVE-FUNCTIONAL-IMAGE', true);
  const state = value.state; const c = state.comparison!;
  const unavailable = (unit: string) => ({ status: 'not-run' as const, unit, reason: 'Functional image only; no qualified platform or GPU/performance grant' });
  const run = createRunResult({ schema: 'hestia-rd-result-v1', runId: `RD40-PHASE2-${name}`, scenarioId: c.scenarioId,
    scenarioDigest: c.effectiveScenarioDigest, variantId: state.selection!.variant, fixtureDigest: c.fixtureDigest, sourceRefs: c.sourceRefs,
    buildDigest: receipt.buildDigest, lockDigest: value.source.lockDigest, sourceDigest: value.source.sourceDigest, sourceBytesDigest: value.source.sourceBytesDigest,
    browser: { executable: process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH!.replaceAll('\\', '/'), version: browser.version() },
    device: { id: 'UNQUALIFIED-FUNCTIONAL-BROWSER', description: 'Actual browser image; driver/device not measured or qualified', driver: unavailable('metadata') },
    backend: state.submission!.backend.label, runClass: 'image-motion', temperature: 'warm', samples: { planned: 1, observed: 1, skipped: 0, failed: 0, skippedReasons: [] },
    rawDataPaths: [`${name}-viewport.json`], errors: [], metrics: { cpuMs: unavailable('ms'), gpuMs: unavailable('ms'), frameMs: unavailable('ms'),
      uploadBytes: unavailable('bytes'), cpuBytes: unavailable('bytes'), gpuBytes: unavailable('bytes') },
    media: [{ path: 'image.png', sha256: sha(image.bytes), kind: 'image' }], gates: [{ id: 'QUALIFIED-NATIVE-BENCHMARK', status: 'NOT_RUN', reason: 'Functional capture only' }], productIntegrated: false });
  const files = { 'run.json': Buffer.from(canonicalJson(run)), 'image.png': image.bytes, 'original.json': Buffer.from(canonicalJson(input['original.json'])),
    'effective.json': Buffer.from(canonicalJson(input['effective.json'])), 'fixture.json': Buffer.from(canonicalJson(input['fixture.json'])) };
  const sidecar = { schema: 'rd40-comparison-binding-v1', productIntegrated: false,
    runtime: { selection: state.selection, comparison: c, backend: state.submission!.backend, quality: state.submission!.quality,
      source: { sourceDigest: value.source.sourceDigest, sourceBytesDigest: value.source.sourceBytesDigest, lockDigest: value.source.lockDigest } },
    provenance: { sourceCommit: receipt.sourceCommit, sourceTree: receipt.sourceTree, buildDigest: receipt.buildDigest },
    files: Object.fromEntries(['run', 'image', 'original', 'effective', 'fixture'].map((key) => {
      const filename = `${key}.${key === 'image' ? 'png' : 'json'}`; return [key, { path: filename, sha256: sha(files[filename as keyof typeof files]) }];
    })) };
  const uploads: Upload[] = Object.entries(files).map(([filename, buffer]) => ({ name: filename, buffer, mimeType: filename.endsWith('.png') ? 'image/png' : 'application/json' }));
  uploads.push({ name: 'capture.binding.json', buffer: Buffer.from(canonicalJson(sidecar)), mimeType: 'application/json' });
  for (const file of uploads) { await save(info, `${name}-${file.name}`, file.buffer); }
  return { uploads, image: image.bytes, facts: value };
}
async function fileProbe(page: Page, delayFirst = false) {
  await page.evaluate((delay) => {
    const probe: ReadProbe = { names: [] }; (window as typeof window & { rd40FileProbe: ReadProbe }).rd40FileProbe = probe;
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      probe.names.push(this.name);
      if (delay && probe.names.length === 1) { await new Promise<void>((resolve) => { probe.release = resolve; }); }
      return original.call(this);
    };
  }, delayFirst);
}
async function reads(page: Page) { return page.evaluate(() => (window as typeof window & { rd40FileProbe: ReadProbe }).rd40FileProbe.names); }

test.beforeAll(async () => {
  expect(process.env.HESTIA_RD40_PHASE2_BROWSER_GRANTED).toBe('1');
  const bytes = await readFile(process.env.HESTIA_RD40_HEAD_RECEIPT!);
  expect(sha(bytes)).toBe('00fee3e3fece1fa317a6ec8f63167d565b137b33fc7ced6a5e0da184165292f0'); receipt = JSON.parse(bytes.toString()) as Receipt;
  expect(receipt.sourceCommit).toBe('32e88a34f417ae4f92fa7ed278e772846928eaf5'); expect(receipt.sourceTree).toBe('a0c26c6d7e530f70dae8326eb50115b4aa92781c');
});
test.beforeEach(({ page }) => { const errors: string[] = []; pageErrors.set(page, errors); page.on('pageerror', (error) => { errors.push(String(error)); }); });
test.afterEach(async ({ page }, info) => {
  const errors: unknown[] = [];
  if (await page.locator('#dispose').count()) {
    try {
      if (info.status !== info.expectedStatus) { await capture(page, info, 'native-failure-before-dispose', 'ACTUAL-FAILURE-NO-RECLASSIFICATION'); }
    } catch (error) { errors.push(error); }
    try {
      await page.locator('#dispose').click(); await expect(page.locator('#status')).toContainText('disposed');
    } catch (error) { errors.push(error); }
    try {
      const value = await facts(page); expect(value.owners.registeredMounts).toBe(0);
      expect(value.owners.c0).toMatchObject({ renderers: 0, renderloops: 0 }); expect(value.owners.rd11).toMatchObject({ renderers: 0, renderloops: 0 });
      await save(info, 'native-cleanup.json', JSON.stringify({ productIntegrated: false, sourceCommit: receipt.sourceCommit,
        owners: value.owners, state: value.state, pageErrors: pageErrors.get(page), runtimeDisposedBeforeContextClose: true }, null, 2));
    } catch (error) { errors.push(error); }
  }
  try { expect(pageErrors.get(page)).toEqual([]); } catch (error) { errors.push(error); }
  if (errors.length) { throw new AggregateError(errors, 'Native capture/cleanup verification; original test error remains in the report'); }
});

test('UI40 native invalid typed seek preserves nonzero snapshot/reset and live owner; valid backseek remains usable', async ({ page }, info) => {
  await open(page); await page.locator('#fixture').selectOption('F04-DETACH'); await ready(page);
  const input = await inputs(page, info, 'seek-frozen-inputs.json');
  const scenario = input['original.json'] as { snapshots: { tick: number }[]; keyframes: { type: string; tick: number }[] };
  const tick = Math.max(...scenario.snapshots.map((row) => row.tick), ...scenario.keyframes.filter((row) => row.type === 'ResetLab').map((row) => row.tick)) + 1;
  const baseline = await seek(page, tick); expect(baseline.state.comparison!.resetTick).not.toBeNull();
  await capture(page, info, 'native-seek-snapshot', 'ACTUAL-OPTIMIZED-NATIVE-UI');
  const canvas = await page.locator('#gallery-canvas').elementHandle();
  for (const text of ['', '2.5', '-1', String(baseline.state.durationTicks + 1), 'NaN']) {
    await page.locator('#seek').fill(text === 'NaN' ? '' : text);
    if (text === 'NaN') { await page.locator('#seek').pressSequentially('NaN'); expect(Number.isNaN(await page.locator('#seek').evaluate((input: HTMLInputElement) => input.valueAsNumber))).toBe(true); }
    await page.locator('#seek-go').click(); await expect(page.locator('#input-error')).toContainText('Enter an integer tick');
    const current = await ready(page); expect(current.state).toEqual(baseline.state); expect(current.owners).toEqual(baseline.owners);
    expect(await canvas!.evaluate((original) => original === document.getElementById('gallery-canvas'))).toBe(true);
  }
  const back = await seek(page, 7); expect(back.state.comparison!.resetTick).toBeNull();
  expect(back.state.comparison!.fixtureDigest).not.toBe(baseline.state.comparison!.fixtureDigest);
  await expect(page.locator('#input-error')).toHaveText(''); await capture(page, info, 'native-seek-backward', 'ACTUAL-OPTIMIZED-NATIVE-UI');
});

test('UI43 CONTROLLED File.arrayBuffer admission spy: later real oversized JSON blocks whole six-file selection before any copy', async ({ page, browser }, info) => {
  await open(page); await page.locator('#viewport').selectOption('640,360,1'); await ready(page); await seek(page, 19);
  const data = await bundle(page, browser, info, 'admission'); await fileProbe(page);
  const oversized = data.uploads.map((file) => file.name === 'fixture.json' ? { ...file, buffer: Buffer.alloc(1024 * 1024 + 1, 32) } : file);
  await page.locator('#evidence-files').setInputFiles(oversized);
  expect(await page.locator('#evidence-files').evaluate((input: HTMLInputElement) => [...input.files!].find((file) => file.name === 'fixture.json')!.size)).toBe(1024 * 1024 + 1);
  await page.locator('#bind').click(); await expect(page.locator('#evidence-status')).toContainText('oversized local file');
  expect(await reads(page)).toEqual([]); await expect(page.locator('#export-pair')).toBeDisabled(); await expect(page.locator('#bind')).toBeEnabled();
  await save(info, 'controlled-pre-copy-admission.json', JSON.stringify({ productIntegrated: false, classification: 'CONTROLLED-FILE-READ-SPY-ACTUAL-DOM-NATIVE-FILE-METADATA',
    names: oversized.map((file) => ({ name: file.name, bytes: file.buffer.length })), arrayBufferCalls: await reads(page), facts: await facts(page) }, null, 2));
});

test('UI43 CONTROLLED first File.read delay: repeated actual Bind cannot overlap and stale/disposed completion cannot re-enable', async ({ page, browser }, info) => {
  await open(page); await page.locator('#viewport').selectOption('640,360,1'); await ready(page); await seek(page, 19);
  const data = await bundle(page, browser, info, 'pending'); await fileProbe(page, true);
  await page.locator('#evidence-files').setInputFiles(data.uploads); await page.locator('#bind').click();
  await expect(page.locator('#bind')).toBeDisabled(); await page.locator('#bind').dispatchEvent('click'); expect(await reads(page)).toEqual(['capture.binding.json']);
  await page.evaluate(() => { (window as typeof window & { rd40FileProbe: ReadProbe }).rd40FileProbe.release!(); });
  await expect(page.locator('#evidence-status')).toContainText('A bound'); expect(await reads(page)).toHaveLength(6); await expect(page.locator('#bind')).toBeEnabled();
  await fileProbe(page, true); await page.locator('#bind').click(); await expect(page.locator('#bind')).toBeDisabled();
  await page.locator('#dispose').click(); await expect(page.locator('#status')).toContainText('disposed');
  await page.evaluate(() => { (window as typeof window & { rd40FileProbe: ReadProbe }).rd40FileProbe.release!(); });
  await expect(page.locator('#evidence-status')).toContainText('Runtime no longer ready'); await expect(page.locator('#bind')).toBeDisabled();
  await save(info, 'controlled-pending-bind.json', JSON.stringify({ productIntegrated: false, classification: 'CONTROLLED-FILE-READ-DELAY-NOT-NORMAL-PNG-TIMING',
    initialRepeatedBindCopies: 1, completedFirstCopies: 6, disposedCopies: await reads(page), facts: await facts(page) }, null, 2));
});

test('UI41 CONTROLLED actual inventory HTTP held: initial A/B disabled and forced events safe; released latest selection coalesces', async ({ page }, info) => {
  let release!: () => void; const held = new Promise<void>((resolve) => { release = resolve; });
  let requested!: () => void; const request = new Promise<void>((resolve) => { requested = resolve; });
  await page.route('**/inventory.json', async (route) => { requested(); await held; await route.continue(); });
  try {
    await open(page, false); await request;
    await expect(page.locator('#switch-a')).toBeDisabled(); await expect(page.locator('#switch-b')).toBeDisabled();
    await page.locator('#switch-a').dispatchEvent('click'); await page.locator('#switch-b').dispatchEvent('click');
    expect(pageErrors.get(page)).toEqual([]); expect((await facts(page)).owners.registeredMounts).toBe(0);
    await capture(page, info, 'controlled-inventory-held', 'CONTROLLED-HTTP-DELAY-AND-FORCED-DOM-EVENTS');
  } finally { release(); }
  await ready(page); await expect(page.locator('#switch-a')).toBeEnabled(); await expect(page.locator('#switch-b')).toBeEnabled();
  await page.locator('#switch-b').click(); await expect(page.locator('#switch-a')).toBeEnabled();
  await page.locator('#switch-a').click(); const value = await ready(page);
  expect(value.state.selection!.variant).toBe('fixture-control'); expect(value.owners.registeredMounts).toBe(1);
  expect(value.owners.c0.renderloops + value.owners.rd11.renderloops).toBe(1);
  await capture(page, info, 'native-inventory-released-latest', 'ACTUAL-OPTIMIZED-NATIVE-UI-AFTER-CONTROLLED-DELAY');
});

test('UI43 native PNG-bound A/B stable pair and actual contact-sheet downloads decode and bind their own source images', async ({ page, browser }, info) => {
  await open(page); await page.locator('#fixture').selectOption('F04-DETACH'); await ready(page);
  await page.locator('#viewport').selectOption('640,360,1'); await ready(page); await seek(page, 19);
  const images: Buffer[] = []; const captured: Facts[] = [];
  for (const slot of ['A', 'B'] as const) {
    await page.locator(`#switch-${slot.toLowerCase()}`).click(); await ready(page); const data = await bundle(page, browser, info, `contact-${slot.toLowerCase()}`);
    images.push(data.image); captured.push(data.facts); await page.locator('#evidence-slot').selectOption(slot);
    await page.locator('#evidence-files').setInputFiles(data.uploads); await page.locator('#bind').click(); await expect(page.locator('#evidence-status')).toContainText(`${slot} bound`);
  }
  expect(captured[0]!.state.comparison).toEqual(captured[1]!.state.comparison); await expect(page.locator('#contact-sheet')).toBeEnabled();
  const pairs: Buffer[] = [];
  for (let index = 0; index < 2; index++) { const event = page.waitForEvent('download'); await page.locator('#export-pair').click(); pairs.push(await downloaded(await event, info, `native-pair-${index}.json`)); }
  expect(pairs[0]).toEqual(pairs[1]); const pair = JSON.parse(pairs[0]!.toString()) as { A: { runtime: unknown }; B: { runtime: unknown }; hashes: { A: string; B: string }; pairHash: string };
  const { pairHash, ...cards } = pair; expect(sha(canonicalJson(cards))).toBe(pairHash);
  expect(pair.A.runtime).toMatchObject({ comparison: captured[0]!.state.comparison, source: { sourceBytesDigest: receipt.sourceBytesDigest } });
  expect(pair.B.runtime).toMatchObject({ comparison: captured[1]!.state.comparison, source: { sourceBytesDigest: receipt.sourceBytesDigest } });
  const events: Download[] = []; const collect = (download: Download) => { events.push(download); }; page.on('download', collect);
  await page.locator('#contact-sheet').click(); await expect.poll(() => events.length).toBe(2); page.off('download', collect);
  const pngEvent = events.find((event) => event.suggestedFilename() === 'RD40-contact-sheet.png')!;
  const jsonEvent = events.find((event) => event.suggestedFilename() === 'RD40-contact-sheet.json')!;
  const png = await downloaded(pngEvent, info, 'RD40-contact-sheet.png');
  const sidecarBytes = await downloaded(jsonEvent, info, 'RD40-contact-sheet.json'); const sidecar = JSON.parse(sidecarBytes.toString()) as {
    imageSha256: string; A: string; B: string; imageSources: { key: string; sha256: string }[][] };
  expect(sidecar).toMatchObject({ productIntegrated: false, imageSha256: sha(png), A: pair.hashes.A, B: pair.hashes.B, classification: 'TOOL-SIDECAR-NOT-NATIVE-BENCHMARK' });
  for (const [index, image] of images.entries()) { expect(sidecar.imageSources[index]!.find((row) => row.key === 'image')!.sha256).toBe(sha(image)); }
  const decoded = await page.evaluate(async ({ contact, sourceImages }) => {
    const decode = async (base64: string) => createImageBitmap(new Blob([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], { type: 'image/png' }));
    const contactBitmap = await decode(contact); const canvas = document.createElement('canvas'); canvas.width = contactBitmap.width; canvas.height = contactBitmap.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(contactBitmap, 0, 0); const results = [];
    for (const [index, base64] of sourceImages.entries()) {
      const image = await decode(base64); const own = document.createElement('canvas'); own.width = image.width; own.height = image.height;
      const ownCtx = own.getContext('2d')!; ownCtx.drawImage(image, 0, 0);
      const a = ownCtx.getImageData(0, 0, image.width, image.height).data; const b = ctx.getImageData(index * 640, 0, 640, 360).data;
      results.push({ width: image.width, height: image.height, rgbaEqual: a.length === b.length && a.every((value, offset) => value === b[offset]) }); image.close();
    }
    const result = { width: contactBitmap.width, height: contactBitmap.height, ownImages: results }; contactBitmap.close(); return result;
  }, { contact: png.toString('base64'), sourceImages: images.map((image) => image.toString('base64')) });
  expect(decoded).toEqual({ width: 1280, height: 460, ownImages: [{ width: 640, height: 360, rgbaEqual: true }, { width: 640, height: 360, rgbaEqual: true }] });
  await save(info, 'native-contact-sheet-binding.json', JSON.stringify({ productIntegrated: false, classification: 'ACTUAL-NATIVE-PNG-AND-TOOL-SIDECAR-NOT-BENCHMARK',
    sourceCommit: receipt.sourceCommit, sourceTree: receipt.sourceTree, buildDigest: receipt.buildDigest, pairHash, imageSha256: sha(png), sidecarSha256: sha(sidecarBytes), decoded,
    captured, current: await facts(page) }, null, 2));
});

test('FACTS-READER native closed output textContent retains the actual source/frame across visible disclosure clicks', async ({ page }, info) => {
  await open(page); await seek(page, 19);
  const details = page.locator('details:has(#facts)'); const output = page.locator('#facts');
  expect(await details.evaluate((element: HTMLDetailsElement) => element.open)).toBe(false);
  expect(await output.innerText()).toBe(''); const closed = await facts(page);
  const closedText = await output.textContent(); expect(closedText).toBe(await output.evaluate((element: HTMLOutputElement) => element.value));
  await details.locator('summary').click(); expect(await details.evaluate((element: HTMLDetailsElement) => element.open)).toBe(true);
  const expanded = await facts(page); expect(await output.innerText()).toBe(await output.textContent());
  expect(expanded.source).toEqual(closed.source); expect(expanded.state.comparison).toEqual(closed.state.comparison);
  expect(expanded.state.submission!.backend).toEqual(closed.state.submission!.backend); expect(expanded.owners).toEqual(closed.owners);
  await details.locator('summary').click(); expect(await details.evaluate((element: HTMLDetailsElement) => element.open)).toBe(false);
  expect(await output.innerText()).toBe(''); const restored = await ready(page);
  expect(restored.source).toEqual(closed.source); expect(restored.state.comparison).toEqual(closed.state.comparison);
  await save(info, 'native-facts-reader-regression.json', JSON.stringify({ productIntegrated: false, classification: 'ACTUAL-NATIVE-DOM-READ-NOT-INJECTED-FACTS',
    sourceCommit: receipt.sourceCommit, sourceTree: receipt.sourceTree, buildDigest: receipt.buildDigest, closedTextBytes: Buffer.byteLength(closedText!),
    closed, expanded, restored, disclosureRestoredThroughVisibleClick: true }, null, 2));
  await capture(page, info, 'native-facts-reader-closed', 'ACTUAL-OPTIMIZED-NATIVE-UI-DISCLOSURE-RESTORED');
});
