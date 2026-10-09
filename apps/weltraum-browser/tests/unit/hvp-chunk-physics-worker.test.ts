import {expect,it,vi} from "vitest";
import {collisionSectors,type HvpCollisionSector} from "../../src/hestia-prototype/physics/terrainColliders";
import {hvpCollisionDigest} from "../../src/hestia-prototype/persistence/worldCheckpoint";
import type {HvpPhysicsMessage,HvpPhysicsReply,HvpPhysicsRequest} from "../../src/hestia-prototype/physics/physicsWorker";

it("keeps chunk segmentation through the real Worker initialize and complete Restore acknowledgements",async()=>{
  const layout={version:"hvp-static-chunks-v1" as const,primaryTerrainCount:256 as const,neighborTerrainCount:256 as const};
  const empty=():HvpCollisionSector=>({vertices:new Float32Array(),indices:new Uint32Array()});
  const floor=[...collisionSectors({sizeX:8,sizeY:4,sizeZ:8,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0})];
  const chunks=[...Array.from({length:256},empty),...floor],legacy=[...Array.from({length:64},empty),...floor];
  const previousOnmessage=Object.getOwnPropertyDescriptor(globalThis,"onmessage"),previousPost=Object.getOwnPropertyDescriptor(globalThis,"postMessage");
  const host=globalThis as typeof globalThis&{onmessage?:(event:MessageEvent<HvpPhysicsMessage>)=>void|Promise<void>;postMessage?:(reply:HvpPhysicsReply)=>void};
  const replies:HvpPhysicsReply[]=[];let id=0,loaded=false;
  const send=async(request:HvpPhysicsRequest)=>{
    const before=replies.length;
    await host.onmessage!({data:{...request,id:++id,protocol:"hvp-physics-owner-v3",incarnation:"chunk-worker-test"}} as MessageEvent<HvpPhysicsMessage>);
    expect(replies).toHaveLength(before+1);return replies[before]!;
  };
  const interval=vi.spyOn(globalThis,"setInterval").mockReturnValue(1 as unknown as ReturnType<typeof setInterval>);
  const clear=vi.spyOn(globalThis,"clearInterval").mockImplementation(()=>{});
  try{
    host.postMessage=reply=>replies.push(reply);
    await import("../../src/hestia-prototype/physics/physicsWorker");loaded=true;
    const init=await send({kind:"Initialize",sectors:chunks,staticLayout:layout,spawn:{x:.5,y:2,z:.5},gravity:9.81,sessionId:"chunk-worker"} as HvpPhysicsRequest);
    expect(init.error).toBeUndefined();expect(init.snapshot?.colliderCount).toBe(2);
    const high=await send({kind:"PrepareTerrain",transactionId:"high",generation:0,replacements:[{index:64,mesh:empty()}]});
    expect(high.rejected).toBeUndefined();await send({kind:"RollbackTerrain",transactionId:"high"});
    await send({kind:"Pause"});
    const saved=(await send({kind:"Checkpoint"})).checkpoint!;
    expect(saved.collisionDigest).toBe(hvpCollisionDigest(chunks));
    const oldSave={...saved,collisionDigest:hvpCollisionDigest(legacy)};
    const mixed=await send({kind:"PrepareRestore",transactionId:"mixed",checkpoint:oldSave,replacements:[{index:0,mesh:empty()}],completeCollision:{sectors:legacy,layout:null}} as HvpPhysicsRequest);
    expect(mixed.rejected).toMatch(/complete|mixed/i);
    const prepare=async()=>{const reply=await send({kind:"PrepareRestore",transactionId:"restore",checkpoint:oldSave,replacements:[],completeCollision:{sectors:legacy,layout:null}} as HvpPhysicsRequest);
      expect(reply.rejected??reply.error).toBeUndefined();return reply;};
    expect((await prepare()).restoreState).toBe("Prepared");
    expect((await send({kind:"CommitRestore",transactionId:"restore"})).restoreState).toBe("Committed");
    expect((await send({kind:"RollbackRestore",transactionId:"restore"})).restoreState).toBe("RolledBack");
    expect((await send({kind:"Checkpoint"})).checkpoint?.collisionDigest).toBe(saved.collisionDigest);
    expect((await prepare()).restoreState).toBe("Prepared");await send({kind:"CommitRestore",transactionId:"restore"});
    expect((await send({kind:"FinalizeRestore",transactionId:"restore"})).restoreState).toBe("Finalized");
    expect((await send({kind:"Checkpoint"})).checkpoint?.collisionDigest).toBe(oldSave.collisionDigest);
    const legacyHigh=await send({kind:"PrepareTerrain",transactionId:"wood",generation:0,replacements:[{index:64,mesh:empty()}]});
    expect(legacyHigh.rejected).toMatch(/invalid|Stale/i);
    const back=await send({kind:"PrepareRestore",transactionId:"back",checkpoint:saved,replacements:[],completeCollision:{sectors:chunks,layout}} as HvpPhysicsRequest);
    expect(back.restoreState).toBe("Prepared");await send({kind:"CommitRestore",transactionId:"back"});await send({kind:"FinalizeRestore",transactionId:"back"});
    const restored=await send({kind:"PrepareTerrain",transactionId:"high-back",generation:0,replacements:[{index:64,mesh:empty()}]});
    expect(restored.rejected).toBeUndefined();await send({kind:"RollbackTerrain",transactionId:"high-back"});
    const disposed=await send({kind:"Dispose"});expect(disposed.snapshot?.bodyCount).toBe(0);expect(disposed.clock?.timers).toBe(0);
  }finally{
    if(loaded){await send({kind:"Dispose"});}interval.mockRestore();clear.mockRestore();
    for(const [key,descriptor] of [["onmessage",previousOnmessage],["postMessage",previousPost]] as const){
      if(descriptor){Object.defineProperty(globalThis,key,descriptor);}else{Reflect.deleteProperty(globalThis,key);}
    }
  }
});
