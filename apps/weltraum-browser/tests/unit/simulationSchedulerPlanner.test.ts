import { describe, expect, it } from "vitest";
import { createUniverseClock } from "../../src/persistence/index";
import {
  MINING_BACKGROUND_SCHEDULER_FIXTURE,
  createSimulationSchedulerFixtureSnapshot,
  planSimulationScheduler,
  validateSchedulerSnapshot,
  type SchedulerSnapshot,
  type SimulationJobPriority
} from "../../src/simulation-scheduler/index";

type MutableRecord = Record<string, any>;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const entry = (
  seed: string,
  priority: SimulationJobPriority,
  options: {
    readonly nextDueTick?: number;
    readonly lastPlannedTick?: number | null;
    readonly cadenceTicks?: number;
    readonly costUnits?: number;
    readonly maxCatchUpExecutions?: number;
    readonly mode?: string;
    readonly paused?: boolean;
    readonly cancelled?: boolean;
  } = {}
): { readonly definition: MutableRecord; readonly job: MutableRecord } => {
  const definition = clone(MINING_BACKGROUND_SCHEDULER_FIXTURE.definition) as MutableRecord;
  definition.definitionId = `simulation-job-definition:${seed}.v1`;
  definition.kind = `fixture.${seed}`;
  definition.priority = priority;
  definition.cadenceTicks = options.cadenceTicks ?? 10;
  definition.costUnits = options.costUnits ?? 1;
  definition.maxCatchUpExecutions = options.maxCatchUpExecutions ?? 1;
  const job = clone(MINING_BACKGROUND_SCHEDULER_FIXTURE.job) as MutableRecord;
  job.jobId = `simulation-job:${seed}.0`;
  job.definitionId = definition.definitionId;
  job.nextDueTick = options.nextDueTick ?? 100;
  job.lastPlannedTick = options.lastPlannedTick ?? null;
  job.mode = options.mode ?? "Background";
  job.paused = options.paused ?? false;
  job.cancelled = options.cancelled ?? false;
  job.facts = { seed };
  return { definition, job };
};

const snapshot = (
  entries: readonly ReturnType<typeof entry>[],
  tick = 100,
  budget = 100,
  fairnessWindow = 100
): SchedulerSnapshot => validateSchedulerSnapshot({
  schemaVersion: 1,
  revision: 7,
  universeTime: createUniverseClock(tick),
  definitions: entries.map((item) => item.definition),
  jobs: entries.map((item) => item.job),
  budget: { maxCostUnits: budget },
  fairness: { windowTicks: fairnessWindow },
  resultReceipts: []
});

describe("simulation scheduler deterministic planning", () => {
  it("produces byte-identical canonical plans and signatures for equivalent validated snapshots", () => {
    const first = clone(createSimulationSchedulerFixtureSnapshot(100)) as MutableRecord;
    const second = clone(first) as MutableRecord;
    second.definitions.reverse();
    second.jobs.reverse();
    const firstPlan = planSimulationScheduler(first);
    const secondPlan = planSimulationScheduler(second);

    expect(secondPlan.canonicalBytes).toBe(firstPlan.canonicalBytes);
    expect(secondPlan.signature).toBe(firstPlan.signature);
    expect(firstPlan.signature).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
    expect(firstPlan.canonicalBytes).not.toContain("canonicalBytes");
    expect(firstPlan.canonicalBytes).not.toContain("signature");
    expect(Object.isFrozen(firstPlan)).toBe(true);
    expect(Object.isFrozen(firstPlan.requests)).toBe(true);
    expect(Object.isFrozen(firstPlan.requests[0]!.payload)).toBe(true);
  });

  it("uses the fixed Critical, High, Normal, Low order with ASCII job-ID tie breaking", () => {
    const jobs = [
      entry("low", "Low"),
      entry("normal", "Normal"),
      entry("high", "High"),
      entry("critical", "Critical")
    ];
    const plan = planSimulationScheduler(snapshot(jobs));
    expect(plan.requests.map((request) => request.jobId)).toEqual([
      "simulation-job:critical.0",
      "simulation-job:high.0",
      "simulation-job:normal.0",
      "simulation-job:low.0"
    ]);

    const zeta = entry("zeta", "Normal");
    const alpha = entry("alpha", "Normal");
    expect(planSimulationScheduler(snapshot([zeta, alpha])).requests.map((request) => request.jobId)).toEqual([
      "simulation-job:alpha.0",
      "simulation-job:zeta.0"
    ]);
  });

  it("promotes a continuously due Low job to Critical after three fairness windows", () => {
    const low = entry("aged-low", "Low", { nextDueTick: 0, lastPlannedTick: 0, maxCatchUpExecutions: 1 });
    const high = entry("recent-high", "High", { nextDueTick: 0, lastPlannedTick: 300, maxCatchUpExecutions: 1 });
    const plan = planSimulationScheduler(snapshot([high, low], 300, 1, 100));

    expect(plan.requests[0]!.jobId).toBe("simulation-job:aged-low.0");
    expect(plan.diagnostics).toContainEqual(expect.objectContaining({
      code: "JOB_SELECTED",
      jobId: "simulation-job:aged-low.0",
      facts: expect.objectContaining({ effectivePriorityRank: 0 })
    }));
  });

  it("never exceeds budget and never partially charges an execution", () => {
    const tooExpensive = entry("expensive", "Critical", { costUnits: 5 });
    const plan = planSimulationScheduler(snapshot([tooExpensive], 100, 4));
    expect(plan.requests).toEqual([]);
    expect(plan.totalCostUnits).toBe(0);
    expect(plan.deferred).toContainEqual({
      jobId: "simulation-job:expensive.0",
      reason: "Budget",
      dueCount: 1,
      selectedCount: 0
    });
    expect(plan.nextWakeTick).toBeNull();
  });

  it("creates ascending catch-up requests with anticipated revisions and bounded huge-jump arithmetic", () => {
    const huge = entry("huge-jump", "Normal", {
      nextDueTick: 0,
      cadenceTicks: 1,
      costUnits: 1,
      maxCatchUpExecutions: 4
    });
    huge.job.revision = 9;
    const plan = planSimulationScheduler(snapshot([huge], Number.MAX_SAFE_INTEGER, 4, 10));

    expect(plan.requests.map((request) => ({
      tick: request.scheduledTick,
      sequence: request.sequence,
      revision: request.expectedRevision,
      reason: request.reason
    }))).toEqual([
      { tick: 0, sequence: 0, revision: 9, reason: "Due" },
      { tick: 1, sequence: 1, revision: 10, reason: "CatchUp" },
      { tick: 2, sequence: 2, revision: 11, reason: "CatchUp" },
      { tick: 3, sequence: 3, revision: 12, reason: "CatchUp" }
    ]);
    expect(plan.deferred).toContainEqual(expect.objectContaining({
      jobId: "simulation-job:huge-jump.0",
      reason: "CatchUpCap",
      dueCount: Number.MAX_SAFE_INTEGER
    }));
    expect(plan.totalCostUnits).toBe(4);
  });

  it("explains paused, cancelled, dormant, attention, replan, destroyed, and mode-blocked jobs", () => {
    const paused = entry("paused", "Normal", { paused: true });
    const cancelled = entry("cancelled", "Normal", { cancelled: true });
    const dormant = entry("dormant", "Normal", { mode: "Dormant" });
    const attention = entry("attention", "Normal", { mode: "NeedsPlayerAttention" });
    const replan = entry("replan", "Normal", { mode: "NeedsReplan" });
    const destroyed = entry("destroyed", "Normal", { mode: "Destroyed" });
    const disallowed = entry("disallowed", "Normal", { mode: "Active" });
    disallowed.definition.allowedModes = ["Background"];
    const plan = planSimulationScheduler(snapshot([
      paused,
      cancelled,
      dormant,
      attention,
      replan,
      destroyed,
      disallowed
    ]));
    expect(Object.fromEntries(plan.blocked.map((record) => [record.jobId, record.reason]))).toEqual({
      "simulation-job:attention.0": "NeedsPlayerAttention",
      "simulation-job:cancelled.0": "Cancelled",
      "simulation-job:destroyed.0": "Destroyed",
      "simulation-job:disallowed.0": "ModeNotAllowed",
      "simulation-job:dormant.0": "Dormant",
      "simulation-job:paused.0": "Paused",
      "simulation-job:replan.0": "NeedsReplan"
    });
    expect(plan.requests).toHaveLength(0);
  });

  it("blocks exhausted scheduler and job revisions without an immediate-wake livelock", () => {
    const exhaustedJob = entry("exhausted-job", "Critical");
    exhaustedJob.job.revision = Number.MAX_SAFE_INTEGER;
    const jobPlan = planSimulationScheduler(snapshot([exhaustedJob]));
    expect(jobPlan.requests).toEqual([]);
    expect(jobPlan.blocked).toEqual([{
      jobId: "simulation-job:exhausted-job.0",
      reason: "RevisionExhausted"
    }]);
    expect(jobPlan.nextWakeTick).toBeNull();

    const schedulerSource = clone(snapshot([entry("scheduler-exhausted", "Critical")])) as MutableRecord;
    schedulerSource.revision = Number.MAX_SAFE_INTEGER;
    const schedulerPlan = planSimulationScheduler(schedulerSource);
    expect(schedulerPlan.requests).toEqual([]);
    expect(schedulerPlan.blocked[0]).toMatchObject({ reason: "RevisionExhausted" });
    expect(schedulerPlan.nextWakeTick).toBeNull();
  });
});
