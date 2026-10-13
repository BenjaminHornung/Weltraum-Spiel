import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateVolume } from './src/validate.mts';
import { bindSource } from './fixtures.mjs';

const spikeRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(spikeRoot, '../..');
const sourceRoot = path.resolve(repoRoot, '..', 'Hestia-RD-resume-2026-10-05');
const outputRoot = path.join(spikeRoot, 'imported', 'F00-CONTROL');
const gitPath = 'C:\\IFI_SourceCode\\Utils\\opencode-migration\\runtime\\git\\cmd\\git.exe';
const sourceCommit = '04902cef0b3b7129a6069bf945f39f22e414b6f9';
const fixtureRoot = 'experiments/hestia-rd-2026-10-02';
const fixtureDir = `${fixtureRoot}/fixtures/F00-CONTROL`;
const pins = {
  'manifest.json': '378513d00d5f2a11f569ff0748d4e42ac1832674104febd052070f0fd258b81d',
  'recipe.json': '6a4e4b7d2fde3944b1efb434453d1651697a005fb43af02d92b688ccecdaa5c8',
  'scenario.json': '24de3e02b3c7d2cf38f0f1dbf0b5f82a5107bc2507118726b5c081b3d05bf878',
};
const historicalSources = [
  ['experiments/hestia-rd-2026-10-02/tests/RD-13/native.spec.ts', 'historical/tests/RD-13/native.spec.ts'],
  ['experiments/hestia-rd-2026-10-02/reports/planner-followup-ebb913d/RAY_FOLLOWUP.md', 'historical/reports/planner-followup-ebb913d/RAY_FOLLOWUP.md'],
  ['experiments/hestia-rd-2026-10-02/docs/coordination/input-package/03_LAB_VERTRAEGE_UND_FIXTURES.md', 'historical/docs/coordination/input-package/03_LAB_VERTRAEGE_UND_FIXTURES.md'],
];
const slotIds = ['dry', 'wet', 'wood', 'leaf', 'accent', 'emission'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const samePath = (a, b) => path.relative(a, b) === '';
const isWithin = (root, value) => {
  const relative = path.relative(root, value);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
};

function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0')
    || path.posix.isAbsolute(value) || /^[a-z]:/i.test(value)) throw new Error('Unsafe relative path');
  const segments = value.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) throw new Error('Unsafe relative path');
  return segments;
}

function git(args, binary = false) {
  return execFileSync(gitPath, ['-C', sourceRoot, ...args], { encoding: binary ? 'buffer' : 'utf8', maxBuffer: 8 * 1024 * 1024 });
}

async function checkedPath(root, relative, createDirectories = false) {
  const parts = safeRelative(relative);
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Unsafe destination directory');
    } catch (error) {
      if (error.code !== 'ENOENT' || !createDirectories) throw error;
      await mkdir(current);
    }
  }
  const resolved = path.resolve(root, ...parts);
  if (!isWithin(root, resolved) || samePath(root, resolved)) throw new Error('Destination escaped its root');
  return resolved;
}

async function ensureOutputRoot() {
  const spikeInfo = await lstat(spikeRoot);
  if (spikeInfo.isSymbolicLink() || !spikeInfo.isDirectory()) throw new Error('Invalid spike root');
  let current = spikeRoot;
  for (const part of ['imported', 'F00-CONTROL']) {
    current = path.join(current, part);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Unsafe import output directory');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await mkdir(current);
    }
  }
  if (!isWithin(spikeRoot, path.resolve(outputRoot))) throw new Error('Import output escaped the spike root');
}

function parseLfsPointer(bytes) {
  const text = bytes.toString('utf8');
  const match = text.match(/^version https:\/\/git-lfs\.github\.com\/spec\/v1\r?\noid sha256:([a-f0-9]{64})\r?\nsize (\d+)\r?\n?$/);
  return match ? { sha256: match[1], byteLength: Number(match[2]) } : null;
}

async function sourceBlob(gitPathValue, destination) {
  const relative = safeRelative(gitPathValue).join('/');
  const blobSha = git(['rev-parse', `${sourceCommit}:${relative}`]).toString().trim();
  if (!/^[a-f0-9]{40,64}$/.test(blobSha)) throw new Error(`Invalid Git blob for ${relative}`);
  const blobBytes = git(['cat-file', 'blob', blobSha], true);
  const lfsPointer = parseLfsPointer(blobBytes);
  let bytes = blobBytes;
  if (lfsPointer) {
    const sourcePath = await checkedPath(sourceRoot, relative);
    const info = await lstat(sourcePath);
    if (info.isSymbolicLink() || !info.isFile()) throw new Error(`LFS source is not a regular file: ${relative}`);
    bytes = await readFile(sourcePath);
    if (bytes.length !== lfsPointer.byteLength || sha256(bytes) !== lfsPointer.sha256) {
      throw new Error(`LFS content does not match its Git pointer: ${relative}`);
    }
  }
  return {
    sourcePath: relative,
    destination,
    gitBlobSha: blobSha,
    ...(lfsPointer ? { lfsPointer } : {}),
    sha256: sha256(bytes),
    byteLength: bytes.length,
    bytes,
  };
}

async function writeExact(file) {
  const destination = await checkedPath(outputRoot, file.destination, true);
  let info;
  try {
    info = await lstat(destination);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (info) {
    if (info.isSymbolicLink() || !info.isFile()) throw new Error(`Existing destination is not a regular file: ${file.destination}`);
    const existing = await readFile(destination);
    if (existing.length !== file.byteLength || sha256(existing) !== file.sha256) {
      throw new Error(`Refusing to overwrite different imported bytes: ${file.destination}`);
    }
  } else {
    const handle = await open(destination, 'wx');
    try {
      await handle.writeFile(file.bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  const copied = await readFile(destination);
  if (copied.length !== file.byteLength || sha256(copied) !== file.sha256) throw new Error(`Imported bytes failed verification: ${file.destination}`);
  return { sourcePath: file.sourcePath, destination: file.destination, gitBlobSha: file.gitBlobSha,
    ...(file.lfsPointer ? { lfsPointer: file.lfsPointer } : {}), sha256: file.sha256, byteLength: file.byteLength };
}

async function readBoundImport() {
  for (const directory of [spikeRoot, path.dirname(outputRoot), outputRoot]) {
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Invalid imported fixture directory');
  }
  if (!isWithin(spikeRoot, path.resolve(outputRoot))) throw new Error('Imported fixture escaped the spike root');
  const importManifestPath = await checkedPath(outputRoot, 'import-manifest.json');
  const importInfo = await lstat(importManifestPath);
  if (importInfo.isSymbolicLink() || !importInfo.isFile()) throw new Error('Invalid import manifest file');
  const imported = JSON.parse(await readFile(importManifestPath, 'utf8'));
  if (imported.schema !== 'rt01-rd-import-v1' || imported.source?.commit !== sourceCommit
    || imported.productIntegration !== 'NO' || !Array.isArray(imported.files)) throw new Error('Invalid or unbound import manifest');
  const files = new Map();
  for (const record of imported.files) {
    const destination = safeRelative(record.destination).join('/');
    if (files.has(destination) || !/^[a-f0-9]{64}$/.test(record.sha256)
      || !Number.isSafeInteger(record.byteLength) || record.byteLength < 0) throw new Error('Invalid import file binding');
    const filePath = await checkedPath(outputRoot, destination);
    const info = await lstat(filePath);
    if (info.isSymbolicLink() || !info.isFile()) throw new Error(`Invalid imported file: ${destination}`);
    const bytes = await readFile(filePath);
    if (bytes.length !== record.byteLength || sha256(bytes) !== record.sha256) throw new Error(`Imported digest mismatch: ${destination}`);
    files.set(destination, bytes);
  }
  for (const name of Object.keys(pins)) {
    const bytes = files.get(name);
    if (!bytes || sha256(bytes) !== pins[name]) throw new Error(`Pinned source digest mismatch: ${name}`);
  }
  const manifest = JSON.parse(files.get('manifest.json'));
  const recipe = JSON.parse(files.get('recipe.json'));
  const scenario = JSON.parse(files.get('scenario.json'));
  if (manifest.id !== 'F00-CONTROL' || manifest.sourceRevision !== 0
    || recipe.fixtureDigest !== pins['manifest.json'] || scenario.fixtureDigest !== pins['manifest.json']) {
    throw new Error('Imported fixture sources disagree');
  }
  for (const payload of manifest.payloads) {
    const destination = safeRelative(payload.path).join('/');
    const bytes = files.get(destination);
    if (!bytes || bytes.length !== payload.byteLength || sha256(bytes) !== payload.sha256) {
      throw new Error(`Fixture payload digest mismatch: ${destination}`);
    }
  }
  return { imported, files, manifest, recipe, scenario };
}

export async function loadRdManifest() {
  return (await readBoundImport()).manifest;
}

export async function loadRdCameras() {
  return (await readBoundImport()).manifest.cameras;
}

export async function loadRdVolume() {
  const { files, manifest, recipe } = await readBoundImport();
  const region = manifest.voxelRegions.find(candidate => candidate.id === 'control-cells');
  const recipeRegion = recipe.regions.find(candidate => candidate.id === 'control-cells');
  if (!region || region.ownerId !== 'control' || region.dimensions.join(',') !== '32,24,24'
    || !recipeRegion || recipeRegion.coveragePolicy !== 'explicit-known-source-box; outside-unknown'
    || recipeRegion.addressing !== 'X-fast: x+sx*(y+sy*z)' || manifest.quantumMeters !== 0.125) {
    throw new Error('Unexpected F00-Control voxel definition');
  }
  const payload = id => {
    const reference = manifest.payloads.find(item => item.id === id);
    const bytes = reference && files.get(safeRelative(reference.path).join('/'));
    if (!bytes) throw new Error(`Missing fixture payload: ${id}`);
    return bytes;
  };
  const coverageBytes = payload(region.knownCoveragePayload);
  const occupancyBytes = payload(region.occupancyPayload);
  const slotBytes = payload(recipeRegion.materialSlotsPayload);
  const count = region.dimensions.reduce((product, dimension) => product * dimension, 1);
  if ([coverageBytes, occupancyBytes, slotBytes].some(bytes => bytes.length !== count)) throw new Error('Invalid F00 cell payload size');
  const cells = Array.from({ length: count }, (_, index) => {
    const coverage = coverageBytes[index];
    const occupied = occupancyBytes[index];
    const slot = slotBytes[index];
    if (![0, 1].includes(coverage) || ![0, 1].includes(occupied) || slot > slotIds.length) throw new Error(`Invalid F00 cell encoding at ${index}`);
    if (!coverage) return -1;
    if (!occupied) return 0;
    if (slot < 1) throw new Error(`Occupied F00 cell has no material slot at ${index}`);
    return slot;
  });
  const coverage = coverageBytes.every(value => value === 1) ? 'complete' : 'partial';
  const manifestSha = pins['manifest.json'];
  const materialBySourceId = new Map(manifest.materials.map(material => [material.id, material]));
  const materials = slotIds.map((sourceId, index) => {
    const sourceMaterial = materialBySourceId.get(sourceId);
    if (!sourceMaterial?.role) throw new Error(`Missing original F00 material: ${sourceId}`);
    return { id: index + 1, role: sourceMaterial.role, source: manifestSha };
  });
  const cellIds = Array.from({ length: count }, (_, index) => `rd02/control/${index}`);
  const rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const translation = [0, 0, 0];
  const sourcePayload = {
    fixtureId: manifest.id, owner: 'control', frame: 'control', size: region.dimensions,
    cellMeters: manifest.quantumMeters, origin: region.originMeters, rotation, translation,
    coverage, exteriorCoverage: 'Unknown', cells, cellIds,
  };
  const materialProfile = materials.map(({ id, role }) => ({ id, role }));
  const volume = {
    id: manifest.id, provenance: 'RD_SYNTHETIC',
    binding: {
      domain: 'rd-synthetic', world: manifest.id, session: 'rt01-lab', epoch: 'control-0', owner: 'control',
      sourceRevision: 0, sourceGeneration: 0, sourceDigest: sha256(Buffer.from(JSON.stringify(sourcePayload))),
      frame: 'control', originEpoch: 0, transformGeneration: 0,
      materialDigest: sha256(Buffer.from(JSON.stringify(materialProfile))), algorithm: 'rd02-f00-import-v1',
    },
    size: region.dimensions, cellMeters: manifest.quantumMeters, origin: region.originMeters,
    rotation, translation, authorityLeafEdge: 16, rayPageEdge: 8, coverage, exteriorCoverage: 'Unknown',
    cells, cellIds, materials,
  };
  return bindSource(volume);
}

export async function importRd() {
  const sourceInfo = await lstat(sourceRoot);
  if (sourceInfo.isSymbolicLink() || !sourceInfo.isDirectory()) throw new Error('Invalid RD source root');
  git(['cat-file', '-e', `${sourceCommit}^{commit}`]);
  const sourceWorktreeHead = git(['rev-parse', 'HEAD']).toString().trim();
  const files = [];
  for (const [name, digest] of Object.entries(pins)) {
    const file = await sourceBlob(`${fixtureDir}/${name}`, name);
    if (file.sha256 !== digest) throw new Error(`Pinned source digest mismatch: ${name}`);
    files.push(file);
  }
  const manifestFile = files.find(file => file.destination === 'manifest.json');
  const manifest = JSON.parse(manifestFile.bytes);
  if (manifest.id !== 'F00-CONTROL' || !Array.isArray(manifest.payloads)) throw new Error('Unexpected F00 manifest');
  const destinations = new Set(files.map(file => file.destination));
  for (const payload of manifest.payloads) {
    const relative = safeRelative(payload.path).join('/');
    if (!Number.isSafeInteger(payload.byteLength) || payload.byteLength < 0 || !/^[a-f0-9]{64}$/.test(payload.sha256)
      || destinations.has(relative)) throw new Error('Invalid or duplicate F00 payload record');
    const file = await sourceBlob(`${fixtureDir}/${relative}`, relative);
    if (file.byteLength !== payload.byteLength || file.sha256 !== payload.sha256) throw new Error(`Payload does not match manifest: ${relative}`);
    destinations.add(relative);
    files.push(file);
  }
  for (const [sourcePath, destination] of historicalSources) files.push(await sourceBlob(sourcePath, destination));
  for (const file of files) {
    if (file.byteLength > 8 * 1024 * 1024) throw new Error(`Source exceeds importer limit: ${file.sourcePath}`);
  }
  const sourceFiles = files.map(({ bytes, ...record }) => record);
  const sourceRecord = {
    repository: 'Weltraum-Spiel', commit: sourceCommit, sourceWorktreeHead,
    fixturePath: fixtureDir, fixtureId: manifest.id, fixtureManifestSha256: pins['manifest.json'],
    recipeSha256: pins['recipe.json'], scenarioSha256: pins['scenario.json'],
  };
  await ensureOutputRoot();
  const copiedFiles = [];
  for (const file of files) copiedFiles.push(await writeExact(file));
  const importManifest = {
    schema: 'rt01-rd-import-v1', executionLocation: 'LOCAL_WINDOWS_ISOLATED',
    source: sourceRecord, files: copiedFiles, sourceCopyUnchanged: true, productIntegration: 'NO',
  };
  const importManifestBytes = Buffer.from(`${JSON.stringify(importManifest, null, 2)}\n`);
  await writeExact({ sourcePath: `${sourceCommit}:generated-import-manifest`, destination: 'import-manifest.json',
    bytes: importManifestBytes, sha256: sha256(importManifestBytes), byteLength: importManifestBytes.length });
  return { files: copiedFiles.length, payloads: manifest.payloads.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await importRd();
    const volume = await loadRdVolume();
    const cameras = await loadRdCameras();
    console.log(`RD_IMPORT_OK files=${result.files} payloads=${result.payloads} cells=${volume.cells.length} occupied=${volume.cells.filter(cell => cell > 0).length} coverage=${volume.coverage} cameras=${cameras.length} sourceDigest=${volume.binding.sourceDigest} materialDigest=${volume.binding.materialDigest} productIntegration=NO`);
  } catch (error) {
    console.error(`RD_IMPORT_FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
