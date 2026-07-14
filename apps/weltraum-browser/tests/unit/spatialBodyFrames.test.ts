import { describe, expect, it } from "vitest";
import {
  STARTER_BODY_IDS,
  STARTER_CELESTIAL_CATALOG,
  computeCatalogEphemeris,
  requireCelestialBody
} from "../../src/celestial";
import { createUniverseClock } from "../../src/persistence";
import {
  SpatialError,
  computeBodyRotationState,
  createBodyFixedFrameState,
  createBodyFixedFrameTransform,
  createBodyInertialFrameId,
  createBodyInertialFrameState,
  createBodyInertialFrameTransform,
  createSystemInertialFrameId,
  quaternionAngularDistanceRadians,
  rotateSpatialVector,
  spatialVector3
} from "../../src/spatial";

const SYSTEM_FRAME_ID = createSystemInertialFrameId();

const vectorError = (
  left: { readonly x: number; readonly y: number; readonly z: number },
  right: { readonly x: number; readonly y: number; readonly z: number }
): number => Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);

const hestiaAt = (tick: number) => {
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
  if (body.parentBodyId === null) {
    throw new Error("Hestia parent body is missing.");
  }
  const parentRuntimeState = ephemeris.stateByBodyId[body.parentBodyId];
  if (parentRuntimeState === undefined) {
    throw new Error("Hestia parent runtime state is missing.");
  }
  return { time, body, runtimeState, parentRuntimeState };
};

describe("body inertial and body fixed frames", () => {
  it("uses the canonical celestial position and velocity for BodyInertial", () => {
    const fixture = hestiaAt(12_345);
    const state = createBodyInertialFrameState({ ...fixture, systemFrameId: SYSTEM_FRAME_ID });

    expect(state.originPositionMeters).toEqual(fixture.runtimeState.absoluteState.positionMeters);
    expect(state.originVelocityMetersPerSecond).toEqual(
      fixture.runtimeState.absoluteState.velocityMetersPerSecond
    );
    expect(state.orientation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(state.angularVelocityRadiansPerSecond).toEqual({ x: 0, y: 0, z: 0 });
    expect(Object.isFrozen(state)).toBe(true);
  });

  it("cross-checks child relative state against the explicit parent runtime state", () => {
    const fixture = hestiaAt(12_345);
    const transform = createBodyInertialFrameTransform({
      ...fixture,
      systemFrameId: SYSTEM_FRAME_ID,
      parentFrameId: createBodyInertialFrameId(fixture.parentRuntimeState.bodyId)
    });

    expect(transform.translationMeters).toEqual(fixture.runtimeState.parentRelativeState!.positionMeters);
    expect(transform.originVelocityMetersPerSecond).toEqual(
      fixture.runtimeState.parentRelativeState!.velocityMetersPerSecond
    );
  });

  it("rejects inconsistent child absolute and parent-relative Celestial states", () => {
    const fixture = hestiaAt(12_345);
    const inconsistentRuntimeState = {
      ...fixture.runtimeState,
      absoluteState: {
        ...fixture.runtimeState.absoluteState,
        positionMeters: {
          ...fixture.runtimeState.absoluteState.positionMeters,
          x: fixture.runtimeState.absoluteState.positionMeters.x + 1
        }
      }
    };

    expect(() =>
      createBodyInertialFrameTransform({
        ...fixture,
        runtimeState: inconsistentRuntimeState,
        systemFrameId: SYSTEM_FRAME_ID,
        parentFrameId: createBodyInertialFrameId(fixture.parentRuntimeState.bodyId)
      })
    ).toThrowError(expect.objectContaining<Partial<SpatialError>>({ code: "FRAME_MISMATCH" }));
  });

  it("rejects a malformed child runtime state without parent-relative state", () => {
    const fixture = hestiaAt(12_345);
    expect(() =>
      createBodyInertialFrameTransform({
        ...fixture,
        runtimeState: { ...fixture.runtimeState, parentRelativeState: null },
        systemFrameId: SYSTEM_FRAME_ID,
        parentFrameId: createBodyInertialFrameId(fixture.parentRuntimeState.bodyId)
      })
    ).toThrowError(expect.objectContaining<Partial<SpatialError>>({ code: "FRAME_MISMATCH" }));
  });

  it("rejects a child transform bound to the wrong parent frame ID", () => {
    const fixture = hestiaAt(12_345);
    expect(() =>
      createBodyInertialFrameTransform({
        ...fixture,
        systemFrameId: SYSTEM_FRAME_ID,
        parentFrameId: SYSTEM_FRAME_ID
      })
    ).toThrowError(expect.objectContaining<Partial<SpatialError>>({ code: "FRAME_MISMATCH" }));
  });

  it("computes deterministic BodyFixed orientation and angular velocity at identical explicit times", () => {
    const fixture = hestiaAt(2_400);
    const rotationEpoch = createUniverseClock(0);
    const first = createBodyFixedFrameTransform({ ...fixture, rotationEpoch });
    const second = createBodyFixedFrameTransform({ ...fixture, rotationEpoch });

    expect(first).toEqual(second);
    expect(first.orientation).toEqual(second.orientation);
    expect(first.angularVelocityRadiansPerSecond).toEqual(second.angularVelocityRadiansPerSecond);
    expect(Math.hypot(
      first.angularVelocityRadiansPerSecond.x,
      first.angularVelocityRadiansPerSecond.y,
      first.angularVelocityRadiansPerSecond.z
    )).toBeCloseTo((2 * Math.PI) / fixture.body.rotation!.rotationPeriodSeconds, 15);
  });

  it("maps BodyFixed +X through qTiltX * qSpinZ at epoch and prograde quarter period", () => {
    const fixture = hestiaAt(0);
    const rotation = {
      ...fixture.body.rotation!,
      rotationPeriodSeconds: 480,
      axialTiltDegrees: 30,
      retrograde: false,
      primeMeridianAtEpochDegrees: 0
    };
    const epoch = createUniverseClock(0);
    const quarter = createUniverseClock((rotation.rotationPeriodSeconds * 120) / 4);
    const atEpoch = computeBodyRotationState(rotation, epoch, epoch);
    const atQuarter = computeBodyRotationState(rotation, quarter, epoch);
    const bodyFixedX = spatialVector3(1, 0, 0);
    const tiltRadians = rotation.axialTiltDegrees * Math.PI / 180;

    expect(vectorError(rotateSpatialVector(atEpoch.orientation, bodyFixedX), { x: 1, y: 0, z: 0 })).toBeLessThanOrEqual(1e-12);
    expect(
      vectorError(rotateSpatialVector(atQuarter.orientation, bodyFixedX), {
        x: 0,
        y: Math.cos(tiltRadians),
        z: Math.sin(tiltRadians)
      })
    ).toBeLessThanOrEqual(1e-12);
  });

  it("reverses quarter phase and tilted-pole angular velocity for retrograde rotation", () => {
    const fixture = hestiaAt(0);
    const baseRotation = {
      ...fixture.body.rotation!,
      rotationPeriodSeconds: 480,
      axialTiltDegrees: 30,
      primeMeridianAtEpochDegrees: 0
    };
    const epoch = createUniverseClock(0);
    const quarter = createUniverseClock((baseRotation.rotationPeriodSeconds * 120) / 4);
    const prograde = computeBodyRotationState({ ...baseRotation, retrograde: false }, quarter, epoch);
    const retrograde = computeBodyRotationState({ ...baseRotation, retrograde: true }, quarter, epoch);
    const bodyFixedX = spatialVector3(1, 0, 0);
    const tiltRadians = baseRotation.axialTiltDegrees * Math.PI / 180;
    const rate = 2 * Math.PI / baseRotation.rotationPeriodSeconds;
    const tiltedPole = { x: 0, y: -Math.sin(tiltRadians), z: Math.cos(tiltRadians) };

    expect(
      vectorError(rotateSpatialVector(retrograde.orientation, bodyFixedX), {
        x: 0,
        y: -Math.cos(tiltRadians),
        z: -Math.sin(tiltRadians)
      })
    ).toBeLessThanOrEqual(1e-12);
    expect(
      vectorError(prograde.angularVelocityRadiansPerSecond, {
        x: tiltedPole.x * rate,
        y: tiltedPole.y * rate,
        z: tiltedPole.z * rate
      })
    ).toBeLessThanOrEqual(1e-12);
    expect(
      vectorError(retrograde.angularVelocityRadiansPerSecond, {
        x: -tiltedPole.x * rate,
        y: -tiltedPole.y * rate,
        z: -tiltedPole.z * rate
      })
    ).toBeLessThanOrEqual(1e-12);
  });

  it("returns to the epoch orientation after exactly one full rotation period", () => {
    const epochFixture = hestiaAt(0);
    const periodTicks = epochFixture.body.rotation!.rotationPeriodSeconds * 120;
    const periodFixture = hestiaAt(periodTicks);
    const rotationEpoch = createUniverseClock(0);
    const initial = computeBodyRotationState(epochFixture.body.rotation!, epochFixture.time, rotationEpoch);
    const completed = computeBodyRotationState(periodFixture.body.rotation!, periodFixture.time, rotationEpoch);

    expect(quaternionAngularDistanceRadians(initial.orientation, completed.orientation)).toBeLessThanOrEqual(1e-10);
    expect(completed.angularVelocityRadiansPerSecond).toEqual(initial.angularVelocityRadiansPerSecond);
    expect(completed.spinAngleRadians).toBeLessThan(1e-12);
  });

  it("composes BodyFixed without changing the celestial origin and adds explicit spin", () => {
    const fixture = hestiaAt(60_000);
    const inertial = createBodyInertialFrameState({ ...fixture, systemFrameId: SYSTEM_FRAME_ID });
    const fixed = createBodyFixedFrameState(inertial, {
      ...fixture,
      rotationEpoch: createUniverseClock(0)
    });

    expect(fixed.originPositionMeters).toEqual(inertial.originPositionMeters);
    expect(fixed.originVelocityMetersPerSecond).toEqual(inertial.originVelocityMetersPerSecond);
    expect(Math.hypot(
      fixed.angularVelocityRadiansPerSecond.x,
      fixed.angularVelocityRadiansPerSecond.y,
      fixed.angularVelocityRadiansPerSecond.z
    )).toBeGreaterThan(0);
  });

  it("fails closed rather than inventing rotation for a body without RotationDefinition", () => {
    const time = createUniverseClock(0);
    const body = requireCelestialBody(STARTER_CELESTIAL_CATALOG, STARTER_BODY_IDS.pyra);
    const ephemeris = computeCatalogEphemeris(STARTER_CELESTIAL_CATALOG, {
      epochSeconds: 0,
      requestedTimeSeconds: time.epochSeconds
    });
    const runtimeState = ephemeris.stateByBodyId[body.bodyId];
    if (runtimeState === undefined) {
      throw new Error("Pyra runtime state is missing.");
    }

    expect(() => createBodyFixedFrameTransform({ body, runtimeState, time, rotationEpoch: time })).toThrowError(
      expect.objectContaining<Partial<SpatialError>>({ code: "INVALID_ROTATION" })
    );
  });

  it("requires the Celestial runtime epoch to match UniverseTime exactly", () => {
    const fixture = hestiaAt(0);
    expect(() =>
      createBodyInertialFrameState({
        body: fixture.body,
        runtimeState: fixture.runtimeState,
        time: createUniverseClock(1),
        systemFrameId: SYSTEM_FRAME_ID
      })
    ).toThrowError(expect.objectContaining<Partial<SpatialError>>({ code: "TIME_MISMATCH" }));
  });
});
