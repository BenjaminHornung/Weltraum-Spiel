import {migrateLegacy,decodeEnvelope,canonicalJson,sha256,type Envelope,type LegacyKind} from "../../src/capsule";
import {decodeHvpBody} from "../../snapshot/src/hestia-prototype/persistence/bodyCheckpoint";
import {decodeHvpWorld} from "../../snapshot/src/hestia-prototype/persistence/worldCheckpoint";
import {decodeHvpGame} from "../../snapshot/src/hestia-prototype/persistence/gameCheckpoint";
import {requireSolver,type VerifiedSolver} from "./registry";

const encoder=new TextEncoder(),decoder=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true});
const hashValue=(v:unknown)=>sha256(encoder.encode(canonicalJson(v)));
const parse=(b:Uint8Array):unknown=>{if(!b.length||b.length>16*1024*1024)throw new Error("Private transport budget");return JSON.parse(decoder.decode(b).replace(/^\ufeff/,""));};
function bodyFrames(bytes:Uint8Array,kind:LegacyKind){
  const value=parse(bytes),bodies=kind==="body"?[decodeHvpBody(value)]:kind==="world"?decodeHvpWorld(value).bodies:decodeHvpGame(value).world.bodies;
  return bodies.map(({checkpoint,recipe})=>({ownerId:checkpoint.ownerId,sourceHash:recipe.source.contentHash,
    sourceFrame:recipe.source.frame,mass:recipe.mass,principalInertia:recipe.axes.principalInertia,inertiaFrame:recipe.axes.frame}));
}
export interface PrivateEnvelope {
  readonly version:"phy03-private-actual-envelope-r01";
  readonly solverProfile:VerifiedSolver["reference"];
  readonly solverBinding:Pick<VerifiedSolver,"profile"|"package"|"source"|"inputIndexSha256"|"ownerDecisionSha256"|"partialEvidence">;
  readonly sourceStatus:"LEGACY_EXACT_SOURCEV2_UNSUPPORTED";
  readonly colliderStatus:"LEGACY_BINDING_RETAINED_PARTIAL_MATRIX_NO_COLLIDER_ADOPTION";
  readonly legacyEnvelope:Envelope;
  readonly bodyFrames:ReturnType<typeof bodyFrames>;
  readonly digest:string;
}
/** Private data transform only. Original stored solver labels and bytes are retained. */
export async function migratePrivate(bytes:Uint8Array,kind:LegacyKind,solver:VerifiedSolver):Promise<PrivateEnvelope>{
  requireSolver(solver);
  const copy=new Uint8Array(bytes),legacyEnvelope=await migrateLegacy(copy,kind,"legacy-ordered-boxes-v1");
  const {profile,package:pkg,source,inputIndexSha256,ownerDecisionSha256,partialEvidence}=solver;
  const payload={version:"phy03-private-actual-envelope-r01" as const,solverProfile:solver.reference,
    solverBinding:{profile,package:pkg,source,inputIndexSha256,ownerDecisionSha256,partialEvidence},
    sourceStatus:"LEGACY_EXACT_SOURCEV2_UNSUPPORTED" as const,colliderStatus:"LEGACY_BINDING_RETAINED_PARTIAL_MATRIX_NO_COLLIDER_ADOPTION" as const,
    legacyEnvelope,bodyFrames:bodyFrames(copy,kind)};
  return {...payload,digest:await hashValue(payload)};
}
export function encodePrivate(value:PrivateEnvelope):Uint8Array{const b=encoder.encode(canonicalJson(value));parse(b);return b;}
export async function decodePrivate(bytes:Uint8Array,solver:VerifiedSolver){
  requireSolver(solver);const value=parse(bytes) as PrivateEnvelope|null;
  if(!value||value.version!=="phy03-private-actual-envelope-r01"||!value.legacyEnvelope)throw new Error("Unknown private envelope version");
  const {digest,...payload}=value;
  if(typeof digest!=="string"||digest!==await hashValue(payload))throw new Error("Private envelope digest mismatch");
  const old=await decodeEnvelope(encoder.encode(canonicalJson(value.legacyEnvelope)));
  const expected=await migratePrivate(old.legacy,old.envelope.legacy.kind,solver);
  if(canonicalJson(expected)!==canonicalJson(value))throw new Error("Private profile/source/frame/collider mismatch");
  return {envelope:expected,legacy:old.legacy,canonical:old.canonical};
}
export async function readPrivateSave(bytes:Uint8Array,kind:LegacyKind,solver:VerifiedSolver){
  const header=parse(bytes) as {version?:unknown}|null;
  if(header?.version==="phy03-private-actual-envelope-r01")return decodePrivate(bytes,solver);
  if(header?.version==="phy03-world-envelope-v1"){
    const old=await decodeEnvelope(bytes);const envelope=await migratePrivate(old.legacy,old.envelope.legacy.kind,solver);
    return {envelope,legacy:old.legacy,canonical:old.canonical};
  }
  const envelope=await migratePrivate(bytes,kind,solver);
  return {envelope,legacy:new Uint8Array(bytes),canonical:envelope.legacyEnvelope.canonical};
}
