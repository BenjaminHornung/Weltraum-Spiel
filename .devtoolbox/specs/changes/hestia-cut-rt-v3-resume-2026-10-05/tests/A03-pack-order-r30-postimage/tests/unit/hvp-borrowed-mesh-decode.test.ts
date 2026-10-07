import {expect,it,vi} from "vitest";
import type {HvpBodyChildProjection} from "../../src/hestia-prototype/physics/bodyCutSession";
import {buildHvpBodyMeshInput,buildHvpBodyMeshInputSteps,executeHvpBodyMeshJob,decodeHvpBodyMeshOutput,decodeHvpBodyMeshOutputSteps,
  HVP_BODY_MESH_JOB,HVP_BODY_MESH_ALGORITHM,HVP_BODY_MESH_MAX_OUTPUT} from "../../src/workers/hvpBodyMeshJob";
import {algorithmVersion,byteCount,contentRevision,jobDeadline,planningEpoch,workerEpoch,workerJobId,workerJobKind,workerTargetKey} from "../../src/workers/ids";
import {fnv1aBytes,type WorkerJobRequest} from "../../src/workers/protocol";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";
import * as protocol from "../../src/workers/protocol";

// Plain owner-projection DATA only: neither this fixture nor the decoder issues a native/source plan.
const fixture=async()=>{
  const projection:HvpBodyChildProjection=Object.freeze({sessionId:"decode-session",epoch:0,commandId:"decode-cut",ownerId:"decode-parent",
    sourceId:"decode-source",sourceDigest:"fnv1a64-v1:0000000000000001",revision:0,issuedTick:7,removedCells:1,removedMassKg:1,
    parts:Object.freeze([Object.freeze({ownerId:"decode-source:r1:p0",sourceDigest:"fnv1a64-v1:0000000000000002",center:Object.freeze({x:16,y:.0625,z:.0625}),
      massKg:257,sourceBytes:8192,cells:Object.freeze(Array.from({length:257},(_,x)=>Object.freeze({x,y:0,z:0,materialId:x%2?65535:1})))})])});
  const packed=buildHvpBodyMeshInput(projection),request:WorkerJobRequest={jobId:workerJobId("decode-mesh"),jobKind:workerJobKind(HVP_BODY_MESH_JOB),targetKey:workerTargetKey(projection.ownerId),
    planningEpoch:planningEpoch(0),workerEpoch:workerEpoch(0),inputRevision:contentRevision(0),sourceInputDigest:packed.sourceInputDigest,
    algorithmVersion:algorithmVersion(HVP_BODY_MESH_ALGORITHM),priority:"Urgent",deadline:jobDeadline(1),estimatedInputBytes:packed.input.byteLength,
    estimatedOutputBytes:byteCount(HVP_BODY_MESH_MAX_OUTPUT),payload:packed.payload};
  const output=(await executeHvpBodyMeshJob(request,packed.input,{assertCurrent:()=>{},yieldTask:()=>new Promise<void>(resolve=>setTimeout(resolve,0))})).bundle;
  return {projection,request,output};
};
const finish=<T>(steps:Generator<string,T,unknown>)=>{
  const labels=new Set<string>();try{for(;;){const step=steps.next();if(step.done){return {value:step.value,labels};}labels.add(step.value);}}
  finally{steps.return(undefined as never);}
};
it("preserves all mixed/wide cell IDs and exact decoded mesh bytes while charging one retained parent",async()=>{
  const f=await fixture(),ledger=createStructuralOwnerLedger(32*1024*1024),expected=decodeHvpBodyMeshOutput(f.request,f.projection,f.output);
  try{const actual=finish(decodeHvpBodyMeshOutputSteps(f.request,f.projection,f.output,ledger.reserve));
    expect(actual.value).toEqual(expected);expect(actual.labels).toContain("transferHash");expect(actual.labels).toContain("meshDecode");
    for(const field of ["positions","normals","colors","indices"] as const){
      const a=actual.value.parts[0]!.mesh[field]!,b=expected.parts[0]!.mesh[field]!;
      expect(a.constructor).toBe(b.constructor);expect(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).toEqual(new Uint8Array(b.buffer,b.byteOffset,b.byteLength));
    }
    expect(ledger.resources.reservedBytes).toBeGreaterThan(0);expect(ledger.resources.retainedEstimateBytes).toBeGreaterThan(0);
  }finally{ledger.release();}
});
it("preserves the original malformed-index rejection even when the attacker recomputes the packet hash",async()=>{
  const f=await fixture(),buffers=f.output.buffers.map(buffer=>buffer.slice(0));new Uint32Array(buffers[5]!)[0]=0xffffffff;
  const bad={...f.output,buffers,contentHash:fnv1aBytes(buffers)},ledger=createStructuralOwnerLedger(32*1024*1024);let first:Error|undefined;
  try{decodeHvpBodyMeshOutput(f.request,f.projection,bad);}catch(error){if(!(error instanceof Error)){throw error;}first=error;}
  expect(first?.message).toBe("Body-mesh index exceeds its part span");
  try{expect(()=>finish(decodeHvpBodyMeshOutputSteps(f.request,f.projection,bad,ledger.reserve))).toThrow(first!.message);}
  finally{ledger.release();}
});
it("rejects a parent reserve failure before creating decoded products",async()=>{
  const f=await fixture(),first=new Error("decode parent credit failed");let calls=0;
  expect(()=>finish(decodeHvpBodyMeshOutputSteps(f.request,f.projection,f.output,()=>{calls+=1;throw first;}))).toThrow(first);
  expect(calls).toBe(1);
});
it("closes mid-decode scratch without releasing the shared parent or publishing a partial product",async()=>{
  const f=await fixture(),ledger=createStructuralOwnerLedger(32*1024*1024),steps=decodeHvpBodyMeshOutputSteps(f.request,f.projection,f.output,ledger.reserve);
  try{expect(steps.next().done).toBe(false);expect(ledger.resources.reservedBytes).toBeGreaterThan(0);
    expect(steps.return(undefined as never)).toEqual({done:true,value:undefined});expect(steps.next()).toEqual({done:true,value:undefined});
    expect(ledger.resources.reservedBytes).toBeGreaterThan(0);
  }finally{steps.return(undefined as never);ledger.release();}
});
it("rejects an oversized zero-byte channel list before the generic metadata maps can allocate it",async()=>{
  const f=await fixture(),count=16384,buffers=Array.from({length:count},()=>new ArrayBuffer(0));
  const bad={...f.output,buffers,byteLength:byteCount(0),contentHash:"811c9dc5",views:buffers.map((_,index)=>({name:`oversized-${index}`,
    kind:"Uint8Array" as const,bufferIndex:index,byteOffset:0,elementCount:0}))};
  expect(()=>decodeHvpBodyMeshOutput(f.request,f.projection,bad)).toThrow("Invalid body-cut binary layout");
  const validate=vi.spyOn(protocol,"validateTransferableBundle"),ledger=createStructuralOwnerLedger(32*1024*1024);
  try{expect(()=>finish(decodeHvpBodyMeshOutputSteps(f.request,f.projection,bad,ledger.reserve))).toThrow("Invalid body-cut binary layout");
    expect(validate).not.toHaveBeenCalled();
  }finally{validate.mockRestore();ledger.release();}
});

it("packs the same private projection bytes and digests through borrowed bounded work",async()=>{
  const f=await fixture(),ledger=createStructuralOwnerLedger(32*1024*1024);
  try{const expected=buildHvpBodyMeshInput(f.projection),actual=finish(buildHvpBodyMeshInputSteps(f.projection,ledger.reserve));
    expect(actual.value).toEqual(expected);expect(new Uint8Array(actual.value.input.buffers[0]!)).toEqual(new Uint8Array(expected.input.buffers[0]!));
    expect(actual.labels).toContain("meshPack");expect(actual.labels).toContain("transferHash");expect(ledger.resources.reservedBytes).toBeGreaterThan(actual.value.input.byteLength);
  }finally{ledger.release();}
});

it("fails the packing parent reservation before publishing or transferring input",async()=>{
  const f=await fixture(),first=new Error("pack parent credit rejected");let calls=0;
  expect(()=>finish(buildHvpBodyMeshInputSteps(f.projection,()=>{calls+=1;throw first;}))).toThrow(first);expect(calls).toBe(1);
});

it("preserves the generic outer freeze lookup before its second byte hash",async()=>{
  const f=await fixture(),descriptor=Object.getOwnPropertyDescriptor(Object,"freeze")!,freeze=Object.freeze;
  const ByteArray=Uint8Array,events:string[]=[];
  vi.stubGlobal("Uint8Array",new Proxy(ByteArray,{construct(target,args){events.push("bytes");return Reflect.construct(target,args);}}));
  Object.defineProperty(Object,"freeze",{configurable:true,get:()=>{events.push("freeze");return freeze;}});
  try{buildHvpBodyMeshInput(f.projection);}finally{Object.defineProperty(Object,"freeze",descriptor);vi.unstubAllGlobals();}
  const hashes=events.flatMap((entry,index)=>entry==="bytes"?[index]:[]);expect(hashes).toHaveLength(2);
  expect(events.slice(hashes[0]!+1,hashes[1]!)).toContain("freeze");
});
