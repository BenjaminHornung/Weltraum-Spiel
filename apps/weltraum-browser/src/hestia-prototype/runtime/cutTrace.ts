export interface HvpCutSpan {
  readonly commandId: string;
  readonly thread: "main" | "support" | "body" | "physics";
  readonly phase: string;
  readonly origin: number;
  readonly start: number;
  readonly duration: number;
}

export type HvpCutTrace = (span: HvpCutSpan) => void;

export function measureHvpCut<T>(
  trace: HvpCutTrace | undefined,
  commandId: string,
  thread: HvpCutSpan["thread"],
  phase: string,
  run: () => T
): T {
  if (!trace) {
    return run();
  }
  const start = performance.now();
  try {
    return run();
  } finally {
    try {
      trace({ commandId, thread, phase, origin: performance.timeOrigin, start, duration: performance.now() - start });
    } catch {
      // Diagnostic sinks are non-authoritative.
    }
  }
}

export async function measureHvpCutAsync<T>(
  trace: HvpCutTrace | undefined,
  commandId: string,
  thread: HvpCutSpan["thread"],
  phase: string,
  run: () => Promise<T>
): Promise<T> {
  if (!trace) {
    return run();
  }
  const start = performance.now();
  try {
    return await run();
  } finally {
    try {
      trace({ commandId, thread, phase, origin: performance.timeOrigin, start, duration: performance.now() - start });
    } catch {
      // Diagnostic sinks are non-authoritative.
    }
  }
}

import type { HvpTerrainSnapshot } from "../terrain/cutPlan";
import type { createHvpMeasurements } from "./measurements";
import type { RenderCommandResult } from "../../presentation/renderCommands";

export interface HvpCutRenderFacts {
  readonly root: HvpTerrainSnapshot;
  readonly nativeGeneration: number;
  readonly recoveryHold: boolean;
  readonly activeTerrainKeys: readonly string[];
  readonly visibleTerrainKeys: readonly string[];
  readonly body?: HvpBodyCutRenderFacts;
}

export interface HvpBodyRenderBinding {
  readonly ownerId: string;
  readonly sourceDigest: string;
  readonly renderKey: string;
}

export interface HvpBodyCutRenderFacts {
  readonly outcome: Readonly<{ id: string; status: string }>;
  readonly nativeState: string;
  readonly nativeSequence: number;
  readonly receipt: Readonly<{ id: string; status: string; parentId: string; children: readonly string[] }>;
  readonly children: readonly HvpBodyRenderBinding[];
  readonly activeKeys: readonly string[];
  readonly visibleKeys: readonly string[];
}

export interface HvpCutObservationDropReasons {
  readonly missingInput: number;
  readonly invalidSpan: number;
  readonly invalidFrame: number;
  readonly overflow: number;
  readonly superseded: number;
  readonly disposed: number;
  readonly diagnosticFailure: number;
  readonly collectedRoot: number;
}

export interface HvpCutObservationState {
  readonly inputCount: number;
  readonly pendingRender: boolean;
  readonly disposed: boolean;
  readonly dropped: number;
  readonly dropReasons: HvpCutObservationDropReasons;
}

// Five main and five body key lists, three bounded child-binding lists and fixed
// records fit this controlled-payload allowance. Native snapshots stay borrowed.
export const HVP_CUT_TRACE_RESERVE_BYTES = 512 * 1024;

type HvpCutObservationSink = Pick<ReturnType<typeof createHvpMeasurements>, "record">;
type HvpCutTerminalStatus = "Applied" | "NoOp" | "Rejected" | "RecoveryHold";
type HvpCutDropReason = keyof HvpCutObservationDropReasons;
type HvpRawSpan = Readonly<{
  commandId: string;
  thread: HvpCutSpan["thread"];
  phase: string;
  origin: number;
  start: number;
  duration: number;
}>;
type HvpSpanTiming = Readonly<{ origin: number; start: number; end: number }>;
type HvpInputRecord = Readonly<{ origin: number; start: number }>;
type HvpPendingRender = Readonly<{
  commandId: string;
  input: HvpInputRecord;
  root: WeakRef<HvpTerrainSnapshot>;
  revision: number;
  digest: string;
  nativeGeneration: number;
  activeTerrainKeys: readonly string[];
  body?: Readonly<{
    outcome: WeakRef<HvpBodyCutRenderFacts["outcome"]>;
    sequence: number;
    parentId: string;
    children: readonly HvpBodyRenderBinding[];
    activeKeys: readonly string[];
  }>;
}>;

const HVP_CUT_MAX_INPUTS = 9;
const HVP_CUT_MAX_KEYS = 64;
const HVP_CUT_MAX_KEY_LENGTH = 256;
const HVP_CUT_KEY_PREFIX = "hvp:terrain:s";
const HVP_CUT_DIGEST = /^[a-f0-9]{8}$/;
const HVP_CUT_PHASE = /^[A-Za-z][A-Za-z0-9]{0,62}$/;

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isCutThread = (value: unknown): value is HvpCutSpan["thread"] =>
  value === "main" || value === "support" || value === "body" || value === "physics";

const isCutCommandId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 128;

const terminalStatus = (span: unknown): HvpCutTerminalStatus | undefined => {
  try {
    if (!span || typeof span !== "object" || !("thread" in span) || !("phase" in span)
      || span.thread !== "main") {
      return undefined;
    }
    switch (span.phase) {
      case "cutTotalAppliedMs": case "cutBodyTotalAppliedMs": return "Applied";
      case "cutTotalNoOpMs": case "cutBodyTotalNoOpMs": return "NoOp";
      case "cutTotalRejectedMs": case "cutBodyTotalRejectedMs": return "Rejected";
      case "cutTotalRecoveryHoldMs": case "cutBodyTotalRecoveryHoldMs": return "RecoveryHold";
      default: return undefined;
    }
  } catch {
    return undefined;
  }
};

const readCommandId = (span: unknown): unknown => {
  try {
    return span && typeof span === "object" && "commandId" in span ? span.commandId : undefined;
  } catch {
    return undefined;
  }
};

const isBodySpan = (span: unknown): boolean => {
  try {
    return !!span && typeof span === "object" && "thread" in span && span.thread === "main"
      && "phase" in span && typeof span.phase === "string" && span.phase.startsWith("cutBody");
  } catch { return false; }
};

const readRawSpan = (span: HvpCutSpan): HvpRawSpan | undefined => {
  try {
    if (!span || typeof span !== "object" || !isCutCommandId(span.commandId) || !isCutThread(span.thread)
      || typeof span.phase !== "string" || !HVP_CUT_PHASE.test(span.phase)
      || !isFiniteNonNegative(span.origin) || !isFiniteNonNegative(span.start) || !isFiniteNonNegative(span.duration)) {
      return undefined;
    }
    const end = span.origin + span.start + span.duration;
    if (!Number.isFinite(end) || end < 0) {
      return undefined;
    }
    return { commandId: span.commandId, thread: span.thread, phase: span.phase, origin: span.origin,
      start: span.start, duration: span.duration };
  } catch {
    return undefined;
  }
};

const keyListStatus = (values: readonly string[], prefix = HVP_CUT_KEY_PREFIX): "valid" | "overflow" | "invalidFrame" => {
  if (!Array.isArray(values)) {
    return "invalidFrame";
  }
  if (values.length > HVP_CUT_MAX_KEYS) {
    return "overflow";
  }
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (typeof key !== "string" || key.length === 0 || key.length > HVP_CUT_MAX_KEY_LENGTH || !key.startsWith(prefix)) {
      return "invalidFrame";
    }
    for (let previous = 0; previous < index; previous += 1) {
      if (values[previous] === key) {
        return "invalidFrame";
      }
    }
  }
  return "valid";
};

const sameKeys = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  for (const key of left) {
    if (!right.includes(key)) {
      return false;
    }
  }
  return true;
};

const bodyFactsStatus = (body: HvpBodyCutRenderFacts | undefined, commandId: string): "valid" | "overflow" | "invalidFrame" => {
  if (!body || !body.outcome || typeof body.outcome !== "object" || body.outcome.id !== commandId || body.outcome.status !== "Applied"
    || body.nativeState !== "Idle" || !isSafeNonNegativeInteger(body.nativeSequence) || !body.receipt
    || body.receipt.id !== commandId || body.receipt.status !== "Applied"
    || typeof body.receipt.parentId !== "string" || body.receipt.parentId.length === 0 || body.receipt.parentId.length > 256
    || !Array.isArray(body.children) || !Array.isArray(body.receipt.children)) { return "invalidFrame"; }
  if (body.children.length > 32 || body.receipt.children.length > 32) { return "overflow"; }
  const active = keyListStatus(body.activeKeys, ""), visible = keyListStatus(body.visibleKeys, "");
  if (active === "overflow" || visible === "overflow") { return "overflow"; }
  if (active !== "valid" || visible !== "valid" || !sameKeys(body.activeKeys, body.visibleKeys)
    || body.children.length !== body.receipt.children.length || body.activeKeys.includes(body.receipt.parentId)) { return "invalidFrame"; }
  for (let i = 0; i < body.children.length; i += 1) {
    const child = body.children[i];
    if (!child || typeof child.ownerId !== "string" || child.ownerId.length === 0 || child.ownerId.length > 256
      || child.ownerId === body.receipt.parentId || child.ownerId !== body.receipt.children[i]
      || typeof child.sourceDigest !== "string" || !/^fnv1a64-v1:[a-f0-9]{16}$/.test(child.sourceDigest)
      || typeof child.renderKey !== "string" || !body.activeKeys.includes(child.renderKey)) { return "invalidFrame"; }
    for (let previous = 0; previous < i; previous += 1) {
      if (body.children[previous]!.ownerId === child.ownerId || body.children[previous]!.renderKey === child.renderKey) { return "invalidFrame"; }
    }
  }
  return "valid";
};

export function createHvpCutObservation(
  sink: HvpCutObservationSink,
  readFrame: (bodyCommandId?: string) => HvpCutRenderFacts
): {
  confirm(run: () => void): void;
  trace: HvpCutTrace;
  render(run: () => RenderCommandResult): RenderCommandResult;
  read(): HvpCutObservationState;
  dispose(): void;
} {
  const inputs = new Map<string, HvpInputRecord>();
  const drops: Record<HvpCutDropReason, number> = {
    missingInput: 0, invalidSpan: 0, invalidFrame: 0, overflow: 0,
    superseded: 0, disposed: 0, diagnosticFailure: 0, collectedRoot: 0
  };
  let dropped = 0;
  let activeInput: HvpInputRecord | undefined;
  let pending: HvpPendingRender | undefined;
  let disposed = false;
  let operationGeneration = 0;

  const drop = (reason: HvpCutDropReason, count = 1): void => {
    drops[reason] += count;
    dropped += count;
  };

  const consumePending = (reason: HvpCutDropReason): void => {
    if (pending) {
      pending = undefined;
      drop(reason);
    }
  };

  const isCurrent = (generation: number): boolean => !disposed && operationGeneration === generation;

  const readParentOrigin = (): { value?: number; reason?: "invalidSpan" | "diagnosticFailure" } => {
    try {
      const value = performance.timeOrigin;
      if (!isFiniteNonNegative(value)) {
        return { reason: "invalidSpan" };
      }
      return { value };
    } catch {
      return { reason: "diagnosticFailure" };
    }
  };

  const translatedTiming = (span: HvpRawSpan, origin: number): HvpSpanTiming | undefined => {
    const start = span.origin - origin + span.start;
    const end = span.origin + span.start + span.duration - origin;
    if (!isFiniteNonNegative(start) || !isFiniteNonNegative(end) || !Number.isFinite(start + span.duration)
      || start + span.duration < 0) {
      return undefined;
    }
    return { origin, start, end };
  };

  const relay = (span: HvpRawSpan, timing: HvpSpanTiming, generation: number): void => {
    try {
      sink.record(span.phase, timing.start, span.duration, Object.freeze({
        commandId: span.commandId, thread: span.thread, phase: span.phase,
        origin: span.origin, start: span.start, duration: span.duration
      }));
    } catch {
      if (isCurrent(generation)) {
        drop("diagnosticFailure");
      }
    }
  };

  const factsStatus = (facts: HvpCutRenderFacts): "valid" | "overflow" | "invalidFrame" => {
    try {
      if (!facts || typeof facts !== "object" || !facts.root || typeof facts.root !== "object"
        || !isSafeNonNegativeInteger(facts.root.revision) || typeof facts.root.sourceDigest !== "string"
        || !HVP_CUT_DIGEST.test(facts.root.sourceDigest) || !isSafeNonNegativeInteger(facts.nativeGeneration)
        || typeof facts.recoveryHold !== "boolean") {
        return "invalidFrame";
      }
      const active = keyListStatus(facts.activeTerrainKeys);
      const visible = keyListStatus(facts.visibleTerrainKeys);
      if (active === "overflow" || visible === "overflow") {
        return "overflow";
      }
      if (active !== "valid" || visible !== "valid") {
        return "invalidFrame";
      }
      return "valid";
    } catch {
      return "invalidFrame";
    }
  };

  const captureApplied = (commandId: string, input: HvpInputRecord, generation: number, bodyCommand: boolean): void => {
    if (!isCurrent(generation)) {
      return;
    }
    let facts: HvpCutRenderFacts;
    try {
      facts = bodyCommand ? readFrame(commandId) : readFrame();
    } catch {
      if (isCurrent(generation)) {
        drop("invalidFrame");
      }
      return;
    }
    if (!isCurrent(generation)) {
      return;
    }
    try {
      const status = factsStatus(facts);
      if (status !== "valid") {
        if (isCurrent(generation)) {
          drop(status);
        }
        return;
      }
      const root = facts.root;
      const nativeGeneration = facts.nativeGeneration;
      const recoveryHold = facts.recoveryHold;
      const activeTerrainKeys = facts.activeTerrainKeys;
      const visibleTerrainKeys = facts.visibleTerrainKeys;
      if (!isCurrent(generation)) {
        return;
      }
      if (recoveryHold || nativeGeneration !== root.revision
        || !sameKeys(activeTerrainKeys, visibleTerrainKeys)) {
        if (isCurrent(generation)) {
          drop("invalidFrame");
        }
        return;
      }
      if (!isCurrent(generation)) {
        return;
      }
      const activeKeys = Object.freeze([...activeTerrainKeys]);
      let body: HvpPendingRender["body"];
      if (bodyCommand) {
        const bodyStatus = bodyFactsStatus(facts.body, commandId);
        if (bodyStatus !== "valid") { if (isCurrent(generation)) { drop(bodyStatus); } return; }
        const value = facts.body!;
        body = Object.freeze({ outcome: new WeakRef(value.outcome), sequence: value.nativeSequence, parentId: value.receipt.parentId,
          children: Object.freeze(value.children.map(child => Object.freeze({ ownerId: child.ownerId, sourceDigest: child.sourceDigest, renderKey: child.renderKey }))),
          activeKeys: Object.freeze([...value.activeKeys]) });
      }
      if (!isCurrent(generation)) {
        return;
      }
      pending = Object.freeze({ commandId, input, root: new WeakRef(root), revision: root.revision,
        digest: root.sourceDigest, nativeGeneration, activeTerrainKeys: activeKeys, ...(body ? { body } : {}) });
    } catch {
      if (isCurrent(generation)) {
        drop("invalidFrame");
      }
    }
  };

  const handleTerminal = (span: HvpRawSpan, status: HvpCutTerminalStatus, input: HvpInputRecord | undefined,
    timing: HvpSpanTiming | undefined, generation: number): void => {
    if (!input || !timing || !isCurrent(generation)) {
      return;
    }
    try {
      const inputEnd = input.origin + input.start;
      const duration = span.origin + span.start + span.duration - inputEnd;
      const inputStart = input.origin - timing.origin + input.start;
      if (!isFiniteNonNegative(inputEnd) || !isFiniteNonNegative(inputStart) || !isFiniteNonNegative(duration)) {
        if (isCurrent(generation)) {
          drop("invalidSpan");
        }
        return;
      }
      sink.record(`${isBodySpan(span) ? "cutBody" : "cut"}InputTo${status}Ms`, inputStart, duration, Object.freeze({
        commandId: span.commandId, inputOrigin: input.origin, inputStart: input.start,
        terminalOrigin: span.origin, terminalStart: span.start, terminalDuration: span.duration
      }));
    } catch {
      if (isCurrent(generation)) {
        drop("diagnosticFailure");
      }
    }
    if (status === "Applied" && isCurrent(generation)) {
      captureApplied(span.commandId, input, generation, isBodySpan(span));
    }
  };

  const confirm = (run: () => void): void => {
    const previous = activeInput;
    const generation = operationGeneration;
    activeInput = undefined;
    if (!disposed) {
      let start: number | undefined;
      let origin: number | undefined;
      let clockFailure = false;
      try {
        start = performance.now();
        origin = performance.timeOrigin;
      } catch {
        clockFailure = true;
        if (isCurrent(generation)) {
          drop("diagnosticFailure");
        }
      }
      if (isCurrent(generation) && !clockFailure) {
        const absoluteStart = start !== undefined && origin !== undefined ? origin + start : Number.NaN;
        if (!isFiniteNonNegative(start) || !isFiniteNonNegative(origin) || !Number.isFinite(absoluteStart)) {
          drop("invalidSpan");
        } else {
          activeInput = Object.freeze({ origin, start });
        }
      }
    }
    try {
      run();
    } finally {
      activeInput = disposed ? undefined : previous;
    }
  };

  const trace: HvpCutTrace = (span): void => {
    if (disposed) {
      return;
    }
    const status = terminalStatus(span);
    const generation = status === "Applied" ? ++operationGeneration : operationGeneration;
    if (status === "Applied") {
      consumePending("superseded");
    }
    const commandId = readCommandId(span);
    if (!isCurrent(generation)) {
      return;
    }
    const knownCommandId = isCutCommandId(commandId) ? commandId : undefined;
    const inputKey = `${isBodySpan(span) ? "body" : "terrain"}:${knownCommandId ?? ""}`;
    const input = status && knownCommandId ? inputs.get(inputKey) : undefined;
    if (status && knownCommandId) {
      inputs.delete(inputKey);
      if (!input) {
        drop("missingInput");
      }
    }
    const raw = readRawSpan(span);
    if (!isCurrent(generation)) {
      return;
    }
    if (!raw) {
      if (isCurrent(generation)) {
        drop("invalidSpan");
      }
      return;
    }
    const parent = readParentOrigin();
    if (!isCurrent(generation)) {
      return;
    }
    if (parent.value === undefined) {
      drop(parent.reason ?? "invalidSpan");
      return;
    }
    const timing = translatedTiming(raw, parent.value);
    if (!timing) {
      drop("invalidSpan");
      return;
    }
    relay(raw, timing, generation);
    if (!isCurrent(generation)) {
      return;
    }
    const submitted = raw.thread === "main" && (raw.phase === "cutSubmittedMs" || raw.phase === "cutBodySubmittedMs");
    if (submitted) {
      if (inputs.has(inputKey)) {
        drop("invalidSpan");
      } else if (!activeInput) {
        // A producer marker without the real confirm callback is not input evidence.
      } else if (inputs.size >= HVP_CUT_MAX_INPUTS) {
        drop("overflow");
      } else {
        inputs.set(inputKey, activeInput);
        // Bind the real confirm time before a terminal exists, including timeouts.
        const marker: HvpRawSpan = {commandId: raw.commandId, thread: "main",
          phase: isBodySpan(raw) ? "cutBodyInputMs" : "cutInputMs",
          origin: activeInput.origin, start: activeInput.start, duration: 0};
        const inputTiming = translatedTiming(marker, parent.value);
        if (inputTiming) {
          relay(marker, inputTiming, generation);
        } else {
          drop("invalidSpan");
        }
      }
      return;
    }
    if (status) {
      handleTerminal(raw, status, input, timing, generation);
    }
  };

  const readFrameForRender = (bodyCommandId?: string): HvpCutRenderFacts | undefined => {
    try {
      return bodyCommandId === undefined ? readFrame() : readFrame(bodyCommandId);
    } catch {
      return undefined;
    }
  };

  const comparePending = (candidate: HvpPendingRender, facts: HvpCutRenderFacts): HvpCutDropReason | undefined => {
    try {
      const status = factsStatus(facts);
      if (status !== "valid") {
        return status;
      }
      let expectedRoot: HvpTerrainSnapshot | undefined;
      try {
        expectedRoot = candidate.root.deref();
      } catch {
        return "collectedRoot";
      }
      if (!expectedRoot) {
        return "collectedRoot";
      }
      if (facts.root !== expectedRoot || !sameKeys(candidate.activeTerrainKeys, facts.activeTerrainKeys)
        || !sameKeys(candidate.activeTerrainKeys, facts.visibleTerrainKeys)) {
        return "superseded";
      }
      if (facts.root.revision !== candidate.revision || facts.root.sourceDigest !== candidate.digest
        || facts.nativeGeneration !== candidate.nativeGeneration || facts.recoveryHold) {
        return "invalidFrame";
      }
      if (candidate.body) {
        const status = bodyFactsStatus(facts.body, candidate.commandId);
        if (status !== "valid") { return status; }
        const body = facts.body!, saved = candidate.body;
        if (saved.outcome.deref() !== body.outcome || saved.sequence !== body.nativeSequence || saved.parentId !== body.receipt.parentId
          || !sameKeys(saved.activeKeys, body.activeKeys) || saved.children.length !== body.children.length
          || saved.children.some((child, index) => { const next = body.children[index]!;
            return child.ownerId !== next.ownerId || child.sourceDigest !== next.sourceDigest || child.renderKey !== next.renderKey;
          })) { return "superseded"; }
      }
      return undefined;
    } catch {
      return "invalidFrame";
    }
  };

  const render = (run: () => RenderCommandResult): RenderCommandResult => {
    const candidate = pending;
    if (disposed || !candidate) {
      return run();
    }
    const generation = operationGeneration;
    let preClockValid = true;
    try {
      const preClock = performance.now();
      if (!isFiniteNonNegative(preClock)) {
        preClockValid = false;
      }
    } catch {
      preClockValid = false;
    }
    if (!isCurrent(generation)) {
      return run();
    }
    if (!preClockValid) {
      consumePending("diagnosticFailure");
      return run();
    }
    const before = readFrameForRender(candidate.body ? candidate.commandId : undefined);
    if (!isCurrent(generation)) {
      return run();
    }
    if (!before) {
      consumePending("invalidFrame");
      return run();
    } else {
      const reason = comparePending(candidate, before);
      if (!isCurrent(generation) || pending !== candidate) {
        return run();
      }
      if (reason) {
        consumePending(reason);
        return run();
      }
    }
    if (!isCurrent(generation) || pending !== candidate) {
      return run();
    }
    let result: RenderCommandResult;
    try {
      result = run();
    } catch (error) {
      throw error;
    }
    if (!isCurrent(generation)) {
      return result;
    }
    let end: number;
    let endOrigin: number;
    try {
      end = performance.now();
      endOrigin = performance.timeOrigin;
    } catch {
      if (isCurrent(generation) && pending === candidate) {
        consumePending("diagnosticFailure");
      }
      return result;
    }
    if (!isCurrent(generation) || pending !== candidate) {
      return result;
    }
    if (!isFiniteNonNegative(end) || !isFiniteNonNegative(endOrigin)) {
      consumePending("diagnosticFailure");
      return result;
    }
    const after = readFrameForRender(candidate.body ? candidate.commandId : undefined);
    if (!isCurrent(generation) || pending !== candidate) {
      return result;
    }
    if (!after) {
      consumePending("invalidFrame");
      return result;
    }
    const reason = comparePending(candidate, after);
    if (!isCurrent(generation) || pending !== candidate) {
      return result;
    }
    if (reason) {
      consumePending(reason);
      return result;
    }
    if (!isCurrent(generation) || pending !== candidate) {
      return result;
    }
    let accepted = false;
    try {
      accepted = result.status === "Accepted";
    } catch {
      if (isCurrent(generation) && pending === candidate) {
        consumePending("invalidFrame");
      }
      return result;
    }
    if (!isCurrent(generation) || pending !== candidate) {
      return result;
    }
    if (!accepted) {
      return result;
    }
    const parent = readParentOrigin();
    if (!isCurrent(generation) || pending !== candidate) {
      return result;
    }
    if (parent.value === undefined) {
      consumePending(parent.reason ?? "diagnosticFailure");
      return result;
    }
    const start = candidate.input.origin - parent.value + candidate.input.start;
    const duration = endOrigin + end - (candidate.input.origin + candidate.input.start);
    if (!isFiniteNonNegative(start) || !isFiniteNonNegative(duration)
      || !Number.isFinite(candidate.input.origin + candidate.input.start)) {
      consumePending("invalidSpan");
      return result;
    }
    pending = undefined;
    try {
      sink.record(candidate.body ? "cutBodyFirstCommittedRenderSubmitMs" : "cutFirstCommittedRenderSubmitMs", start, duration, Object.freeze({
        commandId: candidate.commandId, savedRevision: candidate.revision, savedDigest: candidate.digest,
        nativeGeneration: candidate.nativeGeneration, activeTerrainKeys: candidate.activeTerrainKeys,
        rootIdentityMatches: true, activeKeysMatch: true, visibleKeysMatch: true,
        nativeGenerationMatches: true, recoveryHold: false,
        ...(candidate.body ? { bodySequence: candidate.body.sequence, parentId: candidate.body.parentId,
          children: candidate.body.children, activeBodyKeys: candidate.body.activeKeys, outcomeIdentityMatches: true } : {})
      }));
    } catch {
      if (isCurrent(generation)) {
        drop("diagnosticFailure");
      }
    }
    return result;
  };

  const read = (): HvpCutObservationState => Object.freeze({ inputCount: inputs.size, pendingRender: pending !== undefined,
    disposed, dropped, dropReasons: Object.freeze({ ...drops }) });

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    operationGeneration += 1;
    if (inputs.size > 0) {
      drop("disposed", inputs.size);
      inputs.clear();
    }
    if (pending) {
      pending = undefined;
      drop("disposed");
    }
    activeInput = undefined;
  };

  return { confirm, trace, render, read, dispose };
}
