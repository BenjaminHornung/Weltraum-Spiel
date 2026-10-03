import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { admit, directory, git, lab, sha } from './run.mjs';
import { buildRoot, bytes, freezePath, freezeSha, root, START, writeJson } from './phase2.mjs';
import { compareRoi, ROIS } from './oracle.ts';

// Diagnostic only. It never changes an oracle, profile, material or acceptance result.
const label = process.argv[2]; assert.match(label ?? '', /^[a-z0-9-]+$/);
const target = `${root}/diagnostics-${label}`; admit(target, { owner: root }); directory(target, root);
assert.equal(execFileSync(git, ['rev-parse', 'HEAD'], { cwd: lab, encoding: 'utf8' }).trim(), START);
assert.equal(sha(bytes(freezePath)), freezeSha);
const chrome = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe';
const browser = await chromium.launch({ executablePath: chrome, headless: true });
let context; let page; const consoleMessages = []; const pageErrors = [];
const readState = async () => JSON.parse(await page.locator('#facts').textContent());
function identity(state) {
  const d = state.diagnostics; assert(d && d.rendered && d.pending === false);
  assert.equal(d.rendered.tick, d.frame.tick); assert.equal(d.rendered.fixtureDigest, d.fixtureDigest);
  assert.equal(d.rendered.sourceRevision, d.sourceRevision); assert.equal(d.frame.sourceRevision, d.sourceRevision);
  assert.equal(d.rendered.cameraId, d.frame.cameraId); assert.equal(d.rendered.projectionGeneration, d.projectionGeneration);
  return { scenarioId: state.scenarioId, scenarioDigest: state.scenarioDigest, fixtureId: d.fixtureId, fixtureDigest: d.fixtureDigest,
    sourceRevision: d.sourceRevision, frame: d.frame, rendered: d.rendered, pending: d.pending, backend: d.backend, resolution: d.resolution };
}
async function capture(name, ui = false) {
  const before = await readState(); const binding = identity(before); const file = `${target}/${name}`; admit(file, { owner: root });
  const png = ui ? await page.screenshot({ path: file }) : await page.locator('#view').screenshot({ path: file });
  const after = await readState(); assert.deepEqual(identity(after), binding, 'Capture crossed a source/frame/pending boundary');
  const record = { path: file, sha256: sha(png), bytes: png.length, width: png.readUInt32BE(16), height: png.readUInt32BE(20), before, after, binding, productIntegrated: false };
  writeJson(`${file}.json`, record); return { png, record };
}
async function roiPixels(png, rect) {
  return page.evaluate(async ({ base64, rect }) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(32, 32); const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, rect[0] * bitmap.width, rect[1] * bitmap.height, rect[2] * bitmap.width, rect[3] * bitmap.height, 0, 0, 32, 32);
    bitmap.close(); return Array.from(ctx.getImageData(0, 0, 32, 32).data);
  }, { base64: Buffer.from(png).toString('base64'), rect });
}
async function compareImages(reference, candidate) {
  const observations = [];
  for (const roi of ROIS) {
    const a = await roiPixels(reference, roi.rect); const b = await roiPixels(candidate, roi.rect);
    let outcome; try { outcome = { status: 'ORACLE_ACCEPTED', ...compareRoi(a, b, 'C1-C2') }; }
    catch (error) { outcome = { status: 'ORACLE_REJECTED', reason: String(error) }; }
    observations.push({ roi, ...outcome, referenceRgbaSha256: sha(Buffer.from(a)), candidateRgbaSha256: sha(Buffer.from(b)) });
  }
  return observations;
}
let result;
try {
  context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 }); page = await context.newPage();
  page.on('console', (message) => { consoleMessages.push({ type: message.type(), text: message.text() }); });
  page.on('pageerror', (error) => { pageErrors.push(String(error)); });
  await page.goto('http://127.0.0.1:5280/'); assert.equal(await page.evaluate(() => 'TestBridge' in window), false);
  const normalUi = `${target}/normal-lab-no-bridge.png`; admit(normalUi, { owner: root }); const normalPng = await page.screenshot({ path: normalUi });
  const normalRoute = { url: page.url(), TestBridgePresent: false, body: await page.locator('body').innerText(), image: { path: normalUi, sha256: sha(normalPng) } };
  const originalFolder = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/browser/rd11-phase2-c5317835-native-01/cases/43eacad7fdae/REN12-NEGATIVE';
  const originalGood = bytes(`${originalFolder}/with-baked-ao.png`); const originalBad = bytes(`${originalFolder}/missing-baked-ao.png`);
  const originalNegative = { goodSha256: sha(originalGood), badSha256: sha(originalBad), observations: await compareImages(originalGood, originalBad) };
  const entry = '/src/experiments/three-webgpu/index.html';
  const response = await page.goto(`http://127.0.0.1:5280${entry}?mode=C1&scenario=F01-HVP-COAST-REPLAY&testBridge=1`);
  assert.equal(sha(await response.body()), sha(bytes(path.join(buildRoot, entry.slice(1)))));
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(document.getElementById('facts').textContent).diagnostics?.rendered?.tick === 0);
  const good = await capture('reproduced-with-baked-ao.png'); await capture('reproduced-good-visible-ui.png', true);
  assert(good.record.before.diagnostics.owners.some((owner) => owner.meshes.some((mesh) => mesh.material.vertexColors)));
  await page.evaluate(() => window.TestBridge.omitVertexColors());
  await page.getByLabel('Seek tick', { exact: true }).fill('1'); await page.getByRole('button', { name: 'Seek', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(document.getElementById('facts').textContent).diagnostics?.rendered?.tick === 1);
  const bad = await capture('reproduced-missing-baked-ao.png'); await capture('reproduced-bad-visible-ui.png', true);
  assert(bad.record.before.diagnostics.owners.every((owner) => owner.meshes.every((mesh) => mesh.material.vertexColors === false)));
  const reproducedNegative = await compareImages(good.png, bad.png);
  await page.getByRole('button', { name: 'Dispose', exact: true }).click(); await page.waitForFunction(() => document.getElementById('facts').dataset.mounts === '0');
  const cleanup = await readState(); assert.deepEqual(cleanup.liveHosts, { renderers: 0, renderloops: 0, abortListeners: 0 });
  result = { status: 'DIAGNOSTIC_EXECUTED_NOT_A_FUNCTIONAL_PASS', failure: 'Original frozen AO ROI accepted actual vertex-color omission', normalRoute, originalNegative, reproducedNegative,
    good: good.record, bad: bad.record, cleanup, browser: browser.version(), executable: chrome, executableSha256: sha(bytes(chrome)),
    oracleSha256: sha(bytes(path.join(lab, 'reports/RD-11/oracle.ts'))), sourceAndProfilesChanged: false, freezeSha, productIntegrated: false };
} finally {
  try { await context?.close(); }
  finally {
    await browser.close();
    writeJson(`${target}/console-and-cleanup.json`, { consoleMessages, pageErrors, ownedContextClosed: context ? true : 'NOT_CREATED', ownedBrowserClosed: true, productIntegrated: false });
  }
}
writeJson(`${target}/diagnosis.json`, result);
console.log(JSON.stringify({ status: result.status, originalNegative: result.originalNegative.observations, reproducedNegative: result.reproducedNegative, browser: result.browser, ownedBrowserClosed: true }));
