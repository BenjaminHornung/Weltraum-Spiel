import {beforeAll,it,expect} from "vitest";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {admitActualInputs,selectSolver,type VerifiedSolver} from "../src/registry";
import {createOwnedA0LabStore,createActualOwnerAuthoredFixtures} from "../src/a0LabContract";
let solver:VerifiedSolver;
beforeAll(async()=>{const proof=await admitActualInputs(async p=>new Uint8Array(await readFile(resolve(p))));solver=selectSolver(proof,"rapier-0.21.0-phy01.migration2:legacy-impulse-v1");},30000);
it("consumes actual A0 shared validators/WeakMap context with an owned injected memory slot",async()=>{
  const {lab}=createActualOwnerAuthoredFixtures(),slot="phy03-modern-r01-actual-owner-contract";
  const store=createOwnedA0LabStore(solver,"phy03-migration-capsule-modern-r01-owner-memory",slot);
  await store.initialize();try{
    const saved=await store.save(lab,null);expect(saved.metadata.slotId).toBe(slot);
    expect((await store.load()).game.checkpoint).toEqual(lab);
    const admissions:number[]=[],cold=await store.loadCold(b=>admissions.push(b));
    expect(admissions).toEqual([cold.game.decodeWorkingBytes]);expect(cold.recipeRetainedBytes).toBeGreaterThan(0);
    await expect(store.save(lab,0)).rejects.toMatchObject({code:"RevisionConflict"});
    await expect(store.save(lab,null,"hvp-primary")).rejects.toThrow(/Task-owned/);
  }finally{await store.close();}
});
it("keeps original legacy data readable and rejected by actual private lab context without writes",async()=>{
  const {legacy}=createActualOwnerAuthoredFixtures(),before=JSON.stringify(legacy);
  const store=createOwnedA0LabStore(solver,"phy03-migration-capsule-modern-r01-legacy-memory","phy03-modern-r01-legacy-reject");
  await store.initialize();try{
    await expect(store.save(legacy,null)).rejects.toThrow(/schema\/profile/);expect((await store.list()).slots).toEqual([]);
    expect(JSON.stringify(legacy)).toBe(before);
    expect(()=>createOwnedA0LabStore(solver,"weltraum-hestia-prototype-v1","hvp-primary")).toThrow(/Task-owned/);
  }finally{await store.close();}
});
