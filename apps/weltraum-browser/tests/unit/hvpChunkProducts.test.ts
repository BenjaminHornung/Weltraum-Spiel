import {expect,it,vi} from "vitest";
import * as renderMesher from "../../src/hvp/hvpCoastMesher";
import * as collisionMesher from "../../src/hestia-prototype/physics/terrainColliders";
import {buildHvpChunkInput} from "../../src/hestia-prototype/terrain/terrainChunkInput";
import type {HvpTerrainSnapshot} from "../../src/hestia-prototype/terrain/cutPlan";
import {HVP_CHUNK_JOB,HVP_CHUNK_MAX_OUTPUT,executeHvpChunkJob,decodeHvpChunkOutput,hvpChunkInputDigest} from "../../src/workers/hvpChunkJob";
import {algorithmVersion,byteCount,contentRevision,jobDeadline,planningEpoch,workerEpoch,workerJobId,workerJobKind,workerTargetKey} from "../../src/workers/ids";
import {snapshotWorkerJobRequest,type TransferableBufferBundle,type WorkerJobRequest} from "../../src/workers/protocol";
import {validateHvpChunkPayload,validateHvpChunkRequest} from "../../src/workers/hvpChunkJob";
import {packHvpTerrainMeshSteps} from "../../src/workers/hvpTerrainJob";

const prepare=(read:(x:number,y:number,z:number)=>number,id=0,neighbor?:HvpTerrainSnapshot)=>{
  const s:HvpTerrainSnapshot={sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
    sessionId:"chunk-products",epoch:2,revision:3,sourceDigest:"12345678",baseDigest:"87654321",overlayBytes:0,
    readSlot:read,copyLeaf:()=>new Uint8Array(4096),leafRevision:()=>0};
  const {slots,payload}=buildHvpChunkInput(s,id,read,"explicit-halo-v1",s.sessionId,neighbor),buffers=[slots.buffer as ArrayBuffer];
  const input:TransferableBufferBundle={buffers,ownership:"SenderToWorker",revision:contentRevision(3),byteLength:byteCount(slots.byteLength),
    views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
  const request:WorkerJobRequest={jobId:workerJobId("chunk-test"),targetKey:workerTargetKey("chunk-0"),jobKind:workerJobKind(HVP_CHUNK_JOB),
    workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(3),sourceInputDigest:hvpChunkInputDigest(payload,buffers),
    algorithmVersion:algorithmVersion(1),priority:"Urgent",deadline:jobDeadline(0),estimatedInputBytes:input.byteLength,
    estimatedOutputBytes:byteCount(HVP_CHUNK_MAX_OUTPUT),payload};
  return {payload,input,request};
};
it.each(["east","west"] as const)("keeps complete %s halo binding across canonical request snapshots",side=>{
  const neighbor:HvpTerrainSnapshot={sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:side==="east"?16:-48,y:-8,z:-16},
    sessionId:"neighbor",epoch:1,revision:2,sourceDigest:"11223344",baseDigest:"55667788",overlayBytes:0,readSlot:()=>0,copyLeaf:()=>new Uint8Array(4096),leafRevision:()=>0};
  const p=prepare(()=>0,side==="east"?7:0,neighbor),snapshot=snapshotWorkerJobRequest(p.request);
  expect(hvpChunkInputDigest(snapshot.payload as typeof p.payload,p.input.buffers)).toBe(p.request.sourceInputDigest);
  expect(()=>validateHvpChunkRequest(snapshot,p.input)).not.toThrow();
  const changed=snapshotWorkerJobRequest({...p.request,payload:{...p.payload,haloNeighbor:{...p.payload.haloNeighbor!,sourceDigest:"99887766"}}});
  expect(()=>validateHvpChunkRequest(changed,p.input)).toThrow("Chunk input binding mismatch");
});

it("uses one material halo for render AO and binary collision, and never emits halo-owned cells",()=>{
  const alone=prepare((x,y,z)=>x===0&&y===0&&z===0?1:0);
  const shadow=prepare((x,y,z)=>x===0&&y===0&&z===0?1:x===-1&&y===-1&&z===0?1:0);
  const a=decodeHvpChunkOutput(executeHvpChunkJob(alone.request,alone.input).bundle,alone.payload);
  const b=decodeHvpChunkOutput(executeHvpChunkJob(shadow.request,shadow.input).bundle,shadow.payload);
  expect(a.render.unitFaceCount).toBe(6);expect(b.render.unitFaceCount).toBe(6);
  expect(b.render.colors).not.toEqual(a.render.colors);expect(b.collision).toEqual(a.collision);
  const ghost=prepare((x,y,z)=>x===-1&&y===10&&z===10?4:0);
  const empty=decodeHvpChunkOutput(executeHvpChunkJob(ghost.request,ghost.input).bundle,ghost.payload);
  expect(empty.render.indices).toHaveLength(0);expect(empty.collision.indices).toHaveLength(0);
  expect(empty.render.boundsMeters).toEqual({min:{x:-16,y:-8,z:-16},max:{x:-12,y:-4,z:-12}});
});
it("skips both mesh scans only after a complete all-air halo has passed every input check",()=>{
  const p=prepare(()=>0),render=vi.spyOn(renderMesher,"meshHvpOccupancy"),collision=vi.spyOn(collisionMesher,"meshCollisionInput");
  try{
    const output=executeHvpChunkJob(p.request,p.input),products=decodeHvpChunkOutput(output.bundle,p.payload);
    expect(products.render.indices).toHaveLength(0);expect(products.collision.indices).toHaveLength(0);
    expect(output.bundle.buffers).toHaveLength(8);expect(new Set(output.bundle.buffers).size).toBe(8);
    expect(render).not.toHaveBeenCalled();expect(collision).not.toHaveBeenCalled();
    new Uint8Array(p.input.buffers[0]!)[34**3-1]=255;
    const lateInvalid={...p.request,sourceInputDigest:hvpChunkInputDigest(p.payload,p.input.buffers)};
    expect(()=>executeHvpChunkJob(lateInvalid,p.input)).toThrow(/Invalid chunk material/);
  }finally{render.mockRestore();collision.mockRestore();}
});
it("keeps both explicit Empty outputs and pure chunk-split surface equivalence",()=>{
  for(const read of [()=>0,()=>1]){
    const p=prepare(read,41),result=executeHvpChunkJob(p.request,p.input),mesh=decodeHvpChunkOutput(result.bundle,p.payload);
    expect(result.bundle.buffers).toHaveLength(8);expect(new Set(result.bundle.buffers).size).toBe(8);
    expect(mesh.render.indices).toHaveLength(0);expect(mesh.collision.indices).toHaveLength(0);
  }
  const read=(x:number,y:number,z:number)=>y===10&&z===10&&(x===31||x===32)?2:0;
  let faces=0;
  for(const id of [0,1]){const p=prepare(read,id),mesh=decodeHvpChunkOutput(executeHvpChunkJob(p.request,p.input).bundle,p.payload);
    faces+=mesh.render.unitFaceCount;expect(mesh.collision.indices.length/6).toBe(5);}
  expect(faces).toBe(10);
});
it("retains legacy closed World boundary contacts while authored render ghosts occlude the view",()=>{
  const p=prepare(()=>1),products=decodeHvpChunkOutput(executeHvpChunkJob(p.request,p.input).bundle,p.payload);
  expect(products.render.indices).toHaveLength(0);
  // -X/-Y/-Z are physical World boundaries; internal chunk faces remain culled.
  expect(products.collision.indices).toHaveLength(18);
});
it("culls only confirmed neighbour contacts and binds every neighbour identity field",()=>{
  const neighbor:HvpTerrainSnapshot={sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:16,y:-8,z:-16},
    sessionId:"chunk-east",epoch:4,revision:5,sourceDigest:"east1234",baseDigest:"eastbase",overlayBytes:0,
    readSlot:()=>1,copyLeaf:()=>new Uint8Array(4096),leafRevision:()=>0};
  const p=prepare(()=>1,7,neighbor),products=decodeHvpChunkOutput(executeHvpChunkJob(p.request,p.input).bundle,p.payload);
  expect(p.payload.physicalHalo).toBe("east");expect(products.collision.indices).toHaveLength(12);
  for(const changed of [{sessionId:"foreign"},{epoch:6},{generation:7},{sourceDigest:"foreign"},{baseDigest:"foreign"},
    {originMeters:{x:48,y:-8,z:-16}}]){
    expect(()=>executeHvpChunkJob({...p.request,payload:{...p.payload,haloNeighbor:{...p.payload.haloNeighbor,...changed}}},p.input)).toThrow();
  }
  expect(()=>validateHvpChunkPayload({...p.payload,physicalHalo:"closed-exterior"})).toThrow(/halo/i);
});
it("rejects changed identities, halo/material/layout versions and malformed geometry",()=>{
  const p=prepare((x,y,z)=>x===0&&y===0&&z===0?1:0);
  for(const changed of [{worldId:"foreign"},{sessionId:"foreign"},{epoch:3},{generation:4},{sourceDigest:"foreign"},{baseDigest:"foreign"},
    {renderVersion:"foreign"},{collisionVersion:"foreign"},
    {materialDigest:"foreign"},{haloBinding:"foreign"},{chunk:1},{haloWidth:2},{coreOrigin:[1,0,0]},
    {originMeters:{x:-15,y:-8,z:-16}}]){
    expect(()=>executeHvpChunkJob({...p.request,payload:{...p.payload,...changed}},p.input)).toThrow();
  }
  const output=executeHvpChunkJob(p.request,p.input).bundle;
  new Uint32Array(output.buffers[7]!)[0]=0xffffffff;
  expect(()=>decodeHvpChunkOutput(output,p.payload)).toThrow(/geometry/i);
});
it("rejects sparse and inherited manifest coordinates",()=>{
  const p=prepare(()=>0);
  expect(()=>validateHvpChunkPayload({...p.payload,coreOrigin:new Array(3)})).toThrow(/coverage/i);
  const inherited=new Array(3);Object.setPrototypeOf(inherited,{0:0,1:0,2:0});
  expect(()=>validateHvpChunkPayload({...p.payload,coreOrigin:inherited})).toThrow(/coverage/i);
});
it("rejects resizable input/output buffers before hashing",()=>{
  const p=prepare(()=>0);
  const Resizable=ArrayBuffer as unknown as new(length:number,options:{maxByteLength:number})=>ArrayBuffer;
  const input=new Resizable(34**3,{maxByteLength:34**3*2});
  expect(()=>executeHvpChunkJob(p.request,{...p.input,buffers:[input]})).toThrow(/fixed/i);
  const output=executeHvpChunkJob(p.request,p.input).bundle;
  const buffers=[...output.buffers];buffers[0]=new Resizable(0,{maxByteLength:4096});
  expect(()=>decodeHvpChunkOutput({...output,buffers},p.payload)).toThrow(/fixed/i);
});
it("reads legacy output generation only after pack allocations and yields",()=>{
  const p=prepare((x,y,z)=>x>=0&&x<16&&z>=0&&z<16&&y===1&&(x+z)%2===0?1:0);
  const mesh=decodeHvpChunkOutput(executeHvpChunkJob(p.request,p.input).bundle,p.payload).render;
  let reads=0;const pack=packHvpTerrainMeshSteps(mesh,()=>{reads+=1;return 3;},()=>{});
  expect(reads).toBe(0);let packYields=0;for(;;){const step=pack.next();if(step.done){break;}
    if(step.value.startsWith("terrainPack")){packYields+=1;expect(reads).toBe(0);}else{expect(reads).toBe(1);}}
  expect(packYields).toBeGreaterThan(0);expect(reads).toBe(1);
});
