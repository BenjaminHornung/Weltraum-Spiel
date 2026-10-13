import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {admitCurrentInputs,admitActualInputs,selectSolver,requireSolver} from '../build/esm-r01/spike/modern-r01/src/registry.js';
import {createOwnedCurrentLabStore} from '../build/esm-r01/current-ownedStore.js';
import {createSyntheticAuthoredCodecFixtures} from '../build/esm-r01/current-app/tests/fixtures/phy01LabCodecFixtures.js';
import {decodeHvpLabGame} from '../build/esm-r01/current-app/src/hestia-prototype/persistence/gameCheckpoint.js';
import {migratePrivate,decodePrivate,encodePrivate,readPrivateSave} from '../build/esm-r01/spike/modern-r01/src/envelope.js';
import {publishPrivate} from '../build/esm-r01/spike/modern-r01/src/privateSave.js';
import {InMemoryPublicationStore,PUBLICATION_CRASH_PHASES} from '../build/esm-r01/spike/src/publication.js';
import {canonicalJson,sha256} from '../build/esm-r01/spike/src/profileBinding.js';

// Prepared against actual Source; NOT_RUN until genuine emission and a new bounded effect review.
const historical=JSON.parse(await readFile(new URL('../evidence/HISTORICAL_READER_INPUTS.json',import.meta.url),'utf8'));
const current=JSON.parse(await readFile(new URL('../input/current-binding.json',import.meta.url),'utf8'));
const allowed=new Map(historical.rows.map(row=>[row.relativePath,row.origin]));
for(const row of current.rows)allowed.set(row.path,new URL('../'+row.path,import.meta.url));
let reads=0;
const reader=async path=>{assert(allowed.has(path),'Frozen member required');reads++;return new Uint8Array(await readFile(allowed.get(path)));};
const cases=[];
const check=async(name,body)=>{try{await body();cases.push({name,verdict:'PASS'});}catch(error){cases.push({name,verdict:'FAIL',error:String(error.stack??error)});}};
const encode=value=>new TextEncoder().encode(canonicalJson(value));
const rehash=async value=>{const {digest,...payload}=value;return {...payload,digest:await sha256(encode(payload))};};
let proof,oldProof;
await check('U01 current196/F26 genuine byte admission without solver initialization',async()=>{
  proof=await admitCurrentInputs(reader);
  assert.equal(proof.source.wasmSha256,'f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb');
  assert.equal(proof.package.version,'0.21.0-phy01.migration2-margin-r05');
  assert.equal(proof.profile.dynamicGyroscopicForces,false);assert.throws(()=>requireSolver(proof));
  assert.equal(proof.partialEvidence.raw.PASS,146);assert.equal(proof.partialEvidence.raw.FAIL,46);
});
await check('U02 historical admission remains historical and cannot construct current store',async()=>{
  oldProof=await admitActualInputs(reader);selectSolver(oldProof,oldProof.profile.id);
  assert.equal(oldProof.source.wasmSha256,'ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9');
  assert.notEqual(oldProof.reference.digest,proof.reference.digest);
  assert.throws(()=>createOwnedCurrentLabStore(oldProof,'phy03-migration-capsule-modern-r01-old','phy03-modern-r01-old'));
});
await check('U03 corrupted exact input member is rejected before proof issuance',()=>assert.rejects(
  admitCurrentInputs(async path=>path===current.rows[0].path?new Uint8Array([0]):reader(path)),/bytes mismatch/));
if(proof){
  await check('U04 object-instance/profile/private target gates precede memory construction',()=>{
    assert.throws(()=>selectSolver({...proof},proof.profile.id));assert.throws(()=>selectSolver(proof,'rapier-0.21.0'));
    selectSolver(proof,proof.profile.id);requireSolver(proof);
    assert.throws(()=>createOwnedCurrentLabStore({...proof},'phy03-migration-capsule-modern-r01-r11','phy03-modern-r01-r11'));
    assert.throws(()=>createOwnedCurrentLabStore(proof,'weltraum-hestia-prototype-v1','phy03-modern-r01-r11'));
    assert.throws(()=>createOwnedCurrentLabStore(proof,'phy03-migration-capsule-modern-r01-r11','hvp-primary'));
  });
  const authored=createSyntheticAuthoredCodecFixtures();
  const slot='phy03-modern-r01-r11',db='phy03-migration-capsule-modern-r01-r11';
  const store=createOwnedCurrentLabStore(proof,db,slot);await store.initialize();
  try{
    await check('U05 current Source memory Save/accounted Cold/load/resave',async()=>{
      await store.save(authored.lab,null);const accounting=[];const cold=await store.loadCold(n=>accounting.push(n));
      assert.equal(cold.game.checkpoint.signature,authored.lab.signature);assert.equal(cold.game.checkpoint.world.solver,proof.profile.id);
      assert.equal(accounting.length,1);assert(accounting[0]>0);
      const loaded=await store.load();await store.save(loaded.game.checkpoint,loaded.metadata.recordRevision);
      assert.equal((await store.load()).metadata.recordRevision,2);
    });
    await check('U06 legacy/public cross-admission and stale CAS leave complete export unchanged',async()=>{
      const before=canonicalJson(await store.export());
      await assert.rejects(store.save(authored.legacy,2));await assert.rejects(store.save(authored.lab,1),{code:'RevisionConflict'});
      await assert.rejects(store.import(await store.export(),{kind:'CreateNewSlot',targetSlotId:'hvp-primary'}));
      assert.equal(canonicalJson(await store.export()),before);
    });
    await check('U07 mature transport import to second owned memory slot and stale replace CAS',async()=>{
      const target='phy03-modern-r01-r11-import';const second=createOwnedCurrentLabStore(proof,db,target);await second.initialize();
      try{await second.import(await store.export(),{kind:'CreateNewSlot',targetSlotId:target});
        assert.equal((await second.load()).game.checkpoint.signature,authored.lab.signature);
        const before=canonicalJson(await second.export());
        await assert.rejects(second.import(await second.export(),{kind:'ReplaceExpectedRevision',expectedRevision:0}),{code:'InvalidEnvelope'});
        await assert.rejects(second.import(await second.export(),{kind:'ReplaceExpectedRevision',expectedRevision:2}),{code:'ImportConflict'});
        assert.equal(canonicalJson(await second.export()),before);
      }finally{await second.close();}
    });
  }finally{await store.close();}
  await check('U08 closed memory repository rejects load',()=>assert.rejects(store.load()));
  for(const [kind,file] of [['body','body384.json'],['world','legacy-world.json'],['game','legacy-game.json']]){
    const bytes=new Uint8Array(await readFile(new URL('../fixtures/'+file,import.meta.url)));
    await check('L-'+kind+': genuine legacy fixture dual-read/private migration preserves exact bytes/frames',async()=>{
      const before=bytes.slice();const envelope=await migratePrivate(bytes,kind,proof);
      assert.equal(envelope.solverBinding.source.wasmSha256,proof.source.wasmSha256);
      const parsed=await decodePrivate(encodePrivate(envelope),proof);assert.deepEqual(parsed.legacy,before);assert.deepEqual(bytes,before);
      assert.equal(canonicalJson((await readPrivateSave(bytes,kind,proof)).envelope),canonicalJson(envelope));
      assert.equal(canonicalJson((await readPrivateSave(encodePrivate(envelope),kind,proof)).envelope),canonicalJson(envelope));
      assert.equal(canonicalJson((await readPrivateSave(encode(envelope.legacyEnvelope),kind,proof)).envelope),canonicalJson(envelope));
      for(const frame of envelope.bodyFrames){assert(frame.mass.totalMassKg>0);assert(frame.sourceHash);assert(frame.principalInertia);assert(frame.inertiaFrame);}
      await assert.rejects(decodePrivate(encodePrivate(envelope),oldProof));
      const changed=structuredClone(envelope);changed.solverBinding.source.wasmSha256='0'.repeat(64);
      await assert.rejects(decodePrivate(encode(await rehash(changed)),proof));
    });
  }
  const bytes=new Uint8Array(await readFile(new URL('../fixtures/legacy-game.json',import.meta.url)));
  const envelope=await migratePrivate(bytes,'game',proof),candidate=encodePrivate(envelope);
  for(const phase of PUBLICATION_CRASH_PHASES)await check('C-'+phase+': real publication crash cut retains legacy and exact candidate',async()=>{
    const memory=new InMemoryPublicationStore();const pointer=await memory.seedLegacy('phy03-r11-legacy',bytes);
    await assert.rejects(publishPrivate(memory,db,slot,pointer,envelope,proof,phase),{code:'SIMULATED_CRASH'});
    assert.deepEqual((await memory.readSlot('phy03-r11-legacy')).bytes,bytes);
    assert.equal((await memory.getPointer()).slotId,phase==='afterPointer'?slot:'phy03-r11-legacy');
    const written=await memory.readSlot(slot);if(phase==='beforeWrite')assert.equal(written,undefined);else assert.deepEqual(written.bytes,candidate);
  });
  await check('C-CAS: stale pointer cannot publish',async()=>{
    const memory=new InMemoryPublicationStore();const pointer=await memory.seedLegacy('phy03-r11-legacy',bytes);
    await publishPrivate(memory,db,slot,pointer,envelope,proof);
    await assert.rejects(publishPrivate(memory,db,'phy03-modern-r01-r11-other',pointer,envelope,proof),{code:'STALE_POINTER'});
    assert.deepEqual((await memory.readSlot('phy03-r11-legacy')).bytes,bytes);
  });
}else cases.push({name:'DEPENDENT_CURRENT_PROOF_CASES',verdict:'NOT_RUN',reason:'No forged proof or native substitute'});
console.log(JSON.stringify({population:'R11_PREPARED_CHANGED_SOURCE_MEMORY_LEGACY_PUBLICATION',cases,reads,
  pass:cases.filter(c=>c.verdict==='PASS').length,fail:cases.filter(c=>c.verdict==='FAIL').length,
  sourceBindingOnly:true,physicalHeap:'UNSUPPORTED',cold:'ACCOUNTED_JSON_DECODE_ADMISSION_NOT_NATIVE_COLD',nativeBrowserGpuDb:'NOT_RUN'},null,2));
if(cases.some(c=>c.verdict!=='PASS'))process.exitCode=1;
