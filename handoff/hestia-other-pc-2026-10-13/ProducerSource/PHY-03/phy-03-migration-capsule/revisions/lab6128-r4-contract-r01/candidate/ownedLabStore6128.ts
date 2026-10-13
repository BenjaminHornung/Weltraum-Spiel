// SOURCE CANDIDATE ONLY — typecheck/tests/runtime NOT_RUN. No public integration.
import {createMemorySaveRepository} from "../inputs/a0-6128/apps/weltraum-browser/src/browser-storage/memorySaveRepository";
import {createHvpSaveStoreCore} from "../inputs/a0-6128/apps/weltraum-browser/src/hestia-prototype/persistence/phy01LabSave";
import {decodeHvpLabGame,decodeHvpColdLabGame} from "../inputs/a0-6128/apps/weltraum-browser/src/hestia-prototype/persistence/gameCheckpoint";
import {HVP_SOLVER_PROFILE} from "../inputs/a0-6128/apps/weltraum-browser/src/hestia-prototype/physics/profile";
import {requireSolver,type VerifiedSolver} from "../../../modern-r01/src/registry";
import {requirePrivateDatabase} from "../../../modern-r01/src/privateSave";
import {canonicalJson} from "../../../src/capsule";

/** Rebind the mature private store to frozen6128 validators; retain existing verified solver/owned-slot gates. */
export function createOwnedLabStore6128(solver:VerifiedSolver,databaseName:string,slotId:string){
  requireSolver(solver);requirePrivateDatabase(databaseName);
  if(!/^phy03-modern-r01-[a-zA-Z0-9-]{1,100}$/.test(slotId))throw new Error("Task-owned A0 lab slot required");
  if(canonicalJson(solver.profile)!==canonicalJson(HVP_SOLVER_PROFILE))throw new Error("Actual A0 lab solver context mismatch");
  const repository=createMemorySaveRepository([]);
  return createHvpSaveStoreCore(repository,{defaultSlot:slotId,slot:id=>{
    if(id!==slotId)throw new Error("Task-owned A0 lab slot required");return id;
  },decode:decodeHvpLabGame,decodeCold:decodeHvpColdLabGame});
}
