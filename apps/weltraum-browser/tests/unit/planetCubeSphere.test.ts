import { describe, expect, it } from "vitest";
import { cross, dot, sub, vec3, type Vec3 } from "../../src/core/vector";
import {
  PLANET_FACES,
  directionToPlanetFaceUv,
  getPlanetFaceBasis,
  planetFaceBasisHasOutwardWinding,
  planetFaceUvToDirection,
  PlanetTopologyError,
  type PlanetFace
} from "../../src/planet";

const expectDirectionClose = (actual: Vec3, expected: Vec3): void => {
  expect(actual.x).toBeCloseTo(expected.x, 12);
  expect(actual.y).toBeCloseTo(expected.y, 12);
  expect(actual.z).toBeCloseTo(expected.z, 12);
};

describe("canonical cube-sphere transforms", () => {
  it("uses the fixed face order and right-handed outward bases", () => {
    expect(PLANET_FACES).toEqual(["+X", "-X", "+Y", "-Y", "+Z", "-Z"]);
    const expected = {
      "+X": [vec3(1, 0, 0), vec3(0, 0, -1), vec3(0, 1, 0)],
      "-X": [vec3(-1, 0, 0), vec3(0, 0, 1), vec3(0, 1, 0)],
      "+Y": [vec3(0, 1, 0), vec3(1, 0, 0), vec3(0, 0, -1)],
      "-Y": [vec3(0, -1, 0), vec3(1, 0, 0), vec3(0, 0, 1)],
      "+Z": [vec3(0, 0, 1), vec3(1, 0, 0), vec3(0, 1, 0)],
      "-Z": [vec3(0, 0, -1), vec3(-1, 0, 0), vec3(0, 1, 0)]
    } satisfies Record<PlanetFace, readonly [Vec3, Vec3, Vec3]>;

    for (const face of PLANET_FACES) {
      const basis = getPlanetFaceBasis(face);
      expect([basis.normal, basis.uAxis, basis.vAxis]).toEqual(expected[face]);
      expectDirectionClose(cross(basis.uAxis, basis.vAxis), basis.normal);
      expect(planetFaceBasisHasOutwardWinding(face)).toBe(true);
    }
  });

  it("round-trips every face center and deterministic interior sample", () => {
    for (const face of PLANET_FACES) {
      for (const [u, v] of [[0.5, 0.5], [0.125, 0.25], [0.8, 0.7]] as const) {
        const direction = planetFaceUvToDirection({ face, u, v });
        const roundTrip = directionToPlanetFaceUv(direction);
        expect(roundTrip.face).toBe(face);
        expect(roundTrip.u).toBeCloseTo(u, 12);
        expect(roundTrip.v).toBeCloseTo(v, 12);
      }
    }
  });

  it("canonically round-trips all face edges and corners without changing direction", () => {
    for (const face of PLANET_FACES) {
      for (const u of [0, 0.5, 1]) {
        for (const v of [0, 0.5, 1]) {
          if (u === 0.5 && v === 0.5) continue;
          const direction = planetFaceUvToDirection({ face, u, v });
          const canonical = directionToPlanetFaceUv(direction);
          expectDirectionClose(planetFaceUvToDirection(canonical), direction);
          expect([canonical.u, canonical.v].every(Number.isFinite)).toBe(true);
        }
      }
    }
  });

  it("breaks equal dominant component ties by X, then Y, then Z, before sign", () => {
    expect(directionToPlanetFaceUv(vec3(1, 1, 1)).face).toBe("+X");
    expect(directionToPlanetFaceUv(vec3(-1, 1, 1)).face).toBe("-X");
    expect(directionToPlanetFaceUv(vec3(0, 1, 1)).face).toBe("+Y");
    expect(directionToPlanetFaceUv(vec3(0, -1, -1)).face).toBe("-Y");
    expect(directionToPlanetFaceUv(vec3(0, 0, 1)).face).toBe("+Z");
    expect(directionToPlanetFaceUv(vec3(0, 0, -1)).face).toBe("-Z");
  });

  it("keeps local triangle winding outward after sphere projection", () => {
    for (const face of PLANET_FACES) {
      const p00 = planetFaceUvToDirection({ face, u: 0.25, v: 0.25 });
      const p10 = planetFaceUvToDirection({ face, u: 0.75, v: 0.25 });
      const p11 = planetFaceUvToDirection({ face, u: 0.75, v: 0.75 });
      expect(dot(cross(sub(p10, p00), sub(p11, p00)), p00)).toBeGreaterThan(0);
    }
  });

  it("rejects zero, non-finite, unknown-face, and out-of-range UV inputs", () => {
    const invalidDirections = [vec3(), vec3(Number.NaN, 0, 0), vec3(0, Number.POSITIVE_INFINITY, 0)];
    for (const direction of invalidDirections) {
      expect(() => directionToPlanetFaceUv(direction)).toThrowError(PlanetTopologyError);
    }
    expect(() => planetFaceUvToDirection({ face: "+X", u: -0.01, v: 0.5 })).toThrowError(PlanetTopologyError);
    expect(() => planetFaceUvToDirection({ face: "+X", u: 0.5, v: Number.NaN })).toThrowError(PlanetTopologyError);
    expect(() => getPlanetFaceBasis("north" as PlanetFace)).toThrowError(PlanetTopologyError);
  });
});
