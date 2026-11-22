import { HVP_SOURCE_MIN_METERS, materializeHvpCoastSource, prepareHvpCoastSource } from "../../../src/hvp/hvpCoastSource";
import { createHvpTerrainRoot } from "../../../src/hestia-prototype/terrain/cutPlan";
import { createTerrainComponentIndex } from "../../../src/voxel/structural/componentIndex";
import { createStructuralOwnerLedger } from "../../../src/voxel/structural/model";
import { initializeHvpRapier, R } from "../../../src/hestia-prototype/physics/rapierPort";
import { issueHvpCompactNativeOwner } from "../../../src/hestia-prototype/physics/compactNativeOwner";
import { resolveHvpGravity } from "../../../src/hestia-prototype/physics/profile";
import { HVP_PHYSICS_DT } from "../../../src/hestia-prototype/physics/tick";
import { installHvpRigidBody } from "../../../src/hestia-prototype/physics/rigidBody";
import type { HvpCell } from "../../../src/hestia-prototype/terrain/picking";

type Command = "ping" | "open" | "cut" | "step" | "close";
const identity = {x:0,y:0,z:0,w:1};
const origin = HVP_SOURCE_MIN_METERS;
const supportMin: HvpCell = [176,78,76], supportMax: HvpCell = [180,82,80];
function bounds(min:HvpCell, max:HvpCell) {
  return {x:origin.x+(min[0]+max[0])/16, y:origin.y+(min[1]+max[1])/16, z:origin.z+(min[2]+max[2])/16};
}

function geometry() {
  const root=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"placement-rock-arm",1);
  const before=root.read();
  const cut=root.prepare({sessionId:before.sessionId,epoch:before.epoch,revision:before.revision,sourceDigest:before.sourceDigest,
    commandId:"placement-cut",toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:supportMin,max:supportMax}});
  const index=createTerrainComponentIndex(before);
  try {
    const result=index.prepareCompact(cut);
    if(cut.changed.length!==64 || result.fragments.length!==1)throw new Error("Unexpected support occupancy");
    const f=result.fragments[0]!;
    if(f.cellCount!==384 || f.massKg!==1722.65625)throw new Error("Incorrect source fixture");
    return {request:{ownerId:f.ownerId,origin,cells:[],massKg:f.massKg,colliderBoxes:f.colliderBoxes,
      compactSource:{generation:f.revision,parts:f.parts,cellCount:f.cellCount}},
      binding:{sessionId:before.sessionId,epoch:before.epoch,generation:f.revision,terrainDigest:cut.after.sourceDigest}};
  } finally {index.dispose();}
}

/** A bounded physical fixture cut from the real Hestia source. The full player run separately tests the streamed terrain. */
export function createScene() {
  let world:R.World | undefined, support:R.RigidBody | undefined, body:R.RigidBody | undefined;
  let source:ReturnType<typeof geometry> | undefined, owner:ReturnType<typeof issueHvpCompactNativeOwner> | undefined;
  let ledger:ReturnType<typeof createStructuralOwnerLedger> | undefined;
  const supportCenter=bounds(supportMin,supportMax);
  function queries(w:R.World) {
    const box=source!.request.colliderBoxes[0]!;
    const arm=bounds(box.min,box.max);
    const hit=(p:typeof arm)=>w.castRay(new R.Ray({x:p.x,y:p.y,z:p.z-.6},{x:0,y:0,z:1}),1.2,true);
    // This narrow capsule fits inside the half-metre cut. This is an occupancy query, not player-clearance proof.
    const capsule=new R.Capsule(.035,.025);
    const overlap=(p:typeof arm)=>w.intersectionWithShape(p,identity,capsule);
    const a=hit(arm),b=overlap(arm);
    return {supportRay:Boolean(hit(supportCenter)),supportCapsule:Boolean(overlap(supportCenter)),armRay:Boolean(a),armCapsule:Boolean(b),
      armMoves:!!body && a?.collider.parent()?.handle===body.handle && b?.parent()?.handle===body.handle};
  }
  return async function execute(kind:Command) {
    if(kind==="ping")return 1;
    if(kind==="open") {
      if(world)throw new Error("Duplicate scene");
      await initializeHvpRapier();
      source??=geometry();
      world=new R.World({x:0,y:-resolveHvpGravity(),z:0});
      world.timestep=HVP_PHYSICS_DT;
      ledger=createStructuralOwnerLedger(0,96*1024*1024,128);
      support=world.createRigidBody(R.RigidBodyDesc.fixed());
      for(const shape of [{min:supportMin,max:supportMax},...source.request.colliderBoxes]) {
        const {min,max}=shape,c=bounds(min,max);
        const desc=R.ColliderDesc.cuboid((max[0]-min[0])/16,(max[1]-min[1])/16,(max[2]-min[2])/16);
        world.createCollider(desc.setTranslation(c.x,c.y,c.z),support);
      }
      const floor=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(supportCenter.x,supportCenter.y-1.25,supportCenter.z));
      world.createCollider(R.ColliderDesc.cuboid(8,.125,8),floor);
      world.updateSceneQueries();
      return queries(world);
    }
    if(!world||!source||!support||!ledger)throw new Error("Expected live scene");
    if(kind==="cut"){
      if(owner)throw new Error("Duplicate cut");
      owner=issueHvpCompactNativeOwner(source.request,source.binding,ledger.reserve);
      world.removeRigidBody(support);
      body=installHvpRigidBody(world,owner.recipe,{translationMeters:origin,rotation:identity});
      world.updateSceneQueries();
      return {checks:queries(world),nativeMassKg:body.mass(),cells:source.request.compactSource.cellCount,
        massKg:owner.recipe.mass.totalMassKg,boxes:source.request.colliderBoxes.length};
    }
    if(kind==="step"){
      if(!body)throw new Error("Expected detached fragment");
      body.wakeUp();
      const begin=performance.now();
      world.step();
      const duration=performance.now()-begin;
      return {duration,y:body.translation().y};
    }
    owner?.dispose();world.free();ledger.release();body=undefined;owner=undefined;world=undefined;support=undefined;ledger=undefined;
    return 0;
  };
}

// The identical compiled module is loaded with import() on main and as a module Worker.
if(typeof document==="undefined" && typeof self!=="undefined") {
  const execute=createScene();
  self.onmessage=async({data}:{data:{id:number;kind:Command}})=>{
    const begin=performance.now();
    try{const result=await execute(data.kind);self.postMessage({id:data.id,result,begin,end:performance.now(),origin:performance.timeOrigin});}
    catch(error){self.postMessage({id:data.id,error:String(error)});}
  };
}
