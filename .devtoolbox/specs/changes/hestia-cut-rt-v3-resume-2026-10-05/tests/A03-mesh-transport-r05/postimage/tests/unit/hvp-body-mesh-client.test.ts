import {expect,it,vi} from "vitest";
import {createHvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import type {HvpPhysicsMessage,HvpPhysicsReply,HvpPhysicsSnapshot} from "../../src/hestia-prototype/physics/physicsWorker";
import type {HvpMovingCutPreparation} from "../../src/hestia-prototype/physics/bodyCutSession";
import {byteCount,contentRevision} from "../../src/workers/ids";
import {fnv1aBytes,type TransferableBufferBundle,type WorkerJobRequest} from "../../src/workers/protocol";

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
    if(value.kind!=="AdmitBodyChildMesh"){
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
