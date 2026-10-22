import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkBridge, checkLaneReceipt, checkNodeRequestClock } from './bridge-contract.mjs';
import { requireRuntimeGrant } from '../benni-pc-native24-source-r01/diagnostic-boundary.mjs';

const hash = 'a'.repeat(64);
function fixture(action = 'LANE_START') {
  const root = { pid: 101, created: '133000000000000001', imageSha256: hash, ownedHandle: true, identityVerified: true };
  const expected = { schema: 'hestia.native24.bridge.v1', originalRoleCount: 1250, originalRolesSha256: hash,
    nodeSha256: hash, bridgePins: [{ role: 'BATCH_ENTRY', path: 'fixed/batch.mjs', bytes: 123, sha256: hash }],
    runtimeBindingsIssued: false, fixedArgv: ['fixed-node', 'fixed-batch', 'fixed-slot'], manifestSha256: hash };
  const trusted = { kind: 'SYNTHETIC_DATA_TEST', batchToken: 'batch-1', nextOrdinal: 0, usedTokens: [],
    root, nativeOrigin: 'native-origin-1', nodeOrigin: 'node-origin-1', utcNowMs: 1000000 };
  const observed = { action, kind: trusted.kind, batchToken: 'batch-1', ordinal: 0, token: 'lane-unique-0',
    originalRoleCount: 1250, originalRolesSha256: hash, bridgePins: structuredClone(expected.bridgePins),
    argv: ['fixed-node', 'fixed-batch', 'fixed-slot'], manifestSha256: hash,
    root: structuredClone(root), members: [structuredClone(root)], activeCount: 1, exclusive: true,
    job: { unnamed: true, inherited: false, killOnClose: true, breakaway: false, hardCap: 3 },
    atomicJobList: true, suspended: true, membershipVerifiedBeforeResume: true,
    previousLaneRetired: true, childTerminal: true, childClose: true, streamsComplete: true,
    frameworkClose: true, terminalExitMatches: true, cancelled: false, unknownEffects: false,
    wholeJobZero: false, jobClosed: false, rootTerminal: false, rootHandleClosed: false, allOwnedHandlesClosed: false,
    nativeClock: { domain: 'WINDOWS_BOOT_MONOTONIC_MILLISECONDS', origin: 'native-origin-1',
      issued: 900000000, now: 900001000, workDeadline: 901140000, overallEnd: 901200000, cleanupMs: 60000 },
    nodeClock: { domain: 'PROCESS_LOCAL_MONOTONIC_MILLISECONDS', origin: 'node-origin-1',
      issued: 5000, issuedUpper: 5000, now: 6000, nowUpper: 6000, utcIssued: 999000, utcNow: 1000000,
      workDeadline: 1144999, overallEnd: 1204999, cleanupMs: 60000 },
    issuedUtcMs: 999000, caseMs: 5000, childMs: 600000, outerMs: 1200000, cleanupMs: 60000, maxLanes: 6, retry: 0,
    utcOverallEndMs: 2199000, utcWorkDeadlineMs: 2139000,
    publication: {status: 'PUBLISHED', noReplace: true, events: ['OPEN_PENDING_EXCLUSIVE', 'WRITE_PENDING_COMPLETE', 'CLOSE_PENDING', 'LINK_FINAL_NO_REPLACE', 'UNLINK_PENDING']},
    receiptTotalProcesses: action === 'LANE_RETIRE' ? 3 : 1,
    ownership: {verified: true, transferredOnce: true, unverifiedWaitOrTerminate: false, waitSucceeded: true, threadCloseAttempted: true, processCloseAttempted: true, threadClosed: true, processClosed: true},
    totalProcesses: action === 'BATCH_RETIRE' ? 13 : action === 'LANE_RETIRE' ? 3 : 1,
    descendants: [102, 103].map((pid, index) => ({ pid, parentPid: 101 + index, created: '13300000000000000' + (index + 2),
      imageSha256: hash, identityVerified: true, memberWasVerified: true, terminal: true, handleClosed: true })) };
  if (action === 'BATCH_RETIRE' || action === 'ERROR_RETIRE') {
    observed.members = []; observed.activeCount = 0; observed.wholeJobZero = true; observed.jobClosed = true;
    observed.rootTerminal = true; observed.rootHandleClosed = true; observed.allOwnedHandlesClosed = true;
    observed.ordinal = trusted.nextOrdinal = action === 'BATCH_RETIRE' ? 6 : 0;
  }
  return { expected, observed, trusted };
}
let passed = 0, failed = 0;
function test(name, run) { try { run(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.stack); } }
function result(value) { return checkBridge(value.expected, value.observed, value.trusted); }
function hold(name, mutate) { test(name, () => { const v = fixture(); mutate(v); assert.equal(result(v).disposition, 'HOLD'); }); }
for (const action of ['ROOT_RESUME', 'LANE_START', 'LANE_RETIRE', 'BATCH_RETIRE', 'ERROR_RETIRE']) {
  test(action + ' accepts only complete labeled data proof', () => assert.deepEqual(result(fixture(action)), { disposition: 'ROOT_REVIEW_READY', reasons: [] }));
}
hold('no resume before exact Job membership', v => { v.observed.action = 'ROOT_RESUME'; v.observed.membershipVerifiedBeforeResume = false; });
hold('no resume without atomic JOB_LIST', v => { v.observed.action = 'ROOT_RESUME'; v.observed.atomicJobList = false; });
hold('no resume of an already running root', v => { v.observed.action = 'ROOT_RESUME'; v.observed.suspended = false; });
hold('no lane without exact Root-only membership', v => { v.observed.members.push({ ...v.observed.root, pid: 102 }); v.observed.activeCount = 2; });
hold('unknown member accounting fails', v => { v.observed.activeCount = 2; });
hold('missing membership fails', v => { v.observed.members = null; });
hold('foreign root identity fails', v => { v.observed.members[0].pid = 555; });
hold('creation identity drift fails', v => { v.observed.root.created = '133000000000000002'; });
hold('unverified root image fails', v => { v.observed.root.identityVerified = false; });
hold('missing owned root handle fails', v => { v.observed.root.ownedHandle = false; });
hold('wrong root image hash fails', v => { v.observed.root.imageSha256 = 'b'.repeat(64); });
hold('wrong batch token fails', v => { v.observed.batchToken = 'other'; });
hold('replayed lane token fails', v => { v.trusted.usedTokens.push(v.observed.token); });
hold('missing lane token fails', v => { v.observed.token = null; });
hold('wrong lane ordinal fails', v => { v.observed.ordinal = 1; });
hold('noninteger lane ordinal fails', v => { v.observed.ordinal = '0'; });
hold('seventh lane cannot start', v => { v.observed.ordinal = v.trusted.nextOrdinal = 6; });
hold('nonexclusive protocol fails', v => { v.observed.exclusive = false; });
hold('next lane needs previous retirement', v => { v.observed.previousLaneRetired = false; });
for (const field of ['childTerminal', 'childClose', 'streamsComplete', 'frameworkClose', 'terminalExitMatches']) {
  test('retirement refuses missing ' + field, () => {
    const v = fixture('LANE_RETIRE'); v.observed[field] = false;
    assert.equal(result(v).disposition, 'HOLD'); assert.ok(result(v).reasons.includes('INCOMPLETE_TERMINAL'));
  });
}
hold('cancelled lane stays HOLD', v => { v.observed.cancelled = true; });
hold('unknown effects stay HOLD', v => { v.observed.unknownEffects = true; });
for (const field of ['unnamed', 'killOnClose']) hold('required Job ' + field, v => { v.observed.job[field] = false; });
for (const field of ['inherited', 'breakaway']) hold('forbidden Job ' + field, v => { v.observed.job[field] = true; });
hold('no automatic process cap growth', v => { v.observed.job.hardCap = 4; });
hold('source pin drift fails', v => { v.observed.bridgePins[0].sha256 = 'b'.repeat(64); });
hold('source path drift fails', v => { v.observed.bridgePins[0].path = 'elsewhere'; });
hold('source role drift fails', v => { v.observed.bridgePins[0].role = 'OTHER'; });
hold('source byte drift fails', v => { v.observed.bridgePins[0].bytes++; });
hold('missing source pin fails', v => { v.observed.bridgePins.pop(); });
hold('original role count cannot be replaced', v => { v.observed.originalRoleCount = 1243; });
hold('original source manifest drift fails', v => { v.observed.originalRolesSha256 = 'b'.repeat(64); });
for (const clock of ['nativeClock', 'nodeClock']) {
  hold(clock + ' missing origin fails', v => { v.observed[clock].origin = null; });
  hold(clock + ' wrong independent origin fails', v => { v.observed[clock].origin = 'wrong'; });
  hold(clock + ' missing trusted origin fails', v => { v.trusted[clock === 'nativeClock' ? 'nativeOrigin' : 'nodeOrigin'] = null; });
  hold(clock + ' backward observation fails', v => { v.observed[clock].now = v.observed[clock].issued - 1; });
  hold(clock + ' work plus cleanup exceeds overall', v => { v.observed[clock].workDeadline++; });
  hold(clock + ' duration disagrees with UTC', v => { v.observed[clock].now++; });
  hold(clock + ' expired work fails', v => { v.observed[clock].workDeadline = v.observed[clock].now; });
}
hold('native boot ticks cannot use Node domain', v => { v.observed.nativeClock.domain = v.observed.nodeClock.domain; });
hold('Node process origin cannot use native domain', v => { v.observed.nodeClock.domain = v.observed.nativeClock.domain; });
for (const field of ['caseMs', 'childMs', 'outerMs', 'cleanupMs', 'maxLanes', 'retry']) hold('fixed budget ' + field, v => { v.observed[field]++; });
for (const action of ['BATCH_RETIRE', 'ERROR_RETIRE']) for (const field of ['wholeJobZero', 'jobClosed', 'rootTerminal', 'rootHandleClosed', 'allOwnedHandlesClosed']) {
  test(action + ' requires ' + field, () => { const v = fixture(action); v.observed[field] = false; assert.equal(result(v).disposition, 'HOLD'); });
}
test('final batch requires all six lanes', () => { const v = fixture('BATCH_RETIRE'); v.observed.ordinal = v.trusted.nextOrdinal = 5; assert.equal(result(v).disposition, 'HOLD'); });
test('actual unissued bindings remain HOLD', () => { const v = fixture(); v.trusted.kind = v.observed.kind = 'ACTUAL_CURRENT'; assert.equal(result(v).disposition, 'HOLD'); });
test('malformed input remains HOLD', () => assert.equal(checkBridge(null, null, null).disposition, 'HOLD'));
test('pure check leaves source facts unchanged', () => { const v = fixture(); const before = JSON.stringify(v); result(v); assert.equal(JSON.stringify(v), before); });
test('source readiness never opens existing unconditional runtime veto', () => assert.throws(() => requireRuntimeGrant(result(fixture()), '01a13648-c55b-7250-bf07-34921d70b43b'), /SOURCE_ONLY_NATIVE24_NO_RUNTIME_GRANT/));
for (const index of [0, 1, 2]) hold('fixed argv position ' + index + ' drift fails', v => { v.observed.argv[index] = 'foreign'; });
hold('manifest digest drift fails', v => { v.observed.manifestSha256 = 'b'.repeat(64); });
test('error retirement may use its reserved cleanup interval', () => {
  const v = fixture('ERROR_RETIRE');
  for (const name of ['nativeClock', 'nodeClock']) v.observed[name].now = v.observed[name].workDeadline + 1;
  v.observed.nodeClock.nowUpper = v.observed.nodeClock.now;
  v.observed.nodeClock.utcNow = v.observed.nodeClock.utcIssued + v.observed.nodeClock.now - v.observed.nodeClock.issued;
  v.trusted.utcNowMs = v.observed.issuedUtcMs + 1140001;
  assert.equal(result(v).disposition, 'ROOT_REVIEW_READY');
});
function receiptFixture() {
  const expected = { action: 'LANE_RETIRE', batchToken: 'batch-one', ordinal: 0, token: 'fresh-one',
    rootPid: 101, rootCreated: '133000000000000001', nativeOrigin: 'native-one', nativeIssued: 900000000,
    nativeWorkDeadline: 901140000, nativeOverallEnd: 901200000, usedReceipts: [] };
  const fields = ['N24', 'LANE_RETIRE', 'batch-one', '0', 'fresh-one', '101', '133000000000000001',
    '1', 'native-one', '900001000', '901140000', '901200000', '3'];
  return { expected, fields };
}
test('fixed Root-only wire receipt proves data consistency', () => {
  const v = receiptFixture(); assert.equal(checkLaneReceipt(v.expected, v.fields), 'ROOT_ONLY_DATA_PROVEN');
});
for (let index = 0; index < 13; index++) test('wire receipt field ' + index + ' cannot drift', () => {
  const v = receiptFixture(); v.fields[index] = 'wrong'; assert.equal(checkLaneReceipt(v.expected, v.fields), 'HOLD');
});
test('wire receipt replay fails', () => {
  const v = receiptFixture(); v.expected.usedReceipts = ['LANE_RETIRE:0:fresh-one']; assert.equal(checkLaneReceipt(v.expected, v.fields), 'HOLD');
});
test('wire receipt refuses surviving descendant count', () => {
  const v = receiptFixture(); v.fields[7] = '2'; assert.equal(checkLaneReceipt(v.expected, v.fields), 'HOLD');
});
for (const field of ['rootPid', 'rootCreated', 'nativeOrigin', 'nativeIssued']) test('wire receipt missing trusted ' + field, () => {
  const v = receiptFixture(); v.expected[field] = null; assert.equal(checkLaneReceipt(v.expected, v.fields), 'HOLD');
});
test('wire receipt integer formatting is canonical', () => {
  const v = receiptFixture(); v.fields[9] = '0900001000'; assert.equal(checkLaneReceipt(v.expected, v.fields), 'HOLD');
});
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
test('both JS entries reach old veto before dynamic application imports', () => {
  for (const name of ['diagnostic.mjs', 'diagnostic-child.mjs']) {
    const source = read(name);
    assert.match(source, /^import \{requireRuntimeGrant\} from '\.\.\/benni-pc-native24-source-r01\/diagnostic-boundary\.mjs';\nrequireRuntimeGrant\(\);\n/);
    assert.equal((source.match(/^import /gm) ?? []).length, 1);
    assert.ok(source.indexOf('requireRuntimeGrant();') < source.indexOf('await import('));
  }
});
test('native public entry is only an unconditional throw with no eager type initializer', () => {
  const source = read('Native24Family.cs');
  assert.match(source, /public static int SuperviseNative24\(\)\s*\{\s*throw new InvalidOperationException\("SOURCE_ONLY_NATIVE24_NO_RUNTIME_GRANT"\);\s*\}/);
  assert.doesNotMatch(source, /static Native24Family\s*\(|ModuleInitializer|private static readonly/);
});
test('supervisor PowerShell AST confirms first executable statement is throw', () => {
  const proof = JSON.parse(read('STATIC_AST_RESULT.json'));
  assert.equal(proof.parseErrors, 0); assert.equal(proof.firstStatement, 'ThrowStatementAst');
  assert.equal(proof.bridgeExecuted, false);
});
test('derived child preserves complete existing IPC cancel/start/finally/close body', () => {
  const old = read('../benni-pc-native24-source-r01/diagnostic-child.mjs').replaceAll('\r\n', '\n');
  const derived = read('diagnostic-child.mjs').replaceAll('\r\n', '\n');
  assert.equal(derived.slice(derived.indexOf('if (!process.send')).trimEnd(), old.slice(old.indexOf('if (!process.send')).trimEnd());
});
test('derived parent preserves entire IPC and bounded cancel/streams/close implementation', () => {
  const old = read('../benni-pc-native24-source-r01/diagnostic.mjs').replaceAll('\r\n', '\n');
  const derived = read('diagnostic.mjs').replaceAll('\r\n', '\n');
  const section = text => text.slice(text.indexOf('  const child = await new Promise'), text.indexOf('  json(path.join(output, id + ".command.json")'));
  assert.equal(section(derived), section(old));
  assert.ok(derived.indexOf("await requireRootOnlyReceipt('LANE_START'") < derived.indexOf('    const direct = spawn('));
  assert.ok(derived.indexOf("await requireRootOnlyReceipt('LANE_RETIRE'") < derived.indexOf('    const error = receiveChild('));
});
test('final compile is emit-only and generated DLL absent from loaded assembly paths', () => {
  const result = JSON.parse(read('COMPILE_R01_ENGINE_RESULT.json'));
  assert.equal(result.diagnostic, null); assert.equal(result.generatedAssemblyLoaded, false);
  assert.equal(result.nativeMethodsInvoked, 0); assert.equal(result.passThru, false);
  assert.equal(result.sourceSha256, digest(readFileSync(new URL('Native24Family.cs', import.meta.url))));
  assert.equal(result.outputSha256, digest(readFileSync(new URL('Native24Family.compile-r01.dll', import.meta.url))));
  const paths = JSON.parse(read('COMPILE_R01_ASSEMBLIES_AFTER.json'));
  assert.ok(paths.every(path => path.toLowerCase() !== result.output.toLowerCase()));
});
test('new bridge pins are separate from all 1250 unchanged original role rows', () => {
  const bindings = JSON.parse(read('BRIDGE_BINDINGS.json'));
  const baseline = JSON.parse(read('PRESERVATION_BASELINE.json'));
  assert.equal(bindings.originalRoleCount, 1250); assert.equal(baseline.roleRowsOrdered1250.length, 1250);
  assert.equal(bindings.bridgePins.length, 6);
  for (const pin of bindings.bridgePins) assert.equal(digest(readFileSync(pin.path)), pin.sha256);
  const rows = read('BRIDGE_SOURCE_PINS.tsv').trimEnd().split('\n').map(line => line.split('\t'));
  assert.equal(rows.length, 1256);
  for (let i = 0; i < 1250; i++) {
    const pin = baseline.roleRowsOrdered1250[i];
    assert.deepEqual(rows[i], ['ORIGINAL:' + pin.role, pin.path, String(pin.bytes), pin.sha256]);
  }
  assert.equal(digest(readFileSync(new URL('BRIDGE_SOURCE_PINS.tsv', import.meta.url))), bindings.manifestSha256);
});
test('all 24 original case descriptors and six lanes remain bound untouched', () => {
  const cases = JSON.parse(read('../benni-pc-native24-source-r01/cases.json'));
  assert.equal(cases.length, 24); assert.equal(new Set(cases.map(row => row.id)).size, 24);
  for (const profile of ['legacy-impulse-v1', 'gyroscopic-v1']) for (const kind of ['triangles', 'multi-cuboid', 'voxels']) {
    assert.equal(cases.filter(row => row.profile === profile && row.kind === kind).length, 4);
  }
});
test('current actual bridge values remain absent and HOLD', () => {
  const bindings = JSON.parse(read('BRIDGE_BINDINGS.json'));
  for (const value of Object.values(bindings.actualCurrent)) assert.equal(value, null);
  assert.equal(checkBridge(bindings, null, null).disposition, 'HOLD');
});
test('transient unknown past Job member prevents next lane', () => {
  const v = fixture(); v.observed.totalProcesses++; assert.equal(result(v).disposition, 'HOLD');
});
test('unobserved descendant identity prevents lane acceptance', () => {
  const v = fixture('LANE_RETIRE'); v.observed.descendants.pop(); assert.equal(result(v).disposition, 'HOLD');
});
for (const field of ['identityVerified', 'memberWasVerified', 'terminal', 'handleClosed']) test('every descendant requires ' + field, () => {
  for (let index = 0; index < 2; index++) {
    const v = fixture('LANE_RETIRE'); v.observed.descendants[index][field] = false; assert.equal(result(v).disposition, 'HOLD');
  }
});
test('extra transient process cannot hide behind eventual Root-only state', () => {
  const v = fixture('LANE_RETIRE'); v.observed.totalProcesses = 4; assert.equal(result(v).disposition, 'HOLD');
});
test('second direct child cannot replace the strict child/fork topology', () => {
  const v = fixture('LANE_RETIRE'); v.observed.descendants[1].parentPid = 101; assert.equal(result(v).disposition, 'HOLD');
});
function fresh(remaining = 660000) {
  const v = fixture('LANE_START');
  for (const name of ['nativeClock', 'nodeClock']) v.observed[name].now = v.observed[name].overallEnd - remaining;
  v.observed.nodeClock.nowUpper = v.observed.nodeClock.now;
  v.observed.nodeClock.utcNow = v.observed.nodeClock.utcIssued + v.observed.nodeClock.now - v.observed.nodeClock.issued;
  v.trusted.utcNowMs = v.observed.issuedUtcMs + 1200000 - remaining;
  v.observed.utcOverallEndMs = v.observed.issuedUtcMs + 1200000;
  v.observed.utcWorkDeadlineMs = v.observed.utcOverallEndMs - 60000;
  v.observed.publication = {status: 'PUBLISHED', noReplace: true,
    events: ['OPEN_PENDING_EXCLUSIVE', 'WRITE_PENDING_COMPLETE', 'CLOSE_PENDING', 'LINK_FINAL_NO_REPLACE', 'UNLINK_PENDING']};
  return v;
}
const check = v => checkBridge(v.expected, v.observed, v.trusted);
test('100ms receipt wait consumes exact child plus cleanup reserve: HOLD before spawn', () => {
  const v = fresh(659900); assert.equal(check(v).disposition, 'HOLD');
});
test('fresh exact 660000ms overall and 600000ms work reserve is accepted as data', () => {
  const v = fresh(); assert.equal(check(v).disposition, 'ROOT_REVIEW_READY');
});
test('independently short UTC reserve is HOLD even with enough monotonic reserve', () => {
  const v = fresh(); v.observed.utcOverallEndMs -= 100; v.observed.utcWorkDeadlineMs -= 100;
  assert.equal(check(v).disposition, 'HOLD');
});
test('watched final visible before complete close is HOLD', () => {
  const v = fresh(); v.observed.publication.events = ['OPEN_FINAL', 'WRITE_FINAL_PARTIAL', 'CLOSE_FINAL'];
  assert.equal(check(v).disposition, 'HOLD');
});
test('atomic no-replace pending-close-link-unlink publication is accepted as data', () => {
  const v = fresh(); assert.equal(check(v).disposition, 'ROOT_REVIEW_READY');
});
test('overwriting rename publication is HOLD', () => {
  const v = fresh(); v.observed.publication.noReplace = false; v.observed.publication.events[3] = 'RENAME_REPLACE';
  assert.equal(check(v).disposition, 'HOLD');
});
for (const status of ['EEXIST', 'UNSUPPORTED']) test('publication ' + status + ' remains HOLD without fallback', () => {
  const v = fresh(); v.observed.publication.status = status; assert.equal(check(v).disposition, 'HOLD');
});
test('link before close is HOLD', () => {
  const v = fresh(); [v.observed.publication.events[2], v.observed.publication.events[3]] = [v.observed.publication.events[3], v.observed.publication.events[2]];
  assert.equal(check(v).disposition, 'HOLD');
});

test('native start receipt refuses the 100ms-late reserve', () => {
  const v = receiptFixture(); v.expected.action = v.fields[1] = 'LANE_START'; v.fields[12] = '1';
  v.fields[9] = '900540100'; assert.equal(checkLaneReceipt(v.expected, v.fields), 'HOLD');
});
test('native start receipt accepts fresh exact full reserve', () => {
  const v = receiptFixture(); v.expected.action = v.fields[1] = 'LANE_START'; v.fields[12] = '1';
  v.fields[9] = '900540000'; assert.equal(checkLaneReceipt(v.expected, v.fields), 'ROOT_ONLY_DATA_PROVEN');
});
test('production publisher closes exclusive pending file before atomic no-replace link', () => {
  const source = read('diagnostic.mjs');
  const publisher = source.slice(source.indexOf('function publishRequest('), source.indexOf('async function requireRootOnlyReceipt('));
  const order = ['fs.openSync(pending, \'wx\')', 'fs.writeFileSync(handle,', 'fs.closeSync(handle)', 'fs.linkSync(pending, final)', 'fs.unlinkSync(pending)'];
  const positions = order.map(text => publisher.indexOf(text));
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])));
  assert.doesNotMatch(publisher, /renameSync|copyFileSync|writeFileSync\(final/);
});
test('caller refreshes UTC and process-monotonic full reserve after awaited receipt and before spawn', () => {
  const source = read('diagnostic.mjs'), start = source.indexOf("await requireRootOnlyReceipt('LANE_START'");
  const between = source.slice(start, source.indexOf('  const child = await new Promise', start));
  assert.ok(between.includes('mayAcquireLane(entry.end, fresh.utc)'));
  assert.ok(between.includes('mayAcquireLane(nodeOverallEnd, fresh.upper)'));
});
test('native start receipt checks full native work and overall reserves', () => {
  const source = read('Native24Family.cs'), start = source.indexOf('private static void RootOnlyReceipt(');
  const method = source.slice(start, source.indexOf('// Intentionally private', start));
  assert.ok(method.includes('run.WorkDeadline - receiptNow >= 600000'));
  assert.ok(method.includes('run.OverallEnd - receiptNow >= 660000'));
  assert.ok(method.indexOf('receiptNow >= 660000') < method.indexOf('Publish(ProtocolPath('));
});
for(const [action,total] of [['LANE_START',2],['LANE_RETIRE',4]]) test('late transient process rejected at '+action+' receipt',()=>{
 const v=fixture(action);v.observed.receiptTotalProcesses=total;assert.equal(check(v).disposition,'HOLD');
});
test('final active-zero cannot hide cumulative total14',()=>{
 const v=fixture('BATCH_RETIRE');v.observed.totalProcesses=14;assert.equal(check(v).disposition,'HOLD');
});
test('final total13 and zero is valid data',()=>{
 const v=fixture('BATCH_RETIRE');v.observed.totalProcesses=13;assert.equal(check(v).disposition,'ROOT_REVIEW_READY');
});
for(const stage of ['NONINHERITANCE','API','MEMBERSHIP','IDENTITY']) test('rejected '+stage+' candidate must close without wait/transfer',()=>{
 const v=fixture('LANE_RETIRE');v.observed.ownership={verified:false,transferredOnce:true,unverifiedWaitOrTerminate:true,
 events:['OPEN_QUERY',stage+'_FAILED'],threadCloseAttempted:false,processCloseAttempted:false,waitSucceeded:false};
 assert.equal(check(v).disposition,'HOLD');
});
test('wait failure cannot skip both independent close attempts',()=>{
 const v=fixture('LANE_RETIRE');v.observed.ownership={verified:true,transferredOnce:true,unverifiedWaitOrTerminate:false,
 events:['OPEN_QUERY','VERIFIED','TRANSFER','WAIT_FAILED'],waitSucceeded:false,threadCloseAttempted:false,processCloseAttempted:false};
 const result=check(v);assert.equal(result.disposition,'HOLD');assert.ok(result.reasons.includes('OWNED_HANDLE_CLOSE_MISSING'));
});

test('wait failure preserves HOLD after both independent close attempts',()=>{
 const v=fixture('LANE_RETIRE');v.observed.ownership.waitSucceeded=false;
 const r=check(v);assert.equal(r.disposition,'HOLD');assert.ok(!r.reasons.includes('OWNED_HANDLE_CLOSE_MISSING'));
});
test('native query candidate closes locally and transfers only after all validation',()=>{
 const s=read('Native24Family.cs'),a=s.indexOf('private static void CaptureOwnedDescendants('),b=s.indexOf('private static string[] AwaitRequest(');
 const body=s.slice(a,b);
 assert.ok(body.indexOf('lane.AddRange(candidates)')>body.indexOf('unknown owned topology'));
 assert.ok(body.includes('foreach (BoundProcess candidate in candidates) try { candidate.CloseChecked(); }'));
 assert.doesNotMatch(body,/WaitExited\(|TerminateJobObject\(/);
});
test('native final success requires cumulative13 plus zero',()=>{
 const s=read('Native24Family.cs');assert.ok(s.includes('finalAccounting.TotalProcesses == 13 && finalAccounting.ActiveProcesses == 0'));
 assert.ok(s.includes('boundary.ActiveProcesses == 1 && boundary.TotalProcesses == expectedTotal'));
});
test('native cleanup attempts each checked close independently of failed waits',()=>{
 const s=read('Native24Family.cs'),body=s.slice(s.lastIndexOf('foreach (BoundProcess child in lane) {'));
 assert.match(body,/WaitExited\(child\.Process\.Value, run\.OverallEnd\); \}\s*catch[\s\S]*?try \{ child\.CloseChecked\(\); \}/);
 assert.match(body,/WaitExited\(root\.Process\.Value, run\.OverallEnd\); \}\s*catch[\s\S]*?try \{ root\.CloseChecked\(\); \}/);
});
function clockFixture(){
 const v=fixture('LANE_START');
 v.observed.issuedUtcMs=2000000;v.trusted.utcNowMs=2000000;v.observed.nativeClock.now=v.observed.nativeClock.issued;
 v.observed.utcOverallEndMs=3200000;v.observed.utcWorkDeadlineMs=3140000;
 Object.assign(v.observed.nodeClock,{issued:1000,issuedUpper:1001,now:1001,nowUpper:1002,utcIssued:2000000,utcNow:2000000,overallEnd:1200999,workDeadline:1140999});
 return v;
}
const clockCheck=v=>checkBridge(v.expected,v.observed,v.trusted);
test('real UTC unchanged while floor crosses a millisecond is valid interval data',()=>assert.equal(clockCheck(clockFixture()).disposition,'ROOT_REVIEW_READY'));
test('identical overlapping mono brackets are valid',()=>{
 const v=clockFixture();v.observed.nodeClock.now=1000;v.observed.nodeClock.nowUpper=1001;
 assert.equal(clockCheck(v).disposition,'ROOT_REVIEW_READY');
});

function clockHold(name, mutate){test(name,()=>{const v=clockFixture();mutate(v);assert.equal(clockCheck(v).disposition,'HOLD')})}
test('matching actual UTC transition brackets overlap',()=>{const v=clockFixture();Object.assign(v.observed.nodeClock,{now:1002,nowUpper:1003,utcNow:2000001});assert.equal(clockCheck(v).disposition,'ROOT_REVIEW_READY')});
test('genuine observed sample duration is preserved',()=>{const v=clockFixture();Object.assign(v.observed.nodeClock,{now:1100,nowUpper:1101,utcNow:2000100});assert.equal(clockCheck(v).disposition,'ROOT_REVIEW_READY')});
clockHold('disjoint offset intervals fail',v=>{v.observed.nodeClock.utcNow=2000100});
clockHold('merely touching offset intervals fail',v=>{v.observed.nodeClock.utcNow=2000003});
clockHold('backward own UTC fails',v=>{v.observed.nodeClock.utcNow=1999999});
clockHold('backward lower endpoint fails',v=>{v.observed.nodeClock.now=999});
clockHold('backward upper endpoint fails',v=>{v.observed.nodeClock.now=1000;v.observed.nodeClock.nowUpper=1000});
clockHold('inverted bracket fails',v=>{v.observed.nodeClock.nowUpper=1000});
for(const field of ['issuedUpper','nowUpper','utcIssued','utcNow'])clockHold('missing '+field+' fails',v=>{delete v.observed.nodeClock[field]});
clockHold('wrong process origin fails',v=>{v.observed.nodeClock.origin='other'});
clockHold('unsafe input fails',v=>{v.observed.nodeClock.nowUpper=9007199254740992});
clockHold('integer-plus-one overflow fails',v=>{v.observed.nodeClock.utcIssued=v.observed.nodeClock.utcNow=Number.MAX_SAFE_INTEGER});
clockHold('numeric string input fails without coercion',v=>{v.observed.nodeClock.now='1001'});
clockHold('fractional endpoint fails',v=>{v.observed.nodeClock.nowUpper=1002.5});
test('negative signed offset bounds are valid',()=>{const v=clockFixture();Object.assign(v.observed.nodeClock,{issued:3000000,issuedUpper:3000001,now:3000001,nowUpper:3000002,overallEnd:4199999,workDeadline:4139999});assert.equal(clockCheck(v).disposition,'ROOT_REVIEW_READY')});
function exactUpper(){const v=clockFixture();Object.assign(v.observed.nodeClock,{now:540998,nowUpper:540999,utcNow:2539998});return v}
test('fresh upper with exact full reserve passes',()=>assert.equal(clockCheck(exactUpper()).disposition,'ROOT_REVIEW_READY'));
test('one millisecond less than fresh-upper reserve fails',()=>{const v=exactUpper();v.observed.nodeClock.now++;v.observed.nodeClock.nowUpper++;v.observed.nodeClock.utcNow++;assert.equal(clockCheck(v).disposition,'HOLD')});
test('prewait exact reserve is not reused after100ms',()=>{const v=exactUpper();v.observed.nodeClock.now+=100;v.observed.nodeClock.nowUpper+=100;v.observed.nodeClock.utcNow+=100;assert.equal(clockCheck(v).disposition,'HOLD')});
clockHold('expired real UTC fails',v=>{v.observed.nodeClock.utcNow=3200000});
test('conservative end uses UTC upper representation without extension',()=>{const v=clockFixture();assert.equal(v.observed.nodeClock.overallEnd,1200999);assert.equal(clockCheck(v).disposition,'ROOT_REVIEW_READY');v.observed.nodeClock.overallEnd++;v.observed.nodeClock.workDeadline++;assert.equal(clockCheck(v).disposition,'HOLD')});
test('Node issue UTC may differ from earlier Native issue UTC',()=>{const v=clockFixture();Object.assign(v.observed.nodeClock,{utcIssued:2000050,utcNow:2000050,overallEnd:1200949,workDeadline:1140949});assert.equal(clockCheck(v).disposition,'ROOT_REVIEW_READY')});
function wireClock(){return ['N24','LANE_START','batch','0','token','node-origin-1','1000','1001','1140999','1200999','2000000','2000000','1','1','1001','1002']}
test('exact16field canonical request matches interval model',()=>assert.equal(checkNodeRequestClock(wireClock(),'node-origin-1',3200000),'CLOCK_DATA_PROVEN'));
test('old14field request is HOLD',()=>assert.equal(checkNodeRequestClock(wireClock().slice(0,14),'node-origin-1',3200000),'HOLD'));
for(const value of ['01000','+1000','1000.0','1e3','9007199254740992'])test('noncanonical/unsafe wire integer '+value,()=>{const f=wireClock();f[6]=value;assert.equal(checkNodeRequestClock(f,'node-origin-1',3200000),'HOLD')});
test('wire wrong origin fails',()=>assert.equal(checkNodeRequestClock(wireClock(),'wrong',3200000),'HOLD'));

test('producer samples floor then real UTC then ceil without a measurement loop',()=>{
 const s=read('diagnostic.mjs'),a=s.indexOf('function sampleNodeClock()'),b=s.indexOf('const issuedSample',a),body=s.slice(a,b);
 assert.ok(body.indexOf('Math.floor(performance.now())')<body.indexOf('Date.now()'));
 assert.ok(body.indexOf('Date.now()')<body.indexOf('Math.ceil(performance.now())'));
 assert.doesNotMatch(body,/for\s*\(|while\s*\(/);
 assert.ok(s.includes('const issuedUtcHigh = issuedUtc + 1'));
 assert.ok(s.includes('nodeIssued + remainingUtc'));
 assert.ok(s.includes('mayAcquireLane(nodeOverallEnd, fresh.upper)'));
});
test('producer and Native reader agree on appended14/15 upper fields',()=>{
 const s=read('diagnostic.mjs'),native=read('Native24Family.cs');
 assert.ok(s.includes('issuedSample.upper, sampled.upper'));
 assert.ok(native.includes('p.Length == 16'));
 assert.ok(native.includes('issuedUpper = Field(14), nowUpper = Field(15)'));
 assert.ok(native.includes('Math.Max(issueLow, nowLow) < Math.Min(issueHigh, nowHigh)'));
 assert.doesNotMatch(native,/utcNow - utcIssued == now - issued/);
});
console.log(JSON.stringify({ passed, failed, syntheticOnly: true, payloadExecutions: 0, frameworkImports: 0, nativeMethodsInvoked: 0, runtimeGrant: 'NONE_HOLD' }));
process.exitCode = failed ? 1 : 0;

