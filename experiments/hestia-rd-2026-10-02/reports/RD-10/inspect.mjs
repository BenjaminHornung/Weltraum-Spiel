import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';

const lab = fileURLToPath(new URL('../../', import.meta.url)); const repo = path.resolve(lab, '../..');
const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10';
const start = '4788520ef7cecc5db62da8d51f0daaa8ac8bdd09';
const base = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e';
const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const label = process.env.HESTIA_RD10_COMMAND_LABEL;
assert.match(label ?? '', /^[a-z0-9-]+$/); const rawRoot = `${run}/inspection/${label}`;
assertIsolation({ task: 'RD-10', runRoot: rawRoot }); assert(!existsSync(rawRoot)); mkdirSync(rawRoot, { recursive: true });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (relative) => readFileSync(path.join(lab, relative));
const freeze = JSON.parse(readFileSync(`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/freezes/${start}.json`, 'utf8'));
const frozen = freeze.frozenFiles.map(({ path: relative, sha256: expected }) => {
  const actual = sha(read(relative)); assert.equal(actual, expected, relative); return { path: relative, sha256: actual };
});
assert.equal(frozen.length, 18);
function output(name, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`; const file = path.join(lab, 'reports/RD-10', name);
  if (existsSync(file)) { assert.equal(readFileSync(file, 'utf8'), text, `Refuse unchecked evidence regeneration: ${name}`); }
  else { writeFileSync(file, text, { flag: 'wx' }); }
  return { path: `reports/RD-10/${name}`, sha256: sha(Buffer.from(text)) };
}
const sources = [];
async function official(name, url, expressions, local) {
  assert.match(url, /^https:\/\/(registry\.npmjs\.org|raw\.githubusercontent\.com)\//);
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) }); assert.equal(response.status, 200, url);
  const reader = response.body.getReader(); const chunks = []; let length = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) { break; } length += value.length; assert(length <= 524288); chunks.push(value); }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const bytes = Buffer.concat(chunks); const text = bytes.toString('utf8'); const hash = sha(bytes);
  for (const expression of expressions) { assert(expression.test(text), `${name}: ${expression}`); }
  if (local) { assert.equal(sha(read(local)), hash, `Installed Three source differs: ${local}`); }
  writeFileSync(`${rawRoot}/${name}.txt`, bytes, { flag: 'wx' });
  const lines = text.split('\n');
  const record = { name, url, bytes: length, sha256: hash, retainedRaw: `inspection/${label}/${name}.txt`,
    ...(local ? { installedPath: local, installedSha256: hash } : {}),
    excerpts: lines.flatMap((line, index) => expressions.some((expression) => expression.test(line)) ? [{ line: index + 1, text: lines.slice(Math.max(0, index - 1), index + 4).join('\n') }] : []).slice(0, 12) };
  sources.push(record); return text;
}
const threeCommit = '2431a09f46f34c560bc8e44b33be0e567723d5b9';
const babylonCommit = 'cbe5bb36998fdde6bd93d76e67813ff571a535db';
const playcanvasCommit = 'cfef43d306b2b55a2c0742e4994221f6d2463957';
const packages = [];
for (const [name, version, license, commit] of [['three', '0.185.1', 'MIT', threeCommit], ['babylonjs', '9.29.0', 'Apache-2.0', babylonCommit], ['playcanvas', '2.23.0', 'MIT', playcanvasCommit]]) {
  const text = await official(`${name}-registry`, `https://registry.npmjs.org/${name}/${version}`, []);
  const metadata = JSON.parse(text); assert.equal(metadata.version, version); assert.equal(metadata.license, license); assert.equal(metadata.gitHead, commit);
  packages.push({ name, version, license, commit, integrity: metadata.dist.integrity, unpackedBytes: metadata.dist.unpackedSize,
    unpackedBytesKind: 'registry-declared-package-size-NOT-bundle-or-memory', installed: name === 'three' });
}
await official('three-webgpu-renderer', `https://raw.githubusercontent.com/mrdoob/three.js/${threeCommit}/src/renderers/webgpu/WebGPURenderer.js`,
  [/parameters.forceWebGL/, /getFallback/, /HalfFloatType/, /StandardNodeLibrary/], 'node_modules/three/src/renderers/webgpu/WebGPURenderer.js');
await official('three-renderer-init', `https://raw.githubusercontent.com/mrdoob/three.js/${threeCommit}/src/renderers/common/Renderer.js`,
  [/async init\(/, /await backend.init/, /getFallback/], 'node_modules/three/src/renderers/common/Renderer.js');
await official('three-webgpu-backend', `https://raw.githubusercontent.com/mrdoob/three.js/${threeCommit}/src/renderers/webgpu/WebGPUBackend.js`,
  [/await navigator.gpu.requestAdapter/, /await adapter.requestDevice/, /compatibilityMode/, /renderer._samples = 0/], 'node_modules/three/src/renderers/webgpu/WebGPUBackend.js');
await official('three-material-hooks', `https://raw.githubusercontent.com/mrdoob/three.js/${threeCommit}/src/materials/Material.js`,
  [/onBeforeCompile/, /customProgramCacheKey/, /WebGLRenderer/], 'node_modules/three/src/materials/Material.js');
await official('babylon-webgpu-init', `https://raw.githubusercontent.com/BabylonJS/Babylon.js/${babylonCommit}/packages/dev/core/src/Engines/webgpuEngine.pure.ts`,
  [/public initAsync\(/, /gpu!.requestAdapter\(this._options\)/, /await this._adapter.requestDevice/, /glslang is not available/]);
await official('playcanvas-factory', `https://raw.githubusercontent.com/playcanvas/engine/${playcanvasCommit}/src/platform/graphics/graphics-device-create.js`,
  [/deviceTypes.push\(DEVICETYPE_WEBGL2\)/, /initWebGpu/, /glslangUrl/]);
await official('playcanvas-actual-device', `https://raw.githubusercontent.com/playcanvas/engine/${playcanvasCommit}/src/platform/graphics/graphics-device.js`,
  [/get deviceType\(\)/, /return this._deviceType/]);
for (const relative of ['apps/weltraum-browser/src/hestia-prototype/presentation/visualEffects.ts', 'apps/weltraum-browser/src/hestia-prototype/presentation/look.ts', 'apps/weltraum-browser/package-lock.json']) {
  const bytes = execFileSync(git, ['show', `${base}:${relative}`], { cwd: repo, maxBuffer: 8 * 1024 * 1024 });
  const name = path.basename(relative); writeFileSync(`${rawRoot}/b3-${name}`, bytes, { flag: 'wx' });
  assert.equal(sha(readFileSync(path.join(repo, relative))), sha(bytes), `Own checkout product bytes changed: ${relative}`);
  const lines = bytes.toString().split('\n'); sources.push({ name: `b3-${name}`, source: `${base}:${relative}`, bytes: bytes.length, sha256: sha(bytes), retainedRaw: `inspection/${label}/b3-${name}`,
    excerpts: lines.flatMap((line, index) => /onBeforeCompile|customProgramCacheKey|PCFShadowMap|toneMapping|readable-coast-v6|fogNear:|fogFar:/.test(line) ? [{ line: index + 1, text: line }] : []).slice(0, 16) });
}
const inventoryBytes = read('fixtures/inventory.json'); assert.equal(sha(inventoryBytes), freeze.currentFixtureInventorySha256);
const inventory = JSON.parse(inventoryBytes.toString());
const fixtures = [];
for (const group of ['F01-HVP-COAST', 'F04-DETACH', 'F06-MATERIAL']) {
  const manifests = inventory.fixtures.filter((entry) => entry.group === group).map((entry) => {
    const bytes = read(`fixtures/${entry.manifestPath}`); assert.equal(bytes.length, entry.manifestBytes); assert.equal(sha(bytes), entry.manifestSha256);
    const manifest = JSON.parse(bytes.toString()); assert.equal(manifest.id, entry.id);
    const payloads = entry.payloads.map((payload) => { const raw = read(`fixtures/${payload.path}`); assert.equal(raw.length, payload.byteLength); assert.equal(sha(raw), payload.sha256);
      return { id: payload.id, path: payload.path, byteLength: payload.byteLength, sha256: payload.sha256 }; });
    return { id: entry.id, fixtureDigest: entry.fixtureDigest, manifestPath: entry.manifestPath, manifestSha256: entry.manifestSha256,
      manifestBytes: entry.manifestBytes, payloadBytes: entry.payloadBytes, sourceRevision: manifest.sourceRevision,
      sourceRefs: manifest.sourceRefs, cameras: manifest.cameras, materials: manifest.materials, presentation: manifest.presentation ?? null, payloads };
  });
  const scenario = inventory.scenarios.find((entry) => entry.id === `${group}-REPLAY`); assert(scenario);
  const bytes = read(`fixtures/${scenario.path}`); assert.equal(sha(bytes), scenario.sha256);
  const value = JSON.parse(bytes.toString());
  fixtures.push({ group, manifests, scenario: { ...scenario, bytes: bytes.length, initialCameraId: value.initialCameraId,
    initialWeatherPresetId: value.initialWeatherPresetId, weatherPresets: value.weatherPresets, durationTicks: value.durationTicks,
    ticksPerSecond: value.ticksPerSecond, keyframes: value.keyframes } });
}
const profiles = [
  { id: 'C0', engine: 'three', version: '0.185.1', entry: 'three', namedExport: 'WebGLRenderer', backend: 'WebGL2', material: 'MeshLambertMaterial canonical RD03 control',
    availability: 'EXISTING-RD03-HOST-NOT-RD10-OPTIMIZED-EVIDENCE', antialiasRequested: true, effectiveSamples: 'NOT_RUN', outputFormat: 'NOT_RUN',
    fidelityUnsupported: ['product-native-PCF-shadow-pipeline', 'procedural-product-sky', 'GLSL-water/onBeforeCompile-hooks'] },
  { id: 'C1', engine: 'three', version: '0.185.1', entry: 'three/webgpu', namedExport: 'WebGPURenderer', materialEntry: 'three/tsl', forceWebGL: true, backend: 'WebGL2-only-if-inspected',
    material: 'required-node/TSL-material-port', availability: 'NOT_IMPLEMENTED', antialiasRequested: true, requestedSamples: 4,
    outputBufferType: 'HalfFloatType (same requested policy as C2)', effectiveSamples: 'NOT_RUN-compatibility-can-disable-MSAA', outputFormat: 'NOT_RUN' },
  { id: 'C2', engine: 'three', version: '0.185.1', entry: 'three/webgpu', namedExport: 'WebGPURenderer', materialEntry: 'three/tsl', forceWebGL: false, backend: 'WebGPU-only-if-inspected-no-hidden-WebGL-success',
    material: 'same-required-node/TSL-material-port-as-C1', availability: 'NOT_IMPLEMENTED', antialiasRequested: true, requestedSamples: 4,
    outputBufferType: 'HalfFloatType (same requested policy as C1)', effectiveSamples: 'NOT_RUN-compatibility-can-disable-MSAA', outputFormat: 'NOT_RUN' },
];
const sourceOutput = output('source-evidence.json', { phase: 1, start, base, packages, sources,
  sourceSupportIsNotSpeed: true, historicalR03: 'UNRESOLVED-NOT-AVAILABLE; not current RD03 or RR03', productIntegrated: false });
const comparisonOutput = output('comparison-freeze.json', { schema: 'rd10-comparison-freeze-v1', phase: 1, start,
  startTree: '6df6382bfcd596c464828b7938ad9ac5036aca05', immutableProductSource: base, lockSha256: freeze.lockDigest, inventorySha256: sha(inventoryBytes),
  sourceEvidence: sourceOutput, frozenSharedFiles: frozen, fixtures, profiles, babylonProfiles: 'PENDING-HEAD-EXACT-PIN-AND-RD12-no-B-profiles-authorized',
  geometryPolicy: 'Same frozen canonical payloads, stable owners, source revisions, camera/scenario replay and resolution; no reductions or asymmetric quality',
  fixtureLookPolicy: { F01: 'Bound hvp:readable-coast-v6: linear-sRGB inputs, SRGB output, ACES exposure1.05, fog48–170m, source lights/water descriptors',
    F04: 'Actual synthetic RD03 look: NoToneMapping exposure1, no fog; do not copy coast look', F06: 'Actual synthetic RD03 look: NoToneMapping exposure1, no fog; do not copy coast look' },
  comparisons: { C0_to_C1: 'Material/pipeline port AND potentially output-buffer quality axis, NOT pure backend',
    C1_to_C2: 'Cleaner backend comparison ONLY AFTER feature, actual-backend, effective-MSAA/output-format and visual parity proof' },
  barriers: ['C1/C2 await init and inspect renderer.backend; WebGPURenderer default can fall back', 'C1 forceWebGL still needs Node/TSL; WebGL onBeforeCompile cannot be reused',
    'Full PCF/sky/water parity unsupported in C0; do not invent matching features', 'Capability triangle is not C0/C1/C2, no timing or art claim',
    'Headless/software/fallback/unknown identity never target-qualified; no benchmark lease'], productIntegrated: false });
writeFileSync(`${rawRoot}/summary.json`, JSON.stringify({ frozenSharedFiles: frozen.length, fixtures: fixtures.map((fixture) => ({ group: fixture.group, variants: fixture.manifests.length })),
  outputs: [sourceOutput, comparisonOutput], productIntegrated: false }, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ status: 'PASS-SOURCE-AND-BYTE-BINDINGS-ONLY', frozenSharedFiles: frozen.length, sourceRecords: sources.length,
  outputs: [sourceOutput, comparisonOutput], productIntegrated: false }, null, 2));
