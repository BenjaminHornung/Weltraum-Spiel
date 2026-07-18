import type { DamageType } from "../combat";
import type { InteractionCapabilityId } from "../interaction";
import type { ResourceRequirement } from "../resources";
import type { SuitInterfaceId } from "../suit";
import type {
  SurfaceEquipmentBlueprintId,
  SurfaceEquipmentCalibrationId,
  SurfaceEquipmentCalibrationOptionId,
  SurfaceEquipmentCatalogId,
  SurfaceEquipmentCatalogVersion,
  SurfaceEquipmentCommandId,
  SurfaceEquipmentLegalClassId,
  SurfaceEquipmentModuleId,
  SurfaceEquipmentModuleInstanceId,
  SurfaceEquipmentModuleVersion,
  SurfaceEquipmentRevision,
  SurfaceEquipmentSignature,
  SurfaceEquipmentSlotId,
  SurfaceEquipmentSlotTypeId,
  SurfaceEquipmentTagId
} from "./ids";

export const SURFACE_EQUIPMENT_CATEGORIES = Object.freeze([
  "Scanner",
  "ExtractionTool",
  "RepairTool",
  "BreachingTool",
  "Sidearm",
  "Longarm",
  "UtilityDevice"
] as const);
export type SurfaceEquipmentCategory = (typeof SURFACE_EQUIPMENT_CATEGORIES)[number];

export const SURFACE_EQUIPMENT_MODULE_ROLES = Object.freeze([
  "Frame",
  "ToolHead",
  "DeliveryAssembly",
  "PowerPack",
  "ThermalSink",
  "FeedSystem",
  "Magazine",
  "Optic",
  "Scanner",
  "Control",
  "Safety",
  "LegalTransponder",
  "Grip",
  "Stock",
  "Utility"
] as const);
export type SurfaceEquipmentModuleRole = (typeof SURFACE_EQUIPMENT_MODULE_ROLES)[number];

export const SURFACE_EQUIPMENT_LEGAL_CLASSES = Object.freeze([
  "Unrestricted",
  "Licensed",
  "Restricted",
  "Prohibited",
  "IndustrialOnly",
  "MissionAuthorized"
] as const);
export type SurfaceEquipmentLegalClass = (typeof SURFACE_EQUIPMENT_LEGAL_CLASSES)[number];

export const SURFACE_EQUIPMENT_DELIVERY_CLASSES = Object.freeze(["Projectile", "Beam", "ToolContact"] as const);
export type SurfaceEquipmentDeliveryClass = (typeof SURFACE_EQUIPMENT_DELIVERY_CLASSES)[number];

export const SURFACE_EQUIPMENT_READINESS_STATES = Object.freeze(["Ready", "Limited", "Blocked"] as const);
export type SurfaceEquipmentReadinessState = (typeof SURFACE_EQUIPMENT_READINESS_STATES)[number];

export const SURFACE_EQUIPMENT_CAPACITY_KINDS = Object.freeze(["Ammo", "Charge"] as const);
export type SurfaceEquipmentCapacityKind = (typeof SURFACE_EQUIPMENT_CAPACITY_KINDS)[number];

export interface SurfaceEquipmentDisplayMetadata {
  readonly displayName: string;
  readonly description: string;
}

export interface SurfaceEquipmentBalanceMetadata {
  readonly tier: "provisional-v0";
  readonly rationale: string;
}

export interface SurfaceEquipmentSafetyMetadata {
  readonly interlockRequired: boolean;
  readonly certified: boolean;
}

export interface SurfaceEquipmentLegalMetadata {
  readonly legalClassId: SurfaceEquipmentLegalClassId;
  readonly legalClass: SurfaceEquipmentLegalClass;
}

export interface SurfaceEquipmentCalibrationOptionDefinition {
  readonly optionId: SurfaceEquipmentCalibrationOptionId;
  readonly order: number;
  readonly displayMetadata: SurfaceEquipmentDisplayMetadata;
}

export interface SurfaceEquipmentCalibrationDefinition {
  readonly calibrationId: SurfaceEquipmentCalibrationId;
  readonly order: number;
  readonly displayMetadata: SurfaceEquipmentDisplayMetadata;
  readonly defaultOptionId: SurfaceEquipmentCalibrationOptionId;
  readonly options: readonly SurfaceEquipmentCalibrationOptionDefinition[];
}

export interface SurfaceEquipmentCapacity {
  readonly kind: SurfaceEquipmentCapacityKind;
  readonly units: number;
}

export interface SurfaceEquipmentSlotDefinition {
  readonly slotId: SurfaceEquipmentSlotId;
  readonly order: number;
  readonly slotTypeId: SurfaceEquipmentSlotTypeId;
  readonly required: boolean;
  readonly exactCount: number;
  readonly allowedRoles: readonly SurfaceEquipmentModuleRole[];
  readonly allowedTags: readonly SurfaceEquipmentTagId[];
  readonly excludedTags: readonly SurfaceEquipmentTagId[];
  readonly requiredSuitInterfaces: readonly SuitInterfaceId[];
  readonly maximumMassGrams: number;
  readonly maximumBulkMicroUnits: number;
  readonly parentSlotId?: SurfaceEquipmentSlotId;
  readonly displayMetadata: SurfaceEquipmentDisplayMetadata;
}

export interface SurfaceEquipmentModuleDefinition {
  readonly moduleId: SurfaceEquipmentModuleId;
  readonly moduleVersion: SurfaceEquipmentModuleVersion;
  readonly displayMetadata: SurfaceEquipmentDisplayMetadata;
  readonly primaryRole: SurfaceEquipmentModuleRole;
  readonly tags: readonly SurfaceEquipmentTagId[];
  readonly massGrams: number;
  readonly bulkMicroUnits: number;
  readonly continuousPowerMilliwatts: number;
  readonly pulseEnergyMillijoules: number;
  readonly heatPerActionMillijoules: number;
  readonly activeThermalLoadMilliwatts: number;
  readonly passiveDissipationMilliwatts: number;
  readonly compatibleSlotTypeIds: readonly SurfaceEquipmentSlotTypeId[];
  readonly interactionCapabilities: readonly InteractionCapabilityId[];
  readonly requiredSuitInterfaces: readonly SuitInterfaceId[];
  readonly resourceRequirements: readonly ResourceRequirement[];
  readonly damageType?: DamageType;
  readonly deliveryClass?: SurfaceEquipmentDeliveryClass;
  readonly rangeMillimeters?: number;
  readonly cycleTicks?: number;
  readonly capacity?: SurfaceEquipmentCapacity;
  readonly calibrationDefinitions: readonly SurfaceEquipmentCalibrationDefinition[];
  readonly safetyMetadata: SurfaceEquipmentSafetyMetadata;
  readonly legalMetadata: SurfaceEquipmentLegalMetadata;
  readonly balanceMetadata: SurfaceEquipmentBalanceMetadata;
  readonly contentSignature: SurfaceEquipmentSignature;
}

export interface SurfaceEquipmentCatalog {
  readonly catalogId: SurfaceEquipmentCatalogId;
  readonly catalogVersion: SurfaceEquipmentCatalogVersion;
  readonly schemaVersion: 1;
  readonly displayMetadata: SurfaceEquipmentDisplayMetadata;
  readonly slots: readonly SurfaceEquipmentSlotDefinition[];
  readonly modules: readonly SurfaceEquipmentModuleDefinition[];
  readonly contentSignature: SurfaceEquipmentSignature;
}

export interface SurfaceEquipmentModuleInstance {
  readonly moduleInstanceId: SurfaceEquipmentModuleInstanceId;
  readonly moduleId: SurfaceEquipmentModuleId;
}

export interface SurfaceEquipmentSlotAssignment {
  readonly slotId: SurfaceEquipmentSlotId;
  readonly moduleInstanceIds: readonly SurfaceEquipmentModuleInstanceId[];
}

export interface SurfaceEquipmentCalibrationChoice {
  readonly moduleInstanceId: SurfaceEquipmentModuleInstanceId;
  readonly calibrationId: SurfaceEquipmentCalibrationId;
  readonly optionId: SurfaceEquipmentCalibrationOptionId;
}

export interface SurfaceEquipmentBlueprint {
  readonly blueprintId: SurfaceEquipmentBlueprintId;
  readonly catalogId: SurfaceEquipmentCatalogId;
  readonly catalogVersion: SurfaceEquipmentCatalogVersion;
  readonly revision: SurfaceEquipmentRevision;
  readonly category: SurfaceEquipmentCategory;
  readonly displayMetadata: SurfaceEquipmentDisplayMetadata;
  readonly slotAssignments: readonly SurfaceEquipmentSlotAssignment[];
  readonly moduleInstances: readonly SurfaceEquipmentModuleInstance[];
  readonly calibrationChoices: readonly SurfaceEquipmentCalibrationChoice[];
  readonly tags: readonly SurfaceEquipmentTagId[];
  readonly processedCommandIds: readonly SurfaceEquipmentCommandId[];
  readonly contentSignature: SurfaceEquipmentSignature;
}

export interface SurfaceEquipmentFixture {
  readonly fixtureId: SurfaceEquipmentBlueprintId;
  readonly catalog: SurfaceEquipmentCatalog;
  readonly blueprint: SurfaceEquipmentBlueprint;
}
