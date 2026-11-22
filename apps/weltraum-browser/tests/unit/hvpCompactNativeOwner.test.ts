import {beforeAll,expect,it} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {createHvpWorkerBodyResidency} from "../../src/hestia-prototype/physics/bodyResidency";
import {hvpFragmentArchiveDigest} from "../../src/hestia-prototype/physics/compactFragmentIdentity";
import type {HvpCuttableBody} from "../../src/hestia-prototype/physics/bodyCut";
import {HVP_PLAYER_PROFILE} from "../../src/hestia-prototype/physics/profile";
import {issueHvpCompactNativeOwner} from "../../src/hestia-prototype/physics/compactNativeOwner";
import {captureHvpBodyHit,captureHvpCompactBodyHit,prepareHvpBodyCut,stageHvpBodyCut} from "../../src/hestia-prototype/physics/bodyCut";
import {installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {prepareHvpTerrainFragmentOwnedSteps,prepareHvpTerrainFragment,type HvpTerrainFragmentRequest} from "../../src/hestia-prototype/physics/terrainFragment";
import {decodeHvpBody,encodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import {prepareHvpLocalBodyCut} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {encodeStructuralObject} from "../../src/voxel/structural";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";
import {createTerrainComponentIndex,materializeCompactCells} from "../../src/voxel/structural/componentIndex";
import {cutAt,rootFor,uFixture} from "./componentIndex/compactFixtures";
import type {HvpCell} from "../../src/hestia-prototype/terrain/picking";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {HVP_SOURCE_MIN_METERS,HVP_COAST_MATERIAL_REGISTRY,materializeHvpCoastSource,prepareHvpCoastSource} from "../../src/hvp/hvpCoastSource";
import {compactTerrainOwnerDigest} from "../../src/voxel/structural/componentIndex/fragment";
import {orderedSpans} from "../../src/voxel/structural/componentIndex/exactShapes";

beforeAll(initializeHvpRapier);
const identity={x:0,y:0,z:0,w:1};
const pose={rotation:{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},translationMeters:{x:0,y:-3*.125,z:0}};
const ledger=()=>createStructuralOwnerLedger(0,96*1024*1024,128);
const yieldTask=async()=>{};
function fixture() {
  const root=rootFor(uFixture()),cut=cutAt(root,[12,2,4]),index=createTerrainComponentIndex(cut.before);
  try {
    const result=index.prepareCompact(cut),f=result.fragments[0]!;
    return {request:{ownerId:f.ownerId,origin:HVP_SOURCE_MIN_METERS,compactSource:{generation:f.revision,parts:f.parts,cellCount:f.cellCount},
      cells:[],massKg:f.massKg,colliderBoxes:f.colliderBoxes},binding:{sessionId:cut.after.sessionId,epoch:cut.after.epoch,
      generation:cut.after.revision,terrainDigest:cut.after.sourceDigest}};
  } finally {index.dispose();}
}

it("retains the compact material identity through an actual sleep, park and wake",()=>{
  const {request,binding}=fixture(),budget=ledger(),world=new R.World({x:0,y:0,z:0});
  const owner=issueHvpCompactNativeOwner(request,binding,budget.reserve),id=request.ownerId;
  try {
    const body=installHvpRigidBody(world,owner.recipe,pose),shapes=body.numColliders();
    const target:HvpCuttableBody={ownerId:id,family:"terrain",body,compactOwner:owner,
      get recipe(){return owner.materializeV1Sync(budget.reserve);}};
    const targets=new Map([[id,target]]),bodies=new Map([[id,body]]);
    const residency=createHvpWorkerBodyResidency(world,targets,bodies,()=>true);
    body.sleep();
    expect(owner.archiveReady()).toBe(false);
    expect(residency.park(id,{x:99,y:0,z:99})).toBe(true);
    expect([world.bodies.len(),world.colliders.len(),targets.size,bodies.size]).toEqual([0,0,0,0]);
    expect(residency.sources()[0]).toMatchObject({ownerId:id,sourceDigest:owner.identity.membershipDigest,colliders:shapes});
    expect(()=>owner.readMaterial(12,11,4)).toThrow(/disposed/);
    const saved=decodeHvpBody(residency.checkpoint()[0]!);
    expect(residency.restore(id)).toBe(true);
    expect([world.bodies.len(),world.colliders.len(),targets.size,bodies.size]).toEqual([1,shapes,1,1]);
    const woke=targets.get(id)!;
    expect(woke.recipe.source.contentHash).toBe(saved.recipe.source.contentHash);
    expect(hvpFragmentArchiveDigest(woke.recipe)).toBe(owner.identity.membershipDigest);
    expect(woke.body.isSleeping()).toBe(true);
    residency.dispose();
  }finally{owner.dispose();world.free();budget.release();}
});

it("binds the moving tool's original compact material hit to the genuine archive through a late recut",async()=>{
  const {request,binding}=fixture(),budget=ledger(),world=new R.World({x:0,y:0,z:0});
  const owner=issueHvpCompactNativeOwner(request,binding,budget.reserve),other=issueHvpCompactNativeOwner(request,binding,budget.reserve);
  const body=installHvpRigidBody(world,owner.recipe,pose),targets=new Map([[request.ownerId,{owner,body}]]);
  const eye={x:-1,y:1.25,z:-12.5*.125},direction={x:1,y:0,z:0};
  try{
    expect(()=>captureHvpCompactBodyHit(world,new Map([[request.ownerId,{owner:other,body}]]),eye,direction,77)).toThrow(/binding/);
    const contact=captureHvpCompactBodyHit(world,targets,eye,direction,77)!;
    expect(contact.identity).toBe(owner.identity);expect(contact.issuedTick).toBe(77);
    expect(contact.materialId).toBe(owner.readMaterial(...contact.cell));expect(contact.materialId).toBeGreaterThan(0);
    expect(owner.archiveReady()).toBe(false);
    const late=contact.forStructuralCut(budget.reserve,yieldTask);
    const rotation=body.rotation();body.setAngvel({x:.1,y:0,z:.25},true);body.setLinvel({x:1,y:0,z:0},true);
    body.setTranslation({x:8,y:2,z:1},true);world.step();
    const {hit,target}=await late;
    expect(hit.cell).toEqual(contact.cell);expect(hit.pose).toBe(contact.pose);expect(hit.issuedTick).toBe(77);
    expect(hit.sourceDigest).toBe(target.recipe.source.contentHash);expect(hit.sourceDigest).toMatch(/^fnv1a64-v1:/);
    expect(captureHvpBodyHit(world,new Map([[request.ownerId,target]]),eye,direction,78)).toBeNull();
    const plan=prepareHvpBodyCut(hit,target,"moving-cut",1),stage=stageHvpBodyCut(world,target,plan);
    expect(stage.parentPose.position.x).toBeCloseTo(8+1/60,4);expect(stage.removedMomentum.massKg).toBeGreaterThan(0);
    expect(stage.parentPose.rotation.w).toBeCloseTo(rotation.w,2);stage.commit();stage.finalize();
    await expect(contact.forStructuralCut(budget.reserve,yieldTask)).rejects.toThrow(/Stale/);
  }finally{owner.dispose();other.dispose();world.free();budget.release();}
});

it("publishes the rotated U's exact native collider and inertia before any v1 authority is constructed",async()=>{
  const {request,binding}=fixture(),budget=ledger(),world=new R.World({x:0,y:-9.81,z:0}),reference=new R.World({x:0,y:-9.81,z:0});
  const owner=issueHvpCompactNativeOwner(request,binding,budget.reserve);
  try {
    const body=installHvpRigidBody(world,owner.recipe,pose);
    world.updateSceneQueries();
    expect(owner.archiveReady()).toBe(false);
    expect(owner.readMaterial(18,9,4)).toBe(0);
    expect(owner.readMaterial(12,11,4)).toBe(2);
    const ray=(z:number)=>world.castRay(new R.Ray({x:-1,y:1.25,z},{x:1,y:0,z:0}),4,true);
    expect(ray(-18.5*.125)).toBeNull();
    expect(ray(-12.5*.125)?.collider.parent()?.handle).toBe(body.handle);
    const capsule=new R.Capsule(HVP_PLAYER_PROFILE.height/2-HVP_PLAYER_PROFILE.radius,HVP_PLAYER_PROFILE.radius);
    expect(world.intersectionWithShape({x:4.5*.125,y:1.25,z:-18.5*.125},identity,capsule)).toBeNull();
    expect(world.intersectionWithShape({x:4.5*.125,y:1.25,z:-12.5*.125},identity,capsule)?.parent()?.handle).toBe(body.handle);
    expect(owner.archiveReady()).toBe(false);

    const cells=materializeCompactCells(request.compactSource);
    const oracle=prepareHvpTerrainFragment({...request,compactSource:undefined,cells},binding.generation);
    const control=installHvpRigidBody(reference,oracle,pose);
    expect(body.numColliders()).toBe(control.numColliders());
    expect(body.mass()).toBe(control.mass());
    for (const [field,value] of Object.entries(oracle.mass.inertiaTensorKgMetersSquared)) {
      expect(owner.recipe.mass.inertiaTensorKgMetersSquared[field as keyof typeof oracle.mass.inertiaTensorKgMetersSquared]).toBeCloseTo(value,9);
    }
    for (const rb of [body,control]) rb.applyImpulseAtPoint({x:.9,y:.15,z:.125},{x:.2,y:.1,z:0},true);
    world.step();reference.step();
    for(const [a,b] of [[body.angvel(),control.angvel()],[body.linvel(),control.linvel()],[body.translation(),control.translation()]]) {
      for (const k of ["x","y","z"] as const) expect(a![k]).toBeCloseTo(b![k],5);
    }
    const oldIdentity=owner.identity;
    const failed=owner.materializeV1(()=>{throw new Error("credit exhausted");},yieldTask);
    await expect(failed).rejects.toThrow(/credit/);
    expect(owner.archiveReady()).toBe(false);
    const first=owner.materializeV1(budget.reserve,yieldTask),again=owner.materializeV1(budget.reserve,yieldTask);
    expect(first).toBe(again);
    const legacy=await first;
    expect(encodeStructuralObject(legacy.source)).toBe(encodeStructuralObject(oracle.source));
    expect(await owner.materializeV1(budget.reserve,yieldTask)).toBe(legacy);
    expect(owner.identity).toBe(oldIdentity);
    const saved=encodeHvpBody(request.ownerId,"terrain",legacy,body);
    const cold=decodeHvpBody(saved);
    const hit=[12,9,4] as const;
    expect(prepareHvpLocalBodyCut(cold.recipe.source,hit,"recut",2,"Box")).toEqual(prepareHvpLocalBodyCut(oracle.source,hit,"recut",2,"Box"));
  } finally {owner.dispose();budget.release();world.free();reference.free();}
});

it("keeps its own immutable material source and invalidates post-disposal native installation",async()=>{
  const {request,binding}=fixture(),copy=structuredClone(request),bud=ledger(),world=new R.World({x:0,y:0,z:0});
  const owner=issueHvpCompactNativeOwner(copy,binding,bud.reserve);
  try {
    (copy.compactSource.parts[0]!.runs as number[])[0]=0;
    expect(owner.readMaterial(12,11,4)).toBe(2);
    const keep=owner.recipe;
    const pending=owner.materializeV1(bud.reserve,yieldTask);
    owner.dispose();
    await expect(pending).rejects.toThrow(/disposed/);
    expect(()=>owner.readMaterial(12,11,4)).toThrow(/disposed/);
    expect(()=>installHvpRigidBody(world,keep)).toThrow();
    expect(world.bodies.len()).toBe(0);
  } finally {owner.dispose();bud.release();world.free();}
});

it("rejects a matching-volume hull, disconnected craft, foreign generation and forged source claims",()=>{
  const {request,binding}=fixture(),bud=ledger();
  const issue=(r:HvpTerrainFragmentRequest)=>issueHvpCompactNativeOwner(r,binding,bud.reserve);
  try {
    expect(()=>issue({...request,ownerId:"hvp:terrain-fragment:r1:00000000"})).toThrow(/membership/);
    expect(()=>issue({...request,compactSource:{...request.compactSource,generation:99}})).toThrow();
    expect(()=>issue({...request,massKg:request.massKg+1})).toThrow(/mass/);
    expect(()=>issue({...request,colliderBoxes:[{min:[12,3,4],max:[25,20,5]}]})).toThrow(/coverage/);
    const parts=[{origin:[0,0,0] as const,leafRevision:1,label:1,runs:[0x10010,0x10012]}];
    const ownerId=`hvp:terrain-fragment:r1:${compactTerrainOwnerDigest(orderedSpans(parts))}`;
    expect(()=>issue({...request,ownerId,compactSource:{generation:1,cellCount:2,parts},
      colliderBoxes:[{min:[0,1,0],max:[1,2,1]},{min:[2,1,0],max:[3,2,1]}]})).toThrow(/connectivity/);
  } finally {bud.release();}
});

it("admits a four-leaf archive-profile edge (1024 cells/128 material runs) and reconstructs its exact v1 body",async()=>{
  const {binding}=fixture(),bud=ledger();
  const parts=[];
  for(let bx=0;bx<4;bx++) {
    const runs=[];
    for(let y=1;y<=16;y++) {
      // Keep all rows in the same y-leaf.
      const offset=(y-1)*16 + 256;
      runs.push(0x10000 | (7<<12) | offset,0x20000 | (7<<12) | (offset+8));
    }
    parts.push({origin:[bx*16,16,0] as HvpCell,leafRevision:0,label:1,runs});
  }
  const count=1024,ownerId=`hvp:terrain-fragment:r1:${compactTerrainOwnerDigest(orderedSpans(parts))}`;
  const d=HVP_COAST_MATERIAL_REGISTRY;
  const massKg=count/2*(d[0]!.densityKgPerM3+d[1]!.densityKgPerM3)*.125**3;
  const source={generation:1,cellCount:count,parts};
  const request={ownerId,massKg,cells:[],compactSource:source,origin:HVP_SOURCE_MIN_METERS,colliderBoxes:[{min:[0,16,1] as HvpCell,max:[64,32,2] as HvpCell}]};
  const owner=issueHvpCompactNativeOwner(request,binding,bud.reserve);
  try {
    const saved=await owner.materializeV1(bud.reserve,yieldTask);
    const reference=prepareHvpTerrainFragment({...request,compactSource:undefined,cells:materializeCompactCells(source)},1);
    expect(encodeStructuralObject(saved.source)).toBe(encodeStructuralObject(reference.source));
    expect(owner.recipe.mass.totalMassKg).toBe(saved.mass.totalMassKg);
  } finally {owner.dispose();bud.release();}
},60000);

it("compares the published native Rock Arm against the eager recipe on the same 64-cell cut", () => {
  const root=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"lazy-profile",1);
  const before=root.read(), cut=cutAt(root,[176,78,76],[180,82,80]), index=createTerrainComponentIndex(before);
  try {
    const fragment=index.prepareCompact(cut).fragments[0]!;
    const request={ownerId:fragment.ownerId,cells:[],origin:HVP_SOURCE_MIN_METERS,massKg:fragment.massKg,
      colliderBoxes:fragment.colliderBoxes,compactSource:{generation:fragment.revision,cellCount:fragment.cellCount,parts:fragment.parts}};
    const binding={sessionId:before.sessionId,epoch:before.epoch,generation:fragment.revision,terrainDigest:cut.after.sourceDigest};
    const benchmark=process.env.HVP_COMPACT_NATIVE_BENCH==="1";
    const samples=[];
    let nativeMass:number|undefined;
    for(let pair=0;pair<(benchmark?36:1);pair++) {
      for(const lane of pair%2?["eager","compact"]:["compact","eager"]) {
        const world=new R.World({x:0,y:-9.81,z:0}),budget=ledger();
        let owner:ReturnType<typeof issueHvpCompactNativeOwner>|undefined;
        try {
          const start=performance.now();
          let recipe;
          if(lane==="compact") {
            owner=issueHvpCompactNativeOwner(request,binding,budget.reserve);
            recipe=owner.recipe;
          } else {
            const steps=prepareHvpTerrainFragmentOwnedSteps(request,binding.generation,budget.reserve);
            for(;;) {const result=steps.next();if(result.done) {recipe=result.value;break;}}
          }
          const prepared=performance.now(), body=installHvpRigidBody(world,recipe);
          world.updateSceneQueries();
          const end=performance.now();
          nativeMass??=body.mass();
          expect(body.mass()).toBe(nativeMass);
          expect(recipe.mass.totalMassKg).toBe(1722.65625);
          expect(body.numColliders()).toBe(1);
          if(owner) expect(owner.archiveReady()).toBe(false);
          if(benchmark) samples.push({lane,pair,prepareMs:prepared-start,installAndRefreshMs:end-prepared,totalMs:end-start});
        } finally {owner?.dispose();world.free();budget.release();}
      }
    }
    if(benchmark) console.info("HVP compact native isolated samples",JSON.stringify({ownerId:request.ownerId,warmupPairs:4,nativeMass,samples}));
  } finally {index.dispose();}
},60000);
