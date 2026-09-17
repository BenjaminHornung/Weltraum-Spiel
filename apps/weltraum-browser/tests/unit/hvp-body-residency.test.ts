import {beforeAll,expect,it,vi} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {installHvpRigidBody,prepareHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {createHvpBodyResidency} from "../../src/hestia-prototype/physics/bodyResidency";
import type {HvpCuttableBody} from "../../src/hestia-prototype/physics/bodyCut";
beforeAll(initializeHvpRapier);
const setup=()=>{
  const world=new R.World({x:0,y:-9.81,z:0});
  world.createCollider(R.ColliderDesc.cuboid(2,.1,2).setTranslation(0,-.1,0));
  const recipe=prepareHvpRigidBody(ingestHvpStructuralCells("resident-rock",[{x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1}],
    [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"stone",destructible:true,tags:null}]));
  const body=installHvpRigidBody(world,recipe,{translationMeters:{x:0,y:1,z:0},rotation:{x:0,y:0,z:0,w:1}});
  const targets=new Map<string,HvpCuttableBody>([["rock",{ownerId:"rock",body,recipe,family:"terrain"}]]),bodies=new Map([["rock",body]]);
  return {world,body,recipe,targets,bodies};
};
it("pins active/near bodies and conserves actual material, pose and sleep over twenty native cycles",()=>{
  const h=setup();let safe=true;const resident=createHvpBodyResidency(h.world,h.targets,h.bodies,()=>safe);
  try{
    expect(resident.park("rock",{x:30,y:1,z:0})).toBe(false);
    for(let i=0;i<240;i+=1){h.world.step();}expect(h.body.isSleeping()).toBe(true);
    expect(resident.park("rock",{x:10,y:1,z:0})).toBe(false);
    const before={position:{...h.body.translation()},orientation:{...h.body.rotation()},mass:h.body.mass(),digest:h.recipe.source.contentHash};
    safe=false;expect(()=>resident.park("rock",{x:30,y:1,z:0})).toThrow(/held tick/);safe=true;
    for(let i=0;i<20;i+=1){
      expect(resident.park("rock",{x:30,y:1,z:0})).toBe(true);expect(h.world.bodies.len()).toBe(0);expect(h.targets.size).toBe(0);
      expect(resident.checkpoint()).toHaveLength(1);expect(resident.near({x:30,y:1,z:0})).toEqual([]);expect(resident.near({x:0,y:1,z:0})).toEqual(["rock"]);
      expect(resident.restore("rock")).toBe(true);const current=h.targets.get("rock")!;
      expect({...current.body.translation()}).toEqual(before.position);expect({...current.body.rotation()}).toEqual(before.orientation);
      expect(current.body.mass()).toBe(before.mass);expect(current.recipe.source.contentHash).toBe(before.digest);expect(current.body.isSleeping()).toBe(true);
      expect(h.world.bodies.len()).toBe(1);expect(h.world.colliders.len()).toBe(2);expect(resident.read()).toEqual([]);
    }
  }finally{h.world.free();}
},120_000);
it("retains a checkpoint and holds after an uncertain native removal instead of losing matter",()=>{
  const h=setup();const resident=createHvpBodyResidency(h.world,h.targets,h.bodies,()=>true);
  try{
    h.body.sleep();const remove=h.world.removeRigidBody.bind(h.world);
    vi.spyOn(h.world,"removeRigidBody").mockImplementationOnce(body=>{remove(body);throw new Error("after-effect fault");});
    expect(()=>resident.park("rock",{x:30,y:1,z:0})).toThrow(/RecoveryHold/);
    expect(resident.checkpoint()).toHaveLength(1);expect(h.targets.size).toBe(0);expect(h.world.bodies.len()).toBe(0);
    expect(resident.held).toBe(true);expect(()=>resident.restore("rock")).toThrow(/RecoveryHold/);
  }finally{h.world.free();}
});
