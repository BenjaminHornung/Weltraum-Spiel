import { describe,it,expect } from "vitest";
import { createHvpTerrainRoot, restoreHvpTerrainRoot, type HvpCutRequest } from "../../src/hestia-prototype/terrain/cutPlan";
import { createHvpTerrainConsumer } from "../../src/hestia-prototype/terrain/terrainConsumer";
import type { HvpTerrainProducts } from "../../src/hestia-prototype/terrain/terrainProducts";
import {analyzeHvpTerrainSupport} from "../../src/hestia-prototype/terrain/supportPlan";
import type {HvpTerrainFragmentRequest} from "../../src/hestia-prototype/physics/terrainFragment";

const setup=(fault="")=>{
  const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
    sourceDigest:"12345678",readSlot:(_x,y,_z)=>y<80?1:0},"session",1);
  const events:string[]=[];let visible=0,world=0,held=false;
  const fail=(at:string)=>{events.push(at);if(fault===at){throw new Error(at);}};
  const consumer=createHvpTerrainConsumer(root,async plan=>{fail("compile");return {source:plan.after,render:new Map(),collision:new Map()};},
    ()=>{fail("stage");return {publish(){visible=1;fail("publish");},rollback(){visible=0;fail("render-rollback");},finish(){fail("retire");}};},
    {async prepareTerrain(){fail("prepare");held=true;},async commitTerrain(){world=1;fail("commit");},
      publishTerrain(){expect(root.read().revision).toBe(visible);expect(visible).toBe(world);fail("world-publish");},
      async rollbackTerrain(){world=0;held=false;fail("world-rollback");},async finalizeTerrain(){fail("finalize");held=false;},
      async command(){held=true;events.push("hold");}});
  const request=(id="cut-1"):HvpCutRequest=>({sessionId:"session",epoch:1,revision:root.read().revision,sourceDigest:root.read().sourceDigest,
    commandId:id,toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[40,79,56],max:[41,80,57]}});
  return {root,consumer,request,events,read:()=>({visible,world,held})};
};
describe("HVP paired terrain consumer",()=>{
  it("replays the saved exact outcome without recompiling or committing the cut again",async()=>{
    const s=setup(),request=s.request(),pending=s.consumer.submit(request);
    await expect(s.consumer.checkpoint()).rejects.toThrow(/boundary/);
    const outcome=await pending;
    const saved=JSON.parse(JSON.stringify({root:s.root.checkpoint(),receipts:await s.consumer.checkpoint()}));
    s.consumer.dispose();const root=restoreHvpTerrainRoot(saved.root);
    const forbidden=()=>{throw new Error("Replay must not mutate");};
    const loaded=createHvpTerrainConsumer(root,forbidden,forbidden,{prepareTerrain:forbidden,commitTerrain:forbidden,
      publishTerrain:forbidden,rollbackTerrain:forbidden,finalizeTerrain:forbidden,command:forbidden});
    loaded.restoreReceipts(saved.receipts);
    expect(await loaded.submit(request)).toEqual(outcome);expect(root.read().revision).toBe(1);
    expect(root.read().readSlot(40,79,56)).toBe(0);
    const bad=structuredClone(saved.receipts);bad.entries[0].outcome.revision=2;
    expect(()=>loaded.restoreReceipts(bad)).toThrow(/terrain outcome/);
    expect(await loaded.submit(request)).toEqual(outcome);
  },120_000);
  it.each([false,true])("adopts removed and transferred cells together and restores both on upload failure=%s",async failUpload=>{
    const cells=new Set<string>();for(let y=0;y<=80;y+=1){cells.add(`176:${y}:77`);}cells.add("177:80:77");cells.add("178:80:77");
    const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},sourceDigest:"12345678",
      readSlot:(x,y,z)=>cells.has(`${x}:${y}:${z}`)?1:0},"transfer",0),before=root.read();
    let world=0,published=0,visible=0,fragments:readonly HvpTerrainFragmentRequest[]=[];
    const consumer=createHvpTerrainConsumer(root,async plan=>({source:plan.after,render:new Map(),collision:new Map()}),(_products,bodies)=>{
      expect(root.read()).toBe(before);expect(bodies).toHaveLength(1);if(failUpload){throw new Error("upload");}
      return {publish(){expect(world).toBe(1);expect(published).toBe(1);visible=1;},rollback(){visible=0;},finish(){}};
    },{async prepareTerrain(_id,_generation,_mesh,requests){fragments=requests??[];},async commitTerrain(){world=1;},
      preparedTerrainFragments:()=>fragments.map(f=>({ownerId:f.ownerId,sourceDigest:"fixture",centerOfMass:{x:0,y:0,z:0},cellCount:f.cells.length,massKg:f.massKg,colliders:1,sourceBytes:0})),
      publishTerrain(){published=world;},async finalizeTerrain(){},async rollbackTerrain(){expect(visible).toBe(0);world=0;published=0;fragments=[];},async command(){}},[],async cut=>analyzeHvpTerrainSupport(cut));
    const result=await consumer.submit({sessionId:"transfer",epoch:0,revision:0,sourceDigest:before.sourceDigest,commandId:"under",toolPolicy:"hvp-plasma-v1",
      shape:{kind:"Box",min:[176,79,77],max:[177,80,78]}});
    if(failUpload){expect(result.status).toBe("Rejected");expect(root.read()).toBe(before);expect(fragments).toHaveLength(0);}
    else{expect(result).toMatchObject({status:"Applied",removedCells:1,transferredCells:3,materialRemovedKg:4.6875,transferredMassKg:14.0625});
      expect(root.read().readSlot(178,80,77)).toBe(0);expect([visible,world,published]).toEqual([1,1,1]);}
  });
  it("publishes the paired generation once, snapshots input and remembers exact outcomes",async()=>{
    const s=setup();const request=s.request();const before=s.root.read();
    const task=s.consumer.submit(request);expect(s.consumer.submit(request)).toBe(task);
    expect(s.root.read()).toBe(before);
    expect((await task).status).toBe("Applied");expect(s.root.read().readSlot(40,79,56)).toBe(0);
    expect(s.read()).toEqual({visible:1,world:1,held:false});
    expect(s.events).toEqual(["compile","stage","prepare","commit","publish","world-publish","finalize","retire"]);
    expect(s.consumer.submit(request)).toBe(task);
    expect((await s.consumer.submit({...request,shape:{kind:"Box",min:[41,79,56],max:[42,80,57]}})).reason).toBe("IdempotencyConflict");
    expect((await s.consumer.submit(s.request("again"))).status).toBe("NoOp");expect(s.root.read().revision).toBe(1);
  });
  it.each(["compile","stage","prepare","commit","publish","world-publish","finalize"])("restores the previous generation after %s failure",async fault=>{
    const s=setup(fault),before=s.root.read();const result=await s.consumer.submit(s.request());
    expect(result.status).toBe("Rejected");expect(s.root.read()).toBe(before);expect(s.read()).toEqual({visible:0,world:0,held:false});
  });
  it("reports RecoveryHold instead of rolling back an already finalized cleanup",async()=>{
    const s=setup("retire");expect((await s.consumer.submit(s.request())).status).toBe("RecoveryHold");
    expect(s.root.read().revision).toBe(1);expect(s.read()).toEqual({visible:1,world:1,held:true});
    expect((await s.consumer.submit(s.request("next"))).reason).toBe("RecoveryHold");
  });
  it("bounds queued commands and rejects stale compiler identity without publication",async()=>{
    const s=setup();let release!:(value:HvpTerrainProducts)=>void;
    const blocker=new Promise<HvpTerrainProducts>(resolve=>{release=resolve;});
    const consumer=createHvpTerrainConsumer(s.root,()=>blocker,()=>{throw new Error("Must not stage stale output");},
      {prepareTerrain:async()=>{},commitTerrain:async()=>{},publishTerrain:()=>{},rollbackTerrain:async()=>{},finalizeTerrain:async()=>{},command:async()=>{}});
    const tasks=Array.from({length:8},(_,i)=>consumer.submit(s.request(`cut-${i}`)));
    expect((await consumer.submit(s.request("overflow"))).reason).toBe("Backpressure");
    release({source:s.root.read(),render:new Map(),collision:new Map()});
    expect((await Promise.all(tasks)).every(r=>r.status==="Rejected")).toBe(true);
    expect(s.root.read().revision).toBe(0);
  });
});
