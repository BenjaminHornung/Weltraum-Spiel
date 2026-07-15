import { describe, expect, it } from "vitest";
import { vec3 } from "../../src/core/vector";
import {
  PlanetFrustumCullingError,
  cullPlanetBoundingSphereByFrustum,
  type PlanetBoundingSphere,
  type PlanetFrustumPlane
} from "../../src/planet";

const positiveXPlane: PlanetFrustumPlane = { normal: vec3(1, 0, 0), constantMeters: 0 };

describe("conservative planet frustum culling", () => {
  it("retains tangent and intersecting spheres and culls only a fully outside sphere", () => {
    const tangent: PlanetBoundingSphere = { center: vec3(-1, 0, 0), radiusMeters: 1 };
    const intersecting: PlanetBoundingSphere = { center: vec3(-0.5, 0, 0), radiusMeters: 1 };
    const outside: PlanetBoundingSphere = { center: vec3(-1.001, 0, 0), radiusMeters: 1 };

    expect(cullPlanetBoundingSphereByFrustum(tangent, [positiveXPlane], 0)).toMatchObject({
      culled: false,
      reason: "retained-intersecting-or-inside"
    });
    expect(cullPlanetBoundingSphereByFrustum(intersecting, [positiveXPlane], 0).culled).toBe(false);
    expect(cullPlanetBoundingSphereByFrustum(outside, [positiveXPlane], 0)).toEqual({
      culled: true,
      reason: "culled-fully-outside-plane",
      decisivePlaneIndex: 0,
      signedCenterDistanceMeters: -1.001
    });
  });

  it("retains a numerically uncertain outside distance within the declared tolerance", () => {
    const uncertain: PlanetBoundingSphere = { center: vec3(-1.0000005, 0, 0), radiusMeters: 1 };
    expect(cullPlanetBoundingSphereByFrustum(uncertain, [positiveXPlane], 1e-6).culled).toBe(false);
  });

  it("retains a planetary-scale tangent sphere for an accepted near-unit plane normal", () => {
    const acceptedNormalLength = 1.0000000000005;
    const tangent: PlanetBoundingSphere = {
      center: vec3(0, 0, 0),
      radiusMeters: 6_000_000
    };
    const nearUnitPlane: PlanetFrustumPlane = {
      normal: vec3(acceptedNormalLength, 0, 0),
      constantMeters: -6_000_000 * acceptedNormalLength
    };

    expect(cullPlanetBoundingSphereByFrustum(tangent, [nearUnitPlane])).toMatchObject({
      culled: false,
      reason: "retained-intersecting-or-inside",
      decisivePlaneIndex: null,
      signedCenterDistanceMeters: -6_000_000
    });
  });

  it("reports the first decisive plane deterministically", () => {
    const sphere: PlanetBoundingSphere = { center: vec3(-2, -3, 0), radiusMeters: 1 };
    const result = cullPlanetBoundingSphereByFrustum(sphere, [
      positiveXPlane,
      { normal: vec3(0, 1, 0), constantMeters: 0 }
    ]);
    expect(result.decisivePlaneIndex).toBe(0);
    expect(Object.values(result).filter((value) => typeof value === "number").every(Number.isFinite)).toBe(true);
  });

  it("rejects empty, non-normalized, and non-finite plane inputs", () => {
    const sphere: PlanetBoundingSphere = { center: vec3(), radiusMeters: 1 };
    expect(() => cullPlanetBoundingSphereByFrustum(sphere, [])).toThrowError(PlanetFrustumCullingError);
    expect(() => cullPlanetBoundingSphereByFrustum(
      sphere,
      [{ normal: vec3(2, 0, 0), constantMeters: 0 }]
    )).toThrowError(PlanetFrustumCullingError);
    expect(() => cullPlanetBoundingSphereByFrustum(
      sphere,
      [{ normal: vec3(1, 0, 0), constantMeters: Number.NaN }]
    )).toThrowError(PlanetFrustumCullingError);
    expect(() => cullPlanetBoundingSphereByFrustum(sphere, [positiveXPlane], -1)).toThrowError(
      PlanetFrustumCullingError
    );
  });

  it("rejects every malformed plane before a valid earlier plane can decide culling", () => {
    const outside: PlanetBoundingSphere = { center: vec3(-2, 0, 0), radiusMeters: 1 };
    const malformedPlanes: readonly PlanetFrustumPlane[] = [
      { normal: vec3(2, 0, 0), constantMeters: 0 },
      { normal: vec3(1, 0, 0), constantMeters: Number.NaN }
    ];

    for (const malformedPlane of malformedPlanes) {
      expect(() => cullPlanetBoundingSphereByFrustum(
        outside,
        [positiveXPlane, malformedPlane]
      )).toThrowError(PlanetFrustumCullingError);
    }
  });
});
