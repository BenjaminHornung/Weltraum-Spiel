import { describe, expect, it, vi } from "vitest";
import { createHvpTerrainRoot } from "../../src/hestia-prototype/terrain/cutPlan";
import { createHvpTerrainCompiler, meshInitialHvpTerrain, hvpDirtySectors, copyHvpTerrainSlots } from "../../src/hestia-prototype/terrain/terrainProducts";
import { executeHvpTerrainJob, hvpTerrainInputDigest, HVP_TERRAIN_JOB, HVP_TERRAIN_MAX_OUTPUT, decodeHvpTerrainOutput } from "../../src/workers/hvpTerrainJob";
import { executeHvpCollisionJob } from "../../src/workers/hvpCollisionJob";
import { algorithmVersion, byteCount, contentRevision, jobDeadline, planningEpoch, workerEpoch, workerJobId, workerJobKind, workerTargetKey } from "../../src/workers/ids";
import type { TransferableBufferBundle, WorkerJobRequest } from "../../src/workers/protocol";
import { WorkerPool, type WorkerJobTerminal } from "../../src/workers/workerPool";

describe("HVP local terrain derivation", () => {
  it("copies immutable COW leaves in canonical order without millions of per-cell map lookups", async () => {
    const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
      sourceDigest:"flat",readSlot:()=>1},"copy-test",0);
    const cut=root.prepare({sessionId:"copy-test",epoch:0,revision:0,sourceDigest:"flat",commandId:"copy-cut",toolPolicy:"hvp-plasma-v1",
      shape:{kind:"Box",min:[31,63,15],max:[33,65,17]}});
    let leaves=0;
    const source={...cut.after,readSlot:()=>{throw new Error("Per-cell source lookup");},copyLeaf:(x:number,y:number,z:number)=>{leaves+=1;return cut.after.copyLeaf(x,y,z);}};
    const expected=new Uint8Array(8_388_608).fill(1);
    for(const change of cut.changed){const [x,y,z]=change.cell;expected[x+y*256+z*32768]=0;}
    const copied=await copyHvpTerrainSlots(source);
    expect(leaves).toBe(2048);expect(copied.every((value,i)=>value===expected[i])).toBe(true);
    copied.fill(0);expect(root.read().readSlot(0,1,0)).toBe(1);
    await expect(copyHvpTerrainSlots(source,()=>true)).rejects.toThrow(/Cancelled/);
  });
  it("covers sixteen 8m sectors exactly and invalidates only local content/halo products", () => {
    const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
      sourceDigest:"flat",readSlot:(_x:number,y:number)=>y<80?1:0},"sector-test",0);
    const meshes=meshInitialHvpTerrain(root.read());
    expect(meshes.size).toBe(16);
    let area=0;
    for(const mesh of meshes.values()) {
      for(let i=0;i<mesh.indices.length;i+=3) {
        const a=mesh.indices[i]!*3,b=mesh.indices[i+1]!*3,c=mesh.indices[i+2]!*3;
        if(mesh.normals[a+1]!==1) { continue; }
        expect(mesh.positions[a+1]).toBe(2);
        area+=Math.abs((mesh.positions[b]!-mesh.positions[a]!)*(mesh.positions[c+2]!-mesh.positions[a+2]!)
          -(mesh.positions[c]!-mesh.positions[a]!)*(mesh.positions[b+2]!-mesh.positions[a+2]!))/2;
      }
    }
    expect(area).toBe(32*32);
    const plan=root.prepare({sessionId:"sector-test",epoch:0,revision:0,sourceDigest:"flat",commandId:"edge",toolPolicy:"hvp-plasma-v1",
      shape:{kind:"Box",min:[63,79,63],max:[64,80,64]}});
    expect(hvpDirtySectors(plan,64)).toEqual([0,1,4,5]);
    expect(hvpDirtySectors(plan,32)).toEqual([9,10,17,18]);
    expect(plan.contentLeaves).toEqual(["3:4:3"]);
  },120_000);
  it("binds source, session, epoch, generation and sector before accepting actual typed worker output", () => {
    const slots=new Uint8Array(66*130*66);
    for(let z=1;z<=4;z+=1) { for(let y=1;y<=4;y+=1) { for(let x=1;x<=4;x+=1) { slots[x+y*66+z*66*130]=1; } } }
    const payload={sessionId:"test",epoch:2,generation:3,sourceDigest:"known",sector:0};
    const bundle:TransferableBufferBundle={buffers:[slots.buffer],byteLength:byteCount(slots.byteLength),revision:contentRevision(3),ownership:"SenderToWorker",
      views:[{name:"slots",kind:"Uint8Array",bufferIndex:0,byteOffset:0,elementCount:slots.length}]};
    const request={jobId:workerJobId("terrain"),targetKey:workerTargetKey("sector-0"),jobKind:workerJobKind(HVP_TERRAIN_JOB),
      workerEpoch:workerEpoch(0),planningEpoch:planningEpoch(0),inputRevision:contentRevision(3),sourceInputDigest:hvpTerrainInputDigest(payload,bundle.buffers),
      algorithmVersion:algorithmVersion(1),priority:"Urgent" as const,deadline:jobDeadline(0),estimatedInputBytes:byteCount(slots.byteLength),
      estimatedOutputBytes:byteCount(HVP_TERRAIN_MAX_OUTPUT),payload};
    const result=executeHvpTerrainJob(request,bundle);
    const mesh=decodeHvpTerrainOutput(result.bundle,payload);
    expect(mesh.indices).toHaveLength(36);
    expect(mesh.colors?.length).toBe(mesh.positions.length);
    for(const changed of [{sessionId:"foreign"},{epoch:3},{generation:4},{sector:1},{sourceDigest:"other"}]) {
      expect(()=>executeHvpTerrainJob({...request,payload:{...payload,...changed}},bundle)).toThrow(/binding/);
    }
    new Uint32Array(result.bundle.buffers[3]!)[0]=0xffffffff;
    expect(()=>decodeHvpTerrainOutput(result.bundle,payload)).toThrow();
  });

  it("rolls a quiescent compiler pool only after shutdown and lazily starts the replacement with monotone job IDs",async()=>{
    const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
      sourceDigest:"rollover",readSlot:()=>1},"rollover-test",0);
    const plan=root.prepare({sessionId:"rollover-test",epoch:0,revision:0,sourceDigest:"rollover",commandId:"rollover-cut",toolPolicy:"hvp-plasma-v1",
      shape:{kind:"Box",min:[1,1,1],max:[2,2,2]}});
    const startedPools:WorkerPool[]=[],shutdownPools:WorkerPool[]=[],enqueuedPools:WorkerPool[]=[],jobIds:string[]=[];
    const originalShutdown=WorkerPool.prototype.shutdown;
    const start=vi.spyOn(WorkerPool.prototype,"start").mockImplementation(function(this:WorkerPool){startedPools.push(this);return Promise.resolve();});
    const shutdown=vi.spyOn(WorkerPool.prototype,"shutdown").mockImplementation(async function(this:WorkerPool){
      shutdownPools.push(this);await originalShutdown.call(this);
    });
    const enqueue=vi.spyOn(WorkerPool.prototype,"enqueue").mockImplementation(function(this:WorkerPool,request:WorkerJobRequest){
      enqueuedPools.push(this);jobIds.push(request.jobId);
      const terminal={kind:"Failed",failure:{jobId:request.jobId,code:"WorkerFault",message:"Synthetic compiler test"}} as WorkerJobTerminal;
      return {jobId:request.jobId,workerEpoch:workerEpoch(0),result:Promise.resolve(terminal),cancel:()=>true};
    });
    const compiler=createHvpTerrainCompiler();
    try{
      await expect(compiler.compile(plan)).rejects.toThrow(/Terrain prepare Failed/);
      const firstJobCount=jobIds.length,firstJobSequence=Number(jobIds.at(-1)!.split("-").at(-1));
      expect(firstJobCount).toBeGreaterThan(0);expect(startedPools).toHaveLength(1);
      const firstPool=startedPools[0]!;

      await compiler.rolloverAfterLoad(()=>true);

      expect(shutdownPools).toEqual([firstPool]);expect(startedPools).toHaveLength(1);
      await expect(compiler.compile(plan)).rejects.toThrow(/Terrain prepare Failed/);
      expect(startedPools).toHaveLength(2);expect(startedPools[1]).not.toBe(firstPool);
      expect(enqueuedPools.slice(0,firstJobCount).every(pool=>pool===firstPool)).toBe(true);
      const secondPool=startedPools[1]!,secondJobCount=jobIds.length-firstJobCount;
      expect(enqueuedPools.slice(firstJobCount).every(pool=>pool===secondPool)).toBe(true);
      const secondJobSequence=Number(jobIds.at(-1)!.split("-").at(-1));
      expect(secondJobCount).toBeGreaterThan(0);expect(secondJobSequence).toBeGreaterThan(firstJobSequence);

      await compiler.rolloverAfterLoad(()=>true);

      expect(shutdownPools).toEqual([firstPool,secondPool]);expect(startedPools).toHaveLength(2);
      await expect(compiler.compile(plan)).rejects.toThrow(/Terrain prepare Failed/);
      expect(startedPools).toHaveLength(3);expect(startedPools[2]).not.toBe(secondPool);
      expect(enqueuedPools.slice(firstJobCount+secondJobCount).every(pool=>pool===startedPools[2])).toBe(true);
      expect(jobIds.slice(firstJobCount+secondJobCount).every(id=>Number(id.split("-").at(-1))>secondJobSequence)).toBe(true);
    }finally{
      await compiler.dispose();start.mockRestore();shutdown.mockRestore();enqueue.mockRestore();
    }
  });

  it("blocks rollover while compiler source copying is still before worker enqueue",async()=>{
    const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
      sourceDigest:"copy-rollover",readSlot:()=>1},"copy-rollover-test",0);
    const plan=root.prepare({sessionId:"copy-rollover-test",epoch:0,revision:0,sourceDigest:"copy-rollover",commandId:"copy-rollover-cut",toolPolicy:"hvp-plasma-v1",
      shape:{kind:"Box",min:[1,1,1],max:[2,2,2]}});
    const compiler=createHvpTerrainCompiler();
    const analyzing=compiler.analyze(plan);
    try{
      await expect(compiler.rolloverAfterLoad(()=>true)).rejects.toThrow(/quiescent/);
      await compiler.dispose();
      await expect(analyzing).rejects.toThrow(/Cancelled/);
    }finally{await compiler.dispose();}
  });

  it("does not replace the pool when its Load owner is lost while shutdown is pending",async()=>{
    const startedPools:WorkerPool[]=[];let releaseShutdown!:()=>void,signalShutdown!:()=>void;
    const shutdownEntered=new Promise<void>(resolve=>{signalShutdown=resolve;});
    const shutdownGate=new Promise<void>(resolve=>{releaseShutdown=resolve;});
    const originalShutdown=WorkerPool.prototype.shutdown;
    const start=vi.spyOn(WorkerPool.prototype,"start").mockImplementation(function(this:WorkerPool){startedPools.push(this);return Promise.resolve();});
    const shutdown=vi.spyOn(WorkerPool.prototype,"shutdown").mockImplementation(async function(this:WorkerPool){
      signalShutdown();await shutdownGate;await originalShutdown.call(this);
    });
    const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
      sourceDigest:"owner-rollover",readSlot:()=>1},"owner-rollover-test",0);
    const plan=root.prepare({sessionId:"owner-rollover-test",epoch:0,revision:0,sourceDigest:"owner-rollover",commandId:"owner-rollover-cut",toolPolicy:"hvp-plasma-v1",
      shape:{kind:"Box",min:[1,1,1],max:[2,2,2]}});
    const compiler=createHvpTerrainCompiler();let ownerLive=true;
    try{
      const rollover=compiler.rolloverAfterLoad(()=>ownerLive);
      await shutdownEntered;ownerLive=false;releaseShutdown();
      await expect(rollover).rejects.toThrow(/owner changed/);
      await expect(compiler.compile(plan)).rejects.toThrow(/disposed/);
      expect(startedPools).toHaveLength(0);
    }finally{
      releaseShutdown();await compiler.dispose();start.mockRestore();shutdown.mockRestore();
    }
  });

  it("blocks rollover through accepted-terminal decoding and the compiler's post-terminal yield",async()=>{
    const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
      sourceDigest:"terminal-rollover",readSlot:()=>1},"terminal-rollover-test",0);
    const plan=root.prepare({sessionId:"terminal-rollover-test",epoch:0,revision:0,sourceDigest:"terminal-rollover",commandId:"terminal-rollover-cut",toolPolicy:"hvp-plasma-v1",
      shape:{kind:"Box",min:[1,1,1],max:[2,2,2]}});
    const compiler=createHvpTerrainCompiler();let releaseYield:(()=>void)|undefined,signalYield!:()=>void;
    const yielded=new Promise<void>(resolve=>{signalYield=resolve;});
    const start=vi.spyOn(WorkerPool.prototype,"start").mockResolvedValue(undefined);
    const enqueue=vi.spyOn(WorkerPool.prototype,"enqueue").mockImplementation((request,bundle)=>{
      const output=request.jobKind===HVP_TERRAIN_JOB?executeHvpTerrainJob(request,bundle):executeHvpCollisionJob(request,bundle);
      const terminal:WorkerJobTerminal={kind:"Completed",result:output.result,output:output.bundle};
      return {jobId:request.jobId,workerEpoch:workerEpoch(0),result:Promise.resolve(terminal),cancel:()=>false};
    });
    const accepted=vi.spyOn(WorkerPool.prototype,"isAcceptedCompletedTerminal").mockReturnValue(true);
    const originalSetTimeout=globalThis.setTimeout;let holdYield=true;
    const setTimeout=vi.spyOn(globalThis,"setTimeout").mockImplementation((handler,timeout,...args)=>{
      if(holdYield&&timeout===0&&typeof handler==="function"){
        holdYield=false;releaseYield=()=>{handler(...args);};signalYield();return 0 as unknown as ReturnType<typeof globalThis.setTimeout>;
      }
      return originalSetTimeout(handler,timeout,...args);
    });
    try{
      const compiling=compiler.compile(plan);
      await yielded;
      await expect(compiler.rolloverAfterLoad(()=>true)).rejects.toThrow(/quiescent/);
      releaseYield?.();
      await expect(compiling).resolves.toMatchObject({render:expect.any(Map),collision:expect.any(Map)});
    }finally{
      releaseYield?.();await compiler.dispose();start.mockRestore();enqueue.mockRestore();accepted.mockRestore();setTimeout.mockRestore();
    }
  });

  it("fails closed when pool retirement itself rejects",async()=>{
    const root=createHvpTerrainRoot({sizeX:16,sizeY:16,sizeZ:16,cellMeters:.125,originMeters:{x:0,y:0,z:0},
      sourceDigest:"retirement-fault",readSlot:()=>1},"retirement-fault",0);
    const plan=root.prepare({sessionId:"retirement-fault",epoch:0,revision:0,sourceDigest:"retirement-fault",commandId:"retirement-fault-cut",toolPolicy:"hvp-plasma-v1",
      shape:{kind:"Box",min:[1,1,1],max:[2,2,2]}});
    const compiler=createHvpTerrainCompiler();
    const shutdown=vi.spyOn(WorkerPool.prototype,"shutdown").mockRejectedValueOnce(new Error("injected retirement failure"));
    const start=vi.spyOn(WorkerPool.prototype,"start");
    try{
      await expect(compiler.rolloverAfterLoad(()=>true)).rejects.toThrow(/injected retirement failure/);
      await expect(compiler.compile(plan)).rejects.toThrow(/disposed/);
      expect(start).not.toHaveBeenCalled();expect(compiler.diagnostics()).toMatchObject({runningJobs:0,queue:0,workers:0});
    }finally{shutdown.mockRestore();start.mockRestore();await compiler.dispose();}
  });

  it("does not accept a replacement after disposal while retirement is pending",async()=>{
    let releaseShutdown!:()=>void,signalShutdown!:()=>void;
    const entered=new Promise<void>(resolve=>{signalShutdown=resolve;});
    const gate=new Promise<void>(resolve=>{releaseShutdown=resolve;});
    const actual=WorkerPool.prototype.shutdown;
    const shutdown=vi.spyOn(WorkerPool.prototype,"shutdown").mockImplementationOnce(async function(this:WorkerPool){
      signalShutdown();await gate;await actual.call(this);
    });
    const compiler=createHvpTerrainCompiler();
    try{
      const rollover=compiler.rolloverAfterLoad(()=>true);
      await entered;
      await compiler.dispose();releaseShutdown();
      await expect(rollover).rejects.toThrow(/owner changed/);
      await expect(compiler.rolloverAfterLoad(()=>true)).rejects.toThrow(/disposed/);
      expect(compiler.diagnostics()).toMatchObject({runningJobs:0,queue:0,workers:0,state:"Stopped"});
    }finally{releaseShutdown();shutdown.mockRestore();await compiler.dispose();}
  });
});
