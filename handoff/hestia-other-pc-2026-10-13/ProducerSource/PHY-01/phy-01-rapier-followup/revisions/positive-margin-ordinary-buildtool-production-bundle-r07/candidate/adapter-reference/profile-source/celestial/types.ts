import type { Vec3 } from "../core/vector";
import type { CelestialBodyId, CelestialCatalogId } from "./ids";

export const CELESTIAL_SCHEMA_VERSION = 1 as const;
export type CelestialSchemaVersion = typeof CELESTIAL_SCHEMA_VERSION;

export const CELESTIAL_BODY_TYPES = [
  "Star",
  "RockyPlanet",
  "SuperEarth",
  "GasGiant",
  "IceGiant",
  "Moon",
  "Asteroid",
  "Comet",
  "Station",
  "ArtificialStructure"
] as const;

export type CelestialBodyType = (typeof CELESTIAL_BODY_TYPES)[number];

export interface OrbitDefinitionInput {
  readonly schemaVersion: number;
  readonly parentBodyId: CelestialBodyId | string;
  readonly semiMajorAxisMeters: number;
  readonly eccentricity: number;
  readonly inclinationDegrees: number;
  readonly longitudeOfAscendingNodeDegrees: number;
  readonly argumentOfPeriapsisDegrees: number;
  readonly meanAnomalyAtEpochDegrees: number;
}

export interface OrbitDefinition extends Omit<OrbitDefinitionInput, "schemaVersion" | "parentBodyId"> {
  readonly schemaVersion: CelestialSchemaVersion;
  readonly parentBodyId: CelestialBodyId;
}

export interface RotationDefinitionInput {
  readonly schemaVersion: number;
  readonly rotationPeriodSeconds: number;
  readonly axialTiltDegrees: number;
  readonly retrograde: boolean;
  readonly primeMeridianAtEpochDegrees: number;
}

export interface RotationDefinition extends Omit<RotationDefinitionInput, "schemaVersion"> {
  readonly schemaVersion: CelestialSchemaVersion;
}

export type AtmosphereHazard =
  | "HighPressure"
  | "LowPressure"
  | "Toxic"
  | "Corrosive"
  | "HighOxygen"
  | "Radiation"
  | "Storms"
  | "ThermalExtreme";

export interface AtmosphereDefinitionInput {
  readonly schemaVersion: number;
  readonly hasAtmosphere: boolean;
  readonly surfacePressurePa?: number;
  readonly hazards: readonly AtmosphereHazard[];
}

export interface AtmosphereDefinition extends Omit<AtmosphereDefinitionInput, "schemaVersion"> {
  readonly schemaVersion: CelestialSchemaVersion;
}

export interface GravityDefinitionInput {
  readonly schemaVersion: number;
  readonly gravitationalParameterMu: number;
  readonly canBeDominantSource: boolean;
}

export interface GravityDefinition extends Omit<GravityDefinitionInput, "schemaVersion"> {
  readonly schemaVersion: CelestialSchemaVersion;
}

export interface VisualScaleProfileInput {
  readonly schemaVersion: number;
  readonly mapRadiusScale: number;
  readonly localRadiusScale: number;
  readonly impostorRadiusScale: number;
  readonly renderOnly: true;
}

export interface VisualScaleProfile extends Omit<VisualScaleProfileInput, "schemaVersion"> {
  readonly schemaVersion: CelestialSchemaVersion;
}

export type SurfaceAccessMode = "Deferred" | "OrbitOnly" | "NoSolidSurface";

export interface SurfaceAccessProfileInput {
  readonly schemaVersion: number;
  readonly mode: SurfaceAccessMode;
}

export interface SurfaceAccessProfile extends Omit<SurfaceAccessProfileInput, "schemaVersion"> {
  readonly schemaVersion: CelestialSchemaVersion;
}

export type GameplayAccessMode = "Deferred" | "OrbitOnly";

export interface GameplayAccessProfileInput {
  readonly schemaVersion: number;
  readonly mode: GameplayAccessMode;
  readonly tags: readonly string[];
}

export interface GameplayAccessProfile extends Omit<GameplayAccessProfileInput, "schemaVersion"> {
  readonly schemaVersion: CelestialSchemaVersion;
}

export interface CelestialBodyDefinitionInput {
  readonly schemaVersion: number;
  readonly bodyId: CelestialBodyId | string;
  readonly displayName: string;
  readonly bodyType: CelestialBodyType;
  readonly parentBodyId: CelestialBodyId | string | null;
  readonly radiusMeters: number;
  readonly massKg: number;
  readonly gravity: GravityDefinitionInput;
  readonly orbit: OrbitDefinitionInput | null;
  readonly rotation: RotationDefinitionInput | null;
  readonly atmosphere: AtmosphereDefinitionInput | null;
  readonly visualScale: VisualScaleProfileInput;
  readonly surfaceAccess: SurfaceAccessProfileInput;
  readonly gameplayAccess: GameplayAccessProfileInput;
}

export interface CelestialBodyDefinition
  extends Omit<
    CelestialBodyDefinitionInput,
    | "schemaVersion"
    | "bodyId"
    | "parentBodyId"
    | "gravity"
    | "orbit"
    | "rotation"
    | "atmosphere"
    | "visualScale"
    | "surfaceAccess"
    | "gameplayAccess"
  > {
  readonly schemaVersion: CelestialSchemaVersion;
  readonly bodyId: CelestialBodyId;
  readonly parentBodyId: CelestialBodyId | null;
  readonly gravity: GravityDefinition;
  readonly orbit: OrbitDefinition | null;
  readonly rotation: RotationDefinition | null;
  readonly atmosphere: AtmosphereDefinition | null;
  readonly visualScale: VisualScaleProfile;
  readonly surfaceAccess: SurfaceAccessProfile;
  readonly gameplayAccess: GameplayAccessProfile;
}

export interface CelestialCatalogInput {
  readonly schemaVersion: number;
  readonly catalogId: CelestialCatalogId | string;
  readonly bodies: readonly CelestialBodyDefinitionInput[];
}

export interface CelestialCatalogIndexes {
  readonly bodyById: Readonly<Record<string, CelestialBodyDefinition>>;
  readonly childIdsByParentId: Readonly<Record<string, readonly CelestialBodyId[]>>;
  readonly bodyIdsByType: Readonly<Record<CelestialBodyType, readonly CelestialBodyId[]>>;
}

export interface CelestialCatalog {
  readonly schemaVersion: CelestialSchemaVersion;
  readonly catalogId: CelestialCatalogId;
  readonly bodies: readonly CelestialBodyDefinition[];
  readonly rootBodyId: CelestialBodyId;
  readonly indexes: CelestialCatalogIndexes;
  readonly canonicalJson: string;
  readonly signature: string;
}

export type CelestialFrameKind = "AbsoluteSystem" | "BodyCentered";

export interface CelestialReferenceFrame {
  readonly schemaVersion: CelestialSchemaVersion;
  readonly kind: CelestialFrameKind;
  readonly referenceBodyId: CelestialBodyId;
  readonly units: "meters";
}

export interface CelestialKinematicState {
  readonly frame: CelestialReferenceFrame;
  readonly positionMeters: Vec3;
  readonly velocityMetersPerSecond: Vec3;
}

export interface CelestialRuntimeState {
  readonly schemaVersion: CelestialSchemaVersion;
  readonly bodyId: CelestialBodyId;
  readonly requestedTimeSeconds: number;
  readonly gravitationalParameterMu: number;
  readonly physicalRadiusMeters: number;
  readonly absoluteState: CelestialKinematicState;
  readonly parentRelativeState: CelestialKinematicState | null;
}

export interface KeplerSolverOptions {
  readonly toleranceRadians: number;
  readonly maxIterations: number;
}

export interface KeplerSolution {
  readonly eccentricAnomalyRadians: number;
  readonly normalizedMeanAnomalyRadians: number;
  readonly residualRadians: number;
  readonly iterations: number;
}

export interface RelativeOrbitalState {
  readonly positionMeters: Vec3;
  readonly velocityMetersPerSecond: Vec3;
  readonly orbitalPeriodSeconds: number;
  readonly meanMotionRadiansPerSecond: number;
  readonly meanAnomalyRadians: number;
  readonly eccentricAnomalyRadians: number;
  readonly solverIterations: number;
}

export interface CatalogEphemerisInput {
  readonly epochSeconds: number;
  readonly requestedTimeSeconds: number;
  readonly solverOptions?: KeplerSolverOptions;
}

export interface CelestialCatalogEphemeris {
  readonly schemaVersion: CelestialSchemaVersion;
  readonly epochSeconds: number;
  readonly requestedTimeSeconds: number;
  readonly states: readonly CelestialRuntimeState[];
  readonly stateByBodyId: Readonly<Record<string, CelestialRuntimeState>>;
  readonly canonicalJson: string;
  readonly signature: string;
}

export interface GravitySourceInput {
  readonly schemaVersion: number;
  readonly bodyId: CelestialBodyId | string;
  readonly absolutePositionMeters: Vec3;
  readonly gravitationalParameterMu: number;
  readonly physicalRadiusMeters: number;
  readonly minimumQueryRadiusMeters?: number;
  readonly eligible: boolean;
}

export interface GravitySource extends Omit<GravitySourceInput, "schemaVersion" | "bodyId" | "minimumQueryRadiusMeters"> {
  readonly schemaVersion: CelestialSchemaVersion;
  readonly bodyId: CelestialBodyId;
  readonly minimumQueryRadiusMeters: number;
}

export interface GravityAccelerationResult {
  readonly sourceBodyId: CelestialBodyId;
  readonly queryPositionMeters: Vec3;
  readonly sourcePositionMeters: Vec3;
  readonly distanceMeters: number;
  readonly magnitudeMetersPerSecondSquared: number;
  readonly accelerationMetersPerSecondSquared: Vec3;
}

export interface DominantGravitySourceResult extends GravityAccelerationResult {
  readonly source: GravitySource;
}
