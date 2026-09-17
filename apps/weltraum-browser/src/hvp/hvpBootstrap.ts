import * as THREE from "three";
import {createHvpListeners} from "../hestia-prototype/runtime/listeners";
import {createHvpNeighborController,type HvpNeighborStage} from "../hestia-prototype/runtime/neighborController";
import {createHvpDormancyController} from "../hestia-prototype/runtime/dormancyController";
import {MemoryContentCache} from "../streaming/memoryContentCache";
import {createHvpSalvageLoop,type HvpSalvageCheckpoint} from "../hestia-prototype/gameplay/salvageLoop";
import {createHvpSalvageMarker,createHvpSalvageLink,HVP_SALVAGE_MARKER_KEY,HVP_SALVAGE_LINK_KEY} from "../hestia-prototype/presentation/salvageMarker";
import { createHvpTerrainRoot,createHvpTerrainOwner,assertHvpTerrainSnapshot,type HvpTerrainSnapshot } from "../hestia-prototype/terrain/cutPlan";
import {assertHvpSupportCurrent,type HvpSupportPlan} from "../hestia-prototype/terrain/supportPlan";
import type {HvpCell} from "../hestia-prototype/terrain/picking";
import { createHvpTerrainCompiler, meshInitialHvpTerrain, type HvpTerrainProducts } from "../hestia-prototype/terrain/terrainProducts";
import { createHvpTerrainConsumer, type HvpStagedTerrain,type HvpPreparedTerrainBody } from "../hestia-prototype/terrain/terrainConsumer";
import {meshHvpTerrainFragment,meshHvpBodyCells} from "../hestia-prototype/presentation/terrainFragment";
import {readHvpBodyCells} from "../hestia-prototype/physics/bodyCutPlan";
import {createHvpSaveStore,HVP_SAVE_SLOT} from "../hestia-prototype/persistence/saveStore";
import {encodeHvpGame,type HvpDecodedGame} from "../hestia-prototype/persistence/gameCheckpoint";
import {encodeHvpPlant} from "../hestia-prototype/persistence/plantCheckpoint";
import {replaceHvpScene} from "../hestia-prototype/persistence/sceneReplacement";
import {createPersistenceSignature} from "../persistence";
import {ADAPTIVE_BRICK_ESTIMATED_BYTES} from "../voxel/adaptive";
import { createHvpPlasmaTool } from "../hestia-prototype/terrain/plasmaTool";
import { createHvpVisualRenderer, HVP_EFFECT_COST, HVP_EFFECT_VERSION } from "../hestia-prototype/presentation/visualEffects";
import { createHvpPhysicsClient, type HvpPhysicsClient } from "../hestia-prototype/physics/client";
import {createHvpMeasurements} from "../hestia-prototype/runtime/measurements";
import { HVP_INERTIA_CELLS, HVP_INERTIA_KEY } from "../hestia-prototype/physics/profile";
import {meshHvpBranchProducts,meshHvpBranchFoliage,type HvpBranchProduct} from "../hestia-prototype/presentation/structuralPart";
import {createHvpStructuralConsumer,type HvpStagedBranch} from "../hestia-prototype/terrain/structuralConsumer";
import {createHvpBodyCutConsumer} from "../hestia-prototype/terrain/bodyCutConsumer";
import { createHvpPlayerInput } from "../hestia-prototype/player/input";
import { createHvpAvatarMesh, HVP_AVATAR_KEY } from "../hestia-prototype/player/presentation";
import type { HvpCollisionSource } from "../hestia-prototype/physics/terrainColliders";
import { fnv1aHash } from "../core/hash";
import { ThreeRenderBackend } from "../render/three/backend";
import { ThreeMaterialFactory, type ThreeMaterialLease } from "../render/three/backend/threeMaterialFactory";
import {
  artifactRevision,
  backendRevision,
  createFrameProjectionSnapshot,
  createMeshArtifact,
  createMaterialProfile,
  createRenderCommand,
  createVisibilityPlan,
  frameId,
  frameRevision,
  representationKey,
  materialProfileId,
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
import { buildHvpPlant, estimateHvpVegetationSourceBytes, meshHvpVegetation, planHvpVegetation, projectHvpVegetation, HVP_VEGETATION_VERSION } from "../hestia-prototype/presentation/vegetation";
import type { RepresentationTransformSnapshot } from "../presentation";
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
  readHvpSourceColumnWorld,
  type HvpCoastSourceSnapshot,
  type HvpPreparedCoastSource,
  type HvpWaterMask
} from "./hvpCoastSource";
import {
  HVP_COAST_MESH_ALGORITHM_VERSION,
  HVP_FARFIELD_MESH_ALGORITHM_VERSION,
  HVP_WATER_MESH_ALGORITHM_VERSION,
  meshHvpFarField,
  meshHvpJoinRing,
  meshHvpWaterMask,
  meshHvpOccupancy,
  type HvpCompactMesh
} from "./hvpCoastMesher";
import {
  HVP_FRAME_ID,
  HVP_WATER_REPRESENTATION_KEY,
  type HvpBlockMesh
} from "./hvpTerrain";

/** Fail-closed double-mount guard: at most one live HVP session per module. */
let activeHvpMount = false;
/** Mount generation: late teardown of a superseded start must not touch the live mount. */
let hvpMountEpoch = 0;

type HvpDocumentPort = Pick<Document, "body" | "querySelector" | "createElement"> & Partial<Pick<Document, "addEventListener" | "removeEventListener" | "hidden">>;
type HvpWindowPort = Pick<Window,
  | "innerWidth"
  | "innerHeight"
  | "devicePixelRatio"
  | "requestAnimationFrame"
  | "cancelAnimationFrame"
  | "addEventListener"
  | "removeEventListener"
> & Partial<Pick<Window,"location"|"confirm">>;
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
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -26;
  key.shadow.camera.right = 26;
  key.shadow.camera.top = 26;
  key.shadow.camera.bottom = -26;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 110;
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = 0.035;
  key.shadow.bias = -0.0002;
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
      key.shadow.dispose();
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
  updateProjection(): void;
}

export const createHvpPresentationBackend = (
  backend: RenderBackend,
  readCamera: () => HvpProjectionCamera,
  waterRepresentationKey: RepresentationKey,
  readObjectTransforms: () => readonly RepresentationTransformSnapshot[] = () => [],
  isRepresentationVisible: (key: RepresentationKey) => boolean = () => true,
  onTiming?: (metric:string,start:number,duration:number)=>void,
  deferInitialProjection = false
): HvpPresentationBackend => {
  const framesByRepresentation = new Map<RepresentationKey, FrameId>();
  let lastFrameId: FrameId | undefined;
  let projectionRevision = 0;
  let waterEnabled = true;

  const publishCurrentSet = (): void => {
    if (deferInitialProjection) { return; }
    const current = framesByRepresentation.values().next().value ?? lastFrameId;
    if (current === undefined) return;
    const started=onTiming?performance.now():0;
    for (const candidate of framesByRepresentation.values()) {
      if (candidate !== current) throw new Error("HVP representations must share one projection frame.");
    }
    projectionRevision += 1;
    const camera = readCamera();
    const keys = [...framesByRepresentation.keys()];
    const isVisible = (key: RepresentationKey): boolean => (waterEnabled || (key !== waterRepresentationKey && !key.startsWith(`${waterRepresentationKey}:`))) && isRepresentationVisible(key);
    const objectTransforms = new Map(readObjectTransforms().map((transform) => [transform.representationKey, transform]));
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
        representationTransforms: keys.map((key) => objectTransforms.get(key) ?? ({
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
        visibleRepresentationKeys: keys.filter(isVisible),
        fallbackRepresentationKeys: [],
        hiddenRepresentationKeys: keys.filter(key => !isVisible(key))
      })
    })), "HVP visibility plan");
    onTiming?.("startupProjectionMs",started,performance.now()-started);
  };

  const dispatch = (command: RenderCommand): RenderCommandResult => {
    const started=onTiming&&command.kind==="UpsertMeshArtifact"?performance.now():0;
    const result = backend.dispatch(command);
    if(onTiming&&command.kind==="UpsertMeshArtifact"){onTiming("startupBackendUpsertMs",started,performance.now()-started);}
    if (command.kind === "UpsertMeshArtifact" && accepted(result)) {
      lastFrameId = command.artifact.frameId;
      framesByRepresentation.set(command.artifact.representationKey, command.artifact.frameId);
      publishCurrentSet();
    } else if ((command.kind === "RemoveRepresentation" || command.kind === "EvictRepresentation") && accepted(result)) {
      framesByRepresentation.delete(command.representationKey);
      publishCurrentSet();
    } else if (command.kind === "ResetBackend" || command.kind === "DisposeBackend") {
      framesByRepresentation.clear();
      lastFrameId = undefined;
    }
    return result;
  };

  return Object.freeze({
    dispatch,
    updateProjection: () => { deferInitialProjection = false; publishCurrentSet(); },
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
  readonly vegetationSourceBytes: number;
  readonly checkpointSourceBytes: number;
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
  readonly terrainMeshes?: readonly HvpCompactMesh[];
  readonly waterMesh: HvpCompactMesh;
  readonly joinMesh: HvpCompactMesh;
  readonly farMesh: HvpCompactMesh;
  readonly groupedIndexBytes: number;
  readonly drawCalls: number;
  readonly additionalMeshes?: readonly HvpCompactMesh[];
  readonly vegetationSourceBytes?: number;
  readonly checkpointSourceBytes?:number;
  readonly visualEffects?: boolean;
}): HvpResourceLedger => {
  const meshes: ReadonlyArray<HvpCompactMesh> = [...(input.terrainMeshes ?? [input.terrainMesh]), input.waterMesh, input.joinMesh, input.farMesh, ...(input.additionalMeshes ?? [])];
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
  const effects = input.visualEffects ? HVP_EFFECT_COST : { triangles:0,drawCalls:0,cpuBytes:0,meshBytes:0 };
  const retainedMeshBytes = artifactCopyBytes + effects.meshBytes;
  const maskBytes = hvpWaterMaskBytes();
  const vegetationSourceBytes = input.vegetationSourceBytes ?? 0;
  const checkpointSourceBytes=input.checkpointSourceBytes??0;
  const totalCpuBytes =
    HVP_SOURCE_SLOT_COUNT + HVP_SOURCE_SLOT_COUNT + maskBytes + meshBytes + input.groupedIndexBytes
    + artifactCopyBytes + tempEstimateBytes + vegetationSourceBytes * 2 + effects.cpuBytes + checkpointSourceBytes;
  return Object.freeze({
    slotBytes: HVP_SOURCE_SLOT_COUNT,
    preparedCopyBytes: HVP_SOURCE_SLOT_COUNT,
    maskBytes,
    meshBytes,
    groupedIndexBytes: input.groupedIndexBytes,
    artifactCopyBytes,
    retainedMeshBytes,
    tempEstimateBytes,
    vegetationSourceBytes,
    checkpointSourceBytes,
    totalCpuBytes,
    gpuBytes: "unsupported",
    triangles: triangles + effects.triangles,
    drawCalls: input.drawCalls + effects.drawCalls
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

/** Initial mesher scratch is no longer live during replacement. Retain both
 * generations, grouped indices and the bounded worker/World preparation reserve. */
export const estimateHvpStageCpuBytes=(before:Pick<HvpResourceLedger,"totalCpuBytes"|"tempEstimateBytes">,
  after:Pick<HvpResourceLedger,"totalCpuBytes"|"tempEstimateBytes">,stagedMeshBytes:number,preparationBytes:number):number=>
  Math.max(before.totalCpuBytes-before.tempEstimateBytes,after.totalCpuBytes-after.tempEstimateBytes)
  +stagedMeshBytes*3+preparationBytes;

export interface HvpBoundProducts {
  readonly prepared: HvpPreparedCoastSource;
  readonly terrainMesh: HvpCompactMesh;
  readonly terrainMeshes?: readonly HvpCompactMesh[];
  readonly terrainSource?:HvpTerrainSnapshot;
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
  if(products.terrainSource){assertHvpTerrainSnapshot(products.terrainSource);
    if(products.terrainSource.baseDigest!==products.prepared.sourceDigest){problems.push("terrain base digest");}}
  const terrainDigest=products.terrainSource?.sourceDigest??products.prepared.sourceDigest;
  if (products.terrainMesh.sourceDigest !== terrainDigest) {
    problems.push("terrain digest");
  }
  if (products.terrainMesh.algorithmVersion !== HVP_COAST_MESH_ALGORITHM_VERSION && products.terrainMeshes === undefined) {
    problems.push("terrain algorithm");
  }
  if (products.terrainMeshes !== undefined && (products.terrainMeshes.length !== 16 || products.terrainMeshes.some(mesh =>
    mesh.algorithmVersion !== "hvp-terrain-sector-v1" || mesh.sourceDigest !== terrainDigest))) {
    problems.push("terrain sector binding");
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
    readonly createPhysics?: typeof createHvpPhysicsClient;
  } = {}
): Promise<HvpBootstrapHandle> => {
  const documentPort = overrides.documentPort ?? document;
  if (activeHvpMount || documentPort.querySelector("#hvp-hud") !== null) {
    throw new Error("HVP-02 already mounted: dispose the live session before starting again.");
  }
  activeHvpMount = true;
  const myEpoch = ++hvpMountEpoch;
  const windowPort = overrides.windowPort ?? window;
  const measurement=createHvpMeasurements(new URLSearchParams(windowPort.location?.search??"").get("hvpMeasure")==="1");
  const measurementStarted=performance.now();
  let startupPhaseStarted=measurementStarted;
  let startupMeasuring=true;
  const startupPhase=(name:string):void=>{
    if(!measurement.enabled){return;}
    const now=performance.now();measurement.record(name,startupPhaseStarted,now-startupPhaseStarted);startupPhaseStarted=now;
  };
  documentPort.body.dataset.hestiaPrototype = "1";
  documentPort.body.dataset.hestiaPrototypeState = "Loading" satisfies HvpLifecycleState;

  let backend: HvpBackend | undefined;
  let camera: ReturnType<typeof createHvpCamera> | undefined;
  let hud: ReturnType<typeof createHvpHud> | undefined;
  let physics: HvpPhysicsClient | undefined;
  let playerInput: ReturnType<typeof createHvpPlayerInput> | undefined;
  const physicsAbort = new AbortController();
  let physicsPausedByFocus = false;
  const pausePhysics = (): void => { physicsPausedByFocus = true; void physics?.command("Pause").catch(() => {}); };
  const visibilityChanged = (): void => { if (documentPort.hidden) { pausePhysics(); } };
  let lookScene: HvpLookScene | undefined;
  const plainTerrainLeases: Array<{nodeKey:string;lease:ThreeMaterialLease}> = [];
  let terrainCompiler: ReturnType<typeof createHvpTerrainCompiler> | undefined;
  let terrainConsumer: ReturnType<typeof createHvpTerrainConsumer> | undefined;
  let structuralConsumer:ReturnType<typeof createHvpStructuralConsumer>|undefined;
  let bodyCutConsumer:ReturnType<typeof createHvpBodyCutConsumer>|undefined;
  let neighbor:ReturnType<typeof createHvpNeighborController>|undefined;
  let dormancy:ReturnType<typeof createHvpDormancyController>|undefined;
  const neighborCache=new MemoryContentCache(32*1024*1024);
  let plasmaTool: ReturnType<typeof createHvpPlasmaTool> | undefined;
  let saveStore:ReturnType<typeof createHvpSaveStore>|undefined;
  let saveBusy=false,saveHold=false;
  const listeners=createHvpListeners();
  let visualDisposal:Readonly<{geometries:number;textures:number}>|undefined;
  let disposalReceipt:Record<string,unknown>|undefined;
  // The post-session launcher must not retain the inner scene/cell closures.
  const launcherListeners=createHvpListeners();
  let launcher:HTMLElement|undefined;
  const restartAfterEnd=()=>{launcherListeners.dispose();launcher?.remove();launcher=undefined;windowPort.location?.assign(`/?hestiaPrototype=1${measurement.enabled?"&hvpMeasure=1":""}`);};
  let plainJoinLease: ThreeMaterialLease | undefined;
  const plainVegetationLeases: Array<{ nodeKey: string; lease: ThreeMaterialLease }> = [];
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
      const errors:unknown[]=[];
      const attempt=async(action:()=>unknown)=>{try{await action();}catch(error){errors.push(error);}};
      const closingInput=playerInput,closingCamera=camera,closingHud=hud,closingPhysics=physics,closingCompiler=terrainCompiler,closingBackend=backend;
      if(animationFrame!==undefined){windowPort.cancelAnimationFrame(animationFrame);animationFrame=undefined;}
      await attempt(()=>listeners.dispose());
      await attempt(()=>playerInput?.dispose()); playerInput=undefined;
      await attempt(()=>plasmaTool?.dispose());plasmaTool=undefined;
      await attempt(()=>terrainConsumer?.dispose());terrainConsumer=undefined;
      await attempt(()=>structuralConsumer?.dispose());structuralConsumer=undefined;
      await attempt(()=>bodyCutConsumer?.dispose());bodyCutConsumer=undefined;
      await attempt(()=>dormancy?.dispose());dormancy=undefined;
      await attempt(()=>neighbor?.dispose());neighbor=undefined;neighborCache.clear();
      await attempt(()=>terrainCompiler?.dispose());terrainCompiler=undefined;
      physicsAbort.abort();
      await attempt(()=>physics?.dispose());
      await attempt(()=>saveStore?.close());saveStore=undefined;
      physics = undefined;
      await attempt(()=>hud?.dispose());
      hud = undefined;
      await attempt(()=>camera?.dispose());
      camera = undefined;
      await attempt(()=>lookScene?.dispose());
      lookScene = undefined;
      failureRoot?.remove();
      failureRoot = undefined;
      for (const pair of plainTerrainLeases.splice(0)) {
        await attempt(()=>pair.lease.release());
      }
      try {
        plainJoinLease?.release();
      } catch(error) {errors.push(error);}
      plainJoinLease = undefined;
      for (const pair of plainVegetationLeases.splice(0)) {
        await attempt(()=>pair.lease.release());
      }
      if (backend !== undefined) {
        await attempt(()=>{const revision=backend!.readDiagnostics().backendRevision;
          requireAccepted(backend!.dispatch(createRenderCommand({kind:"DisposeBackend",backendRevision:revision})),"HVP backend disposal");});
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
      const native=closingPhysics?.lifecycle?.(),jobs=closingCompiler?.diagnostics(),render=closingBackend?.readDiagnostics();
      disposalReceipt={state:errors.length?"Failed":"Disposed",errors:errors.map(String),
        scope:"HVP-owned registrations, worker timers, backend/cache objects; not process or GPU byte usage",
        disposed:{geometries:render?render.geometryAllocations-render.geometryDisposals:null,
          materials:render?render.materialAllocations-render.materialDisposals:null,textures:visualDisposal?.textures??null,
          workers:native===undefined?null:native.workers+(jobs?.workers??0),
          listeners:listeners.size+(closingInput?.listenerCount??0)+(closingCamera?.listenerCount??0)+(closingHud?.listenerCount??0)+(native?.listeners??0),
          timers:native?.timers??null,pendingJobs:(jobs?.runningJobs??0)+(jobs?.queue??0)+(native?.pendingJobs??0),
          bodies:native?.native?.bodies??null,colliders:native?.native?.colliders??null,ownedBytes:render?.ownedCpuBytes??null},
        cacheBytes:neighborCache.totalBytes,visual:visualDisposal??null,native:native?.native??null,measurementHealth:measurement.read()};
      if(errors.length){throw errors[0];}
    })();
    disposePromise = cleanup.finally(() => { releaseMount(); });
    return disposePromise;
  };
  // Cancellation is registered before any expensive work so a pagehide
  // during the deferred source still tears the mount down exactly once.
  listeners.add(windowPort,"pagehide",pageHide,{once:true});
  listeners.add(windowPort,"blur",pausePhysics);
  if(documentPort.addEventListener&&documentPort.removeEventListener){listeners.add(documentPort as Pick<Document,"addEventListener"|"removeEventListener">,"visibilitychange",visibilityChanged);}

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
      lightingMode: "None",
      rendererFactory: (canvas,parameters)=>createHvpVisualRenderer(canvas,parameters,undefined,remaining=>{visualDisposal=remaining;})
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

    let vegetationTransforms: readonly RepresentationTransformSnapshot[] = [];
    let physicsTransforms: readonly RepresentationTransformSnapshot[] = [];
    const activeTerrainKeys = new Set<string>();
    const activeFragmentKeys=new Set<string>();
    const managedFragmentKeys=new Set<string>();
    const managedRestoreKeys=new Set<string>(),activeRestoreKeys=new Set<string>();
    const managedNeighborKeys=new Set<string>(),activeNeighborKeys=new Set<string>();
    const activeBranchKeys=new Set<string>();
    let branchProducts:readonly HvpBranchProduct[]=[];
    let activePreviewKey="";
    const presentation = createHvpPresentationBackend(backend, () => ({
      position: backend!.camera.position,
      orientation: backend!.camera.quaternion,
      verticalFovDegrees: backend!.camera.fov,
      aspect: backend!.camera.aspect,
      near: backend!.camera.near,
      far: backend!.camera.far
    }), representationKey(HVP_WATER_REPRESENTATION_KEY), () => [...vegetationTransforms, ...physicsTransforms,
      ...physicsTransforms.filter(t=>t.representationKey==="hvp:branch:parent").map(t=>({...t,representationKey:representationKey(HVP_SALVAGE_LINK_KEY)})),
      ...branchProducts.filter(p=>p.decoration).flatMap(p=>{
        const owner=physicsTransforms.find(t=>t.representationKey===p.ownerId);
        return owner?[{...owner,representationKey:representationKey(p.key)}]:[];
      })],
    key => (key !== HVP_AVATAR_KEY || !(playerInput?.active) || playerInput.thirdPerson)
      && (key!==HVP_SALVAGE_LINK_KEY||branchProducts.some(p=>p.ownerId==="hvp:branch:parent"))
      && (!key.startsWith("hvp:terrain:s") || activeTerrainKeys.has(key))
      && (!managedFragmentKeys.has(key)||activeFragmentKeys.has(key))
      && (!managedRestoreKeys.has(key)||activeRestoreKeys.has(key))
      && (!managedNeighborKeys.has(key)||activeNeighborKeys.has(key))
      && (!(key.startsWith("hvp:branch:")||key.startsWith("hvp-branch:"))||activeBranchKeys.has(key)||activeFragmentKeys.has(key))
      && (!key.startsWith("hvp:tool:preview:") || key===activePreviewKey),
      measurement.enabled?(name,start,duration)=>{if(startupMeasuring){measurement.record(name,start,duration);}}:undefined,true);

    const frame = frameId(HVP_FRAME_ID);
    const caps: HvpResourceCaps = { ...HVP_RESOURCE_CAPS_DEFAULT, ...overrides.resourceCaps };
    admitHvpResources(
      {
        totalCpuBytes: estimateHvpPreflightBytes() + 32 * 1024 * 1024,
        retainedMeshBytes: 0,
        triangles: 0,
        drawCalls: 0
      },
      caps
    );
    startupPhase("startupRendererMs");
    const loadQuery=new URLSearchParams(windowPort.location?.search??"").get("hvpLoad");
    if(loadQuery!==null&&loadQuery!=="primary"){throw new Error("Unknown Hestia restore slot");}
    let coldGame:HvpDecodedGame|undefined,coldRevision:number|null=null,checkpointSourceBytes=0;
    if(loadQuery==="primary"){
      admitHvpResources({totalCpuBytes:80*1024*1024,retainedMeshBytes:0,triangles:0,drawCalls:0},caps);
      saveStore=createHvpSaveStore();await saveStore.initialize();const record=await saveStore.load();
      coldGame=record.game;coldRevision=record.metadata.recordRevision;
      checkpointSourceBytes=HVP_SOURCE_SLOT_COUNT+coldGame.world.sourceBytes+record.metadata.payloadBytes*4+(coldGame.neighborRoot?HVP_SOURCE_SLOT_COUNT:0);
    }
    const snapshot = coldGame?.base??await (overrides.createSourceSnapshot?.() ?? materializeHvpCoastSourceAsync());
    if (disposed || hvpMountEpoch !== myEpoch) {
      // Canceled while the source was deferred: publish nothing, schedule
      // nothing, claim neither Ready nor Error.
      return Object.freeze({ dispose });
    }
    const prepared = prepareHvpCoastSource(snapshot);
    startupPhase("startupSourceMs");
    documentPort.body.dataset.hestiaPrototypeSourceDigest = prepared.sourceDigest;
    const terrainRoot = createHvpTerrainOwner(coldGame?.root??createHvpTerrainRoot(prepared, `hvp-session-${myEpoch}`, myEpoch));
    documentPort.body.dataset.hestiaPrototypeRestoreSource=coldGame?"artifact":"authored-start";
    const coldEast=coldGame?.checkpoint.world.neighbor?.resident?coldGame.neighborRoot?.read():undefined;
    const initialTerrain = meshInitialHvpTerrain(terrainRoot.read(),coldEast);
    const terrainMesh = initialTerrain.get(0)!;
    if (terrainMesh.faceCount === 0) throw new Error("HVP coast mesher produced no terrain faces.");
    const mask = deriveHvpWaterMask(prepared);
    let water = meshHvpWaterMask(mask);
    let joinMesh = meshHvpJoinRing(prepared);
    let farMesh = meshHvpFarField(prepared);
    const originalProxies={water,join:joinMesh,far:farMesh};
    assertHvpProductsBound({
      prepared,
      terrainMesh,
      terrainMeshes: [...initialTerrain.values()],
      terrainSource:terrainRoot.read(),
      waterMask: mask,
      waterMesh: water,
      joinMesh,
      farMesh
    });
    startupPhase("startupCoastMeshMs");
    const terrainLooks = new Map([...initialTerrain].map(([id, mesh]) => [id, createHvpCompactLookTerrain(mesh, look, {allowPartialRoles:true})]));
    let joinLook = createHvpCompactLookTerrain(joinMesh, look);
    let farLook = createHvpCompactLookTerrain(farMesh, look, { allowPartialRoles: true });
    const plants = coldGame?coldGame.plants.map(p=>p.instance):planHvpVegetation();
    const vegetationSourceBytes = estimateHvpVegetationSourceBytes(plants);
    if (vegetationSourceBytes > 16 * 1024 * 1024) { throw new Error("Vegetation source BudgetExceeded before allocation"); }
    const collisionSources: HvpCollisionSource[] = [{...terrainRoot.read(),
      readHaloSlot:coldEast?(x,y,z)=>x>=256?coldEast.readSlot(x-256,y,z):undefined:undefined}];
    const plantSources=coldGame?.plants??plants.map(buildHvpPlant);
    const vegetation = plantSources.flatMap((source) => {
      const plant=source.instance;
      if (source.wood !== null) {
        const wood = source.wood;
        collisionSources.push({ sizeX: wood.sizeX, sizeY: wood.sizeY, sizeZ: wood.sizeZ, cellMeters: wood.cellMeters,
          originMeters: { x: plant.position.x + wood.originMeters.x, y: plant.position.y + wood.originMeters.y, z: plant.position.z + wood.originMeters.z },
          readSlot: (x, y, z) => wood.slotAt(x, y, z) });
      }
      return meshHvpVegetation(source);
    });
    startupPhase("startupVegetationMs");
    if(coldEast){collisionSources.push({...coldEast,readHaloSlot:(x,y,z)=>x<0?terrainRoot.read().readSlot(x+256,y,z):undefined});}
    const spawn = coldGame?.checkpoint.world.dropSpawn??{ x: -9, y: readHvpSourceColumnWorld(-9, -9).topMeters + 2.25, z: -9 };
    const savedDrop=coldGame?.world.bodies.find(b=>b.checkpoint.family==="drop"),savedInertia=coldGame?.world.bodies.find(b=>b.checkpoint.family==="inertia");
    if(coldGame&&(!savedDrop||!savedInertia)){throw new Error("Saved prototype specimens missing");}
    const dropMesh = savedDrop?meshHvpBodyCells(readHvpBodyCells(savedDrop.recipe.source),savedDrop.recipe.mass.centerOfMassMeters!,savedDrop.recipe.source.contentHash)
      :meshHvpOccupancy({ sizeX: 4, sizeY: 4, sizeZ: 4, cellMeters: 0.125,
      originMeters: { x: -0.25, y: -0.25, z: -0.25 }, slotAt: () => 1 }, undefined, "hvp-drop-cube-v1", "hvp-drop-cube-v1");
    const avatarMesh = createHvpAvatarMesh();
    const inertiaSlots=new Uint8Array(8*8*2);
    for(const c of HVP_INERTIA_CELLS) { inertiaSlots[c.x+c.y*8+c.z*64]=c.materialId; }
    let inertiaMesh=savedInertia?meshHvpBodyCells(readHvpBodyCells(savedInertia.recipe.source),{x:0,y:0,z:0},savedInertia.recipe.source.contentHash)
      :meshHvpOccupancy({sizeX:8,sizeY:8,sizeZ:2,cellMeters:.125,originMeters:{x:0,y:0,z:0},
      slotAt:(x,y,z)=>inertiaSlots[x+y*8+z*64]!},undefined,"hvp-inertia-l-v1","hvp-inertia-l-v1");
    vegetationTransforms = projectHvpVegetation(vegetation, plants.map((plant) => ({
      ownerId: plant.id, position: plant.position, orientation: { x: 0, y: 0, z: 0, w: 1 }
    })));
    const scenario=new URLSearchParams(windowPort.location?.search??"").get("hvpScenario")??"coast";
    if(!["coast","rock-arm","salvage","east-edge"].includes(scenario)){throw new Error("Unknown Hestia scenario");}
    const salvageScenario=coldGame?coldGame.checkpoint.world.branch?.kind==="salvage":scenario==="salvage";
    const salvageMarker=salvageScenario?createHvpSalvageMarker(readHvpSourceColumnWorld(-11.5,-12.625).topMeters):undefined;
    const salvageLink=salvageScenario?createHvpSalvageLink():undefined;
    type NeighborCosts={meshes:readonly HvpCompactMesh[];groupedBytes:number;draws:number;sourceBytes:number;cacheBytes:number;checkpointBytes:number;baseProxyBytes:number;sharedBytes:number;physicsBytes:number};
    let neighborCosts:NeighborCosts={meshes:[],groupedBytes:0,draws:0,sourceBytes:0,cacheBytes:0,checkpointBytes:0,baseProxyBytes:0,sharedBytes:0,physicsBytes:0};
    const sceneLedger=(input:Parameters<typeof buildHvpResourceLedger>[0]&{neighbor?:NeighborCosts;dormantCheckpointBytes?:number})=>{
      const n=input.neighbor??neighborCosts;
      const dormantCheckpointBytes=input.dormantCheckpointBytes??physics?.read().dormantCheckpointBytes??0;
      const result=buildHvpResourceLedger({...input,
        additionalMeshes:[...(input.additionalMeshes??[]),...n.meshes,...(salvageMarker&&salvageLink?[salvageMarker,salvageLink]:[])],
        groupedIndexBytes:input.groupedIndexBytes+n.groupedBytes,drawCalls:input.drawCalls+(salvageMarker?2:0)+n.draws});
      // The live composite's raw typed views alias the cache packet. Artifact
      // snapshots and regrouped indices are separate allocations; count those.
      return {...result,totalCpuBytes:result.totalCpuBytes+n.sourceBytes+n.cacheBytes+n.checkpointBytes+n.baseProxyBytes-n.sharedBytes+n.physicsBytes+dormantCheckpointBytes,dormantCheckpointBytes,
        neighborSourceBytes:n.sourceBytes,neighborCacheBytes:n.cacheBytes,neighborCheckpointBytes:n.checkpointBytes,neighborBaseProxyBytes:n.baseProxyBytes};
    };
    let ledger = sceneLedger({
      terrainMesh,
      terrainMeshes: [...initialTerrain.values()],
      waterMesh: water,
      joinMesh,
      farMesh,
      additionalMeshes: [...vegetation.map((product) => product.mesh), dropMesh, avatarMesh, inertiaMesh],
      visualEffects: true,
      vegetationSourceBytes,checkpointSourceBytes,
      groupedIndexBytes:
        [...terrainLooks.values()].reduce((n,group)=>n+group.indices.byteLength,0) + joinLook.indices.byteLength + farLook.indices.byteLength,
      drawCalls:
        [...terrainLooks.values()].reduce((n,group)=>n+group.materialRanges.length,0) + 1 + joinLook.materialRanges.length + farLook.materialRanges.length
        + vegetation.reduce((draws, product) => draws + product.profiles.length, 0) + 3
    });
    // Mesher scratch is no longer owned in this phase. Reserve two bounded
    // collision jobs (40 MiB each) plus 8 MiB results and their solver copy.
    // Never add serial phase peaks, or omit simultaneously owned worker buffers.
    const physicsPrepareBytes = 96 * 1024 * 1024;
    admitHvpResources({ ...ledger,
      totalCpuBytes: Math.max(ledger.totalCpuBytes, ledger.totalCpuBytes - ledger.tempEstimateBytes + physicsPrepareBytes)
    }, caps);
    const rockScenario=scenario==="rock-arm";
    // Explicit new-session scenario, never a camera-driven teleport of a live avatar.
    const playerSpawn = coldGame?.checkpoint.world.player?.position??(scenario==="east-edge"?{x:7,y:readHvpSourceColumnWorld(7,-14).topMeters+.92,z:-14}:rockScenario?{x:7,y:.125+.92,z:-6.25}:salvageScenario?
      {x:-11.8125,y:readHvpSourceColumnWorld(-11.8125,-15.25).topMeters+.92,z:-15.25}:{ x: -9, y: readHvpSourceColumnWorld(-9, -11).topMeters + 0.92, z: -11 });
    documentPort.body.dataset.hestiaPrototypeScenario=coldGame?"saved":scenario;
    // Authored dry impulse area behind the start, not the sloping channel bank.
    const inertiaSpawn={x:-9,y:Math.max(...[-9,-8].flatMap(x=>[-13.75,-12.5].map(z=>readHvpSourceColumnWorld(x,z).topMeters)))+1.25,z:-13};
    const branchSpawn={x:-12,y:Math.max(...[-12,-11.5].flatMap(x=>[-13.5,-13].map(z=>readHvpSourceColumnWorld(x,z).topMeters))),z:-13.5};
    startupPhase("startupAdmissionMs");
    physics = await (overrides.createPhysics ?? createHvpPhysicsClient)(collisionSources, spawn, physicsAbort.signal, playerSpawn, inertiaSpawn,branchSpawn,coldGame?.checkpoint.world,salvageScenario?"salvage":"branch",measurement.enabled?measurement.worker:undefined);
    startupPhase("startupPhysicsMs");
    if (disposed || hvpMountEpoch !== myEpoch) { await physics.dispose(); physics = undefined; return Object.freeze({ dispose }); }
    const branch=physics.read().structural;
    if (physicsPausedByFocus || documentPort.hidden) { await physics.command("Pause"); }
    if(!branch){throw new Error("Canonical anchored branch is missing from the admitted World");}
    const fixedBranchOwners=new Set(branch.parts.filter(p=>p.anchored).map(p=>p.ownerId));
    branchProducts=meshHvpBranchProducts(branch).filter(p=>!coldGame||p.decoration||fixedBranchOwners.has(p.ownerId));
    const coldFragments=coldGame?.world.bodies.filter(b=>b.checkpoint.family==="terrain"||(b.checkpoint.family==="branch"&&b.checkpoint.dynamic)).map(b=>{
      const cells=readHvpBodyCells(b.recipe.source),mesh=meshHvpBodyCells(cells,b.recipe.mass.centerOfMassMeters!,b.recipe.source.contentHash);
      return {ownerId:b.checkpoint.ownerId,family:b.checkpoint.family as "terrain"|"branch",mesh,cells:cells.length,
        sourceBytes:b.recipe.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES,group:createHvpCompactLookTerrain(mesh,look,{allowPartialRoles:true})};
    })??[];
    ledger=sceneLedger({terrainMesh:initialTerrain.get(0)!,terrainMeshes:[...initialTerrain.values()],waterMesh:water,joinMesh,farMesh,
      additionalMeshes:[...vegetation.map(p=>p.mesh),dropMesh,avatarMesh,inertiaMesh,...branchProducts.map(p=>p.mesh),...coldFragments.map(p=>p.mesh)],vegetationSourceBytes,checkpointSourceBytes,visualEffects:true,
      groupedIndexBytes:[...terrainLooks.values()].reduce((n,g)=>n+g.indices.byteLength,joinLook.indices.byteLength+farLook.indices.byteLength+coldFragments.reduce((n,p)=>n+p.group.indices.byteLength,0)),
      drawCalls:[...terrainLooks.values()].reduce((n,g)=>n+g.materialRanges.length,4+joinLook.materialRanges.length+farLook.materialRanges.length+vegetation.reduce((n,p)=>n+p.profiles.length,0)+branchProducts.length+coldFragments.reduce((n,p)=>n+p.group.materialRanges.length,0))});
    const inertia=physics.read().inertia;
    if(inertia===null) { throw new Error("Canonical inertia specimen is missing from the admitted World"); }
    if(inertia!==null) {
      const center=inertia.centerOfMass;
      for(let i=0;i<inertiaMesh.positions.length;i+=3) {
        inertiaMesh.positions[i]=inertiaMesh.positions[i]!-center.x;inertiaMesh.positions[i+1]=inertiaMesh.positions[i+1]!-center.y;inertiaMesh.positions[i+2]=inertiaMesh.positions[i+2]!-center.z;
      }
      const bounds=inertiaMesh.boundsMeters;
      inertiaMesh={...inertiaMesh,sourceDigest:inertia.sourceDigest,boundsMeters:{
        min:{x:Math.fround(bounds.min.x-center.x),y:Math.fround(bounds.min.y-center.y),z:Math.fround(bounds.min.z-center.z)},
        max:{x:Math.fround(bounds.max.x-center.x),y:Math.fround(bounds.max.y-center.y),z:Math.fround(bounds.max.z-center.z)}}};
    }
    const physicsPayloadBytes = physics.collisionBytes * 2;
    // Transfer buffers plus the corresponding solver collision payload; native
    // allocator overhead is reported separately as unsupported, never zero.
    const admittedLedger = { ...ledger,
      totalCpuBytes: Math.max(ledger.totalCpuBytes, ledger.totalCpuBytes - ledger.tempEstimateBytes + physicsPrepareBytes),
      physicsPayloadBytes, physicsPrepareBytes };
    admitHvpResources(admittedLedger, caps);
    lookScene = createHvpLookScene(scene, look);
    documentPort.body.dataset.hestiaPrototypeWaterDigest = mask.digest;
    documentPort.body.dataset.hestiaPrototypeTriangles = String(ledger.triangles);
    documentPort.body.dataset.hestiaPrototypeResources = JSON.stringify({ ledger: admittedLedger, caps });
    documentPort.body.dataset.hestiaPrototypePhysicsWorkers = String(physics.workerCount);
    documentPort.body.dataset.hestiaPrototypePhysicsPreparation = JSON.stringify(physics.preparation);
    documentPort.body.dataset.hestiaPrototypeEffects = HVP_EFFECT_VERSION;

    const makeTerrainEntry = (id: number, mesh: HvpCompactMesh, generation: number,
      group = createHvpCompactLookTerrain(mesh, look, {allowPartialRoles:true}),tag="") => ({ id, mesh, group,
      artifact: createMeshArtifact({ representationKey: representationKey(`hvp:terrain:s${id}:r${generation}${tag}`),
        sourceRevision: sourceRevision(generation), artifactRevision: artifactRevision(generation),
        algorithmVersion: mesh.algorithmVersion, frameId: frame, positions: mesh.positions, normals: mesh.normals,
        indices: group.indices, attributes: {color:mesh.colors!}, materialRanges:group.materialRanges,bounds:mesh.boundsMeters }) });
    const terrainEntries = new Map([...initialTerrain].map(([id,mesh])=>[id,makeTerrainEntry(id,mesh,terrainRoot.read().revision,terrainLooks.get(id)!)]));
    const upsertTerrain = (entry: Pick<ReturnType<typeof makeTerrainEntry>,"artifact"|"group">): void => {
      requireAccepted(presentation.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),
        artifact:entry.artifact,materialProfiles:entry.group.materialProfiles})),"HVP terrain sector upsert");
    };
    for(const entry of terrainEntries.values()) {
      activeTerrainKeys.add(entry.artifact.representationKey); upsertTerrain(entry);
    }
    if(salvageMarker){
      const profile=createMaterialProfile({id:materialProfileId("hvp:salvage-zone-material"),kind:"BasicLit",baseColor:{r:.02,g:.7,b:1},opacity:1,doubleSided:false,wireframe:false,depthWrite:true});
      requireAccepted(presentation.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),
        artifact:createMeshArtifact({representationKey:representationKey(HVP_SALVAGE_MARKER_KEY),sourceRevision:sourceRevision(0),artifactRevision:artifactRevision(0),algorithmVersion:salvageMarker.algorithmVersion,
          frameId:frame,positions:salvageMarker.positions,normals:salvageMarker.normals,indices:salvageMarker.indices,
          materialRanges:[{materialProfileId:profile.id,startIndex:0,indexCount:salvageMarker.indices.length}],bounds:salvageMarker.boundsMeters}),materialProfiles:[profile]})),"Salvage marker upsert");
    }
    if(salvageLink){
      const profile=createMaterialProfile({id:materialProfileId("hvp:salvage-link-material"),kind:"DebugWireframe",baseColor:{r:1,g:.3,b:.02},opacity:1,doubleSided:false,wireframe:true,depthWrite:false});
      requireAccepted(presentation.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),
        artifact:createMeshArtifact({representationKey:representationKey(HVP_SALVAGE_LINK_KEY),sourceRevision:sourceRevision(0),artifactRevision:artifactRevision(0),algorithmVersion:salvageLink.algorithmVersion,
          frameId:frame,positions:salvageLink.positions,normals:salvageLink.normals,indices:salvageLink.indices,
          materialRanges:[{materialProfileId:profile.id,startIndex:0,indexCount:salvageLink.indices.length}],bounds:salvageLink.boundsMeters}),materialProfiles:[profile]})),"Salvage link upsert");
    }

    const originalProxyArtifacts:ReturnType<typeof createMeshArtifact>[]=[];
    requireAccepted(presentation.dispatch(createRenderCommand({
      kind: "UpsertMeshArtifact",
      backendRevision: backendRevision(0),
      artifact: originalProxyArtifacts[0]=createMeshArtifact({
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
      artifact: originalProxyArtifacts[1]=createMeshArtifact({
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
      artifact: originalProxyArtifacts[2]=createMeshArtifact({
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

    for (const product of vegetation) {
      requireAccepted(presentation.dispatch(createRenderCommand({
        kind: "UpsertMeshArtifact", backendRevision: backendRevision(0),
        artifact: product.artifact, materialProfiles: product.profiles
      })), "HVP vegetation upsert");
    }
    documentPort.body.dataset.hestiaPrototypeVegetation = HVP_VEGETATION_VERSION;
    documentPort.body.dataset.hestiaPrototypeVegetationDigest = fnv1aHash(JSON.stringify({
      products: vegetation.map((product) => [product.artifact.representationKey, product.artifact.contentHash]),
      transforms: vegetationTransforms
    }));
    documentPort.body.dataset.hestiaPrototypeVegetationCount = String(plants.length);
    documentPort.body.dataset.hestiaPrototypeVegetationPhysics = "wood-static-collision; decoration-noncolliding";

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
    for(const entry of terrainEntries.values()) {
      plainTerrainLeases.push({nodeKey:entry.artifact.representationKey,lease:materialFactory.acquire(entry.group.materialProfiles)});
    }
    plainJoinLease = materialFactory.acquire(joinLook.materialProfiles);
    for (const product of vegetation) {
      if (product.artifact.representationKey.endsWith(":wood")) {
        plainVegetationLeases.push({ nodeKey: product.artifact.representationKey, lease: materialFactory.acquire(product.profiles) });
      }
    }
    const aoColoredByNode = new Map<string, readonly THREE.Material[]>();
    const setAoOnNodes = (enabled: boolean): void => {
      // Render-only Inspect toggle: swaps material arrays on terrain, join and wood
      // AO-carrying representations. Source, density, geometry, camera, and
      // lights stay fixed; water and the far proxy are untouched. No
      // UpsertMeshArtifact, no remesh.
      const root = backend?.representationRoot;
      if (root === undefined || plainJoinLease === undefined) {
        return;
      }
      const joinLease = plainJoinLease;
      const pairs: ReadonlyArray<{ nodeKey: string; lease: ThreeMaterialLease }> = [
        ...plainTerrainLeases,
        { nodeKey: HVP_JOIN_REPRESENTATION_KEY, lease: joinLease },
        ...plainVegetationLeases
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

    camera = createHvpCamera({ camera: backend.camera, canvas, windowPort: windowPort as Window,
      isInputBlocked: () => playerInput?.active ?? false });
    playerInput = createHvpPlayerInput(canvas, backend.camera, physics, documentPort as Document, windowPort as Window, () => {
      camera!.reset(); hud!.update("Ready", camera!.readPose(), stats);
    },{confirm:()=>{void plasmaTool?.confirm();},select:mode=>plasmaTool?.select(mode)},()=>saveBusy||saveHold||Boolean(dormancy?.read().recoveryHold));
    if(!coldGame&&scenario==="east-edge"){playerInput.aimAt({x:48,y:playerSpawn.y+.75,z:-14});}
    const dropProfile = createMaterialProfile({ id: materialProfileId("hvp:drop-limestone-v1"), kind: "BasicLit",
      baseColor: { r: 0.8, g: 0.35, b: 0.12 }, opacity: 1, doubleSided: false, wireframe: false, depthWrite: true });
    const avatarProfile = createMaterialProfile({ id: materialProfileId("hvp:player:suit-v1"), kind: "BasicLit",
      baseColor: { r: 1, g: 1, b: 1 }, opacity: 1, doubleSided: false, wireframe: false, depthWrite: true });
    playerInput.update();
    physicsTransforms = physics.read().bodies.map(pose => ({ representationKey: representationKey(pose.ownerId),
      positionRelative: pose.position, orientation: pose.orientation, scale: { x: 1, y: 1, z: 1 } }));
    physicsTransforms = [...physicsTransforms, { representationKey: representationKey(HVP_AVATAR_KEY),
      positionRelative: playerInput.visualPosition, orientation: playerInput.visualOrientation, scale: { x: 1, y: 1, z: 1 } }];
    requireAccepted(presentation.dispatch(createRenderCommand({ kind: "UpsertMeshArtifact", backendRevision: backendRevision(0),
      artifact: createMeshArtifact({ representationKey: representationKey(HVP_AVATAR_KEY), frameId: frame, sourceRevision: sourceRevision(1),
        artifactRevision: artifactRevision(1), algorithmVersion: avatarMesh.algorithmVersion, positions: avatarMesh.positions,
        normals: avatarMesh.normals, indices: avatarMesh.indices, attributes: { color: avatarMesh.colors! },
        materialRanges: [{ materialProfileId: avatarProfile.id, startIndex: 0, indexCount: avatarMesh.indices.length }],
        bounds: avatarMesh.boundsMeters }), materialProfiles: [avatarProfile] })), "Player suit model upsert");
    requireAccepted(presentation.dispatch(createRenderCommand({ kind: "UpsertMeshArtifact", backendRevision: backendRevision(0),
      artifact: createMeshArtifact({ representationKey: representationKey("hvp:physics:drop"), frameId: frame, sourceRevision: sourceRevision(1),
        artifactRevision: artifactRevision(1), algorithmVersion: "hvp-drop-cube-v1", positions: dropMesh.positions, normals: dropMesh.normals,
        indices: dropMesh.indices, materialRanges: [{ materialProfileId: dropProfile.id, startIndex: 0, indexCount: dropMesh.indices.length }],
        bounds: dropMesh.boundsMeters }), materialProfiles: [dropProfile] })), "Physics drop body upsert");
    if(inertia!==null) {
      const profile=createMaterialProfile({id:materialProfileId("hvp:inertia:wood-v1"),kind:"BasicLit",
        baseColor:{r:.48,g:.28,b:.12},opacity:1,doubleSided:false,wireframe:false,depthWrite:true});
      requireAccepted(presentation.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),
        artifact:createMeshArtifact({representationKey:representationKey(HVP_INERTIA_KEY),frameId:frame,sourceRevision:sourceRevision(1),
          artifactRevision:artifactRevision(1),algorithmVersion:inertiaMesh.algorithmVersion,positions:inertiaMesh.positions,normals:inertiaMesh.normals,
          indices:inertiaMesh.indices,materialRanges:[{materialProfileId:profile.id,startIndex:0,indexCount:inertiaMesh.indices.length}],bounds:inertiaMesh.boundsMeters}),
        materialProfiles:[profile]})),"Canonical L body upsert");
    }
    const branchWoodProfile=createMaterialProfile({id:materialProfileId("hvp:branch:wood-v1"),kind:"BasicLit",
      baseColor:{r:.43,g:.25,b:.11},opacity:1,doubleSided:false,wireframe:false,depthWrite:true});
    const branchLeafProfile=createMaterialProfile({id:materialProfileId("hvp:branch:leaf-v1"),kind:"BasicLit",
      baseColor:{r:.22,g:.46,b:.12},opacity:1,doubleSided:false,wireframe:false,depthWrite:true});
    const makeBranchEntry=(product:HvpBranchProduct,generation:number)=>{
      const profile=product.decoration?branchLeafProfile:branchWoodProfile;
      return {product,profile,artifact:createMeshArtifact({representationKey:representationKey(product.key),frameId:frame,
        sourceRevision:sourceRevision(generation),artifactRevision:artifactRevision(generation),algorithmVersion:product.mesh.algorithmVersion,
        positions:product.mesh.positions,normals:product.mesh.normals,indices:product.mesh.indices,bounds:product.mesh.boundsMeters,
        materialRanges:[{materialProfileId:profile.id,startIndex:0,indexCount:product.mesh.indices.length}]})};
    };
    let branchEntries=branchProducts.map(p=>makeBranchEntry(p,0));
    const uploadBranch=(entry:ReturnType<typeof makeBranchEntry>)=>requireAccepted(presentation.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",
      backendRevision:backendRevision(0),artifact:entry.artifact,materialProfiles:[entry.profile]})),"Branch mesh upsert");
    const retireBranch=(entry:ReturnType<typeof makeBranchEntry>)=>{
      const a=entry.artifact,result=presentation.dispatch(createRenderCommand({kind:"RemoveRepresentation",backendRevision:backendRevision(0),representationKey:a.representationKey,
        expectedSourceRevision:a.sourceRevision,expectedArtifactRevision:a.artifactRevision,expectedContentHash:a.contentHash}));
      if(result.status!=="NotFound"){requireAccepted(result,"Branch retirement");}
      managedRestoreKeys.delete(a.representationKey);activeRestoreKeys.delete(a.representationKey);
    };
    for(const entry of branchEntries){activeBranchKeys.add(entry.product.key);uploadBranch(entry);}
    const makeFragmentEntry=(ownerId:string,mesh:HvpCompactMesh,sourceBytes:number,cellCount:number,generation:number,family:"terrain"|"branch"="terrain",renderKey=ownerId)=>{
      // Gate explicit ownership, not an ID prefix, before uploading prepared children.
      managedFragmentKeys.add(renderKey);
      if(family==="branch"&&mesh.materialRanges.some(r=>r.slot!==1)){throw new Error("Unexpected timber material");}
      const terrainGroup=createHvpCompactLookTerrain(mesh,look,{allowPartialRoles:true});
      const group=family==="terrain"?terrainGroup:{...terrainGroup,materialProfiles:[branchWoodProfile],
        materialRanges:terrainGroup.materialRanges.map(r=>({...r,materialProfileId:branchWoodProfile.id}))};
      return {ownerId,family,sourceBytes:sourceBytes+cellCount*32,mesh,group,artifact:createMeshArtifact({representationKey:representationKey(renderKey),frameId:frame,
        sourceRevision:sourceRevision(generation),artifactRevision:artifactRevision(generation),algorithmVersion:mesh.algorithmVersion,
        positions:mesh.positions,normals:mesh.normals,indices:group.indices,attributes:{color:mesh.colors!},
        materialRanges:group.materialRanges,bounds:mesh.boundsMeters})};
    };
    const fragmentEntries=new Map<string,ReturnType<typeof makeFragmentEntry>>();
    const parkedRenderOwners=new Set(physics.read().parked?.map(p=>p.ownerId)??[]);
    for(const p of coldFragments){
      const entry=makeFragmentEntry(p.ownerId,p.mesh,p.sourceBytes,p.cells,terrainRoot.read().revision,p.family);
      fragmentEntries.set(p.ownerId,entry);if(parkedRenderOwners.has(p.ownerId)){continue;}activeFragmentKeys.add(entry.artifact.representationKey);
      upsertTerrain(entry);plainTerrainLeases.push({nodeKey:entry.artifact.representationKey,lease:materialFactory.acquire(entry.group.materialProfiles)});
    }
    const fragmentSourceBytes=()=>[...fragmentEntries.values()].reduce((n,e)=>n+e.sourceBytes,0);
    const stats = {
      faces: [...terrainEntries.values()].reduce((n,e)=>n+e.mesh.faceCount,0) + water.faceCount,
      vertices: [...terrainEntries.values()].reduce((n,e)=>n+e.mesh.positions.length/3,0) + water.positions.length / 3,
      triangles: [...terrainEntries.values()].reduce((n,e)=>n+e.mesh.indices.length/3,0) + water.indices.length / 3,
      sceneFaces: [...terrainEntries.values()].reduce((n,e)=>n+e.mesh.faceCount,0) + water.faceCount + joinMesh.faceCount + farMesh.faceCount
        + vegetation.reduce((faces, product) => faces + product.mesh.faceCount, 0),
      sceneTriangles: ledger.triangles
    };
    const updateTerrainState = (): void => {
      if(disposed||hvpMountEpoch!==myEpoch) { return; }
      const cacheDelta=neighborCache.totalBytes-neighborCosts.cacheBytes;
      if(cacheDelta!==0){neighborCosts={...neighborCosts,cacheBytes:neighborCache.totalBytes};ledger={...ledger,totalCpuBytes:ledger.totalCpuBytes+cacheDelta};}
      const dormantCheckpointBytes=physics!.read().dormantCheckpointBytes??0;
      ledger={...ledger,totalCpuBytes:ledger.totalCpuBytes+dormantCheckpointBytes-ledger.dormantCheckpointBytes,dormantCheckpointBytes};
      const entries=[...terrainEntries.values()];
      stats.faces=entries.reduce((n,e)=>n+e.mesh.faceCount,water.faceCount);
      stats.vertices=entries.reduce((n,e)=>n+e.mesh.positions.length/3,water.positions.length/3);
      stats.triangles=entries.reduce((n,e)=>n+e.mesh.indices.length/3,water.indices.length/3);
      stats.sceneFaces=stats.faces+joinMesh.faceCount+farMesh.faceCount+vegetation.reduce((n,p)=>n+p.mesh.faceCount,0)+[...fragmentEntries.values()].reduce((n,e)=>n+e.mesh.faceCount,0)+neighborCosts.meshes.reduce((n,m)=>n+m.faceCount,0);
      stats.sceneTriangles=ledger.triangles;
      const root=terrainRoot.read();
      documentPort.body.dataset.hestiaPrototypeTerrainGeneration=String(root.revision);
      documentPort.body.dataset.hestiaPrototypeSourceDigest=root.sourceDigest;
      documentPort.body.dataset.hestiaPrototypeTerrainSectors=JSON.stringify(entries.map(e=>({id:e.id,key:e.artifact.representationKey,hash:e.artifact.contentHash})));
      documentPort.body.dataset.hestiaPrototypeTriangles=String(ledger.triangles);
      documentPort.body.dataset.hestiaPrototypeResources=JSON.stringify({ledger:{...ledger,physicsPayloadBytes:physics!.collisionBytes*2,physicsPrepareBytes,dynamicFragmentSourceBytes:fragmentSourceBytes()},caps});
      documentPort.body.dataset.hestiaPrototypeTerrainFragments=JSON.stringify(physics!.read().terrainFragments??[]);
      hud?.update("Ready",camera!.readPose(),stats);
    };
    const removeTerrainEntry = (entry:Pick<ReturnType<typeof makeTerrainEntry>,"artifact">,kind:"RemoveRepresentation"|"EvictRepresentation"="RemoveRepresentation"):void => {
      const a=entry.artifact;
      const result=presentation.dispatch(createRenderCommand({kind,backendRevision:backendRevision(0),
        representationKey:a.representationKey,expectedSourceRevision:a.sourceRevision,expectedArtifactRevision:a.artifactRevision,expectedContentHash:a.contentHash}));
      if(result.status!=="NotFound") { requireAccepted(result,"Terrain retirement"); }
      const index=plainTerrainLeases.findIndex(p=>p.nodeKey===a.representationKey);
      if(index>=0) { plainTerrainLeases.splice(index,1)[0]!.lease.release(); }
      aoColoredByNode.delete(a.representationKey);
      managedRestoreKeys.delete(a.representationKey);activeRestoreKeys.delete(a.representationKey);
    };
    const stageDormancy=(candidate:ReturnType<HvpPhysicsClient["read"]>):HvpStagedTerrain=>{
      const before=new Set(parkedRenderOwners),next=new Set(candidate.parked.map(p=>p.ownerId));
      const wake=[...before].filter(id=>!next.has(id)).map(id=>{
        const entry=fragmentEntries.get(id),source=candidate.terrainFragments.find(p=>p.ownerId===id);
        if(!entry||!source||entry.mesh.sourceDigest!==source.sourceDigest){throw new Error("Dormant projection/source mismatch");}return entry;
      });
      const park=[...next].filter(id=>!before.has(id)).map(id=>{
        const entry=fragmentEntries.get(id);if(!entry){throw new Error("Missing dormant projection owner");}return entry;
      });
      const previousLedger=ledger,previousTransforms=physicsTransforms;
      const nextLedger={...ledger,totalCpuBytes:ledger.totalCpuBytes+candidate.dormantCheckpointBytes-ledger.dormantCheckpointBytes,
        dormantCheckpointBytes:candidate.dormantCheckpointBytes};admitHvpResources(nextLedger,caps);
      try{for(const entry of wake){upsertTerrain(entry);plainTerrainLeases.push({nodeKey:entry.artifact.representationKey,lease:materialFactory.acquire(entry.group.materialProfiles)});}
        if(!aoEnabled){setAoOnNodes(false);}
      }catch(error){for(const entry of wake){removeTerrainEntry(entry,"EvictRepresentation");}throw error;}
      const visible=(parked:ReadonlySet<string>)=>{
        parkedRenderOwners.clear();for(const id of parked){parkedRenderOwners.add(id);}
        for(const entry of fragmentEntries.values()){
          if(parked.has(entry.ownerId)){activeFragmentKeys.delete(entry.artifact.representationKey);activeRestoreKeys.delete(entry.artifact.representationKey);}
          else{activeFragmentKeys.add(entry.artifact.representationKey);if(managedRestoreKeys.has(entry.artifact.representationKey)){activeRestoreKeys.add(entry.artifact.representationKey);}}
        }
      };
      return {
        publish(){visible(next);ledger=nextLedger;syncPhysicsTransforms();presentation.updateProjection();updateTerrainState();},
        rollback(){visible(before);ledger=previousLedger;physicsTransforms=previousTransforms;presentation.updateProjection();for(const entry of wake){removeTerrainEntry(entry,"EvictRepresentation");}},
        // Dormancy is reversible residency, not permanent source removal.
        finish(){for(const entry of park){removeTerrainEntry(entry,"EvictRepresentation");}}
      };
    };
    const waterGroup=(mesh:HvpCompactMesh)=>({indices:mesh.indices,materialProfiles:[look.water.materialProfile],
      materialRanges:[{materialProfileId:look.water.materialProfile.id,startIndex:0,indexCount:mesh.indices.length}]});
    type NeighborEntry={mesh:HvpCompactMesh;group:ReturnType<typeof createHvpCompactLookTerrain>;artifact:ReturnType<typeof createMeshArtifact>};
    let neighborEntries:NeighborEntry[]=originalProxyArtifacts.map((artifact,i)=>({artifact,mesh:[water,joinMesh,farMesh][i]!,group:[waterGroup(water),joinLook,farLook][i]!}));
    originalProxyArtifacts.length=0;
    for(const e of neighborEntries){managedNeighborKeys.add(e.artifact.representationKey);activeNeighborKeys.add(e.artifact.representationKey);}
    const meshBytes=(m:HvpCompactMesh)=>m.positions.byteLength+m.normals.byteLength+m.indices.byteLength+(m.colors?.byteLength??0);
    const baseProxyBytes=Object.values(originalProxies).reduce((n,m)=>n+meshBytes(m),0);
    let neighborVisualSequence=0;
    const stageNeighbor=(value:HvpNeighborStage,restore?:{
      tiles:ReadonlyMap<number,ReturnType<typeof makeTerrainEntry>>;
      ledger:(meshes:readonly HvpCompactMesh[],groups:readonly NeighborEntry["group"][],costs:NeighborCosts)=>ReturnType<typeof sceneLedger>;
      sourceBytes:number;overlayBytes:number;stagingBytes:number;stagedMeshBytes:number;
    }):HvpStagedTerrain=>{
      const visualSequence=++neighborVisualSequence;
      const p=value.products;
      const meshes=p?[p.water,p.join,p.far,...p.region,p.waterPatch]:[originalProxies.water,originalProxies.join,originalProxies.far];
      const stagedCollisionBytes=value.seams?[...value.seams.primary.collision.values(),...value.seams.east].reduce((n,m)=>n+m.vertices.byteLength+m.indices.byteLength,0):0;
      const nativeCoexistence=physics!.collisionBytes*2+stagedCollisionBytes*2;
      const reuseProxies=(p!==null&&neighborCosts.meshes.length>0)
        ||(p===null&&water===originalProxies.water&&joinMesh===originalProxies.join&&farMesh===originalProxies.far);
      const plannedBytes=meshes.slice(reuseProxies?3:0).reduce((n,m)=>n+meshBytes(m),0)
        +(restore?0:[...(value.seams?.primary.render.values()??[])].reduce((n,m)=>n+meshBytes(m),0));
      const extraState=Math.max(0,(value.source?8_388_608+value.source.overlayBytes*2:0)+value.cacheBytes+value.checkpointBytes+(p?baseProxyBytes:0)
        -neighborCosts.sourceBytes-neighborCosts.cacheBytes-neighborCosts.checkpointBytes-neighborCosts.baseProxyBytes);
      // Snapshot/group allocations must be admitted before createMeshArtifact.
      documentPort.body.dataset.hestiaPrototypeNeighborAdmission=JSON.stringify({phase:"snapshot",plannedBytes,extraState,
        retainedCpu:ledger.totalCpuBytes-ledger.tempEstimateBytes,nativeCoexistence});
      // Both compiler jobs have completed. Only their retained output and
      // disabled native replacement colliders coexist with graphics staging.
      admitHvpResources({...ledger,totalCpuBytes:estimateHvpStageCpuBytes(ledger,ledger,plannedBytes,nativeCoexistence)+extraState+(restore?.stagingBytes??0),
        retainedMeshBytes:ledger.retainedMeshBytes+plannedBytes+(restore?.stagedMeshBytes??0)},caps);
      const groups=meshes.map((m,i)=>i===0||(p!==null&&i===meshes.length-1)?waterGroup(m):createHvpCompactLookTerrain(m,look,{allowPartialRoles:true}));
      const previous=neighborEntries,previousCosts=neighborCosts,previousLedger=ledger;
      const previousProxies={water,joinMesh,farMesh,joinLook,farLook};
      const previousWaterDigest=documentPort.body.dataset.hestiaPrototypeWaterDigest;
      // Clipping the immutable originals by the fixed collar is independent of
      // B's LOD: retain those three GPU artifacts while changing local geometry.
      const next:NeighborEntry[]=meshes.map((mesh,i)=>{
        if(reuseProxies&&i<3){return {...previous[i]!,mesh};}
        const key=representationKey(i===0||(p!==null&&i===meshes.length-1)?`hvp:water:neighbor:${value.epoch}:${visualSequence}:${i}`:`hvp:neighbor:${value.epoch}:${visualSequence}:${i}`);
        managedNeighborKeys.add(key);
        return {mesh,group:groups[i]!,artifact:createMeshArtifact({representationKey:key,sourceRevision:sourceRevision(value.epoch),artifactRevision:artifactRevision(value.epoch),
          algorithmVersion:mesh.algorithmVersion,frameId:frame,positions:mesh.positions,normals:mesh.normals,indices:groups[i]!.indices,
          attributes:mesh.colors===null?undefined:{color:mesh.colors},materialRanges:groups[i]!.materialRanges,bounds:mesh.boundsMeters})};
      });
      const costs:NeighborCosts={meshes:meshes.slice(3),groupedBytes:next.slice(3,-1).reduce((n,e)=>n+e.group.indices.byteLength,0),
        draws:next.slice(3).reduce((n,e)=>n+e.group.materialRanges.length,0),sourceBytes:value.source?8_388_608+value.source.overlayBytes*2:0,
        cacheBytes:value.cacheBytes,checkpointBytes:value.checkpointBytes,baseProxyBytes:p?baseProxyBytes:0,
        sharedBytes:p?meshes.reduce((n,m)=>n+meshBytes(m),0):0,physicsBytes:nativeCoexistence};
      const replacements=restore?[]:[...(value.seams?.primary.render??[])].map(([id,mesh])=>makeTerrainEntry(id,mesh,terrainRoot.read().revision,undefined,`:neighbor${value.epoch}:${visualSequence}`));
      const oldEdges=replacements.map(e=>terrainEntries.get(e.id)!);
      const allTerrain=new Map(restore?.tiles??terrainEntries);for(const e of replacements){allTerrain.set(e.id,e);}
      const nextLedger=restore?.ledger(meshes,groups,costs)??sceneLedger({terrainMesh:allTerrain.get(0)!.mesh,terrainMeshes:[...allTerrain.values()].map(e=>e.mesh),
        waterMesh:meshes[0]!,joinMesh:meshes[1]!,farMesh:meshes[2]!,neighbor:costs,
        additionalMeshes:[...vegetation.map(v=>v.mesh),dropMesh,avatarMesh,inertiaMesh,...branchProducts.map(b=>b.mesh),...[...fragmentEntries.values()].map(e=>e.mesh)],
        vegetationSourceBytes,checkpointSourceBytes,visualEffects:true,
        groupedIndexBytes:[...allTerrain.values()].reduce((n,e)=>n+e.group.indices.byteLength,next[1]!.group.indices.byteLength+next[2]!.group.indices.byteLength+[...fragmentEntries.values()].reduce((n,e)=>n+e.group.indices.byteLength,0)),
        drawCalls:[...allTerrain.values()].reduce((n,e)=>n+e.group.materialRanges.length,4+next[1]!.group.materialRanges.length+next[2]!.group.materialRanges.length+vegetation.reduce((n,v)=>n+v.profiles.length,0)+branchProducts.length+[...fragmentEntries.values()].reduce((n,e)=>n+e.group.materialRanges.length,0))});
      const retained=nextLedger.totalCpuBytes-nextLedger.tempEstimateBytes+(restore?.sourceBytes??fragmentSourceBytes())+(restore?.overlayBytes??terrainRoot.read().overlayBytes)*2;
      // Cached meshes were not all remeshed concurrently. Keep the full bounded
      // preparation allowance as this generation's working-phase estimate.
      const published={...nextLedger,tempEstimateBytes:physicsPrepareBytes,totalCpuBytes:retained+physicsPrepareBytes};
      const newEntries=next.filter(e=>!previous.some(old=>old.artifact===e.artifact));
      const newBytes=[...newEntries,...replacements].reduce((n,e)=>n+meshBytes(e.mesh),0);
      documentPort.body.dataset.hestiaPrototypeNeighborAdmission=JSON.stringify({phase:"publication",old:ledger.totalCpuBytes-ledger.tempEstimateBytes,
        next:retained,newBytes,nativeCoexistence,preparing:0});
      admitHvpResources({...published,totalCpuBytes:Math.max(published.totalCpuBytes,estimateHvpStageCpuBytes(ledger,published,newBytes,restore?.stagingBytes??0)),
        retainedMeshBytes:Math.max(ledger.retainedMeshBytes,published.retainedMeshBytes)+newBytes+(restore?.stagedMeshBytes??0)},caps);
      const retire=(e:NeighborEntry)=>{removeTerrainEntry(e);managedNeighborKeys.delete(e.artifact.representationKey);activeNeighborKeys.delete(e.artifact.representationKey);};
      try{
        for(const e of [...newEntries,...replacements]){upsertTerrain(e);
          if(e.mesh.colors!==null){plainTerrainLeases.push({nodeKey:e.artifact.representationKey,lease:materialFactory.acquire(e.group.materialProfiles)});}
          if(e.artifact.representationKey.startsWith("hvp:water:")){const node=backend!.representationRoot?.getObjectByName(`representation:${e.artifact.representationKey}`);
            if(node){node.renderOrder=look.water.renderOrder;node.frustumCulled=false;}}
        }
        if(!aoEnabled){setAoOnNodes(false);}
      }catch(error){for(const e of newEntries){retire(e);}for(const e of replacements){removeTerrainEntry(e);}throw error;}
      const project=()=>{presentation.updateProjection();updateTerrainState();};
      return {
        publish(){
          activeNeighborKeys.clear();for(const e of next){activeNeighborKeys.add(e.artifact.representationKey);}
          for(const e of oldEdges){activeTerrainKeys.delete(e.artifact.representationKey);}
          for(const e of replacements){terrainEntries.set(e.id,e);activeTerrainKeys.add(e.artifact.representationKey);}
          neighborEntries=next;neighborCosts=costs;water=meshes[0]!;joinMesh=meshes[1]!;farMesh=meshes[2]!;joinLook=next[1]!.group;farLook=next[2]!.group;ledger=published;
          documentPort.body.dataset.hestiaPrototypeWaterDigest=p?fnv1aHash(JSON.stringify([mask.digest,p.region[0]!.sourceDigest])):mask.digest;project();
        },
        rollback(){
          activeNeighborKeys.clear();for(const e of previous){activeNeighborKeys.add(e.artifact.representationKey);}
          for(const e of replacements){activeTerrainKeys.delete(e.artifact.representationKey);}
          for(const e of oldEdges){terrainEntries.set(e.id,e);activeTerrainKeys.add(e.artifact.representationKey);}
          neighborEntries=previous;neighborCosts=previousCosts;ledger=previousLedger;
          ({water,joinMesh,farMesh,joinLook,farLook}=previousProxies);
          documentPort.body.dataset.hestiaPrototypeWaterDigest=previousWaterDigest??mask.digest;project();
          for(const e of newEntries){retire(e);}for(const e of replacements){removeTerrainEntry(e);}
        },
        finish(){for(const e of previous){if(!next.some(n=>n.artifact===e.artifact)){retire(e);}}for(const e of oldEdges){removeTerrainEntry(e);}project();}
      };
    };
    const stageTerrain = (products:HvpTerrainProducts,fragments:readonly HvpPreparedTerrainBody[]=[]):HvpStagedTerrain => {
      const added=fragments.map(f=>makeFragmentEntry(f.request.ownerId,meshHvpTerrainFragment(f),f.state.sourceBytes,f.request.cells.length,products.source.revision));
      const allFragments=[...fragmentEntries.values(),...added];
      const sourceBytes=allFragments.reduce((n,e)=>n+e.sourceBytes,0);
      const groups=new Map([...products.render].map(([id,mesh])=>[id,createHvpCompactLookTerrain(mesh,look,{allowPartialRoles:true})]));
      const meshes=new Map([...terrainEntries].map(([id,e])=>[id,e.mesh]));
      for(const [id,mesh] of products.render) { meshes.set(id,mesh); }
      const nextLedger=sceneLedger({terrainMesh:meshes.get(0)!,terrainMeshes:[...meshes.values()],waterMesh:water,joinMesh,farMesh,
        additionalMeshes:[...vegetation.map(p=>p.mesh),dropMesh,avatarMesh,inertiaMesh,...branchProducts.map(p=>p.mesh),...allFragments.map(e=>e.mesh)],vegetationSourceBytes,checkpointSourceBytes,visualEffects:true,
        groupedIndexBytes:[...meshes.keys()].reduce((n,id)=>n+(groups.get(id)??terrainEntries.get(id)!.group).indices.byteLength,joinLook.indices.byteLength+farLook.indices.byteLength+allFragments.reduce((n,e)=>n+e.group.indices.byteLength,0)),
        drawCalls:[...meshes.keys()].reduce((n,id)=>n+(groups.get(id)??terrainEntries.get(id)!.group).materialRanges.length,4+joinLook.materialRanges.length+farLook.materialRanges.length+vegetation.reduce((n,p)=>n+p.profiles.length,0)+branchProducts.length+allFragments.reduce((n,e)=>n+e.group.materialRanges.length,0))});
      const publishedLedger={...nextLedger,totalCpuBytes:Math.max(nextLedger.totalCpuBytes,nextLedger.totalCpuBytes-nextLedger.tempEstimateBytes+physicsPrepareBytes)+sourceBytes+products.source.overlayBytes*2};
      const stagedBytes=[...products.render.values(),...added.map(e=>e.mesh)].reduce((n,m)=>n+m.positions.byteLength+m.normals.byteLength+m.indices.byteLength+(m.colors?.byteLength??0),0);
      // Count coexistence, not only the eventual visible generation.
      const admitted={...publishedLedger,totalCpuBytes:estimateHvpStageCpuBytes(ledger,publishedLedger,stagedBytes,physicsPrepareBytes),
        retainedMeshBytes:Math.max(ledger.retainedMeshBytes,nextLedger.retainedMeshBytes)+stagedBytes};
      admitHvpResources(admitted,caps);
      const next=[...products.render].map(([id,mesh])=>makeTerrainEntry(id,mesh,products.source.revision,groups.get(id)!));
      const previous=next.map(e=>terrainEntries.get(e.id)!); const previousLedger=ledger;
      const previousTransforms=physicsTransforms;
      const restore=():void=>{
        for(const e of next) { activeTerrainKeys.delete(e.artifact.representationKey); }
        for(const e of previous) { terrainEntries.set(e.id,e);activeTerrainKeys.add(e.artifact.representationKey); }
        for(const e of added){activeFragmentKeys.delete(e.artifact.representationKey);fragmentEntries.delete(e.ownerId);}
        physicsTransforms=previousTransforms;
        ledger=previousLedger; presentation.updateProjection(); updateTerrainState();
      };
      try {
        for(const entry of [...next,...added]) {
          upsertTerrain(entry);
          plainTerrainLeases.push({nodeKey:entry.artifact.representationKey,lease:materialFactory.acquire(entry.group.materialProfiles)});
        }
        if(!aoEnabled) { setAoOnNodes(false); }
      } catch(error) { for(const e of [...next,...added]) { removeTerrainEntry(e); } throw error; }
      return {
        publish() {
          for(const e of previous) { activeTerrainKeys.delete(e.artifact.representationKey); }
          for(const e of next) { terrainEntries.set(e.id,e);activeTerrainKeys.add(e.artifact.representationKey); }
          for(const e of added){activeFragmentKeys.add(e.artifact.representationKey);fragmentEntries.set(e.ownerId,e);}
          ledger=publishedLedger;syncPhysicsTransforms();
          presentation.updateProjection();updateTerrainState();
        },
        rollback() { restore();for(const e of [...next,...added]) { removeTerrainEntry(e); } },
        finish() { for(const e of previous) { removeTerrainEntry(e); }updateTerrainState(); }
      };
    };
    terrainCompiler=createHvpTerrainCompiler();
    terrainConsumer=createHvpTerrainConsumer(terrainRoot,plan=>{
      admitHvpResources({...ledger,totalCpuBytes:ledger.totalCpuBytes-ledger.tempEstimateBytes+physicsPrepareBytes+plan.after.overlayBytes*2},caps);
      return terrainCompiler!.compile(plan);
    },stageTerrain,physics,plants.filter(p=>p.kind==="tree").map(p=>p.position),plan=>{
      admitHvpResources({...ledger,totalCpuBytes:ledger.totalCpuBytes-ledger.tempEstimateBytes+physicsPrepareBytes+plan.after.overlayBytes*2},caps);
      return terrainCompiler!.analyze(plan);
    });
    const syncPhysicsTransforms=()=>{
      physicsTransforms=physics!.read().bodies.map(p=>({representationKey:representationKey(p.ownerId),positionRelative:p.position,orientation:p.orientation,scale:{x:1,y:1,z:1}}));
      const aliases=physicsTransforms.flatMap(p=>{const alias=fragmentEntries.get(p.representationKey)?.artifact.representationKey
        ??branchEntries.find(e=>!e.product.decoration&&e.product.ownerId===p.representationKey)?.product.key;
        return alias&&alias!==p.representationKey?[{...p,representationKey:representationKey(alias)}]:[];});
      physicsTransforms=[...physicsTransforms,...aliases];
      physicsTransforms=[...physicsTransforms,{representationKey:representationKey(HVP_AVATAR_KEY),positionRelative:playerInput!.visualPosition,
        orientation:playerInput!.visualOrientation,scale:{x:1,y:1,z:1}}];
    };
    bodyCutConsumer=createHvpBodyCutConsumer(physics,source=>{
      admitHvpResources({...ledger,totalCpuBytes:ledger.totalCpuBytes-ledger.tempEstimateBytes+physicsPrepareBytes},caps);
      return terrainCompiler!.compileBody(source);
    },(parentId,products)=>{
      const parent=fragmentEntries.get(parentId),branchParent=branchEntries.find(e=>!e.product.decoration&&e.product.ownerId===parentId);
      if(!parent&&!branchParent){throw new Error("Missing moving render parent");}
      const family=branchParent?"branch":parent!.family,generation=physics!.read().moving.sequence+1;
      const next=products.parts.map(p=>makeFragmentEntry(p.ownerId,p.mesh,p.sourceBytes,p.cells.length,generation,family));
      const remaining=[...fragmentEntries.values()].filter(e=>e!==parent),all=[...remaining,...next],previousLedger=ledger,previousTransforms=physicsTransforms;
      const previousBranchEntries=branchEntries,previousBranchProducts=branchProducts;
      const removedBranchEntries=branchEntries.filter(e=>e.product.ownerId===parentId);
      const attached=removedBranchEntries.filter(e=>e.product.decoration);
      const supportCell=physics!.read().structural?.attachment.supportCell;
      const nextSupport=attached.length&&supportCell?products.parts.find(p=>p.cells.some(c=>c.x===supportCell.x&&c.y===supportCell.y&&c.z===supportCell.z)):undefined;
      const nextLeaves=nextSupport?attached.map((_,i)=>makeBranchEntry(meshHvpBranchFoliage(nextSupport.ownerId,nextSupport.center,nextSupport.sourceDigest,
        `hvp:branch:foliage:body-r${generation}-${i}`),generation)):[];
      const nextBranchEntries=[...branchEntries.filter(e=>!removedBranchEntries.includes(e)),...nextLeaves];
      const nextBranchProducts=nextBranchEntries.map(e=>e.product);
      const nextLedger=sceneLedger({terrainMesh:terrainEntries.get(0)!.mesh,terrainMeshes:[...terrainEntries.values()].map(e=>e.mesh),waterMesh:water,joinMesh,farMesh,
        additionalMeshes:[...vegetation.map(p=>p.mesh),dropMesh,avatarMesh,inertiaMesh,...nextBranchProducts.map(p=>p.mesh),...all.map(e=>e.mesh)],vegetationSourceBytes,checkpointSourceBytes,visualEffects:true,
        groupedIndexBytes:[...terrainEntries.values()].reduce((n,e)=>n+e.group.indices.byteLength,joinLook.indices.byteLength+farLook.indices.byteLength+all.reduce((n,e)=>n+e.group.indices.byteLength,0)),
        drawCalls:[...terrainEntries.values()].reduce((n,e)=>n+e.group.materialRanges.length,4+joinLook.materialRanges.length+farLook.materialRanges.length+vegetation.reduce((n,p)=>n+p.profiles.length,0)+nextBranchProducts.length+all.reduce((n,e)=>n+e.group.materialRanges.length,0))});
      const publishedLedger={...nextLedger,totalCpuBytes:Math.max(nextLedger.totalCpuBytes,nextLedger.totalCpuBytes-nextLedger.tempEstimateBytes+physicsPrepareBytes)
        +terrainRoot.read().overlayBytes*2+all.reduce((n,e)=>n+e.sourceBytes,0)};
      const stagedBytes=[...next.map(e=>e.mesh),...nextLeaves.map(e=>e.product.mesh)].reduce((n,m)=>n+m.positions.byteLength+m.normals.byteLength+m.indices.byteLength+(m.colors?.byteLength??0),0);
      admitHvpResources({...publishedLedger,totalCpuBytes:estimateHvpStageCpuBytes(ledger,publishedLedger,stagedBytes,physicsPrepareBytes),
        retainedMeshBytes:Math.max(ledger.retainedMeshBytes,publishedLedger.retainedMeshBytes)+stagedBytes},caps);
      try{for(const e of next){upsertTerrain(e);plainTerrainLeases.push({nodeKey:e.artifact.representationKey,lease:materialFactory.acquire(e.group.materialProfiles)});}
        for(const e of nextLeaves){uploadBranch(e);}
        if(!aoEnabled){setAoOnNodes(false);}
      }catch(error){for(const e of next){removeTerrainEntry(e);}for(const e of nextLeaves){retireBranch(e);}throw error;}
      const setBranchEntries=(entries:typeof branchEntries,products:readonly HvpBranchProduct[])=>{
        activeBranchKeys.clear();for(const e of entries){activeBranchKeys.add(e.product.key);}branchEntries=entries;branchProducts=products;
      };
      return {
        publish(){if(parent){activeFragmentKeys.delete(parent.artifact.representationKey);}fragmentEntries.delete(parentId);
          for(const e of next){activeFragmentKeys.add(e.artifact.representationKey);fragmentEntries.set(e.ownerId,e);}
          if(attached.length&&physics!.read().structural?.attachment.ownerId!==(nextSupport?.ownerId??null)){throw new Error("Attachment owner publication mismatch");}
          setBranchEntries(nextBranchEntries,nextBranchProducts);
          ledger=publishedLedger;syncPhysicsTransforms();presentation.updateProjection();updateTerrainState();},
        rollback(){for(const e of next){activeFragmentKeys.delete(e.artifact.representationKey);fragmentEntries.delete(e.ownerId);}
          if(parent){activeFragmentKeys.add(parent.artifact.representationKey);fragmentEntries.set(parentId,parent);}
          setBranchEntries(previousBranchEntries,previousBranchProducts);physicsTransforms=previousTransforms;ledger=previousLedger;
          presentation.updateProjection();updateTerrainState();for(const e of next){removeTerrainEntry(e);}for(const e of nextLeaves){retireBranch(e);}},
        finish(){if(parent){removeTerrainEntry(parent);}for(const e of removedBranchEntries){retireBranch(e);}updateTerrainState();}
      };
    });
    structuralConsumer=createHvpStructuralConsumer(physics,state=>{
      const nextProducts=meshHvpBranchProducts(state),next=nextProducts.map(p=>makeBranchEntry(p,state.generation+1));
      const previous=branchEntries,previousProducts=branchProducts,previousLedger=ledger;
      const previousTransforms=physicsTransforms;
      const nextLedger=sceneLedger({terrainMesh:terrainEntries.get(0)!.mesh,terrainMeshes:[...terrainEntries.values()].map(e=>e.mesh),waterMesh:water,joinMesh,farMesh,
        additionalMeshes:[...vegetation.map(p=>p.mesh),dropMesh,avatarMesh,inertiaMesh,...nextProducts.map(p=>p.mesh),...[...fragmentEntries.values()].map(e=>e.mesh)],vegetationSourceBytes,checkpointSourceBytes,visualEffects:true,
        groupedIndexBytes:[...terrainEntries.values()].reduce((n,e)=>n+e.group.indices.byteLength,joinLook.indices.byteLength+farLook.indices.byteLength+[...fragmentEntries.values()].reduce((n,e)=>n+e.group.indices.byteLength,0)),
        drawCalls:[...terrainEntries.values()].reduce((n,e)=>n+e.group.materialRanges.length,4+joinLook.materialRanges.length+farLook.materialRanges.length+vegetation.reduce((n,p)=>n+p.profiles.length,0)+nextProducts.length+[...fragmentEntries.values()].reduce((n,e)=>n+e.group.materialRanges.length,0))});
      const publishedLedger={...nextLedger,totalCpuBytes:Math.max(nextLedger.totalCpuBytes,nextLedger.totalCpuBytes-nextLedger.tempEstimateBytes+physicsPrepareBytes)+terrainRoot.read().overlayBytes*2+fragmentSourceBytes()};
      const stagedBytes=nextProducts.reduce((n,p)=>n+p.mesh.positions.byteLength+p.mesh.normals.byteLength+p.mesh.indices.byteLength,0);
      admitHvpResources({...publishedLedger,totalCpuBytes:estimateHvpStageCpuBytes(ledger,publishedLedger,stagedBytes,physicsPrepareBytes),
        retainedMeshBytes:Math.max(ledger.retainedMeshBytes,nextLedger.retainedMeshBytes)+stagedBytes},caps);
      try{for(const entry of next){uploadBranch(entry);}}catch(error){for(const entry of next){retireBranch(entry);}throw error;}
      const setEntries=(entries:typeof branchEntries,products:readonly HvpBranchProduct[],restore=false)=>{
        activeBranchKeys.clear();for(const entry of entries){activeBranchKeys.add(entry.product.key);}
        branchEntries=entries;branchProducts=products;
        if(restore){physicsTransforms=previousTransforms;}else{syncPhysicsTransforms();}
        presentation.updateProjection();updateTerrainState();
        if(!disposed&&hvpMountEpoch===myEpoch){documentPort.body.dataset.hestiaPrototypeStructure=JSON.stringify(physics!.read().structural);}
      };
      const staged:HvpStagedBranch={
        publish(){ledger=publishedLedger;setEntries(next,nextProducts);},
        rollback(){ledger=previousLedger;setEntries(previous,previousProducts,true);for(const entry of next){retireBranch(entry);}},
        finish(){for(const entry of previous){retireBranch(entry);}}
      };return staged;
    });
    updateTerrainState();
    let previewRevision=0;
    let previewArtifact:ReturnType<typeof createMeshArtifact>|undefined;
    let supportPreviewVisible=false,supportPending=false;
    let supportCandidate:HvpSupportPlan|undefined;
    let supportView={state:"Idle",cells:0,massKg:0,fragments:0,message:""};
    const showCutPreview=(cells:readonly HvpCell[],allowed:boolean):void=>{
      supportPreviewVisible=false;
      const previous=previewArtifact;
      if(cells.length===0) { activePreviewKey="";presentation.updateProjection();return; }
      const min=[0,1,2].map(a=>Math.min(...cells.map(c=>c[a]!)));
      const max=[0,1,2].map(a=>Math.max(...cells.map(c=>c[a]!))+1);
      const selected=new Set(cells.map(c=>c.join(":")));
      const mesh=meshHvpOccupancy({sizeX:max[0]!-min[0]!,sizeY:max[1]!-min[1]!,sizeZ:max[2]!-min[2]!,cellMeters:.125,
        originMeters:{x:-16+min[0]!*.125,y:-8+min[1]!*.125,z:-16+min[2]!*.125},
        slotAt:(x,y,z)=>selected.has(`${x+min[0]!}:${y+min[1]!}:${z+min[2]!}`)?1:0},undefined,"tool-preview","tool-preview-v1");
      const bytes=mesh.positions.byteLength+mesh.normals.byteLength+mesh.indices.byteLength;
      admitHvpResources({...ledger,totalCpuBytes:ledger.totalCpuBytes+bytes*3,retainedMeshBytes:ledger.retainedMeshBytes+bytes,
        triangles:ledger.triangles+mesh.indices.length/3,drawCalls:ledger.drawCalls+1},caps);
      const profile=createMaterialProfile({id:materialProfileId(allowed?"hvp:tool:allowed":"hvp:tool:protected"),kind:"DebugWireframe",
        baseColor:allowed?{r:0.1,g:1,b:0.85}:{r:1,g:0.12,b:0.08},opacity:.8,doubleSided:true,wireframe:true,depthWrite:false});
      previewRevision+=1;
      const artifact=createMeshArtifact({representationKey:representationKey(`hvp:tool:preview:${previewRevision}`),frameId:frame,
        sourceRevision:sourceRevision(previewRevision),artifactRevision:artifactRevision(previewRevision),algorithmVersion:"hvp-tool-preview-v1",
        positions:mesh.positions,normals:mesh.normals,indices:mesh.indices,bounds:mesh.boundsMeters,
        materialRanges:[{materialProfileId:profile.id,startIndex:0,indexCount:mesh.indices.length}]});
      activePreviewKey=artifact.representationKey;
      requireAccepted(presentation.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),artifact,materialProfiles:[profile]})),"Cut preview");
      previewArtifact=artifact;
      if(previous) { requireAccepted(presentation.dispatch(createRenderCommand({kind:"RemoveRepresentation",backendRevision:backendRevision(0),
        representationKey:previous.representationKey,expectedSourceRevision:previous.sourceRevision,expectedArtifactRevision:previous.artifactRevision,
        expectedContentHash:previous.contentHash})),"Retire cut preview"); }
    };
    plasmaTool=createHvpPlasmaTool(terrainRoot,terrainConsumer,()=>neighbor?.read().busy||neighbor?.read().recoveryHold||dormancy?.read().busy||dormancy?.read().recoveryHold?undefined:playerInput!.readAim(),showCutPreview,
      plants.filter(p=>p.kind==="tree").map(p=>p.position),{physics,consumer:structuralConsumer,
      admit:()=>admitHvpResources({...ledger,totalCpuBytes:estimateHvpStageCpuBytes(ledger,ledger,0,physicsPrepareBytes)},caps)},bodyCutConsumer);
    const previewRockSupport=async():Promise<void>=>{
      if(supportPending||disposed){return;}
      supportPending=true;
      supportView={state:"Pending",cells:0,massKg:0,fragments:0,message:"Prüfung kanonischer Zellen; keine Mutation"};
      documentPort.body.dataset.hestiaPrototypeSupport=JSON.stringify(supportView);
      showCutPreview([],false);supportCandidate=undefined;
      try{
        if(["Pending","RecoveryHold"].includes(terrainConsumer!.read().state)||structuralConsumer!.read().state!=="Ready"||bodyCutConsumer!.read().state!=="Idle"){
          throw new Error("Andere Mutation ist noch nicht abgeschlossen");
        }
        playerInput!.stop();await physics!.command("Pause");
        if(disposed||hvpMountEpoch!==myEpoch){return;}
        camera!.setPreset("C05-ROCKARM");hud!.update("Ready",camera!.readPose(),stats);
        const current=terrainRoot.read();
        const plan=terrainRoot.prepare({sessionId:current.sessionId,epoch:current.epoch,revision:current.revision,sourceDigest:current.sourceDigest,
          commandId:`support-preview-${previewRevision}`,toolPolicy:"hvp-plasma-v1",shape:{kind:"Box",min:[176,78,76],max:[180,82,80]}});
        admitHvpResources({...ledger,totalCpuBytes:ledger.totalCpuBytes-ledger.tempEstimateBytes+physicsPrepareBytes+plan.after.overlayBytes*2},caps);
        const result=await terrainCompiler!.analyze(plan);
        if(disposed||hvpMountEpoch!==myEpoch){return;}
        if(terrainRoot.read()!==plan.before){throw new Error("Stale support source");}
        if(result.status==="Ready"){
          assertHvpSupportCurrent(result,terrainRoot.read());supportCandidate=result;
          // This named preview contains the bounded authored roof, not arbitrary full-region output.
          if(result.fragments.reduce((n,f)=>n+f.cells.length,0)>512){throw new Error("Support preview geometry BudgetExceeded");}
          const cells=result.fragments.flatMap(f=>f.cells.map(c=>[c.x,c.y,c.z] as HvpCell));
          showCutPreview(cells,true);supportPreviewVisible=true;
        }
        supportView={state:result.status,cells:result.fragments.reduce((n,f)=>n+f.cells.length,0),massKg:result.fragments.reduce((n,f)=>n+f.massKg,0),
          fragments:result.fragments.length,message:result.reason||"Nur Vorschau; Terrain und World unverändert"};
        documentPort.body.dataset.hestiaPrototypeSupport=JSON.stringify({...supportView,generation:current.revision,sourceDigest:current.sourceDigest,
          candidateDigest:plan.after.sourceDigest,probes:result.probes,changedCells:plan.changed.length});
      }catch(error){
        if(!disposed&&hvpMountEpoch===myEpoch){supportView={state:"Rejected",cells:0,massKg:0,fragments:0,message:String(error)};
          documentPort.body.dataset.hestiaPrototypeSupport=JSON.stringify(supportView);}
      }finally{supportPending=false;}
    };
    let saveRevision:number|null=coldRevision,saveInitialized=coldGame!==undefined,restoreSequence=0;
    let saveView={state:coldGame?"Loaded":"Idle",message:coldGame?"Aus Spielstand gestartet – pausiert":"Lokaler Hestia-Spielstand",revision:coldRevision};
    let plantCheckpoints:ReturnType<typeof encodeHvpPlant>[]|undefined;
    let salvage=salvageScenario?createHvpSalvageLoop(terrainRoot.read().sessionId,coldGame?.checkpoint.progress??undefined):undefined;
    const observeSalvage=()=>{
      if(!salvage){return;}
      const s=physics!.read();salvage.observe({ticks:s.ticks,status:s.status,terrainTransaction:s.terrainTransaction,movingState:s.moving.state,
        player:s.player,branch:s.structural??null,lastImpulse:s.lastImpulse,lastImpulseTick:s.lastImpulseTick});
      documentPort.body.dataset.hestiaPrototypeSalvage=JSON.stringify(salvage.read());
    };
    const currentView=()=>({camera:camera!.checkpoint(),...playerInput!.checkpoint(),tool:plasmaTool!.checkpoint(),waterEnabled,aoEnabled});
    const restoreView=(view:ReturnType<typeof currentView>)=>{
      playerInput!.restore(view);camera!.restore(view.camera);inspectEnabled=view.camera.mode==="Fly";plasmaTool!.restore(view.tool);
      waterEnabled=view.waterEnabled;presentation.setWaterEnabled(waterEnabled);documentPort.body.dataset.hestiaPrototypeWater=waterEnabled?"on":"off";
      aoEnabled=view.aoEnabled;setAoOnNodes(aoEnabled);documentPort.body.dataset.hestiaPrototypeAo=aoEnabled?"on":"off";
    };
    const sourcesForSave=()=>plantCheckpoints??=(plantSources.map(encodeHvpPlant));
    const openSaveStore=async()=>{
      saveStore??=createHvpSaveStore();
      if(!saveInitialized){await saveStore.initialize();const list=await saveStore.list();saveRevision=list.slots.find(s=>s.slotId===HVP_SAVE_SLOT)?.recordRevision??null;saveInitialized=true;}
      return saveStore;
    };
    const confirmed=()=>!disposed&&hvpMountEpoch===myEpoch&&!supportPending&&!neighbor?.read().busy&&!neighbor?.read().recoveryHold&&!dormancy?.read().busy&&!dormancy?.read().recoveryHold
      &&!["Pending","RecoveryHold"].includes(terrainConsumer!.read().state)
      &&structuralConsumer!.read().state==="Ready"&&bodyCutConsumer!.read().state==="Idle";
    const admitNeighbor=(bytes:Readonly<{source:number;cache:number;checkpoint:number;preparing:boolean}>)=>{
      documentPort.body.dataset.hestiaPrototypeNeighborAdmission=JSON.stringify({phase:"work",...bytes,retainedCpu:ledger.totalCpuBytes-ledger.tempEstimateBytes});
      admitHvpResources({...ledger,totalCpuBytes:ledger.totalCpuBytes-ledger.tempEstimateBytes-neighborCosts.sourceBytes-neighborCosts.cacheBytes-neighborCosts.checkpointBytes
        +bytes.source+bytes.cache+bytes.checkpoint+(bytes.preparing?physicsPrepareBytes:0)},caps);
    };
    neighbor=createHvpNeighborController({primary:()=>terrainRoot.read(),physics,compiler:terrainCompiler!,proxies:originalProxies,cache:neighborCache,
      baseSectorCount:physics.read().neighbor?.baseSectorCount??physics.preparation.jobs,current:()=>!disposed&&hvpMountEpoch===myEpoch,
      blocked:()=>saveBusy||saveHold||supportPending||Boolean(dormancy?.read().busy||dormancy?.read().recoveryHold)||["Pending","RecoveryHold"].includes(terrainConsumer!.read().state)||structuralConsumer!.read().state!=="Ready"||bodyCutConsumer!.read().state!=="Idle",
      admit:admitNeighbor,stage:stageNeighbor});
    const captureGame=async()=>{
      if(!confirmed()){throw new Error("Save requires all commands to be confirmed");}
      const root=terrainRoot.read(),world=await physics!.checkpoint();
      const receipts={terrain:await terrainConsumer!.checkpoint(),structural:structuralConsumer!.checkpoint(),moving:bodyCutConsumer!.checkpoint()};
      if(!confirmed()||root!==terrainRoot.read()){throw new Error("Scene changed during checkpoint");}
      observeSalvage();let candidate:HvpSalvageCheckpoint|undefined;
      if(salvage&&["Save","Completed"].includes(salvage.read().stage!)){candidate=salvage.prepareSave(createPersistenceSignature(world));}
      const east=neighbor!.checkpoint();
      return {candidate,game:encodeHvpGame({terrain:terrainRoot.checkpoint(),plants:sourcesForSave(),world,receipts,view:currentView(),progress:candidate??salvage?.checkpoint()??null,
        ...(east?{neighbor:{version:"hvp-neighbor-scene-v1" as const,terrain:east,lod:neighbor!.read().renderLod??neighbor!.read().lod}}:{})})};
    };
    const loadGame=async(game:HvpDecodedGame)=>{
      const old=terrainRoot.read();
      if(game.checkpoint.terrain.baseDigest!==prepared.sourceDigest
        ||createPersistenceSignature(game.checkpoint.plants)!==createPersistenceSignature(sourcesForSave())
        ||(game.checkpoint.world.branch?.kind??"branch")!==(physics!.read().structural?.kind??"branch")){
        throw new Error("Different static scene: use an artifact-only new session, not in-place replacement");
      }
      const originalWorld=await physics!.checkpoint();
      for(const family of ["drop","inertia"]){
        const a=originalWorld.bodies.find(b=>b.family===family),b=game.checkpoint.world.bodies.find(b=>b.family===family);
        if(!a||!b||a.ownerId!==b.ownerId||createPersistenceSignature(JSON.parse(a.region).object)!==createPersistenceSignature(JSON.parse(b.region).object)){
          throw new Error("Different fixed-profile specimen source");
        }
      }
      const current=()=>confirmed()&&terrainRoot.read()===old;
      // A stays resident. Restore batches use one worker, not the normal two:
      // 40 MiB worker scratch + 8 MiB accepted results + 8 MiB solver copy.
      const restorePrepareBytes=56*1024*1024,retainedDecodedBytes=game.decodedBytes+8_388_608;
      for(const entry of neighborCache.snapshot().entries){if(entry.leaseCount===0&&entry.pinCount===0){neighborCache.delete(entry.key);}}
      updateTerrainState();
      admitHvpResources({...ledger,totalCpuBytes:ledger.totalCpuBytes-ledger.tempEstimateBytes+retainedDecodedBytes+restorePrepareBytes+physics!.collisionBytes*2},caps);
      const raw=await terrainCompiler!.restore(old,game.root.read(),true);
      const render=new Map(raw.render),collision=new Map(raw.collision);
      const regionalRestore=Boolean(originalWorld.neighbor||game.checkpoint.world.neighbor||neighbor!.checkpoint()||game.neighborRoot);
      if(originalWorld.neighbor?.resident||game.checkpoint.world.neighbor?.resident){
        const seams=await terrainCompiler!.neighborSeams(game.root.read(),game.checkpoint.world.neighbor?.resident?game.neighborRoot!.read():undefined,undefined,true);
        for(const [id,mesh] of seams.primary.render){render.set(id,mesh);}
        for(const [id,mesh] of seams.primary.collision){collision.set(id,mesh);}
        const base=game.checkpoint.world.neighbor?.baseSectorCount;
        if(game.checkpoint.world.neighbor?.resident){for(const [i,mesh] of seams.east.entries()){collision.set(base!+i,mesh);}}
      }
      const products={source:raw.source,render,collision};
      if(!current()){throw new Error("Stale scene preparation");}
      const oldReceipts={terrain:await terrainConsumer!.checkpoint(),structural:structuralConsumer!.checkpoint(),moving:bodyCutConsumer!.checkpoint()},oldView=currentView();
      const loadTag=`:load${++restoreSequence}`;
      await replaceHvpScene(game,`restore-${restoreSequence}`,physics!,[...products.collision].map(([index,mesh])=>({index,mesh})),async candidate=>{
        if(!candidate.structural||!candidate.inertia){throw new Error("Missing restored prototype owners");}
        const root=game.root.read(),nextTiles=[...products.render].map(([id,mesh])=>makeTerrainEntry(id,mesh,root.revision,undefined,loadTag));
        const nextFragments=game.world.bodies.filter(b=>b.checkpoint.family==="terrain"||(b.checkpoint.family==="branch"&&b.checkpoint.dynamic))
          .map(b=>{const cells=readHvpBodyCells(b.recipe.source),owner=b.checkpoint.ownerId;
            return makeFragmentEntry(owner,meshHvpBodyCells(cells,b.recipe.mass.centerOfMassMeters!,b.recipe.source.contentHash),
              b.recipe.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES,cells.length,root.revision,b.checkpoint.family as "terrain"|"branch",`${owner}${loadTag}`);});
        const nextParked=new Set(candidate.parked.map(p=>p.ownerId));
        const fixed=new Set(candidate.structural.parts.filter(p=>p.anchored).map(p=>p.ownerId));
        const nextBranch=meshHvpBranchProducts(candidate.structural).filter(p=>p.decoration||fixed.has(p.ownerId))
          .map(p=>makeBranchEntry({...p,key:`${p.key}${loadTag}`},root.revision));
        const nextMap=new Map(terrainEntries);for(const e of nextTiles){nextMap.set(e.id,e);}
        const replacementLedger=(proxyMeshes:readonly HvpCompactMesh[],proxyGroups:readonly NeighborEntry["group"][],costs:NeighborCosts)=>sceneLedger({terrainMesh:nextMap.get(0)!.mesh,terrainMeshes:[...nextMap.values()].map(e=>e.mesh),waterMesh:proxyMeshes[0]!,joinMesh:proxyMeshes[1]!,farMesh:proxyMeshes[2]!,neighbor:costs,dormantCheckpointBytes:candidate.dormantCheckpointBytes,
          additionalMeshes:[...vegetation.map(p=>p.mesh),dropMesh,avatarMesh,inertiaMesh,...nextBranch.map(e=>e.product.mesh),...nextFragments.map(e=>e.mesh)],vegetationSourceBytes,checkpointSourceBytes,visualEffects:true,
          groupedIndexBytes:[...nextMap.values()].reduce((n,e)=>n+e.group.indices.byteLength,proxyGroups[1]!.indices.byteLength+proxyGroups[2]!.indices.byteLength+nextFragments.reduce((n,e)=>n+e.group.indices.byteLength,0)),
          drawCalls:[...nextMap.values()].reduce((n,e)=>n+e.group.materialRanges.length,4+proxyGroups[1]!.materialRanges.length+proxyGroups[2]!.materialRanges.length+vegetation.reduce((n,p)=>n+p.profiles.length,0)+nextBranch.length+nextFragments.reduce((n,e)=>n+e.group.materialRanges.length,0))});
        const nextLedger=replacementLedger([water,joinMesh,farMesh],[waterGroup(water),joinLook,farLook],neighborCosts);
        const sourceBytes=nextFragments.reduce((n,e)=>n+e.sourceBytes,0);
        const publishedLedger={...nextLedger,totalCpuBytes:Math.max(nextLedger.totalCpuBytes,nextLedger.totalCpuBytes-nextLedger.tempEstimateBytes+physicsPrepareBytes)+sourceBytes+root.overlayBytes*2};
        const bytes=[...nextTiles.map(e=>e.mesh),...nextFragments.map(e=>e.mesh),...nextBranch.map(e=>e.product.mesh)]
          .reduce((n,m)=>n+m.positions.byteLength+m.normals.byteLength+m.indices.byteLength+(m.colors?.byteLength??0),0);
        admitHvpResources({...publishedLedger,totalCpuBytes:ledger.totalCpuBytes-ledger.tempEstimateBytes+retainedDecodedBytes+physics!.collisionBytes*2+bytes*3,
          retainedMeshBytes:ledger.retainedMeshBytes+bytes},caps);
        const newKeys=[...nextTiles,...nextFragments,...nextBranch].map(e=>e.artifact.representationKey);
        for(const key of newKeys){managedRestoreKeys.add(key);}
        const previousNeighbor=neighbor!;
        let nextNeighbor:ReturnType<typeof createHvpNeighborController>|undefined,neighborStage:HvpStagedTerrain|undefined,neighborPublished=false;
        try{
          for(const e of [...nextTiles,...nextFragments.filter(e=>!nextParked.has(e.ownerId))]){upsertTerrain(e);plainTerrainLeases.push({nodeKey:e.artifact.representationKey,lease:materialFactory.acquire(e.group.materialProfiles)});}
          for(const e of nextBranch){uploadBranch(e);}if(!aoEnabled){setAoOnNodes(false);}
          if(regionalRestore){
            // Candidate B is a real paused World. Its controller may prepare a
            // cache lease, but cannot issue native mutations before publication.
            const livePhysics=()=>{if(!neighborPublished){throw new Error("Unpublished neighbour cannot mutate World A");}return physics!;};
            const stage=(value:HvpNeighborStage)=>stageNeighbor(value,{tiles:nextMap,ledger:replacementLedger,sourceBytes,
              overlayBytes:root.overlayBytes,stagingBytes:retainedDecodedBytes+bytes*3,stagedMeshBytes:bytes});
            nextNeighbor=createHvpNeighborController({primary:()=>neighborPublished?terrainRoot.read():root,
              physics:{read:()=>neighborPublished?physics!.read():candidate,
                prepareNeighbor:(...args)=>livePhysics().prepareNeighbor(...args),commitNeighbor:id=>livePhysics().commitNeighbor(id),
                publishNeighbor:()=>livePhysics().publishNeighbor(),rollbackNeighbor:id=>livePhysics().rollbackNeighbor(id),
                finalizeNeighbor:id=>livePhysics().finalizeNeighbor(id),command:kind=>livePhysics().command(kind)},
              compiler:terrainCompiler!,proxies:originalProxies,cache:neighborCache,
              baseSectorCount:candidate.neighbor?.baseSectorCount??originalWorld.neighbor?.baseSectorCount??physics!.preparation.jobs,
              current:()=>!disposed&&hvpMountEpoch===myEpoch&&(neighborPublished||current()),
              blocked:()=>!neighborPublished||saveBusy||saveHold||supportPending||Boolean(dormancy?.read().busy||dormancy?.read().recoveryHold)||["Pending","RecoveryHold"].includes(terrainConsumer!.read().state)
                ||structuralConsumer!.read().state!=="Ready"||bodyCutConsumer!.read().state!=="Idle",
              admit:cost=>neighborPublished?admitNeighbor(cost):admitHvpResources({...ledger,totalCpuBytes:ledger.totalCpuBytes-ledger.tempEstimateBytes+retainedDecodedBytes
                +Math.max(0,cost.cache-neighborCosts.cacheBytes)+cost.source+cost.checkpoint+(cost.preparing?restorePrepareBytes:0)},caps),
              stage:value=>{
                if(neighborPublished){return stageNeighbor(value);}
                if(neighborStage){throw new Error("Duplicate staged neighbour generation");}
                neighborStage=stage(value);
                // Defer all visible changes and retirement to the outer scene CAS.
                return {publish(){},rollback(){},finish(){}};
              }});
            if(game.neighborRoot){await nextNeighbor.initialize(game.neighborRoot,game.checkpoint.neighbor!.lod);}
            if(!neighborStage){neighborStage=stage({products:null,seams:null,epoch:candidate.neighbor?.epoch??restoreSequence,source:null,
              cacheBytes:neighborCache.totalBytes,checkpointBytes:nextNeighbor.read().checkpointBytes});}
          }
        }catch(error){
          try{neighborStage?.rollback();}finally{await nextNeighbor?.dispose();}
          for(const e of [...nextTiles,...nextFragments]){removeTerrainEntry(e);}for(const e of nextBranch){retireBranch(e);}throw error;
        }
        const previousTiles=new Map(terrainEntries),previousFragments=new Map(fragmentEntries),previousBranch=branchEntries,previousBranchProducts=branchProducts,
          previousLedger=ledger,previousTransforms=physicsTransforms;
        const previousSalvage=salvage;
        const previousParked=new Set(parkedRenderOwners);
        let previousRoot:ReturnType<typeof createHvpTerrainRoot>|undefined;
        const setEntries=(tiles:typeof terrainEntries,fragments:typeof fragmentEntries,branches:typeof branchEntries,parked:ReadonlySet<string>)=>{
          terrainEntries.clear();activeTerrainKeys.clear();for(const [id,e] of tiles){terrainEntries.set(id,e);activeTerrainKeys.add(e.artifact.representationKey);}
          parkedRenderOwners.clear();for(const id of parked){parkedRenderOwners.add(id);}
          fragmentEntries.clear();activeFragmentKeys.clear();for(const [id,e] of fragments){fragmentEntries.set(id,e);
            if(!parked.has(id)){activeFragmentKeys.add(e.artifact.representationKey);}else{activeRestoreKeys.delete(e.artifact.representationKey);}}
          branchEntries=branches;branchProducts=branches.map(e=>e.product);activeBranchKeys.clear();for(const e of branches){activeBranchKeys.add(e.product.key);}
        };
        return {
          publish(){
            previousRoot=terrainRoot.replace(old,game.root);
            salvage=game.checkpoint.progress?createHvpSalvageLoop(game.root.read().sessionId,game.checkpoint.progress):undefined;
            terrainConsumer!.restoreReceipts(game.receipts.terrain);structuralConsumer!.restoreReceipts(game.receipts.structural);bodyCutConsumer!.restoreReceipts(game.receipts.moving);
            for(const key of newKeys){activeRestoreKeys.add(key);}
            setEntries(nextMap,new Map(nextFragments.map(e=>[e.ownerId,e])),nextBranch,nextParked);ledger=publishedLedger;
            if(nextNeighbor){neighbor=nextNeighbor;neighborPublished=true;neighborStage!.publish();}
            restoreView(game.view);syncPhysicsTransforms();presentation.updateProjection();updateTerrainState();
          },
          rollback(){
            if(previousRoot){terrainRoot.replace(root,previousRoot);}
            salvage=previousSalvage;
            terrainConsumer!.restoreReceipts(oldReceipts.terrain);structuralConsumer!.restoreReceipts(oldReceipts.structural);bodyCutConsumer!.restoreReceipts(oldReceipts.moving);
            for(const key of newKeys){activeRestoreKeys.delete(key);}
            setEntries(previousTiles,previousFragments,previousBranch,previousParked);branchProducts=previousBranchProducts;ledger=previousLedger;
            neighbor=previousNeighbor;neighborPublished=false;physicsTransforms=previousTransforms;
            neighborStage?.rollback();nextNeighbor?.retire();
            restoreView(oldView);presentation.updateProjection();
            for(const e of [...nextTiles,...nextFragments]){removeTerrainEntry(e);}for(const e of nextBranch){retireBranch(e);}
          },
          finish(){for(const e of nextTiles){removeTerrainEntry(previousTiles.get(e.id)!);}
            for(const e of previousFragments.values()){removeTerrainEntry(e);}for(const e of previousBranch){retireBranch(e);}
            if(nextNeighbor){neighborStage!.finish();previousNeighbor.retire();}
            updateTerrainState();}
        };
      },current);
    };
    const saveAction=async(kind:"Save"|"Load")=>{
      if(saveBusy||saveHold||disposed||dormancy?.read().busy||dormancy?.read().recoveryHold){return;}
      saveBusy=true;saveView={state:kind==="Save"?"Saving":"Loading",message:"Bestätigte Generation vorbereiten",revision:saveRevision};
      hud?.updateSave();
      try{
        if(!confirmed()){throw new Error("Mutation/RecoveryHold: zuerst laufenden Befehl abschließen");}
        playerInput!.stop();showCutPreview([],false);await physics!.command("Pause");
        // Before decoding B, reserve A + the bounded checkpoint working set.
        admitHvpResources({...ledger,totalCpuBytes:ledger.totalCpuBytes-ledger.tempEstimateBytes+64*1024*1024+16*1024*1024},caps);
        const store=await openSaveStore();if(!confirmed()){throw new Error("Scene disposed during storage access");}
        if(kind==="Save"){
          const captured=await captureGame(),record=await store.save(captured.game,saveRevision);saveRevision=record.metadata.recordRevision;
          if(captured.candidate&&salvage){salvage.commitSave(captured.candidate,(record.envelope.player.data.hestia as unknown as {progress:HvpSalvageCheckpoint}).progress);}
          saveView={state:"Saved",message:"Vollständiger Hestia-Spielstand lokal gespeichert",revision:saveRevision};
        }else{
          const record=await store.load();if(!confirmed()){throw new Error("Scene disposed during load");}
          await loadGame(record.game);saveRevision=record.metadata.recordRevision;
          saveView={state:"Loaded",message:"Spielstand geladen – pausiert, Spielen setzt ausdrücklich fort",revision:saveRevision};
        }
      }catch(error){saveHold=String(error).includes("RecoveryHold");saveView={state:saveHold?"RecoveryHold":"Rejected",message:String(error),revision:saveRevision};}
      finally{saveBusy=false;if(!disposed&&hvpMountEpoch===myEpoch){hud?.updateSave();if(!saveHold){syncPhysicsTransforms();observeSalvage();updateTerrainState();}}}
    };
    let inspectEnabled = false;
    if(coldGame){
      terrainConsumer!.restoreReceipts(coldGame.receipts.terrain);structuralConsumer!.restoreReceipts(coldGame.receipts.structural);bodyCutConsumer!.restoreReceipts(coldGame.receipts.moving);
      if(coldGame.neighborRoot){
        await neighbor!.initialize(coldGame.neighborRoot,coldGame.checkpoint.neighbor!.lod);
        // The decoded B grid is handed to the controller (or released when
        // dormant); it is no longer an additional checkpoint-owned copy.
        checkpointSourceBytes-=HVP_SOURCE_SLOT_COUNT;
        ledger={...ledger,checkpointSourceBytes,totalCpuBytes:ledger.totalCpuBytes-HVP_SOURCE_SLOT_COUNT};
      }
      restoreView(coldGame.view);syncPhysicsTransforms();presentation.updateProjection();updateTerrainState();
      coldGame=undefined;
    }
    dormancy=createHvpDormancyController({physics,stage:stageDormancy,current:()=>!disposed&&hvpMountEpoch===myEpoch,
      blocked:()=>saveBusy||saveHold||supportPending||Boolean(neighbor?.read().busy||neighbor?.read().recoveryHold)
        ||["Pending","RecoveryHold"].includes(terrainConsumer!.read().state)||structuralConsumer!.read().state!=="Ready"||bodyCutConsumer!.read().state!=="Idle",
      admit:()=>{
        // Warm derived CPU meshes stay bounded/accounted; native and GPU owners
        // are removed. Keep the existing preparation allowance for source
        // decode/native reconstruction, plus fresh backend snapshots.
        const bytes=[...fragmentEntries.values()].reduce((n,e)=>n+e.mesh.positions.byteLength+e.mesh.normals.byteLength+e.mesh.indices.byteLength+(e.mesh.colors?.byteLength??0),0);
        admitHvpResources({...ledger,totalCpuBytes:ledger.totalCpuBytes-ledger.tempEstimateBytes+physicsPrepareBytes+3*bytes},caps);
      }});
    const endSession=async()=>{
      if(disposed||saveBusy){return;}
      if(neighbor?.read().busy||dormancy?.read().busy||supportPending||terrainConsumer!.read().queued>0
        ||structuralConsumer!.read().state==="Pending"||bodyCutConsumer!.read().state==="Pending"){
        saveView={state:"Rejected",message:"Laufenden Vorgang vor dem Beenden abwarten",revision:saveRevision};hud?.updateSave();return;
      }
      if(!windowPort.confirm?.("Sitzung beenden? Ungespeicherte Änderungen werden verworfen; der gespeicherte Stand bleibt erhalten.")){return;}
      try{await dispose();}catch(error){disposalReceipt??={state:"Failed",errors:[String(error)]};}
      if(hvpMountEpoch!==myEpoch){return;}
      documentPort.body.dataset.hestiaPrototypeDisposal=JSON.stringify(disposalReceipt);
      launcher=documentPort.createElement("section");launcher.id="hvp-ended";launcher.setAttribute("role","status");
      launcher.setAttribute("style","position:fixed;inset:20% 15%;padding:24px;background:#10202a;color:#fff;font:16px system-ui;z-index:40");
      const message=documentPort.createElement("p");message.textContent=disposalReceipt?.state==="Disposed"?"Hestia-Sitzung beendet":"Fehler beim Beenden – neu laden";
      const restart=documentPort.createElement("button");restart.textContent="Neu starten";restart.type="button";
      launcherListeners.add(restart,"click",restartAfterEnd);launcher.append(message,restart);host.append(launcher);
    };
    hud = createHvpHud({
      host,
      documentPort,
      actions: {
        endSession:()=>{void endSession();},
        readNeighbor:()=>neighbor?.read()??null,
        readDormancy:()=>dormancy?.read()??null,
        retryNeighbor:()=>{neighbor?.retry();dormancy?.retry();},
        restartEast:()=>{if(!saveBusy&&!saveHold&&windowPort.confirm?.("Neue Sitzung am Ostpfad starten? Ungespeicherte Änderungen werden verworfen.")){
          windowPort.location?.assign("/?hestiaPrototype=1&hvpScenario=east-edge");}},
        readSalvage:()=>salvage?.read()??null,
        restartSalvage:()=>{if(!saveBusy&&!saveHold&&windowPort.confirm?.("Neuen Bergungsauftrag starten? Ungespeicherte Änderungen werden verworfen; der gespeicherte Stand bleibt erhalten.")){
          windowPort.location?.assign("/?hestiaPrototype=1&hvpScenario=salvage");}},
        readSave:()=>saveView,save:()=>{void saveAction("Save");},load:()=>{void saveAction("Load");},
        loadNewSession:()=>{if(!saveBusy&&!saveHold&&windowPort.confirm?.("Gespeicherte Sitzung neu öffnen? Ungespeicherte Änderungen werden verworfen.")){
          windowPort.location?.assign("/?hestiaPrototype=1&hvpLoad=primary");}},
        setPreset: (preset: HvpCameraPreset) => {
          playerInput!.stop();
          camera!.setPreset(preset);
          if(preset==="C07-QUARRY") { void physics!.command("Pause");playerInput!.aimAt({x:-10.5,y:1,z:-9}); }
          hud!.update("Ready", camera!.readPose(), stats);
        },
        resetCamera: () => {
          playerInput!.stop();
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
          playerInput!.stop();
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
        },
        readPhysics: () => physics!.read(),
        physicsCommand: kind => { if (kind === "Pause") { playerInput!.stop(); } return physics!.command(kind); },
        play: () => { inspectEnabled = false; camera!.setMode("Orbit"); playerInput!.start(); },
        readThirdPerson: () => playerInput!.thirdPerson,
        readAimScreen: () => playerInput!.aimScreen,
        togglePlayerView: () => playerInput!.toggleView(),
        readTool:()=>plasmaTool!.read(),
        selectTool:mode=>plasmaTool!.select(mode),
        aimBranch:()=>{
          playerInput!.stop();plasmaTool!.select(physics!.read().structural?.cutEdge===1?1:2);
          const target=physics!.read().structural?.aimPoint;
          if(target){playerInput!.aimAt(target);}
          void physics!.command("Pause").catch(error=>{
            if(!disposed&&hvpMountEpoch===myEpoch){documentPort.body.dataset.hestiaPrototypeInputError=String(error);}
          });
        },
        previewSupport:()=>{void previewRockSupport();},
        aimRock:()=>{
          playerInput!.stop();camera!.setPreset("C05-ROCKARM");plasmaTool!.select(2);
          playerInput!.aimAt({x:6.49,y:2.1875,z:-6.25});void physics!.command("Pause");
          hud!.update("Ready",camera!.readPose(),stats);
        },
        restartRock:()=>{
          if(windowPort.confirm?.("Neue Felsarm-Sitzung starten? Ungespeicherte Schnitte dieser Sitzung werden verworfen.")){
            windowPort.location?.assign("/?hestiaPrototype=1&hvpScenario=rock-arm");
          }
        },
        readSupport:()=>supportView,
        aimImpulse:()=>{
          playerInput!.stop();
          const target=physics!.read().inertia?.aimPoint;
          if(target) { playerInput!.aimAt(target); }
          void physics!.command("Pause").catch(error=>{
            if(!disposed&&hvpMountEpoch===myEpoch) { documentPort.body.dataset.hestiaPrototypeInputError=String(error); }
          });
        }
      }
    });
    // Upload all startup objects while Loading, then publish their complete set
    // before Ready or the first draw. Subsequent mutations publish immediately.
    presentation.updateProjection();
    hud.update("Ready", camera.readPose(), stats);
    startupMeasuring=false;
    startupPhase("startupPublishMs");
    measurement.record("bootstrapReadyMs",measurementStarted,performance.now()-measurementStarted);

    let previousFrameTime: number | undefined;
    let measurementFrame=0;
    let firstReadyFrame=false;
    let residencyDiagnosticFrames=0;
    let physicsTick = -1;
    const renderFrame = (timestamp: number): void => {
      const frameStarted=measurement.enabled?performance.now():0;
      if(measurement.enabled&&previousFrameTime!==undefined){measurement.record("frameIntervalMs",previousFrameTime,timestamp-previousFrameTime);}
      if (disposed) return;
      const deltaSeconds = previousFrameTime === undefined ? 0 : (timestamp - previousFrameTime) / 1_000;
      previousFrameTime = timestamp;
      if(++residencyDiagnosticFrames%60===0){
        const d=backend!.readDiagnostics();
        documentPort.body.dataset.hestiaPrototypeOwnedRender=JSON.stringify({
          geometries:d.geometryAllocations-d.geometryDisposals,materials:d.materialAllocations-d.materialDisposals,
          representations:d.activeRepresentations,ownedCpuBytes:d.ownedCpuBytes,
          previewCount:d.residentRepresentationKeys.filter(key=>key.startsWith("hvp:tool:preview:")).length});
      }
      try {
        playerInput!.update();
        physics!.update();
        plasmaTool!.update();
        if(supportCandidate&&terrainRoot.read()!==supportCandidate.cut.before){
          supportCandidate=undefined;supportView={state:"Stale",cells:0,massKg:0,fragments:0,message:"Terrainrevision geändert"};
          documentPort.body.dataset.hestiaPrototypeSupport=JSON.stringify(supportView);
          if(supportPreviewVisible){showCutPreview([],false);}
        }
        documentPort.body.dataset.hestiaPrototypeTool=JSON.stringify(plasmaTool!.read());
         const state = physics!.read();
         dormancy!.update();
         documentPort.body.dataset.hestiaPrototypeBodyResidency=JSON.stringify({...dormancy!.read(),parkedRenderOwners:[...parkedRenderOwners],
           derivedMeshCacheBytes:[...fragmentEntries.values()].filter(e=>parkedRenderOwners.has(e.ownerId)).reduce((n,e)=>n+e.mesh.positions.byteLength+e.mesh.normals.byteLength+e.mesh.indices.byteLength+(e.mesh.colors?.byteLength??0),0)});
        if(state.player&&(state.player.status!=="Inspection"||state.neighbor?.resident||state.neighborPinned)){
          neighbor!.update(state.player.position.x,state.neighborPinned);
        }
        documentPort.body.dataset.hestiaPrototypeNeighbor=JSON.stringify(neighbor!.read());
        documentPort.body.dataset.hestiaPrototypePhysics = JSON.stringify(state);
        documentPort.body.dataset.hestiaPrototypePhysicsClock = JSON.stringify(physics!.clock??null);
        documentPort.body.dataset.hestiaPrototypeStructure = JSON.stringify(state.structural);
        if (state.ticks !== physicsTick || playerInput!.active) {
          physicsTick = state.ticks;
          syncPhysicsTransforms();
          presentation.updateProjection();
        }
        hud!.updatePhysics();
        if(!saveBusy){observeSalvage();}
      } catch (error) {
        void dispose().finally(() => { failureRoot = presentHvpFailure(documentPort, error); });
        return;
      }
      camera!.update(deltaSeconds);
      if (disposed) return;
      if(measurement.enabled){measurement.record("mainFrameCpuMs",frameStarted,performance.now()-frameStarted);}
      backend!.renderFrame();
      if(measurement.enabled){
        if(!firstReadyFrame){
          firstReadyFrame=true;const now=performance.now();
          measurement.record("coldReadyMs",measurementStarted,now-measurementStarted);
          measurement.record("navigationReadyMs",0,now);
        }
        if(++measurementFrame%15===0){
          const state=physics!.read(),jobs=terrainCompiler!.diagnostics();
          measurement.record("resources",performance.now(),0,{triangles:ledger.triangles,draws:ledger.drawCalls,cpuBytes:ledger.totalCpuBytes,
            meshBytes:ledger.retainedMeshBytes,activeDynamic:state.activeDynamic,residentDynamic:state.residentDynamic,colliders:state.colliderCount,
            heavyJobs:jobs.runningJobs,queue:jobs.queue});
          documentPort.body.dataset.hestiaPrototypeMeasurements=JSON.stringify(measurement.read());
        }
      }
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
