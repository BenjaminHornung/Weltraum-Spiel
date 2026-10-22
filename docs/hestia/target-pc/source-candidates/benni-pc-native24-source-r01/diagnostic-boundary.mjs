export function requireRuntimeGrant(_grant, nativeId = process.env.CODEX_THREAD_ID) {
  if (nativeId !== "01a13648-c55b-7250-bf07-34921d70b43b")
    throw new Error("CURRENT_A0_IDENTITY_REQUIRED");
  // No authenticated runtime capability was issued for this source task.
  throw new Error("SOURCE_ONLY_NATIVE24_NO_RUNTIME_GRANT");
}

export function titlePattern(titles) {
  if (!Array.isArray(titles) || titles.length !== 4 || new Set(titles).size !== 4
    || titles.some(title => typeof title !== "string" || title.length === 0))
    throw new Error("Exact four unique lane titles required");
  return "^(?:" + titles.map(title => title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")$";
}

export function validateSlot(slot, input, now) {
  if (!slot || slot.schema !== "a66.native24.diagnostic-slot.v1"
    || input.ownerNative !== "01a13648-c55b-7250-bf07-34921d70b43b"
    || typeof input.runnerNative !== "string" || input.runnerNative.length === 0
    || slot.ownerNative !== input.ownerNative || slot.runnerNative !== input.runnerNative
    || slot.family?.status !== "VERIFIED" || slot.family.runnerNative !== input.runnerNative
    || typeof input.outputRoot !== "string" || input.outputRoot.length === 0
    || slot.output?.root !== input.outputRoot || slot.output.status !== "VERIFIED_NEW_EXCLUSIVE"
    || slot.input?.bytes !== input.bytes || slot.input?.sha256 !== input.sha256
    || slot.classification !== "DIAGNOSTIC_NOT_REFERENCE" || slot.reference !== false
    || slot.directTermination !== "OWN_NEW_CHILD_HANDLE_ONLY_AFTER_CANCEL_GRACE"
    || slot.background !== true || slot.retry !== 0 || slot.outerMs !== 1200000
    || slot.childMs !== 600000 || slot.cleanupReserveMs !== 60000 || slot.caseMs !== 5000
    || slot.capacity?.unknown !== 0 || !Number.isInteger(slot.capacity?.workingMains)
    || slot.capacity.workingMains < 1 || slot.capacity.workingMains > 6
    || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(slot.runName))
    throw new Error("Bound Native24 diagnostic disposition required");
  const observed = Date.parse(slot.capacity.observedAtUtc);
  const issued = Date.parse(slot.issuedAtUtc), enterBefore = Date.parse(slot.enterBeforeUtc);
  if (![observed, issued, enterBefore, now].every(Number.isFinite)
    || observed > now || now - observed > 60000 || issued > now
    || now > enterBefore || enterBefore - issued > 60000)
    throw new Error("Fresh capacity and entry deadline required");
  const operationEnd = Date.parse(slot.operationDeadlineUtc);
  if (!Number.isFinite(operationEnd) || operationEnd <= now || operationEnd > now + slot.outerMs)
    throw new Error("Bound whole-operation deadline required");
  return Object.freeze({end: operationEnd, runName: slot.runName});
}

export function mayAcquireLane(end, now) {
  return Number.isFinite(end) && Number.isFinite(now) && end - now >= 660000;
}

export function frameworkCloseError(stdout, stderr) {
  return [stdout, stderr].some(bytes => bytes.toString("utf8")
    .replace(/\u001b\[[0-9;]*m/g, "").includes("error during close"));
}

export function terminalState(fields, state) {
  return {...fields, cancelled: state.cancelled, directTerminationRequested: state.directTerminationRequested,
    spawned: state.spawned, error: state.error, setupFailure: state.error !== null && !state.spawned};
}
