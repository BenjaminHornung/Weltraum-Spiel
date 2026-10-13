import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const [variant, label, ...filters] = process.argv.slice(2);
assert.ok(["a", "b", "c"].includes(variant));
assert.match(label, /^[a-z0-9-]{1,64}$/);
assert.equal(process.versions.node.split(".")[0], "22");
const apiBinding = JSON.parse(readFileSync("results/api-verified.json", "utf8"));
assert.equal(apiBinding.verifiedBeforeBehaviorTests, true);
const sha = path => createHash("sha256").update(readFileSync(path)).digest("hex");
assert.equal(sha("package-lock.json"), apiBinding.lockSha256);
for (const entry of apiBinding.entries) {
  assert.equal(sha("node_modules/" + entry.alias + "/" + entry.entry), entry.entrySha256);
}
mkdirSync("results", { recursive: true });
const prefix = `results/legacy-${variant}-${label}`;
for (const suffix of [".json", ".stdout.log", ".stderr.log", ".receipt.json", ".inputs.json"]) {
  assert.ok(!existsSync(prefix + suffix), "Preserve previous result: " + prefix + suffix);
}
const args = ["node_modules/vitest/vitest.mjs", "run", ...filters];
const manifest = JSON.parse(readFileSync("source-manifest.json", "utf8"));
if (existsSync("historical-populations.json")) {
  for (const row of JSON.parse(readFileSync("historical-populations.json", "utf8")).files) {
    assert.equal(sha(row.path), row.sha256, "Historical population changed: " + row.path);
  }
}
const snapshotDigests = [];
for (const source of manifest.files) {
  assert.equal(sha(source.copiedTo[0]), source.sha256, "A control was changed: " + source.path);
  for (const path of source.copiedTo) { snapshotDigests.push({ path, sha256: sha(path) }); }
}
let candidateBinding = null;
if (variant === "c") {
  const packageBindingPath = "results/package-migration2.binding.json";
  const packageBinding = JSON.parse(readFileSync(packageBindingPath, "utf8"));
  for (const row of packageBinding.files) { assert.equal(sha(row.path), row.sha256); }
  const candidateDigests = JSON.parse(readFileSync("candidate-lineage.initial.json", "utf8")).files
    .map(({path}) => ({path,sha256:sha(path)}));
  candidateBinding = { profile: packageBinding.profile, packageBindingSha256: sha(packageBindingPath), candidateDigests,
    adapterSha256: sha("src/rapier021Candidate.ts"),
    testDigests: readdirSync("tests").filter(path => path.endsWith(".test.ts")).sort()
      .map(path => ({path:"tests/"+path,sha256:sha("tests/"+path)})) };
}
writeFileSync(prefix + ".inputs.json", JSON.stringify({ node: process.version,
  lockSha256: apiBinding.lockSha256, packageBindings: apiBinding.entries.map(({alias,version,embeddedWasmSha256}) =>
    ({alias,version,embeddedWasmSha256})), snapshotDigests,
  sourceManifestSha256: sha("source-manifest.json"), testScriptSha256: sha("scripts/run-suite.mjs"),
  configSha256: sha("vite.config.ts"), adapterSha256: sha("src/rapier021.ts"),
  behaviorTestSha256: sha("tests/behavior.test.ts"), adapterTestSha256: sha("tests/adapter.test.ts"),
  candidateBinding }, null, 2) + "\n", { flag: "wx" });
const temporaryRoot = resolve(".test-temp");
mkdirSync(temporaryRoot, { recursive: true });
const run = spawnSync(process.execPath, args, { encoding: "utf8", windowsHide: true,
  env: { ...process.env, PHY_VARIANT: variant, PHY_SUITE: process.env.PHY_SUITE ?? "legacy",
    PHY_RUN_LABEL: label, PHY_RESULT: prefix + ".json",
    TEMP: temporaryRoot, TMP: temporaryRoot, TMPDIR: temporaryRoot },
  timeout: 300_000,
  maxBuffer: 16 * 1024 * 1024 });
writeFileSync(prefix + ".stdout.log", run.stdout ?? "", { flag: "wx" });
writeFileSync(prefix + ".stderr.log", run.stderr ?? "", { flag: "wx" });
const receipt = { command: ["node", ...args], variant, suite: process.env.PHY_SUITE ?? "legacy", node: process.version,
  environment: "LOCAL_WINDOWS_ISOLATED", exitCode: run.status, signal: run.signal,
  spawnError: run.error?.message ?? null, result: existsSync(prefix + ".json") ? prefix + ".json" : null };
writeFileSync(prefix + ".receipt.json", JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(receipt, null, 2));
console.log((run.stdout ?? "").slice(-5000));
console.error((run.stderr ?? "").slice(-2000));
process.exitCode = run.status ?? 1;
