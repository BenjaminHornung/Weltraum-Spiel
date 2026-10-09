import {expect,it,vi} from "vitest";
import {writeFileSync} from "node:fs";
import {resolve,dirname,basename} from "node:path";
import checkpoint from "../fixtures/hvp-contact-r90-body384.json";
import {decodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import {prepareHvpStructuralBreak,prepareHvpStructuralBreakOwnedHashSteps} from "../../src/hestia-prototype/physics/structuralPlan";
import {prepareHvpRigidBody} from "../../src/hestia-prototype/physics/rigidRecipe";
import * as commands from "../../src/voxel/structural/commands";
import * as validation from "../../src/voxel/structural/validation";
import * as model from "../../src/voxel/structural/model";
import * as classification from "../../src/voxel/structural/classificationSteps";
import * as mass from "../../src/voxel/structural/massProperties";

const output=process.env.HVP_OWNER_COMMAND_OUTPUT;
const fallback=process.env.HVP_OWNER_COMMAND_FALLBACK;
it.skipIf(!output)("attributes four existing OwnerCommand generator boundaries on saved Body384 with full plan parity",()=>{
  const master=resolve("../..",".devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/tests/D2");
  if(!output||dirname(resolve(output))!==master||!/^owner-command-attribution-r\d+\.json$/.test(basename(output))){throw new Error("Explicit fresh bound receipt required");}
  if(fallback!==undefined&&fallback!=="1"){throw new Error("Unknown test-only fallback comparison");}
  let source=decodeHvpBody(checkpoint).recipe.source;
  expect(source.contentHash).toBe("fnv1a64-v1:70d85a5593bd44c9");
  expect(source.bricks.reduce((n,brick)=>n+brick.cells.length,0)).toBe(384);
  const bounds={min:{x:180,y:84,z:76},max:{x:184,y:88,z:80}},commandId="d2-owner-command-attribution";
  const ledger=model.createStructuralOwnerLedger(32*1024*1024,undefined,128),spies:Array<{mockRestore:()=>void}>=[];
  const aggregate=()=>({calls:0,completed:0,nextCalls:0,elapsedMs:0});
  const ownerCommand=aggregate(),commandValidation=aggregate(),derivation=aggregate(),classifyWork=aggregate(),massWork=aggregate(),publication=aggregate();
  let insideOwner=false,passed=false;
  const observe=<Y,T,N>(steps:Generator<Y,T,N>,row:ReturnType<typeof aggregate>,owner=false)=>{
    row.calls+=1;const next=steps.next.bind(steps);let started:number|undefined;
    steps.next=(...args)=>{const previous=insideOwner;if(owner){insideOwner=true;}started??=performance.now();row.nextCalls+=1;
      try{const result=next(...args);if(result.done){row.completed+=1;row.elapsedMs+=performance.now()-started;}return result;}
      finally{insideOwner=previous;}};return steps;
  };
  try{
    const admission=model.admitOwnedStructuralGraphSteps(source,ledger.reserve);
    try{for(;;){const step=admission.next();if(step.done){source=step.value;break;}}}finally{admission.return(undefined as never);}
    expect(model.isOwnedStructuralGraph(source)).toBe(true);
    const expected=prepareHvpStructuralBreak(source,bounds,commandId);
    const parentRecipe=prepareHvpRigidBody(source);
    if(fallback==="1"){spies.push(vi.spyOn(classification,"readOwnedClassifiedMassEntries").mockReturnValue(undefined));}
    const owner=commands.ownedStructuralPlanCommandSteps,validate=validation.structuralDestructionCommandValidationSteps,
      derive=model.ownedStructuralDerivationCandidateSteps,classify=classification.structuralOwnedComponentClassificationSteps,
      measureMass=mass.structuralOwnedObjectMassSteps,publish=model.ownedStructuralReconstructionSteps;
    spies.push(vi.spyOn(commands,"ownedStructuralPlanCommandSteps").mockImplementation((...args)=>observe(owner(...args),ownerCommand,true)));
    spies.push(vi.spyOn(validation,"structuralDestructionCommandValidationSteps").mockImplementation((...args)=>{
      const steps=validate(...args);return insideOwner?observe(steps,commandValidation):steps;}));
    spies.push(vi.spyOn(model,"ownedStructuralDerivationCandidateSteps").mockImplementation((...args)=>{
      const steps=derive(...args);return insideOwner?observe(steps,derivation):steps;}));
    spies.push(vi.spyOn(classification,"structuralOwnedComponentClassificationSteps").mockImplementation((...args)=>{
      const steps=classify(...args);return insideOwner?observe(steps,classifyWork):steps;}));
    spies.push(vi.spyOn(mass,"structuralOwnedObjectMassSteps").mockImplementation((...args)=>{
      const steps=measureMass(...args);return insideOwner?observe(steps,massWork):steps;}));
    spies.push(vi.spyOn(model,"ownedStructuralReconstructionSteps").mockImplementation((...args)=>{
      const steps=publish(...args);return insideOwner?observe(steps,publication):steps;}));
    const steps=prepareHvpStructuralBreakOwnedHashSteps(source,bounds,commandId,undefined,parentRecipe,ledger.reserve);
    try{for(;;){const step=steps.next();if(step.done){
      expect(JSON.stringify(step.value)).toBe(JSON.stringify(expected));
      expect(step.value.after.bricks.reduce((n,brick)=>n+brick.cells.length,0)).toBe(352);break;
    }}}finally{steps.return(undefined as never);}
    for(const row of [ownerCommand,commandValidation,derivation,classifyWork,massWork,publication]){expect(row).toMatchObject({calls:1,completed:1});}
    for(const row of [ownerCommand,commandValidation,derivation,classifyWork,massWork,publication]){
      expect(row.nextCalls).toBeGreaterThan(0);expect(Number.isFinite(row.elapsedMs)&&row.elapsedMs>=0).toBe(true);}
    passed=true;
  }finally{
    for(const spy of spies){spy.mockRestore();}ledger.release();
    expect(ledger.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});
    const receipt=JSON.stringify({classification:"SYNCHRONOUS_SAVED_BODY384_GENERATOR_ELAPSED_NOT_GAME_CPU",status:passed?"PASS":"FAIL",
      sourceHash:source.contentHash,sourceCells:384,remainingCells:passed?352:null,fullPlanParity:passed,
      ownerCommand,phases:{commandValidation,derivation,classificationAndMass:{classification:classifyWork,mass:massWork},publication},
      hashUnits:128,ownedAncestor:model.isOwnedStructuralGraph(source),parentRecipeReused:true,testOnlyMassFallback:fallback==="1",
      hashUnitsMeaning:"Real bodyCutSession ledger/admitted Source; historical r01 default1 and r02/r03 unadmitted Sources are different diagnostic populations.",ledgerAfter:ledger.resources,
      timingMeaning:"Only first-next and terminal clocks per generator; no per-cell timers. Synchronous drain includes observer/descheduling time. OwnerCommand includes every child span; child spans may contain each other, do not add or infer game CPU."},null,2);
    expect(Buffer.byteLength(receipt+"\n")).toBeLessThanOrEqual(8192);writeFileSync(output,receipt+"\n",{flag:"wx"});
  }
});
