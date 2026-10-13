import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {admitActualInputs, selectSolver, requireSolver} from '../build/esm-r03/spike/modern-r01/src/registry.js';
import {createOwnedLabStore6128} from '../build/esm-r03/spike/revisions/lab6128-source-contract-r02/candidate/ownedLabStore6128.js';
import {createSyntheticAuthoredCodecFixtures} from '../build/esm-r03/spike/revisions/lab6128-r4-contract-r01/inputs/a0-6128/apps/weltraum-browser/tests/fixtures/phy01LabCodecFixtures.js';
import {decodeHvpLabGame} from '../build/esm-r03/spike/revisions/lab6128-r4-contract-r01/inputs/a0-6128/apps/weltraum-browser/src/hestia-prototype/persistence/gameCheckpoint.js';
import {InMemoryPublicationStore, PUBLICATION_CRASH_PHASES} from '../build/esm-r03/spike/src/publication.js';

const refs = JSON.parse(await readFile(new URL('../evidence/REGISTRY_READER_INPUTS.json', import.meta.url), 'utf8'));
const allowed = new Map(refs.rows.map(row => [row.relativePath, row.origin]));
let reads = 0;
const reader = async path => {
  assert(allowed.has(path), 'Exact frozen byte-reader member required');
  reads++;
  return new Uint8Array(await readFile(allowed.get(path)));
};
const cases = [];
const check = async (name, fn) => {
  try { await fn(); cases.push({name, verdict: 'PASS'}); }
  catch (error) { cases.push({name, verdict: 'FAIL', error: String(error.stack ?? error)}); }
};
const fixtures = createSyntheticAuthoredCodecFixtures();
let proof;
await check('A01 genuine existing registry byte issuance; no native initialization', async () => {
  proof = await admitActualInputs(reader);
  assert.equal(proof.profile.id, 'rapier-0.21.0-phy01.migration2:legacy-impulse-v1');
  assert.equal(proof.profile.dynamicGyroscopicForces, false);
  assert.equal(proof.source.wasmSha256, 'ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9');
  assert.throws(() => requireSolver(proof));
  assert.equal(proof.partialEvidence.raw.PASS, 146);
  assert.equal(proof.partialEvidence.raw.FAIL, 46);
});
if (proof) {
  await check('A02 explicit registered profile choice and object-instance negatives', () => {
    assert.throws(() => selectSolver(proof, 'rapier-0.21.0'));
    assert.throws(() => selectSolver({...proof}, proof.profile.id));
    selectSolver(proof, proof.profile.id); requireSolver(proof);
    assert.throws(() => requireSolver({...proof}));
  });
  const db = 'phy03-migration-capsule-modern-r01-r10', slot = 'phy03-modern-r01-r10';
  await check('A03 shared database and slot names rejected before repository construction', () => {
    assert.throws(() => createOwnedLabStore6128(proof, 'weltraum-hestia-prototype-v1', slot));
    assert.throws(() => createOwnedLabStore6128(proof, db, 'hvp-primary'));
    assert.throws(() => createOwnedLabStore6128({...proof}, db, slot));
  });
  const store = createOwnedLabStore6128(proof, db, slot); await store.initialize();
  try {
    await check('A04 issued candidate owned-memory Save/JSON Cold/load/resave', async () => {
      await store.save(fixtures.lab, null);
      const accounting = [], cold = await store.loadCold(bytes => accounting.push(bytes));
      assert.equal(cold.game.checkpoint.signature, fixtures.lab.signature);
      assert.equal(cold.game.checkpoint.world.solver, proof.profile.id);
      assert(accounting.length === 1 && accounting[0] > 0);
      const loaded = await store.load(); await store.save(loaded.game.checkpoint, loaded.metadata.recordRevision);
      assert.equal((await store.load()).metadata.recordRevision, 2);
    });
    await check('A05 stale CAS/foreign-slot rollback retains complete owned export', async () => {
      const before = JSON.stringify(await store.export());
      await assert.rejects(store.save(fixtures.lab, 1), {code: 'RevisionConflict'});
      await assert.rejects(store.import(await store.export(), {kind: 'CreateNewSlot', targetSlotId: 'hvp-primary'}));
      assert.equal(JSON.stringify(await store.export()), before);
    });
  } finally { await store.close(); }
  await check('A06 closed owned-memory repository rejects load', () => assert.rejects(store.load()));
} else {
  for (const name of ['A02', 'A03', 'A04', 'A05', 'A06']) cases.push({name, verdict: 'NOT_RUN', reason: 'Genuine registry issuance failed; no forged substitute'});
}

const encode = value => new TextEncoder().encode(JSON.stringify(value));
const oldBytes = encode(fixtures.legacy), newBytes = encode(fixtures.lab);
for (const phase of PUBLICATION_CRASH_PHASES) await check('C-' + phase + ': actual mature memory publication rollback/pointer cut', async () => {
  const store = new InMemoryPublicationStore(), old = await store.seedLegacy('phy03-r10-legacy', oldBytes);
  await assert.rejects(store.publish({slotId: 'phy03-r10-new', bytes: newBytes, expectedPointer: old,
    validate: bytes => decodeHvpLabGame(JSON.parse(new TextDecoder().decode(bytes))), crashAt: phase}), {code: 'SIMULATED_CRASH'});
  assert.deepEqual((await store.readSlot('phy03-r10-legacy')).bytes, oldBytes);
  const pointer = await store.getPointer();
  assert.equal(pointer.slotId, phase === 'afterPointer' ? 'phy03-r10-new' : 'phy03-r10-legacy');
  assert.equal(pointer.revision, phase === 'afterPointer' ? 1 : 0);
  const candidate = await store.readSlot('phy03-r10-new');
  if (phase === 'beforeWrite') assert.equal(candidate, undefined);
  else assert.deepEqual(candidate.bytes, newBytes);
});
await check('C-CAS: stale pointer rejects and original bytes retained', async () => {
  const store = new InMemoryPublicationStore(), old = await store.seedLegacy('phy03-r10-legacy', oldBytes);
  const validate = bytes => decodeHvpLabGame(JSON.parse(new TextDecoder().decode(bytes)));
  await store.publish({slotId: 'phy03-r10-new', bytes: newBytes, expectedPointer: old, validate});
  await assert.rejects(store.publish({slotId: 'phy03-r10-other', bytes: newBytes, expectedPointer: old, validate}), {code: 'STALE_POINTER'});
  assert.deepEqual((await store.readSlot('phy03-r10-legacy')).bytes, oldBytes);
});
const failed = cases.filter(x => x.verdict === 'FAIL').length;
console.log(JSON.stringify({population: 'R10_FROZEN_BYTE_REGISTRY_OWNED_MEMORY_PUBLICATION', nodeVersion: process.versions.node,
  cases, pass: cases.filter(x => x.verdict === 'PASS').length, fail: failed,
  notRun: cases.filter(x => x.verdict === 'NOT_RUN').length, opaqueInputReads: reads,
  registeredProfile: proof?.profile.id ?? null,
  inheritedMatrix: proof ? {PASS: proof.partialEvidence.raw.PASS, FAIL: proof.partialEvidence.raw.FAIL, rerun: false} : null,
  cold: 'ACCOUNTED_JSON_DECODE_ADMISSION_NOT_MEASURED_PEAK_NOT_NATIVE_COLD',
  nativeBrowserDbPublicSavePhysicalHeap: 'NOT_RUN'}, null, 2));
if (failed) process.exitCode = 1;
