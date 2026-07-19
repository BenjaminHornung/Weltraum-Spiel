import {
  createPersistenceSignature,
  deepFreeze,
  failPersistenceValidation,
  transitionSimulationMode,
  type SimulationMode,
  type SimulationTick
} from "../persistence/index";
import type {
  JobExecutionResultDecision,
  NextDueIntent,
  SchedulerCommandDecision,
  SchedulerSnapshot,
  SimulationJobDefinition,
  SimulationJobInstance
} from "./types";
import { getStaticExecutionBlockReason } from "./eligibility";
import { validateJobExecutionResult, validateSchedulerCommand, validateSchedulerSnapshot } from "./validation";

const increment = (value: number, path: string): number => {
  if (value === Number.MAX_SAFE_INTEGER) {
    return failPersistenceValidation("INVALID_INTEGER", path, "Scheduler revision increment would exceed MAX_SAFE_INTEGER.");
  }
  return value + 1;
};

const EMPTY_EVENT_INTENTS = Object.freeze([]) as readonly [];

const replaceJob = (
  snapshot: SchedulerSnapshot,
  replacement: SimulationJobInstance,
  resultReceipts = snapshot.resultReceipts
): SchedulerSnapshot => validateSchedulerSnapshot({
  ...snapshot,
  revision: increment(snapshot.revision, "/revision"),
  jobs: snapshot.jobs.map((job) => job.jobId === replacement.jobId ? replacement : job),
  resultReceipts
});

const rejectedCommand = (
  snapshot: SchedulerSnapshot,
  reason: Extract<SchedulerCommandDecision, { readonly kind: "Rejected" }>["reason"]
): SchedulerCommandDecision => deepFreeze({ kind: "Rejected", reason, snapshot }) as SchedulerCommandDecision;

export const applySchedulerCommand = (source: unknown, commandSource: unknown): SchedulerCommandDecision => {
  const snapshot = validateSchedulerSnapshot(source);
  const command = validateSchedulerCommand(commandSource);
  const job = snapshot.jobs.find((candidate) => candidate.jobId === command.jobId);
  if (job === undefined) return rejectedCommand(snapshot, "UnknownJob");
  if (job.revision !== command.expectedRevision) return rejectedCommand(snapshot, "RevisionMismatch");
  if (snapshot.revision === Number.MAX_SAFE_INTEGER || job.revision === Number.MAX_SAFE_INTEGER) {
    return rejectedCommand(snapshot, "RevisionExhausted");
  }

  let replacement: SimulationJobInstance;
  switch (command.kind) {
    case "Pause":
      if (job.cancelled) return rejectedCommand(snapshot, "Cancelled");
      if (job.mode === "Destroyed") return rejectedCommand(snapshot, "Destroyed");
      if (job.paused) return rejectedCommand(snapshot, "AlreadyPaused");
      replacement = { ...job, revision: increment(job.revision, "/jobs/revision"), paused: true };
      break;
    case "Resume":
      if (job.cancelled) return rejectedCommand(snapshot, "Cancelled");
      if (job.mode === "Destroyed") return rejectedCommand(snapshot, "Destroyed");
      if (job.mode === "NeedsReplan") return rejectedCommand(snapshot, "NeedsReplan");
      if (job.mode === "NeedsPlayerAttention") return rejectedCommand(snapshot, "NeedsPlayerAttention");
      if (!job.paused) return rejectedCommand(snapshot, "NotPaused");
      replacement = { ...job, revision: increment(job.revision, "/jobs/revision"), paused: false };
      break;
    case "Cancel":
      if (job.cancelled) return rejectedCommand(snapshot, "Cancelled");
      if (job.mode === "Destroyed") return rejectedCommand(snapshot, "Destroyed");
      replacement = {
        ...job,
        revision: increment(job.revision, "/jobs/revision"),
        mode: transitionSimulationMode(job.mode, "Destroyed"),
        paused: false,
        cancelled: true,
        nextDueTick: null
      };
      break;
    case "Wake":
      if (job.cancelled) return rejectedCommand(snapshot, "Cancelled");
      if (job.mode === "Destroyed") return rejectedCommand(snapshot, "Destroyed");
      if (job.mode !== "Dormant") return rejectedCommand(snapshot, "NotDormant");
      replacement = {
        ...job,
        revision: increment(job.revision, "/jobs/revision"),
        mode: transitionSimulationMode(job.mode, "Background"),
        nextDueTick: command.nextDueTick,
        paused: false
      };
      break;
  }
  return deepFreeze({ kind: "Accepted", snapshot: replaceJob(snapshot, replacement) }) as SchedulerCommandDecision;
};

const rejectedResult = (
  snapshot: SchedulerSnapshot,
  reason: Extract<JobExecutionResultDecision, { readonly kind: "Rejected" }>["reason"]
): JobExecutionResultDecision => deepFreeze({
  kind: "Rejected",
  reason,
  snapshot,
  persistentEventIntents: EMPTY_EVENT_INTENTS
}) as JobExecutionResultDecision;

const nextDueTick = (
  job: SimulationJobInstance,
  definition: SimulationJobDefinition,
  intent: NextDueIntent
): SimulationTick | null => {
  switch (intent.kind) {
    case "None": return null;
    case "AtTick": return intent.tick;
    case "KeepCadence":
      if (job.nextDueTick === null) {
        return failPersistenceValidation("INVALID_VALUE", "/nextDue", "KeepCadence requires an existing next due tick.");
      }
      if (definition.cadenceTicks > Number.MAX_SAFE_INTEGER - job.nextDueTick) {
        return failPersistenceValidation("INVALID_INTEGER", "/nextDue", "Next due tick would exceed MAX_SAFE_INTEGER.");
      }
      return (job.nextDueTick + definition.cadenceTicks) as SimulationTick;
  }
};

export const applyJobExecutionResult = (source: unknown, resultSource: unknown): JobExecutionResultDecision => {
  const snapshot = validateSchedulerSnapshot(source);
  const result = validateJobExecutionResult(resultSource);
  const resultSignature = createPersistenceSignature(result);
  const existingReceipt = snapshot.resultReceipts.find((receipt) =>
    receipt.jobId === result.jobId && receipt.expectedRevision === result.expectedRevision
  );
  if (existingReceipt !== undefined) {
    return existingReceipt.resultSignature === resultSignature
      ? deepFreeze({ kind: "Idempotent", snapshot, persistentEventIntents: EMPTY_EVENT_INTENTS })
      : deepFreeze({ kind: "Conflict", snapshot, persistentEventIntents: EMPTY_EVENT_INTENTS });
  }

  const job = snapshot.jobs.find((candidate) => candidate.jobId === result.jobId);
  if (job === undefined) return rejectedResult(snapshot, "UnknownJob");
  if (job.revision !== result.expectedRevision) return rejectedResult(snapshot, "RevisionMismatch");
  const definition = snapshot.definitions.find((candidate) => candidate.definitionId === job.definitionId)!;
  const blockReason = getStaticExecutionBlockReason(snapshot.revision, job, definition);
  if (blockReason !== undefined) return rejectedResult(snapshot, blockReason);
  if (job.nextDueTick! > snapshot.universeTime.tick) return rejectedResult(snapshot, "NotDue");
  if (result.completionTick > snapshot.universeTime.tick) {
    return failPersistenceValidation(
      "INVALID_VALUE",
      "/completionTick",
      "Execution completion tick cannot be later than the snapshot Universe Time."
    );
  }
  if (
    (job.lastPlannedTick !== null && result.completionTick < job.lastPlannedTick) ||
    (result.status === "Completed" && job.lastCompletedTick !== null && result.completionTick < job.lastCompletedTick)
  ) {
    return failPersistenceValidation(
      "INVALID_VALUE",
      "/completionTick",
      "Execution completion tick cannot move scheduler history backward."
    );
  }
  for (const event of result.persistentEventIntents) {
    if (event.universeTime.tick > snapshot.universeTime.tick) {
      return failPersistenceValidation(
        "INVALID_VALUE",
        "/persistentEventIntents",
        "Persistent event intents cannot be later than the snapshot Universe Time."
      );
    }
  }
  let mode: SimulationMode = job.mode;
  let cancelled = false;
  let failureCount = job.failureCount;
  let completedTick = job.lastCompletedTick;
  let dueTick = result.status === "TerminalFailure" || result.status === "Cancelled"
    ? null
    : nextDueTick(job, definition, result.nextDue);
  switch (result.status) {
    case "Completed":
      completedTick = result.completionTick;
      failureCount = 0;
      break;
    case "RetryableFailure":
      failureCount = increment(failureCount, "/jobs/failureCount");
      break;
    case "TerminalFailure":
      failureCount = increment(failureCount, "/jobs/failureCount");
      mode = transitionSimulationMode(mode, "Destroyed");
      cancelled = true;
      dueTick = null;
      break;
    case "NeedsReplan":
      mode = transitionSimulationMode(mode, "NeedsReplan");
      break;
    case "NeedsPlayerAttention":
      mode = transitionSimulationMode(mode, "NeedsPlayerAttention");
      break;
    case "Cancelled":
      mode = transitionSimulationMode(mode, "Destroyed");
      cancelled = true;
      dueTick = null;
      break;
  }
  const replacement: SimulationJobInstance = {
    ...job,
    revision: increment(job.revision, "/jobs/revision"),
    mode,
    nextDueTick: dueTick,
    lastPlannedTick: result.completionTick,
    lastCompletedTick: completedTick,
    failureCount,
    paused: false,
    cancelled
  };
  const receipt = { jobId: result.jobId, expectedRevision: result.expectedRevision, resultSignature };
  const updated = replaceJob(snapshot, replacement, [...snapshot.resultReceipts, receipt]);
  return deepFreeze({
    kind: "Accepted",
    snapshot: updated,
    persistentEventIntents: result.persistentEventIntents
  }) as JobExecutionResultDecision;
};
