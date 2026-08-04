import { describe, expect, it } from "vitest";
import { normalize } from "../../src/core/vector";
import {
  createSurfaceCapsuleSweepResult,
  createSurfaceGroundContactResult,
  createSurfaceLineResult,
  createSurfacePlayerCommand,
  createSurfaceRayResult,
  type SurfaceCapsuleSweepQuery,
  type SurfaceCollisionQueryPort,
  type SurfaceGroundContactQuery
} from "../../src/surface-play/contracts";
import {
  applySurfaceFixedStepCapsuleSeparation,
  createHestiaAgileGroundedLocomotionPresetV1,
  createSurfaceFixedStepRuntime,
  createSurfaceLocomotionState,
  stepSurfaceLocomotion,
  type SurfaceLocomotionState
} from "../../src/surface-play/player";

const config = createHestiaAgileGroundedLocomotionPresetV1();
const context = Object.freeze({
  bodyId: "body:hestia",
  regionId: "region:hestia-test",
  surfaceFrameId: "frame:hestia-test",
  regionRevision: 4
});

const planePort = (slopeRadians: number): SurfaceCollisionQueryPort => {
  const slope = Math.tan(slopeRadians);
  const normal = normalize({ x: -slope, y: 1, z: 0 });
  const heightAt = (x: number) => slope * x;
  const groundContact = (x: number, z: number, distanceMeters: number) => ({
    pointMeters: { x, y: heightAt(x), z },
    normal,
    distanceMeters,
    colliderId: "terrain:plane"
  });

  return {
    queryGroundContact(query: SurfaceGroundContactQuery) {
      const bottom = query.positionMeters.y - query.capsule.heightMeters / 2;
      const clearance = bottom - heightAt(query.positionMeters.x);
      return createSurfaceGroundContactResult({
        status: "Resolved",
        queryId: query.queryId,
        contact: clearance >= -1e-7 && clearance <= query.maximumDistanceMeters
          ? groundContact(query.positionMeters.x, query.positionMeters.z, Math.max(0, clearance))
          : null
      });
    },
    sweepCapsule(query: SurfaceCapsuleSweepQuery) {
      const startBottom = query.startPositionMeters.y - query.capsule.heightMeters / 2;
      const startClearance = startBottom - heightAt(query.startPositionMeters.x);
      const endX = query.startPositionMeters.x + query.displacementMeters.x;
      const endBottom = startBottom + query.displacementMeters.y;
      const endClearance = endBottom - heightAt(endX);
      const intoSurface = query.displacementMeters.x * normal.x
        + query.displacementMeters.y * normal.y
        + query.displacementMeters.z * normal.z < -1e-9;
      if (!intoSurface || endClearance > 0) {
        return createSurfaceCapsuleSweepResult({
          status: "Resolved",
          queryId: query.queryId,
          fraction: 1,
          contact: null
        });
      }
      const denominator = startClearance - endClearance;
      const fraction = denominator <= 1e-12
        ? 0
        : Math.min(1, Math.max(0, startClearance / denominator));
      const hitX = query.startPositionMeters.x + query.displacementMeters.x * fraction;
      const hitZ = query.startPositionMeters.z + query.displacementMeters.z * fraction;
      return createSurfaceCapsuleSweepResult({
        status: "Resolved",
        queryId: query.queryId,
        fraction,
        contact: groundContact(
          hitX,
          hitZ,
          Math.hypot(
            query.displacementMeters.x,
            query.displacementMeters.y,
            query.displacementMeters.z
          ) * fraction
        )
      });
    },
    queryRay: (query) => createSurfaceRayResult({ status: "Resolved", queryId: query.queryId, contact: null }),
    queryLine: (query) => createSurfaceLineResult({ status: "Resolved", queryId: query.queryId, contact: null })
  };
};

const airPort: SurfaceCollisionQueryPort = {
  queryGroundContact: (query) => createSurfaceGroundContactResult({
    status: "Resolved",
    queryId: query.queryId,
    contact: null
  }),
  sweepCapsule: (query) => createSurfaceCapsuleSweepResult({
    status: "Resolved",
    queryId: query.queryId,
    fraction: 1,
    contact: null
  }),
  queryRay: (query) => createSurfaceRayResult({ status: "Resolved", queryId: query.queryId, contact: null }),
  queryLine: (query) => createSurfaceLineResult({ status: "Resolved", queryId: query.queryId, contact: null })
};

const stateAt = (
  slopeRadians: number,
  overrides: Partial<SurfaceLocomotionState> = {}
) => createSurfaceLocomotionState({
  playerId: "player:hestia-test",
  surfaceFrameId: context.surfaceFrameId,
  positionMeters: { x: 0, y: config.capsule.heightMeters / 2, z: 0 },
  velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
  yawRadians: 0,
  pitchRadians: 0,
  grounded: true,
  groundNormal: normalize({ x: -Math.tan(slopeRadians), y: 1, z: 0 }),
  movementMode: "Walk",
  capsule: config.capsule,
  simulationTick: 0,
  jumpHeld: false,
  ...overrides
});

interface CommandOptions {
  readonly forward?: number;
  readonly right?: number;
  readonly jump?: boolean;
}

const command = (state: Readonly<SurfaceLocomotionState>, options: CommandOptions = {}) =>
  createSurfacePlayerCommand({
    playerId: state.playerId,
    surfaceFrameId: state.surfaceFrameId,
    simulationTick: state.simulationTick + 1,
    moveAxes: { forward: options.forward ?? 0, right: options.right ?? 0 },
    lookDeltaRadians: { yaw: 0, pitch: 0 },
    sprint: false,
    crouch: null,
    jump: options.jump ?? false,
    fire: false,
    pointerLockIntent: "Unchanged",
    reset: "None"
  });

const advance = (
  state: Readonly<SurfaceLocomotionState>,
  ticks: number,
  port: SurfaceCollisionQueryPort,
  options: CommandOptions = {}
) => {
  let current = state;
  for (let index = 0; index < ticks; index += 1) {
    const result = stepSurfaceLocomotion(current, command(current, options), context, port, config);
    expect(result.status).toBe("Advanced");
    if (result.status !== "Advanced") throw new Error(result.rejection.message);
    current = result.state;
  }
  return current;
};

describe("Surface locomotion support states", () => {
  it("projects separation velocity against every obtuse contact normal within a bounded pass budget", () => {
    const initial = stateAt(0, {
      velocityMetersPerSecond: { x: -1, y: -1, z: 0 }
    });
    const normals = [
      { x: 1, y: 0, z: 0 },
      { x: -0.5, y: Math.sqrt(0.75), z: 0 }
    ] as const;
    const corrected = applySurfaceFixedStepCapsuleSeparation(
      createSurfaceFixedStepRuntime(initial),
      { positionMeters: initial.positionMeters, contactNormals: normals },
      config.fixedDeltaSeconds
    );

    for (const normal of normals) {
      const intoNormal = corrected.currentState.velocityMetersPerSecond.x * normal.x
        + corrected.currentState.velocityMetersPerSecond.y * normal.y
        + corrected.currentState.velocityMetersPerSecond.z * normal.z;
      expect(intoNormal).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it("keeps a feasible tangential escape against nearly opposing contact normals", () => {
    const initial = stateAt(0, {
      velocityMetersPerSecond: { x: -1, y: -1, z: 2 }
    });
    const angleRadians = 0.01;
    const normals = [
      { x: 1, y: 0, z: 0 },
      { x: -Math.cos(angleRadians), y: Math.sin(angleRadians), z: 0 }
    ] as const;
    const corrected = applySurfaceFixedStepCapsuleSeparation(
      createSurfaceFixedStepRuntime(initial),
      { positionMeters: initial.positionMeters, contactNormals: normals },
      config.fixedDeltaSeconds
    );
    const velocity = corrected.currentState.velocityMetersPerSecond;

    for (const normal of normals) {
      const intoNormal = velocity.x * normal.x
        + velocity.y * normal.y
        + velocity.z * normal.z;
      expect(intoNormal).toBeGreaterThanOrEqual(-1e-9);
    }
    expect(velocity.z).toBeCloseTo(2, 12);
    expect(Math.hypot(velocity.x, velocity.y, velocity.z))
      .toBeLessThanOrEqual(Math.hypot(-1, -1, 2) + 1e-12);
    expect([velocity.x, velocity.y, velocity.z].every(Number.isFinite)).toBe(true);
  });

  it.each([0, 30, 49.99])(
    "captures qualified rest on a %s degree slope without 600-tick drift",
    (degrees) => {
      const radians = degrees * Math.PI / 180;
      const initial = stateAt(radians, { supportState: "Unsupported" });
      const result = advance(initial, 600, planePort(radians));

      expect(result.supportState).toBe("SupportedResting");
      expect(Math.hypot(
        result.positionMeters.x - initial.positionMeters.x,
        result.positionMeters.y - initial.positionMeters.y,
        result.positionMeters.z - initial.positionMeters.z
      )).toBeLessThanOrEqual(1e-6);
      expect(Math.hypot(
        result.velocityMetersPerSecond.x,
        result.velocityMetersPerSecond.y,
        result.velocityMetersPerSecond.z
      )).toBeLessThanOrEqual(1e-6);
    }
  );

  it("requires two eligible SupportedMoving ticks and uses the exact capture boundary", () => {
    const first = advance(stateAt(0, {
      supportState: "SupportedMoving",
      supportCaptureTicks: 0,
      velocityMetersPerSecond: { x: 0.2, y: 0, z: 0 }
    }), 1, planePort(0));
    const second = advance(first, 1, planePort(0));
    const overBoundary = advance(stateAt(0, {
      supportState: "Unsupported",
      velocityMetersPerSecond: { x: 0.200_001, y: 0, z: 0 }
    }), 1, planePort(0));

    expect(first.supportState).toBe("SupportedMoving");
    expect(first.supportCaptureTicks).toBe(1);
    expect(second.supportState).toBe("SupportedResting");
    expect(overBoundary.supportState).toBe("SupportedMoving");
  });

  it("preserves the hysteresis band and releases rest at exactly 0.25 m/s", () => {
    const held = advance(stateAt(0, {
      supportState: "SupportedResting",
      velocityMetersPerSecond: { x: 0.249_999, y: 0, z: 0 }
    }), 1, planePort(0));
    const released = advance(stateAt(0, {
      supportState: "SupportedResting",
      velocityMetersPerSecond: { x: 0.25, y: 0, z: 0 }
    }), 1, planePort(0));

    expect(held.supportState).toBe("SupportedResting");
    expect(held.velocityMetersPerSecond).toEqual({ x: 0, y: 0, z: 0 });
    expect(released.supportState).toBe("SupportedMoving");
  });

  it("keeps input, jump, contact loss, steep-slope gravity and external impulse physical", () => {
    const resting = stateAt(0, { supportState: "SupportedResting" });
    const moved = advance(resting, 1, planePort(0), { forward: 1 });
    const jumped = advance(resting, 1, planePort(0), { jump: true });
    const unsupported = advance(resting, 1, airPort);
    const steepRadians = 50.01 * Math.PI / 180;
    const steep = advance(stateAt(steepRadians, { supportState: "SupportedResting" }), 1, planePort(steepRadians));
    const impulse = advance(stateAt(0, {
      supportState: "SupportedResting",
      velocityMetersPerSecond: { x: 1, y: 0, z: 0 }
    }), 1, planePort(0));

    expect(moved.supportState).toBe("SupportedMoving");
    expect(moved.positionMeters.z).toBeGreaterThan(0);
    expect(jumped.supportState).toBe("Unsupported");
    expect(jumped.grounded).toBe(false);
    expect(jumped.velocityMetersPerSecond.y).toBeGreaterThan(0);
    expect(unsupported.supportState).toBe("Unsupported");
    expect(unsupported.positionMeters.y).toBeLessThan(resting.positionMeters.y);
    expect(steep.supportState).toBe("Unsupported");
    expect(steep.positionMeters.x).toBeLessThan(resting.positionMeters.x);
    expect(impulse.supportState).toBe("SupportedMoving");
    expect(impulse.positionMeters.x).toBeGreaterThan(resting.positionMeters.x);
  });
});
