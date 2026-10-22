import { validateSlot, titlePattern, mayAcquireLane } from '../benni-pc-native24-source-r01/diagnostic-boundary.mjs';

const text = value => typeof value === 'string' && value.length > 0;
const millis = value => Number.isSafeInteger(value) && value >= 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : NaN;
}

// Expected is frozen Root source data; trusted is independently supplied caller context, never an observed self-claim.
// This checks consistency only and exposes no execution authority, callback or runtime capability.
export function checkAdmission(expected, observed, trusted) {
  const reasons = [];
  const reject = reason => { if (!reasons.includes(reason)) reasons.push(reason); };
  const result = () => Object.freeze({ disposition: reasons.length ? 'HOLD' : 'ROOT_REVIEW_READY', reasons: Object.freeze(reasons) });
  if (!object(expected) || expected.schema !== 'hestia.native24.pure-admission-bound-inputs.v1'
    || !Array.isArray(expected.roleBindings) || expected.roleBindings.length !== 1250
    || expected.roleCounts?.total !== 1250 || expected.roleCounts?.duplicateRolePathRowsRetained !== 7
    || !Array.isArray(expected.matrix?.canonicalRows) || expected.matrix.canonicalRows.length !== 24
    || !object(expected.sourceOwner) || !object(expected.clockContract)) {
    reject('EXPECTED_CONTRACT'); return result();
  }
  if (!object(observed) || !object(trusted)) { reject('MISSING_OBSERVATIONS'); reject('CLOCK_ORIGIN'); return result(); }
  const input = observed.input, slot = observed.slot, capacity = slot?.capacity, clock = slot?.clock;
  const synthetic = trusted.kind === 'SYNTHETIC_DATA_TEST';
  if ((!synthetic && trusted.kind !== 'ACTUAL_CURRENT') || observed.kind !== trusted.kind) reject('SOURCE_KIND');
  const rows = observed.roles;
  if (!Array.isArray(rows) || rows.length !== expected.roleBindings.length) reject('ROLE_BINDINGS');
  else for (let i = 0; i < rows.length; i++) {
    const actual = rows[i], pin = expected.roleBindings[i];
    if (!object(actual) || !object(pin) || !text(pin.role) || !text(pin.path) || !millis(pin.bytes)
      || typeof pin.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(pin.sha256)
      || actual.role !== pin.role || actual.path !== pin.path || actual.bytes !== pin.bytes || actual.sha256 !== pin.sha256) {
      reject('ROLE_BINDINGS'); break;
    }
  }
  const owner = expected.sourceOwner;
  if (!object(input) || input.ownerNative !== owner.nativeId || input.ownerPaseo !== owner.paseoId
    || input.workspaceId !== owner.workspaceId || input.branch !== owner.branch || input.head !== owner.head) reject('OWNER_BINDING');
  if (!text(trusted.runnerNative) || input?.runnerNative !== trusted.runnerNative || slot?.runnerNative !== trusted.runnerNative
    || (!synthetic && expected.realDeclaredAbsences?.freshRunnerBindingIssued !== true)) reject('RUNNER_BINDING');
  const inputPin = expected.roleBindings.find(row => row.role === 'CALLER_INPUT_BINDINGS');
  if (!inputPin || input?.bytes !== inputPin.bytes || input?.sha256 !== inputPin.sha256
    || slot?.input?.bytes !== inputPin.bytes || slot?.input?.sha256 !== inputPin.sha256) reject('INPUT_BINDING');

  const canonical = new Map(expected.matrix.canonicalRows.map(row => [row.id, row]));
  const seen = new Set(), lanes = new Map();
  let matrixValid = Array.isArray(observed.cases) && observed.cases.length === 24 && canonical.size === 24;
  if (matrixValid) for (const row of observed.cases) {
    if (!object(row)) { matrixValid = false; break; }
    const originalTitle = 'dynamic staged recut preserves active state and detached disposal leaves no ghosts';
    const lifecycle = row.population === 'PREPARED18' && ['sleeping', 'awake', 'wakes-after-stage'].includes(row.parentState)
      ? `prepared:${row.parentState}` : row.population === 'ORIGINAL6_ASSERTIONS' && row.title === originalTitle
        ? 'original:dynamic-staged-recut' : null;
    const pin = canonical.get(row.id);
    if (!pin || seen.has(row.id) || pin.profile !== row.profile || pin.kind !== row.kind || pin.lifecycle !== lifecycle
      || pin.title !== row.title || pin.gyro !== row.gyro || (row.lifecycle !== undefined && row.lifecycle !== lifecycle)) { matrixValid = false; break; }
    seen.add(row.id);
    const key = `${row.profile}/${row.kind}`;
    if (!lanes.has(key)) lanes.set(key, []);
    lanes.get(key).push(row.title);
  }
  if (matrixValid) {
    try { if (lanes.size !== 6) matrixValid = false; for (const titles of lanes.values()) titlePattern(titles); }
    catch { matrixValid = false; }
  }
  if (!matrixValid) reject('CASE_MATRIX');

  if (!text(trusted.outputRoot) || !text(trusted.outputClaimId) || input?.outputRoot !== trusted.outputRoot
    || slot?.output?.root !== trusted.outputRoot || slot?.output?.status !== 'VERIFIED_NEW_EXCLUSIVE'
    || slot?.output?.claimId !== trusted.outputClaimId || !text(slot?.runName) || slot?.output?.runName !== slot?.runName
    || (!synthetic && expected.realDeclaredAbsences?.exclusiveOutputCustodyIssued !== true)) reject('OUTPUT_CUSTODY');
  if (!object(capacity) || capacity.unknown !== 0 || !Number.isInteger(capacity.workingMains)
    || capacity.workingMains < 1 || capacity.workingMains >= 6
    || (!synthetic && expected.realDeclaredAbsences?.freshCapacityIssued !== true)) reject('CAPACITY');
  const callerPin = expected.roleBindings.find(row => row.role === 'CALLER_SOURCE_MANIFEST');
  const fixturePin = expected.roleBindings.find(row => row.role === 'FIXED_HARMLESS_FAMILY_MANIFEST');
  const family = slot?.family;
  if (!text(trusted.containmentReceiptId) || family?.status !== 'VERIFIED'
    || family?.qualification !== 'EXACT_NATIVE24_PAYLOAD_CONTAINMENT_QUALIFIED'
    || family?.receiptId !== trusted.containmentReceiptId || family?.ownerNative !== owner.nativeId
    || family?.runnerNative !== trusted.runnerNative || family?.payloadManifestSha256 !== callerPin?.sha256
    || family?.fixedHarmlessManifestSha256 !== fixturePin?.sha256
    || (!synthetic && expected.familyContract?.runtimeReceiptIssued !== true)) reject('NATIVE24_CONTAINMENT');
  const requiredOrigin = synthetic ? expected.clockContract.syntheticTestOnlyOriginId : expected.clockContract.realExpectedOriginId;
  if (!text(requiredOrigin) || trusted.expectedClockOriginId !== requiredOrigin || clock?.originId !== requiredOrigin
    || clock?.domain !== 'PROCESS_LOCAL_MONOTONIC_MILLISECONDS' || clock?.domain !== expected.clockContract.domain
    || clock?.runnerNative !== trusted.runnerNative) reject('CLOCK_ORIGIN');

  const now = trusted.utcNowMs, mono = trusted.monotonicNowMs;
  const issued = utc(slot?.issuedAtUtc), enter = utc(slot?.enterBeforeUtc), end = utc(slot?.operationDeadlineUtc), sampled = utc(capacity?.observedAtUtc);
  const utcValid = [now, issued, enter, end, sampled].every(millis)
    && issued <= now && sampled <= now && now - sampled <= 60000 && enter > now
    && enter >= issued && enter - issued <= 60000 && end > now && end - issued <= 1200000;
  if (!utcValid) reject('UTC_CLOCK');
  const issuedMono = clock?.issuedAtMs, enterMono = clock?.enterBeforeMs, endMono = clock?.operationDeadlineMs, sampledMono = capacity?.observedAtMonotonicMs;
  const monoValid = [mono, issuedMono, enterMono, endMono, sampledMono].every(millis)
    && issuedMono <= mono && sampledMono <= mono && mono - sampledMono <= 60000 && enterMono > mono
    && enterMono >= issuedMono && enterMono - issuedMono <= 60000 && endMono > mono && endMono - issuedMono <= 1200000;
  if (!monoValid) reject('MONOTONIC_CLOCK');
  // Exact integer-ms interval agreement is conservative consistency checking, not equivalence of unobserved clocks.
  if (utcValid && monoValid && (now - issued !== mono - issuedMono || now - sampled !== mono - sampledMono
    || enter - issued !== enterMono - issuedMono || end - issued !== endMono - issuedMono)) reject('CLOCK_SKEW');
  if (!mayAcquireLane(end, now) || !mayAcquireLane(endMono, mono)) reject('OPERATION_RESERVE');
  for (const [key, value] of Object.entries({ caseMs: 5000, outerMs: 1200000, childMs: 600000, cleanupReserveMs: 60000, retry: 0, maxSerialLanes: 6 })) {
    if (slot?.[key] !== value) reject('BUDGET_BINDING');
  }
  if (slot?.serialLanes !== true) reject('BUDGET_BINDING');
  try { validateSlot(slot, input, now); } catch { reject('SLOT_CONTRACT'); }
  return result();
}
