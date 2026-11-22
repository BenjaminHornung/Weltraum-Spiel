import {expect,it,vi} from "vitest";
import {createHvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import {createHvpTerrainConsumer} from "../../src/hestia-prototype/terrain/terrainConsumer";
import {createHvpTerrainRoot,type HvpCutRequest} from "../../src/hestia-prototype/terrain/cutPlan";
import type {HvpPhysicsMessage,HvpPhysicsReply} from "../../src/hestia-prototype/physics/physicsWorker";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";

vi.mock("../../src/workers/workerPool",()=>({WorkerPool:class {async start(){} async shutdown(){}}}));
const floor={sizeX:4,sizeY:16,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0};

it.each(["delayed","before-L","after-L"] as const)("keeps the normal consumer and real solver coupled across %s delivery",async fault=>{
  type Host={onmessage:(event:MessageEvent<HvpPhysicsMessage>)=>Promise<void>;postMessage:(reply:HvpPhysicsReply)=>void};
  const host=globalThis as unknown as Host,ports=new Map<string,ChannelWorker>(),commands:string[]=[],closing:Promise<void>[]=[];
  const oldOn=Object.getOwnPropertyDescriptor(host,"onmessage");
  let sawBarrier!:()=>void,resume!:()=>void;
  const barrier=new Promise<void>(resolve=>{sawBarrier=resolve;}),release=new Promise<void>(resolve=>{resume=resolve;});
  let faulted=false,oldDelivery:(()=>void)|undefined;
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
      if(message.kind==="Initialize"){Object.assign(message,{sectors:[...collisionSectors(floor)]});}
      if(!faulted&&(fault==="before-L"?message.kind==="CommitTerrain":message.kind==="FinalizeTerrain")){
        faulted=true;sawBarrier();
        void release.then(()=>{
          if(fault==="delayed"){void this.dispatch(message);}
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
  const timer=vi.spyOn(globalThis,"setInterval").mockImplementation(()=>1 as unknown as ReturnType<typeof setInterval>);
  const physics=await createHvpPhysicsClient([],{x:2,y:3,z:2},new AbortController().signal);
  const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},sourceDigest:"12345678",
    readSlot:(_x,y,_z)=>y<80?1:0},"channel",1);
  let uploads=0;
  const consumer=createHvpTerrainConsumer(root,async plan=>({source:plan.after,render:new Map(),collision:new Map([
    [0,{vertices:new Float32Array(),indices:new Uint32Array()}]])}),()=>{uploads+=1;throw new Error("Injected device loss");},physics);
  const request=(id:string,x:number):HvpCutRequest=>({commandId:id,sessionId:"channel",epoch:1,
    revision:root.read().revision,sourceDigest:root.read().sourceDigest,toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[x,79,56],max:[x+1,80,57]}});
  try{
    const first=request("one",40),second=request("two",41),cut=consumer.submit(first);
    await barrier;expect(root.read().revision).toBe(fault==="before-L"?0:1);
    expect(consumer.submit(first)).toBe(cut);
    const conflict=await consumer.submit({...first,shape:second.shape});expect(conflict.reason).toBe("IdempotencyConflict");
    const next=consumer.submit(second,source=>({...second,revision:source.revision,sourceDigest:source.sourceDigest}));
    await expect(consumer.checkpoint()).rejects.toThrow(/boundary/);resume();
    const [one,two]=await Promise.all([cut,next]);
    expect(one.status,one.reason).toBe(fault==="before-L"?"Rejected":"Applied");expect(two.status,two.reason).toBe("Applied");
    expect(root.read().revision).toBe(fault==="before-L"?1:2);
    oldDelivery?.();expect(physics.read().terrainGeneration).toBe(root.read().revision);
    expect(consumer.submit(first)).toBe(cut);const saved=await consumer.checkpoint();
    expect(saved.entries.filter(e=>e.outcome.status==="Applied")).toHaveLength(root.read().revision);
    expect(commands.filter(c=>c==="RecoverTerrain")).toHaveLength(fault==="delayed"?0:1);
    expect(uploads).toBe(0);await consumer.presentNext();expect(consumer.read().renderError).toMatch(/device loss/);
    expect(physics.read().terrainTransaction).toBe("Idle");expect(consumer.read().state).toBe("Applied");
  }finally{
    resume();consumer.dispose();await physics.dispose();await Promise.allSettled(closing);timer.mockRestore();vi.unstubAllGlobals();
    if(oldOn){Object.defineProperty(host,"onmessage",oldOn);}else{Reflect.deleteProperty(host,"onmessage");}
  }
},60000);
