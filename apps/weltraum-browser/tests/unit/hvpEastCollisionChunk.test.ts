import {expect,it,vi} from "vitest";
import * as chunks from "../../src/workers/hvpChunkJob";
import * as renderMesher from "../../src/hvp/hvpCoastMesher";
import {buildHvpChunkInput} from "../../src/hestia-prototype/terrain/terrainChunkInput";
import type {HvpTerrainSnapshot} from "../../src/hestia-prototype/terrain/cutPlan";
import {algorithmVersion,byteCount,contentRevision,jobDeadline,planningEpoch,workerEpoch,workerJobId,workerJobKind,workerTargetKey} from "../../src/workers/ids";
import {snapshotWorkerJobRequest,type TransferableBufferBundle,type WorkerJobRequest} from "../../src/workers/protocol";

const prepare=(read:(x:number,y:number,z:number)=>number,id=0)=>{
  const primary:HvpTerrainSnapshot={sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
    sessionId:"primary",epoch:2,revision:3,sourceDigest:"12345678",baseDigest:"87654321",overlayBytes:0,
    readSlot:read,copyLeaf:()=>new Uint8Array(4096),leafRevision:()=>0};
  const east={...primary,originMeters:{x:16,y:-8,z:-16},sessionId:"east",sourceDigest:"11223344"};
  const built=buildHvpChunkInput(east,id,read,"render:primary:exact-halo",east.sessionId,primary),buffers=[built.slots.buffer as ArrayBuffer];
  const input:TransferableBufferBundle={buffers,ownership:"SenderToWorker",revision:contentRevision(3),byteLength:byteCount(34**3),
    views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:34**3}]};
  const combined:WorkerJobRequest={jobId:workerJobId("east-test"),targetKey:workerTargetKey(`chunk-${id}`),jobKind:workerJobKind(chunks.HVP_CHUNK_JOB),
    workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(3),sourceInputDigest:chunks.hvpChunkInputDigest(built.payload,buffers),
    algorithmVersion:algorithmVersion(1),priority:"Urgent",deadline:jobDeadline(0),estimatedInputBytes:input.byteLength,
    estimatedOutputBytes:byteCount(chunks.HVP_CHUNK_MAX_OUTPUT),payload:built.payload};
  const payload:chunks.HvpEastChunkCollisionPayload={...built.payload,purpose:chunks.HVP_EAST_CHUNK_COLLISION_PURPOSE};
  const request={...combined,jobKind:workerJobKind(chunks.HVP_EAST_CHUNK_COLLISION_JOB),algorithmVersion:algorithmVersion(chunks.HVP_EAST_CHUNK_COLLISION_ALGORITHM),
    estimatedOutputBytes:byteCount(chunks.HVP_EAST_CHUNK_COLLISION_MAX_OUTPUT),payload,sourceInputDigest:chunks.hvpEastChunkCollisionInputDigest(payload,buffers)};
  return {input,payload,request,combined,combinedPayload:built.payload,east};
};
it("retains exact collision geometry without deriving or claiming a render product",()=>{
  const render=vi.spyOn(renderMesher,"meshHvpOccupancy");
  try{
    for(const [id,read] of [[0,()=>0],[0,()=>1],[7,()=>4],[248,()=>2],
      [41,(x:number,y:number,z:number)=>y===33&&(x+z)%2===0?3:0]] as const){
      const p=prepare(read,id),expected=chunks.decodeHvpChunkOutput(chunks.executeHvpChunkJob(p.combined,p.input).bundle,p.combinedPayload).collision;
      render.mockClear();const result=chunks.executeHvpEastChunkCollisionJob(p.request,p.input),actual=chunks.decodeHvpEastChunkCollisionOutput(result.bundle,p.payload);
      expect(actual).toEqual(expected);expect(render.mock.calls.filter(args=>args[3]==="hvp-terrain-chunk-v1")).toHaveLength(0);
      expect(result.bundle.buffers).toHaveLength(2);
      expect(new Set(result.bundle.buffers).size).toBe(2);expect(result.bundle.views.map(v=>v.name)).toEqual(["vertices","indices"]);
      expect(result.result.algorithmVersion).toBe(chunks.HVP_EAST_CHUNK_COLLISION_ALGORITHM);
      expect(()=>chunks.decodeHvpChunkOutput(result.bundle,p.combinedPayload)).toThrow();
    }
  }finally{render.mockRestore();}
});
it("binds exact East purpose, algorithm, generation and every original manifest field",()=>{
  const p=prepare(()=>1),snapshot=snapshotWorkerJobRequest(p.request);
  expect(chunks.hvpEastChunkCollisionInputDigest(snapshot.payload as typeof p.payload,p.input.buffers)).toBe(p.request.sourceInputDigest);
  expect(p.request.sourceInputDigest).not.toBe(p.combined.sourceInputDigest);
  for(const changed of [{purpose:"render-and-collision"},{worldId:"foreign"},{sessionId:"foreign"},{epoch:3},{generation:4},
    {sourceDigest:"foreign"},{baseDigest:"foreign"},{materialDigest:"foreign"},{haloBinding:"foreign"},
    {physicalHalo:"closed-exterior",haloNeighbor:null},{haloNeighbor:{...p.payload.haloNeighbor!,generation:4}},
    {sourceOrigin:{x:-16,y:-8,z:-16}},{sizeX:64},{haloWidth:2},{coreOrigin:[1,0,0]}]){
    expect(()=>chunks.executeHvpEastChunkCollisionJob({...p.request,payload:{...p.payload,...changed}},p.input)).toThrow();
  }
  for(const changed of [{algorithmVersion:algorithmVersion(1)},{jobKind:workerJobKind(chunks.HVP_CHUNK_JOB)},
    {sourceInputDigest:p.combined.sourceInputDigest},{inputRevision:contentRevision(4)},{estimatedOutputBytes:byteCount(chunks.HVP_CHUNK_MAX_OUTPUT)}]){
    expect(()=>chunks.executeHvpEastChunkCollisionJob({...p.request,...changed},p.input)).toThrow();
  }
  expect(()=>chunks.executeHvpChunkJob(p.request,p.input)).toThrow();
  expect(()=>chunks.executeHvpEastChunkCollisionJob(p.combined,p.input)).toThrow();
  const output=chunks.executeHvpEastChunkCollisionJob(p.request,p.input).bundle;
  expect(()=>chunks.decodeHvpEastChunkCollisionOutput(output,{...p.payload,purpose:"foreign"} as unknown as typeof p.payload)).toThrow();
  expect(()=>chunks.decodeHvpEastChunkCollisionOutput(output,{...p.payload,generation:4})).toThrow();
});
it("rejects late Unknown/material, mutable buffers and out-of-bounds output",()=>{
  const p=prepare(()=>1);new Uint8Array(p.input.buffers[0]!)[34**3-1]=255;
  const invalid={...p.request,sourceInputDigest:chunks.hvpEastChunkCollisionInputDigest(p.payload,p.input.buffers)};
  expect(()=>chunks.executeHvpEastChunkCollisionJob(invalid,p.input)).toThrow(/material/);
  new Uint8Array(p.input.buffers[0]!)[34**3-1]=1;
  const output=chunks.executeHvpEastChunkCollisionJob(p.request,p.input).bundle;
  new Float32Array(output.buffers[0]!)[0]=1000;
  expect(()=>chunks.decodeHvpEastChunkCollisionOutput(output,p.payload)).toThrow(/geometry/);
  const Resizable=ArrayBuffer as unknown as new(length:number,options:{maxByteLength:number})=>ArrayBuffer;
  expect(()=>chunks.hvpEastChunkCollisionInputDigest(p.payload,[new Resizable(34**3,{maxByteLength:34**3*2})])).toThrow(/fixed/);
  expect(()=>buildHvpChunkInput({...p.east,readSlot:()=>undefined},0,()=>undefined,"unknown")).toThrow(/coverage|Unknown/i);
});
