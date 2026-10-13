import {openIndexedDbPublicationStore,type PublicationStore,type Pointer,type PublicationCrashPhase} from "../../src/publication";
import {decodePrivate,type PrivateEnvelope,encodePrivate} from "./envelope";
import {requireSolver,type VerifiedSolver} from "./registry";
import {requirePrivateDatabase} from "./privateTarget";
export {requirePrivateDatabase} from "./privateTarget";

export function openPrivateDatabase(name:string){requirePrivateDatabase(name);return openIndexedDbPublicationStore(name);}
export async function publishPrivate(store:PublicationStore,databaseName:string,slotId:string,expectedPointer:Pointer,envelope:PrivateEnvelope,
  solver:VerifiedSolver,crashAt?:PublicationCrashPhase){
  requireSolver(solver);requirePrivateDatabase(databaseName);
  if("databaseName" in store&&store.databaseName!==databaseName)throw new Error("Injected database does not match the owned target");
  if(!/^phy03-modern-r01-[a-zA-Z0-9-]{1,100}$/.test(slotId))throw new Error("Task-owned private slot required");
  return store.publish({slotId,bytes:encodePrivate(envelope),expectedPointer,crashAt,validate:async b=>{await decodePrivate(b,solver);}});
}
