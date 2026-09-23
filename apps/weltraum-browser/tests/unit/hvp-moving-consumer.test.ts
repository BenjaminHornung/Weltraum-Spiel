import {expect,it,vi} from "vitest";
import {createHvpBodyCutConsumer} from "../../src/hestia-prototype/terrain/bodyCutConsumer";
import type {HvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import type {HvpBodyCutProducts} from "../../src/workers/hvpBodyCutJob";
import type {HvpCutSpan,HvpCutTrace} from "../../src/hestia-prototype/runtime/cutTrace";

const request={id:"recut-1",ownerId:"hvp:terrain-fragment:r1:12345678",sourceDigest:"source",edge:1,direction:{x:0,y:0,z:1}};
const harness=(fault="",trace?:HvpCutTrace)=>{
  let native=0,visible=0,published=0,paused=false;
  const fail=(phase:string)=>{if(fault===phase){throw new Error(`injected ${phase}`);}};
  const physics={
    beginBodyCut:vi.fn(async()=>{fail("begin");return {}; }),
    stageBodyCut:async()=>{fail("stage-world");},
    commitBodyCut:async()=>{fail("commit");native=1;},
    publishBodyCut:()=>{fail("world-publish");published=native;},
    rollbackBodyCut:async()=>{expect(visible).toBe(0);native=0;published=0;},
    finalizeBodyCut:async()=>{fail("finalize");},
    command:async()=>{paused=true;},read:()=>({moving:{state:"Idle"}})
  } as unknown as HvpPhysicsClient;
  const consumer=createHvpBodyCutConsumer(physics,async()=>{fail("compile");return {parts:[],removedCells:1,removedMassKg:1} as HvpBodyCutProducts;},()=>{
    fail("upload");return {
      publish(){expect(native).toBe(1);expect(published).toBe(1);visible=1;fail("publish");},
      rollback(){visible=0;},finish(){fail("retire");}
    };
  },trace);
  return {consumer,physics,state:()=>({native,visible,published,paused})};
};
it("owns one moving command and publishes the matching native and visible replacement once",async()=>{
  const h=harness(),result=h.consumer.submit(request);expect(h.consumer.submit(request)).toBe(result);
  await result;expect(h.consumer.read().last?.status).toBe("Applied");
  expect(h.state()).toEqual({native:1,visible:1,published:1,paused:false});
  expect(h.physics.beginBodyCut).toHaveBeenCalledTimes(1);
  await expect(h.consumer.submit({...request,edge:4})).rejects.toThrow(/conflict/);
});
it.each(["","begin"])("restores completed moving receipts without native replay (%s)",async fault=>{
  const h=harness(fault),task=h.consumer.submit(request);
  expect(()=>h.consumer.checkpoint()).toThrow(/boundary/);await task;
  const saved=JSON.parse(JSON.stringify(h.consumer.checkpoint()));h.consumer.dispose();
  const next=harness();next.consumer.restoreReceipts(saved);await next.consumer.submit(request);
  expect(next.physics.beginBodyCut).not.toHaveBeenCalled();expect(next.consumer.read().last).toEqual(saved.last);
  await expect(next.consumer.submit({...request,edge:4})).rejects.toThrow(/conflict/);
});
it.each(["begin","compile","upload","stage-world","commit","world-publish","publish","finalize"])("preserves old publication on %s failure",async fault=>{
  const h=harness(fault);await h.consumer.submit(request);
  expect(h.consumer.read().last?.status).toBe("Rejected");expect(h.state()).toEqual({native:0,visible:0,published:0,paused:false});
});
it("does not resurrect a removed parent after uncertain old-resource retirement",async()=>{
  const h=harness("retire");await h.consumer.submit(request);
  expect(h.consumer.read().state).toBe("RecoveryHold");expect(h.state()).toEqual({native:1,visible:1,published:1,paused:true});
  expect(()=>h.consumer.checkpoint()).toThrow(/boundary/);
  await expect(h.consumer.submit({...request,id:"recut-2"})).rejects.toThrow(/RecoveryHold/);
});

it("P07 observes body submission and the actual finalized outcome without replacing its promise",async()=>{
  const spans:HvpCutSpan[]=[];let now=10;
  const clock=vi.spyOn(performance,"now").mockImplementation(()=>now);
  const h=harness("",span=>{spans.push(span);if(span.phase==="cutBodyTotalAppliedMs"){
    expect(h.consumer.read().last?.status).toBe("Applied");expect(h.state().visible).toBe(1);
  }});
  let release!:()=>void,entered!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  const ready=new Promise<void>(resolve=>{entered=resolve;});
  const finalize=vi.spyOn(h.physics,"finalizeBodyCut").mockImplementation(()=>{entered();return held;});
  try{
    const result=h.consumer.submit(request);expect(h.consumer.submit(request)).toBe(result);
    await ready;expect(spans.map(s=>s.phase)).toEqual(["cutBodySubmittedMs"]);
    now=50;release();await result;
    expect(spans.map(s=>s.phase)).toEqual(["cutBodySubmittedMs","cutBodyTotalAppliedMs"]);
    expect(spans[1]).toMatchObject({commandId:request.id,thread:"main",start:10,duration:40});
    expect(h.consumer.submit(request)).toBe(result);
    await expect(h.consumer.submit({...request,edge:4})).rejects.toThrow(/conflict/);
    expect(spans).toHaveLength(2);
  }finally{release();finalize.mockRestore();clock.mockRestore();h.consumer.dispose();}
});

it.each(["", "compile", "retire"])("P07 trace failures preserve body state and saved receipts (%s)",async fault=>{
  const baseline=harness(fault),observed=harness(fault,()=>{throw new Error("diagnostic sink");});
  try{
    await baseline.consumer.submit(request);await observed.consumer.submit(request);
    expect(observed.state()).toEqual(baseline.state());expect(observed.consumer.read()).toEqual(baseline.consumer.read());
    if(fault!=="retire"){expect(observed.consumer.checkpoint()).toEqual(baseline.consumer.checkpoint());}
  }finally{baseline.consumer.dispose();observed.consumer.dispose();}
});

it("P07 disabled body tracing reads no clock and can be disabled while finalize is pending",async()=>{
  const spans:HvpCutSpan[]=[];const off=harness(),h=harness("",span=>spans.push(span));
  const clock=vi.spyOn(performance,"now");let release!:()=>void,entered!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});const ready=new Promise<void>(resolve=>{entered=resolve;});
  const finalize=vi.spyOn(h.physics,"finalizeBodyCut").mockImplementation(()=>{entered();return held;});
  try{
    await off.consumer.submit(request);expect(clock).not.toHaveBeenCalled();
    const result=h.consumer.submit(request);await ready;expect(spans).toHaveLength(1);
    h.consumer.disableTrace();clock.mockClear();release();await result;
    expect(clock).not.toHaveBeenCalled();expect(spans).toHaveLength(1);expect(h.consumer.read().last?.status).toBe("Applied");
  }finally{release();finalize.mockRestore();clock.mockRestore();off.consumer.dispose();h.consumer.dispose();}
});

it("P07 unavailable diagnostic clocks do not change body completion",async()=>{
  const h=harness("",()=>{throw new Error("must not be reached");});
  const clock=vi.spyOn(performance,"now").mockImplementation(()=>{throw new Error("clock unavailable");});
  try{await h.consumer.submit(request);expect(h.consumer.read().last?.status).toBe("Applied");}
  finally{clock.mockRestore();h.consumer.dispose();}
});

it.each([["compile","Rejected"],["retire","RecoveryHold"]])("P07 emits the actual body %s terminal without an Applied marker",async(fault,status)=>{
  const spans:HvpCutSpan[]=[];const h=harness(fault,span=>spans.push(span));
  try{
    await h.consumer.submit(request);
    expect(spans.map(s=>s.phase)).toEqual(["cutBodySubmittedMs",`cutBodyTotal${status}Ms`]);
    expect(h.consumer.read().last?.status).toBe(status);
  }finally{h.consumer.dispose();}
});
