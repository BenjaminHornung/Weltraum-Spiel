import type { SuitEquipmentInterfaceSnapshot } from "../suit";
import { cloneAndFreezeSurfaceEquipmentValue, createSurfaceEquipmentSignature } from "./canonical";
import type { SurfaceEquipmentDiagnosticCode } from "./diagnostics";
import type { SurfaceEquipmentSignature } from "./ids";
import { assertSurfaceEquipmentStatsProvenance, type SurfaceEquipmentDerivedStats } from "./stats";
import type { SurfaceEquipmentBlueprint, SurfaceEquipmentCategory, SurfaceEquipmentReadinessState } from "./types";
import { compareSurfaceEquipmentText } from "./validation";

export type SurfaceEquipmentReadinessImpact = "Limited" | "Blocked";
export type SurfaceEquipmentReadinessPhase =
  | "Actor"
  | "EquipmentBus"
  | "Interfaces"
  | "StructureSafety"
  | "ContinuousPower"
  | "PulseReserve"
  | "ThermalDissipation"
  | "GripHandedness";

export interface SurfaceEquipmentReadinessBlocker {
  readonly code: SurfaceEquipmentDiagnosticCode;
  readonly impact: SurfaceEquipmentReadinessImpact;
  readonly phase: SurfaceEquipmentReadinessPhase;
  readonly path: string;
  readonly message: string;
  readonly required?: number | string;
  readonly available?: number | string;
}

export interface SurfaceEquipmentSuitReadiness {
  readonly blueprintId: SurfaceEquipmentBlueprint["blueprintId"];
  readonly revision: SurfaceEquipmentBlueprint["revision"];
  readonly catalogId: SurfaceEquipmentBlueprint["catalogId"];
  readonly catalogVersion: SurfaceEquipmentBlueprint["catalogVersion"];
  readonly statsSignature: SurfaceEquipmentDerivedStats["signature"];
  readonly suitStateId: SuitEquipmentInterfaceSnapshot["stateId"];
  readonly suitRevision: SuitEquipmentInterfaceSnapshot["revision"];
  readonly state: SurfaceEquipmentReadinessState;
  readonly blockers: readonly SurfaceEquipmentReadinessBlocker[];
  readonly signature: SurfaceEquipmentSignature;
}

/**
 * Deterministic V1 budget policy:
 * - a zero available budget with non-zero demand is always Blocked;
 * - Sidearm, Longarm, and BreachingTool budget shortfalls are always Blocked;
 * - other categories with a positive-but-insufficient budget are Limited.
 * Limited is advisory capacity degradation only. It never authorizes consumption or mutation.
 */
export const SURFACE_EQUIPMENT_BUDGET_READINESS_POLICY = Object.freeze({
  zeroAvailable: "Blocked",
  safetyCriticalShortfall: "Blocked",
  utilityPositiveShortfall: "Limited"
} as const);

const safetyCriticalCategories: readonly SurfaceEquipmentCategory[] = Object.freeze([
  "BreachingTool", "Sidearm", "Longarm"
]);
const readinessPhaseOrder: readonly SurfaceEquipmentReadinessPhase[] = Object.freeze([
  "Actor", "EquipmentBus", "Interfaces", "StructureSafety", "ContinuousPower",
  "PulseReserve", "ThermalDissipation", "GripHandedness"
]);

const impactForBudget = (
  category: SurfaceEquipmentCategory,
  available: number
): SurfaceEquipmentReadinessImpact => available === 0 || safetyCriticalCategories.includes(category)
  ? "Blocked"
  : "Limited";

const orderedBlockers = (
  blockers: readonly SurfaceEquipmentReadinessBlocker[]
): readonly SurfaceEquipmentReadinessBlocker[] => cloneAndFreezeSurfaceEquipmentValue(
  blockers.slice().sort((left, right) => {
    const phaseComparison = readinessPhaseOrder.indexOf(left.phase) - readinessPhaseOrder.indexOf(right.phase);
    if (phaseComparison !== 0) return phaseComparison;
    const pathComparison = compareSurfaceEquipmentText(left.path, right.path);
    if (pathComparison !== 0) return pathComparison;
    return compareSurfaceEquipmentText(left.code, right.code);
  })
) as readonly SurfaceEquipmentReadinessBlocker[];

export const evaluateEquipmentSuitReadiness = (
  blueprint: SurfaceEquipmentBlueprint,
  stats: SurfaceEquipmentDerivedStats,
  suitInterfaceSnapshot: SuitEquipmentInterfaceSnapshot
): SurfaceEquipmentSuitReadiness => {
  assertSurfaceEquipmentStatsProvenance(blueprint, stats);
  const blockers: SurfaceEquipmentReadinessBlocker[] = [];
  if (suitInterfaceSnapshot.actorIncapacitated) blockers.push({
    code: "SuitActorIncapacitated", impact: "Blocked", phase: "Actor", path: "/suit/actorIncapacitated",
    message: "Incapacitated actors cannot ready equipment."
  });
  if (!suitInterfaceSnapshot.equipmentBusOnline) blockers.push({
    code: "SuitEquipmentBusOffline", impact: "Blocked", phase: "EquipmentBus", path: "/suit/equipmentBusOnline",
    message: "Suit equipment bus is offline."
  });
  for (const interfaceId of stats.requiredSuitInterfaces) {
    if (!suitInterfaceSnapshot.interfaceIds.includes(interfaceId)) blockers.push({
      code: "InterfaceMissing", impact: "Blocked", phase: "Interfaces", path: `/suit/interfaces/${interfaceId}`,
      message: "Suit does not expose a required equipment interface.", required: interfaceId
    });
  }
  for (const diagnostic of stats.diagnostics) {
    if (diagnostic.severity !== "Error" || [
      "ContinuousPowerExceeded", "PulseEnergyExceeded", "ThermalBudgetExceeded",
      "SuitActorIncapacitated", "SuitEquipmentBusOffline"
    ].includes(diagnostic.code)) continue;
    blockers.push({
      code: diagnostic.code, impact: "Blocked", phase: "StructureSafety", path: diagnostic.path,
      message: diagnostic.message
    });
  }
  if (stats.continuousPowerMilliwatts > suitInterfaceSnapshot.continuousPowerBudgetMilliwatts) blockers.push({
    code: "ContinuousPowerExceeded",
    impact: impactForBudget(blueprint.category, suitInterfaceSnapshot.continuousPowerBudgetMilliwatts),
    phase: "ContinuousPower", path: "/suit/continuousPowerBudgetMilliwatts",
    message: "Equipment continuous-power demand exceeds the suit budget.",
    required: stats.continuousPowerMilliwatts, available: suitInterfaceSnapshot.continuousPowerBudgetMilliwatts
  });
  if (stats.pulseEnergyMillijoules > suitInterfaceSnapshot.pulseEnergyAvailableMillijoules) blockers.push({
    code: "PulseEnergyExceeded",
    impact: impactForBudget(blueprint.category, suitInterfaceSnapshot.pulseEnergyAvailableMillijoules),
    phase: "PulseReserve", path: "/suit/pulseEnergyAvailableMillijoules",
    message: "Equipment pulse-energy intent exceeds the available suit reserve.",
    required: stats.pulseEnergyMillijoules, available: suitInterfaceSnapshot.pulseEnergyAvailableMillijoules
  });
  if (stats.netThermalBurdenMilliwatts > suitInterfaceSnapshot.thermalDissipationBudgetMilliwatts) blockers.push({
    code: "ThermalBudgetExceeded",
    impact: impactForBudget(blueprint.category, suitInterfaceSnapshot.thermalDissipationBudgetMilliwatts),
    phase: "ThermalDissipation", path: "/suit/thermalDissipationBudgetMilliwatts",
    message: "Equipment net thermal burden exceeds suit dissipation capacity.",
    required: stats.netThermalBurdenMilliwatts, available: suitInterfaceSnapshot.thermalDissipationBudgetMilliwatts
  });
  const handedness = blueprint.tags.includes("handed:left" as SurfaceEquipmentBlueprint["tags"][number])
    ? "left" : blueprint.tags.includes("handed:right" as SurfaceEquipmentBlueprint["tags"][number]) ? "right" : undefined;
  if (handedness !== undefined && !suitInterfaceSnapshot.interfaceIds.some((id) => id === `interface:grip-${handedness}`)) {
    blockers.push({
      code: "GripRequirementUnsatisfied", impact: "Blocked", phase: "GripHandedness",
      path: `/suit/interfaces/interface:grip-${handedness}`,
      message: "Suit does not expose the optional handed grip interface.", required: `interface:grip-${handedness}`
    });
  }
  const ordered = orderedBlockers(blockers);
  const state: SurfaceEquipmentReadinessState = ordered.some((blocker) => blocker.impact === "Blocked")
    ? "Blocked" : ordered.length > 0 ? "Limited" : "Ready";
  const payload = {
    blueprintId: blueprint.blueprintId,
    revision: blueprint.revision,
    catalogId: blueprint.catalogId,
    catalogVersion: blueprint.catalogVersion,
    statsSignature: stats.signature,
    suitStateId: suitInterfaceSnapshot.stateId,
    suitRevision: suitInterfaceSnapshot.revision,
    state,
    blockers: ordered
  };
  return cloneAndFreezeSurfaceEquipmentValue({
    ...payload,
    signature: createSurfaceEquipmentSignature({
      ...payload,
      blueprintSignature: blueprint.contentSignature,
      statsSignature: stats.signature,
      suitSignature: suitInterfaceSnapshot.canonicalSignature
    })
  }) as SurfaceEquipmentSuitReadiness;
};
