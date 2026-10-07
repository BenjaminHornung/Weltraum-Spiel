import {expect,it,vi} from "vitest";
import {createHvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import type {HvpPhysicsMessage,HvpPhysicsReply,HvpPhysicsSnapshot} from "../../src/hestia-prototype/physics/physicsWorker";
import type {HvpMovingCutPreparation} from "../../src/hestia-prototype/physics/bodyCutSession";
import {byteCount,contentRevision} from "../../src/workers/ids";
import {fnv1aBytes,type TransferableBufferBundle,type WorkerJobRequest} from "../../src/workers/protocol";
import {quoteHvpBodyMeshWork,createHvpBodyMeshPhaseReserve} from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import {createHvpBodyMeshTaskPump} from "../../src/workers/hvpBoundedPump";
import type {HvpBodyChildProjection} from "../../src/hestia-prototype/physics/bodyCutSession";

vi.mock("../../src/workers/workerPool",()=>({WorkerPool:class {async start(){} async shutdown(){}}}));
const preparation={issuedTick:7,payload:{sessionId:"mesh-session",epoch:0,commandId:"mesh-cut",ownerId:"mesh-parent",
  sourceId:"mesh-source",sourceDigest:"fnv1a64-v1:0000000000000000",revision:0}} as HvpMovingCutPreparation;
const snapshot={status:"Running",ticks:7,bodyCount:1,colliderCount:1,collisionBytes:0,
  moving:{state:"Preparing",pendingId:"mesh-cut"}} as HvpPhysicsSnapshot;
const packet=():TransferableBufferBundle=>{
  const buffers=Array.from({length:7},()=>new ArrayBuffer(4));
  return {buffers,ownership:"WorkerToConsumer",revision:contentRevision(0),byteLength:byteCount(28),contentHash:fnv1aBytes(buffers),
    views:buffers.map((_,i)=>({name:`channel-${i}`,kind:"Uint8Array" as const,bufferIndex:i,byteOffset:0,elementCount:4}))};
};
class OwnerPort {
  static current:OwnerPort;
  onmessage:((event:MessageEvent<HvpPhysicsReply>)=>void)|null=null;
  onerror=null;onmessageerror=null;sequence=0;terminated=false;
  last?:HvpPhysicsMessage;holdKinds=new Set<HvpPhysicsMessage["kind"]>();
  constructor(){OwnerPort.current=this;}
  postMessage(value:HvpPhysicsMessage,transfers:Transferable[]=[]){
    this.last=structuredClone(value,{transfer:transfers});
    if(this.holdKinds.has(value.kind))return;
    if(value.kind!=="AdmitBodyChildMesh"&&value.kind!=="PrepareBodyMeshWork"&&value.kind!=="ReleaseBodyMeshWork"){
      const message=this.last;
      queueMicrotask(()=>this.deliver(message,{snapshot:value.kind==="Dispose"?{...snapshot,status:"Disposed",bodyCount:0,colliderCount:0}:snapshot,
        bodyPreparation:value.kind==="BeginBodyCut"?preparation:undefined}));
    }
  }
  deliver(message:HvpPhysicsMessage,patch:Partial<HvpPhysicsReply>={}){
    this.onmessage?.({data:{id:message.id,protocol:message.protocol,incarnation:message.incarnation,sequence:++this.sequence,
      clock:{timers:message.kind==="Dispose"?0:1,maxTimerGapMs:this.sequence,maxAdvanceMs:0,maxHandlerMs:0,lastCommand:message.kind,lastHandlerMs:0,delayedCallbacks:[]},
      ...patch}} as MessageEvent<HvpPhysicsReply>);
  }
  terminate(){this.terminated=true;}
}
it.each(["ready","callback-fails","release-fails","disposed","bad-view"] as const)("awaits native Source-only views before Stage and proves exact preStage release (%s)",async mode=>{
  const abort=new AbortController();vi.stubGlobal("Worker",OwnerPort);let client:Awaited<ReturnType<typeof createHvpPhysicsClient>>|undefined;
  const sourceView={ownerId:"hvp:terrain-fragment:r1:12345678",sourceDigest:"fnv1a64-v1:0000000000000001",
    centerOfMass:{x:0,y:1,z:0},cellCount:1,massKg:4.6875,colliders:1,sourceBytes:131072};
  const fragment={ownerId:sourceView.ownerId,origin:{x:-16,y:-8,z:-16},massKg:sourceView.massKg,
    cells:[{x:128,y:72,z:128,materialId:1}],colliderBoxes:[{min:[128,72,128] as const,max:[129,73,129] as const}]};
  let continueCallback:()=>void=()=>{},calls=0,settled=false;const callbackGate=new Promise<void>(resolve=>{continueCallback=resolve;}),sentinel=new Error("hidden graphics failed");
  try{
    client=await createHvpPhysicsClient([],{x:0,y:1,z:0},abort.signal);const port=OwnerPort.current;
    port.holdKinds.add("PrepareTerrainPlan");port.holdKinds.add("ReleaseTerrainPlan");const before=client.read(),clock=client.clock;
    const waiting=client.prepareTerrain("owned",0,[{index:0,mesh:{vertices:new Float32Array(),indices:new Uint32Array()}}],[fragment],
      {sourceDigest:"26d5308d",sourceSessionId:"root-source",sourceEpoch:3,copyBytes:65536,nativeBytes:32*1024*1024,
        onSourcePrepared:async views=>{calls+=1;expect(views).toEqual([sourceView]);expect(Object.isFrozen(views)).toBe(true);
          expect(Object.isFrozen(views[0]!.centerOfMass)).toBe(true);expect(client!.read()).toBe(before);expect(client!.clock).toBe(clock);
          await callbackGate;if(mode==="callback-fails"||mode==="release-fails"){throw sentinel;}}});
    const result=waiting.then(()=>{settled=true;return {accepted:true};},error=>{settled=true;return {error};});
    await vi.waitFor(()=>expect(port.last?.kind).toBe("PrepareTerrainPlan"));const prepared=port.last!;
    if(prepared.kind!=="PrepareTerrainPlan"){throw new Error("Expected actual preparation request");}
    port.deliver(prepared,{terrainPlan:{prepareRequestId:prepared.id,transactionId:prepared.transactionId,generation:prepared.generation,
      sourceDigest:prepared.sourceDigest,sourceSessionId:prepared.sourceSessionId,sourceEpoch:prepared.sourceEpoch,
      sourceViews:[mode==="bad-view"?{...sourceView,cellCount:2}:sourceView]}});
    if(mode==="bad-view"){
      await vi.waitFor(()=>expect(port.last?.kind).toBe("ReleaseTerrainPlan"));expect(calls).toBe(0);expect(settled).toBe(false);
      const release=port.last!;if(release.kind!=="ReleaseTerrainPlan"){throw new Error("Expected forged-view release");}
      expect(release.prepareRequestId).toBe(prepared.id);port.deliver(release,{terrainPlanReleased:{prepareRequestId:prepared.id}});
      const terminal=await result;expect("error" in terminal&&(terminal.error as Error).message).toMatch(/source view binding/);
      expect(client.read()).toBe(before);expect(client.clock).toBe(clock);return;
    }
    await vi.waitFor(()=>expect(calls).toBe(1));expect(port.last).toBe(prepared);expect(settled).toBe(false);
    if(mode==="disposed"){
      // Dispose wins while the callback is suspended; no later Stage or release may be sent.
      await client.dispose();continueCallback();const terminal=await result;expect("error" in terminal&&(terminal.error as Error).message).toMatch(/disposed/i);
      expect(port.last?.kind).toBe("Dispose");expect(port.terminated).toBe(true);expect(client.lifecycle?.().pendingJobs).toBe(0);return;
    }
    continueCallback();
    if(mode==="ready"){expect(await result).toEqual({accepted:true});expect(port.last?.kind).toBe("PrepareTerrain");}
    else{
      await vi.waitFor(()=>expect(port.last?.kind).toBe("ReleaseTerrainPlan"));expect(settled).toBe(false);const release=port.last!;
      if(release.kind!=="ReleaseTerrainPlan"){throw new Error("Expected exact release request");}expect(release.prepareRequestId).toBe(prepared.id);
      port.deliver(release,{terrainPlanReleased:{prepareRequestId:prepared.id+(mode==="release-fails"?1:0)}});
      expect(await result).toEqual({error:sentinel});
      if(mode==="release-fails"){expect(()=>client!.read()).toThrow(/release unproven/);expect(port.terminated).toBe(true);}
      else{expect(client.read()).toBe(before);expect(port.terminated).toBe(false);}
    }
  }finally{continueCallback();
    try{if(mode==="release-fails"&&OwnerPort.current.terminated){await expect(client?.dispose()).rejects.toThrow(/release unproven/);}
      else{await client?.dispose();}}
    finally{abort.abort();vi.unstubAllGlobals();}
  }
});
it("R74 ignores a duplicate successful Begin reply with a higher sequence without moving owner watermarks",async()=>{
  const abort=new AbortController();vi.stubGlobal("Worker",OwnerPort);
  let client:Awaited<ReturnType<typeof createHvpPhysicsClient>>|undefined;
  try{
    client=await createHvpPhysicsClient([],{x:0,y:1,z:0},abort.signal);
    await client.beginBodyCut({id:"mesh-cut",ownerId:"mesh-parent",sourceDigest:preparation.payload.sourceDigest,edge:1,direction:{x:1,y:0,z:0}});
    const port=OwnerPort.current,message=port.last!,before=client.read(),clock=client.clock;
    expect(message.kind).toBe("BeginBodyCut");
    port.deliver(message,{sequence:10000,bodyPreparation:preparation,snapshot:{...snapshot,ticks:999},restoreState:"Prepared"});
    expect(client.read()).toBe(before);expect(client.clock).toBe(clock);
    expect(client.lifecycle?.().pendingJobs).toBe(0);
    await client.rollbackBodyCut("mesh-cut");
    expect(client.clock?.maxTimerGapMs).toBe(port.sequence);
    expect(port.sequence).toBeLessThan(10000);
  }finally{await client?.dispose();abort.abort();vi.unstubAllGlobals();}
});

it.each(["StageBodyCut","CommitBodyCut"] as const)("R74 retires deferred %s success across Dispose and remount",async boundary=>{
  const abort=new AbortController();vi.stubGlobal("Worker",OwnerPort);
  let client:Awaited<ReturnType<typeof createHvpPhysicsClient>>|undefined,next:typeof client;
  try{
    client=await createHvpPhysicsClient([],{x:0,y:1,z:0},abort.signal);
    await client.beginBodyCut({id:"mesh-cut",ownerId:"mesh-parent",sourceDigest:preparation.payload.sourceDigest,edge:1,direction:{x:1,y:0,z:0}});
    const port=OwnerPort.current;port.holdKinds.add(boundary);
    const waiting=boundary==="StageBodyCut"?client.stageBodyCut("mesh-cut",{parts:[],removedCells:1,removedMassKg:1}):client.commitBodyCut("mesh-cut");
    const settled=waiting.then(()=>({accepted:true}),error=>({error}));
    await vi.waitFor(()=>expect(port.last?.kind).toBe(boundary));
    const message=port.last!,callback=port.onmessage!;
    await client.dispose();expect("error" in await settled).toBe(true);expect(port.terminated).toBe(true);
    let disposedError:unknown;try{client.read();}catch(error){disposedError=error;}
    expect(disposedError).toBeInstanceOf(Error);
    const disposed=client.lifecycle?.(),disposedClock=client.clock;
    expect(disposed).toMatchObject({workers:0,pendingJobs:0,native:{status:"Disposed",bodies:0,colliders:0}});
    next=await createHvpPhysicsClient([],{x:0,y:1,z:0},abort.signal);
    const current=OwnerPort.current,before=next.read(),clock=next.clock;
    const late:HvpPhysicsReply={id:message.id,protocol:message.protocol,incarnation:message.incarnation,sequence:10000,
      snapshot:{...snapshot,ticks:999},restoreState:"Prepared"};
    callback({data:late} as MessageEvent<HvpPhysicsReply>);
    current.onmessage?.({data:late} as MessageEvent<HvpPhysicsReply>);
    let afterError:unknown;try{client.read();}catch(error){afterError=error;}
    expect(afterError).toBe(disposedError);expect(client.lifecycle?.()).toEqual(disposed);expect(client.clock).toBe(disposedClock);
    expect(next.read()).toBe(before);expect(next.clock).toBe(clock);
    expect(next.lifecycle?.()).toMatchObject({workers:1,pendingJobs:0});
    await next.command("Pause");expect(next.clock?.maxTimerGapMs).toBe(current.sequence);
    expect(current.sequence).toBeLessThan(10000);
  }finally{await next?.dispose();await client?.dispose();abort.abort();vi.unstubAllGlobals();}
});
it.each(["valid","bad-begin","late-rollback"] as const)("transfers exclusive mesh data and preserves client state (%s)",async mode=>{
  const abort=new AbortController();vi.stubGlobal("Worker",OwnerPort);
  let client:Awaited<ReturnType<typeof createHvpPhysicsClient>>|undefined;
  try{
    client=await createHvpPhysicsClient([],{x:0,y:1,z:0},abort.signal);
    await client.beginBodyCut({id:"mesh-cut",ownerId:"mesh-parent",sourceDigest:preparation.payload.sourceDigest,edge:1,direction:{x:1,y:0,z:0}});
    const port=OwnerPort.current,output=packet(),oldClock=client.clock,oldSnapshot=client.read();
    const pending=client.admitBodyMeshOutput!("mesh-cut",{} as WorkerJobRequest,output);
    const settled=pending.then(value=>({value}),error=>({error}));
    expect(output.buffers.every(buffer=>buffer.byteLength===0)).toBe(true);
    const message=port.last!;
    if(message.kind!=="AdmitBodyChildMesh"){throw new Error("Expected private admission request");}
    if(mode==="late-rollback"){await client.rollbackBodyCut("mesh-cut");}
    const returned=structuredClone(message.output,{transfer:[...message.output.buffers]});
    const clockBeforeReply=client.clock;
    port.deliver(message,{bodyMeshAdmission:{beginRequestId:message.binding.beginRequestId-(mode==="bad-begin"?1:0),output:returned},
      snapshot:{...snapshot,ticks:999},restoreState:"Prepared"});
    const result=await settled;
    expect(client.clock).toBe(clockBeforeReply);
    expect(client.read().ticks).toBe(oldSnapshot.ticks);
    expect(client.lifecycle?.().pendingJobs).toBe(0);expect(port.terminated).toBe(false);
    if(mode==="valid"){
      expect("value" in result&&result.value.buffers.every(buffer=>buffer.byteLength===4)).toBe(true);
      expect(client.read()).toBe(oldSnapshot);expect(client.clock).toBe(oldClock);
    }else{expect("error" in result).toBe(true);}
  }finally{await client?.dispose();abort.abort();vi.unstubAllGlobals();}
});

it.each(["valid","bad-budget","late-rollback","concurrent-release"] as const)("binds prepaid projection and late resource release without publishing data replies (%s)",async mode=>{
  const abort=new AbortController();vi.stubGlobal("Worker",OwnerPort);
  let client:Awaited<ReturnType<typeof createHvpPhysicsClient>>|undefined;
  try{
    client=await createHvpPhysicsClient([],{x:0,y:1,z:0},abort.signal);
    await client.beginBodyCut({id:"mesh-cut",ownerId:"mesh-parent",sourceDigest:preparation.payload.sourceDigest,edge:1,direction:{x:1,y:0,z:0}});
    const pending=client.prepareBodyMeshWork!("mesh-cut",32*1024*1024,32768),settled=pending.then(value=>({value}),error=>({error}));
    const port=OwnerPort.current,message=port.last!;if(message.kind!=="PrepareBodyMeshWork"){throw new Error("Expected quoted projection request");}
    const projection:HvpBodyChildProjection={...preparation.payload,issuedTick:7,removedCells:1,removedMassKg:1,
      parts:[{ownerId:"mesh-source:r1:p0",sourceDigest:preparation.payload.sourceDigest,center:{x:0,y:0,z:0},massKg:1,sourceBytes:512,
        cells:[{x:0,y:0,z:0,materialId:65535}]}]};
    const budget=quoteHvpBodyMeshWork([{cells:1,gridCells:1,exposedFaces:6,slotBytes:2}],2,16384,32768+6*504);
    if(mode==="late-rollback"){await client.rollbackBodyCut("mesh-cut");}
    const before=client.read(),clock=client.clock;
    port.deliver(message,{bodyMeshWork:{beginRequestId:message.binding.beginRequestId,projection,budget:mode==="bad-budget"?{...budget,bytes:budget.bytes+1}:budget},
      snapshot:{...snapshot,ticks:999},restoreState:"Prepared"});
    const result=await settled;expect(client.read()).toBe(before);expect(client.clock).toBe(clock);
    if(mode==="valid"||mode==="concurrent-release"){expect("value" in result&&result.value.projection.parts[0]!.cells[0]!.materialId).toBe(65535);
      expect("value" in result&&Object.isFrozen(result.value.projection.parts[0]!.cells)).toBe(true);
      await client.finalizeBodyCut("mesh-cut");
    }else{expect("error" in result).toBe(true);}
    const releaseBefore=client.read(),releaseClock=client.clock,releasing=client.releaseBodyMeshWork!("mesh-cut"),end=port.last!;
    const duplicate=mode==="concurrent-release"?client.releaseBodyMeshWork!("mesh-cut"):Promise.resolve();
    if(mode==="concurrent-release"){expect(port.last).toBe(end);}
    if(end.kind!=="ReleaseBodyMeshWork"){throw new Error("Expected retained resource ticket release");}
    port.deliver(end,{bodyMeshReleased:{beginRequestId:end.binding.beginRequestId},snapshot:{...snapshot,ticks:999},restoreState:"Prepared"});
    await Promise.all([releasing,duplicate]);expect(client.read()).toBe(releaseBefore);expect(client.clock).toBe(releaseClock);
  }finally{await client?.dispose();abort.abort();vi.unstubAllGlobals();}
});

it("uses actual task ports and closes suspended scratch on pump disposal",async()=>{
  const pump=createHvpBodyMeshTaskPump(()=>{});let closed=false,units=0;
  function* steps(){try{for(let i=0;i<100000;i+=1){units+=1;yield "meshWork";}}finally{closed=true;}}
  const pending=pump.run(steps());void pending.catch(()=>{});
  expect(units).toBeGreaterThan(0);expect(units).toBeLessThan(100000);expect(closed).toBe(false);
  pump.dispose();await expect(pending).rejects.toThrow("task pump disposed");expect(closed).toBe(true);pump.dispose();
  const successful=createHvpBodyMeshTaskPump(()=>{});try{await successful.host.yieldTask();successful.host.assertCurrent();}finally{successful.dispose();}
});
it("keeps the first pump error when cursor cleanup also throws",async()=>{
  const first=new Error("owner cancelled"),cleanup=new Error("cursor close failed");let calls=0,closed=false;
  const pump=createHvpBodyMeshTaskPump(()=>{calls+=1;if(calls===2){throw first;}});
  function* steps(){try{yield "meshWork";yield "meshWork";}finally{closed=true;throw cleanup;}}
  try{await expect(pump.run(steps())).rejects.toBe(first);expect(closed).toBe(true);}finally{pump.dispose();}
});
it("exhausts a prepaid phase before another allocation and keeps its first failure",()=>{
  const reserve=createHvpBodyMeshPhaseReserve(8192);reserve(8192);let first:unknown;
  try{reserve(1);}catch(error){first=error;}expect(first).toBeInstanceOf(Error);
  expect(()=>reserve(0)).toThrow(first as Error);expect(()=>createHvpBodyMeshPhaseReserve(0)).toThrow("Invalid");
});

it("reports actual contiguous work quanta instead of allocating a diagnostic entry per cell step",async()=>{
  let units=0;const spans:{label:string;duration:number}[]=[];
  const pump=createHvpBodyMeshTaskPump(()=>{},(label,_start,duration)=>{spans.push({label,duration});});
  function* steps(){for(let i=0;i<10000;i+=1){units+=1;yield "meshDecode";}return units;}
  try{expect(await pump.run(steps())).toBe(10000);expect(spans.length).toBeGreaterThan(0);expect(spans.length).toBeLessThan(100);
    expect(spans.every(span=>span.label==="meshQuantum"&&Number.isFinite(span.duration)&&span.duration>=0)).toBe(true);
  }finally{pump.dispose();}
});
