import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('./', import.meta.url)), '..', '..');
const producerRoot = process.argv[2] && path.resolve(process.argv[2]);
if (!producerRoot) throw new Error('Usage: node import-rt.mjs <RT-01 worktree>');

const pin = {
  receipt: '7ec2c677895d7a4d356814c94787824d61fad827dde99cff1d0f2e8c87d297c4',
  binding: 'c1d7e4684eda0002b5ebe7d8187583ce4fc6fc33d8de637108abd73a1e21026c',
  fixtures: 'bc6e9be728c932b0fe6f88ea2d6024f61b2b53bc59d47aae0e941c499a34dbea',
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const safeRelative = value => {
  assert.equal(typeof value, 'string');
  assert.ok(value.length > 0 && !value.includes('\\') && !path.posix.isAbsolute(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..'), `Unsafe relative path: ${value}`);
  return value;
};
const toPath = (root, relative) => path.join(root, ...safeRelative(relative).split('/'));
const controlPaths = {
  receipt: 'spikes/rt-01-oracle/receipt.json',
  binding: 'spikes/rt-01-oracle/binding-manifest.json',
  fixtures: 'spikes/_shared/rt-2026-10-09/v1/manifest.json',
};
const readPinned = async (name, relative) => {
  const bytes = await readFile(toPath(producerRoot, relative));
  assert.equal(hash(bytes), pin[name], `Pinned RT-01 ${name} digest`);
  return bytes;
};

// Verify all producer controls immediately before parsing or copying any bound input.
const [receiptBytes, bindingBytes, fixtureManifestBytes] = await Promise.all(Object.entries(controlPaths)
  .map(([name, relative]) => readPinned(name, relative)));
const receipt = JSON.parse(receiptBytes);
const binding = JSON.parse(bindingBytes);
const fixtureManifest = JSON.parse(fixtureManifestBytes);
assert.equal(receipt.taskId, 'RT-01');
assert.equal(receipt.source.baseCommit, '17b1db4201a28e7b607c30707bdc2b75e3484a10');
assert.equal(receipt.source.bindingManifestSha256, pin.binding);
assert.equal(receipt.source.fixtureManifestSha256, pin.fixtures);
assert.equal(binding.baseCommit, receipt.source.baseCommit);
assert.equal(fixtureManifest.schema, 'hestia.rt-fixtures.v1');
assert.equal(fixtureManifest.frozen, true);
assert.equal(fixtureManifest.version, 'rt-2026-10-09/v1');
assert.equal(fixtureManifest.rayCount, 1000);
assert.equal(fixtureManifest.uniqueNumericRayCount, 1000);
assert.equal(fixtureManifest.files.length, 49);

const copied = [];
const outputs = [];
const addCopy = (sourcePath, targetPath, sourceBytes, targetBytes = sourceBytes, modificationReason = null) => {
  safeRelative(sourcePath);
  safeRelative(targetPath);
  const record = {
    sourcePath,
    targetPath,
    sourceByteLength: sourceBytes.length,
    sourceSha256: hash(sourceBytes),
    targetByteLength: targetBytes.length,
    targetSha256: hash(targetBytes),
    modified: modificationReason !== null,
    modificationReason,
  };
  copied.push(record);
  outputs.push({ targetPath, bytes: targetBytes });
};

const sharedPrefix = 'spikes/_shared/rt-2026-10-09/v1';
addCopy(`${sharedPrefix}/manifest.json`, 'fixtures/manifest.json', fixtureManifestBytes);
for (const entry of fixtureManifest.files) {
  const relative = safeRelative(entry.path);
  const sourcePath = `${sharedPrefix}/${relative}`;
  const bytes = await readFile(toPath(producerRoot, sourcePath));
  assert.equal(bytes.length, entry.byteLength, `Frozen fixture size: ${relative}`);
  assert.equal(hash(bytes), entry.sha256, `Frozen fixture digest: ${relative}`);
  addCopy(sourcePath, `fixtures/${relative}`, bytes);
}

const bindingFiles = new Map(binding.files.map(file => [file.path, file]));
async function readBoundSource(sourcePath) {
  const row = bindingFiles.get(sourcePath);
  assert.ok(row, `RT-01 binding entry: ${sourcePath}`);
  const bytes = await readFile(toPath(producerRoot, sourcePath));
  assert.equal(bytes.length, row.byteLength, `RT-01 source size: ${sourcePath}`);
  assert.equal(hash(bytes), row.sha256, `RT-01 source digest: ${sourcePath}`);
  return bytes;
}

for (const name of ['dda.mts', 'bruteForce.mts', 'types.mts', 'validate.mts']) {
  const sourcePath = `spikes/rt-01-oracle/src/${name}`;
  addCopy(sourcePath, `src/${name}`, await readBoundSource(sourcePath));
}
const helperPath = 'spikes/rt-01-oracle/fixtures.mjs';
addCopy(helperPath, 'fixtures.mjs', await readBoundSource(helperPath));

const loaderPath = 'spikes/rt-01-oracle/load.mjs';
const loaderBytes = await readBoundSource(loaderPath);
const loaderSource = loaderBytes.toString('utf8');
const oldRoot = "import { frozenRoot } from './export.mjs';";
assert.equal(loaderSource.split(oldRoot).length - 1, 1, 'Expected RT-01 loader root import');
const localRoot = "import { fileURLToPath } from 'node:url';\nconst frozenRoot = fileURLToPath(new URL('./fixtures/', import.meta.url));";
addCopy(loaderPath, 'load.mjs', loaderBytes,
  Buffer.from(loaderSource.replace(oldRoot, localRoot)),
  'Resolve the trusted frozen-fixture root inside this immutable import; retain RT-01 digest, source, material, current-binding and validation checks unchanged.');

const importManifest = {
  schema: 'hestia.gfx03.rt01-import.v1',
  producer: {
    taskId: 'RT-01',
    baseCommit: binding.baseCommit,
    receipt: { sourcePath: controlPaths.receipt, byteLength: receiptBytes.length, sha256: hash(receiptBytes) },
    bindingManifest: { sourcePath: controlPaths.binding, byteLength: bindingBytes.length, sha256: hash(bindingBytes) },
    sharedFixtureManifest: { sourcePath: controlPaths.fixtures, byteLength: fixtureManifestBytes.length, sha256: hash(fixtureManifestBytes) },
  },
  fixtures: { version: fixtureManifest.version, payloadCount: fixtureManifest.files.length },
  copiedFiles: copied,
};
const importManifestBytes = Buffer.from(`${JSON.stringify(importManifest, null, 2)}\n`);
const destination = path.join(repoRoot, 'spikes', 'gfx-03-backend-bakeoff', 'imported', 'rt01');

async function inventory(directory, prefix = '') {
  const names = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), `Imported tree contains symlink: ${prefix}${entry.name}`);
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) names.push(...await inventory(path.join(directory, entry.name), `${relative}/`));
    else names.push(relative);
  }
  return names;
}

async function verifyExisting() {
  const bytes = await readFile(path.join(destination, 'import-manifest.json'));
  assert.deepEqual(bytes, importManifestBytes, 'Existing RT-01 import manifest changed');
  for (const entry of copied) {
    const bytes = await readFile(toPath(destination, entry.targetPath));
    assert.equal(bytes.length, entry.targetByteLength, `Imported size: ${entry.targetPath}`);
    assert.equal(hash(bytes), entry.targetSha256, `Imported digest: ${entry.targetPath}`);
  }
  const expected = [...copied.map(entry => entry.targetPath), 'import-manifest.json'].sort();
  assert.deepEqual((await inventory(destination)).sort(), expected, 'Imported RT-01 file inventory changed');
}

async function ensureExactFile(relative, bytes) {
  const target = toPath(destination, relative);
  await mkdir(path.dirname(target), { recursive: true });
  try {
    const existing = await readFile(target);
    assert.deepEqual(existing, bytes, `Existing RT-01 import changed: ${relative}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(target, bytes, { flag: 'wx' });
  }
}

let destinationExists = false;
try { await stat(destination); destinationExists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(destination, { recursive: true });
for (const file of outputs) await ensureExactFile(file.targetPath, file.bytes);
await ensureExactFile('import-manifest.json', importManifestBytes);
await verifyExisting();
console.log(JSON.stringify({ status: 'PASS', alreadyPresent: destinationExists, payloads: fixtureManifest.files.length, files: copied.length }));
