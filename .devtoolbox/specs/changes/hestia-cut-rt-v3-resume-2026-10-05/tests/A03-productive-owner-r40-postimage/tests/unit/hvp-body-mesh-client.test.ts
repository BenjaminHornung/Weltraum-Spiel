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
  last?:HvpPhysicsMessage;
  constructor(){OwnerPort.current=this;}
  postMessage(value:HvpPhysicsMessage,transfers:Transferable[]=[]){
    this.last=structuredClone(value,{transfer:transfers});
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
