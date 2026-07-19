import {
  createResourceId,
  evaluateContainerEligibility,
  extractFromMiningReservoir,
  findResourceDefinition,
  isSaveSafeResourceId,
  type ResourceCatalog,
  type ResourceContainerSnapshot,
  type ResourceTransferRejectionCode
} from "../resources/index";
import { createInteractionCapabilityId } from "../interaction/index";
import type {
  InteractionCapabilityProjection,
  SurfaceEquipmentBlueprint,
  SurfaceEquipmentDerivedStats,
  SurfaceEquipmentSuitReadiness
} from "../surface-equipment/index";
import type { SuitEquipmentInterfaceSnapshot, SuitStateSnapshot } from "../suit/index";
import type { PlanetaryEnvironmentSample } from "../planetary-environment/index";
import {
  canonicalSurfaceExtractionJson,
  cloneAndFreezeSurfaceExtraction,
  freezeSurfaceExtraction,
  surfaceExtractionSignature
} from "./canonical";
import {
  EXTRACTION_SESSION_STATES,
  SURFACE_EXTRACTION_BLOCK_REASONS,
  SURFACE_EXTRACTION_METHODS,
  SURFACE_EXTRACTION_SCHEMA_VERSION,
  type ExtractionBlockReason,
  type ExtractionEnergyHeatToolIntent,
  type ExtractionEquipmentSnapshot,
  type ExtractionEventIntent,
  type ExtractionMissionIntent,
  type ExtractionPreparationInput,
  type ExtractionPreparationResult,
  type ExtractionPulseCommand,
  type ExtractionPulseReceipt,
  type ExtractionPulseResult,
  type ExtractionSession,
  type ExtractionSessionState,
  type ExtractionSessionTransitionResult,
  type ExtractionSuitSnapshot,
  type ScanResult,
  type SurfaceResourceClaim,
  type SurfaceResourceClaimInput,
  type SurfaceResourceDepletionState,
  type SurfaceResourceEnvironmentRestrictions,
  type SurfaceResourceEnvironmentRestrictionsInput,
  type SurfaceResourceLegalityMetadata,
  type SurfaceResourceLegalityMetadataInput,
  type SurfaceResourceNodeDefinition,
  type SurfaceResourceNodeDefinitionInput,
  type SurfaceResourceNodeState,
  type SurfaceResourceNodeStateInput,
  type SurfaceResourceScanInput,
  type SurfaceResourceScanOutcome,
  type UnscannedSurfaceResourceNodeView
} from "./types";

const STABLE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const GRADE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const LEGAL_STATUSES = new Set(["Legal", "Restricted", "Illegal", "ProtectedSample"]);
const OWNERSHIP_POLICIES = new Set(["Unclaimed", "OwnerOnly", "PermitOrOwner"]);
const EXPOSURE_STATES = new Set(["Hidden", "Exposed", "Surveyed"]);
const HAZARD_IDS = new Set([
  "Vacuum", "LowPressure", "HighPressure", "Hypoxia", "Hyperoxia", "ToxicAtmosphere",
  "CorrosiveAtmosphere", "ExtremeCold", "ExtremeHeat", "Radiation", "Dust", "Spores",
  "LowVisibility", "UnknownComposition"
]);

const fail = (message: string): never => {
  throw new RangeError(message);
};

const stableId = (value: unknown, label: string): string =>
  typeof value === "string" && STABLE_ID.test(value) ? value : fail(`${label} must be a stable lowercase identifier.`);

const gradeId = (value: unknown): string =>
  typeof value === "string" && GRADE_ID.test(value) ? value : fail("grade must be lowercase and save-safe.");

const finite = (value: unknown, label: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    return fail(`${label} must be finite from ${minimum} through ${maximum}.`);
  }
  return Object.is(value, -0) ? 0 : value;
};

const safeInteger = (value: unknown, label: string, minimum = 0): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    return fail(`${label} must be a safe integer greater than or equal to ${minimum}.`);
  }
  return value;
};

const uniqueSorted = (values: readonly string[]): readonly string[] =>
  Object.freeze([...new Set(values)].sort());

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const roundQuantity = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

const environmentRestrictions = (
  input: SurfaceResourceEnvironmentRestrictionsInput | undefined
): SurfaceResourceEnvironmentRestrictions => {
  const allowedModelStates = input?.allowedModelStates ?? ["Valid", "Vacuum"];
  if (allowedModelStates.length === 0 || allowedModelStates.some((state) => state !== "Valid" && state !== "Vacuum")) {
    fail("environmentRestrictions.allowedModelStates must contain Valid and/or Vacuum.");
  }
  const blockedHazards = input?.blockedHazards ?? [];
  if (blockedHazards.some((hazardId) => !HAZARD_IDS.has(hazardId))) {
    fail("environmentRestrictions.blockedHazards contains an unsupported hazard.");
  }
  return cloneAndFreezeSurfaceExtraction({
    allowedModelStates: uniqueSorted(allowedModelStates),
    blockedHazards: uniqueSorted(blockedHazards),
    maximumDustLoad: finite(input?.maximumDustLoad ?? Number.MAX_SAFE_INTEGER, "maximumDustLoad"),
    maximumSporeLoad: finite(input?.maximumSporeLoad ?? Number.MAX_SAFE_INTEGER, "maximumSporeLoad"),
    maximumCorrosiveExposure: finite(
      input?.maximumCorrosiveExposure ?? Number.MAX_SAFE_INTEGER,
      "maximumCorrosiveExposure"
    )
  }) as SurfaceResourceEnvironmentRestrictions;
};

const legalityMetadata = (input: SurfaceResourceLegalityMetadataInput): SurfaceResourceLegalityMetadata => {
  if (!LEGAL_STATUSES.has(input.legalStatus)) fail("legality.legalStatus is unsupported.");
  if (!OWNERSHIP_POLICIES.has(input.ownershipPolicy)) fail("legality.ownershipPolicy is unsupported.");
  const requiredPermitId = input.requiredPermitId === undefined
    ? undefined
    : stableId(input.requiredPermitId, "legality.requiredPermitId");
  if (input.ownershipPolicy === "PermitOrOwner" && requiredPermitId === undefined) {
    fail("PermitOrOwner requires legality.requiredPermitId.");
  }
  return cloneAndFreezeSurfaceExtraction({
    legalStatus: input.legalStatus,
    ownershipPolicy: input.ownershipPolicy,
    ...(requiredPermitId === undefined ? {} : { requiredPermitId })
  }) as SurfaceResourceLegalityMetadata;
};

export const createSurfaceResourceNodeDefinition = (
  input: SurfaceResourceNodeDefinitionInput
): SurfaceResourceNodeDefinition => {
  if (input.schemaVersion !== undefined && input.schemaVersion !== SURFACE_EXTRACTION_SCHEMA_VERSION) {
    fail("Unsupported surface resource node definition schemaVersion.");
  }
  if (!SURFACE_EXTRACTION_METHODS.includes(input.extractionMethod)) fail("Unsupported extractionMethod.");
  const minimum = finite(input.pulseYieldRange.minimum, "pulseYieldRange.minimum", Number.MIN_VALUE);
  const maximum = finite(input.pulseYieldRange.maximum, "pulseYieldRange.maximum", minimum);
  const unsigned = {
    schema: "weltraum.surface-resource-node-definition" as const,
    schemaVersion: SURFACE_EXTRACTION_SCHEMA_VERSION,
    definitionId: stableId(input.definitionId, "definitionId"),
    resourceId: createResourceId(input.resourceId),
    extractionMethod: input.extractionMethod,
    requiredCapability: createInteractionCapabilityId(input.requiredCapability),
    hardnessBasisPoints: safeInteger(input.hardnessBasisPoints, "hardnessBasisPoints", 1),
    grade: gradeId(input.grade),
    gradeBasisPoints: safeInteger(input.gradeBasisPoints, "gradeBasisPoints", 1),
    pulseYieldRange: { minimum, maximum },
    contaminationFactor: finite(input.contaminationFactor, "contaminationFactor"),
    dustFactor: finite(input.dustFactor, "dustFactor"),
    legality: legalityMetadata(input.legality),
    environmentRestrictions: environmentRestrictions(input.environmentRestrictions)
  };
  return freezeSurfaceExtraction({
    ...unsigned,
    canonicalSignature: surfaceExtractionSignature(unsigned)
  }) as SurfaceResourceNodeDefinition;
};

const claim = (input: SurfaceResourceClaimInput | undefined): SurfaceResourceClaim | undefined => {
  if (input === undefined) return undefined;
  return cloneAndFreezeSurfaceExtraction({
    claimId: stableId(input.claimId, "claim.claimId"),
    ownerId: stableId(input.ownerId, "claim.ownerId"),
    extractionAllowedActorIds: uniqueSorted(
      (input.extractionAllowedActorIds ?? []).map((actorId) => stableId(actorId, "claim.extractionAllowedActorIds"))
    )
  }) as SurfaceResourceClaim;
};

const depletionStateFor = (reservoir: ResourceContainerSnapshot): SurfaceResourceDepletionState => {
  const depletion = reservoir.depletion;
  if (depletion === undefined) return fail("Surface resource node reservoir must expose mining depletion.");
  if (depletion.remainingQuantity <= 0) return "Depleted";
  return depletion.depletedQuantity > 0 ? "PartiallyDepleted" : "Available";
};

const nodeSignaturePayload = (node: Omit<SurfaceResourceNodeState, "canonicalSignature">) => ({
  schema: node.schema,
  schemaVersion: node.schemaVersion,
  nodeId: node.nodeId,
  surfaceFrameId: node.surfaceFrameId,
  localPosition: node.localPosition,
  revision: node.revision,
  reservoirSignature: node.reservoir.signature,
  reservoirRevision: node.reservoir.state.revision,
  exposureState: node.exposureState,
  depletionState: node.depletionState,
  ...(node.claim === undefined ? {} : { claim: node.claim }),
  ...(node.activeSessionId === undefined ? {} : { activeSessionId: node.activeSessionId })
});

const finalizeNode = (node: Omit<SurfaceResourceNodeState, "canonicalSignature">): SurfaceResourceNodeState =>
  freezeSurfaceExtraction({
    ...node,
    canonicalSignature: surfaceExtractionSignature(nodeSignaturePayload(node))
  }) as SurfaceResourceNodeState;

export const createSurfaceResourceNodeState = (
  definition: SurfaceResourceNodeDefinition,
  input: SurfaceResourceNodeStateInput
): SurfaceResourceNodeState => {
  if (input.reservoir.definition.kind !== "MiningNodeReservoir") fail("reservoir must be a MiningNodeReservoir.");
  if (input.reservoir.state.contents.some((stack) => stack.resourceId !== definition.resourceId)) {
    fail("reservoir contents must match the node definition resourceId.");
  }
  const exposureState = input.exposureState ?? "Hidden";
  if (!EXPOSURE_STATES.has(exposureState)) fail("Unsupported exposureState.");
  const activeSessionId = input.activeSessionId === undefined
    ? undefined
    : stableId(input.activeSessionId, "activeSessionId");
  return finalizeNode({
    schema: "weltraum.surface-resource-node-state",
    schemaVersion: SURFACE_EXTRACTION_SCHEMA_VERSION,
    nodeId: stableId(input.nodeId, "nodeId"),
    surfaceFrameId: stableId(input.surfaceFrameId, "surfaceFrameId"),
    localPosition: cloneAndFreezeSurfaceExtraction({
      x: finite(input.localPosition.x, "localPosition.x", -Number.MAX_SAFE_INTEGER),
      y: finite(input.localPosition.y, "localPosition.y", -Number.MAX_SAFE_INTEGER),
      z: finite(input.localPosition.z, "localPosition.z", -Number.MAX_SAFE_INTEGER)
    }),
    revision: safeInteger(input.revision ?? 0, "revision"),
    reservoir: input.reservoir,
    exposureState,
    depletionState: depletionStateFor(input.reservoir),
    ...(claim(input.claim) === undefined ? {} : { claim: claim(input.claim) }),
    ...(activeSessionId === undefined ? {} : { activeSessionId })
  });
};

const replaceNode = (
  node: SurfaceResourceNodeState,
  changes: Partial<Pick<SurfaceResourceNodeState, "revision" | "reservoir" | "exposureState" | "activeSessionId">> & {
    readonly clearActiveSession?: boolean;
  }
): SurfaceResourceNodeState => finalizeNode({
  schema: node.schema,
  schemaVersion: node.schemaVersion,
  nodeId: node.nodeId,
  surfaceFrameId: node.surfaceFrameId,
  localPosition: node.localPosition,
  revision: changes.revision ?? node.revision,
  reservoir: changes.reservoir ?? node.reservoir,
  exposureState: changes.exposureState ?? node.exposureState,
  depletionState: depletionStateFor(changes.reservoir ?? node.reservoir),
  ...(node.claim === undefined ? {} : { claim: node.claim }),
  ...(changes.clearActiveSession === true
    ? {}
    : changes.activeSessionId !== undefined
      ? { activeSessionId: changes.activeSessionId }
      : node.activeSessionId === undefined
        ? {}
        : { activeSessionId: node.activeSessionId })
});

export const createUnscannedSurfaceResourceNodeView = (
  node: SurfaceResourceNodeState
): UnscannedSurfaceResourceNodeView => freezeSurfaceExtraction({
  nodeId: node.nodeId,
  surfaceFrameId: node.surfaceFrameId,
  localPosition: node.localPosition,
  revision: node.revision,
  exposureState: node.exposureState,
  depletionState: node.depletionState,
  ...(node.activeSessionId === undefined ? {} : { activeSessionId: node.activeSessionId }),
  deterministicSignature: surfaceExtractionSignature({
    nodeId: node.nodeId,
    revision: node.revision,
    surfaceFrameId: node.surfaceFrameId,
    localPosition: node.localPosition,
    exposureState: node.exposureState,
    depletionState: node.depletionState,
    ...(node.activeSessionId === undefined ? {} : { activeSessionId: node.activeSessionId })
  })
}) as UnscannedSurfaceResourceNodeView;

const actorCanExtractClaim = (node: SurfaceResourceNodeState, actorId: string): boolean =>
  node.claim === undefined || node.claim.ownerId === actorId || node.claim.extractionAllowedActorIds.includes(actorId);

export const scanSurfaceResourceNode = (
  definition: SurfaceResourceNodeDefinition,
  node: SurfaceResourceNodeState,
  input: SurfaceResourceScanInput
): SurfaceResourceScanOutcome => {
  const scanCapability = createInteractionCapabilityId("capability.scan");
  if (input.actorContext.incapacitated) {
    return freezeSurfaceExtraction({ status: "Blocked", reason: "SuitNotReady" }) as SurfaceResourceScanOutcome;
  }
  if (input.equipment.readiness !== "Ready") return freezeSurfaceExtraction({ status: "Blocked", reason: "EquipmentNotReady" }) as SurfaceResourceScanOutcome;
  if (!input.equipment.capabilityIds.includes(scanCapability) || !input.actorContext.capabilities.includes(scanCapability)) {
    return freezeSurfaceExtraction({ status: "Blocked", reason: "CapabilityMissing" }) as SurfaceResourceScanOutcome;
  }
  if (!input.actorContext.tools.includes(input.equipment.toolId)) {
    return freezeSurfaceExtraction({ status: "Blocked", reason: "ToolMissing" }) as SurfaceResourceScanOutcome;
  }
  const distance = finite(input.distanceMeters, "distanceMeters");
  if (distance > input.equipment.maximumRangeMillimeters / 1000) {
    return freezeSurfaceExtraction({ status: "Blocked", reason: "InvalidPulse" }) as SurfaceResourceScanOutcome;
  }
  if (input.environment.modelState === "OutOfModel") {
    return freezeSurfaceExtraction({ status: "Blocked", reason: "EnvironmentUnsafe" }) as SurfaceResourceScanOutcome;
  }
  const skill = safeInteger(input.scanSkillBasisPoints, "scanSkillBasisPoints", 0);
  const visibilityFactor = clamp(input.environment.visibilityM / Math.max(1, distance * 20), 0.25, 1);
  const exposureFactor = node.exposureState === "Hidden" ? 0.8 : node.exposureState === "Exposed" ? 0.92 : 1;
  const confidence = roundQuantity(clamp(skill / 10_000, 0, 1) * visibilityFactor * exposureFactor);
  const remaining = node.reservoir.depletion?.remainingQuantity ?? 0;
  const hazards = uniqueSorted([
    ...input.environment.hazards.map((hazard) => hazard.hazardId),
    ...(definition.contaminationFactor > 0 ? ["NodeContamination"] : []),
    ...(definition.dustFactor > 0 ? ["NodeDust"] : [])
  ]);
  const ownership = {
    ...(node.claim === undefined ? {} : { claimId: node.claim.claimId, ownerId: node.claim.ownerId }),
    extractionAllowed: actorCanExtractClaim(node, input.actorContext.actorId)
  };
  const unsigned: Omit<ScanResult, "deterministicSignature"> = {
    nodeId: node.nodeId,
    nodeRevision: node.revision,
    confidence,
    resourceId: definition.resourceId,
    estimatedGrade: definition.grade,
    estimatedQuantity: roundQuantity(remaining * (0.85 + confidence * 0.15)),
    hazards,
    ownership,
    legalFacts: definition.legality,
    requiredCapability: definition.requiredCapability,
    environmentSignature: input.environment.signature
  };
  return freezeSurfaceExtraction({
    status: "Scanned",
    result: {
      ...unsigned,
      deterministicSignature: surfaceExtractionSignature(unsigned)
    }
  }) as SurfaceResourceScanOutcome;
};

const equipmentSnapshot = (
  blueprint: SurfaceEquipmentBlueprint,
  stats: SurfaceEquipmentDerivedStats,
  readiness: SurfaceEquipmentSuitReadiness,
  projection: InteractionCapabilityProjection
): ExtractionEquipmentSnapshot => {
  const projectionPayload = {
    equipmentId: projection.equipmentId,
    equipmentRevision: projection.equipmentRevision,
    capabilityIds: projection.capabilityIds,
    toolId: projection.toolId,
    readiness: projection.readiness,
    energyIntent: projection.energyIntent
  };
  const unsigned = {
    equipmentId: blueprint.blueprintId,
    equipmentRevision: blueprint.revision,
    blueprintSignature: blueprint.contentSignature,
    statsSignature: stats.signature,
    readinessSignature: readiness.signature,
    projectionSignature: surfaceExtractionSignature(projectionPayload),
    toolId: projection.toolId,
    capabilityIds: projection.capabilityIds,
    readiness: projection.readiness,
    pulseEnergyMillijoules: stats.pulseEnergyMillijoules,
    heatPerActionMillijoules: stats.heatPerActionMillijoules,
    cycleTicks: stats.cycleTicks
  };
  return freezeSurfaceExtraction({ ...unsigned, signature: surfaceExtractionSignature(unsigned) }) as ExtractionEquipmentSnapshot;
};

const suitSnapshot = (
  state: SuitStateSnapshot,
  equipmentInterface: SuitEquipmentInterfaceSnapshot
): ExtractionSuitSnapshot => {
  const unsigned = {
    stateId: state.stateId,
    definitionId: state.definitionId,
    actorId: state.actorId,
    revision: state.revision,
    criticalState: state.criticalState,
    actorIncapacitated: state.actorIncapacitated,
    equipmentBusOnline: equipmentInterface.equipmentBusOnline,
    stateSignature: state.contentSignature,
    interfaceSignature: equipmentInterface.canonicalSignature
  };
  return freezeSurfaceExtraction({ ...unsigned, signature: surfaceExtractionSignature(unsigned) }) as ExtractionSuitSnapshot;
};

const receiptSignaturePayload = (receipt: ExtractionPulseReceipt) => ({
  idempotencyKey: receipt.idempotencyKey,
  commandSignature: receipt.commandSignature,
  pulseSignature: receipt.pulseSignature,
  pulseIndex: receipt.pulseIndex,
  extractedQuantity: receipt.extractedQuantity,
  nodeRevisionAfter: receipt.nodeRevisionAfter,
  sessionRevisionAfter: receipt.sessionRevisionAfter,
  targetSignatureAfter: receipt.targetSignatureAfter,
  demandIntent: receipt.demandIntent,
  transfer: {
    status: receipt.transferResult.status,
    acceptedQuantity: receipt.transferResult.acceptedQuantity,
    sourceSignatureAfter: receipt.transferResult.sourceSignatureAfter,
    targetSignatureAfter: receipt.transferResult.targetSignatureAfter,
    issues: receipt.transferResult.issues
  },
  eventIntents: receipt.eventIntents,
  missionIntents: receipt.missionIntents
});

const sessionSignaturePayload = (session: Omit<ExtractionSession, "canonicalSignature">) => ({
  schema: session.schema,
  schemaVersion: session.schemaVersion,
  sessionId: session.sessionId,
  nodeId: session.nodeId,
  actorId: session.actorId,
  resourceId: session.resourceId,
  equipment: session.equipment,
  suit: session.suit,
  environmentSignature: session.environmentSignature,
  targetContainerId: session.targetContainerId,
  startedUniverseTick: session.startedUniverseTick,
  revision: session.revision,
  pulseSequence: session.pulseSequence,
  state: session.state,
  blockReasons: session.blockReasons,
  pulseReceipts: session.pulseReceipts.map(receiptSignaturePayload)
});

const finalizeSession = (session: Omit<ExtractionSession, "canonicalSignature">): ExtractionSession =>
  freezeSurfaceExtraction({
    ...session,
    canonicalSignature: surfaceExtractionSignature(sessionSignaturePayload(session))
  }) as ExtractionSession;

const replaceSession = (
  session: ExtractionSession,
  changes: Partial<Pick<ExtractionSession, "revision" | "pulseSequence" | "state" | "blockReasons" | "pulseReceipts">>
): ExtractionSession => finalizeSession({
  schema: session.schema,
  schemaVersion: session.schemaVersion,
  sessionId: session.sessionId,
  nodeId: session.nodeId,
  actorId: session.actorId,
  resourceId: session.resourceId,
  equipment: session.equipment,
  suit: session.suit,
  environmentSignature: session.environmentSignature,
  targetContainerId: session.targetContainerId,
  startedUniverseTick: session.startedUniverseTick,
  revision: changes.revision ?? session.revision,
  pulseSequence: changes.pulseSequence ?? session.pulseSequence,
  state: changes.state ?? session.state,
  blockReasons: changes.blockReasons ?? session.blockReasons,
  pulseReceipts: changes.pulseReceipts ?? session.pulseReceipts
});

const environmentIsSafe = (
  definition: SurfaceResourceNodeDefinition,
  environment: PlanetaryEnvironmentSample
): boolean => environment.modelState !== "OutOfModel" &&
  definition.environmentRestrictions.allowedModelStates.includes(environment.modelState) &&
  environment.hazards.every((hazard) => !definition.environmentRestrictions.blockedHazards.includes(hazard.hazardId)) &&
  environment.dustLoad <= definition.environmentRestrictions.maximumDustLoad &&
  environment.sporeLoad <= definition.environmentRestrictions.maximumSporeLoad &&
  environment.corrosiveExposure <= definition.environmentRestrictions.maximumCorrosiveExposure;

const orderedBlockReasons = (reasons: readonly ExtractionBlockReason[]): readonly ExtractionBlockReason[] =>
  Object.freeze([...new Set(reasons)].sort(
    (left, right) => SURFACE_EXTRACTION_BLOCK_REASONS.indexOf(left) - SURFACE_EXTRACTION_BLOCK_REASONS.indexOf(right)
  ));

const targetCapacityForMinimumYield = (
  definition: SurfaceResourceNodeDefinition,
  target: ResourceContainerSnapshot,
  catalog: ResourceCatalog
): boolean => {
  const resource = findResourceDefinition(catalog, definition.resourceId);
  if (resource === undefined) return false;
  const minimum = resource.stackRule.kind === "Bulk" ? definition.pulseYieldRange.minimum : 1;
  if (minimum * resource.massPerUnitKg > target.remainingMassKg) return false;
  if (minimum * resource.volumePerUnitM3 > target.remainingVolumeM3) return false;
  const compatibleStackExists = target.state.contents.some((stack) => stack.resourceId === definition.resourceId);
  return compatibleStackExists || target.stackCount < target.definition.maxStackCount;
};

export const prepareExtractionSession = (
  definition: SurfaceResourceNodeDefinition,
  node: SurfaceResourceNodeState,
  input: ExtractionPreparationInput
): ExtractionPreparationResult => {
  const blockers: ExtractionBlockReason[] = [];
  const actorId = stableId(input.actorId, "actorId");
  if (input.actorContext.actorId !== actorId) blockers.push("InvalidPulse");
  if (input.expectedNodeRevision !== node.revision) blockers.push("NodeRevisionConflict");
  if (node.depletionState === "Depleted") blockers.push("NodeDepleted");
  if (node.activeSessionId !== undefined && node.activeSessionId !== input.sessionId) blockers.push("ActiveSessionConflict");
  if (!input.actorContext.tools.includes(input.equipmentProjection.toolId)) blockers.push("ToolMissing");
  if (!input.equipmentProjection.capabilityIds.includes(definition.requiredCapability) ||
      !input.actorContext.capabilities.includes(definition.requiredCapability)) blockers.push("CapabilityMissing");
  const equipmentProvenanceInvalid =
    input.equipmentStats.blueprintId !== input.blueprint.blueprintId ||
    input.equipmentStats.revision !== input.blueprint.revision ||
    input.equipmentReadiness.blueprintId !== input.blueprint.blueprintId ||
    input.equipmentReadiness.revision !== input.blueprint.revision ||
    input.equipmentReadiness.statsSignature !== input.equipmentStats.signature ||
    input.equipmentProjection.equipmentId !== input.blueprint.blueprintId ||
    input.equipmentProjection.equipmentRevision !== input.blueprint.revision ||
    input.equipmentProjection.readiness !== input.equipmentReadiness.state;
  if (equipmentProvenanceInvalid || input.equipmentProjection.readiness !== "Ready" || input.equipmentReadiness.state !== "Ready") {
    blockers.push("EquipmentNotReady");
  }
  if (input.suitState.actorId !== actorId || input.suitState.criticalState || input.suitState.actorIncapacitated ||
      input.suitInterface.stateId !== input.suitState.stateId || input.suitInterface.revision !== input.suitState.revision ||
      input.suitInterface.actorIncapacitated || !input.suitInterface.equipmentBusOnline) blockers.push("SuitNotReady");
  if (!environmentIsSafe(definition, input.environment)) blockers.push("EnvironmentUnsafe");
  if (definition.legality.legalStatus === "Illegal" && !input.actorContext.legalOverride) blockers.push("IllegalExtraction");
  const claimAllowed = actorCanExtractClaim(node, actorId);
  const hasPermit = definition.legality.requiredPermitId !== undefined &&
    input.actorContext.permissions.includes(definition.legality.requiredPermitId);
  if (definition.legality.ownershipPolicy === "OwnerOnly" && !claimAllowed) blockers.push("OwnershipDenied");
  if (definition.legality.ownershipPolicy === "PermitOrOwner" && !claimAllowed && !hasPermit) blockers.push("OwnershipDenied");
  if (input.target.definition.containerId !== input.targetContainerId || input.target.state.containerId !== input.targetContainerId) {
    blockers.push("InvalidPulse");
  }
  const sourceStack = node.reservoir.state.contents.find((stack) => stack.resourceId === definition.resourceId);
  if (sourceStack === undefined) {
    blockers.push("NodeDepleted");
  } else {
    const eligibility = evaluateContainerEligibility(input.target.definition, input.catalog, sourceStack, actorId);
    if (eligibility.issues.some((issue) => issue === "HazardNotAllowed" || issue === "HazardBlocked")) {
      blockers.push("HazardContainerRequired");
    }
    if (eligibility.issues.includes("OwnershipDenied")) blockers.push("OwnershipDenied");
  }
  if (!targetCapacityForMinimumYield(definition, input.target, input.catalog)) blockers.push("TargetCapacityExceeded");

  const blockReasons = orderedBlockReasons(blockers);
  const state: ExtractionSessionState = blockReasons.length === 0 ? "Prepared" : "Blocked";
  if (!EXTRACTION_SESSION_STATES.includes(state)) fail("Invalid derived session state.");
  const session = finalizeSession({
    schema: "weltraum.surface-extraction-session",
    schemaVersion: SURFACE_EXTRACTION_SCHEMA_VERSION,
    sessionId: stableId(input.sessionId, "sessionId"),
    nodeId: node.nodeId,
    actorId,
    resourceId: definition.resourceId,
    equipment: equipmentSnapshot(
      input.blueprint,
      input.equipmentStats,
      input.equipmentReadiness,
      input.equipmentProjection
    ),
    suit: suitSnapshot(input.suitState, input.suitInterface),
    environmentSignature: input.environment.signature,
    targetContainerId: stableId(input.targetContainerId, "targetContainerId"),
    startedUniverseTick: safeInteger(input.startedUniverseTick, "startedUniverseTick"),
    revision: 0,
    pulseSequence: 0,
    state,
    blockReasons,
    pulseReceipts: Object.freeze([])
  });
  const eventIntents: readonly ExtractionEventIntent[] = state === "Prepared"
    ? Object.freeze([freezeSurfaceExtraction({
        intentId: `event:${session.sessionId}:prepared`,
        type: "ExtractionPrepared",
        sessionId: session.sessionId,
        nodeId: node.nodeId,
        actorId,
        universeTick: session.startedUniverseTick
      }) as ExtractionEventIntent])
    : Object.freeze([]);
  return freezeSurfaceExtraction({ ready: state === "Prepared", session, blockReasons, eventIntents }) as ExtractionPreparationResult;
};

const transitionBlocked = (
  session: ExtractionSession,
  reason: ExtractionBlockReason,
  node?: SurfaceResourceNodeState
): ExtractionSessionTransitionResult => freezeSurfaceExtraction({
  status: "Blocked",
  reason,
  session,
  ...(node === undefined ? {} : { node }),
  eventIntents: Object.freeze([])
}) as ExtractionSessionTransitionResult;

export const beginExtractionSession = (
  session: ExtractionSession,
  node: SurfaceResourceNodeState,
  expectedSessionRevision: number,
  expectedNodeRevision: number,
  universeTick: number
): ExtractionSessionTransitionResult => {
  if (node.revision !== expectedNodeRevision) return transitionBlocked(session, "NodeRevisionConflict", node);
  if (session.revision !== expectedSessionRevision) return transitionBlocked(session, "SessionRevisionConflict", node);
  if (session.state !== "Prepared") return transitionBlocked(session, "InvalidPulse", node);
  if (node.depletionState === "Depleted") return transitionBlocked(session, "NodeDepleted", node);
  if (node.activeSessionId !== undefined && node.activeSessionId !== session.sessionId) {
    return transitionBlocked(session, "ActiveSessionConflict", node);
  }
  const nextSession = replaceSession(session, { revision: session.revision + 1, state: "Active", blockReasons: Object.freeze([]) });
  const nextNode = replaceNode(node, { revision: node.revision + 1, activeSessionId: session.sessionId });
  const eventIntents = Object.freeze([freezeSurfaceExtraction({
    intentId: `event:${session.sessionId}:started`,
    type: "ExtractionStarted",
    sessionId: session.sessionId,
    nodeId: node.nodeId,
    actorId: session.actorId,
    universeTick: safeInteger(universeTick, "universeTick")
  }) as ExtractionEventIntent]);
  return freezeSurfaceExtraction({ status: "Applied", session: nextSession, node: nextNode, eventIntents }) as ExtractionSessionTransitionResult;
};

const sessionOnlyTransition = (
  session: ExtractionSession,
  expectedRevision: number,
  universeTick: number,
  fromStates: readonly ExtractionSessionState[],
  toState: ExtractionSessionState,
  eventType: "ExtractionPaused" | "ExtractionResumed"
): ExtractionSessionTransitionResult => {
  if (session.revision !== expectedRevision) return transitionBlocked(session, "SessionRevisionConflict");
  if (!fromStates.includes(session.state)) return transitionBlocked(session, "InvalidPulse");
  const next = replaceSession(session, { revision: session.revision + 1, state: toState, blockReasons: Object.freeze([]) });
  const eventIntents = Object.freeze([freezeSurfaceExtraction({
    intentId: `event:${session.sessionId}:${toState.toLowerCase()}:${next.revision}`,
    type: eventType,
    sessionId: session.sessionId,
    nodeId: session.nodeId,
    actorId: session.actorId,
    universeTick: safeInteger(universeTick, "universeTick")
  }) as ExtractionEventIntent]);
  return freezeSurfaceExtraction({ status: "Applied", session: next, eventIntents }) as ExtractionSessionTransitionResult;
};

export const pauseExtractionSession = (
  session: ExtractionSession,
  expectedRevision: number,
  universeTick: number
): ExtractionSessionTransitionResult => sessionOnlyTransition(
  session,
  expectedRevision,
  universeTick,
  ["Active"],
  "Paused",
  "ExtractionPaused"
);

export const resumeExtractionSession = (
  session: ExtractionSession,
  expectedRevision: number,
  universeTick: number
): ExtractionSessionTransitionResult => sessionOnlyTransition(
  session,
  expectedRevision,
  universeTick,
  ["Paused"],
  "Active",
  "ExtractionResumed"
);

export const cancelExtractionSession = (
  session: ExtractionSession,
  node: SurfaceResourceNodeState,
  expectedSessionRevision: number,
  expectedNodeRevision: number,
  universeTick: number
): ExtractionSessionTransitionResult => {
  if (node.revision !== expectedNodeRevision) return transitionBlocked(session, "NodeRevisionConflict", node);
  if (session.revision !== expectedSessionRevision) return transitionBlocked(session, "SessionRevisionConflict", node);
  if (!["Prepared", "Active", "Paused", "Blocked"].includes(session.state)) {
    return transitionBlocked(session, "InvalidPulse", node);
  }
  if (node.activeSessionId !== undefined && node.activeSessionId !== session.sessionId) {
    return transitionBlocked(session, "ActiveSessionConflict", node);
  }
  const nextSession = replaceSession(session, {
    revision: session.revision + 1,
    state: "Cancelled",
    blockReasons: Object.freeze([])
  });
  const nextNode = node.activeSessionId === session.sessionId
    ? replaceNode(node, { revision: node.revision + 1, clearActiveSession: true })
    : node;
  const eventIntents = Object.freeze([freezeSurfaceExtraction({
    intentId: `event:${session.sessionId}:cancelled`,
    type: "ExtractionCancelled",
    sessionId: session.sessionId,
    nodeId: session.nodeId,
    actorId: session.actorId,
    universeTick: safeInteger(universeTick, "universeTick")
  }) as ExtractionEventIntent]);
  return freezeSurfaceExtraction({ status: "Applied", session: nextSession, node: nextNode, eventIntents }) as ExtractionSessionTransitionResult;
};

const demandIntentFor = (session: ExtractionSession): ExtractionEnergyHeatToolIntent => freezeSurfaceExtraction({
  toolId: session.equipment.toolId,
  pulseEnergyMillijoules: session.equipment.pulseEnergyMillijoules,
  heatMillijoules: session.equipment.heatPerActionMillijoules,
  toolUseTicks: session.equipment.cycleTicks
}) as ExtractionEnergyHeatToolIntent;

const commandSignature = (command: ExtractionPulseCommand): string => surfaceExtractionSignature({
  idempotencyKey: stableId(command.idempotencyKey, "idempotencyKey"),
  expectedSessionRevision: safeInteger(command.expectedSessionRevision, "expectedSessionRevision"),
  expectedNodeRevision: safeInteger(command.expectedNodeRevision, "expectedNodeRevision"),
  expectedTargetRevision: safeInteger(command.expectedTargetRevision, "expectedTargetRevision"),
  explicitTickDelta: safeInteger(command.explicitTickDelta, "explicitTickDelta", 1),
  pulseIndex: safeInteger(command.pulseIndex, "pulseIndex", 1),
  deterministicSeed: stableId(command.deterministicSeed, "deterministicSeed"),
  universeTick: safeInteger(command.universeTick, "universeTick")
});

export const calculateDeterministicPulseYield = (
  definition: SurfaceResourceNodeDefinition,
  session: ExtractionSession,
  environment: PlanetaryEnvironmentSample,
  command: ExtractionPulseCommand,
  remainingQuantity: number,
  catalog: ResourceCatalog
): number => {
  if (environment.signature !== session.environmentSignature) fail("Environment signature does not match the session snapshot.");
  const resource = findResourceDefinition(catalog, definition.resourceId);
  if (resource === undefined) return fail("Node resource is absent from the supplied Resource Catalog.");
  const rollSignature = surfaceExtractionSignature({
    definitionSignature: definition.canonicalSignature,
    grade: definition.grade,
    gradeBasisPoints: definition.gradeBasisPoints,
    equipmentSignature: session.equipment.signature,
    pulseIndex: command.pulseIndex,
    deterministicSeed: command.deterministicSeed,
    environmentSignature: environment.signature
  });
  const roll = Number.parseInt(rollSignature.slice(-8), 16) / 0xffffffff;
  const base = definition.pulseYieldRange.minimum +
    (definition.pulseYieldRange.maximum - definition.pulseYieldRange.minimum) * roll;
  const equipmentBasisPoints = clamp(
    Math.round(session.equipment.pulseEnergyMillijoules * 10_000 / definition.hardnessBasisPoints),
    2_500,
    15_000
  );
  const environmentPenalty = 1 +
    environment.dustLoad * definition.dustFactor +
    environment.contamination * definition.contaminationFactor +
    environment.sporeLoad * definition.contaminationFactor +
    environment.corrosiveExposure * definition.contaminationFactor;
  const environmentBasisPoints = clamp(Math.round(10_000 / environmentPenalty), 1_000, 10_000);
  let quantity = base * definition.gradeBasisPoints * equipmentBasisPoints * environmentBasisPoints / 1_000_000_000_000;
  if (resource.stackRule.kind !== "Bulk") quantity = Math.max(1, Math.floor(quantity));
  return roundQuantity(Math.min(finite(remainingQuantity, "remainingQuantity"), quantity));
};

const transferBlockReason = (code: ResourceTransferRejectionCode | undefined): ExtractionBlockReason => {
  switch (code) {
    case "TargetMassExceeded":
    case "TargetVolumeExceeded":
    case "TargetStackLimitExceeded":
      return "TargetCapacityExceeded";
    case "HazardBlocked":
      return "HazardContainerRequired";
    case "OwnershipDenied":
    case "AccessDenied":
      return "OwnershipDenied";
    case "SourceRevisionConflict":
      return "NodeRevisionConflict";
    default:
      return "InvalidPulse";
  }
};

const blockedPulse = (
  reason: ExtractionBlockReason,
  node: SurfaceResourceNodeState,
  session: ExtractionSession,
  target: ResourceContainerSnapshot,
  demandIntent: ExtractionEnergyHeatToolIntent,
  command?: ExtractionPulseCommand
): ExtractionPulseResult => {
  const pulseSignature = surfaceExtractionSignature({
    status: "Blocked",
    reason,
    nodeSignature: node.canonicalSignature,
    sessionSignature: session.canonicalSignature,
    targetSignature: target.signature,
    ...(command === undefined ? {} : { commandSignature: commandSignature(command) })
  });
  return freezeSurfaceExtraction({
    status: "Blocked",
    reason,
    extractedQuantity: 0,
    demandIntent,
    node,
    session,
    target,
    eventIntents: Object.freeze([]),
    missionIntents: Object.freeze([]),
    pulseSignature
  }) as ExtractionPulseResult;
};

export const executeExtractionPulse = (
  definition: SurfaceResourceNodeDefinition,
  node: SurfaceResourceNodeState,
  session: ExtractionSession,
  target: ResourceContainerSnapshot,
  environment: PlanetaryEnvironmentSample,
  catalog: ResourceCatalog,
  command: ExtractionPulseCommand
): ExtractionPulseResult => {
  const demandIntent = demandIntentFor(session);
  let currentCommandSignature: string;
  try {
    currentCommandSignature = commandSignature(command);
  } catch {
    return blockedPulse("InvalidPulse", node, session, target, demandIntent);
  }
  const priorReceipt = session.pulseReceipts.find((receipt) => receipt.idempotencyKey === command.idempotencyKey);
  if (priorReceipt !== undefined) {
    if (priorReceipt.commandSignature !== currentCommandSignature ||
        priorReceipt.nodeRevisionAfter !== node.revision ||
        priorReceipt.sessionRevisionAfter !== session.revision ||
        priorReceipt.targetSignatureAfter !== target.signature) {
      return blockedPulse("InvalidPulse", node, session, target, demandIntent, command);
    }
    return freezeSurfaceExtraction({
      status: "Idempotent",
      extractedQuantity: priorReceipt.extractedQuantity,
      demandIntent: priorReceipt.demandIntent,
      transferResult: priorReceipt.transferResult,
      node,
      session,
      target,
      eventIntents: priorReceipt.eventIntents,
      missionIntents: priorReceipt.missionIntents,
      pulseSignature: priorReceipt.pulseSignature
    }) as ExtractionPulseResult;
  }
  if (node.revision !== command.expectedNodeRevision) {
    return blockedPulse("NodeRevisionConflict", node, session, target, demandIntent, command);
  }
  if (session.revision !== command.expectedSessionRevision) {
    return blockedPulse("SessionRevisionConflict", node, session, target, demandIntent, command);
  }
  if (session.state !== "Active" || node.activeSessionId !== session.sessionId || session.nodeId !== node.nodeId) {
    return blockedPulse("InvalidPulse", node, session, target, demandIntent, command);
  }
  if (node.depletionState === "Depleted") return blockedPulse("NodeDepleted", node, session, target, demandIntent, command);
  if (command.pulseIndex !== session.pulseSequence + 1) {
    return blockedPulse("InvalidPulse", node, session, target, demandIntent, command);
  }
  if (target.definition.containerId !== session.targetContainerId || target.state.revision !== command.expectedTargetRevision) {
    return blockedPulse("InvalidPulse", node, session, target, demandIntent, command);
  }
  if (environment.signature !== session.environmentSignature || !environmentIsSafe(definition, environment)) {
    return blockedPulse("EnvironmentUnsafe", node, session, target, demandIntent, command);
  }
  const remaining = node.reservoir.depletion?.remainingQuantity ?? 0;
  const quantity = calculateDeterministicPulseYield(definition, session, environment, command, remaining, catalog);
  if (!(quantity > 0)) return blockedPulse("InvalidPulse", node, session, target, demandIntent, command);

  const transferResult = extractFromMiningReservoir({
    source: { containerId: node.reservoir.definition.containerId, expectedRevision: node.reservoir.state.revision },
    target: { containerId: target.definition.containerId, expectedRevision: target.state.revision },
    resourceId: definition.resourceId,
    quantity,
    allowPartial: false,
    context: isSaveSafeResourceId(session.actorId) ? { actorId: session.actorId } : {}
  }, catalog, node.reservoir, target);
  if (transferResult.status !== "Accepted") {
    return freezeSurfaceExtraction({
      ...blockedPulse(transferBlockReason(transferResult.code), node, session, target, demandIntent, command),
      transferResult
    }) as ExtractionPulseResult;
  }

  const nodeDepleted = (transferResult.source.depletion?.remainingQuantity ?? 0) <= 0;
  const nextNode = replaceNode(node, {
    revision: node.revision + 1,
    reservoir: transferResult.source,
    ...(nodeDepleted ? { clearActiveSession: true } : {})
  });
  const eventIntents: ExtractionEventIntent[] = [
    freezeSurfaceExtraction({
      intentId: `event:${session.sessionId}:pulse:${command.pulseIndex}`,
      type: "ExtractionPulseExecuted",
      sessionId: session.sessionId,
      nodeId: node.nodeId,
      actorId: session.actorId,
      universeTick: command.universeTick,
      pulseIndex: command.pulseIndex,
      quantity: transferResult.acceptedQuantity
    }) as ExtractionEventIntent,
    freezeSurfaceExtraction({
      intentId: `event:${session.sessionId}:transfer:${command.pulseIndex}`,
      type: "ResourceTransferred",
      sessionId: session.sessionId,
      nodeId: node.nodeId,
      actorId: session.actorId,
      universeTick: command.universeTick,
      pulseIndex: command.pulseIndex,
      quantity: transferResult.acceptedQuantity
    }) as ExtractionEventIntent
  ];
  if (nodeDepleted) eventIntents.push(freezeSurfaceExtraction({
    intentId: `event:${session.sessionId}:depleted`,
    type: "NodeDepleted",
    sessionId: session.sessionId,
    nodeId: node.nodeId,
    actorId: session.actorId,
    universeTick: command.universeTick,
    pulseIndex: command.pulseIndex,
    quantity: transferResult.acceptedQuantity
  }) as ExtractionEventIntent);
  const missionIntents: ExtractionMissionIntent[] = [freezeSurfaceExtraction({
    intentId: `mission:${session.sessionId}:progress:${command.pulseIndex}`,
    type: "RecordExtractionProgress",
    sessionId: session.sessionId,
    nodeId: node.nodeId,
    resourceId: definition.resourceId,
    quantity: transferResult.acceptedQuantity,
    pulseIndex: command.pulseIndex
  }) as ExtractionMissionIntent];
  if (nodeDepleted) missionIntents.push(freezeSurfaceExtraction({
    intentId: `mission:${session.sessionId}:complete`,
    type: "CompleteExtractionObjective",
    sessionId: session.sessionId,
    nodeId: node.nodeId,
    resourceId: definition.resourceId,
    quantity: transferResult.acceptedQuantity,
    pulseIndex: command.pulseIndex
  }) as ExtractionMissionIntent);
  const sessionRevisionAfter = session.revision + 1;
  const pulseSignature = surfaceExtractionSignature({
    commandSignature: currentCommandSignature,
    extractedQuantity: transferResult.acceptedQuantity,
    nodeSignatureAfter: nextNode.canonicalSignature,
    sessionRevisionAfter,
    targetSignatureAfter: transferResult.target.signature,
    transferStatus: transferResult.status,
    demandIntent,
    eventIntents,
    missionIntents
  });
  const receipt = freezeSurfaceExtraction({
    idempotencyKey: command.idempotencyKey,
    commandSignature: currentCommandSignature,
    pulseSignature,
    pulseIndex: command.pulseIndex,
    extractedQuantity: transferResult.acceptedQuantity,
    nodeRevisionAfter: nextNode.revision,
    sessionRevisionAfter,
    targetSignatureAfter: transferResult.target.signature,
    demandIntent,
    transferResult,
    eventIntents: Object.freeze(eventIntents),
    missionIntents: Object.freeze(missionIntents)
  }) as ExtractionPulseReceipt;
  const nextSession = replaceSession(session, {
    revision: sessionRevisionAfter,
    pulseSequence: command.pulseIndex,
    state: nodeDepleted ? "Completed" : "Active",
    blockReasons: Object.freeze([]),
    pulseReceipts: Object.freeze([...session.pulseReceipts, receipt])
  });
  return freezeSurfaceExtraction({
    status: "Applied",
    extractedQuantity: transferResult.acceptedQuantity,
    demandIntent,
    transferResult,
    node: nextNode,
    session: nextSession,
    target: transferResult.target,
    eventIntents: Object.freeze(eventIntents),
    missionIntents: Object.freeze(missionIntents),
    pulseSignature
  }) as ExtractionPulseResult;
};

export const canonicalExtractionSessionJson = (session: ExtractionSession): string =>
  canonicalSurfaceExtractionJson(sessionSignaturePayload(session));
