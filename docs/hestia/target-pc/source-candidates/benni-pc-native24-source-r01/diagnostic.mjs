import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash, randomUUID} from "node:crypto";
import {spawn} from "node:child_process";
import {createBatchOwner, childTerminal, receiveChild, appendChildBytes} from "./batchOwner.mjs";
import {requireRuntimeGrant, titlePattern, validateSlot, mayAcquireLane, frameworkCloseError, terminalState} from "./diagnostic-boundary.mjs";

requireRuntimeGrant();

const root = path.dirname(fileURLToPath(import.meta.url));
const scope = root;
const json = (name, value) => fs.writeFileSync(name, JSON.stringify(value, null, 2) + "\n", {flag: "wx"});
function row(name) {
  if (!fs.lstatSync(name).isFile()) throw new Error("Regular input required: " + name);
  const bytes = fs.readFileSync(name);
  return {path: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex")};
}
function capture(name) {
  if (!fs.lstatSync(name).isFile()) throw new Error("Regular control required");
  const bytes = fs.readFileSync(name);
  return {bytes, row: {path: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex")},
    value: JSON.parse(bytes)};
}
function requireRunnerAndLease(input) {
  if (typeof input.runnerNative !== "string" || process.env.CODEX_THREAD_ID !== input.runnerNative)
    throw new Error("Actual bound Runner thread required");
  const lease = capture(input.adminStatePath);
  if (input.ownerNative !== "01a13648-c55b-7250-bf07-34921d70b43b"
    || typeof input.ownerPaseo !== "string" || input.ownerPaseo.length === 0
    || lease.value.ownership?.a0NativeThreadId !== input.ownerNative
    || lease.value.ownership?.a0PaseoAgentId !== input.ownerPaseo)
    throw new Error("Actual sole A0 lease required");
  return lease.row;
}
function verify(input) {
  if (!Array.isArray(input.files) || input.files.length === 0)
    throw new Error("Nonempty source/tool bindings required");
  for (const expected of input.files) {
    const actual = row(expected.path);
    if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256)
      throw new Error("Diagnostic input drift: " + expected.path);
  }
  const executable = row(process.execPath);
  if (executable.bytes !== input.node.bytes || executable.sha256 !== input.node.sha256)
    throw new Error("Bound CIFI Node required");
}

if (process.argv.length !== 3) throw new Error("One separate A0 diagnostic slot file required");
const inputPath = path.join(scope, "INPUT_BINDINGS.json");
const inputCapture = capture(inputPath), inputRow = inputCapture.row, input = inputCapture.value;
const slotCapture = capture(process.argv[2]), slot = slotCapture.value;
verify(input);
const initialLease = requireRunnerAndLease(input);
const admissionInput = {...inputRow, ownerNative: input.ownerNative, runnerNative: input.runnerNative,
  outputRoot: input.outputRoot};
const admittedEntry = validateSlot(slot, admissionInput, Date.now());
const operationEnd = Date.parse(slot.operationDeadlineUtc);
if (!Number.isFinite(operationEnd) || operationEnd > admittedEntry.end)
  throw new Error("Bound whole-operation deadline required");
const entry = Object.freeze({...admittedEntry, end: operationEnd});
const owner = createBatchOwner(JSON.parse(fs.readFileSync(path.join(root, "cases.json"), "utf8")));
fs.mkdirSync(path.join(root, "runs"), {recursive: true});
const output = path.join(root, "runs", entry.runName);
fs.mkdirSync(output);
fs.writeFileSync(path.join(output, "INPUT_CONSUMED.json"), inputCapture.bytes, {flag: "wx"});
fs.writeFileSync(path.join(output, "SLOT_CONSUMED.json"), slotCapture.bytes, {flag: "wx"});
json(path.join(output, "CONSUMED.json"), {slot: slotCapture.row, input: inputRow, initialLease,
  enteredAtUtc: new Date().toISOString(), classification: "DIAGNOSTIC_NOT_REFERENCE",
  priorB08: "HISTORICAL_FAIL_CLEANUP_UNCONFIRMED", userReboot: "NOT_QUALIFIED_BY_THIS_SOURCE_COPY", retry: 0});

for (let lane = owner.next(); lane; lane = owner.next()) {
  try { verify(input); requireRunnerAndLease(input); }
  catch (error) { owner.stop("INPUT_OR_LEASE_DRIFT"); json(path.join(output, "DRIFT_HOLD.json"), {error: String(error)}); break; }
  const id = lane.profile + "-" + lane.kind;
  const observations = path.join(output, id + ".cases");
  fs.mkdirSync(observations);
  const requestPath = path.join(output, id + ".request.json");
  const request = {input: inputRow, token: randomUUID(), cwd: root,
    profile: lane.profile, kind: lane.kind, pattern: titlePattern(lane.cases.map(c => c.title)),
    report: path.join(output, id + ".vitest.json")};
  json(requestPath, request);
  const argv = [path.join(root, "diagnostic-child.mjs"), requestPath];
  const env = {...process.env, PHY02_PROFILE: lane.profile, PHY02_KIND: lane.kind,
    PHY02_OBSERVATIONS_ROOT: observations, PHY02_OBSERVATIONS: path.join(output, id + ".original.json"),
    TEMP: path.join(scope, "temp"), TMP: path.join(scope, "temp")};
  for (const name of input.removedEnvironmentNames) delete env[name];
  const startedUtc = new Date().toISOString();
  if (owner.read().completedLanes === 0) validateSlot(slot, admissionInput, Date.now());
  if (!mayAcquireLane(entry.end, Date.now())) { owner.stop("FULL_CHILD_AND_CLEANUP_RESERVE_MISSING"); break; }
  const child = await new Promise(resolve => {
    const direct = spawn(process.execPath, argv, {cwd: root, env, windowsHide: true,
      stdio: ["ignore", "pipe", "pipe", "ipc"]});
    const stdout = [], stderr = [], messages = [];
    let terminal, settled = false, cancelled = false, cleanupTimer, cutoffTimer,
      directTerminationRequested = false, spawned = false, childError = null;
    const finish = fields => {
      if (settled) return;
      settled = true; clearTimeout(deadline); clearTimeout(cleanupTimer); clearTimeout(cutoffTimer);
      resolve({...childTerminal(terminalState(fields, {spawned, cancelled, directTerminationRequested,
        error: childError}), stdout, stderr, direct.pid), terminal, messages});
    };
    const cancel = reason => {
      if (cancelled || settled) return;
      cancelled = true;
      owner.stop(reason);
      if (direct.connected) direct.send({type: "cancel", token: request.token}, () => {});
      cleanupTimer = setTimeout(() => {
        directTerminationRequested = true;
        direct.kill("SIGTERM"); // Fresh owned handle only; no PID/tree lookup or descendant termination.
        cutoffTimer = setTimeout(() => {
          direct.stdout.destroy(); direct.stderr.destroy();
          if (direct.connected) direct.disconnect();
          direct.unref();
          finish({exit: null, timeout: true, cleanupUnconfirmed: true, directTerminationRequested});
        }, 5000);
      }, 55000);
    };
    const deadline = setTimeout(() => cancel("CHILD_DEADLINE_CANCEL_REQUESTED"), 600000);
    direct.on("spawn", () => {
      spawned = true;
      direct.send({type: "start", token: request.token}, error => { if (error) cancel("OWNED_IPC_START_FAILURE"); });
    });
    direct.on("message", message => {
      if (message?.token !== request.token) { cancel("OWNED_IPC_IDENTITY_DRIFT"); return; }
      messages.push(message);
      if (message.type === "terminal") terminal = message;
    });
    direct.stdout.on("data", bytes => { if (appendChildBytes(stdout, bytes)) cancel("STDOUT_LIMIT_CANCEL_REQUESTED"); });
    direct.stderr.on("data", bytes => { if (appendChildBytes(stderr, bytes)) cancel("STDERR_LIMIT_CANCEL_REQUESTED"); });
    direct.on("error", error => {
      childError = String(error);
      if (spawned) cancel("OWNED_CHILD_HANDLE_ERROR");
      else finish({exit: null, closeObserved: false});
    });
    direct.on("close", (exit, signal) => finish({exit, signal, cancelled, directTerminationRequested,
      closeObserved: true, closedUtc: new Date().toISOString()}));
  });
  json(path.join(output, id + ".command.json"), {binary: input.node, argv, cwd: root, startedUtc,
    finishedUtc: new Date().toISOString(), childMs: 600000, cleanupMs: 60000,
    exit: child.exit, signal: child.signal ?? null, declaredChildPid: child.declaredChildPid,
    timeout: child.timeout ?? false, cancelled: child.cancelled ?? false, setupFailure: child.setupFailure ?? false,
    terminal: child.terminal ?? null, messages: child.messages,
    directTerminationRequested: child.directTerminationRequested ?? false,
    closeObserved: child.closeObserved ?? false,
    frameworkCloseError: frameworkCloseError(child.stdout, child.stderr),
    rawCompleteness: child.closeObserved ? "TERMINAL_DIRECT_CHILD_CLOSE" : "NONTERMINAL_CUTOFF_ONLY",
    cleanup: "OWNED_FRAMEWORK_CLOSE_AND_DIRECT_CHILD_ONLY", osDescendants: "UNVERIFIED", physicalHeap: "UNSUPPORTED"});
  fs.writeFileSync(path.join(output, id + ".stdout.bin"), child.stdout, {flag: "wx"});
  fs.writeFileSync(path.join(output, id + ".stderr.bin"), child.stderr, {flag: "wx"});
  if (!child.terminal?.closeResolved || child.terminal.cancelled || child.cancelled || child.cleanupUnconfirmed
    || !child.closeObserved || frameworkCloseError(child.stdout, child.stderr)
    || child.terminal.exit !== child.exit) owner.stop("FRAMEWORK_TERMINAL_OR_CLOSE_UNCONFIRMED");
  if (!owner.read().poisoned) {
    const error = receiveChild(owner, lane, child, () => fs.readdirSync(observations)
      .filter(name => /^\d+\.json$/.test(name)).map(name => JSON.parse(fs.readFileSync(path.join(observations, name), "utf8"))));
    if (error) json(path.join(output, id + ".receive-error.json"), {error});
  }
  json(path.join(output, id + ".owner.json"), owner.read());
  if (owner.read().poisoned) break;
}
verify(input);
json(path.join(output, "batch.json"), {...owner.read(), classification: "DIAGNOSTIC_NOT_REFERENCE",
  oldSourceProtocolStatus: owner.read().status, actualCases: owner.read().results.reduce((n, lane) => n + lane.records.length, 0),
  reference: "NOT_QUALIFIED", productAdoption: false, osDescendants: "UNVERIFIED", physicalHeap: "UNSUPPORTED"});
process.exitCode = owner.read().poisoned ? 2 : owner.read().results.some(lane => lane.exit === 1) ? 1 : 0;
