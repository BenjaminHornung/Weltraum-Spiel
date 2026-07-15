import { describe, expect, it } from "vitest";
import { planetFaceUvToDirection, planetTileFaceUvBounds } from "../../src/planet";
import {
  PLANET_FACES,
  PlanetTileBoundsError,
  createPlanetTileBounds,
  type PlanetTileKey
} from "../../src/planet";

const pointAtRadius = (direction: { readonly x: number; readonly y: number; readonly z: number }, radius: number) => ({
  x: direction.x * radius,
  y: direction.y * radius,
  z: direction.z * radius
});

const distance = (
  left: { readonly x: number; readonly y: number; readonly z: number },
  right: { readonly x: number; readonly y: number; readonly z: number }
): number => Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);

describe("conservative planet tile bounds", () => {
  it("contains corner, edge, and deterministic interior shell samples at both radial extrema", () => {
    for (const face of PLANET_FACES) {
      const key: PlanetTileKey = { bodyId: "planet.hestia", face, level: 3, x: 2, y: 5 };
      const bounds = createPlanetTileBounds({
        key,
        bodyRadiusMeters: 6_000_000,
        minHeightMeters: -250,
        maxHeightMeters: 3_500
      });
      const uv = planetTileFaceUvBounds(key);

      for (const uFactor of [0, 0.25, 0.5, 0.75, 1]) {
        for (const vFactor of [0, 0.25, 0.5, 0.75, 1]) {
          const direction = planetFaceUvToDirection({
            face,
            u: uv.minU + (uv.maxU - uv.minU) * uFactor,
            v: uv.minV + (uv.maxV - uv.minV) * vFactor
          });
          for (const radius of [bounds.minRadiusMeters, bounds.maxRadiusMeters]) {
            const point = pointAtRadius(direction, radius);
            expect(distance(point, bounds.boundingSphere.center)).toBeLessThanOrEqual(bounds.boundingSphere.radiusMeters);
          }
        }
      }

      expect(Object.values(bounds.capAxis).every(Number.isFinite)).toBe(true);
      expect(Object.values(bounds.boundingSphere.center).every(Number.isFinite)).toBe(true);
      expect([
        bounds.angularExtentRadians,
        bounds.minRadiusMeters,
        bounds.maxRadiusMeters,
        bounds.boundingSphere.radiusMeters
      ].every(Number.isFinite)).toBe(true);
    }
  });

  it("contains every level-27 corner at both exact radial extrema", () => {
    const key: PlanetTileKey = {
      bodyId: "planet.hestia",
      face: "+X",
      level: 27,
      x: 67_108_864,
      y: 67_108_864
    };
    const bounds = createPlanetTileBounds({
      key,
      bodyRadiusMeters: 6_000_000,
      minHeightMeters: 0,
      maxHeightMeters: 0.01
    });
    const uv = planetTileFaceUvBounds(key);

    for (const [u, v] of [
      [uv.minU, uv.minV],
      [uv.maxU, uv.minV],
      [uv.minU, uv.maxV],
      [uv.maxU, uv.maxV]
    ] as const) {
      const direction = planetFaceUvToDirection({ face: key.face, u, v });
      for (const radius of [bounds.minRadiusMeters, bounds.maxRadiusMeters]) {
        const point = pointAtRadius(direction, radius);
        expect(distance(point, bounds.boundingSphere.center)).toBeLessThanOrEqual(
          bounds.boundingSphere.radiusMeters
        );
      }
    }
  });

  it("is deterministic and remains in unscaled body-relative metres", () => {
    const input = {
      key: { bodyId: "planet.hestia", face: "+X", level: 0, x: 0, y: 0 } as const,
      bodyRadiusMeters: 6_000_000,
      minHeightMeters: 0,
      maxHeightMeters: 2_000
    };
    const first = createPlanetTileBounds(input);
    const second = createPlanetTileBounds(input);
    expect(second).toEqual(first);
    expect(first.minRadiusMeters).toBe(6_000_000);
    expect(first.maxRadiusMeters).toBe(6_002_000);
    expect(Math.hypot(
      first.boundingSphere.center.x,
      first.boundingSphere.center.y,
      first.boundingSphere.center.z
    )).toBeCloseTo(6_001_000, 6);
  });

  it("rejects invalid radii and height ranges instead of producing NaN", () => {
    const key = { bodyId: "planet.hestia", face: "+X", level: 0, x: 0, y: 0 } as const;
    const invalidInputs = [
      { key, bodyRadiusMeters: 0, minHeightMeters: 0, maxHeightMeters: 1 },
      { key, bodyRadiusMeters: Number.NaN, minHeightMeters: 0, maxHeightMeters: 1 },
      { key, bodyRadiusMeters: 100, minHeightMeters: 2, maxHeightMeters: 1 },
      { key, bodyRadiusMeters: 100, minHeightMeters: -100, maxHeightMeters: 1 },
      { key, bodyRadiusMeters: 100, minHeightMeters: 0, maxHeightMeters: Number.POSITIVE_INFINITY }
    ];
    for (const input of invalidInputs) {
      expect(() => createPlanetTileBounds(input)).toThrowError(PlanetTileBoundsError);
    }
  });
});
