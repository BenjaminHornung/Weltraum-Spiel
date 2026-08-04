import { beforeAll, describe, expect, it, vi } from "vitest";
import { createDamageableSnapshot } from "../../src/combat";
import * as surfaceRigidBodyPhysics from "../../src/surface-play/physics";
import {
  createSurfaceCapsuleSweepQuery,
  createSurfaceGroundContactQuery,
  createSurfaceLineQuery,
  createSurfacePlayerCommand,
  createSurfaceRayQuery
} from "../../src/surface-play/contracts";
import {
  createHestiaPulseCutterState,
  createSurfaceCombatRuntimeState,
  type SurfaceCombatRuntimeState
} from "../../src/surface-play/combat";
import { HESTIA_COAST_LUSH_PRESET_ID } from "../../src/world-generation/hestia";
import {
  createHestiaAgileGroundedLocomotionPresetV1,
  createSurfaceLocomotionState,
  type SurfaceLocomotionState
} from "../../src/surface-play/player";
import { createSurfaceVoxelCollisionDelegate } from "../../src/surface-play/surfacePlayCollision";
import {
  resolveHestiaSurfacePlaySpawn,
  resolveHestiaSurfacePlayWorld,
  revalidateHestiaSurfacePlayWorld
} from "../../src/surface-play/surfacePlayBootstrap";
import {
  createHestiaSurfacePlayAuthorityInput,
  HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG,
  HESTIA_SURFACE_PLAY_V1_CONFIG
} from "../../src/surface-play/surfacePlayConfig";
import {
  createSurfacePlayRuntime,
  sameRigidBodyCollisionSource,
  type SurfacePlayRuntimeOptions
} from "../../src/surface-play/surfacePlayRuntime";
import {
  admitSurfaceRigidBodyBatch,
  createSurfaceRigidBodyCandidate,
  createSurfaceRigidBodyWorld
} from "../../src/surface-play/physics";
import * as surfaceTreeRuntime from "../../src/surface-play/vegetation/surfaceTreeRuntime";
import { createHestiaUmbrellaTree } from "../../src/surface-play/vegetation/hestiaUmbrellaTree";
import type { SurfaceTreeRuntimeState } from "../../src/surface-play/vegetation/surfaceTreeRuntime";
import { PreparedStructuralFirePrivateWorkerRuntimeV2 } from "../../src/surface-play/workers/preparedStructuralFireWorker";
import type { PreparedStructuralFireWorkerSeedPreparationInput } from "../../src/surface-play/workers/preparedStructuralFireWorkerClient";
import {
  SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
  applySurfaceVoxelEdit,
  createSurfaceRegionVoxelAuthority,
  type SurfaceRegionVoxelAuthority,
  type SurfaceRegionVoxelAuthorityInput,
  type SurfaceRegionVoxelCollisionAdapter,
  type SurfaceRegionVoxelState,
  type SurfaceVoxelEditIntent
} from "../../src/surface-play/voxel-edit";

const config = createHestiaAgileGroundedLocomotionPresetV1();
const fixedDelta = config.fixedDeltaSeconds;
const authorityInput: SurfaceRegionVoxelAuthorityInput = {
  ...HESTIA_SURFACE_PLAY_V1_CONFIG,
  seed: "hestia-surface-play-runtime-integration",
  brickBounds: {
    minInclusive: { x: -1, y: -1, z: 0 },
    maxExclusive: { x: 1, y: 0, z: 1 }
  },
  residentBrickCoordinates: [
    { x: -1, y: -1, z: 0 },
    { x: 0, y: -1, z: 0 }
  ]
};

let baseAuthority: SurfaceRegionVoxelAuthority;

beforeAll(() => {
  baseAuthority = createSurfaceRegionVoxelAuthority(authorityInput);
}, 30_000);

const playerState = (overrides: Partial<SurfaceLocomotionState> = {}) => createSurfaceLocomotionState({
  playerId: "surface-player:runtime-integration",
  surfaceFrameId: authorityInput.surfaceFrameId,
  positionMeters: { x: 0, y: 0.9, z: 8 },
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

const command = (
  tick: number,
  state: Readonly<SurfaceLocomotionState>,
  overrides: Partial<Parameters<typeof createSurfacePlayerCommand>[0]> = {}
) => createSurfacePlayerCommand({
  playerId: state.playerId,
  surfaceFrameId: state.surfaceFrameId,
  simulationTick: tick,
  moveAxes: { forward: 0, right: 0 },
  lookDeltaRadians: { yaw: 0, pitch: 0 },
  sprint: false,
  crouch: null,
  jump: false,
  fire: false,
  pointerLockIntent: "Unchanged",
  reset: "None",
  ...overrides
});

const runtime = (overrides: Partial<SurfacePlayRuntimeOptions> = {}) => createSurfacePlayRuntime({
  routeId: "surface-play-runtime-integration",
  initialPlayerState: playerState(),
  authority: baseAuthority,
  ...overrides
});

const combatState = (
  overrides: Partial<SurfaceCombatRuntimeState> = {},
  dronePositionMeters = { x: 0, y: 1.62, z: 12 }
): Readonly<SurfaceCombatRuntimeState> => ({
  ...createSurfaceCombatRuntimeState(authorityInput.surfaceFrameId, dronePositionMeters),
  ...overrides
});

const downwardPlayer = (x: number) => playerState({
  positionMeters: { x, y: 0.9, z: 8 },
  pitchRadians: -config.maximumPitchRadians
});

const fireOneTerrainShot = (
  applyVoxelEdit: NonNullable<SurfacePlayRuntimeOptions["applyVoxelEdit"]>,
  x = 0
) => {
  const instance = runtime({
    initialPlayerState: downwardPlayer(x),
    initialCombatState: combatState({}, { x: 12, y: 10, z: 12 }),
    applyVoxelEdit
  });
  const before = instance.read();
  const result = instance.advance(fixedDelta, (tick, state) => command(tick, state, { fire: true }));
  return { instance, before, result };
};

const knownInteriorIntent = (
  authority: SurfaceRegionVoxelAuthority,
  intent: Readonly<SurfaceVoxelEditIntent>,
  overrides: Partial<SurfaceVoxelEditIntent>
) => ({
  ...intent,
  expectedRegionRevision: authority.state.regionRevision,
  centerGlobalQuantum: { x: 0, y: -64, z: 32 },
  ...overrides
});

describe("Surface Play runtime integration", () => {
  it("refreshes a pose-equal rigid-body collision source when Falling becomes Resting", () => {
    const admission = admitSurfaceRigidBodyBatch(createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: 0,
      terrainColliders: []
    }), [createSurfaceRigidBodyCandidate({
      bodyId: "body:lifecycle-refresh",
      componentId: "component:lifecycle-refresh",
      objectId: "object:lifecycle-refresh",
      sourceObjectRevision: 1,
      sourceContentHash: "fnv1a64-v1:1111111111111111",
      occupiedCells: [{ x: 0, y: 0, z: 0 }],
      cellSizeMeters: 1,
      massKg: 1,
      centerOfMassMeters: { x: 0.5, y: 0.5, z: 0.5 },
      inertiaTensorKgMetersSquared: { xx: 1, yy: 1, zz: 1, xy: 0, xz: 0, yz: 0 },
      colliderRevision: 1,
      detachedAtSimulationTick: 0
    })]);
    if (admission.status !== "Admitted") throw new Error("Lifecycle refresh fixture admission failed.");
    const falling = admission.world;
    const resting = Object.freeze({
      ...falling,
      bodies: Object.freeze(falling.bodies.map((body) => Object.freeze({
        ...body,
        lifecycle: "Resting" as const
      })))
    });

    expect(falling.bodies[0].lifecycle).toBe("Falling");
    expect(resting.bodies[0].positionMeters).toBe(falling.bodies[0].positionMeters);
    expect(resting.bodies[0].orientation).toBe(falling.bodies[0].orientation);
    expect(resting.bodies[0].colliders).toBe(falling.bodies[0].colliders);
    expect(sameRigidBodyCollisionSource(falling, resting)).toBe(false);
    expect(sameRigidBodyCollisionSource(resting, falling)).toBe(false);
  });

  it("rolls back the full Tree state when post-physics Player separation is blocked", () => {
    const sourceWorld = resolveHestiaSurfacePlayWorld();
    const authority = createSurfaceRegionVoxelAuthority(createHestiaSurfacePlayAuthorityInput(sourceWorld));
    const adopted = revalidateHestiaSurfacePlayWorld(authority, sourceWorld);
    if (adopted.status === "Rejected") throw new Error(adopted.failure.message);
    const initialPlayerState = resolveHestiaSurfacePlaySpawn(authority, adopted.world);
    const createWorldRuntime = () => createSurfacePlayRuntime({
      routeId: "surface-play-runtime-blocked-separation",
      initialPlayerState,
      authority,
      world: adopted.world
    });
    const control = createWorldRuntime();
    const instance = createWorldRuntime();
    const before = instance.read();
    const expectedFirst = control.advance(fixedDelta, (tick, state) => command(tick, state));
    const expectedSecond = control.advance(fixedDelta, (tick, state) => command(tick, state));
    const originalAdvanceTreePhysics = surfaceTreeRuntime.advanceSurfaceTreePhysics;
    const treeInputs: Readonly<SurfaceTreeRuntimeState>[] = [];
    const treeOutputs: Readonly<SurfaceTreeRuntimeState>[] = [];
    const advanceTreeSpy = vi.spyOn(surfaceTreeRuntime, "advanceSurfaceTreePhysics")
      .mockImplementation((state) => {
        treeInputs.push(state);
        const advanced = originalAdvanceTreePhysics(state);
        treeOutputs.push(advanced);
        return advanced;
      });
    const separationSpy = vi.spyOn(surfaceRigidBodyPhysics, "separateSurfaceRigidBodyCapsule")
      .mockImplementation((_world, query) => Object.freeze({
        status: "Blocked" as const,
        positionMeters: Object.freeze({ x: 99, y: 99, z: 99 }),
        iterations: 1,
        contacts: Object.freeze([Object.freeze({
          bodyId: "body:test-blocked",
          componentId: "component:test-blocked",
          colliderIndex: 0,
          normal: Object.freeze({ x: 1, y: 0, z: 0 }),
          correctionDistanceMeters: query.skinMeters
        })])
      }));

    try {
      const first = instance.advance(fixedDelta, (tick, state) => command(tick, state));
      expect(first.status).toBe("Advanced");
      expect(first.rejections).toEqual([]);
      expect(separationSpy).toHaveBeenCalledOnce();
      expect(treeInputs).toHaveLength(1);
      expect(treeOutputs).toHaveLength(1);
      expect(treeOutputs[0]).not.toBe(treeInputs[0]);
      expect(treeOutputs[0]!.physicsWorld).not.toBe(treeInputs[0]!.physicsWorld);
      expect(separationSpy.mock.calls[0]?.[0]).toBe(treeOutputs[0]!.physicsWorld);
      expect(first.snapshot.player).toEqual(expectedFirst.snapshot.player);
      expect(first.snapshot.fixedStep).toEqual(expectedFirst.snapshot.fixedStep);
      expect(first.snapshot.player.positionMeters).not.toEqual({ x: 99, y: 99, z: 99 });

      const firstStructural = first.snapshot.presentation.structural;
      const beforeStructural = before.presentation.structural;
      if (firstStructural === null || beforeStructural === null) {
        throw new Error("Blocked-separation fixture requires Structural presentation.");
      }
      expect({ ...firstStructural, simulationTick: beforeStructural.simulationTick })
        .toEqual(beforeStructural);
      expect(Object.isFrozen(first.snapshot)).toBe(true);
      expect(Object.isFrozen(first.snapshot.fixedStep)).toBe(true);
      expect(Object.isFrozen(firstStructural)).toBe(true);
      expect(Object.isFrozen(firstStructural.dynamicBodies)).toBe(true);

      const second = instance.advance(fixedDelta, (tick, state) => command(tick, state));
      expect(second.status).toBe("Advanced");
      expect(second.rejections).toEqual([]);
      expect(treeInputs).toHaveLength(2);
      expect(treeInputs[1]).toBe(treeInputs[0]);
      expect(separationSpy).toHaveBeenCalledTimes(2);
      expect(second.snapshot.player).toEqual(expectedSecond.snapshot.player);
      expect(second.snapshot.fixedStep).toEqual(expectedSecond.snapshot.fixedStep);
      expect(Object.isFrozen(second.snapshot.presentation.structural)).toBe(true);
    } finally {
      separationSpy.mockRestore();
      advanceTreeSpy.mockRestore();
    }
  }, 180_000);

  it("creates deterministic state and returns immutable read snapshots without debug HUD data", () => {
    const first = runtime().read();
    const second = runtime().read();

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.fixedStep)).toBe(true);
    expect(Object.isFrozen(first.player)).toBe(true);
    expect(Object.isFrozen(first.presentation)).toBe(true);
    expect(Object.isFrozen(first.hud)).toBe(true);
    expect(Object.keys(first.hud).sort()).toEqual([
      "mode", "movementMode", "grounded", "energyJoules", "maximumEnergyJoules",
      "heatJoules", "maximumHeatJoules", "cooldownSeconds", "targetCondition",
      "weaponReadiness", "latestAction", "latestBlock"
    ].sort());
    expect(JSON.stringify(first.hud)).not.toMatch(/revision|hash|brick|worker/i);
  });

  it("freezes retained async Structural preparation latency at ReadyToAdopt", async () => {
    let nowMilliseconds = 100;
    let resolveRun!: (result: unknown) => void;
    const client = {
      readTelemetry: () => null,
      run: vi.fn(() => new Promise((resolve) => {
        resolveRun = resolve;
      }))
    } as unknown as NonNullable<SurfacePlayRuntimeOptions["preparedStructuralFireClient"]>;
    const sourceWorld = resolveHestiaSurfacePlayWorld();
    const authority = createSurfaceRegionVoxelAuthority(createHestiaSurfacePlayAuthorityInput(sourceWorld));
    const adopted = revalidateHestiaSurfacePlayWorld(authority, sourceWorld);
    if (adopted.status === "Rejected") throw new Error(adopted.failure.message);
    const spawn = resolveHestiaSurfacePlaySpawn(authority, adopted.world);
    const tree = adopted.world.encounter.structuralTrees[0];
    if (tree === undefined) throw new Error("Expected the Hestia Structural Tree fixture.");
    const treePosition = {
      x: (tree.rootQuantum.x + 0.5) * 0.125,
      z: (tree.rootQuantum.z + 0.5) * 0.125
    };
    const initialPlayerState = createSurfaceLocomotionState({
      ...spawn,
      positionMeters: Object.freeze({
        x: adopted.world.anchorCenterMeters.x,
        y: spawn.positionMeters.y,
        z: adopted.world.anchorCenterMeters.z
      }),
      yawRadians: Math.atan2(
        treePosition.x - adopted.world.anchorCenterMeters.x,
        treePosition.z - adopted.world.anchorCenterMeters.z
      )
    });
    const instance = createSurfacePlayRuntime({
      routeId: "surface-play-runtime-async-latency",
      initialPlayerState,
      authority,
      world: adopted.world,
      structuralFireMode: "AsyncPreparingV2",
      preparedStructuralFireClient: client,
      now: () => nowMilliseconds
    });

    const first = instance.advance(fixedDelta, (tick, state) => command(tick, state, { fire: true }));
    const queued = first.snapshot.hud.structuralPreparation;
    expect(queued?.status).toBe("Queued");
    nowMilliseconds = 1_100;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(client.run).toHaveBeenCalledOnce();
    const running = instance.read().hud.structuralPreparation;
    expect(running?.status).toBe("Running");
    expect(running?.latencyMilliseconds).toBe(1_000);

    nowMilliseconds = 2_500;
    resolveRun({ state: "Completed", ready: {} as never, workerEpoch: 1 });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const ready = instance.read().hud.structuralPreparation;
    expect(ready?.status).toBe("ReadyToAdopt");
    expect(ready?.latencyMilliseconds).toBe(2_400);
    const diagnostics = instance.read().preparedStructuralFireDiagnostics;
    expect(diagnostics.current).toBeNull();
    expect(diagnostics.lastCompleted).toMatchObject({
      phase: "Fire",
      status: "ReadyToAdopt",
      reason: "FixedTickAdoptionUnavailable",
      publication: { status: "Unavailable", atMilliseconds: null }
    });
    expect(diagnostics.lastCompleted?.runtime.readyToAdoptAtMilliseconds).toBe(2_500);
    nowMilliseconds = 102_500;
    expect(instance.read().hud.structuralPreparation?.latencyMilliseconds).toBe(2_400);
    expect(instance.read().appliedVoxelTransitions).toEqual([]);
    expect(instance.read().combat.energyJoules).toBe(240);
    instance.dispose?.();
  }, 180_000);

  it("passes the full Coast Tree authority to the async seed constructor", async () => {
    const sourceWorld = resolveHestiaSurfacePlayWorld(
      HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG,
      HESTIA_COAST_LUSH_PRESET_ID
    );
    const authority = createSurfaceRegionVoxelAuthority(
      createHestiaSurfacePlayAuthorityInput(sourceWorld, HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG)
    );
    const adopted = revalidateHestiaSurfacePlayWorld(authority, sourceWorld);
    if (adopted.status === "Rejected") throw new Error(adopted.failure.message);
    const receivedStates: Readonly<SurfaceTreeRuntimeState>[] = [];
    const worker = new PreparedStructuralFirePrivateWorkerRuntimeV2(1, () => {});
    const client = {
      hasPreparedSeed: () => false,
      prepareSeed: vi.fn(async ({ state, input }: PreparedStructuralFireWorkerSeedPreparationInput) => {
        receivedStates.push(state);
        return { state: "Prepared" as const, input: worker.prepareSeed(state, input) };
      }),
      run: async () => ({ state: "Completed", ready: {} as never, workerEpoch: 1 }),
      readTelemetry: () => null
    } as unknown as NonNullable<SurfacePlayRuntimeOptions["preparedStructuralFireClient"]>;
    const instance = createSurfacePlayRuntime({
      routeId: "surface-play-coast-async-v2",
      initialPlayerState: resolveHestiaSurfacePlaySpawn(authority, adopted.world),
      authority,
      world: adopted.world,
      structuralFireMode: "AsyncPreparingV2",
      preparedStructuralFireClient: client
    });

    try {
      await instance.warmPreparedStructuralFireSeed?.();
      expect(client.prepareSeed).toHaveBeenCalledOnce();
      expect(instance.read().preparedStructuralFireDiagnostics).toMatchObject({
        current: null,
        lastCompleted: { phase: "WarmSeed", status: "Completed" }
      });
      const receivedState = receivedStates[0];
      if (receivedState === undefined) throw new Error("Expected the async seed handoff state.");
      const brick = receivedState.authority.object.bricks[0];
      if (brick === undefined) throw new Error("Expected a Coast Structural Tree brick.");
      expect(typeof brick.key).toBe("object");
    } finally {
      instance.dispose?.();
    }
  }, 180_000);

  it("correlates overlapping prewarm diagnostics to the active operation", async () => {
    let nowMilliseconds = 0;
    const deferred: Array<{
      readonly input: ReturnType<typeof surfaceTreeRuntime.createSurfaceTreePreparedFireWorkerRunInput>;
      readonly resolve: (value: unknown) => void;
    }> = [];
    const client = {
      prepareSeed: vi.fn(({
        state,
        input
      }: PreparedStructuralFireWorkerSeedPreparationInput) => {
        const prepared = surfaceTreeRuntime.createSurfaceTreePreparedFireWorkerInput(state, input);
        if (prepared.seed === undefined) throw new Error("Expected a prewarm seed manifest.");
        const preparedInput = surfaceTreeRuntime.createSurfaceTreePreparedFireWorkerRunInput(
          state,
          input,
          prepared.seed.manifest
        );
        return new Promise<unknown>((resolve) => deferred.push({ input: preparedInput, resolve }));
      }),
      readTelemetry: () => null
    } as unknown as NonNullable<SurfacePlayRuntimeOptions["preparedStructuralFireClient"]>;
    const sourceWorld = resolveHestiaSurfacePlayWorld();
    const authority = createSurfaceRegionVoxelAuthority(createHestiaSurfacePlayAuthorityInput(sourceWorld));
    const adopted = revalidateHestiaSurfacePlayWorld(authority, sourceWorld);
    if (adopted.status === "Rejected") throw new Error(adopted.failure.message);
    const instance = createSurfacePlayRuntime({
      routeId: "surface-play-overlapping-prewarm-diagnostics",
      initialPlayerState: resolveHestiaSurfacePlaySpawn(authority, adopted.world),
      authority,
      world: adopted.world,
      structuralFireMode: "AsyncPreparingV2",
      preparedStructuralFireClient: client,
      now: () => nowMilliseconds
    });
    try {
      const first = instance.warmPreparedStructuralFireSeed?.();
      const second = instance.warmPreparedStructuralFireSeed?.();
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(deferred).toHaveLength(2);

      nowMilliseconds = 100;
      deferred[0]!.resolve({ state: "Prepared", input: deferred[0]!.input });
      await first;
      expect(instance.read().preparedStructuralFireDiagnostics.current?.phase).toBe("WarmSeed");
      expect(instance.read().preparedStructuralFireDiagnostics.lastCompleted).toBeNull();

      nowMilliseconds = 200;
      deferred[1]!.resolve({ state: "Prepared", input: deferred[1]!.input });
      await second;
      const diagnostics = instance.read().preparedStructuralFireDiagnostics;
      expect(diagnostics.current).toBeNull();
      expect(diagnostics.lastCompleted).toMatchObject({
        phase: "WarmSeed",
        status: "Completed"
      });
      expect(diagnostics.lastCompleted?.runtime.prewarmEndAtMilliseconds).toBe(200);
    } finally {
      instance.dispose?.();
    }
  }, 180_000);

  it("keeps a Fire trace when stale WarmSeed callbacks arrive around ReadyToAdopt", async () => {
    let nowMilliseconds = 0;
    let warmPreparedInput: ReturnType<typeof surfaceTreeRuntime.createSurfaceTreePreparedFireWorkerRunInput> | undefined;
    let resolveWarm!: (value: unknown) => void;
    let resolveFire!: (value: unknown) => void;
    let warmDiagnostics: ((value: unknown) => void) | undefined;
    let fireDiagnostics: ((value: unknown) => void) | undefined;
    const client = {
      prepareSeed: vi.fn((
        { state, input }: PreparedStructuralFireWorkerSeedPreparationInput,
        options?: Readonly<{ readonly observeDiagnostics?: (value: unknown) => void }>
      ) => {
        const prepared = surfaceTreeRuntime.createSurfaceTreePreparedFireWorkerInput(state, input);
        if (prepared.seed === undefined) throw new Error("Expected a prepared seed manifest.");
        const preparedInput = surfaceTreeRuntime.createSurfaceTreePreparedFireWorkerRunInput(
          state,
          input,
          prepared.seed.manifest
        );
        if (input.fireCommandId === "surface-tree-prewarm") {
          warmPreparedInput = preparedInput;
          warmDiagnostics = options?.observeDiagnostics;
          return new Promise<unknown>((resolve) => { resolveWarm = resolve; });
        }
        return Object.freeze({ state: "Prepared" as const, input: preparedInput });
      }),
      run: vi.fn((_input: unknown, options: Readonly<{
        readonly observeDiagnostics?: (value: unknown) => void;
      }>) => {
        fireDiagnostics = options.observeDiagnostics;
        return new Promise<unknown>((resolve) => { resolveFire = resolve; });
      }),
      readTelemetry: () => null
    } as unknown as NonNullable<SurfacePlayRuntimeOptions["preparedStructuralFireClient"]>;
    const sourceWorld = resolveHestiaSurfacePlayWorld();
    const authority = createSurfaceRegionVoxelAuthority(createHestiaSurfacePlayAuthorityInput(sourceWorld));
    const adopted = revalidateHestiaSurfacePlayWorld(authority, sourceWorld);
    if (adopted.status === "Rejected") throw new Error(adopted.failure.message);
    const spawn = resolveHestiaSurfacePlaySpawn(authority, adopted.world);
    const tree = adopted.world.encounter.structuralTrees[0];
    if (tree === undefined) throw new Error("Expected the Hestia Structural Tree fixture.");
    const treePosition = {
      x: (tree.rootQuantum.x + 0.5) * 0.125,
      z: (tree.rootQuantum.z + 0.5) * 0.125
    };
    const initialPlayerState = createSurfaceLocomotionState({
      ...spawn,
      positionMeters: Object.freeze({
        x: adopted.world.anchorCenterMeters.x,
        y: spawn.positionMeters.y,
        z: adopted.world.anchorCenterMeters.z
      }),
      yawRadians: Math.atan2(
        treePosition.x - adopted.world.anchorCenterMeters.x,
        treePosition.z - adopted.world.anchorCenterMeters.z
      )
    });
    const instance = createSurfacePlayRuntime({
      routeId: "surface-play-diagnostic-token-order",
      initialPlayerState,
      authority,
      world: adopted.world,
      structuralFireMode: "AsyncPreparingV2",
      preparedStructuralFireClient: client,
      now: () => nowMilliseconds
    });
    try {
      const before = instance.read();
      const warm = instance.warmPreparedStructuralFireSeed?.();
      expect(warm).toBeDefined();

      instance.advance(fixedDelta, (tick, state) => command(tick, state, { fire: true }));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(warmDiagnostics).toBeDefined();
      expect(fireDiagnostics).toBeDefined();

      fireDiagnostics?.({
        rootJobId: "fire:diagnostic-root",
        workerEpoch: 12,
        main: { executePostStartAtMilliseconds: 10 },
        worker: {
          clockDomain: "Worker",
          prepareSeed: null,
          execute: {
            receiptAtMilliseconds: 20,
            computeStartedAtMilliseconds: 21,
            computeCompletedAtMilliseconds: 24,
            computeDurationMilliseconds: 3
          }
        },
        seedCanonicalBytes: 5,
        resultCanonicalBytes: 7,
        structuredCloneBytes: null
      });
      warmDiagnostics?.({
        rootJobId: "warm:stale-root",
        workerEpoch: 99,
        main: { prepareSeedStartAtMilliseconds: 900 },
        worker: {
          clockDomain: "Worker",
          prepareSeed: {
            receiptAtMilliseconds: 901,
            computeStartedAtMilliseconds: 902,
            computeCompletedAtMilliseconds: 903,
            computeDurationMilliseconds: 1
          },
          execute: null
        },
        seedCanonicalBytes: 99,
        resultCanonicalBytes: null,
        structuredCloneBytes: null
      });
      expect(instance.read().preparedStructuralFireDiagnostics.current).toMatchObject({
        phase: "Fire",
        rootJobId: "fire:diagnostic-root",
        workerEpoch: 12,
        seedCanonicalBytes: 5
      });
      expect(instance.read().preparedStructuralFireDiagnostics.lastCompleted).toBeNull();

      nowMilliseconds = 100;
      resolveFire({ state: "Completed", ready: {} as never, workerEpoch: 12 });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const ready = instance.read().preparedStructuralFireDiagnostics;
      expect(ready.current).toBeNull();
      expect(ready.lastCompleted).toMatchObject({
        phase: "Fire",
        status: "ReadyToAdopt",
        rootJobId: "fire:diagnostic-root",
        workerEpoch: 12,
        seedCanonicalBytes: 5,
        resultCanonicalBytes: 7,
        worker: { execute: { receiptAtMilliseconds: 20, computeDurationMilliseconds: 3 } }
      });

      warmDiagnostics?.({
        rootJobId: "warm:late-root",
        workerEpoch: 100,
        main: { prepareSeedEndAtMilliseconds: 1_000 },
        worker: null,
        seedCanonicalBytes: 100,
        resultCanonicalBytes: null,
        structuredCloneBytes: null
      });
      resolveWarm({ state: "Prepared", input: warmPreparedInput });
      await warm;
      const afterWarm = instance.read();
      expect(afterWarm.preparedStructuralFireDiagnostics.lastCompleted).toMatchObject({
        phase: "Fire",
        status: "ReadyToAdopt",
        rootJobId: "fire:diagnostic-root",
        workerEpoch: 12,
        seedCanonicalBytes: 5,
        resultCanonicalBytes: 7
      });
      expect(afterWarm.authorityState).toBe(before.authorityState);
      expect(afterWarm.appliedVoxelTransitions).toEqual([]);
      expect(afterWarm.latestVoxelTransition).toBeNull();
      expect(afterWarm.combat.energyJoules).toBe(before.combat.energyJoules);
    } finally {
      instance.dispose?.();
    }
  }, 180_000);

  it("reuses the warmed seed across physics ticks and keeps the real hit bound", async () => {
    const sourceWorld = resolveHestiaSurfacePlayWorld();
    const authority = createSurfaceRegionVoxelAuthority(createHestiaSurfacePlayAuthorityInput(sourceWorld));
    const adopted = revalidateHestiaSurfacePlayWorld(authority, sourceWorld);
    if (adopted.status === "Rejected") throw new Error(adopted.failure.message);
    const spawn = resolveHestiaSurfacePlaySpawn(authority, adopted.world);
    const tree = adopted.world.encounter.structuralTrees[0];
    if (tree === undefined) throw new Error("Expected the Hestia Structural Tree fixture.");
    const treePosition = {
      x: (tree.rootQuantum.x + 0.5) * 0.125,
      z: (tree.rootQuantum.z + 0.5) * 0.125
    };
    const initialPlayerState = createSurfaceLocomotionState({
      ...spawn,
      positionMeters: Object.freeze({
        x: adopted.world.anchorCenterMeters.x,
        y: spawn.positionMeters.y,
        z: adopted.world.anchorCenterMeters.z
      }),
      yawRadians: Math.atan2(
        treePosition.x - adopted.world.anchorCenterMeters.x,
        treePosition.z - adopted.world.anchorCenterMeters.z
      )
    });
    const seedState = surfaceTreeRuntime.createSurfaceTreeRuntimeState(
      createHestiaUmbrellaTree(tree),
      createSurfaceRigidBodyWorld({
        simulationTick: 0,
        gravityMetersPerSecondSquared: config.gravityMetersPerSecondSquared,
        terrainColliders: []
      })
    );
    const seedCell = seedState.collision.cells[0];
    if (seedCell === undefined) throw new Error("Expected a Structural Tree collision cell.");
    const seedHit = Object.freeze({
      address: seedCell.address,
      materialId: seedCell.materialId,
      semanticKey: seedCell.semanticKey,
      pointMeters: Object.freeze({
        x: (seedCell.minMeters.x + seedCell.maxMeters.x) / 2,
        y: (seedCell.minMeters.y + seedCell.maxMeters.y) / 2,
        z: (seedCell.minMeters.z + seedCell.maxMeters.z) / 2
      }),
      normal: Object.freeze({ x: 0, y: 1, z: 0 })
    });
    const seedInput = surfaceTreeRuntime.createSurfaceTreePreparedFireWorkerInput(seedState, {
      fireCommandId: "surface-tree-seed-test",
      hit: seedHit,
      simulationTick: 0
    });
    if (seedInput.seed === undefined) throw new Error("Expected a seed manifest fixture.");
    const preparedSeedInput = Object.freeze({
      request: seedInput.request,
      command: seedInput.command,
      previousChainHash: seedInput.previousChainHash,
      seedManifest: seedInput.seed.manifest
    });
    const prepareSeed = vi.fn(async (
      request: Readonly<{ readonly input: Readonly<{ readonly fireCommandId: string }> }>
    ) => ({
      state: "Prepared" as const,
      input: Object.freeze({
        ...preparedSeedInput,
        command: Object.freeze({
          ...preparedSeedInput.command,
          fireCommandId: request.input.fireCommandId,
          structuralCommandId: `surface-tree-edit:${request.input.fireCommandId}`
        })
      })
    }));
    const runInputs: unknown[] = [];
    const client = {
      hasPreparedSeed: vi.fn(() => true),
      prepareSeed,
      run: vi.fn(async (input: unknown) => {
        runInputs.push(input);
        return { state: "Completed", ready: {} as never, workerEpoch: 1 };
      }),
      readTelemetry: () => null
    } as unknown as NonNullable<SurfacePlayRuntimeOptions["preparedStructuralFireClient"]>;
    const fullInputSpy = vi.spyOn(surfaceTreeRuntime, "createSurfaceTreePreparedFireWorkerInput");
    const instance = createSurfacePlayRuntime({
      routeId: "surface-play-runtime-async-seed-cache",
      initialPlayerState,
      authority,
      world: adopted.world,
      structuralFireMode: "AsyncPreparingV2",
      preparedStructuralFireClient: client
    });
    try {
      await instance.warmPreparedStructuralFireSeed?.();
      fullInputSpy.mockClear();
      for (let step = 0; step < 20; step += 1) {
        instance.advance(fixedDelta, (tick, state) => command(tick, state));
      }
      instance.advance(fixedDelta, (tick, state) => command(tick, state, { fire: true }));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(prepareSeed).toHaveBeenCalledTimes(1);
      expect(fullInputSpy).not.toHaveBeenCalled();
      expect(runInputs).toHaveLength(1);
      expect(runInputs[0]).toMatchObject({
        command: {
          fireCommandId: expect.any(String),
          structuralCommandId: expect.stringContaining("surface-tree-edit:"),
          simulationTick: 21
        }
      });
      expect((runInputs[0] as { readonly command: { readonly fireCommandId: string } })
        .command.fireCommandId).not.toBe("surface-tree-seed-test");
    } finally {
      fullInputSpy.mockRestore();
      instance.dispose?.();
    }
  }, 180_000);

  it("performs zero, one, and multiple catch-up steps with one command per tick and residual accumulation", () => {
    const instance = runtime();
    const ticks: number[] = [];
    const factory = (tick: number, state: Readonly<SurfaceLocomotionState>) => {
      ticks.push(tick);
      return command(tick, state);
    };

    expect(instance.advance(0, factory).steps).toBe(0);
    expect(instance.advance(fixedDelta / 2, factory).steps).toBe(0);
    expect(instance.read().fixedStep.accumulatorSeconds).toBeCloseTo(fixedDelta / 2, 12);
    expect(instance.advance(fixedDelta / 2, factory).steps).toBe(1);
    expect(instance.advance(fixedDelta * 3 + fixedDelta / 4, factory).steps).toBe(3);
    expect(ticks).toEqual([1, 2, 3, 4]);
    expect(instance.read().fixedStep.accumulatorSeconds).toBeCloseTo(fixedDelta / 4, 12);
  });

  it("updates locomotion before combat and advances cooldown before evaluating fire", () => {
    const initialCombat = combatState({
      weapon: createHestiaPulseCutterState({ cooldownSeconds: fixedDelta })
    });
    const instance = runtime({ initialCombatState: initialCombat });
    const result = instance.advance(fixedDelta, (tick, state) => command(tick, state, {
      moveAxes: { forward: 1, right: 0 },
      fire: true
    }));

    expect(result.snapshot.player.positionMeters.z).toBeGreaterThan(8);
    expect(result.snapshot.presentation.weapon.muzzlePositionMeters)
      .toEqual(result.snapshot.firstPersonView.eyePositionMeters);
    expect(result.snapshot.combat.latestFireResult).toMatchObject({ status: "Accepted" });
    expect(result.snapshot.combat.energyJoules).toBe(228);
    expect(result.snapshot.combat.heatJoules).toBe(18);
  });

  it("uses Combat Core ordering for drone damage and destruction without presentation-authored integrity", () => {
    const initial = combatState();
    const initialCombatState = combatState({
      drone: Object.freeze({
        ...initial.drone,
        mode: "Damaged",
        damageable: createDamageableSnapshot({
          targetEntityId: initial.drone.damageable.targetEntityId,
          armor: {
            ...initial.drone.damageable.armor,
            current: 0
          },
          hull: {
            ...initial.drone.damageable.hull,
            current: 15
          },
          modules: initial.drone.damageable.modules
        })
      })
    });
    const instance = runtime({ initialCombatState });
    const result = instance.advance(fixedDelta, (tick, state) => command(tick, state, { fire: true }));

    expect(result.snapshot.combat.target).toMatchObject({ condition: "Destroyed", integrity: 0 });
    expect(result.snapshot.combat.events.map((event) => event.kind)).toEqual([
      "FireAccepted", "TargetDamaged", "TargetDestroyed"
    ]);
    expect(result.snapshot.presentation.target.condition).toBe("Destroyed");
    expect(result.snapshot.presentation.target).not.toHaveProperty("integrity");
  });

  it.each([
    [0.1875, 2],
    [-0.1875, -2]
  ])("maps terrain hit x=%s to deterministic half-even SubtractSphere quantum %s", (x, expectedQuantum) => {
    const capture: { intent: Readonly<SurfaceVoxelEditIntent> | null } = { intent: null };
    const { result } = fireOneTerrainShot((_authority, intent) => {
      capture.intent = intent;
      throw new Error("intent capture");
    }, x);

    expect(result.snapshot.combat.latestFireResult).toMatchObject({ status: "Accepted", hit: "Terrain" });
    expect(capture.intent).toMatchObject({
      operation: "SubtractSphere",
      centerGlobalQuantum: { x: expectedQuantum },
      quantumMeters: 0.125,
      radiusMeters: 0.75
    });
    expect(capture.intent?.editId).toBe(`surface-edit:surface-play-runtime-integration:1:1`);
  });

  it("adopts Applied authority, plans remesh, refreshes collision, and advances the next tick", () => {
    const { instance, result } = fireOneTerrainShot((authority, intent) => applySurfaceVoxelEdit(
      authority,
      knownInteriorIntent(authority, intent, {})
    ));

    expect(result.snapshot.latestVoxelTransition?.result.status).toBe("Applied");
    expect(result.snapshot.latestVoxelTransition?.remeshPlan?.status).toBe("Planned");
    expect(result.snapshot.authorityState.regionRevision).toBe(1);
    expect(result.snapshot.presentation.terrain.regionRevision).toBe(1);
    const remeshPlan = result.snapshot.latestVoxelTransition?.remeshPlan;
    if (remeshPlan?.status !== "Planned") throw new Error("Expected a planned remesh transition.");
    const materialized = remeshPlan.orderedRemeshKeys.map((key) => instance.materializeBrick(key));
    expect(materialized.some((brick) => brick?.regionRevision === 1)).toBe(true);
    expect(materialized.every((brick) => brick === undefined || brick.regionRevision === 1)).toBe(true);
    expect(instance.materializeBrick("brick:outside-resident-coverage")).toBeUndefined();

    const next = instance.advance(fixedDelta, (tick, state) => command(tick, state));
    expect(next.status).toBe("Advanced");
    expect(next.steps).toBe(1);
    expect(next.snapshot.player.simulationTick).toBe(2);
  });

  it("adopts journaled NoChange without fake deformation or remesh work", () => {
    const { before, result } = fireOneTerrainShot((authority, intent) => applySurfaceVoxelEdit(
      authority,
      knownInteriorIntent(authority, intent, {
        centerGlobalQuantum: { x: 0, y: -4, z: 64 },
        radiusMeters: 0.125
      })
    ));

    expect(result.snapshot.latestVoxelTransition?.result.status).toBe("NoChange");
    expect(result.snapshot.latestVoxelTransition?.remeshPlan).toBeNull();
    expect(result.snapshot.authorityState.regionRevision).toBe(1);
    expect(result.snapshot.authorityState.editRevision).toBe(0);
    expect(result.snapshot.authorityState.currentVoxelContentHash)
      .toBe(before.authorityState.currentVoxelContentHash);
    expect(result.snapshot.presentation.terrain.regionRevision).toBe(1);
  });

  it.each([
    ["stale", "StaleRevision", "The terrain state changed. Aim again."],
    ["invalid", "AuthorityRefused", "The terrain cut could not be applied. Aim at a stable surface."],
    ["thrown", "AuthorityRefused", "The terrain cut could not be applied. Aim at a stable surface."]
  ] as const)("keeps rejected %s terrain edits fail-closed with typed player feedback", (kind, code, playerCopy) => {
    const apply = (authority: SurfaceRegionVoxelAuthority, intent: Readonly<SurfaceVoxelEditIntent>) => {
      if (kind === "thrown") throw new Error("authority offline");
      if (kind === "stale") {
        return applySurfaceVoxelEdit(authority, { ...intent, expectedRegionRevision: authority.state.regionRevision + 1 });
      }
      return applySurfaceVoxelEdit(authority, { ...intent, mesh: {} } as unknown as SurfaceVoxelEditIntent);
    };
    const { before, result } = fireOneTerrainShot(apply);

    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]).toMatchObject({ kind: "VoxelEdit", code, simulationTick: 1 });
    expect(result.snapshot.latestRejection).toEqual(result.rejections[0]);
    expect(result.snapshot.hud.latestBlock).toBe(playerCopy);
    expect(result.snapshot.hud.latestBlock).not.toBe(result.rejections[0].message);
    expect(result.snapshot.authorityState).toBe(before.authorityState);
    expect(result.snapshot.presentation.terrain).toEqual(before.presentation.terrain);
    expect(result.snapshot.hud.latestAction).toBe(before.hud.latestAction);
  });

  it("maps a real duplicate edit refusal without adopting its transition", () => {
    const journalIntent: SurfaceVoxelEditIntent = {
      schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
      editId: "edit:runtime-duplicate",
      expectedRegionRevision: 0,
      tick: 1,
      actorId: "surface-player:runtime-integration",
      sourceId: "hestia.pulse-cutter.v1",
      sourceImpactIntentId: "impact:runtime-duplicate",
      bodyId: baseAuthority.state.bodyId,
      surfaceFrameId: baseAuthority.state.surfaceFrameId,
      regionId: baseAuthority.state.regionId,
      operation: "SubtractSphere",
      centerGlobalQuantum: { x: 0, y: -4, z: 64 },
      quantumMeters: 0.125,
      radiusMeters: 0.125
    };
    const journaled = applySurfaceVoxelEdit(baseAuthority, journalIntent);
    expect(journaled.result.status).toBe("NoChange");
    const instance = createSurfacePlayRuntime({
      routeId: "surface-play-runtime-duplicate",
      initialPlayerState: downwardPlayer(0),
      initialCombatState: combatState({}, { x: 12, y: 10, z: 12 }),
      authority: journaled.authority,
      applyVoxelEdit: (authority, intent) => applySurfaceVoxelEdit(authority, {
        ...intent,
        editId: journalIntent.editId
      })
    });
    const before = instance.read();
    const result = instance.advance(fixedDelta, (tick, state) => command(tick, state, { fire: true }));

    expect(result.rejections[0]).toMatchObject({ kind: "VoxelEdit", code: "DuplicateCommand" });
    expect(result.snapshot.authorityState).toBe(before.authorityState);
    expect(result.snapshot.presentation.terrain).toEqual(before.presentation.terrain);
    expect(result.snapshot.hud.latestAction).toBe(before.hud.latestAction);
  });
});

const bindingFor = (state: Readonly<SurfaceRegionVoxelState>, simulationTick = 7) => ({
  bodyId: state.bodyId,
  regionId: state.regionId,
  surfaceFrameId: state.surfaceFrameId,
  regionRevision: state.regionRevision,
  simulationTick
});

const densityAdapter = (
  classify: (position: Readonly<{ x: number; y: number; z: number }>) => "Solid" | "Air"
): SurfaceRegionVoxelCollisionAdapter => ({
  sampleDensity: (_binding, position) => {
    const classification = classify(position);
    return {
      status: "Resolved",
      density: classification === "Solid" ? -1 : 1,
      materialValue: classification === "Solid" ? 1 : 0,
      classification,
      regionRevision: baseAuthority.state.regionRevision,
      editRevision: baseAuthority.state.editRevision
    };
  },
  sampleSolidAir: () => { throw new Error("unused"); },
  raycast: () => { throw new Error("unused"); },
  queryGround: () => { throw new Error("unused"); }
});

describe("density-backed Surface Play collision delegate", () => {
  it("resolves ground, ray, and line hits with outward normals and bounded misses", () => {
    const state = baseAuthority.state;
    const delegate = createSurfaceVoxelCollisionDelegate(densityAdapter((point) => point.y <= -1 ? "Solid" : "Air"), state);
    const binding = bindingFor(state);
    const capsule = { radiusMeters: 0.35, heightMeters: 1.8 };
    const ground = delegate.queryGroundContact(createSurfaceGroundContactQuery({
      ...binding,
      queryId: "collision:ground",
      kind: "GroundContact",
      capsule,
      positionMeters: { x: 0, y: 0.9, z: 8 },
      maximumDistanceMeters: 2
    }));
    const ray = delegate.queryRay(createSurfaceRayQuery({
      ...binding,
      queryId: "collision:ray",
      kind: "Ray",
      originMeters: { x: 0, y: 1, z: 8 },
      direction: { x: 0, y: -1, z: 0 },
      maximumDistanceMeters: 3
    }));
    const line = delegate.queryLine(createSurfaceLineQuery({
      ...binding,
      queryId: "collision:line",
      kind: "Line",
      startMeters: { x: 0, y: 1, z: 8 },
      endMeters: { x: 0, y: -2, z: 8 }
    }));
    const outside = delegate.queryRay(createSurfaceRayQuery({
      ...binding,
      queryId: "collision:outside",
      kind: "Ray",
      originMeters: { x: 40, y: 1, z: 8 },
      direction: { x: 0, y: -1, z: 0 },
      maximumDistanceMeters: 3
    }));

    for (const result of [ground, ray, line]) {
      expect(result).toMatchObject({ status: "Resolved", contact: { normal: { x: 0, y: 1, z: 0 } } });
    }
    expect(ground.status === "Resolved" ? ground.contact?.distanceMeters : null).toBeCloseTo(1, 3);
    expect(outside).toMatchObject({ status: "Resolved", contact: null });
  });

  it("uses full-height capsule centers, reports wall sweeps, and handles zero displacement", () => {
    const state = baseAuthority.state;
    const delegate = createSurfaceVoxelCollisionDelegate(densityAdapter((point) => point.x >= 4 ? "Solid" : "Air"), state);
    const binding = bindingFor(state);
    const capsule = { radiusMeters: 0.35, heightMeters: 1.8 };
    const hit = delegate.sweepCapsule(createSurfaceCapsuleSweepQuery({
      ...binding,
      queryId: "collision:capsule-hit",
      kind: "CapsuleSweep",
      capsule,
      startPositionMeters: { x: 2, y: -4, z: 8 },
      displacementMeters: { x: 4, y: 0, z: 0 }
    }));
    const still = delegate.sweepCapsule(createSurfaceCapsuleSweepQuery({
      ...binding,
      queryId: "collision:capsule-still",
      kind: "CapsuleSweep",
      capsule,
      startPositionMeters: { x: 2, y: -4, z: 8 },
      displacementMeters: { x: 0, y: 0, z: 0 }
    }));

    expect(hit).toMatchObject({
      status: "Resolved",
      contact: { normal: { x: -1, y: 0, z: 0 } }
    });
    expect(hit.status === "Resolved" ? hit.fraction : 1).toBeGreaterThan(0);
    expect(hit.status === "Resolved" ? hit.fraction : 0).toBeLessThan(1);
    expect(still).toEqual({ status: "Resolved", queryId: "collision:capsule-still", fraction: 1, contact: null });
  });

  it("fails closed when the density authority reports a stale revision", () => {
    const state = baseAuthority.state;
    const stale: SurfaceRegionVoxelCollisionAdapter = {
      ...densityAdapter(() => "Air"),
      sampleDensity: () => ({
        status: "Rejected",
        reason: "StaleRevision",
        message: "stale density revision",
        regionRevision: state.regionRevision + 1,
        editRevision: state.editRevision
      })
    };
    const delegate = createSurfaceVoxelCollisionDelegate(stale, state);
    const result = delegate.queryRay(createSurfaceRayQuery({
      ...bindingFor(state),
      queryId: "collision:stale",
      kind: "Ray",
      originMeters: { x: 0, y: -1, z: 8 },
      direction: { x: 0, y: -1, z: 0 },
      maximumDistanceMeters: 1
    }));

    expect(result).toEqual({
      status: "Rejected",
      queryId: "collision:stale",
      code: "StaleRevision",
      message: "stale density revision"
    });
  });
});
