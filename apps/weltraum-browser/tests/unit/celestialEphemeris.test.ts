import { describe, expect, it } from "vitest";
import { sub } from "../../src/core/vector";
import {
  STARTER_BODY_IDS,
  STARTER_CELESTIAL_CATALOG,
  CelestialError,
  computeCatalogEphemeris,
  orbitalPeriodSeconds,
  propagateKeplerOrbit,
  requireCelestialBody,
  solveEllipticKepler
} from "../../src/celestial";

const expectCelestialError = (action: () => unknown, code: CelestialError["code"]): void => {
  try {
    action();
    throw new Error(`Expected CelestialError ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(CelestialError);
    expect((error as CelestialError).code).toBe(code);
  }
};

describe("deterministic Kepler propagation", () => {
  it("returns to the epoch position after one circular orbital period", () => {
    const body = requireCelestialBody(STARTER_CELESTIAL_CATALOG, STARTER_BODY_IDS.hestia);
    const parent = requireCelestialBody(STARTER_CELESTIAL_CATALOG, STARTER_BODY_IDS.aurelia);
    const orbit = body.orbit!;
    const period = orbitalPeriodSeconds(orbit.semiMajorAxisMeters, parent.gravity.gravitationalParameterMu);
    const epoch = propagateKeplerOrbit(orbit, parent.gravity.gravitationalParameterMu, 0, 0);
    const afterPeriod = propagateKeplerOrbit(orbit, parent.gravity.gravitationalParameterMu, 0, period);

    expect(afterPeriod.positionMeters.x).toBeCloseTo(epoch.positionMeters.x, 3);
    expect(afterPeriod.positionMeters.y).toBeCloseTo(epoch.positionMeters.y, 3);
    expect(afterPeriod.velocityMetersPerSecond.x).toBeCloseTo(epoch.velocityMetersPerSecond.x, 8);
    expect(afterPeriod.velocityMetersPerSecond.y).toBeCloseTo(epoch.velocityMetersPerSecond.y, 8);
  });

  it("places a circular orbit at the quarter-period position with tangent velocity", () => {
    const body = requireCelestialBody(STARTER_CELESTIAL_CATALOG, STARTER_BODY_IDS.hestia);
    const parent = requireCelestialBody(STARTER_CELESTIAL_CATALOG, STARTER_BODY_IDS.aurelia);
    const orbit = body.orbit!;
    const period = orbitalPeriodSeconds(orbit.semiMajorAxisMeters, parent.gravity.gravitationalParameterMu);
    const state = propagateKeplerOrbit(orbit, parent.gravity.gravitationalParameterMu, 0, period / 4);

    expect(state.positionMeters.x).toBeCloseTo(0, 3);
    expect(state.positionMeters.y).toBeCloseTo(orbit.semiMajorAxisMeters, 3);
    expect(state.velocityMetersPerSecond.x).toBeLessThan(0);
    expect(state.velocityMetersPerSecond.y).toBeCloseTo(0, 8);
  });

  it("fails closed for invalid inputs and explicit non-convergence", () => {
    expectCelestialError(() => solveEllipticKepler(0, 1), "InvalidOrbit");
    expectCelestialError(() => solveEllipticKepler(Number.NaN, 0), "InvalidNumber");
    expectCelestialError(
      () => solveEllipticKepler(1, 0.99, { toleranceRadians: Number.MIN_VALUE, maxIterations: 1 }),
      "KeplerConvergenceFailure"
    );
  });
});

describe("catalog ephemeris", () => {
  it("composes moon absolute position and velocity from the parent-relative state", () => {
    const ephemeris = computeCatalogEphemeris(STARTER_CELESTIAL_CATALOG, {
      epochSeconds: 0,
      requestedTimeSeconds: 12_345
    });
    const parent = ephemeris.stateByBodyId[STARTER_BODY_IDS.hestia];
    const moon = ephemeris.stateByBodyId[STARTER_BODY_IDS.luma];

    const composedPosition = sub(moon.absoluteState.positionMeters, parent.absoluteState.positionMeters);
    const composedVelocity = sub(moon.absoluteState.velocityMetersPerSecond, parent.absoluteState.velocityMetersPerSecond);
    expect(composedPosition.x).toBeCloseTo(moon.parentRelativeState!.positionMeters.x, 5);
    expect(composedPosition.y).toBeCloseTo(moon.parentRelativeState!.positionMeters.y, 5);
    expect(composedPosition.z).toBeCloseTo(moon.parentRelativeState!.positionMeters.z, 5);
    expect(composedVelocity.x).toBeCloseTo(moon.parentRelativeState!.velocityMetersPerSecond.x, 10);
    expect(composedVelocity.y).toBeCloseTo(moon.parentRelativeState!.velocityMetersPerSecond.y, 10);
    expect(composedVelocity.z).toBeCloseTo(moon.parentRelativeState!.velocityMetersPerSecond.z, 10);
    expect(moon.parentRelativeState?.frame.referenceBodyId).toBe(STARTER_BODY_IDS.hestia);
    expect(moon.absoluteState.frame.referenceBodyId).toBe(STARTER_BODY_IDS.aurelia);
  });

  it("is byte-deterministic for repeated explicit time inputs", () => {
    const input = { epochSeconds: 1_000, requestedTimeSeconds: 987_654 };
    const first = computeCatalogEphemeris(STARTER_CELESTIAL_CATALOG, input);
    const second = computeCatalogEphemeris(STARTER_CELESTIAL_CATALOG, input);

    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(first.signature).toBe(second.signature);
    expect(first.states.map((state) => state.bodyId)).toEqual(STARTER_CELESTIAL_CATALOG.bodies.map((body) => body.bodyId));
  });

  it("keeps floating-origin translation external to orbital truth", () => {
    const ephemeris = computeCatalogEphemeris(STARTER_CELESTIAL_CATALOG, {
      epochSeconds: 0,
      requestedTimeSeconds: 42_000
    });
    const parent = ephemeris.stateByBodyId[STARTER_BODY_IDS.hestia];
    const moon = ephemeris.stateByBodyId[STARTER_BODY_IDS.luma];
    const floatingOrigin = { x: 1e12, y: -2e12, z: 3e12 };
    const rebasedParent = sub(parent.absoluteState.positionMeters, floatingOrigin);
    const rebasedMoon = sub(moon.absoluteState.positionMeters, floatingOrigin);

    expect(sub(rebasedMoon, rebasedParent).x).toBeCloseTo(moon.parentRelativeState!.positionMeters.x, 3);
    expect(sub(rebasedMoon, rebasedParent).y).toBeCloseTo(moon.parentRelativeState!.positionMeters.y, 3);
    expect(ephemeris.stateByBodyId[STARTER_BODY_IDS.aurelia].absoluteState.positionMeters).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("returns deeply immutable finite state", () => {
    const ephemeris = computeCatalogEphemeris(STARTER_CELESTIAL_CATALOG, {
      epochSeconds: 0,
      requestedTimeSeconds: 1
    });
    const values = ephemeris.states.flatMap((state) => [
      state.absoluteState.positionMeters.x,
      state.absoluteState.positionMeters.y,
      state.absoluteState.positionMeters.z,
      state.absoluteState.velocityMetersPerSecond.x,
      state.absoluteState.velocityMetersPerSecond.y,
      state.absoluteState.velocityMetersPerSecond.z
    ]);

    expect(values.every(Number.isFinite)).toBe(true);
    expect(Object.isFrozen(ephemeris)).toBe(true);
    expect(Object.isFrozen(ephemeris.states)).toBe(true);
    expect(Object.isFrozen(ephemeris.states[0].absoluteState.positionMeters)).toBe(true);
    expect(Object.isFrozen(ephemeris.stateByBodyId)).toBe(true);
  });
});
