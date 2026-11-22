import {parentPort,threadId,workerData} from "node:worker_threads";
import {initializeHvpRapier,R} from "../../../src/hestia-prototype/physics/rapierPort";
import {compactRuntimeMembershipDigest,issueHvpCompactNativeOwner,type HvpCompactRuntimeBinding} from "../../../src/hestia-prototype/physics/compactNativeOwner";
import {installHvpRigidBody} from "../../../src/hestia-prototype/physics/rigidBody";
import {restoreHvpBody} from "../../../src/hestia-prototype/physics/restoreBody";
import {captureHvpBodyHit,prepareHvpBodyCut,stageHvpBodyCut} from "../../../src/hestia-prototype/physics/bodyCut";
import {readHvpBodyCells} from "../../../src/hestia-prototype/physics/bodyCutPlan";
import {decodeHvpBody,encodeHvpBody} from "../../../src/hestia-prototype/persistence/bodyCheckpoint";
import {HVP_PLAYER_PROFILE} from "../../../src/hestia-prototype/physics/profile";
import {HVP_COAST_REGISTRY_DIGEST} from "../../../src/hvp/hvpCoastSource";
import {createStructuralOwnerLedger} from "../../../src/voxel/structural/model";
import {mapStructuralAuthorPointToWorld,rotateStructuralWorldVector} from "../../../src/voxel/structural";
import type {HvpTerrainFragmentRequest} from "../../../src/hestia-prototype/physics/terrainFragment";

const port=parentPort;
const capability="hvp-compact-native-ipc-qualification-v1" as const;
if(!port || workerData.capability!==capability || !Number.isSafeInteger(workerData.incarnation)) throw new Error("Missing qualification capability");
type Owner=ReturnType<typeof issueHvpCompactNativeOwner>;
type Identity=Owner["identity"];
type Cmd= {id:number;incarnation:number;capability:string;identity?:Identity} & (
  {kind:"open";request:HvpTerrainFragmentRequest;binding:HvpCompactRuntimeBinding} |
  {kind:"cold";saved:ReturnType<typeof encodeHvpBody>;binding:HvpCompactRuntimeBinding} |
  {kind:"initialize"|"query"|"move"|"save"|"recut"|"dispose"});
const ledger=createStructuralOwnerLedger(0,96*1024*1024,128);
const pose={rotation:{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},translationMeters:{x:0,y:-3*.125,z:0}};
let prepared:R.World|undefined;
let world:R.World|undefined,body:R.RigidBody|undefined,owner:Owner|undefined,identity:Identity|undefined;
let coldRecipe:ReturnType<typeof decodeHvpBody>["recipe"]|undefined;
let id=0;
const schedule=()=>new Promise<void>(resolve=>setImmediate(resolve));
const state=()=>({position:{...body!.translation()},rotation:{...body!.rotation()},velocity:{...body!.linvel()},angular:{...body!.angvel()}});
const bound=(a:Identity|undefined,b:Identity|undefined)=>!!a&&!!b&&a.kind===b.kind&&a.sessionId===b.sessionId
  &&a.epoch===b.epoch&&a.generation===b.generation&&a.terrainDigest===b.terrainDigest&&a.ownerId===b.ownerId
  &&a.registryDigest===b.registryDigest&&a.membershipDigest===b.membershipDigest;
async function execute(msg:Cmd) {
  if(msg.id!==id+1 || msg.incarnation!==workerData.incarnation || msg.capability!==capability) throw new Error("Wrong endpoint, capability or order");
  id=msg.id;
  if(msg.kind==="initialize") {
    if(prepared||world) throw new Error("World already initialized");
    await initializeHvpRapier();prepared=new R.World({x:0,y:-9.81,z:0});
    return {ready:true,threadId};
  }
  if(msg.kind==="dispose") {
    if(world&&identity&&!bound(identity,msg.identity)) throw new Error("Stale compact identity");
    const bodies=world?.bodies.len()??0;
    owner?.dispose();prepared?.free();prepared=undefined;world?.free();world=undefined;body=undefined;identity=undefined;coldRecipe=undefined;ledger.release();
    return {disposed:true,released:bodies};
  }
  if(msg.kind==="open"||msg.kind==="cold") {
    if(world) throw new Error("Owner already open");
    await initializeHvpRapier();
    const w=prepared??new R.World({x:0,y:-9.81,z:0});prepared=undefined;
    try {
      if(msg.kind==="open") {
        owner=issueHvpCompactNativeOwner(msg.request,msg.binding,ledger.reserve);
        body=installHvpRigidBody(w,owner.recipe,pose);identity=owner.identity;
      } else {
        const decoded=decodeHvpBody(msg.saved);
        const cells=readHvpBodyCells(decoded.recipe.source).slice().sort((a,b)=>a.z-b.z||a.y-b.y||a.x-b.x);
        const spans=cells.map(c=>({x:c.x,end:c.x+1,y:c.y,z:c.z,material:c.materialId}));
        const expected={kind:"hvp-compact-runtime-v1" as const,...msg.binding,ownerId:decoded.checkpoint.ownerId,registryDigest:HVP_COAST_REGISTRY_DIGEST,
          membershipDigest:compactRuntimeMembershipDigest(spans,cells.length)};
        if(!bound(expected,msg.identity)||!expected.ownerId.startsWith(`hvp:terrain-fragment:r${expected.generation}:`)||decoded.checkpoint.family!=="terrain"||decoded.recipe.source.objectId!==expected.ownerId) throw new Error("Saved fragment identity mismatch");
        body=restoreHvpBody(w,decoded);coldRecipe=decoded.recipe;identity=expected;
      }
      w.updateSceneQueries();world=w;
    } catch(error) {owner?.dispose();owner=undefined;body=undefined;identity=undefined;coldRecipe=undefined;w.free();throw error;}
    return {identity,threadId,archiveReady:owner?.archiveReady()??true,state:state(),bodies:w.bodies.len(),colliders:w.colliders.len()};
  }
  if(!world||!body||!identity||!bound(identity,msg.identity)) throw new Error("Stale compact identity");
  if(msg.kind==="query") {
    const ray=(z:number)=>world!.castRay(new R.Ray({x:-1,y:1.25,z},{x:1,y:0,z:0}),4,true);
    const capsule=new R.Capsule(HVP_PLAYER_PROFILE.height/2-HVP_PLAYER_PROFILE.radius,HVP_PLAYER_PROFILE.radius);
    return {identity,holeRay:ray(-18.5*.125)===null,wallRay:ray(-12.5*.125)?.collider.parent()?.handle===body.handle,
      holeCapsule:world.intersectionWithShape({x:4.5*.125,y:1.25,z:-18.5*.125},{x:0,y:0,z:0,w:1},capsule)===null,
      archiveReady:owner?.archiveReady()??true};
  }
  if(msg.kind==="move") {
    body.setLinvel({x:.25,y:.35,z:-.8},true);body.setAngvel({x:.3,y:-.4,z:1.5},true);
    world.step();return {identity,state:state(),archiveReady:owner?.archiveReady()??true};
  }
  const recipe=coldRecipe??await owner!.materializeV1(ledger.reserve,schedule);
  if(msg.kind==="save") return {identity,legacyHash:recipe.source.contentHash,saved:encodeHvpBody(identity.ownerId,"terrain",recipe,body)};
  const rotation={...body.rotation()},center=recipe.mass.centerOfMassMeters!;
  const eye=mapStructuralAuthorPointToWorld(rotation,{...body.translation()},center,{x:18.5*.125,y:3.5*.125,z:-.25});
  const ray=rotateStructuralWorldVector(rotation,{x:0,y:0,z:1});
  const target={ownerId:identity.ownerId,body,recipe},hit=captureHvpBodyHit(world,new Map([[target.ownerId,target]]),eye,ray,1);
  if(!hit||hit.sourceDigest!==identity.membershipDigest||hit.ownerId!==target.ownerId) throw new Error("Moving source binding incomplete");
  const plan=prepareHvpBodyCut(hit,target,"ipc-recut",1);
  const stage=stageHvpBodyCut(world,target,plan);
  stage.commit();stage.finalize();world.updateSceneQueries();
  const parent=identity;
  const children=stage.result.parts.map(p=>({ownerId:p.ownerId,hash:plan.local.plan.parts.find(f=>f.ownerId===p.ownerId)!.recipe.source.contentHash,cells:p.cells.length,mass:p.body.mass(),
    velocity:{...p.body.linvel()},angular:{...p.body.angvel()}}));
  identity=undefined;owner?.dispose();owner=undefined;body=undefined;coldRecipe=undefined;
  return {parent,hit:hit.cell,children,bodies:world.bodies.len()};
}
let queue=Promise.resolve();
port.on("message",(msg:Cmd)=>{queue=queue.then(async()=>{
  try {const result=await execute(msg);port.postMessage({id:msg.id,threadId,result});if(msg.kind==="dispose")port.close();}
  catch(e){port.postMessage({id:msg.id,threadId,error:String(e)});}
});});
