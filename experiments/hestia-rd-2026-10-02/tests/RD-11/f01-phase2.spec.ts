import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { admit, directory, sha } from '../../reports/RD-11/run.mjs';
import { bytes } from '../../reports/RD-11/phase2.mjs';
import { fixtureRevision, getFixtureDigest } from '../../src/contracts/fixture';
import { sampleScenario } from '../../src/contracts/scenario';
import { loadInventory, loadReplay } from '../../src/runner/assets';

const owner = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/browser/${process.env.HESTIA_RD_BROWSER_RUN_ID}`;
const read = async (page: Page) => JSON.parse(await page.locator('#facts').innerText());
const localFetch: typeof fetch = async (input) => new Response(bytes(fileURLToPath(new URL(`../../fixtures${new URL(String(input)).pathname}`, import.meta.url))));
function save(name: string, data: unknown) {
  const file = path.join(owner, name); admit(file, { owner }); directory(path.dirname(file), owner); admit(file, { owner });
  writeFileSync(file, JSON.stringify(data, null, 2), { flag: 'wx' });
}
for (const mode of ['C1', 'C2'] as const) {
  test(`${mode} F01 frozen camera/weather/reset keyframes and backward seek`, async ({ page }) => {
    test.setTimeout(180_000);
    const publicRoot = new URL('http://127.0.0.1:5280/'); const inventory = await loadInventory(publicRoot, localFetch);
    const replay = await loadReplay(inventory, 'F01-HVP-COAST-REPLAY', publicRoot, localFetch);
    const entry = '/src/experiments/three-webgpu/index.html';
    const response = await page.goto(`${entry}?mode=${mode}&scenario=F01-HVP-COAST-REPLAY`);
    expect(sha(await response!.body())).toBe(sha(bytes(path.join(process.env.HESTIA_RD11_OPTIMIZED_BUILD!, entry))));
    expect(await page.evaluate(() => 'TestBridge' in window)).toBe(false);
    await page.getByRole('button', { name: 'Mount', exact: true }).click();
    await expect(page.locator('#status')).toContainText(/Mounted|UNSUPPORTED|FAILED/, { timeout: 30_000 });
    if (/UNSUPPORTED/.test(await page.locator('#status').innerText())) {
      save(`${mode}/unsupported.json`, { status: await page.locator('#status').innerText(), state: await read(page) });
      test.skip(true, `${mode} native keyframe gate unavailable; not a fallback success`);
    }
    await expect(page.locator('#status')).toContainText('Mounted');
    await page.getByLabel('Pause', { exact: true }).check();
    const ticks = [0, ...replay.scenario.keyframes.flatMap((event) => [event.tick - 1, event.tick]), 1559, 0];
    const observations = [];
    for (const [index, tick] of ticks.entries()) {
      const expected = sampleScenario(replay.scenario, tick, true);
      await page.getByLabel('Seek tick', { exact: true }).fill(String(tick)); await page.getByRole('button', { name: 'Seek', exact: true }).click();
      await expect(page.locator('#status')).toContainText('Seek applied');
      await page.waitForFunction(({ tick, digest, camera }) => {
        const d = JSON.parse(document.querySelector('#facts')!.textContent!).diagnostics;
        return !d?.pending && d?.rendered?.tick === tick && d.rendered.fixtureDigest === digest && d.rendered.cameraId === camera
          && d.rendered.projectionGeneration === d.projectionGeneration;
      }, { tick, digest: getFixtureDigest(expected.fixture), camera: expected.frame.cameraId });
      const before = await read(page); const d = before.diagnostics;
      expect(d.frame).toEqual(expected.frame); expect(d.resetTick).toBe(expected.resetTick);
      expect(d.fixtureDigest).toBe(getFixtureDigest(expected.fixture)); expect(d.sourceRevision).toBe(fixtureRevision(expected.fixture));
      expect(d.backend.actual).toBe(mode === 'C1' ? 'webgl2' : 'webgpu'); expect(d.backend.initialized).toBe(true); expect(d.backend.fallbackObserved).toBe(false); expect(d.pending).toBe(false);
      const imagePath = path.join(owner, mode, `${index}-${tick}.png`); admit(imagePath, { owner }); directory(path.dirname(imagePath), owner); admit(imagePath, { owner });
      const image = await page.locator('#view').screenshot({ path: imagePath });
      const after = await read(page); expect(after.diagnostics.frame).toEqual(d.frame); expect(after.diagnostics.rendered).toEqual(d.rendered); expect(after.diagnostics.pending).toBe(false);
      const media = { path: imagePath, sha256: sha(image), width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
      const row = { mode, tick, before, after, media }; observations.push(row); save(`${mode}/${index}-${tick}.json`, row);
      if (tick === 120) {
        const uiPath = path.join(owner, mode, 'C07-visible-ui.png'); admit(uiPath, { owner }); const uiImage = await page.screenshot({ path: uiPath });
        const uiAfter = await read(page); expect(uiAfter.diagnostics.frame).toEqual(d.frame); expect(uiAfter.diagnostics.rendered).toEqual(d.rendered);
        save(`${mode}/C07-visible-ui.json`, { before: after, after: uiAfter, path: uiPath, sha256: sha(uiImage) });
      }
    }
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(document.querySelector('#facts')!.textContent!).diagnostics?.rendered?.tick === 0);
    const reset = await read(page); expect(reset.diagnostics.frame).toEqual(sampleScenario(replay.scenario, 0, false).frame);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForFunction(() => { const d = JSON.parse(document.querySelector('#facts')!.textContent!).diagnostics; return d?.frame.tick >= 2 && d?.rendered.tick === d.frame.tick; });
    await page.getByLabel('Pause', { exact: true }).check();
    await page.waitForFunction(() => { const d = JSON.parse(document.querySelector('#facts')!.textContent!).diagnostics; return d?.frame.paused === true && d?.rendered.tick === d.frame.tick; });
    const paused = await read(page); expect(paused.diagnostics.frame).toEqual(sampleScenario(replay.scenario, paused.diagnostics.frame.tick, true).frame);
    await page.getByLabel('Pause', { exact: true }).uncheck(); await expect(page.locator('#status')).toContainText('Pause state applied');
    await page.getByRole('button', { name: 'Advance 60 ticks', exact: true }).click();
    const advancedTick = paused.diagnostics.frame.tick + 60;
    await page.waitForFunction((tick) => JSON.parse(document.querySelector('#facts')!.textContent!).diagnostics?.rendered?.tick === tick, advancedTick);
    const advanced = await read(page); expect(advanced.diagnostics.frame).toEqual(sampleScenario(replay.scenario, advancedTick, false).frame);
    const controlsPath = path.join(owner, mode, 'play-pause-advance-visible-ui.png'); admit(controlsPath, { owner });
    const controlsImage = await page.screenshot({ path: controlsPath }); const controlsAfter = await read(page);
    expect(controlsAfter.diagnostics.frame).toEqual(advanced.diagnostics.frame); expect(controlsAfter.diagnostics.rendered).toEqual(advanced.diagnostics.rendered);
    save(`${mode}/play-pause-advance-visible-ui.json`, { before: advanced, after: controlsAfter, path: controlsPath, sha256: sha(controlsImage) });
    await page.getByRole('button', { name: 'Dispose', exact: true }).click(); await expect(page.locator('#status')).toContainText('Disposed');
    const disposed = await read(page); expect(disposed.liveHosts).toEqual({ renderers: 0, renderloops: 0, abortListeners: 0 });
    save(`${mode}/replay.json`, { observations, reset, paused, advanced, disposed, weatherShaderHooks: 'UNSUPPORTED_METADATA_ONLY', otherCameraRoi: 'NOT_RUN', productIntegrated: false });
  });
}
