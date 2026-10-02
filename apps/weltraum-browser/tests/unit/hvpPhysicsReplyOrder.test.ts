import {expect,it,vi} from "vitest";
import {createHvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import {HVP_PHYSICS_PROTOCOL} from "../../src/hestia-prototype/physics/physicsProtocol";
import type {HvpPhysicsMessage,HvpPhysicsReply,HvpPhysicsSnapshot} from "../../src/hestia-prototype/physics/physicsWorker";
import type {HvpWorldCheckpoint} from "../../src/hestia-prototype/persistence/worldCheckpoint";

vi.mock("../../src/workers/workerPool",()=>({WorkerPool:class {
  async start():Promise<void>{}
  async shutdown():Promise<void>{}
}}));
const snapshot=(ticks:number,disposed=false)=>({status:disposed?"Disposed":"Paused",ticks,
  bodyCount:disposed?0:1,colliderCount:0,collisionBytes:0} as HvpPhysicsSnapshot);
const clock=(value:number,disposed=false)=>({timers:disposed?0:1,maxTimerGapMs:value,maxAdvanceMs:0,maxHandlerMs:0,
  lastCommand:"Read",lastHandlerMs:0,delayedCallbacks:[]});
class HeldWorker {
  static current:HeldWorker;
  onmessage:((event:MessageEvent<HvpPhysicsReply>)=>void)|null=null;
  onerror:((event:ErrorEvent)=>void)|null=null;
  onmessageerror:((event:MessageEvent)=>void)|null=null;
  readonly messages:HvpPhysicsMessage[]=[];
  sequence=0;
  terminated=false;
  beforePost?: (message:HvpPhysicsMessage)=>void;
  constructor(){HeldWorker.current=this;}
  postMessage(message:HvpPhysicsMessage):void {
    this.messages.push(message);
    this.beforePost?.(message);
    if(message.kind==="Initialize"||message.kind==="Dispose"){
      queueMicrotask(()=>this.deliver(message));
    }
  }
  last():HvpPhysicsMessage {return this.messages.at(-1)!;}
  deliver(message:HvpPhysicsMessage,patch:Partial<HvpPhysicsReply>={}):void {
    const sequence=patch.sequence??this.sequence+1;
    this.sequence=Math.max(this.sequence,sequence);
    const disposed=message.kind==="Dispose";
    this.onmessage?.({data:{id:message.id,protocol:message.protocol,incarnation:message.incarnation,sequence,
      snapshot:snapshot(disposed?0:100,disposed),clock:clock(sequence,disposed),...patch}} as MessageEvent<HvpPhysicsReply>);
  }
  terminate():void {this.terminated=true;}
}
const withClient=async(run:(client:Awaited<ReturnType<typeof createHvpPhysicsClient>>,worker:HeldWorker)=>Promise<void>,
  onTimings?:(batch:NonNullable<HvpPhysicsReply["timings"]>)=>void)=>{
  const controller=new AbortController();
  vi.stubGlobal("Worker",HeldWorker);
  let client:Awaited<ReturnType<typeof createHvpPhysicsClient>>|undefined;
  try{
    client=await createHvpPhysicsClient([],{x:0,y:1,z:0},controller.signal,undefined,undefined,undefined,undefined,"branch",onTimings);
    await run(client,HeldWorker.current);
  }finally{
    await client?.dispose().catch(()=>undefined);
    controller.abort();vi.unstubAllGlobals();
  }
};

it("settles request IDs while publishing by owner sequence, not request order",async()=>{
  await withClient(async(client,worker)=>{
    const older=client.command("Pause"),first=worker.last();
    const newer=client.command("Pause"),second=worker.last();
    worker.deliver(second,{sequence:2,snapshot:snapshot(20),clock:clock(20)});
    await newer;
    worker.deliver(first,{sequence:3,snapshot:snapshot(30),clock:clock(30)});
    await older;
    expect(client.read().ticks).toBe(30);expect(client.clock?.maxTimerGapMs).toBe(30);

    const third=client.command("Pause"),thirdMessage=worker.last();
    const fourth=client.command("Pause"),fourthMessage=worker.last();
    worker.deliver(thirdMessage,{sequence:5,snapshot:snapshot(50),clock:clock(50)});
    await third;
    worker.deliver(fourthMessage,{sequence:4,snapshot:snapshot(40),clock:clock(40)});
    await fourth;
    expect(client.read().ticks).toBe(50);expect(client.clock?.maxTimerGapMs).toBe(50);
    expect(client.lifecycle?.().pendingJobs).toBe(0);
  });
});

it.each([false,true])("ignores foreign/settled errors but preserves the bound fatal timer channel (pending=%s)",async hasPending=>{
  await withClient(async(client,worker)=>{
    const request=client.command("Pause"),message=worker.last();
    worker.deliver(message,{incarnation:"old-owner",error:"foreign fatal",snapshot:snapshot(999)});
    expect(client.read().ticks).toBe(100);expect(client.lifecycle?.().pendingJobs).toBe(1);
    expect(worker.terminated).toBe(false);
    worker.deliver(message,{snapshot:snapshot(10)});await request;
    worker.deliver(message,{error:"late settled-request error"});
    worker.deliver({...message,id:-1},{incarnation:"old-owner",error:"foreign timer error"});
    expect(client.read().ticks).toBe(10);expect(worker.terminated).toBe(false);
    const pending=hasPending?client.command("Pause"):undefined;
    const failure=pending===undefined?undefined:expect(pending).rejects.toThrow("real bound timer error");
    worker.deliver({...message,id:-1},{error:"real bound timer error"});
    await failure;
    expect(()=>client.read()).toThrow("real bound timer error");
    expect(worker.terminated).toBe(true);expect(client.lifecycle?.().pendingJobs).toBe(0);
  });
});

it.each(["protocol","sequence","incarnation","null-incarnation"] as const)("fails closed for a current reply with invalid %s",async field=>{
  await withClient(async(client,worker)=>{
    const pending=client.command("Pause"),message=worker.last();
    const failure=expect(pending).rejects.toThrow("Invalid physics reply binding");
    const invalid:Partial<HvpPhysicsReply>={};
    Reflect.set(invalid,field==="null-incarnation"?"incarnation":field,
      field==="protocol"?"hvp-physics-owner-v2":field==="sequence"?NaN:field==="null-incarnation"?null:undefined);
    worker.deliver(message,invalid);await failure;
    expect(worker.terminated).toBe(true);
  });
});

it("keeps the owning Restore receipt across Pause/Inspect and a late Read after Finalize",async()=>{
  await withClient(async(client,worker)=>{
    client.update();const oldRead=worker.last();
    const preparing=client.prepareRestore("restore",{} as HvpWorldCheckpoint,[]),prepareMessage=worker.last();
    const candidate=snapshot(5);
    worker.deliver(prepareMessage,{snapshot:candidate,restoreState:"Prepared"});
    expect(await preparing).toBe(candidate);
    const pause=client.command("Pause");worker.deliver(worker.last(),{snapshot:snapshot(999),restoreState:"Preparing"});await pause;
    const committing=client.commitRestore("restore"),commitMessage=worker.last();
    const committed=snapshot(6);
    worker.deliver(commitMessage,{snapshot:committed,restoreState:"Committed"});await committing;
    const inspect=client.command("Inspect");worker.deliver(worker.last(),{snapshot:snapshot(1000),restoreState:"Preparing",clock:clock(1234)});await inspect;
    const observedClock=client.clock;
    client.publishRestore();expect(client.read()).toBe(committed);
    expect(client.clock).toBe(observedClock);
    expect(client.clock?.maxTimerGapMs).toBe(1234);
    const finalizing=client.finalizeRestore("restore");
    worker.deliver(worker.last(),{snapshot:committed,restoreState:"Finalized"});await finalizing;
    worker.deliver(oldRead,{snapshot:snapshot(2000)});
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    expect(client.read()).toBe(committed);
    expect(client.lifecycle?.().pendingJobs).toBe(0);
    expect(worker.messages.every(message=>message.protocol===HVP_PHYSICS_PROTOCOL
      &&message.incarnation===prepareMessage.incarnation)).toBe(true);
  });
});

it("invalidates saved transport callbacks after native disposal",async()=>{
  await withClient(async(client,worker)=>{
    const callback=worker.onmessage!;
    const binding=worker.messages[0]!;
    await client.dispose();
    callback({data:{id:-1,protocol:binding.protocol,incarnation:binding.incarnation,sequence:999,error:"late timer"}} as MessageEvent<HvpPhysicsReply>);
    expect(()=>client.read()).toThrow("Physics disposed");
    expect(worker.terminated).toBe(true);expect(client.lifecycle?.().pendingJobs).toBe(0);
  });
});

it("retains the Restore candidate when diagnostics synchronously observe and then throw",async()=>{
  let client:Awaited<ReturnType<typeof createHvpPhysicsClient>>|undefined,observation:Promise<void>|undefined;
  await withClient(async(current,worker)=>{
    client=current;
    worker.beforePost=message=>{
      if(message.kind==="Pause"){worker.deliver(message,{snapshot:snapshot(999),restoreState:"Preparing"});}
    };
    const preparing=client.prepareRestore("observed",{} as HvpWorldCheckpoint,[]),prepare=worker.last();
    const candidate=snapshot(5);
    worker.deliver(prepare,{snapshot:candidate,restoreState:"Prepared",timings:{origin:0,steps:[],dropped:0}});
    await observation;expect(await preparing).toBe(candidate);
    expect(client.lifecycle?.().timingSinkFailures).toBe(1);
    const commit=client.commitRestore("observed");
    worker.deliver(worker.last(),{snapshot:candidate,restoreState:"Committed"});await commit;
    client.publishRestore();expect(client.read()).toBe(candidate);
    const finalize=client.finalizeRestore("observed");
    worker.deliver(worker.last(),{snapshot:candidate,restoreState:"Finalized"});await finalize;
    worker.beforePost=undefined;
  },()=>{
    observation=client!.command("Pause");
    throw new Error("optional Restore observation failed");
  });
});

it("installs the held request cutoff before even a synchronous post callback",async()=>{
  await withClient(async(client,worker)=>{
    client.update();const read=worker.last(),before=client.read();
    let checked=false;
    worker.beforePost=message=>{
      if(message.kind!=="PrepareTerrain"){return;}
      worker.deliver(read,{snapshot:snapshot(999)});
      expect(client.read()).toBe(before);checked=true;
    };
    const preparing=client.prepareTerrain("terrain",0,[]),message=worker.last();
    worker.beforePost=undefined;
    worker.deliver(message,{snapshot:{...snapshot(100),terrainTransaction:"PreparedHeld"}});
    await preparing;expect(checked).toBe(true);
    const rollback=client.rollbackTerrain("terrain");worker.deliver(worker.last());await rollback;
  });
});

it("settles the original deadline once and ignores replies after timeout termination",async()=>{
  await withClient(async(client,worker)=>{
    vi.useFakeTimers({toFake:["setTimeout","clearTimeout"]});
    try{
      const callback=worker.onmessage!;
      const request=client.command("Pause"),message=worker.last();
      const rejection=expect(request).rejects.toThrow("Physics worker response deadline exceeded");
      await vi.advanceTimersByTimeAsync(20_000);await rejection;
      expect(client.lifecycle?.().pendingJobs).toBe(0);expect(worker.terminated).toBe(true);
      callback({data:{id:message.id,protocol:message.protocol,incarnation:message.incarnation,sequence:500,
        snapshot:snapshot(500),error:"late failure"}} as MessageEvent<HvpPhysicsReply>);
      expect(()=>client.read()).toThrow("Physics worker response deadline exceeded");
    }finally{vi.useRealTimers();}
  });
});
