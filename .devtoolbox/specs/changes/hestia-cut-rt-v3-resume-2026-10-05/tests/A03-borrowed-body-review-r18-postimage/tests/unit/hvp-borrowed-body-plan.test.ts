import {expect,it,vi} from "vitest";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpLocalBodyCut,prepareHvpLocalBodyCutOwnedHashSteps,readHvpBodyCells,readHvpOwnedBodyCellsSteps} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {prepareHvpRigidBody,assertHvpRigidRecipe} from "../../src/hestia-prototype/physics/rigidRecipe";
import {createStructuralOwnerLedger,isIssuedStructuralObject} from "../../src/voxel/structural/model";
import {serializeStructuralObject} from "../../src/voxel/structural/canonical";

const source=()=>ingestHvpStructuralCells("borrowed-body",Array.from({length:5},(_,x)=>({x,y:0,z:0,materialId:1})),
  [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]);
const finish=<T>(steps:Generator<unknown,T,unknown>):T=>{
  let failed=false;
  try{for(;;){const step=steps.next();if(step.done){return step.value;}}}
  catch(error){failed=true;throw error;}
  finally{try{steps.return(undefined as never);}catch(error){if(!failed){throw error;}}}
};
it.each(["Box","Sphere"] as const)("composes the same complete %s plan, children and removed mass under one retained parent",brush=>{
  const before=source(),original=serializeStructuralObject(before),recipe=prepareHvpRigidBody(before),edge=brush==="Sphere"?2:1;
  const expected=prepareHvpLocalBodyCut(before,[2,0,0],"borrowed-plan",edge,brush),ledger=createStructuralOwnerLedger(32*1024*1024);
  const actual=finish(prepareHvpLocalBodyCutOwnedHashSteps(before,[2,0,0],"borrowed-plan",edge,brush,undefined,recipe,ledger.reserve));
  expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));expect(serializeStructuralObject(before)).toBe(original);
  expect(isIssuedStructuralObject(actual.plan.after)).toBe(true);
  for(const part of actual.plan.parts){assertHvpRigidRecipe(part.recipe);expect(isIssuedStructuralObject(part.recipe.source)).toBe(true);}
  expect(ledger.resources.reservedBytes).toBeGreaterThan(0);expect(ledger.resources.hashReservations).toBeGreaterThan(3);ledger.release(true);
});
it("closes mid-plan command/ingest work without releasing the shared parent",()=>{
  const before=source(),recipe=prepareHvpRigidBody(before),ledger=createStructuralOwnerLedger(32*1024*1024);
  const steps=prepareHvpLocalBodyCutOwnedHashSteps(before,[2,0,0],"cancel-plan",1,"Box",undefined,recipe,ledger.reserve);
  for(let unit=0;unit<100;unit+=1){expect(steps.next().done).toBe(false);}
  steps.return(undefined as never);expect(ledger.resources.reservedBytes).toBeGreaterThan(0);ledger.release();
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
