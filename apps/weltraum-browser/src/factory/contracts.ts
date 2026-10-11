import type { ResourceCatalog } from "../resources/catalog";
import type { ResourceContainerState } from "../resources/containers";
import type { ResourceId } from "../resources/ids";

export type FactoryId = string;
export type FactoryDigest = string;
export type FactoryQuantityBasis = "mg" | "piece" | "mm";

export interface FactorySourceRef {
  readonly sourceId: string;
  readonly fileName: string;
  readonly sha256: string;
  readonly status: "source-fixture" | "current-repository";
}

/** A storage envelope, never a claimed physical solid-material density. */
export type FactoryVolumeProfile = Readonly<{
  kind: "cargo-pack" | "derived-capacity-envelope";
  version: "fp02-pack-volume-v1" | "fp06-conservative-envelope-v1";
  numeratorMm3: number;
  denominatorUnits: number;
  sourceRefs: readonly string[];
}> | Readonly<{ kind: "unknown"; version: "unbound-v1"; sourceRefs: readonly string[] }>;

export interface FactoryItem {
  readonly sourceId: string;
  readonly resourceId: ResourceId;
  readonly version: 1;
  /** FNV1a canonical signature. Admission also compares complete canonical bytes. */
  readonly digest: FactoryDigest;
  readonly displayName: string;
  readonly quantityBasis: FactoryQuantityBasis;
  readonly massMgPerUnit: number;
  readonly volumeProfile: FactoryVolumeProfile;
  readonly sourceRef: string;
}

export interface FactoryTerm {
  readonly itemId: string;
  readonly quantityUnits: number;
}

export interface FactoryProcess {
  readonly kind: "electric" | "manual";
  readonly capability: string;
  /** null means the source did not fix manual tool time. */
  readonly durationMs: number | null;
  readonly powerWatts: number;
  readonly workJ: number;
  readonly availability: "first-dry-loop" | "planned";
}

export interface FactoryRecipe {
  readonly sourceId: string;
  readonly runtimeId: string;
  readonly version: 1;
  readonly digest: FactoryDigest;
  readonly inputs: readonly FactoryTerm[];
  /** Includes the retained offcut; no hidden waste sink. */
  readonly outputs: readonly FactoryTerm[];
  readonly processes: readonly FactoryProcess[];
  readonly sourceRef: string;
}

/** Local tuples use east, north, height, all in millimetres. */
export interface FactoryPort {
  readonly sourceId: string;
  readonly runtimeId: string;
  readonly role: "SolidBatchIn" | "SolidBatchOut" | "PowerConsumer" | "WasteCassette";
  /** null for POWER/internal ports whose geometry is not fixed in FP02. */
  readonly centerMm: readonly [number, number, number] | null;
  readonly outwardNormal: readonly [number, number, number] | null;
  readonly sizeMm: readonly [number, number] | null;
  readonly externallyConnectable: boolean;
}

export interface FactoryDevice {
  readonly sourceId: string;
  readonly runtimeId: string;
  readonly version: 1;
  readonly digest: FactoryDigest;
  readonly sizeMm: readonly [number, number, number];
  readonly massMg: number;
  readonly bom: readonly FactoryTerm[];
  readonly capabilities: readonly string[];
  readonly powerWatts: number;
  readonly ports: readonly FactoryPort[];
  readonly buffers: readonly Readonly<{ role: "input" | "output" | "offcut" | "storage"; massMg: number; volumeMm3: null }>[];
  readonly minimumServiceClearanceMm: number;
  readonly sourceRef: string;
}

export interface FactoryCargoPosition {
  readonly cargoId: string;
  readonly runtimeId: string;
  readonly itemId: string;
  readonly quantityUnits: number;
  readonly massMg: number;
  readonly packedVolumeMm3: number;
}

export interface FactoryFrame {
  readonly version: "fp02-east-north-height-to-hvp-xyz-v1";
  readonly placementGridMm: 250;
  readonly runtimeAxes: Readonly<{ east: "x"; north: "z"; height: "y" }>;
  readonly sourceRefs: readonly string[];
}

export interface FactoryTerrainSource {
  readonly profileVersion: string;
  readonly registryDigest: string;
  readonly cellSizeMm: 125;
  readonly limestoneDensityKgPerM3: 2400;
  readonly densityProvenance: "prototype-tuning-unapproved";
  readonly sourceRef: string;
}

export interface FactoryCatalogData {
  readonly version: "fp02-factory-catalog-v1";
  readonly sources: readonly FactorySourceRef[];
  readonly items: readonly FactoryItem[];
  readonly recipes: readonly FactoryRecipe[];
  readonly devices: readonly FactoryDevice[];
  readonly cargo: readonly FactoryCargoPosition[];
  readonly idMapping: readonly Readonly<{ sourceId: string; runtimeId: string }>[];
  readonly frame: FactoryFrame;
  readonly terrain: FactoryTerrainSource;
  readonly conveyor: Readonly<{
    version: "fp02-conveyor-reference-v1";
    speedMmPerSecond: 750;
    maxPacketMassMg: 10000000;
    powerWattsPerMeter: 25;
    moduleLengthMm: 1000;
    maxFixtureLineLengthMm: 12000;
    nominalRateMgPerSecond: 1000000;
    sourceRef: "FP02:8.3";
  }>;
}

export type MutableFactoryInput<T> = T extends readonly (infer U)[] ? MutableFactoryInput<U>[]
  : T extends object ? { -readonly [K in keyof T]: MutableFactoryInput<T[K]> } : T;
export type FactoryCatalogInput = MutableFactoryInput<FactoryCatalogData>;

export interface FactoryCatalog extends FactoryCatalogData {
  readonly resources: ResourceCatalog;
  readonly canonicalJson: string;
  readonly catalogDigest: FactoryDigest;
}

export interface FactoryLayout {
  readonly sourceId: "FP02-LAYOUT-A" | "FP02-LAYOUT-B";
  readonly sizeMm: readonly [number, number];
  readonly placements: readonly Readonly<{ instanceId: string; deviceId: string; centerMm: readonly [number, number, number]; quarterTurns: 0 }>[];
  readonly beltLines: readonly Readonly<{ instanceId: string; startMm: readonly [number, number, number]; endMm: readonly [number, number, number]; lengthMm: number; moduleCount: number; driveCount: 1 }>[];
  readonly totalLoadWatts: number;
  readonly extraCableLengthMm: number;
  readonly installed: false;
}

export interface FactoryFixture {
  readonly name: "cargo" | "layout-a" | "layout-b";
  readonly catalog: FactoryCatalog;
  readonly cargo: readonly FactoryCargoPosition[];
  readonly resourceState: ResourceContainerState;
  readonly layout: FactoryLayout | null;
  readonly initialBatteryEnergyJ: 12960000;
}

export interface FactoryBinding {
  readonly sessionId: FactoryId;
  readonly epoch: number;
  readonly hostTick: number;
  readonly factoryStep: number;
  readonly factoryRevision: number;
  readonly terrainRevision: number;
  readonly catalogDigest: FactoryDigest;
  readonly sourceProfileDigest: FactoryDigest;
}

export type FactoryCommandResult = Readonly<{ status: "Committed"; commandId: FactoryId; receiptId: FactoryId }>
  | Readonly<{ status: "NoOp"; commandId: FactoryId }>
  | Readonly<{ status: "Rejected" | "RecoveryHold"; commandId: FactoryId; reason: string }>;

export interface FactoryClockBinding {
  readonly hostTick: number;
  readonly universeTick: number;
  readonly factoryStep: number;
  readonly hostTicksSinceFactoryStep: number;
}
