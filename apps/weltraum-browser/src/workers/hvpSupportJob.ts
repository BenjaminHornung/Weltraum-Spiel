import {fnv1aHash} from "../core/hash";
import {HVP_COAST_MATERIAL_REGISTRY} from "../hvp/hvpCoastSource";
import {analyzeHvpSupportSnapshot,type HvpSupportReport,type HvpTerrainFragment} from "../hestia-prototype/terrain/supportPlan";
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
export const hvpSupportInputDigest=(p:HvpSupportPayload,buffers:readonly ArrayBuffer[])=>
  fnv1aHash(JSON.stringify([...identity(p),fnv1aBytes(buffers)]));
export const validateHvpSupportRequest=(request:WorkerJobRequest,input:TransferableBufferBundle):HvpSupportPayload=>{
  const p=validateHvpSupportPayload(request.payload),v=input.views[0],count=p.size[0]*p.size[1]*p.size[2];
  if(request.jobKind!==HVP_SUPPORT_JOB||request.algorithmVersion!==1||request.inputRevision!==p.generation
    ||request.estimatedOutputBytes!==HVP_SUPPORT_MAX_OUTPUT||input.buffers.length!==1||input.views.length!==1
    ||input.revision!==p.generation||input.byteLength!==count||input.buffers[0]!.byteLength!==count
    ||v?.name!=="slots"||v.kind!=="Uint8Array"||v.bufferIndex!==0||v.byteOffset!==0||v.elementCount!==count
    ||request.sourceInputDigest!==hvpSupportInputDigest(p,input.buffers)){throw new Error("Support input binding mismatch");}
  return p;
};
export const decodeHvpSupportOutput=(output:TransferableBufferBundle,p:HvpSupportPayload):HvpSupportReport=>{
  const b=validateTransferableBundle(output),v=b.views[0];
  if(b.ownership!=="WorkerToConsumer"||b.revision!==p.generation||b.byteLength>HVP_SUPPORT_MAX_OUTPUT
    ||b.buffers.length!==1||b.views.length!==1||v?.kind!=="Uint8Array"||v.name!=="report"
    ||v.bufferIndex!==0||v.byteOffset!==0||v.elementCount!==b.buffers[0]!.byteLength){throw new Error("Invalid support output layout");}
  const value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(b.buffers[0]!)) as {binding:unknown;report:HvpSupportReport};
  const r=value.report;
  if(JSON.stringify(value.binding)!==JSON.stringify(identity(p))||!r
    ||!["Ready","NoChange","UnknownBoundary","OverBudget","FragmentOverBudget"].includes(r.status)
    ||typeof r.reason!=="string"||r.reason.length>512||!Number.isSafeInteger(r.probes)||r.probes<0||r.probes>262_144
    ||!Number.isSafeInteger(r.anchoredWitnesses)||r.anchoredWitnesses<0||r.anchoredWitnesses>3072
    ||!Number.isSafeInteger(r.workingBytes)||r.workingBytes<0||r.workingBytes>32*1024*1024
    ||!Array.isArray(r.fragments)||r.fragments.length>32||(r.status!=="Ready"&&r.fragments.length!==0)){
    throw new Error("Invalid support output binding or budget");
  }
  const seen=new Set<number>();
  const fragments:HvpTerrainFragment[]=r.fragments.map((f:HvpTerrainFragment)=>{
    if(!Array.isArray(f.cells)||f.cells.length<1||f.cells.length>32_768||!Number.isSafeInteger(f.colliders)||f.colliders<1||f.colliders>64){
      throw new Error("Invalid support fragment admission");
    }
    let mass=0,previous=-1;
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],leaves=new Set<string>();
    const cells=f.cells.map((c:HvpTerrainFragment["cells"][number])=>{
      if(!c||![c.x,c.y,c.z].every((n,a)=>Number.isSafeInteger(n)&&n>=0&&n<p.size[a]!)
        ||!Number.isInteger(c.materialId)||c.materialId<1||c.materialId>4){throw new Error("Invalid support fragment cell");}
      const key=c.x+c.y*p.size[0]+c.z*p.size[0]*p.size[1];
      if(key<=previous||seen.has(key)||seen.size===262_144){throw new Error("Duplicate, unordered or excessive support cells");}
      previous=key;seen.add(key);mass+=HVP_COAST_MATERIAL_REGISTRY[c.materialId-1]!.densityKgPerM3*.125**3;
      for(const [a,n] of [c.x,c.y,c.z].entries()){min[a]=Math.min(min[a]!,n);max[a]=Math.max(max[a]!,n+1);}
      leaves.add(`${Math.floor(c.x/16)}:${Math.floor(c.y/16)}:${Math.floor(c.z/16)}`);
      return Object.freeze({x:c.x,y:c.y,z:c.z,materialId:c.materialId});
    });
    const digest=fnv1aHash(JSON.stringify(cells)),sortedLeaves=[...leaves].sort();
    if(f.digest!==digest||f.id!==`hvp-terrain-fragment-${digest}`||!Number.isFinite(f.massKg)||Math.abs(f.massKg-mass)>1e-6
      ||JSON.stringify(f.min)!==JSON.stringify(min)||JSON.stringify(f.max)!==JSON.stringify(max)
      ||JSON.stringify(f.affectedLeaves)!==JSON.stringify(sortedLeaves)){throw new Error("Invalid support fragment geometry or mass binding");}
    return Object.freeze({id:f.id,digest,cells:Object.freeze(cells),massKg:mass,colliders:f.colliders,
      min:Object.freeze(min) as unknown as HvpCell,max:Object.freeze(max) as unknown as HvpCell,affectedLeaves:Object.freeze(sortedLeaves)});
  });
  if(seen.size>r.probes){throw new Error("Support cells exceed actual probes");}
  return Object.freeze({status:r.status,reason:r.reason,probes:r.probes,anchoredWitnesses:r.anchoredWitnesses,
    workingBytes:r.workingBytes,fragments:Object.freeze(fragments)});
};
export const executeHvpSupportJob=(request:WorkerJobRequest,bundle:TransferableBufferBundle)=>{
  const input=validateTransferableBundle(bundle),p=validateHvpSupportRequest(request,input),slots=new Uint8Array(input.buffers[0]!);
  if(slots.some(v=>v>4&&v!==255)||p.changed.some(([x,y,z])=>slots[x+y*p.size[0]+z*p.size[0]*p.size[1]]!==0)){
    throw new Error("Invalid candidate occupancy or cut seeds");
  }
  const report=analyzeHvpSupportSnapshot({sizeX:p.size[0],sizeY:p.size[1],sizeZ:p.size[2],cellMeters:.125,originMeters:{x:0,y:0,z:0},
    readSlot:(x,y,z)=>{const v=slots[x+y*p.size[0]+z*p.size[0]*p.size[1]]!;return v===255?undefined:v;}},p.changed);
  const bytes=new TextEncoder().encode(JSON.stringify({binding:identity(p),report}));
  if(bytes.byteLength>HVP_SUPPORT_MAX_OUTPUT){throw new Error("Support output BudgetExceeded");}
  const buffers=[bytes.buffer as ArrayBuffer];
  const output:TransferableBufferBundle={buffers,ownership:"WorkerToConsumer",revision:contentRevision(p.generation),byteLength:byteCount(bytes.byteLength),
    contentHash:fnv1aBytes(buffers),views:[{name:"report",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:bytes.length}]};
  decodeHvpSupportOutput(output,p);
  const result:WorkerJobResult={jobId:request.jobId,targetKey:request.targetKey,workerEpoch:request.workerEpoch,planningEpoch:request.planningEpoch,
    inputRevision:request.inputRevision,sourceInputDigest:request.sourceInputDigest,outputRevision:contentRevision(p.generation),
    algorithmVersion:request.algorithmVersion,outputBytes:output.byteLength,contentHash:output.contentHash};
  return {result,bundle:output};
};
