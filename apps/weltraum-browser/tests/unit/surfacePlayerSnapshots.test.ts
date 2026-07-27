import { describe, expect, it } from "vitest";
import {
  createHestiaAgileGroundedLocomotionPresetV1,
  createSurfaceFirstPersonViewSnapshot,
  createSurfaceFixedStepRuntime,
  createSurfaceLocomotionState,
  createSurfacePlayerContractSnapshot,
  createSurfacePlayerPresentationSnapshot
} from "../../src/surface-play/player";

const state = (x: number, yawRadians = 0, pitchRadians = 0) => createSurfaceLocomotionState({
  playerId: "player:hestia",
  surfaceFrameId: "frame:hestia-test",
  positionMeters: { x, y: 0.9, z: 0 },
  velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
  yawRadians,
  pitchRadians,
  grounded: true,
  movementMode: "Walk",
  capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
  simulationTick: x
});

describe("surface player snapshots", () => {
  it("adapts immutable gameplay and interpolation snapshots without feedback", () => {
    const previous = state(0);
    const current = state(1, 0.4, 0.2);
    const runtime = {
      ...createSurfaceFixedStepRuntime(current),
      previousState: previous,
      currentState: current,
      accumulatorSeconds: 1 / 120,
      interpolationAlpha: 0.5
    };

    const gameplay = createSurfacePlayerContractSnapshot(current);
    const presentation = createSurfacePlayerPresentationSnapshot(runtime);

    expect(gameplay.positionMeters.x).toBe(1);
    expect(presentation.positionMeters.x).toBeCloseTo(0.5);
    expect(presentation.yawRadians).toBeCloseTo(0.2);
    expect(current.positionMeters.x).toBe(1);
    expect(Object.isFrozen(presentation)).toBe(true);
  });

  it("creates a head-height, pitch-limited, zero-roll view with no head bob or FOV", () => {
    const config = createHestiaAgileGroundedLocomotionPresetV1();
    const current = state(0, Math.PI / 2, Math.PI);
    const view = createSurfaceFirstPersonViewSnapshot(current, config);

    expect(view.eyePositionMeters.y).toBeCloseTo(1.62);
    expect(view.pitchRadians).toBeCloseTo(config.maximumPitchRadians);
    expect(view.forward.x).toBeGreaterThan(0);
    expect(view.surfaceUp).toEqual({ x: 0, y: 1, z: 0 });
    expect(view.rollRadians).toBe(0);
    expect(view.headBobOffsetMeters).toBe(0);
    expect("fov" in view).toBe(false);
  });
});
