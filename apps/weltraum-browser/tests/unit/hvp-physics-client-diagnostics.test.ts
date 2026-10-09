import {expect,it,vi} from "vitest";
import {createHvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import type {HvpPhysicsMessage,HvpPhysicsReply,HvpPhysicsSnapshot} from "../../src/hestia-prototype/physics/physicsWorker";

vi.mock("../../src/workers/workerPool",()=>({WorkerPool:class {
  async start():Promise<void>{}
  async shutdown():Promise<void>{}
}}));

it("settles real client replies even when optional diagnostics throw",async()=>{
  const controller=new AbortController();
  let worker:PhysicsWorkerStub|undefined;
  const callbackErrors:unknown[]=[],observed=vi.fn(()=>{throw new Error("optional telemetry sink failed");});
  class PhysicsWorkerStub {
    onmessage:((event:MessageEvent<HvpPhysicsReply>)=>void)|null=null;
    onerror:((event:ErrorEvent)=>void)|null=null;
    onmessageerror:((event:MessageEvent)=>void)|null=null;
    terminated=false;
    readonly messages:HvpPhysicsMessage[]=[];
    sequence=0;
    constructor(){worker=this;}
    postMessage(message:HvpPhysicsMessage):void {
      this.messages.push(message);
      queueMicrotask(()=>{
        const disposed=message.kind==="Dispose";
        const snapshot={status:disposed?"Disposed":"Running",bodyCount:disposed?0:1,colliderCount:0,collisionBytes:0} as HvpPhysicsSnapshot;
        const reply:HvpPhysicsReply={id:message.id,protocol:message.protocol,incarnation:message.incarnation,sequence:++this.sequence,snapshot,
          timings:{origin:performance.timeOrigin,steps:[],dropped:0},
          clock:{timers:disposed?0:1,maxTimerGapMs:0,maxAdvanceMs:0,maxHandlerMs:0,lastCommand:message.kind,
            lastHandlerMs:0,delayedCallbacks:[]}};
        try {this.onmessage?.({data:reply} as MessageEvent<HvpPhysicsReply>);}
        catch(error){callbackErrors.push(error);}
      });
    }
    terminate():void{this.terminated=true;}
  }
  vi.stubGlobal("Worker",PhysicsWorkerStub);
  let client:Awaited<ReturnType<typeof createHvpPhysicsClient>>|undefined;
  try {
    const starting=createHvpPhysicsClient([],{x:0,y:1,z:0},controller.signal,undefined,undefined,undefined,undefined,"branch",observed);
    void starting.catch(()=>undefined);
    // A completion-turn oracle avoids waiting for the 20-second production timeout.
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    expect(callbackErrors).toEqual([]);
    client=await starting;
    expect(client.read().status).toBe("Running");
    client.update();
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    expect(callbackErrors).toEqual([]);
    expect(client.lifecycle?.()).toMatchObject({workers:1,pendingJobs:0,timingSinkFailures:1});
    expect(worker?.messages.some(message=>message.kind==="Read"&&message.measure===false)).toBe(true);
    await client.dispose();
    expect(callbackErrors).toEqual([]);
    expect(worker?.terminated).toBe(true);
    expect(observed).toHaveBeenCalledTimes(1);
  } finally {
    controller.abort();
    vi.unstubAllGlobals();
  }
});

it.each([false,true])("frees a saturated reply slot before a reentrant failing sink (rejected=%s)",async rejected=>{
  const controller=new AbortController(),callbackErrors:unknown[]=[];
  let worker:HoldingWorker|undefined,client:Awaited<ReturnType<typeof createHvpPhysicsClient>>|undefined;
  const snapshot={status:"Running",bodyCount:1,colliderCount:0,collisionBytes:0} as HvpPhysicsSnapshot;
  let sinkCalls=0;
  class HoldingWorker {
    onmessage:((event:MessageEvent<HvpPhysicsReply>)=>void)|null=null;
    onerror:((event:ErrorEvent)=>void)|null=null;
    onmessageerror:((event:MessageEvent)=>void)|null=null;
    readonly held:HvpPhysicsMessage[]=[];
    readonly messages:HvpPhysicsMessage[]=[];
    sequence=0;
    terminated=false;
    constructor(){worker=this;}
    postMessage(message:HvpPhysicsMessage):void{
      this.messages.push(message);
      if(message.kind==="Pause"){this.held.push(message);}
      else{queueMicrotask(()=>this.deliver(message));}
    }
    deliver(message:HvpPhysicsMessage,reject=false):void{
      const disposed=message.kind==="Dispose";
      const reply:HvpPhysicsReply={id:message.id,protocol:message.protocol,incarnation:message.incarnation,sequence:++this.sequence,snapshot:disposed?{...snapshot,status:"Disposed",bodyCount:0}:snapshot,
        ...(reject?{rejected:"original native rejection"}:{}),
        timings:{origin:performance.timeOrigin,steps:[],dropped:0},
        clock:{timers:disposed?0:1,maxTimerGapMs:0,maxAdvanceMs:0,maxHandlerMs:0,lastCommand:message.kind,
          lastHandlerMs:0,delayedCallbacks:[]}};
      try{this.onmessage?.({data:reply} as MessageEvent<HvpPhysicsReply>);}catch(error){callbackErrors.push(error);}
    }
    terminate():void{this.terminated=true;}
  }
  vi.stubGlobal("Worker",HoldingWorker);
  try{
    client=await createHvpPhysicsClient([],{x:0,y:1,z:0},controller.signal,undefined,undefined,undefined,undefined,"branch",()=>{
      sinkCalls+=1;
      if(client&&sinkCalls===2){client.update();throw new Error("reentrant optional sink failed");}
    });
    const commands=Array.from({length:8},()=>client!.command("Pause"));
    for(const command of commands){void command.catch(()=>undefined);}
    expect(client.lifecycle?.().pendingJobs).toBe(8);
    const first=worker!.held.shift()!;
    worker!.deliver(first,rejected);
    expect(callbackErrors).toEqual([]);
    expect(worker!.messages.filter(message=>message.kind==="Read")).toHaveLength(1);
    expect(client.lifecycle?.().pendingJobs).toBe(8); // seven Pause + one admitted reentrant Read
    for(const message of worker!.held.splice(0)){worker!.deliver(message);}
    const settled=await Promise.allSettled(commands);
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    expect(settled[0]?.status).toBe(rejected?"rejected":"fulfilled");
    if(rejected){
      if(settled[0]?.status!=="rejected"){throw new Error("Original native rejection was lost");}
      expect(settled[0].reason).toBeInstanceOf(Error);
      expect(settled[0].reason.message).toBe("original native rejection");
    }
    expect(settled.slice(1).every(result=>result.status==="fulfilled")).toBe(true);
    expect(client.read()).toBe(snapshot);
    expect(client.lifecycle?.()).toMatchObject({workers:1,pendingJobs:0,timingSinkFailures:1});
    expect(worker!.terminated).toBe(false);
    expect(sinkCalls).toBe(2); // Initialize and the failing reply, never the queued old replies.
    await client.dispose();
    expect(worker!.terminated).toBe(true);
    expect(callbackErrors).toEqual([]);
  }finally{controller.abort();vi.unstubAllGlobals();}
});

it("transfers only the complete Restore catalogue and rejects mixed replacement ownership before detaching",async()=>{
  const controller=new AbortController();let sent:HvpPhysicsMessage|undefined,transfers:Transferable[]=[];
  class WorkerStub {
    onmessage:((event:MessageEvent<HvpPhysicsReply>)=>void)|null=null;
    onerror:((event:ErrorEvent)=>void)|null=null;onmessageerror:((event:MessageEvent)=>void)|null=null;
    sequence=0;
    postMessage(message:HvpPhysicsMessage,buffers:Transferable[]=[]):void{
      const received=structuredClone(message,{transfer:buffers});
      if(message.kind==="PrepareRestore"){sent=received;transfers=buffers;}
      queueMicrotask(()=>this.onmessage?.({data:{id:message.id,protocol:message.protocol,incarnation:message.incarnation,sequence:++this.sequence,
        snapshot:{status:message.kind==="Dispose"?"Disposed":"Paused",bodyCount:message.kind==="Dispose"?0:1,colliderCount:0,collisionBytes:0} as HvpPhysicsSnapshot,
        clock:{timers:message.kind==="Dispose"?0:1,maxTimerGapMs:0,maxAdvanceMs:0,maxHandlerMs:0,lastCommand:message.kind,lastHandlerMs:0,delayedCallbacks:[]},
        ...(message.kind==="PrepareRestore"?{restoreState:"Prepared"}:message.kind==="RollbackRestore"?{restoreState:"RolledBack"}:{})}} as unknown as MessageEvent<HvpPhysicsReply>));
    }
    terminate():void{}
  }
  vi.stubGlobal("Worker",WorkerStub);
  let client:Awaited<ReturnType<typeof createHvpPhysicsClient>>|undefined;
  try{
    client=await createHvpPhysicsClient([],{x:0,y:1,z:0},controller.signal);
    const mesh={vertices:new Float32Array([0,0,0,1,0,0,0,0,1]),indices:new Uint32Array([0,1,2])},complete={sectors:[mesh],layout:null};
    const saved={} as Parameters<typeof client.prepareRestore>[1];
    await expect(client.prepareRestore("mixed",saved,[{index:0,mesh}],complete)).rejects.toThrow(/Mixed complete/);
    expect(mesh.vertices.byteLength).toBe(36);expect(sent).toBeUndefined();
    await client.prepareRestore("full",saved,[],complete);
    expect(transfers).toHaveLength(2);expect(mesh.vertices.byteLength).toBe(0);expect(mesh.indices.byteLength).toBe(0);
    expect(sent?.kind).toBe("PrepareRestore");
    if(sent?.kind!=="PrepareRestore"){throw new Error("Missing complete transfer");}
    expect(sent.replacements).toEqual([]);expect(sent.completeCollision?.sectors[0]?.vertices).toEqual(new Float32Array([0,0,0,1,0,0,0,0,1]));
    await client.rollbackRestore("full");expect(client.lifecycle?.().pendingJobs).toBe(0);await client.dispose();
  }finally{controller.abort();vi.unstubAllGlobals();}
});
