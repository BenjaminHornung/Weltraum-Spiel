import {fnv1aHash} from "../core/hash";
import {HVP_COAST_REGISTRY_DIGEST} from "../hvp/hvpCoastSource";
import {meshHvpOccupancy,meshHvpOccupancySteps,materializeHvpKnownEmptyMeshSteps,type HvpCompactMesh} from "../hvp/hvpCoastMesher";
import {hvpChunkCoordinates,type HvpChunkPayload} from "../hestia-prototype/terrain/terrainChunkInput";
import {meshCollisionInput,meshCollisionInputOwnedSteps,type HvpCollisionSector} from "../hestia-prototype/physics/terrainColliders";
import type {StructuralOwnedReserve} from "../voxel/structural/validation";
import type {createHvpBodyMeshTaskPump} from "./hvpBoundedPump";
import {fnv1aBytesSteps} from "./hvpBodyCutWire";
import {decodeHvpTerrainMeshSteps,packHvpTerrainMeshSteps} from "./hvpTerrainJob";
import {decodeHvpCollisionOutputSteps} from "./hvpCollisionJob";
import {byteCount,contentRevision} from "./ids";
import {fnv1aBytes,validateTransferableBundle,type TransferableBufferBundle,type WorkerJobRequest,type WorkerJobResult} from "./protocol";

export const HVP_CHUNK_JOB="BuildHvpTerrainChunk";
export const HVP_CHUNK_MAX_OUTPUT=8*1024*1024;
const payloadKeys=["worldId","renderVersion","collisionVersion","sessionId","epoch","generation","sourceDigest","baseDigest","materialDigest","chunk","coreOrigin",
  "sizeX","sizeY","sizeZ","haloWidth","originMeters","sourceOrigin","haloBinding","physicalHalo","haloNeighbor"];
const resizableGetter=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,"resizable")?.get;
const readResizable=resizableGetter===undefined?undefined:Function.prototype.call.bind(resizableGetter);
export const validateHvpChunkBuffers=(buffers:readonly ArrayBuffer[]):void=>{
  if(!Array.isArray(buffers)||buffers.length<1||buffers.length>8){throw new Error("Invalid fixed chunk buffers");}
  for(const b of buffers){if(!(b instanceof ArrayBuffer)||readResizable?.(b)===true){throw new Error("Chunk buffers must be fixed ArrayBuffers");}}
};
export const validateHvpChunkPayload=(value:unknown):HvpChunkPayload=>{
  const p=value as HvpChunkPayload|null;
  if(!p||typeof p!=="object"||Object.keys(p).length!==payloadKeys.length||payloadKeys.some(k=>!Object.hasOwn(p,k))
    ||![p.worldId,p.sessionId,p.sourceDigest,p.baseDigest].every(v=>typeof v==="string"&&/^[-A-Za-z0-9:._]{1,128}$/.test(v))
    ||typeof p.haloBinding!=="string"||!/^[-A-Za-z0-9:._]{1,512}$/.test(p.haloBinding)
    ||!Number.isSafeInteger(p.epoch)||p.epoch<0||p.materialDigest!==HVP_COAST_REGISTRY_DIGEST
    ||p.sizeX!==32||p.sizeY!==32||p.sizeZ!==32||p.haloWidth!==1||p.renderVersion!=="hvp-terrain-chunk-v1"
    ||p.collisionVersion!=="hvp-collision-chunk-v1"){throw new Error("Invalid chunk manifest binding");}
  contentRevision(p.generation);const c=hvpChunkCoordinates(p.chunk);
  if(!Array.isArray(p.coreOrigin)||p.coreOrigin.length!==3||Object.keys(p.coreOrigin).length!==3
    ||[0,1,2].some(i=>!Object.hasOwn(p.coreOrigin,i)||p.coreOrigin[i]!==c[i]!*32)
    ||![p.originMeters,p.sourceOrigin].every(o=>o&&typeof o==="object"&&Object.keys(o).length===3
      &&Object.hasOwn(o,"x")&&Object.hasOwn(o,"y")&&Object.hasOwn(o,"z")&&[o.x,o.y,o.z].every(n=>Number.isSafeInteger(n*8)))
    ||p.sourceOrigin.y!==-8||p.sourceOrigin.z!==-16||p.originMeters.x!==p.sourceOrigin.x+c[0]*4
    ||p.originMeters.y!==p.sourceOrigin.y+c[1]*4||p.originMeters.z!==p.sourceOrigin.z+c[2]*4){throw new Error("Invalid chunk coverage binding");}
  const n=p.haloNeighbor;
  if(p.physicalHalo==="closed-exterior"){if(n!==null){throw new Error("Invalid chunk physical halo binding");}}
  else if(p.physicalHalo==="east"||p.physicalHalo==="west"){
    if(!n||typeof n!=="object"||Object.keys(n).sort().join(",")!=="baseDigest,epoch,generation,originMeters,sessionId,sourceDigest"
      ||![n.sessionId,n.sourceDigest,n.baseDigest].every(v=>typeof v==="string"&&/^[-A-Za-z0-9:._]{1,128}$/.test(v))
      ||![n.epoch,n.generation].every(v=>Number.isSafeInteger(v)&&v>=0)||!n.originMeters
      ||Object.keys(n.originMeters).sort().join(",")!=="x,y,z"||n.originMeters.x!==p.sourceOrigin.x+(p.physicalHalo==="east"?32:-32)
      ||n.originMeters.y!==p.sourceOrigin.y||n.originMeters.z!==p.sourceOrigin.z){throw new Error("Invalid chunk physical halo binding");}
  }else{throw new Error("Invalid chunk physical halo binding");}
  return p;
};
const digestFromHash=(p:HvpChunkPayload,hash:string)=>fnv1aHash(JSON.stringify(payloadKeys.map(k=>{
  // Request snapshots sort nested records; bind values in the producer's fixed order.
  if(k==="originMeters"||k==="sourceOrigin"){const point=p[k];return {x:point.x,y:point.y,z:point.z};}
  if(k==="haloNeighbor"&&p.haloNeighbor!==null){const neighbor=p.haloNeighbor;
    return {sessionId:neighbor.sessionId,epoch:neighbor.epoch,generation:neighbor.generation,sourceDigest:neighbor.sourceDigest,baseDigest:neighbor.baseDigest,
      originMeters:{x:neighbor.originMeters.x,y:neighbor.originMeters.y,z:neighbor.originMeters.z}};}
  return p[k as keyof HvpChunkPayload];
}).concat(hash)));
export const hvpChunkInputDigest=(p:HvpChunkPayload,buffers:readonly ArrayBuffer[])=>{
  validateHvpChunkPayload(p);validateHvpChunkBuffers(buffers);return digestFromHash(p,fnv1aBytes(buffers));
};
export function* hvpChunkInputDigestSteps(p:HvpChunkPayload,buffers:readonly ArrayBuffer[]):Generator<string,string,unknown>{
  validateHvpChunkPayload(p);validateHvpChunkBuffers(buffers);return digestFromHash(p,yield* fnv1aBytesSteps(buffers));
}
export const validateHvpChunkRequest=(r:WorkerJobRequest,b:TransferableBufferBundle)=>drain(validateHvpChunkRequestSteps(r,b));
export function* validateHvpChunkRequestSteps(r:WorkerJobRequest,b:TransferableBufferBundle):Generator<string,HvpChunkPayload,unknown>{
  validateHvpChunkBuffers(b.buffers);const p=validateHvpChunkPayload(r.payload),v=b.views[0];
  if(r.jobKind!==HVP_CHUNK_JOB||r.algorithmVersion!==1||r.inputRevision!==p.generation||b.revision!==p.generation
    ||b.ownership!=="SenderToWorker"||r.estimatedInputBytes!==34**3||r.estimatedOutputBytes!==HVP_CHUNK_MAX_OUTPUT
    ||b.buffers.length!==1||b.views.length!==1||b.byteLength!==34**3||v?.name!=="slots"||v.kind!=="Uint8Array"
    ||v.bufferIndex!==0||v.byteOffset!==0||v.elementCount!==34**3
    ||r.sourceInputDigest!==digestFromHash(p,yield* fnv1aBytesSteps(b.buffers))){throw new Error("Chunk input binding mismatch");}
  return p;
}
const drain=<T>(steps:Generator<string,T,unknown>):T=>{for(;;){const step=steps.next();if(step.done){return step.value;}}};
export const decodeHvpChunkOutput=(b:TransferableBufferBundle,p:HvpChunkPayload)=>drain(decodeHvpChunkOutputSteps(b,p));
export function* decodeHvpChunkOutputSteps(source:TransferableBufferBundle,p:HvpChunkPayload,reserve?:StructuralOwnedReserve):Generator<string,{render:HvpCompactMesh;collision:HvpCollisionSector},unknown>{
  validateHvpChunkPayload(p);
  if(!Array.isArray(source.buffers)||source.buffers.length!==8||!Array.isArray(source.views)||source.views.length!==8
    ||!Number.isSafeInteger(source.byteLength)||source.byteLength<0||source.byteLength>HVP_CHUNK_MAX_OUTPUT){throw new Error("Invalid chunk output binding");}
  validateHvpChunkBuffers(source.buffers);reserve?.(16_384);const b=validateTransferableBundle(source);
  if(b.ownership!=="WorkerToConsumer"||b.revision!==p.generation||b.views[6]!.name!=="collisionVertices"||b.views[7]!.name!=="collisionIndices"){
    throw new Error("Invalid chunk output binding");}
  const renderBuffers=b.buffers.slice(0,6),collisionBuffers=b.buffers.slice(6);
  const render:TransferableBufferBundle={buffers:renderBuffers,views:b.views.slice(0,6),ownership:b.ownership,revision:b.revision,
    byteLength:byteCount(renderBuffers.reduce((n,a)=>n+a.byteLength,0))};
  const collision:TransferableBufferBundle={buffers:collisionBuffers,views:b.views.slice(6).map((v,i)=>({...v,name:i===0?"vertices":"indices",bufferIndex:v.bufferIndex-6})),
    ownership:b.ownership,revision:b.revision,byteLength:byteCount(collisionBuffers.reduce((n,a)=>n+a.byteLength,0))};
  const min=p.originMeters,max={x:min.x+4,y:min.y+4,z:min.z+4};
  return {render:yield* decodeHvpTerrainMeshSteps(render,{generation:p.generation,sourceDigest:p.sourceDigest,
      boundsMeters:{min,max},algorithmVersion:"hvp-terrain-chunk-v1"},reserve),
    collision:yield* decodeHvpCollisionOutputSteps(collision,{sizeX:32,sizeY:32,sizeZ:32,originMeters:min,outputRevision:contentRevision(p.generation)},reserve??(()=>{}))};
}
export const executeHvpChunkJob=(r:WorkerJobRequest,b:TransferableBufferBundle)=>drain(chunkJobSteps(r,b));
export const executeHvpChunkJobOwned=(r:WorkerJobRequest,b:TransferableBufferBundle,pump:ReturnType<typeof createHvpBodyMeshTaskPump>,reserve:StructuralOwnedReserve)=>pump.run(chunkJobSteps(r,b,reserve));
function* chunkJobSteps(r:WorkerJobRequest,b:TransferableBufferBundle,reserve?:StructuralOwnedReserve):Generator<string,{result:WorkerJobResult;bundle:TransferableBufferBundle},unknown>{
  if(!Array.isArray(b.buffers)||b.buffers.length!==1||!Array.isArray(b.views)||b.views.length!==1||b.byteLength!==34**3){throw new Error("Chunk input binding mismatch");}
  validateHvpChunkBuffers(b.buffers);reserve?.(16_384+b.byteLength);const input=validateTransferableBundle(b),p=yield* validateHvpChunkRequestSteps(r,input);
  const slots=new Uint8Array(input.buffers[0]!);
  let allAir=true;
  for(let i=0;i<slots.length;i+=1){if(slots[i]!>4){throw new Error("Invalid chunk material");}allAir=allAir&&slots[i]===0;
    if(reserve&&(i+1)%4096===0){yield "chunkInput";}}
  const slotAt=(x:number,y:number,z:number)=>slots[x+1+(y+1)*34+(z+1)*34*34]!;
  const occupancy={sizeX:32,sizeY:32,sizeZ:32,cellMeters:.125,originMeters:p.originMeters,slotAt,ghostSlotAt:slotAt};
  const budgets={maxVisitedCells:32**3,maxQuads:50_000,maxVertices:200_000,maxIndices:300_000};
  const mesh=allAir?yield* materializeHvpKnownEmptyMeshSteps(occupancy,budgets,p.sourceDigest,"hvp-terrain-chunk-v1",true,reserve)
    :reserve?yield* meshHvpOccupancySteps(occupancy,budgets,p.sourceDigest,"hvp-terrain-chunk-v1",{ao:true},reserve)
    :meshHvpOccupancy(occupancy,budgets,p.sourceDigest,"hvp-terrain-chunk-v1",{ao:true});
  const render=yield* packHvpTerrainMeshSteps(mesh,p.generation,reserve);
  let collision:HvpCollisionSector;
  if(allAir){
    // Fully validated zero slots stay empty under every inside/confirmed-neighbor physical mask.
    reserve?.(8192);collision={vertices:new Float32Array(0),indices:new Uint32Array(0)};
  }else{
    reserve?.(8192+slots.byteLength);const binary=new Uint8Array(slots.length);
    for(let i=0;i<slots.length;i+=1){
      const x=p.coreOrigin[0]+i%34-1,y=p.coreOrigin[1]+Math.floor(i/34)%34-1,z=p.coreOrigin[2]+Math.floor(i/(34*34))-1;
      const inside=x>=0&&x<256&&y>=0&&y<128&&z>=0&&z<256;
      const confirmedNeighbor=y>=0&&y<128&&z>=0&&z<256&&(p.physicalHalo==="east"?x>=256&&x<512:p.physicalHalo==="west"?x<0&&x>=-256:false);
      // Known authored render ghosts do not remove the established closed physical exterior.
      binary[i]=Number(slots[i]!==0&&(inside||confirmedNeighbor));if(reserve&&(i+1)%4096===0){yield "chunkCollisionInput";}
    }
    const collisionInput={sizeX:32,sizeY:32,sizeZ:32,originMeters:p.originMeters,slots:binary};
    collision=reserve?yield* meshCollisionInputOwnedSteps(collisionInput,reserve):meshCollisionInput(collisionInput);
  }
  reserve?.(8192);const buffers=[...render.buffers,collision.vertices.buffer as ArrayBuffer,collision.indices.buffer as ArrayBuffer];
  const bytes=buffers.reduce((n,a)=>n+a.byteLength,0);
  if(bytes>HVP_CHUNK_MAX_OUTPUT){throw new Error("Chunk output BudgetExceeded");}
  const output:TransferableBufferBundle={buffers,ownership:"WorkerToConsumer",revision:contentRevision(p.generation),byteLength:byteCount(bytes),
    contentHash:reserve?yield* fnv1aBytesSteps(buffers):fnv1aBytes(buffers),views:[...render.views,
      {name:"collisionVertices",kind:"Float32Array",bufferIndex:6,byteOffset:0,elementCount:collision.vertices.length},
      {name:"collisionIndices",kind:"Uint32Array",bufferIndex:7,byteOffset:0,elementCount:collision.indices.length}]};
  yield* decodeHvpChunkOutputSteps(output,p,reserve);
  return {bundle:output,result:{jobId:r.jobId,targetKey:r.targetKey,workerEpoch:r.workerEpoch,planningEpoch:r.planningEpoch,inputRevision:r.inputRevision,
    sourceInputDigest:r.sourceInputDigest,outputRevision:contentRevision(p.generation),algorithmVersion:r.algorithmVersion,outputBytes:output.byteLength,contentHash:output.contentHash}};
}
