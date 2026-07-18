declare const interactionActorIdBrand: unique symbol;
declare const interactionTargetIdBrand: unique symbol;
declare const interactionCapabilityIdBrand: unique symbol;
declare const interactionToolIdBrand: unique symbol;
declare const interactionRevisionBrand: unique symbol;
declare const interactionTickBrand: unique symbol;

export type InteractionActorId = string & { readonly [interactionActorIdBrand]: "InteractionActorId" };
export type InteractionTargetId = string & { readonly [interactionTargetIdBrand]: "InteractionTargetId" };
export type InteractionCapabilityId = string & {
  readonly [interactionCapabilityIdBrand]: "InteractionCapabilityId";
};
export type InteractionToolId = string & { readonly [interactionToolIdBrand]: "InteractionToolId" };
export type InteractionRevision = number & { readonly [interactionRevisionBrand]: "InteractionRevision" };
export type InteractionTick = number & { readonly [interactionTickBrand]: "InteractionTick" };

export const INTERACTION_VERBS = Object.freeze([
  "Inspect",
  "Scan",
  "Extract",
  "Repair",
  "Open",
  "Close",
  "Activate",
  "Deactivate",
  "Pickup",
  "Place",
  "Transfer"
] as const);

export type InteractionVerb = (typeof INTERACTION_VERBS)[number];

export const INTERACTION_DECISION_STATUSES = Object.freeze(["Allowed", "Blocked", "Unavailable"] as const);
export type InteractionDecisionStatus = (typeof INTERACTION_DECISION_STATUSES)[number];

export const INTERACTION_BLOCK_REASONS = Object.freeze([
  "OutOfRange",
  "NoLineOfSight",
  "NotReachable",
  "MissingCapability",
  "MissingTool",
  "InsufficientEnergy",
  "InsufficientResource",
  "HazardTooHigh",
  "PermissionDenied",
  "IllegalWithoutOverride",
  "TargetBusy",
  "TargetStale",
  "ActorIncapacitated",
  "ModeConflict"
] as const);

export type InteractionBlockReason = (typeof INTERACTION_BLOCK_REASONS)[number];

export const INTERACTION_UNAVAILABLE_REASONS = Object.freeze([
  "InvalidTarget",
  "InvalidActor",
  "InvalidContract",
  "UnsupportedVerb",
  "UnknownCapability",
  "TargetNotActionable"
] as const);

export type InteractionUnavailableReason = (typeof INTERACTION_UNAVAILABLE_REASONS)[number];
export type InteractionWarning = "HazardWarning";
export type InteractionLegalState = "Legal" | "Restricted" | "Illegal";
export type InteractionInterruptPolicy = "Interruptible" | "Committed";
export type InteractionMovementToleranceClass = "Stationary" | "Limited" | "Mobile";
export type InteractionSessionStatus = "Active" | "Cancelled" | "Interrupted";
export type InteractionInterruptionReason =
  | "MovementToleranceExceeded"
  | "Damage"
  | "FocusLoss"
  | "ModeConflict";
export type InteractionResultCode =
  | "InteractionCompleted"
  | "DecisionNotAllowed"
  | "InvalidTick"
  | "SessionCancelled"
  | "MovementToleranceExceeded"
  | "DamageInterrupted"
  | "FocusLossInterrupted"
  | "ModeConflictInterrupted"
  | "HoldIncomplete"
  | "ActorIdentityMismatch"
  | "ActorRevisionStale"
  | "TargetIdentityMismatch"
  | "TargetRevisionStale";
export type InteractionNextAction = "ContinueHold" | "RetryEvaluation" | "AwaitExternalApplication" | null;

export interface InteractionResourceCost {
  readonly resourceId: string;
  readonly amount: number;
}

export interface InteractionCosts {
  readonly energy: number;
  readonly resources: readonly InteractionResourceCost[];
}

export interface InteractionHazardSummary {
  readonly level: number;
  readonly warningThreshold: number;
}

export interface InteractionVerbRule {
  readonly verb: InteractionVerb;
  readonly requiredCapabilities: readonly InteractionCapabilityId[];
  readonly requiredTools: readonly InteractionToolId[];
  readonly costs: InteractionCosts;
  readonly requiredPermissionId: string | null;
  readonly requiredHoldTicks: InteractionTick;
  readonly interruptPolicy: InteractionInterruptPolicy;
  readonly movementToleranceClass: InteractionMovementToleranceClass;
  readonly damageInterrupts: boolean;
  readonly focusLossInterrupts: boolean;
  /** Empty means every actor mode is accepted. */
  readonly allowedActorModes: readonly string[];
  readonly targetBusy: boolean;
}

export interface InteractionTargetSnapshot {
  readonly targetId: InteractionTargetId;
  readonly revision: InteractionRevision;
  readonly ownerId: string | null;
  readonly claimId: string | null;
  readonly legalState: InteractionLegalState;
  readonly hazard: InteractionHazardSummary;
  readonly supportedVerbs: readonly InteractionVerb[];
  /** Canonical union of every verb rule's capability requirements. */
  readonly requiredCapabilities: readonly InteractionCapabilityId[];
  /** Canonical union of every verb rule's tool requirements. */
  readonly requiredTools: readonly InteractionToolId[];
  readonly verbRules: readonly InteractionVerbRule[];
}

export interface InteractionResourceAvailability {
  readonly resourceId: string;
  readonly amount: number;
}

export interface InteractionActorContext {
  readonly actorId: InteractionActorId;
  readonly revision: InteractionRevision;
  /** Explicit vocabulary supplied by the owning adapter; no ambient registry is consulted. */
  readonly knownCapabilities: readonly InteractionCapabilityId[];
  readonly capabilities: readonly InteractionCapabilityId[];
  readonly tools: readonly InteractionToolId[];
  readonly energyAvailable: number;
  readonly resources: readonly InteractionResourceAvailability[];
  readonly permissions: readonly string[];
  readonly legalOverride: boolean;
  readonly hazardTolerance: number;
  readonly incapacitated: boolean;
  readonly mode: string;
}

export interface InteractionCandidate {
  readonly actorId: InteractionActorId;
  readonly actorRevision: InteractionRevision;
  readonly target: InteractionTargetSnapshot;
  readonly expectedTargetRevision: InteractionRevision;
  readonly verb: InteractionVerb;
  readonly distanceMeters: number;
  readonly maximumDistanceMeters: number;
  readonly lineOfSight: boolean;
  readonly reachable: boolean;
  /** Lower values have higher focus priority. */
  readonly focusRank: number;
}

interface InteractionDecisionBase {
  readonly status: InteractionDecisionStatus;
  readonly warnings: readonly InteractionWarning[];
  readonly decisionHash: `fnv1a32:${string}`;
}

export interface AllowedInteractionDecision extends InteractionDecisionBase {
  readonly status: "Allowed";
  readonly reason: null;
  readonly unavailableReason: null;
  readonly costs: InteractionCosts;
  readonly requiredHoldTicks: InteractionTick;
  readonly interruptPolicy: InteractionInterruptPolicy;
  readonly movementToleranceClass: InteractionMovementToleranceClass;
  readonly damageInterrupts: boolean;
  readonly focusLossInterrupts: boolean;
}

export interface BlockedInteractionDecision extends InteractionDecisionBase {
  readonly status: "Blocked";
  readonly reason: InteractionBlockReason;
  readonly unavailableReason: null;
}

export interface UnavailableInteractionDecision extends InteractionDecisionBase {
  readonly status: "Unavailable";
  readonly reason: null;
  readonly unavailableReason: InteractionUnavailableReason;
}

export type InteractionDecision =
  | AllowedInteractionDecision
  | BlockedInteractionDecision
  | UnavailableInteractionDecision;

export interface InteractionCandidateSelection {
  readonly candidate: InteractionCandidate;
  readonly decision: InteractionDecision;
}

/* Task 2 owns behavior for the following serializable contracts. */
export interface InteractionSession {
  readonly sessionId: string;
  readonly actorId: InteractionActorId;
  readonly actorRevision: InteractionRevision;
  readonly targetId: InteractionTargetId;
  readonly targetRevision: InteractionRevision;
  readonly verb: InteractionVerb;
  readonly decisionHash: `fnv1a32:${string}`;
  readonly startTick: InteractionTick;
  readonly currentTick: InteractionTick;
  readonly progressTicks: InteractionTick;
  readonly requiredHoldTicks: InteractionTick;
  readonly costs: InteractionCosts;
  readonly interruptPolicy: InteractionInterruptPolicy;
  readonly movementToleranceClass: InteractionMovementToleranceClass;
  readonly damageInterrupts: boolean;
  readonly focusLossInterrupts: boolean;
  readonly status: InteractionSessionStatus;
  readonly interruptionReason: InteractionInterruptionReason | null;
}

export interface InteractionProgress {
  readonly sessionId: string;
  readonly tick: InteractionTick;
  readonly progressTicks: InteractionTick;
  readonly requiredHoldTicks: InteractionTick;
  readonly readyToComplete: boolean;
}

export interface InteractionCompletionRequest {
  readonly sessionId: string;
  readonly actorId: InteractionActorId;
  readonly actorRevision: InteractionRevision;
  readonly targetId: InteractionTargetId;
  readonly targetRevision: InteractionRevision;
  readonly completionTick: InteractionTick;
}

export interface InteractionSessionStartRequest {
  readonly sessionId: string;
  readonly candidate: InteractionCandidate;
  readonly context: InteractionActorContext;
  readonly decision: InteractionDecision;
}

export interface InteractionSessionAdvanceRequest {
  readonly tick: InteractionTick;
  readonly movementClass: InteractionMovementToleranceClass;
  readonly damageOccurred: boolean;
  readonly focusMaintained: boolean;
  readonly modeConflict: boolean;
}

export interface InteractionSessionCancelRequest {
  readonly cancellationTick: InteractionTick;
}

export interface InteractionMutationIntent {
  readonly expectedActorRevision: InteractionRevision;
  readonly expectedTargetRevision: InteractionRevision;
  readonly consumedCosts: InteractionCosts;
  readonly generatedCapabilities: readonly InteractionCapabilityId[];
  readonly discoveryFacts: readonly string[];
  readonly events: readonly InteractionEvent[];
  readonly resultCode: InteractionResultCode;
  readonly nextAction: InteractionNextAction;
}

export interface InteractionResult {
  readonly status: "Completed" | "Rejected" | "Cancelled" | "Interrupted";
  readonly sessionId: string;
  readonly mutation: InteractionMutationIntent | null;
  readonly resultCode: InteractionResultCode;
  readonly nextAction: InteractionNextAction;
}

export interface InteractionEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly phase: "Started" | "Advanced" | "Cancelled" | "Interrupted" | "Completed" | "Rejected";
  readonly tick: InteractionTick;
  readonly actorId: InteractionActorId;
  readonly targetId: InteractionTargetId;
  readonly verb: InteractionVerb;
  readonly resultCode: InteractionResultCode;
}

export interface InteractionSessionTransition {
  readonly status: "Started" | "Advanced" | "Rejected" | "Cancelled" | "Interrupted";
  readonly session: InteractionSession | null;
  readonly progress: InteractionProgress | null;
  readonly result: InteractionResult | null;
}

export interface InteractionVerbRuleInput {
  readonly verb: InteractionVerb | string;
  readonly requiredCapabilities: readonly string[];
  readonly requiredTools: readonly string[];
  readonly costs: {
    readonly energy: number;
    readonly resources: readonly InteractionResourceCost[];
  };
  readonly requiredPermissionId: string | null;
  readonly requiredHoldTicks: number;
  readonly interruptPolicy: InteractionInterruptPolicy | string;
  readonly movementToleranceClass: InteractionMovementToleranceClass | string;
  readonly damageInterrupts: boolean;
  readonly focusLossInterrupts: boolean;
  readonly allowedActorModes: readonly string[];
  readonly targetBusy: boolean;
}

export interface InteractionTargetSnapshotInput {
  readonly targetId: string;
  readonly revision: number;
  readonly ownerId: string | null;
  readonly claimId: string | null;
  readonly legalState: InteractionLegalState | string;
  readonly hazard: InteractionHazardSummary;
  readonly supportedVerbs: readonly (InteractionVerb | string)[];
  readonly verbRules: readonly InteractionVerbRuleInput[];
}

export interface InteractionActorContextInput {
  readonly actorId: string;
  readonly revision: number;
  readonly knownCapabilities: readonly string[];
  readonly capabilities: readonly string[];
  readonly tools: readonly string[];
  readonly energyAvailable: number;
  readonly resources: readonly InteractionResourceAvailability[];
  readonly permissions: readonly string[];
  readonly legalOverride: boolean;
  readonly hazardTolerance: number;
  readonly incapacitated: boolean;
  readonly mode: string;
}

export interface InteractionCandidateInput {
  readonly actorId: string;
  readonly actorRevision: number;
  readonly target: InteractionTargetSnapshotInput | InteractionTargetSnapshot;
  readonly expectedTargetRevision: number;
  readonly verb: InteractionVerb | string;
  readonly distanceMeters: number;
  readonly maximumDistanceMeters: number;
  readonly lineOfSight: boolean;
  readonly reachable: boolean;
  readonly focusRank: number;
}

export class InteractionContractError extends Error {
  public constructor(
    public readonly code: string,
    public readonly path: string,
    message: string
  ) {
    super(`${path || "interaction"}: ${message}`);
    this.name = "InteractionContractError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
