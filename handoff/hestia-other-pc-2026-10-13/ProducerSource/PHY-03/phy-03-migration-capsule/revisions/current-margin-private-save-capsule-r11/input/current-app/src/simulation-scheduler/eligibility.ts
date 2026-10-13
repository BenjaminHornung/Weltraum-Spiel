import type {
  SchedulerBlockedReason,
  SimulationJobDefinition,
  SimulationJobInstance
} from "./types";

/** Shared static execution gate. Due-time comparison remains caller-specific. */
export const getStaticExecutionBlockReason = (
  schedulerRevision: number,
  job: SimulationJobInstance,
  definition: SimulationJobDefinition
): SchedulerBlockedReason | undefined => {
  if (schedulerRevision === Number.MAX_SAFE_INTEGER || job.revision === Number.MAX_SAFE_INTEGER) {
    return "RevisionExhausted";
  }
  if (job.cancelled) return "Cancelled";
  if (job.mode === "Destroyed") return "Destroyed";
  if (job.paused) return "Paused";
  if (job.mode === "Dormant") return "Dormant";
  if (job.mode === "NeedsReplan") return "NeedsReplan";
  if (job.mode === "NeedsPlayerAttention") return "NeedsPlayerAttention";
  if (!definition.allowedModes.includes(job.mode)) return "ModeNotAllowed";
  if (job.nextDueTick === null) return "NoNextDueTick";
  return undefined;
};
