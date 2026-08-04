import { describe, expect, it } from "vitest";
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
  advanceSurfaceFixedStepRuntime,
  createHestiaAgileGroundedLocomotionPresetV1,
  createSurfaceFixedStepRuntime,
  createSurfaceLocomotionState,
  recoverSurfaceLocomotion,
  stepSurfaceLocomotion,
  type SurfaceLocomotionState
} from "../../src/surface-play/player";

const config = createHestiaAgileGroundedLocomotionPresetV1();
const context = {
  bodyId: "body:hestia",
  regionId: "region:hestia-test",
  surfaceFrameId: "frame:hestia-test",
  regionRevision: 4
};

const floorContact = (x: number, z: number, distanceMeters: number) => ({
  pointMeters: { x, y: 0, z },
  normal: { x: 0, y: 1, z: 0 },
  distanceMeters,
  colliderId: "terrain:floor"
});

const floorPort: SurfaceCollisionQueryPort = {
  queryGroundContact: (query: SurfaceGroundContactQuery) => {
    const bottom = query.positionMeters.y - query.capsule.heightMeters * 0.5;
    return createSurfaceGroundContactResult({
      status: "Resolved",
      queryId: query.queryId,
      contact: bottom >= -1e-9 && bottom <= query.maximumDistanceMeters
        ? floorContact(query.positionMeters.x, query.positionMeters.z, Math.max(0, bottom))
        : null
    });
  },
  sweepCapsule: (query: SurfaceCapsuleSweepQuery) => {
    const startBottom = query.startPositionMeters.y - query.capsule.heightMeters * 0.5;
    const endBottom = startBottom + query.displacementMeters.y;
    const crossesFloor = query.displacementMeters.y < 0 && endBottom <= 0;
    if (!crossesFloor) {
      return createSurfaceCapsuleSweepResult({
        status: "Resolved",
        queryId: query.queryId,
        fraction: 1,
        contact: null
      });
    }
    const fraction = startBottom <= 0
      ? 0
      : Math.min(1, Math.max(0, startBottom / -query.displacementMeters.y));
    return createSurfaceCapsuleSweepResult({
      status: "Resolved",
      queryId: query.queryId,
      fraction,
      contact: floorContact(
        query.startPositionMeters.x + query.displacementMeters.x * fraction,
        query.startPositionMeters.z + query.displacementMeters.z * fraction,
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

const initialState = (overrides: Partial<SurfaceLocomotionState> = {}) => createSurfaceLocomotionState({
  playerId: "player:hestia-test",
  surfaceFrameId: context.surfaceFrameId,
  positionMeters: { x: 0, y: 0.9, z: 0 },
  velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
  yawRadians: 0,
  pitchRadians: 0,
  grounded: true,
  groundNormal: { x: 0, y: 1, z: 0 },
  movementMode: "Walk",
  capsule: config.capsule,
  simulationTick: 0,
  jumpHeld: false,
  ...overrides
});

interface CommandOptions {
  readonly forward?: number;
  readonly right?: number;
  readonly sprint?: boolean;
  readonly jump?: boolean;
}

const command = (state: Readonly<SurfaceLocomotionState>, options: CommandOptions = {}) =>
  createSurfacePlayerCommand({
    playerId: state.playerId,
    surfaceFrameId: state.surfaceFrameId,
    simulationTick: state.simulationTick + 1,
    moveAxes: { forward: options.forward ?? 0, right: options.right ?? 0 },
    lookDeltaRadians: { yaw: 0, pitch: 0 },
    sprint: options.sprint ?? false,
    crouch: null,
    jump: options.jump ?? false,
    fire: false,
    pointerLockIntent: "Unchanged",
    reset: "None"
  });

const advance = (
  state: Readonly<SurfaceLocomotionState>,
  ticks: number,
  options: CommandOptions,
  port: SurfaceCollisionQueryPort = floorPort
) => {
  let current = state;
  for (let tick = 0; tick < ticks; tick += 1) {
    const result = stepSurfaceLocomotion(current, command(current, options), context, port, config);
    expect(result.status).toBe("Advanced");
    if (result.status !== "Advanced") throw new Error(result.rejection.message);
    current = result.state;
  }
  return current;
};

describe("surface locomotion fixed-step core", () => {
  it("remains grounded and still under explicit Hestia gravity", () => {
    const result = advance(initialState(), 600, {});

    expect(config.gravityMetersPerSecondSquared).toBe(11.78);
    expect(result.grounded).toBe(true);
    expect(result.positionMeters.x).toBe(0);
    expect(result.positionMeters.z).toBe(0);
    expect(result.velocityMetersPerSecond).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("covers a stable walk distance and makes sprint faster", () => {
    const walk = advance(initialState(), 120, { forward: 1 });
    const sprint = advance(initialState(), 120, { forward: 1, sprint: true });

    expect(walk.positionMeters.z).toBeGreaterThan(9);
    expect(walk.positionMeters.z).toBeLessThan(10.1);
    expect(sprint.positionMeters.z).toBeGreaterThan(walk.positionMeters.z + 4);
    expect(walk.velocityMetersPerSecond.z).toBeCloseTo(config.walkSpeedMetersPerSecond, 8);
    expect(sprint.velocityMetersPerSecond.z).toBeCloseTo(config.sprintSpeedMetersPerSecond, 8);
  });

  it.each([0, Math.PI / 3])(
    "maps A and D onto rendered camera-local left and right at yaw %s",
    (yawRadians) => {
      const start = initialState({ yawRadians });
      const pressingD = advance(start, 1, { right: 1 });
      const pressingA = advance(start, 1, { right: -1 });
      const cameraRight = {
        x: -Math.cos(yawRadians),
        z: Math.sin(yawRadians)
      };
      const screenRightDisplacement =
        (pressingD.positionMeters.x - start.positionMeters.x) * cameraRight.x
        + (pressingD.positionMeters.z - start.positionMeters.z) * cameraRight.z;
      const screenLeftDisplacement =
        (pressingA.positionMeters.x - start.positionMeters.x) * cameraRight.x
        + (pressingA.positionMeters.z - start.positionMeters.z) * cameraRight.z;

      expect(screenRightDisplacement).toBeGreaterThan(0);
      expect(screenLeftDisplacement).toBeLessThan(0);
    }
  );

  it("accelerates and decelerates without a velocity-zero shortcut", () => {
    const accelerating = advance(initialState(), 8, { forward: 1 });
    const oneBrakeTick = advance(accelerating, 1, {});
    const stopped = advance(oneBrakeTick, 20, {});

    expect(accelerating.velocityMetersPerSecond.z).toBeGreaterThan(0);
    expect(accelerating.velocityMetersPerSecond.z).toBeLessThan(config.walkSpeedMetersPerSecond);
    expect(oneBrakeTick.velocityMetersPerSecond.z).toBeGreaterThan(0);
    expect(oneBrakeTick.velocityMetersPerSecond.z).toBeLessThan(accelerating.velocityMetersPerSecond.z);
    expect(stopped.velocityMetersPerSecond.z).toBe(0);
  });

  it("jumps to a plausible apex, cannot double-jump, lands, and does not bunny-hop while held", () => {
    let state = initialState();
    let apex = state.positionMeters.y;
    let airborneVelocityBeforeSecondPress = 0;
    let airborneVelocityAfterSecondPress = 0;
    let landings = 0;
    let wasGrounded = state.grounded;

    for (let tick = 0; tick < 180; tick += 1) {
      const jump = tick !== 8;
      if (tick === 8) airborneVelocityBeforeSecondPress = state.velocityMetersPerSecond.y;
      const result = stepSurfaceLocomotion(state, command(state, { jump }), context, floorPort, config);
      expect(result.status).toBe("Advanced");
      if (result.status !== "Advanced") throw new Error(result.rejection.message);
      state = result.state;
      if (tick === 9) airborneVelocityAfterSecondPress = state.velocityMetersPerSecond.y;
      apex = Math.max(apex, state.positionMeters.y);
      if (!wasGrounded && state.grounded) landings += 1;
      wasGrounded = state.grounded;
    }

    expect(apex - 0.9).toBeGreaterThan(1);
    expect(apex - 0.9).toBeLessThanOrEqual(config.jumpApexMeters + 0.01);
    expect(airborneVelocityAfterSecondPress).toBeLessThan(airborneVelocityBeforeSecondPress);
    expect(landings).toBe(1);
    expect(state.grounded).toBe(true);
    expect(state.positionMeters.y).toBeGreaterThanOrEqual(0.9);
    expect(state.positionMeters.y).toBeLessThanOrEqual(0.9 + config.collisionSkinMeters);
  });

  it("limits air control without capping existing horizontal momentum", () => {
    const airborne = initialState({
      grounded: false,
      movementMode: "Airborne",
      positionMeters: { x: 0, y: 20, z: 0 },
      velocityMetersPerSecond: { x: 10, y: 0, z: 0 }
    });
    const alongMomentum = advance(airborne, 1, { right: -1 }, airPort);
    const perpendicular = advance(alongMomentum, 1, { forward: 1 }, airPort);

    expect(alongMomentum.velocityMetersPerSecond.x).toBe(10);
    expect(perpendicular.velocityMetersPerSecond.x).toBe(10);
    expect(perpendicular.velocityMetersPerSecond.z).toBeCloseTo(
      config.airAccelerationMetersPerSecondSquared * config.fixedDeltaSeconds,
      10
    );
    expect(perpendicular.velocityMetersPerSecond.z).toBeLessThan(config.maximumAirControlSpeedMetersPerSecond);
  });

  it("produces identical states for identical fixed-step inputs", () => {
    const run = () => advance(initialState(), 240, { forward: 0.8, right: -0.25, sprint: true });

    expect(run()).toEqual(run());
  });

  it("keeps fixed-step truth identical across variable presentation frames", () => {
    const commandFactory = (_tick: number, state: Readonly<SurfaceLocomotionState>) =>
      command(state, { forward: 1 });
    const oneFrame = advanceSurfaceFixedStepRuntime(
      createSurfaceFixedStepRuntime(initialState()),
      1,
      commandFactory,
      context,
      floorPort,
      config
    );
    let partitioned = createSurfaceFixedStepRuntime(initialState());
    for (const delta of [0.07, 0.13, 0.04, 0.19, 0.11, 0.08, 0.16, 0.22]) {
      const result = advanceSurfaceFixedStepRuntime(
        partitioned,
        delta,
        commandFactory,
        context,
        floorPort,
        config
      );
      expect(result.status).toBe("Advanced");
      if (result.status !== "Advanced") throw new Error(result.rejection.message);
      partitioned = result.runtime;
    }

    expect(oneFrame.status).toBe("Advanced");
    if (oneFrame.status !== "Advanced") throw new Error(oneFrame.rejection.message);
    expect(partitioned.currentState).toEqual(oneFrame.runtime.currentState);
    expect(partitioned.accumulatorSeconds).toBeCloseTo(oneFrame.runtime.accumulatorSeconds, 12);
    expect(partitioned.interpolationAlpha).toBeCloseTo(oneFrame.runtime.interpolationAlpha, 12);
  });

  it("requires an explicit finite recovery target", () => {
    const falling = advance(initialState({ grounded: false, movementMode: "Airborne" }), 30, {}, airPort);
    const recovered = recoverSurfaceLocomotion(falling, {
      positionMeters: { x: 4, y: 8, z: -3 },
      yawRadians: 1,
      pitchRadians: 10
    }, config);

    expect(falling.movementMode).toBe("Airborne");
    expect(recovered.positionMeters).toEqual({ x: 4, y: 8, z: -3 });
    expect(recovered.velocityMetersPerSecond).toEqual({ x: 0, y: 0, z: 0 });
    expect(recovered.movementMode).toBe("Recovery");
    expect(recovered.pitchRadians).toBe(config.maximumPitchRadians);
    expect(() => recoverSurfaceLocomotion(falling, {
      positionMeters: { x: Number.NaN, y: 0, z: 0 },
      yawRadians: 0,
      pitchRadians: 0
    }, config)).toThrow(/finite/);
  });

  it("never emits NaN or Infinity across sustained motion", () => {
    const result = advance(initialState(), 1200, { forward: 1, right: 1, sprint: true });
    const numericValues = [
      result.positionMeters.x,
      result.positionMeters.y,
      result.positionMeters.z,
      result.velocityMetersPerSecond.x,
      result.velocityMetersPerSecond.y,
      result.velocityMetersPerSecond.z,
      result.yawRadians,
      result.pitchRadians
    ];

    expect(numericValues.every(Number.isFinite)).toBe(true);
  });
});
