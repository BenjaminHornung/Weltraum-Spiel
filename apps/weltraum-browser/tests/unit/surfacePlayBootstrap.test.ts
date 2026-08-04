import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { backendRevision, renderCommandResult } from "../../src/presentation";
import {
  createSurfaceGroundContactQuery,
  createSurfacePlayerCommand,
  createSurfaceStructuralPresentationSnapshot,
  type SurfacePlayerCommand
} from "../../src/surface-play/contracts";
import {
  createHestiaAgileGroundedLocomotionPresetV1,
  createSurfaceLocomotionState
} from "../../src/surface-play/player";
import {
  readActiveSurfacePlaySnapshot,
  resolveHestiaSurfacePlaySpawn,
  startSurfacePlay,
  type SurfacePlayBootstrapDependencies
} from "../../src/surface-play/surfacePlayBootstrap";
import { createSurfaceVoxelCollisionDelegate } from "../../src/surface-play/surfacePlayCollision";
import { HESTIA_SURFACE_PLAY_V1_CONFIG } from "../../src/surface-play/surfacePlayConfig";
import {
  presentSurfacePlayFailure,
  presentSurfacePlayLoading,
  SURFACE_PLAY_LOADING_PHASES,
  startSurfacePlayRoute
} from "../../src/surface-play/surfacePlayFailurePresenter";
import type {
  SurfacePlayRuntime,
  SurfacePlayRuntimeSnapshot
} from "../../src/surface-play/surfacePlayRuntime";
import {
  createSurfaceRegionVoxelAuthority,
  createSurfaceRegionVoxelCollisionAdapter,
  type SurfaceRegionVoxelAuthority
} from "../../src/surface-play/voxel-edit";
import type { HestiaSurfaceWorldFacts } from "../../src/surface-play/world";

class FakeElement extends EventTarget {
  id = "";
  className = "";
  textContent = "";
  hidden = false;
  type = "";
  readonly dataset: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  parent: FakeElement | undefined;

  constructor(readonly tagName: string) { super(); }

  append(...children: FakeElement[]): void {
    children.forEach((child) => { child.parent = this; });
    this.children.push(...children);
  }

  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  remove(): void {
    if (this.parent === undefined) return;
    const index = this.parent.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
    this.parent = undefined;
  }
}

const findById = (element: FakeElement, id: string): FakeElement | null => {
  if (element.id === id) return element;
  for (const child of element.children) {
    const match = findById(child, id);
    if (match !== null) return match;
  }
  return null;
};

class FakeDocument extends EventTarget {
  readonly body = new FakeElement("body");
  readonly head = new FakeElement("head");
  readonly host = new FakeElement("main");
  readonly canvas = new FakeElement("canvas");
  readonly listenerTotals = new Map<string, number>();
  pointerLockElement: unknown = null;
  visibilityState: DocumentVisibilityState = "visible";

  constructor() {
    super();
    this.body.append(this.host, this.canvas);
  }

  querySelector(selector: string): FakeElement | null {
    if (selector === "#app") return this.host;
    if (selector === "#debug-scene") return this.canvas;
    return selector.startsWith("#") ? findById(this.body, selector.slice(1)) : null;
  }

  createElement(tagName: string): FakeElement { return new FakeElement(tagName); }
  createElementNS(_namespace: string, tagName: string): FakeElement { return new FakeElement(tagName); }
  exitPointerLock(): void { this.pointerLockElement = null; }

  public override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, listener, options);
    this.listenerTotals.set(type, (this.listenerTotals.get(type) ?? 0) + 1);
  }

  public override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void {
    super.removeEventListener(type, listener, options);
    this.listenerTotals.set(type, Math.max(0, (this.listenerTotals.get(type) ?? 0) - 1));
  }
}

class FakeWindow extends EventTarget {
  innerWidth = 1280;
  innerHeight = 720;
  devicePixelRatio = 1;
  readonly animationFrames = new Map<number, FrameRequestCallback>();
  readonly listenerTotals = new Map<string, number>();
  #nextAnimationFrame = 1;

  public override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, listener, options);
    this.listenerTotals.set(type, (this.listenerTotals.get(type) ?? 0) + 1);
  }

  public override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void {
    super.removeEventListener(type, listener, options);
    this.listenerTotals.set(type, Math.max(0, (this.listenerTotals.get(type) ?? 0) - 1));
  }

  requestAnimationFrame(callback: FrameRequestCallback): number {
    const id = this.#nextAnimationFrame++;
    this.animationFrames.set(id, callback);
    return id;
  }

  cancelAnimationFrame(id: number): void { this.animationFrames.delete(id); }

  runAnimationFrame(timestamp: number): void {
    const entry = this.animationFrames.entries().next().value as [number, FrameRequestCallback] | undefined;
    if (entry === undefined) throw new Error("Expected a scheduled animation frame.");
    this.animationFrames.delete(entry[0]);
    entry[1](timestamp);
  }
}

const descendants = (element: FakeElement): FakeElement[] =>
  element.children.flatMap((child) => [child, ...descendants(child)]);

const mouseEvent = (type: string, button: number): Event =>
  Object.assign(new Event(type), { button });

const keyboardEvent = (code: string, repeat = false): Event =>
  Object.assign(new Event("keydown", { cancelable: true }), { code, repeat });

const fixedDeltaSeconds = createHestiaAgileGroundedLocomotionPresetV1().fixedDeltaSeconds;

const createPlayerState = (simulationTick = 0) => createSurfaceLocomotionState({
  playerId: "surface-player:test",
  surfaceFrameId: HESTIA_SURFACE_PLAY_V1_CONFIG.surfaceFrameId,
  positionMeters: { x: 8, y: 1, z: 8 },
  velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
  yawRadians: Math.PI,
  pitchRadians: 0,
  grounded: true,
  groundNormal: { x: 0, y: 1, z: 0 },
  movementMode: "Walk",
  capsule: createHestiaAgileGroundedLocomotionPresetV1().capsule,
  simulationTick,
  jumpHeld: false
});

const createStructuralFallSnapshot = (simulationTick: number) =>
  createSurfaceStructuralPresentationSnapshot({
    bodyId: HESTIA_SURFACE_PLAY_V1_CONFIG.bodyId,
    regionId: HESTIA_SURFACE_PLAY_V1_CONFIG.regionId,
    surfaceFrameId: HESTIA_SURFACE_PLAY_V1_CONFIG.surfaceFrameId,
    regionRevision: 0,
    objects: [{
      objectId: "object:test.detached-tree",
      treeInstanceId: "tree:test.detached-tree",
      speciesId: "test.detached-tree.v1",
      objectRevision: 2,
      editRevision: 2,
      contentHash: "fnv1a64-v1:1111111111111111",
      componentIds: [],
      meshArtifactId: "mesh:test.detached-tree:2"
    }],
    components: [],
    bodySources: [{
      componentId: "component:test.detached-tree.crown",
      sourceFragmentId: "fragment:test.detached-tree.crown",
      bodyId: "body:test.detached-tree.crown",
      objectId: "object:test.detached-tree",
      sourceObjectRevision: 1,
      sourceContentHash: "fnv1a64-v1:1111111111111111",
      colliderRevision: 1,
      meshArtifactId: "mesh:test.detached-tree.crown"
    }],
    dynamicBodies: [{
      bodyId: "body:test.detached-tree.crown",
      componentId: "component:test.detached-tree.crown",
      objectId: "object:test.detached-tree",
      sourceObjectRevision: 1,
      sourceContentHash: "fnv1a64-v1:1111111111111111",
      lifecycle: "Falling",
      positionMeters: { x: 4, y: 12 - simulationTick * 0.1, z: 2 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      linearVelocityMetersPerSecond: { x: 0, y: -simulationTick * 0.1, z: 0 },
      angularVelocityRadiansPerSecond: { x: 0, y: 0.1, z: 0 },
      colliderRevision: 1,
      simulationTick
    }],
    latestTransition: null,
    physicsFailure: null,
    simulationTick
  });

const createSnapshot = (
  player = createPlayerState(),
  accumulatorSeconds = 0,
  structural = null as ReturnType<typeof createStructuralFallSnapshot> | null
): Readonly<SurfacePlayRuntimeSnapshot> => Object.freeze({
  authorityState: Object.freeze({ regionRevision: 0 }),
  fixedStep: Object.freeze({
    previousState: player,
    currentState: player,
    accumulatorSeconds,
    interpolationAlpha: accumulatorSeconds / fixedDeltaSeconds
  }),
  player,
  presentation: Object.freeze({
    structural
  }),
  combat: Object.freeze({
    events: Object.freeze([]),
    latestFireResult: null
  }),
  hud: Object.freeze({
    mode: "SURFACE PLAY",
    movementMode: player.movementMode,
    grounded: player.grounded,
    latestAction: null,
    latestBlock: null
  }),
  latestVoxelTransition: null,
  latestRejection: null
} as unknown as SurfacePlayRuntimeSnapshot);

const createWorldFacts = (): Readonly<HestiaSurfaceWorldFacts> => ({
  identity: {
    bodyId: HESTIA_SURFACE_PLAY_V1_CONFIG.bodyId,
    regionId: HESTIA_SURFACE_PLAY_V1_CONFIG.regionId,
    surfaceFrameId: HESTIA_SURFACE_PLAY_V1_CONFIG.surfaceFrameId,
    regionRevision: 0
  },
  anchorCenterMeters: { x: 64, y: 10.820156477200054, z: -32 },
  verticalBand: { minimumMeters: 0, maximumExclusiveMeters: 32 },
  brickBounds: HESTIA_SURFACE_PLAY_V1_CONFIG.brickBounds,
  residentBrickCoordinates: HESTIA_SURFACE_PLAY_V1_CONFIG.residentBrickCoordinates,
  traversalDomain: {
    identity: {
      bodyId: HESTIA_SURFACE_PLAY_V1_CONFIG.bodyId,
      regionId: HESTIA_SURFACE_PLAY_V1_CONFIG.regionId,
      surfaceFrameId: HESTIA_SURFACE_PLAY_V1_CONFIG.surfaceFrameId,
      regionRevision: 0
    },
    gridSizeMeters: 0.5,
    gridOriginMeters: { x: 40, z: -56 },
    gridCounts: { x: 97, z: 97 },
    residentInsetBoundsMeters: { minInclusive: { x: 40, z: -56 }, maxExclusive: { x: 88, z: -8 } },
    componentBoundsMeters: {
      minInclusive: { x: 40, z: -56 },
      maxExclusive: { x: 88, z: -8 },
      size: { x: 48, z: 48 }
    },
    spawnGridCell: { gridX: 48, gridZ: 48 },
    spawnPerimeterDistanceMeters: 12,
    cells: []
  },
  shoreBoundary: {
    identity: {
      bodyId: HESTIA_SURFACE_PLAY_V1_CONFIG.bodyId,
      regionId: HESTIA_SURFACE_PLAY_V1_CONFIG.regionId,
      surfaceFrameId: HESTIA_SURFACE_PLAY_V1_CONFIG.surfaceFrameId,
      regionRevision: 0
    },
    gridSizeMeters: 0.5,
    gridOriginMeters: { x: 40, z: -56 },
    gridCounts: { x: 97, z: 97 },
    residentInsetBoundsMeters: { minInclusive: { x: 40, z: -56 }, maxExclusive: { x: 88, z: -8 } },
    dryCellKeys: []
  },
  waterSurfaceHeightMeters: 0,
  environment: {
    identity: {
      bodyId: HESTIA_SURFACE_PLAY_V1_CONFIG.bodyId,
      regionId: HESTIA_SURFACE_PLAY_V1_CONFIG.regionId,
      surfaceFrameId: HESTIA_SURFACE_PLAY_V1_CONFIG.surfaceFrameId,
      regionRevision: 0
    },
    rootSeed: HESTIA_SURFACE_PLAY_V1_CONFIG.seed,
    voxelSizeMeters: HESTIA_SURFACE_PLAY_V1_CONFIG.voxelSizeMeters,
    residentBrickCoordinates: HESTIA_SURFACE_PLAY_V1_CONFIG.residentBrickCoordinates,
    waterSurfaceHeightMeters: 0,
    anchorCenterMeters: { x: 64, y: 10.820156477200054, z: -32 },
    decorativePopulation: [],
    waterPatches: []
  },
  encounter: {
    surveyDronePositionMeters: { x: 64, y: 12.440156477200054, z: -44 },
    structuralTrees: [{
      instanceId: "hestia.surface-play.umbrella.phase2",
      seed: "hestia.surface-play.umbrella.phase2-seed",
      rootQuantum: { x: 464, y: 86, z: -336 }
    }]
  }
} as Readonly<HestiaSurfaceWorldFacts>);

interface HarnessOptions {
  readonly spawnFailure?: Error;
  readonly runtimeFailure?: Error;
  readonly commandsPerAdvance?: number;
  readonly fixedStepScheduler?: boolean;
}

const harness = (options: HarnessOptions = {}) => {
  const documentPort = new FakeDocument();
  const windowPort = new FakeWindow();
  const authority = { state: { surfaceFrameId: HESTIA_SURFACE_PLAY_V1_CONFIG.surfaceFrameId } } as SurfaceRegionVoxelAuthority;
  const world = createWorldFacts();
  const player = createPlayerState();
  let snapshot = Object.freeze({ ...createSnapshot(player), world }) as Readonly<SurfacePlayRuntimeSnapshot>;
  const commands: Readonly<SurfacePlayerCommand>[] = [];
  const advanceStepCounts: number[] = [];
  let simulationTick = 0;
  let accumulatorSeconds = 0;
  let currentPlayer = player;
  let inputHeld = true;
  let pointerLocked = true;
  let uiBlocked = false;
  let uiIntent: (() => void) | undefined;
  let materializeBinding: ((key: string) => unknown) | undefined;
  let runtimeAuthority: SurfaceRegionVoxelAuthority | undefined;
  const lifecycle = {
    input: 0,
    pointer: 0,
    ui: 0,
    presentation: 0,
    backend: 0
  };

  const backend = {
    resize: vi.fn(),
    dispatch: vi.fn((_command: unknown) => {
      lifecycle.backend += 1;
      return renderCommandResult("Accepted");
    }),
    readDiagnostics: vi.fn(() => ({
      acceptedArtifacts: 0,
      rejectedArtifacts: 0,
      activeRepresentations: 0,
      activeFallbacks: 0,
      geometryAllocations: 0,
      geometryDisposals: 0,
      materialAllocations: 0,
      materialDisposals: 0,
      estimatedGpuBytes: 0,
      ownedCpuBytes: 0,
      replacementCount: 0,
      removeCount: 0,
      staleRejectCount: 0,
      resetCount: 0,
      evictionCount: 0,
      evictionRejectCount: 0,
      rehydrationCount: 0,
      renderTargetAllocations: 0,
      renderTargetDisposals: 0,
      activeRenderTargets: 0,
      backendRevision: backendRevision(0),
      backendState: "Available",
      residentRepresentationKeys: [],
      visibleRepresentationKeys: [],
      pinnedFallbackRepresentationKeys: []
    }))
  };
  let runtime!: SurfacePlayRuntime;
  const materializeBrick = vi.fn(function (this: unknown, _key: string) {
    if (this !== runtime) throw new Error("materializeBrick lost its runtime binding.");
    return undefined;
  });
  const resolveStructuralMeshArtifact = vi.fn(function (this: unknown, _meshArtifactId: string) {
    if (this !== runtime) throw new Error("resolveStructuralMeshArtifact lost its runtime binding.");
    return undefined;
  });
  runtime = {
    read: vi.fn(() => snapshot),
    materializeBrick,
    resolveStructuralMeshArtifact,
    advance: vi.fn((elapsedSeconds: number, commandFactory: Parameters<SurfacePlayRuntime["advance"]>[1]) => {
      let steps = options.commandsPerAdvance ?? 1;
      if (options.fixedStepScheduler) {
        accumulatorSeconds += elapsedSeconds;
        steps = 0;
        while (accumulatorSeconds + 1e-12 >= fixedDeltaSeconds) {
          simulationTick += 1;
          commands.push(commandFactory(simulationTick, currentPlayer));
          currentPlayer = createPlayerState(simulationTick);
          accumulatorSeconds -= fixedDeltaSeconds;
          if (Math.abs(accumulatorSeconds) <= 1e-12) accumulatorSeconds = 0;
          steps += 1;
        }
        snapshot = Object.freeze({
          ...createSnapshot(
            currentPlayer,
            accumulatorSeconds,
            simulationTick === 0 ? null : createStructuralFallSnapshot(simulationTick)
          ),
          world
        }) as Readonly<SurfacePlayRuntimeSnapshot>;
      } else {
        for (let index = 0; index < steps; index += 1) {
          simulationTick += 1;
          commands.push(commandFactory(simulationTick, player));
        }
      }
      advanceStepCounts.push(steps);
      return { status: "Advanced" as const, steps, snapshot, rejections: [] };
    })
  };
  const createAuthority = vi.fn(() => {
    expect(documentPort.body.dataset.surfacePlayState).toBe("loading");
    return authority;
  });
  const resolveWorld = vi.fn(() => world);
  const revalidateWorld = vi.fn(() => ({ status: "Selected" as const, world }));
  const resolveSpawn = vi.fn(() => {
    if (options.spawnFailure !== undefined) throw options.spawnFailure;
    return player;
  });
  const createBackend = vi.fn(() => backend);
  const createRuntime = vi.fn((runtimeOptions: { readonly authority: SurfaceRegionVoxelAuthority }) => {
    runtimeAuthority = runtimeOptions.authority;
    if (options.runtimeFailure !== undefined) throw options.runtimeFailure;
    return runtime;
  });
  const present = vi.fn();
  const presentStructural = vi.fn();
  const render = vi.fn();
  const createPresentation = vi.fn((presentationOptions: { readonly materializeBrick: (key: string) => unknown }) => {
    materializeBinding = presentationOptions.materializeBrick;
    return {
      present,
      presentStructural,
      render,
      dispose: vi.fn(() => { lifecycle.presentation += 1; })
    };
  });
  const consumeCommand = vi.fn((request: { playerId: string; surfaceFrameId: string; simulationTick: number }) =>
    createSurfacePlayerCommand({
      ...request,
      moveAxes: { forward: inputHeld ? 1 : 0, right: 0 },
      lookDeltaRadians: { yaw: 0, pitch: 0 },
      sprint: false,
      crouch: null,
      jump: false,
      fire: false,
      pointerLockIntent: "Unchanged",
      reset: "None"
    }));
  const clearHeldInputs = vi.fn(() => { inputHeld = false; });
  const createInput = vi.fn(() => ({
    consumeCommand,
    clearHeldInputs,
    dispose: vi.fn(() => { lifecycle.input += 1; })
  }));
  const requestPointerLock = vi.fn();
  const createPointerLock = vi.fn(() => ({
    request: requestPointerLock,
    release: vi.fn(),
    isLocked: () => pointerLocked,
    readSnapshot: () => ({ state: pointerLocked ? "Locked" : "Unlocked", locked: pointerLocked, error: null }),
    dispose: vi.fn(() => { lifecycle.pointer += 1; })
  }));
  const createUi = vi.fn((uiOptions: { readonly onIntent: () => void }) => {
    uiIntent = uiOptions.onIntent;
    return {
      update: vi.fn(),
      isPlayerInputBlocked: () => uiBlocked,
      dispose: vi.fn(() => { lifecycle.ui += 1; })
    };
  });
  const waitForNextPaint = vi.fn(async () => undefined);
  const dependencies = {
    documentPort,
    windowPort,
    createAuthority,
    resolveWorld,
    revalidateWorld,
    resolveSpawn,
    createBackend,
    createRuntime,
    createPresentation,
    createInput,
    createPointerLock,
    createUi,
    waitForNextPaint
  } as unknown as Partial<SurfacePlayBootstrapDependencies>;

  return {
    advanceStepCounts,
    authority,
    backend,
    commands,
    consumeCommand,
    createAuthority,
    resolveWorld,
    revalidateWorld,
    createBackend,
    createInput,
    createPointerLock,
    createPresentation,
    createRuntime,
    createUi,
    dependencies,
    documentPort,
    lifecycle,
    materializeBinding: () => materializeBinding,
    present,
    presentStructural,
    render,
    requestPointerLock,
    resolveSpawn,
    runtime,
    runtimeAuthority: () => runtimeAuthority,
    setPointerLocked: (locked: boolean) => { pointerLocked = locked; },
    setUiBlocked: (blocked: boolean) => { uiBlocked = blocked; },
    uiIntent: () => uiIntent,
    waitForNextPaint,
    windowPort,
    world
  };
};

describe("Surface Play authoritative spawn", () => {
  it("resolves a finite grounded state exactly from the authority query in the same frame", () => {
    const authority = createSurfaceRegionVoxelAuthority(HESTIA_SURFACE_PLAY_V1_CONFIG);
    const state = resolveHestiaSurfacePlaySpawn(authority);
    const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
    const collision = createSurfaceVoxelCollisionDelegate(
      createSurfaceRegionVoxelCollisionAdapter(authority),
      authority.state
    );
    const query = collision.queryGroundContact(createSurfaceGroundContactQuery({
      queryId: "surface-spawn:hestia-surface-play-v1:0",
      kind: "GroundContact",
      bodyId: authority.state.bodyId,
      regionId: authority.state.regionId,
      surfaceFrameId: authority.state.surfaceFrameId,
      regionRevision: authority.state.regionRevision,
      simulationTick: 0,
      capsule: locomotion.capsule,
      positionMeters: { x: 64, y: 33 + locomotion.capsule.heightMeters / 2, z: -32 },
      maximumDistanceMeters: 34
    }));

    expect(query.status).toBe("Resolved");
    if (query.status !== "Resolved" || query.contact === null) throw new Error("Expected authoritative spawn contact.");
    expect(state.surfaceFrameId).toBe(authority.state.surfaceFrameId);
    expect(state.grounded).toBe(true);
    expect(state.positionMeters).toEqual({
      x: 64,
      y: query.contact.pointMeters.y + locomotion.capsule.heightMeters / 2,
      z: -32
    });
    expect(state.groundNormal).toEqual(query.contact.normal);
    expect(Object.values(state.positionMeters).every(Number.isFinite)).toBe(true);
    expect(Object.values(state.velocityMetersPerSecond).every(Number.isFinite)).toBe(true);
  }, 30_000);
});

describe("Surface Play bootstrap lifecycle", () => {
  it("starts and disposes the final worker client only for the explicit async-v2 mode", async () => {
    const source = harness();
    const client = {
      start: vi.fn(async () => undefined),
      dispose: vi.fn(async () => undefined)
    };
    const handle = await startSurfacePlay({
      ...source.dependencies,
      structuralFireMode: "AsyncPreparingV2",
      createPreparedStructuralFireClient: () => client as never
    });

    expect(client.start).toHaveBeenCalledOnce();
    expect(source.createRuntime).toHaveBeenCalledWith(expect.objectContaining({
      structuralFireMode: "AsyncPreparingV2",
      preparedStructuralFireClient: client
    }));
    handle.dispose();
    expect(client.dispose).toHaveBeenCalledOnce();
  });

  it("publishes real monotonic startup phases and their completed-work percentages", async () => {
    const source = harness();
    const observations: Array<Readonly<{ phase: string; percentage: string }>> = [];
    source.waitForNextPaint.mockImplementation(async () => {
      const loading = findById(source.documentPort.body, "surface-play-loading");
      observations.push({
        phase: loading?.dataset.phase ?? "missing",
        percentage: loading?.dataset.progressPercentage ?? "missing"
      });
    });

    const handle = await startSurfacePlay(source.dependencies);

    expect(observations).toEqual([
      { phase: "preparing-world", percentage: "14" },
      { phase: "materializing-terrain", percentage: "29" },
      { phase: "resolving-spawn", percentage: "43" },
      { phase: "starting-runtime", percentage: "57" },
      { phase: "preparing-presentation", percentage: "71" },
      { phase: "connecting-controls", percentage: "86" }
    ]);
    expect(findById(source.documentPort.body, "surface-play-loading")).toBeNull();
    expect(source.documentPort.body.dataset.surfacePlayState).toBe("ready");
    handle.dispose();
  });

  it("exposes only the newest active immutable Runtime snapshot and clears it by owner", async () => {
    expect(readActiveSurfacePlaySnapshot()).toBeNull();
    const first = harness();
    const second = harness();
    const firstHandle = await startSurfacePlay(first.dependencies);
    expect(readActiveSurfacePlaySnapshot()).toBe(first.runtime.read());

    const secondHandle = await startSurfacePlay(second.dependencies);
    expect(readActiveSurfacePlaySnapshot()).toBe(second.runtime.read());

    firstHandle.dispose();
    expect(readActiveSurfacePlaySnapshot()).toBe(second.runtime.read());
    secondHandle.dispose();
    expect(readActiveSurfacePlaySnapshot()).toBeNull();
  });

  it("contains spawn rejection as an inert accessible failure with idempotent cleanup", async () => {
    const source = harness({ spawnFailure: new Error("synthetic spawn rejection") });
    const handle = await startSurfacePlay(source.dependencies);

    expect(handle.runtime).toBeUndefined();
    expect(source.documentPort.body.dataset).toMatchObject({
      uiSurface: "surface-play",
      surfacePlayState: "failed"
    });
    expect(source.createRuntime).not.toHaveBeenCalled();
    expect(source.createPresentation).not.toHaveBeenCalled();
    expect(source.createInput).not.toHaveBeenCalled();
    expect(source.createBackend).not.toHaveBeenCalled();
    expect(source.windowPort.animationFrames.size).toBe(0);
    const alert = descendants(source.documentPort.host).find((element) => element.getAttribute("role") === "alert");
    expect(alert?.id).toBe("surface-play-failure");
    expect(alert?.getAttribute("aria-live")).toBe("assertive");
    expect(descendants(alert!).map((element) => element.textContent).join(" ")).toContain("synthetic spawn rejection");

    handle.dispose();
    handle.dispose();
    expect(descendants(source.documentPort.host).some((element) => element.id === "surface-play-failure")).toBe(false);
    expect(source.lifecycle).toEqual({ input: 0, pointer: 0, ui: 0, presentation: 0, backend: 0 });
    expect(source.documentPort.body.dataset).toEqual({});
  });

  it("wires the sole authority, presentation, UI intent, datasets, and viewport resize", async () => {
    const source = harness();
    const handle = await startSurfacePlay(source.dependencies);

    expect(handle.runtime).toBe(source.runtime);
    expect(source.documentPort.canvas.getAttribute("aria-label")).toBe("Hestia surface viewport");
    expect(source.documentPort.body.dataset).toEqual({
      uiSurface: "surface-play",
      surfacePlayState: "ready",
      locomotionState: "idle"
    });
    expect(source.createAuthority).toHaveBeenCalledOnce();
    expect(source.createAuthority).toHaveBeenCalledWith(HESTIA_SURFACE_PLAY_V1_CONFIG);
    expect(source.resolveSpawn).toHaveBeenCalledWith(
      source.authority,
      expect.objectContaining({ anchorCenterMeters: { x: 64, y: 10.820156477200054, z: -32 } })
    );
    expect(source.createRuntime).toHaveBeenCalledOnce();
    expect(source.runtimeAuthority()).toBe(source.authority);
    expect(source.createPresentation).toHaveBeenCalledWith(expect.objectContaining({
      initialSnapshot: expect.objectContaining({ world: source.world })
    }));
    source.materializeBinding()?.("brick:test");
    expect(source.runtime.materializeBrick).toHaveBeenCalledWith("brick:test");
    expect(source.requestPointerLock).not.toHaveBeenCalled();
    source.uiIntent()?.();
    expect(source.requestPointerLock).toHaveBeenCalledOnce();
    expect(source.backend.resize).toHaveBeenLastCalledWith(1280, 720, 1);

    source.windowPort.innerWidth = 900;
    source.windowPort.innerHeight = 500;
    source.windowPort.devicePixelRatio = 2;
    source.windowPort.dispatchEvent(new Event("resize"));
    expect(source.backend.resize).toHaveBeenLastCalledWith(900, 500, 2);

    handle.dispose();
  });

  it("bounds catch-up debt per RAF and publishes each authoritative falling pose while it drains", async () => {
    const source = harness({ fixedStepScheduler: true });
    const handle = await startSurfacePlay(source.dependencies);
    const halfFixedFrameMilliseconds = fixedDeltaSeconds * 500;
    const debtFrameTimestamp = 1_000 + halfFixedFrameMilliseconds + 250;

    source.windowPort.runAnimationFrame(1_000);
    source.windowPort.runAnimationFrame(1_000 + halfFixedFrameMilliseconds);
    expect(source.runtime.read().fixedStep.accumulatorSeconds).toBeCloseTo(fixedDeltaSeconds / 2, 12);
    source.advanceStepCounts.length = 0;
    source.present.mockClear();
    source.presentStructural.mockClear();
    source.render.mockClear();

    source.windowPort.dispatchEvent(mouseEvent("mousedown", 0));
    source.windowPort.runAnimationFrame(debtFrameTimestamp);
    expect(source.present).toHaveBeenCalledOnce();
    expect(source.render).toHaveBeenCalledOnce();
    expect(source.advanceStepCounts).toEqual([4]);

    source.windowPort.dispatchEvent(mouseEvent("mouseup", 0));
    source.windowPort.dispatchEvent(mouseEvent("mousedown", 0));
    source.windowPort.runAnimationFrame(debtFrameTimestamp);
    source.windowPort.runAnimationFrame(debtFrameTimestamp);
    source.windowPort.runAnimationFrame(debtFrameTimestamp);

    expect(source.advanceStepCounts).toEqual([4, 4, 4, 3]);
    expect(source.commands.map((command) => command.simulationTick))
      .toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
    expect(source.commands.filter((command) => command.fire).map((command) => command.simulationTick))
      .toEqual([1, 5]);
    expect(source.present).toHaveBeenCalledTimes(4);
    expect(source.render).toHaveBeenCalledTimes(4);
    const fallingSnapshots = source.presentStructural.mock.calls
      .map(([snapshot]) => snapshot as ReturnType<typeof createStructuralFallSnapshot>);
    expect(fallingSnapshots.map((snapshot) => snapshot.simulationTick)).toEqual([4, 8, 12, 15]);
    expect(new Set(fallingSnapshots.map((snapshot) => snapshot.dynamicBodies[0]?.positionMeters.y)).size).toBe(4);
    expect(fallingSnapshots.every((snapshot) => Object.isFrozen(snapshot))).toBe(true);

    source.windowPort.runAnimationFrame(debtFrameTimestamp);
    expect(source.advanceStepCounts).toEqual([4, 4, 4, 3, 0]);
    expect(source.commands).toHaveLength(15);
    expect(source.runtime.read().fixedStep.accumulatorSeconds).toBeCloseTo(fixedDeltaSeconds / 2, 12);
    handle.dispose();
  });

  it("keeps normal 60 Hz cadence at one ordered input command per rendered frame", async () => {
    const source = harness({ fixedStepScheduler: true });
    const handle = await startSurfacePlay(source.dependencies);
    const startTimestamp = 2_000;
    const fixedFrameMilliseconds = fixedDeltaSeconds * 1_000;

    source.windowPort.runAnimationFrame(startTimestamp);
    source.advanceStepCounts.length = 0;
    source.present.mockClear();
    source.windowPort.runAnimationFrame(startTimestamp + fixedFrameMilliseconds);
    source.windowPort.runAnimationFrame(startTimestamp + fixedFrameMilliseconds * 2);

    expect(source.advanceStepCounts).toEqual([1, 1]);
    expect(source.commands.map((command) => ({
      simulationTick: command.simulationTick,
      moveAxes: command.moveAxes
    }))).toEqual([
      { simulationTick: 1, moveAxes: { forward: 1, right: 0 } },
      { simulationTick: 2, moveAxes: { forward: 1, right: 0 } }
    ]);
    expect(source.present).toHaveBeenCalledTimes(2);
    handle.dispose();
  });

  it("consumes one command per tick, latches fire once while locked, and clears blocked input", async () => {
    const source = harness({ commandsPerAdvance: 2 });
    const handle = await startSurfacePlay(source.dependencies);

    source.windowPort.dispatchEvent(mouseEvent("mousedown", 0));
    source.windowPort.runAnimationFrame(1_000);
    expect(source.consumeCommand).toHaveBeenCalledTimes(2);
    expect(source.commands.map((command) => command.simulationTick)).toEqual([1, 2]);
    expect(source.commands.map((command) => command.fire)).toEqual([true, false]);

    source.windowPort.runAnimationFrame(1_016);
    expect(source.commands.slice(2).map((command) => command.fire)).toEqual([false, false]);

    source.setPointerLocked(false);
    source.documentPort.dispatchEvent(new Event("pointerlockchange"));
    source.windowPort.dispatchEvent(mouseEvent("mousedown", 0));
    source.windowPort.runAnimationFrame(1_032);
    expect(source.commands.slice(4).every((command) => command.moveAxes.forward === 0 && !command.fire)).toBe(true);

    source.setPointerLocked(true);
    source.windowPort.dispatchEvent(mouseEvent("mousedown", 0));
    source.setUiBlocked(true);
    source.windowPort.runAnimationFrame(1_048);
    expect(source.commands.slice(6).every((command) => command.moveAxes.forward === 0 && !command.fire)).toBe(true);

    handle.dispose();
  });

  it("toggles the hidden diagnostics overlay with non-repeated F1 while preserving player commands", async () => {
    const source = harness();
    const handle = await startSurfacePlay(source.dependencies);
    const overlay = findById(source.documentPort.body, "surface-play-debug-overlay");

    expect(overlay?.hidden).toBe(true);
    expect(overlay?.dataset.visible).toBe("false");

    const movementKey = keyboardEvent("KeyW");
    source.windowPort.dispatchEvent(movementKey);
    expect(movementKey.defaultPrevented).toBe(false);

    const show = keyboardEvent("F1");
    source.windowPort.dispatchEvent(show);
    expect(show.defaultPrevented).toBe(true);
    expect(overlay?.hidden).toBe(false);
    expect(overlay?.dataset.visible).toBe("true");

    source.windowPort.dispatchEvent(keyboardEvent("F1", true));
    expect(overlay?.hidden).toBe(false);

    source.windowPort.dispatchEvent(mouseEvent("mousedown", 0));
    source.windowPort.runAnimationFrame(1_000);
    expect(source.commands.at(-1)).toMatchObject({
      moveAxes: { forward: 1, right: 0 },
      fire: true
    });

    source.windowPort.dispatchEvent(keyboardEvent("F1"));
    expect(overlay?.hidden).toBe(true);
    expect(source.commands).toHaveLength(1);
    handle.dispose();
  });

  it("reads backend diagnostics only while the F1 overlay is visible", async () => {
    const source = harness();
    const handle = await startSurfacePlay(source.dependencies);
    const overlay = findById(source.documentPort.body, "surface-play-debug-overlay");
    const initialReadCount = source.backend.readDiagnostics.mock.calls.length;

    source.windowPort.runAnimationFrame(1_000);
    source.windowPort.runAnimationFrame(1_016);
    expect(source.backend.readDiagnostics).toHaveBeenCalledTimes(initialReadCount);
    expect(overlay?.dataset.sampleCount).toBe("0");

    source.windowPort.dispatchEvent(keyboardEvent("F1"));
    source.windowPort.runAnimationFrame(1_032);
    expect(source.backend.readDiagnostics).toHaveBeenCalledTimes(initialReadCount + 1);
    expect(overlay?.dataset.sampleCount).toBe("1");

    source.windowPort.dispatchEvent(keyboardEvent("F1"));
    source.windowPort.runAnimationFrame(1_048);
    expect(source.backend.readDiagnostics).toHaveBeenCalledTimes(initialReadCount + 1);
    expect(overlay?.dataset.sampleCount).toBe("1");
    handle.dispose();
  });

  it("removes listeners, cancels RAF, and disposes every owned adapter exactly once", async () => {
    const source = harness();
    const handle = await startSurfacePlay(source.dependencies);
    expect(source.windowPort.animationFrames.size).toBe(1);

    source.windowPort.dispatchEvent(new Event("pagehide"));
    handle.dispose();
    expect(source.windowPort.animationFrames.size).toBe(0);
    expect([...source.windowPort.listenerTotals.values()].every((total) => total === 0)).toBe(true);
    expect([...source.documentPort.listenerTotals.values()].every((total) => total === 0)).toBe(true);
    expect(source.lifecycle).toEqual({ input: 1, pointer: 1, ui: 1, presentation: 1, backend: 0 });
    expect(source.documentPort.body.dataset).toEqual({});
    expect(findById(source.documentPort.body, "surface-play-debug-overlay")).toBeNull();
  });

  it("disposes a backend when runtime construction fails after backend creation", async () => {
    const source = harness({ runtimeFailure: new Error("synthetic runtime construction failure") });
    const handle = await startSurfacePlay(source.dependencies);

    expect(handle.runtime).toBeUndefined();
    expect(source.createBackend).toHaveBeenCalledOnce();
    expect(source.createPresentation).not.toHaveBeenCalled();
    expect(source.backend.dispatch).toHaveBeenCalledOnce();
    expect(source.backend.dispatch.mock.calls[0]?.[0]).toMatchObject({ kind: "DisposeBackend" });
    expect(source.lifecycle.backend).toBe(1);
    handle.dispose();
    handle.dispose();
    expect(source.lifecycle.backend).toBe(1);
  });
});

describe("Surface Play route containment", () => {
  it("explicitly allowlists the F1 diagnostics overlay as a direct Surface Play route child", () => {
    const style = readFileSync(new URL("../../src/style.css", import.meta.url), "utf8");
    const containmentSelector = style.match(
      /body\[data-ui-surface="surface-play"\] #app > [^{]+\{/u
    )?.[0];

    expect(containmentSelector).toContain(":not(#surface-play-debug-overlay)");
  });

  it("uses an accessible determinate loader, completes explicitly, and rejects phase regression", () => {
    const documentPort = new FakeDocument();
    const loading = presentSurfacePlayLoading(documentPort as unknown as Document);
    const progress = descendants(loading.root as unknown as FakeElement)
      .find((element) => element.getAttribute("role") === "progressbar");
    const fill = descendants(loading.root as unknown as FakeElement)
      .find((element) => element.className === "surface-play-loading__fill");

    expect(loading.root.getAttribute("role")).toBe("status");
    expect(loading.root.getAttribute("aria-busy")).toBe("true");
    expect(progress?.getAttribute("aria-valuemin")).toBe("0");
    expect(progress?.getAttribute("aria-valuemax")).toBe("100");
    expect(progress?.getAttribute("aria-valuenow")).toBe("0");
    expect(progress?.getAttribute("aria-valuetext")).toBe("Loading surface systems — 0%");
    expect(fill?.getAttribute("style")).toBe("width: 0%");
    loading.update("preparing-world");
    expect(loading.root.dataset.phase).toBe("preparing-world");
    expect(loading.root.dataset.progressPercentage).toBe("14");
    expect(progress?.getAttribute("aria-valuenow")).toBe("14");
    expect(progress?.getAttribute("aria-valuetext")).toBe("Selecting dry Hestia terrain — 14%");
    expect(fill?.getAttribute("style")).toBe("width: 14%");
    loading.update("preparing-world");
    expect(loading.root.dataset.progressPercentage).toBe("14");
    expect(() => loading.update("loading-module")).toThrow("must be monotonic");
    expect(() => loading.complete()).toThrow("final phase");
    for (const phase of SURFACE_PLAY_LOADING_PHASES.slice(2)) loading.update(phase.id);
    expect(loading.root.dataset.progressPercentage).toBe("86");
    loading.complete();
    loading.complete();
    expect(loading.root.dataset.progressPercentage).toBe("100");
    expect(progress?.getAttribute("aria-valuenow")).toBe("100");
    expect(progress?.getAttribute("aria-valuetext")).toBe("Connecting suit controls — 100%");
    expect(fill?.getAttribute("style")).toBe("width: 100%");
    expect(loading.root.getAttribute("aria-busy")).toBe("false");
    loading.dispose();
    loading.dispose();
    expect(findById(documentPort.body, "surface-play-loading")).toBeNull();
  });

  it("publishes 100 percent only after a successful route bootstrap and before removal", async () => {
    const documentPort = new FakeDocument();
    let loadingRoot: FakeElement | undefined;

    await startSurfacePlayRoute(documentPort as unknown as Document, async () => ({
      startSurfacePlay: async ({ loading } = {}) => {
        if (loading === undefined) throw new Error("Expected route-owned loading handle.");
        loadingRoot = loading.root as unknown as FakeElement;
        for (const phase of SURFACE_PLAY_LOADING_PHASES.slice(1)) loading.update(phase.id);
        loading.dispose();
        expect(loadingRoot.parent).toBeDefined();
        return { runtime: {} };
      }
    }));

    const progress = descendants(loadingRoot!)
      .find((element) => element.getAttribute("role") === "progressbar");
    expect(loadingRoot?.dataset.progressPercentage).toBe("100");
    expect(progress?.getAttribute("aria-valuenow")).toBe("100");
    expect(loadingRoot?.parent).toBeUndefined();
  });

  it("publishes loading before import/start and contains a rejected route start", async () => {
    const documentPort = new FakeDocument();
    const observations: string[] = [];
    let loadingRoot: FakeElement | undefined;

    await startSurfacePlayRoute(documentPort as unknown as Document, async () => {
      observations.push(documentPort.body.dataset.surfacePlayState);
      observations.push(findById(documentPort.body, "surface-play-loading")?.dataset.phase ?? "missing");
      return {
        startSurfacePlay: async ({ loading } = {}) => {
          loadingRoot = loading?.root as unknown as FakeElement;
          observations.push(documentPort.body.dataset.surfacePlayState);
          observations.push(findById(documentPort.body, "surface-play-loading")?.dataset.phase ?? "missing");
          throw new Error("synthetic route failure");
        }
      };
    });

    expect(observations).toEqual(["loading", "loading-module", "loading", "preparing-world"]);
    expect(loadingRoot?.dataset.progressPercentage).toBe("14");
    expect(documentPort.body.dataset).toMatchObject({ uiSurface: "surface-play", surfacePlayState: "failed" });
    expect(findById(documentPort.body, "surface-play-loading")).toBeNull();
    const alert = descendants(documentPort.host).find((element) => element.id === "surface-play-failure");
    expect(alert?.getAttribute("role")).toBe("alert");
    expect(descendants(alert!).map((element) => element.textContent).join(" ")).toContain("synthetic route failure");
  });

  it("keeps Surface Play ahead of Surface Lab and normal runtime without a TestBridge dependency", () => {
    const main = readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
    const playBranch = main.indexOf("if (isSurfacePlayQuery(searchParams))");
    const labBranch = main.indexOf("else if (isSurfaceLabQuery(searchParams))");
    const normalBranch = main.lastIndexOf("startNormalRuntime();");
    expect(playBranch).toBeGreaterThan(-1);
    expect(labBranch).toBeGreaterThan(playBranch);
    expect(normalBranch).toBeGreaterThan(labBranch);

    const sourceRoot = new URL("../../src/surface-play/", import.meta.url);
    const sourceFiles = (directory: URL): URL[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const target = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      return entry.isDirectory() ? sourceFiles(target) : entry.name.endsWith(".ts") ? [target] : [];
    });
    const surfacePlaySource = sourceFiles(sourceRoot)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(surfacePlaySource).not.toContain("TestBridge");
  });

  it("presents a non-Error route failure without claiming playable state", () => {
    const documentPort = new FakeDocument();
    const root = presentSurfacePlayFailure(documentPort as unknown as Document, "offline");
    expect(root.getAttribute("role")).toBe("alert");
    expect(documentPort.body.dataset.surfacePlayState).toBe("failed");
    expect(descendants(root as unknown as FakeElement).map((element) => element.textContent).join(" "))
      .toContain("Surface Play initialization failed.");
  });

  it("styles the determinate fill without a looping loading animation", () => {
    const style = readFileSync(new URL("../../src/style.css", import.meta.url), "utf8");
    expect(style).toContain(".surface-play-loading__fill");
    expect(style).not.toContain("@keyframes surface-play-loading-scan");
  });
});
