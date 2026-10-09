import {expect,it,vi} from "vitest";
import {ingestHvpStructuralCells,prepareHvpStructuralIngestOwnedSteps} from "../../src/hestia-prototype/terrain/structuralIngest";
import * as retention from "../../src/voxel/adaptive/residency";
import * as structuralCanonical from "../../src/voxel/structural/canonical";
import {deriveStructuralSingleComponentPhysicsPreparation,deriveStructuralSingleComponentPhysicsPreparationOwnedHashSteps} from "../../src/voxel/structural/physicsTransition";
import {STRUCTURAL_FRAGMENT_SCHEMA_VERSION,STRUCTURAL_FRAGMENT_ID_VERSION} from "../../src/voxel/structural/types";
import {prepareHvpLocalBodyCut,prepareHvpLocalBodyCutOwnedHashSteps,readHvpBodyCells,readHvpOwnedBodyCellsSteps} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {prepareHvpRigidBody,prepareHvpRigidBodyOwnedHashSteps,assertHvpRigidRecipe} from "../../src/hestia-prototype/physics/rigidRecipe";
import {createStructuralOwnerLedger,isIssuedStructuralObject} from "../../src/voxel/structural/model";
import {serializeStructuralObject,structuralCanonicalHashSteps} from "../../src/voxel/structural/canonical";
import {borrowedHvpPlanSteps} from "../../src/hestia-prototype/physics/structuralPlan";
import {deepFreeze,hashAdaptiveCanonical} from "../../src/voxel/adaptive";
import type {StructuralOwnedReserve} from "../../src/voxel/structural/validation";

const source=(length=5)=>ingestHvpStructuralCells("borrowed-body",Array.from({length},(_,x)=>({x,y:0,z:0,materialId:1})),
  [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]);
const finish=<T>(steps:Generator<unknown,T,unknown>):T=>{
  let failed=false;
  try{for(;;){const step=steps.next();if(step.done){return step.value;}}}
  catch(error){failed=true;throw error;}
  finally{try{steps.return(undefined as never);}catch(error){if(!failed){throw error;}}}
};
it("keeps full canonical bytes and original default units while the owner selects an immutable bounded hash quantum",()=>{
  const payload=deepFreeze({values:Array.from({length:4096},(_,index)=>index%3===0?"material.65535":"material.1"),edge:-0});
  const expected=hashAdaptiveCanonical(payload),counts:number[]=[];
  for(const units of [1,128] as const){
    const ledger=createStructuralOwnerLedger(32*1024*1024,undefined,units),steps=structuralCanonicalHashSteps(payload,ledger.reserve);let count=0;
    try{for(;;){count+=1;const step=steps.next();if(step.done){expect(step.value).toBe(expected);break;}}}
    finally{steps.return(undefined as never);ledger.release();}
    expect(ledger.resources.reservedBytes).toBe(0);counts.push(count);
    expect(Object.getOwnPropertyDescriptor(ledger.reserve,"hashUnits")).toEqual(units===1?undefined:
      {value:128,writable:false,configurable:false,enumerable:false});
  }
  expect(counts[0]).toBeGreaterThan(4096);expect(counts[1]).toBeLessThan(128);
});
it("refuses getter or mutable hash-quantum metadata without reading a getter and retains the first parent failure",()=>{
  const payload=deepFreeze({value:1});let reads=0;
  for(const descriptor of [{get:()=>{reads+=1;return 128;}},{value:128,writable:true},{value:128,configurable:true}]){
    const reserve:StructuralOwnedReserve=()=>{};Object.defineProperty(reserve,"hashUnits",descriptor);
    expect(()=>finish(structuralCanonicalHashSteps(payload,reserve))).toThrow("immutable own value");
  }
  expect(reads).toBe(0);
  const first=new Error("parent hash credit failed"),reserve:StructuralOwnedReserve=()=>{throw first;};
  Object.defineProperty(reserve,"hashUnits",{value:0});
  expect(()=>finish(structuralCanonicalHashSteps(payload,reserve))).toThrow(first);
  expect(()=>createStructuralOwnerLedger(32*1024*1024,undefined,0 as never)).toThrow("1 or 128");
});
it("bounds borrowed work with a stalled clock and closes its actual nested cursor on cancellation",()=>{
  const clock=vi.spyOn(performance,"now").mockReturnValue(0);
  let advances=0,closed=0;
  function* nested(){try{for(let unit=0;unit<300;unit+=1){advances+=1;yield;}return "complete";}finally{closed+=1;}}
  const steps=borrowedHvpPlanSteps(nested(),"ownerIngest");
  try{
    expect(steps.next()).toEqual({done:false,value:"ownerIngest"});expect(advances).toBe(128);
    expect(steps.next()).toEqual({done:false,value:"ownerIngest"});expect(advances).toBe(256);
    steps.return(undefined as never);expect(closed).toBe(1);expect(advances).toBe(256);
  }finally{steps.return(undefined as never);clock.mockRestore();}
});
it("ends borrowed work at its elapsed cutoff before reaching the unit ceiling",()=>{
  let now=0,advances=0,closed=0;
  const clock=vi.spyOn(performance,"now").mockImplementation(()=>now);
  function* nested(){try{for(let unit=0;unit<300;unit+=1){advances+=1;now+=.25;yield;}return "complete";}finally{closed+=1;}}
  const steps=borrowedHvpPlanSteps(nested(),"ownerMass");
  try{
    expect(steps.next()).toEqual({done:false,value:"ownerMass"});expect(advances).toBe(4);
    steps.return(undefined as never);expect(closed).toBe(1);
  }finally{steps.return(undefined as never);clock.mockRestore();}
});
it.each([new Error("nested first failure"),null,undefined])("keeps the original borrowed failure when cursor cleanup also fails (%s)",first=>{
  const cleanup=new Error("nested cleanup failure"),nested=(function*(){yield;return 1;})();
  const close=vi.fn(()=>{throw cleanup;});nested.next=()=>{throw first;};nested.return=close;
  let caught=false,actual:unknown;
  try{borrowedHvpPlanSteps(nested,"ownerIngest").next();}catch(error){caught=true;actual=error;}
  expect(caught).toBe(true);expect(actual).toBe(first);expect(close).toHaveBeenCalledTimes(1);
});
it("propagates cleanup failure after a successful borrowed result",()=>{
  const cleanup=new Error("completed cursor cleanup failure"),nested=(function*(){return 7;})();
  nested.return=()=>{throw cleanup;};
  expect(()=>borrowedHvpPlanSteps(nested,"ownerIngest").next()).toThrow(cleanup);
});
it.each(["Box","Sphere"] as const)("composes the same complete %s plan, children and removed mass under one retained parent",brush=>{
  const before=source(),original=serializeStructuralObject(before),recipe=prepareHvpRigidBody(before),edge=brush==="Sphere"?2:1;
  const expected=prepareHvpLocalBodyCut(before,[2,0,0],"borrowed-plan",edge,brush),ledger=createStructuralOwnerLedger(32*1024*1024);
  let recipeSteps=0;
  const steps=prepareHvpLocalBodyCutOwnedHashSteps(before,[2,0,0],"borrowed-plan",edge,brush,undefined,recipe,ledger.reserve);
  const actual=finish((function*(){try{for(;;){const step=steps.next();if(step.done){return step.value;}
    if(["ownerRecipe","childSourcePrepare","childClassificationCells","childHash"].includes(step.value)){recipeSteps+=1;}
    yield step.value;}}finally{steps.return(undefined as never);}})());
  // Tiny D2 Recipes may complete inside one bounded step after full partition reuse.
  expect(recipeSteps).toBeLessThan(1024);
  expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));expect(serializeStructuralObject(before)).toBe(original);
  expect(isIssuedStructuralObject(actual.plan.after)).toBe(true);
  for(const part of actual.plan.parts){assertHvpRigidRecipe(part.recipe);expect(isIssuedStructuralObject(part.recipe.source)).toBe(true);}
  expect(ledger.resources.reservedBytes).toBeGreaterThan(0);expect(ledger.resources.hashReservations).toBeGreaterThan(3);ledger.release(true);
});
it("reuses only this reserved preparation's freshly derived fragment binding and keeps complete mass/classification/transition bytes",()=>{
  const before=source(),zero={x:0,y:0,z:0};
  const args=[before,{velocityMetersPerSecond:zero,angularVelocityRadPerSecond:zero},
    {maxFragments:1,maxCollidersPerFragment:64,maxVoxelsPerFragment:32768},
    {maxVisitedCells:32768,maxConnectivityCells:32768,maxComponents:32,maxConnectivityFacts:262144},()=>{},()=>{}] as const;
  const expected=deriveStructuralSingleComponentPhysicsPreparation(...args),ledger=createStructuralOwnerLedger(32*1024*1024,undefined,128);
  const hash=vi.spyOn(structuralCanonical,"structuralCanonicalHashSteps");
  try{
    const actual=finish(deriveStructuralSingleComponentPhysicsPreparationOwnedHashSteps(...args,ledger.reserve));
    expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    for(const schemaVersion of [STRUCTURAL_FRAGMENT_SCHEMA_VERSION,STRUCTURAL_FRAGMENT_ID_VERSION]){
      expect(hash.mock.calls.filter(([payload])=>(payload as {schemaVersion?:string}).schemaVersion===schemaVersion)).toHaveLength(1);
    }
    expect(ledger.resources.reservedBytes).toBeGreaterThan(0);
  }finally{hash.mockRestore();ledger.release();}
});
it("lets the final Structural issuer build and fully validate authority retention once per owned ingest",()=>{
  const cells=Array.from({length:5},(_,x)=>({x,y:0,z:0,materialId:1}));
  const materials=[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}];
  const expected=ingestHvpStructuralCells("retention-once",cells,materials),ledger=createStructuralOwnerLedger(32*1024*1024,undefined,128);
  const build=vi.spyOn(retention,"adaptiveAuthorityRetentionSteps");
  const phases:string[]=[];
  try{
    const actual=finish(prepareHvpStructuralIngestOwnedSteps("retention-once",cells,materials,[],ledger.reserve,phase=>phases.push(phase)));
    expect(serializeStructuralObject(actual)).toBe(serializeStructuralObject(expected));
    expect(isIssuedStructuralObject(actual)).toBe(true);expect(build).toHaveBeenCalledTimes(1);
    expect(phases).toEqual(["ownerIngestPrefix","ownerIngestBricks","ownerIngestProofs","ownerIngestStructural"]);
    expect(ledger.resources.reservedBytes).toBeGreaterThan(0);
  }finally{build.mockRestore();ledger.release();}
});
it("checks recipe measurement lifetime once per bounded owned quantum rather than per internal scalar",()=>{
  const before=source(64),expected=prepareHvpRigidBody(before),ledger=createStructuralOwnerLedger(32*1024*1024,undefined,128);
  const clock=vi.spyOn(performance,"now").mockReturnValue(0),live=vi.fn(()=>true);
  try{
    const actual=finish(prepareHvpRigidBodyOwnedHashSteps(before,{},live,ledger.reserve));
    expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    expect(live).toHaveBeenCalled();expect(live.mock.calls.length).toBeLessThan(64);
    expect(ledger.resources.reservedBytes).toBeGreaterThan(0);
  }finally{clock.mockRestore();ledger.release();}
});
it("closes mid-plan command/ingest work without releasing the shared parent",()=>{
  const before=source(),recipe=prepareHvpRigidBody(before),ledger=createStructuralOwnerLedger(32*1024*1024);
  const steps=prepareHvpLocalBodyCutOwnedHashSteps(before,[2,0,0],"cancel-plan",1,"Box",undefined,recipe,ledger.reserve);
  for(let unit=0;unit<100;unit+=1){expect(steps.next().done).toBe(false);}
  steps.return(undefined as never);expect(ledger.resources.reservedBytes).toBeGreaterThan(0);ledger.release();
});
it("cancels the actual borrowed recipe at its first outer quantum while retaining its parent credit",()=>{
  // Keep a recipe larger than one128-unit quantum after duplicate work is removed.
  const before=ingestHvpStructuralCells("cancel-recipe",Array.from({length:16},(_,x)=>({x,y:0,z:0,materialId:1})),
    [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]);
  const recipe=prepareHvpRigidBody(before),ledger=createStructuralOwnerLedger(32*1024*1024,undefined,128);
  const steps=prepareHvpLocalBodyCutOwnedHashSteps(before,[2,0,0],"cancel-recipe",1,"Box",undefined,recipe,ledger.reserve);
  const clock=vi.spyOn(performance,"now").mockReturnValue(0);let reached=false;
  try{for(let unit=0;unit<100000;unit+=1){const step=steps.next();expect(step.done).toBe(false);
    if(step.value==="ownerRecipe"){reached=true;break;}}
    expect(reached).toBe(true);steps.return(undefined as never);
    expect(steps.next().done).toBe(true);expect(ledger.resources.reservedBytes).toBeGreaterThan(0);
  }finally{steps.return(undefined as never);clock.mockRestore();ledger.release();}
  expect(ledger.resources.reservedBytes).toBe(0);
});
it("keeps the original parent failure before any final plan or retry work",()=>{
  const before=source(),recipe=prepareHvpRigidBody(before),ledger=createStructuralOwnerLedger(32*1024*1024),first=new Error("body parent reserve failed");let calls=0;
  const reserve=vi.fn<typeof ledger.reserve>((...args)=>{calls+=1;if(calls===2){throw first;}ledger.reserve(...args);});
  expect(()=>finish(prepareHvpLocalBodyCutOwnedHashSteps(before,[2,0,0],"failed-plan",1,"Box",undefined,recipe,reserve))).toThrow(first);
  expect(reserve).toHaveBeenCalledTimes(2);expect(ledger.resources.reservedBytes).toBeGreaterThan(0);ledger.release();
});
it("credits a warm cell projection before borrowing it from the parent",()=>{
  const before=source(),cached=readHvpBodyCells(before),first=new Error("warm projection reserve failed");
  const reserve=vi.fn(()=>{throw first;});
  expect(()=>finish(readHvpOwnedBodyCellsSteps(before,reserve))).toThrow(first);
  expect(reserve).toHaveBeenCalledExactlyOnceWith(64+cached.length*256,true);
});
it("yields through Sphere material comparisons while preserving first-match semantics",()=>{
  const materials=Array.from({length:64},(_,index)=>({materialId:index+1,densityKgPerCubicMeter:512,
    structuralClass:"wood" as const,destructible:true,tags:null}));
  const before=ingestHvpStructuralCells("sphere-material-scan",Array.from({length:5},(_,x)=>({x,y:0,z:0,materialId:64})),materials);
  const expected=prepareHvpLocalBodyCut(before,[2,0,0],"sphere-material-scan",2,"Sphere"),recipe=prepareHvpRigidBody(before);
  const ledger=createStructuralOwnerLedger(32*1024*1024),steps=prepareHvpLocalBodyCutOwnedHashSteps(before,[2,0,0],"sphere-material-scan",2,"Sphere",undefined,recipe,ledger.reserve);
  let comparisons=0;
  try{for(;;){const step=steps.next();if(step.done){expect(JSON.stringify(step.value)).toBe(JSON.stringify(expected));break;}
    if(step.value==="ownerMaterial"){comparisons+=1;}}
    expect(comparisons).toBe(expected.plan.removedCells*materials.length);
  }finally{steps.return(undefined as never);ledger.release();}
});
