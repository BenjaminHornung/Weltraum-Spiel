import { ThreeRenderBackend } from "../render/three/backend";
import { createRenderCommand } from "../presentation";
import { MemoryContentCache } from "../streaming";
import { VOXEL_CHANNEL_BYTES } from "../voxel";
import { WorkerPool } from "../workers";
import { createSurfaceLabCamera } from "./surfaceLabCamera";
import { createSurfaceLabController, type SurfaceLabController } from "./surfaceLabController";
import { createSurfaceLabEnvironment } from "./surfaceLabEnvironment";
import { presentSurfaceLabFailure } from "./surfaceLabFailurePresenter";
import {
  clearSurfaceLabDataset,
  createSurfaceLabFrameTimeSampler,
  createSurfaceLabHud,
  type SurfaceLabFrameTimeSample
} from "./surfaceLabHud";
import { createSurfaceLabPresentationBackend } from "./surfaceLabPresentationBackend";
import type { SurfaceLabTelemetrySnapshot } from "./surfaceLabTelemetry";

export interface SurfaceLabBootstrapHandle {
  readonly controller: SurfaceLabController | undefined;
  dispose(): Promise<void>;
}

type SurfaceLabWindowPort = Pick<Window,
  | "innerWidth"
  | "innerHeight"
  | "devicePixelRatio"
  | "requestAnimationFrame"
  | "cancelAnimationFrame"
  | "addEventListener"
  | "removeEventListener"
>;

export interface SurfaceLabBootstrapDependencies {
  readonly documentPort: Pick<Document, "body" | "querySelector" | "createElement">;
  readonly windowPort: SurfaceLabWindowPort;
  readonly navigatorPort: Pick<Navigator, "hardwareConcurrency">;
  readonly nowMilliseconds: () => number;
  readonly createBackend: (options: ConstructorParameters<typeof ThreeRenderBackend>[0]) => ThreeRenderBackend;
  readonly createWorkerPool: (options: ConstructorParameters<typeof WorkerPool>[0]) => WorkerPool;
  readonly createController: typeof createSurfaceLabController;
  readonly createCamera: typeof createSurfaceLabCamera;
  readonly createEnvironment: typeof createSurfaceLabEnvironment;
  readonly createHud: typeof createSurfaceLabHud;
  readonly createFrameTimeSampler: typeof createSurfaceLabFrameTimeSampler;
}

export const startSurfaceLab = async (
  overrides: Partial<SurfaceLabBootstrapDependencies> = {}
): Promise<SurfaceLabBootstrapHandle> => {
  const dependencies: SurfaceLabBootstrapDependencies = {
    documentPort: overrides.documentPort ?? document,
    windowPort: overrides.windowPort ?? window,
    navigatorPort: overrides.navigatorPort ?? navigator,
    nowMilliseconds: overrides.nowMilliseconds ?? (() => performance.now()),
    createBackend: overrides.createBackend ?? ((options) => new ThreeRenderBackend(options)),
    createWorkerPool: overrides.createWorkerPool ?? ((options) => new WorkerPool(options)),
    createController: overrides.createController ?? createSurfaceLabController,
    createCamera: overrides.createCamera ?? createSurfaceLabCamera,
    createEnvironment: overrides.createEnvironment ?? createSurfaceLabEnvironment,
    createHud: overrides.createHud ?? createSurfaceLabHud,
    createFrameTimeSampler: overrides.createFrameTimeSampler ?? createSurfaceLabFrameTimeSampler
  };
  const documentPort = dependencies.documentPort;
  const windowPort = dependencies.windowPort;
  documentPort.body.dataset.surfaceLab = "1";

  let host: HTMLElement | undefined;
  let backend: ThreeRenderBackend | undefined;
  let workerPool: WorkerPool | undefined;
  let controller: SurfaceLabController | undefined;
  let camera: ReturnType<typeof createSurfaceLabCamera> | undefined;
  let environment: ReturnType<typeof createSurfaceLabEnvironment> | undefined;
  let hud: ReturnType<typeof createSurfaceLabHud> | undefined;
  let unsubscribe: (() => void) | undefined;
  let animationFrame: number | undefined;
  let disposed = false;
  let disposePromise: Promise<void> | undefined;
  let failureRoot: HTMLElement | undefined;
  let earlyBackendReleased = false;

  const releaseEarlyBackend = (): void => {
    if (backend === undefined || controller !== undefined || earlyBackendReleased) return;
    earlyBackendReleased = true;
    const diagnostics = backend.readDiagnostics();
    const result = backend.dispatch(createRenderCommand({
      kind: "DisposeBackend",
      backendRevision: diagnostics.backendRevision
    }));
    const uninitializedNoOp = diagnostics.backendState === "Uninitialized" && result.status === "BackendUnavailable";
    if (result.status !== "Accepted" && result.status !== "AlreadyApplied" && !uninitializedNoOp) {
      throw new Error(`Surface Lab early backend cleanup failed: ${result.reasonCode ?? result.status}`);
    }
  };

  const pageHide = (): void => { void dispose(); };
  const dispose = (): Promise<void> => {
    if (disposePromise !== undefined) return disposePromise;
    disposed = true;
    disposePromise = (async () => {
      windowPort.removeEventListener("pagehide", pageHide);
      if (animationFrame !== undefined) {
        windowPort.cancelAnimationFrame(animationFrame);
        animationFrame = undefined;
      }
      unsubscribe?.();
      unsubscribe = undefined;
      hud?.dispose();
      hud = undefined;
      camera?.dispose();
      camera = undefined;
      environment?.dispose();
      environment = undefined;
      failureRoot?.remove();
      failureRoot = undefined;
      if (controller !== undefined) {
        await controller.dispose();
      } else {
        try {
          if (workerPool !== undefined) await workerPool.shutdown();
        } finally {
          releaseEarlyBackend();
        }
      }
      clearSurfaceLabDataset(documentPort.body);
    })();
    return disposePromise;
  };

  try {
    const canvas = documentPort.querySelector<HTMLCanvasElement>("#debug-scene");
    if (canvas === null) throw new Error("Missing #debug-scene canvas for Surface Lab.");
    canvas.setAttribute("aria-label", "Hestia Surface Lab terrain viewport");
    host = documentPort.querySelector<HTMLElement>("#app") ?? undefined;
    if (host === undefined) throw new Error("Missing #app host for Surface Lab.");

    backend = dependencies.createBackend({
      canvas,
      width: Math.max(1, windowPort.innerWidth),
      height: Math.max(1, windowPort.innerHeight),
      pixelRatio: Math.max(1, windowPort.devicePixelRatio),
      antialias: true,
      backgroundColor: 0x081718,
      lightingMode: "None"
    });
    const detectedWorkers = Number.isSafeInteger(dependencies.navigatorPort.hardwareConcurrency)
      && dependencies.navigatorPort.hardwareConcurrency > 0
      ? dependencies.navigatorPort.hardwareConcurrency
      : 4;
    workerPool = dependencies.createWorkerPool({
      workerCount: Math.min(4, detectedWorkers),
      queueCapacity: 32
    });
    const presentationBackend = createSurfaceLabPresentationBackend({
      backend,
      readCamera: () => ({
        position: backend!.camera.position,
        orientation: backend!.camera.quaternion,
        verticalFovDegrees: backend!.camera.fov,
        aspect: backend!.camera.aspect,
        near: backend!.camera.near,
        far: backend!.camera.far
      })
    });
    controller = dependencies.createController({
      workerPool,
      backend: presentationBackend,
      cache: new MemoryContentCache(32 * VOXEL_CHANNEL_BYTES),
      nowMilliseconds: dependencies.nowMilliseconds
    });
    windowPort.addEventListener("pagehide", pageHide, { once: true });
    await controller.start();
    if (disposed) return Object.freeze({ controller, dispose });

    camera = dependencies.createCamera({ camera: backend.camera, canvas, windowPort: windowPort as Window });
    environment = dependencies.createEnvironment(backend);
    const sampler = dependencies.createFrameTimeSampler();
    let latestTelemetry = controller.readTelemetry();
    let latestFrameTime: SurfaceLabFrameTimeSample = Object.freeze({ averageMilliseconds: 0, sampleCount: 0, complete: false });
    hud = dependencies.createHud({
      host,
      presentationState: environment.readState(),
      cameraPose: camera.readPose(),
      documentPort,
      actions: {
        resetCamera: () => camera!.reset(),
        setCameraMode: (mode) => camera!.setMode(mode),
        setFogEnabled: (enabled) => environment!.setFogEnabled(enabled),
        setWaterEnabled: (enabled) => environment!.setWaterEnabled(enabled),
        setVegetationEnabled: (enabled) => environment!.setVegetationEnabled(enabled),
        setWireframeEnabled: (enabled) => environment!.setWireframeEnabled(enabled),
        setBoundariesEnabled: (enabled) => environment!.setBoundariesEnabled(enabled),
        regenerate: (seed) => controller!.regenerate(seed),
        setResolution: (voxelSizeMeters) => controller!.setResolution(voxelSizeMeters)
      }
    });
    unsubscribe = controller.subscribe((snapshot: SurfaceLabTelemetrySnapshot) => {
      if (disposed) return;
      latestTelemetry = snapshot;
      environment!.sync(snapshot);
      hud!.update(snapshot, latestFrameTime, camera!.readPose());
    });

    let previousFrameTime: number | undefined;
    let lastHudUpdateTime = 0;
    let lastCompleteSampleState = false;
    const renderFrame = (timestamp: number): void => {
      if (disposed) return;
      const deltaMilliseconds = previousFrameTime === undefined ? 0 : timestamp - previousFrameTime;
      previousFrameTime = timestamp;
      camera!.update(deltaMilliseconds / 1_000);
      if (disposed) return;
      backend!.renderFrame();
      const settled = latestTelemetry.lifecycle === "Ready"
        && latestTelemetry.requestedChunks === latestTelemetry.readyChunks
        && latestTelemetry.failedChunks === 0
        && latestTelemetry.workerQueueDepth === 0
        && latestTelemetry.runningWorkers === 0;
      latestFrameTime = sampler.push(deltaMilliseconds, settled);
      if (timestamp - lastHudUpdateTime >= 100 || latestFrameTime.complete !== lastCompleteSampleState) {
        lastHudUpdateTime = timestamp;
        lastCompleteSampleState = latestFrameTime.complete;
        if (!disposed) hud!.update(latestTelemetry, latestFrameTime, camera!.readPose());
      }
      if (!disposed) animationFrame = windowPort.requestAnimationFrame(renderFrame);
    };
    if (!disposed) animationFrame = windowPort.requestAnimationFrame(renderFrame);
    return Object.freeze({ controller, dispose });
  } catch (error) {
    try { await dispose(); } catch {
      // The technical failure state remains authoritative even if cleanup reports a secondary error.
    }
    failureRoot = presentSurfaceLabFailure(documentPort, error, host);
    let failureDisposed = false;
    const disposeFailure = async (): Promise<void> => {
      if (failureDisposed) return;
      failureDisposed = true;
      failureRoot?.remove();
      failureRoot = undefined;
      clearSurfaceLabDataset(documentPort.body);
    };
    return Object.freeze({ controller: undefined, dispose: disposeFailure });
  }
};
