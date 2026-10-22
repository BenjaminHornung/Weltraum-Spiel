import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkAdmission } from './admission.mjs';
import { requireRuntimeGrant } from '../benni-pc-native24-source-r01/diagnostic-boundary.mjs';

const bytes = readFileSync(new URL('./BOUND_INPUTS.json', import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'), 'c6a0bd2aa34cc55091bfe37878d084ca2551fd1587abec20dedc1bd4e91eea34');
const expected = JSON.parse(bytes);
const cases = JSON.parse(readFileSync(new URL('./CASES_SOURCE.json', import.meta.url), 'utf8'));
const current = JSON.parse(readFileSync(new URL('./CURRENT_READBACK.json', import.meta.url), 'utf8'));
const role = name => expected.roleBindings.find(row => row.role === name);
const utcNowMs = Date.parse('2026-10-17T12:00:00.000Z');
const monotonicNowMs = 1000000;
const utc = offset => new Date(utcNowMs + offset).toISOString();
function fixture() {
  const trusted = { kind: 'SYNTHETIC_DATA_TEST', runnerNative: 'synthetic-runner-v1',
    expectedClockOriginId: expected.clockContract.syntheticTestOnlyOriginId,
    outputRoot: 'C:\\IFI_SourceCode\\Temp\\synthetic-native24-output', outputClaimId: 'synthetic-exclusive-claim',
    containmentReceiptId: 'synthetic-payload-containment', utcNowMs, monotonicNowMs };
  const input = { ownerNative: expected.sourceOwner.nativeId, ownerPaseo: expected.sourceOwner.paseoId,
    workspaceId: expected.sourceOwner.workspaceId, branch: expected.sourceOwner.branch, head: expected.sourceOwner.head,
    runnerNative: trusted.runnerNative, outputRoot: trusted.outputRoot,
    bytes: role('CALLER_INPUT_BINDINGS').bytes, sha256: role('CALLER_INPUT_BINDINGS').sha256 };
  const slot = { schema: 'a66.native24.diagnostic-slot.v1', ownerNative: input.ownerNative, runnerNative: input.runnerNative,
    family: { status: 'VERIFIED', ownerNative: input.ownerNative, runnerNative: input.runnerNative,
      qualification: 'EXACT_NATIVE24_PAYLOAD_CONTAINMENT_QUALIFIED', receiptId: trusted.containmentReceiptId,
      payloadManifestSha256: role('CALLER_SOURCE_MANIFEST').sha256,
      fixedHarmlessManifestSha256: role('FIXED_HARMLESS_FAMILY_MANIFEST').sha256 },
    output: { root: input.outputRoot, status: 'VERIFIED_NEW_EXCLUSIVE', claimId: trusted.outputClaimId,
      runName: 'synthetic-native24-slot' }, input: { bytes: input.bytes, sha256: input.sha256 },
    classification: 'DIAGNOSTIC_NOT_REFERENCE', reference: false,
    directTermination: 'OWN_NEW_CHILD_HANDLE_ONLY_AFTER_CANCEL_GRACE', background: true,
    retry: 0, caseMs: 5000, outerMs: 1200000, childMs: 600000, cleanupReserveMs: 60000,
    maxSerialLanes: 6, serialLanes: true, runName: 'synthetic-native24-slot',
    capacity: { unknown: 0, workingMains: 1, observedAtUtc: utc(-1000), observedAtMonotonicMs: monotonicNowMs - 1000 },
    issuedAtUtc: utc(-1000), enterBeforeUtc: utc(59000), operationDeadlineUtc: utc(1199000),
    clock: { domain: 'PROCESS_LOCAL_MONOTONIC_MILLISECONDS', originId: trusted.expectedClockOriginId,
      runnerNative: input.runnerNative, issuedAtMs: monotonicNowMs - 1000,
      enterBeforeMs: monotonicNowMs + 59000, operationDeadlineMs: monotonicNowMs + 1199000 } };
  return { observed: { kind: trusted.kind, input, slot, roles: structuredClone(expected.roleBindings), cases: structuredClone(cases) }, trusted };
}
let passed = 0, failed = 0, rolePinsExercised = 0, caseMutationsExercised = 0;
const caseIdsExercised = new Set();
function test(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.log(`FAIL ${name}: ${error.stack}`); }
}
function hold(value, reason) {
  const result = checkAdmission(expected, value.observed, value.trusted);
  assert.equal(result.disposition, 'HOLD');
  if (reason) assert.ok(result.reasons.includes(reason), `${reason} missing: ${result.reasons}`);
}
function negative(name, mutate, reason) { test(name, () => { const value = fixture(); mutate(value); hold(value, reason); }); }

test('matching labeled synthetic data is ready only for Root review', () => {
  const value = fixture();
  assert.deepEqual(checkAdmission(expected, value.observed, value.trusted), { disposition: 'ROOT_REVIEW_READY', reasons: [] });
});
test('every one of the 1250 ordered role rows is checked', () => {
  const value = fixture();
  for (let i = 0; i < 1250; i++) {
    const saved = value.observed.roles[i].sha256;
    value.observed.roles[i].sha256 = 'f'.repeat(64) === saved ? 'e'.repeat(64) : 'f'.repeat(64);
    rolePinsExercised++; hold(value, 'ROLE_BINDINGS'); value.observed.roles[i].sha256 = saved;
  }
});
for (const field of ['role', 'path', 'bytes', 'sha256']) negative(`wrong role ${field} refused`, value => {
  value.observed.roles[123][field] = field === 'bytes' ? '1' : 'wrong';
}, 'ROLE_BINDINGS');
negative('missing role refused', value => value.observed.roles.pop(), 'ROLE_BINDINGS');
negative('role reordering refused', value => value.observed.roles.reverse(), 'ROLE_BINDINGS');
negative('duplicate role rows cannot be deduplicated', value => {
  value.observed.roles = value.observed.roles.filter((row, index, all) => all.findIndex(other => other.role === row.role && other.path === row.path) === index);
}, 'ROLE_BINDINGS');
for (const field of ['ownerNative', 'ownerPaseo', 'workspaceId', 'branch', 'head']) negative(`missing or drifting ${field} refused`, value => { value.observed.input[field] = null; }, 'OWNER_BINDING');
negative('matching fake runner self-claims do not replace trusted runner', value => {
  value.observed.input.runnerNative = value.observed.slot.runnerNative = 'other';
}, 'RUNNER_BINDING');
negative('unissued trusted runner refused', value => { value.trusted.runnerNative = null; }, 'RUNNER_BINDING');
negative('input byte/hash drift refused', value => { value.observed.input.sha256 = 'a'.repeat(64); }, 'INPUT_BINDING');
test('all six identity fields of each canonical case are checked', () => {
  for (let index = 0; index < 24; index++) for (const field of ['id', 'profile', 'kind', 'title', 'gyro']) {
    const value = fixture(); value.observed.cases[index][field] = field === 'gyro' ? !value.observed.cases[index][field] : 'wrong'; caseIdsExercised.add(index); caseMutationsExercised++; hold(value, 'CASE_MATRIX');
  }
  for (let index = 0; index < 24; index++) { const value = fixture(); value.observed.cases[index].population = 'wrong'; caseIdsExercised.add(index); caseMutationsExercised++; hold(value, 'CASE_MATRIX'); }
});
negative('wrong prepared lifecycle refused', value => { value.observed.cases[0].parentState = 'dead'; }, 'CASE_MATRIX');
negative('missing case refused', value => value.observed.cases.pop(), 'CASE_MATRIX');
negative('duplicate case refused', value => { value.observed.cases[1] = value.observed.cases[0]; }, 'CASE_MATRIX');
test('matrix ordinal and array position are not case identity', () => {
  const value = fixture(); value.observed.cases.reverse(); for (const row of value.observed.cases) row.matrixOrdinal = -999;
  assert.equal(checkAdmission(expected, value.observed, value.trusted).disposition, 'ROOT_REVIEW_READY');
});
for (const [name, mutate] of [
  ['unknown', value => { value.observed.slot.capacity.unknown = 1; }],
  ['full', value => { value.observed.slot.capacity.workingMains = 6; }],
  ['coerced', value => { value.observed.slot.capacity.workingMains = '1'; }],
  ['missing', value => { value.observed.slot.capacity = null; }],
]) negative(`${name} capacity refused`, mutate, 'CAPACITY');
negative('stale capacity in UTC refused', value => { value.observed.slot.capacity.observedAtUtc = utc(-60001); }, 'UTC_CLOCK');
negative('stale capacity monotonic observation refused', value => { value.observed.slot.capacity.observedAtMonotonicMs = monotonicNowMs - 60001; }, 'MONOTONIC_CLOCK');
negative('future capacity refused', value => { value.observed.slot.capacity.observedAtUtc = utc(1); }, 'UTC_CLOCK');
for (const field of ['root', 'status', 'claimId', 'runName']) negative(`wrong output ${field} refused`, value => { value.observed.slot.output[field] = 'wrong'; }, 'OUTPUT_CUSTODY');
negative('unissued output custody refused', value => { value.trusted.outputClaimId = null; }, 'OUTPUT_CUSTODY');
negative('missing slot and output runName refused', value => {
  delete value.observed.slot.runName; delete value.observed.slot.output.runName;
}, 'OUTPUT_CUSTODY');
negative('numeric slot and output runName refused', value => {
  value.observed.slot.runName = value.observed.slot.output.runName = 7;
}, 'OUTPUT_CUSTODY');
negative('fixture-only VERIFIED family is not Native24 qualification', value => { value.observed.slot.family.qualification = 'FIXTURE_ONLY_NOT_NATIVE24'; }, 'NATIVE24_CONTAINMENT');
negative('unissued payload containment refused', value => { value.trusted.containmentReceiptId = null; }, 'NATIVE24_CONTAINMENT');
negative('payload containment identity drift refused', value => { value.observed.slot.family.payloadManifestSha256 = 'e'.repeat(64); }, 'NATIVE24_CONTAINMENT');
for (const field of ['domain', 'originId', 'runnerNative']) negative(`wrong clock ${field} refused`, value => { value.observed.slot.clock[field] = 'wrong'; }, 'CLOCK_ORIGIN');
negative('two matching untrusted origin claims cannot issue real origin', value => {
  value.trusted.kind = value.observed.kind = 'ACTUAL_CURRENT'; value.trusted.expectedClockOriginId = null;
  value.observed.slot.clock.originId = 'self-claim'; value.observed.slot.clock.expectedOriginId = 'self-claim';
}, 'CLOCK_ORIGIN');
negative('noncanonical UTC text refused without coercion', value => { value.observed.slot.issuedAtUtc = '2026-10-17 11:59:59'; }, 'UTC_CLOCK');
negative('entry UTC deadline equality refused', value => { value.observed.slot.enterBeforeUtc = utc(0); }, 'UTC_CLOCK');
negative('entry monotonic deadline equality refused', value => { value.observed.slot.clock.enterBeforeMs = monotonicNowMs; }, 'MONOTONIC_CLOCK');
negative('backward monotonic observation refused', value => { value.trusted.monotonicNowMs = monotonicNowMs - 2000; }, 'MONOTONIC_CLOCK');
negative('noninteger monotonic data refused', value => { value.observed.slot.clock.issuedAtMs = 1.5; }, 'MONOTONIC_CLOCK');
negative('UTC/monotonic interval skew refused', value => { value.observed.slot.clock.enterBeforeMs -= 1; }, 'CLOCK_SKEW');
negative('operation deadline extension from issue refused', value => { value.observed.slot.operationDeadlineUtc = utc(1200000); }, 'UTC_CLOCK');
negative('insufficient child plus cleanup reserve refused in both clocks', value => {
  value.observed.slot.operationDeadlineUtc = utc(659999); value.observed.slot.clock.operationDeadlineMs = monotonicNowMs + 659999;
}, 'OPERATION_RESERVE');
test('exact child plus cleanup reserve boundary accepted for review', () => {
  const value = fixture(); value.observed.slot.operationDeadlineUtc = utc(660000); value.observed.slot.clock.operationDeadlineMs = monotonicNowMs + 660000;
  assert.equal(checkAdmission(expected, value.observed, value.trusted).disposition, 'ROOT_REVIEW_READY');
});
for (const field of ['caseMs', 'outerMs', 'childMs', 'cleanupReserveMs', 'retry', 'maxSerialLanes']) negative(`budget ${field} drift refused`, value => { value.observed.slot[field]++; }, 'BUDGET_BINDING');
negative('parallel lanes refused', value => { value.observed.slot.serialLanes = false; }, 'BUDGET_BINDING');
test('valid-shaped synthetic admission never opens unchanged old runtime veto', () => {
  const value = fixture(), result = checkAdmission(expected, value.observed, value.trusted);
  assert.throws(() => requireRuntimeGrant(result, expected.sourceOwner.nativeId), /SOURCE_ONLY_NATIVE24_NO_RUNTIME_GRANT/);
  assert.deepEqual(Object.keys(result).sort(), ['disposition', 'reasons']);
});
test('checker does not mutate supplied facts', () => {
  const value = fixture(), before = JSON.stringify(value); checkAdmission(expected, value.observed, value.trusted); assert.equal(JSON.stringify(value), before);
});
test('actual current missing observations remain HOLD with unissued clock', () => {
  const result = checkAdmission(expected, current.observed, current.trusted);
  assert.equal(result.disposition, 'HOLD'); assert.ok(result.reasons.includes('CLOCK_ORIGIN'));
});
test('malformed input fails closed without throwing', () => { assert.equal(checkAdmission(expected, null, null).disposition, 'HOLD'); });
console.log(JSON.stringify({ passed, failed, rolePinsExercised, canonicalCasesExercised: caseIdsExercised.size, caseMutationsExercised,
  actualCurrent: checkAdmission(expected, current.observed, current.trusted), syntheticOnly: true,
  payloadExecutions: 0, fixtureImports: 0, runtimeGrant: 'NONE_HOLD' }));
process.exitCode = failed === 0 ? 0 : 1;
