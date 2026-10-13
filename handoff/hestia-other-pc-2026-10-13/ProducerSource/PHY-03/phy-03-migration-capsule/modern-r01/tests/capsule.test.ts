import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {beforeAll,describe,it,expect} from "vitest";
import {admitActualInputs,selectSolver,type VerifiedSolver} from "../src/registry";
import {migratePrivate,decodePrivate,encodePrivate,readPrivateSave} from "../src/envelope";
import {publishPrivate,requirePrivateDatabase} from "../src/privateSave";
import {InMemoryPublicationStore,PUBLICATION_CRASH_PHASES} from "../../src/publication";
import {canonicalJson,sha256,type LegacyKind} from "../../src/capsule";
import {decodeHvpWorld} from "../../snapshot/src/hestia-prototype/persistence/worldCheckpoint";

const reader=async(path:string)=>new Uint8Array(await readFile(resolve(path)));
let solver:VerifiedSolver,world:Uint8Array;
const db="phy03-migration-capsule-modern-r01-functional-memory";
beforeAll(async()=>{
  const admitted=await admitActualInputs(reader);
  world=await reader("../fixtures/legacy-world.json");
  await expect(migratePrivate(world,"world",admitted)).rejects.toThrow(/Explicit/);
  solver=selectSolver(admitted,"rapier-0.21.0-phy01.migration2:legacy-impulse-v1");
},30000);
const json=(v:unknown)=>new TextEncoder().encode(canonicalJson(v));
const resign=async(value:any)=>{const {digest:_,...payload}=value;return json({...payload,digest:await sha256(json(payload))});};

describe("actual candidate admission without native init",()=>{
  it("derives owner profile/signature from the bound payload",()=>{
    expect(selectSolver(solver,solver.profile.id)).toBe(solver);
    expect(solver.profile.dynamicGyroscopicForces).toBe(false);
    expect(solver.source.vanillaNpmBytes).toBe(false);
    expect(solver.source.wasmSha256).toBe("ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9");
    expect(solver.reference.digest).toMatch(/^[a-f0-9]{64}$/);expect(Object.isFrozen(solver)).toBe(true);
  });
  for(const id of ["rapier-0.12.0","rapier-0.21.0","unknown","rapier-0.21.0-phy01.migration2:gyroscopic-v1"]){
    it("rejects explicit unregistered choice "+id,()=>{expect(()=>selectSolver(solver,id)).toThrow(/Unregistered/);});
  }
  it("rejects a handwritten proof with a copied ID/signature",()=>{expect(()=>selectSolver({...solver} as VerifiedSolver,solver.profile.id)).toThrow(/Unregistered/);});
  it("keeps archived collider results partial, with exact positive and negative links",()=>{
    expect(solver.partialEvidence.raw).toEqual({PASS:146,FAIL:46});
    expect(solver.partialEvidence.selectedProfileRaw).toEqual({PASS:73,FAIL:23});
    expect(solver.partialEvidence.representationChoice).toBe("NONE");
    expect(solver.partialEvidence.currentSemanticIndex).toBe("R03_INDEX_XY_CLOSED");
    expect(solver.partialEvidence.indexClosure.sourceRowsChecked).toBe(12530);
    expect(solver.partialEvidence.sourcePort.adoption).toBe("ACCEPT_BOUNDED_FROZEN_SOURCE_PORT_INPUT");
    expect(solver.partialEvidence.sourcePort.reviewedOwner.privateExpectedSolverContract).toBe("AWAIT_ACTUAL_FROZEN_A0_PRODUCT_CONTRACT");
    expect(solver.partialEvidence.examples.some(c=>c.name.includes("codec")&&c.status==="PASS")).toBe(true);
    expect(solver.partialEvidence.examples.some(c=>c.kind==="voxels"&&c.status==="FAIL")).toBe(true);
    expect(solver.partialEvidence.sourcePort.files).toBe(5015);
  });
  for(const suffix of ["profile.json","rapier_wasm3d_bg.wasm","dist/rapier.js"]){
    it("rejects altered actual bytes "+suffix,async()=>{
      const path="inputs/a0/snapshot/spike/upstream/candidate-package/migration2/"+suffix;
      await expect(admitActualInputs(async p=>{const b=await reader(p);if(p===path)b[0]^=1;return b;})).rejects.toThrow(/bytes mismatch/);
    },30000);
  }
});

describe("private envelope preserves old public bytes",()=>{
  for(const kind of ["body","world","game"] as LegacyKind[]){
    it("roundtrips actual legacy "+kind+" with source/mass/inertia frames",async()=>{
      const bytes=await reader(kind==="body"?"../snapshot/tests/fixtures/hvp-contact-r90-body384.json":"../fixtures/legacy-"+kind+".json");
      const envelope=await migratePrivate(bytes,kind,solver),decoded=await decodePrivate(encodePrivate(envelope),solver);
      expect(decoded.legacy).toEqual(bytes);
      expect(encodePrivate(decoded.envelope)).toEqual(encodePrivate(envelope));
      expect(envelope.bodyFrames.length).toBeGreaterThan(0);
      for(const frame of envelope.bodyFrames){
        expect(frame.mass.totalMassKg).toBeGreaterThan(0);expect(frame.mass.centerOfMassMeters).not.toBeNull();
        expect(frame.principalInertia.x).toBeGreaterThan(0);expect(Math.hypot(...Object.values(frame.inertiaFrame))).toBeCloseTo(1,12);
      }
      expect(envelope.legacyEnvelope.legacy.utf8).toBe(new TextDecoder("utf-8",{ignoreBOM:true}).decode(bytes));
      expect(envelope.legacyEnvelope.solverProfile.id).toContain("0.12");
    });
  }
  it("dual-reads raw legacy and explicitly private envelope",async()=>{
    const raw=await readPrivateSave(world,"world",solver),newRead=await readPrivateSave(encodePrivate(raw.envelope),"world",solver);
    expect(newRead.legacy).toEqual(world);
    expect(JSON.parse(new TextDecoder().decode(newRead.legacy)).solver).toBe("rapier-0.12.0");
  });
  it("does not make the public world decoder accept the private discriminator",async()=>{
    const envelope=await migratePrivate(world,"world",solver);
    expect(()=>decodeHvpWorld(JSON.parse(new TextDecoder().decode(encodePrivate(envelope))))).toThrow();
    expect(()=>decodeHvpWorld(JSON.parse(new TextDecoder().decode(world)))).not.toThrow();
  });
  it("retains BOM input bytes",async()=>{
    const bytes=new Uint8Array([239,187,191,...world]),e=await migratePrivate(bytes,"world",solver);
    expect((await decodePrivate(encodePrivate(e),solver)).legacy).toEqual(bytes);
  });
  for(const axis of ["version","solver","source","collider","inertia","unknown-field"]){
    it("rejects resigned incompatible "+axis+" axis",async()=>{
      const value:any=structuredClone(await migratePrivate(world,"world",solver));
      if(axis==="version")value.version="unknown";
      if(axis==="solver")value.solverProfile.id="rapier-0.12.0";
      if(axis==="source")value.sourceStatus="SourceV2";
      if(axis==="collider")value.colliderStatus="NATIVE_VOXELS_ACCEPTED";
      if(axis==="inertia")value.bodyFrames[0].principalInertia.x+=1;
      if(axis==="unknown-field")value.publicSave=true;
      await expect(decodePrivate(await resign(value),solver)).rejects.toThrow();
    });
  }
  it("rejects truncation and damaged digest",async()=>{
    const bytes=encodePrivate(await migratePrivate(world,"world",solver));
    await expect(decodePrivate(bytes.slice(0,-3),solver)).rejects.toThrow();
    const value:any=JSON.parse(new TextDecoder().decode(bytes));value.digest="0".repeat(64);
    await expect(decodePrivate(json(value),solver)).rejects.toThrow(/digest/);
  });
});

describe("injected task-owned publication simulation",()=>{
  for(const name of ["weltraum-hestia-prototype-v1","hvp-primary","phy03-migration-capsule-other"]){
    it("rejects shared/unowned DB "+name,()=>{expect(()=>requirePrivateDatabase(name)).toThrow(/Task-owned/);});
  }
  it("publishes immutable .21 private slot and rolls back without relabeling .12",async()=>{
    const store=new InMemoryPublicationStore(),old=await store.seedLegacy("phy03-modern-r01-legacy",world);
    const envelope=await migratePrivate(world,"world",solver);
    const current=await publishPrivate(store,db,"phy03-modern-r01-modern",old,envelope,solver);
    expect(current.revision).toBe(1);expect((await store.readSlot(old.slotId))!.bytes).toEqual(world);
    const rollback=await store.compareAndSwapPointer(current,old.slotId,old.digest);expect(rollback.revision).toBe(2);
    expect((await store.readSlot(rollback.slotId))!.bytes).toEqual(world);
    await expect(publishPrivate(store,db,"hvp-primary",rollback,envelope,solver)).rejects.toThrow(/Task-owned/);
  });
  it("rejects a stale pointer after rollback advances its revision",async()=>{
    const store=new InMemoryPublicationStore(),old=await store.seedLegacy("phy03-modern-r01-legacy",world),e=await migratePrivate(world,"world",solver);
    const current=await publishPrivate(store,db,"phy03-modern-r01-modern",old,e,solver);
    await store.compareAndSwapPointer(current,old.slotId,old.digest);
    await expect(publishPrivate(store,db,"phy03-modern-r01-stale",old,e,solver)).rejects.toMatchObject({code:"STALE_POINTER"});
  });
  it("rejects reuse of an immutable candidate slot",async()=>{
    const store=new InMemoryPublicationStore(),old=await store.seedLegacy("phy03-modern-r01-legacy",world),e=await migratePrivate(world,"world",solver);
    const current=await publishPrivate(store,db,"phy03-modern-r01-modern",old,e,solver);
    await expect(publishPrivate(store,db,"phy03-modern-r01-modern",current,e,solver)).rejects.toMatchObject({code:"SLOT_ID_REUSED"});
  });
  it("rejects a different injected DB before writing any slot",async()=>{
    const store=Object.assign(new InMemoryPublicationStore(),{databaseName:"phy03-migration-capsule-modern-r01-other"});
    const old=await store.seedLegacy("phy03-modern-r01-legacy",world),e=await migratePrivate(world,"world",solver);
    await expect(publishPrivate(store,db,"phy03-modern-r01-mismatch",old,e,solver)).rejects.toThrow(/does not match/);
    expect(await store.readSlot("phy03-modern-r01-mismatch")).toBeUndefined();expect(await store.getPointer()).toEqual(old);
  });
  for(const phase of PUBLICATION_CRASH_PHASES){
    it("retains correct pointer and all legacy bytes after crash "+phase,async()=>{
      const store=new InMemoryPublicationStore(),old=await store.seedLegacy("phy03-modern-r01-legacy",world),e=await migratePrivate(world,"world",solver);
      await expect(publishPrivate(store,db,"phy03-modern-r01-candidate",old,e,solver,phase)).rejects.toMatchObject({code:"SIMULATED_CRASH"});
      expect((await store.getPointer())!.slotId).toBe(phase==="afterPointer"?"phy03-modern-r01-candidate":old.slotId);
      expect((await store.readSlot(old.slotId))!.bytes).toEqual(world);
    });
  }
});
