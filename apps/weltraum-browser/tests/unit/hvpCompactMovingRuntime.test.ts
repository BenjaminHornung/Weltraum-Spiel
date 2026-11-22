import {beforeAll,expect,it,vi} from "vitest";
import {HVP_SOURCE_MIN_METERS,prepareHvpCoastSource,materializeHvpCoastSource} from "../../src/hvp/hvpCoastSource";
import {deriveStructuralWorldSplitVelocity,rotateStructuralWorldVector} from "../../src/voxel/structural";
import {createTerrainComponentIndex} from "../../src/voxel/structural/componentIndex";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {captureHvpBodyHit,prepareHvpBodyCut,stageHvpBodyCut,type HvpCuttableBody} from "../../src/hestia-prototype/physics/bodyCut";
import {createHvpOwnedHashBodyCutSession} from "../../src/hestia-prototype/physics/bodyCutSession";
import {issueHvpCompactNativeOwner,type HvpCompactNativeOwner} from "../../src/hestia-prototype/physics/compactNativeOwner";
import {hvpFragmentArchiveDigest} from "../../src/hestia-prototype/physics/compactFragmentIdentity";
import {readCompactMovingProjection} from "../../src/hestia-prototype/presentation/compactMovingProjection";
import {decodeHvpColdBody,encodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {cutAt,rootFor,voxel} from "./componentIndex/compactFixtures";

beforeAll(initializeHvpRapier);
const zero={x:0,y:0,z:0};
const eye={x:189.5*.125,y:85.5*.125,z:76*.125-.4},direction={x:0,y:0,z:1};
const budget=()=>createStructuralOwnerLedger(0,96*1024*1024,128);
const host={assertCurrent(){},async yieldTask(){throw Error("Ungated archive work");}};
type Vec=typeof zero;
function closeVec(a:Vec,b:Vec){
  for(const k of ["x","y","z"] as const)expect(a[k]).toBeCloseTo(b[k],3);
}
function setup(){
  const root=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"moving-rock",1);
  const cut=cutAt(root,[176,78,76],[180,82,80]),idx=createTerrainComponentIndex(cut.before),f=idx.prepareCompact(cut).fragments[0]!;
  idx.dispose();
  const ledger=budget(),world=new R.World(zero);
  const owner=issueHvpCompactNativeOwner({ownerId:f.ownerId,cells:[],origin:HVP_SOURCE_MIN_METERS,massKg:f.massKg,colliderBoxes:f.colliderBoxes,
    compactSource:{generation:f.revision,parts:f.parts,cellCount:f.cellCount}},{sessionId:cut.before.sessionId,epoch:cut.before.epoch,generation:f.revision,terrainDigest:cut.after.sourceDigest},ledger.reserve);
  const body=installHvpRigidBody(world,owner.recipe);
  const targetFor=(b:R.RigidBody,o:HvpCompactNativeOwner):HvpCuttableBody=>({body:b,ownerId:o.identity.ownerId,family:"terrain",compactOwner:o,
    get recipe(){return o.materializeV1Sync(ledger.reserve);}});
  const targets=new Map([[owner.identity.ownerId,targetFor(body,owner)]]),bodies=new Map([[owner.identity.ownerId,body]]);
  const moving=createHvpOwnedHashBodyCutSession(world,targets,bodies,"moving-rock");
  const hit=captureHvpBodyHit(world,targets,eye,direction,7)!;
  expect(hit.cell).toEqual([189,85,76]);
  const request={id:"actual-recut",edge:4,direction,sourceDigest:hit.sourceDigest,ownerId:hit.ownerId};
  return {owner,world,body,targets,moving,ledger,async begin(){return moving.beginCompact(request,eye,7,host,budget,targetFor);},close(){
    world.free();moving.dispose(); for(const t of targets.values())t.compactOwner?.dispose();ledger.release();
  }};
}
it.each(["finalize","rollback staged","rollback committed","dispose"])("uses the bound exact native rock child at the current rotating pose: %s",async terminal=>{
  const f=setup(),id="actual-recut";
  try {
    const prep=await f.begin(),projection=prep.compact!.projection;
    expect(projection.removedCells).toBe(32);expect(projection.removedMassKg).toBe(135.9375);
    const cooked=projection.parts[0]!;
    expect(readCompactMovingProjection(structuredClone(prep)).parts).toEqual(projection.parts);
    for(const change of ["material","removed","owner","duplicate"]){
      const forged=structuredClone(prep);
      const part=forged.compact!.projection.parts[0]!,c=part.cells[0]!;
      if(change==="material")Object.assign(c,{materialId:c.materialId===1?3:1});
      if(change==="duplicate")Object.assign(c,part.cells[1]!);
      if(change==="owner")Object.assign(part,{ownerId:prep.payload.ownerId});
      if(change==="removed")Object.assign(forged.compact!,{removedDigest:part.sourceDigest});
      expect(()=>readCompactMovingProjection(forged)).toThrow();
    }
    expect(cooked.massKg).toBe(1586.71875);expect(cooked.cells).toHaveLength(352);
    expect(f.owner.archiveReady()).toBe(false);
    if(terminal==="dispose"){f.moving.dispose();expect(f.moving.busy).toBe(false);expect(f.moving.resources()?.reservedBytes).toBe(0);return;}
    const p={x:5,y:7,z:9},v={x:2,y:-1,z:.5},w={x:.1,y:.4,z:-.3},q={x:0,y:.6,z:0,w:.8};
    f.body.setTranslation(p,true);f.body.setRotation(q,true);f.body.setLinvel(v,true);f.body.setAngvel(w,true);
    await f.moving.preparePlan(id,host);f.moving.completePlan(id);
    expect(()=>f.moving.stage(id,{...projection,parts:[{...cooked,sourceDigest:prep.compact!.removedDigest}]},11)).toThrow("Foreign compact");
    f.moving.stage(id,projection,11);
    expect(f.owner.archiveReady()).toBe(false);
    if(terminal==="rollback staged"){f.moving.rollback(id);expect(f.world.bodies.len()).toBe(1);expect(f.body.isEnabled()).toBe(true);return;}
    f.moving.commit(id);
    const target=f.targets.get(cooked.ownerId)!;
    expect(target.compactOwner!.archiveReady()).toBe(false);
    closeVec(target.body.angvel(),w);
    closeVec(target.body.linvel(),deriveStructuralWorldSplitVelocity(v,w,p,{...target.body.translation()}));
    const momentum=f.moving.read().last!.removedMomentum!.linear;
    closeVec({x:target.body.mass()*target.body.linvel().x+momentum.x,y:target.body.mass()*target.body.linvel().y+momentum.y,z:target.body.mass()*target.body.linvel().z+momentum.z},
      {x:1722.65625*v.x,y:1722.65625*v.y,z:1722.65625*v.z});
    if(terminal==="rollback committed"){
      f.moving.rollback(id);expect(f.targets.get(f.owner.identity.ownerId)?.body).toBe(f.body);
      expect(f.targets.has(cooked.ownerId)).toBe(false);expect(f.body.isEnabled()).toBe(true);
      expect(f.moving.checkpoint().sequence).toBe(0);return;
    }
    f.moving.finalize(id);
    expect(f.moving.checkpoint().sequence).toBe(1);expect(f.moving.read().last).toMatchObject({status:"Applied",issuedTick:7,commitTick:11});
    expect(f.world.bodies.len()).toBe(1);expect(f.world.getRigidBody(f.body.handle)).toBeNull();
    const selected=cooked.cells.find(c=>c.z===76)!;
    const relative={x:(selected.x+.5)*.125-cooked.center.x,y:(selected.y+.5)*.125-cooked.center.y,z:selected.z*.125-.4-cooked.center.z};
    const origin=rotateStructuralWorldVector(q,relative),ray=rotateStructuralWorldVector(q,direction);
    const position=target.body.translation();const eye2={x:position.x+origin.x,y:position.y+origin.y,z:position.z+origin.z};
    const liveHit=captureHvpBodyHit(f.world,f.targets,eye2,ray,12)!;
    expect(liveHit.sourceDigest).toBe(cooked.sourceDigest);expect(liveHit.cell).toEqual([selected.x,selected.y,selected.z]);
    const saved=encodeHvpBody(cooked.ownerId,"terrain",target.recipe,target.body);
    const cold=decodeHvpColdBody(JSON.parse(JSON.stringify(saved)),f.ledger.reserve);
    expect(hvpFragmentArchiveDigest(cold.recipe)).toBe(cooked.sourceDigest);
    const newWorld=new R.World(zero);
    try {
      const restored=installHvpRigidBody(newWorld,cold.recipe);
      restored.setTranslation({...position},true);restored.setRotation(q,true);restored.setLinvel({...target.body.linvel()},true);restored.setAngvel(w,true);
      const nextTarget={body:restored,ownerId:cooked.ownerId,recipe:cold.recipe};
      const coldHit=captureHvpBodyHit(newWorld,new Map([[cooked.ownerId,nextTarget]]),eye2,ray,13)!;
      expect(coldHit.cell).toEqual(liveHit.cell);expect(coldHit.sourceDigest).toBe(cooked.sourceDigest);
      const plan=prepareHvpBodyCut(coldHit,nextTarget,"after-cold-load",1);
      const next=stageHvpBodyCut(newWorld,nextTarget,plan);
      next.commit();next.finalize();expect(plan.local.plan.removedCells).toBe(1);
      expect(next.result.parts.reduce((n,p)=>n+p.body.mass(),next.result.removedMassKg)).toBeCloseTo(cooked.massKg,3);
    }finally{newWorld.free();}
  }finally{f.close();}
},120000);

it("restores the compact parent after a recoverable native installation failure",async()=>{
  const f=setup(),id="actual-recut";
  try {
    const prep=await f.begin();
    const fault=vi.spyOn(f.world,"createCollider").mockImplementationOnce(()=>{throw Error("native installation fault");});
    try{expect(()=>f.moving.stage(id,prep.compact!.projection,8)).toThrow("installation fault");}finally{fault.mockRestore();}
    f.moving.rollback(id);
    expect(f.moving.read()).toMatchObject({sequence:0,state:"Idle"});
    expect(f.world.bodies.len()).toBe(1);expect(f.body.isEnabled()).toBe(true);
    expect(f.owner.archiveReady()).toBe(false);
    expect(captureHvpBodyHit(f.world,f.targets,eye,direction,9)?.sourceDigest).toBe(f.owner.identity.membershipDigest);
  }finally{f.close();}
},120000);

it("erases a whole small body without issuing an invented child",async()=>{
  const cut=cutAt(rootFor([voxel(12,0,4),voxel(12,1,4),voxel(12,2,4),voxel(12,3,4,2)]),[12,2,4]);
  const idx=createTerrainComponentIndex(cut.before),f=idx.prepareCompact(cut).fragments[0]!;
  idx.dispose();const ledger=budget(),world=new R.World(zero);
  const owner=issueHvpCompactNativeOwner({ownerId:f.ownerId,cells:[],origin:HVP_SOURCE_MIN_METERS,massKg:f.massKg,colliderBoxes:f.colliderBoxes,
    compactSource:{generation:f.revision,parts:f.parts,cellCount:f.cellCount}},{sessionId:cut.before.sessionId,epoch:cut.before.epoch,generation:f.revision,terrainDigest:cut.after.sourceDigest},ledger.reserve);
  try {
    const body=installHvpRigidBody(world,owner.recipe);
    const target:HvpCuttableBody={ownerId:f.ownerId,body,compactOwner:owner,get recipe(){return owner.materializeV1Sync(ledger.reserve);}};
    const targets=new Map([[target.ownerId,target]]);
    const moving=createHvpOwnedHashBodyCutSession(world,targets,new Map([[target.ownerId,body]]),"small-cut");
    const start={x:12.5*.125,y:3.5*.125,z:4*.125-.3},hit=captureHvpBodyHit(world,targets,start,direction,6)!;
    const id="full-small";
    const prep=await moving.beginCompact({id,ownerId:f.ownerId,sourceDigest:hit.sourceDigest,edge:1,direction},start,6,host,budget,()=>{throw Error("Unexpected child");});
    const projection=readCompactMovingProjection(structuredClone(prep));
    expect(projection.parts).toEqual([]);expect(projection.removedMassKg).toBe(owner.recipe.mass.totalMassKg);
    moving.completePlan(id);moving.stage(id,projection,7);moving.commit(id);moving.finalize(id);
    expect(moving.read().last?.status).toBe("Applied");expect(world.bodies.len()).toBe(0);expect(targets.size).toBe(0);moving.dispose();
  }finally{owner.dispose();world.free();ledger.release();}
},120000);
