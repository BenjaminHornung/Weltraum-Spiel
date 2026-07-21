import type {
  DomainEvent,
  ExternalReferenceId,
  JsonObject,
  PersistenceSignature,
  SimulationMode,
  SimulationTick,
  StableInstanceId,
  UniverseTime
} from "../persistence/index";

export type SimulationJobId = ExternalReferenceId & { readonly __simulationJobIdBrand: "SimulationJobId" };
export type SimulationJobDefinitionId = ExternalReferenceId & {
  readonly __simulationJobDefinitionIdBrand: "SimulationJobDefinitionId";
};

export const SIMULATION_JOB_PRIORITIES = Object.freeze(["Critical", "High", "Normal", "Low"] as const);
export type SimulationJobPriority = (typeof SIMULATION_JOB_PRIORITIES)[number];
export type DormantWakePolicy = "ExplicitWake";

export interface SimulationJobDefinition {
  readonly definitionId: SimulationJobDefinitionId;
  readonly kind: string;
  readonly allowedModes: readonly SimulationMode[];
  readonly cadenceTicks: number;
  readonly costUnits: number;
  readonly priority: SimulationJobPriority;
  readonly maxCatchUpExecutions: number;
  readonly payloadSchemaVersion: number;
  readonly executionPayload: JsonObject;
  readonly resultContractVersion: number;
  readonly dormantWakePolicy: DormantWakePolicy;
}

export interface SimulationJobInstance {
  readonly jobId: SimulationJobId;
  readonly definitionId: SimulationJobDefinitionId;
  readonly ownerId: StableInstanceId;
  readonly revision: number;
  readonly mode: SimulationMode;
  readonly nextDueTick: SimulationTick | null;
  readonly lastPlannedTick: SimulationTick | null;
  readonly lastCompletedTick: SimulationTick | null;
  readonly failureCount: number;
  readonly paused: boolean;
  readonly cancelled: boolean;
  readonly facts: JsonObject;
}

export interface SchedulerBudgetPolicy {
  readonly maxCostUnits: number;
}

export interface SchedulerFairnessPolicy {
  readonly windowTicks: number;
}

export interface SchedulerResultReceipt {
  readonly jobId: SimulationJobId;
  readonly expectedRevision: number;
  readonly resultSignature: PersistenceSignature;
}

export interface SchedulerSnapshot {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly universeTime: UniverseTime;
  readonly definitions: readonly SimulationJobDefinition[];
  readonly jobs: readonly SimulationJobInstance[];
  readonly budget: SchedulerBudgetPolicy;
  readonly fairness: SchedulerFairnessPolicy;
  readonly resultReceipts: readonly SchedulerResultReceipt[];
}

export type JobExecutionReason = "Due" | "CatchUp";

export interface JobExecutionRequest {
  readonly jobId: SimulationJobId;
  readonly expectedRevision: number;
  readonly scheduledTick: SimulationTick;
  readonly sequence: number;
  readonly reason: JobExecutionReason;
  readonly costUnits: number;
  readonly payload: JsonObject;
}

export type SchedulerDeferredReason = "Budget" | "CatchUpCap";
export interface SchedulerDeferredExecution {
  readonly jobId: SimulationJobId;
  readonly reason: SchedulerDeferredReason;
  readonly dueCount: number;
  readonly selectedCount: number;
}

export type SchedulerBlockedReason =
  | "RevisionExhausted"
  | "NoNextDueTick"
  | "ModeNotAllowed"
  | "Paused"
  | "Cancelled"
  | "Dormant"
  | "NeedsReplan"
  | "NeedsPlayerAttention"
  | "Destroyed";

export interface SchedulerBlockedExecution {
  readonly jobId: SimulationJobId;
  readonly reason: SchedulerBlockedReason;
}

export type SchedulerDiagnosticCode =
  | "JOB_SELECTED"
  | "JOB_DEFERRED_BUDGET"
  | "JOB_CATCH_UP_CAPPED"
  | "JOB_BLOCKED";

export interface SchedulerDiagnostic {
  readonly code: SchedulerDiagnosticCode;
  readonly jobId: SimulationJobId;
  readonly facts: JsonObject;
}

export interface SchedulerPlan {
  readonly schemaVersion: 1;
  readonly sourceRevision: number;
  readonly sourceTime: UniverseTime;
  readonly requests: readonly JobExecutionRequest[];
  readonly deferred: readonly SchedulerDeferredExecution[];
  readonly blocked: readonly SchedulerBlockedExecution[];
  readonly nextWakeTick: SimulationTick | null;
  readonly totalCostUnits: number;
  readonly diagnostics: readonly SchedulerDiagnostic[];
  readonly canonicalBytes: string;
  readonly signature: PersistenceSignature;
}

export const JOB_EXECUTION_STATUSES = Object.freeze([
  "Completed",
  "RetryableFailure",
  "TerminalFailure",
  "NeedsReplan",
  "NeedsPlayerAttention",
  "Cancelled"
] as const);
export type JobExecutionStatus = (typeof JOB_EXECUTION_STATUSES)[number];

export type NextDueIntent =
  | { readonly kind: "KeepCadence" }
  | { readonly kind: "AtTick"; readonly tick: SimulationTick }
  | { readonly kind: "None" };

export interface JobExecutionResult {
  readonly jobId: SimulationJobId;
  readonly expectedRevision: number;
  readonly completionTick: SimulationTick;
  readonly status: JobExecutionStatus;
  readonly nextDue: NextDueIntent;
  readonly persistentEventIntents: readonly DomainEvent[];
  readonly facts: JsonObject;
}

export type SchedulerCommand =
  | { readonly kind: "Pause"; readonly jobId: SimulationJobId; readonly expectedRevision: number }
  | { readonly kind: "Resume"; readonly jobId: SimulationJobId; readonly expectedRevision: number }
  | { readonly kind: "Cancel"; readonly jobId: SimulationJobId; readonly expectedRevision: number }
  | {
      readonly kind: "Wake";
      readonly jobId: SimulationJobId;
      readonly expectedRevision: number;
      readonly nextDueTick: SimulationTick;
    };

export type SchedulerCommandRejectionReason =
  | "UnknownJob"
  | "RevisionMismatch"
  | "RevisionExhausted"
  | "AlreadyPaused"
  | "NotPaused"
  | "Cancelled"
  | "Destroyed"
  | "NeedsReplan"
  | "NeedsPlayerAttention"
  | "NotDormant";

export type SchedulerCommandDecision =
  | { readonly kind: "Accepted"; readonly snapshot: SchedulerSnapshot }
  | {
      readonly kind: "Rejected";
      readonly reason: SchedulerCommandRejectionReason;
      readonly snapshot: SchedulerSnapshot;
    };

export type ResultApplicationRejectionReason =
  | "UnknownJob"
  | "RevisionMismatch"
  | "RevisionExhausted"
  | "ModeNotAllowed"
  | "NoNextDueTick"
  | "NotDue"
  | "Paused"
  | "Cancelled"
  | "Dormant"
  | "NeedsReplan"
  | "NeedsPlayerAttention"
  | "Destroyed";
export type JobExecutionResultDecision =
  | {
      readonly kind: "Accepted";
      readonly snapshot: SchedulerSnapshot;
      readonly persistentEventIntents: readonly DomainEvent[];
    }
  | { readonly kind: "Idempotent"; readonly snapshot: SchedulerSnapshot; readonly persistentEventIntents: readonly [] }
  | { readonly kind: "Conflict"; readonly snapshot: SchedulerSnapshot; readonly persistentEventIntents: readonly [] }
  | {
      readonly kind: "Rejected";
      readonly reason: ResultApplicationRejectionReason;
      readonly snapshot: SchedulerSnapshot;
      readonly persistentEventIntents: readonly [];
    };

export interface SimulationSchedulerFixture {
  readonly name:
    | "mining-background"
    | "cargo-transfer"
    | "drone-survey"
    | "repair"
    | "mission-deadline-check"
    | "needs-player-attention"
    | "destroyed"
    | "dormant-outpost";
  readonly definition: SimulationJobDefinition;
  readonly job: SimulationJobInstance;
}
