import {expect,it,vi} from "vitest";
import {createHvpStructuralConsumer} from "../../src/hestia-prototype/terrain/structuralConsumer";
import type {HvpPhysicsClient} from "../../src/hestia-prototype/physics/client";

const request={id:"branch-1",generation:0,sourceDigest:"source",direction:{x:0,y:0,z:1}};
const harness=(fault="")=>{
  let world=0,visible=0,published=0,paused=false;
  const fail=(phase:string)=>{if(phase===fault){throw new Error(`injected ${phase}`);}};
  const physics={
    prepareBranch:vi.fn(async()=>{fail("prepare");return {state:"PreparedHeld"};}),
    commitBranch:async()=>{fail("commit");world=1;},
    publishBranch:()=>{fail("world-publish");published=world;},
    rollbackBranch:async()=>{expect(visible).toBe(0);world=0;published=0;},
    finalizeBranch:async()=>{fail("finalize");},
    command:async()=>{paused=true;},read:()=>({structural:{state:"Idle"}})
  } as unknown as HvpPhysicsClient;
  const consumer=createHvpStructuralConsumer(physics,()=>{
    fail("upload");return {
      publish(){expect(world).toBe(1);expect(published).toBe(1);visible=1;fail("publish");},
      rollback(){visible=0;},finish(){fail("retire");}
    };
  });
  return {consumer,physics,state:()=>({world,visible,published,paused})};
};
it("publishes held source/World/mesh once and returns the same receipt for duplicate intent",async()=>{
  const h=harness(),promise=h.consumer.submit(request);
  expect(h.consumer.submit(request)).toBe(promise);await promise;
  expect(h.consumer.read().last?.status).toBe("Applied");expect(h.state()).toEqual({world:1,visible:1,published:1,paused:false});
  expect(h.physics.prepareBranch).toHaveBeenCalledTimes(1);
  await expect(h.consumer.submit({...request,direction:{x:1,y:0,z:0}})).rejects.toThrow(/conflict/);
});
it("restores structural outcomes and preserves synchronous-failure receipts",async()=>{
  const h=harness();await h.consumer.submit(request);
  const saved=JSON.parse(JSON.stringify(h.consumer.checkpoint()));h.consumer.dispose();
  const next=harness();next.consumer.restoreReceipts(saved);await next.consumer.submit(request);
  expect(next.physics.prepareBranch).not.toHaveBeenCalled();expect(next.consumer.read().last).toEqual(saved.last);
  next.physics.prepareBranch=()=>{throw new Error("synchronous native rejection");};
  await next.consumer.submit({...request,id:"branch-2"});
  expect(next.consumer.checkpoint().entries[1]!.outcome.status).toBe("Rejected");
  const invalid=structuredClone(saved);invalid.entries[0].outcome.status="RecoveryHold";
  expect(()=>next.consumer.restoreReceipts(invalid)).toThrow(/completed/);
  expect(next.consumer.checkpoint().entries).toHaveLength(2);
});
it.each(["prepare","upload","commit","world-publish","publish","finalize"])("restores old visibility before resuming World on %s failure",async fault=>{
  const h=harness(fault);await h.consumer.submit(request);
  expect(h.consumer.read().last?.status).toBe("Rejected");expect(h.state()).toEqual({world:0,visible:0,published:0,paused:false});
});
it("retains the new generation and enters RecoveryHold after uncertain old-resource retirement",async()=>{
  const h=harness("retire");await h.consumer.submit(request);
  expect(h.consumer.read().state).toBe("RecoveryHold");expect(h.state()).toEqual({world:1,visible:1,published:1,paused:true});
  await expect(h.consumer.submit({...request,id:"branch-2"})).rejects.toThrow(/RecoveryHold/);
});
