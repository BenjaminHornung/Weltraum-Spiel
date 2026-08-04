import { backendRevision, createRenderCommand } from "../presentation";
import { ThreeRenderBackend } from "../render/three/backend";
import { VOXEL_BRICK_CELL_DIMENSIONS, surfaceFrameId, voxelBodyId, voxelRegionId } from "../voxel";
import { HESTIA_SEA_LEVEL_METERS } from "../world-generation/hestia";
import {
  HESTIA_COAST_LUSH_PRESET_ID,
  HESTIA_PRESET_ID,
  type HestiaGeneratorProfile
} from "../world-generation/hestia";
import {
  createSurfaceGroundContactQuery,
  createSurfacePlayerCommand,
  type SurfacePlayerCommand
} from "./contracts";
import {
  createHestiaAgileGroundedLocomotionPresetV1,
  createSurfaceDomInputAdapter,
  createSurfaceLocomotionState,
  createSurfacePointerLockController,
  type SurfaceDomInputAdapter,
  type SurfaceLocomotionState,
  type SurfacePointerLockController,
  type SurfacePointerLockDocumentPort,
  type SurfacePointerLockTarget
} from "./player";
import {
  HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
  HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG,
  HESTIA_SURFACE_PLAY_V1_CONFIG,
  createHestiaSurfacePlayAuthorityInput
} from "./surfacePlayConfig";
import { createSurfaceVoxelCollisionDelegate } from "./surfacePlayCollision";
import {
  createSurfacePlayPresentation,
  type SurfacePlayPresentation
} from "./surfacePlayPresentation";
import {
  createSurfacePlayRuntime,
  type SurfaceStructuralFireMode,
  type SurfacePlayRuntime,
  type SurfacePlayRuntimeSnapshot
} from "./surfacePlayRuntime";
import { PreparedStructuralFireWorkerClient } from "./workers/preparedStructuralFireWorkerClient";
import {
  presentSurfacePlayFailure,
  presentSurfacePlayLoading,
  type SurfacePlayLoadingHandle,
  type SurfacePlayLoadingPhase
} from "./surfacePlayFailurePresenter";
import { createSurfacePlayUi, type SurfacePlayUi } from "./ui";
import {
  createSurfacePlayDebugOverlay,
  type SurfacePlayDebugOverlay
} from "./ui/surfacePlayDebugOverlay";
import {
  createSurfaceRegionVoxelAuthority,
  createSurfaceRegionVoxelCollisionAdapter,
  type SurfaceRegionVoxelAuthorityInput,
  type SurfaceRegionVoxelAuthority
} from "./voxel-edit";
import {
  createHestiaSourceGroundProbe,
  adoptHestiaSurfaceWorldAgainstAuthority,
  selectHestiaSurfaceWorld,
  type HestiaSurfaceWorldFacts
} from "./world";

const ROUTE_ID = "hestia-surface-play-v1";
const PLAYER_ID = `surface-player:${ROUTE_ID}`;
const MAXIMUM_FRAME_DELTA_SECONDS = 0.25;
const MAXIMUM_FIXED_STEPS_PER_FRAME = 4;

export interface SurfacePlayBootstrapHandle {
  readonly runtime: SurfacePlayRuntime | undefined;
  dispose(): void;
}

interface ActiveSurfacePlayRuntime {
  readonly owner: object;
  readonly runtime: SurfacePlayRuntime;
}

let activeSurfacePlayRuntime: ActiveSurfacePlayRuntime | undefined;

export const readActiveSurfacePlaySnapshot = (
): Readonly<SurfacePlayRuntimeSnapshot> | null =>
  activeSurfacePlayRuntime?.runtime.read() ?? null;

interface SurfacePlayPointerFactoryOptions {
  readonly viewport: HTMLCanvasElement;
  readonly documentPort: Document;
  readonly windowPort: Window;
}

export interface SurfacePlayBootstrapDependencies {
  readonly documentPort: Document;
  readonly windowPort: Window;
  readonly createAuthority: typeof createSurfaceRegionVoxelAuthority;
  readonly resolveWorld: typeof resolveHestiaSurfacePlayWorld;
  readonly revalidateWorld: typeof revalidateHestiaSurfacePlayWorld;
  readonly resolveSpawn: typeof resolveHestiaSurfacePlaySpawn;
  readonly createBackend: (options: ConstructorParameters<typeof ThreeRenderBackend>[0]) => ThreeRenderBackend;
  readonly createRuntime: typeof createSurfacePlayRuntime;
  readonly createPreparedStructuralFireClient: () => PreparedStructuralFireWorkerClient;
  readonly createPresentation: typeof createSurfacePlayPresentation;
  readonly createInput: typeof createSurfaceDomInputAdapter;
  readonly createPointerLock: (options: SurfacePlayPointerFactoryOptions) => SurfacePointerLockController;
  readonly createUi: typeof createSurfacePlayUi;
  readonly waitForNextPaint: () => Promise<void>;
}

export type SurfacePlayBootstrapOptions = Partial<SurfacePlayBootstrapDependencies>
  & Readonly<{
    loading?: SurfacePlayLoadingHandle;
    structuralFireMode?: SurfaceStructuralFireMode;
  }>;

const clearSurfacePlayDataset = (body: HTMLElement): void => {
  delete body.dataset.surfacePlayState;
  delete body.dataset.locomotionState;
  if (body.dataset.uiSurface === "surface-play") delete body.dataset.uiSurface;
};

export const resolveHestiaSurfacePlayWorld = (
  config: Readonly<SurfaceRegionVoxelAuthorityInput> = HESTIA_SURFACE_PLAY_V1_CONFIG,
  profile: HestiaGeneratorProfile = HESTIA_PRESET_ID
): Readonly<HestiaSurfaceWorldFacts> => {
  const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
  const probe = createHestiaSourceGroundProbe({
    fieldIdentity: {
      profile,
      rootSeed: config.seed,
      bodyId: voxelBodyId(config.bodyId),
      surfaceFrameId: surfaceFrameId(config.surfaceFrameId),
      regionId: voxelRegionId(config.regionId),
      voxelSizeMeters: config.voxelSizeMeters
    },
    capsule: locomotion.capsule,
    collisionSkinMeters: locomotion.collisionSkinMeters
  });
  const selection = selectHestiaSurfaceWorld({
    identity: {
      bodyId: config.bodyId,
      regionId: config.regionId,
      surfaceFrameId: config.surfaceFrameId,
      regionRevision: 0
    },
    profile,
    rootSeed: config.seed,
    voxelSizeMeters: config.voxelSizeMeters,
    frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
    waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
    probe
  });
  if (selection.status === "Rejected") throw new Error(selection.failure.message);
  return selection.world;
};

export const revalidateHestiaSurfacePlayWorld = (
  authority: SurfaceRegionVoxelAuthority,
  sourceWorld: Readonly<HestiaSurfaceWorldFacts>
) => adoptHestiaSurfaceWorldAgainstAuthority({
  sourceWorld,
  state: authority.state,
  adapter: createSurfaceRegionVoxelCollisionAdapter(authority),
  waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
  capsule: createHestiaAgileGroundedLocomotionPresetV1().capsule,
  collisionSkinMeters: createHestiaAgileGroundedLocomotionPresetV1().collisionSkinMeters
});

/** Resolves the selected V1 spawn through the adopted authority's density-backed collision path. */
export const resolveHestiaSurfacePlaySpawn = (
  authority: SurfaceRegionVoxelAuthority,
  world?: Readonly<HestiaSurfaceWorldFacts>
): Readonly<SurfaceLocomotionState> => {
  const state = authority.state;
  const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
  const brickSizeMeters = {
    x: VOXEL_BRICK_CELL_DIMENSIONS.x * state.voxelSizeMeters,
    y: VOXEL_BRICK_CELL_DIMENSIONS.y * state.voxelSizeMeters,
    z: VOXEL_BRICK_CELL_DIMENSIONS.z * state.voxelSizeMeters
  };
  const fixture = world === undefined
    ? Object.freeze({
        x: (state.brickBounds.minInclusive.x + state.brickBounds.maxExclusive.x) * brickSizeMeters.x / 2,
        z: (state.brickBounds.minInclusive.z + state.brickBounds.maxExclusive.z) * brickSizeMeters.z / 2
      })
    : Object.freeze({ x: world.anchorCenterMeters.x, z: world.anchorCenterMeters.z });
  if (
    world !== undefined
    && (
      world.identity.bodyId !== state.bodyId
      || world.identity.regionId !== state.regionId
      || world.identity.surfaceFrameId !== state.surfaceFrameId
      || world.identity.regionRevision !== state.regionRevision
    )
  ) throw new Error("Selected Hestia Surface World is stale for the adopted voxel authority.");
  const probeBottomMeters = state.brickBounds.maxExclusive.y * brickSizeMeters.y + 1;
  const maximumDistanceMeters = (state.brickBounds.maxExclusive.y - state.brickBounds.minInclusive.y) * brickSizeMeters.y + 2;
  const delegate = createSurfaceVoxelCollisionDelegate(
    createSurfaceRegionVoxelCollisionAdapter(authority),
    state
  );
  const result = delegate.queryGroundContact(createSurfaceGroundContactQuery({
    queryId: `surface-spawn:${ROUTE_ID}:0`,
    kind: "GroundContact",
    bodyId: state.bodyId,
    regionId: state.regionId,
    surfaceFrameId: state.surfaceFrameId,
    regionRevision: state.regionRevision,
    simulationTick: 0,
    capsule: locomotion.capsule,
    positionMeters: {
      x: fixture.x,
      y: probeBottomMeters + locomotion.capsule.heightMeters / 2,
      z: fixture.z
    },
    maximumDistanceMeters
  }));
  if (result.status === "Rejected") {
    throw new Error(`Surface Play spawn query was rejected: ${result.message}`);
  }
  if (result.contact === null) {
    throw new Error("Surface Play spawn fixture has no authoritative ground contact.");
  }
  if (result.contact.normal.y < Math.cos(locomotion.maximumSlopeRadians)) {
    throw new Error("Surface Play spawn fixture does not provide walkable authoritative ground.");
  }
  if (world !== undefined && Math.abs(result.contact.pointMeters.y - world.anchorCenterMeters.y) > state.voxelSizeMeters) {
    throw new Error("Selected Hestia Surface World does not match materialized authority ground.");
  }
  if (result.contact.pointMeters.y < HESTIA_SEA_LEVEL_METERS + 1) {
    throw new Error("Surface Play spawn authority ground is not dry.");
  }
  return createSurfaceLocomotionState({
    playerId: PLAYER_ID,
    surfaceFrameId: state.surfaceFrameId,
    positionMeters: {
      x: fixture.x,
      y: result.contact.pointMeters.y + locomotion.capsule.heightMeters / 2,
      z: fixture.z
    },
    velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
    yawRadians: Math.PI,
    pitchRadians: 0,
    grounded: true,
    groundNormal: result.contact.normal,
    movementMode: "Walk",
    capsule: locomotion.capsule,
    simulationTick: 0,
    jumpHeld: false
  });
};

const createUiOwnedPointerLock = (
  options: SurfacePlayPointerFactoryOptions
): SurfacePointerLockController => {
  let targetPort!: SurfacePointerLockTarget;
  targetPort = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    requestPointerLock: () => options.viewport.requestPointerLock()
  };
  const documentPort: SurfacePointerLockDocumentPort = {
    addEventListener: options.documentPort.addEventListener.bind(options.documentPort),
    removeEventListener: options.documentPort.removeEventListener.bind(options.documentPort),
    get pointerLockElement() {
      return options.documentPort.pointerLockElement === options.viewport
        ? targetPort
        : options.documentPort.pointerLockElement;
    },
    exitPointerLock: () => options.documentPort.exitPointerLock()
  };
  return createSurfacePointerLockController({
    target: targetPort,
    documentPort,
    windowPort: options.windowPort
  });
};

const locomotionDataset = (snapshot: Readonly<SurfacePlayRuntimeSnapshot>): string => {
  if (!snapshot.hud.grounded) return "airborne";
  if (snapshot.hud.movementMode === "Sprint") return "sprinting";
  const velocity = snapshot.player.velocityMetersPerSecond;
  const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
  const groundedGravityResidual = locomotion.gravityMetersPerSecondSquared
    * locomotion.fixedDeltaSeconds
    * Math.sin(locomotion.maximumSlopeRadians)
    * Math.cos(locomotion.maximumSlopeRadians);
  return Math.hypot(velocity.x, velocity.z) > groundedGravityResidual + 1e-6 ? "moving" : "idle";
};

export const startSurfacePlay = async (
  overrides: SurfacePlayBootstrapOptions = {}
): Promise<SurfacePlayBootstrapHandle> => {
  const owner = Object.freeze({});
  const dependencies: SurfacePlayBootstrapDependencies = {
    documentPort: overrides.documentPort ?? document,
    windowPort: overrides.windowPort ?? window,
    createAuthority: overrides.createAuthority ?? createSurfaceRegionVoxelAuthority,
    resolveWorld: overrides.resolveWorld ?? resolveHestiaSurfacePlayWorld,
    revalidateWorld: overrides.revalidateWorld ?? revalidateHestiaSurfacePlayWorld,
    resolveSpawn: overrides.resolveSpawn ?? resolveHestiaSurfacePlaySpawn,
    createBackend: overrides.createBackend ?? ((options) => new ThreeRenderBackend(options)),
    createRuntime: overrides.createRuntime ?? createSurfacePlayRuntime,
    createPreparedStructuralFireClient: overrides.createPreparedStructuralFireClient
      ?? (() => new PreparedStructuralFireWorkerClient()),
    createPresentation: overrides.createPresentation ?? createSurfacePlayPresentation,
    createInput: overrides.createInput ?? createSurfaceDomInputAdapter,
    createPointerLock: overrides.createPointerLock ?? createUiOwnedPointerLock,
    createUi: overrides.createUi ?? createSurfacePlayUi,
    waitForNextPaint: overrides.waitForNextPaint ?? (() => new Promise<void>((resolve) => {
      windowPort.setTimeout(resolve, 0);
    }))
  };
  const { documentPort, windowPort } = dependencies;
  documentPort.body.dataset.uiSurface = "surface-play";
  documentPort.body.dataset.surfacePlayState = "loading";
  const loading = overrides.loading ?? presentSurfacePlayLoading(documentPort, "preparing-world");

  let backend: ThreeRenderBackend | undefined;
  let runtime: SurfacePlayRuntime | undefined;
  let preparedStructuralFireClient: PreparedStructuralFireWorkerClient | undefined;
  let presentation: SurfacePlayPresentation | undefined;
  let input: SurfaceDomInputAdapter | undefined;
  let pointerLock: SurfacePointerLockController | undefined;
  let ui: SurfacePlayUi | undefined;
  let debugOverlay: SurfacePlayDebugOverlay | undefined;
  let failureRoot: HTMLElement | undefined;
  let animationFrame: number | undefined;
  let disposed = false;
  let fireHeld = false;
  let fireLatched = false;

  const clearPlayerInput = (): void => {
    fireHeld = false;
    fireLatched = false;
    input?.clearHeldInputs();
  };
  const pointerLockChange = (): void => {
    if (!pointerLock?.isLocked()) clearPlayerInput();
  };
  const keyDown = (rawEvent: Event): void => {
    const event = rawEvent as KeyboardEvent;
    if (event.code === "F1") {
      event.preventDefault();
      if (!event.repeat) debugOverlay?.toggle();
      return;
    }
    if (event.code === "Escape") clearPlayerInput();
  };
  const mouseDown = (rawEvent: Event): void => {
    const event = rawEvent as MouseEvent;
    if (event.button !== 0 || !pointerLock?.isLocked()) return;
    if (!fireHeld) fireLatched = true;
    fireHeld = true;
  };
  const mouseUp = (rawEvent: Event): void => {
    if ((rawEvent as MouseEvent).button === 0) fireHeld = false;
  };
  const blur = (): void => clearPlayerInput();
  const resize = (): void => {
    if (backend === undefined) return;
    const width = Math.max(1, windowPort.innerWidth);
    const height = Math.max(1, windowPort.innerHeight);
    backend.resize(width, height, Math.max(1, windowPort.devicePixelRatio));
  };

  const pageHide = (): void => dispose();
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (activeSurfacePlayRuntime?.owner === owner) activeSurfacePlayRuntime = undefined;
    windowPort.removeEventListener("pagehide", pageHide);
    windowPort.removeEventListener("resize", resize);
    windowPort.removeEventListener("keydown", keyDown);
    windowPort.removeEventListener("mousedown", mouseDown);
    windowPort.removeEventListener("mouseup", mouseUp);
    windowPort.removeEventListener("blur", blur);
    documentPort.removeEventListener("pointerlockchange", pointerLockChange);
    if (animationFrame !== undefined) {
      windowPort.cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
    }
    clearPlayerInput();
    runtime?.dispose?.();
    void preparedStructuralFireClient?.dispose();
    input?.dispose();
    pointerLock?.dispose();
    debugOverlay?.dispose();
    ui?.dispose();
    presentation?.dispose();
    failureRoot?.remove();
    loading.dispose();
    input = undefined;
    pointerLock = undefined;
    debugOverlay = undefined;
    ui = undefined;
    presentation = undefined;
    preparedStructuralFireClient = undefined;
    failureRoot = undefined;
    clearSurfacePlayDataset(documentPort.body);
  };

  try {
    const canvas = documentPort.querySelector<HTMLCanvasElement>("#debug-scene");
    if (canvas === null) throw new Error("Missing #debug-scene canvas for Surface Play.");
    canvas.setAttribute("aria-label", "Hestia surface viewport");
    const host = documentPort.querySelector<HTMLElement>("#app");
    if (host === null) throw new Error("Missing #app host for Surface Play.");

    const enterPhase = async (phase: SurfacePlayLoadingPhase): Promise<void> => {
      loading.update(phase);
      await dependencies.waitForNextPaint();
    };

    const searchParams = new URLSearchParams((windowPort as Partial<Window>).location?.search ?? "");
    const coastLush = searchParams.get("surfacePreset") === "coast-lush";
    const surfaceConfig = coastLush
      ? HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG
      : HESTIA_SURFACE_PLAY_V1_CONFIG;
    const surfaceProfile: HestiaGeneratorProfile = coastLush
      ? HESTIA_COAST_LUSH_PRESET_ID
      : HESTIA_PRESET_ID;
    await enterPhase("preparing-world");
    const sourceWorld = dependencies.resolveWorld(surfaceConfig, surfaceProfile);
    await enterPhase("materializing-terrain");
    const authority = dependencies.createAuthority(createHestiaSurfacePlayAuthorityInput(sourceWorld, surfaceConfig));
    const adoptedWorldResult = dependencies.revalidateWorld(authority, sourceWorld);
    if (adoptedWorldResult.status === "Rejected") throw new Error(adoptedWorldResult.failure.message);
    const world = adoptedWorldResult.world;
    await enterPhase("resolving-spawn");
    const initialPlayerState = dependencies.resolveSpawn(authority, world);
    await enterPhase("starting-runtime");
    const structuralFireMode = overrides.structuralFireMode
      ?? (searchParams.get("structuralFire") === "async-v2"
        ? "AsyncPreparingV2"
        : "SynchronousV1");
    if (structuralFireMode === "AsyncPreparingV2") {
      preparedStructuralFireClient = dependencies.createPreparedStructuralFireClient();
      await preparedStructuralFireClient.start();
    }
    backend = dependencies.createBackend({
      canvas,
      width: Math.max(1, windowPort.innerWidth),
      height: Math.max(1, windowPort.innerHeight),
      pixelRatio: Math.max(1, windowPort.devicePixelRatio),
      antialias: true,
      backgroundColor: 0x081718,
      lightingMode: "None"
    });
    runtime = dependencies.createRuntime({
      routeId: ROUTE_ID,
      initialPlayerState,
      authority,
      world,
      structuralFireMode,
      preparedStructuralFireClient
    });
    if (structuralFireMode === "AsyncPreparingV2") {
      await runtime.warmPreparedStructuralFireSeed?.().catch(() => undefined);
    }
    const initialSnapshot = runtime.read();
    const fixedDeltaSeconds = createHestiaAgileGroundedLocomotionPresetV1().fixedDeltaSeconds;
    await enterPhase("preparing-presentation");
    presentation = dependencies.createPresentation({
      backend,
      materializeBrick: runtime.materializeBrick.bind(runtime),
      initialSnapshot,
      resolveStructuralMeshArtifact: runtime.resolveStructuralMeshArtifact.bind(runtime),
      initialStructuralSnapshot: initialSnapshot.presentation.structural ?? undefined
    });
    await enterPhase("connecting-controls");
    pointerLock = dependencies.createPointerLock({ viewport: canvas, documentPort, windowPort });
    input = dependencies.createInput({
      windowPort,
      documentPort,
      isPointerLocked: () => pointerLock?.isLocked() ?? false,
      lookSensitivityRadiansPerPixel: createHestiaAgileGroundedLocomotionPresetV1().mouseSensitivityRadiansPerPixel
    });
    ui = dependencies.createUi({
      host,
      viewport: canvas,
      documentPort,
      onIntent: () => pointerLock?.request()
    });
    debugOverlay = createSurfacePlayDebugOverlay({ host, documentPort });

    const publish = (snapshot: Readonly<SurfacePlayRuntimeSnapshot>): void => {
      ui!.update(snapshot.hud);
      documentPort.body.dataset.locomotionState = locomotionDataset(snapshot);
      presentation!.present(snapshot);
      if (snapshot.presentation.structural !== null) {
        presentation!.presentStructural(snapshot.presentation.structural);
      }
      presentation!.render();
    };
    ui.update(initialSnapshot.hud);
    documentPort.body.dataset.locomotionState = locomotionDataset(initialSnapshot);
    resize();

    windowPort.addEventListener("pagehide", pageHide, { once: true });
    windowPort.addEventListener("resize", resize);
    windowPort.addEventListener("keydown", keyDown);
    windowPort.addEventListener("mousedown", mouseDown);
    windowPort.addEventListener("mouseup", mouseUp);
    windowPort.addEventListener("blur", blur);
    documentPort.addEventListener("pointerlockchange", pointerLockChange);

    let previousTimestamp: number | undefined;
    let pendingElapsedSeconds = 0;
    let latestSnapshot = initialSnapshot;
    const frame = (timestamp: number): void => {
      if (disposed) return;
      const priorTimestamp = previousTimestamp;
      const observedElapsedSeconds = priorTimestamp === undefined
        ? 0
        : Math.max(0, (timestamp - priorTimestamp) / 1_000);
      previousTimestamp = timestamp;
      pendingElapsedSeconds = Math.min(
        MAXIMUM_FRAME_DELTA_SECONDS,
        pendingElapsedSeconds + observedElapsedSeconds
      );
      const previousAccumulatorSeconds = latestSnapshot.fixedStep.accumulatorSeconds;
      const elapsedSeconds = Math.min(
        pendingElapsedSeconds,
        Math.max(
          0,
          MAXIMUM_FIXED_STEPS_PER_FRAME * fixedDeltaSeconds - previousAccumulatorSeconds
        )
      );
      const result = runtime!.advance(elapsedSeconds, (simulationTick, state): Readonly<SurfacePlayerCommand> => {
        if (ui!.isPlayerInputBlocked() || !pointerLock!.isLocked()) clearPlayerInput();
        const base = input!.consumeCommand({
          playerId: state.playerId,
          surfaceFrameId: state.surfaceFrameId,
          simulationTick
        });
        const fire = pointerLock!.isLocked() && fireLatched;
        fireLatched = false;
        return createSurfacePlayerCommand({
          playerId: base.playerId,
          surfaceFrameId: base.surfaceFrameId,
          simulationTick: base.simulationTick,
          moveAxes: base.moveAxes,
          lookDeltaRadians: base.lookDeltaRadians,
          sprint: base.sprint,
          crouch: base.crouch,
          jump: base.jump,
          fire,
          pointerLockIntent: base.pointerLockIntent,
          reset: base.reset
        });
      });
      const nextAccumulatorSeconds = result.snapshot.fixedStep.accumulatorSeconds;
      const consumedElapsedSeconds = Math.min(
        elapsedSeconds,
        Math.max(
          0,
          result.steps * fixedDeltaSeconds + nextAccumulatorSeconds - previousAccumulatorSeconds
        )
      );
      pendingElapsedSeconds = Math.max(0, pendingElapsedSeconds - consumedElapsedSeconds);
      if (pendingElapsedSeconds <= 1e-12) pendingElapsedSeconds = 0;
      latestSnapshot = result.snapshot;
      publish(result.snapshot);
      if (priorTimestamp !== undefined && debugOverlay!.isVisible()) {
        debugOverlay!.update({
          frameTimeMilliseconds: observedElapsedSeconds * 1_000,
          fixedSteps: result.steps,
          pendingElapsedSeconds,
          snapshot: result.snapshot,
          backendDiagnostics: backend!.readDiagnostics()
        });
      }
      if (!disposed) animationFrame = windowPort.requestAnimationFrame(frame);
    };
    animationFrame = windowPort.requestAnimationFrame(frame);
    loading.dispose();
    documentPort.body.dataset.surfacePlayState = "ready";
    activeSurfacePlayRuntime = Object.freeze({ owner, runtime });
    return Object.freeze({ runtime, dispose });
  } catch (error) {
    try {
      dispose();
    } catch {
      // Preserve the player-facing initialization failure if cleanup also fails.
    }
    if (backend !== undefined && presentation === undefined) {
      const diagnostics = backend.readDiagnostics();
      const result = backend.dispatch(createRenderCommand({
        kind: "DisposeBackend",
        backendRevision: diagnostics.backendRevision ?? backendRevision(0)
      }));
      const uninitializedNoOp = diagnostics.backendState === "Uninitialized" && result.status === "BackendUnavailable";
      if (!uninitializedNoOp && result.status !== "Accepted" && result.status !== "AlreadyApplied") {
        // The original setup failure remains the player-facing cause.
      }
    }
    disposed = false;
    failureRoot = presentSurfacePlayFailure(documentPort, error);
    let failureDisposed = false;
    return Object.freeze({
      runtime: undefined,
      dispose: () => {
        if (failureDisposed) return;
        failureDisposed = true;
        failureRoot?.remove();
        failureRoot = undefined;
        clearSurfacePlayDataset(documentPort.body);
      }
    });
  }
};
