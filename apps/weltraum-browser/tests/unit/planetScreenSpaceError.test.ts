import { describe, expect, it } from "vitest";
import { vec3 } from "../../src/core/vector";
import {
  PlanetScreenSpaceError,
  calculatePlanetScreenSpaceError,
  planetGeometricErrorAtLevel,
  type PlanetScreenSpaceErrorInput
} from "../../src/planet";

const baseInput = (): PlanetScreenSpaceErrorInput => ({
  geometricErrorMeters: 10,
  viewportHeightPixels: 1_080,
  verticalFovRadians: Math.PI / 3,
  cameraPosition: vec3(110, 0, 0),
  boundingSphere: { center: vec3(0, 0, 0), radiusMeters: 10 },
  nearClampMeters: 0.1,
  splitThresholdPixels: 1
});

describe("planet screen-space error", () => {
  it("uses conservative sphere distance and the specified perspective formula", () => {
    const result = calculatePlanetScreenSpaceError(baseInput());
    const expectedProjectionScale = 1_080 / (2 * Math.tan(Math.PI / 6));
    expect(result.distanceToBoundMeters).toBe(100);
    expect(result.effectiveDistanceMeters).toBe(100);
    expect(result.projectionScalePixels).toBeCloseTo(expectedProjectionScale, 12);
    expect(result.ssePixels).toBeCloseTo(10 * expectedProjectionScale / 100, 12);
    expect(Object.values(result).filter((value) => typeof value === "number").every(Number.isFinite)).toBe(true);
  });

  it("is monotonic in geometric error, inverse distance, and projection scale", () => {
    const baseline = calculatePlanetScreenSpaceError(baseInput()).ssePixels;
    expect(calculatePlanetScreenSpaceError({ ...baseInput(), geometricErrorMeters: 20 }).ssePixels).toBeGreaterThan(baseline);
    expect(calculatePlanetScreenSpaceError({ ...baseInput(), cameraPosition: vec3(210, 0, 0) }).ssePixels).toBeLessThan(baseline);
    expect(calculatePlanetScreenSpaceError({ ...baseInput(), viewportHeightPixels: 2_160 }).ssePixels).toBeGreaterThan(baseline);
    expect(calculatePlanetScreenSpaceError({ ...baseInput(), verticalFovRadians: Math.PI / 2 }).ssePixels).toBeLessThan(baseline);
  });

  it("does not split at an exact threshold tie and has no hidden state", () => {
    const exact = calculatePlanetScreenSpaceError(baseInput()).ssePixels;
    const tied = calculatePlanetScreenSpaceError({ ...baseInput(), splitThresholdPixels: exact });
    expect(tied.shouldSplit).toBe(false);
    expect(tied.reason).toBe("at-or-below-split-threshold");

    const exceeded = calculatePlanetScreenSpaceError({ ...baseInput(), splitThresholdPixels: exact - 1e-9 });
    expect(exceeded.shouldSplit).toBe(true);
    expect(exceeded.reason).toBe("split-threshold-exceeded");
    expect(calculatePlanetScreenSpaceError({ ...baseInput(), splitThresholdPixels: exact })).toEqual(tied);
  });

  it("clamps inside-bound distance and halves the default geometric error per level", () => {
    const result = calculatePlanetScreenSpaceError({
      ...baseInput(),
      cameraPosition: vec3(0, 0, 0),
      nearClampMeters: 2
    });
    expect(result.distanceToBoundMeters).toBe(0);
    expect(result.effectiveDistanceMeters).toBe(2);
    expect(planetGeometricErrorAtLevel(1_024, 0)).toBe(1_024);
    expect(planetGeometricErrorAtLevel(1_024, 10)).toBe(1);
  });

  it("rejects invalid public inputs and non-finite derived output", () => {
    const invalid = [
      { ...baseInput(), geometricErrorMeters: -1 },
      { ...baseInput(), viewportHeightPixels: 0 },
      { ...baseInput(), verticalFovRadians: Math.PI },
      { ...baseInput(), cameraPosition: vec3(Number.NaN, 0, 0) },
      { ...baseInput(), nearClampMeters: 0 },
      { ...baseInput(), splitThresholdPixels: Number.POSITIVE_INFINITY }
    ];
    for (const input of invalid) {
      expect(() => calculatePlanetScreenSpaceError(input)).toThrowError();
    }
    expect(() => calculatePlanetScreenSpaceError({
      ...baseInput(),
      geometricErrorMeters: Number.MAX_VALUE,
      nearClampMeters: Number.MIN_VALUE,
      cameraPosition: vec3(0, 0, 0)
    })).toThrowError(PlanetScreenSpaceError);
  });
});
