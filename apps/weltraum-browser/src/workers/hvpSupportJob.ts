import {fnv1aHash} from "../core/hash";
import {HVP_COAST_MATERIAL_REGISTRY} from "../hvp/hvpCoastSource";
import {analyzeHvpSupportSnapshot,analyzeHvpSupportSnapshotOwnedSteps,hvpSupportCellDigestSteps,createHvpSupportTimingsCollector,type HvpOwnedSupportWork,type HvpSupportReport,type HvpTerrainFragment,type HvpSupportTimings} from "../hestia-prototype/terrain/supportPlan";
import {createStructuralOwnerLedger} from "../voxel/structural/model";
import {structuralSortSteps,structuralFreezeArraySteps,type StructuralOwnedReserve} from "../voxel/structural/validation";
import {fnv1aBytesSteps} from "./hvpBodyCutWire";
import {readHvpSupportJsonSteps,encodeHvpSupportJsonSteps} from "./hvpSupportJson";
import {borrowedHvpPlanSteps} from "../hestia-prototype/physics/hvpPlanSteps";
import type {HvpTransferredColliderBox} from "../hestia-prototype/physics/rigidRecipe";
import type {HvpCell} from "../hestia-prototype/terrain/picking";
import {byteCount,contentRevision} from "./ids";
import {fnv1aBytes,validateTransferableBundle,type TransferableBufferBundle,type WorkerJobRequest,type WorkerJobResult} from "./protocol";

export const HVP_SUPPORT_JOB="AnalyzeHvpTerrainSupport";
export const HVP_SUPPORT_MAX_OUTPUT=8*1024*1024;
export interface HvpSupportPayload {
  readonly sessionId:string;readonly epoch:number;readonly generation:number;readonly sourceDigest:string;
  readonly size: HvpCell;readonly changed:readonly HvpCell[];
}
export const validateHvpSupportPayload=(input:unknown):HvpSupportPayload=>{
  const p=input as HvpSupportPayload|null;
  if(!p||typeof p!=="object"||typeof p.sessionId!=="string"||!/^[A-Za-z0-9:._-]{1,128}$/.test(p.sessionId)
    ||!Number.isSafeInteger(p.epoch)||p.epoch<0||typeof p.sourceDigest!=="string"||!/^[0-9a-f]{8}$/.test(p.sourceDigest)
    ||!Array.isArray(p.size)||p.size.length!==3||p.size.some(n=>!Number.isSafeInteger(n)||n<1||n>256)
    ||p.size[0]*p.size[1]*p.size[2]>8_388_608||!Array.isArray(p.changed)||p.changed.length>512
    ||p.changed.some(c=>!Array.isArray(c)||c.length!==3||c.some((v,a)=>!Number.isSafeInteger(v)||v<0||v>=p.size[a]!))){
    throw new Error("Invalid HVP support identity or coverage");
  }
  contentRevision(p.generation);return p;
};
const identity=(p:HvpSupportPayload)=>[p.sessionId,p.epoch,p.generation,p.sourceDigest,p.size,p.changed];
function* matchesSupportMetadata(actual:unknown,expected:unknown):Generator<string,boolean,unknown>{
  if(!Array.isArray(expected)){yield "supportMetadata";return actual===expected;}
  if(!Array.isArray(actual)||actual.length!==expected.length){return false;}
  for(let i=0;i<expected.length;i+=1){if(!(yield* matchesSupportMetadata(actual[i],expected[i]))){return false;}}
  return true;
}
export const hvpSupportInputDigest=(p:HvpSupportPayload,buffers:readonly ArrayBuffer[])=>
  fnv1aHash(JSON.stringify([...identity(p),fnv1aBytes(buffers)]));
export const validateHvpSupportRequest=(request:WorkerJobRequest,input:TransferableBufferBundle):HvpSupportPayload=>{
  const steps=supportRequestSteps(request,input);
  for(;;){const step=steps.next();if(step.done){return step.value;}}
};
function* supportRequestSteps(request:WorkerJobRequest,input:TransferableBufferBundle,owned=false):Generator<string,HvpSupportPayload,unknown>{
  const p=validateHvpSupportPayload(request.payload),v=input.views[0],count=p.size[0]*p.size[1]*p.size[2];
  if(request.jobKind!==HVP_SUPPORT_JOB||request.algorithmVersion!==1||request.inputRevision!==p.generation
    ||request.estimatedOutputBytes!==HVP_SUPPORT_MAX_OUTPUT||input.buffers.length!==1||input.views.length!==1
    ||input.revision!==p.generation||input.byteLength!==count||input.buffers[0]!.byteLength!==count
    ||v?.name!=="slots"||v.kind!=="Uint8Array"||v.bufferIndex!==0||v.byteOffset!==0||v.elementCount!==count
    ||request.sourceInputDigest!==(owned?fnv1aHash(JSON.stringify([...identity(p),yield* fnv1aBytesSteps(input.buffers)]))
      :hvpSupportInputDigest(p,input.buffers))){throw new Error("Support input binding mismatch");}
  return p;
}
export const validateHvpSupportRequestSteps=(request:WorkerJobRequest,input:TransferableBufferBundle)=>supportRequestSteps(request,input,true);
export function* hvpSupportInputDigestSteps(p:HvpSupportPayload,buffers:readonly ArrayBuffer[]):Generator<string,string,unknown>{
  return fnv1aHash(JSON.stringify([...identity(p),yield* fnv1aBytesSteps(buffers)]));
}
export const decodeHvpSupportOutput=(output:TransferableBufferBundle,p:HvpSupportPayload):HvpSupportReport=>{
  const steps=supportOutputSteps(output,p);
  for(;;){const step=steps.next();if(step.done){return step.value;}}
};
/** Exclusive pool-owned wire; the original schema validators run before a report can be published. */
export const decodeHvpSupportOutputSteps=(output:TransferableBufferBundle,p:HvpSupportPayload,reserve:StructuralOwnedReserve)=>supportOutputSteps(output,p,reserve);
function* supportOutputSteps(output:TransferableBufferBundle,p:HvpSupportPayload,owned?:StructuralOwnedReserve):Generator<string,HvpSupportReport,unknown>{
  if(owned&&(!Array.isArray(output.buffers)||output.buffers.length!==1||!Array.isArray(output.views)||output.views.length!==1
    ||!Number.isSafeInteger(output.byteLength)||output.byteLength<0||output.byteLength>HVP_SUPPORT_MAX_OUTPUT)){throw new Error("Invalid support output layout");}
  const b=validateTransferableBundle(output),v=b.views[0];
  if(b.ownership!=="WorkerToConsumer"||b.revision!==p.generation||b.byteLength>HVP_SUPPORT_MAX_OUTPUT
    ||b.buffers.length!==1||b.views.length!==1||v?.kind!=="Uint8Array"||v.name!=="report"
    ||v.bufferIndex!==0||v.byteOffset!==0||v.elementCount!==b.buffers[0]!.byteLength){throw new Error("Invalid support output layout");}
  const value=(owned===undefined?JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(b.buffers[0]!))
    :yield* readHvpSupportJsonSteps(new Uint8Array(b.buffers[0]!),owned)) as {binding:unknown;report:HvpSupportReport;timings?:HvpSupportTimings};
  const r=value.report;
  if((owned===undefined?JSON.stringify(value.binding)!==JSON.stringify(identity(p)):!(yield* matchesSupportMetadata(value.binding,identity(p))))||!r
    ||!["Ready","NoChange","UnknownBoundary","OverBudget","FragmentOverBudget"].includes(r.status)
    ||typeof r.reason!=="string"||r.reason.length>512||!Number.isSafeInteger(r.probes)||r.probes<0||r.probes>262_144
    ||!Number.isSafeInteger(r.anchoredWitnesses)||r.anchoredWitnesses<0||r.anchoredWitnesses>3072
    ||!Number.isSafeInteger(r.workingBytes)||r.workingBytes<0||r.workingBytes>32*1024*1024
    ||!Array.isArray(r.fragments)||r.fragments.length>32||(r.status!=="Ready"&&r.fragments.length!==0)){
    throw new Error("Invalid support output binding or budget");
  }
  const seen=new Set<number>();
  function* fragmentSteps(f:HvpTerrainFragment):Generator<string,HvpTerrainFragment,unknown>{
    if(!Array.isArray(f.cells)||f.cells.length<1||f.cells.length>32_768||!Number.isSafeInteger(f.colliders)||f.colliders<1||f.colliders>64){
      throw new Error("Invalid support fragment admission");
    }
    let mass=0,previous=-1;
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],leaves=new Set<string>();
    const prepareCell=(c:HvpTerrainFragment["cells"][number])=>{
      if(!c||![c.x,c.y,c.z].every((n,a)=>Number.isSafeInteger(n)&&n>=0&&n<p.size[a]!)
        ||!Number.isInteger(c.materialId)||c.materialId<1||c.materialId>4){throw new Error("Invalid support fragment cell");}
      const key=c.x+c.y*p.size[0]+c.z*p.size[0]*p.size[1];
      if(key<=previous||seen.has(key)||seen.size===262_144){throw new Error("Duplicate, unordered or excessive support cells");}
      previous=key;seen.add(key);mass+=HVP_COAST_MATERIAL_REGISTRY[c.materialId-1]!.densityKgPerM3*.125**3;
      for(const [a,n] of [c.x,c.y,c.z].entries()){min[a]=Math.min(min[a]!,n);max[a]=Math.max(max[a]!,n+1);}
      leaves.add(`${Math.floor(c.x/16)}:${Math.floor(c.y/16)}:${Math.floor(c.z/16)}`);
      owned?.(256,true);return Object.freeze({x:c.x,y:c.y,z:c.z,materialId:c.materialId});
    };
    let cells:HvpTerrainFragment["cells"][number][];
    if(owned){owned(128+f.cells.length*8,true);cells=[];for(const c of f.cells){cells.push(prepareCell(c));yield "supportDecodeCells";}}
    else{cells=f.cells.map(prepareCell);}
    const digest=owned===undefined?fnv1aHash(JSON.stringify(cells)):yield* hvpSupportCellDigestSteps(cells);
    const sortedLeaves=[...leaves];
    if(owned){yield* borrowedHvpPlanSteps(structuralSortSteps(sortedLeaves,(a,b)=>a<b?-1:a>b?1:0,owned),"supportDecodeLeaves");}
    else{sortedLeaves.sort();}
    if(f.digest!==digest||f.id!==`hvp-terrain-fragment-${digest}`||!Number.isFinite(f.massKg)||Math.abs(f.massKg-mass)>1e-6
      ||(owned===undefined?JSON.stringify(f.min)!==JSON.stringify(min):!(yield* matchesSupportMetadata(f.min,min)))
      ||(owned===undefined?JSON.stringify(f.max)!==JSON.stringify(max):!(yield* matchesSupportMetadata(f.max,max)))
      ||(owned===undefined?JSON.stringify(f.affectedLeaves)!==JSON.stringify(sortedLeaves):!(yield* matchesSupportMetadata(f.affectedLeaves,sortedLeaves)))){throw new Error("Invalid support fragment geometry or mass binding");}
    if(!Array.isArray(f.colliderBoxes)||f.colliderBoxes.length<1||f.colliderBoxes.length>64){throw new Error("Invalid support collider boxes");}
    let boxVolume=0;
    const prepareBox=(box:HvpTransferredColliderBox)=>{
      if(!box||!Array.isArray(box.min)||!Array.isArray(box.max)||box.min.length!==3||box.max.length!==3
        ||![...box.min,...box.max].every((v)=>Number.isSafeInteger(v)&&Math.abs(v)<=1_000_000)
        ||box.min[0]!>=box.max[0]!||box.min[1]!>=box.max[1]!||box.min[2]!>=box.max[2]!){
        throw new Error("Invalid support collider box");
      }
      boxVolume+=(box.max[0]!-box.min[0]!)*(box.max[1]!-box.min[1]!)*(box.max[2]!-box.min[2]!);
      owned?.(512,true);return Object.freeze({min:Object.freeze([...box.min] as [number,number,number]),max:Object.freeze([...box.max] as [number,number,number])});
    };
    let colliderBoxes:HvpTransferredColliderBox[];
    if(owned){owned(128+f.colliderBoxes.length*8,true);colliderBoxes=[];for(const box of f.colliderBoxes){colliderBoxes.push(prepareBox(box));yield "supportDecodeBoxes";}}
    else{colliderBoxes=f.colliderBoxes.map(prepareBox);}
    if(boxVolume!==cells.length){throw new Error("Support collider coverage mismatch");}
    if(f.colliders!==colliderBoxes.length){throw new Error("Invalid support collider count");}
    const frozenCells=owned===undefined?Object.freeze(cells):yield* borrowedHvpPlanSteps(structuralFreezeArraySteps(cells,owned),"supportDecodeCells");
    owned?.(1024,true);return Object.freeze({id:f.id,digest,cells:frozenCells,massKg:mass,colliders:f.colliders,
      min:Object.freeze(min) as unknown as HvpCell,max:Object.freeze(max) as unknown as HvpCell,affectedLeaves:Object.freeze(sortedLeaves),
      colliderBoxes:Object.freeze(colliderBoxes)});
  }
  let fragments:HvpTerrainFragment[];
  if(owned){owned(128+r.fragments.length*8,true);fragments=[];for(const f of r.fragments){fragments.push(yield* fragmentSteps(f));yield "supportDecodeFragment";}}
  else{fragments=r.fragments.map(f=>{const steps=fragmentSteps(f);for(;;){const step=steps.next();if(step.done){return step.value;}}});}
  if(seen.size>r.probes){throw new Error("Support cells exceed actual probes");}
  const tm=value.timings;
  let ownedTimings:HvpSupportTimings|undefined;
  if(tm!==undefined){
    if(tm===null||typeof tm!=="object"){throw new Error("Invalid support timings");}
    const spanKeys:readonly (keyof HvpSupportTimings)[]=["seedsMs","supportMs","ingestMs","recipeMs","totalMs"];
    const bd=tm.recipeBreakdown;
    if(typeof tm.fragmentCount!=="number"||!Number.isSafeInteger(tm.fragmentCount)||tm.fragmentCount<0||tm.fragmentCount>32
      ||typeof tm.fragmentCells!=="number"||!Number.isSafeInteger(tm.fragmentCells)||tm.fragmentCells<0||tm.fragmentCells!==seen.size
      ||spanKeys.some(k=>typeof tm[k]!=="number"||!Number.isFinite(tm[k]!)||tm[k]!<0||tm[k]!>262_144)
      ||(bd!==undefined&&(typeof bd!=="object"||bd===null
        ||(["massMs","classifyMs","transitionMs","axesMs"] as const).some(k=>typeof bd[k]!=="number"||!Number.isFinite(bd[k])||bd[k]<0||bd[k]>262_144)))
      ||tm.fragmentCount!==r.fragments.length){throw new Error("Invalid support timings");}
    const recipeBreakdown=bd===undefined?undefined:Object.freeze({massMs:bd.massMs,classifyMs:bd.classifyMs,transitionMs:bd.transitionMs,axesMs:bd.axesMs});
    ownedTimings=Object.freeze({seedsMs:tm.seedsMs,supportMs:tm.supportMs,ingestMs:tm.ingestMs,recipeMs:tm.recipeMs,
      fragmentCount:tm.fragmentCount,fragmentCells:tm.fragmentCells,totalMs:tm.totalMs,
      ...(recipeBreakdown===undefined?{}:{recipeBreakdown})});
  }
  return Object.freeze({status:r.status,reason:r.reason,probes:r.probes,anchoredWitnesses:r.anchoredWitnesses,
    workingBytes:r.workingBytes,fragments:Object.freeze(fragments),...(ownedTimings===undefined?{}:{timings:ownedTimings})});
}
export const executeHvpSupportJob=(request:WorkerJobRequest,bundle:TransferableBufferBundle)=>{
  const steps=supportJobSteps(request,bundle);
  for(;;){const step=steps.next();if(step.done){return step.value;}}
};
/** Exclusive first-party worker input; the single job ledger covers every fragment and wire copy. */
export const executeHvpSupportJobOwned=async(request:WorkerJobRequest,bundle:TransferableBufferBundle,
  pump:{run:<T>(steps:Generator<string,T,unknown>)=>Promise<T>},prepareAllowanceBytes=96*1024*1024)=>{
  const ledger=createStructuralOwnerLedger(0,prepareAllowanceBytes,128);
  let workspaceBytes=0,workspacePeak=0,active=false;
  const reserve:StructuralOwnedReserve=(bytes,_retained,kind)=>{
    if(!active){throw new Error("Support workspace outside fragment lifetime");}
    workspaceBytes+=bytes;
    const increase=Math.max(0,workspaceBytes-workspacePeak);
    ledger.reserve(increase,false,kind);workspacePeak=Math.max(workspacePeak,workspaceBytes);
  };
  Object.defineProperty(reserve,"hashUnits",{value:128});
  const work:HvpOwnedSupportWork={reserve,retain:bytes=>ledger.reserve(bytes,true),
    beginFragment:()=>{if(active){throw new Error("Overlapping support fragment workspace");}active=true;workspaceBytes=0;},
    endFragment:()=>{active=false;workspaceBytes=0;}};
  try{
    // The reader aliases this backing store; count the transferred input once before allocating views/search.
    ledger.reserve(bundle.buffers.reduce((n,b)=>n+b.byteLength,0)+16_384);
    return await pump.run(supportJobSteps(request,bundle,work));
  }finally{active=false;workspaceBytes=0;ledger.release();}
};
function* supportJobSteps(request:WorkerJobRequest,bundle:TransferableBufferBundle,owned?:HvpOwnedSupportWork):Generator<string,
  {result:WorkerJobResult;bundle:TransferableBufferBundle},unknown>{
  const input=validateTransferableBundle(bundle),p=yield* supportRequestSteps(request,input,owned!==undefined),slots=new Uint8Array(input.buffers[0]!);
  let invalid=false;
  if(owned){for(let i=0;i<slots.length;i+=1){const v=slots[i]!;if(v>4&&v!==255){invalid=true;break;}if((i+1)%4096===0){yield "supportInput";}}}
  else{invalid=slots.some(v=>v>4&&v!==255);}
  if(invalid||p.changed.some(([x,y,z])=>slots[x+y*p.size[0]+z*p.size[0]*p.size[1]]!==0)){
    throw new Error("Invalid candidate occupancy or cut seeds");
  }
  const clock=createHvpSupportTimingsCollector();
  const source={sizeX:p.size[0],sizeY:p.size[1],sizeZ:p.size[2],cellMeters:.125,originMeters:{x:0,y:0,z:0},
    readSlot:(x:number,y:number,z:number)=>{const v=slots[x+y*p.size[0]+z*p.size[0]*p.size[1]]!;return v===255?undefined:v;}};
  const report=owned===undefined?analyzeHvpSupportSnapshot(source,p.changed,{},clock)
    :yield* analyzeHvpSupportSnapshotOwnedSteps(source,p.changed,{},clock,owned);
  const timings=clock.done(report.fragments.length,report.fragments.reduce((n,f)=>n+f.cells.length,0));
  if(owned){
    const cells=report.fragments.reduce((n,f)=>n+f.cells.length,0),boxes=report.fragments.reduce((n,f)=>n+f.colliderBoxes.length,0);
    // Fixed schema/validated finite numbers: original + parsed + frozen decoded graphs coexist.
    // 96 UTF16 chars/cell, 256/box and 16KiB controls bound wire text before allocation.
    const chars=16_384+cells*96+boxes*256+report.fragments.reduce((n,f)=>n+f.affectedLeaves.length*32,0);
    owned.retain(chars*8+cells*512+boxes*512+report.fragments.length*4096);
  }
  const wire={binding:identity(p),report,timings};
  const bytes=owned===undefined?new TextEncoder().encode(JSON.stringify(wire)):yield* encodeHvpSupportJsonSteps(wire,HVP_SUPPORT_MAX_OUTPUT);
  if(bytes.byteLength>HVP_SUPPORT_MAX_OUTPUT){throw new Error("Support output BudgetExceeded");}
  const buffers=[bytes.buffer as ArrayBuffer];
  const output:TransferableBufferBundle={buffers,ownership:"WorkerToConsumer",revision:contentRevision(p.generation),byteLength:byteCount(bytes.byteLength),
    contentHash:owned===undefined?fnv1aBytes(buffers):yield* fnv1aBytesSteps(buffers),views:[{name:"report",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:bytes.length}]};
  if(owned){yield* decodeHvpSupportOutputSteps(output,p,owned.retain);}
  else{decodeHvpSupportOutput(output,p);}
  const result:WorkerJobResult={jobId:request.jobId,targetKey:request.targetKey,workerEpoch:request.workerEpoch,planningEpoch:request.planningEpoch,
    inputRevision:request.inputRevision,sourceInputDigest:request.sourceInputDigest,outputRevision:contentRevision(p.generation),
    algorithmVersion:request.algorithmVersion,outputBytes:output.byteLength,contentHash:output.contentHash};
  return {result,bundle:output};
}
