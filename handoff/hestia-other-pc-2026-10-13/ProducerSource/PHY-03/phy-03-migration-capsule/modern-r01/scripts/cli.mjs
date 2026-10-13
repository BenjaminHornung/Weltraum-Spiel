import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {admitActualInputs,selectSolver,migratePrivate,encodePrivate,decodePrivate,InMemoryPublicationStore,publishPrivate,createOwnedA0LabStore,createActualOwnerAuthoredFixtures} from '../dist/capsule.js';
const modern=resolve(import.meta.dirname,'..');
const read=async p=>new Uint8Array(await readFile(resolve(modern,p)));
const proof=await admitActualInputs(read);
const action=process.argv[2]??'register',chosen=process.argv[3];
if(action==='register')console.log(JSON.stringify({status:'PASS',scope:'ACTUAL_BYTES_ADMISSION_ONLY',...proof}));
else{
  const solver=selectSolver(proof,chosen);
  if(action==='lab'){
    const {lab}=createActualOwnerAuthoredFixtures(),store=createOwnedA0LabStore(solver,'phy03-migration-capsule-modern-r01-cli-lab-memory','phy03-modern-r01-cli-owner-lab');
    await store.initialize();try{
      const saved=await store.save(lab,null),loaded=await store.load(),admissions=[];
      const cold=await store.loadCold(b=>admissions.push(b));
      console.log(JSON.stringify({status:'PASS',scope:'ACTUAL_A0_AUTHORED_MEMORY_CODEC_NOT_NATIVE_COLD',slot:saved.metadata.slotId,
        revision:loaded.metadata.recordRevision,profile:loaded.game.checkpoint.profiles.solver,admissions,recipeRetainedBytes:cold.recipeRetainedBytes}));
    }finally{await store.close();}
    process.exit(0);
  }
  const bytes=await read('../fixtures/legacy-world.json');
  const e=await migratePrivate(bytes,'world',solver);
  if(action==='export'){
    const out=resolve(modern,'.runtime/world-private-envelope-r01.json');
    if(relative(modern,out).startsWith('..'))throw new Error('Own output required');
    await mkdir(resolve(modern,'.runtime'),{recursive:true});await writeFile(out,encodePrivate(e),{flag:'wx'});
    await decodePrivate(new Uint8Array(await readFile(out)),solver);
    console.log(JSON.stringify({status:'PASS',scope:'PRIVATE_JSON_NOT_NATIVE_COLD',output:out,digest:e.digest}));
  }else if(action==='transaction'){
    const store=new InMemoryPublicationStore(),old=await store.seedLegacy('phy03-modern-r01-cli-legacy',bytes);
    const current=await publishPrivate(store,'phy03-migration-capsule-modern-r01-cli-memory','phy03-modern-r01-cli-modern',old,e,solver);
    const rollback=await store.compareAndSwapPointer(current,old.slotId,old.digest);
    console.log(JSON.stringify({status:'PASS',scope:'PRIVATE_IN_MEMORY_CAS_NOT_INDEXEDDB',old,current,rollback}));
  }else throw new Error('Unknown command');
}
