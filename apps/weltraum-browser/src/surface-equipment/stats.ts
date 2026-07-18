import type { DamageType } from "../combat";
import type { InteractionCapabilityId } from "../interaction";
import type { ResourceRequirement } from "../resources";
import type { SuitInterfaceId } from "../suit";
import { cloneAndFreezeSurfaceEquipmentValue, createSurfaceEquipmentSignature } from "./canonical";
import {
  orderSurfaceEquipmentDiagnostics,
  type SurfaceEquipmentDiagnostic,
  type SurfaceEquipmentDiagnosticInput
} from "./diagnostics";
import type { SurfaceEquipmentSignature } from "./ids";
import type {
  SurfaceEquipmentBlueprint,
  SurfaceEquipmentCapacity,
  SurfaceEquipmentCatalog,
  SurfaceEquipmentDeliveryClass,
  SurfaceEquipmentLegalClass,
  SurfaceEquipmentModuleDefinition,
  SurfaceEquipmentSafetyMetadata
} from "./types";
import { compareSurfaceEquipmentText, surfaceEquipmentDataError, surfaceEquipmentDataPath } from "./validation";

export interface SurfaceEquipmentCapacityTotals {
  readonly ammoUnits: number;
  readonly chargeUnits: number;
}

export interface SurfaceEquipmentDerivedStats {
  readonly blueprintId: SurfaceEquipmentBlueprint["blueprintId"];
  readonly revision: SurfaceEquipmentBlueprint["revision"];
  readonly catalogId: SurfaceEquipmentCatalog["catalogId"];
  readonly catalogVersion: SurfaceEquipmentCatalog["catalogVersion"];
  readonly totalMassGrams: number;
  readonly totalBulkMicroUnits: number;
  readonly continuousPowerMilliwatts: number;
  readonly pulseEnergyMillijoules: number;
  readonly heatPerActionMillijoules: number;
  readonly activeThermalLoadMilliwatts: number;
  readonly passiveDissipationMilliwatts: number;
  readonly netThermalBurdenMilliwatts: number;
  readonly effectiveRangeMillimeters: number;
  readonly cycleTicks: number;
  readonly capacity: SurfaceEquipmentCapacityTotals;
  readonly interactionCapabilities: readonly InteractionCapabilityId[];
  readonly requiredSuitInterfaces: readonly SuitInterfaceId[];
  readonly resourceRequirements: readonly ResourceRequirement[];
  readonly damageType?: DamageType;
  readonly deliveryClass?: SurfaceEquipmentDeliveryClass;
  readonly safetyMetadata: SurfaceEquipmentSafetyMetadata;
  readonly legalClass: SurfaceEquipmentLegalClass;
  readonly diagnostics: readonly SurfaceEquipmentDiagnostic[];
  readonly signature: SurfaceEquipmentSignature;
}

const safeAdd = (
  left: number,
  right: number,
  diagnostics: SurfaceEquipmentDiagnosticInput[],
  path: string
): number => {
  if (right > Number.MAX_SAFE_INTEGER - left) {
    if (!diagnostics.some((diagnostic) => diagnostic.code === "AggregateOverflow" && diagnostic.path === path)) {
      diagnostics.push({
        code: "AggregateOverflow", severity: "Error", phase: "Structure", path,
        message: "Surface-equipment aggregate exceeds the safe-integer range."
      });
    }
    return Number.MAX_SAFE_INTEGER;
  }
  return left + right;
};

const uniqueSorted = <T extends string>(values: readonly T[]): readonly T[] =>
  [...new Set(values)].sort(compareSurfaceEquipmentText);

const LEGAL_CLASS_ORDER: readonly SurfaceEquipmentLegalClass[] = Object.freeze([
  "Unrestricted", "Licensed", "IndustrialOnly", "MissionAuthorized", "Restricted", "Prohibited"
]);

const legalClassFor = (modules: readonly SurfaceEquipmentModuleDefinition[]): SurfaceEquipmentLegalClass =>
  modules.reduce<SurfaceEquipmentLegalClass>((current, module) =>
    LEGAL_CLASS_ORDER.indexOf(module.legalMetadata.legalClass) > LEGAL_CLASS_ORDER.indexOf(current)
      ? module.legalMetadata.legalClass
      : current, "Unrestricted");

const requirementTotals = (
  modules: readonly SurfaceEquipmentModuleDefinition[],
  diagnostics: SurfaceEquipmentDiagnosticInput[]
): readonly ResourceRequirement[] => {
  const totals = new Map<string, number>();
  for (const module of modules) {
    for (const requirement of module.resourceRequirements) {
      if (!Number.isFinite(requirement.quantity) || requirement.quantity <= 0) {
        diagnostics.push({
          code: "ResourceRequirementInvalid", severity: "Error", phase: "Resource",
          path: `/modules/${module.moduleId}/resourceRequirements/${requirement.resourceId}`,
          message: "Resource requirements must be finite and positive."
        });
        continue;
      }
      const next = (totals.get(requirement.resourceId) ?? 0) + requirement.quantity;
      if (!Number.isFinite(next) || next <= 0) {
        diagnostics.push({
          code: "ResourceRequirementInvalid", severity: "Error", phase: "Resource",
          path: `/resourceRequirements/${requirement.resourceId}`,
          message: "Aggregated resource requirement is not finite and positive."
        });
        continue;
      }
      totals.set(requirement.resourceId, next);
    }
  }
  return [...totals.entries()]
    .sort(([left], [right]) => compareSurfaceEquipmentText(left, right))
    .map(([resourceId, quantity]) => ({ resourceId: resourceId as ResourceRequirement["resourceId"], quantity }));
};

const requiredRolesForCategory = (category: SurfaceEquipmentBlueprint["category"]): readonly string[] => {
  switch (category) {
    case "Scanner": return ["Control"];
    case "RepairTool": return ["Control"];
    case "BreachingTool": return ["Safety"];
    case "Sidearm":
    case "Longarm": return ["FeedSystem", "Magazine", "Control", "Safety"];
    default: return [];
  }
};

const requiredCapabilityForCategory = (
  category: SurfaceEquipmentBlueprint["category"]
): string | undefined => {
  switch (category) {
    case "Scanner": return "capability.scan";
    case "ExtractionTool": return "capability.extract";
    case "RepairTool": return "capability.repair";
    case "BreachingTool": return "capability.access";
    default: return undefined;
  }
};

const addRoleDiagnostics = (
  blueprint: SurfaceEquipmentBlueprint,
  modules: readonly SurfaceEquipmentModuleDefinition[],
  diagnostics: SurfaceEquipmentDiagnosticInput[]
): void => {
  const roles = new Set(modules.map((module) => module.primaryRole));
  for (const role of requiredRolesForCategory(blueprint.category)) {
    if (roles.has(role as SurfaceEquipmentModuleDefinition["primaryRole"])) continue;
    const code = role === "FeedSystem" ? "AmmoFeedMissing"
      : role === "Magazine" ? "MagazineMissing"
        : role === "Control" ? "ControlMissing" : "SafetyMissing";
    diagnostics.push({
      code, severity: "Error", phase: "SafetyLegal", path: `/category/${blueprint.category}/${role}`,
      message: `${blueprint.category} requires a ${role} module.`
    });
  }
};

const capacityTotals = (
  capacities: readonly SurfaceEquipmentCapacity[],
  diagnostics: SurfaceEquipmentDiagnosticInput[]
): SurfaceEquipmentCapacityTotals => {
  let ammoUnits = 0;
  let chargeUnits = 0;
  for (const capacity of capacities) {
    if (capacity.kind === "Ammo") ammoUnits = safeAdd(ammoUnits, capacity.units, diagnostics, "/totals/capacity/ammoUnits");
    else chargeUnits = safeAdd(chargeUnits, capacity.units, diagnostics, "/totals/capacity/chargeUnits");
  }
  return { ammoUnits, chargeUnits };
};

export const deriveSurfaceEquipmentStats = (
  blueprint: SurfaceEquipmentBlueprint,
  catalog: SurfaceEquipmentCatalog
): SurfaceEquipmentDerivedStats => {
  if (blueprint.catalogId !== catalog.catalogId) {
    throw surfaceEquipmentDataError("UnknownReference", "/blueprint/catalogId", "Blueprint catalog ID does not match the supplied catalog.");
  }
  if (blueprint.catalogVersion !== catalog.catalogVersion) {
    throw surfaceEquipmentDataError("UnknownReference", "/blueprint/catalogVersion", "Blueprint catalog version does not match the supplied catalog.");
  }
  const diagnostics: SurfaceEquipmentDiagnosticInput[] = [];
  const moduleById = new Map(catalog.modules.map((module) => [module.moduleId, module]));
  const instanceById = new Map(blueprint.moduleInstances.map((instance) => [instance.moduleInstanceId, instance]));
  const assigned = new Set<string>();
  const modules: SurfaceEquipmentModuleDefinition[] = [];

  for (const instance of blueprint.moduleInstances) {
    const module = moduleById.get(instance.moduleId);
    if (module === undefined) {
      diagnostics.push({
        code: "UnknownModule", severity: "Error", phase: "Structure",
        path: `/moduleInstances/${instance.moduleInstanceId}/moduleId`, moduleInstanceId: instance.moduleInstanceId,
        message: "Module instance references an unknown catalog module."
      });
    } else modules.push(module);
  }

  for (const assignment of blueprint.slotAssignments) {
    const slot = catalog.slots.find((candidate) => candidate.slotId === assignment.slotId);
    if (slot === undefined) {
      diagnostics.push({
        code: "UnknownSlot", severity: "Error", phase: "Structure", path: `/slotAssignments/${assignment.slotId}`,
        slotId: assignment.slotId, message: "Slot assignment references an unknown catalog slot."
      });
      continue;
    }
    if (assignment.moduleInstanceIds.length > slot.exactCount) {
      diagnostics.push({
        code: "SlotCapacityExceeded", severity: "Error", phase: "Structure", path: `/slotAssignments/${slot.slotId}`,
        slotId: slot.slotId, message: "Slot assignment exceeds its exact count."
      });
    }
    let slotMass = 0;
    let slotBulk = 0;
    for (const instanceId of assignment.moduleInstanceIds) {
      if (assigned.has(instanceId)) {
        diagnostics.push({
          code: "DuplicateModuleInstance", severity: "Error", phase: "Structure",
          path: `/slotAssignments/${slot.slotId}/${instanceId}`, slotId: slot.slotId, moduleInstanceId: instanceId,
          message: "Module instance is assigned more than once."
        });
      }
      assigned.add(instanceId);
      const instance = instanceById.get(instanceId);
      const module = instance === undefined ? undefined : moduleById.get(instance.moduleId);
      if (module === undefined) continue;
      slotMass = safeAdd(slotMass, module.massGrams, diagnostics, `/slotAssignments/${slot.slotId}/mass`);
      slotBulk = safeAdd(slotBulk, module.bulkMicroUnits, diagnostics, `/slotAssignments/${slot.slotId}/bulk`);
      if (!module.compatibleSlotTypeIds.includes(slot.slotTypeId)) {
        diagnostics.push({
          code: "SlotTypeMismatch", severity: "Error", phase: "Compatibility",
          path: `/slotAssignments/${slot.slotId}/${instanceId}`, slotId: slot.slotId, moduleInstanceId: instanceId,
          message: "Module does not declare compatibility with the slot type."
        });
      }
      if (!slot.allowedRoles.includes(module.primaryRole)) {
        diagnostics.push({
          code: "SlotRoleMismatch", severity: "Error", phase: "Compatibility",
          path: `/slotAssignments/${slot.slotId}/${instanceId}`, slotId: slot.slotId, moduleInstanceId: instanceId,
          message: "Module role is not allowed by the slot."
        });
      }
      if ((slot.allowedTags.length > 0 && !module.tags.some((tag) => slot.allowedTags.includes(tag))) ||
        module.tags.some((tag) => slot.excludedTags.includes(tag))) {
        diagnostics.push({
          code: "TagIncompatible", severity: "Error", phase: "Compatibility",
          path: `/slotAssignments/${slot.slotId}/${instanceId}`, slotId: slot.slotId, moduleInstanceId: instanceId,
          message: "Module tags are incompatible with the slot."
        });
      }
      for (const interfaceId of slot.requiredSuitInterfaces) {
        if (!module.requiredSuitInterfaces.includes(interfaceId)) {
          diagnostics.push({
            code: "InterfaceMissing", severity: "Error", phase: "Compatibility",
            path: `/slotAssignments/${slot.slotId}/${instanceId}/interfaces/${interfaceId}`,
            slotId: slot.slotId, moduleInstanceId: instanceId,
            message: "Module does not declare a suit interface required by the slot."
          });
        }
      }
    }
    if (slotMass > slot.maximumMassGrams) diagnostics.push({
      code: "MassLimitExceeded", severity: "Error", phase: "Compatibility", path: `/slotAssignments/${slot.slotId}/mass`,
      slotId: slot.slotId, message: "Slot mass limit is exceeded.",
      details: { actual: slotMass, maximum: slot.maximumMassGrams }
    });
    if (slotBulk > slot.maximumBulkMicroUnits) diagnostics.push({
      code: "BulkLimitExceeded", severity: "Error", phase: "Compatibility", path: `/slotAssignments/${slot.slotId}/bulk`,
      slotId: slot.slotId, message: "Slot bulk limit is exceeded.",
      details: { actual: slotBulk, maximum: slot.maximumBulkMicroUnits }
    });
  }

  for (const slot of catalog.slots) {
    const count = blueprint.slotAssignments.find((assignment) => assignment.slotId === slot.slotId)?.moduleInstanceIds.length ?? 0;
    if (slot.required && count !== slot.exactCount) diagnostics.push({
      code: "MissingRequiredSlot", severity: "Error", phase: "Structure", path: `/slotAssignments/${slot.slotId}`,
      slotId: slot.slotId, message: "Required slot does not contain its exact module count.",
      details: { actual: count, expected: slot.exactCount }
    });
    if (!slot.required && count > 0 && count < slot.exactCount) diagnostics.push({
      code: "SlotCountMismatch", severity: "Error", phase: "Structure", path: `/slotAssignments/${slot.slotId}`,
      slotId: slot.slotId, message: "Optional slot must be empty or contain its exact module count.",
      details: { actual: count, expected: slot.exactCount }
    });
  }

  addRoleDiagnostics(blueprint, modules, diagnostics);
  const interactionCapabilities = uniqueSorted(modules.flatMap((module) => module.interactionCapabilities));
  const requiredCapability = requiredCapabilityForCategory(blueprint.category);
  if (requiredCapability !== undefined && !interactionCapabilities.includes(requiredCapability as InteractionCapabilityId)) {
    diagnostics.push({
      code: "CapabilityUnsatisfied", severity: "Error", phase: "Capability", path: `/category/${blueprint.category}/capability`,
      message: `Category requires ${requiredCapability}.`
    });
  }

  const damageTypes = uniqueSorted(modules.flatMap((module) => module.damageType === undefined ? [] : [module.damageType]));
  const deliveryClasses = uniqueSorted(modules.flatMap((module) => module.deliveryClass === undefined ? [] : [module.deliveryClass]));
  const damageFactsPresent = damageTypes.length > 0 || deliveryClasses.length > 0 ||
    (["BreachingTool", "Sidearm", "Longarm"] as const).includes(
      blueprint.category as "BreachingTool" | "Sidearm" | "Longarm"
    );
  const damagingModules = modules.filter((module) => module.damageType !== undefined);
  if (damageFactsPresent && (damageTypes.length !== 1 || deliveryClasses.length !== 1 ||
    damagingModules.some((module) => module.deliveryClass === undefined || module.rangeMillimeters === undefined || module.cycleTicks === undefined))) {
    diagnostics.push({
      code: "DamageDeliveryIncomplete", severity: "Error", phase: "Capability", path: "/damageDelivery",
      message: "Damage delivery requires one damage type, one delivery class, range, and cycle facts."
    });
  }
  if (modules.some((module) => module.legalMetadata.legalClass === "Prohibited") ||
    (modules.some((module) => module.legalMetadata.legalClass === "MissionAuthorized") &&
      !modules.some((module) => module.primaryRole === "LegalTransponder"))) {
    diagnostics.push({
      code: "LegalConfigurationInvalid", severity: "Error", phase: "SafetyLegal", path: "/legal",
      message: "Prohibited or mission-authorized equipment lacks a valid V1 legal configuration."
    });
  }
  if (modules.some((module) => module.safetyMetadata.interlockRequired && !module.safetyMetadata.certified)) {
    diagnostics.push({
      code: "SafetyCertificationInvalid", severity: "Error", phase: "SafetyLegal", path: "/safety/certification",
      message: "A required installed safety interlock is not certified."
    });
  }

  let totalMassGrams = 0;
  let totalBulkMicroUnits = 0;
  let continuousPowerMilliwatts = 0;
  let pulseEnergyMillijoules = 0;
  let heatPerActionMillijoules = 0;
  let activeThermalLoadMilliwatts = 0;
  let passiveDissipationMilliwatts = 0;
  for (const module of modules) {
    totalMassGrams = safeAdd(totalMassGrams, module.massGrams, diagnostics, "/totals/totalMassGrams");
    totalBulkMicroUnits = safeAdd(totalBulkMicroUnits, module.bulkMicroUnits, diagnostics, "/totals/totalBulkMicroUnits");
    continuousPowerMilliwatts = safeAdd(continuousPowerMilliwatts, module.continuousPowerMilliwatts, diagnostics, "/totals/continuousPowerMilliwatts");
    pulseEnergyMillijoules = safeAdd(pulseEnergyMillijoules, module.pulseEnergyMillijoules, diagnostics, "/totals/pulseEnergyMillijoules");
    heatPerActionMillijoules = safeAdd(heatPerActionMillijoules, module.heatPerActionMillijoules, diagnostics, "/totals/heatPerActionMillijoules");
    activeThermalLoadMilliwatts = safeAdd(activeThermalLoadMilliwatts, module.activeThermalLoadMilliwatts, diagnostics, "/totals/activeThermalLoadMilliwatts");
    passiveDissipationMilliwatts = safeAdd(passiveDissipationMilliwatts, module.passiveDissipationMilliwatts, diagnostics, "/totals/passiveDissipationMilliwatts");
  }
  const cycleValues = modules.flatMap((module) => module.cycleTicks === undefined ? [] : [module.cycleTicks]);
  const payload = {
    blueprintId: blueprint.blueprintId,
    revision: blueprint.revision,
    catalogId: blueprint.catalogId,
    catalogVersion: blueprint.catalogVersion,
    totalMassGrams,
    totalBulkMicroUnits,
    continuousPowerMilliwatts,
    pulseEnergyMillijoules,
    heatPerActionMillijoules,
    activeThermalLoadMilliwatts,
    passiveDissipationMilliwatts,
    netThermalBurdenMilliwatts: Math.max(0, activeThermalLoadMilliwatts - passiveDissipationMilliwatts),
    effectiveRangeMillimeters: Math.max(0, ...modules.map((module) => module.rangeMillimeters ?? 0)),
    cycleTicks: cycleValues.length === 0 ? 0 : Math.min(...cycleValues),
    capacity: capacityTotals(modules.flatMap((module) => module.capacity === undefined ? [] : [module.capacity]), diagnostics),
    interactionCapabilities,
    requiredSuitInterfaces: uniqueSorted(modules.flatMap((module) => module.requiredSuitInterfaces)),
    resourceRequirements: requirementTotals(modules, diagnostics),
    ...(damageTypes.length === 1 ? { damageType: damageTypes[0] } : {}),
    ...(deliveryClasses.length === 1 ? { deliveryClass: deliveryClasses[0] } : {}),
    safetyMetadata: {
      interlockRequired: modules.some((module) => module.safetyMetadata.interlockRequired),
      certified: modules.every((module) => module.safetyMetadata.certified)
    },
    legalClass: legalClassFor(modules),
    diagnostics: orderSurfaceEquipmentDiagnostics(diagnostics)
  };
  return cloneAndFreezeSurfaceEquipmentValue({
    ...payload,
    signature: createSurfaceEquipmentSignature({ blueprintSignature: blueprint.contentSignature, ...payload })
  }) as SurfaceEquipmentDerivedStats;
};

export const validateSurfaceEquipmentConfiguration = deriveSurfaceEquipmentStats;

export const assertSurfaceEquipmentStatsProvenance = (
  blueprint: SurfaceEquipmentBlueprint,
  stats: SurfaceEquipmentDerivedStats,
  path = "/stats"
): void => {
  const checks = [
    ["blueprintId", stats.blueprintId, blueprint.blueprintId],
    ["revision", stats.revision, blueprint.revision],
    ["catalogId", stats.catalogId, blueprint.catalogId],
    ["catalogVersion", stats.catalogVersion, blueprint.catalogVersion]
  ] as const;
  for (const [field, actual, expected] of checks) {
    if (actual !== expected) {
      throw surfaceEquipmentDataError(
        "InvalidValue",
        surfaceEquipmentDataPath(path, field),
        "Derived stats provenance does not match the supplied blueprint."
      );
    }
  }
};
