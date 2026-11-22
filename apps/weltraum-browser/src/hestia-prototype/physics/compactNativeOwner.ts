import {bindHvpCompactChildArchive,createHvpCompactChildIdentity,compactRuntimeMembershipDigest} from "./compactFragmentIdentity";
export {compactRuntimeMembershipDigest} from "./compactFragmentIdentity";
import {MICROVOXEL_BASE_QUANTUM_METERS} from "../../voxel/adaptive";
import {HVP_COAST_MATERIAL_REGISTRY,HVP_COAST_REGISTRY_DIGEST,HVP_SOURCE_MIN_METERS} from "../../hvp/hvpCoastSource";
import {box,cell,exactShapes,type Box,type Span} from "../../voxel/structural/componentIndex/exactShapes";
import {cellsFromCompactSpans,checkedCompactSpans,compactTerrainOwnerDigest} from "../../voxel/structural/componentIndex/fragment";
import {combineMass,measureCompactMaterialSpans,preparePart,type CompactMass} from "../../voxel/structural/componentIndex/partFacts";
import type {StructuralColliderBoxMeters} from "../../voxel/structural/physicsTransition";
import {createStructuralMaterialTable} from "../../voxel/structural/model";
import type {StructuralOwnedReserve} from "../../voxel/structural/validation";
import type {HvpCell} from "../terrain/picking";
import {prepareHvpStructuralIngestOwnedSteps} from "../terrain/structuralIngest";
import {copyHvpCompactTerrainSource} from "./compactTerrainWire";
import {hvpPrincipalAxes} from "./principalAxes";
import {admitHvpTransferredRigidBodyOwnedSteps,type HvpRigidRecipe} from "./rigidRecipe";
import type {HvpTerrainFragmentRequest} from "./terrainFragment";

export interface HvpCompactNativeRecipe {
  readonly kind:"hvp-compact-native-v1";
  readonly mass:CompactMass;
  readonly axes:ReturnType<typeof hvpPrincipalAxes>;
  readonly colliders:readonly StructuralColliderBoxMeters[];
}
const issued=new WeakSet<object>();
const issuedOwners=new WeakSet<object>();
export type HvpCompactNativeOwner=ReturnType<typeof makeCompactOwner>;
export const isIssuedHvpCompactNativeOwner=(owner:object):owner is HvpCompactNativeOwner=>issuedOwners.has(owner);
export const isIssuedHvpCompactNativeRecipe=(recipe:object):recipe is HvpCompactNativeRecipe=>issued.has(recipe);

export interface HvpCompactRuntimeBinding {
  readonly sessionId:string;
  readonly epoch:number;
  readonly generation:number;
  readonly terrainDigest:string;
}

const q=MICROVOXEL_BASE_QUANTUM_METERS;
export const compactCoastMaterials=createStructuralMaterialTable(HVP_COAST_MATERIAL_REGISTRY.map(m=>Object.freeze({materialId:m.slot,
  densityKgPerCubicMeter:m.densityKgPerM3,structuralClass:m.role,destructible:true,tags:null})));
const meters=(p:HvpCell)=>Object.freeze({x:p[0]*q,y:p[1]*q,z:p[2]*q});
export const compactBoxesShareFace=(a:Box,b:Box)=> {
  let touched=0;
  for(let axis=0;axis<3;axis++) {
    if(a.max[axis]===b.min[axis] || b.max[axis]===a.min[axis]) touched++;
    else if(a.max[axis]<b.min[axis] || b.max[axis]<a.min[axis]) return false;
  }
  return touched===1;
};
function connected(boxes:readonly Box[]) {
  const seen=new Set([0]),queue=[0];
  for(let at=0;at<queue.length;at++) for(let i=0;i<boxes.length;i++) {
    if(!seen.has(i)&&compactBoxesShareFace(boxes[queue[at]!]!,boxes[i]!)) { seen.add(i);queue.push(i); }
  }
  return seen.size===boxes.length;
}
const sameBox=(a:Box|undefined,b:Box)=>a!==undefined && Array.isArray(a.min) && a.min.length===3
  && Array.isArray(a.max) && a.max.length===3 && [0,1,2].every(i=>a.min[i]===b.min[i]&&a.max[i]===b.max[i]);

/** Isolated native owner. Its immutable material spans are authoritative. Native shapes and an
 * optional Structural v1 archive are derived from that exact same captured membership. */
export function issueHvpCompactNativeOwner(request:HvpTerrainFragmentRequest,binding:HvpCompactRuntimeBinding,reserve:StructuralOwnedReserve) {
  const {sessionId,epoch,generation,terrainDigest}=binding;
  if (typeof sessionId!=="string" || !/^[A-Za-z0-9:._-]{1,128}$/.test(sessionId) || !Number.isSafeInteger(epoch) || epoch<0
    || !Number.isSafeInteger(generation) || generation<1 || !/^[0-9a-f]{8}$/.test(terrainDigest)) throw new Error("Invalid compact owner binding");
  if(!request.compactSource || request.compactSource.generation!==generation || !Array.isArray(request.cells) || request.cells.length
    || request.sourceRegion!==undefined || request.sourceSubset!==undefined
    || request.origin?.x!==HVP_SOURCE_MIN_METERS.x || request.origin.y!==HVP_SOURCE_MIN_METERS.y || request.origin.z!==HVP_SOURCE_MIN_METERS.z
    || !Number.isFinite(request.massKg) || request.massKg<=0 || !Array.isArray(request.colliderBoxes) || !request.colliderBoxes.length
    || request.colliderBoxes.length>64) throw new Error("Invalid compact native request");
  // This isolated profile qualifies bounded v1 archive materialization on demand. Larger sources
  // continue to use the caller's existing full admission until their archive budgets are qualified.
  const count=request.compactSource.cellCount;
  if(!Number.isSafeInteger(count)||count<1||count>1024) throw new Error("Compact archive profile exceeded");
  reserve(16384+count*1024,true);
  const wire=copyHvpCompactTerrainSource(request.compactSource);
  const checked=checkedCompactSpans(wire);
  const leafCount=new Set(wire.parts.map(p=>p.origin.join(":"))).size;
  if(leafCount>4 || checked.length>128) throw new Error("Compact archive profile exceeded");
  let total=0;
  for(const s of checked) {
    if(s.y<1 || s.y>=128) throw new Error("Invalid compact native material extent");
    total+=s.end-s.x;
  }
  if(total!==count) throw new Error("Invalid compact native declared count");
  const digest=compactTerrainOwnerDigest(checked);
  const ownerId=request.ownerId;
  if(!digest || ownerId!==`hvp:terrain-fragment:r${generation}:${digest}`) throw new Error("Compact native membership mismatch");
  const facts=wire.parts.map(part=>preparePart(part.origin,part.leafRevision,part.label,[...part.runs]));
  const min=cell(...([0,1,2].map(i=>Math.min(...facts.map(f=>f.bounds.min[i]!))) as [number,number,number]));
  const max=cell(...([0,1,2].map(i=>Math.max(...facts.map(f=>f.bounds.max[i]!))) as [number,number,number]));
  const shapes=exactShapes(checked,count,box(min,max));
  if(!shapes || shapes.length!==request.colliderBoxes.length || !shapes.every((b,i)=>sameBox(request.colliderBoxes[i]!,b))
    || !connected(shapes)) throw new Error("Invalid compact native collision coverage or connectivity");
  const mass=combineMass(facts);
  if(Math.abs(mass.totalMassKg-request.massKg)>Math.max(1,request.massKg)*1e-10) throw new Error("Invalid compact native mass");
  const identity=Object.freeze({kind:"hvp-compact-runtime-v1" as const,sessionId,epoch,generation,terrainDigest,ownerId,
    membershipDigest:compactRuntimeMembershipDigest(checked,count),registryDigest:HVP_COAST_REGISTRY_DIGEST});
  return makeCompactOwner(identity,checked,count,leafCount,box(min,max),mass,shapes);
}

type CompactIdentity=Readonly<HvpCompactRuntimeBinding & {kind:"hvp-compact-runtime-v1";ownerId:string;membershipDigest:string;registryDigest:string}>;
export function issueCompactMovingChild(parent:HvpCompactNativeOwner,removed:readonly Span[],kept:readonly Span[]){
  if(!isIssuedHvpCompactNativeOwner(parent))throw new Error("Missing authoritative moving parent");
  const identity=createHvpCompactChildIdentity({ownerId:parent.identity.ownerId,revision:0,sourceDigest:parent.identity.membershipDigest,spans:parent.materialRuns()},removed,kept);
  if(!identity)return;
  const f=measureCompactMaterialSpans(kept),shapes=exactShapes(kept,f.count,f.bounds);
  if(!shapes||!connected(shapes))throw new Error("Unverified moving child collision coverage");
  const leaves=new Set(kept.map(s=>[s.x>>4,s.y>>4,s.z>>4].join(",")));
  const child=makeCompactOwner(Object.freeze({...parent.identity,ownerId:identity.ownerId,membershipDigest:identity.sourceDigest}),
    kept,f.count,leaves.size,f.bounds,f.mass,shapes,recipe=>{bindHvpCompactChildArchive(recipe,identity.proof);});
  return {child,removedDigest:identity.removedDigest};
}
function makeCompactOwner(identity:CompactIdentity,checked:readonly Span[],count:number,leafCount:number,bounds:Box,mass:CompactMass,
  shapes:readonly Box[],bindArchive?:(archive:HvpRigidRecipe)=>void){
  const ownerId=identity.ownerId;
  const axes=hvpPrincipalAxes(mass.inertiaTensorKgMetersSquared);
  if(![mass.totalMassKg,...Object.values(axes.principalInertia)].every(v=>Number.isFinite(Math.fround(v))&&Math.fround(v)>0)) {
    throw new Error("Invalid compact native precision");
  }
  const recipe:HvpCompactNativeRecipe=Object.freeze({kind:"hvp-compact-native-v1",mass,axes,colliders:Object.freeze(
    shapes.map(b=>Object.freeze({minMeters:meters(b.min),maxMeters:meters(b.max)})))});
  // Duplicate owner IDs are rejected by the Worker. Exact membership is retained even if an
  // unrelated source in another session or revision happens to have the same FNV32 suffix.
  let spans:readonly Span[]|undefined=checked;
  let archive:HvpRigidRecipe|undefined;
  let pending:Promise<HvpRigidRecipe>|undefined;
  let disposed=false;

  function* archiveSteps(credit:StructuralOwnedReserve) {
    if(disposed) throw new Error("Compact owner disposed");
    credit(2048+count*256,true);
    const cells=cellsFromCompactSpans(spans!);
    const source=yield* prepareHvpStructuralIngestOwnedSteps(ownerId,cells,compactCoastMaterials,[],credit,undefined,true);
    const result=yield* admitHvpTransferredRigidBodyOwnedSteps(source,{massKg:mass.totalMassKg,colliderBoxes:shapes!},undefined,credit,true);
    if(disposed) throw new Error("Compact owner disposed");
    bindArchive?.(result);
    archive=result;
    return result;
  }
  async function buildArchive(credit:StructuralOwnedReserve,yieldTask:()=>Promise<void>):Promise<HvpRigidRecipe> {
    const task=archiveSteps(credit);
    try {
      let deadline=performance.now()+2;
      while(!disposed) {
        const next=task.next();
        if(next.done) return next.value;
        if(performance.now()>=deadline) {await yieldTask();deadline=performance.now()+2;}
      }
      throw new Error("Compact owner disposed");
    } finally { task.return(undefined as never); }
  }
  issued.add(recipe);
  const owner=Object.freeze({
    identity,recipe,cellCount:count,leafCount,bounds,
    materialRuns(){
      if(disposed)throw new Error("Compact owner disposed");
      return Object.freeze(spans!.map(s=>Object.freeze({...s})));
    },
    readMaterial(x:number,y:number,z:number) {
      if(disposed) throw new Error("Compact owner disposed");
      if(![x,y,z].every(Number.isSafeInteger)) throw new Error("Integer compact source coordinates required");
      const values=spans!;let low=0,high=values.length;
      while(low<high) {const mid=(low+high)>>>1,s=values[mid]!;
        if(s.z<z || s.z===z&&(s.y<y || s.y===y&&s.end<=x)) low=mid+1;else high=mid;
      }
      const s=values[low];
      return s&&s.y===y&&s.z===z&&s.x<=x&&x<s.end?s.material:0;
    },
    archiveReady:()=>archive!==undefined,
    peekArchive:()=>archive,
    ownsArchive:(candidate:HvpRigidRecipe)=>archive!==undefined&&archive===candidate,
    materializeV1Sync(credit:StructuralOwnedReserve):HvpRigidRecipe {
      if(disposed||pending) throw new Error("Compact owner disposed or archive in flight");
      if(archive) return archive;
      const steps=archiveSteps(credit);
      for(;;){const next=steps.next();if(next.done)return next.value;}
    },
    materializeV1(credit:StructuralOwnedReserve,yieldTask:()=>Promise<void>):Promise<HvpRigidRecipe> {
      if(disposed) return Promise.reject(new Error("Compact owner disposed"));
      if(archive) return Promise.resolve(archive);
      pending??=Promise.resolve().then(()=>buildArchive(credit,yieldTask)).finally(()=>{pending=undefined;});
      return pending;
    },
    dispose() {disposed=true;spans=undefined;archive=undefined;issued.delete(recipe);issuedOwners.delete(owner);}
  });
  issuedOwners.add(owner);return owner;
}
