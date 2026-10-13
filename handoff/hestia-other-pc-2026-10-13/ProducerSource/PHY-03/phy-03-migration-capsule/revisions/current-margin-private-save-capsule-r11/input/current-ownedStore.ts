import {createMemorySaveRepository} from "./current-app/src/browser-storage/memorySaveRepository";
import {createHvpSaveStoreCore} from "./current-app/src/hestia-prototype/persistence/phy01LabSave";
import {decodeHvpLabGame,decodeHvpColdLabGame} from "./current-app/src/hestia-prototype/persistence/gameCheckpoint";
import {HVP_SOLVER_PROFILE} from "./current-app/src/hestia-prototype/physics/profile";
import {requireSolver,type VerifiedSolver} from "./spike/modern-r01/src/registry";
import {requirePrivateDatabase} from "./spike/modern-r01/src/privateTarget";
import {canonicalJson} from "./spike/src/profileBinding";

export function createOwnedCurrentLabStore(solver:VerifiedSolver,databaseName:string,slotId:string){
  requireSolver(solver);requirePrivateDatabase(databaseName);
  if(!/^phy03-modern-r01-[a-zA-Z0-9-]{1,100}$/.test(slotId))throw new Error("Task-owned A0 lab slot required");
  if(canonicalJson(solver.profile)!==canonicalJson(HVP_SOLVER_PROFILE)
    ||solver.source.wasmSha256!=="f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb"
    ||solver.package.version!=="0.21.0-phy01.migration2-margin-r05")throw new Error("Actual current A0 source/package context mismatch");
  const repository=createMemorySaveRepository([]);
  return createHvpSaveStoreCore(repository,{defaultSlot:slotId,slot:id=>{
    if(id!==slotId)throw new Error("Task-owned A0 lab slot required");return id;
  },decode:decodeHvpLabGame,decodeCold:decodeHvpColdLabGame});
}
