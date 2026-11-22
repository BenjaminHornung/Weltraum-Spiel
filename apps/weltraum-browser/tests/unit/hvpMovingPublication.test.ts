import {expect,it,vi} from "vitest";
import {createHvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import {bindHvpPhysicsOwner,type HvpPhysicsOwnerPort,type HvpWorkerMessage,type HvpWorkerReply} from "../../src/hestia-prototype/physics/physicsWorkerHost";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";
import {HVP_SOURCE_MIN_METERS,prepareHvpCoastSource,materializeHvpCoastSource} from "../../src/hvp/hvpCoastSource";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {createTerrainComponentIndex} from "../../src/voxel/structural/componentIndex";
import {createHvpBodyCutConsumer} from "../../src/hestia-prototype/terrain/bodyCutConsumer";
import {readCompactMovingProjection} from "../../src/hestia-prototype/presentation/compactMovingProjection";
import type {HvpBodyCutProducts} from "../../src/workers/hvpBodyCutJob";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpLocalBodyCut} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {cutAt} from "./componentIndex/compactFixtures";

vi.mock("../../src/workers/workerPool",()=>({WorkerPool:class {async start(){} async shutdown(){}}}));
const floor={sizeX:4,sizeY:16,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0};

it.each(["ok","worker-loss","lost-live","forged-reply","render-loss","pre-seal","fallback-loss"])("publishes exact moving children over terrain R1, %s",async fault=>{
  const root=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"moving-rock",1);
  const cut=cutAt(root,[176,78,76],[180,82,80]),index=createTerrainComponentIndex(cut.before);
  const f=index.prepareCompact(cut).fragments[0]!,mesh=[...collisionSectors(floor)][0]!;
  const logs:string[]=[],closed:Promise<void>[]=[];
  const stopped=vi.spyOn(globalThis,"setInterval").mockImplementation(()=>1 as unknown as ReturnType<typeof setInterval>);
  let late:(()=>void)|undefined,recovered=false;
  class Transport {
    onmessage:((e:MessageEvent<HvpWorkerReply>)=>void)|null=null;onerror:((e:ErrorEvent)=>void)|null=null;onmessageerror=null;
    sealId=-1;bodyCommand="";
    owner:HvpPhysicsOwnerPort={postMessage:original=>{
      const reply=structuredClone(original);
      const cb=this.onmessage;
      if(reply.id===this.sealId&&fault==="lost-live"){late=()=>cb?.({data:reply} as MessageEvent<HvpWorkerReply>);return;}
      if(reply.id===this.sealId&&(fault==="worker-loss"||fault==="fallback-loss"&&this.bodyCommand==="after-recovery")){
        late=()=>cb?.({data:reply} as MessageEvent<HvpWorkerReply>);
        this.onerror?.({message:"worker terminated after moving L"} as ErrorEvent);return;
      }
      if(reply.id===this.sealId&&fault==="forged-reply"&&reply.snapshot)Object.assign(reply.snapshot.moving,{sequence:0});
      cb?.({data:reply} as MessageEvent<HvpWorkerReply>);
    }};
    close=bindHvpPhysicsOwner(this.owner);
    postMessage(value:HvpWorkerMessage,transfers:Transferable[]=[]){
      const message=structuredClone(value,{transfer:transfers});logs.push(message.kind);
      if(message.kind==="Initialize")Object.assign(message,{sectors:[mesh],player:{spawn:{
        x:HVP_SOURCE_MIN_METERS.x+189.5*.125,y:HVP_SOURCE_MIN_METERS.y+85.5*.125-.75,z:HVP_SOURCE_MIN_METERS.z+76*.125-.4
      },coverage:[{minX:-16,maxX:16,minZ:-16,maxZ:16}]}});
      if(message.kind==="PublishMovingCut"){
        this.sealId=message.id;this.bodyCommand=message.transactionId;
        if(fault==="pre-seal"){
          const send=message.recoveryPort.postMessage.bind(message.recoveryPort);
          message.recoveryPort.postMessage=data=>{
            if(data.kind==="Forward")throw new Error("failure before sealing forward record");send(data);
          };
        }
      }
      if(message.kind==="RecoverTerrain"){
        recovered=true;expect(message.image.motion.revision).toBe(1);
        if(fault==="fallback-loss"){
          expect(message.image.journal).toHaveLength(0);expect(message.image.moving).toBeUndefined();
          expect(message.image.assets.world.moving.last?.id).toBe("after-recovery");
        }else if(fault!=="pre-seal"){
          expect(message.image.journal).toHaveLength(1);
          expect(message.movingFenced).toBe(true);expect(message.image.moving?.delta?.children).toHaveLength(1);
        }
      }
      queueMicrotask(()=>void this.owner.onmessage!({data:message} as MessageEvent<HvpWorkerMessage>));
    }
    terminate(){closed.push(this.close());}
  }
  vi.stubGlobal("Worker",Transport);
  const client=await createHvpPhysicsClient([],{x:0,y:2,z:0},new AbortController().signal);
  try{
    const fragment={ownerId:f.ownerId,cells:[],origin:HVP_SOURCE_MIN_METERS,colliderBoxes:f.colliderBoxes,massKg:f.massKg,
      compactSource:{generation:f.revision,cellCount:f.cellCount,parts:f.parts}};
    const binding={sessionId:cut.after.sessionId,epoch:cut.after.epoch,baseRevision:0,commandId:"rock",baseDigest:cut.before.sourceDigest,targetDigest:cut.after.sourceDigest};
    expect(await client.applyCompactTerrain!(binding,[{index:0,mesh}],[fragment],{copyBytes:16*1024*1024,nativeBytes:48*1024*1024},()=>root.commit(cut))).toBe(true);
    await client.command("Play");
    let childId="",childDigest="",nextDirection={x:0,y:0,z:1};
    const consumer=createHvpBodyCutConsumer(client,async source=>{
      const p=readCompactMovingProjection(source),part=p.parts[0]!;
      expect(part.cells.length).toBe(352);
      const target=part.cells.filter(c=>c.z===76).sort((a,b)=>Math.hypot(a.x-189,a.y-85)-Math.hypot(b.x-189,b.y-85))[0]!;
      const vector={x:(target.x-189)*.125,y:(target.y-85)*.125,z:.4+.0625},length=Math.hypot(vector.x,vector.y,vector.z);
      nextDirection={x:vector.x/length,y:vector.y/length,z:vector.z/length};
      childId=part.ownerId;childDigest=part.sourceDigest;
      return p as unknown as HvpBodyCutProducts;
    },()=>({publish(){if(fault==="render-loss")throw Error("renderer lost");},rollback(){},finish(){}}));
    const parent=client.read().terrainFragments.find(v=>v.ownerId===f.ownerId)!;
    const request={id:"recut",ownerId:f.ownerId,sourceDigest:parent.sourceDigest,edge:4,direction:{x:0,y:0,z:1}};
    await consumer.submit(request);late?.();
    if(fault==="pre-seal"){
      expect(consumer.read().last,JSON.stringify(consumer.read())).toMatchObject({status:"Rejected"});
      expect(client.read().terrainFragments.map(v=>v.ownerId)).toContain(f.ownerId);
      expect(client.read().moving.sequence).toBe(0);expect(recovered).toBe(true);return;
    }
    expect(consumer.read().last,JSON.stringify(consumer.read())).toMatchObject({status:fault==="render-loss"?"RecoveryHold":"Applied"});
    expect(client.read().moving.last).toMatchObject({id:"recut",parentId:f.ownerId,children:[childId],status:"Applied"});
    expect(client.read().terrainFragments.find(v=>v.ownerId===childId)).toMatchObject({cellCount:352,sourceDigest:childDigest,massKg:1586.71875});
    expect(client.read().terrainFragments.map(v=>v.ownerId)).not.toContain(f.ownerId);
    await consumer.submit(request);expect(logs.filter(k=>k==="PublishMovingCut")).toHaveLength(1);
    expect(logs).not.toContain("RollbackBodyCut");
    if(fault==="lost-live")expect(logs).toContain("InspectMovingPublication");
    expect(recovered).toBe(fault==="worker-loss"||fault==="forged-reply");
    await client.command("Pause");
    await expect(client.checkpoint()).rejects.toThrow(/nicht freigegeben/);
    await client.command("Play");
    if(fault!=="render-loss"){
      const next=await client.beginBodyCut({id:"after-recovery",edge:1,ownerId:childId,sourceDigest:childDigest,direction:nextDirection});
      expect(next.payload.cellCount).toBe(352);
      if(fault==="fallback-loss"){
        expect(next.compact).toBeUndefined();
        const src=ingestHvpStructuralCells(next.payload.sourceId,next.cells,next.payload.materials);
        const result=prepareHvpLocalBodyCut(src,next.payload.cell,next.payload.commandId,next.payload.edge).plan;
        const parts=result.parts.map(p=>({ownerId:p.ownerId,sourceDigest:p.recipe.source.contentHash,center:p.recipe.mass.centerOfMassMeters!,massKg:p.recipe.mass.totalMassKg}));
        await client.stageBodyCut("after-recovery",{parts,removedCells:result.removedCells,removedMassKg:result.removedMassKg});
        await client.commitBodyCut("after-recovery");client.publishBodyCut();await client.finalizeBodyCut("after-recovery");
        expect(recovered).toBe(true);expect(client.read().moving.sequence).toBe(2);
        expect(client.read().moving.last?.id).toBe("after-recovery");
        expect(client.read().terrainFragments.reduce((n,v)=>n+v.cellCount,0)).toBe(351);
      }else{
        await client.rollbackBodyCut("after-recovery");expect(client.read().moving.sequence).toBe(1);
      }
    }
    consumer.dispose();
  }finally{index.dispose();await client.dispose().catch(()=>{});await Promise.all(closed);stopped.mockRestore();vi.unstubAllGlobals();}
},120000);
