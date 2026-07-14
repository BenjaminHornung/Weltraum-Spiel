import { describe, expect, it } from "vitest";
import {
  STARTER_BODY_IDS,
  STARTER_CELESTIAL_CATALOG,
  computeCatalogEphemeris,
  requireCelestialBody
} from "../../src/celestial";
import { createUniverseClock } from "../../src/persistence";
import { createSystemInertialFrameId, createSystemInertialFrameState } from "../../src/spatial";
import {
  PhysicsSpaceError,
  createGravityFieldSnapshot,
  createGravitySourceBinding,
  createPhysicsProbeState,
  queryGravityField,
  runPhysicsProbeSimulation,
  stepPhysicsProbe
} from "../../src/physics-space";

const SYSTEM_FRAME_ID = createSystemInertialFrameId();

const fixtureAt = (tick: number) => {
  const time = createUniverseClock(tick);
  const body = requireCelestialBody(STARTER_CELESTIAL_CATALOG, STARTER_BODY_IDS.hestia);
  const ephemeris = computeCatalogEphemeris(STARTER_CELESTIAL_CATALOG, {
    epochSeconds: 0,
    requestedTimeSeconds: time.epochSeconds
  });
  const runtimeState = ephemeris.stateByBodyId[body.bodyId];
  if (runtimeState === undefined) {
    throw new Error("Hestia runtime state is missing.");
  }
  const frame = createSystemInertialFrameState(SYSTEM_FRAME_ID, time);
  const binding = createGravitySourceBinding({ body, runtimeState, time });
  const field = createGravityFieldSnapshot({ time, systemFrameState: frame, bindings: [binding] });
  return { time, body, runtimeState, frame, field };
};

const vectorError = (
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number }
) => Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);

describe("deterministic fixed-step physics probe", () => {
  it("uses semi-implicit Euler in SystemInertial space", () => {
    const start = fixtureAt(0);
    const end = fixtureAt(1);
    const state = createPhysicsProbeState({
      probeId: "probe:semi-implicit",
      frameId: start.frame.frameId,
      time: start.time,
      positionMeters: {
        x: start.runtimeState.absoluteState.positionMeters.x + start.body.radiusMeters + 10_000,
        y: start.runtimeState.absoluteState.positionMeters.y,
        z: start.runtimeState.absoluteState.positionMeters.z
      },
      velocityMetersPerSecond: { x: 4, y: 250, z: -2 }
    });
    const dt = 1 / 120;
    const gravity = queryGravityField({
      field: start.field,
      positionMeters: state.positionMeters,
      positionFrameState: start.frame,
      outputFrameState: start.frame
    });
    const expectedVelocity = {
      x: state.velocityMetersPerSecond.x + gravity.systemAccelerationMetersPerSecondSquared.x * dt,
      y: state.velocityMetersPerSecond.y + gravity.systemAccelerationMetersPerSecondSquared.y * dt,
      z: state.velocityMetersPerSecond.z + gravity.systemAccelerationMetersPerSecondSquared.z * dt
    };
    const expectedPosition = {
      x: state.positionMeters.x + expectedVelocity.x * dt,
      y: state.positionMeters.y + expectedVelocity.y * dt,
      z: state.positionMeters.z + expectedVelocity.z * dt
    };
    const result = stepPhysicsProbe({
      state,
      deltaTimeSeconds: dt,
      startFrameState: start.frame,
      endFrameState: end.frame,
      gravityField: start.field
    });

    expect(vectorError(result.absoluteVelocityMetersPerSecond, expectedVelocity)).toBeLessThanOrEqual(1e-12);
    expect(vectorError(result.absolutePositionMeters, expectedPosition)).toBeLessThanOrEqual(1e-5);
    expect(result.state.time).toEqual(end.time);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.state)).toBe(true);
  });

  it("rejects zero, negative, non-finite, inexact, and time-mismatched steps", () => {
    const start = fixtureAt(0);
    const oneTick = fixtureAt(1);
    const twoTicks = fixtureAt(2);
    const state = createPhysicsProbeState({
      probeId: "probe:invalid-dt",
      frameId: start.frame.frameId,
      time: start.time,
      positionMeters: {
        x: start.runtimeState.absoluteState.positionMeters.x + start.body.radiusMeters + 1_000,
        y: start.runtimeState.absoluteState.positionMeters.y,
        z: start.runtimeState.absoluteState.positionMeters.z
      },
      velocityMetersPerSecond: { x: 0, y: 1, z: 0 }
    });
    const action = (deltaTimeSeconds: number, endFrameState = oneTick.frame) => () =>
      stepPhysicsProbe({
        state,
        deltaTimeSeconds,
        startFrameState: start.frame,
        endFrameState,
        gravityField: start.field
      });

    for (const dt of [0, -1 / 120, Number.NaN, Number.POSITIVE_INFINITY, 0.01]) {
      expect(action(dt)).toThrowError(
        expect.objectContaining<Partial<PhysicsSpaceError>>({ code: "INVALID_TIME_STEP" })
      );
    }
    expect(action(1 / 120, twoTicks.frame)).toThrowError(
      expect.objectContaining<Partial<PhysicsSpaceError>>({ code: "INVALID_TIME_STEP" })
    );
    expect(() =>
      stepPhysicsProbe({
        state: { ...state, time: oneTick.time },
        deltaTimeSeconds: 1 / 120,
        startFrameState: start.frame,
        endFrameState: oneTick.frame,
        gravityField: start.field
      })
    ).toThrow();
  });

  it("is reproducible and produces byte-stable canonical results for identical explicit steps", () => {
    const tick0 = fixtureAt(0);
    const tick1 = fixtureAt(1);
    const tick2 = fixtureAt(2);
    const callerState = {
      probeId: "probe:reproducible",
      frameId: tick0.frame.frameId,
      time: tick0.time,
      positionMeters: {
        x: tick0.runtimeState.absoluteState.positionMeters.x + tick0.body.radiusMeters + 20_000,
        y: tick0.runtimeState.absoluteState.positionMeters.y,
        z: tick0.runtimeState.absoluteState.positionMeters.z
      },
      velocityMetersPerSecond: { x: 0, y: 500, z: 2 }
    } as const;
    const before = structuredClone(callerState);
    const initialState = createPhysicsProbeState(callerState);
    const contexts = [
      {
        deltaTimeSeconds: 1 / 120,
        startFrameState: tick0.frame,
        endFrameState: tick1.frame,
        gravityField: tick0.field
      },
      {
        deltaTimeSeconds: 1 / 120,
        startFrameState: tick1.frame,
        endFrameState: tick2.frame,
        gravityField: tick1.field
      }
    ] as const;

    const first = runPhysicsProbeSimulation(initialState, contexts);
    const second = runPhysicsProbeSimulation(initialState, contexts);

    expect(first).toEqual(second);
    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(first.signature).toBe(second.signature);
    expect(first.steps.map((step) => step.canonicalJson)).toEqual(
      second.steps.map((step) => step.canonicalJson)
    );
    expect(callerState).toEqual(before);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.steps)).toBe(true);
  });
});
