import {expect,it} from "vitest";
import {createHvpDormancyController} from "../../src/hestia-prototype/runtime/dormancyController";
import type {HvpPhysicsClient} from "../../src/hestia-prototype/physics/client";

const harness=(fault="")=>{
  let prepared=0,visible=true,running=true,published=false;
  const fail=(phase:string)=>{if(phase===fault){throw new Error(phase);}};
  const physics={read:()=>({status:"Running",player:{status:"Walking",position:{x:20,y:1,z:0}},bodyResidencyTransaction:"Idle",parked:[],
      terrainFragments:[{ownerId:"rock"}],bodies:[{ownerId:"rock",sleeping:true,position:{x:0,y:0,z:0}}]}),
    prepareBodyResidency:async()=>{prepared+=1;running=false;fail("prepare");return {} as never;},
    commitBodyResidency:async()=>{expect(running).toBe(false);},publishBodyResidency:()=>{published=true;},
    finalizeBodyResidency:async()=>{expect(visible).toBe(false);running=true;},rollbackBodyResidency:async()=>{fail("rollback");running=true;},
    command:async()=>{running=false;}} as unknown as HvpPhysicsClient;
  const controller=createHvpDormancyController({physics,blocked:()=>false,current:()=>true,admit:()=>{},stage:()=>{
    if(fault==="rollback"){throw new Error("upload");}return {publish(){expect(published).toBe(true);visible=false;},rollback(){visible=true;},finish(){fail("retire");}};
  }});
  return {controller,state:()=>({prepared,visible,running})};
};
const settled=async(c:ReturnType<typeof createHvpDormancyController>)=>{for(let i=0;i<100&&c.read().busy;i+=1){await Promise.resolve();}expect(c.read().busy).toBe(false);};
it("keeps the World held until the replacement visibility is published",async()=>{
  const h=harness();h.controller.update();await settled(h.controller);
  expect(h.state()).toEqual({prepared:1,visible:false,running:true});expect(h.controller.read().changes).toBe(1);await h.controller.dispose();
});
it.each(["rollback","retire"])("holds on uncertain %s rather than reporting a restored World",async fault=>{
  const h=harness(fault);h.controller.update();await settled(h.controller);expect(h.controller.read().recoveryHold).toBe(true);expect(h.state().running).toBe(false);
  for(let i=0;i<200;i+=1){h.controller.update();}expect(h.state().prepared).toBe(1);await h.controller.dispose();
});
