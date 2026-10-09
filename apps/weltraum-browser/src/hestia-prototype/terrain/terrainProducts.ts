import { readHvpSourceColumnWorld,hvpSourceColumnTopMeters } from "../../hvp/hvpCoastSource";
import {fnv1aHash} from "../../core/hash";
import { WorkerPool, type WorkerJobTicket,type WorkerPoolEvent } from "../../workers/workerPool";
import { runHvpBounded,createHvpBodyMeshTaskPump } from "../../workers/hvpBoundedPump";
import { algorithmVersion, byteCount, contentRevision, jobDeadline, planningEpoch, workerEpoch, workerJobId, workerJobKind, workerTargetKey } from "../../workers/ids";
import { fnv1aBytes, type TransferableBufferBundle } from "../../workers/protocol";
import { HVP_TERRAIN_JOB, HVP_TERRAIN_MAX_OUTPUT, decodeHvpTerrainOutput,decodeHvpTerrainOutputSteps, executeHvpTerrainJob, hvpTerrainInputDigest } from "../../workers/hvpTerrainJob";
import { HVP_COLLISION_JOB, HVP_COLLISION_MAX_OUTPUT, decodeHvpCollisionOutput,decodeHvpCollisionOutputSteps } from "../../workers/hvpCollisionJob";
import {fnv1aBytesSteps} from "../../workers/hvpBodyCutWire";
import type { HvpCompactMesh } from "../../hvp/hvpCoastMesher";
import type { HvpCollisionSector,HvpCollisionSource } from "../physics/terrainColliders";
import type { HvpPreparedCut, HvpTerrainSnapshot } from "./cutPlan";
import {copyHvpOwnedTerrainLeaf,copyHvpOwnedTerrainSlotsSteps,readHvpPrivateCutSource,isHvpPrivateTerrainSource} from "./cutPlan";
import {HVP_OWNED_SLOT_COPY_SCRATCH_BYTES} from "./ownedSlotCopy";
import {HVP_SUPPORT_JOB,HVP_SUPPORT_MAX_OUTPUT,hvpSupportInputDigestSteps,decodeHvpSupportOutputSteps,type HvpSupportPayload} from "../../workers/hvpSupportJob";
import {createStructuralOwnerLedger} from "../../voxel/structural/model";
import {analyzeHvpTerrainSupport,analyzeHvpSupportSnapshotOwnedSteps,createHvpSupportTimingsCollector,bindHvpSupportPlan,releaseHvpOwnedSupportPlan,createHvpSupportPhaseCredits,bindHvpOwnedSupportCut,type HvpSupportPhaseCredits,type HvpSupportPlan,type HvpOwnedSupportWork} from "./supportPlan";
import type {HvpMovingCutPreparation,HvpBodyChildProjection} from "../physics/bodyCutSession";
import {buildHvpBodyMeshInput,buildHvpBodyMeshInputSteps,HVP_BODY_MESH_JOB,HVP_BODY_MESH_ALGORITHM,HVP_BODY_MESH_MAX_OUTPUT} from "../../workers/hvpBodyMeshJob";
import {createHvpBodyMeshPhaseReserve,type HvpBodyMeshBudget} from "../presentation/bodyMeshAdmission";
import {measureHvpCutAsync,type HvpCutTrace} from "../runtime/cutTrace";
import {HVP_BODY_CUT_JOB,HVP_BODY_CUT_ALGORITHM,HVP_BODY_CUT_MAX_OUTPUT,hvpBodyCutInputDigest,validateHvpBodyCutPayload,decodeHvpBodyCutOutput} from "../../workers/hvpBodyCutJob";
import {HVP_NEIGHBOR_JOB,HVP_NEIGHBOR_MAX_OUTPUT,hvpNeighborInputDigest,decodeHvpNeighborOutput,type HvpNeighborPayload} from "../../workers/hvpNeighborJob";
import {encodeHvpProjectionPacket} from "../runtime/projectionPacket";
import type {HvpNeighborProxies} from "../runtime/neighborProducts";
import {buildHvpChunkInputSteps,hvpChunkCoordinates,hvpDirtyChunks,hvpRestoreChunksSteps,type HvpChunkPayload} from "./terrainChunkInput";
import {HVP_CHUNK_JOB,HVP_CHUNK_MAX_OUTPUT,decodeHvpChunkOutput,decodeHvpChunkOutputSteps,hvpChunkInputDigestSteps} from "../../workers/hvpChunkJob";
import {composeHvpTerrainColumnSteps} from "./terrainChunkComposition";

interface HvpChunkStartupPopulation {
  primaryJobs:number;
  primaryEmptyBoth:number;
  eastJobs:number;
  eastEmptyBoth:number;
}
interface HvpChunkStartupObservation {
  readonly primarySource:HvpTerrainSnapshot;
  readonly population:HvpChunkStartupPopulation;
}

/** Two borrowed job IDs and fixed aggregates only; elapsed host intervals are not worker CPU. */
export const createHvpChunkPoolObservation=()=>{
  const rows=Array.from({length:2},()=>({id:undefined as WorkerJobTicket["jobId"]|undefined,stage:0,at:0}));
  let jobs=0,queuedMs=0,workerTransportMs=0,acceptanceMs=0,valid=true;
  return {
    observe(event:WorkerPoolEvent):void{
      if(!valid||!("jobId" in event)){return;}
      try{
        const now=performance.now();if(!Number.isFinite(now)||now<0){valid=false;return;}
        let row=rows.find(value=>value.id===event.jobId);
        if(event.type==="Queued"){
          if(row){valid=false;return;}row=rows.find(value=>value.id===undefined);
          if(!row){valid=false;return;}row.id=event.jobId;row.stage=1;row.at=now;return;
        }
        if(!row||now<row.at){valid=false;return;}
        const elapsed=now-row.at;
        if(event.type==="Dispatched"&&row.stage===1){queuedMs+=elapsed;row.stage=2;}
        else if(event.type==="OutputTransferred"&&row.stage===2){workerTransportMs+=elapsed;row.stage=3;}
        else if(event.type==="Completed"&&row.stage===3){acceptanceMs+=elapsed;jobs+=1;row.id=undefined;row.stage=0;}
        else{valid=false;return;}
        row.at=now;if(jobs>512||![queuedMs,workerTransportMs,acceptanceMs].every(Number.isFinite)){valid=false;}
      }catch{valid=false;}
    },
    read(expectedJobs:number){return Object.freeze({jobs,queuedMs,workerTransportMs,acceptanceMs,
      complete:valid&&Number.isSafeInteger(expectedJobs)&&expectedJobs>=0&&jobs===expectedJobs&&rows.every(row=>row.id===undefined)});}
  };
};
type HvpChunkPoolSummary=ReturnType<ReturnType<typeof createHvpChunkPoolObservation>["read"]>;

export interface HvpTerrainProducts {
  readonly render: ReadonlyMap<number, HvpCompactMesh>;
  readonly collision: ReadonlyMap<number, HvpCollisionSector>;
  readonly source: HvpTerrainSnapshot;
}
export interface HvpTerrainSeams {readonly primary:HvpTerrainProducts;readonly east:readonly HvpCollisionSector[];readonly finish?:()=>void;readonly discard?:()=>void}
const ownedProducts=new WeakMap<HvpTerrainProducts,{credits:HvpSupportPhaseCredits;release:(promote?:boolean)=>void}>();
const ownedChunkCollisions=new WeakMap<HvpTerrainProducts,ReadonlyMap<number,HvpCollisionSector>>();
const ownedChunkNeighbors=new WeakMap<HvpTerrainProducts,ReadonlyMap<number,HvpCollisionSector>>();
const ownedChunkBindings=new WeakMap<HvpTerrainProducts,{owner:object;source:HvpTerrainSnapshot;neighbor?:HvpTerrainSnapshot;worldId:string;current:()=>void}>();
declare const chunkPhysicsInputBrand:unique symbol;
export interface HvpChunkPhysicsInput {readonly [chunkPhysicsInputBrand]:true}
const chunkPhysicsInputs=new WeakMap<HvpChunkPhysicsInput,{products:HvpTerrainProducts;sources:readonly HvpCollisionSource[];current:()=>void;neighbor?:HvpTerrainSnapshot;worldId:string}>();
const collisionSourceValues=(s:HvpCollisionSource)=>[s.sizeX,s.sizeY,s.sizeZ,s.cellMeters,s.originMeters.x,s.originMeters.y,s.originMeters.z,s.readSlot,s.readHaloSlot,
  (s as Partial<HvpTerrainSnapshot>).sessionId,(s as Partial<HvpTerrainSnapshot>).epoch,(s as Partial<HvpTerrainSnapshot>).revision,
  (s as Partial<HvpTerrainSnapshot>).sourceDigest,(s as Partial<HvpTerrainSnapshot>).baseDigest];
/** An exact producer-owned initial tuple; mutable Source wrappers are checked on every resume. */
export const bindHvpChunkPhysicsInput=(owner:{read:()=>HvpTerrainSnapshot},products:HvpTerrainProducts,sources:readonly HvpCollisionSource[]):HvpChunkPhysicsInput=>{
  const binding=ownedChunkBindings.get(products);
  if(binding===undefined||binding.owner!==owner||!ownedProducts.has(products)||owner.read()!==binding.source||!Array.isArray(sources)||sources.length<1){throw new Error("Owned initial chunk binding required");}
  const source=owner.read(),primary=sources[0]!,east=binding.neighbor;
  const matches=(wrapper:HvpCollisionSource,s:HvpTerrainSnapshot)=>{const expected=collisionSourceValues(s);return collisionSourceValues(wrapper).every((v,i)=>i===8||Object.is(v,expected[i]));};
  if(!matches(primary,source)||(east&&(sources.length<2||!matches(sources[sources.length-1]!,east)||!ownedChunkNeighbors.has(products)))){throw new Error("Prepared chunk Source/halo mismatch");}
  const observed=sources.map(s=>({source:s,values:collisionSourceValues(s)}));
  const current=()=>{
    binding.current();
    if(ownedChunkBindings.get(products)!==binding||!ownedProducts.has(products)||owner.read()!==source||sources.length!==observed.length
      ||observed.some((entry,i)=>{const values=collisionSourceValues(entry.source);return sources[i]!==entry.source||entry.values.some((v,j)=>!Object.is(v,values[j]));})){throw new Error("Stale initial chunk tuple");}
  };
  current();const input=Object.freeze({}) as HvpChunkPhysicsInput;chunkPhysicsInputs.set(input,{products,sources,current,neighbor:east,worldId:binding.worldId});return input;
};
export const hvpChunkPhysicsInputCredits=(input:HvpChunkPhysicsInput):HvpSupportPhaseCredits=>{
  const bound=chunkPhysicsInputs.get(input);if(bound===undefined){throw new Error("Foreign initial chunk tuple");}bound.current();
  const credits=ownedProducts.get(bound.products)?.credits;if(credits===undefined){throw new Error("Initial chunk credits expired");}return credits;
};
export function* prepareHvpChunkPhysicsInputSteps(input:HvpChunkPhysicsInput,sources:readonly HvpCollisionSource[],reserve:import("../../voxel/structural/validation").StructuralOwnedReserve){
  const bound=chunkPhysicsInputs.get(input);if(bound===undefined||bound.sources!==sources){throw new Error("Foreign initial chunk tuple");}
  bound.current();const steps=copyHvpOwnedChunkCollisionSteps(bound.products,reserve);let primary:HvpCollisionSector[];
  for(;;){bound.current();const step=steps.next();if(step.done){primary=step.value;break;}yield step.value;}
  const east:HvpCollisionSector[]=[],neighbor=ownedChunkNeighbors.get(bound.products);
  if(bound.neighbor){
    if(neighbor===undefined||neighbor.size!==256){throw new Error("Incomplete initial neighbour coverage");}reserve(8192);
    for(let id=0;id<256;id+=1){const mesh=neighbor.get(id);if(mesh===undefined){throw new Error("Missing initial neighbour chunk");}
      const copy=copyChunkCollisionSteps(mesh,reserve);for(;;){bound.current();const step=copy.next();if(step.done){east.push(step.value);break;}yield step.value;}yield "chunkNeighborCoverage";
    }
  }
  bound.current();return {primary:primary!,east,worldId:bound.worldId,assertCurrent:bound.current};
}
const NativeFloat32Array=Float32Array,NativeUint32Array=Uint32Array;
function* copyChunkCollisionSteps(mesh:HvpCollisionSector,reserve:import("../../voxel/structural/validation").StructuralOwnedReserve):Generator<string,HvpCollisionSector,unknown>{
  reserve(320+mesh.vertices.byteLength+mesh.indices.byteLength);
  const vertices=new NativeFloat32Array(mesh.vertices.length),indices=new NativeUint32Array(mesh.indices.length);
  for(let i=0;i<vertices.length;i+=1024){vertices.set(mesh.vertices.subarray(i,i+1024),i);yield "chunkCollisionCopy";}
  for(let i=0;i<indices.length;i+=1024){indices.set(mesh.indices.subarray(i,i+1024),i);yield "chunkCollisionCopy";}
  return {vertices,indices};
}
/** Independent copies; neither the private cache nor mutable caller geometry becomes a Native receipt. */
export function* copyHvpOwnedChunkCollisionSteps(products:HvpTerrainProducts,reserve:import("../../voxel/structural/validation").StructuralOwnedReserve):Generator<string,HvpCollisionSector[],unknown>{
  const cache=ownedChunkCollisions.get(products);
  if(cache===undefined||!ownedProducts.has(products)){throw new Error("Live owned chunk products required");}
  reserve(8192);const sectors:HvpCollisionSector[]=[];
  for(let id=0;id<256;id+=1){
    if(ownedChunkCollisions.get(products)!==cache||!ownedProducts.has(products)){throw new Error("Chunk product lifetime expired");}
    const mesh=cache.get(id);if(mesh===undefined){throw new Error("Incomplete owned chunk collision coverage");}
    const steps=copyChunkCollisionSteps(mesh,reserve);
    for(;;){
      if(ownedChunkCollisions.get(products)!==cache||!ownedProducts.has(products)){throw new Error("Chunk product lifetime expired");}
      const step=steps.next();if(step.done){sectors.push(step.value);break;}yield step.value;
    }
    yield "chunkCollisionCoverage";
  }
  if(ownedChunkCollisions.get(products)!==cache||!ownedProducts.has(products)){throw new Error("Chunk product lifetime expired");}
  return sectors;
}
export const hvpTerrainProductPhaseCredits=(products:HvpTerrainProducts):HvpSupportPhaseCredits|undefined=>ownedProducts.get(products)?.credits;
const releaseProducts=(products:HvpTerrainProducts,promote:boolean):void=>{
  const own=ownedProducts.get(products);ownedProducts.delete(products);ownedChunkCollisions.delete(products);ownedChunkNeighbors.delete(products);ownedChunkBindings.delete(products);own?.credits.release();own?.release(promote);
};
export const releaseHvpOwnedTerrainProducts=(products:HvpTerrainProducts):void=>releaseProducts(products,true);
export const discardHvpOwnedTerrainProducts=(products:HvpTerrainProducts):void=>releaseProducts(products,false);
export const hvpDirtySectors = (plan: HvpPreparedCut, cells: number): number[] => {
  const ids=new Set<number>(), width=256/cells;
  for(const {cell:[x,,z]} of plan.changed) {
    for(const dx of [-1,0,1]) { for(const dz of [-1,0,1]) {
      if(x+dx>=0&&x+dx<256&&z+dz>=0&&z+dz<256) { ids.add(Math.floor((z+dz)/cells)*width+Math.floor((x+dx)/cells)); }
    } }
  }
  return [...ids].sort((a,b)=>a-b);
};
/** Compatible immutable base; only changed COW leaves and their halo need work. */
export const hvpRestoreSectors=(before:HvpTerrainSnapshot,after:HvpTerrainSnapshot,cells:32|64):number[]=>{
  if(before.baseDigest!==after.baseDigest||[before,after].some(s=>s.sizeX!==256||s.sizeY!==128||s.sizeZ!==256||s.cellMeters!==.125
    ||s.originMeters.x!==-16||s.originMeters.y!==-8||s.originMeters.z!==-16)){throw new Error("Compatible normative restore coverage required");}
  if(before.sourceDigest===after.sourceDigest){return [];}
  const ids=new Set<number>(),width=256/cells;
  for(let z=0;z<16;z+=1){for(let y=0;y<8;y+=1){for(let x=0;x<16;x+=1){
    if(before.leafRevision(x,y,z)===0&&after.leafRevision(x,y,z)===0){continue;}
    const a=before.copyLeaf(x,y,z),b=after.copyLeaf(x,y,z);
    if(a.every((n,i)=>n===b[i])){continue;}
    for(let sx=Math.floor(Math.max(0,x*16-1)/cells);sx<=Math.floor(Math.min(255,x*16+16)/cells);sx+=1){
      for(let sz=Math.floor(Math.max(0,z*16-1)/cells);sz<=Math.floor(Math.min(255,z*16+16)/cells);sz+=1){ids.add(sz*width+sx);}
    }
  }}}
  return [...ids].sort((a,b)=>a-b);
};
const jobInput = (source: HvpTerrainSnapshot, id: number, render: boolean, sequence: number,
  readNeighbor?:(x:number,y:number,z:number)=>number|undefined) => {
  const steps=jobInputSteps(source,id,render,sequence,readNeighbor);for(;;){const step=steps.next();if(step.done){return step.value;}}
};
function* jobInputSteps(source:HvpTerrainSnapshot,id:number,render:boolean,sequence:number,
  readNeighbor?:((x:number,y:number,z:number)=>number|undefined),reserve?:import("../../voxel/structural/validation").StructuralOwnedReserve,cacheAuthoredGhosts=false){
  if(source.sizeX!==256||source.sizeY!==128||source.sizeZ!==256) { throw new Error("Normative terrain dimensions required"); }
  const edge=render?64:32, width=256/edge, sx=id%width*edge, sz=Math.floor(id/width)*edge, halo=edge+2;
  if(!Number.isSafeInteger(id)||id<0||id>=width*width) { throw new Error("Invalid terrain sector"); }
  reserve?.(8192+halo*130*halo+(cacheAuthoredGhosts?16_384:0));const slots=new Uint8Array(halo*130*halo);let units=0;
  const ghostTops=cacheAuthoredGhosts&&render?new Map<number,number>():undefined;
  for(let z=-1;z<=edge;z+=1) { for(let y=-1;y<=128;y+=1) { for(let x=-1;x<=edge;x+=1) {
    if(y<0||y>=128) { continue; }
    let slot=source.readSlot(sx+x,y,sz+z);
    if(slot===undefined&&readNeighbor){slot=readNeighbor(sx+x,y,sz+z);}
    if(slot===undefined) {
      if(!render) { slot=0; }
      else {
        // Known authored join columns are only ghost context, never editable coverage.
        let top:number;
        if(ghostTops===undefined){top=readHvpSourceColumnWorld(source.originMeters.x+(sx+x+.5)*.125,source.originMeters.z+(sz+z+.5)*.125).topMeters;}
        else{
          const key=x+1+(z+1)*halo,cached=ghostTops.get(key);
          if(cached!==undefined){top=cached;}
          else{
            if(ghostTops.size>=131){throw new Error("Private terrain ghost column BudgetExceeded");}
            top=hvpSourceColumnTopMeters(source.originMeters.x+(sx+x+.5)*.125,source.originMeters.z+(sz+z+.5)*.125);ghostTops.set(key,top);
          }
        }
        slot=-8+(y+1)*.125<=top?1:0;
      }
    }
    slots[x+1+(y+1)*halo+(z+1)*halo*130]=render?slot:Number(slot!==0);
    if(reserve&&++units===1024){units=0;yield "terrainInputCopy";}
  } } }
  const buffers=[slots.buffer as ArrayBuffer];
  const bundle:TransferableBufferBundle={buffers,ownership:"SenderToWorker",revision:contentRevision(source.revision),byteLength:byteCount(slots.byteLength),
    views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
  const identity={sessionId:source.sessionId,epoch:source.epoch,sector:id,generation:source.revision,sourceDigest:source.sourceDigest};
  const collision={sizeX:edge,sizeY:128,sizeZ:edge,originMeters:{x:source.originMeters.x+sx*.125,y:source.originMeters.y,z:source.originMeters.z+sz*.125},outputRevision:contentRevision(source.revision)};
  const request={jobId:workerJobId(`hvp-products-${sequence}`),targetKey:workerTargetKey(`hvp-${render?"render":"collision"}-${id}`),
    jobKind:workerJobKind(render?HVP_TERRAIN_JOB:HVP_COLLISION_JOB),workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),
    inputRevision:contentRevision(source.revision),sourceInputDigest:reserve===undefined?render?hvpTerrainInputDigest(identity,buffers):fnv1aBytes(buffers)
      :render?terrainDigestFromHash(identity,yield* fnv1aBytesSteps(buffers)):yield* fnv1aBytesSteps(buffers),
    algorithmVersion:algorithmVersion(1),priority:"Urgent" as const,deadline:jobDeadline(sequence),estimatedInputBytes:byteCount(slots.byteLength),
    estimatedOutputBytes:byteCount(render?HVP_TERRAIN_MAX_OUTPUT:HVP_COLLISION_MAX_OUTPUT),payload:render?identity:collision};
  return {request,bundle,identity,collision};
}
const terrainDigestFromHash=(p:{sessionId:string;epoch:number;sector:number;generation:number;sourceDigest:string},hash:string)=>
  fnv1aHash(JSON.stringify([p.sessionId,p.epoch,p.sector,p.generation,p.sourceDigest,hash]));
function* chunkJobInputSteps(source:HvpTerrainSnapshot,id:number,sequence:number,worldId:string,neighbor:HvpTerrainSnapshot|undefined,
  renderNeighbor:HvpTerrainSnapshot|undefined,
  reserve:import("../../voxel/structural/validation").StructuralOwnedReserve):Generator<string,{kind:"chunk";request:import("../../workers/protocol").WorkerJobRequest;bundle:TransferableBufferBundle;payload:HvpChunkPayload},unknown>{
  if(neighbor!==undefined&&renderNeighbor!==neighbor){throw new Error("Unmatched physical chunk neighbour");}
  reserve(16_384);const tops=new Map<string,number>();
  const halo=(x:number,y:number,z:number):number|undefined=>{
    if(y<0||y>=128){return 0;}
    if(renderNeighbor&&renderNeighbor.originMeters.x===source.originMeters.x+32&&x>=256&&x<512&&z>=0&&z<256){return renderNeighbor.readSlot(x-256,y,z);}
    if(renderNeighbor&&renderNeighbor.originMeters.x===source.originMeters.x-32&&x<0&&x>=-256&&z>=0&&z<256){return renderNeighbor.readSlot(x+256,y,z);}
    const key=`${x}:${z}`;let top=tops.get(key);
    if(top===undefined){if(tops.size>=67){throw new Error("Chunk authored ghost BudgetExceeded");}
      top=hvpSourceColumnTopMeters(source.originMeters.x+(x+.5)*.125,source.originMeters.z+(z+.5)*.125);tops.set(key,top);}
    return source.originMeters.y+(y+1)*.125<=top?1:0;
  };
  const haloBinding=renderNeighbor?`render:${renderNeighbor.sessionId}:${renderNeighbor.epoch}:${renderNeighbor.revision}:${renderNeighbor.sourceDigest}:${renderNeighbor.baseDigest}:${renderNeighbor.originMeters.x}:${renderNeighbor.originMeters.y}:${renderNeighbor.originMeters.z}:authored-v5`:`closed-exterior:authored-v5`;
  const {slots,payload}=yield* buildHvpChunkInputSteps(source,id,halo,haloBinding,reserve,worldId,neighbor),buffers=[slots.buffer as ArrayBuffer];
  const bundle:TransferableBufferBundle={buffers,ownership:"SenderToWorker",revision:contentRevision(source.revision),byteLength:byteCount(slots.byteLength),
    views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
  const digest=yield* hvpChunkInputDigestSteps(payload,buffers);
  return {kind:"chunk",payload,bundle,request:{jobId:workerJobId(`hvp-products-${sequence}`),targetKey:workerTargetKey(`hvp-chunk-${id}`),jobKind:workerJobKind(HVP_CHUNK_JOB),
    workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(source.revision),sourceInputDigest:digest,algorithmVersion:algorithmVersion(1),
    priority:"Urgent",deadline:jobDeadline(sequence),estimatedInputBytes:bundle.byteLength,estimatedOutputBytes:byteCount(HVP_CHUNK_MAX_OUTPUT),payload}};
}

/** Initial load uses the exact same kernel as later dirty-sector worker jobs. */
export const meshInitialHvpTerrain = (source: HvpTerrainSnapshot,east?:HvpTerrainSnapshot): ReadonlyMap<number,HvpCompactMesh> => {
  if(east&&(east.originMeters.x!==16||east.originMeters.y!==-8||east.originMeters.z!==-16)){throw new Error("Invalid initial neighbour coverage");}
  const meshes=new Map<number,HvpCompactMesh>();
  for(let id=0;id<16;id+=1) {
    const job=jobInput(source,id,true,id,east?(x,y,z)=>x>=256?east.readSlot(x-256,y,z):undefined:undefined);
    meshes.set(id,decodeHvpTerrainOutput(executeHvpTerrainJob(job.request,job.bundle).bundle,job.identity));
  }
  return meshes;
};

/** At most two concurrent derived jobs; accepted edits remain in the source owner. */
export const copyHvpTerrainSlots=async(source:HvpTerrainSnapshot,cancelled:()=>boolean=()=>false,host?:import("../physics/bodyCutSession").HvpBodyPlanHost):Promise<Uint8Array>=>{
  if(source.sizeX!==256||source.sizeY!==128||source.sizeZ!==256){throw new Error("Unsupported terrain snapshot size");}
  if(cancelled()){throw new Error("Cancelled terrain snapshot");}
  const slots=new Uint8Array(8_388_608);
  const bulk=host===undefined?undefined:copyHvpOwnedTerrainSlotsSteps(source,slots);
  if(bulk!==undefined){let failed=false;
    try{for(;;){if(cancelled()){throw new Error("Cancelled terrain snapshot");}host!.assertCurrent();const step=bulk.next();
      if(step.done){break;}if(host!.continuePlan?.()!==true){await host!.yieldTask();}
    }}catch(error){failed=true;throw error;}
    finally{try{bulk.return(undefined as never);}catch(error){if(!failed){throw error;}}}
    if(cancelled()){throw new Error("Cancelled terrain snapshot");}host!.assertCurrent();return slots;
  }
  for(let lz=0;lz<16;lz+=1){
    if(cancelled()){throw new Error("Cancelled terrain snapshot");}
    for(let ly=0;ly<8;ly+=1){for(let lx=0;lx<16;lx+=1){const leaf=(host===undefined?undefined:copyHvpOwnedTerrainLeaf(source,lx,ly,lz))??source.copyLeaf(lx,ly,lz);
      if(leaf.length!==4096){throw new Error("Incomplete canonical leaf");}
      for(let z=0;z<16;z+=1){for(let y=0;y<16;y+=1){
        slots.set(leaf.subarray(y*16+z*256,y*16+z*256+16),lx*16+(ly*16+y)*256+(lz*16+z)*32768);
      }}
      if(host){host.assertCurrent();if(host.continuePlan?.()!==true){await host.yieldTask();}}
    }}
    if(host===undefined){await new Promise<void>(resolve=>setTimeout(resolve,0));}
  }
  if(cancelled()){throw new Error("Cancelled terrain snapshot");}return slots;
};

/** At most two concurrent derived jobs; accepted edits remain in the source owner. */
type HvpNeighborTimingPhase="primaryCopy"|"eastCopy"|"inputDigest"|"workerWait"|"decode";
export const createHvpTerrainCompiler = (observePoolStartup?:((start:number,duration:number)=>void),
  observeNeighbor?:((phase:HvpNeighborTimingPhase,start:number,duration:number)=>void)) => {
  const observeNeighborSync=<T>(phase:HvpNeighborTimingPhase,run:()=>T):T=>{
    if(observeNeighbor===undefined){return run();}
    const start=performance.now();
    try{return run();}finally{try{observeNeighbor(phase,start,performance.now()-start);}catch{/* Diagnostics have no authority. */}}
  };
  const observeNeighborAsync=<T>(phase:HvpNeighborTimingPhase,run:()=>Promise<T>):Promise<T>=>{
    if(observeNeighbor===undefined){return run();}
    const start=performance.now();
    return (async()=>{try{return await run();}finally{try{observeNeighbor(phase,start,performance.now()-start);}catch{/* Diagnostics have no authority. */}}})();
  };
  const count=Math.max(1,Math.min(2,(globalThis.navigator?.hardwareConcurrency??2)-1));
  let chunkPoolObservation:ReturnType<typeof createHvpChunkPoolObservation>|undefined;
  const createPool=()=>new WorkerPool({workerCount:count,queueCapacity:32,observe:event=>chunkPoolObservation?.observe(event)});
  let pool=createPool(),started:Promise<void>|undefined,sequence=0,disposed=false,rollingOver=false,rolloverFailed=false,activeOperations=0;
  let readyRoot:{read:()=>HvpTerrainSnapshot}|undefined;
  type ChunkCache={source:HvpTerrainSnapshot;worldId:string;neighbor?:HvpTerrainSnapshot;renderNeighbor?:HvpTerrainSnapshot;render:ReadonlyMap<number,HvpCompactMesh>;collision:ReadonlyMap<number,HvpCollisionSector>;
    neighborCollision?:ReadonlyMap<number,HvpCollisionSector>;neighborCollisionSource?:HvpTerrainSnapshot;bytes:number};
  let chunkCache:ChunkCache|undefined;
  const pendingChunks=new Map<HvpTerrainProducts,{cache:ChunkCache;bytes:number}>();
  const chunkMeshBytes=(m:HvpCompactMesh)=>m.positions.byteLength+m.normals.byteLength+(m.colors?.byteLength??0)+m.indices.byteLength+640+m.materialRanges.length*144;
  const chunkResident=(resident:number)=>resident+(chunkCache?.bytes??0);
  const startPool=()=>started??=(observePoolStartup===undefined?pool.start():(async()=>{
    const start=performance.now();
    try{await pool.start();}finally{try{observePoolStartup?.(start,performance.now()-start);}catch{/* Diagnostics have no authority. */}}
  })());
  let disposePromise:Promise<void>|undefined,idleResolve:(()=>void)|undefined;
  const retainedSupport=new Set<HvpSupportPlan>();
  const retainedProducts=new Set<HvpTerrainProducts>();
  let supportAnalyzing=false;
  const withOperation=async<T>(operation:()=>Promise<T>):Promise<T>=>{
    if(disposed||rolloverFailed){throw new Error("Terrain compiler disposed");}
    if(rollingOver){throw new Error("Terrain compiler rollover in progress");}
    activeOperations+=1;
    try{return await operation();}finally{activeOperations-=1;if(activeOperations===0){idleResolve?.();idleResolve=undefined;}}
  };
  const compileSectors=async(source:HvpTerrainSnapshot,renderIds:readonly number[],collisionIds:readonly number[],limit:number,
    readNeighbor?:(x:number,y:number,z:number)=>number|undefined,signal?:AbortSignal,parallel=count,credits?:HvpSupportPhaseCredits,
    observeInput?:((start:number,duration:number)=>void),chunks?:{ids:readonly number[];worldId:string;neighbor?:HvpTerrainSnapshot;renderNeighbor?:HvpTerrainSnapshot;assertCurrent:()=>void},startup?:HvpChunkStartupObservation):Promise<HvpTerrainProducts>=>{
    if(disposed||rolloverFailed){throw new Error("Terrain compiler disposed");}
    if(!Number.isInteger(parallel)||parallel<1||parallel>count){throw new Error("Invalid preparation concurrency");}
    const render=new Map<number,HvpCompactMesh>(),collision=new Map<number,HvpCollisionSector>();
    const work:Array<{id:number;render:boolean;chunk?:boolean}>=chunks===undefined?
      [...renderIds.map(id=>({id,render:true})),...collisionIds.map(id=>({id,render:false}))]:chunks.ids.map(id=>({id,render:true,chunk:true}));
    if(work.length>limit||new Set(renderIds).size!==renderIds.length||new Set(collisionIds).size!==collisionIds.length){throw new Error("Terrain derivative BudgetExceeded");}
    if(chunks&&(new Set(chunks.ids).size!==chunks.ids.length||credits===undefined)){throw new Error("Owned unique chunk phase credits required");}
    if(work.length!==0){await startPool();}
    const active=new Set<WorkerJobTicket>();
    const results=await runHvpBounded(work,parallel,async part=>{
      if(disposed){throw new Error("Terrain compiler disposed");}
      if(signal?.aborted){throw new Error("Cancelled neighbour products");}
      const lane=credits?.beginLane(parallel);let retainedBytes=0,failed=false;
      const pump=lane===undefined?undefined:createHvpBodyMeshTaskPump(()=>{if(disposed||signal?.aborted){throw new Error(disposed?"Terrain compiler disposed":"Cancelled neighbour products");}chunks?.assertCurrent();});
      try{
      const cacheGhosts=part.render&&pump!==undefined&&readyRoot!==undefined&&isHvpPrivateTerrainSource(readyRoot,source)&&readyRoot.read()===source;
      const inputBytes=part.chunk?34**3:(part.render?66:34)*130*(part.render?66:34),packBytes=(part.chunk?65_536:32_768)+inputBytes*2+(cacheGhosts?16_384:0);
      const packReserve=lane===undefined?undefined:createHvpBodyMeshPhaseReserve(packBytes);
      const workerBytes=lane===undefined?undefined:lane.bytes-packBytes;
      if(workerBytes!==undefined&&workerBytes<=0){throw new Error("Terrain derivative phase budget exhausted");}
      const resultReserve=workerBytes===undefined?undefined:createHvpBodyMeshPhaseReserve(workerBytes);
      const inputStart=observeInput===undefined?0:performance.now();
      const job=part.chunk?await pump!.run(chunkJobInputSteps(source,part.id,sequence++,chunks!.worldId,chunks!.neighbor,chunks!.renderNeighbor,packReserve!)):
        {kind:"sector" as const,...(pump===undefined?jobInput(source,part.id,part.render,sequence++,readNeighbor):await pump.run(jobInputSteps(source,part.id,part.render,sequence++,readNeighbor,packReserve,cacheGhosts)))};
      if(observeInput!==undefined){try{observeInput(inputStart,performance.now()-inputStart);}catch{/* Diagnostics cannot invalidate products. */}}
      const ticket=pump===undefined?pool.enqueue(job.request,job.bundle):await pool.enqueueTerrainDerivative(job.request,job.bundle,workerBytes!,pump.host,packReserve!,resultReserve!);
      active.add(ticket);
      const cancel=()=>{try{ticket.cancel();}catch{/* Still await the real terminal or worker termination. */}};
      signal?.addEventListener("abort",cancel,{once:true});
      try{
        const terminal=await ticket.result;
        if(terminal.kind!=="Completed"||!pool.isAcceptedCompletedTerminal(terminal)||disposed){throw new Error(`Terrain prepare ${terminal.kind}`);}
        if(signal?.aborted){throw new Error("Cancelled neighbour products");}
        chunks?.assertCurrent();
        let product:{id:number;render:true;mesh:HvpCompactMesh;collision?:HvpCollisionSector}|{id:number;render:false;mesh:HvpCollisionSector};
        if(job.kind==="chunk"){
          const pair=pump===undefined?decodeHvpChunkOutput(terminal.output,job.payload):await pump.run(decodeHvpChunkOutputSteps(terminal.output,job.payload,resultReserve!));
          if(startup){
            const primary=source===startup.primarySource;
            startup.population[primary?"primaryJobs":"eastJobs"]+=1;
            if(pair.render.indices.length===0&&pair.collision.indices.length===0){startup.population[primary?"primaryEmptyBoth":"eastEmptyBoth"]+=1;}
          }
          product={id:part.id,render:true,mesh:pair.render,collision:pair.collision};
        }else{product=part.render?{id:part.id,render:true as const,mesh:pump===undefined?decodeHvpTerrainOutput(terminal.output,job.identity)
          :await pump.run(decodeHvpTerrainOutputSteps(terminal.output,job.identity,resultReserve!))}
          :{id:part.id,render:false as const,mesh:pump===undefined?decodeHvpCollisionOutput(terminal.output,job.collision)
            :await pump.run(decodeHvpCollisionOutputSteps(terminal.output,job.collision,resultReserve!))};}
        retainedBytes=product.render?product.mesh.positions.byteLength+product.mesh.normals.byteLength+product.mesh.colors!.byteLength
          +product.mesh.indices.byteLength+320+144*product.mesh.materialRanges.length:product.mesh.vertices.byteLength+product.mesh.indices.byteLength+320;
        if(product.render&&product.collision){retainedBytes+=product.collision.vertices.byteLength+product.collision.indices.byteLength+320;}
        // Yield a real event-loop turn per finished job, without waiting for its sibling.
        await new Promise<void>(resolve=>setTimeout(resolve,0));
        if(disposed){throw new Error("Terrain compiler disposed");}
        if(signal?.aborted){throw new Error("Cancelled neighbour products");}
        return product;
      }finally{signal?.removeEventListener("abort",cancel);active.delete(ticket);}
      }catch(error){failed=true;throw error;}
      finally{pump?.dispose();if(lane){try{credits!.endLane(lane,retainedBytes);}catch(error){if(!failed){throw error;}}}}
    },()=>{
      for(const ticket of active){try{ticket.cancel();}catch{/* A failed cancellation must not skip other tickets. */}}
    });
    for(const product of results){
      if(product.render){render.set(product.id,product.mesh);if(product.collision){collision.set(product.id,product.collision);}}else{collision.set(product.id,product.mesh);}
    }
    return {render,collision,source};
  };
  const compileChunks=async(source:HvpTerrainSnapshot,ids:readonly number[],worldId:string,neighbor:HvpTerrainSnapshot|undefined,
    credits:HvpSupportPhaseCredits,before:ChunkCache|undefined,current:()=>void,observeInput?:((start:number,duration:number)=>void),completeCollision=false,renderNeighbor=neighbor,startup?:HvpChunkStartupObservation)=>{
    current();const raw=await compileSectors(source,[],[],256,undefined,undefined,count,credits,observeInput,{ids,worldId,neighbor,renderNeighbor,assertCurrent:current},startup);
    const neighborIds=neighbor&&completeCollision?(before?.neighbor===neighbor&&before.neighborCollision!==undefined
      ?before.neighborCollisionSource===source?[]:Array.from({length:32},(_,i)=>i*8):Array.from({length:256},(_,i)=>i)):[];
    const neighborRaw=neighborIds.length===0?undefined:await compileSectors(neighbor!,[],[],256,undefined,undefined,count,credits,observeInput,
      {ids:neighborIds,worldId,neighbor:source,renderNeighbor:source,assertCurrent:current},startup);
    const lane=credits.beginLane(1),reserve=createHvpBodyMeshPhaseReserve(lane.bytes);
    const pump=createHvpBodyMeshTaskPump(current);
    let retained=0,failed=false,produced:{products:HvpTerrainProducts;cache:ChunkCache;bytes:number}|undefined;
    try{
      reserve(65_536);const next=new Map(before?.render??[]);
      for(const [id,mesh]of raw.render){next.set(id,mesh);}
      if(next.size!==256||Array.from({length:256},(_,id)=>id).some(id=>!next.has(id))){throw new Error("Incomplete chunk cache coverage");}
      const nextCollision=new Map(before?.collision??[]);let copiedCollisionBytes=0;
      for(const [id,mesh]of raw.collision){const copy=await pump.run(copyChunkCollisionSteps(mesh,reserve));nextCollision.set(id,copy);copiedCollisionBytes+=copy.vertices.byteLength+copy.indices.byteLength+320;}
      if(nextCollision.size!==256||Array.from({length:256},(_,id)=>id).some(id=>!nextCollision.has(id))){throw new Error("Incomplete chunk collision cache coverage");}
      const neighborCollision=neighbor===undefined?undefined:new Map(before?.neighbor===neighbor?before.neighborCollision:undefined);
      for(const [id,mesh]of neighborRaw?.collision??[]){const copy=await pump.run(copyChunkCollisionSteps(mesh,reserve));neighborCollision!.set(id,copy);copiedCollisionBytes+=copy.vertices.byteLength+copy.indices.byteLength+320;}
      if(neighbor&&completeCollision&&(neighborCollision?.size!==256||Array.from({length:256},(_,id)=>id).some(id=>!neighborCollision.has(id)))){throw new Error("Incomplete chunk neighbour coverage");}
      retained+=copiedCollisionBytes;
      const columns=[...new Set(ids.map(id=>{const c=hvpChunkCoordinates(id);return Math.floor(c[0]/2)+Math.floor(c[2]/2)*4;}))].sort((a,b)=>a-b);
      const render=new Map<number,HvpCompactMesh>();
      for(const id of columns){const mesh=await pump.run(composeHvpTerrainColumnSteps(next,source,id,reserve));render.set(id,mesh);retained+=chunkMeshBytes(mesh);}
      const cache:ChunkCache={source,worldId,neighbor,renderNeighbor,render:next,collision:nextCollision,neighborCollision,neighborCollisionSource:completeCollision?source:before?.neighborCollisionSource,
        bytes:32_768+[...next.values()].reduce((n,m)=>n+chunkMeshBytes(m),0)
        +[...nextCollision.values(),...(neighborCollision?.values()??[])].reduce((n,m)=>n+m.vertices.byteLength+m.indices.byteLength+320,0)
        +(renderNeighbor!==undefined&&neighbor===undefined?8_388_608+renderNeighbor.overlayBytes*2:0)};
      const products:HvpTerrainProducts={source,render,collision:raw.collision};
      current();produced={products,cache,bytes:32_768+[...raw.render.values()].reduce((n,m)=>n+chunkMeshBytes(m),0)
        +[...render.values()].reduce((n,m)=>n+chunkMeshBytes(m),0)+[...raw.collision.values()].reduce((n,m)=>n+m.vertices.byteLength+m.indices.byteLength+320,0)+copiedCollisionBytes};
    }catch(error){failed=true;throw error;}
    finally{pump.dispose();try{credits.endLane(lane,retained);}catch(error){if(!failed){throw error;}}}
    pendingChunks.set(produced!.products,{cache:produced!.cache,bytes:produced!.bytes});ownedChunkCollisions.set(produced!.products,produced!.cache.collision);
    ownedChunkBindings.set(produced!.products,{owner:readyRoot!,source,neighbor,worldId,current});
    if(completeCollision&&neighbor){ownedChunkNeighbors.set(produced!.products,produced!.cache.neighborCollision!);}return produced!.products;
  };
  const releaseChunkCandidate=(products:HvpTerrainProducts,promote=true):void=>{
    const pending=pendingChunks.get(products);pendingChunks.delete(products);
    if(promote&&pending&&!disposed&&readyRoot?.read()===pending.cache.source){chunkCache=pending.cache;}
  };
  const rolloverAfterLoad=async(ownerStillLive:()=>boolean,keepChunks=true):Promise<void>=>{
    if(disposed||rolloverFailed){throw new Error("Terrain compiler disposed");}
    if(rollingOver||activeOperations!==0||!ownerStillLive()){
      rolloverFailed=true;
      throw new Error("Terrain compiler rollover requires a live, quiescent owner");
    }
    rollingOver=true;
    const retiring=pool;
    try{
      await retiring.shutdown();
      if(disposed||rolloverFailed||!ownerStillLive()){throw new Error("Terrain compiler owner changed during rollover");}
      const retired=retiring.snapshot();
      if(retired.state!=="Stopped"||retired.activeWorkers!==0||retired.runningJobs!==0||retired.queue.size!==0||retired.workers.length!==0){
        throw new Error("Terrain worker pool retirement unproven");
      }
      pool=createPool();started=undefined;
      await startPool();
      if(disposed||rolloverFailed||!ownerStillLive()){throw new Error("Terrain compiler owner changed during pool preparation");}
      if(!keepChunks){chunkCache=undefined;}
    }catch(error){rolloverFailed=true;throw error;}
    finally{rollingOver=false;}
  };
  return {
    diagnostics:()=>{const state=pool.snapshot();return {runningJobs:state.runningJobs,queue:state.queue.size,workers:state.workers.filter(w=>w.state!=="Stopped").length,state:state.state,
      chunkCacheBytes:chunkCache?.bytes??0,pendingChunkBytes:[...pendingChunks.values()].reduce((n,p)=>n+p.bytes,0)};},
    prepare(ownerStillLive:()=>boolean=()=>true,rootBinding?:{read:()=>HvpTerrainSnapshot}):Promise<void>{
      return withOperation(async()=>{
        if((chunkCache!==undefined||pendingChunks.size!==0)&&rootBinding!==readyRoot){throw new Error("Active chunk root binding cannot change");}
        const source=rootBinding?.read();
        if(!ownerStillLive()){throw new Error("Terrain compiler owner changed before pool preparation");}
        await startPool();
        if(disposed||rolloverFailed||!ownerStillLive()||(rootBinding!==undefined&&rootBinding.read()!==source)){throw new Error("Terrain compiler owner changed during pool preparation");}
        readyRoot=rootBinding;
      });
    },
    rolloverAfterLoad,
    async initialChunks(source:HvpTerrainSnapshot,east:HvpTerrainSnapshot|undefined,residentBytes:number,worldId:string,
      observeInput?:((start:number,duration:number)=>void),observePopulation?:((population:Readonly<HvpChunkStartupPopulation>)=>void),
      observePool?:((summary:HvpChunkPoolSummary)=>void)):Promise<HvpTerrainProducts>{
      return withOperation(async()=>{
        if(readyRoot===undefined||readyRoot.read()!==source||!isHvpPrivateTerrainSource(readyRoot,source)){throw new Error("Initial chunk owned source binding required");}
        if(activeOperations!==1||retainedSupport.size!==0||retainedProducts.size!==0||chunkCache!==undefined||pendingChunks.size!==0){throw new Error("Initial chunk lifetime pending");}
        if(east&&east.originMeters.x!==source.originMeters.x+32){throw new Error("Invalid initial chunk neighbour coverage");}
        const ledger=createStructuralOwnerLedger(residentBytes,96*1024*1024,128),credits=createHvpSupportPhaseCredits(32_768,residentBytes);
        ledger.reserve(96*1024*1024);let handedOff=false,products:HvpTerrainProducts|undefined;
        const startup=observePopulation?{primarySource:source,population:{primaryJobs:0,primaryEmptyBoth:0,eastJobs:0,eastEmptyBoth:0}}:undefined;
        const observation=observePool?createHvpChunkPoolObservation():undefined;chunkPoolObservation=observation;
        try{
          const binding=readyRoot,current=()=>{if(disposed||readyRoot!==binding||binding.read()!==source){throw new Error("Initial chunk source changed");}};
          products=await compileChunks(source,Array.from({length:256},(_,i)=>i),worldId,east,credits,undefined,current,observeInput,true,east,startup);
          if(disposed||readyRoot.read()!==source){throw new Error("Initial chunk source changed");}
          const accepted=products;ownedProducts.set(accepted,{credits,release:promote=>{releaseChunkCandidate(accepted,promote);retainedProducts.delete(accepted);ledger.release();}});
          retainedProducts.add(products);handedOff=true;
          if(startup){try{observePopulation?.(Object.freeze({...startup.population}));}catch{/* Diagnostics cannot invalidate admitted products. */}}
          return products;
        }finally{
          chunkPoolObservation=undefined;
          if(observation){try{observePool?.(observation.read(east?512:256));}catch{/* Diagnostics have no authority. */}}
          if(!handedOff){if(products){pendingChunks.delete(products);}credits.release();ledger.release();}
        }
      });
    },
    async initial(source:HvpTerrainSnapshot,east:HvpTerrainSnapshot|undefined,residentBytes:number,
      observeInput?:((start:number,duration:number)=>void)):Promise<HvpTerrainProducts>{
      if(east&&(east.originMeters.x!==16||east.originMeters.y!==-8||east.originMeters.z!==-16)){throw new Error("Invalid initial neighbour coverage");}
      return withOperation(async()=>{
        if(activeOperations!==1||retainedSupport.size!==0||retainedProducts.size!==0){throw new Error("Initial terrain resource lifetime pending");}
        const ledger=createStructuralOwnerLedger(residentBytes,96*1024*1024,128),credits=createHvpSupportPhaseCredits(32_768,residentBytes);
        ledger.reserve(96*1024*1024);let handedOff=false;
        try{
          const products=await compileSectors(source,Array.from({length:16},(_,id)=>id),[],16,
            east?(x,y,z)=>x>=256?east.readSlot(x-256,y,z):undefined:undefined,undefined,count,credits,observeInput);
          ownedProducts.set(products,{credits,release:()=>{retainedProducts.delete(products);ledger.release();}});
          retainedProducts.add(products);handedOff=true;return products;
        }finally{if(!handedOff){credits.release();ledger.release();}}
      });
    },
    releaseDisposedSupportResources():void{
      if(!disposed||activeOperations!==0){throw new Error("Support producer has not drained");}
      for(const plan of [...retainedSupport]){releaseHvpOwnedSupportPlan(plan);}
      for(const products of [...retainedProducts]){releaseHvpOwnedTerrainProducts(products);}
    },
    async neighborSeams(primary:HvpTerrainSnapshot,east?:HvpTerrainSnapshot,signal?:AbortSignal,serial=false,renderOnly=false,residentBytes=0):Promise<HvpTerrainSeams>{
      return withOperation(async()=>{
        if(chunkCache!==undefined){
          const cache=chunkCache,binding=readyRoot;
          if(cache.source!==primary||binding?.read()!==primary||!isHvpPrivateTerrainSource(binding,primary)){throw new Error("Owned neighbour chunk lineage required");}
          if(east&&(east.originMeters.x!==primary.originMeters.x+32||east.originMeters.y!==primary.originMeters.y||east.originMeters.z!==primary.originMeters.z)){throw new Error("Invalid east chunk coverage");}
          if(activeOperations!==1||retainedProducts.size!==0||retainedSupport.size!==0||pendingChunks.size!==0){throw new Error("Neighbour chunk lifetime pending");}
          const current=()=>{if(disposed||signal?.aborted||readyRoot!==binding||binding.read()!==primary||chunkCache!==cache){throw new Error("Cancelled stale neighbour chunks");}};
          const resident=chunkResident(residentBytes),ledger=createStructuralOwnerLedger(resident,96*1024*1024,128),credits=createHvpSupportPhaseCredits(32_768,resident);
          ledger.reserve(96*1024*1024);let products:HvpTerrainProducts|undefined,handedOff=false;
          try{
            products=await compileChunks(primary,Array.from({length:32},(_,i)=>i*8+7),cache.worldId,renderOnly?cache.neighbor:east,credits,cache,current,undefined,!renderOnly,east);
            current();const accepted=products;ownedProducts.set(accepted,{credits,release:promote=>{releaseChunkCandidate(accepted,promote);retainedProducts.delete(accepted);ledger.release();}});
            retainedProducts.add(accepted);
            const neighbor=ownedChunkNeighbors.get(accepted),copyLane=credits.beginLane(1),pump=createHvpBodyMeshTaskPump(current),reserve=createHvpBodyMeshPhaseReserve(copyLane.bytes);
            const meshes:HvpCollisionSector[]=[];let bytes=0;
            try{if(east&&!renderOnly){for(let id=0;id<256;id+=1){const mesh=neighbor?.get(id);if(mesh===undefined){throw new Error("Incomplete neighbour collision products");}
              const copy=await pump.run(copyChunkCollisionSteps(mesh,reserve));meshes.push(copy);bytes+=copy.vertices.byteLength+copy.indices.byteLength+320;}}}
            finally{pump.dispose();credits.endLane(copyLane,bytes);}
            handedOff=true;return {primary:renderOnly?{...accepted,collision:new Map()}:accepted,east:meshes,
              finish:()=>releaseHvpOwnedTerrainProducts(accepted),discard:()=>discardHvpOwnedTerrainProducts(accepted)};
          }finally{if(!handedOff){if(products){discardHvpOwnedTerrainProducts(products);pendingChunks.delete(products);}credits.release();ledger.release();}}
        }
        const a=await compileSectors(primary,[3,7,11,15],renderOnly?[]:[7,15,23,31,39,47,55,63],12,
          east?(x,y,z)=>x>=256?east.readSlot(x-256,y,z):undefined:undefined,signal,serial?1:count);
        const b=east&&!renderOnly?await compileSectors(east,[],Array.from({length:64},(_,i)=>i),64,
          (x,y,z)=>x<0?primary.readSlot(x+256,y,z):undefined,signal,serial?1:count):undefined;
        return {primary:a,east:b?[...b.collision].sort(([a],[b])=>a-b).map(([,mesh])=>mesh):[]};
      });
    },
    async neighborProjection(primary:HvpTerrainSnapshot,east:HvpTerrainSnapshot,lod:.125|.5,epoch:number,key:string,proxies:HvpNeighborProxies,signal?:AbortSignal){
      return withOperation(async()=>{
        if(signal?.aborted){throw new Error("Cancelled neighbour projection");}
        const cancelled=()=>disposed||signal?.aborted===true;
        const buffers=[(await observeNeighborAsync("primaryCopy",()=>copyHvpTerrainSlots(primary,cancelled))).buffer as ArrayBuffer,
          (await observeNeighborAsync("eastCopy",()=>copyHvpTerrainSlots(east,cancelled))).buffer as ArrayBuffer,encodeHvpProjectionPacket([proxies.join,proxies.far,proxies.water])];
        const payload:HvpNeighborPayload={epoch,primaryRevision:primary.revision,eastRevision:east.revision,primaryDigest:primary.sourceDigest,eastDigest:east.sourceDigest,lod,key};
        const bundle:TransferableBufferBundle={ownership:"SenderToWorker",revision:contentRevision(east.revision),buffers,
          byteLength:byteCount(buffers.reduce((n,b)=>n+b.byteLength,0)),views:buffers.map((b,i)=>({name:["primary","east","proxies"][i]!,kind:"Uint8Array",bufferIndex:i,byteOffset:0,elementCount:b.byteLength}))};
        await startPool();if(disposed||signal?.aborted){throw new Error("Cancelled neighbour preparation");}
        const job=sequence++,ticket=pool.enqueue({jobId:workerJobId(`hvp-neighbor-${job}`),targetKey:workerTargetKey("hvp-east-projection"),jobKind:workerJobKind(HVP_NEIGHBOR_JOB),
          workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(east.revision),sourceInputDigest:observeNeighborSync("inputDigest",()=>hvpNeighborInputDigest(payload,buffers)),
          algorithmVersion:algorithmVersion(1),priority:"Normal",deadline:jobDeadline(job),estimatedInputBytes:bundle.byteLength,estimatedOutputBytes:byteCount(HVP_NEIGHBOR_MAX_OUTPUT),payload},bundle);
        const cancel=()=>ticket.cancel();signal?.addEventListener("abort",cancel,{once:true});
        const terminal=await observeNeighborAsync("workerWait",()=>ticket.result.finally(()=>signal?.removeEventListener("abort",cancel)));
        if(terminal.kind!=="Completed"||!pool.isAcceptedCompletedTerminal(terminal)||disposed||signal?.aborted){throw new Error(`Neighbour preparation ${terminal.kind}`);}
        return {products:observeNeighborSync("decode",()=>decodeHvpNeighborOutput(terminal.output,payload)),buffer:terminal.output.buffers[0]!,payload};
      });
    },
    async compileBody(preparation:HvpMovingCutPreparation){
      return withOperation(async()=>{
        const p=validateHvpBodyCutPayload(preparation.payload);
        if(preparation.cells.length!==p.cellCount){throw new Error("Body source count mismatch");}
        const cells=new Int32Array(p.cellCount*4);
        for(const [i,c] of preparation.cells.entries()){
          if(![c.x,c.y,c.z,c.materialId].every(n=>Number.isSafeInteger(n)&&Math.abs(n)<=1_000_000)){throw new Error("Invalid local body source");}
          cells.set([c.x,c.y,c.z,c.materialId],i*4);
        }
        const buffers=[cells.buffer as ArrayBuffer],bundle:TransferableBufferBundle={buffers,ownership:"SenderToWorker",revision:contentRevision(p.revision),
          byteLength:byteCount(cells.byteLength),views:[{name:"cells",kind:"Int32Array",bufferIndex:0,byteOffset:0,elementCount:cells.length}]};
        await startPool();
        const terminal=await pool.enqueue({jobId:workerJobId(`hvp-body-${sequence++}`),targetKey:workerTargetKey(p.ownerId),jobKind:workerJobKind(HVP_BODY_CUT_JOB),
          workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(p.revision),sourceInputDigest:hvpBodyCutInputDigest(p,buffers),
          algorithmVersion:algorithmVersion(HVP_BODY_CUT_ALGORITHM),priority:"Urgent",deadline:jobDeadline(sequence),estimatedInputBytes:bundle.byteLength,
          estimatedOutputBytes:byteCount(HVP_BODY_CUT_MAX_OUTPUT),payload:p},bundle).result;
        if(disposed||terminal.kind!=="Completed"||!pool.isAcceptedCompletedTerminal(terminal)){throw new Error(`Body prepare ${terminal.kind}`);}
        return decodeHvpBodyCutOutput(terminal.output,p);
      });
    },
    async compileBodyMesh(projection:HvpBodyChildProjection,budget?:HvpBodyMeshBudget,trace?:HvpCutTrace){
      return withOperation(async()=>{
        const current=()=>{if(disposed||rolloverFailed){throw new Error("Body mesh compiler disposed");}};
        const pump=budget===undefined?undefined:createHvpBodyMeshTaskPump(current,trace===undefined?undefined:(_label,start,duration)=>{
          trace({commandId:projection.commandId,thread:"main",phase:"cutBodyPrepareWorkMs",origin:performance.timeOrigin,start,duration});
        });
        try{
        const packed=pump===undefined?buildHvpBodyMeshInput(projection)
          :await pump.run(buildHvpBodyMeshInputSteps(projection,createHvpBodyMeshPhaseReserve(budget!.packBytes)));
        await startPool();
        if(disposed){throw new Error("Terrain compiler disposed");}
        const request={jobId:workerJobId(`hvp-body-mesh-${sequence++}`),targetKey:workerTargetKey(packed.payload.ownerId),
          jobKind:workerJobKind(HVP_BODY_MESH_JOB),workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),
          inputRevision:contentRevision(packed.payload.revision),sourceInputDigest:packed.sourceInputDigest,
          algorithmVersion:algorithmVersion(HVP_BODY_MESH_ALGORITHM),priority:"Urgent" as const,deadline:jobDeadline(sequence),
          estimatedInputBytes:packed.input.byteLength,estimatedOutputBytes:byteCount(HVP_BODY_MESH_MAX_OUTPUT),payload:packed.payload};
        const ticket=pump===undefined?pool.enqueue(request,packed.input)
          :await pool.enqueueBodyMesh(request,packed.input,budget!.workerBytes,pump.host,createHvpBodyMeshPhaseReserve(budget!.packBytes));
        const terminal=await ticket.result;
        if(disposed||terminal.kind!=="Completed"||!pool.isAcceptedCompletedTerminal(terminal)){throw new Error(`Body mesh prepare ${terminal.kind}`);}
        // Preserve exclusive raw buffers for native-owner admission before any consumer decoding/staging.
        return {request:{...request,workerEpoch:terminal.result.workerEpoch},output:terminal.output};
        }finally{pump?.dispose();}
      });
    },
    async analyze(plan:HvpPreparedCut,residentBytesValue?:number,trace?:HvpCutTrace):Promise<HvpSupportPlan>{
      return withOperation(async()=>{
        if(supportAnalyzing||retainedSupport.size!==0||retainedProducts.size!==0){throw new Error("Support resource lifetime pending");}supportAnalyzing=true;
        try{
        if(plan.changed.length===0){return analyzeHvpTerrainSupport(plan);}
        const s=plan.after,total=s.sizeX*s.sizeY*s.sizeZ;
        const measure=<T>(phase:string,run:()=>Promise<T>)=>measureHvpCutAsync(trace,plan.request.commandId,"main",phase,run);
        if(!Number.isSafeInteger(total)||total<1||total>8_388_608){throw new Error("Support input BudgetExceeded");}
        const privateSource=readyRoot===undefined?undefined:readHvpPrivateCutSource(plan);
        if(privateSource!==undefined){
          const rootBinding=readyRoot!;
          const current=()=>{
            if(disposed||rolloverFailed||rollingOver||readyRoot!==rootBinding||rootBinding.read()!==plan.before){throw new Error("Stale private terrain cut");}
            privateSource.assertCurrent();
          };
          current();
          const resident=chunkResident(residentBytesValue??total),ledger=createStructuralOwnerLedger(resident,96*1024*1024,128);
          const pump=createHvpBodyMeshTaskPump(current,trace===undefined?undefined:(_label,start,duration)=>{
            trace({commandId:plan.request.commandId,thread:"main",phase:"cutSupportPrepareWorkMs",origin:performance.timeOrigin,start,duration});
          });
          let workspaceBytes=0,workspacePeak=0,active=false,handedOff=false;
          const reserve:import("../../voxel/structural/validation").StructuralOwnedReserve=(bytes,_retained,kind)=>{
            if(!active){throw new Error("Support workspace outside fragment lifetime");}
            workspaceBytes+=bytes;const increase=Math.max(0,workspaceBytes-workspacePeak);
            ledger.reserve(increase,false,kind);workspacePeak=Math.max(workspacePeak,workspaceBytes);
          };
          Object.defineProperty(reserve,"hashUnits",{value:128});
          const work:HvpOwnedSupportWork={reserve,retain:bytes=>ledger.reserve(bytes,true),
            beginFragment:()=>{if(active){throw new Error("Overlapping support fragment workspace");}active=true;workspaceBytes=0;},
            endFragment:()=>{active=false;workspaceBytes=0;}};
          try{
            ledger.reserve(16_384);
            const clock=createHvpSupportTimingsCollector();
            const report=await measure("cutSupportLocalPlanMs",()=>pump.run(analyzeHvpSupportSnapshotOwnedSteps(privateSource.source,plan.changed.map(c=>c.cell),{},clock,work)));
            current();
            const timings=clock.done(report.fragments.length,report.fragments.reduce((n,f)=>n+f.cells.length,0));
            const credits=createHvpSupportPhaseCredits(ledger.resources.reservedBytes,resident);
            const accepted=bindHvpSupportPlan(plan,Object.freeze({...report,timings}),()=>{retainedSupport.delete(accepted);ledger.release();},credits);
            retainedSupport.add(accepted);handedOff=true;return accepted;
          }finally{pump.dispose();if(!handedOff){ledger.release();}}
        }
        // Reuse immutable COW leaf copies, not 8 million map/string lookups and
        // 256 nested timers. Unknown coverage still fails closed at copyLeaf.
        const resident=chunkResident(residentBytesValue??total),ledger=createStructuralOwnerLedger(resident,96*1024*1024,128),pump=createHvpBodyMeshTaskPump(()=>{
          if(disposed){throw new Error("Cancelled terrain snapshot");}if(rolloverFailed){throw new Error("Support compiler disposed");}
        });
        let handedOff=false;
        try{
        ledger.reserve(total+HVP_OWNED_SLOT_COPY_SCRATCH_BYTES);
        const slots=await measure("cutSupportCopyMs",()=>copyHvpTerrainSlots(s,()=>disposed,pump.host));
        const payload:HvpSupportPayload={sessionId:s.sessionId,epoch:s.epoch,generation:s.revision,sourceDigest:s.sourceDigest,
          size:[s.sizeX,s.sizeY,s.sizeZ],changed:plan.changed.map(c=>c.cell)};
        const buffers=[slots.buffer as ArrayBuffer],input:TransferableBufferBundle={buffers,ownership:"SenderToWorker",revision:contentRevision(s.revision),
          byteLength:byteCount(slots.byteLength),views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
        const packBytes=24_576+input.byteLength;ledger.reserve(packBytes);
        const workerGrant=96*1024*1024-ledger.resources.reservedBytes;
        if(workerGrant<=0){throw new Error("Support Prepare envelope exhausted");}ledger.reserve(workerGrant);
        const packReserve=createHvpBodyMeshPhaseReserve(packBytes),resultDebit=createHvpBodyMeshPhaseReserve(workerGrant);let resultUsed=0;
        const resultReserve:import("../../voxel/structural/validation").StructuralOwnedReserve=(bytes,retained,kind)=>{
          resultDebit(bytes,retained,kind);resultUsed+=bytes;
        };
        const request={jobId:workerJobId(`hvp-support-${sequence++}`),targetKey:workerTargetKey("hvp-support"),jobKind:workerJobKind(HVP_SUPPORT_JOB),
          workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(s.revision),
          sourceInputDigest:await measure("cutSupportInputHashMs",()=>pump.run(hvpSupportInputDigestSteps(payload,buffers))),algorithmVersion:algorithmVersion(1),priority:"Urgent" as const,
          deadline:jobDeadline(sequence),estimatedInputBytes:input.byteLength,estimatedOutputBytes:byteCount(HVP_SUPPORT_MAX_OUTPUT),payload};
        await startPool();
        const ticket=await measure("cutSupportAdmissionMs",()=>pool.enqueueSupport(request,input,pump.host,packReserve,workerGrant,resultReserve));
        const terminal=await measure("cutSupportWorkerWaitMs",()=>ticket.result);
        if(disposed||terminal.kind!=="Completed"||!pool.isAcceptedCompletedTerminal(terminal)){throw new Error(`Support prepare ${terminal.kind}`);}
        const report=await measure("cutSupportDecodeMs",()=>pump.run(decodeHvpSupportOutputSteps(terminal.output,payload,resultReserve)));
        await pump.run((function*(){for(const f of report.fragments){for(const c of f.cells){
          if(s.readSlot(c.x,c.y,c.z)!==c.materialId){throw new Error("Foreign support occupancy");}yield "supportSourceBinding";
        }}})());
        const credits=createHvpSupportPhaseCredits(total+HVP_OWNED_SLOT_COPY_SCRATCH_BYTES+packBytes+resultUsed,resident);
        const accepted=bindHvpSupportPlan(plan,report,()=>{retainedSupport.delete(accepted);ledger.release();},credits);
        retainedSupport.add(accepted);handedOff=true;return accepted;
        }finally{pump.dispose();if(!handedOff){ledger.release();}}
        }finally{supportAnalyzing=false;}
      });
    },
    async compile(plan:HvpPreparedCut,support?:HvpSupportPlan,residentBytes?:number):Promise<HvpTerrainProducts> {
      const credits=support===undefined?undefined:bindHvpOwnedSupportCut(support,plan);
      return withOperation(async()=>{
        if(chunkCache!==undefined){
          if(activeOperations!==1||retainedProducts.size!==0||supportAnalyzing||[...retainedSupport].some(p=>p!==support)){throw new Error("Chunk preparation lifetime pending");}
          const cache=chunkCache,binding=readyRoot,witness=readHvpPrivateCutSource(plan);
          if(witness?.source!==plan.after||cache.source!==plan.before||pendingChunks.size!==0){throw new Error("Foreign or pending chunk Source lineage");}
          const current=()=>{if(disposed||readyRoot!==binding||binding?.read()!==plan.before||chunkCache!==cache){throw new Error("Stale chunk root binding");}witness.assertCurrent();};
          current();
          let ledger:ReturnType<typeof createStructuralOwnerLedger>|undefined;
          const resident=chunkResident(residentBytes??0),phase=credits??createHvpSupportPhaseCredits(32_768,resident);
          if(credits===undefined){ledger=createStructuralOwnerLedger(resident,96*1024*1024,128);ledger.reserve(96*1024*1024);}
          let handedOff=false,products:HvpTerrainProducts|undefined;
          try{
            products=await compileChunks(plan.after,hvpDirtyChunks(plan),cache.worldId,cache.neighbor,phase,cache,current,undefined,false,cache.renderNeighbor);
            current();
            const accepted=products;ownedProducts.set(accepted,{credits:phase,release:()=>{releaseChunkCandidate(accepted);retainedProducts.delete(accepted);ledger?.release();}});
            retainedProducts.add(products);handedOff=true;return products;
          }finally{if(!handedOff){if(products){pendingChunks.delete(products);}if(credits===undefined){phase.release();}ledger?.release();}}
        }
        if(credits!==undefined||residentBytes===undefined){return compileSectors(plan.after,hvpDirtySectors(plan,64),hvpDirtySectors(plan,32),64,undefined,undefined,count,credits);}
        if(activeOperations!==1||supportAnalyzing||retainedSupport.size!==0||retainedProducts.size!==0){throw new Error("Terrain resource lifetime pending");}
        const ledger=createStructuralOwnerLedger(residentBytes,96*1024*1024,128),phase=createHvpSupportPhaseCredits(32_768,residentBytes);
        ledger.reserve(96*1024*1024);let handedOff=false;
        try{
          const products=await compileSectors(plan.after,hvpDirtySectors(plan,64),hvpDirtySectors(plan,32),64,undefined,undefined,count,phase);
          ownedProducts.set(products,{credits:phase,release:()=>{retainedProducts.delete(products);ledger.release();}});
          retainedProducts.add(products);handedOff=true;return products;
        }finally{if(!handedOff){phase.release();ledger.release();}}
      });
    },
    async restore(before:HvpTerrainSnapshot,after:HvpTerrainSnapshot,serial=false):Promise<HvpTerrainProducts>{
      return withOperation(async()=>{
        // A full scene restore may need all 16 render + 64 collision sectors,
        // still in bounded batches; it is not a larger per-cut allowance.
        return compileSectors(after,hvpRestoreSectors(before,after,64),hvpRestoreSectors(before,after,32),80,undefined,undefined,serial?1:count);
      });
    },
    async restoreChunks(before:HvpTerrainSnapshot,afterOwner:{read:()=>HvpTerrainSnapshot},east:HvpTerrainSnapshot|undefined,residentBytes:number,worldId:string,renderEast=east):Promise<HvpTerrainProducts>{
      return withOperation(async()=>{
        const cache=chunkCache,binding=readyRoot,after=afterOwner.read();
        if((cache!==undefined&&cache.source!==before)||binding?.read()!==before||!isHvpPrivateTerrainSource(binding,before)||!isHvpPrivateTerrainSource(afterOwner,after)){throw new Error("Owned chunk restore lineage required");}
        if([east,renderEast].some(s=>s&&(s.originMeters.x!==after.originMeters.x+32||s.originMeters.y!==after.originMeters.y||s.originMeters.z!==after.originMeters.z))){throw new Error("Invalid restored east chunk coverage");}
        if(activeOperations!==1||retainedProducts.size!==0||retainedSupport.size!==0||pendingChunks.size!==0){throw new Error("Chunk restore lifetime pending");}
        const current=()=>{if(disposed||readyRoot!==binding||binding.read()!==before||afterOwner.read()!==after||chunkCache!==cache){throw new Error("Stale chunk restore binding");}};
        const resident=chunkResident(residentBytes),ledger=createStructuralOwnerLedger(resident,96*1024*1024,128),credits=createHvpSupportPhaseCredits(32_768,resident);
        ledger.reserve(96*1024*1024);const lane=credits.beginLane(1),pump=createHvpBodyMeshTaskPump(current);
        let products:HvpTerrainProducts|undefined,handedOff=false;
        try{
          const dirty=new Set(cache===undefined?Array.from({length:256},(_,i)=>i):await pump.run(hvpRestoreChunksSteps(before,after,createHvpBodyMeshPhaseReserve(lane.bytes))));
          if(east!==cache?.neighbor||renderEast!==cache?.renderNeighbor){for(let id=7;id<256;id+=8){dirty.add(id);}}
          pump.dispose();credits.endLane(lane,0);
          products=await compileChunks(after,[...dirty].sort((a,b)=>a-b),worldId,east,credits,cache,current,undefined,true,renderEast);current();
          ownedChunkBindings.set(products,{owner:afterOwner,source:after,neighbor:east,worldId,current});
          const accepted=products;ownedProducts.set(accepted,{credits,release:promote=>{releaseChunkCandidate(accepted,promote);retainedProducts.delete(accepted);ledger.release();}});
          retainedProducts.add(accepted);handedOff=true;return products;
        }finally{
          pump.dispose();if(!handedOff){if(products){pendingChunks.delete(products);ownedChunkCollisions.delete(products);}credits.release();ledger.release();}
        }
      });
    },
    dispose():Promise<void> {
      return disposePromise??=(async()=>{
        disposed=true;readyRoot=undefined;chunkCache=undefined;pendingChunks.clear();if(started!==undefined){await pool.shutdown();}
        if(activeOperations>0){await new Promise<void>(resolve=>{idleResolve=resolve;});}
      })();
    }
  };
};
