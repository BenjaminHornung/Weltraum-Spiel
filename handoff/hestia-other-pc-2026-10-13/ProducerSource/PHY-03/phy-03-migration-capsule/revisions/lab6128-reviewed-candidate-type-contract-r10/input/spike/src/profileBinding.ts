import {serializeCanonicalPersistenceValue} from "../snapshot/src/persistence";

// Same mature aliases/bodies as capsule.ts, without importing a legacy World decoder.
export const canonicalJson=serializeCanonicalPersistenceValue;
export const sha256=async(bytes:Uint8Array):Promise<string>=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new Uint8Array(bytes))))
  .map(n=>n.toString(16).padStart(2,"0")).join("");
export interface ProfileRef {readonly id:string;readonly digest:string}
