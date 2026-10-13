import {beforeAll,expect,it} from "vitest";
import {createMemorySaveRepository} from "../../src/browser-storage/memorySaveRepository";
import {assertHvpDecodedGame,assertHvpDecodedLabGame,decodeHvpGame,decodeHvpLabGame,decodeHvpColdLabGame,encodeHvpLabGame,
  type HvpDecodedGame,type HvpLabGameCheckpoint} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import {createHvpPhy01LabSaveStore,HVP_PHY01_LAB_SAVE_SLOT} from "../../src/hestia-prototype/persistence/phy01LabSave";
import {HVP_SOLVER_PROFILE} from "../../src/hestia-prototype/physics/profile";
import {createPersistenceSignature} from "../../src/persistence/canonical";
import {createSyntheticAuthoredCodecFixtures} from "../fixtures/phy01LabCodecFixtures";

let fixtures:ReturnType<typeof createSyntheticAuthoredCodecFixtures>;

const resignLab=(value:HvpLabGameCheckpoint):HvpLabGameCheckpoint=>{
  const {signature:_signature,...data}=value;
  return {...value,signature:createPersistenceSignature(data)};
};
const labData=(value:HvpLabGameCheckpoint)=>{
  const {version:_version,profiles:_profiles,signature:_signature,...data}=value;
  return data;
};

beforeAll(()=>{fixtures=createSyntheticAuthoredCodecFixtures();});

it("keeps legacy and PHY-01 codec contexts and admission markers separate",()=>{
  const {lab,legacy}=fixtures,decodedLab=decodeHvpLabGame(lab),decodedLegacy=decodeHvpGame(legacy);
  expect(lab.profiles.solver).toEqual(HVP_SOLVER_PROFILE);
  expect(decodedLab.checkpoint).toEqual(lab);expect(decodedLegacy.checkpoint).toEqual(legacy);
  expect(()=>decodeHvpGame(lab)).toThrow(/schema\/profile/);
  expect(()=>decodeHvpLabGame(legacy)).toThrow(/schema\/profile/);
  expect(()=>assertHvpDecodedGame(decodedLab as unknown as HvpDecodedGame)).toThrow(/Unvalidated/);
  expect(()=>assertHvpDecodedLabGame(decodedLegacy as unknown as ReturnType<typeof decodeHvpLabGame>)).toThrow(/Unvalidated/);
  expect(()=>assertHvpDecodedGame(decodedLegacy)).not.toThrow();
  expect(()=>assertHvpDecodedLabGame(decodedLab)).not.toThrow();
});

it("rejects legacy solver, gyro-on, wrong source profile, and invalid signature in the lab context",()=>{
  const {lab,legacy}=fixtures;
  let coldAdmissions=0;
  expect(()=>decodeHvpColdLabGame(legacy,()=>{coldAdmissions+=1;})).toThrow(/schema\/profile/);
  expect(coldAdmissions).toBe(0);
  const legacyWorld=structuredClone(lab);Reflect.set(legacyWorld.world,"solver","rapier-0.12.0");
  expect(()=>decodeHvpLabGame(resignLab(legacyWorld))).toThrow(/World checkpoint profile\/owner budget/);
  const gyro=structuredClone(lab);Reflect.set(gyro,"profiles",{...gyro.profiles,solver:{...HVP_SOLVER_PROFILE,dynamicGyroscopicForces:true}});
  expect(()=>decodeHvpLabGame(resignLab(gyro))).toThrow(/schema\/profile/);
  const wrongSource=structuredClone(lab);Reflect.set(wrongSource,"profiles",{...wrongSource.profiles,
    solver:{...HVP_SOLVER_PROFILE,sourceProfile:"rapier-0.21.0-phy01.migration1"}});
  expect(()=>decodeHvpLabGame(resignLab(wrongSource))).toThrow(/schema\/profile/);
  const badSignature=structuredClone(lab);Reflect.set(badSignature,"signature","forged");
  expect(()=>decodeHvpLabGame(badSignature)).toThrow(/signature mismatch/);
});

it("retains owner and source transport rejection for lab checkpoints",()=>{
  const {lab}=fixtures;
  const duplicateOwner=encodeHvpLabGame({...labData(lab),world:{...lab.world,bodies:[...lab.world.bodies,...lab.world.bodies]}});
  expect(()=>decodeHvpLabGame(duplicateOwner)).toThrow(/Duplicate or invalid body owner/);
  const oversized=structuredClone(lab);
  Reflect.set(oversized.world.bodies[0]!,"region","x".repeat(16*1024*1024+1));
  expect(()=>decodeHvpLabGame(oversized)).toThrow(/World source transport budget/);
});

it("uses the existing MemorySaveRepository envelope, CAS, export and import path in its fixed lab slot",async()=>{
  const repository=createMemorySaveRepository([]),store=createHvpPhy01LabSaveStore(repository);
  await store.initialize();
  try{
    const saved=await store.save(fixtures.lab,null);
    expect(saved.metadata.slotId).toBe(HVP_PHY01_LAB_SAVE_SLOT);expect(saved.metadata.recordRevision).toBe(1);
    const loaded=await store.load();expect(loaded.game.checkpoint).toEqual(fixtures.lab);
    const preparations:number[]=[],cold=await store.loadCold(bytes=>{preparations.push(bytes);});
    expect(cold.game.checkpoint).toEqual(fixtures.lab);
    expect(preparations).toEqual([loaded.game.decodeWorkingBytes]);
    expect(cold.recipeRetainedBytes).toBeGreaterThan(0);
    expect(()=>assertHvpDecodedLabGame(cold.game)).not.toThrow();
    const bundle=await store.export();
    await store.import(bundle,{kind:"ReplaceExpectedRevision",expectedRevision:1});
    expect((await store.load()).metadata.recordRevision).toBe(2);
    const beforeRejectedWrites=await store.export();
    await expect(store.save(fixtures.lab,1)).rejects.toMatchObject({code:"RevisionConflict"});
    await expect(store.save(fixtures.lab,null,"hvp-primary")).rejects.toThrow(/isolated slot/);
    await expect(store.import(bundle,{kind:"CreateNewSlot",targetSlotId:"hvp-primary"})).rejects.toThrow(/isolated slot/);
    expect(await store.export()).toEqual(beforeRejectedWrites);
  }finally{await store.close();}
});
