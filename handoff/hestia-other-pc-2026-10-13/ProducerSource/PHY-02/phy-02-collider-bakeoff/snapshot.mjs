import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
const base="17b1db4201a28e7b607c30707bdc2b75e3484a10";
const git="C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe";
assert.equal(execFileSync(git,["rev-parse","HEAD"],{cwd:"../..",encoding:"utf8"}).trim(),base);
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const manifest=[];
function source(path){
  const b=fs.readFileSync("../../"+path), committed=execFileSync(git,["show",base+":"+path],{cwd:"../..",maxBuffer:4*1024*1024});
  assert.equal(b.toString().replaceAll("\r\n","\n"),committed.toString().replaceAll("\r\n","\n"),"changed product source "+path);
  manifest.push({path,base,workingBytesSha256:sha(b),gitBytesSha256:sha(committed)});
  return b.toString().replaceAll("\r\n","\n");
}
const axes=source("apps/weltraum-browser/src/hestia-prototype/physics/principalAxes.ts");
const greedy=source("apps/weltraum-browser/src/voxel/structural/physicsTransition.ts");
const validation=source("apps/weltraum-browser/src/voxel/structural/validation.ts");
const mesher=source("apps/weltraum-browser/src/hvp/hvpCoastMesher.ts");
const blockAo=source("apps/weltraum-browser/src/voxel/blockAmbientOcclusion.ts");
const slice=(s,a,b)=>{assert(s.includes(a)&&s.includes(b));return s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));};
const prelude=`import {deepFreeze} from "../geometry.js";
type StructuralOwnedReserve=(bytes:number,retained?:boolean)=>void;
type QuantumBox=Readonly<{min:Readonly<{x:number;y:number;z:number}>;max:Readonly<{x:number;y:number;z:number}>}>;
const quantumKey=(x:number,y:number,z:number)=>x+":"+y+":"+z;
class StructuralValidationError extends Error {
  constructor(readonly code:string,readonly path:string,message:string){super(message);this.name="StructuralValidationError";}
}
const structuralFail=(code:string,path:string,message:string):never=>{throw new StructuralValidationError(code,path,message);};
// shortcut: no owned-budget execution in primitive slice, consume original owner API with PHY-01.
export function* structuralFreezeArraySteps<T>(values:T[],reserve?:StructuralOwnedReserve):Generator<void,readonly T[],void>{
  if(reserve!==undefined)throw new Error("Owned reserve path is not supported in this primitive snapshot");
  return deepFreeze(values);
}
`;
const generated={
  "src/product/blockAmbientOcclusion.ts":blockAo,
  "src/product/collisionMesher.ts":`import {structuralFreezeArraySteps} from "./greedy.js";
import {hvpAoDarknessFactor,hvpFaceAoSamples,hvpPackAoSignature,hvpQuadIndexPattern,hvpUnpackAoSignature,hvpVertexAo,type HvpAoFace} from "./blockAmbientOcclusion.js";
type StructuralOwnedReserve=(bytes:number,retained?:boolean)=>void;
const HVP_SLOT_KNOWN_AIR=0;
`+slice(mesher,"export const HVP_COAST_MESH_ALGORITHM_VERSION","export interface HvpTestCell"),
  "src/product/principalAxes.ts":axes.replace('import type { StructuralInertiaTensor } from "../../voxel/structural";','import type { StructuralInertiaTensor } from "../geometry.js";'),
  "src/product/greedy.ts":prelude
    +slice(validation,"export const drainStructuralSteps","/** Produced plain arrays")
    +slice(validation,"export function* structuralSortSteps","/** Only schema-owned output")
    +slice(greedy,"export const mergeGreedyQuantumBoxes","const toMetersBox")
};
fs.mkdirSync("src/product",{recursive:true});fs.mkdirSync("evidence",{recursive:true});
for(const [path,content] of Object.entries(generated)){
  if(process.argv.includes("--check"))assert.equal(fs.readFileSync(path,"utf8"),content,path);
  else fs.writeFileSync(path,content);
  manifest.push({generated:path,sha256:sha(Buffer.from(content)),adaptation:"standalone type/import/budget boundary only; original math and greedy validation/order preserved"});
}
for(const path of [
  "apps/weltraum-browser/src/hvp/hvpCoastSource.ts",
  "apps/weltraum-browser/src/hestia-prototype/physics/rigidRecipe.ts",
  "apps/weltraum-browser/src/hestia-prototype/physics/rapierPort.ts",
  "apps/weltraum-browser/src/hestia-prototype/physics/session.ts",
  "apps/weltraum-browser/src/hestia-prototype/physics/terrainColliders.ts",
  "apps/weltraum-browser/src/hestia-prototype/persistence/bodyCheckpoint.ts",
  "apps/weltraum-browser/src/hestia-prototype/physics/restoreBody.ts",
  "apps/weltraum-browser/src/hestia-prototype/persistence/worldCheckpoint.ts",
  "apps/weltraum-browser/tests/unit/hvpChunkCompiler.test.ts",
  "apps/weltraum-browser/tests/unit/structuralPgTragwerkR3.test.ts"
].filter(p=>fs.existsSync("../../"+p)))source(path);
if(!process.argv.includes("--check"))fs.writeFileSync("evidence/source-manifest.json",JSON.stringify(manifest,null,2)+"\n");
console.log("PASS source snapshot: "+manifest.length+" bindings");
