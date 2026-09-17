import {fnv1aHash} from "../core/hash";
import {buildHvpNeighborProducts} from "../hestia-prototype/runtime/neighborProducts";
import {encodeHvpProjectionPacket,decodeHvpProjectionPacket,HVP_PROJECTION_PACKET_LIMIT} from "../hestia-prototype/runtime/projectionPacket";
import {byteCount,contentRevision} from "./ids";
import {fnv1aBytes,validateTransferableBundle,type TransferableBufferBundle,type WorkerJobRequest,type WorkerJobResult} from "./protocol";

export const HVP_NEIGHBOR_JOB="BuildHvpNeighborProjection";
export const HVP_NEIGHBOR_MAX_OUTPUT=HVP_PROJECTION_PACKET_LIMIT;
export interface HvpNeighborPayload {
  readonly epoch:number;readonly primaryRevision:number;readonly eastRevision:number;
  readonly primaryDigest:string;readonly eastDigest:string;readonly lod:.125|.5;readonly key:string;
}
export const validateHvpNeighborPayload=(value:unknown):HvpNeighborPayload=>{
  const p=value as HvpNeighborPayload|null;
  if(!p||Object.keys(p).sort().join(",")!=="eastDigest,eastRevision,epoch,key,lod,primaryDigest,primaryRevision"
    ||!Number.isSafeInteger(p.epoch)||p.epoch<1||![p.primaryDigest,p.eastDigest].every(d=>typeof d==="string"&&/^[0-9a-f]{8}$/.test(d))
    ||(p.lod!==.125&&p.lod!==.5)||typeof p.key!=="string"||p.key.length<1||p.key.length>512){throw new Error("Invalid neighbour projection binding");}
  contentRevision(p.primaryRevision);contentRevision(p.eastRevision);return p;
};
const identity=(p:HvpNeighborPayload)=>[p.epoch,p.primaryRevision,p.eastRevision,p.primaryDigest,p.eastDigest,p.lod,p.key];
export const hvpNeighborInputDigest=(p:HvpNeighborPayload,buffers:readonly ArrayBuffer[])=>fnv1aHash(JSON.stringify([...identity(p),fnv1aBytes(buffers)]));
export const validateHvpNeighborRequest=(request:WorkerJobRequest,input:TransferableBufferBundle)=>{
  const p=validateHvpNeighborPayload(request.payload);
  if(request.jobKind!==HVP_NEIGHBOR_JOB||request.algorithmVersion!==1||request.inputRevision!==p.eastRevision||input.revision!==p.eastRevision
    ||request.estimatedOutputBytes!==HVP_NEIGHBOR_MAX_OUTPUT||input.buffers.length!==3||input.views.length!==3
    ||input.buffers[0]!.byteLength!==8_388_608||input.buffers[1]!.byteLength!==8_388_608||input.buffers[2]!.byteLength>HVP_PROJECTION_PACKET_LIMIT
    ||input.views.some((v,i)=>v.name!==["primary","east","proxies"][i]||v.kind!=="Uint8Array"||v.bufferIndex!==i||v.byteOffset!==0||v.elementCount!==input.buffers[i]!.byteLength)
    ||request.sourceInputDigest!==hvpNeighborInputDigest(p,input.buffers)){throw new Error("Neighbour projection input mismatch");}
  return p;
};
export const hvpNeighborProjectionDigest=(p:HvpNeighborPayload)=>fnv1aHash(JSON.stringify(["hvp-east-products-v1",p.primaryDigest,p.eastDigest,p.lod]));
export const decodeHvpNeighborOutput=(output:TransferableBufferBundle,p:HvpNeighborPayload)=>{
  const b=validateTransferableBundle(output),v=b.views[0];
  if(b.ownership!=="WorkerToConsumer"||b.revision!==p.eastRevision||b.buffers.length!==1||b.views.length!==1||b.byteLength>HVP_NEIGHBOR_MAX_OUTPUT
    ||v?.name!=="projections"||v.kind!=="Uint8Array"||v.bufferIndex!==0||v.byteOffset!==0||v.elementCount!==b.buffers[0]!.byteLength){throw new Error("Invalid neighbour output layout");}
  const digest=hvpNeighborProjectionDigest(p),meshes=decodeHvpProjectionPacket(b.buffers[0]!,digest),n=p.lod===.125?2:3;
  if(meshes.length!==n+4){throw new Error("Incomplete neighbour projections");}
  return Object.freeze({digest,lod:p.lod,region:Object.freeze(meshes.slice(0,n)),waterPatch:meshes[n]!,join:meshes[n+1]!,far:meshes[n+2]!,water:meshes[n+3]!,
    sourceBytes:8_388_608,projectionBytes:p.lod===.5?131_072:0});
};
export const executeHvpNeighborJob=(request:WorkerJobRequest,bundle:TransferableBufferBundle)=>{
  const input=validateTransferableBundle(bundle),p=validateHvpNeighborRequest(request,input);
  const source=(buffer:ArrayBuffer,x:number,sourceDigest:string)=>{
    const slots=new Uint8Array(buffer);if(slots.some(n=>n>4)){throw new Error("Missing or invalid canonical neighbour slots");}
    return {sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,sourceDigest,originMeters:{x,y:-8,z:-16},
      readSlot:(x:number,y:number,z:number)=>x<0||x>=256||y<0||y>=128||z<0||z>=256?undefined:slots[x+y*256+z*32768]};
  };
  const proxies=decodeHvpProjectionPacket(input.buffers[2]!,p.primaryDigest);
  if(proxies.length!==3){throw new Error("Missing base projection products");}
  const value=buildHvpNeighborProducts(source(input.buffers[0]!,-16,p.primaryDigest),source(input.buffers[1]!,16,p.eastDigest),p.lod,
    {join:proxies[0]!,far:proxies[1]!,water:proxies[2]!});
  const buffer=encodeHvpProjectionPacket([...value.region,value.waterPatch,value.join,value.far,value.water]),buffers=[buffer];
  const output:TransferableBufferBundle={buffers,ownership:"WorkerToConsumer",revision:contentRevision(p.eastRevision),byteLength:byteCount(buffer.byteLength),
    contentHash:fnv1aBytes(buffers),views:[{name:"projections",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:buffer.byteLength}]};
  decodeHvpNeighborOutput(output,p);
  const result:WorkerJobResult={jobId:request.jobId,targetKey:request.targetKey,workerEpoch:request.workerEpoch,planningEpoch:request.planningEpoch,
    inputRevision:request.inputRevision,sourceInputDigest:request.sourceInputDigest,outputRevision:output.revision,algorithmVersion:request.algorithmVersion,outputBytes:output.byteLength,contentHash:output.contentHash};
  return {result,bundle:output};
};
