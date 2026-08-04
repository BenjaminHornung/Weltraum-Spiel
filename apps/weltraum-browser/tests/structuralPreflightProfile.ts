import { performance } from "node:perf_hooks";
import { createSurfaceRigidBodyWorld } from "../src/surface-play/physics";
import {
  createSurfaceTreeCollisionBinding,
  raycastSurfaceTreeCollision
} from "../src/surface-play/vegetation/surfaceTreeCollision";
import { createHestiaUmbrellaTree } from "../src/surface-play/vegetation/hestiaUmbrellaTree";
import {
  createSurfaceTreeRuntimeState,
  preflightSurfaceTreeFire,
  type SurfaceTreeRuntimeState
} from "../src/surface-play/vegetation/surfaceTreeRuntime";

const originMeters = Object.freeze({ x: 64, y: 12.441, z: -32 });
const direction = Object.freeze({ x: -5.9375, y: -0.8999, z: -9.9375 });
let state: Readonly<SurfaceTreeRuntimeState> = createSurfaceTreeRuntimeState(
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

for (let ordinal = 1; ordinal <= 2; ordinal += 1) {
  const raycast = raycastSurfaceTreeCollision(state.collision, {
    binding: createSurfaceTreeCollisionBinding(state.collision),
    originMeters,
    direction,
    maximumDistanceMeters: 30
  });
  if (raycast.status !== "Resolved" || raycast.kind !== "Hit") throw new Error("Pinned ray missed.");
  const startedAt = performance.now();
  const preflight = preflightSurfaceTreeFire(state, {
    fireCommandId: `fire:tree-profile:${ordinal}`,
    hit: raycast.hit,
    simulationTick: ordinal
  });
  const durationMilliseconds = performance.now() - startedAt;
  if (preflight.status !== "Ready") throw new Error("Pinned preflight rejected.");
  console.info({ ordinal, supportResult: preflight.supportResult, durationMilliseconds });
  state = preflight.state;
}
