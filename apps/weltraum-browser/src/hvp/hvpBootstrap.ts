import type { FactoryPlacementPlan, FactoryPlacementRequest } from "../factory/construction/placement";
import type { FactoryCarrierRequest, FactoryFacilityRequest } from "../hestia-prototype/physics/factoryFacilitySession";
import type { FactorySourceProfile, FactoryNativeConstructionPort } from "../factory/session/hostPort";
import type { FactoryHostExtension, FactoryHostExtensionHandle, FactoryHostPort, FactoryHostView, FactoryNativeHandlingPort,FactoryUiPanel,FactoryHostSurface } from "../factory/session/hostPort";
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
  deepFreezeMetadata,
  frameId,
  frameRevision,
  representationKey,
  materialProfileId,
  sourceRevision,
  visibilityPlanRevision,
  type FrameId,
  type MaterialProfile,
  type MaterialRange,
  type MeshArtifact,
  type RenderBackend,
  type RenderCommand,
  type RenderCommandResult,
  type RepresentationKey
} from "../presentation";
import {canonicalJson as factoryCanonicalJson,canonicalSignature as factoryCanonicalSignature} from "../resources/serialization";
import { createHvpCamera, type HvpCameraPreset } from "./hvpCamera";
import { createHvpHud, type HvpLifecycleState } from "./hvpHud";
import { buildHvpPlant, estimateHvpVegetationSourceBytes, isHvpPlantHabitat, meshHvpVegetation, planHvpVegetation, projectHvpVegetation, HVP_VEGETATION_VERSION } from "../hestia-prototype/presentation/vegetation";
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
    readonly factoryExtension?: FactoryHostExtension;
    readonly factorySourceProfile?: FactorySourceProfile;
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
  let factoryMount: Promise<FactoryHostExtensionHandle> | undefined;
  let factoryHandle: FactoryHostExtensionHandle | undefined;
  const factoryListeners = new Set<(view: FactoryHostView) => void>();
  let factoryFocusedPanel:FactoryUiPanel|null=null,factorySurface:FactoryHostSurface|null=null;
  let factoryFocusPauseDepth=0,factoryRecoveryPending=false,factoryInputError:string|null=null;
  const factoryPausePending=()=>factoryFocusPauseDepth>0||factoryRecoveryPending;
  const factoryPanelFocused=()=>factoryFocusedPanel!==null||factorySurface!==null;
  const factoryBlocked = () => factoryHandle !== undefined && !factoryHandle.isQuiescent();
  let publishFactoryView: (() => FactoryHostView) | undefined;
  let readFactoryView: (() => FactoryHostView) | undefined;
  const factoryCanResume = () => readFactoryView?.().confirmed === true && !documentPort.hidden && !factoryPausePending();
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
  const restartAfterEnd=()=>{launcherListeners.dispose();launcher?.remove();launcher=undefined;windowPort.location?.assign(overrides.factoryExtension?`/factory.html${measurement.enabled?"?hvpMeasure=1":""}`:`/?hestiaPrototype=1${measurement.enabled?"&hvpMeasure=1":""}`);};
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
      factoryListeners.clear();
      // Extension cleanup precedes every native, input and render owner.
      await attempt(async () => { if (factoryMount) await (await factoryMount).dispose(); });
      factoryHandle = undefined;
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
        delete documentPort.body.dataset.hestiaFactoryInputTransport;
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
    const managedFactoryKeys=new Set<string>(),activeFactoryKeys=new Set<string>();
    let factoryTransforms:readonly RepresentationTransformSnapshot[]=[];
    type FactoryCost={cpu:number;mesh:number;triangles:number;draws:number};
    const factoryCosts=new Map<string,FactoryCost>();
    const factoryTotals=()=>[...factoryCosts.values()].reduce((a,b)=>({cpu:a.cpu+b.cpu,mesh:a.mesh+b.mesh,triangles:a.triangles+b.triangles,draws:a.draws+b.draws}),{cpu:0,mesh:0,triangles:0,draws:0});
    let branchProducts:readonly HvpBranchProduct[]=[];
    let activePreviewKey="";
    const presentation = createHvpPresentationBackend(backend, () => ({
      position: backend!.camera.position,
      orientation: backend!.camera.quaternion,
      verticalFovDegrees: backend!.camera.fov,
      aspect: backend!.camera.aspect,
      near: backend!.camera.near,
      far: backend!.camera.far
    }), representationKey(HVP_WATER_REPRESENTATION_KEY), () => [...vegetationTransforms, ...physicsTransforms,...factoryTransforms,
      ...physicsTransforms.filter(t=>t.representationKey==="hvp:branch:parent").map(t=>({...t,representationKey:representationKey(HVP_SALVAGE_LINK_KEY)})),
      ...branchProducts.filter(p=>p.decoration).flatMap(p=>{
        const owner=physicsTransforms.find(t=>t.representationKey===p.ownerId);
        return owner?[{...owner,representationKey:representationKey(p.key)}]:[];
      })],
    // Factory modals stop intent without moving the first-person camera out
    // of its own head. A late Pause ACK must not reveal the visor there.
    key => (key !== HVP_AVATAR_KEY || (overrides.factoryExtension
      ? inspectEnabled||Boolean(playerInput?.thirdPerson)
      : !(playerInput?.active)||playerInput.thirdPerson))
      && (key!==HVP_SALVAGE_LINK_KEY||branchProducts.some(p=>p.ownerId==="hvp:branch:parent"))
      && (!key.startsWith("hvp:terrain:s") || activeTerrainKeys.has(key))
      && (!managedFragmentKeys.has(key)||activeFragmentKeys.has(key))
      && (!managedRestoreKeys.has(key)||activeRestoreKeys.has(key))
      && (!managedNeighborKeys.has(key)||activeNeighborKeys.has(key))
      && (!managedFactoryKeys.has(key)||activeFactoryKeys.has(key))
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
    if (overrides.factoryExtension && loadQuery !== null) throw new Error("Factory requires a combined checkpoint; legacy load is unavailable");
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
    if(overrides.factorySourceProfile && (!overrides.factoryExtension||(overrides.factorySourceProfile.version!=="hvp-factory-startsite-v1"&&overrides.factorySourceProfile.version!=="hvp-factory-startsite-v2"&&overrides.factorySourceProfile.version!=="hvp-factory-startsite-v3"&&overrides.factorySourceProfile.version!=="hvp-factory-startsite-v4"&&overrides.factorySourceProfile.version!=="hvp-factory-startsite-v5")||snapshot.version!==overrides.factorySourceProfile.version))throw new Error("Factory source/profile binding mismatch");
    if((snapshot.version==="hvp-factory-startsite-v1"||snapshot.version==="hvp-factory-startsite-v2"||snapshot.version==="hvp-factory-startsite-v3"||snapshot.version==="hvp-factory-startsite-v4"||snapshot.version==="hvp-factory-startsite-v5")&&!overrides.factorySourceProfile)throw new Error("Factory source requires its explicitly bound profile");
    const initialFactoryCargo=overrides.factorySourceProfile?(await import("../factory/fixtures/cargoSite")).createFactoryCargoSite(snapshot):undefined;
    if(initialFactoryCargo)factoryCosts.set(initialFactoryCargo.ownerId,{cpu:initialFactoryCargo.canonicalJson.length*16+1944,mesh:1296,triangles:12,draws:1});
    const sourceColumn=overrides.factorySourceProfile?.readColumn??readHvpSourceColumnWorld;
    const vegetationProfile=overrides.factorySourceProfile?{version:"hvp-factory-vegetation-v1" as const,readColumn:sourceColumn}:undefined;
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
    const plants = coldGame?coldGame.plants.map(p=>p.instance):(()=>{
      const planned=planHvpVegetation(undefined,vegetationProfile);
      if(overrides.factorySourceProfile?.version!=="hvp-factory-startsite-v2"&&overrides.factorySourceProfile?.version!=="hvp-factory-startsite-v3"&&overrides.factorySourceProfile?.version!=="hvp-factory-startsite-v4"&&overrides.factorySourceProfile?.version!=="hvp-factory-startsite-v5")return planned;
      const invalid=planned.filter(p=>!isHvpPlantHabitat(p.kind,p.position.x,p.position.z,vegetationProfile));
      const removed=invalid[0];
      if(planned.length!==97||invalid.length!==1||removed?.id!=="hvp:flora:bed-52-220"||removed.kind!=="broadleaf"||removed.variant!==1
        ||removed.position.x!==-9.5||removed.position.y!==2.5||removed.position.z!==11.5)throw Error("Factory V2 initial decoration differs from its exact habitat delta");
      // Exact source-derived nonphysical broadleaf delta; all wood/native owners and habitat guards remain intact.
      return Object.freeze(planned.filter(p=>p!==removed));
    })();
    const vegetationSourceBytes = estimateHvpVegetationSourceBytes(plants);
    if (vegetationSourceBytes > 16 * 1024 * 1024) { throw new Error("Vegetation source BudgetExceeded before allocation"); }
    const collisionSources: HvpCollisionSource[] = [{...terrainRoot.read(),
      readHaloSlot:coldEast?(x,y,z)=>x>=256?coldEast.readSlot(x-256,y,z):undefined:undefined}];
    const plantSources=coldGame?.plants??plants.map(plant=>buildHvpPlant(plant,vegetationProfile));
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
    const spawn = coldGame?.checkpoint.world.dropSpawn??{ x: -9, y: sourceColumn(-9, -9).topMeters + 2.25, z: -9 };
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
    const salvageMarker=salvageScenario?createHvpSalvageMarker(sourceColumn(-11.5,-12.625).topMeters):undefined;
    const salvageLink=salvageScenario?createHvpSalvageLink():undefined;
    type NeighborCosts={meshes:readonly HvpCompactMesh[];groupedBytes:number;draws:number;sourceBytes:number;cacheBytes:number;checkpointBytes:number;baseProxyBytes:number;sharedBytes:number;physicsBytes:number};
    let neighborCosts:NeighborCosts={meshes:[],groupedBytes:0,draws:0,sourceBytes:0,cacheBytes:0,checkpointBytes:0,baseProxyBytes:0,sharedBytes:0,physicsBytes:0};
    const sceneLedger=(input:Parameters<typeof buildHvpResourceLedger>[0]&{neighbor?:NeighborCosts;dormantCheckpointBytes?:number})=>{
      const n=input.neighbor??neighborCosts;
      const dormantCheckpointBytes=input.dormantCheckpointBytes??physics?.read().dormantCheckpointBytes??0;
      const cost=factoryTotals();
      const result=buildHvpResourceLedger({...input,
        additionalMeshes:[...(input.additionalMeshes??[]),...n.meshes,...(salvageMarker&&salvageLink?[salvageMarker,salvageLink]:[])],
        groupedIndexBytes:input.groupedIndexBytes+n.groupedBytes,drawCalls:input.drawCalls+(salvageMarker?2:0)+n.draws});
      // The live composite's raw typed views alias the cache packet. Artifact
      // snapshots and regrouped indices are separate allocations; count those.
      return {...result,factoryCpuBytes:cost.cpu,factoryMeshBytes:cost.mesh,factoryTriangles:cost.triangles,factoryDraws:cost.draws,retainedMeshBytes:result.retainedMeshBytes+cost.mesh,triangles:result.triangles+cost.triangles,drawCalls:result.drawCalls+cost.draws,totalCpuBytes:result.totalCpuBytes+cost.cpu+n.sourceBytes+n.cacheBytes+n.checkpointBytes+n.baseProxyBytes-n.sharedBytes+n.physicsBytes+dormantCheckpointBytes,dormantCheckpointBytes,
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
    const playerSpawn = coldGame?.checkpoint.world.player?.position??(initialFactoryCargo?{x:initialFactoryCargo.spawnMm[0]/1000,y:initialFactoryCargo.spawnMm[1]/1000,z:initialFactoryCargo.spawnMm[2]/1000}:scenario==="east-edge"?{x:7,y:sourceColumn(7,-14).topMeters+.92,z:-14}:rockScenario?{x:7,y:.125+.92,z:-6.25}:salvageScenario?
      {x:-11.8125,y:sourceColumn(-11.8125,-15.25).topMeters+.92,z:-15.25}:{ x: -9, y: sourceColumn(-9, -11).topMeters + 0.92, z: -11 });
    documentPort.body.dataset.hestiaPrototypeScenario=coldGame?"saved":scenario;
    // Authored dry impulse area behind the start, not the sloping channel bank.
    const inertiaSpawn={x:-9,y:Math.max(...[-9,-8].flatMap(x=>[-13.75,-12.5].map(z=>sourceColumn(x,z).topMeters)))+1.25,z:-13};
    const branchSpawn={x:-12,y:Math.max(...[-12,-11.5].flatMap(x=>[-13.5,-13].map(z=>sourceColumn(x,z).topMeters))),z:-13.5};
    startupPhase("startupAdmissionMs");
    physics = await (overrides.createPhysics ?? createHvpPhysicsClient)(collisionSources, spawn, physicsAbort.signal, playerSpawn, inertiaSpawn,branchSpawn,coldGame?.checkpoint.world,salvageScenario?"salvage":"branch",measurement.enabled?measurement.worker:undefined,overrides.factorySourceProfile!==undefined,initialFactoryCargo);
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
      isInputBlocked: () => Boolean(playerInput?.active||playerInput?.activationPending||factoryPanelFocused()) });
    playerInput = createHvpPlayerInput(canvas, backend.camera, physics, documentPort as Document, windowPort as Window, () => {
      camera!.reset(); hud!.update("Ready", camera!.readPose(), stats);
    },{confirm:()=>{if (!factoryBlocked()) void plasmaTool?.confirm();},select:mode=>plasmaTool?.select(mode)},()=>saveBusy||saveHold||factoryPanelFocused()||factoryBlocked()||Boolean(dormancy?.read().recoveryHold)||Boolean(overrides.factoryExtension&&!factoryCanResume()),overrides.factorySourceProfile!==undefined,overrides.factoryExtension!==undefined);
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
      supportView={state:"Pending",cells:0,massKg:0,fragments:0,message:"Checking canonical cells; no mutation"};
      documentPort.body.dataset.hestiaPrototypeSupport=JSON.stringify(supportView);
      showCutPreview([],false);supportCandidate=undefined;
      try{
        if(["Pending","RecoveryHold"].includes(terrainConsumer!.read().state)||structuralConsumer!.read().state!=="Ready"||bodyCutConsumer!.read().state!=="Idle"){
          throw new Error("Another mutation is still pending");
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
          fragments:result.fragments.length,message:result.reason||"Preview only; terrain and world unchanged"};
        documentPort.body.dataset.hestiaPrototypeSupport=JSON.stringify({...supportView,generation:current.revision,sourceDigest:current.sourceDigest,
          candidateDigest:plan.after.sourceDigest,probes:result.probes,changedCells:plan.changed.length});
      }catch(error){
        if(!disposed&&hvpMountEpoch===myEpoch){supportView={state:"Rejected",cells:0,massKg:0,fragments:0,message:String(error)};
          documentPort.body.dataset.hestiaPrototypeSupport=JSON.stringify(supportView);}
      }finally{supportPending=false;}
    };
    let saveRevision:number|null=coldRevision,saveInitialized=coldGame!==undefined,restoreSequence=0;
    let saveView={state:coldGame?"Loaded":"Idle",message:coldGame?"Started from save – paused":"Local Hestia save",revision:coldRevision};
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
    const confirmed=(ignoreFactory=false)=>!disposed&&hvpMountEpoch===myEpoch&&(ignoreFactory||!factoryBlocked())&&!supportPending&&!neighbor?.read().busy&&!neighbor?.read().recoveryHold&&!dormancy?.read().busy&&!dormancy?.read().recoveryHold
      &&!["Pending","RecoveryHold"].includes(terrainConsumer!.read().state)
      &&structuralConsumer!.read().state==="Ready"&&bodyCutConsumer!.read().state==="Idle";
    const admitNeighbor=(bytes:Readonly<{source:number;cache:number;checkpoint:number;preparing:boolean}>)=>{
      documentPort.body.dataset.hestiaPrototypeNeighborAdmission=JSON.stringify({phase:"work",...bytes,retainedCpu:ledger.totalCpuBytes-ledger.tempEstimateBytes});
      admitHvpResources({...ledger,totalCpuBytes:ledger.totalCpuBytes-ledger.tempEstimateBytes-neighborCosts.sourceBytes-neighborCosts.cacheBytes-neighborCosts.checkpointBytes
        +bytes.source+bytes.cache+bytes.checkpoint+(bytes.preparing?physicsPrepareBytes:0)},caps);
    };
    neighbor=createHvpNeighborController({primary:()=>terrainRoot.read(),physics,compiler:terrainCompiler!,proxies:originalProxies,cache:neighborCache,
      baseSectorCount:physics.read().neighbor?.baseSectorCount??physics.preparation.jobs,current:()=>!disposed&&hvpMountEpoch===myEpoch,
      blocked:()=>saveBusy||saveHold||factoryBlocked()||supportPending||Boolean(dormancy?.read().busy||dormancy?.read().recoveryHold)||["Pending","RecoveryHold"].includes(terrainConsumer!.read().state)||structuralConsumer!.read().state!=="Ready"||bodyCutConsumer!.read().state!=="Idle",
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
              blocked:()=>!neighborPublished||saveBusy||saveHold||factoryBlocked()||supportPending||Boolean(dormancy?.read().busy||dormancy?.read().recoveryHold)||["Pending","RecoveryHold"].includes(terrainConsumer!.read().state)
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
    const rejectLegacyPersistence = () => {
      if (!overrides.factoryExtension) return false;
      saveView={state:"Rejected",message:"Factory: combined save not available yet; legacy save/load blocked",revision:saveRevision};
      hud?.updateSave(); return true;
    };
    const saveAction=async(kind:"Save"|"Load")=>{
      if (rejectLegacyPersistence()) return;
      if(saveBusy||saveHold||disposed||dormancy?.read().busy||dormancy?.read().recoveryHold){return;}
      saveBusy=true;saveView={state:kind==="Save"?"Saving":"Loading",message:"Preparing confirmed generation",revision:saveRevision};
      hud?.updateSave();
      try{
        if(!confirmed()){throw new Error("Mutation/RecoveryHold: complete the pending command first");}
        playerInput!.stop();showCutPreview([],false);await physics!.command("Pause");
        // Before decoding B, reserve A + the bounded checkpoint working set.
        admitHvpResources({...ledger,totalCpuBytes:ledger.totalCpuBytes-ledger.tempEstimateBytes+64*1024*1024+16*1024*1024},caps);
        const store=await openSaveStore();if(!confirmed()){throw new Error("Scene disposed during storage access");}
        if(kind==="Save"){
          const captured=await captureGame(),record=await store.save(captured.game,saveRevision);saveRevision=record.metadata.recordRevision;
          if(captured.candidate&&salvage){salvage.commitSave(captured.candidate,(record.envelope.player.data.hestia as unknown as {progress:HvpSalvageCheckpoint}).progress);}
          saveView={state:"Saved",message:"Complete Hestia save stored locally",revision:saveRevision};
        }else{
          const record=await store.load();if(!confirmed()){throw new Error("Scene disposed during load");}
          await loadGame(record.game);saveRevision=record.metadata.recordRevision;
          saveView={state:"Loaded",message:"Game loaded and paused; select Play to resume",revision:saveRevision};
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
      blocked:()=>saveBusy||saveHold||factoryBlocked()||supportPending||Boolean(neighbor?.read().busy||neighbor?.read().recoveryHold)
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
      const factoryEndBlocked=factoryHandle!==undefined&&!(factoryHandle.canEndSession?.()??factoryHandle.isQuiescent());
      if(factoryEndBlocked||neighbor?.read().busy||dormancy?.read().busy||supportPending||terrainConsumer!.read().queued>0
        ||structuralConsumer!.read().state==="Pending"||bodyCutConsumer!.read().state==="Pending"){
        saveView={state:"Rejected",message:"Wait for the pending operation before ending the session",revision:saveRevision};hud?.updateSave();return;
      }
      if(!windowPort.confirm?.("End session? Unsaved changes will be discarded; your existing save is retained.")){return;}
      try{await dispose();}catch(error){disposalReceipt??={state:"Failed",errors:[String(error)]};}
      if(hvpMountEpoch!==myEpoch){return;}
      documentPort.body.dataset.hestiaPrototypeDisposal=JSON.stringify(disposalReceipt);
      launcher=documentPort.createElement("section");launcher.id="hvp-ended";launcher.setAttribute("role","status");
      launcher.setAttribute("style","position:fixed;inset:20% 15%;padding:24px;background:#10202a;color:#fff;font:16px system-ui;z-index:40");
      const message=documentPort.createElement("p");message.textContent=disposalReceipt?.state==="Disposed"?"Hestia session ended":"Failed to end session – reload";
      const restart=documentPort.createElement("button");restart.textContent="Restart";restart.type="button";
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
        restartEast:()=>{if(!saveBusy&&!saveHold&&windowPort.confirm?.("Start a new east-path session? Unsaved changes will be discarded.")){
          windowPort.location?.assign("/?hestiaPrototype=1&hvpScenario=east-edge");}},
        readSalvage:()=>salvage?.read()??null,
        restartSalvage:()=>{if(!saveBusy&&!saveHold&&windowPort.confirm?.("Start a new salvage objective? Unsaved changes will be discarded; your existing save is retained.")){
          windowPort.location?.assign("/?hestiaPrototype=1&hvpScenario=salvage");}},
        readSave:()=>saveView,save:()=>{void saveAction("Save");},load:()=>{void saveAction("Load");},
        loadNewSession:()=>{if (rejectLegacyPersistence()) return; if(!saveBusy&&!saveHold&&windowPort.confirm?.("Reopen the saved session? Unsaved changes will be discarded.")){
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
        readContextHint:()=>{
          if(!overrides.factoryExtension)return undefined;
          const facilities=physics!.read().factoryFacilities,carrier=facilities?.carrier;
          if(!facilities||!carrier)return undefined;
          const mass=(carrier.massMg/1_000_000).toFixed(1),keys="WASD: walk and carry · Esc: pause / cargo controls · V: view";
          if(facilities.state==="RecoveryHold"||!["Carrying","Deposited"].includes(carrier.phase))return{
            target:`Transport on hold: ${mass} kg`,feedback:"Transport transition not confirmed yet.",cut:"Cargo is retained; wait for confirmed state.",keys};
          if(carrier.phase==="Deposited")return{target:`Depot: ${mass} kg`,feedback:carrier.accessible?"Cargo is at the accessible depot.":"Return to the depot to handle its cargo.",cut:"Use cargo controls to deliver locally or return to the source.",keys};
          const reasons:Record<string,string>={CarrierOverlap:"Obstacle in transport path. Choose a clear route.",CarrierSweep:"Obstacle in transport path. Choose a clear route.",CarrierSupport:"The ground does not fully support the cargo.",CarrierCoverage:"Transport ground is not fully confirmed yet.",CarrierGroundHeight:"Transport needs level ground."};
          return{target:`Transport: ${mass} kg`,feedback:facilities.lastCarrierVeto?(reasons[facilities.lastCarrierVeto.reason]??"Movement stopped: transport route unconfirmed."):"WASD moves you and the cargo together; obstacles stop both.",cut:"In cargo controls: set down here, deliver locally or return.",keys};
        },
        physicsCommand: kind => {
          if (overrides.factoryExtension && (kind === "Resume" || kind === "Drop") && !factoryCanResume()) {
            return Promise.reject(new Error("Factory host busy, hidden or unconfirmed"));
          }
          if (kind === "Pause") playerInput!.stop();
          const result = physics!.command(kind);
          return publishFactoryView ? result.then(() => { publishFactoryView!(); }) : result;
        },
        play: () => { if (overrides.factoryExtension && !factoryCanResume()) return; inspectEnabled = false; camera!.setMode("Orbit"); playerInput!.start(); },
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
          if(windowPort.confirm?.("Start a new rock-arm session? Unsaved cuts in this session will be discarded.")){
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
    const factoryLegacyHudRoots=overrides.factoryExtension?[documentPort.querySelector<HTMLElement>("#hvp-hud"),documentPort.querySelector<HTMLElement>("#hvp-interaction")]:[];
    const hideFactoryLegacyHud=()=>{for(const root of factoryLegacyHudRoots)if(root)root.hidden=true;};
    hideFactoryLegacyHud();
    startupMeasuring=false;
    startupPhase("startupPublishMs");
    measurement.record("bootstrapReadyMs",measurementStarted,performance.now()-measurementStarted);

    if (overrides.factoryExtension) {
      const current = () => !disposed && hvpMountEpoch === myEpoch;
      // An admitted internal command owns the Factory barrier; all native/host holds still apply.
      const nativeFactoryConfirmed=()=>{const native=physics!.read();return confirmed(true)&&!saveBusy&&!saveHold&&(!native.factoryFacilities||native.factoryFacilities.state==="Idle")&&["Running","Paused"].includes(native.status);};
      const factoryRecoveryAvailable=()=>{
        const native=physics!.read(),input=physics!.lifecycle?.().factoryInput;
        return current()&&!documentPort.hidden&&!factoryPausePending()&&!saveBusy&&!saveHold&&confirmed(true)&&!factoryBlocked()
          &&!!physics!.recoverFactorySimulationHold&&!!factoryHandle?.recoverSimulationHold
          &&native.status==="SimulationHold"&&native.factoryFacilities?.state==="Idle"&&native.terrainTransaction==="Idle"
          &&native.neighborTransaction==="Idle"&&native.bodyResidencyTransaction==="Idle"&&native.moving.state==="Idle"
          &&(!native.structural||native.structural.state==="Idle")&&!playerInput!.active&&!playerInput!.activationPending
          &&!!input&&input.enabled&&!input.closing&&input.commandDepth===0&&input.pendingIds.length===0
          &&input.desiredLevel.x===0&&input.desiredLevel.z===0&&!input.desiredLevel.sprint&&!input.desiredLevel.jump;
      };
      const read = (): FactoryHostView => {
        if (!current()) throw new Error("Factory host disposed or superseded");
        const root = terrainRoot.read(), native = physics!.read();
        return Object.freeze({ sessionId: root.sessionId, epoch: myEpoch, nativeTick: native.ticks,
          simulationRecoveryAvailable:factoryRecoveryAvailable(),
          physicsStatus: native.status, confirmed: confirmed() && !saveBusy && !saveHold && !factoryPausePending() && (!native.factoryFacilities||native.factoryFacilities.state==="Idle") && ["Running", "Paused"].includes(native.status),
          input:Object.freeze({active:playerInput!.active,activationPending:playerInput!.activationPending,pointerLocked:(documentPort as Document).pointerLockElement===canvas,
            pausePending:factoryPausePending(),focusedPanel:factoryFocusedPanel,surface:factorySurface,error:factoryInputError}),
          terrain: Object.freeze({ epoch: root.epoch, revision: root.revision, sourceDigest: root.sourceDigest,
            baseDigest: root.baseDigest, profileVersion:overrides.factorySourceProfile?snapshot.version as NonNullable<FactoryHostView["terrain"]["profileVersion"]>:undefined, cellMeters: root.cellMeters, originMeters: root.originMeters,
            sizeX: root.sizeX, sizeY: root.sizeY, sizeZ: root.sizeZ }) });
      };
      let syncCarrierProjection=()=>{};
      let syncInstalledProjection=()=>{};
      publishFactoryView = () => {
        syncCarrierProjection();
        const view = read();
        for (const listener of factoryListeners) listener(view);
        syncInstalledProjection();
        return view;
      };
      readFactoryView = read;
      const factoryAssets=await import("../factory/presentation/factoryAssets");
      const playAssets=await import("../factory/presentation/playAssetLoader");
      const s1Assets=await import("../factory/presentation/factoryS1Assets");
      const partCells=await import("../factory/presentation/factoryPartCells");
      const handlingProfiles=await import("../factory/construction/cargoHandlingProfile");
      const factoryCatalog=(await import("../factory/catalog/fp02Catalog"));
      const playCatalog=factoryCatalog.loadFactoryCatalog(factoryCatalog.createFp02CatalogInput());
      const factoryAssetAbort=new AbortController();
      const installationProfiles=await import("../factory/construction/installationProfile");
      type FactoryScene={id:string;keys:readonly RepresentationKey[];artifacts:MeshArtifact[];transforms:readonly RepresentationTransformSnapshot[];published:boolean;
        play?:import("../factory/presentation/playAssetLoader").PlayAssetProjection;
        request?:FactoryPlacementRequest;s1?:import("../factory/presentation/factoryS1Assets").FactoryS1Assets;
        expectedSourceDigest?:string;expectedProfileDigest?:string;retiredKeys?:Set<RepresentationKey>;
        safePose?:Readonly<{jobId:string|null;partPoses:import("../factory/presentation/machinePose").MachinePose["partPoses"]}>;modelError?:string|null};
      const factoryScenes=new Map<string,FactoryScene>();
      const factoryStages=new Map<string,{request:FactoryFacilityRequest;binding:FactoryHostView;prepared:import("../hestia-prototype/physics/factoryFacilitySession").FactoryFacilityRead;scene?:FactoryScene;play?:import("../factory/presentation/playAssetLoader").PlayAssetProjection;s1?:import("../factory/presentation/factoryS1Assets").FactoryS1Assets;consumedProjection?:{scene:FactoryScene;published:boolean;activeKeys:readonly RepresentationKey[];registered:boolean}}>();
      let carrierScene:FactoryScene|undefined,carrierProjectionRevision=0,carrierPoseKey="",carrierOperation:"pickup"|"deposit"|"release"|undefined,carrierCaptureCostKey:string|undefined;
      let ghost:FactoryScene|undefined;
      let ghostDefinition:string|undefined;
      // Closed S0 definitions share bounded presentation slots; paid Native instance IDs stay separate.
      const ghostSlots=new Map(["B06","B07","B05","B09","fp02.comp.small_brace","fp02.device.battery_4kwh","fp02.device.distribution_40kw","fp02.device.pv_pack_2kwp","fp02.device.wind_pack_6kw"].map((definition,index)=>[definition,{id:`ghost:slot_${index}`,revision:0}]));
      const factoryPose=(keys:readonly RepresentationKey[],request:FactoryPlacementRequest):readonly RepresentationTransformSnapshot[]=>{
        if(request.centerMm.length!==3||!request.centerMm.every(Number.isFinite)||!Number.isInteger(request.quarterTurns)||request.quarterTurns<0||request.quarterTurns>3)throw new Error("Invalid Factory projection pose");
        return keys.map(key=>({representationKey:key,positionRelative:{x:request.centerMm[0]!/1000,y:request.centerMm[1]!/1000,z:request.centerMm[2]!/1000},orientation:{x:0,y:Math.sin(request.quarterTurns*Math.PI/4),z:0,w:Math.cos(request.quarterTurns*Math.PI/4)},scale:{x:1,y:1,z:1}}));
      };
      const costFor=(sourceId:string,materialBytes=0):FactoryCost=>{const profile=installationProfiles.createFactoryInstallationProfile(sourceId),boxes=profile.colliders.length;
        return {cpu:boxes*648*3+profile.canonicalJson.length*2+materialBytes*2,mesh:boxes*648*2,triangles:boxes*12,draws:boxes};};
      const admitFactory=()=>{const cost=factoryTotals();admitHvpResources({...ledger,totalCpuBytes:ledger.totalCpuBytes-ledger.factoryCpuBytes+cost.cpu,retainedMeshBytes:ledger.retainedMeshBytes-ledger.factoryMeshBytes+cost.mesh,triangles:ledger.triangles-ledger.factoryTriangles+cost.triangles,drawCalls:ledger.drawCalls-ledger.factoryDraws+cost.draws},caps);};
      // The loader's sealed 25-file census caps every file at 108824 bytes,
      // 3720 vertices / 5580 indices / 24 ranges. Admit transient parsing and
      // both original + backend geometry copies before starting an import.
      const playImportPeak:FactoryCost={cpu:108824*8+(83735+9721)*4+3720*32,mesh:(3720*24+5580*2)*2,triangles:1860,draws:24};
      const playCost=(projection:import("../factory/presentation/playAssetLoader").PlayAssetProjection):FactoryCost=>{
        const bytes=projection.parts.reduce((n,p)=>n+p.artifact.positions.byteLength+(p.artifact.normals?.byteLength??0)+p.artifact.indices.byteLength,0);
        return {cpu:bytes*3+108824*8+(83735+9721)*4,mesh:bytes*2,triangles:projection.parts.reduce((n,p)=>n+p.artifact.indices.length/3,0),draws:projection.parts.reduce((n,p)=>n+p.artifact.materialRanges.length,0)};
      };
      // Include these module-retained closed definitions in every Factory
      // lifetime, including a second session whose compiler cache is warm.
      factoryCosts.set("s1:closed-definitions",{cpu:2*13*32768+(19222+19487+5596+5889)*8,mesh:0,triangles:0,draws:0});admitFactory();
      const refreshFactoryProjection=()=>{
        factoryTransforms=Object.freeze([...factoryScenes.values(),...(ghost?[ghost]:[])].filter(scene=>scene.published).flatMap(scene=>scene.transforms));
        documentPort.body.dataset.hestiaFactoryPresentation=JSON.stringify({sessionId:terrainRoot.read().sessionId,epoch:myEpoch,nativeTick:physics!.read().ticks,
          scenes:[...factoryScenes.values()].map(scene=>({instanceId:scene.id,published:scene.published,assetId:scene.play?.assetId??null,
            glbSha256:scene.play?.glbSha256??null,sourceFileSha256:scene.play?.sourceFileSha256??null,s1:!!scene.s1,modelError:scene.modelError??null,
            visibleKeys:scene.keys.filter(key=>activeFactoryKeys.has(key)),transforms:scene.transforms})),cost:factoryTotals()});
        presentation.updateProjection();
      };
      const dropFactoryScene=(scene:FactoryScene)=>{
        const retired=scene.retiredKeys??=new Set();
        try{for(const artifact of scene.artifacts){const key=artifact.representationKey;if(retired.has(key))continue;
          activeFactoryKeys.delete(key);requireAccepted(presentation.dispatch(createRenderCommand({kind:"RemoveRepresentation",backendRevision:backendRevision(0),representationKey:key,expectedSourceRevision:artifact.sourceRevision,expectedArtifactRevision:artifact.artifactRevision,expectedContentHash:artifact.contentHash})),"Factory retire");
          retired.add(key);const index=plainTerrainLeases.findIndex(value=>value.nodeKey===key);if(index>=0)plainTerrainLeases.splice(index,1)[0]!.lease.release();
        }}catch(error){factoryScenes.set(scene.id,scene);throw Error(`RecoveryHold: Factory retirement unproven: ${String(error)}`);}
        for(const key of scene.keys)managedFactoryKeys.delete(key);if(scene.s1)s1Assets.disposeFactoryS1Assets(scene.s1);factoryCosts.delete(scene.id);factoryScenes.delete(scene.id);
      };
      const stagePlayScene=(id:string,projection:import("../factory/presentation/playAssetLoader").PlayAssetProjection,request:FactoryPlacementRequest):FactoryScene=>{
        const keys=projection.parts.map(part=>part.artifact.representationKey);
        for(const key of keys)managedFactoryKeys.add(key);
        const scene:FactoryScene={id,keys,artifacts:[],transforms:factoryPose(keys,request),published:false,play:projection};
        try{for(const part of projection.parts){const artifact=createMeshArtifact({...part.artifact,frameId:frame});
          requireAccepted(presentation.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),artifact,materialProfiles:part.materialProfiles})),"Play hidden mesh stage");
          scene.artifacts.push(artifact);plainTerrainLeases.push({nodeKey:artifact.representationKey,lease:materialFactory.acquire(part.materialProfiles)});}}
        catch(error){dropFactoryScene(scene);throw error;}return scene;
      };
      const stageFactoryScene=(request:FactoryPlacementRequest,id:string,isGhost:boolean,derivedRevision=1):FactoryScene=>{
        const profile=installationProfiles.createFactoryInstallationProfile(request.definitionSourceId);
        const projection=factoryAssets.createFactoryAssetProjection({...profile.definitionRef,instanceId:id},profile.source);
        const keys=projection.parts.map(part=>part.artifact.representationKey);
        // Hide ALL keys before the first Upsert can publish the projection set.
        for(const key of keys)managedFactoryKeys.add(key);
        const scene:FactoryScene={id,keys,artifacts:[],transforms:factoryPose(keys,request),published:false};
        try{for(const part of projection.parts){const profiles=isGhost?part.materialProfiles.map(value=>createMaterialProfile({...value,id:materialProfileId(`ghost_${value.id}`),baseColor:{r:.05,g:.65,b:.75},opacity:.45,wireframe:true,depthWrite:false})):part.materialProfiles;
          // Source vertices remain local; the admitted +Y transform binds them to this existing Host frame.
          const artifact=createMeshArtifact({...part.artifact,frameId:frame,...(isGhost?{artifactRevision:artifactRevision(derivedRevision),materialRanges:part.artifact.materialRanges.map(range=>({...range,materialProfileId:materialProfileId(`ghost_${range.materialProfileId}`)}))}:{})});
          requireAccepted(presentation.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),artifact,materialProfiles:profiles})),"Factory hidden mesh stage");scene.artifacts.push(artifact);plainTerrainLeases.push({nodeKey:artifact.representationKey,lease:materialFactory.acquire(profiles)});}}
        catch(error){dropFactoryScene(scene);throw error;}return scene;
      };
      const cargoVariants:FactoryScene[]=[];
      let cargoVariantKey="";
      if(initialFactoryCargo){
        const nativeCargo=physics!.read().factoryFacilities?.cargo;
        if(!nativeCargo||nativeCargo.profileDigest!==initialFactoryCargo.profileDigest)throw new Error("Factory Cargo native profile receipt missing");
        const origin=factoryAssets.readFactoryCargoProjectionOrigin(nativeCargo);
        factoryCosts.delete(initialFactoryCargo.ownerId);
        for(const opened of [false,true]){
          const id=`${initialFactoryCargo.ownerId}:${opened?"open":"closed"}`;
          factoryCosts.set(id,playImportPeak);admitFactory();
          const projection=await playAssets.loadPlayAssetProjection({assetId:opened?"play_wreck_cargo_open_v1":"play_wreck_cargo_v1",instanceId:id,signal:factoryAssetAbort.signal,
            expectedBinding:{visualOnlyAnchor:{kind:"visual-only-cargo",ownerId:nativeCargo.ownerId,containerId:nativeCargo.containerId,worldCenterMm:nativeCargo.positionMm,nativeBoundsMm:nativeCargo.site.boundsMm,quantityAuthority:"existing finite cargo readview",opened}}});
          if(!current())throw Error("Factory Cargo import superseded");
          factoryCosts.set(id,playCost(projection));admitFactory();
          cargoVariants.push(stagePlayScene(id,projection,{transactionId:id,instanceId:id,definitionSourceId:"Cargo",centerMm:origin,quarterTurns:0}));
        }
      }
      const stageCarrierScene=async(native:import("../hestia-prototype/physics/factoryFacilitySession").FactoryNativeCarrierRead|undefined):Promise<FactoryScene>=>{
        if(!native||!Number.isSafeInteger(carrierProjectionRevision+1))throw Error("Carrier projection unavailable");
        carrierProjectionRevision++;
        const profile=handlingProfiles.readCargoHandlingProfile(playCatalog,native.profileId);
        if(!profile||profile.digest!==native.profileDigest||profile.massMg!==native.massMg)throw Error("Carrier render profile binding mismatch");
        const kind=profile.sizeMm[0]===500?"light":profile.sizeMm[2]===1500?"heavy":"medium";
        const projection=await playAssets.loadPlayAssetProjection({assetId:`play_carrier_${kind}_v1`,instanceId:`carrier:slot:${carrierProjectionRevision}`,signal:factoryAssetAbort.signal,
          expectedBinding:{visualOnlyAnchor:{kind:"visual-only-carrier",owner:"existing Native carrier",profileSizeMm:profile.sizeMm,quantityAuthority:"closed CargoHandlingProfile and active custody readview"}}});
        if(!current())throw Error("Carrier import superseded");
        factoryCosts.set("carrier:slot",playCost(projection));admitFactory();
        return stagePlayScene("carrier:slot",projection,{transactionId:native.transactionId,instanceId:native.ownerId,definitionSourceId:native.profileId,centerMm:native.positionMm,quarterTurns:1});
      };
      syncCarrierProjection=()=>{
        const native=physics!.read(),cargo=native.factoryFacilities?.cargo,carrier=native.factoryFacilities?.carrier;
        const cargoKey=JSON.stringify([cargo?.profileDigest,cargo?.opened,cargo?.positionMm]);let changed=false;
        if(cargoKey!==cargoVariantKey){cargoVariantKey=cargoKey;changed=true;
          for(const [index,scene] of cargoVariants.entries()){
            scene.published=Boolean(cargo&&cargo.profileDigest===initialFactoryCargo?.profileDigest&&index===(cargo.opened?1:0));
            for(const key of scene.keys)scene.published?activeFactoryKeys.add(key):activeFactoryKeys.delete(key);
            if(scene.published)factoryScenes.set(scene.id,scene);else factoryScenes.delete(scene.id);
          }
        }
        if(carrierScene?.published&&carrier){const key=JSON.stringify(carrier.positionMm);if(key!==carrierPoseKey){carrierPoseKey=key;changed=true;carrierScene.transforms=factoryPose(carrierScene.keys,{transactionId:carrier.transactionId,instanceId:carrier.ownerId,definitionSourceId:carrier.profileId,centerMm:carrier.positionMm,quarterTurns:1});}}
        if(changed)refreshFactoryProjection();
      };
      const playIds:Readonly<Record<string,string>>={B06:"play_cutter_v2",B07:"play_former_v2",B05:"play_workbench_v1",B09:"play_storage_v1",
        "fp02.comp.small_brace":"play_brace_v1","fp06.line.belt_4m":"play_belt_v1","fp02.device.battery_4kwh":"play_battery_v1",
        "fp02.device.distribution_40kw":"play_distribution_v1","fp02.device.pv_pack_2kwp":"play_pv_v1","fp02.device.wind_pack_6kw":"play_wind_v1"};
      const loadInstalledPlay=async(request:FactoryFacilityRequest)=>{
        const assetId=playIds[request.definitionRef.sourceId];if(!assetId)throw Error("Factory definition has no admitted Play model");
        const s1=["B06","B07"].includes(request.definitionRef.sourceId)
          ?await s1Assets.loadFactoryS1Assets({...request.definitionRef,instanceId:request.instanceId},{signal:factoryAssetAbort.signal}):undefined;
        const play=s1?.render??await playAssets.loadPlayAssetProjection({assetId,instanceId:request.instanceId,expectedBinding:{definitionRef:request.definitionRef},signal:factoryAssetAbort.signal});
        if(!current())throw Error("Installed Play import superseded");
        return {play,...(s1?{s1}:{})};
      };
      const admitInstalledImport=(request:FactoryFacilityRequest,baseCpu:number)=>{
        let cellMeshPeak=0;
        if(["B06","B07"].includes(request.definitionRef.sourceId)){
          // These two closed definitions stay cached for the module lifetime.
          // Charge both bounded grids and metadata before the first compiler allocation.
          const cells=partCells.compileFactoryPartCells(request.definitionRef);let faces=0;
          for(const part of cells.parts)for(let z=0;z<part.sizeZ;z++)for(let y=0;y<part.sizeY;y++)for(let x=0;x<part.sizeX;x++){
            const slot=part.readSlot(x,y,z);if(!slot)continue;
            for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])if(part.readSlot(x+dx!,y+dy!,z+dz!)!==slot)faces++;
          }
          // A unit face upper-bounds greedy quads: four position/normal vertices
          // and six Uint32 indices. Cover ordinary Number buffers, typed
          // mesher output, artifact copies and the retained mesh derivative.
          cellMeshPeak=faces*120*6;
        }
        factoryCosts.set(request.instanceId,{...playImportPeak,cpu:baseCpu+playImportPeak.cpu+cellMeshPeak});admitFactory();
      };
      syncInstalledProjection=()=>{
        // No await or external UI data between this private snapshot and sample.
        const snapshot=physics!.read(),facilities=snapshot.factoryFacilities,header=read();
        const domain=factoryHandle?.readFactoryPresentation?.(header);let changed=false;
        for(const scene of factoryScenes.values()){
          if(!scene.play||!scene.request||!scene.published)continue;
          const owner=facilities?.owners.find(o=>o.instanceId===scene.id&&o.sourceDigest===scene.expectedSourceDigest&&o.profileDigest===scene.expectedProfileDigest);
          const native=facilities?.partObservations?.find(p=>p.instanceId===scene.id);
          let poses=scene.play.parts.map(p=>({partId:p.partId,translationM:[0,0,0] as readonly number[]}));
          try{
            if(!owner)poses=[];
            else if(scene.s1){
              const machine=domain?.machines.find(m=>m.instanceId===scene.id);if(!native||!machine||!domain)throw Error("Current Native/domain machine read unavailable");
              const work={...machine,sessionId:domain.sessionId,epoch:domain.epoch,publicationRevision:domain.publicationRevision,nativeTick:domain.nativeTick,catalogDigest:domain.catalogDigest,
                terrainRevision:domain.terrainRevision,facilityRevision:domain.facilityRevision,confirmed:domain.confirmed&&machine.confirmed&&snapshot.status==="Running"};
              const pose=s1Assets.sampleFactoryS1Assets(scene.s1,{sessionId:header.sessionId,epoch:header.epoch,nativeTick:snapshot.ticks,terrainRevision:header.terrain.revision,
                facilityRevision:facilities!.revision,currentPhysicsSnapshot:snapshot,native:{sessionId:header.sessionId,epoch:header.epoch,nativeTick:snapshot.ticks,rawObservation:native},work});
              if(pose.status!=="FAULT"&&pose.partPoses.length)scene.safePose={jobId:work.jobId,partPoses:pose.partPoses};
              // Empty HeldPose suppresses motion, while current Native presence
              // independently permits an intact paused machine's static view.
              const present=new Set(native.confirmed&&native.published?native.parts.filter(p=>p.status==="Present"&&p.colliderHandles.length).map(p=>p.partId):[]);
              for(const [child,parent] of Object.entries(scene.s1.cells.semanticParents))if(!present.has(parent))present.delete(child);
              const safe=scene.safePose?.jobId===work.jobId?scene.safePose.partPoses:poses;
              poses=safe.filter(p=>present.has(p.partId)).map(p=>({partId:p.partId,translationM:p.translationM}));
            }else if(scene.request.definitionSourceId==="B09"){
              const present=new Set(native?.confirmed&&native.published?native.parts.filter(p=>p.status==="Present"&&p.colliderHandles.length).map(p=>p.partId):[]);
              poses=poses.filter(p=>present.has(p.partId));
            }
            scene.modelError=null;
          }catch(error){scene.modelError=String(error);poses=[];}
          const transforms=factoryAssets.createFactoryPartTransforms(scene.play.parts,owner??scene.request,poses);
          if(JSON.stringify(transforms)!==JSON.stringify(scene.transforms)){scene.transforms=transforms;changed=true;}
          const shown=new Set(transforms.map(t=>t.representationKey));
          for(const key of scene.keys){const wanted=shown.has(key);if(wanted!==activeFactoryKeys.has(key)){changed=true;wanted?activeFactoryKeys.add(key):activeFactoryKeys.delete(key);}}
        }
        if(changed)refreshFactoryProjection();
      };
      const construction:FactoryNativeConstructionPort=Object.freeze({
        openCargo:async()=>{const native=physics!.read(),cargo=native.factoryFacilities?.cargo;if(!cargo||!physics!.openFactoryCargo||!nativeFactoryConfirmed())throw new Error("Factory Cargo host unavailable");await physics!.openFactoryCargo({ownerId:cargo.ownerId,profileDigest:cargo.profileDigest,expectedTerrainRevision:native.terrainGeneration,expectedRevision:native.factoryFacilities!.revision});publishFactoryView!();},
        readFacts:()=>{const native=physics!.read(),view=read(),position=native.player?.position;
          if(!position)throw new Error("Factory requires the actual native player");
          return {binding:{sessionId:view.sessionId,epoch:view.epoch,terrainRevision:view.terrain.revision,sourceDigest:view.terrain.sourceDigest,baseDigest:view.terrain.baseDigest,facilityRevision:native.factoryFacilities?.revision??0},
            cargoAccess:native.factoryFacilities?.cargo,
            ...(native.factoryFacilities?.carrier?.phase==="Deposited"?{buildDepot:{containerId:native.factoryFacilities.carrier.containerId,profileId:native.factoryFacilities.carrier.profileId,profileDigest:native.factoryFacilities.carrier.profileDigest,accessible:native.factoryFacilities.carrier.accessible===true,bodyHandle:native.factoryFacilities.carrier.bodyHandle}}:{}),
            actor:{actorId:"hvp_player",ownerId:"fp02_wreck_owner",positionMm:[position.x*1000,position.y*1000,position.z*1000],canBuild:confirmed(true)&&["Running","Paused"].includes(native.status)},
            terrain:{cellMm:125,originMm:[view.terrain.originMeters.x*1000,view.terrain.originMeters.y*1000,view.terrain.originMeters.z*1000],size:[view.terrain.sizeX,view.terrain.sizeY,view.terrain.sizeZ],readSlot:(x:number,y:number,z:number)=>hostPort.readTerrainSlot(x,y,z)}};},
        prepareNative:async(input:FactoryFacilityRequest)=>{if(!current()||!physics!.prepareFactoryFacility)throw new Error("Native Factory capability missing");
          const request=deepFreezeMetadata(JSON.parse(JSON.stringify(input)) as FactoryFacilityRequest),binding=read();
          const estimate=costFor(request.definitionRef.sourceId,request.materialBinding.length),native=physics!.read();
          let loaded:Awaited<ReturnType<typeof loadInstalledPlay>>|undefined;
          try{admitInstalledImport(request,estimate.cpu+native.collisionBytes*2+(native.colliderCount+native.bodyCount)*2048);loaded=await loadInstalledPlay(request);const cost=playCost(loaded.play);factoryCosts.set(request.instanceId,{...cost,cpu:cost.cpu+(loaded.s1?.cost.cpu??0)+estimate.cpu+native.collisionBytes*2+(native.colliderCount+native.bodyCount)*2048});admitFactory();
            const receipt=await physics!.prepareFactoryFacility(request);factoryStages.set(request.transactionId,{request,binding,prepared:receipt,...loaded});return receipt;}
          catch(error){if(loaded?.s1)s1Assets.disposeFactoryS1Assets(loaded.s1);factoryCosts.delete(request.instanceId);throw error;}},
        commitNative:async(id:string)=>{if(!physics!.commitFactoryFacility)throw new Error("Native Factory capability missing");await physics!.commitFactoryFacility(id);},
        publishNative:(id:string)=>{if(!physics!.publishFactoryFacility)throw new Error("Native Factory capability missing");const stage=factoryStages.get(id);
          if(stage?.request.consumedCustody&&carrierScene)stage.consumedProjection={scene:carrierScene,published:carrierScene.published,activeKeys:carrierScene.keys.filter(key=>activeFactoryKeys.has(key)),registered:factoryScenes.has(carrierScene.id)};
          physics!.publishFactoryFacility(id);if(stage?.consumedProjection){carrierScene!.published=false;for(const key of carrierScene!.keys)activeFactoryKeys.delete(key);refreshFactoryProjection();}},
        rollbackNative:async(id:string)=>{if(!physics!.rollbackFactoryFacility)throw new Error("Native Factory capability missing");await physics!.rollbackFactoryFacility(id);},
        finalizeNative:async(id:string)=>{if(!physics!.finalizeFactoryFacility)throw new Error("Native Factory capability missing");await physics!.finalizeFactoryFacility(id);if(factoryStages.get(id)?.request.consumedCustody&&carrierScene){factoryScenes.delete(carrierScene.id);dropFactoryScene(carrierScene);carrierScene=undefined;refreshFactoryProjection();}},
        stageProjection:async(plan:FactoryPlacementPlan)=>{const stage=factoryStages.get(plan.request.transactionId);if(!stage||stage.request.instanceId!==plan.installation.instanceId||stage.request.profileDigest!==plan.profile.profileDigest)throw new Error("Factory staged identity mismatch");
          const now=read(),held=stage.prepared,owner=held.prepared,prepared=held.preparedPartObservation;
          // The client intentionally withholds PreparedHeld from its public
          // snapshot. Use this private transaction's actual prepare-RPC read.
          if(!current()||now.sessionId!==stage.binding.sessionId||now.epoch!==stage.binding.epoch||now.nativeTick!==stage.binding.nativeTick
            ||now.terrain.revision!==stage.binding.terrain.revision||now.terrain.sourceDigest!==stage.binding.terrain.sourceDigest||now.terrain.baseDigest!==stage.binding.terrain.baseDigest
            ||held.state!=="PreparedHeld"||held.transactionId!==stage.request.transactionId||held.revision!==stage.request.expectedRevision
            ||stage.request.expectedTerrainRevision!==now.terrain.revision||!owner||owner.instanceId!==stage.request.instanceId
            ||owner.ownerId!==stage.request.ownerId||owner.transactionId!==stage.request.transactionId
            ||factoryCanonicalJson(owner.definitionRef)!==factoryCanonicalJson(stage.request.definitionRef)||owner.profileDigest!==plan.profile.profileDigest||owner.sourceDigest!==plan.profile.sourceDigest
            ||factoryCanonicalJson(owner.centerMm)!==factoryCanonicalJson(plan.request.centerMm)||owner.quarterTurns!==plan.request.quarterTurns
            ||factoryCanonicalJson(stage.request.centerMm)!==factoryCanonicalJson(plan.request.centerMm)||stage.request.quarterTurns!==plan.request.quarterTurns
            ||stage.request.definitionRef.sourceId!==plan.request.definitionSourceId||owner.materialBinding!==stage.request.materialBinding)throw Error("Factory private prepared receipt binding mismatch");
          if(["B06","B07","B09"].includes(plan.request.definitionSourceId)){
            if(!prepared||prepared.instanceId!==owner.instanceId||prepared.published||!prepared.confirmed||!prepared.complete||prepared.installationRevision!==owner.installationRevision
              ||prepared.terrainRevision!==now.terrain.revision||prepared.facilityRevision!==held.revision||prepared.profileDigest!==plan.profile.profileDigest||prepared.sourceDigest!==plan.profile.sourceDigest
              ||factoryCanonicalJson(prepared.definitionRef)!==factoryCanonicalJson(owner.definitionRef))throw Error("Factory hidden Native geometry unconfirmed");
            const {observationDigest,...proof}=prepared;if(observationDigest!==factoryCanonicalSignature(proof))throw Error("Factory hidden Native observation digest mismatch");
            const expectedParts=plan.profile.source.parts.map(part=>({partId:part.partId,status:"Present",colliderHandles:plan.profile.colliders.flatMap((box,index)=>box.partId===part.partId?[owner.colliderHandles[index]]:[])}));
            if(owner.colliderHandles.length!==plan.profile.colliders.length||new Set(owner.colliderHandles).size!==owner.colliderHandles.length
              ||factoryCanonicalJson(prepared.parts)!==factoryCanonicalJson(expectedParts))throw Error("Factory hidden Native part geometry binding mismatch");
          }
          if(!stage.play)throw Error("Factory Play model not loaded");stage.scene=stagePlayScene(plan.installation.instanceId,stage.play,plan.request);stage.scene.request=plan.request;stage.scene.s1=stage.s1;
          stage.scene.expectedSourceDigest=plan.profile.sourceDigest;stage.scene.expectedProfileDigest=plan.profile.profileDigest;},
        publishProjection:(plan:FactoryPlacementPlan)=>{const stage=factoryStages.get(plan.request.transactionId),scene=stage?.scene;if(!scene)throw new Error("Factory projection not prepared");
          scene.published=true;for(const key of scene.keys)activeFactoryKeys.add(key);factoryScenes.set(scene.id,scene);syncInstalledProjection();refreshFactoryProjection();},
        rollbackProjection:(id:string)=>{const stage=factoryStages.get(id);if(!stage)throw new Error("Factory rollback stage missing");if(stage.scene){factoryScenes.delete(stage.scene.id);dropFactoryScene(stage.scene);}else{if(stage.s1)s1Assets.disposeFactoryS1Assets(stage.s1);factoryCosts.delete(stage.request.instanceId);}
          if(stage.consumedProjection){const saved=stage.consumedProjection;carrierScene=saved.scene;carrierScene.published=saved.published;for(const key of carrierScene.keys)activeFactoryKeys.delete(key);for(const key of saved.activeKeys)activeFactoryKeys.add(key);if(saved.registered)factoryScenes.set(carrierScene.id,carrierScene);}
          refreshFactoryProjection();factoryStages.delete(id);},
        finalizeProjection:(id:string)=>{if(!factoryStages.get(id)?.scene?.published)throw new Error("Factory finalize scene missing");factoryStages.delete(id);},
        projectGhost:(request:FactoryPlacementRequest|null)=>{
          if(request&&ghost&&ghostDefinition===request.definitionSourceId){ghost.transforms=factoryPose(ghost.keys,request);refreshFactoryProjection();return;}
          const slot=request?ghostSlots.get(request.definitionSourceId):undefined;
          if(request&&(!slot||!Number.isSafeInteger(slot.revision+1)))throw new Error("Factory ghost slot unavailable or revision exhausted");
          if(request)factoryPose([],request);
          if(ghost){dropFactoryScene(ghost);ghost=undefined;ghostDefinition=undefined;refreshFactoryProjection();}if(!request)return;
          const id=slot!.id;factoryCosts.set(id,costFor(request.definitionSourceId));try{admitFactory();slot!.revision++;ghost=stageFactoryScene(request,id,true,slot!.revision);ghostDefinition=request.definitionSourceId;ghost.published=true;for(const key of ghost.keys)activeFactoryKeys.add(key);refreshFactoryProjection();}catch(error){factoryCosts.delete(id);throw error;}},
        dispose:()=>{factoryAssetAbort.abort();for(const scene of cargoVariants)if(!factoryScenes.has(scene.id))dropFactoryScene(scene);if(carrierScene&&!factoryScenes.has(carrierScene.id))dropFactoryScene(carrierScene);carrierScene=undefined;syncCarrierProjection=()=>{};syncInstalledProjection=()=>{};for(const stage of factoryStages.values())if(stage.scene&&!factoryScenes.has(stage.scene.id))dropFactoryScene(stage.scene);for(const scene of factoryScenes.values())dropFactoryScene(scene);if(ghost)dropFactoryScene(ghost);
          ghost=undefined;ghostDefinition=undefined;factoryScenes.clear();factoryStages.clear();factoryCosts.clear();factoryTransforms=[];presentation.updateProjection();}
      });
      const handling:FactoryNativeHandlingPort=Object.freeze({
        read:()=>{if(!current())throw Error("Factory Host disposed");const value=physics!.read().factoryFacilities;if(!value)throw Error("Factory Native authority unavailable");return value;},
        prepare:async(request:FactoryCarrierRequest,operation:"pickup"|"deposit"|"release")=>{
          if(!physics!.prepareFactoryCarrier)throw Error("Factory carrier unavailable");
          const native=physics!.read(),captureKey=`carrier:capture:${request.transactionId}`;
          if(operation==="pickup")factoryCosts.set("carrier:slot",playImportPeak);
          factoryCosts.set(captureKey,{cpu:request.materialBinding.length*2+native.collisionBytes*2+(native.colliderCount+native.bodyCount)*2048,mesh:0,triangles:0,draws:0});
          try{admitFactory();carrierCaptureCostKey=captureKey;}catch(error){factoryCosts.delete(captureKey);if(operation==="pickup")factoryCosts.delete("carrier:slot");throw error;}
          try{const prepared=await physics!.prepareFactoryCarrier(request,operation);carrierOperation=operation;if(operation==="pickup")carrierScene=await stageCarrierScene(prepared.carrier);return prepared;}
          catch(error){if(carrierOperation===operation){try{await physics!.rollbackFactoryCarrier!(request.transactionId);carrierOperation=undefined;}catch(rollback){throw Error(`RecoveryHold: Carrier projection rollback: ${String(error)}; ${String(rollback)}`);}}
            if(!String(error).includes("RecoveryHold")){factoryCosts.delete(captureKey);carrierCaptureCostKey=undefined;if(operation==="pickup")factoryCosts.delete("carrier:slot");}throw error;}
        },
        commit:async(id:string)=>{if(!physics!.commitFactoryCarrier)throw Error("Factory carrier unavailable");await physics!.commitFactoryCarrier(id);},
        publish:(id:string)=>{if(!physics!.publishFactoryCarrier)throw Error("Factory carrier unavailable");physics!.publishFactoryCarrier(id);if(carrierOperation==="pickup"){if(!carrierScene)throw Error("RecoveryHold: Missing carrier projection");carrierScene.published=true;for(const key of carrierScene.keys)activeFactoryKeys.add(key);factoryScenes.set(carrierScene.id,carrierScene);carrierPoseKey="";syncCarrierProjection();}else if(carrierOperation==="release"&&carrierScene){
          try{factoryScenes.delete(carrierScene.id);dropFactoryScene(carrierScene);carrierScene=undefined;refreshFactoryProjection();}catch(error){throw Error(`RecoveryHold: Published carrier retirement unproven: ${String(error)}`);}}},
        rollback:async(id:string)=>{if(!physics!.rollbackFactoryCarrier)throw Error("Factory carrier unavailable");await physics!.rollbackFactoryCarrier(id);if(carrierOperation==="pickup"&&carrierScene){dropFactoryScene(carrierScene);carrierScene=undefined;refreshFactoryProjection();}if(carrierCaptureCostKey)factoryCosts.delete(carrierCaptureCostKey);carrierCaptureCostKey=undefined;carrierOperation=undefined;},
        finalize:async(id:string)=>{if(!physics!.finalizeFactoryCarrier)throw Error("Factory carrier unavailable");await physics!.finalizeFactoryCarrier(id);if(carrierCaptureCostKey)factoryCosts.delete(carrierCaptureCostKey);carrierCaptureCostKey=undefined;carrierOperation=undefined;publishFactoryView!();}
      });
      const pauseForFactoryFocus=()=>{
        factoryFocusPauseDepth++;playerInput!.stop();
        void physics!.command("Pause").then(()=>{if(!current())return;factoryFocusPauseDepth--;publishFactoryView!();},
          error=>{if(!current())return;factoryFocusPauseDepth--;factoryInputError=String(error);publishFactoryView!();});
      };
      const hostPort: FactoryHostPort = Object.freeze({ current, read,construction,handling,
        setPanelFocus:(panel:FactoryUiPanel|null)=>{
          if(!current()||factoryFocusedPanel===panel)return;
          const wasBlocked=factoryPanelFocused();factoryFocusedPanel=panel;
          if(!wasBlocked&&factoryPanelFocused())pauseForFactoryFocus();
        },
        setSurface:(surface:FactoryHostSurface|null,binding:Readonly<{sessionId:string;epoch:number}>)=>{
          if(!current()||binding.sessionId!==terrainRoot.read().sessionId||binding.epoch!==myEpoch||factorySurface===surface)return;
          const wasBlocked=factoryPanelFocused();factorySurface=surface;
          if(!wasBlocked&&factoryPanelFocused())pauseForFactoryFocus();
        },
        play:()=>{
          if(!current()||!factoryCanResume())return Promise.reject(new Error("Factory host busy, hidden or unconfirmed"));
          // The invoking click still owns user activation. Release our sole input guard before requesting lock.
          factorySurface=null;factoryFocusedPanel=null;factoryInputError=null;inspectEnabled=false;camera!.setMode("Orbit");
          const activation=playerInput!.start();
          return activation.then(result=>{
            if(!current())throw new Error("Factory host disposed or superseded");
            if(result.status!=="Playing"){factoryInputError=result.reason??"Play not confirmed";publishFactoryView!();throw new Error(factoryInputError);}
            return publishFactoryView!();
          });
        },
        recoverSimulationHold:async()=>{
          if(!factoryRecoveryAvailable()||factoryHandle?.canRecoverSimulationHold?.()!==true)throw Error("Factory SimulationHold recovery unavailable");
          const expectedTick=physics!.read().ticks;factoryRecoveryPending=true;factoryInputError=null;playerInput!.stop();let acknowledged=false;
          try{
            await factoryHandle!.recoverSimulationHold!(async()=>{
              if(!current()||documentPort.hidden||saveBusy||saveHold||!confirmed(true)||physics!.read().status!=="SimulationHold"||physics!.read().ticks!==expectedTick)throw Error("Factory SimulationHold recovery unavailable");
              await physics!.recoverFactorySimulationHold!(expectedTick);acknowledged=true;
            });
            factoryRecoveryPending=false;return publishFactoryView!();
          }catch(error){
            let unchangedHold=false;try{unchangedHold=physics!.read().status==="SimulationHold";}catch{/* Keep the fence on an unknown Native reply. */}
            factoryRecoveryPending=acknowledged||!unchangedHold;factoryInputError=String(error);
            if(current())publishFactoryView!();throw error;
          }
        },
        endSession,
        readTerrainSlot: (x: number, y: number, z: number) => {
          if (!current()) throw new Error("Factory host disposed or superseded");
          const root = terrainRoot.read();
          if (![x,y,z].every(Number.isSafeInteger) || x < 0 || y < 0 || z < 0
            || x >= root.sizeX || y >= root.sizeY || z >= root.sizeZ) return undefined;
          return root.readSlot(x,y,z);
        },
        subscribeConfirmed: (listener: (view: FactoryHostView) => void) => {
          if (!current()) throw new Error("Factory host disposed or superseded");
          factoryListeners.add(listener); return () => { factoryListeners.delete(listener); };
        },
        pause: async () => {
          if (!current()) throw new Error("Factory host disposed or superseded");
          playerInput!.stop(); await physics!.command("Pause");
          return publishFactoryView!();
        },
        resume: async () => {
          if (!current() || !factoryCanResume()) throw new Error("Factory host busy, hidden or unconfirmed");
          await physics!.command("Resume"); return publishFactoryView!();
        } });
      factoryMount = overrides.factoryExtension(hostPort);
      factoryHandle = await factoryMount;
      if (!current()) { await dispose(); return Object.freeze({ dispose }); }
      publishFactoryView();
    }

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
          supportCandidate=undefined;supportView={state:"Stale",cells:0,massKg:0,fragments:0,message:"Terrain revision changed"};
          documentPort.body.dataset.hestiaPrototypeSupport=JSON.stringify(supportView);
          if(supportPreviewVisible){showCutPreview([],false);}
        }
        documentPort.body.dataset.hestiaPrototypeTool=JSON.stringify(plasmaTool!.read());
         const state = physics!.read();
         publishFactoryView?.();
         dormancy!.update();
         documentPort.body.dataset.hestiaPrototypeBodyResidency=JSON.stringify({...dormancy!.read(),parkedRenderOwners:[...parkedRenderOwners],
           derivedMeshCacheBytes:[...fragmentEntries.values()].filter(e=>parkedRenderOwners.has(e.ownerId)).reduce((n,e)=>n+e.mesh.positions.byteLength+e.mesh.normals.byteLength+e.mesh.indices.byteLength+(e.mesh.colors?.byteLength??0),0)});
        if(state.player&&(state.player.status!=="Inspection"||state.neighbor?.resident||state.neighborPinned)){
          neighbor!.update(state.player.position.x,state.neighborPinned);
        }
        documentPort.body.dataset.hestiaPrototypeNeighbor=JSON.stringify(neighbor!.read());
        documentPort.body.dataset.hestiaPrototypePhysics = JSON.stringify(state);
        documentPort.body.dataset.hestiaPrototypePhysicsClock = JSON.stringify(physics!.clock??null);
        if(overrides.factoryExtension)documentPort.body.dataset.hestiaFactoryInputTransport=JSON.stringify(physics!.lifecycle?.().factoryInput??null);
        documentPort.body.dataset.hestiaPrototypeStructure = JSON.stringify(state.structural);
        if (state.ticks !== physicsTick || playerInput!.active) {
          physicsTick = state.ticks;
          syncPhysicsTransforms();
          presentation.updateProjection();
        }
        hud!.updatePhysics();
        hideFactoryLegacyHud();
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
