import { fnv1aHash } from "../core/hash";
import { meshHvpOccupancy, type HvpCompactMesh } from "../hvp/hvpCoastMesher";
import { byteCount, contentRevision } from "./ids";
import { fnv1aBytes, validateTransferableBundle, type TransferableBufferBundle, type WorkerJobRequest, type WorkerJobResult } from "./protocol";

export const HVP_TERRAIN_JOB = "BuildHvpTerrainSector";
export const HVP_TERRAIN_MAX_OUTPUT = 8 * 1024 * 1024;
export interface HvpTerrainPayload {
  readonly sessionId: string; readonly epoch: number; readonly sector: number;
  readonly generation: number; readonly sourceDigest: string;
}
export const validateHvpTerrainPayload = (value: unknown): HvpTerrainPayload => {
  const p = value as HvpTerrainPayload | null;
  if (p === null || typeof p !== "object" || !/^[A-Za-z0-9:._-]{1,128}$/.test(p.sessionId)
    || !Number.isSafeInteger(p.epoch) || p.epoch < 0 || !Number.isSafeInteger(p.sector) || p.sector < 0 || p.sector >= 16
    || typeof p.sourceDigest !== "string" || p.sourceDigest.length < 1 || p.sourceDigest.length > 128) {
    throw new RangeError("Invalid HVP terrain job identity");
  }
  contentRevision(p.generation);
  return p;
};
export const hvpTerrainInputDigest = (p: HvpTerrainPayload, buffers: readonly ArrayBuffer[]): string =>
  fnv1aHash(JSON.stringify([p.sessionId,p.epoch,p.sector,p.generation,p.sourceDigest,fnv1aBytes(buffers)]));
export const validateHvpTerrainRequest = (request: WorkerJobRequest, input: TransferableBufferBundle): HvpTerrainPayload => {
  const p = validateHvpTerrainPayload(request.payload);
  const v = input.views[0];
  if (request.jobKind !== HVP_TERRAIN_JOB || request.algorithmVersion !== 1 || request.inputRevision !== p.generation
    || request.estimatedOutputBytes !== HVP_TERRAIN_MAX_OUTPUT || input.buffers.length !== 1 || input.views.length !== 1
    || input.byteLength !== 66*130*66 || v?.kind !== "Uint8Array" || v.name !== "slots" || v.bufferIndex !== 0
    || v.byteOffset !== 0 || v.elementCount !== 66*130*66 || request.sourceInputDigest !== hvpTerrainInputDigest(p,input.buffers)) {
    throw new RangeError("HVP terrain input binding mismatch");
  }
  return p;
};
const names = ["positions", "normals", "colors", "indices", "ranges", "metrics"] as const;
const kinds = ["Float32Array", "Float32Array", "Float32Array", "Uint32Array", "Uint32Array", "Float64Array"] as const;
export const decodeHvpTerrainOutput = (output: TransferableBufferBundle, p: HvpTerrainPayload): HvpCompactMesh => {
  const b = validateTransferableBundle(output);
  if (b.buffers.length !== 6 || b.views.length !== 6 || b.byteLength > HVP_TERRAIN_MAX_OUTPUT
    || b.ownership !== "WorkerToConsumer" || b.revision !== p.generation) { throw new Error("Invalid HVP terrain output binding"); }
  for (let i=0;i<6;i+=1) {
    const v=b.views[i]!;
    if (v.name!==names[i] || v.kind!==kinds[i] || v.bufferIndex!==i || v.byteOffset!==0
      || v.elementCount*(i===5?8:4)!==b.buffers[i]!.byteLength) { throw new Error("Invalid HVP terrain output layout"); }
  }
  const positions=new Float32Array(b.buffers[0]!), normals=new Float32Array(b.buffers[1]!), colors=new Float32Array(b.buffers[2]!);
  const indices=new Uint32Array(b.buffers[3]!), ranges=new Uint32Array(b.buffers[4]!), metrics=new Float64Array(b.buffers[5]!);
  const min=[-16+(p.sector%4)*8,-8,-16+Math.floor(p.sector/4)*8], max=[min[0]!+8,8,min[2]!+8];
  if (positions.length%12!==0 || indices.length%6!==0 || normals.length!==positions.length || colors.length!==positions.length
    || positions.some((v,i)=>!Number.isFinite(v)||!Number.isInteger(v*8)||v<min[i%3]!||v>max[i%3]!)
    || normals.some(v=>v!==0&&v!==1&&v!==-1) || colors.some(v=>!Number.isFinite(v)||v<0||v>1)
    || indices.some(v=>v>=positions.length/3) || ranges.length%3!==0 || metrics.length!==5
    || metrics.some(v=>!Number.isSafeInteger(v)||v<0) || metrics[0]!==indices.length/6 || positions.length!==metrics[0]!*12) {
    throw new Error("Invalid HVP terrain output geometry");
  }
  const materialRanges = [];
  let cursor=0;
  for(let i=0;i<ranges.length;i+=3) {
    const slot=ranges[i]!,startIndex=ranges[i+1]!,indexCount=ranges[i+2]!;
    if(slot<1||slot>4||startIndex!==cursor||indexCount===0||indexCount%6!==0) { throw new Error("Invalid terrain material range"); }
    materialRanges.push({slot,startIndex,indexCount}); cursor+=indexCount;
  }
  if(cursor!==indices.length) { throw new Error("Incomplete terrain material ranges"); }
  return { positions,normals,colors,indices,materialRanges,faceCount:metrics[0]!,unitFaceCount:metrics[1]!,outerFaceCount:metrics[2]!,
    cavityFaceCount:metrics[3]!,tempEstimateBytes:metrics[4]!,sourceDigest:p.sourceDigest,algorithmVersion:"hvp-terrain-sector-v1",
    boundsMeters:{min:{x:min[0]!,y:min[1]!,z:min[2]!},max:{x:max[0]!,y:max[1]!,z:max[2]!}} };
};
export const executeHvpTerrainJob = (request: WorkerJobRequest, bundle: TransferableBufferBundle) => {
  const input=validateTransferableBundle(bundle), p=validateHvpTerrainRequest(request,input);
  const slots=new Uint8Array(input.buffers[0]!);
  if(slots.some(v=>v>4)) { throw new Error("Unknown terrain material slot"); }
  const slotAt=(x:number,y:number,z:number)=>slots[x+1+(y+1)*66+(z+1)*66*130]!;
  const mesh=meshHvpOccupancy({sizeX:64,sizeY:128,sizeZ:64,cellMeters:0.125,
    originMeters:{x:-16+p.sector%4*8,y:-8,z:-16+Math.floor(p.sector/4)*8},slotAt,ghostSlotAt:slotAt},
    {maxVisitedCells:524288,maxQuads:100000,maxVertices:400000,maxIndices:600000},p.sourceDigest,"hvp-terrain-sector-v1",{ao:true});
  const ranges=new Uint32Array(mesh.materialRanges.flatMap(r=>[r.slot,r.startIndex,r.indexCount]));
  const metrics=new Float64Array([mesh.faceCount,mesh.unitFaceCount,mesh.outerFaceCount,mesh.cavityFaceCount,mesh.tempEstimateBytes]);
  const arrays=[mesh.positions,mesh.normals,mesh.colors!,new Uint32Array(mesh.indices),ranges,metrics];
  const buffers=arrays.map(a=>a.buffer as ArrayBuffer), bytes=buffers.reduce((n,b)=>n+b.byteLength,0);
  if(bytes>HVP_TERRAIN_MAX_OUTPUT) { throw new Error("Terrain output BudgetExceeded"); }
  const output:TransferableBufferBundle={buffers,ownership:"WorkerToConsumer",revision:contentRevision(p.generation),byteLength:byteCount(bytes),
    contentHash:fnv1aBytes(buffers),views:arrays.map((a,i)=>({name:names[i]!,kind:kinds[i]!,bufferIndex:i,byteOffset:0,elementCount:a.length}))};
  decodeHvpTerrainOutput(output,p);
  const result:WorkerJobResult={jobId:request.jobId,targetKey:request.targetKey,workerEpoch:request.workerEpoch,planningEpoch:request.planningEpoch,
    inputRevision:request.inputRevision,sourceInputDigest:request.sourceInputDigest,outputRevision:contentRevision(p.generation),
    algorithmVersion:request.algorithmVersion,outputBytes:output.byteLength,contentHash:output.contentHash};
  return {result,bundle:output};
};
