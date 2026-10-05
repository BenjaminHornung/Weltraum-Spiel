import {beforeAll,expect,it,vi} from "vitest";
import {R,initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody,installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {createHvpBodyCutSession,type HvpBodyPlanHost} from "../../src/hestia-prototype/physics/bodyCutSession";
import {prepareHvpBodyCutSteps} from "../../src/hestia-prototype/physics/bodyCut";

const probe=vi.hoisted(()=>({steps:0,closed:0}));
vi.mock("../../src/hestia-prototype/physics/bodyCut",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../src/hestia-prototype/physics/bodyCut")>();
  return {...actual,prepareHvpBodyCutSteps:vi.fn(function*(...args:Parameters<typeof actual.prepareHvpBodyCutSteps>){
    try{
      // Pump-only probe before the real retained native plan; no replacement product/Worker harness.
      for(const phase of ["childClassificationCells","childHash"]){
        for(let i=0;i<4;i+=1){
          probe.steps+=1;yield phase;
        }
      }
      return yield* actual.prepareHvpBodyCutSteps(...args);
    }finally{
      probe.closed+=1;
    }
  })};
});
beforeAll(initializeHvpRapier);

it("keeps every classification/first-phase task yield, budgets only hash batches, shares one plan and checks cancellation after each advance",async()=>{
  for(const mode of ["legacy","expired","budgeted","cancel"] as const){
    Object.assign(probe,{steps:0,closed:0});vi.mocked(prepareHvpBodyCutSteps).mockClear();
    const world=new R.World({x:0,y:0,z:0});
    const source=ingestHvpStructuralCells("quantum-source",Array.from({length:5},(_,x)=>({x,y:0,z:0,materialId:1})),
      [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]);
    const recipe=prepareHvpRigidBody(source),body=installHvpRigidBody(world,recipe);
    const target={ownerId:"quantum-parent",body,recipe};
    const session=createHvpBodyCutSession(world,new Map([[target.ownerId,target]]),new Map([[target.ownerId,body]]),"quantum-session");
    const request={id:"quantum-cut",ownerId:target.ownerId,sourceDigest:source.contentHash,edge:1,direction:{x:0,y:0,z:1}};
    const yields:number[]=[];
    let continued=0;
    const assertCurrent=vi.fn();
    const host:HvpBodyPlanHost={yieldTask:()=>{
      yields.push(probe.steps);continued=0;
      return new Promise<void>(resolve=>{setTimeout(resolve,0);});
    },assertCurrent,...(mode==="legacy"?{}:{continuePlan:()=>{
      if(mode==="cancel"){
        session.rollback(request.id);return true;
      }
      continued+=1;
      return mode==="budgeted"&&continued<3;
    }})};
    let preparation:Promise<void>|undefined;
    try{
      session.begin(request,{x:.3125,y:.0625,z:-1},7);
      preparation=session.preparePlan(request.id,host);
      expect(yields).toEqual([1]);expect(probe.steps).toBe(1);
      expect(session.holdsWorld).toBe(false);expect(world.bodies.len()).toBe(1);
      if(mode==="cancel"){
        await expect(preparation).rejects.toThrow("Moving preparation cancelled");
        expect(probe.steps).toBe(6);expect(yields).toEqual([1,2,3,4,5]);expect(assertCurrent).toHaveBeenCalledTimes(5);
      }else{
        await preparation;
        expect(yields.slice(0,mode==="budgeted"?6:8)).toEqual(mode==="budgeted"?[1,2,3,4,5,8]:[1,2,3,4,5,6,7,8]);
        // A new phase still yields even while the budget would allow another repeated batch.
        expect(yields[mode==="budgeted"?6:8]).toBe(8);
        const count=yields.length;
        await session.preparePlan(request.id,host);
        expect(yields).toHaveLength(count);expect(prepareHvpBodyCutSteps).toHaveBeenCalledTimes(1);
        session.rollback(request.id);
      }
      expect(probe.closed).toBe(1);expect(world.bodies.len()).toBe(1);
    }finally{
      if(session.busy){
        session.rollback(request.id);
      }
      await preparation?.catch(()=>undefined);
      world.free();
    }
  }
});
