import { describe, expect, it } from "vitest";
import {
  STARTER_BODY_IDS,
  STARTER_CELESTIAL_CATALOG,
  CelestialError,
  createGravitySource,
  escapeVelocityMetersPerSecond,
  gravitationalAccelerationAt,
  requireCelestialBody,
  selectDominantGravitySource,
  surfaceGravityMetersPerSecondSquared
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

const source = (bodyId: string, x: number, mu = 100, radius = 1) =>
  createGravitySource({
    schemaVersion: 1,
    bodyId,
    absolutePositionMeters: { x, y: 0, z: 0 },
    gravitationalParameterMu: mu,
    physicalRadiusMeters: radius,
    eligible: true
  });

describe("pure local gravity queries", () => {
  it("uses inverse-square magnitude and points toward the source", () => {
    const gravity = gravitationalAccelerationAt(source("body.source", 0), { x: 10, y: 0, z: 0 });

    expect(gravity.distanceMeters).toBe(10);
    expect(gravity.magnitudeMetersPerSecondSquared).toBe(1);
    expect(gravity.accelerationMetersPerSecondSquared).toEqual({ x: -1, y: 0, z: 0 });
  });

  it("uses physical radius and mu, independent of visual scale profiles", () => {
    const hestia = requireCelestialBody(STARTER_CELESTIAL_CATALOG, STARTER_BODY_IDS.hestia);
    const expectedSurfaceGravity = hestia.gravity.gravitationalParameterMu / hestia.radiusMeters ** 2;
    const expectedEscapeVelocity = Math.sqrt(2 * hestia.gravity.gravitationalParameterMu / hestia.radiusMeters);

    expect(surfaceGravityMetersPerSecondSquared(hestia)).toBe(expectedSurfaceGravity);
    expect(escapeVelocityMetersPerSecond(hestia)).toBe(expectedEscapeVelocity);
    expect(hestia.visualScale.renderOnly).toBe(true);
  });

  it("fails closed strictly inside the minimum radius but allows the surface", () => {
    const gravitySource = source("body.source", 0, 100, 2);

    expectCelestialError(
      () => gravitationalAccelerationAt(gravitySource, { x: 1.999, y: 0, z: 0 }),
      "InsideMinimumRadius"
    );
    expect(gravitationalAccelerationAt(gravitySource, { x: 2, y: 0, z: 0 }).magnitudeMetersPerSecondSquared).toBe(25);
  });

  it("selects the strongest eligible source with lexical ID tie-breaking", () => {
    const alpha = source("body.alpha", -10);
    const beta = source("body.beta", 10);
    const stronger = source("body.stronger", 20, 1_000);

    expect(selectDominantGravitySource([beta, alpha], { x: 0, y: 0, z: 0 }).source.bodyId).toBe("body.alpha");
    expect(selectDominantGravitySource([alpha, stronger], { x: 0, y: 0, z: 0 }).source.bodyId).toBe("body.stronger");
  });

  it("rejects invalid sources and produces deeply immutable finite output", () => {
    expectCelestialError(
      () =>
        createGravitySource({
          schemaVersion: 1,
          bodyId: "body.invalid",
          absolutePositionMeters: { x: 0, y: Number.NaN, z: 0 },
          gravitationalParameterMu: 1,
          physicalRadiusMeters: 1,
          eligible: true
        }),
      "InvalidNumber"
    );
    expectCelestialError(() => selectDominantGravitySource([], { x: 0, y: 0, z: 0 }), "NoGravitySource");

    const gravity = gravitationalAccelerationAt(source("body.source", 0), { x: 10, y: 5, z: -2 });
    expect(Object.isFrozen(gravity)).toBe(true);
    expect(Object.isFrozen(gravity.accelerationMetersPerSecondSquared)).toBe(true);
    expect(Object.values(gravity.accelerationMetersPerSecondSquared).every(Number.isFinite)).toBe(true);
  });
});
