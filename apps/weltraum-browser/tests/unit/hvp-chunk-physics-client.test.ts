import {expect,it,vi} from "vitest";
import {createHvpTerrainRoot,restoreHvpPrivateTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {createHvpTerrainCompiler,bindHvpChunkPhysicsInput,prepareHvpChunkPhysicsInputSteps,discardHvpOwnedTerrainProducts} from "../../src/hestia-prototype/terrain/terrainProducts";
import {createHvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import {collisionSectors,type HvpCollisionSource} from "../../src/hestia-prototype/physics/terrainColliders";
import {hvpCollisionDigest} from "../../src/hestia-prototype/persistence/worldCheckpoint";
import type {HvpWorldCheckpoint} from "../../src/hestia-prototype/persistence/worldCheckpoint";
import type {HvpPhysicsMessage,HvpPhysicsReply,HvpPhysicsSnapshot} from "../../src/hestia-prototype/physics/physicsWorker";
import {WorkerPool,type WorkerJobTerminal} from "../../src/workers/workerPool";
import {executeHvpChunkJob,HVP_CHUNK_JOB} from "../../src/workers/hvpChunkJob";
import {executeHvpCollisionJob} from "../../src/workers/hvpCollisionJob";
import {workerEpoch} from "../../src/workers/ids";
import {transferListFor} from "../../src/workers/protocol";

it.each(["new","legacy","bad","east","bad-world"] as const)("uses an exact prepared tuple and selects the complete saved collision representation (%s)",async mode=>{
  const root=restoreHvpPrivateTerrainRoot(createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},sourceDigest:"12345678",
    readSlot:(x,y,z)=>x===31&&y===10&&z===10?1:0},"chunk-client",0).checkpoint());
  const start=vi.spyOn(WorkerPool.prototype,"start").mockResolvedValue(undefined),kinds:string[]=[];
  const enqueue=vi.spyOn(WorkerPool.prototype,"enqueueTerrainDerivative").mockImplementation(async(request,bundle,_grant,_host,reserve)=>{
    reserve(16_384);reserve(8192+bundle.byteLength);kinds.push(request.jobKind);
    const input=structuredClone(bundle,{transfer:transferListFor(bundle)}),output=request.jobKind===HVP_CHUNK_JOB?executeHvpChunkJob(request,input):executeHvpCollisionJob(request,input);
    return {jobId:request.jobId,workerEpoch:workerEpoch(0),result:Promise.resolve({kind:"Completed",result:output.result,output:output.bundle} as WorkerJobTerminal),cancel:()=>false};
  });
  const accepted=vi.spyOn(WorkerPool.prototype,"isAcceptedCompletedTerminal").mockReturnValue(true),compiler=createHvpTerrainCompiler(),abort=new AbortController();
  let initialized:Extract<HvpPhysicsMessage,{kind:"Initialize"}>|undefined,workers=0;
  class OwnerWorker {
    onmessage:((event:MessageEvent<HvpPhysicsReply>)=>void)|null=null;onerror:((event:ErrorEvent)=>void)|null=null;onmessageerror:((event:MessageEvent)=>void)|null=null;sequence=0;
    constructor(){workers+=1;}
    postMessage(message:HvpPhysicsMessage,buffers:Transferable[]=[]){
      const received=structuredClone(message,{transfer:buffers});if(received.kind==="Initialize"){initialized=received;}
      const disposed=message.kind==="Dispose";
      const reply:HvpPhysicsReply={id:message.id,protocol:message.protocol,incarnation:message.incarnation,sequence:++this.sequence,
        snapshot:{status:disposed?"Disposed":"Paused",bodyCount:disposed?0:1,colliderCount:0,collisionBytes:0} as HvpPhysicsSnapshot,
        clock:{timers:disposed?0:1,maxTimerGapMs:0,maxAdvanceMs:0,maxHandlerMs:0,lastCommand:message.kind,lastHandlerMs:0,delayedCallbacks:[]}};
      queueMicrotask(()=>this.onmessage?.({data:reply} as MessageEvent<HvpPhysicsReply>));
    }
    terminate(){}
  }
  vi.stubGlobal("Worker",OwnerWorker);
  let products:Awaited<ReturnType<typeof compiler.initialChunks>>|undefined,client:Awaited<ReturnType<typeof createHvpPhysicsClient>>|undefined;
  const populations:{primaryJobs:number;primaryEmptyBoth:number;eastJobs:number;eastEmptyBoth:number}[]=[];
  const poolSummaries:{jobs:number;complete:boolean}[]=[];
  try{
    const east=mode==="east"?restoreHvpPrivateTerrainRoot(createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:16,y:-8,z:-16},sourceDigest:"87654321",
      readSlot:(x,y,z)=>x===0&&y===10&&z===10?1:0},"chunk-client-east",0).checkpoint()).read():undefined;
    await compiler.prepare(()=>true,root);products=await compiler.initialChunks(root.read(),east,16*1024*1024,"chunk-client-world",undefined,
      mode==="east"?population=>{populations.push(population);throw new Error("Population sink failed");}:undefined,
      mode==="east"?summary=>{poolSummaries.push(summary);throw new Error("Pool summary sink failed");}:undefined);
    if(mode==="east"){
      expect(populations).toEqual([{primaryJobs:256,primaryEmptyBoth:255,eastJobs:256,eastEmptyBoth:255}]);
      expect(Object.isFrozen(populations[0])).toBe(true);
      // This fixture bypasses real pool events; incomplete observation must never fabricate a complete summary.
      expect(poolSummaries).toHaveLength(1);expect(poolSummaries[0]).toMatchObject({jobs:0,complete:false});
      expect(Object.isFrozen(poolSummaries[0])).toBe(true);
    }else{expect(populations).toEqual([]);}
    const wood={sizeX:8,sizeY:4,sizeZ:8,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0};
    const sources:HvpCollisionSource[]=[{...root.read(),readHaloSlot:east?(x,y,z)=>x>=256?east.readSlot(x-256,y,z):undefined:undefined},wood,
      ...(east?[{...east,readHaloSlot:(x:number,y:number,z:number)=>x<0?root.read().readSlot(x+256,y,z):undefined}]:[])];
    const input=bindHvpChunkPhysicsInput(root,products,sources);
    const foreign=prepareHvpChunkPhysicsInputSteps(input,[...sources],()=>{});expect(()=>foreign.next()).toThrow(/Foreign/);
    const changed=prepareHvpChunkPhysicsInputSteps(input,sources,()=>{});changed.next();Object.assign(sources[0]!,{sizeX:128});
    expect(()=>changed.next()).toThrow(/Stale/);Object.assign(sources[0]!,{sizeX:256});
    const legacyDigest=hvpCollisionDigest(sources.flatMap(s=>[...collisionSectors(s)]));
    let checkpoint=mode==="new"?undefined:{sessionId:"chunk-client-world",collisionDigest:mode==="legacy"?legacyDigest:"00000000"} as HvpWorldCheckpoint;
    if(mode==="bad-world"){checkpoint={...checkpoint!,sessionId:"foreign-world",collisionDigest:legacyDigest};}
    if(east){
      const packet=prepareHvpChunkPhysicsInputSteps(input,sources,()=>{});let ready:IteratorReturnResult<{primary:ReturnType<typeof collisionSectors> extends Generator<infer T>?T[]:never;east:ReturnType<typeof collisionSectors> extends Generator<infer T>?T[]:never;assertCurrent:()=>void}>;
      for(;;){const step=packet.next();if(step.done){ready=step;break;}}
      checkpoint={sessionId:"chunk-client-world",collisionDigest:hvpCollisionDigest([...ready!.value.primary,...collisionSectors(wood),...ready!.value.east]),
        neighbor:{version:"hvp-neighbor-world-v1",epoch:1,resident:true,sourceDigest:east.sourceDigest,baseSectorCount:257}} as HvpWorldCheckpoint;
    }
    kinds.length=0;
    const starting=createHvpPhysicsClient(sources,{x:.5,y:2,z:.5},abort.signal,{x:.5,y:2,z:.5},undefined,undefined,checkpoint,"branch",undefined,undefined,input);
    if(mode==="bad"||mode==="bad-world"){
      await expect(starting).rejects.toThrow(mode==="bad"?/exact saved/:/World identity/);expect(workers).toBe(0);expect(initialized).toBeUndefined();
    }else{
      client=await starting;expect(initialized).toBeDefined();expect(initialized!.sectors).toHaveLength(mode==="east"?513:mode==="new"?257:65);
      expect(initialized!.sessionId).toBe("chunk-client-world");
      expect(initialized!.staticLayout?.primaryTerrainCount).toBe(mode==="legacy"?undefined:256);
      expect(initialized!.player?.coverage).toHaveLength(64);expect(client.staticTerrainLayout?.()?.primaryTerrainCount).toBe(mode==="legacy"?undefined:256);
      expect(kinds).toHaveLength(mode==="legacy"?65:1);expect(kinds.every(k=>k!==HVP_CHUNK_JOB)).toBe(true);
      if(mode==="legacy"){expect(hvpCollisionDigest(initialized!.sectors)).toBe(legacyDigest);}
      // Initialize transfers independent copies, never the caller's product or private cache buffers.
      expect(products.collision.get(0)!.vertices.buffer.byteLength).toBeGreaterThan(0);
      await client.dispose();
    }
    discardHvpOwnedTerrainProducts(products);expect(compiler.diagnostics().chunkCacheBytes).toBe(0);
    expect(()=>bindHvpChunkPhysicsInput(root,products!,sources)).toThrow(/owned/i);
  }finally{
    abort.abort();if(products){discardHvpOwnedTerrainProducts(products);}await compiler.dispose();compiler.releaseDisposedSupportResources();
    accepted.mockRestore();enqueue.mockRestore();start.mockRestore();vi.unstubAllGlobals();
  }
},120_000);
