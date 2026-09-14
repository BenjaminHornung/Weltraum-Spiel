import * as THREE from "three";
import { ThreeRenderBackend } from "../render/three/backend";
import { ThreeMaterialFactory, type ThreeMaterialLease } from "../render/three/backend/threeMaterialFactory";
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
  assertHvpWaterPresentation,
  createHvpLookProfile,
  type HvpLookMaterialRole,
  type HvpLookProfile
} from "../hestia-prototype/presentation/look";
import {
  HVP_COAST_CPU_BUDGET_BYTES,
  HVP_COAST_DRAW_CALL_BUDGET,
  HVP_COAST_MESH_BUDGET_BYTES,
  HVP_COAST_SEED_NAME,
  HVP_COAST_SOURCE_VERSION,
  HVP_COAST_TRIANGLE_BUDGET,
  HVP_JOIN_WATER_HALF_METERS,
  HVP_OUTER_WATER_CELL_METERS,
  HVP_OUTER_WATER_HALF_METERS,
  HVP_SOURCE_CELL_METERS,
  HVP_SOURCE_SIZE_X,
  HVP_SOURCE_SIZE_Z,
  HVP_SOURCE_SLOT_COUNT,
  deriveHvpWaterMask,
  hvpSourceSlotRole,
  materializeHvpCoastSourceAsync,
  prepareHvpCoastSource,
  type HvpCoastSourceSnapshot,
  type HvpPreparedCoastSource,
  type HvpWaterMask
} from "./hvpCoastSource";
import {
  HVP_COAST_MESH_ALGORITHM_VERSION,
  HVP_FARFIELD_MESH_ALGORITHM_VERSION,
  HVP_WATER_MESH_ALGORITHM_VERSION,
  meshHvpCoastSource,
  meshHvpFarField,
  meshHvpJoinRing,
  meshHvpWaterMask,
  type HvpCompactMesh
} from "./hvpCoastMesher";
import {
  HVP_FRAME_ID,
  HVP_TERRAIN_REPRESENTATION_KEY,
  HVP_WATER_REPRESENTATION_KEY,
  type HvpBlockMesh
} from "./hvpTerrain";

/** Fail-closed double-mount guard: at most one live HVP session per module. */
let activeHvpMount = false;
/** Mount generation: late teardown of a superseded start must not touch the live mount. */
let hvpMountEpoch = 0;

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

const HVP_JOIN_REPRESENTATION_KEY = "hvp:join";
const HVP_FAR_REPRESENTATION_KEY = "hvp:far";

const accepted = (result: RenderCommandResult): boolean =>
  result.status === "Accepted" || result.status === "AlreadyApplied";

const requireAccepted = (result: RenderCommandResult, operation: string): void => {
  if (!accepted(result)) throw new Error(`${operation} failed: ${result.reasonCode ?? result.status}`);
};

export interface HvpLookTerrain {
  readonly indices: Uint16Array | Uint32Array;
  readonly materialRanges: readonly MaterialRange[];
  readonly materialProfiles: readonly MaterialProfile[];
}

const HVP_LOOK_ROLES: readonly HvpLookMaterialRole[] = [
  "limestone-dry",
  "limestone-wet",
  "soil",
  "moss"
];

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

/**
 * @deprecated Reference-only HVP-01 look oracle path: derives roles from
 * face height/normal heuristics and diverges from production slot grouping
 * (createHvpCompactLookTerrain). Do not wire to production; kept for
 * existing test oracles only. No runtime change.
 * Reorders only render indices so each semantic look role stays one draw group.
 */
export const createHvpLookTerrain = (mesh: HvpBlockMesh, look: HvpLookProfile): HvpLookTerrain => {
  if (look.materials.length !== HVP_LOOK_ROLES.length) {
    throw new Error(`HVP look must define exactly ${HVP_LOOK_ROLES.length} terrain material roles.`);
  }
  const indicesByRole = new Map<HvpLookMaterialRole, number[]>(
    look.materials.map((material) => [material.role, []])
  );
  if (indicesByRole.size !== HVP_LOOK_ROLES.length) {
    throw new Error("HVP look terrain roles must be unique.");
  }
  for (const role of HVP_LOOK_ROLES) {
    const material = look.materials.find((candidate) => candidate.role === role);
    if (material === undefined || material.materialProfile.id !== `hvp:look:${role}`) {
      throw new Error(`HVP look role/profile divergence for ${role}.`);
    }
  }
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
  for (const role of HVP_LOOK_ROLES) {
    const material = look.materials.find((candidate) => candidate.role === role);
    const roleIndices = indicesByRole.get(role);
    if (material === undefined || roleIndices === undefined || roleIndices.length === 0) {
      throw new Error(`HVP look material role ${role} is empty.`);
    }
    const startIndex = orderedIndices.length;
    for (const index of roleIndices) {
      orderedIndices.push(index);
    }
    materialRanges.push({
      materialProfileId: material.materialProfile.id,
      startIndex,
      indexCount: roleIndices.length
    });
    materialProfiles.push(material.materialProfile);
  }
  if (materialRanges.length !== HVP_LOOK_ROLES.length || materialProfiles.length !== HVP_LOOK_ROLES.length) {
    throw new Error("HVP look must produce one non-empty terrain range per role.");
  }
  return Object.freeze({
    indices: mesh.indices instanceof Uint32Array ? new Uint32Array(orderedIndices) : new Uint16Array(orderedIndices),
    materialRanges: Object.freeze(materialRanges),
    materialProfiles: Object.freeze(materialProfiles)
  });
};

/**
 * Production look grouping: mesher slot runs map to look roles through the
 * source registry, never through screen color. Strict mode emits exactly one
 * non-empty range per role in deterministic role order, without argument-list
 * spread over fine-mesh index runs. Partial mode (far proxy only) skips
 * absent roles while keeping order, divergence, and contiguity checks.
 */
export const createHvpCompactLookTerrain = (
  mesh: HvpCompactMesh,
  look: HvpLookProfile,
  options: { allowPartialRoles?: boolean } = {}
): HvpLookTerrain => {
  if (look.materials.length !== HVP_LOOK_ROLES.length) {
    throw new Error(`HVP look must define exactly ${HVP_LOOK_ROLES.length} terrain material roles.`);
  }
  const roleBySlot = new Map<number, HvpLookMaterialRole>();
  for (const material of look.materials) {
    if (material.materialProfile.id !== `hvp:look:${material.role}`) {
      throw new Error(`HVP look role/profile divergence for ${material.role}.`);
    }
  }
  for (let slot = 1; slot <= HVP_LOOK_ROLES.length; slot += 1) {
    const role = hvpSourceSlotRole(slot);
    if (!HVP_LOOK_ROLES.includes(role)) {
      throw new Error(`HVP look role is not registered: ${role}`);
    }
    roleBySlot.set(slot, role);
  }
  if (roleBySlot.size !== HVP_LOOK_ROLES.length) {
    throw new Error("HVP look terrain roles must be unique.");
  }
  const counts = new Map<HvpLookMaterialRole, number>();
  for (const role of HVP_LOOK_ROLES) {
    counts.set(role, 0);
  }
  for (const range of mesh.materialRanges) {
    const role = roleBySlot.get(range.slot);
    if (role === undefined) {
      throw new Error(`HVP look role is not registered for slot ${String(range.slot)}`);
    }
    counts.set(role, counts.get(role)! + range.indexCount);
  }
  for (const role of HVP_LOOK_ROLES) {
    if (counts.get(role) === 0) {
      if (options.allowPartialRoles === true) {
        continue;
      }
      throw new Error(`HVP look material role ${role} is empty.`);
    }
  }
  const useUint32 = mesh.indices instanceof Uint32Array;
  const orderedIndices = useUint32
    ? new Uint32Array(mesh.indices.length)
    : new Uint16Array(mesh.indices.length);
  const materialRanges: MaterialRange[] = [];
  const materialProfiles: MaterialProfile[] = [];
  let cursor = 0;
  for (const role of HVP_LOOK_ROLES) {
    // Strict mode already rejected empty roles above; partial mode skips them
    // here so no zero-length range ever reaches the artifact contract.
    if (counts.get(role) === 0) {
      continue;
    }
    const material = look.materials.find((candidate) => candidate.role === role);
    if (material === undefined) {
      throw new Error(`HVP look role/profile divergence for ${role}.`);
    }
    const startIndex = cursor;
    for (const range of mesh.materialRanges) {
      if (roleBySlot.get(range.slot) !== role) {
        continue;
      }
      for (let offset = 0; offset < range.indexCount; offset += 1) {
        const sourceIndex = mesh.indices[range.startIndex + offset];
        if (sourceIndex === undefined) {
          throw new Error(`HVP look regrouping hit an unmapped index at range ${range.startIndex}+${offset}.`);
        }
        orderedIndices[cursor] = sourceIndex;
        cursor += 1;
      }
    }
    materialRanges.push({
      materialProfileId: material.materialProfile.id,
      startIndex,
      indexCount: cursor - startIndex
    });
    materialProfiles.push(material.materialProfile);
  }
  if (cursor !== mesh.indices.length) {
    throw new Error("HVP look regrouping dropped mesh indices.");
  }
  return Object.freeze({
    indices: orderedIndices,
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
  root.userData.hvpRenderOnly = true;
  root.userData.hvpEditable = false;

  const previousBackground = scene.background;
  const previousFog = scene.fog;
  const background = new THREE.Color(look.background.color);
  const fog = new THREE.Fog(look.background.color, look.background.fogNear, look.background.fogFar);
  scene.background = background;
  scene.fog = fog;

  const ambient = new THREE.HemisphereLight(
    look.lighting.ambient.color,
    look.lighting.ambient.groundColor ?? 0x2e2a24,
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

export interface HvpResourceCaps {
  readonly maxCpuBytes: number;
  readonly maxMeshBytes: number;
  readonly maxTriangles: number;
  readonly maxDrawCalls: number;
}

export const HVP_RESOURCE_CAPS_DEFAULT: HvpResourceCaps = Object.freeze({
  maxCpuBytes: HVP_COAST_CPU_BUDGET_BYTES,
  maxMeshBytes: HVP_COAST_MESH_BUDGET_BYTES,
  maxTriangles: HVP_COAST_TRIANGLE_BUDGET,
  maxDrawCalls: HVP_COAST_DRAW_CALL_BUDGET
});

export interface HvpResourceLedger {
  readonly slotBytes: number;
  readonly preparedCopyBytes: number;
  readonly maskBytes: number;
  /** Mesher outputs (positions/normals/indices/colors), transient build peak. */
  readonly meshBytes: number;
  readonly groupedIndexBytes: number;
  /**
   * Backend MeshArtifact snapshots: createMeshArtifact copies
   * positions/normals/indices/color once each per dispatched artifact.
   * Retained by the backend for the scene lifetime.
   */
  readonly artifactCopyBytes: number;
  /**
   * Retained logical mesh payload (cap 128 MiB): all four artifact snapshots.
   */
  readonly retainedMeshBytes: number;
  readonly tempEstimateBytes: number;
  /** Build-peak controlled CPU total (cap 256 MiB), not a retained total. */
  readonly totalCpuBytes: number;
  /** GPU-resident bytes are not observable from this runtime: unsupported, never 0. */
  readonly gpuBytes: "unsupported";
  readonly triangles: number;
  readonly drawCalls: number;
}

/**
 * Exact pre-work reservation: owned pages plus mask scratch, before any
 * expensive materialization. Mesher-internal gates cover output allocation
 * during meshing; the full ledger is admitted again before scene publish.
 */
const hvpWaterMaskBytes = (): number => {
  const joinDim = Math.round((HVP_JOIN_WATER_HALF_METERS * 2) / HVP_SOURCE_CELL_METERS);
  const outerDim = Math.round((HVP_OUTER_WATER_HALF_METERS * 2) / HVP_OUTER_WATER_CELL_METERS);
  return HVP_SOURCE_SIZE_X * HVP_SOURCE_SIZE_Z + joinDim * joinDim + outerDim * outerDim;
};

export const estimateHvpPreflightBytes = (): number =>
  HVP_SOURCE_SLOT_COUNT + HVP_SOURCE_SLOT_COUNT + hvpWaterMaskBytes();

export const buildHvpResourceLedger = (input: {
  readonly terrainMesh: HvpCompactMesh;
  readonly waterMesh: HvpCompactMesh;
  readonly joinMesh: HvpCompactMesh;
  readonly farMesh: HvpCompactMesh;
  readonly groupedIndexBytes: number;
  readonly drawCalls: number;
}): HvpResourceLedger => {
  const meshes: ReadonlyArray<HvpCompactMesh> = [input.terrainMesh, input.waterMesh, input.joinMesh, input.farMesh];
  let meshBytes = 0;
  let triangles = 0;
  let tempEstimateBytes = 0;
  for (const mesh of meshes) {
    meshBytes += mesh.positions.byteLength + mesh.normals.byteLength + mesh.indices.byteLength;
    meshBytes += mesh.colors?.byteLength ?? 0;
    triangles += mesh.indices.length / 3;
    tempEstimateBytes += mesh.tempEstimateBytes;
  }
  const artifactCopyBytes = meshBytes;
  const retainedMeshBytes = artifactCopyBytes;
  const maskBytes = hvpWaterMaskBytes();
  const totalCpuBytes =
    HVP_SOURCE_SLOT_COUNT + HVP_SOURCE_SLOT_COUNT + maskBytes + meshBytes + input.groupedIndexBytes
    + artifactCopyBytes + tempEstimateBytes;
  return Object.freeze({
    slotBytes: HVP_SOURCE_SLOT_COUNT,
    preparedCopyBytes: HVP_SOURCE_SLOT_COUNT,
    maskBytes,
    meshBytes,
    groupedIndexBytes: input.groupedIndexBytes,
    artifactCopyBytes,
    retainedMeshBytes,
    tempEstimateBytes,
    totalCpuBytes,
    gpuBytes: "unsupported",
    triangles,
    drawCalls: input.drawCalls
  });
};

export const admitHvpResources = (
  ledger: Pick<HvpResourceLedger, "totalCpuBytes" | "retainedMeshBytes" | "triangles" | "drawCalls">,
  caps: HvpResourceCaps = HVP_RESOURCE_CAPS_DEFAULT
): void => {
  if (ledger.triangles > caps.maxTriangles) {
    throw new Error(`HVP scene BudgetExceeded: ${ledger.triangles} triangles exceed ${caps.maxTriangles}`);
  }
  if (ledger.retainedMeshBytes > caps.maxMeshBytes) {
    throw new Error(`HVP scene BudgetExceeded: ${ledger.retainedMeshBytes} retained mesh bytes exceed ${caps.maxMeshBytes}`);
  }
  if (ledger.totalCpuBytes > caps.maxCpuBytes) {
    throw new Error(`HVP scene BudgetExceeded: ${ledger.totalCpuBytes} CPU bytes exceed ${caps.maxCpuBytes}`);
  }
  if (ledger.drawCalls > caps.maxDrawCalls) {
    throw new Error(`HVP scene BudgetExceeded: ${ledger.drawCalls} draw calls exceed ${caps.maxDrawCalls}`);
  }
};

export interface HvpBoundProducts {
  readonly prepared: HvpPreparedCoastSource;
  readonly terrainMesh: HvpCompactMesh;
  readonly waterMask: HvpWaterMask;
  readonly waterMesh: HvpCompactMesh;
  readonly joinMesh: HvpCompactMesh;
  readonly farMesh: HvpCompactMesh;
}

/**
 * Publication-boundary check: terrain, water, and join products must carry
 * the prepared source digest through their own bound fields, and every
 * algorithm must be on the allowlist. Runs before the first dispatch; the
 * shared MeshArtifact schema is untouched.
 */
export const assertHvpProductsBound = (products: HvpBoundProducts): void => {
  const problems: string[] = [];
  if (products.terrainMesh.sourceDigest !== products.prepared.sourceDigest) {
    problems.push("terrain digest");
  }
  if (products.terrainMesh.algorithmVersion !== HVP_COAST_MESH_ALGORITHM_VERSION) {
    problems.push("terrain algorithm");
  }
  if (products.waterMask.sourceDigest !== products.prepared.sourceDigest) {
    problems.push("water mask source");
  }
  if (products.waterMesh.sourceDigest !== products.waterMask.digest) {
    problems.push("water digest");
  }
  if (products.waterMesh.algorithmVersion !== HVP_WATER_MESH_ALGORITHM_VERSION) {
    problems.push("water algorithm");
  }
  if (products.joinMesh.sourceDigest !== products.prepared.sourceDigest) {
    problems.push("join digest");
  }
  if (products.joinMesh.algorithmVersion !== HVP_COAST_MESH_ALGORITHM_VERSION) {
    problems.push("join algorithm");
  }
  if (products.farMesh.sourceDigest !== products.prepared.sourceDigest) {
    problems.push("far digest");
  }
  if (products.farMesh.algorithmVersion !== HVP_FARFIELD_MESH_ALGORITHM_VERSION) {
    problems.push("far algorithm");
  }
  if (problems.length > 0) {
    throw new Error(`HVP products unbound: ${problems.join(", ")}`);
  }
};

export const startHvp = async (
  overrides: {
    readonly documentPort?: HvpDocumentPort;
    readonly windowPort?: HvpWindowPort;
    readonly createBackend?: (options: ConstructorParameters<typeof ThreeRenderBackend>[0]) => HvpBackend;
    readonly createSourceSnapshot?: () => Promise<HvpCoastSourceSnapshot> | HvpCoastSourceSnapshot;
    readonly resourceCaps?: Partial<HvpResourceCaps>;
  } = {}
): Promise<HvpBootstrapHandle> => {
  const documentPort = overrides.documentPort ?? document;
  if (activeHvpMount || documentPort.querySelector("#hvp-hud") !== null) {
    throw new Error("HVP-02 already mounted: dispose the live session before starting again.");
  }
  activeHvpMount = true;
  const myEpoch = ++hvpMountEpoch;
  const windowPort = overrides.windowPort ?? window;
  documentPort.body.dataset.hestiaPrototype = "1";
  documentPort.body.dataset.hestiaPrototypeState = "Loading" satisfies HvpLifecycleState;

  let backend: HvpBackend | undefined;
  let camera: ReturnType<typeof createHvpCamera> | undefined;
  let hud: ReturnType<typeof createHvpHud> | undefined;
  let lookScene: HvpLookScene | undefined;
  let plainTerrainLease: ThreeMaterialLease | undefined;
  let plainJoinLease: ThreeMaterialLease | undefined;
  let waterEnabled = true;
  let animationFrame: number | undefined;
  let failureRoot: HTMLElement | undefined;
  let disposed = false;
  let disposePromise: Promise<void> | undefined;
  const flightHud = documentPort.querySelector<HTMLElement>("#flight-hud");
  const flightHudWasHidden = flightHud?.hidden ?? true;
  const reticle = documentPort.querySelector<HTMLElement>(".hud-center-safe-area");
  const reticleStyle = reticle?.getAttribute("style") ?? null;
  const restoreReticle = (): void => {
    if (reticle === null || reticle === undefined) {
      return;
    }
    if (reticleStyle === null) {
      reticle.removeAttribute("style");
    } else {
      reticle.setAttribute("style", reticleStyle);
    }
  };

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
      try {
        plainTerrainLease?.release();
      } catch {
        // Plain-variant leases are best-effort on teardown paths.
      }
      plainTerrainLease = undefined;
      try {
        plainJoinLease?.release();
      } catch {
        // Plain-variant leases are best-effort on teardown paths.
      }
      plainJoinLease = undefined;
      if (backend !== undefined) {
        const revision = backend.readDiagnostics().backendRevision;
        backend.dispatch(createRenderCommand({ kind: "DisposeBackend", backendRevision: revision }));
        backend = undefined;
      }
      // Shared DOM belongs to whoever holds the mount now: a superseded
      // start must not wipe a newer mount's datasets or restore its reticle.
      if (hvpMountEpoch === myEpoch) {
        if (flightHud) flightHud.hidden = flightHudWasHidden;
        restoreReticle();
        for (const key of Object.keys(documentPort.body.dataset)) {
          if (key === "hestiaPrototype" || key.startsWith("hestiaPrototype")) delete documentPort.body.dataset[key];
        }
      }
    })();
    disposePromise = cleanup.finally(() => { releaseMount(); });
    return disposePromise;
  };
  // Cancellation is registered before any expensive work so a pagehide
  // during the deferred source still tears the mount down exactly once.
  windowPort.addEventListener("pagehide", pageHide, { once: true });

  try {
    const canvas = documentPort.querySelector<HTMLCanvasElement>("#debug-scene");
    if (canvas === null) throw new Error("Missing #debug-scene canvas for HVP-02.");
    canvas.setAttribute("aria-label", "HVP-02 readable coast viewport");
    const host = documentPort.querySelector<HTMLElement>("#app");
    if (host === null) throw new Error("Missing #app host for HVP-02.");
    if (flightHud) flightHud.hidden = true;
    reticle?.setAttribute("style", "display:none");

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
    assertHvpWaterPresentation(look.water);
    const scene = backend.scene;
    if (scene === undefined) throw new Error("HVP-02 requires a rendered Three.js scene.");
    documentPort.body.dataset.hestiaPrototypeLook = look.id;
    documentPort.body.dataset.hestiaPrototypeMaterialRoles = look.materials.map((material) => material.role).join(",");
    documentPort.body.dataset.hestiaPrototypeLighting = "key-fill";
    documentPort.body.dataset.hestiaPrototypeWaterPresentation = "transparent-non-simulated";
    documentPort.body.dataset.hestiaPrototypeUnderwaterGeometry = "visible";
    documentPort.body.dataset.hestiaPrototypeWaterDepth = "depth-aware";
    documentPort.body.dataset.hestiaPrototypeWaterRenderOrder = String(look.water.renderOrder);
    documentPort.body.dataset.hestiaPrototypeBackground = "distant-coast-proxy";
    documentPort.body.dataset.hestiaPrototypeBackgroundEditable = String(look.distantCoast.editable);
    documentPort.body.dataset.hestiaPrototypeSourceRevision = HVP_COAST_SOURCE_VERSION;
    documentPort.body.dataset.hestiaPrototypeSeed = HVP_COAST_SEED_NAME;
    documentPort.body.dataset.hestiaPrototypeRenderer = "three-basic-lit";

    const presentation = createHvpPresentationBackend(backend, () => ({
      position: backend!.camera.position,
      orientation: backend!.camera.quaternion,
      verticalFovDegrees: backend!.camera.fov,
      aspect: backend!.camera.aspect,
      near: backend!.camera.near,
      far: backend!.camera.far
    }), representationKey(HVP_WATER_REPRESENTATION_KEY));

    const frame = frameId(HVP_FRAME_ID);
    const caps: HvpResourceCaps = { ...HVP_RESOURCE_CAPS_DEFAULT, ...overrides.resourceCaps };
    admitHvpResources(
      {
        totalCpuBytes: estimateHvpPreflightBytes(),
        retainedMeshBytes: 0,
        triangles: 0,
        drawCalls: 0
      },
      caps
    );
    const snapshot = await (overrides.createSourceSnapshot?.() ?? materializeHvpCoastSourceAsync());
    if (disposed || hvpMountEpoch !== myEpoch) {
      // Canceled while the source was deferred: publish nothing, schedule
      // nothing, claim neither Ready nor Error.
      return Object.freeze({ dispose });
    }
    const prepared = prepareHvpCoastSource(snapshot);
    documentPort.body.dataset.hestiaPrototypeSourceDigest = prepared.sourceDigest;
    const terrainMesh = meshHvpCoastSource(prepared);
    if (terrainMesh.faceCount === 0) throw new Error("HVP coast mesher produced no terrain faces.");
    const mask = deriveHvpWaterMask(prepared);
    const water = meshHvpWaterMask(mask);
    const joinMesh = meshHvpJoinRing(prepared);
    const farMesh = meshHvpFarField(prepared);
    assertHvpProductsBound({
      prepared,
      terrainMesh,
      waterMask: mask,
      waterMesh: water,
      joinMesh,
      farMesh
    });
    const terrainLook = createHvpCompactLookTerrain(terrainMesh, look);
    const joinLook = createHvpCompactLookTerrain(joinMesh, look);
    const farLook = createHvpCompactLookTerrain(farMesh, look, { allowPartialRoles: true });
    const ledger = buildHvpResourceLedger({
      terrainMesh,
      waterMesh: water,
      joinMesh,
      farMesh,
      groupedIndexBytes:
        terrainLook.indices.byteLength + joinLook.indices.byteLength + farLook.indices.byteLength,
      drawCalls:
        terrainLook.materialRanges.length + 1 + joinLook.materialRanges.length + farLook.materialRanges.length
    });
    admitHvpResources(ledger, caps);
    lookScene = createHvpLookScene(scene, look);
    documentPort.body.dataset.hestiaPrototypeWaterDigest = mask.digest;
    documentPort.body.dataset.hestiaPrototypeTriangles = String(ledger.triangles);
    documentPort.body.dataset.hestiaPrototypeResources = JSON.stringify({ ledger, caps });

    requireAccepted(presentation.dispatch(createRenderCommand({
      kind: "UpsertMeshArtifact",
      backendRevision: backendRevision(0),
      artifact: createMeshArtifact({
        representationKey: representationKey(HVP_TERRAIN_REPRESENTATION_KEY),
        sourceRevision: sourceRevision(1),
        artifactRevision: artifactRevision(0),
        algorithmVersion: HVP_COAST_MESH_ALGORITHM_VERSION,
        frameId: frame,
        positions: terrainMesh.positions,
        normals: terrainMesh.normals,
        indices: terrainLook.indices,
        attributes: terrainMesh.colors === null ? undefined : { color: terrainMesh.colors },
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
        algorithmVersion: HVP_WATER_MESH_ALGORITHM_VERSION,
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

    requireAccepted(presentation.dispatch(createRenderCommand({
      kind: "UpsertMeshArtifact",
      backendRevision: backendRevision(0),
      artifact: createMeshArtifact({
        representationKey: representationKey(HVP_JOIN_REPRESENTATION_KEY),
        sourceRevision: sourceRevision(1),
        artifactRevision: artifactRevision(2),
        algorithmVersion: HVP_COAST_MESH_ALGORITHM_VERSION,
        frameId: frame,
        positions: joinMesh.positions,
        normals: joinMesh.normals,
        indices: joinLook.indices,
        attributes: joinMesh.colors === null ? undefined : { color: joinMesh.colors },
        materialRanges: joinLook.materialRanges,
        bounds: {
          min: { ...joinMesh.boundsMeters.min },
          max: { ...joinMesh.boundsMeters.max }
        }
      }),
      materialProfiles: joinLook.materialProfiles
    })), "HVP join upsert");

    requireAccepted(presentation.dispatch(createRenderCommand({
      kind: "UpsertMeshArtifact",
      backendRevision: backendRevision(0),
      artifact: createMeshArtifact({
        representationKey: representationKey(HVP_FAR_REPRESENTATION_KEY),
        sourceRevision: sourceRevision(1),
        artifactRevision: artifactRevision(3),
        algorithmVersion: HVP_FARFIELD_MESH_ALGORITHM_VERSION,
        frameId: frame,
        positions: farMesh.positions,
        normals: farMesh.normals,
        indices: farLook.indices,
        materialRanges: farLook.materialRanges,
        bounds: {
          min: { ...farMesh.boundsMeters.min },
          max: { ...farMesh.boundsMeters.max }
        }
      }),
      materialProfiles: farLook.materialProfiles
    })), "HVP far upsert");

    const representationRoot = backend.representationRoot;
    const waterNode = representationRoot?.getObjectByName(`representation:${HVP_WATER_REPRESENTATION_KEY}`);
    if (waterNode !== undefined) {
      waterNode.renderOrder = look.water.renderOrder;
      waterNode.frustumCulled = false;
    }
    let aoEnabled = true;
    documentPort.body.dataset.hestiaPrototypeAo = "on";
    // Plain-variant leases from a mount-owned factory: the backend keeps its
    // colored leases, so toggling swaps whole material arrays and never
    // mutates a cached instance behind another holder's back.
    const materialFactory = new ThreeMaterialFactory();
    plainTerrainLease = materialFactory.acquire(terrainLook.materialProfiles);
    plainJoinLease = materialFactory.acquire(joinLook.materialProfiles);
    const aoColoredByNode = new Map<string, readonly THREE.Material[]>();
    const setAoOnNodes = (enabled: boolean): void => {
      // Render-only Inspect toggle: swaps material arrays on the two
      // AO-carrying representations. Source, density, geometry, camera, and
      // lights stay fixed; water and the far proxy are untouched. No
      // UpsertMeshArtifact, no remesh.
      const root = backend?.representationRoot;
      if (root === undefined || plainTerrainLease === undefined || plainJoinLease === undefined) {
        return;
      }
      const terrainLease = plainTerrainLease;
      const joinLease = plainJoinLease;
      const pairs: ReadonlyArray<{ nodeKey: string; lease: ThreeMaterialLease }> = [
        { nodeKey: HVP_TERRAIN_REPRESENTATION_KEY, lease: terrainLease },
        { nodeKey: HVP_JOIN_REPRESENTATION_KEY, lease: joinLease }
      ];
      for (const pair of pairs) {
        const node = root.getObjectByName(`representation:${pair.nodeKey}`);
        if (!(node instanceof THREE.Mesh)) {
          continue;
        }
        if (enabled) {
          const stashed = aoColoredByNode.get(pair.nodeKey);
          if (stashed !== undefined) {
            node.material = [...stashed];
            for (const material of stashed) {
              material.needsUpdate = true;
            }
          }
        } else {
          if (!aoColoredByNode.has(pair.nodeKey)) {
            const current = Array.isArray(node.material) ? node.material : [node.material];
            aoColoredByNode.set(pair.nodeKey, [...current]);
          }
          node.material = [...pair.lease.materials];
          for (const material of pair.lease.materials) {
            material.needsUpdate = true;
          }
        }
      }
    };

    camera = createHvpCamera({ camera: backend.camera, canvas, windowPort: windowPort as Window });
    const stats = {
      faces: terrainMesh.faceCount + water.faceCount,
      vertices: terrainMesh.positions.length / 3 + water.positions.length / 3,
      triangles: terrainMesh.indices.length / 3 + water.indices.length / 3,
      sceneFaces: terrainMesh.faceCount + water.faceCount + joinMesh.faceCount + farMesh.faceCount,
      sceneTriangles: ledger.triangles
    };
    let inspectEnabled = false;
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
        },
        readInspectEnabled: () => inspectEnabled,
        setInspectEnabled: (enabled: boolean) => {
          inspectEnabled = enabled;
          camera!.setMode(enabled ? "Fly" : "Orbit");
          hud!.update("Ready", camera!.readPose(), stats);
        },
        readAoEnabled: () => aoEnabled,
        setAoEnabled: (enabled: boolean) => {
          aoEnabled = enabled;
          setAoOnNodes(enabled);
          documentPort.body.dataset.hestiaPrototypeAo = enabled ? "on" : "off";
          hud!.update("Ready", camera!.readPose(), stats);
        }
      }
    });
    hud.update("Ready", camera.readPose(), stats);

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
    const wasLive = !disposed;
    try { await dispose(); } catch {
      // The technical failure state remains authoritative even if cleanup reports a secondary error.
    }
    if (!wasLive || hvpMountEpoch !== myEpoch) {
      // Torn down before the failure (pagehide/dispose) or superseded by a
      // newer mount: never install Error UI or wipe another mount's state.
      return Object.freeze({ dispose });
    }
    failureRoot = presentHvpFailure(documentPort, error);
    let failureDisposed = false;
    const disposeFailure = async (): Promise<void> => {
      if (failureDisposed) return;
      failureDisposed = true;
      releaseMount();
      failureRoot?.remove();
      failureRoot = undefined;
      if (hvpMountEpoch === myEpoch) {
        if (flightHud) flightHud.hidden = flightHudWasHidden;
        restoreReticle();
        for (const key of Object.keys(documentPort.body.dataset)) {
          if (key === "hestiaPrototype" || key.startsWith("hestiaPrototype")) delete documentPort.body.dataset[key];
        }
      }
    };
    return Object.freeze({ dispose: disposeFailure });
  }
};
