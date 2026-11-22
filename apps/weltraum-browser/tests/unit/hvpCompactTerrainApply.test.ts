import {expect,it,vi} from "vitest";
import {createHvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import {bindHvpPhysicsOwner,type HvpPhysicsOwnerPort,type HvpWorkerMessage,type HvpWorkerReply} from "../../src/hestia-prototype/physics/physicsWorkerHost";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import {createTerrainComponentIndex,materializeCompactCells} from "../../src/voxel/structural/componentIndex";
import {HVP_SOURCE_MIN_METERS} from "../../src/hvp/hvpCoastSource";
import {cutAt,rootFor,uFixture} from "./componentIndex/compactFixtures";
import type {HvpCutSpan} from "../../src/hestia-prototype/runtime/cutTrace";
vi.mock("../../src/workers/workerPool",()=>({WorkerPool:class {async start(){} async shutdown(){}}}));
const floor={sizeX:4,sizeY:16,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0};

it.each(["ack","before-install","lost-ack","stale-root","forged-reply"] as const)("applies compact publication with a real R05 owner: %s",async fault=>{
  const commands:{kind:string;incarnation:string}[]=[],replies:string[]=[],spans:HvpCutSpan[]=[];
  let faulted=false,late:undefined|(()=>void),baseTick:number|undefined;
  const close:Promise<void>[]=[];
  class Transport{
    onmessage:((e:MessageEvent<HvpWorkerReply>)=>void)|null=null;
    onerror:((e:ErrorEvent)=>void)|null=null;onmessageerror=null;
    private owner:HvpPhysicsOwnerPort={postMessage:value=>{
      const reply=structuredClone(value),handler=this.onmessage;
      if(reply.terrainPlan && reply.snapshot){
        replies.push("ApplyCompactTerrain");
        if(fault==="lost-ack"&&!faulted){faulted=true;baseTick=reply.terrainMotion!.tick.ticks;
          late=()=>handler?.({data:reply} as MessageEvent<HvpWorkerReply>);
          this.onerror?.({message:"cut worker lost after native commit"} as ErrorEvent);return;
        }
        if(fault==="forged-reply")Object.assign(reply.terrainPlan.sourceViews[0]!,{sourceDigest:"hvp-material-cells-v1:aaaaaaaaaaaaaaaa"});
        if(baseTick!==undefined)expect(reply.terrainMotion!.tick.ticks).toBe(baseTick);
      }
      this.onmessage?.({data:reply} as MessageEvent<HvpWorkerReply>);
      if(reply.terrainPlan)this.onmessage?.({data:reply} as MessageEvent<HvpWorkerReply>);
    }};
    private terminateOwner=bindHvpPhysicsOwner(this.owner);
    postMessage(value:HvpWorkerMessage,transfers:Transferable[]=[]){
      const msg=structuredClone(value,{transfer:transfers});commands.push({kind:msg.kind,incarnation:msg.incarnation});
      if(msg.kind==="Initialize")Object.assign(msg,{sectors:[...collisionSectors(floor)]});
      if(fault==="before-install"&&msg.kind==="ApplyCompactTerrain")Object.assign(msg.fragments[0]!,{massKg:-1});
      queueMicrotask(()=>void this.owner.onmessage!({data:msg} as MessageEvent<HvpWorkerMessage>));
    }
    terminate(){close.push(this.terminateOwner());}
  }
  vi.stubGlobal("Worker",Transport);
  const cut=cutAt(rootFor(uFixture()),[12,2,4]),index=createTerrainComponentIndex(cut.before);
  const client=await createHvpPhysicsClient([],{x:2,y:3,z:2},new AbortController().signal);
  try{
    const f=index.prepareCompact(cut).fragments[0]!,compact={generation:1,cellCount:f.cellCount,parts:f.parts};
    const fRequest={ownerId:f.ownerId,cells:materializeCompactCells(compact),compactSource:compact,massKg:f.massKg,colliderBoxes:f.colliderBoxes,origin:HVP_SOURCE_MIN_METERS};
    const binding={sessionId:cut.after.sessionId,epoch:cut.after.epoch,baseRevision:0,commandId:"one",baseDigest:cut.before.sourceDigest,targetDigest:cut.after.sourceDigest};
    const edits=[{index:0,mesh:[...collisionSectors(floor)][0]!}];
    const credit={copyBytes:16*1024*1024,nativeBytes:48*1024*1024,trace:(s:HvpCutSpan)=>spans.push(s)};
    let published=0;
    const run=client.applyCompactTerrain!(binding,edits,[fRequest],credit,views=>{
      expect(client.read().terrainGeneration).toBe(0);
      expect(views[0]).toMatchObject({ownerId:f.ownerId,colliders:f.colliderBoxes.length,cellCount:f.cellCount});
      if(fault==="stale-root")throw new Error("Stale cut plan");
      published++;
    });
    if(fault==="ack"||fault==="lost-ack"){
      expect(await run).toBe(true);late?.();
      expect(published).toBe(1);expect(client.read().terrainGeneration).toBe(1);
      expect(client.read().terrainFragments.map(f=>f.ownerId)).toEqual([f.ownerId]);
      expect(client.lifecycle!().terrainRecovery).toMatchObject({entries:1,fragments:1,held:0});
      const kinds=commands.filter(c=>c.kind!=="Initialize").map(c=>c.kind);
      expect(kinds).toEqual(fault==="ack"?["ApplyCompactTerrain"]:["ApplyCompactTerrain","RecoverTerrain","ApplyCompactTerrain"]);
      expect(spans.filter(s=>s.phase==="cutRecoverySideband")).toHaveLength(fault==="ack"?0:1);
      expect(spans.filter(s=>s.phase==="cutRecoveryMailboxWrite")).toHaveLength(1);
    }else{
      await expect(run).rejects.toThrow();
      expect(published).toBe(0);expect(client.read().terrainGeneration).toBe(0);
      expect(client.read().terrainFragments).toHaveLength(0);
      expect(commands.some(c=>c.kind==="RecoverTerrain")).toBe(fault!=="before-install");
    }
    expect(client.lifecycle!().pendingJobs).toBe(0);
  }finally{await client.dispose();await Promise.all(close);index.dispose();vi.unstubAllGlobals();}
},60000);
