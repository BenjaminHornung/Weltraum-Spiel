import type {
  BlueprintId,
  BlueprintSchemaVersion,
  CatalogId,
  CatalogSchemaVersion,
  CatalogVersion,
  ComponentId,
  ComponentSchemaVersion,
  ConnectionId,
  PartCategoryId,
  PartDefinitionId,
  PartDefinitionSchemaVersion,
  PartInstanceId,
  SocketId,
  SocketSchemaVersion
} from "./ids";
import type { JsonObject } from "./validation";

export type NamespacedExtensions = JsonObject;

export interface SerializableVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MeterDimensions {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface GridFootprint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Integer local placement coordinates; unlike a footprint, values may be negative. */
export interface GridPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface EulerDegrees {
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
}

export interface QuaternionRotation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export type MountSide = "front" | "back" | "left" | "right" | "top" | "bottom" | "internal" | "any";

export type ComponentKind =
  | "ControlCore"
  | "Structural"
  | "MainThruster"
  | "RcsCluster"
  | "FuelTank"
  | "CargoStorage"
  | "FixedWeapon"
  | "TurretWeapon"
  | "SensorUtility"
  | "DockingConnector"
  | "Armor"
  | "PowerHeatReserved";

export type BuiltInSocketType =
  | "structural"
  | "hardpoint"
  | "mainThrusterNozzle"
  | "rcsNozzle"
  | "turretBase"
  | "turretYawPivot"
  | "turretPitchPivot"
  | "muzzle"
  | "muzzleFlash"
  | "cargoAttach"
  | "dockingConnector"
  | "cameraAnchor";

/** Built-in values are closed in v1; serialized custom socket types remain extensible. */
export type SocketType = BuiltInSocketType | (string & {});

export type SocketRole = "Structural" | "Functional" | "Visual" | "Camera";
export type SocketDirectionRole = "None" | "MountNormal" | "Thrust" | "Aim" | "Docking" | "Camera";
export type SocketCapacityClass = "light" | "standard" | "heavy" | "unlimited";

export interface SocketArcMetadata {
  readonly yawDegrees?: number;
  readonly pitchDegrees?: number;
  readonly minimumRangeMeters?: number;
  readonly maximumRangeMeters?: number;
}

export interface PartSocket {
  readonly socketId: SocketId;
  readonly schemaVersion: SocketSchemaVersion;
  readonly socketType: SocketType;
  readonly localPosition: SerializableVector3;
  readonly localRotation: QuaternionRotation;
  readonly role: SocketRole;
  readonly directionRole: SocketDirectionRole;
  readonly direction: SerializableVector3;
  readonly compatibleCategoryIds: readonly PartCategoryId[];
  readonly compatibleComponentKinds: readonly ComponentKind[];
  readonly capacityClass: SocketCapacityClass;
  readonly mountSide: MountSide;
  readonly requiredForComponentIds: readonly ComponentId[];
  readonly compatibilityAliases: readonly string[];
  readonly arc?: SocketArcMetadata;
  readonly vfxRole?: string;
  readonly excludedFromCameraBounds: boolean;
  readonly extensions?: NamespacedExtensions;
}

export type SocketDefinition = PartSocket;

export interface ComponentBase<TKind extends ComponentKind> {
  readonly componentId: ComponentId;
  readonly kind: TKind;
  readonly schemaVersion: ComponentSchemaVersion;
  readonly tags?: readonly string[];
  readonly extensions?: NamespacedExtensions;
}

export interface ControlCoreComponent extends ComponentBase<"ControlCore"> {
  readonly controlSocketId: SocketId;
  readonly cameraSocketId?: SocketId;
  readonly seatCount: number;
  readonly controlRating: number;
  readonly supportedControlModes: readonly ("manual" | "assisted" | "autopilot")[];
}

export interface StructuralComponent extends ComponentBase<"Structural"> {
  readonly structuralSocketIds: readonly SocketId[];
  readonly structuralRating: number;
}

export interface MainThrusterComponent extends ComponentBase<"MainThruster"> {
  readonly nozzleSocketId: SocketId;
  readonly maximumThrustNewtons: number;
  readonly propellantBurnKilogramsPerSecond: number;
  readonly throttleResponseSeconds: number;
  readonly gimbalDegrees?: number;
  readonly propulsionSupply?: PropulsionSupply;
}

export interface RcsClusterComponent extends ComponentBase<"RcsCluster"> {
  readonly nozzleSocketIds: readonly SocketId[];
  readonly thrustPerNozzleNewtons: number;
  readonly propellantBurnKilogramsPerSecond: number;
  readonly translationAxes: readonly ("x" | "y" | "z")[];
  readonly rotationAxes: readonly ("x" | "y" | "z")[];
  readonly propulsionSupply?: PropulsionSupply;
}

export type PropulsionSupply =
  | {
      readonly mode: "Fuel";
      readonly fuelKind: string;
    }
  | {
      readonly mode: "FuelFreeExperimental";
    };

export interface FuelTankComponent extends ComponentBase<"FuelTank"> {
  readonly capacityKilograms: number;
  readonly fuelKind: string;
  readonly feedSocketIds?: readonly SocketId[];
  readonly fillSocketId?: SocketId;
}

export interface CargoStorageComponent extends ComponentBase<"CargoStorage"> {
  readonly cargoAttachSocketIds: readonly SocketId[];
  readonly capacityCubicMeters: number;
  readonly maximumPayloadKilograms: number;
  readonly accessSocketId?: SocketId;
}

export interface FixedWeaponComponent extends ComponentBase<"FixedWeapon"> {
  readonly hardpointSocketId: SocketId;
  readonly muzzleSocketId: SocketId;
  readonly muzzleFlashSocketId?: SocketId;
  readonly damagePerShot: number;
  readonly projectileSpeedMetersPerSecond: number;
  readonly rangeMeters: number;
  readonly rateOfFirePerSecond: number;
  readonly recoilNewtons: number;
}

export interface TurretWeaponComponent extends ComponentBase<"TurretWeapon"> {
  readonly turretBaseSocketId: SocketId;
  readonly yawPivotSocketId: SocketId;
  readonly pitchPivotSocketId: SocketId;
  readonly muzzleSocketId: SocketId;
  readonly muzzleFlashSocketId?: SocketId;
  readonly damagePerShot: number;
  readonly projectileSpeedMetersPerSecond: number;
  readonly rangeMeters: number;
  readonly rateOfFirePerSecond: number;
  readonly recoilNewtons: number;
}

export interface SensorUtilityComponent extends ComponentBase<"SensorUtility"> {
  readonly mountSocketId: SocketId;
  readonly rangeMeters: number;
  readonly scanRatePerSecond: number;
  readonly sensorRating: number;
}

export interface DockingConnectorComponent extends ComponentBase<"DockingConnector"> {
  readonly connectorSocketId: SocketId;
  readonly dockingRating: number;
  readonly maximumApproachSpeedMetersPerSecond: number;
}

export interface ArmorComponent extends ComponentBase<"Armor"> {
  readonly armorRating: number;
  readonly coverageFraction: number;
  readonly addedMassKilograms: number;
}

/** Reservation metadata only. It intentionally contains no executable power or heat behavior. */
export interface PowerHeatReservedComponent extends ComponentBase<"PowerHeatReserved"> {
  readonly reservedPowerWatts: number;
  readonly reservedHeatWatts: number;
  readonly reservationReason: string;
}

export type ShipBuilderComponent =
  | ControlCoreComponent
  | StructuralComponent
  | MainThrusterComponent
  | RcsClusterComponent
  | FuelTankComponent
  | CargoStorageComponent
  | FixedWeaponComponent
  | TurretWeaponComponent
  | SensorUtilityComponent
  | DockingConnectorComponent
  | ArmorComponent
  | PowerHeatReservedComponent;

export interface BuildCostReference {
  readonly resourceId: string;
  readonly quantity: number;
  readonly extensions?: NamespacedExtensions;
}

export interface PartAssetReference {
  readonly assetId: string;
  readonly variantId?: string;
  readonly extensions?: NamespacedExtensions;
}

export interface PartDefinition {
  readonly partDefinitionId: PartDefinitionId;
  readonly schemaVersion: PartDefinitionSchemaVersion;
  readonly displayName: string;
  readonly description: string;
  readonly categoryId: PartCategoryId;
  readonly tags: readonly string[];
  readonly dimensionsMeters: MeterDimensions;
  readonly gridFootprint: GridFootprint;
  readonly dryMassKilograms: number;
  readonly allowedMountSides: readonly MountSide[];
  readonly sockets: readonly PartSocket[];
  readonly components: readonly ShipBuilderComponent[];
  readonly buildCostReferences?: readonly BuildCostReference[];
  readonly visualReference?: PartAssetReference;
  readonly colliderReference?: PartAssetReference;
  readonly variantGroupId?: string;
  readonly balanceTier?: string;
  readonly extensions?: NamespacedExtensions;
}

/** Categories are palette/search metadata only and must not be used as capability evidence. */
export interface PartCategoryDefinition {
  readonly categoryId: PartCategoryId;
  readonly displayNameKey?: string;
  readonly displayNameFallback?: string;
  readonly descriptionKey?: string;
  readonly descriptionFallback?: string;
  readonly sortOrder: number;
  readonly presentationKey?: string;
  readonly paletteTags: readonly string[];
  readonly requiredSystemRole?: string;
  readonly allowedComponentKinds?: readonly ComponentKind[];
  readonly recommendedComponentKinds?: readonly ComponentKind[];
  readonly extensions?: NamespacedExtensions;
}

export interface PartInstance {
  readonly stableInstanceId: PartInstanceId;
  readonly partDefinitionId: PartDefinitionId;
  readonly localGridPosition: GridPosition;
  readonly localRotation: EulerDegrees;
  readonly enabled: boolean;
  readonly mirrorGroupId?: string;
  readonly customName?: string;
  readonly extensions?: NamespacedExtensions;
}

export interface PartConnectionEndpoint {
  readonly partInstanceId: PartInstanceId;
  readonly socketId: SocketId;
}

export type ConnectionType = "Structural" | "Functional" | "Power" | "Data" | "Fuel" | "Docking" | (string & {});

export interface PartConnection {
  readonly connectionId: ConnectionId;
  readonly from: PartConnectionEndpoint;
  readonly to: PartConnectionEndpoint;
  readonly connectionType: ConnectionType;
  readonly enabled: boolean;
  readonly metadata?: JsonObject;
}

export interface MirrorGroup {
  readonly mirrorGroupId: string;
  readonly instanceIds: readonly PartInstanceId[];
  readonly extensions?: NamespacedExtensions;
}

export interface ShipBlueprint {
  readonly blueprintId: BlueprintId;
  readonly displayName: string;
  readonly schemaVersion: BlueprintSchemaVersion;
  readonly catalogId: CatalogId;
  readonly catalogVersion: CatalogVersion;
  readonly gridMeters: number;
  readonly instances: readonly PartInstance[];
  readonly connections: readonly PartConnection[];
  readonly referencedPartDefinitionIds: readonly PartDefinitionId[];
  readonly mirrorGroups?: readonly MirrorGroup[];
  readonly draftMetadata?: JsonObject;
  readonly cachedValidationMetadata?: JsonObject;
  readonly cachedStatsMetadata?: JsonObject;
  readonly extensions?: NamespacedExtensions;
}

export interface ShipPartCatalogDocument {
  readonly catalogId: CatalogId;
  readonly catalogVersion: CatalogVersion;
  readonly schemaVersion: CatalogSchemaVersion;
  readonly categories: readonly PartCategoryDefinition[];
  readonly partDefinitions: readonly PartDefinition[];
  readonly extensions?: NamespacedExtensions;
}

export interface ShipPartCatalogSummary {
  readonly categoryCount: number;
  readonly partDefinitionCount: number;
  readonly componentCount: number;
  readonly socketCount: number;
}

export interface ShipPartCatalogIndexes {
  readonly partById: Readonly<Record<PartDefinitionId, PartDefinition>>;
  readonly categoryById: Readonly<Record<PartCategoryId, PartCategoryDefinition>>;
  readonly partsByCategory: Readonly<Record<PartCategoryId, readonly PartDefinition[]>>;
  readonly partsByComponentKind: Readonly<Partial<Record<ComponentKind, readonly PartDefinition[]>>>;
  readonly partsByTag: Readonly<Record<string, readonly PartDefinition[]>>;
}

export interface ShipPartCatalogSnapshot extends ShipPartCatalogDocument {
  readonly summary: ShipPartCatalogSummary;
  readonly signature: string;
  readonly indexes: ShipPartCatalogIndexes;
}

export type ShipStatAvailability =
  | "Available"
  | "UnavailableMissingMetadata"
  | "UnavailableNoFuel"
  | "UnavailableNoThrust"
  | "UnavailableUnsupported"
  | "Invalid";

export type ShipStatUnit =
  | "kg"
  | "N"
  | "m/s^2"
  | "N*m"
  | "m/s"
  | "s"
  | "m^3"
  | "m"
  | "W"
  | "count"
  | "ratio"
  | "unitless";

export type ShipStatValue<TValue, TUnit extends ShipStatUnit = ShipStatUnit> =
  | {
      readonly availability: "Available";
      readonly value: TValue;
      readonly unit: TUnit;
    }
  | {
      readonly availability: Exclude<ShipStatAvailability, "Available">;
      readonly value: null;
      readonly unit: TUnit;
    };

export interface ShipStatPreviewInput {
  readonly fuelFillFraction?: number;
  readonly cargoPreviewMassKg?: number;
  readonly cargoPreviewVolumeM3?: number;
}

export interface ShipStatPreviewPayload {
  readonly previewVersion: 1;
  readonly fuelFillFraction: number;
  readonly cargoPreviewMassKg: number;
  readonly cargoPreviewVolumeM3: number;
}

export interface ShipStatPreview extends ShipStatPreviewPayload {
  readonly signature: string;
}

export interface ShipAnalysisPolicyInput {
  readonly thrustOffsetWarningMeters?: number;
  readonly weakBrakingRatio?: number;
  readonly hardOverlapRatio?: number;
  readonly lowAccelerationMps2?: number | null;
  readonly minimumRcsSymmetryRatio?: number | null;
}

export interface ShipAnalysisPolicyPayload {
  readonly policyVersion: 1;
  readonly thrustOffsetWarningMeters: number;
  readonly weakBrakingRatio: number;
  readonly hardOverlapRatio: number;
  readonly lowAccelerationMps2: number | null;
  readonly minimumRcsSymmetryRatio: number | null;
}

export interface ShipAnalysisPolicy extends ShipAnalysisPolicyPayload {
  readonly signature: string;
}

export interface ShipStats {
  readonly dryMassKg: ShipStatValue<number, "kg">;
  readonly plannedFuelMassKg: ShipStatValue<number, "kg">;
  readonly plannedCargoMassKg: ShipStatValue<number, "kg">;
  readonly plannedCargoVolumeM3: ShipStatValue<number, "m^3">;
  readonly totalEmptyMassKg: ShipStatValue<number, "kg">;
  readonly totalLoadedMassKg: ShipStatValue<number, "kg">;
  readonly mainThrustNewtons: ShipStatValue<number, "N">;
  readonly accelerationEmptyMps2: ShipStatValue<number, "m/s^2">;
  readonly accelerationLoadedMps2: ShipStatValue<number, "m/s^2">;
  readonly rcsTranslationPositiveX: ShipStatValue<number, "N">;
  readonly rcsTranslationNegativeX: ShipStatValue<number, "N">;
  readonly rcsTranslationPositiveY: ShipStatValue<number, "N">;
  readonly rcsTranslationNegativeY: ShipStatValue<number, "N">;
  readonly rcsTranslationPositiveZ: ShipStatValue<number, "N">;
  readonly rcsTranslationNegativeZ: ShipStatValue<number, "N">;
  readonly pitchTorqueNm: ShipStatValue<number, "N*m">;
  readonly yawTorqueNm: ShipStatValue<number, "N*m">;
  readonly rollTorqueNm: ShipStatValue<number, "N*m">;
  readonly deltaVMps: ShipStatValue<number, "m/s">;
  readonly burnTimeSeconds: ShipStatValue<number, "s">;
  readonly cargoMassCapacityKg: ShipStatValue<number, "kg">;
  readonly cargoVolumeCapacityM3: ShipStatValue<number, "m^3">;
  readonly weaponCount: ShipStatValue<number, "count">;
  readonly usableWeaponCount: ShipStatValue<number, "count">;
  readonly fixedWeaponCount: ShipStatValue<number, "count">;
  readonly turretWeaponCount: ShipStatValue<number, "count">;
  readonly missingMuzzleCount: ShipStatValue<number, "count">;
  readonly blockedOrInvalidWeaponCount: ShipStatValue<number, "count">;
  readonly centerOfMass: ShipStatValue<SerializableVector3, "m">;
  readonly thrustAxisPoint: ShipStatValue<SerializableVector3, "m">;
  readonly thrustAxisDirection: ShipStatValue<SerializableVector3, "unitless">;
  readonly thrustOffsetMeters: ShipStatValue<number, "m">;
  readonly forwardAccelerationMps2: ShipStatValue<number, "m/s^2">;
  readonly brakingAccelerationMps2: ShipStatValue<number, "m/s^2">;
  readonly brakingRatio: ShipStatValue<number, "ratio">;
  readonly powerGenerated: ShipStatValue<number, "W">;
  readonly powerRequired: ShipStatValue<number, "W">;
  readonly powerBalance: ShipStatValue<number, "W">;
  readonly heatGenerated: ShipStatValue<number, "W">;
  readonly coolingCapacity: ShipStatValue<number, "W">;
  readonly heatBalance: ShipStatValue<number, "W">;
}

export interface ShipStatsEvaluationOptions {
  readonly preview?: ShipStatPreviewInput | ShipStatPreview;
  readonly policy?: ShipAnalysisPolicyInput | ShipAnalysisPolicy;
}

export interface ShipStatsReportPayload {
  readonly reportVersion: 1;
  readonly catalogSignature: string;
  readonly blueprintLayoutHash: string;
  readonly previewSignature: string;
  readonly policySignature: string;
  readonly preview: ShipStatPreview;
  readonly policy: ShipAnalysisPolicy;
  readonly stats: ShipStats;
}

export interface ShipStatsReport extends ShipStatsReportPayload {
  readonly signature: string;
}
