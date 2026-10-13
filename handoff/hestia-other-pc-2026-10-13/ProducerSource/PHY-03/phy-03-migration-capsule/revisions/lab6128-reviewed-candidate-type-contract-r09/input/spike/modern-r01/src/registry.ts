import binding from "../input-binding.json";
import {HVP_SOLVER_PROFILE} from "../inputs/a0/snapshot/spike/snapshot/c/src/hestia-prototype/physics/profile";
import {canonicalJson,sha256,type ProfileRef} from "../../src/capsule";
import {bindPartialEvidence} from "./partialEvidence";
import {canonicalCloneAndDeepFreeze} from "../../snapshot/src/core/hash";

export type InputReader=(path:string)=>Promise<Uint8Array>;
const issued=new WeakSet<object>();
const selected=new WeakSet<object>();
const packageRoot="inputs/a0/snapshot/spike/upstream/candidate-package/migration2/";
const decoder=new TextDecoder("utf-8",{fatal:true}),encoder=new TextEncoder();
const hashValue=(v:unknown)=>sha256(encoder.encode(canonicalJson(v)));
declare const admitted:unique symbol;
export interface VerifiedSolver {
  readonly [admitted]:true;
  readonly profile:Readonly<typeof HVP_SOLVER_PROFILE>;
  readonly reference:ProfileRef;
  readonly package:Readonly<{name:string;version:string}>;
  readonly source:Readonly<{id:string;npmBaseVersion:string;vanillaNpmBytes:false;upstreamRevision:string;nativeSourceDigest:string;cargoLockSha256:string;wasmSha256:string}>;
  readonly inputIndexSha256:string;
  readonly ownerDecisionSha256:string;
  readonly partialEvidence:Awaited<ReturnType<typeof bindPartialEvidence>>;
}

/** Checks copied bytes, never producer imports or native initialization. */
export async function admitActualInputs(read:InputReader):Promise<VerifiedSolver>{
  if(await sha256(encoder.encode(JSON.stringify(binding.files)))!==binding.inputIndexSha256)throw new Error("Input index mismatch");
  const selected=new Map<string,Uint8Array>();
  for(const row of binding.files){
    const bytes=new Uint8Array(await read(row.path));
    if(bytes.length!==row.bytes||await sha256(bytes)!==row.sha256)throw new Error("Actual input bytes mismatch: "+row.path);
    if([packageRoot+"package.json",packageRoot+"profile.json",packageRoot+"rapier_wasm3d_bg.wasm","inputs/PHY01_PROFILE_DECISION_R01.md"].includes(row.path))selected.set(row.path,bytes);
  }
  const pkg=JSON.parse(decoder.decode(selected.get(packageRoot+"package.json")));
  const source=JSON.parse(decoder.decode(selected.get(packageRoot+"profile.json")));
  const owner=selected.get("inputs/PHY01_PROFILE_DECISION_R01.md")!;
  if(pkg.name!=="@hestia/rapier3d-phy01-candidate"||pkg.version!=="0.21.0-phy01.migration2"
    ||source.id!==HVP_SOLVER_PROFILE.sourceProfile||source.npmBaseVersion!=="0.21.0"||source.vanillaNpmBytes!==false
    ||source.wasmSha256!==await sha256(selected.get(packageRoot+"rapier_wasm3d_bg.wasm")!)
    ||HVP_SOLVER_PROFILE.dynamicGyroscopicForces!==false||!decoder.decode(owner).includes(HVP_SOLVER_PROFILE.id)
    ||await sha256(owner)!=="e9b191c097bf4bd2ff1366222cb47bb8c60fcb8b71be47c58c204b1084b53a51")throw new Error("Actual candidate/owner profile mismatch");
  const profile=Object.freeze({...HVP_SOLVER_PROFILE});
  const partialEvidence=await bindPartialEvidence(read,profile.id);
  const payload={profile,package:Object.freeze({name:pkg.name,version:pkg.version}),source:Object.freeze({
    id:source.id,npmBaseVersion:source.npmBaseVersion,vanillaNpmBytes:false as const,upstreamRevision:source.upstreamRevision,
    nativeSourceDigest:source.nativeSourceDigest,cargoLockSha256:source.cargoLockSha256,wasmSha256:source.wasmSha256}),
    inputIndexSha256:binding.inputIndexSha256,ownerDecisionSha256:await sha256(owner),partialEvidence};
  const proof=canonicalCloneAndDeepFreeze({...payload,reference:{id:profile.id,digest:await hashValue(payload)}}) as VerifiedSolver;
  issued.add(proof);return proof;
}

/** No default activation; caller must name the actual verified owner choice. */
export function selectSolver(proof:VerifiedSolver,explicitProfileId:string):VerifiedSolver{
  if(!issued.has(proof)||explicitProfileId!==proof.profile.id)throw new Error("Unregistered or unselected solver profile");
  selected.add(proof);
  return proof;
}
export function requireSolver(proof:VerifiedSolver):void{
  if(!selected.has(proof))throw new Error("Explicit verified solver choice required");
}
