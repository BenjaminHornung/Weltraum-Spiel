import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
const base="17b1db4201a28e7b607c30707bdc2b75e3484a10",branch="feature/phy-02-2026-10-09";
const git="C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe";
const root=path.resolve("../.."),spike="spikes/phy-02-collider-bakeoff",spec=".devtoolbox/specs/changes/phy-02-2026-10-09";
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const gitRun=args=>execFileSync(git,args,{cwd:root,encoding:"utf8",maxBuffer:16*1024*1024}).trim();
assert.equal(gitRun(["rev-parse","HEAD"]),base);assert.equal(gitRun(["branch","--show-current"]),branch);
assert.equal(process.version,"v22.23.2");assert(process.execPath.replaceAll("\\","/").startsWith("C:/IFI_SourceCode/"));
const excluded=new Set([spike+"/evidence/seal.json"]);
function walk(d){
  return fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>{
    if(["node_modules","dist",".npm-cache"].includes(e.name))return [];
    const p=d+"/"+e.name;return e.isDirectory()?walk(p):[p];
  });
}
function dirtyRows(){
  const entries=gitRun(["status","--porcelain=v1","-z","-uall"]).split("\0").filter(Boolean);
  const files=entries.map(line=>{assert(!/[RC]/.test(line.slice(0,2)),"Rename/copy not supported");return line.slice(3);});
  for(const p of files)assert(p.startsWith(spike+"/")||p.startsWith(spec+"/"),"Forbidden changed path "+p);
  return [...new Set(files)].filter(p=>!excluded.has(p)).sort().map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(root,p)))}));
}
function contentRows(){
  return [...walk(spike),...walk(spec)].filter(p=>!excluded.has(p)).sort().map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(root,p)))}));
}
function dependencyRows(d){
  return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{
    const p=d+"/"+e.name;
    if(e.isSymbolicLink())return [];
    return e.isDirectory()?dependencyRows(p):[{path:p,sha256:sha(fs.readFileSync(p))}];
  }).sort((a,b)=>a.path.localeCompare(b.path));
}
function checkV1(){
  const p="handoffs/c-seam-2026-10-09-v1",b=fs.readFileSync(p+"/receipt.json");
  assert.equal(sha(b),"34e5050d46cd80f1923356a845a11d8dae12eebc3844ed343e277f49c3979e4c");
  const r=JSON.parse(b);
  for(const f of r.files)assert.equal(sha(fs.readFileSync(p+"/"+f.path)),f.sha256);
  assert.equal(sha(fs.readFileSync(p+"/source-dirty-binding.json")),r.sourceBindingSha256);
  for(const f of r.dependencies)assert.equal(sha(fs.readFileSync(f.path)),f.sha256);
}
checkV1();
if(process.argv.includes("--check")){
  const sealed=JSON.parse(fs.readFileSync("evidence/seal.json","utf8"));
  assert.deepEqual(dirtyRows(),sealed.dirty);assert.deepEqual(contentRows(),sealed.content);
  for(const f of sealed.dependencies)assert.equal(sha(fs.readFileSync(f.path)),f.sha256);
  assert.equal(sha(fs.readFileSync(process.execPath)),sealed.node.sha256);
  for(const f of sealed.compiled)assert.equal(sha(fs.readFileSync(f.path)),f.sha256);
  console.log("PASS final seal, complete scope delta, content, runtime/compiler/dependency bytes and immutable V1");process.exit(0);
}
assert(!fs.existsSync("evidence/seal.json"),"Final seal already exists; do not overwrite");
const run="evidence/runs/final-functional-03";
const exits=JSON.parse(fs.readFileSync(run+"/exitcodes.json","utf8")),tap=fs.readFileSync(run+"/tests.log","utf8");
assert.equal(exits.find(e=>e.name==="build").exitCode,0);assert.equal(exits.find(e=>e.name==="snapshot").exitCode,0);
assert.equal(exits.find(e=>e.name==="repro").exitCode,0);assert.equal(exits.find(e=>e.name==="tests").exitCode,1);
assert.equal(exits.find(e=>e.name==="seam-probe").exitCode,1);
const total=Number(tap.match(/^# tests (\d+)$/m)?.[1]),pass=Number(tap.match(/^# pass (\d+)$/m)?.[1]),fail=Number(tap.match(/^# fail (\d+)$/m)?.[1]);
assert.equal(fail,1);assert.equal(total,pass+fail);assert(tap.includes("native coupled XYZ seam contacts"));
const bound=JSON.parse(fs.readFileSync(run+"/input-binding.json","utf8"));
for(const f of bound.inputs)assert.equal(sha(fs.readFileSync(f.path)),f.sha256,"Changed test input "+f.path);
const node={path:process.execPath,version:process.version,sha256:sha(fs.readFileSync(process.execPath))};
const profile={schemaVersion:1,cwd:process.cwd(),node,git:{path:git,version:gitRun(["--version"])},
  inputBindings:run+"/input-binding.json",commands:[
    {command:node.path+" verify.mjs <new-run-id>",expectedExitCode:1,outputs:"evidence/runs/<new-run-id>/exitcodes.json, tests.log, diagnostics.json, seam-probe.json"},
    {command:node.path+" handoffs/c-seam-2026-10-09-v1/repro.mjs",expectedExitCode:1,outputs:"stdout JSON; seven slideOracle FAIL; distinguish 90-step completion from native trap and cleanup failure"},
    {command:node.path+" seal.mjs --check",expectedExitCode:0,outputs:"read-only seal check"}],
  parameterProfiles:[.125,.25],modeArguments:["--mode=A","--mode=B","--mode=C","--mode=all"],
  classification:"LOCAL_WINDOWS_ISOLATED_FUNCTIONAL_DIAGNOSTIC",actualAdapter:"CPU_WASM_NO_GPU",
  expectations:{snapshot:0,build:0,tests:1,diagnostics:0,seamProbe:1,qualifiedReference:"NOT_RUN",productIntegration:"NO"},
  v1ReceiptSha256:"34e5050d46cd80f1923356a845a11d8dae12eebc3844ed343e277f49c3979e4c"};
fs.writeFileSync("run-profile.json",JSON.stringify(profile,null,2)+"\n");
const diag=JSON.parse(fs.readFileSync(run+"/diagnostics.json","utf8"));assert.equal(diag.rows.length,70);
const api=JSON.parse(fs.readFileSync("evidence/api-control.json","utf8"));assert(api.every(a=>a.useTimeWasm.some(w=>w.sha256===a.wasmSha256)));
const lock=JSON.parse(fs.readFileSync("package-lock.json","utf8"));
const receipt={schemaVersion:1,task:"PHY-02",implementation:"PARTIAL",codeOracleVerification:"FAIL",basicGeometryMassStaging:"PASS",
  executionLocation:"LOCAL_WINDOWS_ISOLATED",environmentProof:"FUNCTIONAL_DIAGNOSTIC_CONCURRENT_LOAD",recommendation:"NO_ADOPTION_FOR_OBSERVED_NATIVE_SEAM_WORKLOAD",
  productIntegration:"NO",base,branch,node,build:"PASS",tests:{total,pass,fail,failedTest:"native coupled XYZ seam contacts stay flat during sliding and changed-neighbor contacts invalidate"},
  rawExits:exits,diagnosticRows:diag.rows.length,apiAndUseTimeWasm:api,
  lockSha256:sha(fs.readFileSync("package-lock.json")),sourceManifestSha256:sha(fs.readFileSync("evidence/source-manifest.json")),
  runInputSha256:sha(fs.readFileSync(run+"/input-binding.json")),runProfileSha256:sha(fs.readFileSync("run-profile.json")),
  registryIntegrities:Object.entries(lock.packages).filter(([p])=>p.includes("rapier0")).map(([p,v])=>({path:p,version:v.version,integrity:v.integrity,license:v.license})),
  shader:"NOT_APPLICABLE_NO_RENDER_CODE",compilerAndAllDependencyBytes:"evidence/seal.json",
  hardware:"NOT_RUN_NO_A0_SLOT",phy01:"NOT_FROZEN_NOT_CONSUMED",fullHvpMatrix:"NOT_RUN_PHY01_PENDING",
  actualRockArmGameplay:"NOT_RUN_SOURCE_ROOF_REPLAY_ONLY",actualMovingCommand:"NOT_RUN_LITERAL_MOVING_PRIMITIVE_ONLY",
  historicalProductAssertions:"SOURCE_BOUND_UNCHANGED_NOT_RERUN",devtoolbox:{spec:"PASS",verify:"FAIL_PRODUCT_DEPENDENCIES_ABSENT",executionId:"b5fe1e67150a4ecbb9e3b5d05e3faac1"},
  review:"READ_ONLY_REVIEW_FOUND_AND_CORRECTED_THREE_CODE_ERRORS_PLUS_TEST_SIGN_AND_POSE_NEGATIVE",
  commit:"NOT_PERFORMED",push:"NOT_PERFORMED",humanPlannotator:"NOT_REQUESTED_NO_COMMIT",v1ReceiptSha256:profile.v1ReceiptSha256,
  finalSeal:"evidence/seal.json",sealNote:"Detached final manifest hashes this receipt and all scope content; manifest excludes only its own self bytes."};
fs.writeFileSync("receipt.json",JSON.stringify(receipt,null,2)+"\n");
// Review carrier excludes itself and the final detached manifest; all payload source/evidence files are included.
const reviewPaths=contentRows().filter(f=>!f.path.endsWith("/evidence/review.diff"));
let diff="";
for(const f of reviewPaths){
  const b=fs.readFileSync(path.join(root,f.path),"utf8").replaceAll("\r\n","\n"),lines=b.replace(/\n$/,"").split("\n");
  diff+="diff --git a/"+f.path+" b/"+f.path+"\nnew file mode 100644\n--- /dev/null\n+++ b/"+f.path+"\n@@ -0,0 +1,"+lines.length+" @@\n"
    +lines.map(l=>"+"+l).join("\n")+"\n";
}
fs.writeFileSync("evidence/review.diff",diff);
const dirty=dirtyRows(),baselineTree=gitRun(["rev-parse",base+"^{tree}"]);
const content=contentRows(),dependencies=dependencyRows("node_modules"),compiled=dependencyRows("dist");
const sealed={schemaVersion:1,base,branch,baselineTree,node,
  dirtyTreeDigest:sha(Buffer.from(JSON.stringify({baselineTree,dirty}))),dirty,
  meaning:"Fixed Git base tree plus complete current Git dirty delta, including staged/unstaged/untracked. Local ignored evidence and source content, all installed dependency bytes and compiled bytes are separately complete. Only detached seal self excluded.",
  contentDigest:sha(Buffer.from(JSON.stringify(content))),content,dependencies,compiled,
  reviewDiff:{path:"evidence/review.diff",sha256:sha(fs.readFileSync("evidence/review.diff")),excludedCarrier:["review.diff itself","detached seal.json"]}};
fs.writeFileSync("evidence/seal.json",JSON.stringify(sealed,null,2)+"\n");
console.log("SEALED PARTIAL: "+pass+"/"+total+" pass; mandatory seam FAIL\nseal SHA256 "+sha(fs.readFileSync("evidence/seal.json"))+"\nNode SHA256 "+node.sha256);
