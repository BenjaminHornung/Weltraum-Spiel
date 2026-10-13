import type {
  DomainEvent,
  ExternalReferenceId,
  JsonObject,
  JsonPrimitive,
  MissionId,
  MissionTime,
  PersistenceSignature,
  PlayerId,
  SimulationTick,
  StableInstanceId,
  UniverseTime
} from "../persistence/index";

export const MISSION_SCHEMA_VERSION = 1 as const;

export type MissionDefinitionId = ExternalReferenceId;
export type ObjectiveId = ExternalReferenceId;
export type ResourceDefinitionId = ExternalReferenceId;
export type ItemDefinitionId = ExternalReferenceId;
export type FactionDefinitionId = ExternalReferenceId;
export type UnlockDefinitionId = ExternalReferenceId;
export type MissionCommandId = ExternalReferenceId;

export const MISSION_STATES = Object.freeze([
  "Offered",
  "Accepted",
  "Active",
  "Completed",
  "Failed",
  "Abandoned",
  "Expired",
  "RewardClaimed"
] as const);
export type MissionState = (typeof MISSION_STATES)[number];

export const OBJECTIVE_STATES = Object.freeze([
  "Locked",
  "Available",
  "Active",
  "Completed",
  "Failed",
  "Skipped"
] as const);
export type ObjectiveState = (typeof OBJECTIVE_STATES)[number];

export type MissionKind = "Survey" | "Extraction" | "Repair" | "Recovery" | "Protection" | "Courier";
export type ObjectiveGraphMode = "Sequential" | "ParallelAll" | "ParallelAny";
export type ObjectiveRequirementMode = "Required" | "Optional";

export type EligibilityRequirement =
  | { readonly kind: "FactPresent"; readonly factKey: string }
  | { readonly kind: "FactEquals"; readonly factKey: string; readonly expected: JsonPrimitive }
  | { readonly kind: "FactAtLeast"; readonly factKey: string; readonly minimum: number };

export type MissionObjectiveDescriptor =
  | { readonly kind: "ReachTarget"; readonly targetId: StableInstanceId }
  | { readonly kind: "SurveyTarget"; readonly targetId: StableInstanceId; readonly sampleCount: number }
  | { readonly kind: "InteractWithTarget"; readonly targetId: StableInstanceId }
  | { readonly kind: "ExtractResource"; readonly resourceId: ResourceDefinitionId; readonly quantity: number }
  | { readonly kind: "DeliverResource"; readonly resourceId: ResourceDefinitionId; readonly quantity: number }
  | { readonly kind: "RepairTarget"; readonly targetId: StableInstanceId; readonly requiredAmount: number }
  | { readonly kind: "RecoverItem"; readonly itemDefinitionId: ItemDefinitionId }
  | { readonly kind: "ProtectTarget"; readonly targetId: StableInstanceId; readonly untilTick: SimulationTick }
  | { readonly kind: "WaitUntilTick"; readonly tick: SimulationTick };

export interface MissionObjectiveDefinition {
  readonly objectiveId: ObjectiveId;
  readonly requirementMode: ObjectiveRequirementMode;
  readonly hiddenUntilPrerequisitesMet: boolean;
  readonly prerequisiteObjectiveIds: readonly ObjectiveId[];
  readonly descriptor: MissionObjectiveDescriptor;
}

export interface MissionObjectiveGraph {
  readonly mode: ObjectiveGraphMode;
  readonly objectives: readonly MissionObjectiveDefinition[];
}

export type MissionFailureCondition =
  | { readonly kind: "AnyRequiredObjectiveFailed" }
  | { readonly kind: "ObjectiveFailed"; readonly objectiveId: ObjectiveId }
  | { readonly kind: "UniverseTickReached"; readonly tick: SimulationTick };

export type MissionExpiryPolicy =
  | { readonly kind: "None" }
  | { readonly kind: "AbsoluteUniverseTick"; readonly tick: SimulationTick }
  | { readonly kind: "TicksAfterAcceptance"; readonly ticks: SimulationTick };

export type MissionOutcomeDescriptor =
  | {
      readonly kind: "Resource";
      readonly resourceId: ResourceDefinitionId;
      readonly quantity: number;
      readonly currencyLike: boolean;
    }
  | { readonly kind: "Item"; readonly itemDefinitionId: ItemDefinitionId; readonly quantity: number }
  | { readonly kind: "ReputationDelta"; readonly factionId: FactionDefinitionId; readonly delta: number }
  | { readonly kind: "LicenseUnlock"; readonly licenseId: UnlockDefinitionId }
  | { readonly kind: "MissionChainUnlock"; readonly missionDefinitionId: MissionDefinitionId };

export interface MissionDefinition {
  readonly definitionId: MissionDefinitionId;
  readonly schemaVersion: typeof MISSION_SCHEMA_VERSION;
  readonly missionKind: MissionKind;
  readonly issuerId: StableInstanceId;
  readonly contentKey: string;
  readonly eligibilityRequirements: readonly EligibilityRequirement[];
  readonly objectiveGraph: MissionObjectiveGraph;
  readonly failureConditions: readonly MissionFailureCondition[];
  readonly expiryPolicy: MissionExpiryPolicy;
  readonly rewardDescriptors: readonly MissionOutcomeDescriptor[];
  readonly penaltyDescriptors: readonly MissionOutcomeDescriptor[];
  readonly legalityTags: readonly string[];
  readonly definitionsVersion: string;
}

export interface MissionObjectiveProgressSnapshot {
  readonly count: number;
  readonly measuredAmount: number;
  readonly resourceQuantity: number;
  readonly targetMatched: boolean;
  readonly itemMatched: boolean;
  readonly tick: SimulationTick;
  readonly facts: JsonObject;
}

export interface MissionObjectiveInstanceState {
  readonly objectiveId: ObjectiveId;
  readonly state: ObjectiveState;
  readonly progress: MissionObjectiveProgressSnapshot;
}

export type MissionProgress =
  | { readonly kind: "Count"; readonly amount: number }
  | { readonly kind: "MeasuredAmount"; readonly amount: number }
  | { readonly kind: "ResourceQuantity"; readonly resourceId: ResourceDefinitionId; readonly quantity: number }
  | { readonly kind: "Target"; readonly targetId: StableInstanceId }
  | { readonly kind: "Item"; readonly itemDefinitionId: ItemDefinitionId }
  | { readonly kind: "Tick"; readonly tick: SimulationTick }
  | { readonly kind: "MachineFacts"; readonly facts: JsonObject };

export type MissionEventKind =
  | "MissionOffered"
  | "MissionAccepted"
  | "MissionActivated"
  | "ObjectiveProgressApplied"
  | "ObjectiveCompleted"
  | "ObjectiveFailed"
  | "ObjectiveSkipped"
  | "MissionCompleted"
  | "MissionFailed"
  | "MissionAbandoned"
  | "MissionExpired"
  | "MissionRewardClaimed";

export interface MissionOutcomeIntent {
  readonly disposition: "Reward" | "Penalty";
  readonly missionId: MissionId;
  readonly ownerId: PlayerId;
  readonly issuerId: StableInstanceId;
  readonly descriptor: MissionOutcomeDescriptor;
}

export interface MissionReplayRecord {
  readonly commandId: MissionCommandId;
  readonly expectedRevision: number;
  readonly fingerprint: PersistenceSignature;
  readonly eventIntents: readonly DomainEvent[];
  readonly outcomeIntents: readonly MissionOutcomeIntent[];
}

export interface MissionInstance {
  readonly missionId: MissionId;
  readonly definitionReference: {
    readonly definitionId: MissionDefinitionId;
    readonly definitionsVersion: string;
    readonly schemaVersion: typeof MISSION_SCHEMA_VERSION;
    readonly definitionSignature: PersistenceSignature;
  };
  readonly ownerId: PlayerId;
  readonly issuerId: StableInstanceId;
  readonly state: MissionState;
  readonly revision: number;
  readonly acceptedAt: UniverseTime | null;
  readonly activatedAt: MissionTime | null;
  readonly objectiveStates: readonly MissionObjectiveInstanceState[];
  readonly expiry: UniverseTime | null;
  readonly facts: JsonObject;
  readonly rewardClaimState: "Unavailable" | "Unclaimed" | "Claimed";
  readonly failureReason: ExternalReferenceId | null;
  readonly abandonReason: ExternalReferenceId | null;
  readonly replayRecords: readonly MissionReplayRecord[];
  readonly signature: PersistenceSignature;
}

export type MissionRejectionCode =
  | "INVALID_COMMAND"
  | "INVALID_DEFINITION"
  | "REVISION_CONFLICT"
  | "CONFLICTING_REPLAY"
  | "INVALID_STATE_TRANSITION"
  | "MISSION_TERMINAL"
  | "OBJECTIVE_NOT_FOUND"
  | "OBJECTIVE_NOT_ACTIVE"
  | "OBJECTIVE_TERMINAL"
  | "OBJECTIVE_REQUIREMENT_NOT_MET"
  | "OBJECTIVE_NOT_OPTIONAL"
  | "ELIGIBILITY_FAILED"
  | "PROGRESS_TYPE_MISMATCH"
  | "RESOURCE_MISMATCH"
  | "TARGET_MISMATCH"
  | "ITEM_MISMATCH"
  | "EXPIRY_NOT_REACHED"
  | "EXPIRY_REQUIRED"
  | "FAILURE_CONDITION_REACHED"
  | "MISSION_REQUIREMENTS_NOT_MET"
  | "REWARD_NOT_AVAILABLE";

export interface MissionCommandRejection {
  readonly code: MissionRejectionCode;
  readonly path: string;
  readonly message: string;
}

export interface MissionCommandSuccess {
  readonly ok: true;
  readonly instance: MissionInstance;
  readonly eventIntents: readonly DomainEvent[];
  readonly outcomeIntents: readonly MissionOutcomeIntent[];
}

export interface MissionCommandFailure {
  readonly ok: false;
  readonly rejection: MissionCommandRejection;
}

export type MissionCommandResult = MissionCommandSuccess | MissionCommandFailure;

export interface MissionCommandEnvelope {
  readonly commandId: MissionCommandId;
  readonly expectedRevision: number;
  readonly at: UniverseTime;
}

export interface MissionInstanceCommand extends MissionCommandEnvelope {
  readonly definition: MissionDefinition;
  readonly instance: MissionInstance;
}

export interface CreateMissionOfferCommand extends MissionCommandEnvelope {
  readonly definition: MissionDefinition;
  readonly missionId: MissionId;
  readonly ownerId: PlayerId;
  readonly facts: JsonObject;
}

export interface AcceptMissionCommand extends MissionInstanceCommand {}

export interface ActivateMissionCommand extends MissionInstanceCommand {
  readonly missionTime: MissionTime;
}

export interface ObjectiveMissionCommand extends MissionInstanceCommand {
  readonly objectiveId: ObjectiveId;
}

export interface ApplyObjectiveProgressCommand extends ObjectiveMissionCommand {
  readonly progress: MissionProgress;
}

export interface ReasonedMissionCommand extends MissionInstanceCommand {
  readonly reasonCode: ExternalReferenceId;
}

export interface ReasonedObjectiveMissionCommand extends ObjectiveMissionCommand {
  readonly reasonCode: ExternalReferenceId;
}
