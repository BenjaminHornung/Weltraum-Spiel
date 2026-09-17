import {fnv1aHash} from "../../core/hash";
import {fnv1aBytes} from "../../workers/protocol";
import {ADAPTIVE_BRICK_ESTIMATED_BYTES} from "../../voxel/adaptive";
import {decodeStructuralObject} from "../../voxel/structural";
import {readHvpBodyCells} from "../physics/bodyCutPlan";
import {HVP_BRANCH_KEY,HVP_INERTIA_KEY,validateHvpPlayerCheckpoint} from "../physics/profile";
import {createHvpTick,type HvpTickCheckpoint} from "../physics/tick";
import type {HvpBranchCheckpoint} from "../physics/branchSession";
import type {HvpMovingCheckpoint} from "../physics/bodyCutSession";
import type {HvpCollisionCoverage,HvpPlayerCheckpoint} from "../player/locomotion";
import type {HvpCollisionSector} from "../physics/terrainColliders";
import {decodeHvpBody,type HvpBodyCheckpoint} from "./bodyCheckpoint";
import {validateHvpNeighborCheckpoint,type HvpNeighborCheckpoint} from "../runtime/residency";

type Vec=Readonly<{x:number;y:number;z:number}>;
export interface HvpWorldCheckpoint {
  readonly version:"hvp-world-checkpoint-v1";readonly solver:"rapier-0.12.0";readonly sessionId:string;
  readonly gravity:number;readonly terrainGeneration:number;readonly tick:HvpTickCheckpoint;readonly collisionDigest:string;
  readonly dropSpawn:Vec;readonly player:HvpPlayerCheckpoint|null;readonly coverage:readonly HvpCollisionCoverage[];
  readonly bodies:readonly HvpBodyCheckpoint[];readonly branch:HvpBranchCheckpoint|null;readonly moving:HvpMovingCheckpoint;
  readonly impulses:number;readonly lastImpulseTick:number|null;
  readonly lastImpulse:Readonly<{status:string;reason:string;point?:Vec;impulse?:Vec;target?:string}>|null;
  readonly neighbor?:HvpNeighborCheckpoint|null;readonly parked?:readonly string[];
}
const safeInt=(n:number)=>Number.isSafeInteger(n)&&n>=0;
const validId=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9:_-]{1,128}$/.test(v);
const vector=(v:unknown):v is Vec=>!!v&&typeof v==="object"&&Object.keys(v).sort().join(",")==="x,y,z"
  &&["x","y","z"].every(k=>Number.isFinite(Math.fround((v as Record<string,number>)[k]!)));

/** Canonical collision products must match the artifact-derived replacement scene. */
export const hvpCollisionDigest=(sectors:readonly HvpCollisionSector[]):string=>{
  if(sectors.length>4094){throw new Error("Collision checkpoint budget");}
  let bytes=0;
  for(const s of sectors){
    if(!(s.vertices instanceof Float32Array)||!(s.indices instanceof Uint32Array)||s.vertices.length%3!==0||s.indices.length%3!==0
      ||s.vertices.some(n=>!Number.isFinite(n))||s.indices.some(n=>n>=s.vertices.length/3)){throw new Error("Invalid collision checkpoint input");}
    bytes+=s.vertices.byteLength+s.indices.byteLength;
  }
  if(bytes>8*1024*1024){throw new Error("Collision checkpoint payload budget");}
  return fnv1aHash(JSON.stringify(sectors.map(s=>[s.vertices.length,s.indices.length,
    fnv1aBytes([s.vertices.buffer.slice(s.vertices.byteOffset,s.vertices.byteOffset+s.vertices.byteLength) as ArrayBuffer,
      s.indices.buffer.slice(s.indices.byteOffset,s.indices.byteOffset+s.indices.byteLength) as ArrayBuffer])])));
};

/** Decode sources and verify all membership before allocating a replacement World. */
const inspectHvpWorld=(value:unknown)=>{
  const c=value as HvpWorldCheckpoint|null;
  if(!c||Object.keys(c).filter(k=>k!=="neighbor"&&k!=="parked").sort().join(",")!=="bodies,branch,collisionDigest,coverage,dropSpawn,gravity,impulses,lastImpulse,lastImpulseTick,moving,player,sessionId,solver,terrainGeneration,tick,version"
    ||c.version!=="hvp-world-checkpoint-v1"||c.solver!=="rapier-0.12.0"||!validId(c.sessionId)||!Number.isFinite(c.gravity)||c.gravity<=0
    ||!safeInt(c.terrainGeneration)||!safeInt(c.impulses)||!vector(c.dropSpawn)||!/^([0-9a-f]{8})$/.test(c.collisionDigest)
    ||!Array.isArray(c.bodies)||c.bodies.length<1||c.bodies.length>64||!Array.isArray(c.coverage)||c.coverage.length>128){throw new Error("Invalid World checkpoint profile/owner budget");}
  if(c.neighbor!==undefined&&c.neighbor!==null){validateHvpNeighborCheckpoint(c.neighbor);}
  if(c.parked!==undefined&&(!Array.isArray(c.parked)||c.parked.length>64||!c.parked.every(validId)||new Set(c.parked).size!==c.parked.length)){
    throw new Error("Invalid checkpointed owner list");
  }
  if(!c.tick||Object.keys(c.tick).sort().join(",")!=="backlogSeconds,discardedSeconds,status,ticks"){throw new Error("Missing confirmed tick checkpoint");}
  createHvpTick(()=>{},c.tick).dispose();
  if(c.lastImpulseTick!==null&&(!safeInt(c.lastImpulseTick)||c.lastImpulseTick>c.tick.ticks)){throw new Error("Invalid impulse clock");}
  for(const r of c.coverage){
    if(!r||Object.keys(r).sort().join(",")!=="maxX,maxZ,minX,minZ"||![r.minX,r.maxX,r.minZ,r.maxZ].every(Number.isFinite)
      ||r.minX>=r.maxX||r.minZ>=r.maxZ){throw new Error("Invalid player coverage checkpoint");}
  }
  const east=c.coverage.filter(r=>r.maxX>16);
  if(east.length>0&&!c.neighbor?.resident){throw new Error("Coverage cannot outlive its confirmed neighbour");}
  if(c.neighbor?.resident){
    let area=0;
    for(const [i,r] of east.entries()){
      if(r.minX<16||r.maxX>48||r.minZ< -16||r.maxZ>16){throw new Error("Foreign neighbour coverage");}
      area+=(r.maxX-r.minX)*(r.maxZ-r.minZ);
      if(east.slice(0,i).some(p=>r.minX<p.maxX&&r.maxX>p.minX&&r.minZ<p.maxZ&&r.maxZ>p.minZ)){throw new Error("Duplicate neighbour coverage");}
    }
    if(c.player!==null&&area!==32*32){throw new Error("Incomplete confirmed neighbour coverage");}
  }
  if((c.player===null)!==(c.coverage.length===0)){throw new Error("Player/coverage membership mismatch");}
  if(c.player!==null){validateHvpPlayerCheckpoint(c.player,c.gravity);}
  const b=c.branch;
   if(b!==null&&(!b||!["generation,last,origin,source","generation,kind,last,origin,source"].includes(Object.keys(b).sort().join(","))
     ||(b.kind!==undefined&&b.kind!=="branch"&&b.kind!=="salvage")||!vector(b.origin)||(b.generation!==0&&b.generation!==1)
    ||(b.generation===0?typeof b.source!=="string":b.source!==null))){throw new Error("Invalid branch checkpoint");}
  if(b?.last!==null&&b?.last!==undefined){const r=b.last;
    if(Object.keys(r).sort().join(",")!=="id,removedCells,removedMassKg,status"||!validId(r.id)||!["Applied","Rejected"].includes(r.status)
      ||!safeInt(r.removedCells)||r.removedCells>512||!Number.isFinite(r.removedMassKg)||r.removedMassKg<0){throw new Error("Invalid branch receipt");}}
  if(!c.moving||Object.keys(c.moving).sort().join(",")!=="last,sequence"||!safeInt(c.moving.sequence)){throw new Error("Invalid moving checkpoint");}
  if(c.moving.last!==null){const r=c.moving.last,p=r.parentPose,m=r.removedMomentum;
    if(Object.keys(r).sort().join(",")!=="children,commitTick,id,issuedTick,parentId,parentPose,removedCells,removedMassKg,removedMomentum,status"
      ||!validId(r.id)||!validId(r.parentId)||!["Applied","Rejected"].includes(r.status)||!Array.isArray(r.children)||r.children.length>32
      ||!r.children.every(validId)||new Set(r.children).size!==r.children.length||!safeInt(r.removedCells)||r.removedCells<1||r.removedCells>512
      ||!Number.isFinite(r.removedMassKg)||r.removedMassKg<=0||!safeInt(r.issuedTick)||!safeInt(r.commitTick)||r.issuedTick>r.commitTick||r.commitTick>c.tick.ticks
      ||!p||Object.keys(p).sort().join(",")!=="angularVelocity,position,rotation,velocity"||!vector(p.position)||!vector(p.velocity)||!vector(p.angularVelocity)||!p.rotation
      ||Object.keys(p.rotation).sort().join(",")!=="w,x,y,z"
      ||![p.rotation.x,p.rotation.y,p.rotation.z,p.rotation.w].every(Number.isFinite)||Math.abs(Math.hypot(p.rotation.x,p.rotation.y,p.rotation.z,p.rotation.w)-1)>1e-6
      ||!m||Object.keys(m).sort().join(",")!=="angular,center,linear,massKg,referencePoint"||!vector(m.referencePoint)||!vector(m.center)||!vector(m.linear)||!vector(m.angular)||m.massKg!==r.removedMassKg){throw new Error("Invalid moving receipt");}
  }
  if(c.lastImpulse!==null){const r=c.lastImpulse;
    if(!r||Object.keys(r).sort().join(",")!==(r.status==="Applied"?"impulse,point,reason,status,target":"reason,status")
      ||!["Applied","Rejected"].includes(r.status)||typeof r.reason!=="string"||r.reason.length>512
      ||(r.status==="Applied"&&(!vector(r.point)||!vector(r.impulse)||!validId(r.target)))){throw new Error("Invalid impulse receipt");}}
  // Serialized size and brick counts are inspected before any source reconstruction.
  let textBytes=0,sourceBytes=0;
  const countBricks=(text:string,region:boolean)=>{
    if(typeof text!=="string"||text.length>16*1024*1024){throw new Error("World source transport budget");}
    textBytes+=new TextEncoder().encode(text).byteLength;
    if(textBytes>16*1024*1024){throw new Error("World source transport budget");}
    const object=region?JSON.parse(text).object:JSON.parse(text);
    if(!Array.isArray(object?.bricks)||object.bricks.length<1||object.bricks.length>128){throw new Error("World body brick budget");}
    sourceBytes+=object.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES;
    if(sourceBytes>64*1024*1024){throw new Error("World decoded source budget");}
  };
  for(const body of c.bodies){if(!body){throw new Error("Missing saved body owner");}countBricks(body.region,true);}
  if(b?.source!==null&&b?.source!==undefined){countBricks(b.source,false);}
  const owners=new Set<string>();
  for(const body of c.bodies){if(!validId(body.ownerId)||owners.has(body.ownerId)){throw new Error("Duplicate or invalid body owner");}owners.add(body.ownerId);}
  return {checkpoint:c,sourceBytes};
};
export const hvpWorldCheckpointBytes=(value:unknown):number=>inspectHvpWorld(value).sourceBytes;
export const decodeHvpWorld=(value:unknown)=>{
  const {checkpoint:c,sourceBytes}=inspectHvpWorld(value),b=c.branch;
  const decoded=c.bodies.map(decodeHvpBody),drop=decoded.filter(d=>d.checkpoint.family==="drop"),inertia=decoded.filter(d=>d.checkpoint.family==="inertia");
  const parked=new Set(c.parked??[]);
  for(const id of parked){const owner=decoded.find(d=>d.checkpoint.ownerId===id);
    if(!owner||owner.checkpoint.family!=="terrain"||!owner.checkpoint.dynamic||!owner.checkpoint.sleeping){throw new Error("Invalid dormant material owner");}}
  if(drop.length!==1||drop[0]!.checkpoint.ownerId!=="hvp:physics:drop"||!drop[0]!.checkpoint.dynamic||inertia.length>1
    ||inertia.some(d=>d.checkpoint.ownerId!==HVP_INERTIA_KEY||!d.checkpoint.dynamic)
    ||decoded.some(d=>d.checkpoint.family==="terrain"&&!d.checkpoint.dynamic)||decoded.filter(d=>d.checkpoint.dynamic&&!parked.has(d.checkpoint.ownerId)).length>32){throw new Error("World body owner membership mismatch");}
  const branchBodies=decoded.filter(d=>d.checkpoint.family==="branch"),fixed=branchBodies.filter(d=>!d.checkpoint.dynamic);
  if((b===null&&branchBodies.length!==0)||(b!==null&&fixed.length===0)
    ||(b?.generation===0&&(branchBodies.length!==1||fixed[0]?.checkpoint.ownerId!==HVP_BRANCH_KEY))){throw new Error("Branch body owner membership mismatch");}
  const branchSource=b?.source?decodeStructuralObject(b.source):null;
  if(branchSource&&branchSource.objectId!==((b?.kind??"branch")==="salvage"?"hvp-salvage":"hvp-branch")){throw new Error("Branch scenario/source mismatch");}
  if(branchSource&&(JSON.stringify(readHvpBodyCells(branchSource))!==JSON.stringify(readHvpBodyCells(fixed[0]!.recipe.source))
    ||JSON.stringify(branchSource.materials)!==JSON.stringify(fixed[0]!.recipe.source.materials))){throw new Error("Branch source/body mismatch");}
  return Object.freeze({checkpoint:structuredClone(c),bodies:Object.freeze(decoded),branchSource,sourceBytes});
};
export type HvpDecodedWorld=ReturnType<typeof decodeHvpWorld>;
