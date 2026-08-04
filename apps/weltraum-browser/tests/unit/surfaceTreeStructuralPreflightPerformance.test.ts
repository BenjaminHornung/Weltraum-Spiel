import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { createSurfaceRigidBodyWorld } from "../../src/surface-play/physics";
import {
  createSurfaceTreeCollisionBinding,
  raycastSurfaceTreeCollision
} from "../../src/surface-play/vegetation/surfaceTreeCollision";
import { createHestiaUmbrellaTree } from "../../src/surface-play/vegetation/hestiaUmbrellaTree";
import {
  createSurfaceTreeRuntimeState,
  preflightSurfaceTreeFire,
  type SurfaceTreeRuntimeState
} from "../../src/surface-play/vegetation/surfaceTreeRuntime";

const PRELIGHT_TARGET_MILLISECONDS = 80;
const LONG_TASK_LIMIT_MILLISECONDS = 100;
const SAMPLE_COUNT = 3;

const originMeters = Object.freeze({ x: 64, y: 12.441, z: -32 });
const targetMeters = Object.freeze({ x: 58.0625, y: 11.5411, z: -41.9375 });
const direction = Object.freeze({
  x: targetMeters.x - originMeters.x,
  y: targetMeters.y - originMeters.y,
  z: targetMeters.z - originMeters.z
});

const createState = (): Readonly<SurfaceTreeRuntimeState> =>
  createSurfaceTreeRuntimeState(
    createHestiaUmbrellaTree({
      instanceId: "hestia.surface-play.umbrella.phase2",
      seed: "hestia.surface-play.umbrella.phase2-seed",
      rootQuantum: { x: 464, y: 72, z: -336 }
    }),
    createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: 9.81,
      terrainColliders: []
    })
  );

const fireRealRay = (
  state: Readonly<SurfaceTreeRuntimeState>,
  ordinal: number
) => {
  const raycast = raycastSurfaceTreeCollision(state.collision, {
    binding: createSurfaceTreeCollisionBinding(state.collision),
    originMeters,
    direction,
    maximumDistanceMeters: 30
  });
  expect(raycast.status).toBe("Resolved");
  if (raycast.status !== "Resolved") {
    throw new Error("Pinned real Tree ray was rejected by the current Structural authority.");
  }
  expect(raycast.kind).toBe("Hit");
  if (raycast.kind !== "Hit") {
    throw new Error("Pinned real Tree ray missed the current Structural authority.");
  }

  const startedAt = performance.now();
  const preflight = preflightSurfaceTreeFire(state, {
    fireCommandId: `fire:tree-structural-preflight:${ordinal}`,
    hit: raycast.hit,
    simulationTick: ordinal
  });
  const durationMilliseconds = performance.now() - startedAt;
  expect(preflight.status).toBe("Ready");
  if (preflight.status !== "Ready") {
    throw new Error("Pinned real Tree fire preflight was rejected.");
  }
  return Object.freeze({ preflight, durationMilliseconds });
};

describe("Surface Tree Structural preflight performance", () => {
  it("keeps the pinned real hit 1 and detaching hit 2 within the synchronous work budget", () => {
    const warmInitial = createState();
    const warmFirst = fireRealRay(warmInitial, 10_001);
    fireRealRay(warmFirst.preflight.state, 10_002);

    const hit1Durations: number[] = [];
    const hit2Durations: number[] = [];
    for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
      const initial = createState();
      const first = fireRealRay(initial, sample * 2 + 1);
      expect(first.preflight.supportResult).toBe("Anchored");
      const second = fireRealRay(first.preflight.state, sample * 2 + 2);
      expect(second.preflight.supportResult).toBe("Detached");
      hit1Durations.push(first.durationMilliseconds);
      hit2Durations.push(second.durationMilliseconds);
    }

    const maximumHit1 = Math.max(...hit1Durations);
    const maximumHit2 = Math.max(...hit2Durations);
    console.info("surface-tree-structural-preflight", {
      hit1Durations,
      hit2Durations,
      maximumHit1,
      maximumHit2
    });
    expect(maximumHit1).toBeLessThanOrEqual(PRELIGHT_TARGET_MILLISECONDS);
    expect(maximumHit2).toBeLessThanOrEqual(PRELIGHT_TARGET_MILLISECONDS);
    expect(Math.max(maximumHit1, maximumHit2)).toBeLessThan(LONG_TASK_LIMIT_MILLISECONDS);
  }, 180_000);
});
