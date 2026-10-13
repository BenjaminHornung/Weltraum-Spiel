import { openIndexedDbPublicationStore } from "../../src/publication.js";
import { decodePrivate, encodePrivate } from "./envelope.js";
import { requireSolver } from "./registry.js";
import { requirePrivateDatabase } from "./privateTarget.js";
export { requirePrivateDatabase } from "./privateTarget.js";
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
