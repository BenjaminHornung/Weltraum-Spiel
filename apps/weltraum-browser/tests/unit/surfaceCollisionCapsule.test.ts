import { describe, expect, it } from "vitest";
import { normalize, type Vec3 } from "../../src/core/vector";
import { resolveSurfaceCapsuleMotion } from "../../src/surface-play/collision";
import {
  createSurfaceCapsuleSweepResult,
  createSurfaceGroundContactResult,
  createSurfaceLineResult,
  createSurfaceRayResult,
  type SurfaceCapsuleSweepQuery,
  type SurfaceCollisionQueryPort,
  type SurfaceGroundContactQuery
} from "../../src/surface-play/contracts";
import { createHestiaAgileGroundedLocomotionPresetV1 } from "../../src/surface-play/player";

interface HeightSample {
  readonly height: number;
  readonly normal: Vec3;
}

const binding = {
  bodyId: "body:hestia",
  regionId: "region:hestia-test",
  surfaceFrameId: "frame:hestia-test",
  regionRevision: 4,
  simulationTick: 1
};

const syntheticHeightfieldPort = (sample: (x: number, z: number) => HeightSample): SurfaceCollisionQueryPort => {
  const ground = (query: SurfaceGroundContactQuery) => {
    const terrain = sample(query.positionMeters.x, query.positionMeters.z);
    const bottom = query.positionMeters.y - query.capsule.heightMeters * 0.5;
    const distanceMeters = bottom - terrain.height;
    return createSurfaceGroundContactResult({
      status: "Resolved",
      queryId: query.queryId,
      contact: distanceMeters <= query.maximumDistanceMeters && distanceMeters >= -1e-6
        ? {
          pointMeters: { x: query.positionMeters.x, y: terrain.height, z: query.positionMeters.z },
          normal: terrain.normal,
          distanceMeters: Math.max(0, distanceMeters),
          colliderId: "terrain:heightfield"
        }
        : null
    });
  };

  const sweep = (query: SurfaceCapsuleSweepQuery) => {
    const displacement = query.displacementMeters;
    const distance = Math.hypot(displacement.x, displacement.y, displacement.z);
    const steps = Math.max(1, Math.ceil(distance / 0.01));
    let previousT = 0;
    let previousSample = sample(query.startPositionMeters.x, query.startPositionMeters.z);
    let previousClearance = query.startPositionMeters.y - query.capsule.heightMeters * 0.5 - previousSample.height;

    for (let index = 1; index <= steps; index += 1) {
      const t = index / steps;
      const position = {
        x: query.startPositionMeters.x + displacement.x * t,
        y: query.startPositionMeters.y + displacement.y * t,
        z: query.startPositionMeters.z + displacement.z * t
      };
      const terrain = sample(position.x, position.z);
      const clearance = position.y - query.capsule.heightMeters * 0.5 - terrain.height;
      const movingIntoSurface = displacement.x * terrain.normal.x
        + displacement.y * terrain.normal.y
        + displacement.z * terrain.normal.z < -1e-6;
      const crossedSurface = previousClearance > 1e-6 && clearance <= 1e-6;
      const heightBarrier = terrain.height > previousSample.height + 0.05 && clearance <= 1e-6;
      if (crossedSurface || heightBarrier || (clearance <= 1e-6 && movingIntoSurface)) {
        let low = previousT;
        let high = t;
        for (let iteration = 0; iteration < 20; iteration += 1) {
          const middle = (low + high) * 0.5;
          const middlePosition = {
            x: query.startPositionMeters.x + displacement.x * middle,
            y: query.startPositionMeters.y + displacement.y * middle,
            z: query.startPositionMeters.z + displacement.z * middle
          };
          const middleTerrain = sample(middlePosition.x, middlePosition.z);
          const middleClearance = middlePosition.y - query.capsule.heightMeters * 0.5 - middleTerrain.height;
          if (middleClearance > 0) low = middle;
          else high = middle;
        }
        const fraction = previousClearance <= 0 ? 0 : high;
        const hitPosition = {
          x: query.startPositionMeters.x + displacement.x * fraction,
          y: query.startPositionMeters.y + displacement.y * fraction,
          z: query.startPositionMeters.z + displacement.z * fraction
        };
        const heightChangedAbruptly = Math.abs(terrain.height - previousSample.height) > 0.05;
        const normal = heightChangedAbruptly && Math.abs(displacement.x) > 1e-9
          ? { x: -Math.sign(displacement.x), y: 0, z: 0 }
          : terrain.normal;
        return createSurfaceCapsuleSweepResult({
          status: "Resolved",
          queryId: query.queryId,
          fraction,
          contact: {
            pointMeters: {
              x: hitPosition.x,
              y: sample(hitPosition.x, hitPosition.z).height,
              z: hitPosition.z
            },
            normal,
            distanceMeters: distance * fraction,
            colliderId: "terrain:heightfield"
          }
        });
      }
      previousT = t;
      previousSample = terrain;
      previousClearance = clearance;
    }
    return createSurfaceCapsuleSweepResult({
      status: "Resolved",
      queryId: query.queryId,
      fraction: 1,
      contact: null
    });
  };

  return {
    queryGroundContact: ground,
    sweepCapsule: sweep,
    queryRay: (query) => createSurfaceRayResult({ status: "Resolved", queryId: query.queryId, contact: null }),
    queryLine: (query) => createSurfaceLineResult({ status: "Resolved", queryId: query.queryId, contact: null })
  };
};

const request = (
  positionMeters: Vec3,
  velocityMetersPerSecond: Vec3,
  displacementMeters: Vec3,
  wasGrounded = true
) => ({
  binding,
  queryIdPrefix: "collision:test",
  capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
  positionMeters,
  velocityMetersPerSecond,
  displacementMeters,
  wasGrounded
});

describe("surface capsule collision resolution", () => {
  const config = createHestiaAgileGroundedLocomotionPresetV1();

  it("walks a supported ramp and rejects a ramp above the slope limit as ground", () => {
    const walkableSlope = Math.tan(40 * Math.PI / 180);
    const steepSlope = Math.tan(60 * Math.PI / 180);
    const walkable = syntheticHeightfieldPort((x) => ({
      height: Math.max(0, x * walkableSlope),
      normal: x > 0 ? normalize({ x: -walkableSlope, y: 1, z: 0 }) : { x: 0, y: 1, z: 0 }
    }));
    const steep = syntheticHeightfieldPort((x) => ({
      height: Math.max(0, x * steepSlope),
      normal: x > 0 ? normalize({ x: -steepSlope, y: 1, z: 0 }) : { x: 0, y: 1, z: 0 }
    }));

    const walkableResult = resolveSurfaceCapsuleMotion(
      walkable,
      request({ x: 0, y: 0.9, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0.5, y: 0, z: 0 }),
      config
    );
    const steepResult = resolveSurfaceCapsuleMotion(
      steep,
      request(
        { x: 0.1, y: 0.9 + 0.1 * steepSlope, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 0.5, y: 0, z: 0 }
      ),
      config
    );

    expect(walkableResult.status).toBe("Resolved");
    if (walkableResult.status === "Resolved") {
      expect(walkableResult.positionMeters.x).toBeGreaterThan(0.2);
      expect(walkableResult.positionMeters.y).toBeGreaterThan(0.9);
      expect(walkableResult.grounded).toBe(true);
    }
    expect(steepResult.status).toBe("Resolved");
    if (steepResult.status === "Resolved") {
      expect(steepResult.positionMeters.x).toBeLessThan(0.2);
      expect(steepResult.grounded).toBe(false);
    }
  });

  it("steps continuously over a low ledge and blocks a ledge above step height", () => {
    const lowStep = syntheticHeightfieldPort((x) => ({
      height: x >= 0.2 ? 0.3 : 0,
      normal: { x: 0, y: 1, z: 0 }
    }));
    const highStep = syntheticHeightfieldPort((x) => ({
      height: x >= 0.2 ? 0.5 : 0,
      normal: { x: 0, y: 1, z: 0 }
    }));

    const low = resolveSurfaceCapsuleMotion(
      lowStep,
      request({ x: 0, y: 0.9, z: 0 }, { x: 3, y: 0, z: 0 }, { x: 0.5, y: 0, z: 0 }),
      config
    );
    const high = resolveSurfaceCapsuleMotion(
      highStep,
      request({ x: 0, y: 0.9, z: 0 }, { x: 3, y: 0, z: 0 }, { x: 0.5, y: 0, z: 0 }),
      config
    );

    expect(low.status).toBe("Resolved");
    if (low.status === "Resolved") {
      expect(low.positionMeters.x).toBeCloseTo(0.5, 2);
      expect(low.positionMeters.y).toBeGreaterThan(1.15);
      expect(low.grounded).toBe(true);
    }
    expect(high.status).toBe("Resolved");
    if (high.status === "Resolved") expect(high.positionMeters.x).toBeLessThan(0.2);
  });

  it("uses the full high-speed sweep and preserves tangential velocity at a wall", () => {
    const wall = syntheticHeightfieldPort((x) => ({
      height: x >= 1 ? 100 : 0,
      normal: { x: 0, y: 1, z: 0 }
    }));

    const result = resolveSurfaceCapsuleMotion(
      wall,
      request({ x: 0, y: 0.9, z: 0 }, { x: 120, y: 0, z: 6 }, { x: 2, y: 0, z: 0.1 }),
      config
    );

    expect(result.status).toBe("Resolved");
    if (result.status === "Resolved") {
      expect(result.positionMeters.x).toBeLessThan(1);
      expect(result.velocityMetersPerSecond.x).toBe(0);
      expect(result.velocityMetersPerSecond.z).toBe(6);
      expect(Math.hypot(
        result.velocityMetersPerSecond.x,
        result.velocityMetersPerSecond.y,
        result.velocityMetersPerSecond.z
      )).toBeGreaterThan(0);
    }
  });

  it("does not fall through a floor during a high-speed downward step", () => {
    const floor = syntheticHeightfieldPort(() => ({ height: 0, normal: { x: 0, y: 1, z: 0 } }));
    const result = resolveSurfaceCapsuleMotion(
      floor,
      request({ x: 0, y: 10, z: 0 }, { x: 0, y: -200, z: 0 }, { x: 0, y: -20, z: 0 }, false),
      config
    );

    expect(result.status).toBe("Resolved");
    if (result.status === "Resolved") {
      expect(result.positionMeters.y).toBeGreaterThanOrEqual(0.9);
      expect(result.positionMeters.y).toBeLessThan(1);
      expect(result.velocityMetersPerSecond.y).toBe(0);
      expect(result.grounded).toBe(true);
    }
  });
});
