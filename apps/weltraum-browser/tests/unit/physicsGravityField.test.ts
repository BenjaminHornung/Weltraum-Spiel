import { describe, expect, it } from "vitest";
import {
  STARTER_BODY_IDS,
  STARTER_CELESTIAL_CATALOG,
  computeCatalogEphemeris,
  gravitationalAccelerationAt,
  requireCelestialBody
} from "../../src/celestial";
import { createUniverseClock } from "../../src/persistence";
import {
  createBodyFixedFrameState,
  createBodyInertialFrameState,
  createFrameStateAtTime,
  createSystemInertialFrameId,
  createSystemInertialFrameState,
  directionFromSystemInertial,
  positionFromSystemInertial,
  spatialVector3
} from "../../src/spatial";
import {
  PhysicsSpaceError,
  createGravityFieldSnapshot,
  createGravitySourceBinding,
  queryGravityField
} from "../../src/physics-space";

const fixtureAt = (tick = 4_800) => {
  const time = createUniverseClock(tick);
  const ephemeris = computeCatalogEphemeris(STARTER_CELESTIAL_CATALOG, {
    epochSeconds: 0,
    requestedTimeSeconds: time.epochSeconds
  });
  const body = requireCelestialBody(STARTER_CELESTIAL_CATALOG, STARTER_BODY_IDS.hestia);
  const runtimeState = ephemeris.stateByBodyId[body.bodyId];
  if (runtimeState === undefined) {
    throw new Error("Hestia runtime state is missing.");
  }
  const system = createSystemInertialFrameState(createSystemInertialFrameId(), time);
  const inertial = createBodyInertialFrameState({
    body,
    runtimeState,
    time,
    systemFrameId: system.frameId
  });
  const fixed = createBodyFixedFrameState(inertial, {
    body,
    runtimeState,
    time,
    rotationEpoch: createUniverseClock(0)
  });
  return { time, ephemeris, body, runtimeState, system, fixed };
};

const bindingFor = (fixture: ReturnType<typeof fixtureAt>, bodyId: string) => {
  const body = requireCelestialBody(STARTER_CELESTIAL_CATALOG, bodyId);
  const runtimeState = fixture.ephemeris.stateByBodyId[body.bodyId];
  if (runtimeState === undefined) {
    throw new Error(`Runtime state for ${bodyId} is missing.`);
  }
  return createGravitySourceBinding({ body, runtimeState, time: fixture.time });
};

const vectorError = (
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number }
) => Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);

describe("physics gravity field adapter", () => {
  it("sorts explicit source bindings canonically and returns immutable stable snapshots", () => {
    const fixture = fixtureAt();
    const hestia = bindingFor(fixture, STARTER_BODY_IDS.hestia);
    const aurelia = bindingFor(fixture, STARTER_BODY_IDS.aurelia);
    const callerBindings = [hestia, aurelia];
    const before = structuredClone(callerBindings);

    const first = createGravityFieldSnapshot({
      time: fixture.time,
      systemFrameState: fixture.system,
      bindings: callerBindings
    });
    const reordered = createGravityFieldSnapshot({
      time: fixture.time,
      systemFrameState: fixture.system,
      bindings: [aurelia, hestia]
    });

    expect(first.bindings.map((binding) => binding.bindingId)).toEqual([
      STARTER_BODY_IDS.hestia,
      STARTER_BODY_IDS.aurelia
    ]);
    expect(first.signature).toBe(reordered.signature);
    expect(first.canonicalJson).toBe(reordered.canonicalJson);
    expect(first.time).toEqual(fixture.time);
    expect(first.systemFrameId).toBe(fixture.system.frameId);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.bindings)).toBe(true);
    expect(Object.isFrozen(first.bindings[0])).toBe(true);
    expect(callerBindings).toEqual(before);
  });

  it("delegates acceleration to Celestial gravity and reports dominant source only as diagnostics", () => {
    const fixture = fixtureAt();
    const binding = bindingFor(fixture, STARTER_BODY_IDS.hestia);
    const field = createGravityFieldSnapshot({
      time: fixture.time,
      systemFrameState: fixture.system,
      bindings: [binding]
    });
    const positionMeters = {
      x: fixture.runtimeState.absoluteState.positionMeters.x + fixture.body.radiusMeters + 1_000,
      y: fixture.runtimeState.absoluteState.positionMeters.y,
      z: fixture.runtimeState.absoluteState.positionMeters.z
    };
    const expected = gravitationalAccelerationAt(binding.source, positionMeters);
    const result = queryGravityField({
      field,
      positionMeters,
      positionFrameState: fixture.system
    });

    expect(result.sourceResults).toEqual([expected]);
    expect(result.systemAccelerationMetersPerSecondSquared).toEqual(
      expected.accelerationMetersPerSecondSquared
    );
    expect(result.dominantSource?.source.bodyId).toBe(STARTER_BODY_IDS.hestia);
    expect(field.bindings).toHaveLength(1);
    expect("visualScale" in field).toBe(false);
    expect("visualScale" in result).toBe(false);
  });

  it("returns the same physical acceleration when queried through a rotating BodyFixed frame", () => {
    const fixture = fixtureAt();
    const field = createGravityFieldSnapshot({
      time: fixture.time,
      systemFrameState: fixture.system,
      bindings: [bindingFor(fixture, STARTER_BODY_IDS.hestia)]
    });
    const systemPosition = {
      x: fixture.runtimeState.absoluteState.positionMeters.x + fixture.body.radiusMeters + 2_000,
      y: fixture.runtimeState.absoluteState.positionMeters.y + 500,
      z: fixture.runtimeState.absoluteState.positionMeters.z - 250
    };
    const bodyFixedPosition = positionFromSystemInertial(systemPosition, fixture.fixed);
    const systemResult = queryGravityField({
      field,
      positionMeters: systemPosition,
      positionFrameState: fixture.system,
      outputFrameState: fixture.system
    });
    const fixedResult = queryGravityField({
      field,
      positionMeters: bodyFixedPosition,
      positionFrameState: fixture.fixed,
      outputFrameState: fixture.fixed
    });

    expect(vectorError(fixedResult.systemPositionMeters, systemPosition)).toBeLessThanOrEqual(1e-5);
    expect(
      vectorError(
        fixedResult.systemAccelerationMetersPerSecondSquared,
        systemResult.systemAccelerationMetersPerSecondSquared
      )
    ).toBeLessThanOrEqual(1e-12);
    expect(
      vectorError(
        fixedResult.accelerationMetersPerSecondSquared,
        directionFromSystemInertial(systemResult.systemAccelerationMetersPerSecondSquared, fixture.fixed)
      )
    ).toBeLessThanOrEqual(1e-12);
  });

  it("rejects non-finite values and does not mutate query input", () => {
    const fixture = fixtureAt();
    const field = createGravityFieldSnapshot({
      time: fixture.time,
      systemFrameState: fixture.system,
      bindings: [bindingFor(fixture, STARTER_BODY_IDS.hestia)]
    });
    const position = spatialVector3(
      fixture.runtimeState.absoluteState.positionMeters.x + fixture.body.radiusMeters + 1_000,
      fixture.runtimeState.absoluteState.positionMeters.y,
      fixture.runtimeState.absoluteState.positionMeters.z
    );
    const before = structuredClone(position);
    queryGravityField({ field, positionMeters: position, positionFrameState: fixture.system });
    expect(position).toEqual(before);

    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        queryGravityField({
          field,
          positionMeters: { x: invalid, y: 0, z: 0 },
          positionFrameState: fixture.system
        })
      ).toThrow();
    }
    expect(() =>
      createGravityFieldSnapshot({
        time: createUniverseClock(1),
        systemFrameState: fixture.system,
        bindings: field.bindings
      })
    ).toThrowError(expect.objectContaining<Partial<PhysicsSpaceError>>({ code: "TIME_MISMATCH" }));
  });

  it("rejects a forged shifted or rotating self-root gravity frame", () => {
    const fixture = fixtureAt();
    const forgedRoot = createFrameStateAtTime({
      frameId: fixture.system.frameId,
      systemFrameId: fixture.system.frameId,
      time: fixture.time,
      originPositionMeters: { x: 1, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: Math.sin(0.25), w: Math.cos(0.25) },
      originVelocityMetersPerSecond: { x: 0, y: 1, z: 0 },
      angularVelocityRadiansPerSecond: { x: 0, y: 0, z: 1 }
    });

    expect(() =>
      createGravityFieldSnapshot({
        time: fixture.time,
        systemFrameState: forgedRoot,
        bindings: [bindingFor(fixture, STARTER_BODY_IDS.hestia)]
      })
    ).toThrowError(expect.objectContaining<Partial<PhysicsSpaceError>>({ code: "FRAME_MISMATCH" }));
  });
});
