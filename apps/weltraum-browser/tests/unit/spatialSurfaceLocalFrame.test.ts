import { describe, expect, it } from "vitest";
import {
  STARTER_BODY_IDS,
  STARTER_CELESTIAL_CATALOG,
  computeCatalogEphemeris,
  requireCelestialBody
} from "../../src/celestial";
import { createUniverseClock } from "../../src/persistence";
import {
  computeSurfaceBasis,
  createBodyFixedFrameState,
  createBodyInertialFrameState,
  createQuaternionFromAxisAngle,
  createSpatialPose,
  createSurfaceLocalFrameDefinition,
  createSurfaceLocalFrameState,
  createSystemInertialFrameId,
  crossSpatialVectors,
  dotSpatialVectors,
  normalizeSpatialVector,
  quaternionAngularDistanceRadians,
  spatialVector3,
  spatialVectorMagnitude,
  transformPose,
  transformPosition
} from "../../src/spatial";

const fixtureAt = (tick = 7_200) => {
  const time = createUniverseClock(tick);
  const body = requireCelestialBody(STARTER_CELESTIAL_CATALOG, STARTER_BODY_IDS.hestia);
  const ephemeris = computeCatalogEphemeris(STARTER_CELESTIAL_CATALOG, {
    epochSeconds: 0,
    requestedTimeSeconds: time.epochSeconds
  });
  const runtimeState = ephemeris.stateByBodyId[body.bodyId];
  if (runtimeState === undefined) {
    throw new Error("Hestia runtime state is missing.");
  }
  const inertial = createBodyInertialFrameState({
    body,
    runtimeState,
    time,
    systemFrameId: createSystemInertialFrameId()
  });
  const fixed = createBodyFixedFrameState(inertial, {
    body,
    runtimeState,
    time,
    rotationEpoch: createUniverseClock(0)
  });
  return { time, body, fixed };
};

const vectorError = (left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }) =>
  Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);

const assertBasis = (latitudeRadians: number, longitudeRadians: number): void => {
  const basis = computeSurfaceBasis({
    bodyId: STARTER_BODY_IDS.hestia,
    latitudeRadians,
    longitudeRadians,
    altitudeMeters: 0
  });
  for (const axis of [basis.east, basis.up, basis.south, basis.north]) {
    expect([axis.x, axis.y, axis.z].every(Number.isFinite)).toBe(true);
    expect(spatialVectorMagnitude(axis)).toBeCloseTo(1, 12);
  }
  expect(Math.abs(dotSpatialVectors(basis.east, basis.up))).toBeLessThanOrEqual(1e-12);
  expect(Math.abs(dotSpatialVectors(basis.up, basis.south))).toBeLessThanOrEqual(1e-12);
  expect(Math.abs(dotSpatialVectors(basis.south, basis.east))).toBeLessThanOrEqual(1e-12);
  expect(vectorError(crossSpatialVectors(basis.east, basis.up), basis.south)).toBeLessThanOrEqual(1e-12);
  expect(vectorError(crossSpatialVectors(basis.up, basis.south), basis.east)).toBeLessThanOrEqual(1e-12);
  expect(vectorError(crossSpatialVectors(basis.south, basis.east), basis.up)).toBeLessThanOrEqual(1e-12);
  expect(vectorError(basis.north, spatialVector3(-basis.south.x, -basis.south.y, -basis.south.z))).toBe(0);
};

describe("SurfaceLocalFrame geographic EUS convention", () => {
  it("makes Up the radial body normal", () => {
    const { time, body, fixed } = fixtureAt();
    const definition = createSurfaceLocalFrameDefinition({
      frameId: "frame:surface.hestia-test",
      anchor: {
        bodyId: body.bodyId,
        latitudeRadians: 0.41,
        longitudeRadians: -1.2,
        altitudeMeters: 350
      }
    });
    const state = createSurfaceLocalFrameState(definition, body, fixed, time);
    const radial = normalizeSpatialVector(state.bodyFixedPositionMeters);

    expect(vectorError(state.upBodyFixed, radial)).toBeLessThanOrEqual(1e-12);
    expect(spatialVectorMagnitude(state.bodyFixedPositionMeters)).toBeCloseTo(body.radiusMeters + 350, 6);
  });

  it("is finite and deterministically longitude-oriented at both geographic poles", () => {
    for (const latitudeRadians of [-Math.PI / 2, Math.PI / 2]) {
      assertBasis(latitudeRadians, 0);
      assertBasis(latitudeRadians, 1.2345);

      const atZero = computeSurfaceBasis({
        bodyId: STARTER_BODY_IDS.hestia,
        latitudeRadians,
        longitudeRadians: 0,
        altitudeMeters: 0
      });
      const atLongitude = computeSurfaceBasis({
        bodyId: STARTER_BODY_IDS.hestia,
        latitudeRadians,
        longitudeRadians: 1.2345,
        altitudeMeters: 0
      });
      expect(atZero.east).toEqual({ x: 0, y: 1, z: 0 });
      expect(vectorError(atZero.east, atLongitude.east)).toBeGreaterThan(0.5);
    }
  });

  it("verifies East x Up = South, Up x South = East, and South x East = Up away from and at poles", () => {
    assertBasis(0.42, -2.1);
    assertBasis(Math.PI / 2, -0.7);
    assertBasis(-Math.PI / 2, 2.4);
  });

  it("roundtrips local positions through BodyFixed within the position tolerance", () => {
    const { time, body, fixed } = fixtureAt();
    const definition = createSurfaceLocalFrameDefinition({
      frameId: "frame:surface.roundtrip",
      anchor: {
        bodyId: body.bodyId,
        latitudeRadians: -0.25,
        longitudeRadians: 2.75,
        altitudeMeters: 125
      }
    });
    const surface = createSurfaceLocalFrameState(definition, body, fixed, time);
    const local = spatialVector3(123.456, 78.9, -321.5);
    const bodyFixed = transformPosition(local, surface, fixed);
    const roundtrip = transformPosition(bodyFixed, fixed, surface);

    expect(vectorError(roundtrip, local)).toBeLessThanOrEqual(1e-5);
  });

  it("keeps the geographic frame independent from actor-facing orientation", () => {
    const { time, body, fixed } = fixtureAt();
    const definition = createSurfaceLocalFrameDefinition({
      frameId: "frame:surface.actor-independent",
      anchor: {
        bodyId: body.bodyId,
        latitudeRadians: 0.5,
        longitudeRadians: 0.75,
        altitudeMeters: 0
      }
    });
    const surface = createSurfaceLocalFrameState(definition, body, fixed, time);
    const stationaryPosition = spatialVector3(10, 2, -30);
    const eastFacing = createSpatialPose({
      positionMeters: stationaryPosition,
      orientation: createQuaternionFromAxisAngle(spatialVector3(0, 1, 0), 0)
    });
    const independentlyTurned = createSpatialPose({
      positionMeters: stationaryPosition,
      orientation: createQuaternionFromAxisAngle(spatialVector3(0, 1, 0), Math.PI / 3)
    });
    const eastAbsolute = transformPose(eastFacing, surface, fixed);
    const turnedAbsolute = transformPose(independentlyTurned, surface, fixed);

    expect(eastAbsolute.positionMeters).toEqual(turnedAbsolute.positionMeters);
    expect(quaternionAngularDistanceRadians(eastAbsolute.orientation, turnedAbsolute.orientation)).toBeCloseTo(
      Math.PI / 3,
      10
    );
    expect(surface.definition).toBe(definition);
    expect(surface.definition.signature).toBe(definition.signature);
  });

  it("does not mutate caller anchors and returns immutable public definitions and states", () => {
    const { time, body, fixed } = fixtureAt();
    const anchor = {
      bodyId: body.bodyId,
      latitudeRadians: 0.1,
      longitudeRadians: 4 * Math.PI,
      altitudeMeters: 5
    };
    const before = structuredClone(anchor);
    const definition = createSurfaceLocalFrameDefinition({ frameId: "frame:surface.immutable", anchor });
    const state = createSurfaceLocalFrameState(definition, body, fixed, time);

    expect(anchor).toEqual(before);
    expect(definition.anchor.longitudeRadians).toBe(0);
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.anchor)).toBe(true);
    expect(Object.isFrozen(state)).toBe(true);
  });
});
