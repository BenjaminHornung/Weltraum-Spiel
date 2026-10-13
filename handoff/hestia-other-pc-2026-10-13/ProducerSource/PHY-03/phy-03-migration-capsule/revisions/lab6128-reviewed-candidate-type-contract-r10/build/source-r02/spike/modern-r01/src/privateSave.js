import { openIndexedDbPublicationStore } from "../../src/publication";
import { decodePrivate, encodePrivate } from "./envelope";
import { requireSolver } from "./registry";
import { requirePrivateDatabase } from "./privateTarget";
export { requirePrivateDatabase } from "./privateTarget";
export function openPrivateDatabase(name) { requirePrivateDatabase(name); return openIndexedDbPublicationStore(name); }
export async function publishPrivate(store, databaseName, slotId, expectedPointer, envelope, solver, crashAt) {
    requireSolver(solver);
    requirePrivateDatabase(databaseName);
    if ("databaseName" in store && store.databaseName !== databaseName)
        throw new Error("Injected database does not match the owned target");
    if (!/^phy03-modern-r01-[a-zA-Z0-9-]{1,100}$/.test(slotId))
        throw new Error("Task-owned private slot required");
    return store.publish({ slotId, bytes: encodePrivate(envelope), expectedPointer, crashAt, validate: async (b) => { await decodePrivate(b, solver); } });
}
