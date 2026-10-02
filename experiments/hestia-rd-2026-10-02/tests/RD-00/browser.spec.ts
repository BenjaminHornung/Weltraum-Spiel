import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { controlManifest, createControlScenario } from '../../src/contracts/controlFixture';
import { importFixture, getFixtureDigest } from '../../src/contracts/fixture';
import { getScenarioDigest } from '../../src/contracts/scenario';
import { createRunResult, type LabMetric } from '../../src/contracts/result';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('RD-00 diagnostic browser: controlled pause/seek/reset, replace, double mount and teardown', async ({ page, browser }) => {
  const errors: string[] = []; page.on('pageerror', (error) => { errors.push(error.message); });
  page.on('console', (message) => { if (message.type() === 'error') { errors.push(message.text()); } });
   const response = await page.goto('/');
   expect(await response!.text()).toBe(readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8'));
  const facts = page.locator('#facts'); const status = page.locator('#status');
  await expect(status).toHaveText('Ready — no renderer host');
  expect(await page.evaluate(() => 'TestBridge' in window)).toBe(false);
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  await expect(facts).toHaveAttribute('data-mounts', '1');
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  await expect(status).toContainText('already mounted'); await expect(facts).toHaveAttribute('data-mounts', '1');
  await page.getByRole('button', { name: 'Advance 60 ticks' }).click(); await expect(facts).toHaveAttribute('data-tick', '60');
  await page.getByLabel('Pause').check(); await page.getByRole('button', { name: 'Advance 60 ticks' }).click();
  await expect(facts).toHaveAttribute('data-tick', '60');
  await page.getByLabel('Seek tick').fill('90'); await page.getByRole('button', { name: 'Seek', exact: true }).click();
  await expect(facts).toHaveAttribute('data-tick', '90');
  const oldDigest = await facts.getAttribute('data-digest');
  await page.getByRole('button', { name: 'Replace snapshot' }).click();
  await expect(facts).not.toHaveAttribute('data-digest', oldDigest!);
   const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00';
   const runId = process.env.RD00_BROWSER_RUN_ID!;
   mkdirSync(`${run}/media`, { recursive: true }); mkdirSync(`${run}/browser/${runId}`, { recursive: true });
   const image = `${run}/media/${runId}.png`; await page.screenshot({ path: image, fullPage: true });
  const state = JSON.parse((await facts.textContent())!);
  expect(state.facts.logicalCosts.gpuBytes.status).toBe('unsupported');
   expect(state.facts.logicalCosts.gpuBytes).not.toHaveProperty('value'); expect(state.productIntegrated).toBe(false);
   expect(state.scenarioId).toBe('RD00-CONTRACT-CONTROL'); expect(state.facts.sourceRevision).toBe(1);
  await page.getByRole('button', { name: 'Reset', exact: true }).click(); await expect(facts).toHaveAttribute('data-tick', '0');
  await page.getByRole('button', { name: 'Dispose', exact: true }).click();
  await page.getByRole('button', { name: 'Dispose', exact: true }).click(); await expect(facts).toHaveAttribute('data-mounts', '0');
  await page.getByRole('button', { name: 'Mount', exact: true }).click(); await expect(facts).toHaveAttribute('data-mounts', '1');
  await page.getByRole('button', { name: 'Dispose', exact: true }).click(); await expect(facts).toHaveAttribute('data-mounts', '0');
   expect(await page.locator('canvas').count()).toBe(1); expect(errors).toEqual([]);
   const codeHash = sha(readFileSync(new URL('../../src/contracts/controlFixture.ts', import.meta.url)));
   const fixture = await importFixture(new TextEncoder().encode(JSON.stringify(controlManifest(codeHash, codeHash, 1))));
   expect(getFixtureDigest(fixture)).toBe(state.fixtureDigest);
   expect(await getScenarioDigest(createControlScenario(fixture))).toBe(state.scenarioDigest);
   const buildFiles = ['index.html', ...readdirSync(new URL('../../dist/assets/', import.meta.url)).map((name) => `assets/${name}`)].sort();
   const buildBinding = buildFiles.map((name) => ({ path: name, sha256: sha(readFileSync(new URL(`../../dist/${name}`, import.meta.url))) }));
   for (const entry of buildBinding) {
     const served = await page.request.get(`/${entry.path}`); expect(served.ok()).toBe(true); expect(sha(await served.body())).toBe(entry.sha256);
   }
   const sourceFiles = ['index.html', 'src/registration.ts', 'src/contracts/controlFixture.ts', 'src/contracts/validation.ts',
     'src/contracts/fixture.ts', 'src/contracts/experiment.ts', 'src/contracts/scenario.ts', 'src/contracts/result.ts', 'vite.config.ts', 'tsconfig.json'].sort();
   const sourceBinding = sourceFiles.map((name) => ({ path: name, sha256: sha(readFileSync(new URL(`../../${name}`, import.meta.url))) }));
   const notRun = (unit: string): LabMetric => ({ status: 'not-run', unit, reason: 'Functional smoke only; no qualified measurements or GPU benchmark lease' });
   const result = createRunResult({ schema: 'hestia-rd-result-v1', runId, scenarioId: state.scenarioId, scenarioDigest: state.scenarioDigest,
     variantId: 'contract-control', fixtureDigest: state.fixtureDigest, sourceRefs: fixture.sourceRefs, sourceDigest: fixture.sourceRefs[0].sourceDigest,
     sourceBytesDigest: sha(new TextEncoder().encode(JSON.stringify(sourceBinding))),
     buildDigest: sha(new TextEncoder().encode(JSON.stringify(buildBinding))), lockDigest: sha(readFileSync(new URL('../../package-lock.json', import.meta.url))),
     browser: { executable: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe', version: browser.version() },
     device: { id: 'rd00-local-win32-smoke', description: 'Task-owned Chromium; GPU model/driver not queried',
       driver: { status: 'unsupported', unit: 'version', reason: 'Canvas2D smoke does not identify the native GPU driver' } },
     backend: 'Canvas2D-contract-control', runClass: 'diagnostic', temperature: 'process-cold',
     samples: { planned: 1, observed: 1, skipped: 0, failed: 0, skippedReasons: [] },
     rawDataPaths: [`browser/${runId}/diagnostic.json`, `browser/${runId}/report.json`, 'commands.jsonl'], errors,
     metrics: { cpuMs: notRun('ms'), gpuMs: notRun('ms'), frameMs: notRun('ms'), uploadBytes: notRun('byte'),
       cpuBytes: notRun('byte'), gpuBytes: state.facts.logicalCosts.gpuBytes },
     media: [{ path: `media/${runId}.png`, sha256: sha(readFileSync(image)), kind: 'image' }],
     gates: [{ id: 'RD00-browser-smoke', status: 'PASS', reason: 'Visible controls, deterministic state, exact fixture/scenario binding and teardown checked' },
       { id: 'selection-benchmark', status: 'NOT_RUN', reason: 'No GPU lease and no RD-03 qualifying runner' }], productIntegrated: false });
   writeFileSync(`${run}/browser/${runId}/result.json`, JSON.stringify(result, null, 2));
   writeFileSync(`${run}/browser/${runId}/byte-bindings.json`, JSON.stringify({ sourceBinding, buildBinding, serverMode: 'Vite-preview-built-dist' }, null, 2));
   writeFileSync(`${run}/browser/${runId}/diagnostic.json`, JSON.stringify({ status: 'PASS', kind: 'diagnostic-not-benchmark', runId,
    browserVersion: browser.version(), executable: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe',
    origin: page.url(), state, finalRegisteredMounts: 0, errors,
    media: { path: image, sha256: createHash('sha256').update(readFileSync(image)).digest('hex') },
    performance: 'NOT_RUN', art: 'NOT_RUN', productIntegrated: false }, null, 2));
});
