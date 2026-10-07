import {expect,it,vi} from "vitest";
import type {HvpPhysicsMessage,HvpPhysicsRequest,HvpPhysicsReply} from "../../src/hestia-prototype/physics/physicsWorker";
import {collisionSectors} from "../../src/hestia-prototype/physics/terrainColliders";

const floor={sizeX:4,sizeY:16,sizeZ:4,cellMeters:.125,originMeters:{x:0,y:0,z:0},readSlot:(_x:number,y:number)=>y===0?1:0};
const fragment={ownerId:"hvp:terrain-fragment:r1:12345678",origin:{x:-16,y:-8,z:-16},massKg:9.375,
  cells:[{x:128,y:76,z:128,materialId:1},{x:129,y:76,z:128,materialId:1}],colliderBoxes:[{min:[128,76,128] as const,max:[130,77,129] as const}]};
async function withWorker(run:(send:(value:HvpPhysicsRequest)=>Promise<HvpPhysicsReply>)=>Promise<void>){
  vi.resetModules();const savedOn=Object.getOwnPropertyDescriptor(globalThis,"onmessage"),savedPost=Object.getOwnPropertyDescriptor(globalThis,"postMessage");
  const host=globalThis as typeof globalThis&{onmessage:(e:MessageEvent<HvpPhysicsMessage>)=>Promise<void>;postMessage:(r:HvpPhysicsReply)=>void};
  const replies:HvpPhysicsReply[]=[];let id=0;
  const timer=vi.spyOn(globalThis,"setInterval").mockImplementation(()=>1 as unknown as ReturnType<typeof setInterval>);
  const clear=vi.spyOn(globalThis,"clearInterval").mockImplementation(()=>{});
  const send=async(value:HvpPhysicsRequest)=>{const current=++id;await host.onmessage({data:{...value,id:current,protocol:"hvp-physics-owner-v3",incarnation:"terrain-prehold-test"}} as MessageEvent<HvpPhysicsMessage>);
    const reply=replies.find(r=>r.id===current);if(!reply){throw new Error("Missing actual worker receipt");}return reply;};
  try{host.postMessage=r=>replies.push(r);await import("../../src/hestia-prototype/physics/physicsWorker");
    expect((await send({kind:"Initialize",sectors:[...collisionSectors(floor)],spawn:{x:.4,y:2,z:.4},gravity:9.81,sessionId:"native-world"})).error).toBeUndefined();
    await run(send);
  }finally{await send({kind:"Dispose"});timer.mockRestore();clear.mockRestore();
    for(const [key,descriptor] of [["onmessage",savedOn],["postMessage",savedPost]] as const){if(descriptor){Object.defineProperty(globalThis,key,descriptor);}else{Reflect.deleteProperty(globalThis,key);}}}
}
const prepare=()=>({kind:"PrepareTerrainPlan" as const,transactionId:"owned",generation:0,sourceDigest:"root-after-1",sourceSessionId:"root-session",sourceEpoch:3,
  allowanceBytes:48*1024*1024,replacements:[{index:0,mesh:[...collisionSectors(floor)][0]!}],fragments:[fragment]});
it("binds actual source-only ACK and Stage, releases a rejected preStage ticket, and admits a fresh retry",async()=>withWorker(async send=>{
  const request=prepare(),ready=await send(request);expect(ready.error).toBeUndefined();expect(ready.rejected).toBeUndefined();
  expect(ready.snapshot).toBeUndefined();expect(ready.terrainPlan).toMatchObject({prepareRequestId:ready.id,sourceSessionId:"root-session",sourceEpoch:3});
  expect(ready.terrainPlan?.sourceViews).toHaveLength(1);
  expect(ready.terrainPlan?.sourceViews[0]).toMatchObject({ownerId:fragment.ownerId,cellCount:2,massKg:9.375,colliders:1});
  const stage={kind:"PrepareTerrain" as const,transactionId:"owned",generation:0,sourceDigest:request.sourceDigest,sourceSessionId:request.sourceSessionId,sourceEpoch:3,
    prepareRequestId:ready.id,replacements:[],fragments:[]};
  const bad=await send({...stage,sourceEpoch:4});expect(bad.rejected).toMatch(/ticket/);expect(bad.snapshot?.terrainTransaction).toBe("Idle");
  const released=await send({kind:"ReleaseTerrainPlan",transactionId:"owned",generation:0,sourceDigest:request.sourceDigest,sourceSessionId:request.sourceSessionId,sourceEpoch:3,prepareRequestId:ready.id});
  expect(released.terrainPlanReleased?.prepareRequestId).toBe(ready.id);expect(released.snapshot).toBeUndefined();
  const retry=await send(prepare());expect(retry.rejected).toBeUndefined();
  const staged=await send({...stage,prepareRequestId:retry.id});expect(staged.rejected).toBeUndefined();expect(staged.snapshot?.terrainTransaction).toBe("PreparedHeld");
  expect(staged.snapshot?.preparedTerrainFragments[0]).toMatchObject({cellCount:2,massKg:9.375});
  expect(staged.snapshot?.preparedTerrainFragments).toEqual(retry.terrainPlan?.sourceViews);
  await send({kind:"RollbackTerrain",transactionId:"owned"});
}));
it("drains a running yielded Native producer before Dispose ACK and rejects its late Stage",async()=>withWorker(async send=>{
  const request=prepare(),preparing=send(request),disposed=await send({kind:"Dispose"}),terminal=await preparing;
  expect(disposed.snapshot).toMatchObject({status:"Disposed",bodyCount:0,colliderCount:0});expect(disposed.clock?.timers).toBe(0);
  expect(terminal.rejected).toMatch(/disposed|cancelled/i);expect(terminal.terrainPlan).toBeUndefined();
  const late=await send({kind:"PrepareTerrain",transactionId:"owned",generation:0,sourceDigest:request.sourceDigest,sourceSessionId:request.sourceSessionId,sourceEpoch:3,
    prepareRequestId:terminal.id,replacements:[],fragments:[]});expect(late.rejected).toMatch(/not ready/);
}));
