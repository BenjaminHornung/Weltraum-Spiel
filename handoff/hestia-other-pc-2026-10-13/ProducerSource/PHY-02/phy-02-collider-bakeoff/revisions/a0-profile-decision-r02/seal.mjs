import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {root,prior,wt,sha,file,json,write,walk,scope,checkPrior} from "./bind.mjs";
const rel=p=>path.relative(wt,p).replaceAll("\\","/"),local=p=>path.relative(root,p).replaceAll("\\","/");
const terminal=new Set(["seal.json","seal.sha256"]);
const priorProof=checkPrior();
if(process.argv.includes("--check")){
  const seal=json("seal.json");assert.equal(sha(fs.readFileSync("seal.json")),fs.readFileSync("seal.sha256","utf8").trim());
  for(const f of seal.files){const p=path.resolve(wt,f.path);assert(p.startsWith(wt+path.sep));assert.equal(fs.statSync(p).size,f.bytes);assert.equal(sha(fs.readFileSync(p)),f.sha256,f.path);}
  assert.deepEqual(scope().dirty,json("DirtyIndex.json").paths);
  const actual=walk(root,new Set(["node_modules",".vite-temp"])).filter(p=>!terminal.has(local(p))).map(rel).sort();
  assert.deepEqual(actual,seal.files.filter(f=>f.path.startsWith(rel(root)+"/")).map(f=>f.path).sort());
  console.log(JSON.stringify({status:"PASS",sealSha256:sha(fs.readFileSync("seal.json")),payloads:seal.files.length,dirtyPaths:scope().dirty.length,
    priorPayloads:priorProof.payloads,priorDependencies:priorProof.dependencies,primary:"legacy-impulse-v1",gyro:"SEPARATE_POPULATION",productIntegration:"NO"}));
}else{
  assert.equal(json("review.json").result,"SUPPORTED_FINITE_PARTIAL_PROFILE_SUPPLEMENT");
  const owner=json("owner-binding.json");for(const f of [owner.decision,owner.olderConsumer]){assert.equal(fs.statSync(f.ownPath).size,f.bytes);assert.equal(sha(fs.readFileSync(f.ownPath)),f.sha256);}
  const matrix=json(path.join(prior,"matrix.json")),primary=matrix.cases.filter(c=>c.profile===owner.selectedPrimary.id),gyro=matrix.cases.filter(c=>c.profile===owner.separatePopulation);
  const counts=rows=>({total:rows.length,rawPass:rows.filter(r=>r.status==="PASS").length,rawFail:rows.filter(r=>r.status==="FAIL").length,
    acceptancePass:rows.filter(r=>r.acceptance==="PASS").length,unsupported:rows.filter(r=>r.acceptance==="UNSUPPORTED").length,notApplicable:rows.filter(r=>r.acceptance==="NOT_APPLICABLE").length});
  assert.equal(primary.length,96);assert.equal(gyro.length,96);
  const cleanup=json("runs/guarded-owner-01/f7-cleanup.json");assert.equal(cleanup.cleanup.status,"PASS");assert.equal(cleanup.primary.name,"AssertionError");
  const actualProfile=json("runs/guarded-owner-01/selected-profile.results.json"),historical=json("runs/guarded-owner-01/historical-f7-guarded.results.json");
  assert.equal(actualProfile.numPassedTests,1);assert.equal(historical.numFailedTests,1);
  for(const f of json("runs/guarded-owner-01/input-binding.json").source.filter(f=>f.path.endsWith(".test.ts")||f.path.endsWith("vitest.config.ts")))
    assert.equal(sha(fs.readFileSync(f.path)),f.sha256,"Changed executed R02 test/config input");
  const derived=json("guarded-source-binding.json");assert.equal(sha(fs.readFileSync(derived.derivedPath)),derived.derivedSha256);assert.equal(derived.numericAssertionsDeadlinesPreserved,true);
  for(const name of ["selected-profile","historical-f7-guarded"]){const capture=json("runs/guarded-owner-01/"+name+".wasm.json");assert.equal(capture.modules.length,1);
    assert.equal(capture.modules[0].sha256,"ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9");}
  const references=["matrix.json","source-index.json","receipt.json","consumer-input-full.json","consumer-input-support.json","dependencies.json","tools.json","package-lock.json",
    "runs/supplemental-05/fixtures.json","runs/full-functional-04/input-binding.json","runs/full-functional-04/exitcodes.json","runs/supplemental-05/exitcodes.json",
    "runner-rest-profile.json"].map(p=>({...file(path.join(prior,p)),path:rel(path.join(prior,p))}));
  write("source-index.json",{schema:"phy02.a0-profile-source.r02",files:walk(root,new Set(["node_modules",".vite-temp","runs"])).filter(p=>!terminal.has(local(p))).map(p=>({...file(p),path:rel(p)})),
    exactR01Closure:priorProof,references,guardedSource:file("guarded-source-binding.json"),declarationDependencies:"Sealed R01 dependencies.json; no new install or lock"});
  write("receipt.json",{schema:"phy02.a0-profile-decision.receipt.r02",status:"PARTIAL",session:"01a12002-e670-70b0-bfe4-8ffe1a688bd5",scope:scope(),productIntegration:"NO",
    primaryProfileBinding:{...owner.selectedPrimary,sourceDecision:file("inputs/PHY01_PROFILE_DECISION_R01.md"),population:counts(primary)},
    gyroSeparatePopulation:{id:owner.separatePopulation,population:counts(gyro),relabelledAsLegacy:false},
    olderA0Consumer:{...file("inputs/A0_CONSUMER_RECEIPT_R01.json"),immutableStatusPreserved:true},ownerAuthority:owner.authority,
    sourceFork:{id:"rapier-0.21.0-phy01.migration2",vanillaNpmBytes:false,packedFiles:99,nativeSource:414,parrySource:434,
      wasmSha256:"ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9",candidateOnly:true},
    previousFreezes:priorProof,fullBoundReferences:references,sourceIndex:file("source-index.json"),ownSourceDerivation:file("guarded-source-binding.json"),
    controls:{selectedPrimary:1,historicalF7:{assertion:"UNCHANGED_FAIL",cleanup:"PASS_SEPARATE_OWN_DRIVER",filtered:8,oldPopulationRewritten:false},
      commands:file("runs/guarded-owner-01/exitcodes.json"),cleanup:file("runs/guarded-owner-01/f7-cleanup.json"),
      wasm:[file("runs/guarded-owner-01/selected-profile.wasm.json"),file("runs/guarded-owner-01/historical-f7-guarded.wasm.json")]},
    ownBuild:{rebuild:false,artifact:"Exact sealed R01 built smoke/source/lock artifact",newScopedTypecheckExit:0,binding:file("final-checks.json")},
    review:file("review.json"),dirtyIndex:{path:"DirtyIndex.json",binding:"Terminal seal"},
    remainingGates:{productActivation:false,publicSaveDefaultCutover:"OPEN_ACTUAL_OWNER_HUMAN_GATE",actualPublicGameCold:"NOT_PROVEN_BY_NATIVE_SNAPSHOT",
      colliderRepresentationCasSaveS2:"OPEN_ACTUAL_OWNER_GATE",hardwareNativeGpuHvp:"NOT_RUN_NO_SLOT",nativeHeapRecovery:"NOT_PROVEN",qualifiedCosts:"NOT_RUN"},
    preservedNegatives:["R01 voxel walks/seam slides/sleeping-swap failures","Original coupled.125 step51/freeFAIL and.25 step48/freeFAIL","Original historicalF7 FAIL","Producer sleep73vs181 and non-native ACK limits"],
    humanActions:{commit:false,push:false,merge:false,publish:false,foreignChat:false}});
  const controls=["DirtyIndex.json","seal.json","seal.sha256"].map(p=>rel(path.join(root,p))),state=scope(),paths=[...new Set([...state.dirty,...controls])].sort();
  const entries=paths.map(p=>controls.includes(p)?{path:p,binding:"SELF_CONTROL_TERMINAL_SEAL"}:{...file(path.join(wt,p)),path:p});
  write("DirtyIndex.json",{schema:"phy02.current-dirty.r02",branch:state.branch,head:state.head,paths,entries,digest:sha(JSON.stringify(entries))});
  const own=walk(root,new Set(["node_modules",".vite-temp"])).filter(p=>!terminal.has(local(p)));
  const spec=path.join(wt,".devtoolbox/specs/changes/phy-02-2026-10-09/revisions/a0-profile-decision-r02/PLAN.md");own.push(spec);
  const files=own.sort().map(p=>({...file(p),path:rel(p)}));
  write("seal.json",{schema:"phy02.profile-addendum.seal.r02",status:"PARTIAL",files,priorSeal:priorProof.seal,receiptSha256:sha(fs.readFileSync("receipt.json")),
    excluded:["seal.json self digest in seal.sha256","seal.sha256 derivative","Only generated node_modules/.vite caches in own R02; all actual dependencies transitively verified in R01"],productIntegration:"NO"});
  fs.writeFileSync("seal.sha256",sha(fs.readFileSync("seal.json"))+"\n",{flag:"wx"});console.log("SEALED R02 "+sha(fs.readFileSync("seal.json"))+" payloads "+files.length+" dirty "+paths.length);
}
