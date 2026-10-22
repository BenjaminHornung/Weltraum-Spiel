import {requireRuntimeGrant} from '../benni-pc-native24-source-r01/diagnostic-boundary.mjs';
requireRuntimeGrant();

const {default: fs} = await import('node:fs');
const {default: path} = await import('node:path');
const {fileURLToPath} = await import('node:url');
const {createHash, randomUUID} = await import('node:crypto');
const {spawn} = await import('node:child_process');
const {createBatchOwner, childTerminal, receiveChild, appendChildBytes} = await import('../benni-pc-native24-source-r01/batchOwner.mjs');
const {titlePattern, validateSlot, mayAcquireLane, frameworkCloseError, terminalState} = await import('../benni-pc-native24-source-r01/diagnostic-boundary.mjs');
const {checkLaneReceipt} = await import('./bridge-contract.mjs');
const callerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../benni-pc-native24-source-r01');
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
const inputPath = path.join(callerRoot, "INPUT_BINDINGS.json");
const inputCapture = capture(inputPath), inputRow = inputCapture.row, input = inputCapture.value;
const slotCapture = capture(process.argv[2]), slot = slotCapture.value;
verify(input);
const initialLease = requireRunnerAndLease(input);
const admissionInput = {...inputRow, ownerNative: input.ownerNative, runnerNative: input.runnerNative,
  outputRoot: path.join(root, "runs")};
const admittedEntry = validateSlot(slot, admissionInput, Date.now());
const operationEnd = Date.parse(slot.operationDeadlineUtc);
if (!Number.isFinite(operationEnd) || operationEnd > admittedEntry.end)
  throw new Error("Bound whole-operation deadline required");
const entry = Object.freeze({...admittedEntry, end: operationEnd});
const owner = createBatchOwner(JSON.parse(fs.readFileSync(path.join(callerRoot, "cases.json"), "utf8")));
fs.mkdirSync(path.join(root, "runs"), {recursive: true});
const output = path.join(root, "runs", entry.runName);
if (entry.runName !== 'unissued') throw new Error('Only the fixed unissued source destination exists');
const bridgeDirectory = path.join(output, 'bridge');
const batchToken = slot.bridge?.batchToken, nodeOrigin = slot.bridge?.nodeOrigin;
if (typeof batchToken !== 'string' || typeof nodeOrigin !== 'string' || nodeOrigin.length === 0)
  throw new Error('Real bridge origins and custody UNISSUED');
if (fs.readFileSync(path.join(output, 'supervisor.claim'), 'utf8').trimEnd() !== batchToken)
  throw new Error('Exclusive supervisor output claim required');
const identity = fs.readFileSync(path.join(bridgeDirectory, 'root.identity.tsv'), 'utf8').trimEnd().split('\t');
if (identity.length !== 7 || identity[0] !== batchToken || identity[1] !== String(process.pid)
  || identity[3] !== slot.bridge?.nativeOrigin) throw new Error('Owned root identity/origin drift');
function sampleNodeClock() {
  const lower = Math.floor(performance.now());
  const utc = Date.now();
  const upper = Math.ceil(performance.now());
  if (![lower, utc, upper].every(value => Number.isSafeInteger(value) && value >= 0) || lower > upper)
    throw new Error('Invalid Node-local sampling bracket');
  return {lower, utc, upper};
}
const issuedSample = sampleNodeClock();
const nodeIssued = issuedSample.lower, issuedUtc = issuedSample.utc;
const issuedUtcHigh = issuedUtc + 1, remainingUtc = entry.end - issuedUtcHigh;
const nodeOverallEnd = nodeIssued + remainingUtc, nodeWorkDeadline = nodeOverallEnd - 60000;
if (![entry.end, issuedUtcHigh, remainingUtc, nodeOverallEnd, nodeWorkDeadline].every(value => Number.isSafeInteger(value) && value >= 0)
  || remainingUtc <= 0 || nodeWorkDeadline <= issuedSample.upper || nodeOverallEnd - nodeIssued > 1200000)
  throw new Error('Invalid conservative Node-local operation end');
const usedReceipts = [];
function verifyBridgePins() {
  const bytes = fs.readFileSync(path.join(root, 'BRIDGE_SOURCE_PINS.tsv'));
  if (createHash('sha256').update(bytes).digest('hex') !== slot.bridge?.pinsSha256) throw new Error('Bridge manifest drift/UNISSUED');
  for (const line of bytes.toString('utf8').trimEnd().split('\n')) {
    const [, file, length, sha256] = line.split('\t'), pin = row(file);
    if (String(pin.bytes) !== length || pin.sha256 !== sha256) throw new Error('Fixed bridge/source/argv pin drift');
  }
}
function publishRequest(action, ordinal, token, complete) {
  const sampled = sampleNodeClock();
  const fields = ['N24', action, batchToken, ordinal, token, nodeOrigin, nodeIssued,
    sampled.lower, nodeWorkDeadline, nodeOverallEnd, issuedUtc, sampled.utc, complete ? 1 : 0, complete ? 1 : 0,
    issuedSample.upper, sampled.upper];
  const name = ordinal + (action === 'LANE_START' ? '.start.request.tsv' : '.retire.request.tsv');
  const final = path.join(bridgeDirectory, name), pending = final + '.pending';
  const handle = fs.openSync(pending, 'wx');
  try { fs.writeFileSync(handle, fields.join('\t') + '\n'); }
  finally { fs.closeSync(handle); }
  fs.linkSync(pending, final);
  fs.unlinkSync(pending);
}
async function requireRootOnlyReceipt(action, ordinal, token) {
  const name = ordinal + (action === 'LANE_START' ? '.start.receipt.tsv' : '.retire.receipt.tsv');
  const file = path.join(bridgeDirectory, name);
  while (true) {
    const sampled = sampleNodeClock();
    if (sampled.upper >= nodeWorkDeadline || sampled.utc >= entry.end - 60000) break;
    if (fs.existsSync(file)) {
      if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error('Regular exclusive receipt required');
      const bytes = fs.readFileSync(file);
      if (bytes.length > 4096) throw new Error('Receipt size bound');
      const fields = bytes.toString('utf8').trimEnd().split('\t');
      const expected = {action, ordinal, token, batchToken, rootPid: process.pid, rootCreated: identity[2],
        nativeOrigin: identity[3], nativeIssued: Number(identity[4]), nativeWorkDeadline: Number(identity[5]),
        nativeOverallEnd: Number(identity[6]), usedReceipts};
      if (checkLaneReceipt(expected, fields) !== 'ROOT_ONLY_DATA_PROVEN') throw new Error('Root-only receipt incomplete/replayed/drifting');
      usedReceipts.push(action + ':' + ordinal + ':' + token);
      return {path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Supervisor Root-only receipt deadline; no next lane');
}
verifyBridgePins();
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
  const request = {input: inputRow, token: randomUUID(), cwd: callerRoot,
    profile: lane.profile, kind: lane.kind, pattern: titlePattern(lane.cases.map(c => c.title)),
    report: path.join(output, id + ".vitest.json")};
  json(requestPath, request);
  const argv = [path.join(root, "diagnostic-child.mjs"), requestPath];
  const allowedEnvironment = ['SystemRoot', 'WINDIR', 'SystemDrive', 'PATH', 'TEMP', 'TMP'];
  const privateEnvironment = Object.fromEntries(allowedEnvironment.filter(name => process.env[name] !== undefined).map(name => [name, process.env[name]]));
  const env = {...privateEnvironment, PHY02_PROFILE: lane.profile, PHY02_KIND: lane.kind,
    PHY02_OBSERVATIONS_ROOT: observations, PHY02_OBSERVATIONS: path.join(output, id + ".original.json"),
    TEMP: path.join(scope, "temp"), TMP: path.join(scope, "temp")};
  for (const name of input.removedEnvironmentNames) delete env[name];
  const startedUtc = new Date().toISOString();
  if (owner.read().completedLanes === 0) validateSlot(slot, admissionInput, Date.now());
  if (!mayAcquireLane(entry.end, Date.now())) { owner.stop("FULL_CHILD_AND_CLEANUP_RESERVE_MISSING"); break; }
  const ordinal = owner.read().completedLanes;
  try {
    verifyBridgePins();
    publishRequest('LANE_START', ordinal, request.token, true);
    await requireRootOnlyReceipt('LANE_START', ordinal, request.token);
    const fresh = sampleNodeClock();
    if (!mayAcquireLane(entry.end, fresh.utc) || !mayAcquireLane(nodeOverallEnd, fresh.upper))
      throw new Error('Fresh UTC and Node-local full child plus cleanup reserve required after start receipt');
  } catch (error) { owner.stop('ROOT_ONLY_START_UNCONFIRMED'); json(path.join(output, id + '.bridge-error.json'), {error: String(error)}); break; }
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
  try {
    publishRequest('LANE_RETIRE', ordinal, request.token, !owner.read().poisoned);
    const receipt = await requireRootOnlyReceipt('LANE_RETIRE', ordinal, request.token);
    json(path.join(output, id + '.retirement.json'), receipt);
    verifyBridgePins();
  } catch (error) { owner.stop('ROOT_ONLY_RETIREMENT_UNCONFIRMED'); json(path.join(output, id + '.retire-error.json'), {error: String(error)}); }
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
