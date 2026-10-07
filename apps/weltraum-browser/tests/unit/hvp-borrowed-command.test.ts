import {expect,it,vi} from "vitest";
import * as structuralPublic from "../../src/voxel/structural";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {ownedStructuralCommandSteps,applyStructuralDestructionCommand} from "../../src/voxel/structural/commands";
import {createStructuralOwnerLedger,isIssuedStructuralObject} from "../../src/voxel/structural/model";
import {serializeStructuralResult,serializeStructuralObject} from "../../src/voxel/structural/canonical";
import {STRUCTURAL_COMMAND_SCHEMA_VERSION,type StructuralObject} from "../../src/voxel/structural/types";
import {deepFreeze} from "../../src/voxel/adaptive";

const source=()=>ingestHvpStructuralCells("borrowed-command",Array.from({length:5},(_,x)=>({x,y:0,z:0,materialId:1})),
  [{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]);
const command=(before:StructuralObject)=>deepFreeze({schemaVersion:STRUCTURAL_COMMAND_SCHEMA_VERSION,commandId:"borrowed-cut",
  targetObjectId:before.objectId,expectedObjectRevision:before.objectRevision,resultingObjectRevision:before.objectRevision+1,
  expectedAdaptiveSource:before.source,sequence:1,actor:"hvp.player",source:"hvp.plasma",materialFilter:null,kind:"SubtractBox" as const,
  shape:{kind:"box" as const,space:"object-local-quantum" as const,boundsQuantum:{min:{x:2,y:0,z:0},max:{x:3,y:1,z:1}}},
  budgets:{maxVisitedBricks:8,maxVisitedCells:32768,maxSelectedCells:512,maxChangedCells:512,maxConnectivityCells:32768,
    maxConnectivityFacts:262144,maxComponents:32,maxMassCells:32768}});
const finish=<T>(steps:Generator<unknown,T,unknown>):T=>{
  let failed=false;
  try{for(;;){const step=steps.next();if(step.done){return step.value;}}}
  catch(error){failed=true;throw error;}
  finally{try{steps.return(undefined as never);}catch(error){if(!failed){throw error;}}}
};
it("uses the same complete command bytes and legitimate issuer without resetting the borrowed parent",()=>{
  const before=source(),request=command(before),original=serializeStructuralObject(before),expected=applyStructuralDestructionCommand(before,request);
  const ledger=createStructuralOwnerLedger(32*1024*1024),actual=finish(ownedStructuralCommandSteps(before,request,ledger.reserve));
  expect(serializeStructuralResult(actual)).toBe(serializeStructuralResult(expected));expect(actual.status).toBe("Applied");
  expect(isIssuedStructuralObject(actual.object)).toBe(true);expect(serializeStructuralObject(before)).toBe(original);
  expect(ledger.resources.reservedBytes).toBeGreaterThan(0);expect(ledger.resources.hashReservations).toBeGreaterThan(0);
  expect(structuralPublic).not.toHaveProperty("ownedStructuralCommandSteps");ledger.release(true);
});
it("cancels nested command work while its charges remain with the real parent",()=>{
  const before=source(),ledger=createStructuralOwnerLedger(32*1024*1024),steps=ownedStructuralCommandSteps(before,command(before),ledger.reserve);
  for(let unit=0;unit<100;unit+=1){expect(steps.next().done).toBe(false);}
  steps.return(undefined as never);expect(ledger.resources.reservedBytes).toBeGreaterThan(0);ledger.release();
});
it("preserves the actual parent budget error instead of a new rejection receipt or nested reset",()=>{
  const before=source(),ledger=createStructuralOwnerLedger(32*1024*1024,20_000);
  let error:unknown;
  try{finish(ownedStructuralCommandSteps(before,command(before),ledger.reserve));}catch(value){error=value;}
  expect(error).toMatchObject({path:"cursor/prepareBytes"});expect(ledger.resources.reservedBytes).toBeGreaterThan(0);ledger.release();
});
it("keeps an ordinary later parent failure original and prevents all further reserve/hash work",()=>{
  const before=source(),ledger=createStructuralOwnerLedger(32*1024*1024),first=new Error("later parent reserve sentinel");let calls=0;
  const reserve=vi.fn<typeof ledger.reserve>((...args)=>{calls+=1;if(calls===2){throw first;}ledger.reserve(...args);});
  let error:unknown;
  try{finish(ownedStructuralCommandSteps(before,command(before),reserve));}catch(value){error=value;}
  expect(error).toBe(first);expect(reserve).toHaveBeenCalledTimes(2);
  expect(ledger.resources.reservedBytes).toBeGreaterThan(0);ledger.release();
});
it("rejects an unissued clone before allocating borrowed command storage",()=>{
  const before=source(),ledger=createStructuralOwnerLedger(32*1024*1024);
  expect(()=>finish(ownedStructuralCommandSteps(deepFreeze({...before}),command(before),ledger.reserve)))
    .toThrow("Owned commands require a first-party issued source.");
  expect(ledger.resources.reservedBytes).toBe(0);
});
