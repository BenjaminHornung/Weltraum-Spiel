import {expect,it,vi} from "vitest";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody,prepareHvpRigidBodyOwnedHashSteps,assertHvpRigidRecipe,type HvpRigidRecipe} from "../../src/hestia-prototype/physics/rigidRecipe";
import {createStructuralOwnerLedger,isIssuedStructuralObject} from "../../src/voxel/structural/model";
import {deepFreeze} from "../../src/voxel/adaptive";

const source=()=>ingestHvpStructuralCells("borrowed-recipe",Array.from({length:5},(_,x)=>({x,y:0,z:0,materialId:1})),
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
  expect(ledger.resources.reservedBytes).toBeGreaterThan(0);expect(ledger.resources.hashReservations).toBeGreaterThan(1);
  expect(result.units).toBeGreaterThan(100);ledger.release(true);expect(ledger.resources.reservedBytes).toBe(0);
});
it("propagates the first parent reserve failure before issuing any recipe",()=>{
  const first=new Error("borrowed parent allocation failure"),reserve=vi.fn(()=>{throw first;});
  const steps=prepareHvpRigidBodyOwnedHashSteps(source(),undefined,undefined,reserve);
  expect(()=>finish(steps)).toThrow(first);expect(reserve).toHaveBeenCalledTimes(1);
});
it("cancellation closes nested work without releasing the parent or creating a final recipe",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024),steps=prepareHvpRigidBodyOwnedHashSteps(source(),undefined,undefined,ledger.reserve);
  expect(steps.next().done).toBe(false);expect(ledger.resources.reservedBytes).toBeGreaterThan(0);
  expect(steps.return(undefined as never)).toEqual({done:true,value:undefined});
  expect(ledger.resources.reservedBytes).toBeGreaterThan(0);ledger.release();expect(ledger.resources.reservedBytes).toBe(0);
});
it("requires a first-party issued source when borrowing the owned parent ledger",()=>{
  const clone=deepFreeze({...source()}),reserve=vi.fn();expect(isIssuedStructuralObject(clone)).toBe(false);
  expect(()=>finish(prepareHvpRigidBodyOwnedHashSteps(clone,undefined,undefined,reserve))).toThrow("Owned rigid preparation requires an issued source");
  expect(reserve).not.toHaveBeenCalled();
});
