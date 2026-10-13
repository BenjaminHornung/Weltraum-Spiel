import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {root,wt,git,sha,file,json,write,walk,scope,verifyCopies} from "./bindings.mjs";
assert.equal(process.cwd(),root);
const relative=p=>path.relative(wt,p).replaceAll("\\","/");
const revision=p=>path.relative(root,p).replaceAll("\\","/");
const terminal=new Set(["seal.json","seal.sha256"]);
const deps=()=>walk(path.join(root,"node_modules"),new Set([".vite",".vite-temp",".cache"])).map(p=>({...file(p),path:revision(p)}));
if(process.argv.includes("--check")){
  const seal=json("seal.json"),state=scope();assert.equal(sha(fs.readFileSync("seal.json")),fs.readFileSync("seal.sha256","utf8").trim());
  for(const f of seal.files){const p=path.resolve(wt,f.path);assert(p.startsWith(wt+path.sep));assert.equal(fs.statSync(p).size,f.bytes,f.path);assert.equal(sha(fs.readFileSync(p)),f.sha256,f.path);}
  const installed=json("dependencies.json");for(const f of installed.files){const p=path.resolve(root,f.path);assert(p.startsWith(root+path.sep));assert.equal(fs.statSync(p).size,f.bytes,f.path);assert.equal(sha(fs.readFileSync(p)),f.sha256,f.path);}
  for(const tool of json("tools.json").ownExecutedBytes)assert.equal(sha(fs.readFileSync(tool.path)),tool.sha256,tool.path);
  assert.deepEqual(state.dirty,json("DirtyIndex.json").paths);
  const actual=walk(root,new Set(["node_modules",".npm-cache"])).filter(p=>!terminal.has(revision(p))).map(relative);
  const sealed=seal.files.filter(f=>f.path.startsWith(relative(root)+"/")).map(f=>f.path);
  assert.deepEqual(actual.sort(),sealed.sort(),"Extra/missing revision payload after seal");
  assert.equal(deps().length,installed.files.length,"Installed dependency file count changed");
  const copies=verifyCopies();console.log(JSON.stringify({status:"PASS",sealSha256:sha(fs.readFileSync("seal.json")),payloads:seal.files.length,
    dirtyPaths:state.dirty.length,dependencies:installed.files.length,oldContent:copies.oldContentCount,producerCopies:copies.consumerFiles+copies.supplemental.length,productIntegration:"NO"}));
}else{
  const copies=verifyCopies(),state=scope(),matrix=json("matrix.json");assert.equal(matrix.cases.length,192);
  assert.equal(json("review-r02.json").result,"SUPPORTED_FINITE_PARTIAL_HANDOFF");
  const npm11="C:\\IFI_SourceCode\\Utils\\opencode-migration\\runtime\\node26\\node_modules\\npm\\bin\\npm-cli.js";
  const npm10="C:\\IFI_SourceCode\\Utils\\npm-tmp\\opencode\\node-v22.23.2-win-x64\\node_modules\\npm\\bin\\npm-cli.js";
  const ownExecutedBytes=[file(process.execPath),file(git),file(npm11),file(npm10),file("node_modules/typescript/bin/tsc"),file("node_modules/vite/bin/vite.js"),file("node_modules/vitest/vitest.mjs")];
  write("tools.json",{ownExecutedBytes,nodeVersion:process.version,successfulNpmVersion:"11.13.0",initialFailedNpmVersion:"10.9.8",
    successfulInstall:{args:["install","--ignore-scripts","--no-audit","--no-fund","--fetch-retries=0","--update-notifier=false","--workspaces=false","--cache",".npm-cache"],exitCode:0},
    failedInstall:{exitCode:1,cause:"Arborist loadPeerSet Cannot read properties of null (reading edgesOut)"},
    installationLogs:walk(path.join(root,".npm-cache/_logs")).map(p=>({...file(p),path:revision(p)})),
    nativeTools:{ownRuns:0,status:"NOT_EXECUTED_NO_NATIVE_PILOT_SLOT",inheritedReceipt:file("producer/results/native-target-margin-contact-fix.receipt.json"),
      profile:file("producer/upstream/native-toolchain-0.2.129.json"),profileMeaning:"Producer-declared native toolchain metadata, digest checked copy; binaries not executed or independently rebuilt here"},
    hardwareGpuHvpPilots:"NOT_RUN_NO_EXPLICIT_A0_RUNNER_SLOT"});
  const installed=deps();write("dependencies.json",{schema:"phy02.installed-bytes.r01",excludedGeneratedCaches:[".vite",".vite-temp",".cache"],files:installed,digest:sha(JSON.stringify(installed))});
  const sources=walk(root,new Set(["node_modules",".npm-cache","runs"])).filter(p=>!terminal.has(revision(p))&&!/^(source-index|receipt|DirtyIndex)\.json$/.test(revision(p)))
    .map(p=>({...file(p),path:relative(p)}));
  write("source-index.json",{schema:"phy02.source-index.r01",candidate:copies.candidate,files:sources,
    fixtureInputs:file("runs/supplemental-05/fixtures.json"),oldSourceCopies:copies.oldSources,
    nativeSourceCount:414,parrySourceCount:434,packageFiles:99,compiledArtifacts:walk(path.join(root,"runs/full-functional-04/dist")).map(p=>({...file(p),path:relative(p)}))});
  write("receipt.json",{schema:"phy02.followup.receipt.r01",status:"PARTIAL",technicalWork:"FINITE_INDEPENDENT_FUNCTIONAL_MATRIX_FINISHED_WITH_RETAINED_FAILURES",
    session:"01a12002-e670-70b0-bfe4-8ffe1a688bd5",executionLocation:"LOCAL_WINDOWS_ISOLATED",scope:{root:wt,branch:state.branch,head:state.head,
      allowed:["spikes/phy-02-collider-bakeoff/**",".devtoolbox/specs/changes/phy-02-2026-10-09/**"]},
    productIntegration:"NO",productOwner:{native:"01a120eb-c6c5-7b40-bb95-cdf703ecb5c3",paseo:"37dddeb2-1688-47cc-af00-b03edd394215"},
    copies,sourceIndex:file("source-index.json"),lock:file("package-lock.json"),tools:file("tools.json"),dependencies:file("dependencies.json"),
    fixtures:file("runs/supplemental-05/fixtures.json"),matrix:file("matrix.json"),raw:matrix.raw,acceptance:matrix.acceptance,
    dirtyIndex:{path:relative(path.join(root,"DirtyIndex.json")),binding:"Terminal seal binds full final dirty inventory; self-control circular hashes explicitly excluded"},
    profiles:["rapier-0.21.0-phy01.migration2:legacy-impulse-v1","rapier-0.21.0-phy01.migration2:gyroscopic-v1"],
    ownBuild:{typecheckExit:0,buildExit:0,builtSmokeExit:0,fullRunExit:1,commandIndex:file("runs/full-functional-04/exitcodes.json"),executedRuntimeTestInputsUnchangedAfterFull04:true},
    supplemental:{runExit:1,positiveExit:0,historicalF7Exit:1,fixtureBindingExit:0,commandIndex:file("runs/supplemental-05/exitcodes.json")},
    sourceControls:matrix.sources,preflight:{binding:file("preflight.json"),status:"BLOCKED_NESTED_TASK_LINK_MISSING",checkboxesClosed:false,specValidation:"PASS"},
    review:{first:file("review-r01.json"),final:file("review-r02.json")},externalGates:file("runner-rest-profile.json"),
    gates:{hardwareReference:"NOT_RUN_NO_SLOT",completeHvpColdRockArmMoving:"BLOCKED_MISSING_EXACT_INPUT_AND_SLOT",publicSaveCutover:"NOT_RUN_A0_PHY03_POLICY",nativeHeapRecovery:"NOT_PROVEN"},
    previousReceipt:file(path.resolve(root,"../../receipt.json")),previousV1Receipt:file(path.resolve(root,"../../handoffs/c-seam-2026-10-09-v1/receipt.json")),
    humanApproval:{plannotator:"NOT_REQUESTED_NO_COMMIT_OR_PUSH",commit:false,push:false,merge:false,publish:false},
    limits:"Timings diagnostic, no reference performance winner; raw PASS guard or rejection does not mean representation/public-save acceptance"});
  const controls=["DirtyIndex.json","seal.json","seal.sha256"].map(p=>relative(path.join(root,p)));
  const paths=[...new Set([...scope().dirty,...controls])].sort();
  write("DirtyIndex.json",{schema:"phy02.dirty-tree.r01",branch:state.branch,head:state.head,paths,
    entries:paths.map(p=>controls.includes(p)?{path:p,binding:"SELF_CONTROL_TERMINAL_SEAL"}:{...file(path.join(wt,p)),path:p}),
    digest:sha(JSON.stringify(paths.map(p=>controls.includes(p)?{path:p,binding:"SELF_CONTROL_TERMINAL_SEAL"}:{path:p,sha256:sha(fs.readFileSync(path.join(wt,p)))}))),
    reason:"Complete final Git-visible dirty paths; ignored raw logs/build artifacts are additionally bound as payloads in terminal seal"});
  const payloads=walk(root,new Set(["node_modules",".npm-cache"])).filter(p=>!terminal.has(revision(p)));
  for(const p of state.dirty.filter(p=>p.startsWith(".devtoolbox/specs/changes/phy-02-2026-10-09/")))payloads.push(path.join(wt,p));
  const files=[...new Set(payloads)].sort().map(p=>({...file(p),path:relative(p)}));
  write("seal.json",{schema:"phy02.immutable-followup-seal.r01",status:"PARTIAL",branch:state.branch,head:state.head,files,
    priorSealSha256:copies.oldSealSha256,sourceIndexSha256:sha(fs.readFileSync("source-index.json")),receiptSha256:sha(fs.readFileSync("receipt.json")),
    dependenciesSha256:sha(fs.readFileSync("dependencies.json")),excludedControls:["seal.json self digest in seal.sha256","seal.sha256 derivative","generated dependency caches and npm download cache; install log byte hashes in tools.json"],
    productIntegration:"NO",referenceHardware:"NOT_RUN",publicSavePolicyOwner:"A0"});
  fs.writeFileSync("seal.sha256",sha(fs.readFileSync("seal.json"))+"\n",{flag:"wx"});
  console.log("SEALED "+sha(fs.readFileSync("seal.json"))+" payloads "+files.length+" dirty "+paths.length+" deps "+installed.length);
}
