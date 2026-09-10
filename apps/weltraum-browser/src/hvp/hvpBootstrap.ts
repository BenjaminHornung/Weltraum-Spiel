import * as THREE from "three";
import { ThreeRenderBackend } from "../render/three/backend";
import {
  artifactRevision,
  backendRevision,
  createFrameProjectionSnapshot,
  createMeshArtifact,
  createRenderCommand,
  createVisibilityPlan,
  frameId,
  frameRevision,
  representationKey,
  sourceRevision,
  visibilityPlanRevision,
  type FrameId,
  type MaterialProfile,
  type MaterialRange,
  type RenderBackend,
  type RenderCommand,
  type RenderCommandResult,
  type RepresentationKey
} from "../presentation";
import { createHvpCamera, type HvpCameraPreset } from "./hvpCamera";
import { createHvpHud, type HvpLifecycleState } from "./hvpHud";
import {
  createHvpLookProfile,
  type HvpLookMaterialRole,
  type HvpLookProfile
} from "../hestia-prototype/presentation/look";
import {
  HVP_BLOCK_MESH_ALGORITHM_VERSION,
  HVP_COAST_BLOCK_SIZE_METERS,
  HVP_FRAME_ID,
  HVP_TERRAIN_MATERIAL_ID,
  HVP_TERRAIN_REPRESENTATION_KEY,
  HVP_WATER_REPRESENTATION_KEY,
  assertHvpCoverageComplete,
  createHvpSession,
  hvpBuildCoastBlockCells,
  hvpBuildWaterPlane,
  hvpMeshBlocks,
  hvpServedCoverage,
  type HvpBlockMesh,
  type HvpSession,
  type HvpSessionSeed
} from "./hvpTerrain";

const HVP_WATER_ALGORITHM_VERSION = "hvp-water-presentation-v2";

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
type HvpBackend = RenderBackend & {
  readonly camera: THREE.PerspectiveCamera;
  readonly scene?: THREE.Scene;
  readonly representationRoot?: THREE.Group;
};

export interface HvpBootstrapHandle {
  dispose(): Promise<void>;
}

const accepted = (result: RenderCommandResult): boolean =>
  result.status === "Accepted" || result.status === "AlreadyApplied";

const requireAccepted = (result: RenderCommandResult, operation: string): void => {
  if (!accepted(result)) throw new Error(`${operation} failed: ${result.reasonCode ?? result.status}`);
};

interface HvpLookTerrain {
  readonly indices: Uint16Array | Uint32Array;
  readonly materialRanges: readonly MaterialRange[];
  readonly materialProfiles: readonly MaterialProfile[];
}

const terrainFaceRole = (mesh: HvpBlockMesh, faceIndex: number): HvpLookMaterialRole => {
  const vertexOffset = faceIndex * 12;
  let centerY = 0;
  for (let vertex = 0; vertex < 4; vertex += 1) {
    centerY += mesh.positions[vertexOffset + vertex * 3 + 1] ?? 0;
  }
  centerY /= 4;
  const normalY = mesh.normals[vertexOffset + 1] ?? 0;
  if (centerY <= 0.05) return "limestone-wet";
  if (normalY > 0.5) return centerY >= 2 ? "moss" : "soil";
  return centerY < 0.8 ? "limestone-wet" : "limestone-dry";
};

/** Reorders only render indices so each semantic look role stays one draw group. */
const createHvpLookTerrain = (mesh: HvpBlockMesh, look: HvpLookProfile): HvpLookTerrain => {
  const indicesByRole = new Map<HvpLookMaterialRole, number[]>(
    look.materials.map((material) => [material.role, []])
  );
  for (let faceIndex = 0; faceIndex < mesh.faceCount; faceIndex += 1) {
    const role = terrainFaceRole(mesh, faceIndex);
    const target = indicesByRole.get(role);
    if (target === undefined) throw new Error(`HVP look role is not registered: ${role}`);
    const indexStart = faceIndex * 6;
    for (let index = indexStart; index < indexStart + 6; index += 1) {
      target.push(mesh.indices[index] ?? 0);
    }
  }

  const orderedIndices: number[] = [];
  const materialRanges: MaterialRange[] = [];
  const materialProfiles: MaterialProfile[] = [];
  for (const material of look.materials) {
    const roleIndices = indicesByRole.get(material.role);
    if (roleIndices === undefined || roleIndices.length === 0) continue;
    const startIndex = orderedIndices.length;
    orderedIndices.push(...roleIndices);
    materialRanges.push({
      materialProfileId: material.materialProfile.id,
      startIndex,
      indexCount: roleIndices.length
    });
    materialProfiles.push(material.materialProfile);
  }
  if (materialRanges.length === 0) throw new Error("HVP look produced no terrain material ranges.");
  return Object.freeze({
    indices: mesh.indices instanceof Uint32Array ? new Uint32Array(orderedIndices) : new Uint16Array(orderedIndices),
    materialRanges: Object.freeze(materialRanges),
    materialProfiles: Object.freeze(materialProfiles)
  });
};

interface HvpLookScene {
  dispose(): void;
}

const disposeThreeResources = (root: THREE.Object3D): void => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry instanceof THREE.BufferGeometry) geometries.add(mesh.geometry);
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    sourceMaterials.filter((material): material is THREE.Material => material instanceof THREE.Material)
      .forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
};

const createHvpLookScene = (scene: THREE.Scene, look: HvpLookProfile): HvpLookScene => {
  const root = new THREE.Group();
  root.name = "hvp-readable-coast-presentation";

  const previousBackground = scene.background;
  const previousFog = scene.fog;
  const background = new THREE.Color(look.background.color);
  const fog = new THREE.Fog(look.background.color, look.background.fogNear, look.background.fogFar);
  scene.background = background;
  scene.fog = fog;

  const ambient = new THREE.HemisphereLight(
    look.lighting.ambient.color,
    0x142228,
    look.lighting.ambient.intensity
  );
  ambient.name = "hvp-ambient-fill";
  const key = new THREE.DirectionalLight(look.lighting.key.color, look.lighting.key.intensity);
  key.name = "hvp-sun-key";
  key.position.set(look.lighting.key.position.x, look.lighting.key.position.y, look.lighting.key.position.z);
  const fill = new THREE.DirectionalLight(look.lighting.fill.color, look.lighting.fill.intensity);
  fill.name = "hvp-cool-fill";
  fill.position.set(look.lighting.fill.position.x, look.lighting.fill.position.y, look.lighting.fill.position.z);
  root.add(ambient, key, fill);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(look.distantCoast.radiusMeters * 2, look.distantCoast.radiusMeters * 2),
    new THREE.MeshLambertMaterial({ color: 0x1b3034, flatShading: true })
  );
  ground.name = "hvp-distant-coast-ground-proxy";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -7.75;
  ground.renderOrder = -2;
  root.add(ground);

  const proxyMaterial = new THREE.MeshLambertMaterial({ color: 0x2a4646, flatShading: true });
  const proxyGroup = new THREE.Group();
  proxyGroup.name = "hvp-distant-coast-proxy-noneditable";
  const proxyPlacements = [
    { x: -43, y: -5.7, z: 32, radius: 16, height: 7 },
    { x: 42, y: -5.4, z: 36, radius: 19, height: 8 },
    { x: -48, y: -6.1, z: -34, radius: 17, height: 5 },
    { x: 46, y: -6, z: -31, radius: 15, height: 6 }
  ];
  for (const placement of proxyPlacements) {
    const mound = new THREE.Mesh(
      new THREE.ConeGeometry(placement.radius, placement.height, 7),
      proxyMaterial
    );
    mound.position.set(placement.x, placement.y, placement.z);
    mound.name = "hvp-distant-coast-mound-proxy";
    proxyGroup.add(mound);
  }
  root.add(proxyGroup);
  scene.add(root);

  let disposed = false;
  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      scene.remove(root);
      disposeThreeResources(root);
      root.clear();
      if (scene.background === background) scene.background = previousBackground;
      if (scene.fog === fog) scene.fog = previousFog;
    }
  };
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
interface HvpPresentationBackend extends RenderBackend {
  setWaterEnabled(enabled: boolean): void;
}

export const createHvpPresentationBackend = (
  backend: RenderBackend,
  readCamera: () => HvpProjectionCamera,
  waterRepresentationKey: RepresentationKey
): HvpPresentationBackend => {
  const framesByRepresentation = new Map<RepresentationKey, FrameId>();
  let lastFrameId: FrameId | undefined;
  let projectionRevision = 0;
  let waterEnabled = true;

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
        visibleRepresentationKeys: keys.filter((key) => waterEnabled || key !== waterRepresentationKey),
        fallbackRepresentationKeys: [],
        hiddenRepresentationKeys: waterEnabled ? [] : [waterRepresentationKey]
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
    readDiagnostics: () => backend.readDiagnostics(),
    setWaterEnabled(enabled: boolean): void {
      if (waterEnabled === enabled) return;
      waterEnabled = enabled;
      publishCurrentSet();
    }
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
  heading.textContent = "HVP-02 UNAVAILABLE";
  const detail = documentPort.createElement("p");
  detail.id = "hvp-error-detail";
  detail.textContent = `Technical initialization failure: ${error instanceof Error ? error.message : "HVP-02 initialization failed."}`;
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
    readonly createBackend?: (options: ConstructorParameters<typeof ThreeRenderBackend>[0]) => HvpBackend;
    readonly createSession?: (seed: HvpSessionSeed) => HvpSession;
  } = {}
): Promise<HvpBootstrapHandle> => {
  const documentPort = overrides.documentPort ?? document;
  if (activeHvpMount || documentPort.querySelector("#hvp-hud") !== null) {
    throw new Error("HVP-02 already mounted: dispose the live session before starting again.");
  }
  activeHvpMount = true;
  const windowPort = overrides.windowPort ?? window;
  documentPort.body.dataset.hestiaPrototype = "1";
  documentPort.body.dataset.hestiaPrototypeState = "Loading" satisfies HvpLifecycleState;

  let backend: HvpBackend | undefined;
  let camera: ReturnType<typeof createHvpCamera> | undefined;
  let hud: ReturnType<typeof createHvpHud> | undefined;
  let lookScene: HvpLookScene | undefined;
  let waterEnabled = true;
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
      lookScene?.dispose();
      lookScene = undefined;
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
    if (canvas === null) throw new Error("Missing #debug-scene canvas for HVP-02.");
    canvas.setAttribute("aria-label", "HVP-01 visible coast viewport");
    const host = documentPort.querySelector<HTMLElement>("#app");
    if (host === null) throw new Error("Missing #app host for HVP-02.");
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

    const look = createHvpLookProfile("readable");
    documentPort.body.dataset.hestiaPrototypeLook = look.id;
    documentPort.body.dataset.hestiaPrototypeMaterialRoles = look.materials.map((material) => material.role).join(",");
    documentPort.body.dataset.hestiaPrototypeLighting = "key-fill";
    documentPort.body.dataset.hestiaPrototypeWaterPresentation = "transparent-non-simulated";
    documentPort.body.dataset.hestiaPrototypeUnderwaterGeometry = "visible";
    documentPort.body.dataset.hestiaPrototypeWaterDepth = "depth-aware";
    documentPort.body.dataset.hestiaPrototypeWaterRenderOrder = String(look.water.renderOrder);
    documentPort.body.dataset.hestiaPrototypeBackground = "distant-coast-proxy";
    documentPort.body.dataset.hestiaPrototypeBackgroundEditable = String(look.distantCoast.editable);
    documentPort.body.dataset.hestiaPrototypeSourceRevision = "1";
    documentPort.body.dataset.hestiaPrototypeSeed = "0";
    documentPort.body.dataset.hestiaPrototypeRenderer = "three-basic-lit";
    const scene = backend.scene;
    if (scene !== undefined) lookScene = createHvpLookScene(scene, look);

    const presentation = createHvpPresentationBackend(backend, () => ({
      position: backend!.camera.position,
      orientation: backend!.camera.quaternion,
      verticalFovDegrees: backend!.camera.fov,
      aspect: backend!.camera.aspect,
      near: backend!.camera.near,
      far: backend!.camera.far
    }), representationKey(HVP_WATER_REPRESENTATION_KEY));

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
    const terrainLook = createHvpLookTerrain(terrainMesh, look);

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
        indices: terrainLook.indices,
        materialRanges: terrainLook.materialRanges,
        bounds: {
          min: { ...terrainMesh.boundsMeters.min },
          max: { ...terrainMesh.boundsMeters.max }
        }
      }),
      materialProfiles: terrainLook.materialProfiles
    })), "HVP terrain upsert");

    requireAccepted(presentation.dispatch(createRenderCommand({
      kind: "UpsertMeshArtifact",
      backendRevision: backendRevision(0),
      artifact: createMeshArtifact({
        representationKey: representationKey(HVP_WATER_REPRESENTATION_KEY),
        sourceRevision: sourceRevision(1),
        artifactRevision: artifactRevision(1),
        algorithmVersion: HVP_WATER_ALGORITHM_VERSION,
        frameId: frame,
        positions: water.positions,
        normals: water.normals,
        indices: water.indices,
        materialRanges: [{
          materialProfileId: look.water.materialProfile.id,
          startIndex: 0,
          indexCount: water.indices.length
        }],
        bounds: { min: { ...water.boundsMeters.min }, max: { ...water.boundsMeters.max } }
      }),
      materialProfiles: [look.water.materialProfile]
    })), "HVP water upsert");

    const representationRoot = backend.representationRoot;
    const waterNode = representationRoot?.getObjectByName(`representation:${HVP_WATER_REPRESENTATION_KEY}`);
    if (waterNode !== undefined) {
      waterNode.renderOrder = look.water.renderOrder;
      waterNode.frustumCulled = false;
    }

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
        },
        readWaterEnabled: () => waterEnabled,
        setWaterEnabled: (enabled: boolean) => {
          waterEnabled = enabled;
          presentation.setWaterEnabled(enabled);
          documentPort.body.dataset.hestiaPrototypeWater = enabled ? "on" : "off";
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
