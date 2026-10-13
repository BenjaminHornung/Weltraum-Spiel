import {createMemorySaveRepository} from "../inputs/a0-lab-codec/consumer/apps/weltraum-browser/src/browser-storage/memorySaveRepository";
import {createHvpSaveStoreCore} from "../inputs/a0-lab-codec/consumer/apps/weltraum-browser/src/hestia-prototype/persistence/phy01LabSave";
import {decodeHvpLabGame,decodeHvpColdLabGame} from "../inputs/a0-lab-codec/consumer/apps/weltraum-browser/src/hestia-prototype/persistence/gameCheckpoint";
import {HVP_SOLVER_PROFILE} from "../inputs/a0-lab-codec/consumer/apps/weltraum-browser/src/hestia-prototype/physics/profile";
import {canonicalJson} from "../../src/capsule";
import {requireSolver,type VerifiedSolver} from "./registry";
import {requirePrivateDatabase} from "./privateSave";

/** Consume A0's actual shared codec/store core; task-owned memory repository and explicit slot only. */
export function createOwnedA0LabStore(solver:VerifiedSolver,databaseName:string,slotId:string){
  requireSolver(solver);requirePrivateDatabase(databaseName);
  if(!/^phy03-modern-r01-[a-zA-Z0-9-]{1,100}$/.test(slotId))throw new Error("Task-owned A0 lab slot required");
  if(canonicalJson(solver.profile)!==canonicalJson(HVP_SOLVER_PROFILE))throw new Error("Actual A0 lab solver context mismatch");
  const repository=createMemorySaveRepository([]);
  return createHvpSaveStoreCore(repository,{defaultSlot:slotId,slot:id=>{
    if(id!==slotId)throw new Error("Task-owned A0 lab slot required");return id;
  },decode:decodeHvpLabGame,decodeCold:decodeHvpColdLabGame});
}
export {createActualOwnerAuthoredFixtures} from "../inputs/a0-lab-codec/consumer/apps/weltraum-browser/tests/unit/phy03-fixture.generated";
