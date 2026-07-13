import { magnitude, scale, sub } from "../core/vector";
import type { Vec3 } from "../core/vector";
import { failCelestial } from "./errors";
import { createCelestialBodyId } from "./ids";
import type {
  CelestialBodyDefinition,
  CelestialRuntimeState,
  DominantGravitySourceResult,
  GravityAccelerationResult,
  GravitySource
} from "./types";
import { CELESTIAL_SCHEMA_VERSION } from "./types";
import {
  assertCelestialSchemaVersion,
  deepFreezeCelestial,
  isCelestialRecord,
  requireFinitePositive,
  requireFiniteVec3
} from "./validation";

export const createGravitySource = (value: unknown): GravitySource => {
  if (!isCelestialRecord(value)) {
    return failCelestial("InvalidGravitySource", "", "Gravity source must be an object.");
  }
  assertCelestialSchemaVersion(value.schemaVersion, "/schemaVersion");
  const bodyId = createCelestialBodyId(value.bodyId, "/bodyId");
  const absolutePositionMeters = requireFiniteVec3(value.absolutePositionMeters, "/absolutePositionMeters");
  const gravitationalParameterMu = requireFinitePositive(value.gravitationalParameterMu, "/gravitationalParameterMu");
  const physicalRadiusMeters = requireFinitePositive(value.physicalRadiusMeters, "/physicalRadiusMeters");
  const minimumQueryRadiusMeters = value.minimumQueryRadiusMeters === undefined
    ? physicalRadiusMeters
    : requireFinitePositive(value.minimumQueryRadiusMeters, "/minimumQueryRadiusMeters");
  if (minimumQueryRadiusMeters < physicalRadiusMeters) {
    return failCelestial(
      "InvalidGravitySource",
      "/minimumQueryRadiusMeters",
      "Minimum query radius cannot be smaller than the physical radius."
    );
  }
  if (typeof value.eligible !== "boolean") {
    return failCelestial("InvalidGravitySource", "/eligible", "Gravity source eligible must be boolean.");
  }
  return deepFreezeCelestial({
    schemaVersion: CELESTIAL_SCHEMA_VERSION,
    bodyId,
    absolutePositionMeters,
    gravitationalParameterMu,
    physicalRadiusMeters,
    minimumQueryRadiusMeters,
    eligible: value.eligible
  });
};

export const gravitySourceFromRuntimeState = (
  body: CelestialBodyDefinition,
  state: CelestialRuntimeState,
  minimumQueryRadiusMeters = body.radiusMeters
): GravitySource => {
  if (body.bodyId !== state.bodyId) {
    return failCelestial("InvalidGravitySource", "/bodyId", "Body and runtime state IDs must match.");
  }
  return createGravitySource({
    schemaVersion: CELESTIAL_SCHEMA_VERSION,
    bodyId: body.bodyId,
    absolutePositionMeters: state.absoluteState.positionMeters,
    gravitationalParameterMu: body.gravity.gravitationalParameterMu,
    physicalRadiusMeters: body.radiusMeters,
    minimumQueryRadiusMeters,
    eligible: body.gravity.canBeDominantSource
  });
};

export const gravitationalAccelerationAt = (
  source: GravitySource,
  queryPositionMeters: Vec3
): GravityAccelerationResult => {
  const queryPosition = requireFiniteVec3(queryPositionMeters, "/queryPositionMeters");
  const displacement = sub(source.absolutePositionMeters, queryPosition);
  const distanceMeters = magnitude(displacement);
  if (!Number.isFinite(distanceMeters)) {
    return failCelestial("InvalidNumber", "/queryPositionMeters", "Gravity distance must be finite.");
  }
  if (distanceMeters < source.minimumQueryRadiusMeters) {
    return failCelestial(
      "InsideMinimumRadius",
      "/queryPositionMeters",
      `Gravity query for ${source.bodyId} is inside its minimum radius.`
    );
  }
  const magnitudeMetersPerSecondSquared = source.gravitationalParameterMu / distanceMeters ** 2;
  const accelerationMetersPerSecondSquared = scale(displacement, magnitudeMetersPerSecondSquared / distanceMeters);
  return deepFreezeCelestial({
    sourceBodyId: source.bodyId,
    queryPositionMeters: queryPosition,
    sourcePositionMeters: source.absolutePositionMeters,
    distanceMeters,
    magnitudeMetersPerSecondSquared,
    accelerationMetersPerSecondSquared
  });
};

/** Public contract name retained independently of any future force-integration API. */
export const gravityAccelerationAtPosition = gravitationalAccelerationAt;

export const surfaceGravityMetersPerSecondSquared = (body: CelestialBodyDefinition): number =>
  body.gravity.gravitationalParameterMu / body.radiusMeters ** 2;

export const escapeVelocityMetersPerSecond = (body: CelestialBodyDefinition): number =>
  Math.sqrt(2 * body.gravity.gravitationalParameterMu / body.radiusMeters);

export const surfaceGravity = surfaceGravityMetersPerSecondSquared;
export const escapeVelocity = escapeVelocityMetersPerSecond;

export const selectDominantGravitySource = (
  sources: readonly GravitySource[],
  queryPositionMeters: Vec3
): DominantGravitySourceResult => {
  const eligibleSources = sources.filter((source) => source.eligible).sort((left, right) =>
    left.bodyId < right.bodyId ? -1 : left.bodyId > right.bodyId ? 1 : 0
  );
  let dominant: DominantGravitySourceResult | undefined;
  for (const source of eligibleSources) {
    const acceleration = gravitationalAccelerationAt(source, queryPositionMeters);
    if (!dominant || acceleration.magnitudeMetersPerSecondSquared > dominant.magnitudeMetersPerSecondSquared) {
      dominant = deepFreezeCelestial({ source, ...acceleration });
    }
  }
  return dominant ?? failCelestial("NoGravitySource", "/sources", "No eligible gravity source was provided.");
};
