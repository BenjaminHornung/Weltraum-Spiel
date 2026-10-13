import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const [mode, label = "final"] = process.argv.slice(2);
assert.ok(["create", "verify"].includes(mode)); assert.match(label, /^[a-z0-9-]{1,40}$/);
const spike = resolve("."), repo = resolve("../.."), prefix = "spikes/phy-01-rapier-followup/";
assert.equal(relative(repo, spike).replaceAll("\\", "/") + "/", prefix);
assert.equal(process.version, "v22.23.2");
const output = label === "final" ? "delivery" : "delivery/" + label;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const hash = path => sha(readFileSync(path));
const json = path => JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
const emit = (path, value, flag = "wx") => writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { flag });
const norm = path => path.replaceAll("\\", "/");
function file(path) { const data = readFileSync(path); return { path: norm(path), bytes: data.length, sha256: sha(data) }; }
function walk(path, skipped = new Set()) {
  const result = [];
  for (const item of readdirSync(path, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name))) {
    if (skipped.has(item.name)) { continue; }
    const next = resolve(path, item.name);
    if (item.isDirectory()) { result.push(...walk(next, skipped)); }
    else { result.push(next); }
  }
  return result;
}
const git = "C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe";
function gitRead(...args) {
  const result = spawnSync(git, ["--no-optional-locks", ...args], { cwd: repo, encoding: "utf8", windowsHide: true,
    maxBuffer: 32 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
  assert.equal(result.status, 0, result.stderr); return result.stdout;
}
const controls = ["dirty-tree.json", "manifest.json", "seal.json", "seal-check.json"].map(p=>prefix+output+"/"+p);
function readStatus() {
  return gitRead("status", "--porcelain=v1", "-z", "--untracked-files=all").split("\0").filter(Boolean)
    .map(row => { assert.ok(!row.slice(0,2).includes("R"), "Unexpected rename"); return { status: row.slice(0,2), path: norm(row.slice(3)) }; });
}
if (mode === "verify") {
  const seal = json(output + "/seal.json"), manifest = json(output + "/manifest.json");
  assert.equal(hash(output+"/manifest.json"), seal.manifestSha256);
  assert.equal(hash(output+"/dirty-tree.json"), seal.dirtyTreeSha256);
  assert.equal(hash(output+"/receipt.json"), seal.receiptSha256);
  assert.equal(hash("scripts/seal-delivery.mjs"), seal.generatorSha256);
  for (const row of manifest.files) { assert.equal(hash(row.absolutePath), row.sha256, row.path); }
  const dirty = json(output+"/dirty-tree.json");
  assert.equal(gitRead("rev-parse", "HEAD").trim(), seal.head);
  assert.equal(gitRead("branch", "--show-current").trim(), seal.branch);
  assert.equal(hash(dirty.index.absolutePath), dirty.index.sha256);
  assert.deepEqual(readStatus(), dirty.status, "Complete dirty/index paths changed after sealing");
  const result = { status: "PASS", checkedAt: new Date().toISOString(), sealSha256: hash(output+"/seal.json"),
    filesVerified: manifest.files.length, completeDirtyPaths: dirty.status.length,
    sourceProfile: seal.sourceProfile, productAccepted: false };
  // Only this excluded verification control is updated; immutable payload/seal are never rewritten.
  emit(output+"/seal-check.json", result, "w"); console.log(JSON.stringify(result)); process.exit(0);
}
mkdirSync(output, { recursive: true });
for (const path of controls) {
  assert.ok(!existsSync(resolve(repo,path)), "Preserve earlier seal: " + path);
}
const head = gitRead("rev-parse", "HEAD").trim(), branch = gitRead("branch", "--show-current").trim();
assert.equal(head, "17b1db4201a28e7b607c30707bdc2b75e3484a10"); assert.equal(branch, "feature/phy-01-2026-10-09");
const indexPath = resolve(repo, gitRead("rev-parse", "--git-path", "index").trim()), indexBefore = file(indexPath);
assert.equal(gitRead("diff", "--name-only"), ""); assert.equal(gitRead("diff", "--cached", "--name-only"), "");
const original = json("historical-populations.json");
for (const row of original.files) { assert.equal(hash(row.path), row.sha256, "Historical input changed " + row.path); }
const native = json("results/native-target-margin-contact-fix.receipt.json"), packed = json("results/package-migration2.binding.json");
for (const row of native.sourceDigests) { assert.equal(hash("upstream/source/"+row.path), row.sha256); }
for (const row of native.dependencySourceDigests) { assert.equal(hash(row.path), row.sha256); }
assert.equal(hash("upstream/candidate-rust/Cargo.lock"), native.cargoLockSha256);
assert.equal(hash(native.wasm.path), native.wasm.sha256); assert.equal(packed.profile.wasmSha256, native.wasm.sha256);
for (const row of packed.files) { assert.equal(hash(row.path), row.sha256); }
assert.equal(packed.profile.vanillaNpmBytes, false);
const lockedNpm = json("results/api-verified.json"); assert.equal(hash("package-lock.json"), lockedNpm.lockSha256);
for (const row of lockedNpm.entries) { assert.equal(hash("node_modules/"+row.alias+"/"+row.entry), row.entrySha256); }
const runtime = json("results/runtime-c-completion.json");
for (const row of [...runtime.sources, ...runtime.build, ...runtime.browserEvidence, runtime.packageBinding]) {
  assert.equal(hash(row.path), row.sha256, "Runtime source changed: " + row.path);
}
const finalInputs = json("results/legacy-c-sealed-source-unfiltered.inputs.json");
for (const row of finalInputs.candidateBinding.candidateDigests) { assert.equal(hash(row.path), row.sha256); }
assert.equal(hash("src/rapier021Candidate.ts"), finalInputs.candidateBinding.adapterSha256);
for (const row of finalInputs.candidateBinding.testDigests) { assert.equal(hash(row.path), row.sha256); }
const admin = "C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-cloud-orchestration-2026-10-09";
const packet = admin + "/Hestia_Cloud_Spikes_und_ProgrammAmendment_2026-10-09";
const names = json(packet+"/SOURCE_DOCS.json");
const packetFiles = walk(packet);
const documents = [packet+"/SOURCE_DOCS.json", packet+"/Auftraege/PHY-01.md", packet+"/Goals/PHY-01.txt",
  packet+"/Cloud/00_GEMEINSAMER_VERTRAG.md", packet+"/03_SCHNITTSTELLEN_UND_UEBERNAHME.md",
  packet+"/Vorarbeiten/Hestia_Rapier_Bakeoff_2026-10-02.pdf"];
for (const key of ["REG", "DF"]) {
  const matches = packetFiles.filter(p=>norm(p).endsWith("/"+names[key])); assert.equal(matches.length,1); documents.push(matches[0]);
}
const phy02 = "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-PHY-02-2026-10-09/spikes/phy-02-collider-bakeoff";
const phy02Seal = file(phy02+"/evidence/seal.json");
assert.equal(phy02Seal.sha256, "693539c26589a1c2f60c4a12e79ad5b91a4d7112a8721415ab9b63fb103dea25");
emit(output+"/input-provenance.json", { documents: documents.map(file), observedAdministrativeInputs:
  [file(admin+"/USER_OVERRIDES_2026-10-09.md"), file(admin+"/STATE.json")],
  administrativeRule: "Observed digests only; orchestrator-owned mutable files are not copied or frozen by PHY01. Direct session instructions remain authoritative.",
  phy02: { handoff: file(phy02+"/HANDOFF.md"), seal: phy02Seal, implementation: "PARTIAL", tests: "35/36",
    diagnostics:70, negative:"coupled0.125-nativeSeam step51trap+cleanup failure; one collider option, not Rapier veto" } });
const nodeDir = dirname(process.execPath), python = "C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe";
const toolFiles = new Set([process.execPath,git,python,...walk(nodeDir+"/node_modules/npm"),...walk("node_modules"),
  ...walk(".native-toolchain-0.2.129"), ...walk(".cargo-home/registry/src"), ...walk(".cargo-home/registry/cache")]);
if (existsSync(".python-deps")) { for (const p of walk(".python-deps")) { toolFiles.add(p); } }
for (const row of json("upstream/native-toolchain-0.2.129.json").executables) { assert.equal(hash(row.path),row.sha256); toolFiles.add(row.path); }
assert.equal(hash(native.hostLinker.path),native.hostLinker.sha256); toolFiles.add(native.hostLinker.path);
for (const row of native.vcDigests) { assert.equal(hash(row.path),row.sha256); toolFiles.add(row.path); }
for (const p of walk(".native-target/generated/target-margin-contact-fix")) { toolFiles.add(p); }
toolFiles.add(resolve(".native-target/build/wasm32-unknown-unknown/release/rapier_wasm3d.wasm"));
toolFiles.add(resolve(".upstream-cache/rapier-b716d375efc0201003f0cd9ef7168eee0b62c177.zip"));
const toolRows = [...toolFiles].sort().map(file);
emit(output+"/toolchain.json", { versions: { node:process.version,npm:"10.9.8",typescript:"7.0.2",vite:"8.1.5",vitest:"4.1.11",
  python:"3.12.13",pypdf:"6.1.3",rust:"1.97.1",cargo:"1.97.1",wasmBindgen:"0.2.129",chromium:"155.0.8059.40",git:"2.56.0.windows.1" },
  rule:"Exact executable/npm/dependency/native target/std/SDK/source-registry hashes; no credential/config/home files copied. Historical caches remain, not all are claimed executed.",
  files:toolRows, digest:sha(JSON.stringify(toolRows)) });
const runs = [];
for (const [id,command] of [
  ["legacy-a-sealed-a-control",[process.execPath,"scripts/run-suite.mjs","a","sealed-a-control"]],
  ["legacy-b-adapted-current",[process.execPath,"scripts/run-suite.mjs","b","adapted-current"]],
  ["legacy-c-profile-label-completion",[process.execPath,"scripts/check.mjs","test","profile-label-completion"]],
  ["legacy-c-sealed-source-unfiltered",[process.execPath,"scripts/run-suite.mjs","c","sealed-source-unfiltered"]]]) {
  const receipt = json("results/"+id+".receipt.json"), result = json("results/"+id+".json");
  runs.push({ id,command,exitCode:receipt.exitCode,total:result.numTotalTests,pass:result.numPassedTests,fail:result.numFailedTests,
    skip:result.numPendingTests,raw:file("results/"+id+".json"),receipt:file("results/"+id+".receipt.json") });
}
assert.deepEqual(runs.map(r=>[r.pass,r.fail,r.skip,r.exitCode]), [[144,0,1,0],[112,32,1,1],[32,0,0,0],[143,1,1,1]]);
const browser = json("results/browser-c-final-profile.json"), counts = {PASS:0,FAIL:0,UNSUPPORTED:0};
for (const result of browser.results) { for (const check of result.checks) { counts[check.status]++; } }
assert.deepEqual(counts,{PASS:23,FAIL:0,UNSUPPORTED:1});
const checks = ["typecheck","build"].map(kind=>({command:[process.execPath,"scripts/check.mjs",kind,"final-profile-label"],
  receipt:file("results/check-"+kind+"-final-profile-label.receipt.json"),exitCode:json("results/check-"+kind+"-final-profile-label.receipt.json").exitCode}));
assert.ok(checks.every(c=>c.exitCode===0)); assert.ok(native.stages.every(s=>s.exitCode===0));
emit(output+"/receipt.json", { schema:"phy01.migration-delivery.v2",session:"01a12002-9fe1-7ba3-ae51-1252fe89c88d",head,branch,
  target:{package:"@dimforge/rapier3d-compat",pin:"0.21.0",mandatory:true},candidate:packed.profile,implementation:"BOUND_LAB_MIGRATION_CANDIDATE",
  productIntegration:false,profiles:json("runner-profile.json").profiles,runs,checks,nativeCommands:native.stages,
  nativeReceipt:file("results/native-target-margin-contact-fix.receipt.json"),packageBinding:file("results/package-migration2.binding.json"),
  patches:file("migration-patches.json"),fixtureAndSourceBinding:file("source-manifest.json"),runtimeBinding:file("results/runtime-c-completion.json"),
  historicalBindings:file("historical-populations.json"),browser:{counts,raw:file("results/browser-c-final-profile.json"),normalBridgeAbsent:true,
  cleanup:"Native normal/drain/reset ACK; forced abort frontend only; nativeACK UNSUPPORTED"},
  toolchain:file(output+"/toolchain.json"),inputs:file(output+"/input-provenance.json"),
  previewCleanup:{port:43102,pid:28136,startLocal:"2026-10-09 17:42:53",ctrlCAttempts:2,action:"exactidentity-guardedStopOwnedProcess",exitCode:0,portClosed:true},
  technicalReview:"reviewer:no concrete Native/adapter/Save blocker; scope side effects disclosed; A0 historical/positiveF7 split required",
  verificationReview: label === "final" ? "See CODE_REVIEW.md and delivery/verification-review.json" : "PENDING_SERIAL_READONLY_REVIEW",
  limits:["native sleep/contact timing drift","O(N) predicates,queryBVH and addedcontact query cost unqualified","parentEnable follows upstream ordinary handling",
    "external complete-game Coldinput absent","historical91bundle unavailable","broadupstream2D/vehicle and qualifiedhardware/fullHVP NOT_RUN",
    "forcedabort nativeACK/heap/leak proof unsupported","5 automatic Playwright side-effect files outside writeslice"],
  gates:["A0 productprofile/publicSavecutover","PHY02 restmatrix","PHY03 solver/sourcecapsule","A0serialslot and userfree window for qualifiedpilots","Plannotator/commit/push/publication"] });
// Create only four named controls before status capture so complete dirty paths include the seal itself.
for (const path of controls) { writeFileSync(resolve(repo,path), "{}\n", {flag:"wx"}); }
const status = readStatus(), sideEffects = walk(resolve(repo,".playwright-mcp")).map(p=>file(p));
assert.equal(sideEffects.length,5);
for (const row of status) { assert.ok(row.path.startsWith(prefix) || row.path.startsWith(".devtoolbox/specs/changes/phy-01-2026-10-09/")
  || sideEffects.some(s=>s.path===norm(resolve(repo,row.path))), "Foreign dirty path: "+row.path); }
const controlSet = new Set(controls);
const files = new Set([...status.filter(r=>!controlSet.has(r.path)).map(r=>resolve(repo,r.path)),
  ...walk(spike,new Set(["node_modules",".npm-cache",".python-deps",".test-temp",".upstream-cache",".native-toolchain",".native-toolchain-0.2.129",".native-target",".cargo-home"])),
  ...sideEffects.map(r=>r.path),...toolFiles]);
const payload = [...files].filter(p=>!controlSet.has(norm(relative(repo,resolve(p))))).sort().map(p=>({
  ...file(p),path:norm(relative(repo,resolve(p))),absolutePath:resolve(p) }));
assert.equal(hash(indexPath),indexBefore.sha256,"Index changed during read-only binding");
emit(output+"/dirty-tree.json", {head,branch,status,index:{...indexBefore,absolutePath:indexPath},
  stagedDiffSha256:sha(gitRead("diff","--cached","--binary")),unstagedDiffSha256:sha(gitRead("diff","--binary")),
  scopeSideEffects:sideEffects.map(row=>({...row,origin:"automatic Playwright tool capture; retained, not product input"})),
  exclusions:controls,rule:"Complete Gitstatus/index includes named selfcontrols; their content hashes are bound externally by seal/check, not recursively."},"w");
emit(output+"/manifest.json", {schema:"phy01.complete-content.v2",files:payload,selfControls:controls,
  categories:"Gitdirty plus all noncache spike/rawlogs/dist/history/spec, ignored browser side effects, critical installed/downloaded toolchain/dependency/native inputs"},"w");
const seal = {schema:"phy01.seal.v2",createdAt:new Date().toISOString(),head,branch,sourceProfile:packed.profile.id,vanillaNpmBytes:false,
  generatorSha256:hash("scripts/seal-delivery.mjs"),manifestSha256:hash(output+"/manifest.json"),dirtyTreeSha256:hash(output+"/dirty-tree.json"),
  receiptSha256:hash(output+"/receipt.json"),fileCount:payload.length,completeDirtyPaths:status.length,
  controlPolicy:"4 named controls excluded from payload to avoid selfhash cycles; seal binds manifest/dirty/receipt, check reports seal SHA",productAccepted:false};
emit(output+"/seal.json",seal,"w");
console.log(JSON.stringify({label,sealSha256:hash(output+"/seal.json"),fileCount:payload.length,dirtyPaths:status.length,toolchainFiles:toolRows.length}));
