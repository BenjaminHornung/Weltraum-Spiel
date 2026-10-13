import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { traceDda } from '../imported/rt01/src/dda.mts';
import { traceBruteForce } from '../imported/rt01/src/bruteForce.mts';
import { loadFrozenVolume } from '../imported/rt01/load.mjs';

const pin = 'bc6e9be728c932b0fe6f88ea2d6024f61b2b53bc59d47aae0e941c499a34dbea';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const importedRoot = path.join(packageRoot, 'imported', 'rt01');
const fixtureRoot = path.join(importedRoot, 'fixtures');
const importManifest = JSON.parse(await readFile(path.join(importedRoot, 'import-manifest.json'), 'utf8'));
const sharedManifestBytes = await readFile(path.join(fixtureRoot, 'manifest.json'));
const sharedManifestDigest = hash(sharedManifestBytes);
const rays = JSON.parse(await readFile(path.join(fixtureRoot, 'rays', 'golden-1000.json'), 'utf8'));

function compare(actual, expected, label) {
  const { distance: actualDistance, normal: actualNormal, ...actualFields } = actual;
  const { distance: expectedDistance, normal: expectedNormal, ...expectedFields } = expected;
  assert.deepEqual(actualFields, expectedFields, label);
  assert.ok(Math.abs(actualDistance - expectedDistance) <= 1e-9, `${label}: ${actualDistance} != ${expectedDistance}`);
  actualNormal.forEach((value, axis) => assert.ok(Math.abs(value - expectedNormal[axis]) <= 1e-9,
    `${label}: normal ${axis} ${value} != ${expectedNormal[axis]}`));
}

test('RT-01 import bytes and all 49 frozen payloads match the recorded source and target digests', async () => {
  assert.equal(importManifest.schema, 'hestia.gfx03.rt01-import.v1');
  assert.equal(importManifest.producer.bindingManifest.sha256, 'c1d7e4684eda0002b5ebe7d8187583ce4fc6fc33d8de637108abd73a1e21026c');
  assert.equal(importManifest.producer.sharedFixtureManifest.sha256, pin);
  assert.equal(importManifest.fixtures.payloadCount, 49);
  assert.equal(sharedManifestDigest, pin);
  assert.equal(importManifest.copiedFiles.length, 56);
  assert.equal(importManifest.copiedFiles.filter(file => file.targetPath.startsWith('fixtures/')).length, 50);
  for (const file of importManifest.copiedFiles) {
    const bytes = await readFile(path.join(importedRoot, ...file.targetPath.split('/')));
    assert.equal(bytes.length, file.targetByteLength, file.targetPath);
    assert.equal(hash(bytes), file.targetSha256, file.targetPath);
  }
  assert.deepEqual(importManifest.copiedFiles.filter(file => file.modified).map(file => file.targetPath), ['load.mjs']);
  assert.match(importManifest.copiedFiles.find(file => file.targetPath === 'load.mjs').modificationReason, /validation checks unchanged/);
});

test('1000 frozen RT-01 rays match both original expected results and independent brute force', async () => {
  assert.equal(rays.length, 1000);
  assert.equal(new Set(rays.map(({ ray }) => JSON.stringify([ray.origin, ray.direction, ray.maxDistance, ray.maxSteps]))).size, 1000);
  assert.deepEqual([...new Set(rays.map(({ expected }) => expected.kind))].sort(), ['BudgetExceeded', 'Hit', 'Miss', 'Unknown']);
  const volumes = new Map();
  const getVolume = entry => {
    if (!volumes.has(entry.volumeId)) {
      volumes.set(entry.volumeId, loadFrozenVolume(entry.volumeId, pin, entry.sourceBinding));
    }
    return volumes.get(entry.volumeId);
  };
  for (const entry of rays) {
    const volume = await getVolume(entry);
    const dda = traceDda(volume, entry.ray);
    const brute = traceBruteForce(volume, entry.ray);
    compare(dda, entry.expected, `${entry.ray.id} DDA/original`);
    compare(brute, entry.expected, `${entry.ray.id} brute/original`);
    compare(dda, brute, `${entry.ray.id} DDA/brute`);
  }
  const frozen = await getVolume(rays[0]);
  assert.ok(Object.isFrozen(frozen) && Object.isFrozen(frozen.cells) && Object.isFrozen(frozen.binding));
});

test('trusted shared-manifest tampering and stale current bindings fail closed', async () => {
  const first = rays[0];
  await mkdir(path.join(packageRoot,'negative-copies'),{recursive:true});
  const temp = await mkdtemp(path.join(packageRoot,'negative-copies','rt01-'));
    const changedManifest = JSON.parse(sharedManifestBytes.toString('utf8'));
    changedManifest.frozen = false;
    await writeFile(path.join(temp, 'manifest.json'), JSON.stringify(changedManifest));
    await assert.rejects(loadFrozenVolume(first.volumeId, pin, first.sourceBinding, temp), /Trusted manifest digest/);
  const stale = structuredClone(first.sourceBinding);
  stale.transformGeneration++;
  await assert.rejects(loadFrozenVolume(first.volumeId, pin, stale), /Stale/);
});
