import {expect,it,vi} from "vitest";
import {createHvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import {createHvpTerrainConsumer} from "../../src/hestia-prototype/terrain/terrainConsumer";
import {createHvpTerrainRoot,type HvpCutRequest} from "../../src/hestia-prototype/terrain/cutPlan";
import type {HvpPhysicsMessage,HvpPhysicsReply} from "../../src/hestia-prototype/physics/physicsWorker";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";

vi.mock("../../src/workers/workerPool",()=>({WorkerPool:class {async start(){} async shutdown(){}}}));
const floor={sizeX:4,sizeY:16,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0};

it.each(["delayed","before-L","after-L","after-two","overrun","during-install","bad-prepare","recovery-rejected","catalog-demand","catalog-overrun","catalog-paused"] as const)("keeps the normal consumer and real solver coupled across %s delivery",async fault=>{
  type Host={onmessage:(event:MessageEvent<HvpPhysicsMessage>)=>Promise<void>;postMessage:(reply:HvpPhysicsReply)=>void};
  const host=globalThis as unknown as Host,ports=new Map<string,ChannelWorker>(),commands:string[]=[],closing:Promise<void>[]=[];
  const oldOn=Object.getOwnPropertyDescriptor(host,"onmessage");
  let sawBarrier!:()=>void,resume!:()=>void,clockStarted=false;
  const barrier=new Promise<void>(resolve=>{sawBarrier=resolve;}),release=new Promise<void>(resolve=>{resume=resolve;});
  let clockTime=0;
  const time=fault.startsWith("catalog-")?vi.spyOn(performance,"now").mockImplementation(()=>clockTime):undefined;
  let catalogReceipts=0,hotProofs=0,faulted=false,oldDelivery:(()=>void)|undefined;
  class ChannelWorker{
    onmessage:((event:MessageEvent<HvpPhysicsReply>)=>void)|null=null;
    onerror:((event:ErrorEvent)=>void)|null=null;onmessageerror=null;
    private handler:Host["onmessage"]|undefined;private incarnation:string|undefined;
    async dispatch(message:HvpPhysicsMessage){
      if(!this.handler){
        vi.resetModules();await import("../../src/hestia-prototype/physics/physicsWorker");this.handler=host.onmessage;
        ports.set(message.incarnation,this);this.incarnation=message.incarnation;
      }
      await this.handler({data:message} as MessageEvent<HvpPhysicsMessage>);
    }
    postMessage(value:HvpPhysicsMessage){
      const message=structuredClone(value);commands.push(message.kind);
      if(fault==="recovery-rejected"&&message.kind==="RecoverTerrain"){Object.assign(message.image.motion,{worldId:"foreign-world"});}
      if(message.kind==="Initialize"){Object.assign(message,{sectors:[...collisionSectors(floor)]});}
      if(fault!=="during-install"&&!faulted&&"transactionId" in message&&message.transactionId==="one"&&(fault==="bad-prepare"?message.kind==="PrepareTerrain":fault==="before-L"?message.kind==="CommitTerrain":message.kind==="FinalizeTerrain")){
        faulted=true;sawBarrier();
        void release.then(()=>{
          if(fault==="delayed"||fault==="bad-prepare"){void this.dispatch(message);}
          else{
            const saved=this.onmessage;
            oldDelivery=()=>saved?.({data:{protocol:message.protocol,id:message.id,incarnation:message.incarnation,
              sequence:999999,error:"stale owner"}} as MessageEvent<HvpPhysicsReply>);
            this.onerror?.({message:"injected worker loss"} as ErrorEvent);
          }
        });
      }else{void this.dispatch(message);}
    }
    receive(reply:HvpPhysicsReply){
      if(fault==="during-install"&&!faulted&&reply.beforeTerrainInstall?.binding.commandId==="one"){
        this.onmessage?.({data:structuredClone(reply)} as MessageEvent<HvpPhysicsReply>);hotProofs++;
        faulted=true;sawBarrier();void release.then(()=>this.onerror?.({message:"lost native installation"} as ErrorEvent));return;
      }
      if(fault==="during-install"&&reply.terrainReceipt?.commandId==="one"&&reply.snapshot?.terrainTransaction==="PreparedHeld"){return;}
      if(reply.beforeTerrainInstall){hotProofs++;}
      if(fault==="bad-prepare"&&reply.snapshot?.terrainTransaction==="PreparedHeld"&&reply.terrainReceipt?.commandId==="one"){
        reply={...reply,terrainReceipt:{...reply.terrainReceipt,baseDigest:"wrong-digest"}};
      }
      if(reply.recoveryAssets){
        if(catalogReceipts===0){expect(clockStarted).toBe(false);}
        else if(fault.startsWith("catalog-")){clockTime+=583;}
        catalogReceipts++;
      }
      if(reply.terrainMotion){
        hotProofs++;expect(reply.recoveryAssets).toBeUndefined();
        expect(Object.keys(reply.terrainMotion)).not.toContain("collision");
        expect(JSON.stringify(reply.terrainMotion).length).toBeLessThan(4096);
      }
      this.onmessage?.({data:structuredClone(reply)} as MessageEvent<HvpPhysicsReply>);
      if(reply.terrainReceipt){this.onmessage?.({data:structuredClone(reply)} as MessageEvent<HvpPhysicsReply>);}
    }
    terminate(){
      if(this.handler&&this.incarnation){const dispose={id:10000,protocol:"hvp-physics-owner-v3" as const,incarnation:this.incarnation,kind:"Dispose" as const};
        closing.push(this.handler({data:dispose} as MessageEvent<HvpPhysicsMessage>));}
    }
  }
  vi.stubGlobal("Worker",ChannelWorker);
  vi.stubGlobal("postMessage",(reply:HvpPhysicsReply)=>ports.get(reply.incarnation)?.receive(reply));
  let nativeTimer:()=>void=()=>{throw new Error("Missing worker clock");};
  const timer=vi.spyOn(globalThis,"setInterval").mockImplementation(handler=>{
    clockStarted=true;nativeTimer=handler as ()=>void;return 1 as unknown as ReturnType<typeof setInterval>;
  });
  const physics=await createHvpPhysicsClient([],{x:2,y:3,z:2},new AbortController().signal);
  const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},sourceDigest:"12345678",
    readSlot:(_x,y,_z)=>y<80?1:0},"channel",1);
  let uploads=0;
  const consumer=createHvpTerrainConsumer(root,async plan=>({source:plan.after,render:new Map(),collision:new Map([
    [0,{vertices:new Float32Array(),indices:new Uint32Array()}]])}),()=>{uploads+=1;throw new Error("Injected device loss");},physics);
  const request=(id:string,x:number):HvpCutRequest=>({commandId:id,sessionId:"channel",epoch:1,
    revision:root.read().revision,sourceDigest:root.read().sourceDigest,toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[x,79,56],max:[x+1,80,57]}});
  try{
    await physics.primeTerrainRecovery!();expect(catalogReceipts).toBe(1);expect(commands).not.toContain("PrimeTerrainRecovery");
    if(fault.startsWith("catalog-")){
      // An unbound native mutation invalidates the old geometry catalog, as a branch/body mutation does.
      await physics.prepareTerrain("legacy",0,[{index:0,mesh:{vertices:new Float32Array(),indices:new Uint32Array()}}]);
      await physics.commitTerrain("legacy");physics.publishTerrain(1);await physics.finalizeTerrain("legacy");
      expect(physics.read().status).toBe("Running");physics.update();
      expect(commands).not.toContain("PrimeTerrainRecovery");
      if(fault==="catalog-paused"){
        await physics.command("Pause");expect(physics.read().status).toBe("Paused");
        expect(commands).not.toContain("PrimeTerrainRecovery");
      }else{
        clockTime+=fault==="catalog-overrun"?120:9;
        await physics.primeTerrainRecovery!();nativeTimer();await physics.command("Inspect");
        expect(physics.read().status).toBe(fault==="catalog-overrun"?"SimulationHold":"Running");
        expect(physics.read().backlogSeconds).toBeCloseTo(fault==="catalog-overrun"?.120-4/60:.009,6);
        expect(physics.read().discardedSeconds).toBe(0);
      }
      expect(catalogReceipts).toBe(2);expect(physics.lifecycle?.().terrainRecovery?.catalogs).toBe(1);return;
    }
    if(fault==="overrun"){
      await new Promise(resolve=>setTimeout(resolve,100));nativeTimer();await physics.command("Inspect");
      expect(physics.read().status).toBe("SimulationHold");
    }
    if(fault==="after-two"){
      for(let i=0;i<2;i++){const prior=await consumer.submit(request("prefill"+i,42+i));expect(prior.status,prior.reason).toBe("Applied");}
    }
    const initial=root.read().revision,preL=fault==="before-L"||fault==="bad-prepare"||fault==="during-install";
    const first=request("one",40),second=request("two",41),cut=consumer.submit(first);
    await barrier;expect(root.read().revision).toBe(initial+(preL?0:1));
    expect(consumer.submit(first)).toBe(cut);
    const conflict=await consumer.submit({...first,shape:second.shape});expect(conflict.reason).toBe("IdempotencyConflict");
    const next=consumer.submit(second,source=>({...second,revision:source.revision,sourceDigest:source.sourceDigest}));
    await expect(consumer.checkpoint()).rejects.toThrow(/boundary/);resume();
    const [one,two]=await Promise.all([cut,next]);
    if(fault==="recovery-rejected"){
      expect(one.status).toBe("RecoveryHold");expect(two.status).toBe("Rejected");
      expect(root.read().revision).toBe(initial+1);expect(consumer.submit(first)).toBe(cut);
      await expect(consumer.checkpoint()).rejects.toThrow(/boundary/);expect(()=>physics.read()).toThrow(/RecoveryHold/);return;
    }
    expect(one.status,one.reason).toBe(preL?"Rejected":"Applied");expect(two.status,two.reason).toBe("Applied");
    expect(root.read().revision).toBe(initial+(preL?1:2));
    oldDelivery?.();expect(physics.read().terrainGeneration).toBe(root.read().revision);
    expect(consumer.submit(first)).toBe(cut);const saved=await consumer.checkpoint();
    expect(saved.entries.filter(e=>e.outcome.status==="Applied")).toHaveLength(root.read().revision);
    expect(commands.filter(c=>c==="RecoverTerrain")).toHaveLength(fault==="delayed"||fault==="bad-prepare"?0:1);
    expect(catalogReceipts).toBe(1);expect(hotProofs).toBeGreaterThan(1);
    expect(physics.lifecycle?.().terrainRecovery).toMatchObject({catalogs:1,entries:root.read().revision,sectors:1,held:0});
    expect(uploads).toBe(0);await consumer.presentNext();expect(consumer.read().renderError).toMatch(/device loss/);
    if(fault==="overrun"){expect(physics.read().status).toBe("SimulationHold");}
    expect(physics.read().terrainTransaction).toBe("Idle");expect(consumer.read().state).toBe("Applied");
  }finally{
    resume();consumer.dispose();
    if(fault==="recovery-rejected"){await expect(physics.dispose()).rejects.toThrow(/RecoveryHold/);}else{await physics.dispose();}
    expect(physics.lifecycle?.().terrainRecovery).toEqual({catalogs:0,entries:0,sectors:0,fragments:0,held:0});
    await Promise.allSettled(closing);timer.mockRestore();time?.mockRestore();vi.unstubAllGlobals();
    if(oldOn){Object.defineProperty(host,"onmessage",oldOn);}else{Reflect.deleteProperty(host,"onmessage");}
  }
},60000);
