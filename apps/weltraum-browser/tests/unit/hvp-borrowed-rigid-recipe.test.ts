import {expect,it,vi} from "vitest";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody,prepareHvpRigidBodyOwnedHashSteps,assertHvpRigidRecipe,type HvpRigidRecipe} from "../../src/hestia-prototype/physics/rigidRecipe";
import {createStructuralOwnerLedger,isIssuedStructuralObject} from "../../src/voxel/structural/model";
import {deepFreeze} from "../../src/voxel/adaptive";

const source=(length=5)=>ingestHvpStructuralCells("borrowed-recipe",Array.from({length},(_,x)=>({x,y:0,z:0,materialId:1})),
  [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]);
const finish=(steps:Generator<string,HvpRigidRecipe,unknown>)=>{
  let units=0;
  try{for(;;){const step=steps.next();if(step.done){return {recipe:step.value,units};}units+=1;}}
  finally{steps.return(undefined as never);}
};
it("derives the identical issued rigid recipe while retaining all nested charges in one borrowed parent",()=>{
  const input=source(),expected=prepareHvpRigidBody(input),ledger=createStructuralOwnerLedger(32*1024*1024);
  const result=finish(prepareHvpRigidBodyOwnedHashSteps(input,undefined,undefined,ledger.reserve));
  expect(JSON.stringify(result.recipe)).toBe(JSON.stringify(expected));assertHvpRigidRecipe(result.recipe);
  expect(result.recipe.source).toBe(input);expect(isIssuedStructuralObject(input)).toBe(true);
  expect(ledger.resources.reservedBytes).toBeGreaterThan(0);expect(ledger.resources.hashReservations).toBe(1);
  // D2 omits the unused full Transition hash; cancellation still has real nested yields.
  expect(result.units).toBeLessThan(1024);ledger.release(true);expect(ledger.resources.reservedBytes).toBe(0);
});
it("propagates the first parent reserve failure before issuing any recipe",()=>{
  const first=new Error("borrowed parent allocation failure"),reserve=vi.fn(()=>{throw first;});
  const steps=prepareHvpRigidBodyOwnedHashSteps(source(),undefined,undefined,reserve);
  expect(()=>finish(steps)).toThrow(first);expect(reserve).toHaveBeenCalledTimes(1);
});
it("cancellation closes nested work without releasing the parent or creating a final recipe",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024),steps=prepareHvpRigidBodyOwnedHashSteps(source(64),undefined,undefined,ledger.reserve);
  expect(steps.next().done).toBe(false);expect(ledger.resources.reservedBytes).toBeGreaterThan(0);
  expect(steps.return(undefined as never)).toEqual({done:true,value:undefined});
  expect(ledger.resources.reservedBytes).toBeGreaterThan(0);ledger.release();expect(ledger.resources.reservedBytes).toBe(0);
});
it("requires a first-party issued source when borrowing the owned parent ledger",()=>{
  const clone=deepFreeze({...source()}),reserve=vi.fn();expect(isIssuedStructuralObject(clone)).toBe(false);
  expect(()=>finish(prepareHvpRigidBodyOwnedHashSteps(clone,undefined,undefined,reserve))).toThrow("Owned rigid preparation requires an issued source");
  expect(reserve).not.toHaveBeenCalled();
});

it("preserves the entire multibrick negative-seam mixed-material recipe",()=>{
  const materials=[1,32768,65535].map((materialId,index)=>({materialId,densityKgPerCubicMeter:[128,512,1024][index]!,
    structuralClass:"wood",destructible:true,tags:null}));
  const input=ingestHvpStructuralCells("borrowed-multibrick",Array.from({length:36},(_,index)=>({x:index-17,y:0,z:0,materialId:materials[index%3]!.materialId})),materials);
  expect(input.bricks.length).toBeGreaterThan(2);
  const ledger=createStructuralOwnerLedger(32*1024*1024),expected=prepareHvpRigidBody(input);
  const actual=finish(prepareHvpRigidBodyOwnedHashSteps(input,undefined,undefined,ledger.reserve));
  expect(JSON.stringify(actual.recipe)).toBe(JSON.stringify(expected));assertHvpRigidRecipe(actual.recipe);
  expect(ledger.resources.reservedBytes).toBeGreaterThan(0);expect(ledger.resources.physicalHeap).toBe("NOT_PROVEN");ledger.release();
});

it("retains the parent and original error for a later allocation failure and mid-work cancellation",()=>{
  const input=source(64),ledger=createStructuralOwnerLedger(32*1024*1024),first=new Error("later borrowed allocation failure");let calls=0;
  const reserve:typeof ledger.reserve=(...args)=>{calls+=1;if(calls===20){throw first;}ledger.reserve(...args);};
  expect(()=>finish(prepareHvpRigidBodyOwnedHashSteps(input,undefined,undefined,reserve))).toThrow(first);
  expect(calls).toBe(20);expect(ledger.resources.reservedBytes).toBeGreaterThan(0);ledger.release();
  const steps=prepareHvpRigidBodyOwnedHashSteps(input,undefined,undefined,ledger.reserve);
  expect(steps.next().done).toBe(false);
  steps.return(undefined as never);expect(ledger.resources.reservedBytes).toBeGreaterThan(0);ledger.release();
});

it("keeps the exact no-hull fallback rejection for a connected comb exceeding 64 colliders",()=>{
  const cells=Array.from({length:128},(_,x)=>({x,y:0,z:0,materialId:1}));
  for(let x=0;x<128;x+=2){cells.push({x,y:1,z:0,materialId:1});}
  const input=ingestHvpStructuralCells("borrowed-fallback",cells,[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]);
  const failure=(run:()=>unknown)=>{try{run();throw new Error("Expected fallback rejection");}catch(error){return error;}};
  const expected=failure(()=>prepareHvpRigidBody(input)),ledger=createStructuralOwnerLedger(32*1024*1024);
  const actual=failure(()=>finish(prepareHvpRigidBodyOwnedHashSteps(input,undefined,undefined,ledger.reserve)));
  expect(expected).toMatchObject({message:"HVP rigid BudgetExceeded: exact collision exceeds 64 cuboids; no hull fallback"});
  expect(actual).toMatchObject({name:(expected as Error).name,message:(expected as Error).message});
  expect(ledger.resources.reservedBytes).toBeGreaterThan(0);ledger.release();
});
