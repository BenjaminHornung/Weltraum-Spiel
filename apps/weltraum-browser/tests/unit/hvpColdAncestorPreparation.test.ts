import {expect,it,vi} from "vitest";
import checkpoint from "../fixtures/hvp-contact-r90-body384.json";
import {decodeHvpBody,decodeHvpColdBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import {prepareHvpLocalBodyCut,prepareHvpLocalBodyCutOwnedHashSteps} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {createStructuralOwnerLedger,isOwnedStructuralGraph} from "../../src/voxel/structural/model";
import * as classification from "../../src/voxel/structural/classificationSteps";

const drain=<T>(steps:Generator<unknown,T,unknown>):T=>{
  try{for(;;){const step=steps.next();if(step.done){return step.value;}}}finally{steps.return(undefined as never);}
};
const failure=(run:()=>unknown)=>{
  try{run();}
  catch(error){const value=error as Error&{code?:unknown;path?:unknown};return {name:value.name,message:value.message,code:value.code,path:value.path};}
  throw new Error("Expected saved input rejection");
};
it("prepares the real saved Body384 ancestor before returning the private Cold Recipe with full Source and plan parity",()=>{
  const expected=decodeHvpBody(checkpoint),ledger=createStructuralOwnerLedger(32*1024*1024,undefined,128);
  try{
    expect(isOwnedStructuralGraph(expected.recipe.source)).toBe(false);
    const actual=decodeHvpColdBody(checkpoint,ledger.reserve);
    expect(isOwnedStructuralGraph(actual.recipe.source)).toBe(true);
    expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    expect(actual.recipe.source).not.toBe(expected.recipe.source);
    expect(actual.recipe.mass.occupiedVoxelCount).toBe(384);
    const publicPlan=prepareHvpLocalBodyCut(expected.recipe.source,[180,84,76],"cold-ancestor-recut",4,"Box").plan;
    const reader=classification.readOwnedClassifiedMassEntries;let classifiedRows=0;
    const reuse=vi.spyOn(classification,"readOwnedClassifiedMassEntries").mockImplementation((...args)=>{
      const rows=reader(...args);if(rows!==undefined){classifiedRows+=1;}return rows;
    });
    try{
      const owned=drain(prepareHvpLocalBodyCutOwnedHashSteps(actual.recipe.source,[180,84,76],"cold-ancestor-recut",4,"Box",undefined,actual.recipe,ledger.reserve));
      expect(JSON.stringify(owned.plan)).toBe(JSON.stringify(publicPlan));
      expect(owned.plan.parts[0]!.recipe.mass.occupiedVoxelCount).toBe(352);
      expect(classifiedRows).toBeGreaterThan(0);
    }finally{reuse.mockRestore();}
    expect(ledger.resources.retainedEstimateBytes).toBeGreaterThan(0);
  }finally{ledger.release();}
  expect(ledger.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});
});
it("preserves malformed public Cold checkpoint errors before ancestor allocation",()=>{
  const invalidSurface=structuredClone(checkpoint);
  invalidSurface.surfaces[0]!.restitution=2;
  const invalidVersion={...checkpoint,version:"invalid"};
  const invalidRegion={...checkpoint,region:"{}"};
  for(const input of [invalidSurface,invalidVersion,invalidRegion]){
    let reserves=0;
    expect(failure(()=>decodeHvpColdBody(input,()=>{reserves+=1;}))).toEqual(failure(()=>decodeHvpBody(input)));
    expect(reserves).toBe(0);
  }
});
it("fails closed when owned ancestor preparation exceeds the unchanged Prepare cap",()=>{
  const ledger=createStructuralOwnerLedger(32*1024*1024,1,128);
  try{expect(()=>decodeHvpColdBody(checkpoint,ledger.reserve)).toThrow(/Prepare96MiB|CPU256MiB/);}
  finally{ledger.release();}
  expect(ledger.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});
});
