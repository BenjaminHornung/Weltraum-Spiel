const text = v => typeof v === 'string' && v.length > 0;
const ms = v => Number.isSafeInteger(v) && v >= 0;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function nodeWindow(c, utcEnd, final) {
  if (!object(c) || ![c.issued, c.issuedUpper, c.now, c.nowUpper, c.utcIssued, c.utcNow,
    c.workDeadline, c.overallEnd, c.cleanupMs, utcEnd].every(ms)) return false;
  if (c.issued > c.issuedUpper || c.now > c.nowUpper || c.issued > c.now || c.issuedUpper > c.nowUpper || c.utcIssued > c.utcNow) return false;
  const issuedUtcHigh = c.utcIssued + 1, nowUtcHigh = c.utcNow + 1;
  const issueLow = c.utcIssued - c.issuedUpper, issueHigh = issuedUtcHigh - c.issued;
  const nowLow = c.utcNow - c.nowUpper, nowHigh = nowUtcHigh - c.now;
  const remainingUtc = utcEnd - issuedUtcHigh, conservativeEnd = c.issued + remainingUtc;
  const workAndCleanup = c.workDeadline + c.cleanupMs, duration = c.overallEnd - c.issued;
  if (![issuedUtcHigh, nowUtcHigh, issueLow, issueHigh, nowLow, nowHigh, remainingUtc,
    conservativeEnd, workAndCleanup, duration].every(Number.isSafeInteger)) return false;
  return Math.max(issueLow, nowLow) < Math.min(issueHigh, nowHigh) && remainingUtc > 0
    && c.utcNow < utcEnd && c.cleanupMs === 60000 && c.workDeadline > c.issuedUpper
    && c.overallEnd <= conservativeEnd && workAndCleanup <= c.overallEnd && duration <= 1200000
    && (final ? c.nowUpper < c.overallEnd : c.nowUpper < c.workDeadline);
}
export function checkBridge(expected, observed, trusted) {
  const reasons = [];
  const no = reason => { if (!reasons.includes(reason)) reasons.push(reason); };
  const done = () => Object.freeze({ disposition: reasons.length ? 'HOLD' : 'ROOT_REVIEW_READY', reasons: Object.freeze(reasons) });
  if (!object(expected) || !object(observed) || !object(trusted)) { no('MISSING_DATA'); return done(); }
  if (expected.schema !== 'hestia.native24.bridge.v1' || expected.originalRoleCount !== 1250
    || observed.originalRoleCount !== 1250 || observed.originalRolesSha256 !== expected.originalRolesSha256) no('ORIGINAL_BINDING');
  if (trusted.kind !== 'SYNTHETIC_DATA_TEST' || observed.kind !== trusted.kind) no('REAL_RUNTIME_UNISSUED');
  if (!Array.isArray(expected.fixedArgv) || expected.fixedArgv.length !== 3 || !Array.isArray(observed.argv)
    || observed.argv.length !== 3 || expected.fixedArgv.some((value, index) => !text(value) || observed.argv[index] !== value)
    || !text(expected.manifestSha256) || observed.manifestSha256 !== expected.manifestSha256) no('FIXED_COMMAND_OR_MANIFEST');
  const pins = expected.bridgePins, rows = observed.bridgePins;
  if (!Array.isArray(pins) || pins.length === 0 || !Array.isArray(rows) || rows.length !== pins.length) no('BRIDGE_PINS');
  else for (let i = 0; i < pins.length; i++) {
    if (!object(pins[i]) || !object(rows[i]) || !text(pins[i].role) || !text(pins[i].path) || !ms(pins[i].bytes)
      || !/^[a-f0-9]{64}$/.test(pins[i].sha256)
      || ['role', 'path', 'bytes', 'sha256'].some(k => rows[i][k] !== pins[i][k])) no('BRIDGE_PINS');
  }
  const action = observed.action, final = action === 'BATCH_RETIRE' || action === 'ERROR_RETIRE';
  if (!['ROOT_RESUME', 'LANE_START', 'LANE_RETIRE', 'BATCH_RETIRE', 'ERROR_RETIRE'].includes(action)) no('ACTION');
  if (!text(trusted.batchToken) || observed.batchToken !== trusted.batchToken || !text(observed.token)
    || !Array.isArray(trusted.usedTokens) || trusted.usedTokens.includes(observed.token)
    || !ms(observed.ordinal) || observed.ordinal !== trusted.nextOrdinal
    || observed.ordinal > 6 || (!final && observed.ordinal >= 6)
    || (action === 'BATCH_RETIRE' && observed.ordinal !== 6) || observed.exclusive !== true) no('PROTOCOL_REPLAY_OR_ORDER');
  const job = observed.job;
  if (!object(job) || job.unnamed !== true || job.inherited !== false || job.killOnClose !== true
    || job.breakaway !== false || job.hardCap !== 3) no('JOB_CUSTODY');
  const root = observed.root, pin = trusted.root;
  if (!object(root) || !object(pin) || !Number.isSafeInteger(root.pid) || root.pid <= 0
    || !text(root.created) || !/^[1-9][0-9]*$/.test(root.created) || root.pid !== pin.pid || root.created !== pin.created
    || root.imageSha256 !== expected.nodeSha256 || root.imageSha256 !== pin.imageSha256
    || root.ownedHandle !== true || root.identityVerified !== true) no('ROOT_IDENTITY');
  if (!Array.isArray(observed.members) || observed.activeCount !== observed.members.length) no('MEMBERSHIP');
  else if (final) { if (observed.members.length !== 0) no('WHOLE_JOB_ZERO'); }
  else if (observed.members.length !== 1 || !object(observed.members[0]) || !object(root)
    || ['pid', 'created', 'imageSha256', 'ownedHandle', 'identityVerified'].some(k => observed.members[0][k] !== root[k])) no('ROOT_ONLY');
  if (action === 'ROOT_RESUME' && (observed.atomicJobList !== true || observed.suspended !== true
    || observed.membershipVerifiedBeforeResume !== true)) no('RESUME_ORDER');
  if ((action === 'LANE_START' || action === 'LANE_RETIRE') && observed.previousLaneRetired !== true) no('PREVIOUS_RETIREMENT');
  if (action === 'LANE_START' || action === 'LANE_RETIRE') {
    const p = observed.publication;
    const order = ['OPEN_PENDING_EXCLUSIVE', 'WRITE_PENDING_COMPLETE', 'CLOSE_PENDING', 'LINK_FINAL_NO_REPLACE', 'UNLINK_PENDING'];
    if (!object(p) || p.status !== 'PUBLISHED' || p.noReplace !== true || !Array.isArray(p.events)
      || p.events.length !== order.length || order.some((event, index) => p.events[index] !== event)) no('REQUEST_PUBLICATION');
  }
  if (action === 'LANE_START' && (!ms(observed.utcOverallEndMs) || !ms(observed.utcWorkDeadlineMs)
    || observed.utcOverallEndMs - observed.nodeClock?.utcNow < 660000 || observed.utcWorkDeadlineMs - observed.nodeClock?.utcNow < 600000
    || observed.utcWorkDeadlineMs + 60000 > observed.utcOverallEndMs
    || observed.utcOverallEndMs - observed.nodeClock?.utcIssued > 1200000)) no('UTC_LANE_START_RESERVE');
  if (action === 'LANE_RETIRE' && ['childTerminal', 'childClose', 'streamsComplete', 'frameworkClose', 'terminalExitMatches'].some(k => observed[k] !== true)) no('INCOMPLETE_TERMINAL');
  if ((action === 'ROOT_RESUME' || action === 'LANE_START') && observed.totalProcesses !== 1 + 2 * observed.ordinal) no('UNKNOWN_PAST_MEMBERSHIP');
  if (action === 'LANE_RETIRE') {
    const ownership = observed.ownership;
    if (!object(ownership) || ownership.verified !== true || ownership.transferredOnce !== true || ownership.unverifiedWaitOrTerminate !== false) no('CANDIDATE_OWNERSHIP');
    if (!object(ownership) || ownership.threadCloseAttempted !== true || ownership.processCloseAttempted !== true) no('OWNED_HANDLE_CLOSE_MISSING');
    if (!object(ownership) || ownership.waitSucceeded !== true || ownership.threadClosed !== true || ownership.processClosed !== true) no('WAIT_OR_CLOSE_UNCERTAIN');
    const descendants = observed.descendants;
    if (!Array.isArray(descendants) || descendants.length !== 2 || observed.totalProcesses !== 1 + 2 * (observed.ordinal + 1)) no('DESCENDANT_IDENTITIES');
    else {
      for (const p of descendants) if (!object(p) || !Number.isSafeInteger(p.pid) || p.pid <= 0
        || !text(p.created) || !/^[1-9][0-9]*$/.test(p.created) || p.identityVerified !== true
        || p.memberWasVerified !== true || p.terminal !== true || p.handleClosed !== true
        || p.imageSha256 !== expected.nodeSha256) no('DESCENDANT_IDENTITIES');
      if (!object(root) || descendants[0]?.parentPid !== root.pid || descendants[1]?.parentPid !== descendants[0]?.pid
        || descendants[0]?.pid === descendants[1]?.pid || descendants.some(p => p?.pid === root?.pid)) no('DESCENDANT_TOPOLOGY');
    }
  }
  if (observed.cancelled !== false || observed.unknownEffects !== false) no('UNKNOWN_EFFECTS');
  if ((action === 'LANE_START' || action === 'LANE_RETIRE') && observed.receiptTotalProcesses !== 1 + 2 * (action === 'LANE_START' ? observed.ordinal : observed.ordinal + 1)) no('RECEIPT_TOTAL_PROCESSES');
  if (action === 'BATCH_RETIRE' && observed.totalProcesses !== 13) no('FINAL_TOTAL_PROCESSES');
  if (final && ['wholeJobZero', 'jobClosed', 'rootTerminal', 'rootHandleClosed', 'allOwnedHandlesClosed'].some(k => observed[k] !== true)) no('RETIREMENT_UNCONFIRMED');
  for (const [name, domain, origin] of [
    ['nativeClock', 'WINDOWS_BOOT_MONOTONIC_MILLISECONDS', trusted.nativeOrigin],
    ['nodeClock', 'PROCESS_LOCAL_MONOTONIC_MILLISECONDS', trusted.nodeOrigin],
  ]) {
    const c = observed[name];
    if (name === 'nodeClock') {
      if (!text(origin) || c?.origin !== origin || c?.domain !== domain || !nodeWindow(c, observed.utcOverallEndMs, final)) no('NODECLOCK');
      if (action === 'LANE_START' && (!object(c) || c.workDeadline - c.nowUpper < 600000 || c.overallEnd - c.nowUpper < 660000)) no('NODECLOCK_LANE_START_RESERVE');
      continue;
    }
    if (action === 'LANE_START' && (!object(c) || c.workDeadline - c.now < 600000 || c.overallEnd - c.now < 660000)) no(name.toUpperCase() + '_LANE_START_RESERVE');
    if (!object(c) || !text(origin) || c.origin !== origin || c.domain !== domain
      || ![c.issued, c.now, c.workDeadline, c.overallEnd, c.cleanupMs, trusted.utcNowMs, observed.issuedUtcMs].every(ms)
      || c.now < c.issued || (final ? c.overallEnd <= c.now : c.workDeadline <= c.now) || c.cleanupMs !== 60000
      || c.workDeadline + c.cleanupMs > c.overallEnd || c.overallEnd - c.issued > 1200000
      || c.now - c.issued !== trusted.utcNowMs - observed.issuedUtcMs) no(name.toUpperCase());
  }
  // Absolute readings have unrelated origins; only each domain's own duration is checked against UTC.
  for (const [name, value] of Object.entries({ caseMs: 5000, childMs: 600000, outerMs: 1200000, cleanupMs: 60000, maxLanes: 6, retry: 0 })) {
    if (observed[name] !== value) no('BUDGET');
  }
  return done();
}
export function checkNodeRequestClock(fields, expectedOrigin, utcEnd) {
  if (!Array.isArray(fields) || fields.length !== 16 || fields[0] !== 'N24'
    || !['LANE_START', 'LANE_RETIRE'].includes(fields[1]) || !text(expectedOrigin) || fields[5] !== expectedOrigin) return 'HOLD';
  const indexes = [6, 7, 8, 9, 10, 11, 14, 15];
  const values = indexes.map(index => typeof fields[index] === 'string' && /^(0|[1-9][0-9]*)$/.test(fields[index]) ? Number(fields[index]) : NaN);
  if (!values.every(ms)) return 'HOLD';
  const [issued, now, workDeadline, overallEnd, utcIssued, utcNow, issuedUpper, nowUpper] = values;
  if (fields[1] === 'LANE_START' && (workDeadline - nowUpper < 600000 || overallEnd - nowUpper < 660000)) return 'HOLD';
  return nodeWindow({issued, now, issuedUpper, nowUpper, utcIssued, utcNow, workDeadline, overallEnd, cleanupMs: 60000}, utcEnd, false)
    ? 'CLOCK_DATA_PROVEN' : 'HOLD';
}
export function checkLaneReceipt(expected, fields) {
  if (!object(expected) || !Array.isArray(fields) || fields.length !== 13
    || !['LANE_START', 'LANE_RETIRE'].includes(expected.action)
    || fields[0] !== 'N24' || fields[1] !== expected.action || fields[2] !== expected.batchToken
    || fields[3] !== String(expected.ordinal) || fields[4] !== expected.token
    || !text(expected.token) || !text(expected.batchToken) || !ms(expected.ordinal) || expected.ordinal >= 6
    || !Number.isSafeInteger(expected.rootPid) || expected.rootPid <= 0
    || !text(expected.rootCreated) || !/^[1-9][0-9]*$/.test(expected.rootCreated)
    || fields[5] !== String(expected.rootPid) || fields[6] !== expected.rootCreated || fields[7] !== '1'
    || !text(expected.nativeOrigin) || fields[8] !== expected.nativeOrigin
    || !Array.isArray(expected.usedReceipts) || expected.usedReceipts.includes(expected.action + ':' + expected.ordinal + ':' + expected.token)) return 'HOLD';
  if (fields[12] !== String(1 + 2 * (expected.action === 'LANE_START' ? expected.ordinal : expected.ordinal + 1))) return 'HOLD';
  const numeric = fields.slice(9, 12).map(v => /^[0-9]+$/.test(v) ? Number(v) : NaN);
  const [now, work, end] = numeric;
  if (!numeric.every(ms) || numeric.some((value, index) => String(value) !== fields[index + 9])
    || !ms(expected.nativeIssued) || now < expected.nativeIssued || now >= work
    || work !== expected.nativeWorkDeadline || end !== expected.nativeOverallEnd
    || work + 60000 > end || end - expected.nativeIssued > 1200000) return 'HOLD';
  if (expected.action === 'LANE_START' && (work - now < 600000 || end - now < 660000)) return 'HOLD';
  return 'ROOT_ONLY_DATA_PROVEN';
}

