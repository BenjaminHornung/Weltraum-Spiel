import type { DamageType } from "../combat";
import { createInteractionToolId, type InteractionCapabilityId, type InteractionToolId } from "../interaction";
import type { ResourceRequirement } from "../resources";
import { cloneAndFreezeSurfaceEquipmentValue } from "./canonical";
import type { SurfaceEquipmentDiagnostic } from "./diagnostics";
import type { SurfaceEquipmentSuitReadiness } from "./readiness";
import { assertSurfaceEquipmentStatsProvenance, type SurfaceEquipmentDerivedStats } from "./stats";
import type {
  SurfaceEquipmentBlueprint,
  SurfaceEquipmentDeliveryClass,
  SurfaceEquipmentLegalClass,
  SurfaceEquipmentReadinessState,
  SurfaceEquipmentSafetyMetadata
} from "./types";
import { surfaceEquipmentDataError, surfaceEquipmentDataPath } from "./validation";

export const SURFACE_EQUIPMENT_RANGE_CLASSES = Object.freeze(["Contact", "Short", "Medium", "Long"] as const);
export type SurfaceEquipmentRangeClass = (typeof SURFACE_EQUIPMENT_RANGE_CLASSES)[number];

export interface SurfaceEquipmentEnergyIntent {
  readonly continuousPowerMilliwatts: number;
  readonly pulseEnergyMillijoules: number;
}

export interface InteractionCapabilityProjection {
  readonly equipmentId: SurfaceEquipmentBlueprint["blueprintId"];
  readonly equipmentRevision: SurfaceEquipmentBlueprint["revision"];
  readonly capabilityIds: readonly InteractionCapabilityId[];
  readonly toolId: InteractionToolId;
  readonly rangeClass: SurfaceEquipmentRangeClass;
  readonly maximumRangeMillimeters: number;
  readonly energyIntent: SurfaceEquipmentEnergyIntent;
  readonly resourceRequirements: readonly ResourceRequirement[];
  readonly safetyMetadata: SurfaceEquipmentSafetyMetadata;
  readonly legalClass: SurfaceEquipmentLegalClass;
  readonly readiness: SurfaceEquipmentReadinessState;
}

const rangeClassFor = (rangeMillimeters: number): SurfaceEquipmentRangeClass => {
  if (rangeMillimeters <= 2_000) return "Contact";
  if (rangeMillimeters <= 10_000) return "Short";
  if (rangeMillimeters <= 50_000) return "Medium";
  return "Long";
};

const assertProjectionProvenance = (
  blueprint: SurfaceEquipmentBlueprint,
  stats: SurfaceEquipmentDerivedStats,
  readiness: SurfaceEquipmentSuitReadiness
): void => {
  assertSurfaceEquipmentStatsProvenance(blueprint, stats);
  const checks = [
    ["blueprintId", readiness.blueprintId, blueprint.blueprintId],
    ["revision", readiness.revision, blueprint.revision],
    ["catalogId", readiness.catalogId, blueprint.catalogId],
    ["catalogVersion", readiness.catalogVersion, blueprint.catalogVersion],
    ["statsSignature", readiness.statsSignature, stats.signature]
  ] as const;
  for (const [field, actual, expected] of checks) {
    if (actual !== expected) {
      throw surfaceEquipmentDataError(
        "InvalidValue",
        surfaceEquipmentDataPath("/readiness", field),
        "Readiness provenance does not match the supplied blueprint and stats."
      );
    }
  }
};

export const createInteractionCapabilityProjection = (
  blueprint: SurfaceEquipmentBlueprint,
  stats: SurfaceEquipmentDerivedStats,
  readiness: SurfaceEquipmentSuitReadiness
): InteractionCapabilityProjection => {
  assertProjectionProvenance(blueprint, stats, readiness);
  return cloneAndFreezeSurfaceEquipmentValue({
  equipmentId: blueprint.blueprintId,
  equipmentRevision: blueprint.revision,
  capabilityIds: stats.interactionCapabilities,
  toolId: createInteractionToolId(`tool:${blueprint.contentSignature}`),
  rangeClass: rangeClassFor(stats.effectiveRangeMillimeters),
  maximumRangeMillimeters: stats.effectiveRangeMillimeters,
  energyIntent: {
    continuousPowerMilliwatts: stats.continuousPowerMilliwatts,
    pulseEnergyMillijoules: stats.pulseEnergyMillijoules
  },
  resourceRequirements: stats.resourceRequirements,
  safetyMetadata: stats.safetyMetadata,
  legalClass: stats.legalClass,
  readiness: readiness.state
  }) as InteractionCapabilityProjection;
};

export interface SurfaceEquipmentFirePermissionMetadata {
  readonly readinessRequired: "Ready";
  readonly currentReadiness: SurfaceEquipmentReadinessState;
  readonly safetyCertified: boolean;
  readonly interlockRequired: boolean;
  readonly legalClass: SurfaceEquipmentLegalClass;
}

export interface SurfaceEquipmentCombatCapabilityProjection {
  readonly equipmentId: SurfaceEquipmentBlueprint["blueprintId"];
  readonly equipmentRevision: SurfaceEquipmentBlueprint["revision"];
  readonly damageType: DamageType;
  readonly deliveryClass: SurfaceEquipmentDeliveryClass;
  readonly rangeMillimeters: number;
  readonly cycleTicks: number;
  readonly ammoCapacityUnits: number;
  readonly ammoResourceRequirements: readonly ResourceRequirement[];
  readonly continuousPowerMilliwatts: number;
  readonly energyPerActionMillijoules: number;
  readonly heatPerActionMillijoules: number;
  readonly firePermission: SurfaceEquipmentFirePermissionMetadata;
}

export type SurfaceEquipmentCombatProjectionResult =
  | { readonly status: "Available"; readonly projection: SurfaceEquipmentCombatCapabilityProjection }
  | { readonly status: "Absent"; readonly reason: "CategoryInapplicable" }
  | {
    readonly status: "Rejected";
    readonly reason: "DamageDeliveryIncomplete" | "ConfigurationInvalid";
    readonly diagnostics: readonly SurfaceEquipmentDiagnostic[];
  };

export const createCombatCapabilityProjection = (
  blueprint: SurfaceEquipmentBlueprint,
  stats: SurfaceEquipmentDerivedStats,
  readiness: SurfaceEquipmentSuitReadiness
): SurfaceEquipmentCombatProjectionResult => {
  assertProjectionProvenance(blueprint, stats, readiness);
  if (!(["Sidearm", "Longarm", "BreachingTool"] as const).includes(
    blueprint.category as "Sidearm" | "Longarm" | "BreachingTool"
  )) {
    return cloneAndFreezeSurfaceEquipmentValue({ status: "Absent", reason: "CategoryInapplicable" }) as SurfaceEquipmentCombatProjectionResult;
  }
  const configurationDiagnostics = stats.diagnostics.filter((diagnostic) => diagnostic.severity === "Error");
  const deliveryComplete = stats.damageType !== undefined && stats.deliveryClass !== undefined &&
    stats.effectiveRangeMillimeters > 0 && stats.cycleTicks > 0;
  if (!deliveryComplete) {
    return cloneAndFreezeSurfaceEquipmentValue({
      status: "Rejected",
      reason: "DamageDeliveryIncomplete",
      diagnostics: configurationDiagnostics
    }) as SurfaceEquipmentCombatProjectionResult;
  }
  if (configurationDiagnostics.length > 0) {
    return cloneAndFreezeSurfaceEquipmentValue({
      status: "Rejected",
      reason: "ConfigurationInvalid",
      diagnostics: configurationDiagnostics
    }) as SurfaceEquipmentCombatProjectionResult;
  }
  return cloneAndFreezeSurfaceEquipmentValue({
    status: "Available",
    projection: {
      equipmentId: blueprint.blueprintId,
      equipmentRevision: blueprint.revision,
      damageType: stats.damageType,
      deliveryClass: stats.deliveryClass,
      rangeMillimeters: stats.effectiveRangeMillimeters,
      cycleTicks: stats.cycleTicks,
      ammoCapacityUnits: stats.capacity.ammoUnits,
      ammoResourceRequirements: stats.capacity.ammoUnits > 0 ? stats.resourceRequirements : [],
      continuousPowerMilliwatts: stats.continuousPowerMilliwatts,
      energyPerActionMillijoules: stats.pulseEnergyMillijoules,
      heatPerActionMillijoules: stats.heatPerActionMillijoules,
      firePermission: {
        readinessRequired: "Ready",
        currentReadiness: readiness.state,
        safetyCertified: stats.safetyMetadata.certified,
        interlockRequired: stats.safetyMetadata.interlockRequired,
        legalClass: stats.legalClass
      }
    }
  }) as SurfaceEquipmentCombatProjectionResult;
};

export const createSurfaceEquipmentCombatProjection = createCombatCapabilityProjection;
