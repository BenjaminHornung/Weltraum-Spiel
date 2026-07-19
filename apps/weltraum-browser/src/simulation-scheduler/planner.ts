import {
  canonicalizePersistenceValue,
  createPersistenceSignature,
  deepFreeze,
  serializeCanonicalPersistenceValue,
  type JsonObject,
  type SimulationTick
} from "../persistence/index";
import type {
  JobExecutionRequest,
  SchedulerBlockedExecution,
  SchedulerDeferredExecution,
  SchedulerDiagnostic,
  SchedulerPlan,
  SimulationJobDefinition,
  SimulationJobInstance,
  SimulationJobPriority
} from "./types";
import { getStaticExecutionBlockReason } from "./eligibility";
import { validateSchedulerSnapshot } from "./validation";

const PRIORITY_RANKS: Readonly<Record<SimulationJobPriority, number>> = Object.freeze({
  Critical: 0,
  High: 1,
  Normal: 2,
  Low: 3
});

interface Candidate {
  readonly job: SimulationJobInstance;
  readonly definition: SimulationJobDefinition;
  readonly effectiveRank: number;
  readonly dueCount: number;
  readonly schedulableCount: number;
  readonly catchUpCapped: boolean;
}

const compareAscii = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const dueCounts = (
  now: number,
  nextDue: number,
  cadence: number,
  maximum: number,
  revision: number
): { readonly dueCount: number; readonly schedulableCount: number; readonly capped: boolean } => {
  const quotient = Math.floor((now - nextDue) / cadence);
  const saturatedDueCount = quotient === Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : quotient + 1;
  const revisionCapacity = Number.MAX_SAFE_INTEGER - revision;
  const schedulableCount = Math.min(saturatedDueCount, maximum, revisionCapacity);
  return {
    dueCount: saturatedDueCount,
    schedulableCount,
    capped: quotient >= maximum || quotient >= revisionCapacity
  };
};

const updateMinimum = (current: SimulationTick | null, candidate: number): SimulationTick | null =>
  Number.isSafeInteger(candidate) && candidate >= 0 && (current === null || candidate < current)
    ? candidate as SimulationTick
    : current;

export const planSimulationScheduler = (source: unknown): SchedulerPlan => {
  const snapshot = validateSchedulerSnapshot(source);
  const definitionsById = new Map(snapshot.definitions.map((definition) => [definition.definitionId, definition]));
  const blocked: SchedulerBlockedExecution[] = [];
  const deferred: SchedulerDeferredExecution[] = [];
  const diagnostics: SchedulerDiagnostic[] = [];
  const candidates: Candidate[] = [];
  let nextWakeTick: SimulationTick | null = null;
  let hasDeferredDueWork = false;

  for (const job of snapshot.jobs) {
    const definition = definitionsById.get(job.definitionId)!;
    const reason = getStaticExecutionBlockReason(snapshot.revision, job, definition);
    if (reason !== undefined) {
      blocked.push({ jobId: job.jobId, reason });
      diagnostics.push({ code: "JOB_BLOCKED", jobId: job.jobId, facts: { reason } });
      continue;
    }
    const nextDueTick = job.nextDueTick!;
    if (nextDueTick > snapshot.universeTime.tick) {
      nextWakeTick = updateMinimum(nextWakeTick, nextDueTick);
      continue;
    }
    const counts = dueCounts(
      snapshot.universeTime.tick,
      nextDueTick,
      definition.cadenceTicks,
      definition.maxCatchUpExecutions,
      job.revision
    );
    const waitingOrigin = job.lastPlannedTick ?? nextDueTick;
    const waitingAge = snapshot.universeTime.tick - waitingOrigin;
    const promotions = Math.floor(waitingAge / snapshot.fairness.windowTicks);
    candidates.push({
      job,
      definition,
      effectiveRank: Math.max(0, PRIORITY_RANKS[definition.priority] - promotions),
      dueCount: counts.dueCount,
      schedulableCount: counts.schedulableCount,
      catchUpCapped: counts.capped
    });
  }

  candidates.sort((left, right) =>
    left.effectiveRank - right.effectiveRank ||
    left.job.nextDueTick! - right.job.nextDueTick! ||
    (left.job.lastPlannedTick === null && right.job.lastPlannedTick === null
      ? 0
      : left.job.lastPlannedTick === null
        ? -1
        : right.job.lastPlannedTick === null
          ? 1
          : left.job.lastPlannedTick - right.job.lastPlannedTick) ||
    compareAscii(left.job.jobId, right.job.jobId)
  );

  const requests: JobExecutionRequest[] = [];
  let totalCostUnits = 0;
  for (const candidate of candidates) {
    let selectedCount = 0;
    const canonicalPayload = canonicalizePersistenceValue<JsonObject>({
      definitionKind: candidate.definition.kind,
      payloadSchemaVersion: candidate.definition.payloadSchemaVersion,
      resultContractVersion: candidate.definition.resultContractVersion,
      definitionPayload: candidate.definition.executionPayload,
      jobFacts: candidate.job.facts,
      ownerId: candidate.job.ownerId
    }) as JsonObject;
    for (let sequence = 0; sequence < candidate.schedulableCount; sequence += 1) {
      if (candidate.definition.costUnits > snapshot.budget.maxCostUnits - totalCostUnits) {
        break;
      }
      const scheduledTick = candidate.job.nextDueTick! + sequence * candidate.definition.cadenceTicks;
      requests.push({
        jobId: candidate.job.jobId,
        expectedRevision: candidate.job.revision + sequence,
        scheduledTick: scheduledTick as SimulationTick,
        sequence,
        reason: sequence === 0 ? "Due" : "CatchUp",
        costUnits: candidate.definition.costUnits,
        payload: canonicalPayload
      });
      selectedCount += 1;
      totalCostUnits += candidate.definition.costUnits;
    }
    if (selectedCount < candidate.schedulableCount) {
      deferred.push({
        jobId: candidate.job.jobId,
        reason: "Budget",
        dueCount: candidate.dueCount,
        selectedCount
      });
      diagnostics.push({
        code: "JOB_DEFERRED_BUDGET",
        jobId: candidate.job.jobId,
        facts: { dueCount: candidate.dueCount, selectedCount }
      });
      hasDeferredDueWork = true;
    }
    if (candidate.catchUpCapped) {
      deferred.push({
        jobId: candidate.job.jobId,
        reason: "CatchUpCap",
        dueCount: candidate.dueCount,
        selectedCount
      });
      diagnostics.push({
        code: "JOB_CATCH_UP_CAPPED",
        jobId: candidate.job.jobId,
        facts: { dueCount: candidate.dueCount, maximum: candidate.schedulableCount }
      });
      hasDeferredDueWork = true;
    }
    if (selectedCount > 0) {
      diagnostics.push({
        code: "JOB_SELECTED",
        jobId: candidate.job.jobId,
        facts: { effectivePriorityRank: candidate.effectiveRank, selectedCount }
      });
    }
    if (selectedCount === candidate.dueCount && !candidate.catchUpCapped) {
      const followingTick = candidate.job.nextDueTick! + candidate.dueCount * candidate.definition.cadenceTicks;
      nextWakeTick = updateMinimum(nextWakeTick, followingTick);
    }
  }
  if (hasDeferredDueWork && requests.length > 0) {
    nextWakeTick = updateMinimum(nextWakeTick, snapshot.universeTime.tick);
  }

  const unsignedPlan = {
    schemaVersion: 1,
    sourceRevision: snapshot.revision,
    sourceTime: snapshot.universeTime,
    requests,
    deferred,
    blocked,
    nextWakeTick,
    totalCostUnits,
    diagnostics
  } as const;
  const canonicalBytes = serializeCanonicalPersistenceValue(unsignedPlan);
  const signature = createPersistenceSignature(unsignedPlan);
  return deepFreeze({ ...unsignedPlan, canonicalBytes, signature }) as SchedulerPlan;
};
