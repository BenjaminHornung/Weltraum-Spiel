import { describe, expect, it } from "vitest";
import { createStableFixtureId, createUniverseClock } from "../../src/persistence/index";
import {
  applyJobExecutionResult,
  applySchedulerCommand,
  createSimulationSchedulerFixtureSnapshot,
  planSimulationScheduler,
  validateJobExecutionResult,
  validateSchedulerSnapshot,
  type JobExecutionResult,
  type SchedulerSnapshot
} from "../../src/simulation-scheduler/index";

type MutableRecord = Record<string, any>;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const miningJobId = "simulation-job:mining-background.0";
const dormantJobId = "simulation-job:dormant-outpost.0";
const attentionJobId = "simulation-job:needs-player-attention.0";

const jobFrom = (snapshot: SchedulerSnapshot, jobId: string) => snapshot.jobs.find((job) => job.jobId === jobId)!;

const eventIntent = (tick = 100) => ({
  eventId: createStableFixtureId("event", "scheduler-result", 0),
  type: "NeedsPlayerAttention" as const,
  universeTime: createUniverseClock(tick),
  sourceId: createStableFixtureId("ship", "scheduler-owner", 0),
  targetId: createStableFixtureId("player", "captain", 0),
  severity: "Warning" as const,
  actionRequired: true,
  payload: { reasonCode: "fixture" },
  status: "Pending" as const,
  acknowledgedAt: null
});

const result = (
  status: JobExecutionResult["status"] = "Completed",
  overrides: Partial<MutableRecord> = {}
): MutableRecord => ({
  jobId: miningJobId,
  expectedRevision: 0,
  completionTick: 100,
  status,
  nextDue: status === "TerminalFailure" || status === "Cancelled" ? { kind: "None" } : { kind: "KeepCadence" },
  persistentEventIntents: [],
  facts: { outcomeCode: status.toLowerCase() },
  ...overrides
});

describe("simulation scheduler commands", () => {
  it("applies Pause and Resume explicitly with job-revision CAS", () => {
    const source = createSimulationSchedulerFixtureSnapshot(100);
    const paused = applySchedulerCommand(source, { kind: "Pause", jobId: miningJobId, expectedRevision: 0 });
    expect(paused.kind).toBe("Accepted");
    if (paused.kind !== "Accepted") throw new Error("Pause was not accepted.");
    expect(jobFrom(paused.snapshot, miningJobId)).toMatchObject({ revision: 1, paused: true, mode: "Background" });
    expect(paused.snapshot.revision).toBe(1);
    expect(planSimulationScheduler(paused.snapshot).blocked).toContainEqual({ jobId: miningJobId, reason: "Paused" });

    const stale = applySchedulerCommand(paused.snapshot, { kind: "Resume", jobId: miningJobId, expectedRevision: 0 });
    expect(stale).toMatchObject({ kind: "Rejected", reason: "RevisionMismatch" });
    const resumed = applySchedulerCommand(paused.snapshot, { kind: "Resume", jobId: miningJobId, expectedRevision: 1 });
    expect(resumed.kind).toBe("Accepted");
    if (resumed.kind !== "Accepted") throw new Error("Resume was not accepted.");
    expect(jobFrom(resumed.snapshot, miningJobId)).toMatchObject({ revision: 2, paused: false, mode: "Background" });
    expect(Object.isFrozen(resumed)).toBe(true);
  });

  it("makes Cancel terminal and rejects later commands or results", () => {
    const source = createSimulationSchedulerFixtureSnapshot(100);
    const cancelled = applySchedulerCommand(source, { kind: "Cancel", jobId: miningJobId, expectedRevision: 0 });
    expect(cancelled.kind).toBe("Accepted");
    if (cancelled.kind !== "Accepted") throw new Error("Cancel was not accepted.");
    expect(jobFrom(cancelled.snapshot, miningJobId)).toMatchObject({
      revision: 1,
      cancelled: true,
      mode: "Destroyed",
      nextDueTick: null
    });
    expect(planSimulationScheduler(cancelled.snapshot).blocked).toContainEqual({ jobId: miningJobId, reason: "Cancelled" });
    expect(applySchedulerCommand(cancelled.snapshot, { kind: "Pause", jobId: miningJobId, expectedRevision: 1 }))
      .toMatchObject({ kind: "Rejected", reason: "Cancelled" });
    expect(applyJobExecutionResult(cancelled.snapshot, result("Completed", { expectedRevision: 1 })))
      .toMatchObject({ kind: "Rejected", reason: "Cancelled" });
  });

  it("uses Wake as the only Dormant-to-Background scheduler command and requires an explicit due tick", () => {
    const source = createSimulationSchedulerFixtureSnapshot(100);
    expect(applySchedulerCommand(source, { kind: "Resume", jobId: dormantJobId, expectedRevision: 0 }))
      .toMatchObject({ kind: "Rejected", reason: "NotPaused" });
    const woken = applySchedulerCommand(source, {
      kind: "Wake",
      jobId: dormantJobId,
      expectedRevision: 0,
      nextDueTick: 105
    });
    expect(woken.kind).toBe("Accepted");
    if (woken.kind !== "Accepted") throw new Error("Wake was not accepted.");
    const wokenJob = jobFrom(woken.snapshot, dormantJobId);
    expect(wokenJob).toMatchObject({ mode: "Background", nextDueTick: 105, revision: 1 });
    const isolated = validateSchedulerSnapshot({
      ...woken.snapshot,
      definitions: [woken.snapshot.definitions.find((definition) => definition.definitionId === wokenJob.definitionId)!],
      jobs: [wokenJob],
      resultReceipts: []
    });
    expect(planSimulationScheduler(isolated).nextWakeTick).toBe(105);
  });

  it("does not let Resume bypass NeedsReplan or NeedsPlayerAttention", () => {
    const source = clone(createSimulationSchedulerFixtureSnapshot(100)) as MutableRecord;
    const attention = source.jobs.find((job: MutableRecord) => job.jobId === attentionJobId)!;
    attention.paused = true;
    const validated = validateSchedulerSnapshot(source);
    expect(applySchedulerCommand(validated, { kind: "Resume", jobId: attentionJobId, expectedRevision: 0 }))
      .toMatchObject({ kind: "Rejected", reason: "NeedsPlayerAttention" });

    const replanSource = clone(validated) as MutableRecord;
    attention.mode = "NeedsReplan";
    replanSource.jobs.find((job: MutableRecord) => job.jobId === attentionJobId)!.mode = "NeedsReplan";
    const replan = validateSchedulerSnapshot(replanSource);
    expect(applySchedulerCommand(replan, { kind: "Resume", jobId: attentionJobId, expectedRevision: 0 }))
      .toMatchObject({ kind: "Rejected", reason: "NeedsReplan" });
  });
});

describe("simulation scheduler result application", () => {
  it("accepts a CAS result, advances revisions/cadence, and returns persistent events only as intents", () => {
    const source = createSimulationSchedulerFixtureSnapshot(100);
    const sourceBytes = JSON.stringify(source);
    const event = eventIntent();
    const decision = applyJobExecutionResult(source, result("Completed", { persistentEventIntents: [event] }));
    expect(decision.kind).toBe("Accepted");
    if (decision.kind !== "Accepted") throw new Error("Result was not accepted.");
    expect(jobFrom(decision.snapshot, miningJobId)).toMatchObject({
      revision: 1,
      lastPlannedTick: 100,
      lastCompletedTick: 100,
      failureCount: 0,
      nextDueTick: 70
    });
    expect(decision.snapshot.revision).toBe(1);
    expect(decision.snapshot.resultReceipts).toHaveLength(1);
    expect(decision.persistentEventIntents).toEqual([event]);
    expect(decision.snapshot).not.toHaveProperty("events");
    expect(JSON.stringify(source)).toBe(sourceBytes);
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.persistentEventIntents[0])).toBe(true);
  });

  it("rejects completion ticks before the currently due execution without mutation", () => {
    const source = createSimulationSchedulerFixtureSnapshot(100);
    const sourceBytes = JSON.stringify(source);

    expect(() => applyJobExecutionResult(source, result("Completed", { completionTick: 39 })))
      .toThrowError(expect.objectContaining({ code: "INVALID_VALUE", path: "/completionTick" }));
    expect(JSON.stringify(source)).toBe(sourceBytes);

    const atDue = applyJobExecutionResult(source, result("Completed", { completionTick: 40 }));
    expect(atDue.kind).toBe("Accepted");
  });

  it("uses durable receipts for idempotence and conflicting-repeat detection", () => {
    const source = createSimulationSchedulerFixtureSnapshot(100);
    const original = result("Completed");
    const accepted = applyJobExecutionResult(source, original);
    expect(accepted.kind).toBe("Accepted");
    if (accepted.kind !== "Accepted") throw new Error("Result was not accepted.");

    expect(applyJobExecutionResult(accepted.snapshot, clone(original))).toMatchObject({ kind: "Idempotent" });
    expect(applyJobExecutionResult(accepted.snapshot, { ...clone(original), facts: { outcomeCode: "different" } }))
      .toMatchObject({ kind: "Conflict" });

    const later = applySchedulerCommand(accepted.snapshot, { kind: "Pause", jobId: miningJobId, expectedRevision: 1 });
    expect(later.kind).toBe("Accepted");
    if (later.kind !== "Accepted") throw new Error("Pause was not accepted.");
    expect(jobFrom(later.snapshot, miningJobId).revision).toBe(2);
    expect(applyJobExecutionResult(later.snapshot, original)).toMatchObject({ kind: "Idempotent" });
  });

  it("rejects forged results while paused or without a currently due request", () => {
    const source = createSimulationSchedulerFixtureSnapshot(100);
    const paused = applySchedulerCommand(source, { kind: "Pause", jobId: miningJobId, expectedRevision: 0 });
    expect(paused.kind).toBe("Accepted");
    if (paused.kind !== "Accepted") throw new Error("Pause was not accepted.");
    expect(applyJobExecutionResult(paused.snapshot, result("Completed", { expectedRevision: 1 })))
      .toMatchObject({ kind: "Rejected", reason: "Paused" });
    expect(jobFrom(paused.snapshot, miningJobId).paused).toBe(true);

    const futureSource = clone(source) as MutableRecord;
    futureSource.jobs.find((job: MutableRecord) => job.jobId === miningJobId)!.nextDueTick = 101;
    expect(applyJobExecutionResult(validateSchedulerSnapshot(futureSource), result()))
      .toMatchObject({ kind: "Rejected", reason: "NotDue" });

    const noDueSource = clone(source) as MutableRecord;
    noDueSource.jobs.find((job: MutableRecord) => job.jobId === miningJobId)!.nextDueTick = null;
    expect(applyJobExecutionResult(validateSchedulerSnapshot(noDueSource), result()))
      .toMatchObject({ kind: "Rejected", reason: "NoNextDueTick" });
  });

  it("rejects commands and results when scheduler or job revision is exhausted", () => {
    const source = clone(createSimulationSchedulerFixtureSnapshot(100)) as MutableRecord;
    source.revision = Number.MAX_SAFE_INTEGER;
    const exhaustedScheduler = validateSchedulerSnapshot(source);
    expect(applySchedulerCommand(exhaustedScheduler, { kind: "Pause", jobId: miningJobId, expectedRevision: 0 }))
      .toMatchObject({ kind: "Rejected", reason: "RevisionExhausted" });
    expect(applyJobExecutionResult(exhaustedScheduler, result()))
      .toMatchObject({ kind: "Rejected", reason: "RevisionExhausted" });

    source.revision = 0;
    source.jobs.find((job: MutableRecord) => job.jobId === miningJobId)!.revision = Number.MAX_SAFE_INTEGER;
    const exhaustedJob = validateSchedulerSnapshot(source);
    expect(applyJobExecutionResult(exhaustedJob, result("Completed", { expectedRevision: Number.MAX_SAFE_INTEGER })))
      .toMatchObject({ kind: "Rejected", reason: "RevisionExhausted" });
  });

  it("rejects stale, future, and unknown job revisions without mutation", () => {
    const source = createSimulationSchedulerFixtureSnapshot(100);
    const future = applyJobExecutionResult(source, result("Completed", { expectedRevision: 1 }));
    expect(future).toMatchObject({ kind: "Rejected", reason: "RevisionMismatch", snapshot: source });
    const unknown = applyJobExecutionResult(source, result("Completed", {
      jobId: "simulation-job:unknown.0",
      expectedRevision: 0
    }));
    expect(unknown).toMatchObject({ kind: "Rejected", reason: "UnknownJob", snapshot: source });
  });

  it.each([
    ["NeedsReplan", "NeedsReplan"],
    ["NeedsPlayerAttention", "NeedsPlayerAttention"]
  ] as const)("transitions %s only to its matching blocked persistence mode", (status, mode) => {
    const source = createSimulationSchedulerFixtureSnapshot(100);
    const decision = applyJobExecutionResult(source, result(status));
    expect(decision.kind).toBe("Accepted");
    if (decision.kind !== "Accepted") throw new Error("Result was not accepted.");
    expect(jobFrom(decision.snapshot, miningJobId).mode).toBe(mode);
    expect(planSimulationScheduler(decision.snapshot).blocked).toContainEqual({ jobId: miningJobId, reason: mode });
    expect(applyJobExecutionResult(decision.snapshot, result("Completed", { expectedRevision: 1 })))
      .toMatchObject({ kind: "Rejected", reason: mode });
  });

  it("makes TerminalFailure destroyed and permanently non-executable", () => {
    const source = createSimulationSchedulerFixtureSnapshot(100);
    const terminal = applyJobExecutionResult(source, result("TerminalFailure"));
    expect(terminal.kind).toBe("Accepted");
    if (terminal.kind !== "Accepted") throw new Error("Terminal result was not accepted.");
    expect(jobFrom(terminal.snapshot, miningJobId)).toMatchObject({
      mode: "Destroyed",
      cancelled: true,
      failureCount: 1,
      nextDueTick: null
    });
    expect(planSimulationScheduler(terminal.snapshot).blocked).toContainEqual({ jobId: miningJobId, reason: "Cancelled" });
    expect(applyJobExecutionResult(terminal.snapshot, result("Completed", { expectedRevision: 1 })))
      .toMatchObject({ kind: "Rejected", reason: "Cancelled" });
  });

  it("validates result envelopes, event intents, unknown fields, and numeric identity fail-closed", () => {
    expect(() => validateJobExecutionResult({ ...result(), extra: true })).toThrow();
    expect(() => validateJobExecutionResult(result("Completed", { expectedRevision: -0 }))).toThrow();
    expect(() => validateJobExecutionResult(result("Completed", { completionTick: Number.POSITIVE_INFINITY }))).toThrow();
    expect(() => validateJobExecutionResult(result("Completed", {
      persistentEventIntents: [{ ...eventIntent(), payload: { message: "UI text is forbidden" } }]
    }))).toThrow();
    expect(() => validateJobExecutionResult(
      result("RetryableFailure", { nextDue: { kind: "None" } })
    )).toThrow();
    expect(() => validateJobExecutionResult(
      result("TerminalFailure", { nextDue: { kind: "KeepCadence" } })
    )).toThrow();
  });

  it("rejects result application while Dormant until an explicit Wake", () => {
    const source = createSimulationSchedulerFixtureSnapshot(100);
    expect(applyJobExecutionResult(source, result("Completed", {
      jobId: dormantJobId,
      expectedRevision: 0,
      nextDue: { kind: "AtTick", tick: 120 }
    }))).toMatchObject({ kind: "Rejected", reason: "Dormant" });
  });
});
