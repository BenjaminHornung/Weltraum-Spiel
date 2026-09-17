import {expect,it,vi} from "vitest";
import {createHvpBodyCutConsumer} from "../../src/hestia-prototype/terrain/bodyCutConsumer";
import type {HvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import type {HvpBodyCutProducts} from "../../src/workers/hvpBodyCutJob";

const request={id:"recut-1",ownerId:"hvp:terrain-fragment:r1:12345678",sourceDigest:"source",edge:1,direction:{x:0,y:0,z:1}};
const harness=(fault="")=>{
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
  });
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
