import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync, fork} from "node:child_process";
import {createHash} from "node:crypto";
import test from "node:test";
import * as boundary from "./diagnostic-boundary.mjs";
import {createBatchOwner} from "./batchOwner.mjs";
import config from "./native24.vitest.config.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const probe = new URL("./guard-effect-probe.mjs", import.meta.url).href;
const readEffects = stdout => JSON.parse(stdout.toString().split("\n").find(line => line.startsWith("GUARD_EFFECTS ")).slice(14));
const owner = "01a13648-c55b-7250-bf07-34921d70b43b";
// Synthetic role fixture for child probes, never a fresh identity readback.
const ownerProbeEnv = {...process.env, CODEX_THREAD_ID: owner};
const now = Date.parse("2026-10-14T08:00:30Z");
const input = {bytes: 123, sha256: "a".repeat(64), ownerNative: owner,
  runnerNative: "synthetic-runner-only", outputRoot: path.join(root, "runs")};
// Structural fixture only: no field in this object is an issued runtime capability.
const slot = {schema: "a66.native24.diagnostic-slot.v1", ownerNative: owner,
  runnerNative: input.runnerNative, input: {bytes: input.bytes, sha256: input.sha256},
  classification: "DIAGNOSTIC_NOT_REFERENCE", reference: false, background: true, retry: 0,
  directTermination: "OWN_NEW_CHILD_HANDLE_ONLY_AFTER_CANCEL_GRACE", caseMs: 5000,
  outerMs: 1200000, childMs: 600000, cleanupReserveMs: 60000, runName: "synthetic-guard-only",
  family: {status: "VERIFIED", runnerNative: input.runnerNative},
  output: {root: input.outputRoot, status: "VERIFIED_NEW_EXCLUSIVE"},
  capacity: {unknown: 0, workingMains: 2, observedAtUtc: "2026-10-14T08:00:00Z"},
  issuedAtUtc: "2026-10-14T08:00:00Z", enterBeforeUtc: "2026-10-14T08:01:00Z",
  operationDeadlineUtc: "2026-10-14T08:20:00Z"};

test("current source gate refuses absent, boolean, old and syntactically complete grants with zero effects", () => {
  for (const grant of [undefined, true, {schema: "a66.native24.diagnostic-slot.v1"}, slot]) {
    const effects = [];
    assert.throws(() => {
      boundary.requireRuntimeGrant(grant, owner);
      effects.push("framework-load", "spawn", "wasm", "physics");
    }, /SOURCE_ONLY_NATIVE24_NO_RUNTIME_GRANT/);
    assert.deepEqual(effects, []);
  }
});

test("source gate rejects unknown or foreign current identity before effects", () => {
  for (const nativeId of [null, "", "foreign-native"]) {
    let effects = 0;
    assert.throws(() => { boundary.requireRuntimeGrant(slot, nativeId); effects++; }, /CURRENT_A0_IDENTITY_REQUIRED/);
    assert.equal(effects, 0);
  }
});

test("hostile grant fields are never consumed as authorization", () => {
  let reads = 0;
  const hostile = new Proxy({}, {get() { reads++; throw new Error("hostile grant"); }});
  assert.throws(() => boundary.requireRuntimeGrant(hostile, owner), /SOURCE_ONLY_NATIVE24_NO_RUNTIME_GRANT/);
  assert.equal(reads, 0);
});

test("synthetic current slot structure validates but cannot unlock the runtime", () => {
  assert.equal(boundary.validateSlot(slot, input, now).end, Date.parse(slot.operationDeadlineUtc));
  assert.throws(() => boundary.requireRuntimeGrant(slot, owner), /SOURCE_ONLY_NATIVE24_NO_RUNTIME_GRANT/);
});

const invalid = [
  ["missing slot", undefined],
  ["historical owner", {...slot, ownerNative: "historical-owner"}],
  ["wrong runner", {...slot, runnerNative: "foreign-runner"}],
  ["missing family", {...slot, family: undefined}],
  ["unknown family", {...slot, family: {...slot.family, status: "UNVERIFIED"}}],
  ["foreign family", {...slot, family: {...slot.family, runnerNative: "foreign-runner"}}],
  ["missing output", {...slot, output: undefined}],
  ["unverified output", {...slot, output: {...slot.output, status: "UNVERIFIED"}}],
  ["foreign output", {...slot, output: {...slot.output, root: path.dirname(root)}}],
  ["broad 60 second case deadline", {...slot, caseMs: 60000}],
  ["missing operation deadline", {...slot, operationDeadlineUtc: undefined}],
  ["expired operation", {...slot, operationDeadlineUtc: "2026-10-14T08:00:29Z"}],
  ["operation exceeds whole-run limit", {...slot, operationDeadlineUtc: "2026-10-14T08:20:31Z"}],
  ["unknown capacity", {...slot, capacity: {...slot.capacity, unknown: 1}}],
  ["seventh main", {...slot, capacity: {...slot.capacity, workingMains: 7}}],
  ["stale capacity", {...slot, capacity: {...slot.capacity, observedAtUtc: "2026-10-14T07:59:29Z"}}],
  ["future capacity", {...slot, capacity: {...slot.capacity, observedAtUtc: "2026-10-14T08:00:31Z"}}],
  ["expired entry", {...slot, enterBeforeUtc: "2026-10-14T08:00:29Z"}],
  ["retry", {...slot, retry: 1}],
  ["reference adoption", {...slot, reference: true}],
];
for (const [name, candidate] of invalid) test(`${name} cannot reach harmless effect boundaries`, () => {
  const effects = [];
  assert.throws(() => {
    boundary.validateSlot(candidate, input, now);
    effects.push("framework-load", "spawn", "wasm", "physics");
  });
  assert.deepEqual(effects, []);
});

test("missing bound runner and same-length input forgery are rejected", () => {
  assert.throws(() => boundary.validateSlot(slot, {...input, runnerNative: null}, now));
  assert.throws(() => boundary.validateSlot(slot, {...input, sha256: "b".repeat(64)}, now));
});

test("copied 24-case catalog preserves six exact lanes and a strict case deadline", () => {
  const cases = JSON.parse(fs.readFileSync(path.join(root, "cases.json"), "utf8"));
  const batch = createBatchOwner(cases);
  assert.equal(cases.length, 24);
  assert.equal(new Set(cases.map(c => c.id)).size, 24);
  for (const profile of ["legacy-impulse-v1", "gyroscopic-v1"])
    for (const kind of ["triangles", "multi-cuboid", "voxels"]) {
      const titles = cases.filter(c => c.profile === profile && c.kind === kind).map(c => c.title);
      assert.equal(titles.length, 4);
      const pattern = new RegExp(boundary.titlePattern(titles));
      for (const title of titles) { assert(pattern.test(title)); assert(!pattern.test(title + " extra")); }
    }
  assert.equal(batch.read().nativeAcceptance, false);
  assert.equal(config.test.testTimeout, 5000);
  assert.equal(config.test.maxWorkers, 1);
  assert.equal(config.test.fileParallelism, false);
});

test("framework-close errors and whole-child cleanup reserve retain the R21 stop rules", () => {
  assert(boundary.frameworkCloseError(Buffer.from("\u001b[31merror during close\u001b[0m"), Buffer.alloc(0)));
  assert(!boundary.frameworkCloseError(Buffer.from("ordinary assertion failure"), Buffer.alloc(0)));
  assert(boundary.mayAcquireLane(now + 660000, now));
  assert(!boundary.mayAcquireLane(now + 659999, now));
  const state = boundary.terminalState({exit: null}, {spawned: true, cancelled: true,
    directTerminationRequested: true, error: "owned-handle error"});
  assert.equal(state.cancelled, true);
  assert.equal(state.directTerminationRequested, true);
  assert.equal(state.setupFailure, false);
});

test("copied parent CLI denies before reading a supplied non-existent slot", () => {
  assert.throws(() => execFileSync(process.execPath, ["--import", probe, path.join(root, "diagnostic.mjs"), "not-a-real-slot.json"],
    {cwd: root, env: ownerProbeEnv, timeout: 2000, windowsHide: true, stdio: "pipe"}), error => {
    assert.equal(error.status, 1);
    assert.match(error.stderr.toString(), /SOURCE_ONLY_NATIVE24_NO_RUNTIME_GRANT/);
    assert.deepEqual(readEffects(error.stdout), {runtimeSpawn: 0, wasm: 0});
    return true;
  });
  assert(!fs.existsSync(path.join(root, "runs")));
});

test("foreign-identity copied CLI denies before runtime effects", () => {
  assert.throws(() => execFileSync(process.execPath, ["--import", probe, path.join(root, "diagnostic.mjs")],
    {cwd: root, env: {...process.env, CODEX_THREAD_ID: "SYNTHETIC_FOREIGN_ONLY"},
      timeout: 2000, windowsHide: true, stdio: "pipe"}), error => {
    assert.equal(error.status, 1);
    assert.match(error.stderr.toString(), /CURRENT_A0_IDENTITY_REQUIRED/);
    assert.deepEqual(readEffects(error.stdout), {runtimeSpawn: 0, wasm: 0});
    return true;
  });
});

test("direct owned-IPC child bypass is denied before the harmless framework can load", async () => {
  const scratch = fs.mkdtempSync(path.join(root, "guard-scratch-"));
  const framework = path.join(scratch, "fake-framework.mjs");
  fs.writeFileSync(framework, 'process.stdout.write("FORBIDDEN_FRAMEWORK_IMPORT\\n"); throw new Error("harmless effect probe");\n');
  const inputBytes = Buffer.from(JSON.stringify({frameworkNode: {path: framework}}));
  const inputPath = path.join(scratch, "fake-input.json");
  fs.writeFileSync(inputPath, inputBytes);
  const request = path.join(scratch, "fake-request.json");
  fs.writeFileSync(request, JSON.stringify({input: {path: inputPath, bytes: inputBytes.length,
    sha256: createHash("sha256").update(inputBytes).digest("hex")}, token: "synthetic-guard-token", cwd: root,
    profile: "synthetic-only", kind: "synthetic-only", pattern: "never-a-physical-case", report: path.join(scratch, "never-written.json")}));
  const child = fork(path.join(root, "diagnostic-child.mjs"), [request],
    {cwd: root, env: ownerProbeEnv, execPath: process.execPath, execArgv: ["--import", probe], windowsHide: true, silent: true});
  let stdout = "", stderr = "";
  child.stdout.on("data", bytes => { stdout += bytes; });
  child.stderr.on("data", bytes => { stderr += bytes; });
  const timer = setTimeout(() => child.kill("SIGTERM"), 2000);
  try {
    const closed = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", code => resolve(code)); });
    child.send({type: "start", token: "synthetic-guard-token"}, () => {});
    assert.equal(await closed, 1);
    assert.match(stderr, /SOURCE_ONLY_NATIVE24_NO_RUNTIME_GRANT/);
    assert(!stdout.includes("FORBIDDEN_FRAMEWORK_IMPORT"));
    assert.deepEqual(readEffects(stdout), {runtimeSpawn: 0, wasm: 0});
    assert(!fs.existsSync(path.join(scratch, "never-written.json")));
  } finally {
    clearTimeout(timer);
    assert.equal(path.dirname(scratch), root);
    fs.rmSync(scratch, {recursive: true});
  }
});
