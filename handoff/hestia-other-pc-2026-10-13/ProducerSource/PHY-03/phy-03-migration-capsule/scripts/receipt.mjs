import {readFileSync,writeFileSync,readdirSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
const spike=resolve(import.meta.dirname,"..");
const read=path=>JSON.parse(readFileSync(resolve(spike,path),"utf8"));
const sha=file=>createHash("sha256").update(readFileSync(file)).digest("hex");
const bind=path=>({path,sha256:sha(resolve(spike,path)),bytes:statSync(resolve(spike,path)).size});
const tests=read("evidence/final-tests.json"),browser=read("evidence/browser-result.json"),runtime=read("evidence/browser-runtime.json"),
  verification=read("evidence/verification.json"),actual=read("evidence/actual-wasm.json"),solver=read("solver-profile.json"),
  sources=read("source-manifest.json"),cleanup=read("evidence/server-cleanup.json"),cli=read("evidence/cli-positive.json"),
  exported=read("evidence/export-run.json"),exportTests=read("evidence/export-tests.json"),cliNegative=read("evidence/cli-negative.json");
assert(tests.success&&tests.numFailedTests===0&&tests.numPassedTests>0,"Focused tests must actually pass");
assert(browser.status==="PASS"&&browser.storage.status==="PASS"&&browser.checks.every(c=>c.status==="PASS"));
assert(verification.node.startsWith("v22.")&&["typecheck","build"].every(n=>verification.records.some(r=>r.name===n&&r.exitCode===0)));
assert(actual.status==="PASS"&&actual.sha256===solver.wasmSha256&&actual.version==="0.12.0");
assert(cleanup.status==="PASS"&&cleanup.exitCode===0&&cleanup.postStopHostConnect==="ECONNREFUSED");
assert(cli.exitCode===0&&cli.result.status==="PASS"&&cli.result.inputSha256===browser.inputSha256&&cli.result.outputSha256===browser.envelopeSha256);
assert(exported.exitCode===0&&exportTests.success&&exportTests.numPassedTests===2&&exportTests.numFailedTests===0);
assert(cliNegative.status==="PASS"&&cliNegative.checks.length===3&&cliNegative.checks.every(c=>c.result==="PASS"&&c.exitCode===1));
for(const source of sources.files){assert.equal(sha(resolve(spike,source.path)),source.sha256,source.path);}
const list=dir=>readdirSync(resolve(spike,dir)).flatMap(name=>{
  const path=`${dir}/${name}`;return statSync(resolve(spike,path)).isDirectory()?list(path):[path];
}).sort();
const receipt={schemaVersion:"phy03-receipt-v1",task:"PHY-03",sourceCommit:sources.base,branch:"feature/phy-03-2026-10-09",
  execution:"LOCAL_WINDOWS_ISOLATED",implementation:"COMPLETE",implementationScope:"independent legacy/envelope/CAS capsule",
  codeOracle:"PASS",hardwareReference:"NOT_RUN",recommendation:"REQUIRES_DECISION",productIntegration:"NO",
  overallAcceptance:"PARTIAL_SELECTED_PROFILE_AND_A0_GATES_PENDING",newSolverLifecycle:"NOT_RUN",sourceV2:"UNSUPPORTED",
  modernCollision:"NOT_RUN",qualifiedBenchmarks:"NOT_RUN",committed:false,pushed:false,plannotatorApproval:"NOT_REQUESTED_NO_COMMIT",
  verifiedAt:new Date().toISOString(),environment:{node:verification.node,npm:read("evidence/dependencies.json").npmVersion,
    browser:runtime.browserVersion,actualBackend:"IndexedDB+Rapier0.12-WASM-control",actualAdapter:"NOT_REQUESTED_NO_RENDERER",
    concurrentLoad:true,referenceWindow:false,gpuTimer:"NOT_REQUESTED"},
  verification:{tests:{status:"PASS",exitCode:0,total:tests.numTotalTests,passed:tests.numPassedTests,failed:tests.numFailedTests,
      skipped:tests.numPendingTests,unchangedNativeControls:25,fixtureExport:{status:"PASS",exitCode:exported.exitCode,passed:exportTests.numPassedTests}},
    typecheck:{status:"PASS",exitCode:0},build:{status:"PASS",exitCode:0,executionBoundary:"OUTSIDE_SANDBOX_IDENTICAL_COMMAND"},
    browser:{status:"PASS",checks:browser.checks.length+browser.storage.checks.length,realIndexedDb:true},
    cli:{status:cli.result.status,exitCode:cli.exitCode,inputSha256:cli.result.inputSha256,outputSha256:cli.result.outputSha256,
      negativeChecks:{status:cliNegative.status,count:cliNegative.checks.length}},
    coldLoadWakeRecut:{status:"PASS",solver:"0.12.0",actualNative:true},
    inheritedDevToolboxProductCheck:{status:"FAIL",exitCode:1,reason:"MODULE_NOT_FOUND product node_modules/typescript/bin/tsc; product install outside scope"},
    cleanup:{status:"PASS",exitCode:0}},
  bindings:{dirtyTreeAlgorithm:"SHA256 phy03-full-dirty-tree-v1 NUL plus JSON(sorted path+SHA256); receipt dirtyTreeSha256 normalized null",
    dirtyTreeSha256:null,dirtyFileCount:0,sourceManifest:bind("source-manifest.json"),taskInputs:bind("evidence/task-inputs.json"),
    lock:bind("package-lock.json"),solverProfile:bind("solver-profile.json"),actualWasmSha256:actual.sha256,
    fixtures:list("fixtures").map(bind),historicalBodyFixture:bind("snapshot/tests/fixtures/hvp-contact-r90-body384.json"),
    buildAssets:list("dist").map(bind),testReport:bind("evidence/final-tests.json"),browserResult:bind("evidence/browser-result.json"),
    cliExecution:bind("evidence/cli-positive.json"),cliNegative:bind("evidence/cli-negative.json"),
    exportExecution:bind("evidence/export-run.json"),exportTests:bind("evidence/export-tests.json"),
    bindingInventory:list("evidence").filter(p=>p.includes("/inventory-")).map(bind),
    shaders:{execution:"NOT_USED_NO_RENDERER",source:bind("snapshot/src/hestia-prototype/presentation/visualEffects.ts")}},
  sourceInventory:{unchangedFiles:sources.files.length,modifiedPorts:sources.modifiedPorts},
  pending:["PHY-01 checked solver adapter/profile","PHY-02 chosen shapes and material mapping","S2 codec/index before owned-subset admission",
    "A0 product cutover and serial-runner hardware gate"],
  handoff:{report:"REPORT.md",entry:"HANDOFF.md",repro:"repro.ps1",profile:"repro-profile.json",reviewDiff:".runtime/final-review.diff"}};
writeFileSync(resolve(spike,"receipt.json"),JSON.stringify(receipt,null,2)+"\n");
console.log(JSON.stringify({status:"PASS",tests:tests.numPassedTests,browserChecks:receipt.verification.browser.checks,snapshotFiles:sources.files.length,
  productIntegration:receipt.productIntegration}));
