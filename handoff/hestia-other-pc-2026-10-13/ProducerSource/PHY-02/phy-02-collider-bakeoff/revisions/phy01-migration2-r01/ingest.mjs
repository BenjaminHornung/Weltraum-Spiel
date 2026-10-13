import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const producer="C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-PHY-01-2026-10-09/spikes/phy-01-rapier-followup";
const delivery=producer+"/delivery",sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const controls={
  "seal.json":"cae9fc22528b2f2788b35cf64b156b35f90f86f80a6d807985534dfb7a32e92e",
  "receipt.json":"f9e0fcac716cee973636822ff62d1db95c7821f7d93ba65d54aabc9c37880ede",
  "manifest.json":"9eeb95413e0195476619ca8fbd1d97537c01da52689dac645746dede7a81c9a9",
  "dirty-tree.json":"4bf1f3ef9c0ef14863de472d8d49023123adee7ccaf34907a1230aff37fd21af"};
assert(process.cwd().replaceAll("\\","/").startsWith("C:/IFI_SourceCode/"));
const oldSeal="../../evidence/seal.json",old=fs.readFileSync(oldSeal);
assert.equal(sha(old),"693539c26589a1c2f60c4a12e79ad5b91a4d7112a8721415ab9b63fb103dea25");
for(const f of JSON.parse(old).content)assert.equal(sha(fs.readFileSync(path.resolve("../../../..",f.path))),f.sha256,"Changed old PHY02 content "+f.path);
fs.mkdirSync("producer/delivery",{recursive:true});
for(const [name,expected] of Object.entries(controls)){
  const bytes=fs.readFileSync(delivery+"/"+name);assert.equal(sha(bytes),expected,"PHY01 control mismatch "+name);
  const destination="producer/delivery/"+name;
  if(fs.existsSync(destination))assert.equal(sha(fs.readFileSync(destination)),expected);
  else fs.writeFileSync(destination,bytes,{flag:"wx"});
}
const manifest=JSON.parse(fs.readFileSync("producer/delivery/manifest.json","utf8"));
const receipt=JSON.parse(fs.readFileSync("producer/delivery/receipt.json","utf8"));
assert.equal(receipt.candidate.id,"rapier-0.21.0-phy01.migration2");assert.equal(receipt.candidate.vanillaNpmBytes,false);
const prefix="spikes/phy-01-rapier-followup/";
const explicit=new Set(["src/rapier021Candidate.ts","package-lock.json","package.json","runner-profile.json","source-manifest.json",
  "historical-populations.json","migration-patches.json","results/native-target-margin-contact-fix.receipt.json",
  "results/package-migration2.binding.json","results/runtime-c-completion.json","upstream/candidate-rust/Cargo.lock",
  "upstream/candidate-rust/Cargo.toml","upstream/parry-provenance.json","upstream/source-provenance.json"]);
const selected=manifest.files.filter(f=>f.path.startsWith(prefix)&&(
  explicit.has(f.path.slice(prefix.length))||f.path.startsWith(prefix+"upstream/candidate-package/migration2/")
  ||f.path.startsWith(prefix+"snapshot/c/src/")||f.path.startsWith(prefix+"snapshot/c/tests/unit/")
  ||f.path.startsWith(prefix+"tests/candidate-")||f.path.startsWith(prefix+"upstream/source/")
  ||f.path.startsWith(prefix+"upstream/parry3d/")||f.path.startsWith(prefix+"upstream/patches/")));
assert.equal(selected.filter(f=>f.path.startsWith(prefix+"upstream/candidate-package/migration2/")).length,99);
const files=[];
for(const entry of selected){
  const relative=entry.path.slice(prefix.length);assert(!relative.split("/").includes(".."),"Unsafe consumer path");
  const source=path.resolve(producer,relative);assert(source.replaceAll("\\","/").startsWith(producer+"/"));
  const bytes=fs.readFileSync(source);assert.equal(bytes.length,entry.bytes);assert.equal(sha(bytes),entry.sha256,"Moving/unbound PHY01 file "+relative);
  const dest="producer/"+relative;fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(fs.existsSync(dest))assert.equal(sha(fs.readFileSync(dest)),entry.sha256);else fs.writeFileSync(dest,bytes,{flag:"wx"});
  files.push({producerPath:entry.path,consumerPath:dest,bytes:bytes.length,sha256:entry.sha256});
}
for(const key of ["nativeReceipt","packageBinding","patches","fixtureAndSourceBinding","runtimeBinding","historicalBindings"]){
  const binding=receipt[key];assert(binding,"Missing "+key);const bytes=fs.readFileSync("producer/"+binding.path);
  assert.equal(bytes.length,binding.bytes);assert.equal(sha(bytes),binding.sha256,key);
}
const binding=JSON.parse(fs.readFileSync("producer/results/package-migration2.binding.json","utf8"));
for(const f of binding.files)assert.equal(sha(fs.readFileSync("producer/"+f.path)),f.sha256);
const nativeReceipt=JSON.parse(fs.readFileSync("producer/results/native-target-margin-contact-fix.receipt.json","utf8"));
for(const f of nativeReceipt.sourceDigests)assert.equal(sha(fs.readFileSync("producer/upstream/source/"+f.path)),f.sha256);
for(const f of nativeReceipt.dependencySourceDigests)assert.equal(sha(fs.readFileSync("producer/"+f.path)),f.sha256);
assert.equal(nativeReceipt.sourceDigests.length,414);assert.equal(nativeReceipt.dependencySourceDigests.length,434);
assert.equal(sha(fs.readFileSync("producer/upstream/candidate-package/migration2/rapier_wasm3d_bg.wasm")),"ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9");
const oldSources=["fixtures.ts","geometry.ts","hestiaFixtures.ts","native.ts",...fs.readdirSync("../../src/product").map(n=>"product/"+n)];
for(const f of oldSources){
  const src="../../src/"+f,dest="previous/src/"+f,bytes=fs.readFileSync(src);fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(fs.existsSync(dest))assert.equal(sha(fs.readFileSync(dest)),sha(bytes));else fs.writeFileSync(dest,bytes,{flag:"wx"});
}
const artifact={schema:"phy02.phy01-consumer.v1",candidate:receipt.candidate,controls,
  oldPhy02SealSha256:sha(old),status:"BYTE_CHECKED_COPIES_NOT_RUNTIME_PASS",productIntegration:"NO",
  files,oldSources:oldSources.map(f=>({path:"previous/src/"+f,sha256:sha(fs.readFileSync("previous/src/"+f))})),
  metadataPathsAreManifestResolved:true,sourceFork:true,vanillaSubstitution:false};
artifact.nativeSourceCount=nativeReceipt.sourceDigests.length;artifact.parrySourceCount=nativeReceipt.dependencySourceDigests.length;
if(!fs.existsSync("consumer-input-full.json"))fs.writeFileSync("consumer-input-full.json",JSON.stringify(artifact,null,2)+"\n",{flag:"wx"});
else assert.deepEqual(JSON.parse(fs.readFileSync("consumer-input-full.json","utf8")),artifact);
console.log("PASS consumer byte copy: "+files.length+" files, exact99 package, native/lock/source receipts; old PHY02 bytes preserved");
