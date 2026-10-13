import {canonicalJson,sha256,type ProfileRef} from "./profileBinding";
export {canonicalJson,sha256} from "./profileBinding";
export type {ProfileRef} from "./profileBinding";
import {decodeHvpBody,type HvpDecodedBody} from "../snapshot/src/hestia-prototype/persistence/bodyCheckpoint";
import {decodeHvpWorld} from "../snapshot/src/hestia-prototype/persistence/worldCheckpoint";
import {decodeHvpGame} from "../snapshot/src/hestia-prototype/persistence/gameCheckpoint";
import {readHvpBodyCells} from "../snapshot/src/hestia-prototype/physics/bodyCutPlan";
import solver from "../solver-profile.json";

const BASE="17b1db4201a28e7b607c30707bdc2b75e3484a10";
const encoder=new TextEncoder(),decoder=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true});
// Preserve original BOM bytes; JSON parsers consume only the decoded leading marker.
const parseJson=(text:string):unknown=>JSON.parse(text.startsWith("\ufeff")?text.slice(1):text);
const MAX_BYTES=16*1024*1024;
const hashValue=(value:unknown)=>sha256(encoder.encode(canonicalJson(value)));
export type LegacyKind="body"|"world"|"game";
type Surface=HvpDecodedBody["checkpoint"]["surfaces"][number];
export type SurfaceBinding=
  |Readonly<{ownerId:string;sourceHash:string;kind:"owner-uniform";surface:Surface}>
  |Readonly<{ownerId:string;sourceHash:string;kind:"legacy-ordered-boxes";entries:readonly {box:unknown;surface:Surface}[]}>;
export interface Envelope {
  readonly version:"phy03-world-envelope-v1";
  readonly worldFormatVersion:"phy03-canonical-world-v1";
  readonly sourceCodec:ProfileRef;readonly solverProfile:ProfileRef;readonly collisionProfile:ProfileRef;
  readonly legacy:Readonly<{kind:LegacyKind;utf8:string;sha256:string}>;
  readonly canonical:unknown;readonly surfaceBindings:readonly SurfaceBinding[];
  readonly provenance:Readonly<{sourceCommit:string;migration:"legacy-envelope-v1";inputSha256:string}>;
  readonly digest:string;
}
const structuralSource={id:"legacy-structural-region-v1",codec:"structural-object-v1+structural-region-save-v1",hashPolicy:"original-structural-FNV64-canonical"};
const sourceDefinitions={
  body:structuralSource,world:structuralSource,
  game:{id:"legacy-hvp-source-set-v1",codec:"hvp-authored-coast-v5+legacy-structural-region-v1+plant-v1",hashPolicy:"original-FNV32-terrain+FNV64-structural"}
} as const;
const collisionDefinitions=[
  {id:"owner-uniform-rebuild-v1",binding:"uniform-surface-per-owner-independent-of-shape-order",terrain:"retain-legacy-collision-digest-no-terrain-representation-change"},
  {id:"legacy-ordered-boxes-v1",binding:"exact-17b1-greedy-box-order-and-per-index-surface",terrain:"retain-legacy-collision-digest"}
] as const;
const reference=async(value:{id:string}):Promise<ProfileRef>=>({id:value.id,digest:await hashValue(value)});
const requireBytes=(bytes:Uint8Array)=>{
  if(!(bytes instanceof Uint8Array)||bytes.byteLength===0||bytes.byteLength>MAX_BYTES){throw new Error("Migration transport budget");}
};
function decodeLegacy(bytes:Uint8Array,kind:LegacyKind){
  requireBytes(bytes);const text=decoder.decode(bytes),value=parseJson(text);
  if(kind==="body"){return {text,bodies:[decodeHvpBody(value)],context:null};}
  if(kind==="world"){
    const world=decodeHvpWorld(value),{bodies:_,solver:__,...header}=world.checkpoint;
    return {text,bodies:world.bodies,context:{world:header}};
  }
  if(kind==="game"){
    const game=decodeHvpGame(value),{bodies:_,solver:__,...header}=game.world.checkpoint;
    return {text,bodies:game.world.bodies,context:{world:header,game:{version:game.checkpoint.version,
      profiles:game.checkpoint.profiles,signature:game.checkpoint.signature,terrain:game.checkpoint.terrain,
      receipts:game.checkpoint.receipts,view:game.checkpoint.view,progress:game.checkpoint.progress}}};
  }
  throw new Error("Unregistered legacy codec");
}
function bodyFacts(body:HvpDecodedBody){
  const {checkpoint,recipe,motion}=body;
  return {ownerId:checkpoint.ownerId,family:checkpoint.family,dynamic:checkpoint.dynamic,sleeping:checkpoint.sleeping,ccd:checkpoint.ccd,
    source:{objectId:recipe.source.objectId,objectRevision:recipe.source.objectRevision,contentHash:recipe.source.contentHash,
      frame:recipe.source.frame,materials:recipe.source.materials,cells:readHvpBodyCells(recipe.source)},mass:recipe.mass,motion};
}
function surfaceBinding(body:HvpDecodedBody,profileId:string):SurfaceBinding{
  const {ownerId,surfaces}=body.checkpoint,sourceHash=body.recipe.source.contentHash;
  if(profileId==="owner-uniform-rebuild-v1"){
    if(surfaces.some(s=>canonicalJson(s)!==canonicalJson(surfaces[0]))){throw new Error(`Unsupported heterogeneous surfaces: ${ownerId}`);}
    return {ownerId,sourceHash,kind:"owner-uniform",surface:surfaces[0]!};
  }
  return {ownerId,sourceHash,kind:"legacy-ordered-boxes",entries:body.recipe.colliders.map((box,i)=>({box,surface:surfaces[i]!}))};
}

/** Pure async transform: no native allocation, slot write, source rewrite or solver-string swap. */
export async function migrateLegacy(bytes:Uint8Array,kind:LegacyKind,collisionProfileId="owner-uniform-rebuild-v1"):Promise<Envelope>{
  const collision=collisionDefinitions.find(p=>p.id===collisionProfileId);
  if(!collision){throw new Error("Unregistered collision profile");}
  const source=sourceDefinitions[kind];if(!source){throw new Error("Unregistered source profile");}
  const copy=new Uint8Array(bytes),decoded=decodeLegacy(copy,kind),inputSha256=await sha256(copy);
  const payload={version:"phy03-world-envelope-v1" as const,worldFormatVersion:"phy03-canonical-world-v1" as const,
    sourceCodec:await reference(source),solverProfile:await reference(solver),
    collisionProfile:await reference(collision),legacy:{kind,utf8:decoded.text,sha256:inputSha256},
    canonical:{context:decoded.context,bodies:decoded.bodies.map(bodyFacts)},
    surfaceBindings:decoded.bodies.map(body=>surfaceBinding(body,collisionProfileId)),
    provenance:{sourceCommit:BASE,migration:"legacy-envelope-v1" as const,inputSha256}};
  return {...payload,digest:await hashValue(payload)};
}
export const encodeEnvelope=(value:Envelope):Uint8Array=>{
  const bytes=encoder.encode(canonicalJson(value));requireBytes(bytes);return bytes;
};
export async function decodeEnvelope(bytes:Uint8Array){
  requireBytes(bytes);const value=parseJson(decoder.decode(bytes)) as Envelope|null;
  if(!value||Object.keys(value).sort().join(",")!=="canonical,collisionProfile,digest,legacy,provenance,solverProfile,sourceCodec,surfaceBindings,version,worldFormatVersion"
    ||value.version!=="phy03-world-envelope-v1"||value.worldFormatVersion!=="phy03-canonical-world-v1"||!value.legacy||typeof value.legacy.utf8!=="string"
    ||!value.collisionProfile||!value.solverProfile||!value.sourceCodec||!value.provenance){throw new Error("Unknown or malformed envelope version/profile");}
  const {digest,...payload}=value;
  if(!/^[0-9a-f]{64}$/.test(digest)||digest!==await hashValue(payload)){throw new Error("Envelope digest mismatch");}
  const legacy=encoder.encode(value.legacy.utf8);requireBytes(legacy);
  if(value.legacy.sha256!==await sha256(legacy)){throw new Error("Legacy input digest mismatch");}
  const expected=await migrateLegacy(legacy,value.legacy.kind,value.collisionProfile.id);
  if(canonicalJson(expected)!==canonicalJson(value)){throw new Error("Unregistered profile, provenance or canonical projection/surface binding mismatch");}
  return {envelope:expected,legacy,canonical:expected.canonical};
}

/** Dual-read dispatch never interprets an unknown new format as legacy. */
export async function readSave(bytes:Uint8Array,legacyKind:LegacyKind){
  requireBytes(bytes);const header=parseJson(decoder.decode(bytes)) as {version?:unknown};
  if(header.version==="phy03-world-envelope-v1"){return decodeEnvelope(bytes);}
  const envelope=await migrateLegacy(bytes,legacyKind,"legacy-ordered-boxes-v1");
  return {envelope,legacy:new Uint8Array(bytes),canonical:envelope.canonical};
}
