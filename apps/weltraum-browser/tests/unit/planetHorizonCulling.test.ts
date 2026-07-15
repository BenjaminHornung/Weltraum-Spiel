import { describe, expect, it } from "vitest";
import { vec3 } from "../../src/core/vector";
import {
  PLANET_HORIZON_DEFAULT_TOLERANCE_RADIANS,
  PlanetHorizonCullingError,
  cullPlanetTileCapByHorizon,
  type PlanetHorizonCullingInput,
  type PlanetHorizonTileCap
} from "../../src/planet";

const axisAtAngle = (angleRadians: number) => vec3(Math.cos(angleRadians), Math.sin(angleRadians), 0);
const degreesToRadians = (degrees: number) => degrees * Math.PI / 180;

// Independently calculated as acos(1000 / 2000) + acos(1000 / 1100).
const OUTER_RADIUS_TANGENT_THRESHOLD_RADIANS = 1.4768972173480224;

const cap = (axis = vec3(1, 0, 0), angularExtentRadians = 0.01, maxRadiusMeters = 1_100): PlanetHorizonTileCap => ({
  capAxis: axis,
  angularExtentRadians,
  maxRadiusMeters
});

const input = (
  cameraDistanceMeters: number,
  tileCap: PlanetHorizonTileCap = cap()
): PlanetHorizonCullingInput => ({
  cameraPosition: vec3(cameraDistanceMeters, 0, 0),
  bodyRadiusMeters: 1_000,
  conservativeHeightMarginMeters: 100,
  tileCap
});

const closestDistanceFromOriginToSegment = (
  start: PlanetHorizonCullingInput["cameraPosition"],
  end: PlanetHorizonCullingInput["cameraPosition"]
): number => {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentZ = end.z - start.z;
  const segmentLengthSquared =
    segmentX * segmentX + segmentY * segmentY + segmentZ * segmentZ;
  const closestParameter = Math.min(1, Math.max(0, -(
    start.x * segmentX + start.y * segmentY + start.z * segmentZ
  ) / segmentLengthSquared));

  return Math.hypot(
    start.x + segmentX * closestParameter,
    start.y + segmentY * closestParameter,
    start.z + segmentZ * closestParameter
  );
};

const nearSurfaceTangentFixture = (axisLength = 1) => {
  const bodyRadiusMeters = 6_000_000;
  const cameraAndTileRadiusMeters = 6_000_001;
  const tangentLegMeters = Math.sqrt(
    (cameraAndTileRadiusMeters - bodyRadiusMeters) *
    (cameraAndTileRadiusMeters + bodyRadiusMeters)
  );
  const tangentAngleRadians = 2 * Math.asin(tangentLegMeters / cameraAndTileRadiusMeters);
  const normalizedAxis = axisAtAngle(tangentAngleRadians);
  const capAxis = vec3(
    normalizedAxis.x * axisLength,
    normalizedAxis.y * axisLength,
    normalizedAxis.z * axisLength
  );
  const cameraPosition = vec3(cameraAndTileRadiusMeters, 0, 0);
  const tilePosition = vec3(
    normalizedAxis.x * cameraAndTileRadiusMeters,
    normalizedAxis.y * cameraAndTileRadiusMeters,
    normalizedAxis.z * cameraAndTileRadiusMeters
  );

  return {
    bodyRadiusMeters,
    cameraAndTileRadiusMeters,
    tangentAngleRadians,
    cameraPosition,
    tilePosition,
    input: {
      cameraPosition,
      bodyRadiusMeters,
      conservativeHeightMarginMeters: 1,
      tileCap: cap(capAxis, 0, cameraAndTileRadiusMeters)
    } satisfies PlanetHorizonCullingInput
  };
};

describe("conservative planet horizon culling", () => {
  it("retains surface, near-orbit, and far-orbit front caps", () => {
    const surface = cullPlanetTileCapByHorizon(input(1_000));
    expect(surface).toMatchObject({ culled: false, reason: "indeterminate-camera-inside-body" });

    for (const distance of [1_200, 10_000]) {
      const result = cullPlanetTileCapByHorizon(input(distance));
      expect(result).toMatchObject({ culled: false, reason: "retained-front-visible" });
      expect(Object.values(result).filter((value) => typeof value === "number").every(Number.isFinite)).toBe(true);
    }
  });

  it("culls only a cap proven completely behind the horizon", () => {
    for (const distance of [1_200, 2_000, 10_000]) {
      const result = cullPlanetTileCapByHorizon(input(distance, cap(vec3(-1, 0, 0))));
      expect(result).toMatchObject({ culled: true, reason: "culled-proven-behind-horizon" });
      expect(result.nearestTileAngleRadians).toBeGreaterThan(result.horizonAngleRadians);
    }
  });

  it("retains a possible-envelope cap at 58 degrees when its line of sight clears the physical sphere", () => {
    const result = cullPlanetTileCapByHorizon(input(
      2_000,
      cap(axisAtAngle(degreesToRadians(58)), 0, 1_100)
    ));

    expect(result).toMatchObject({
      culled: false,
      reason: "retained-front-visible",
      occluderRadiusMeters: 1_000
    });
    expect(result.horizonAngleRadians).toBeCloseTo(OUTER_RADIUS_TANGENT_THRESHOLD_RADIANS, 14);
  });

  it("culls the same possible-envelope cap at a clearly behind angle", () => {
    const result = cullPlanetTileCapByHorizon(input(
      2_000,
      cap(axisAtAngle(degreesToRadians(100)), 0, 1_100)
    ));

    expect(result).toMatchObject({ culled: true, reason: "culled-proven-behind-horizon" });
    expect(result.nearestTileAngleRadians).toBeGreaterThan(result.horizonAngleRadians);
  });

  it("retains the independently calculated outer-radius tangent and culls only just beyond tolerance", () => {
    const tolerance = 1e-8;

    const exact = cullPlanetTileCapByHorizon({
      ...input(2_000, cap(axisAtAngle(OUTER_RADIUS_TANGENT_THRESHOLD_RADIANS), 0, 1_100)),
      angularToleranceRadians: tolerance
    });
    expect(exact).toMatchObject({ culled: false, reason: "retained-horizon-tangent-or-uncertain" });
    expect(exact.horizonAngleRadians).toBeCloseTo(OUTER_RADIUS_TANGENT_THRESHOLD_RADIANS, 14);

    const towardTangency = cullPlanetTileCapByHorizon({
      ...input(2_000, cap(axisAtAngle(OUTER_RADIUS_TANGENT_THRESHOLD_RADIANS - tolerance * 2), 0, 1_100)),
      angularToleranceRadians: tolerance
    });
    expect(towardTangency).toMatchObject({
      culled: false,
      reason: "retained-front-visible"
    });

    const provenBehind = cullPlanetTileCapByHorizon({
      ...input(2_000, cap(axisAtAngle(OUTER_RADIUS_TANGENT_THRESHOLD_RADIANS + tolerance * 2), 0, 1_100)),
      angularToleranceRadians: tolerance
    });
    expect(provenBehind).toMatchObject({ culled: true, reason: "culled-proven-behind-horizon" });
  });

  it("retains the planetary near-surface tangent when the accepted cap axis has near-unit norm drift", () => {
    const fixture = nearSurfaceTangentFixture(0.9999999999995);
    const oracleDistanceMeters = closestDistanceFromOriginToSegment(
      fixture.cameraPosition,
      fixture.tilePosition
    );

    expect(Math.abs(oracleDistanceMeters - fixture.bodyRadiusMeters)).toBeLessThanOrEqual(1e-6);
    expect(cullPlanetTileCapByHorizon(fixture.input)).toMatchObject({
      culled: false,
      reason: "retained-horizon-tangent-or-uncertain"
    });
  });

  it("retains a normalized planetary near-surface tangent but culls a robustly proven-behind counterpart", () => {
    const tangentFixture = nearSurfaceTangentFixture();
    const tangentOracleDistanceMeters = closestDistanceFromOriginToSegment(
      tangentFixture.cameraPosition,
      tangentFixture.tilePosition
    );
    expect(Math.abs(tangentOracleDistanceMeters - tangentFixture.bodyRadiusMeters)).toBeLessThanOrEqual(1e-6);
    expect(cullPlanetTileCapByHorizon(tangentFixture.input)).toMatchObject({
      culled: false,
      reason: "retained-horizon-tangent-or-uncertain"
    });

    const provenBehindAngleRadians = tangentFixture.tangentAngleRadians +
      PLANET_HORIZON_DEFAULT_TOLERANCE_RADIANS * 4;
    const provenBehindAxis = axisAtAngle(provenBehindAngleRadians);
    const provenBehindPosition = vec3(
      provenBehindAxis.x * tangentFixture.cameraAndTileRadiusMeters,
      provenBehindAxis.y * tangentFixture.cameraAndTileRadiusMeters,
      0
    );
    const provenBehindOracleDistanceMeters = closestDistanceFromOriginToSegment(
      tangentFixture.cameraPosition,
      provenBehindPosition
    );
    expect(
      tangentFixture.bodyRadiusMeters - provenBehindOracleDistanceMeters
    ).toBeGreaterThan(5e-7);

    expect(cullPlanetTileCapByHorizon({
      ...tangentFixture.input,
      tileCap: cap(
        provenBehindAxis,
        0,
        tangentFixture.cameraAndTileRadiusMeters
      )
    })).toMatchObject({
      culled: true,
      reason: "culled-proven-behind-horizon"
    });
  });

  it("retains high-relief tiles when the declared height margin cannot enclose them", () => {
    const result = cullPlanetTileCapByHorizon(input(2_000, cap(vec3(-1, 0, 0), 0.01, 1_101)));
    expect(result).toMatchObject({
      culled: false,
      reason: "indeterminate-insufficient-height-margin",
      occluderRadiusMeters: 1_000
    });
  });

  it("retains cameras inside or exactly on the physical body", () => {
    for (const distance of [0, 1_000]) {
      expect(cullPlanetTileCapByHorizon(input(distance, cap(vec3(-1, 0, 0))))).toMatchObject({
        culled: false,
        reason: "indeterminate-camera-inside-body"
      });
    }
  });

  it("does not classify a camera between the physical body and possible envelope as inside-body", () => {
    expect(cullPlanetTileCapByHorizon(input(1_050))).toMatchObject({
      culled: false,
      reason: "retained-front-visible",
      occluderRadiusMeters: 1_000
    });
  });

  it("rejects invalid radii, camera values, cap values, and tolerances", () => {
    expect(() => cullPlanetTileCapByHorizon({ ...input(2_000), bodyRadiusMeters: 0 })).toThrowError(
      PlanetHorizonCullingError
    );
    expect(() => cullPlanetTileCapByHorizon({
      ...input(2_000),
      cameraPosition: vec3(Number.NaN, 0, 0)
    })).toThrowError(PlanetHorizonCullingError);
    expect(() => cullPlanetTileCapByHorizon(input(2_000, cap(vec3(2, 0, 0))))).toThrowError(
      PlanetHorizonCullingError
    );
    expect(() => cullPlanetTileCapByHorizon({
      ...input(2_000),
      angularToleranceRadians: -1
    })).toThrowError(PlanetHorizonCullingError);
  });
});
