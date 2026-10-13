import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const spikeRoot = path.dirname(fileURLToPath(import.meta.url));
const worktreeRoot = path.resolve(spikeRoot, '..', '..');
const mainRoot = path.resolve(worktreeRoot, '..', '..');
const packageRoot = path.join(mainRoot, 'artifacts', 'hestia-cloud-orchestration-2026-10-09',
  'Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09');
const rtWorktree = path.join(mainRoot, '.worktrees', 'Hestia-Spike-RT-01-2026-10-09');
const gfxWorktree = path.join(mainRoot, '.worktrees', 'Hestia-Spike-GFX-03-2026-10-09');

const pins = {
  rtReceipt: { byteLength: 7225, sha256: '7ec2c677895d7a4d356814c94787824d61fad827dde99cff1d0f2e8c87d297c4' },
  rtBinding: { byteLength: 39776, sha256: 'c1d7e4684eda0002b5ebe7d8187583ce4fc6fc33d8de637108abd73a1e21026c' },
  rtFixtures: { byteLength: 7440, sha256: 'bc6e9be728c932b0fe6f88ea2d6024f61b2b53bc59d47aae0e941c499a34dbea' },
  gfxReceipt: { byteLength: 16521, sha256: '19cb90aa136ff917f35318fce26d76ca359ed802782ceae5f5508780cfb9f01e' },
  gfxBinding: { byteLength: 950615, sha256: 'b00e1d955341aad056dc4ea6cbbe147949c96af600f5bbd304313d82b0ff9386' },
};

const rtFiles = [
  ['spikes/rt-01-oracle/src/types.mts', 'imports/rt/src/types.mts'],
  ['spikes/rt-01-oracle/src/validate.mts', 'imports/rt/src/validate.mts'],
  ['spikes/rt-01-oracle/src/dda.mts', 'imports/rt/src/dda.mts'],
  ['spikes/rt-01-oracle/src/bruteForce.mts', 'imports/rt/src/bruteForce.mts'],
  ['spikes/rt-01-oracle/load.mjs', 'imports/rt/load.mjs'],
  ['spikes/rt-01-oracle/fixtures.mjs', 'imports/rt/fixtures.mjs'],
  ['spikes/rt-01-oracle/export.mjs', 'imports/rt/export.mjs'],
  ['spikes/rt-01-oracle/import-rd.mjs', 'imports/rt/import-rd.mjs'],
  ['spikes/rt-01-oracle/README.md', 'imports/rt/README.md'],
  ['spikes/rt-01-oracle/imported/F00-CONTROL/historical/tests/RD-13/native.spec.ts',
    'imports/rt/history/F00-CONTROL/tests/RD-13/native.spec.ts'],
  ['spikes/rt-01-oracle/imported/F00-CONTROL/historical/reports/planner-followup-ebb913d/RAY_FOLLOWUP.md',
    'imports/rt/history/F00-CONTROL/reports/planner-followup-ebb913d/RAY_FOLLOWUP.md'],
  ['spikes/rt-01-oracle/imported/F00-CONTROL/historical/docs/coordination/input-package/03_LAB_VERTRAEGE_UND_FIXTURES.md',
    'imports/rt/history/F00-CONTROL/docs/coordination/input-package/03_LAB_VERTRAEGE_UND_FIXTURES.md'],
];
const gfxFiles = [
  ['spikes/gfx-03-backend-bakeoff/src/port.ts', 'imports/gfx/src/port.ts'],
  ['spikes/gfx-03-backend-bakeoff/src/materials.ts', 'imports/gfx/src/materials.ts'],
];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function safePath(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.startsWith('/')
    || relative.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Unsafe relative path: ${relative}`);
  }
  const result = path.resolve(root, ...relative.split('/'));
  if (!result.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`Path escaped root: ${relative}`);
  return result;
}

function verifyBytes(bytes, expected, label) {
  const actualHash = sha256(bytes);
  if (bytes.length !== expected.byteLength || actualHash !== expected.sha256) {
    throw new Error(`${label} pin mismatch: ${bytes.length}/${actualHash}`);
  }
  return { byteLength: bytes.length, sha256: actualHash };
}

async function readPinnedJson(sourcePath, pin, label) {
  const bytes = await readFile(sourcePath);
  const digest = verifyBytes(bytes, pin, label);
  return { bytes, digest, value: JSON.parse(bytes.toString('utf8')) };
}

function bindingRow(manifest, relative) {
  const matches = manifest.files.filter(entry => entry.path === relative);
  if (matches.length !== 1) throw new Error(`Expected one producer binding for ${relative}, found ${matches.length}`);
  return matches[0];
}

async function readBound(sourceRoot, manifest, sourceRelative, destinationRelative, producer) {
  const sourcePath = safePath(sourceRoot, sourceRelative);
  const row = bindingRow(manifest, sourceRelative);
  const bytes = await readFile(sourcePath);
  const digest = verifyBytes(bytes, row, `${producer}:${sourceRelative}`);
  return { producer, originalPath: sourceRelative, sourcePath, destinationPath: destinationRelative, bytes,
    sourceBytes: digest, destinationBytes: digest };
}

async function readFixture(sourceRoot, entry) {
  const sourcePath = safePath(sourceRoot, entry.path);
  const bytes = await readFile(sourcePath);
  const digest = verifyBytes(bytes, entry, `RT-01 fixture:${entry.path}`);
  return { producer: 'RT-01', originalPath: `spikes/_shared/rt-2026-10-09/v1/${entry.path}`,
    sourcePath, destinationPath: `fixtures/${entry.path}`, bytes, sourceBytes: digest, destinationBytes: digest };
}

async function readDocument(root, relative, sections) {
  const sourcePath = safePath(root, relative);
  const bytes = await readFile(sourcePath);
  return { originalPath: path.relative(mainRoot, sourcePath).split(path.sep).join('/'), sourcePath,
    sections, sourceBytes: { byteLength: bytes.length, sha256: sha256(bytes) }, destinationPath: null,
    destinationBytes: null };
}

async function assertNoSymlink(relative, allowMissing) {
  const parts = relative.split('/');
  let current = spikeRoot;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error(`Refusing symlink destination: ${relative}`);
      if (index < parts.length - 1 && !info.isDirectory()) throw new Error(`Not a directory: ${current}`);
      if (index === parts.length - 1 && !info.isFile()) throw new Error(`Not a file: ${current}`);
    } catch (error) {
      if (error.code !== 'ENOENT' || !allowMissing) throw error;
      return;
    }
  }
}

async function preflightDestination(item) {
  await assertNoSymlink(item.destinationPath, true);
  try {
    const current = await readFile(safePath(spikeRoot, item.destinationPath));
    if (!current.equals(item.bytes)) throw new Error(`Existing destination drift: ${item.destinationPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function writeImmutable(item) {
  const destination = safePath(spikeRoot, item.destinationPath);
  await assertNoSymlink(item.destinationPath, true);
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await writeFile(destination, item.bytes, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    await assertNoSymlink(item.destinationPath, false);
    const current = await readFile(destination);
    if (!current.equals(item.bytes)) throw new Error(`Existing destination drift: ${item.destinationPath}`);
  }
}

export async function importInputs() {
  const rtReceiptPath = path.join(rtWorktree, 'spikes', 'rt-01-oracle', 'receipt.json');
  const rtBindingPath = path.join(rtWorktree, 'spikes', 'rt-01-oracle', 'binding-manifest.json');
  const gfxReceiptPath = path.join(gfxWorktree, 'spikes', 'gfx-03-backend-bakeoff', 'receipt.json');
  const gfxBindingPath = path.join(gfxWorktree, 'spikes', 'gfx-03-backend-bakeoff', 'binding-manifest.json');
  const [rtReceipt, rtBinding, gfxReceipt, gfxBinding] = await Promise.all([
    readPinnedJson(rtReceiptPath, pins.rtReceipt, 'RT-01 receipt'),
    readPinnedJson(rtBindingPath, pins.rtBinding, 'RT-01 binding manifest'),
    readPinnedJson(gfxReceiptPath, pins.gfxReceipt, 'GFX-03 receipt'),
    readPinnedJson(gfxBindingPath, pins.gfxBinding, 'GFX-03 binding manifest'),
  ]);
  const fixtureRoot = path.join(rtWorktree, 'spikes', '_shared', 'rt-2026-10-09', 'v1');
  const fixtureManifestPath = path.join(fixtureRoot, 'manifest.json');
  const fixtureManifest = await readPinnedJson(fixtureManifestPath, pins.rtFixtures, 'RT-01 fixture manifest');
  const fixtureValue = fixtureManifest.value;
  if (fixtureValue.schema !== 'hestia.rt-fixtures.v1' || fixtureValue.frozen !== true
    || fixtureValue.rayCount !== 1000 || fixtureValue.uniqueNumericRayCount !== 1000
    || fixtureValue.files.length !== 49 || new Set(fixtureValue.files.map(entry => entry.path)).size !== 49) {
    throw new Error('RT-01 fixture manifest contract mismatch');
  }

  const imports = [
    ...await Promise.all(rtFiles.map(([source, destination]) =>
      readBound(rtWorktree, rtBinding.value, source, destination, 'RT-01'))),
    ...await Promise.all(gfxFiles.map(([source, destination]) =>
      readBound(gfxWorktree, gfxBinding.value, source, destination, 'GFX-03'))),
    ...await Promise.all(fixtureValue.files.map(entry => readFixture(fixtureRoot, entry))),
    { producer: 'RT-01', originalPath: 'spikes/rt-01-oracle/receipt.json', sourcePath: rtReceiptPath,
      destinationPath: 'imports/rt/producer-receipt.json', bytes: rtReceipt.bytes,
      sourceBytes: rtReceipt.digest, destinationBytes: rtReceipt.digest },
    { producer: 'RT-01', originalPath: 'spikes/rt-01-oracle/binding-manifest.json', sourcePath: rtBindingPath,
      destinationPath: 'imports/rt/producer-binding-manifest.json', bytes: rtBinding.bytes,
      sourceBytes: rtBinding.digest, destinationBytes: rtBinding.digest },
    { producer: 'GFX-03', originalPath: 'spikes/gfx-03-backend-bakeoff/receipt.json', sourcePath: gfxReceiptPath,
      destinationPath: 'imports/gfx/producer-receipt.json', bytes: gfxReceipt.bytes,
      sourceBytes: gfxReceipt.digest, destinationBytes: gfxReceipt.digest },
    { producer: 'GFX-03', originalPath: 'spikes/gfx-03-backend-bakeoff/binding-manifest.json', sourcePath: gfxBindingPath,
      destinationPath: 'imports/gfx/producer-binding-manifest.json', bytes: gfxBinding.bytes,
      sourceBytes: gfxBinding.digest, destinationBytes: gfxBinding.digest },
    { producer: 'RT-01', originalPath: 'spikes/_shared/rt-2026-10-09/v1/manifest.json', sourcePath: fixtureManifestPath,
      destinationPath: 'fixtures/manifest.json', bytes: fixtureManifest.bytes,
      sourceBytes: fixtureManifest.digest, destinationBytes: fixtureManifest.digest },
  ];
  if (new Set(imports.map(item => item.destinationPath)).size !== imports.length) throw new Error('Duplicate import destination');

  const docSpecs = [
    [mainRoot, 'AGENTS.md', null],
    [worktreeRoot, 'AGENTS.md', null],
    [packageRoot, '00_START_HIER.md', null],
    [packageRoot, '01_PRUEFUNG_UND_ENTSCHEIDUNG.md', null],
    [packageRoot, '03_SCHNITTSTELLEN_UND_UEBERNAHME.md', null],
    [packageRoot, 'Cloud/00_GEMEINSAMER_VERTRAG.md', null],
    [packageRoot, 'Auftraege/RT-02A.md', null],
    [packageRoot, 'Goals/RT-02A.txt', null],
    [packageRoot, 'SOURCE_DOCS.json', null],
    [path.dirname(packageRoot), 'USER_OVERRIDES_2026-10-09.md', null],
    [path.dirname(packageRoot), 'STATE.json', null],
    [path.join(packageRoot, 'Quellen'), 'threejs-raytracing-intel-amd-nvidia-2026-10-09.md', ['8', '14', '16']],
    [path.join(packageRoot, 'Quellen'), 'hestia-konzeptpaket-review-und-arbeitspaket-registry-2026-10-09.md', ['RT-02A']],
  ];
  const documents = await Promise.all(docSpecs.map(([root, relative, sections]) => readDocument(root, relative, sections)));
  // STATE is a moving administration observation; preserve its first receipt, not a scientific input pin.
  try {
    const prior = JSON.parse(await readFile(safePath(spikeRoot, 'input-provenance.json'), 'utf8'));
    const index = documents.findIndex(doc => doc.sourcePath.endsWith(`${path.sep}STATE.json`));
    const observed = prior.documents.find(doc => doc.sourcePath === documents[index]?.sourcePath);
    if (!observed) throw new Error('Initial STATE observation missing');
    documents[index] = observed;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const producerRecords = [
    { task: 'RT-01', receipt: { sourcePath: rtReceiptPath, ...rtReceipt.digest },
      bindingManifest: { sourcePath: rtBindingPath, ...rtBinding.digest } },
    { task: 'GFX-03', receipt: { sourcePath: gfxReceiptPath, ...gfxReceipt.digest },
      bindingManifest: { sourcePath: gfxBindingPath, ...gfxBinding.digest } },
  ];
  const provenance = {
    schema: 'hestia.rt02a-input-provenance.v1',
    executionLocation: 'LOCAL_WINDOWS_ISOLATED',
    producers: producerRecords,
    imports: imports.map(({ bytes, ...record }) => record),
    fixtures: { producer: 'RT-01', manifestPath: fixtureManifestPath,
      manifest: fixtureManifest.digest, rayCount: fixtureValue.rayCount,
      uniqueNumericRayCount: fixtureValue.uniqueNumericRayCount, provenance: fixtureValue.provenance,
      members: imports.filter(item => item.destinationPath.startsWith('fixtures/')
        && item.destinationPath !== 'fixtures/manifest.json')
        .map(({ producer, originalPath, sourcePath, destinationPath, sourceBytes, destinationBytes }) =>
          ({ producer, originalPath, sourcePath, destinationPath, sourceBytes, destinationBytes })) },
    documents,
  };
  const provenanceBytes = Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`, 'utf8');
  imports.push({ producer: 'RT-02A importer', originalPath: null, sourcePath: null,
    destinationPath: 'input-provenance.json', bytes: provenanceBytes,
    sourceBytes: { byteLength: provenanceBytes.length, sha256: sha256(provenanceBytes) },
    destinationBytes: { byteLength: provenanceBytes.length, sha256: sha256(provenanceBytes) } });

  for (const item of imports) await preflightDestination(item);
  for (const item of imports) await writeImmutable(item);
  return { importedFiles: imports.length - 1, fixtureMembers: fixtureValue.files.length,
    provenanceSha256: sha256(provenanceBytes) };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  importInputs().then(result => console.log(JSON.stringify({ status: 'IMPORTED', ...result })))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
