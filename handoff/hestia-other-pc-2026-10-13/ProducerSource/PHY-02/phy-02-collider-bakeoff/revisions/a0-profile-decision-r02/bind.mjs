import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {sha,file,json,write,walk,scope} from "../phy01-migration2-r01/bindings.mjs";
export {sha,file,json,write,walk,scope};
export const root=path.dirname(fileURLToPath(import.meta.url)),prior=path.resolve(root,"../phy01-migration2-r01"),wt=path.resolve(root,"../../../..");
export const priorSealSha="4fcbc719c54429e750bc33d4b2051392f34c67ecc35a2c145472e1ddaa243eae";
export function checkPrior(){
  assert.equal(process.cwd(),root);scope();const sealPath=path.join(prior,"seal.json");assert.equal(sha(fs.readFileSync(sealPath)),priorSealSha);
  const seal=json(sealPath);for(const f of seal.files){const p=path.resolve(wt,f.path);assert(p.startsWith(wt+path.sep));assert.equal(fs.statSync(p).size,f.bytes);assert.equal(sha(fs.readFileSync(p)),f.sha256,f.path);}
  const dependencies=json(path.join(prior,"dependencies.json"));for(const f of dependencies.files){const p=path.resolve(prior,f.path);assert(p.startsWith(prior+path.sep));assert.equal(sha(fs.readFileSync(p)),f.sha256,f.path);}
  for(const f of json(path.join(prior,"tools.json")).ownExecutedBytes){const p=path.isAbsolute(f.path)?f.path:path.resolve(prior,f.path);assert.equal(sha(fs.readFileSync(p)),f.sha256,f.path);}
  const originalSeal=path.resolve(prior,"../../evidence/seal.json");
  assert.equal(sha(fs.readFileSync(originalSeal)),"693539c26589a1c2f60c4a12e79ad5b91a4d7112a8721415ab9b63fb103dea25");
  const original=json(originalSeal);assert.equal(original.content.length,73);
  for(const f of original.content){const p=path.resolve(wt,f.path);assert(p.startsWith(wt+path.sep));
    if(f.bytes!==undefined)assert.equal(fs.statSync(p).size,f.bytes,f.path);
    assert.equal(sha(fs.readFileSync(p)),f.sha256,"Changed original PHY02 payload "+f.path);}
  return {status:"FROZEN_PAYLOAD_PASS",seal:{...file(sealPath),sha256:priorSealSha},payloads:seal.files.length,dependencies:dependencies.files.length,originalContent:original.content.length,
    dirtyMeaning:"R01 DirtyIndex is immutable freeze provenance; this additive R02 changes current tree and has its own final index"};
}
if(process.argv.includes("--copy")){
  checkPrior();fs.mkdirSync("inputs");
  const a0="C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/A0";
  const expected=[
    {name:"PHY01_PROFILE_DECISION_R01.md",source:a0+"/PHY01_PROFILE_DECISION_R01.md",bytes:5349,sha256:"e9b191c097bf4bd2ff1366222cb47bb8c60fcb8b71be47c58c204b1084b53a51"},
    {name:"A0_CONSUMER_RECEIPT_R01.json",source:a0+"/phy01-migration2-input-r01/CONSUMER_RECEIPT.json",bytes:955855,sha256:"ea7b76f5e577550dc9dd64e4a9a0b8ddf110a06db52cdf390e14fe9b258b3afe"}
  ];
  for(const f of expected){const bytes=fs.readFileSync(f.source);assert.equal(bytes.length,f.bytes);assert.equal(sha(bytes),f.sha256);fs.writeFileSync("inputs/"+f.name,bytes,{flag:"wx"});}
  const decision=fs.readFileSync("inputs/PHY01_PROFILE_DECISION_R01.md","utf8");
  assert(decision.includes("rapier-0.21.0-phy01.migration2:legacy-impulse-v1"));assert(decision.includes("dynamicGyroscopicForces: false"));
  const admin="C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-cloud-orchestration-2026-10-09",state=json(admin+"/STATE.json");
  assert.equal(state.a0.productWriteAuthority.ownerNative,"01a120eb-c6c5-7b40-bb95-cdf703ecb5c3");
  const authority=fs.readFileSync(admin+"/handoffs/A0_OWNER_SCOPE_CLARIFICATION_R01.md");
  fs.writeFileSync("inputs/A0_OWNER_SCOPE_CLARIFICATION_R01.md",authority,{flag:"wx"});
  write("owner-binding.json",{decision:{...expected[0],ownPath:"inputs/"+expected[0].name},olderConsumer:{...expected[1],ownPath:"inputs/"+expected[1].name,
    label:"Older NOT_SELECTED_YET record is retained unchanged; later separate decision is authoritative candidate binding"},
    selectedPrimary:{id:"rapier-0.21.0-phy01.migration2:legacy-impulse-v1",dynamicGyroscopicForces:false,apply:"Every newly created dynamic body"},
    separatePopulation:"rapier-0.21.0-phy01.migration2:gyroscopic-v1",candidateOnly:true,productActivation:false,publicDefaultSaveCutover:false,
    authority:{source:file(admin+"/STATE.json"),productWriteAuthority:state.a0.productWriteAuthority,userOverrides:file(admin+"/USER_OVERRIDES_2026-10-09.md"),
      clarification:{...file("inputs/A0_OWNER_SCOPE_CLARIFICATION_R01.md"),source:admin+"/handoffs/A0_OWNER_SCOPE_CLARIFICATION_R01.md"},
      phy02:"OWN_SPIKE_SPEC_ONLY_PRODUCT_GLOBAL_READ_ONLY",hardwareNativeGpuHvpSlot:"NOT_GRANTED"}});
  console.log("PASS A0 decision5349 and older consumer955855 exact own copies; legacy primary candidate, gyro separate; prior payloads preserved");
}
