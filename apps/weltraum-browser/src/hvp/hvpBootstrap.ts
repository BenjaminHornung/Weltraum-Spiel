import { ThreeRenderBackend } from "../render/three/backend";
import {
  artifactRevision,
  backendRevision,
  createFrameProjectionSnapshot,
  createMaterialProfile,
  createMeshArtifact,
  createRenderCommand,
  createVisibilityPlan,
  frameId,
  frameRevision,
  materialProfileId,
  representationKey,
  sourceRevision,
  visibilityPlanRevision,
  type FrameId,
  type RenderBackend,
  type RenderCommand,
  type RenderCommandResult,
  type RepresentationKey
} from "../presentation";
import { createHvpCamera, type HvpCameraPreset } from "./hvpCamera";
import { createHvpHud, type HvpLifecycleState } from "./hvpHud";
import {
  HVP_BLOCK_MESH_ALGORITHM_VERSION,
  HVP_COAST_BLOCK_SIZE_METERS,
  HVP_FRAME_ID,
  HVP_TERRAIN_MATERIAL_ID,
  HVP_TERRAIN_REPRESENTATION_KEY,
  HVP_WATER_MATERIAL_ID,
  HVP_WATER_REPRESENTATION_KEY,
  assertHvpCoverageComplete,
  createHvpSession,
  hvpBuildCoastBlockCells,
  hvpBuildWaterPlane,
  hvpMeshBlocks,
  hvpServedCoverage,
  type HvpSession,
  type HvpSessionSeed
} from "./hvpTerrain";

const HVP_WATER_ALGORITHM_VERSION = "hvp-water-plane-v1";

/** Fail-closed double-mount guard: at most one live HVP session per module. */
let activeHvpMount = false;

type HvpDocumentPort = Pick<Document, "body" | "querySelector" | "createElement">;
type HvpWindowPort = Pick<Window,
  | "innerWidth"
  | "innerHeight"
  | "devicePixelRatio"
  | "requestAnimationFrame"
  | "cancelAnimationFrame"
  | "addEventListener"
  | "removeEventListener"
>;

export interface HvpBootstrapHandle {
  dispose(): Promise<void>;
}

const accepted = (result: RenderCommandResult): boolean =>
  result.status === "Accepted" || result.status === "AlreadyApplied";

const requireAccepted = (result: RenderCommandResult, operation: string): void => {
  if (!accepted(result)) throw new Error(`${operation} failed: ${result.reasonCode ?? result.status}`);
};

interface HvpProjectionCamera {
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly orientation: Readonly<{ x: number; y: number; z: number; w: number }>;
  readonly verticalFovDegrees: number;
  readonly aspect: number;
  readonly near: number;
  readonly far: number;
}

/** HVP-owned projection/visibility publisher; mirrors the Surface Lab shape without importing it. */
const createHvpPresentationBackend = (
  backend: RenderBackend,
  readCamera: () => HvpProjectionCamera
): RenderBackend => {
  const framesByRepresentation = new Map<RepresentationKey, FrameId>();
  let lastFrameId: FrameId | undefined;
  let projectionRevision = 0;

  const publishCurrentSet = (): void => {
    const current = framesByRepresentation.values().next().value ?? lastFrameId;
    if (current === undefined) return;
    for (const candidate of framesByRepresentation.values()) {
      if (candidate !== current) throw new Error("HVP representations must share one projection frame.");
    }
    projectionRevision += 1;
    const camera = readCamera();
    const keys = [...framesByRepresentation.keys()];
    const revision = backend.readDiagnostics().backendRevision;
    requireAccepted(backend.dispatch(createRenderCommand({
      kind: "ApplyFrameProjection",
      backendRevision: revision,
      snapshot: createFrameProjectionSnapshot({
        frameId: current,
        frameRevision: frameRevision(projectionRevision),
        cameraPositionRelative: camera.position,
        cameraOrientation: camera.orientation,
        projectionParameters: {
          kind: "Perspective",
          verticalFovDegrees: camera.verticalFovDegrees,
          aspect: camera.aspect,
          near: camera.near,
          far: camera.far
        },
        representationTransforms: keys.map((key) => ({
          representationKey: key,
          positionRelative: { x: 0, y: 0, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 }
        }))
      })
    })), "HVP frame projection");
    requireAccepted(backend.dispatch(createRenderCommand({
      kind: "ApplyVisibilityPlan",
      backendRevision: revision,
      plan: createVisibilityPlan({
        planRevision: visibilityPlanRevision(projectionRevision),
        visibleRepresentationKeys: keys,
        fallbackRepresentationKeys: [],
        hiddenRepresentationKeys: []
      })
    })), "HVP visibility plan");
  };

  const dispatch = (command: RenderCommand): RenderCommandResult => {
    const result = backend.dispatch(command);
    if (command.kind === "UpsertMeshArtifact" && accepted(result)) {
      lastFrameId = command.artifact.frameId;
      framesByRepresentation.set(command.artifact.representationKey, command.artifact.frameId);
      publishCurrentSet();
    } else if (command.kind === "ResetBackend" || command.kind === "DisposeBackend") {
      framesByRepresentation.clear();
      lastFrameId = undefined;
    }
    return result;
  };

  return Object.freeze({
    dispatch,
    renderFrame: () => backend.renderFrame(),
    getCapabilities: () => backend.getCapabilities(),
    readDiagnostics: () => backend.readDiagnostics()
  });
};

export const presentHvpFailure = (
  documentPort: HvpDocumentPort,
  error: unknown,
  host: HTMLElement | undefined = documentPort.querySelector<HTMLElement>("#app") ?? undefined
): HTMLElement => {
  for (const key of Object.keys(documentPort.body.dataset)) {
    if (key === "hestiaPrototype" || key.startsWith("hestiaPrototype")) delete documentPort.body.dataset[key];
  }
  documentPort.body.dataset.hestiaPrototype = "1";
  documentPort.body.dataset.hestiaPrototypeState = "Error";
  const root = documentPort.createElement("section");
  root.id = "hvp-failure";
  root.setAttribute("role", "alert");
  root.setAttribute("aria-live", "assertive");
  const heading = documentPort.createElement("h1");
  heading.textContent = "HVP-01 UNAVAILABLE";
  const detail = documentPort.createElement("p");
  detail.id = "hvp-error-detail";
  detail.textContent = `Technical initialization failure: ${error instanceof Error ? error.message : "HVP-01 initialization failed."}`;
  const boundary = documentPort.createElement("p");
  boundary.textContent = "NOT GAMEPLAY · no terrain readiness is being claimed";
  root.append(heading, detail, boundary);
  (host ?? documentPort.body).append(root);
  return root;
};

export interface HvpModule {
  startHvp(): Promise<HvpBootstrapHandle>;
}

export const startHvpRoute = async (
  documentPort: HvpDocumentPort,
  loadHvp: () => Promise<HvpModule>
): Promise<void> => {
  documentPort.body.dataset.hestiaPrototype = "1";
  try {
    const { startHvp } = await loadHvp();
    await startHvp();
  } catch (error) {
    if (error instanceof Error && error.message.includes("already mounted")) return;
    presentHvpFailure(documentPort, error);
  }
};

export const startHvp = async (
  overrides: {
    readonly documentPort?: HvpDocumentPort;
    readonly windowPort?: HvpWindowPort;
    readonly createBackend?: (options: ConstructorParameters<typeof ThreeRenderBackend>[0]) => ThreeRenderBackend;
    readonly createSession?: (seed: HvpSessionSeed) => HvpSession;
  } = {}
): Promise<HvpBootstrapHandle> => {
  const documentPort = overrides.documentPort ?? document;
  if (activeHvpMount || documentPort.querySelector("#hvp-hud") !== null) {
    throw new Error("HVP-01 already mounted: dispose the live session before starting again.");
  }
  activeHvpMount = true;
  const windowPort = overrides.windowPort ?? window;
  documentPort.body.dataset.hestiaPrototype = "1";
  documentPort.body.dataset.hestiaPrototypeState = "Loading" satisfies HvpLifecycleState;

  let backend: ThreeRenderBackend | undefined;
  let camera: ReturnType<typeof createHvpCamera> | undefined;
  let hud: ReturnType<typeof createHvpHud> | undefined;
  let animationFrame: number | undefined;
  let failureRoot: HTMLElement | undefined;
  let disposed = false;
  let disposePromise: Promise<void> | undefined;
  const flightHud = documentPort.querySelector<HTMLElement>("#flight-hud");
  const flightHudWasHidden = flightHud?.hidden ?? true;

  const pageHide = (): void => { void dispose(); };
  const releaseMount = (): void => {
    activeHvpMount = false;
  };
  const dispose = (): Promise<void> => {
    if (disposePromise !== undefined) return disposePromise;
    disposed = true;
    // The mount stays held until the async cleanup settles, so a restart
    // racing a pending dispose still sees the live mount and fails closed.
    const cleanup = (async () => {
      windowPort.removeEventListener("pagehide", pageHide);
      if (animationFrame !== undefined) {
        windowPort.cancelAnimationFrame(animationFrame);
        animationFrame = undefined;
      }
      hud?.dispose();
      hud = undefined;
      camera?.dispose();
      camera = undefined;
      failureRoot?.remove();
      failureRoot = undefined;
      if (backend !== undefined) {
        const revision = backend.readDiagnostics().backendRevision;
        backend.dispatch(createRenderCommand({ kind: "DisposeBackend", backendRevision: revision }));
        backend = undefined;
      }
      if (flightHud) flightHud.hidden = flightHudWasHidden;
      for (const key of Object.keys(documentPort.body.dataset)) {
        if (key === "hestiaPrototype" || key.startsWith("hestiaPrototype")) delete documentPort.body.dataset[key];
      }
    })();
    disposePromise = cleanup.finally(() => { releaseMount(); });
    return disposePromise;
  };

  try {
    const canvas = documentPort.querySelector<HTMLCanvasElement>("#debug-scene");
    if (canvas === null) throw new Error("Missing #debug-scene canvas for HVP-01.");
    canvas.setAttribute("aria-label", "HVP-01 visible coast viewport");
    const host = documentPort.querySelector<HTMLElement>("#app");
    if (host === null) throw new Error("Missing #app host for HVP-01.");
    if (flightHud) flightHud.hidden = true;

    backend = (overrides.createBackend ?? ((options) => new ThreeRenderBackend(options)))({
      canvas,
      width: Math.max(1, windowPort.innerWidth),
      height: Math.max(1, windowPort.innerHeight),
      pixelRatio: Math.max(1, windowPort.devicePixelRatio),
      antialias: true,
      backgroundColor: 0x0a141c,
      lightingMode: "None"
    });
    requireAccepted(backend.dispatch(createRenderCommand({
      kind: "InitializeBackend",
      backendRevision: backendRevision(0)
    })), "HVP backend initialization");

    const presentation = createHvpPresentationBackend(backend, () => ({
      position: backend!.camera.position,
      orientation: backend!.camera.quaternion,
      verticalFovDegrees: backend!.camera.fov,
      aspect: backend!.camera.aspect,
      near: backend!.camera.near,
      far: backend!.camera.far
    }));

    const frame = frameId(HVP_FRAME_ID);
    const coastCells = hvpBuildCoastBlockCells(HVP_COAST_BLOCK_SIZE_METERS);
    const coverage = hvpServedCoverage(coastCells);
    const session = (overrides.createSession ?? createHvpSession)({
      solids: coverage.solids,
      knownAir: coverage.knownAir
    });
    assertHvpCoverageComplete(session, coverage.solids, coverage.knownAir);
    const terrainMesh = hvpMeshBlocks(
      coastCells,
      HVP_COAST_BLOCK_SIZE_METERS,
      HVP_TERRAIN_MATERIAL_ID
    );
    if (terrainMesh.faceCount === 0) throw new Error("HVP coast mesher produced no terrain faces.");
    const water = hvpBuildWaterPlane();

    const terrainProfile = createMaterialProfile({
      id: materialProfileId(HVP_TERRAIN_MATERIAL_ID),
      kind: "Unlit",
      baseColor: { r: 0.45, g: 0.38, b: 0.28 },
      opacity: 1,
      doubleSided: true,
      wireframe: false,
      depthWrite: true
    });
    const waterProfile = createMaterialProfile({
      id: materialProfileId(HVP_WATER_MATERIAL_ID),
      kind: "Unlit",
      baseColor: { r: 0.12, g: 0.35, b: 0.5 },
      opacity: 0.8,
      doubleSided: true,
      wireframe: false,
      depthWrite: true
    });

    requireAccepted(presentation.dispatch(createRenderCommand({
      kind: "UpsertMeshArtifact",
      backendRevision: backendRevision(0),
      artifact: createMeshArtifact({
        representationKey: representationKey(HVP_TERRAIN_REPRESENTATION_KEY),
        sourceRevision: sourceRevision(1),
        artifactRevision: artifactRevision(0),
        algorithmVersion: HVP_BLOCK_MESH_ALGORITHM_VERSION,
        frameId: frame,
        positions: terrainMesh.positions,
        normals: terrainMesh.normals,
        indices: terrainMesh.indices,
        materialRanges: [{
          materialProfileId: materialProfileId(HVP_TERRAIN_MATERIAL_ID),
          startIndex: 0,
          indexCount: terrainMesh.indices.length
        }],
        bounds: {
          min: { ...terrainMesh.boundsMeters.min },
          max: { ...terrainMesh.boundsMeters.max }
        }
      }),
      materialProfiles: [terrainProfile]
    })), "HVP terrain upsert");

    requireAccepted(presentation.dispatch(createRenderCommand({
      kind: "UpsertMeshArtifact",
      backendRevision: backendRevision(0),
      artifact: createMeshArtifact({
        representationKey: representationKey(HVP_WATER_REPRESENTATION_KEY),
        sourceRevision: sourceRevision(1),
        artifactRevision: artifactRevision(0),
        algorithmVersion: HVP_WATER_ALGORITHM_VERSION,
        frameId: frame,
        positions: water.positions,
        normals: water.normals,
        indices: water.indices,
        materialRanges: [{
          materialProfileId: materialProfileId(HVP_WATER_MATERIAL_ID),
          startIndex: 0,
          indexCount: water.indices.length
        }],
        bounds: { min: { ...water.boundsMeters.min }, max: { ...water.boundsMeters.max } }
      }),
      materialProfiles: [waterProfile]
    })), "HVP water upsert");

    camera = createHvpCamera({ camera: backend.camera, canvas, windowPort: windowPort as Window });
    const stats = {
      faces: terrainMesh.faceCount + 2,
      vertices: terrainMesh.positions.length / 3 + 4,
      triangles: terrainMesh.indices.length / 3 + 2
    };
    hud = createHvpHud({
      host,
      documentPort,
      actions: {
        setPreset: (preset: HvpCameraPreset) => {
          camera!.setPreset(preset);
          hud!.update("Ready", camera!.readPose(), stats);
        },
        resetCamera: () => {
          camera!.reset();
          hud!.update("Ready", camera!.readPose(), stats);
        }
      }
    });
    hud.update("Ready", camera.readPose(), stats);

    windowPort.addEventListener("pagehide", pageHide, { once: true });
    let previousFrameTime: number | undefined;
    const renderFrame = (timestamp: number): void => {
      if (disposed) return;
      const deltaSeconds = previousFrameTime === undefined ? 0 : (timestamp - previousFrameTime) / 1_000;
      previousFrameTime = timestamp;
      camera!.update(deltaSeconds);
      if (disposed) return;
      backend!.renderFrame();
      if (!disposed) animationFrame = windowPort.requestAnimationFrame(renderFrame);
    };
    animationFrame = windowPort.requestAnimationFrame(renderFrame);
    return Object.freeze({ dispose });
  } catch (error) {
    try { await dispose(); } catch {
      // The technical failure state remains authoritative even if cleanup reports a secondary error.
    }
    failureRoot = presentHvpFailure(documentPort, error);
    let failureDisposed = false;
    const disposeFailure = async (): Promise<void> => {
      if (failureDisposed) return;
      failureDisposed = true;
      releaseMount();
      failureRoot?.remove();
      failureRoot = undefined;
      for (const key of Object.keys(documentPort.body.dataset)) {
        if (key === "hestiaPrototype" || key.startsWith("hestiaPrototype")) delete documentPort.body.dataset[key];
      }
    };
    return Object.freeze({ dispose: disposeFailure });
  }
};
