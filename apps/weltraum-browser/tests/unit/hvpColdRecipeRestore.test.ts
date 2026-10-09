import {readFileSync,writeFileSync} from "node:fs";
import {expect,it,vi} from "vitest";
import * as gameCheckpoint from "../../src/hestia-prototype/persistence/gameCheckpoint";
import * as rigidRecipe from "../../src/hestia-prototype/physics/rigidRecipe";
import * as model from "../../src/voxel/structural/model";
import {createHvpSaveStore,HVP_SAVE_SLOT} from "../../src/hestia-prototype/persistence/saveStore";
import {createMemorySaveRepository} from "../../src/browser-storage";
import {createPersistenceSignature,validateSaveGameEnvelopeV1} from "../../src/persistence";

type ColdResult={game:gameCheckpoint.HvpDecodedGame;recipeRetainedBytes:number};
type ColdDecoder=(value:unknown,admit:(workingBytes:number)=>void)=>ColdResult;

it.skipIf(!process.env.HVP_COLD_RESTORE_INPUT)("uses private Recipes only for fresh Cold restore while preserving complete saved data default load errors and budgets",async()=>{
  const cold=(gameCheckpoint as typeof gameCheckpoint&{decodeHvpColdGame:ColdDecoder}).decodeHvpColdGame;
  expect(typeof cold).toBe("function");
  const input=JSON.parse(readFileSync(process.env.HVP_COLD_RESTORE_INPUT!,"utf8"));
  const envelope=validateSaveGameEnvelopeV1(JSON.parse(input.nativeWake.residentEastColdLoad.saved),[]),value=envelope.player.data.hestia;
  const publicGame=gameCheckpoint.decodeHvpGame(value);
  let admissionCalls=0,admittedBytes=0,privateRecipeCalls=0;
  const recipeSpy=vi.spyOn(rigidRecipe,"prepareHvpRigidBody").mockImplementation(()=>{throw new Error("Cold path called public Recipe");});
  const privateRecipe=rigidRecipe.prepareHvpRigidBodyOwnedHashSteps;
  const privateSpy=vi.spyOn(rigidRecipe,"prepareHvpRigidBodyOwnedHashSteps").mockImplementation((...args)=>{privateRecipeCalls+=1;return privateRecipe(...args);});
  let candidate:ColdResult;
  try{
    candidate=cold(value,working=>{admissionCalls+=1;admittedBytes=working;});
    expect(recipeSpy).not.toHaveBeenCalled();expect(privateRecipeCalls).toBe(4);expect(admissionCalls).toBe(1);
    expect(admittedBytes).toBe(publicGame.decodeWorkingBytes);expect(candidate.recipeRetainedBytes).toBeGreaterThan(0);
    expect(Number.isSafeInteger(candidate.recipeRetainedBytes)).toBe(true);
    expect(Object.keys(candidate.game)).toEqual(Object.keys(publicGame));gameCheckpoint.assertHvpDecodedGame(candidate.game);
    expect(JSON.stringify(candidate.game.checkpoint)).toBe(JSON.stringify(publicGame.checkpoint));
    expect(JSON.stringify(candidate.game.world)).toBe(JSON.stringify(publicGame.world));
    expect(candidate.game.root.checkpoint()).toEqual(publicGame.root.checkpoint());
    expect(candidate.game.neighborRoot!.checkpoint()).toEqual(publicGame.neighborRoot!.checkpoint());
    const blocked=new Error("Cold admission denied");privateRecipeCalls=0;
    expect(()=>cold(value,()=>{throw blocked;})).toThrow(blocked);expect(privateRecipeCalls).toBe(0);
  }finally{privateSpy.mockRestore();recipeSpy.mockRestore();}
  const mutable=structuredClone(publicGame.checkpoint);
  const protectedGame=cold(mutable,()=>{(mutable.world.bodies[0]!.surfaces[0]! as {friction:number}).friction+=.25;}).game;
  expect(protectedGame.world.bodies[0]!.checkpoint.surfaces[0]!.friction).toBe(publicGame.world.bodies[0]!.checkpoint.surfaces[0]!.friction);
  expect(JSON.stringify(protectedGame.world)).toBe(JSON.stringify(publicGame.world));
  const failure=(run:()=>unknown)=>{try{run();}catch(error){return (error as Error).message;}throw new Error("Expected saved input rejection");};
  const corrupt=structuredClone(publicGame.checkpoint);(corrupt as {signature:string}).signature="fnv1a32:00000000";
  let rejectedAdmission=0;expect(failure(()=>cold(corrupt,()=>{rejectedAdmission+=1;}))).toBe(failure(()=>gameCheckpoint.decodeHvpGame(corrupt)));expect(rejectedAdmission).toBe(0);
  const material=structuredClone(publicGame.checkpoint);
  (material.world.bodies[0]!.surfaces[0]! as {restitution:number}).restitution=2;
  const {signature:_signature,...data}=material;(material as {signature:string}).signature=createPersistenceSignature(data);
  expect(failure(()=>cold(material,()=>{}))).toBe(failure(()=>gameCheckpoint.decodeHvpGame(material)));
  const nativeLedger=model.createStructuralOwnerLedger;let failedLedger:ReturnType<typeof nativeLedger>|undefined;
  const ledgerSpy=vi.spyOn(model,"createStructuralOwnerLedger").mockImplementation((resident,_limit,hashUnits)=>{failedLedger=nativeLedger(resident,1,hashUnits);return failedLedger;});
  try{expect(()=>cold(value,()=>{})).toThrow(/Prepare96MiB|CPU256MiB/);expect(failedLedger!.resources).toMatchObject({reservedBytes:0,retainedEstimateBytes:0});}
  finally{ledgerSpy.mockRestore();}
  const repository=createMemorySaveRepository([]),store=createHvpSaveStore(repository);await store.initialize();
  try{
    await repository.writeSlot({slotId:HVP_SAVE_SLOT,expectedRevision:null,envelope,lastWriteReason:"ManualSave"});
    const publicSpy=vi.spyOn(rigidRecipe,"prepareHvpRigidBody");
    try{
      const normal=await store.load();expect(publicSpy).toHaveBeenCalledTimes(4);publicSpy.mockClear();
      const loadCold=(store as typeof store&{loadCold:(admit:(bytes:number)=>void)=>Promise<ColdResult&{metadata:typeof normal.metadata}>}).loadCold;
      expect(typeof loadCold).toBe("function");const loaded=await loadCold(()=>{});expect(publicSpy).not.toHaveBeenCalled();
      expect(loaded.metadata).toEqual(normal.metadata);expect(JSON.stringify(loaded.game.checkpoint)).toBe(JSON.stringify(normal.game.checkpoint));
      expect(loaded.recipeRetainedBytes).toBe(candidate.recipeRetainedBytes);
    }finally{publicSpy.mockRestore();}
  }finally{await store.close();}
  if(process.env.HVP_COLD_RESTORE_OUTPUT){writeFileSync(process.env.HVP_COLD_RESTORE_OUTPUT,JSON.stringify({classification:"FRESH_COLD_D2_RECIPE_CONTRACT_TEST_NOT_GAME_QUALIFICATION",status:"PASS",
    bodies:4,admissionCalls,admittedBytes,retainedRecipeBytes:candidate.recipeRetainedBytes,fullCheckpointWorldRootParity:true,defaultLoadRemainsPublic:true,
    admissionFailureBeforeRecipe:true,originalReserveFailureReleased:true,corruptSignatureAndMaterialErrorsPreserved:true})+"\n",{flag:"wx"});}
},120_000);
