// Private source candidate only. Runtime/tests NOT_RUN; no public integration.
import { createMemorySaveRepository } from "../../lab6128-r4-contract-r01/inputs/a0-6128/apps/weltraum-browser/src/browser-storage/memorySaveRepository";
import { createHvpSaveStoreCore } from "../../lab6128-r4-contract-r01/inputs/a0-6128/apps/weltraum-browser/src/hestia-prototype/persistence/phy01LabSave";
import { decodeHvpLabGame, decodeHvpColdLabGame } from "../../lab6128-r4-contract-r01/inputs/a0-6128/apps/weltraum-browser/src/hestia-prototype/persistence/gameCheckpoint";
import { HVP_SOLVER_PROFILE } from "../../lab6128-r4-contract-r01/inputs/a0-6128/apps/weltraum-browser/src/hestia-prototype/physics/profile";
import { requireSolver } from "../../../modern-r01/src/registry";
import { requirePrivateDatabase } from "../../../modern-r01/src/privateTarget";
import { canonicalJson } from "../../../src/profileBinding";
export function createOwnedLabStore6128(solver, databaseName, slotId) {
    requireSolver(solver);
    requirePrivateDatabase(databaseName);
    if (!/^phy03-modern-r01-[a-zA-Z0-9-]{1,100}$/.test(slotId))
        throw new Error("Task-owned A0 lab slot required");
    if (canonicalJson(solver.profile) !== canonicalJson(HVP_SOLVER_PROFILE))
        throw new Error("Actual A0 lab solver context mismatch");
    const repository = createMemorySaveRepository([]);
    return createHvpSaveStoreCore(repository, { defaultSlot: slotId, slot: id => {
            if (id !== slotId)
                throw new Error("Task-owned A0 lab slot required");
            return id;
        }, decode: decodeHvpLabGame, decodeCold: decodeHvpColdLabGame });
}
