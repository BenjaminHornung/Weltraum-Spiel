import { describe,it,expect,vi } from "vitest";
import { createHvpTerrainRoot, restoreHvpTerrainRoot, type HvpCutRequest } from "../../src/hestia-prototype/terrain/cutPlan";
import { createHvpTerrainConsumer, type HvpPreparedTerrainBody } from "../../src/hestia-prototype/terrain/terrainConsumer";
import type { HvpTerrainProducts } from "../../src/hestia-prototype/terrain/terrainProducts";
import {analyzeHvpTerrainSupport} from "../../src/hestia-prototype/terrain/supportPlan";
import type {HvpTerrainFragmentRequest} from "../../src/hestia-prototype/physics/terrainFragment";
import type {HvpCutSpan,HvpCutTrace} from "../../src/hestia-prototype/runtime/cutTrace";

const setup=(fault="",trace?:HvpCutTrace,compileWait?:Promise<void>)=>{
  const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},
    sourceDigest:"12345678",readSlot:(_x,y,_z)=>y<80?1:0},"session",1);
  const events:string[]=[],spans:HvpCutSpan[]=[];let visible=0,world=0,held=false,stageCommandId:string|undefined,stageArity=0;
  const observer=trace?((span:HvpCutSpan)=>{spans.push(span);trace(span);}):undefined;
  const fail=(at:string)=>{events.push(at);if(fault===at){throw new Error(at);}};
  const consumer=createHvpTerrainConsumer(root,async plan=>{fail("compile");if(compileWait){await compileWait;}return {source:plan.after,render:new Map(),collision:new Map()};},
    (...args:unknown[])=>{stageArity=args.length;stageCommandId=args[2] as string|undefined;fail("stage");return {publish(){visible=1;fail("publish");},rollback(){visible=0;fail("render-rollback");},finish(){fail("retire");}};},
    {async prepareTerrain(){fail("prepare");held=true;},async commitTerrain(){world=1;fail("commit");},
      publishTerrain(){expect(root.read().revision).toBe(visible);expect(visible).toBe(world);fail("world-publish");},
      async rollbackTerrain(){world=0;held=false;fail("world-rollback");},async finalizeTerrain(){fail("finalize");held=false;},
      async command(){held=true;events.push("hold");}},[],undefined,observer);
  const request=(id="cut-1"):HvpCutRequest=>({sessionId:"session",epoch:1,revision:root.read().revision,sourceDigest:root.read().sourceDigest,
    commandId:id,toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[40,79,56],max:[41,80,57]}});
  return {root,consumer,request,events,spans,stageCommandId:()=>stageCommandId,stageArity:()=>stageArity,read:()=>({visible,world,held})};
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
  it.each([{failUpload:false,trace:false},{failUpload:true,trace:false},{failUpload:false,trace:true},{failUpload:true,trace:true}])("adopts removed and transferred cells together and restores both on upload failure=$failUpload trace=$trace",async ({failUpload,trace})=>{
    const cells=new Set<string>();for(let y=0;y<=80;y+=1){cells.add(`176:${y}:77`);}cells.add("177:80:77");cells.add("178:80:77");
    const root=createHvpTerrainRoot({sizeX:256,sizeY:128,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-8,z:-16},sourceDigest:"12345678",
      readSlot:(x,y,z)=>cells.has(`${x}:${y}:${z}`)?1:0},"transfer",0),before=root.read();
    let world=0,published=0,visible=0,stageArity=0,stageCommandId:string|undefined,events:string[]=[],fragments:readonly HvpTerrainFragmentRequest[]=[];
    const spans:HvpCutSpan[]=[];
    function stage(_products:HvpTerrainProducts,bodies?:readonly HvpPreparedTerrainBody[],commandId?:string){
       stageArity=arguments.length;stageCommandId=commandId;events.push("stage");
       expect(root.read()).toBe(before);expect(bodies).toHaveLength(1);if(failUpload){throw new Error("upload");}
       return {publish(){expect(world).toBe(1);expect(published).toBe(1);visible=1;},rollback(){visible=0;},finish(){}};
    }
    const consumer=createHvpTerrainConsumer(root,async plan=>({source:plan.after,render:new Map(),collision:new Map()}),stage,{async prepareTerrain(_id,_generation,_mesh,requests){events.push("prepare");fragments=requests??[];},async commitTerrain(){world=1;},
      preparedTerrainFragments:()=>fragments.map(f=>({ownerId:f.ownerId,sourceDigest:"fixture",centerOfMass:{x:0,y:0,z:0},cellCount:f.cells.length,massKg:f.massKg,colliders:1,sourceBytes:0})),
      publishTerrain(){published=world;},async finalizeTerrain(){},async rollbackTerrain(){expect(visible).toBe(0);world=0;published=0;fragments=[];},async command(){}},[],async cut=>analyzeHvpTerrainSupport(cut),trace?span=>spans.push(span):undefined);
    const result=await consumer.submit({sessionId:"transfer",epoch:0,revision:0,sourceDigest:before.sourceDigest,commandId:"under",toolPolicy:"hvp-plasma-v1",
      shape:{kind:"Box",min:[176,79,77],max:[177,80,78]}});
    expect(stageArity).toBe(trace?3:2);expect(stageCommandId).toBe(trace?"under":undefined);expect(events.indexOf("prepare")).toBeLessThan(events.indexOf("stage"));
    if(trace){expect(spans.map(span=>span.phase)).toContain("cutSupportAnalyzeMs");expect(spans.map(span=>span.phase)).toContain("cutTransferPrepareMs");
      expect(spans.map(span=>span.phase).indexOf("cutNativePrepareMs")).toBeLessThan(spans.map(span=>span.phase).indexOf("cutGraphicsStageMs"));}
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
  it("cut trace keeps canonical outcomes and publication order unchanged when tracing is absent, present, or throwing",async()=>{
    for(const fault of ["compile","stage","prepare","commit","publish","world-publish","finalize","retire",""]){
      const plain=setup(fault),observed=setup(fault,()=>{}),throwing=setup(fault,()=>{throw new Error("trace sink");});
      const results=await Promise.all([plain.consumer.submit(plain.request()),observed.consumer.submit(observed.request()),throwing.consumer.submit(throwing.request())]);
      expect(results[1]).toEqual(results[0]);expect(results[2]).toEqual(results[0]);
      expect(observed.root.checkpoint()).toEqual(plain.root.checkpoint());expect(throwing.root.checkpoint()).toEqual(plain.root.checkpoint());
      expect(observed.events).toEqual(plain.events);expect(throwing.events).toEqual(plain.events);
    }
  });
  it("cut trace records one real command interval, ordered phases, and the traced stage command ID",async()=>{
    const plain=setup(""),s=setup("",()=>{});const request=s.request();const task=s.consumer.submit(request);expect(s.consumer.submit(request)).toBe(task);
    await plain.consumer.submit(plain.request());expect(plain.stageArity()).toBe(1);
    const result=await task;expect(result.status).toBe("Applied");expect(s.consumer.submit(request)).toBe(task);
    expect(s.stageCommandId()).toBe("cut-1");expect(s.stageArity()).toBe(3);
    expect(s.spans.map(span=>span.phase)).toEqual(["cutSubmittedMs","cutIdempotencyReplayMs","cutQueueWaitMs","cutRootPrepareMs","cutCompileMs",
      "cutGraphicsStageMs","cutNativePrepareMs","cutNativeCommitMs","cutRootCommitMs","cutPublishMs","cutNativeFinalizeMs",
      "cutCleanupMs","cutTotalAppliedMs","cutIdempotencyReplayMs"]);
    const queue=s.spans.find(span=>span.phase==="cutQueueWaitMs")!,total=s.spans.find(span=>span.phase==="cutTotalAppliedMs")!;
    expect(queue.duration).toBeGreaterThanOrEqual(0);expect(total.duration).toBeGreaterThanOrEqual(queue.duration);
    expect(s.spans.filter(span=>span.phase==="cutSubmittedMs")).toHaveLength(1);expect(s.spans.filter(span=>span.phase==="cutTotalAppliedMs")).toHaveLength(1);
  });
  it("cut trace keeps idempotency conflicts out of the active command interval",async()=>{
    const s=setup("",()=>{});const request=s.request();await s.consumer.submit(request);
    const conflict=await s.consumer.submit({...request,shape:{kind:"Box",min:[41,79,56],max:[42,80,57]}});
    expect(conflict.reason).toBe("IdempotencyConflict");
    expect(s.spans.map(span=>span.phase)).toContain("cutIdempotencyConflictMs");
    expect(s.spans.filter(span=>span.phase==="cutSubmittedMs")).toHaveLength(1);expect(s.spans.filter(span=>span.phase==="cutTotalAppliedMs")).toHaveLength(1);
  });
  it("cut trace records a NoOp without compile or native phases",async()=>{
    const s=setup("",()=>{});await s.consumer.submit(s.request("applied"));const before=s.spans.length;
    const result=await s.consumer.submit(s.request("noop"));const spans=s.spans.slice(before);
    expect(result.status).toBe("NoOp");expect(spans.map(span=>span.phase)).toEqual(["cutSubmittedMs","cutQueueWaitMs","cutRootPrepareMs","cutTotalNoOpMs"]);
    expect(spans.some(span=>span.phase==="cutCompileMs"||span.phase==="cutNativePrepareMs"||span.phase==="cutNativeCommitMs")).toBe(false);
  });
  it("disables later trace phases mid-flight without changing the cached outcome or gameplay",async()=>{
    let release!:()=>void,released=false;
    const blocker=new Promise<void>(resolve=>{release=resolve;});
    const traced=setup("",()=>{},blocker);const plain=setup("");const request=traced.request();const task=traced.consumer.submit(request);
    const settle=()=>{if(!released){released=true;release();}};
    try {
      expect(traced.consumer.submit(request)).toBe(task);await Promise.resolve();traced.consumer.disableTrace();settle();
      const [observed,expected]=await Promise.all([task,plain.consumer.submit(plain.request())]);
      expect(observed).toEqual(expected);expect(traced.root.checkpoint()).toEqual(plain.root.checkpoint());expect(traced.events).toEqual(plain.events);
      expect(traced.consumer.submit(request)).toBe(task);expect(traced.stageArity()).toBe(1);
      expect(traced.spans.map(span=>span.phase)).toEqual(["cutSubmittedMs","cutIdempotencyReplayMs","cutQueueWaitMs","cutRootPrepareMs","cutCompileMs"]);
    } finally {
      settle();await task.catch(()=>undefined);
    }
  });
  it("cut trace rejects overflow with a terminal rejected span and no native work",async()=>{
    const s=setup("",()=>{});let release!:(value:HvpTerrainProducts)=>void;
    const blocker=new Promise<HvpTerrainProducts>(resolve=>{release=resolve;});
    const consumer=createHvpTerrainConsumer(s.root,()=>blocker,()=>{throw new Error("Must not stage stale output");},
      {prepareTerrain:async()=>{},commitTerrain:async()=>{},publishTerrain:()=>{},rollbackTerrain:async()=>{},finalizeTerrain:async()=>{},command:async()=>{}},[],undefined,
      span=>s.spans.push(span));
    const tasks=Array.from({length:8},(_,i)=>consumer.submit(s.request(`trace-${i}`)));
    const overflow=await consumer.submit(s.request("trace-overflow"));expect(overflow.reason).toBe("Backpressure");
    expect(s.spans.filter(span=>span.commandId==="trace-overflow").map(span=>span.phase)).toEqual(["cutSubmittedMs","cutTotalRejectedMs"]);
    release({source:s.root.read(),render:new Map(),collision:new Map()});await Promise.all(tasks);
  });
  it("cut trace measures controlled queue wait once without summing nested durations",async()=>{
    let now=100;const clock=vi.spyOn(performance,"now").mockImplementation(()=>now+=1);let release!:()=>void,released=false;
    const wait=new Promise<void>(resolve=>{release=resolve;});const settle=()=>{if(!released){released=true;release();}};let task:Promise<unknown>|undefined;
    try {
      const s=setup("",()=>{},wait);task=s.consumer.submit(s.request());
      await Promise.resolve();expect(s.spans.map(span=>span.phase)).toEqual(["cutSubmittedMs","cutQueueWaitMs","cutRootPrepareMs"]);
      settle();await task;
      const queue=s.spans.find(span=>span.phase==="cutQueueWaitMs")!,total=s.spans.find(span=>span.phase==="cutTotalAppliedMs")!;
      expect(queue.start).toBe(101);expect(queue.duration).toBe(1);expect(total.start).toBe(101);expect(total.duration).toBeGreaterThan(queue.duration);
    } finally {
      settle();await task?.catch(()=>undefined);clock.mockRestore();
    }
  });
});
