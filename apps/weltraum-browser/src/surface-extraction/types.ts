import type {
  ResourceCatalog,
  ResourceContainerSnapshot,
  ResourceId,
  ResourceLegalStatus,
  ResourceTransferResult
} from "../resources/index";
import type {
  InteractionActorContext,
  InteractionCapabilityId,
  InteractionToolId
} from "../interaction/index";
import type {
  InteractionCapabilityProjection,
  SurfaceEquipmentBlueprint,
  SurfaceEquipmentDerivedStats,
  SurfaceEquipmentSuitReadiness
} from "../surface-equipment/index";
import type { SuitEquipmentInterfaceSnapshot, SuitStateSnapshot } from "../suit/index";
import type { EnvironmentHazardId, PlanetaryEnvironmentSample } from "../planetary-environment/index";
import type { SurfaceVector3 } from "../surface-frame/index";

export const SURFACE_EXTRACTION_SCHEMA_VERSION = 1 as const;

export const SURFACE_EXTRACTION_METHODS = Object.freeze([
  "Cutting",
  "Drilling",
  "Sampling",
  "Sublimation",
  "Thermal"
] as const);
export type SurfaceExtractionMethod = (typeof SURFACE_EXTRACTION_METHODS)[number];

export const SURFACE_EXTRACTION_BLOCK_REASONS = Object.freeze([
  "ToolMissing",
  "CapabilityMissing",
  "EquipmentNotReady",
  "SuitNotReady",
  "EnvironmentUnsafe",
  "NodeDepleted",
  "NodeRevisionConflict",
  "SessionRevisionConflict",
  "IllegalExtraction",
  "OwnershipDenied",
  "TargetCapacityExceeded",
  "HazardContainerRequired",
  "ActiveSessionConflict",
  "InvalidPulse"
] as const);
export type ExtractionBlockReason = (typeof SURFACE_EXTRACTION_BLOCK_REASONS)[number];

export const EXTRACTION_SESSION_STATES = Object.freeze([
  "Prepared",
  "Active",
  "Paused",
  "Completed",
  "Blocked",
  "Cancelled"
] as const);
export type ExtractionSessionState = (typeof EXTRACTION_SESSION_STATES)[number];

export type SurfaceResourceExposureState = "Hidden" | "Exposed" | "Surveyed";
export type SurfaceResourceDepletionState = "Available" | "PartiallyDepleted" | "Depleted";
export type SurfaceResourceOwnershipPolicy = "Unclaimed" | "OwnerOnly" | "PermitOrOwner";

export interface SurfaceResourceEnvironmentRestrictionsInput {
  readonly allowedModelStates?: readonly ("Valid" | "Vacuum")[];
  readonly blockedHazards?: readonly EnvironmentHazardId[];
  readonly maximumDustLoad?: number;
  readonly maximumSporeLoad?: number;
  readonly maximumCorrosiveExposure?: number;
}

export interface SurfaceResourceEnvironmentRestrictions {
  readonly allowedModelStates: readonly ("Valid" | "Vacuum")[];
  readonly blockedHazards: readonly EnvironmentHazardId[];
  readonly maximumDustLoad: number;
  readonly maximumSporeLoad: number;
  readonly maximumCorrosiveExposure: number;
}

export interface SurfaceResourceLegalityMetadataInput {
  readonly legalStatus: ResourceLegalStatus;
  readonly ownershipPolicy: SurfaceResourceOwnershipPolicy;
  readonly requiredPermitId?: string;
}

export interface SurfaceResourceLegalityMetadata {
  readonly legalStatus: ResourceLegalStatus;
  readonly ownershipPolicy: SurfaceResourceOwnershipPolicy;
  readonly requiredPermitId?: string;
}

export interface SurfaceResourceNodeDefinitionInput {
  readonly definitionId: string;
  readonly resourceId: ResourceId | string;
  readonly extractionMethod: SurfaceExtractionMethod;
  readonly requiredCapability: InteractionCapabilityId | string;
  readonly hardnessBasisPoints: number;
  readonly grade: string;
  readonly gradeBasisPoints: number;
  readonly pulseYieldRange: {
    readonly minimum: number;
    readonly maximum: number;
  };
  readonly contaminationFactor: number;
  readonly dustFactor: number;
  readonly legality: SurfaceResourceLegalityMetadataInput;
  readonly environmentRestrictions?: SurfaceResourceEnvironmentRestrictionsInput;
  readonly schemaVersion?: typeof SURFACE_EXTRACTION_SCHEMA_VERSION;
}

export interface SurfaceResourceNodeDefinition {
  readonly schema: "weltraum.surface-resource-node-definition";
  readonly schemaVersion: typeof SURFACE_EXTRACTION_SCHEMA_VERSION;
  readonly definitionId: string;
  readonly resourceId: ResourceId;
  readonly extractionMethod: SurfaceExtractionMethod;
  readonly requiredCapability: InteractionCapabilityId;
  readonly hardnessBasisPoints: number;
  readonly grade: string;
  readonly gradeBasisPoints: number;
  readonly pulseYieldRange: {
    readonly minimum: number;
    readonly maximum: number;
  };
  readonly contaminationFactor: number;
  readonly dustFactor: number;
  readonly legality: SurfaceResourceLegalityMetadata;
  readonly environmentRestrictions: SurfaceResourceEnvironmentRestrictions;
  readonly canonicalSignature: string;
}

export interface SurfaceResourceClaimInput {
  readonly claimId: string;
  readonly ownerId: string;
  readonly extractionAllowedActorIds?: readonly string[];
}

export interface SurfaceResourceClaim {
  readonly claimId: string;
  readonly ownerId: string;
  readonly extractionAllowedActorIds: readonly string[];
}

export interface SurfaceResourceNodeStateInput {
  readonly nodeId: string;
  readonly surfaceFrameId: string;
  readonly localPosition: SurfaceVector3;
  readonly revision?: number;
  readonly reservoir: ResourceContainerSnapshot;
  readonly exposureState?: SurfaceResourceExposureState;
  readonly claim?: SurfaceResourceClaimInput;
  readonly activeSessionId?: string;
}

export interface SurfaceResourceNodeState {
  readonly schema: "weltraum.surface-resource-node-state";
  readonly schemaVersion: typeof SURFACE_EXTRACTION_SCHEMA_VERSION;
  readonly nodeId: string;
  readonly surfaceFrameId: string;
  readonly localPosition: SurfaceVector3;
  readonly revision: number;
  readonly reservoir: ResourceContainerSnapshot;
  readonly exposureState: SurfaceResourceExposureState;
  readonly depletionState: SurfaceResourceDepletionState;
  readonly claim?: SurfaceResourceClaim;
  readonly activeSessionId?: string;
  readonly canonicalSignature: string;
}

export interface UnscannedSurfaceResourceNodeView {
  readonly nodeId: string;
  readonly surfaceFrameId: string;
  readonly localPosition: SurfaceVector3;
  readonly revision: number;
  readonly exposureState: SurfaceResourceExposureState;
  readonly depletionState: SurfaceResourceDepletionState;
  readonly activeSessionId?: string;
  readonly deterministicSignature: string;
}

export interface ScanResult {
  readonly nodeId: string;
  readonly nodeRevision: number;
  readonly confidence: number;
  readonly resourceId: ResourceId;
  readonly estimatedGrade: string;
  readonly estimatedQuantity: number;
  readonly hazards: readonly string[];
  readonly ownership: {
    readonly claimId?: string;
    readonly ownerId?: string;
    readonly extractionAllowed: boolean;
  };
  readonly legalFacts: SurfaceResourceLegalityMetadata;
  readonly requiredCapability: InteractionCapabilityId;
  readonly environmentSignature: string;
  readonly deterministicSignature: string;
}

export interface SurfaceResourceScanInput {
  readonly actorContext: InteractionActorContext;
  readonly equipment: InteractionCapabilityProjection;
  readonly environment: PlanetaryEnvironmentSample;
  readonly scanSkillBasisPoints: number;
  readonly distanceMeters: number;
}

export type SurfaceResourceScanOutcome =
  | { readonly status: "Scanned"; readonly result: ScanResult }
  | { readonly status: "Blocked"; readonly reason: ExtractionBlockReason };

export interface ExtractionEquipmentSnapshot {
  readonly equipmentId: string;
  readonly equipmentRevision: number;
  readonly blueprintSignature: string;
  readonly statsSignature: string;
  readonly readinessSignature: string;
  readonly projectionSignature: string;
  readonly toolId: InteractionToolId;
  readonly capabilityIds: readonly InteractionCapabilityId[];
  readonly readiness: "Ready" | "Limited" | "Blocked";
  readonly pulseEnergyMillijoules: number;
  readonly heatPerActionMillijoules: number;
  readonly cycleTicks: number;
  readonly signature: string;
}

export interface ExtractionSuitSnapshot {
  readonly stateId: string;
  readonly definitionId: string;
  readonly actorId: string;
  readonly revision: number;
  readonly criticalState: boolean;
  readonly actorIncapacitated: boolean;
  readonly equipmentBusOnline: boolean;
  readonly stateSignature: string;
  readonly interfaceSignature: string;
  readonly signature: string;
}

export interface ExtractionEnergyHeatToolIntent {
  readonly toolId: InteractionToolId;
  readonly pulseEnergyMillijoules: number;
  readonly heatMillijoules: number;
  readonly toolUseTicks: number;
}

export type ExtractionEventIntentType =
  | "ExtractionPrepared"
  | "ExtractionStarted"
  | "ExtractionPaused"
  | "ExtractionResumed"
  | "ExtractionCancelled"
  | "ExtractionPulseExecuted"
  | "ResourceTransferred"
  | "NodeDepleted";

export interface ExtractionEventIntent {
  readonly intentId: string;
  readonly type: ExtractionEventIntentType;
  readonly sessionId: string;
  readonly nodeId: string;
  readonly actorId: string;
  readonly universeTick: number;
  readonly pulseIndex?: number;
  readonly quantity?: number;
}

export type ExtractionMissionIntentType = "RecordExtractionProgress" | "CompleteExtractionObjective";

export interface ExtractionMissionIntent {
  readonly intentId: string;
  readonly type: ExtractionMissionIntentType;
  readonly sessionId: string;
  readonly nodeId: string;
  readonly resourceId: ResourceId;
  readonly quantity: number;
  readonly pulseIndex: number;
}

export interface ExtractionPulseReceipt {
  readonly idempotencyKey: string;
  readonly commandSignature: string;
  readonly pulseSignature: string;
  readonly pulseIndex: number;
  readonly extractedQuantity: number;
  readonly nodeRevisionAfter: number;
  readonly sessionRevisionAfter: number;
  readonly targetSignatureAfter: string;
  readonly demandIntent: ExtractionEnergyHeatToolIntent;
  readonly transferResult: ResourceTransferResult;
  readonly eventIntents: readonly ExtractionEventIntent[];
  readonly missionIntents: readonly ExtractionMissionIntent[];
}

export interface ExtractionSession {
  readonly schema: "weltraum.surface-extraction-session";
  readonly schemaVersion: typeof SURFACE_EXTRACTION_SCHEMA_VERSION;
  readonly sessionId: string;
  readonly nodeId: string;
  readonly actorId: string;
  readonly resourceId: ResourceId;
  readonly equipment: ExtractionEquipmentSnapshot;
  readonly suit: ExtractionSuitSnapshot;
  readonly environmentSignature: string;
  readonly targetContainerId: string;
  readonly startedUniverseTick: number;
  readonly revision: number;
  readonly pulseSequence: number;
  readonly state: ExtractionSessionState;
  readonly blockReasons: readonly ExtractionBlockReason[];
  readonly pulseReceipts: readonly ExtractionPulseReceipt[];
  readonly canonicalSignature: string;
}

export interface ExtractionPreparationInput {
  readonly sessionId: string;
  readonly actorId: string;
  readonly expectedNodeRevision: number;
  readonly targetContainerId: string;
  readonly startedUniverseTick: number;
  readonly actorContext: InteractionActorContext;
  readonly blueprint: SurfaceEquipmentBlueprint;
  readonly equipmentStats: SurfaceEquipmentDerivedStats;
  readonly equipmentReadiness: SurfaceEquipmentSuitReadiness;
  readonly equipmentProjection: InteractionCapabilityProjection;
  readonly suitState: SuitStateSnapshot;
  readonly suitInterface: SuitEquipmentInterfaceSnapshot;
  readonly environment: PlanetaryEnvironmentSample;
  readonly target: ResourceContainerSnapshot;
  readonly catalog: ResourceCatalog;
}

export interface ExtractionPreparationResult {
  readonly ready: boolean;
  readonly session: ExtractionSession;
  readonly blockReasons: readonly ExtractionBlockReason[];
  readonly eventIntents: readonly ExtractionEventIntent[];
}

export interface ExtractionSessionTransitionResult {
  readonly status: "Applied" | "Blocked";
  readonly reason?: ExtractionBlockReason;
  readonly session: ExtractionSession;
  readonly node?: SurfaceResourceNodeState;
  readonly eventIntents: readonly ExtractionEventIntent[];
}

export interface ExtractionPulseCommand {
  readonly idempotencyKey: string;
  readonly expectedSessionRevision: number;
  readonly expectedNodeRevision: number;
  readonly expectedTargetRevision: number;
  readonly explicitTickDelta: number;
  readonly pulseIndex: number;
  readonly deterministicSeed: string;
  readonly universeTick: number;
}

export interface ExtractionPulseResult {
  readonly status: "Applied" | "Idempotent" | "Blocked";
  readonly reason?: ExtractionBlockReason;
  readonly extractedQuantity: number;
  readonly demandIntent: ExtractionEnergyHeatToolIntent;
  readonly transferResult?: ResourceTransferResult;
  readonly node: SurfaceResourceNodeState;
  readonly session: ExtractionSession;
  readonly target: ResourceContainerSnapshot;
  readonly eventIntents: readonly ExtractionEventIntent[];
  readonly missionIntents: readonly ExtractionMissionIntent[];
  readonly pulseSignature: string;
}
