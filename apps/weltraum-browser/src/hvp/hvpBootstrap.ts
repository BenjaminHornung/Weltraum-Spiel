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
import {encodeHvpGame,HVP_SAVE_PROFILES,type HvpDecodedGame} from "../hestia-prototype/persistence/gameCheckpoint";
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
import type { HvpCollisionSector, HvpCollisionSource } from "../hestia-prototype/physics/terrainColliders";
import { fnv1aHash } from "../core/hash";
import { ThreeRenderBackend } from "../render/three/backend";
import { ThreeMaterialFactory, type ThreeMaterialLease } from "../render/three/backend/threeMaterialFactory";
import {
  artifactRevision,
  type BackendRevision,
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
  type FrameProjectionSnapshot,
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
import { buildHvpPlant, estimateHvpVegetationSourceBytes, isHvpPlantHabitat, meshHvpVegetation, planHvpVegetation, projectHvpVegetation, HVP_VEGETATION_VERSION,
  type HvpPlantSource, type HvpVegetationProduct } from "../hestia-prototype/presentation/vegetation";
import { countFactoryDecorFaces, createFactoryDecorFootprints, createFactoryDecorProjection, estimateFactoryDecorFootprintBytes,
  factoryDecorFaceBytes, factoryDecorFootprintGeometryMatchesOwners, factoryDecorFootprintsMatchOwners,
  factoryDecorHullFootprintFromNativeSectors,
  type FactoryDecorFootprints, type FactoryDecorHullFootprint, type FactoryDecorInstallationBounds } from "../factory/presentation/factoryDecorProjection";
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
  type HvpFactorySourceVersion,
  type HvpCoastSourceSnapshot,
  type HvpPreparedCoastSource,
  type HvpWaterMask
} from "./hvpCoastSource";
import { readFactorySourceColumnWorld, readFactorySourceColumnWorldV2, readFactorySourceColumnWorldV3,
  readFactorySourceColumnWorldV4, readFactorySourceColumnWorldV5 } from "../factory/fixtures/startSite";
import { readFactorySourceColumnWorldV6 } from "../factory/fixtures/startSiteV6";
import {
  HVP_COAST_MESH_ALGORITHM_VERSION,
  HVP_FARFIELD_MESH_ALGORITHM_VERSION,
  HVP_WATER_MESH_ALGORITHM_VERSION,
  meshHvpFarField,
  meshHvpJoinRing,
  meshHvpWaterMask,
  meshHvpOccupancy,
  type HvpCompactMesh,
  type HvpMeshOccupancy
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

type FactoryColdRestore = Readonly<{
  decoded: import("../factory/persistence/factoryCheckpoint").FactoryDecodedCheckpoint;
  owner: import("../factory/persistence/factoryCheckpoint").FactorySessionCheckpointV2;
  metadata: Readonly<{ recordRevision: number; payloadBytes: number }>;
}>;
type FactoryColdStore = Readonly<{
  initialize(): Promise<void>;
  list(): Promise<Readonly<{ slots: readonly Readonly<{ slotId: string; recordRevision: number }>[] }>>;
  load(retainedCpuBytes?: number): Promise<FactoryColdRestore>;
  save(value: import("../factory/persistence/factoryCheckpoint").FactoryStoredCheckpoint, expectedRevision: number | null,
    beforeCommit?: () => void): Promise<Readonly<{ metadata: Readonly<{ recordRevision: number }>; envelope: import("../persistence").SaveGameEnvelopeV1 }>>;
  close(): Promise<void>;
}>;

const HVP_JOIN_REPRESENTATION_KEY = "hvp:join";
const HVP_FAR_REPRESENTATION_KEY = "hvp:far";
const FACTORY_HULL_METADATA_CPU_BYTES=42_578;
const FACTORY_HULL_PROJECTION_CPU_PEAK_BYTES=1_073_548*2+41_208+70_144+1_523_808*3+703_296+219_792+703_296+219_792+329_688;
const FACTORY_HULL_RENDER_MESH_PEAK_BYTES=1_523_808*2;
const FACTORY_HULL_TRIANGLES=19_536;
const FACTORY_HULL_DRAWS=8;
const factorySourceReaders:Readonly<Record<HvpFactorySourceVersion,FactorySourceProfile["readColumn"]>>=Object.freeze({
  "hvp-factory-startsite-v1":readFactorySourceColumnWorld,
  "hvp-factory-startsite-v2":readFactorySourceColumnWorldV2,
  "hvp-factory-startsite-v3":readFactorySourceColumnWorldV3,
  "hvp-factory-startsite-v4":readFactorySourceColumnWorldV4,
  "hvp-factory-startsite-v5":readFactorySourceColumnWorldV5,
  "hvp-factory-startsite-v6":readFactorySourceColumnWorldV6
});
const factorySourceProfileFor=(version:HvpFactorySourceVersion):FactorySourceProfile=>({version,readColumn:factorySourceReaders[version]});

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
  updateCameraProjection(): void;
  releaseProjectionReference(): void;
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
  let acceptedProjection: FrameProjectionSnapshot | undefined;
  let acceptedProjectionBackendRevision: BackendRevision | undefined;
  const releaseProjectionReference = (): void => {
    acceptedProjection = undefined;
    acceptedProjectionBackendRevision = undefined;
  };
  const sameVector = (left: { readonly x: number; readonly y: number; readonly z: number },
    right: { readonly x: number; readonly y: number; readonly z: number }): boolean =>
    Object.is(left.x, right.x) && Object.is(left.y, right.y) && Object.is(left.z, right.z);
  const sameQuaternion = (left: { readonly x: number; readonly y: number; readonly z: number; readonly w: number },
    right: { readonly x: number; readonly y: number; readonly z: number; readonly w: number }): boolean =>
    Object.is(left.x, right.x) && Object.is(left.y, right.y) && Object.is(left.z, right.z) && Object.is(left.w, right.w);
  const sameProjectionCore = (left: FrameProjectionSnapshot, right: FrameProjectionSnapshot): boolean =>
    left.frameId === right.frameId
      && sameVector(left.cameraPositionRelative, right.cameraPositionRelative)
      && sameQuaternion(left.cameraOrientation, right.cameraOrientation)
      && left.projectionParameters.kind === right.projectionParameters.kind
      && Object.is(left.projectionParameters.verticalFovDegrees, right.projectionParameters.verticalFovDegrees)
      && Object.is(left.projectionParameters.aspect, right.projectionParameters.aspect)
      && Object.is(left.projectionParameters.near, right.projectionParameters.near)
      && Object.is(left.projectionParameters.far, right.projectionParameters.far)
      && left.representationTransforms.length === right.representationTransforms.length
      && left.representationTransforms.every((transform, index) => {
        const other = right.representationTransforms[index];
        return other !== undefined && transform.representationKey === other.representationKey
          && sameVector(transform.positionRelative, other.positionRelative)
          && sameQuaternion(transform.orientation, other.orientation)
          && sameVector(transform.scale, other.scale);
      });
  const sameProjectionCamera = (snapshot: FrameProjectionSnapshot, camera: HvpProjectionCamera): boolean =>
    snapshot.projectionParameters.kind === "Perspective"
      && sameVector(snapshot.cameraPositionRelative, camera.position)
      && sameQuaternion(snapshot.cameraOrientation, camera.orientation)
      && Object.is(snapshot.projectionParameters.verticalFovDegrees, camera.verticalFovDegrees)
      && Object.is(snapshot.projectionParameters.aspect, camera.aspect)
      && Object.is(snapshot.projectionParameters.near, camera.near)
      && Object.is(snapshot.projectionParameters.far, camera.far);

  const publishCurrentSet = (): void => {
    if (deferInitialProjection) { return; }
    const current = framesByRepresentation.values().next().value ?? lastFrameId;
    if (current === undefined) return;
    const started=onTiming?performance.now():0;
    try {
      for (const candidate of framesByRepresentation.values()) {
        if (candidate !== current) throw new Error("HVP representations must share one projection frame.");
      }
      projectionRevision += 1;
      const camera = readCamera();
      const keys = [...framesByRepresentation.keys()];
      const revision = backend.readDiagnostics().backendRevision;
      const objectTransforms = new Map(readObjectTransforms().map((transform) => [transform.representationKey, transform]));
      const snapshot = createFrameProjectionSnapshot({
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
      });
      if (acceptedProjectionBackendRevision !== revision || acceptedProjection === undefined
        || !sameProjectionCore(acceptedProjection, snapshot)) {
        const result = backend.dispatch(createRenderCommand({ kind: "ApplyFrameProjection", backendRevision: revision, snapshot }));
        requireAccepted(result, "HVP frame projection");
        if (result.status === "Accepted") {
          acceptedProjection = snapshot;
          acceptedProjectionBackendRevision = revision;
        } else {
          // AlreadyApplied does not prove this exact frozen object is backend-owned.
          releaseProjectionReference();
        }
      }
      const isVisible = (key: RepresentationKey): boolean => (waterEnabled || (key !== waterRepresentationKey && !key.startsWith(`${waterRepresentationKey}:`))) && isRepresentationVisible(key);
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
    } catch (error) {
      releaseProjectionReference();
      throw error;
    }
  };

  const publishCameraUpdate = (): void => {
    deferInitialProjection = false;
    const current = framesByRepresentation.values().next().value ?? lastFrameId;
    if (current === undefined) return;
    try {
      for (const candidate of framesByRepresentation.values()) {
        if (candidate !== current) throw new Error("HVP representations must share one projection frame.");
      }
      const revision = backend.readDiagnostics().backendRevision;
      const camera = readCamera();
      if (acceptedProjectionBackendRevision !== revision || acceptedProjection === undefined
        || !sameProjectionCamera(acceptedProjection, camera)) {
        publishCurrentSet();
      }
    } catch (error) {
      releaseProjectionReference();
      throw error;
    }
  };

  const dispatch = (command: RenderCommand): RenderCommandResult => {
    // Commands crossing this adapter can change backend ownership or state that
    // the local projection core cannot prove unchanged.
    releaseProjectionReference();
    const started=onTiming&&command.kind==="UpsertMeshArtifact"?performance.now():0;
    try {
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
    } catch (error) {
      releaseProjectionReference();
      throw error;
    }
  };

  return Object.freeze({
    dispatch,
    updateProjection: () => { deferInitialProjection = false; publishCurrentSet(); },
    updateCameraProjection: publishCameraUpdate,
    releaseProjectionReference,
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
  const factoryLogicalCameraReserveBytes = overrides.factoryExtension ? 16 * 1024 : 0;
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
  let logicalFactoryCamera: THREE.PerspectiveCamera | undefined;
  let camera: ReturnType<typeof createHvpCamera> | undefined;
  let hud: ReturnType<typeof createHvpHud> | undefined;
  let physics: HvpPhysicsClient | undefined;
  let playerInput: ReturnType<typeof createHvpPlayerInput> | undefined;
  let applyFactoryDecorProjection:(()=>void)|undefined;
  let factoryMount: Promise<FactoryHostExtensionHandle> | undefined;
  let factoryHandle: FactoryHostExtensionHandle | undefined;
  const factoryListeners = new Set<(view: FactoryHostView) => void>();
  let factoryFocusedPanel:FactoryUiPanel|null=null,factorySurface:FactoryHostSurface|null=null;
  let factoryFocusPauseDepth=0,factoryRecoveryPending=false,factoryInputError:string|null=null;
  const factoryPausePending=()=>factoryFocusPauseDepth>0||factoryRecoveryPending;
  const factoryPanelFocused=()=>factoryFocusedPanel!==null||factorySurface!==null;
  const factoryBlocked = () => factoryHandle !== undefined && !factoryHandle.isQuiescent();
  let publishFactoryView: ((deferInstalledProjection?: boolean) => FactoryHostView) | undefined;
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
  let factorySaveStore:FactoryColdStore|undefined;
  let factorySaveStoreInitialized=false;
  let cleanupFactoryPresentation:(()=>void)|undefined;
  let factoryAssetController:AbortController|undefined;
  let factoryPlayAssets:typeof import("../factory/presentation/playAssetLoader")|undefined;
  let releasePresentationProjectionReference:(()=>void)|undefined;
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
  let fatalFactoryDecorationError: Error | undefined;
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
      await attempt(()=>cleanupFactoryPresentation?.());cleanupFactoryPresentation=undefined;
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
      await attempt(()=>factorySaveStore?.close());factorySaveStore=undefined;factorySaveStoreInitialized=false;
      physics = undefined;
      await attempt(()=>hud?.dispose());
      hud = undefined;
      await attempt(()=>camera?.dispose());
      camera = undefined;
      logicalFactoryCamera=undefined;
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
        await attempt(()=>releasePresentationProjectionReference?.());
        releasePresentationProjectionReference=undefined;
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
    let vegetation: readonly HvpVegetationProduct[]=[];
    let plantSources: readonly HvpPlantSource[]=[];
    let factoryDecorFootprints:FactoryDecorFootprints|undefined;
    const vegetationArtifactRevisions=new Map<string,number>();
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
    const factoryProfileCacheReserveBytes=512*1024;
    const factoryFrameProjectionReferenceReserveBytes=512*1024;
    const factoryTotals=()=>[...factoryCosts.values()].reduce((a,b)=>({cpu:a.cpu+b.cpu,mesh:a.mesh+b.mesh,triangles:a.triangles+b.triangles,draws:a.draws+b.draws}),
      {cpu:factoryProfileCacheReserveBytes+factoryFrameProjectionReferenceReserveBytes+factoryLogicalCameraReserveBytes,mesh:0,triangles:0,draws:0});
    let branchProducts:readonly HvpBranchProduct[]=[];
    let activePreviewKey="";
    const presentation = createHvpPresentationBackend(backend, () => ({
      position: (logicalFactoryCamera ?? backend!.camera).position,
      orientation: (logicalFactoryCamera ?? backend!.camera).quaternion,
      verticalFovDegrees: (logicalFactoryCamera ?? backend!.camera).fov,
      aspect: (logicalFactoryCamera ?? backend!.camera).aspect,
      near: (logicalFactoryCamera ?? backend!.camera).near,
      far: (logicalFactoryCamera ?? backend!.camera).far
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
    releasePresentationProjectionReference=presentation.releaseProjectionReference;

    const frame = frameId(HVP_FRAME_ID);
    const caps: HvpResourceCaps = { ...HVP_RESOURCE_CAPS_DEFAULT, ...overrides.resourceCaps };
    admitHvpResources(
      {
        totalCpuBytes: estimateHvpPreflightBytes() + 32 * 1024 * 1024 + factoryLogicalCameraReserveBytes,
        retainedMeshBytes: 0,
        triangles: 0,
        drawCalls: 0
      },
      caps
    );
    startupPhase("startupRendererMs");
    const query=new URLSearchParams(windowPort.location?.search??"");
    const loadQuery=query.get("hvpLoad"),factoryLoadQuery=query.get("factoryLoad");
    if (overrides.factoryExtension && loadQuery !== null) throw new Error("Factory requires a combined checkpoint; legacy load is unavailable");
    if (!overrides.factoryExtension && factoryLoadQuery !== null) throw new Error("Combined Factory checkpoint requires the Factory owner");
    if (factoryLoadQuery !== null && factoryLoadQuery !== "primary") throw new Error("Unknown Factory restore slot");
    if(loadQuery!==null&&loadQuery!=="primary"){throw new Error("Unknown Hestia restore slot");}
    let coldGame:HvpDecodedGame|undefined,coldFactory:FactoryColdRestore|undefined,coldRevision:number|null=null,checkpointSourceBytes=0,coldNeighborAdoptedBytes=0,coldPlantAdoptedBytes=0;
    if(loadQuery==="primary"){
      admitHvpResources({totalCpuBytes:80*1024*1024,retainedMeshBytes:0,triangles:0,drawCalls:0},caps);
      saveStore=createHvpSaveStore();await saveStore.initialize();const record=await saveStore.load();
      coldGame=record.game;coldRevision=record.metadata.recordRevision;
      checkpointSourceBytes=HVP_SOURCE_SLOT_COUNT+coldGame.world.sourceBytes+record.metadata.payloadBytes*4+(coldGame.neighborRoot?HVP_SOURCE_SLOT_COUNT:0);
    }
    let factoryRestore:FactoryColdRestore["decoded"]|undefined,factoryRestoreOwner:FactoryColdRestore["owner"]|undefined;
    if(factoryLoadQuery==="primary"){
      // Loading a combined checkpoint is an exclusive cold phase: there is no retained scene,
      // Native World, or asset staging yet, and the full bounded CPU cap is reserved first.
      const hullLoader=await import("../factory/presentation/playAssetLoader");
      const coldHullMetadataBytes=hullLoader.readLoadedHullMetadataBytes();
      if(!Number.isSafeInteger(coldHullMetadataBytes)||coldHullMetadataBytes<0||coldHullMetadataBytes>FACTORY_HULL_METADATA_CPU_BYTES)
        throw new Error("Factory Hull metadata cache byte count invalid");
      admitHvpResources({totalCpuBytes:256*1024*1024,retainedMeshBytes:0,triangles:0,drawCalls:0},caps);
      const persistence=await import("../factory/persistence/factorySaveStore");
      factorySaveStore=persistence.createFactorySaveStore();
      await factorySaveStore.initialize();factorySaveStoreInitialized=true;
      coldFactory=await factorySaveStore.load(coldHullMetadataBytes);
      factoryRestore=coldFactory.decoded;
      factoryRestoreOwner=coldFactory.owner;
      coldRevision=coldFactory.metadata.recordRevision;
      const [codec,dryFactory,production]=await Promise.all([
        import("../factory/persistence/factoryCheckpoint"),import("../factory/session/dryFactorySlice"),import("../factory/production/recipeAdmission")
      ]);
      const tree=factoryRestore.preflight,units=64*(tree.objectCount+tree.arrayCount)+16*Math.max(0,tree.nodeCount-1);
      const cacheBytes=dryFactory.readDryFactoryCheckpointCacheBytes(factoryRestoreOwner.domain,factoryRestore.material)
        +production.readProductionFactoryCheckpointCacheBytes(factoryRestore.material);
      const ownerImportBytes=codec.readFactoryDecodedOwnerImportBytes(factoryRestore);
      const retainedColdBytes=tree.utf16Bytes+units+ownerImportBytes+cacheBytes+factoryRestore.native.decodedBytes;
      const coldPreparationBytes=2*HVP_SOURCE_SLOT_COUNT+96*1024*1024+factoryProfileCacheReserveBytes+factoryFrameProjectionReferenceReserveBytes
        +factoryLogicalCameraReserveBytes+coldHullMetadataBytes;
      const coldPhaseBytes=retainedColdBytes+coldPreparationBytes;
      if(!Number.isSafeInteger(units)||!Number.isSafeInteger(cacheBytes)||cacheBytes<0||!Number.isSafeInteger(retainedColdBytes)
        ||!Number.isSafeInteger(coldPhaseBytes))throw new Error("Combined Factory cold memory count invalid");
      if(measurement.enabled)measurement.record("factoryColdAdmission",performance.now(),0,{R:0,T:tree.utf16Bytes,U:units,K:cacheBytes,
        D:factoryRestore.decodeWorkingBytes,P:coldFactory.metadata.payloadBytes,oldBound:16*1024*1024,totalBytes:coldPhaseBytes,
        ownerImportBytes,decodedSourceBytes:factoryRestore.native.decodedBytes,baseBytes:HVP_SOURCE_SLOT_COUNT,preparedBaseBytes:HVP_SOURCE_SLOT_COUNT,nativeReserveBytes:96*1024*1024,
        profileCacheReserveBytes:factoryProfileCacheReserveBytes,frameProjectionReferenceReserveBytes:factoryFrameProjectionReferenceReserveBytes,
        logicalCameraReserveBytes:factoryLogicalCameraReserveBytes});
      // Decoder scratch is retired. Count the exact retained payload/source/cache
      // generation plus the separate V5 snapshot, its prepared copy, and full Native96
      // before source preparation, meshing, or World creation.
      admitHvpResources({totalCpuBytes:coldPhaseBytes,retainedMeshBytes:0,triangles:0,drawCalls:0},caps);
      checkpointSourceBytes=retainedColdBytes;
    }
    // A validated saved source owns Continue's terrain/profile selection; the
    // New Game default never upgrades an older checkpoint during restoration.
    const factorySourceProfile=factoryRestore
      ?factorySourceProfileFor(factoryRestore.checkpoint.native.profiles.source)
      :overrides.factorySourceProfile;
    if(overrides.factoryExtension){
      const renderCamera=backend!.camera;
      logicalFactoryCamera=new THREE.PerspectiveCamera(renderCamera.fov,renderCamera.aspect,renderCamera.near,renderCamera.far);
      logicalFactoryCamera.position.copy(renderCamera.position);
      logicalFactoryCamera.quaternion.copy(renderCamera.quaternion);
    }
    let coldWorldCheckpoint=coldGame?.checkpoint.world??factoryRestore?.checkpoint.native.world;
    let coldNativeWorld=coldGame?.world??factoryRestore?.native.world;
    let coldRoot=coldGame?.root??factoryRestore?.native.root;
    let coldBase=coldGame?.base??factoryRestore?.native.base;
    let coldPlants=coldGame?.plants??factoryRestore?.native.plants;
    let coldNeighborRoot=coldGame?.neighborRoot??factoryRestore?.native.neighborRoot;
    let coldReceipts=coldGame?.receipts??factoryRestore?.native.receipts;
    let coldView=coldGame?.view??factoryRestore?.native.view;
    const coldProgress=coldGame?.checkpoint.progress??factoryRestore?.checkpoint.native.progress??null;
    const coldRestore=Boolean(coldGame||factoryRestore);
    let snapshot:HvpCoastSourceSnapshot|undefined=coldBase??await (overrides.createSourceSnapshot?.() ?? materializeHvpCoastSourceAsync());
    if(!snapshot)throw new Error("HVP source snapshot missing");
    const snapshotVersion=snapshot.version;
    if (disposed || hvpMountEpoch !== myEpoch) {
      // Canceled while the source was deferred: publish nothing, schedule
      // nothing, claim neither Ready nor Error.
      return Object.freeze({ dispose });
    }
    if(factorySourceProfile && (!overrides.factoryExtension||!Object.hasOwn(factorySourceReaders,factorySourceProfile.version)||snapshot.version!==factorySourceProfile.version))throw new Error("Factory source/profile binding mismatch");
    if((snapshot.version==="hvp-factory-startsite-v1"||snapshot.version==="hvp-factory-startsite-v2"||snapshot.version==="hvp-factory-startsite-v3"||snapshot.version==="hvp-factory-startsite-v4"||snapshot.version==="hvp-factory-startsite-v5"||snapshot.version==="hvp-factory-startsite-v6")&&!factorySourceProfile)throw new Error("Factory source requires its explicitly bound profile");
    if(factorySourceProfile){
      if(factorySourceProfile.version==="hvp-factory-startsite-v6"){
        factoryAssetController=new AbortController();
        cleanupFactoryPresentation=()=>factoryAssetController?.abort();
      }
      factoryPlayAssets=await import("../factory/presentation/playAssetLoader");
      const loadedMetadataBytes=factoryPlayAssets.readLoadedHullMetadataBytes();
      if(!Number.isSafeInteger(loadedMetadataBytes)||loadedMetadataBytes<0||loadedMetadataBytes>FACTORY_HULL_METADATA_CPU_BYTES)
        throw new Error("Factory Hull metadata cache byte count invalid");
      if(loadedMetadataBytes>0)factoryCosts.set("factory:hull-metadata",{cpu:loadedMetadataBytes,mesh:0,triangles:0,draws:0});
      if(factorySourceProfile.version==="hvp-factory-startsite-v6"){
        factoryCosts.set("factory:hull-metadata",{cpu:FACTORY_HULL_METADATA_CPU_BYTES,mesh:0,triangles:0,draws:0});
        factoryCosts.set("factory:hull-projection",{cpu:FACTORY_HULL_PROJECTION_CPU_PEAK_BYTES,mesh:FACTORY_HULL_RENDER_MESH_PEAK_BYTES,
          triangles:FACTORY_HULL_TRIANGLES,draws:FACTORY_HULL_DRAWS});
      }
    }
    let factoryHullProjection:import("../factory/presentation/playAssetLoader").FactoryHullProjection|undefined;
    let factoryHullRenderProjection:import("../factory/presentation/playAssetLoader").PlayAssetProjection|undefined;
    let factoryHullNativeSectors:readonly HvpCollisionSector[]|undefined;
    let factoryDecorHullFootprint:FactoryDecorHullFootprint|undefined;
    const initialFactoryCargo=factorySourceProfile?(await import("../factory/fixtures/cargoSite")).createFactoryCargoSite(snapshot):undefined;
    if(initialFactoryCargo)factoryCosts.set(initialFactoryCargo.ownerId,{cpu:initialFactoryCargo.canonicalJson.length*16+1944,mesh:1296,triangles:12,draws:1});
    const sourceColumn=factorySourceProfile?.readColumn??readHvpSourceColumnWorld;
    const vegetationProfile=factorySourceProfile?{version:"hvp-factory-vegetation-v1" as const,readColumn:sourceColumn}:undefined;
    const prepared = prepareHvpCoastSource(snapshot);
    startupPhase("startupSourceMs");
    documentPort.body.dataset.hestiaPrototypeSourceRevision = prepared.version;
    documentPort.body.dataset.hestiaPrototypeSeed = prepared.seedName;
    documentPort.body.dataset.hestiaPrototypeSourceDigest = prepared.sourceDigest;
    const terrainRoot = createHvpTerrainOwner(coldRoot??createHvpTerrainRoot(prepared, `hvp-session-${myEpoch}`, myEpoch));
    snapshot=undefined;coldBase=undefined;coldRoot=undefined;
    documentPort.body.dataset.hestiaPrototypeRestoreSource=coldRestore?"artifact":"authored-start";
    let coldEast=coldWorldCheckpoint?.neighbor?.resident?coldNeighborRoot?.read():undefined;
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
    const plannedPlants = coldPlants?coldPlants.map(p=>p.instance):(()=>{
      const planned=planHvpVegetation(undefined,vegetationProfile);
      if(factorySourceProfile?.version!=="hvp-factory-startsite-v2"&&factorySourceProfile?.version!=="hvp-factory-startsite-v3"&&factorySourceProfile?.version!=="hvp-factory-startsite-v4"&&factorySourceProfile?.version!=="hvp-factory-startsite-v5"&&factorySourceProfile?.version!=="hvp-factory-startsite-v6")return planned;
      const invalid=planned.filter(p=>!isHvpPlantHabitat(p.kind,p.position.x,p.position.z,vegetationProfile));
      const removed=invalid[0];
      if(planned.length!==97||invalid.length!==1||removed?.id!=="hvp:flora:bed-52-220"||removed.kind!=="broadleaf"||removed.variant!==1
        ||removed.position.x!==-9.5||removed.position.y!==2.5||removed.position.z!==11.5)throw Error("Factory V2 initial decoration differs from its exact habitat delta");
      // Exact source-derived nonphysical broadleaf delta; all wood/native owners and habitat guards remain intact.
      return Object.freeze(planned.filter(p=>p!==removed));
    })();
    const plants = !coldRestore&&!coldPlants&&factorySourceProfile?.version==="hvp-factory-startsite-v6"?(()=>{
      const heroMatches=plannedPlants.filter(p=>p.id==="hvp:flora:hero");
      const hero=heroMatches[0];
      if(heroMatches.length!==1||hero?.kind!=="tree"||hero.variant!==0||hero.position.x!==8||hero.position.z!==7){
        throw Error("Factory V6 initial hero vegetation binding mismatch");
      }
      return Object.freeze(plannedPlants.filter(p=>p!==hero));
    })():plannedPlants;
    const vegetationSourceBytes = estimateHvpVegetationSourceBytes(plants);
    if (vegetationSourceBytes > 16 * 1024 * 1024) { throw new Error("Vegetation source BudgetExceeded before allocation"); }
    const physicsPrepareBytes = 96 * 1024 * 1024;
    if(factorySourceProfile?.version==="hvp-factory-startsite-v6"){
      if(!factoryPlayAssets||!factoryAssetController||factoryCosts.get("factory:hull-metadata")?.cpu!==FACTORY_HULL_METADATA_CPU_BYTES
        ||factoryCosts.get("factory:hull-projection")?.cpu!==FACTORY_HULL_PROJECTION_CPU_PEAK_BYTES){
        throw new Error("Factory V6 Hull admission reservation missing");
      }
      const hullPreloadLedger=buildHvpResourceLedger({terrainMesh,terrainMeshes:[...initialTerrain.values()],waterMesh:water,joinMesh,farMesh,
        groupedIndexBytes:[...terrainLooks.values()].reduce((n,group)=>n+group.indices.byteLength,0)+joinLook.indices.byteLength+farLook.indices.byteLength,
        drawCalls:[...terrainLooks.values()].reduce((n,group)=>n+group.materialRanges.length,0)+1+joinLook.materialRanges.length+farLook.materialRanges.length,
        checkpointSourceBytes,visualEffects:true});
      const cost=factoryTotals(),baseCpu=hullPreloadLedger.totalCpuBytes+cost.cpu;
      const totalCpuBytes=Math.max(baseCpu+32*1024*1024,baseCpu-hullPreloadLedger.tempEstimateBytes+physicsPrepareBytes);
      const vegetationDrawCalls=plants.reduce((draws,plant)=>draws+(plant.kind==="tree"?2:1),0);
      admitHvpResources({totalCpuBytes,retainedMeshBytes:hullPreloadLedger.retainedMeshBytes+cost.mesh,
        triangles:hullPreloadLedger.triangles+cost.triangles,
        drawCalls:hullPreloadLedger.drawCalls+cost.draws+vegetationDrawCalls+3},caps);
      if(factoryAssetController.signal.aborted||disposed||hvpMountEpoch!==myEpoch)return Object.freeze({dispose});
      const metadata=await factoryPlayAssets.readFactoryHullMetadata();
      const metadataBytes=metadata.metadataCosts.sidecarUtf8Bytes+metadata.metadataCosts.sidecarHashCopyBytes
        +metadata.metadataCosts.sidecarRawUtf16Bytes+metadata.metadataCosts.sidecarParsedUtf16Bytes+metadata.metadataCosts.sidecarParsedGraphBytes;
      if(metadataBytes!==FACTORY_HULL_METADATA_CPU_BYTES)throw new Error("Factory V6 Hull metadata admission changed");
      factoryHullProjection=await factoryPlayAssets.loadFactoryHullProjection({instanceId:"factory_hull:crashsite",signal:factoryAssetController.signal});
      const hullCosts=factoryHullProjection.costs;
      const loadedHullBytes=hullCosts.sourceBytes+hullCosts.sourceSha256CopyBytes+hullCosts.jsonUtf16Bytes+hullCosts.jsonGraphBytes
        +hullCosts.renderScratchBytes+hullCosts.renderArtifactBytes+hullCosts.stagedRenderArtifactBytes+hullCosts.nativeSectorBytes+hullCosts.nativeHashCopyPeakBytes;
      const nativeHashScratch=219_792,collisionDigestScratch=329_688;
      if(loadedHullBytes!==7_752_960||loadedHullBytes+703_296+nativeHashScratch+collisionDigestScratch!==FACTORY_HULL_PROJECTION_CPU_PEAK_BYTES
        ||factoryHullProjection.parts.length!==8||factoryHullProjection.nativeSectors.length!==8
        ||factoryHullProjection.costs.nativeSectorBytes!==703_296||factoryHullProjection.collisionDigest!==metadata.census.nativeCollisionDigest){
        throw new Error("Factory V6 Hull projection cost or geometry binding mismatch");
      }
      factoryHullNativeSectors=factoryHullProjection.nativeSectors;
      factoryDecorHullFootprint=factoryDecorHullFootprintFromNativeSectors(factoryHullNativeSectors);
      if(disposed||hvpMountEpoch!==myEpoch)return Object.freeze({dispose});
    }
    const eastHaloReader = (east: NonNullable<typeof coldEast>) =>
      (x:number,y:number,z:number) => x>=256?east.readSlot(x-256,y,z):undefined;
    const collisionSources: HvpCollisionSource[] = [{...terrainRoot.read(),
      readHaloSlot:coldEast?eastHaloReader(coldEast):undefined}];
    plantSources=coldPlants??plants.map(plant=>buildHvpPlant(plant,vegetationProfile));
    const checkpointSourceBytesBeforePlantAdoption=checkpointSourceBytes;
    const plantGenerationMatchesNative=factoryRestore!==undefined&&coldPlants===factoryRestore.native.plants;
    if(factoryRestore&&plantGenerationMatchesNative){
      let sourceBytes=0;
      for(const plant of plantSources){
        for(const bytes of [plant.wood?.byteLength??0,plant.decoration.byteLength]){
          if(!Number.isSafeInteger(bytes)||bytes<0||!Number.isSafeInteger(sourceBytes+bytes))throw Error("Factory cold plant source byte count invalid");
          sourceBytes+=bytes;
        }
      }
      if(sourceBytes!==vegetationSourceBytes||sourceBytes>factoryRestore.native.decodedBytes||sourceBytes>checkpointSourceBytes){
        throw Error("Factory cold plant source binding mismatch");
      }
      coldPlantAdoptedBytes=sourceBytes;
      checkpointSourceBytes-=coldPlantAdoptedBytes;
    }
    coldPlants=undefined;
    const coldDecorInstallations:FactoryDecorInstallationBounds[]=factorySourceProfile?(factoryRestore?.checkpoint.factory.installations??[]).map(installation=>{
      const native=factoryRestore?.checkpoint.nativeFactory.owners.find(owner=>owner.instanceId===installation.instanceId);
      if(!native||native.definitionRef.sourceId!==installation.definitionSourceId||native.sourceDigest!==installation.sourceDigest
        ||native.profileDigest!==installation.profileDigest||native.quarterTurns!==installation.quarterTurns
        ||native.centerMm.some((value,index)=>value!==installation.centerMm[index])||!Number.isSafeInteger(native.installationRevision)
        ||native.installationRevision<1)throw Error("Factory cold decoration owner binding mismatch");
      return {instanceId:installation.instanceId,boundsMm:installation.boundsMm,
        ownerWitness:JSON.stringify([native.sourceDigest,native.profileDigest,native.definitionRef.sourceId,...native.centerMm,
          native.quarterTurns,native.installationRevision])};
    }):[];
    let offsetBytesEstimate=0,vegetationBaseLedger:ReturnType<typeof buildHvpResourceLedger>|undefined;
    if(factorySourceProfile){
      const footprintBytes=estimateFactoryDecorFootprintBytes(coldDecorInstallations,factoryDecorHullFootprint);
      offsetBytesEstimate=plantSources.filter(source=>source.instance.kind!=="tree").length*22*22*Int16Array.BYTES_PER_ELEMENT;
      vegetationBaseLedger=buildHvpResourceLedger({terrainMesh,terrainMeshes:[...initialTerrain.values()],waterMesh:water,joinMesh,farMesh,
        vegetationSourceBytes,checkpointSourceBytes,groupedIndexBytes:[...terrainLooks.values()].reduce((n,group)=>n+group.indices.byteLength,0)
          +joinLook.indices.byteLength+farLook.indices.byteLength,
        drawCalls:[...terrainLooks.values()].reduce((n,group)=>n+group.materialRanges.length,0)+1+joinLook.materialRanges.length+farLook.materialRanges.length,
        visualEffects:true});
      const existingFactoryCost=factoryTotals(),decorContextBytes=footprintBytes+offsetBytesEstimate;
      const preReaderBaseCpu=vegetationBaseLedger.totalCpuBytes+existingFactoryCost.cpu;
      const preReaderCpu=Math.max(preReaderBaseCpu+decorContextBytes,
        preReaderBaseCpu-vegetationBaseLedger.tempEstimateBytes+decorContextBytes+physicsPrepareBytes);
      if(!Number.isSafeInteger(footprintBytes)||footprintBytes<0||!Number.isSafeInteger(offsetBytesEstimate)||offsetBytesEstimate<0
        ||!Number.isSafeInteger(preReaderCpu)||preReaderCpu<0)throw Error("Factory decoration pre-reader count invalid");
      admitHvpResources({totalCpuBytes:preReaderCpu,retainedMeshBytes:vegetationBaseLedger.retainedMeshBytes+existingFactoryCost.mesh,
        triangles:vegetationBaseLedger.triangles+existingFactoryCost.triangles,
        drawCalls:vegetationBaseLedger.drawCalls+existingFactoryCost.draws},caps);
      factoryDecorFootprints=createFactoryDecorFootprints(coldDecorInstallations,factoryDecorHullFootprint);
      if(factoryDecorFootprints.retainedBytes!==footprintBytes)throw Error("Factory decoration footprint admission changed");
      factoryCosts.set("factory:decor-projection",{cpu:decorContextBytes,mesh:0,triangles:0,draws:0});
    }
    let initialDecorReaders:{occupancy:HvpMeshOccupancy;offsetBytes:number}[]=factorySourceProfile
      ?plantSources.map(source=>{const projection=createFactoryDecorProjection(source,vegetationProfile,factoryDecorFootprints!);
        return {occupancy:projection.occupancy,offsetBytes:projection.offsetBytes};})
      :[];
    if(initialDecorReaders.reduce((bytes,reader)=>bytes+reader.offsetBytes,0)!==offsetBytesEstimate)
      throw Error("Factory decoration offset admission changed");
    const initialDecorCounts=factorySourceProfile?initialDecorReaders.map(reader=>countFactoryDecorFaces(reader.occupancy)):[];
    const projectedDecorBytes={mesh:0,temp:0,triangles:0};
    if(factorySourceProfile){
      const base=vegetationBaseLedger!;
      for(const decor of initialDecorCounts){
        const cost=factoryDecorFaceBytes(decor.exposedFaces,false);
        projectedDecorBytes.mesh+=cost.mesh;projectedDecorBytes.temp+=cost.temp;projectedDecorBytes.triangles+=cost.triangles;
      }
      // Only the new Factory decoration projection has a pre-mesher bound here.
      // Existing wood and ordinary HVP scenes retain their established ledger path.
      const factoryCostWithReaders=factoryTotals();
      const preMeshCpu=Math.max(base.totalCpuBytes+factoryCostWithReaders.cpu+2*projectedDecorBytes.mesh+projectedDecorBytes.temp,
        base.totalCpuBytes-base.tempEstimateBytes+factoryCostWithReaders.cpu+2*projectedDecorBytes.mesh+physicsPrepareBytes);
      const decorDrawCalls=initialDecorCounts.filter(value=>value.occupiedCells>0).length;
      if(!Number.isSafeInteger(preMeshCpu)||preMeshCpu<0||!Number.isSafeInteger(projectedDecorBytes.mesh)||projectedDecorBytes.mesh<0
        ||!Number.isSafeInteger(projectedDecorBytes.temp)||projectedDecorBytes.temp<0)throw Error("Factory decoration mesher count invalid");
      admitHvpResources({totalCpuBytes:preMeshCpu,retainedMeshBytes:base.retainedMeshBytes+factoryCostWithReaders.mesh+projectedDecorBytes.mesh,
        triangles:base.triangles+factoryCostWithReaders.triangles+projectedDecorBytes.triangles,
        drawCalls:base.drawCalls+factoryCostWithReaders.draws+decorDrawCalls},caps);
    }
    vegetation = plantSources.flatMap((source,index) => {
      const plant=source.instance;
      if (source.wood !== null) {
        const wood = source.wood;
        collisionSources.push({ sizeX: wood.sizeX, sizeY: wood.sizeY, sizeZ: wood.sizeZ, cellMeters: wood.cellMeters,
          originMeters: { x: plant.position.x + wood.originMeters.x, y: plant.position.y + wood.originMeters.y, z: plant.position.z + wood.originMeters.z },
          readSlot: (x, y, z) => wood.slotAt(x, y, z) });
      }
      if(!factorySourceProfile)return meshHvpVegetation(source);
      const decor=initialDecorCounts[index]!;
      return meshHvpVegetation(source,undefined,{decoration:initialDecorReaders[index]!.occupancy,
        ...(decor.occupiedCells===0?{omitEmptyDecoration:true}:{})});
    });
    initialDecorReaders=[];
    if(factoryDecorFootprints?.retainedBytes)factoryCosts.set("factory:decor-projection",{cpu:factoryDecorFootprints.retainedBytes,mesh:0,triangles:0,draws:0});
    else factoryCosts.delete("factory:decor-projection");
    startupPhase("startupVegetationMs");
    if(coldEast){collisionSources.push({...coldEast,readHaloSlot:(x,y,z)=>x<0?terrainRoot.read().readSlot(x+256,y,z):undefined});}
    const spawn = coldWorldCheckpoint?.dropSpawn??{ x: -9, y: sourceColumn(-9, -9).topMeters + 2.25, z: -9 };
    const savedDrop=coldNativeWorld?.bodies.find(b=>b.checkpoint.family==="drop"),savedInertia=coldNativeWorld?.bodies.find(b=>b.checkpoint.family==="inertia");
    if(coldRestore&&(!savedDrop||!savedInertia)){throw new Error("Saved prototype specimens missing");}
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
    const salvageScenario=coldRestore?coldWorldCheckpoint?.branch?.kind==="salvage":scenario==="salvage";
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
    const sceneTotalAfterPlantAdoption=Math.max(ledger.totalCpuBytes,ledger.totalCpuBytes-ledger.tempEstimateBytes+physicsPrepareBytes);
    if(factoryRestore&&measurement.enabled){
      const sceneTotalBeforePlantAdoption=Math.max(ledger.totalCpuBytes+coldPlantAdoptedBytes,
        ledger.totalCpuBytes+coldPlantAdoptedBytes-ledger.tempEstimateBytes+physicsPrepareBytes);
      measurement.record("factoryColdPlantAdoption",performance.now(),0,{phase:"scene",plantGenerationMatchesNative,plantSourceBytes:coldPlantAdoptedBytes,
        checkpointSourceBytesBefore:checkpointSourceBytesBeforePlantAdoption,checkpointSourceBytesAfter:checkpointSourceBytes,
        sceneTotalBefore:sceneTotalBeforePlantAdoption,sceneTotalAfter:sceneTotalAfterPlantAdoption,mesherScratchBytes:ledger.tempEstimateBytes,
        nativeReserveBytes:physicsPrepareBytes,capBytes:caps.maxCpuBytes});
    }
    admitHvpResources({ ...ledger,
      totalCpuBytes: sceneTotalAfterPlantAdoption
    }, caps);
    const rockScenario=scenario==="rock-arm";
    // Explicit new-session scenario, never a camera-driven teleport of a live avatar.
    const playerSpawn = coldWorldCheckpoint?.player?.position??(initialFactoryCargo?{x:initialFactoryCargo.spawnMm[0]/1000,y:initialFactoryCargo.spawnMm[1]/1000,z:initialFactoryCargo.spawnMm[2]/1000}:scenario==="east-edge"?{x:7,y:sourceColumn(7,-14).topMeters+.92,z:-14}:rockScenario?{x:7,y:.125+.92,z:-6.25}:salvageScenario?
      {x:-11.8125,y:sourceColumn(-11.8125,-15.25).topMeters+.92,z:-15.25}:{ x: -9, y: sourceColumn(-9, -11).topMeters + 0.92, z: -11 });
    documentPort.body.dataset.hestiaPrototypeScenario=coldRestore?"saved":scenario;
    // Authored dry impulse area behind the start, not the sloping channel bank.
    const inertiaSpawn={x:-9,y:Math.max(...[-9,-8].flatMap(x=>[-13.75,-12.5].map(z=>sourceColumn(x,z).topMeters)))+1.25,z:-13};
    const branchSpawn={x:-12,y:Math.max(...[-12,-11.5].flatMap(x=>[-13.5,-13].map(z=>sourceColumn(x,z).topMeters))),z:-13.5};
    startupPhase("startupAdmissionMs");
    const coldNeighborLod=coldGame?.checkpoint.neighbor?.lod??factoryRestore?.checkpoint.native.neighbor?.lod;
    physics = await (overrides.createPhysics ?? createHvpPhysicsClient)(collisionSources, spawn, physicsAbort.signal, playerSpawn, inertiaSpawn,branchSpawn,coldWorldCheckpoint,salvageScenario?"salvage":"branch",measurement.enabled?measurement.worker:undefined,factorySourceProfile!==undefined,initialFactoryCargo,factoryRestore?.checkpoint.nativeFactory,factoryHullNativeSectors);
    if(factoryHullProjection){
      const {assetId,glbSha256,sourceFileSha256,definitionRef,visualOnlyAnchor,frameId,bounds,parts,visualVariant}=factoryHullProjection;
      factoryHullRenderProjection=Object.freeze({assetId,glbSha256,sourceFileSha256,definitionRef,visualOnlyAnchor,frameId,bounds,parts,
        ...(visualVariant?{visualVariant}:{})});
      factoryHullProjection=undefined;factoryHullNativeSectors=undefined;
      factoryCosts.set("factory:hull-projection",{cpu:1_523_808,mesh:1_523_808,triangles:0,draws:0});
    }
    coldWorldCheckpoint=undefined;coldEast=undefined;collisionSources.length=0;
    startupPhase("startupPhysicsMs");
    if (disposed || hvpMountEpoch !== myEpoch) { await physics.dispose(); physics = undefined; return Object.freeze({ dispose }); }
    const branch=physics.read().structural;
    if (physicsPausedByFocus || documentPort.hidden) { await physics.command("Pause"); }
    if(!branch){throw new Error("Canonical anchored branch is missing from the admitted World");}
    const fixedBranchOwners=new Set(branch.parts.filter(p=>p.anchored).map(p=>p.ownerId));
    branchProducts=meshHvpBranchProducts(branch).filter(p=>!coldRestore||p.decoration||fixedBranchOwners.has(p.ownerId));
    const coldFragments=coldNativeWorld?.bodies.filter(b=>b.checkpoint.family==="terrain"||(b.checkpoint.family==="branch"&&b.checkpoint.dynamic)).map(b=>{
      const cells=readHvpBodyCells(b.recipe.source),mesh=meshHvpBodyCells(cells,b.recipe.mass.centerOfMassMeters!,b.recipe.source.contentHash);
      return {ownerId:b.checkpoint.ownerId,family:b.checkpoint.family as "terrain"|"branch",mesh,cells:cells.length,
        sourceBytes:b.recipe.source.bricks.length*ADAPTIVE_BRICK_ESTIMATED_BYTES,group:createHvpCompactLookTerrain(mesh,look,{allowPartialRoles:true})};
    })??[];
    coldNativeWorld=undefined;
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

    const inputCamera=logicalFactoryCamera??backend.camera;
    camera = createHvpCamera({ camera: inputCamera, canvas, windowPort: windowPort as Window,
      isInputBlocked: () => Boolean(saveBusy||saveHold||playerInput?.active||playerInput?.activationPending||factoryPanelFocused()) });
    playerInput = createHvpPlayerInput(canvas, inputCamera, physics, documentPort as Document, windowPort as Window, () => {
      camera!.reset(); hud!.update("Ready", camera!.readPose(), stats);
    },{confirm:()=>{if (!factoryBlocked()) void plasmaTool?.confirm();},select:mode=>plasmaTool?.select(mode)},()=>saveBusy||saveHold||factoryPanelFocused()||factoryBlocked()||Boolean(dormancy?.read().recoveryHold)||Boolean(overrides.factoryExtension&&!factoryCanResume()),factorySourceProfile!==undefined,overrides.factoryExtension!==undefined);
    if(!coldRestore&&scenario==="east-edge"){playerInput.aimAt({x:48,y:playerSpawn.y+.75,z:-14});}
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
    let saveView={state:coldRestore?"Loaded":"Idle",message:coldRestore?"Started from save – paused":"Local Hestia save",revision:coldRevision};
    let factoryPersistenceState:"Idle"|"Saving"|"Saved"|"Rejected"|"RecoveryHold"=coldRestore?"Saved":"Idle";
    let factoryPersistenceMessage=coldRestore?"Combined checkpoint loaded and paused":"No Factory checkpoint saved";
    let factorySlotAvailable=Boolean(coldFactory),factorySaveAdmissionReady=false;
    let plantCheckpoints:ReturnType<typeof encodeHvpPlant>[]|undefined;
    let salvage=salvageScenario?createHvpSalvageLoop(terrainRoot.read().sessionId,coldProgress??undefined):undefined;
    const observeSalvage=()=>{
      if(!salvage){return;}
      const s=physics!.read();salvage.observe({ticks:s.ticks,status:s.status,terrainTransaction:s.terrainTransaction,movingState:s.moving.state,
        player:s.player,branch:s.structural??null,lastImpulse:s.lastImpulse,lastImpulseTick:s.lastImpulseTick});
      documentPort.body.dataset.hestiaPrototypeSalvage=JSON.stringify(salvage.read());
    };
    const currentView=()=>({camera:camera!.checkpoint(),...playerInput!.checkpoint(),tool:plasmaTool!.checkpoint(),waterEnabled,aoEnabled});
    const restoreView=(view:ReturnType<typeof currentView>)=>{
      playerInput!.restore(view);camera!.restore(view.camera);inspectEnabled=!overrides.factoryExtension&&view.camera.mode==="Fly";plasmaTool!.restore(view.tool);
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
    if(coldRestore){
      if(!coldReceipts)throw new Error("Saved Hestia receipts missing");
      terrainConsumer!.restoreReceipts(coldReceipts.terrain);structuralConsumer!.restoreReceipts(coldReceipts.structural);bodyCutConsumer!.restoreReceipts(coldReceipts.moving);
      coldReceipts=undefined;
      if(coldNeighborRoot){
        if(coldNeighborLod===undefined)throw new Error("Saved neighbour LOD binding missing");
        await neighbor!.initialize(coldNeighborRoot,coldNeighborLod);
        // The decoded B grid is handed to the controller (or released when
        // dormant); it is no longer an additional checkpoint-owned copy.
        const adoptedNeighborBytes=factoryRestore?HVP_SOURCE_SLOT_COUNT+(coldNeighborRoot?.read().overlayBytes??0):HVP_SOURCE_SLOT_COUNT;
        coldNeighborAdoptedBytes=adoptedNeighborBytes;
        checkpointSourceBytes-=adoptedNeighborBytes;
        ledger={...ledger,checkpointSourceBytes,totalCpuBytes:ledger.totalCpuBytes-adoptedNeighborBytes};
        coldNeighborRoot=undefined;
      }
      if(!coldView)throw new Error("Saved Hestia view missing");
      restoreView(coldView);syncPhysicsTransforms();presentation.updateProjection();updateTerrainState();
      coldView=undefined;
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
          if(saveBusy||saveHold)return;
          playerInput!.stop();
          camera!.setPreset(preset);
          if(preset==="C07-QUARRY") { void physics!.command("Pause");playerInput!.aimAt({x:-10.5,y:1,z:-9}); }
          hud!.update("Ready", camera!.readPose(), stats);
        },
        resetCamera: () => {
          if(saveBusy||saveHold)return;
          playerInput!.stop();
          camera!.reset();
          hud!.update("Ready", camera!.readPose(), stats);
        },
        readWaterEnabled: () => waterEnabled,
        setWaterEnabled: (enabled: boolean) => {
          if(saveBusy||saveHold)return;
          waterEnabled = enabled;
          presentation.setWaterEnabled(enabled);
          documentPort.body.dataset.hestiaPrototypeWater = enabled ? "on" : "off";
        },
        readInspectEnabled: () => inspectEnabled,
        setInspectEnabled: (enabled: boolean) => {
          if(saveBusy||saveHold)return;
          playerInput!.stop();
          inspectEnabled = enabled;
          camera!.setMode(enabled ? "Fly" : "Orbit");
          hud!.update("Ready", camera!.readPose(), stats);
        },
        readAoEnabled: () => aoEnabled,
        setAoEnabled: (enabled: boolean) => {
          if(saveBusy||saveHold)return;
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
        play: () => { if (saveBusy||saveHold||(overrides.factoryExtension && !factoryCanResume())) return; inspectEnabled = false; camera!.setMode("Orbit"); playerInput!.start(); },
        readThirdPerson: () => playerInput!.thirdPerson,
        readAimScreen: () => playerInput!.aimScreen,
        togglePlayerView: () => {if(!saveBusy&&!saveHold)playerInput!.toggleView();},
        readTool:()=>plasmaTool!.read(),
        selectTool:mode=>{if(!saveBusy&&!saveHold)plasmaTool!.select(mode);},
        aimBranch:()=>{
          if(saveBusy||saveHold)return;
          playerInput!.stop();plasmaTool!.select(physics!.read().structural?.cutEdge===1?1:2);
          const target=physics!.read().structural?.aimPoint;
          if(target){playerInput!.aimAt(target);}
          void physics!.command("Pause").catch(error=>{
            if(!disposed&&hvpMountEpoch===myEpoch){documentPort.body.dataset.hestiaPrototypeInputError=String(error);}
          });
        },
        previewSupport:()=>{void previewRockSupport();},
        aimRock:()=>{
          if(saveBusy||saveHold)return;
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
      const factoryHostEpoch=factoryRestore?.checkpoint.host.epoch??myEpoch;
      let factoryProjectionReady=!factoryRestore;
      try{
        if(!factorySaveStore){
          const persistence=await import("../factory/persistence/factorySaveStore");
          factorySaveStore=persistence.createFactorySaveStore();
        }
        if(!factorySaveStoreInitialized){await factorySaveStore.initialize();factorySaveStoreInitialized=true;}
        const slots=await factorySaveStore.list(),slot=slots.slots.find(value=>value.slotId==="factory-primary");
        factorySlotAvailable=slot!==undefined;
        if(!coldRestore)saveRevision=slot?.recordRevision??null;
        if(slot){
          factoryPersistenceState="Saved";
          factoryPersistenceMessage=coldRestore&&slot.recordRevision!==saveRevision
            ?"Loaded checkpoint is older than the saved primary; Save will recheck memory before writing"
            :"Combined Factory checkpoint available; Save checks memory before writing";
        }
        else if(!coldRestore){factoryPersistenceState="Idle";factoryPersistenceMessage="No Factory checkpoint saved; Save checks memory before writing";}
      }catch(error){
        factorySlotAvailable=false;factoryPersistenceState="Rejected";factoryPersistenceMessage=`Factory storage unavailable: ${String(error)}`;
      }
      // An admitted internal command owns the Factory barrier; all native/host holds still apply.
      const nativeFactoryConfirmed=()=>{const native=physics!.read();return confirmed(true)&&(!factoryHandle||factoryProjectionReady)&&!saveBusy&&!saveHold&&(!native.factoryFacilities||native.factoryFacilities.state==="Idle")&&["Running","Paused"].includes(native.status);};
      const factoryRecoveryAvailable=()=>{
        const native=physics!.read(),input=physics!.lifecycle?.().factoryInput;
        return current()&&(!factoryHandle||factoryProjectionReady)&&!documentPort.hidden&&!factoryPausePending()&&!saveBusy&&!saveHold&&confirmed(true)&&!factoryBlocked()
          &&!!physics!.recoverFactorySimulationHold&&!!factoryHandle?.recoverSimulationHold
          &&native.status==="SimulationHold"&&native.factoryFacilities?.state==="Idle"&&native.terrainTransaction==="Idle"
          &&native.neighborTransaction==="Idle"&&native.bodyResidencyTransaction==="Idle"&&native.moving.state==="Idle"
          &&(!native.structural||native.structural.state==="Idle")&&!playerInput!.active&&!playerInput!.activationPending
          &&!!input&&input.enabled&&!input.closing&&input.commandDepth===0&&input.pendingIds.length===0
          &&input.desiredLevel.x===0&&input.desiredLevel.z===0&&!input.desiredLevel.sprint&&!input.desiredLevel.jump;
      };
      const retainedSaveCpuBytes=()=>Math.max(0,ledger.totalCpuBytes-ledger.tempEstimateBytes+physics!.collisionBytes*2
        +Math.max(0,factoryTotals().cpu-ledger.factoryCpuBytes));
      const factorySaveAvailable=()=>{
        if(!factorySaveAdmissionReady||!factorySaveStore||!factorySaveStoreInitialized||!current()||(factoryHandle&&!factoryProjectionReady)||documentPort.hidden||saveBusy||saveHold||factoryPausePending()
          ||!confirmed(true)||playerInput!.active||playerInput!.activationPending||factoryInputError!==null)return false;
        const native=physics!.read(),facilities=native.factoryFacilities,input=physics!.lifecycle?.().factoryInput,compiler=terrainCompiler!.diagnostics();
        return native.status==="Paused"&&facilities?.state==="Idle"&&facilities.transactionId===null
          &&facilities.prepared===null&&native.terrainTransaction==="Idle"&&native.neighborTransaction==="Idle"
          &&native.bodyResidencyTransaction==="Idle"&&native.moving.state==="Idle"&&(!native.structural||native.structural.state==="Idle")
          &&!!input&&input.enabled&&!input.closing&&input.commandDepth===0&&input.pendingIds.length===0
          &&input.desiredLevel.x===0&&input.desiredLevel.z===0&&!input.desiredLevel.sprint&&!input.desiredLevel.jump
          &&compiler.runningJobs===0&&compiler.queue===0;
      };
      const factoryContinueAvailable=()=>Boolean(factorySaveStore&&factorySaveStoreInitialized&&factorySlotAvailable&&current()&&(!factoryHandle||factoryProjectionReady)&&!documentPort.hidden&&!saveBusy&&!saveHold);
      const read = (): FactoryHostView => {
        if (!current()) throw new Error("Factory host disposed or superseded");
        const root = terrainRoot.read(), native = physics!.read();
        return Object.freeze({ sessionId: root.sessionId, epoch: factoryHostEpoch, nativeTick: native.ticks,
          persistence:Object.freeze({state:factoryPersistenceState,message:factoryPersistenceMessage,revision:saveRevision,
            saveAvailable:factorySaveAvailable(),continueAvailable:factoryContinueAvailable()}),
          simulationRecoveryAvailable:factoryRecoveryAvailable(),
          physicsStatus: native.status, confirmed: confirmed() && (!factoryHandle||factoryProjectionReady) && !saveBusy && !saveHold && !factoryPausePending() && (!native.factoryFacilities||native.factoryFacilities.state==="Idle") && ["Running", "Paused"].includes(native.status),
          input:Object.freeze({active:playerInput!.active,activationPending:playerInput!.activationPending,pointerLocked:(documentPort as Document).pointerLockElement===canvas,
            pausePending:factoryPausePending(),focusedPanel:factoryFocusedPanel,surface:factorySurface,error:factoryInputError}),
          terrain: Object.freeze({ epoch: root.epoch, revision: root.revision, sourceDigest: root.sourceDigest,
            baseDigest: root.baseDigest, profileVersion:factorySourceProfile?snapshotVersion as NonNullable<FactoryHostView["terrain"]["profileVersion"]>:undefined, cellMeters: root.cellMeters, originMeters: root.originMeters,
            sizeX: root.sizeX, sizeY: root.sizeY, sizeZ: root.sizeZ }) });
      };
      let syncCarrierProjection=()=>{};
      let syncInstalledProjection:(deferProjection?:boolean)=>void=()=>{};
      publishFactoryView = (deferInstalledProjection=false) => {
        const carrierStarted=measurement.enabled?performance.now():0;
        try{syncCarrierProjection();}finally{if(measurement.enabled)measurement.record("factoryCarrierProjection",carrierStarted,performance.now()-carrierStarted,{calls:1});}
        const view = read();
        let listenerIndex=0;
        for (const listener of factoryListeners){
          const listenerStarted=measurement.enabled?performance.now():0;
          try{listener(view);}finally{if(measurement.enabled)measurement.record("factoryPublishListener",listenerStarted,performance.now()-listenerStarted,{calls:1,index:listenerIndex});}
          listenerIndex++;
        }
        const installedStarted=measurement.enabled?performance.now():0;
        try{syncInstalledProjection(deferInstalledProjection);}finally{if(measurement.enabled)measurement.record("factoryInstalledProjection",installedStarted,performance.now()-installedStarted,{calls:1});}
        return view;
      };
      readFactoryView = read;
      const factoryAssetAbort=factoryAssetController??new AbortController();
      factoryAssetController=factoryAssetAbort;
      cleanupFactoryPresentation=()=>factoryAssetAbort.abort();
      const factoryAssets=await import("../factory/presentation/factoryAssets");
      const playAssets=factoryPlayAssets??await import("../factory/presentation/playAssetLoader");
      factoryPlayAssets=playAssets;
      const loadedHullMetadataBytes=playAssets.readLoadedHullMetadataBytes();
      if(!Number.isSafeInteger(loadedHullMetadataBytes)||loadedHullMetadataBytes<0||loadedHullMetadataBytes>FACTORY_HULL_METADATA_CPU_BYTES)
        throw new Error("Factory Hull metadata cache byte count invalid");
      if(loadedHullMetadataBytes>0&&!factoryCosts.has("factory:hull-metadata"))
        factoryCosts.set("factory:hull-metadata",{cpu:loadedHullMetadataBytes,mesh:0,triangles:0,draws:0});
      const s1Assets=await import("../factory/presentation/factoryS1Assets");
      const partCells=await import("../factory/presentation/factoryPartCells");
      const handlingProfiles=await import("../factory/construction/cargoHandlingProfile");
      const factoryCatalog=(await import("../factory/catalog/fp02Catalog"));
      const playCatalog=factoryCatalog.loadFactoryCatalog(factoryCatalog.createFp02CatalogInput());
      const factoryMaterialView=(await import("../factory/presentation/factoryMaterialProjection"));
      const factoryPlayBatch=(await import("../factory/presentation/batchPlayParts"));
      const installationProfiles=await import("../factory/construction/installationProfile");
      if(installationProfiles.FACTORY_RUNTIME_INSTALLATION_PROFILE_CACHE_RESERVE_BYTES!==factoryProfileCacheReserveBytes)throw new Error("Factory runtime profile cache reserve mismatch");
      const factoryStorageProfile=installationProfiles.readRuntimeFactoryInstallationProfile("B09");
      type HvpCurrentPhysicsSnapshot=ReturnType<HvpPhysicsClient["read"]>;
      type FactoryDecorDomainRead=ReturnType<NonNullable<FactoryHostExtensionHandle["readFactoryPresentation"]>>;
      type FactoryMaterialView=import("../factory/presentation/factoryMaterialProjection").FactoryMaterialProjection;
      type FactoryProjectionPose=Readonly<{instanceId:string;definitionSourceId:string;centerMm:readonly number[];quarterTurns:number}>;
      type FactoryScene={id:string;keys:readonly RepresentationKey[];artifacts:MeshArtifact[];transforms:readonly RepresentationTransformSnapshot[];published:boolean;
        play?:import("../factory/presentation/playAssetLoader").PlayAssetProjection;
        request?:FactoryProjectionPose;s1?:import("../factory/presentation/factoryS1Assets").FactoryS1Assets;
        nativeOwnerId?:string;materialAssetId?:string;materialPacketId?:string;materialFamily?:"cables"|"lots"|"packets";
        expectedSourceDigest?:string;expectedProfileDigest?:string;retiredKeys?:Set<RepresentationKey>;
        safePose?:Readonly<{jobId:string|null;partPoses:import("../factory/presentation/machinePose").MachinePose["partPoses"]}>;modelError?:string|null};
      const factoryScenes=new Map<string,FactoryScene>();
      const factoryMaterialTemplates=new Map<string,import("../factory/presentation/playAssetLoader").PlayAssetProjection>();
      const factoryMaterialTemplateAssetIds=Object.freeze(["play_cable_link_v1","play_cable_end_v1","play_steel_v1","play_semi_v1","play_profile_v1","play_sheet_v1","play_offcut_v1"] as const);
      let factoryMaterialDesired:{key:string;view:FactoryMaterialView}|undefined;
      let factoryMaterialAcceptedKey="",factoryMaterialWorker:Promise<void>|undefined,factoryMaterialGeneration=0;
      let factoryMaterialAcceptedFamilies:{cables:string;lots:string;packets:string;key:string;cableRoutes:readonly string[];
        lotPlacements:readonly string[];lotPlacementBindings:readonly (readonly [string,string])[]}=
        {cables:"",lots:"",packets:"",key:"",cableRoutes:Object.freeze([]),lotPlacements:Object.freeze([]),lotPlacementBindings:Object.freeze([])};
      let factoryMaterialSummary:Readonly<Record<string,unknown>>=Object.freeze({links:[],lots:[],packets:[]});
      const factoryMaterialScenes=new Map<string,FactoryScene>();
      const factoryStorageInspectionScenes=new Map<string,FactoryScene>();
      const factoryStorageInspectionLoading=new Set<string>(),factoryStorageInspectionVisible=new Set<string>();
      let factoryStorageInspectionGeneration=0;
      let factoryDecorAttemptBinding:string|undefined;
      let factoryDecorBackendDispatchPending=false;
      const failFactoryDecorClosed=(error:unknown,resource:"decoration"|"material"="decoration"):never=>{
        const failure=new Error(`RecoveryHold: Factory ${resource} renderer publication failed: ${String(error)}`);
        fatalFactoryDecorationError=failure;
        void dispose().finally(()=>{
          if(hvpMountEpoch===myEpoch){failureRoot?.remove();failureRoot=presentHvpFailure(documentPort,failure);}
        }).catch(()=>{});
        throw failure;
      };
      const updateFactoryDecorProjection=()=>{
        try{presentation.updateProjection();factoryDecorBackendDispatchPending=false;}
        catch(error){if(factoryDecorBackendDispatchPending)failFactoryDecorClosed(error);throw error;}
      };
      applyFactoryDecorProjection=updateFactoryDecorProjection;
      const admitFactoryDecor=(candidate:Parameters<typeof admitHvpResources>[0]):boolean=>{
        try{admitHvpResources(candidate,caps);return true;}
        catch(error){
          if(error instanceof Error&&error.message.startsWith("HVP scene BudgetExceeded:")){
            documentPort.body.dataset.hestiaPrototypeDecorationAdmission=error.message;return false;
          }
          throw error;
        }
      };
      const factoryStages=new Map<string,{request:FactoryFacilityRequest;binding:FactoryHostView;prepared:import("../hestia-prototype/physics/factoryFacilitySession").FactoryFacilityRead;captureCostKey:string;scene?:FactoryScene;play?:import("../factory/presentation/playAssetLoader").PlayAssetProjection;s1?:import("../factory/presentation/factoryS1Assets").FactoryS1Assets;consumedProjection?:{scene:FactoryScene;published:boolean;activeKeys:readonly RepresentationKey[];registered:boolean}}>();
      let carrierScene:FactoryScene|undefined,carrierProjectionRevision=0,carrierPoseKey="",carrierOperation:"pickup"|"deposit"|"release"|undefined,carrierCaptureCostKey:string|undefined;
      let factoryHullScene:FactoryScene|undefined;
      let ghost:FactoryScene|undefined;
      let ghostDefinition:string|undefined;
      // Closed S0 definitions share bounded presentation slots; paid Native instance IDs stay separate.
      const ghostSlots=new Map(["B06","B07","B05","B09","fp02.comp.small_brace","fp02.device.battery_4kwh","fp02.device.distribution_40kw","fp02.device.pv_pack_2kwp","fp02.device.wind_pack_6kw"].map((definition,index)=>[definition,{id:`ghost:slot_${index}`,revision:0}]));
      const factoryPose=(keys:readonly RepresentationKey[],request:Pick<FactoryProjectionPose,"centerMm"|"quarterTurns">):readonly RepresentationTransformSnapshot[]=>{
        if(request.centerMm.length!==3||!request.centerMm.every(Number.isFinite)||!Number.isInteger(request.quarterTurns)||request.quarterTurns<0||request.quarterTurns>3)throw new Error("Invalid Factory projection pose");
        return keys.map(key=>({representationKey:key,positionRelative:{x:request.centerMm[0]!/1000,y:request.centerMm[1]!/1000,z:request.centerMm[2]!/1000},orientation:{x:0,y:Math.sin(request.quarterTurns*Math.PI/4),z:0,w:Math.cos(request.quarterTurns*Math.PI/4)},scale:{x:1,y:1,z:1}}));
      };
      const costFor=(sourceId:string,materialBytes=0):FactoryCost=>{const profile=installationProfiles.createFactoryInstallationProfile(sourceId),boxes=profile.colliders.length;
        return {cpu:boxes*648*3+profile.canonicalJson.length*2+materialBytes*2,mesh:boxes*648*2,triangles:boxes*12,draws:boxes};};
      const admitFactory=()=>{
        const cost=factoryTotals(),memory=factoryHandle?.readFactoryCheckpointMemory?.();
        if(factoryHandle&&!memory)throw Error("Factory committed-owner memory telemetry unavailable");
        if(memory&&(!Number.isSafeInteger(memory.cacheBytes)||memory.cacheBytes<0))throw Error("Factory committed-owner cache count invalid");
        const tree=memory?.treeMetrics,units=tree?64*(tree.objectCount+tree.arrayCount)+16*Math.max(0,tree.nodeCount-1):0;
        const ownerBytes=tree?tree.utf16Bytes+units+(memory?.cacheBytes??0):0;
        if(!Number.isSafeInteger(ownerBytes)||ownerBytes<0)throw Error("Factory committed-owner memory count invalid");
        const retained=estimateHvpStageCpuBytes(ledger,ledger,0,physicsPrepareBytes)-ledger.factoryCpuBytes+cost.cpu;
        const totalCpuBytes=retained+ownerBytes;
        const cacheBreakdown=memory?.cacheBreakdown;
        if(measurement.enabled)measurement.record("factoryStageAdmission",performance.now(),0,{R:retained-physicsPrepareBytes,T:tree?.utf16Bytes??0,
          U:units,K:memory?.cacheBytes??0,D:null,P:null,oldBound:16*1024*1024,totalBytes:totalCpuBytes,nativeReserveBytes:physicsPrepareBytes,cacheBreakdown,
          profileCacheReserveBytes:factoryProfileCacheReserveBytes,frameProjectionReferenceReserveBytes:factoryFrameProjectionReferenceReserveBytes,
          logicalCameraReserveBytes:factoryLogicalCameraReserveBytes});
        admitHvpResources({...ledger,totalCpuBytes,
          retainedMeshBytes:ledger.retainedMeshBytes-ledger.factoryMeshBytes+cost.mesh,
          triangles:ledger.triangles-ledger.factoryTriangles+cost.triangles,drawCalls:ledger.drawCalls-ledger.factoryDraws+cost.draws},caps);
      };
      // The loader's sealed 30-file census caps every file at 108824 bytes,
      // 3720 vertices / 5580 indices / 24 ranges. Admit transient parsing and
      // both original + backend geometry copies before starting an import.
      const playColorBytes=3720*3*Float32Array.BYTES_PER_ELEMENT;
      const playImportPeak:FactoryCost={cpu:108824*8+(83735+9721+10782+5520+14007)*4+3720*32+playColorBytes*3,
        mesh:(3720*(24+3*Float32Array.BYTES_PER_ELEMENT)+5580*2)*2,triangles:1860,draws:24};
      const playCost=(projection:import("../factory/presentation/playAssetLoader").PlayAssetProjection):FactoryCost=>{
        const bytes=projection.parts.reduce((n,p)=>n+p.artifact.positions.byteLength+(p.artifact.normals?.byteLength??0)+p.artifact.indices.byteLength+(p.artifact.attributes?.color?.byteLength??0),0);
        return {cpu:bytes*3+108824*8+(83735+9721+10782+5520+14007)*4,mesh:bytes*2,triangles:projection.parts.reduce((n,p)=>n+p.artifact.indices.length/3,0),draws:projection.parts.reduce((n,p)=>n+p.artifact.materialRanges.length,0)};
      };
      const materialTemplateItem:Readonly<Record<string,string>>=Object.freeze({play_steel_v1:"fp02.bulk.steel_known",play_semi_v1:"fp02.bulk.steel_semi",
        play_profile_v1:"fp02.bulk.steel_profile",play_sheet_v1:"fp02.bulk.steel_sheet",play_offcut_v1:"fp02.bulk.steel_offcut"});
      const materialExpectedBinding=(assetId:string):import("../factory/presentation/playAssetLoader").PlayExpectedBinding=>{
        if(assetId==="play_cable_link_v1"||assetId==="play_cable_end_v1")return {visualOnlyAnchor:{kind:"visual-only-cable",itemId:"fp02.comp.field_cable",
          quantityAuthority:"installed_cable routeMm from confirmed paid job",deformation:"only approved route; visual scale cannot add length, ports, mass or material"}};
        const itemId=materialTemplateItem[assetId],item=playCatalog.items.find(value=>value.sourceId===itemId);
        if(!item||!itemId)throw Error("Factory material template catalog binding missing");
        return {visualOnlyAnchor:{kind:"visual-only-material",itemId,catalogDigest:playCatalog.catalogDigest,
          quantityAuthority:"existing unique actual lot custody; never a quantity encoded by triangles",
          itemRef:{sourceId:item.sourceId,version:item.version,digest:item.digest}}};
      };
      const loadFactoryMaterialTemplates=async(assetIds:ReadonlySet<string>)=>{
        for(const assetId of factoryMaterialTemplateAssetIds){
          if(!assetIds.has(assetId)||factoryMaterialTemplates.has(assetId))continue;
          const importKey=`factory:material:template-import:${assetId}`,templateKey=`factory:material:template:${assetId}`;
          factoryCosts.set(importKey,playImportPeak);
          try{
            admitFactory();
            const projection=await playAssets.loadPlayAssetProjection({assetId,instanceId:`factory:material-template:${assetId}`,signal:factoryAssetAbort.signal,
              expectedBinding:materialExpectedBinding(assetId),renderMode:"vertex-colors"});
            if(!current())throw Error("Factory material template import superseded");
            const bytes=projection.parts.reduce((n,part)=>n+              +part.artifact.positions.byteLength+(part.artifact.normals?.byteLength??0)+part.artifact.indices.byteLength+(part.artifact.attributes?.color?.byteLength??0),0);
            if(!Number.isSafeInteger(bytes)||bytes<=0)throw Error("Factory material template geometry count invalid");
            factoryCosts.delete(importKey);factoryCosts.set(templateKey,{cpu:bytes+4096,mesh:0,triangles:0,draws:0});
            admitFactory();factoryMaterialTemplates.set(assetId,projection);
          }catch(error){factoryCosts.delete(importKey);throw error;}
        }
      };
      // Include these module-retained closed definitions in every Factory
      // lifetime, including a second session whose compiler cache is warm.
      factoryCosts.set("s1:closed-definitions",{cpu:2*13*32768+(19222+19487+5596+5889)*8,mesh:0,triangles:0,draws:0});admitFactory();
      const refreshFactoryProjection=(deferProjection=false)=>{
        factoryTransforms=Object.freeze([...factoryScenes.values(),...(ghost?[ghost]:[])].filter(scene=>scene.published).flatMap(scene=>scene.transforms));
        documentPort.body.dataset.hestiaFactoryPresentation=JSON.stringify({sessionId:terrainRoot.read().sessionId,epoch:factoryHostEpoch,nativeTick:physics!.read().ticks,
          scenes:[...factoryScenes.values()].map(scene=>({instanceId:scene.id,published:scene.published,assetId:scene.play?.assetId??null,
            glbSha256:scene.play?.glbSha256??null,sourceFileSha256:scene.play?.sourceFileSha256??null,s1:!!scene.s1,modelError:scene.modelError??null,
            visibleKeys:scene.keys.filter(key=>activeFactoryKeys.has(key)),transforms:scene.transforms})),material:factoryMaterialSummary,cost:factoryTotals()});
        if(!deferProjection)updateFactoryDecorProjection();
      };
      const dropFactoryScene=(scene:FactoryScene)=>{
        const retired=scene.retiredKeys??=new Set();
        try{for(const artifact of scene.artifacts){const key=artifact.representationKey;if(retired.has(key))continue;
          activeFactoryKeys.delete(key);requireAccepted(presentation.dispatch(createRenderCommand({kind:"RemoveRepresentation",backendRevision:backendRevision(0),representationKey:key,expectedSourceRevision:artifact.sourceRevision,expectedArtifactRevision:artifact.artifactRevision,expectedContentHash:artifact.contentHash})),"Factory retire");
          retired.add(key);const index=plainTerrainLeases.findIndex(value=>value.nodeKey===key);if(index>=0)plainTerrainLeases.splice(index,1)[0]!.lease.release();
        }}catch(error){factoryScenes.set(scene.id,scene);throw Error(`RecoveryHold: Factory retirement unproven: ${String(error)}`);}
        for(const key of scene.keys)managedFactoryKeys.delete(key);if(scene.s1)s1Assets.disposeFactoryS1Assets(scene.s1);factoryCosts.delete(scene.id);factoryScenes.delete(scene.id);
      };
      const stagePlayScene=(id:string,projection:import("../factory/presentation/playAssetLoader").PlayAssetProjection,request:FactoryProjectionPose,
        s1?:import("../factory/presentation/factoryS1Assets").FactoryS1Assets):FactoryScene=>{
        const keys=projection.parts.map(part=>part.artifact.representationKey);
        for(const key of keys)managedFactoryKeys.add(key);
        const scene:FactoryScene={id,keys,artifacts:[],transforms:factoryPose(keys,request),published:false,play:projection,request,...(s1?{s1}:{})};
        try{for(const part of projection.parts){const artifact=createMeshArtifact({...part.artifact,frameId:frame});
          requireAccepted(presentation.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),artifact,materialProfiles:part.materialProfiles})),"Play hidden mesh stage");
          scene.artifacts.push(artifact);plainTerrainLeases.push({nodeKey:artifact.representationKey,lease:materialFactory.acquire(part.materialProfiles,{vertexColors:artifact.attributes?.color!==undefined})});}}
        catch(error){dropFactoryScene(scene);throw error;}return scene;
      };
      const playBatchTransform=(key:RepresentationKey,position:readonly [number,number,number],orientation:Readonly<{x:number;y:number;z:number;w:number}>,scale:Readonly<{x:number;y:number;z:number}>):RepresentationTransformSnapshot=>
        Object.freeze({representationKey:key,positionRelative:Object.freeze({x:position[0],y:position[1],z:position[2]}),orientation:Object.freeze({...orientation}),scale:Object.freeze({...scale})});
      const materialIdentityTransform=(key:RepresentationKey):RepresentationTransformSnapshot=>playBatchTransform(key,[0,0,0],{x:0,y:0,z:0,w:1},{x:1,y:1,z:1});
      const directionFromZ=(from:readonly number[],to:readonly number[])=>{
        const dx=(to[0]!-from[0]!)/1000,dy=(to[1]!-from[1]!)/1000,dz=(to[2]!-from[2]!)/1000,length=Math.hypot(dx,dy,dz);
        if(!Number.isFinite(length)||length<=0)throw Error("Factory material route direction invalid");
        const x=dx/length,y=dy/length,z=dz/length;
        if(z<-.999999)return Object.freeze({x:0,y:1,z:0,w:0});
        const qx=-y,qy=x,qz=0,qw=1+z,magnitude=Math.hypot(qx,qy,qz,qw);
        return Object.freeze({x:qx/magnitude,y:qy/magnitude,z:qz/magnitude,w:qw/magnitude});
      };
      const materialCableInstances=(view:FactoryMaterialView,generation:number):import("../factory/presentation/batchPlayParts").FactoryPlayBatchInstance[]=>{
        const instances:import("../factory/presentation/batchPlayParts").FactoryPlayBatchInstance[]=[];
        for(const link of view.links){
          const nonzero:Array<Readonly<{from:readonly number[];to:readonly number[]}>>=[];
          for(let index=0;index<3;index++){const from=link.routeMm[index]!,to=link.routeMm[index+1]!;
            if(from.some((value,axis)=>value!==to[axis]))nonzero.push({from,to});}
          if(nonzero.length===0||nonzero.length>3)throw Error("Factory paid cable route has no admitted segments");
          for(const segment of nonzero){
            const key=representationKey(`factory:material:cable:${generation}:${instances.length}`),from=segment.from.map(value=>value/1000) as [number,number,number],to=segment.to.map(value=>value/1000) as [number,number,number];
            const delta=to.map((value,axis)=>value-from[axis]!),length=Math.hypot(...delta),projection=factoryMaterialTemplates.get(link.assetId);
            if(!projection)throw Error("Factory paid cable template unavailable");
            instances.push({projection,transform:playBatchTransform(key,[(from[0]+to[0])/2,(from[1]+to[1])/2,(from[2]+to[2])/2],
              directionFromZ(segment.from,segment.to),{x:1,y:1,z:length})});
          }
          for(const [endIndex,point] of [link.routeMm[0],link.routeMm[3]].entries()){
            const key=representationKey(`factory:material:cable-end:${generation}:${instances.length}`),endProjection=factoryMaterialTemplates.get(link.endAssetId);
            if(!endProjection)throw Error("Factory paid cable end template unavailable");
            const segment=endIndex===0?nonzero[0]!:nonzero.at(-1)!;
            instances.push({projection:endProjection,transform:playBatchTransform(key,[point[0]/1000,point[1]/1000,point[2]/1000],
              directionFromZ(segment.from,segment.to),{x:1,y:1,z:1})});
          }
        }
        return instances;
      };
      const materialLotPartId=(lot:FactoryMaterialView["lots"][number]):string=>{
        if(lot.definitionSourceId==="B05"||lot.role==="storage")return "body";
        const prefix=lot.definitionSourceId==="B06"?"cutter_":"former_";
        return `${prefix}${lot.role==="input"?"infeed_carriage":lot.role==="wip"?"clamp":lot.role==="output"?"outfeed_carriage":"offcut"}`;
      };
      // B09's source-derived interior floor tops at .32m; corner posts leave a clear +/- .875m footprint.
      const b09StorageInteriorBounds=Object.freeze({min:Object.freeze({x:-.875,y:.32,z:-.875}),max:Object.freeze({x:.875,y:.32,z:.875})});
      type FactoryMaterialLot=FactoryMaterialView["lots"][number];
      type FactoryMaterialLotLayout=Readonly<{count:number;columns:number;rows:number;scale:number;cellWidth:number;cellDepth:number}>;
      const materialLotLayouts=(view:FactoryMaterialView)=>{
        const sorted=[...view.lots].sort((a,b)=>a.instanceId.localeCompare(b.instanceId)||a.role.localeCompare(b.role)||a.itemId.localeCompare(b.itemId));
        const groups=new Map<string,FactoryMaterialLot[]>();for(const lot of sorted){const key=`${lot.instanceId}:${lot.role}`,group=groups.get(key)??[];group.push(lot);groups.set(key,group);}
        const layouts=new Map<string,FactoryMaterialLotLayout>(),gap=.01;
        for(const [key,lots] of groups){
          const first=lots[0]!,scene=factoryScenes.get(first.instanceId),tray=scene?.play?.parts.find(value=>value.partId===materialLotPartId(first));
          const bounds=lots.map(lot=>factoryMaterialTemplates.get(lot.assetId)?.parts[0]?.artifact.bounds);
          if(!tray||bounds.some(value=>!value))continue;
          const trayBounds=first.definitionSourceId==="B09"&&first.role==="storage"?b09StorageInteriorBounds:tray.artifact.bounds;
          const trayWidth=trayBounds.max.x-trayBounds.min.x,trayDepth=trayBounds.max.z-trayBounds.min.z;
          const glyphWidth=Math.max(...bounds.map(value=>value!.max.x-value!.min.x)),glyphDepth=Math.max(...bounds.map(value=>value!.max.z-value!.min.z));
          if(![trayWidth,trayDepth,glyphWidth,glyphDepth].every(Number.isFinite)||trayWidth<=0||trayDepth<=0||glyphWidth<=0||glyphDepth<=0)continue;
          let best:FactoryMaterialLotLayout|undefined;
          for(let columns=1;columns<=lots.length;columns++){
            const rows=Math.ceil(lots.length/columns),cellWidth=trayWidth/columns,cellDepth=trayDepth/rows;
            const scale=Math.min(.35,(cellWidth-gap)/glyphWidth,(cellDepth-gap)/glyphDepth);
            if(Number.isFinite(scale)&&scale>0&&(!best||scale>best.scale))best=Object.freeze({count:lots.length,columns,rows,scale,cellWidth,cellDepth});
          }
          if(best)layouts.set(key,best);
        }
        const ordinals=new Map<string,number>();
        return sorted.map(lot=>{const key=`${lot.instanceId}:${lot.role}`,ordinal=ordinals.get(key)??0;ordinals.set(key,ordinal+1);
          return {lot,ordinal,layout:layouts.get(key)};});
      };
      const materialLotTransform=(lot:FactoryMaterialLot,ordinal:number,layout:FactoryMaterialLotLayout|undefined,domain:FactoryDecorDomainRead):RepresentationTransformSnapshot|undefined=>{
        const scene=factoryScenes.get(lot.instanceId),request=scene?.request,partId=materialLotPartId(lot),part=scene?.play?.parts.find(value=>value.partId===partId);
        const glyph=factoryMaterialTemplates.get(lot.assetId)?.parts[0]?.artifact.bounds;
        if(!scene?.published||!request||!part||!layout||!glyph)return undefined;
        const machine=domain.machines.find(value=>value.instanceId===lot.instanceId),safePoseState=scene.safePose;
        const safePose=scene.s1&&safePoseState&&safePoseState.jobId===machine?.jobId
          ?safePoseState.partPoses.find(value=>value.partId===partId)?.translationM:[0,0,0];
        const isB09Storage=lot.definitionSourceId==="B09"&&lot.role==="storage";
        const bounds=isB09Storage?b09StorageInteriorBounds:part.artifact.bounds,min=[bounds.min.x,bounds.min.y,bounds.min.z],max=[bounds.max.x,bounds.max.y,bounds.max.z];
        const column=ordinal%layout.columns,row=Math.floor(ordinal/layout.columns),rowCount=Math.min(layout.columns,layout.count-row*layout.columns);
        const glyphCenterX=(glyph.min.x+glyph.max.x)/2,glyphCenterZ=(glyph.min.z+glyph.max.z)/2;
        const floorClearance=isB09Storage?1/1024:.04;
        const local=[(min[0]!+max[0]!)/2+(column-(rowCount-1)/2)*layout.cellWidth-glyphCenterX*layout.scale,
          max[1]!+floorClearance-glyph.min.y*layout.scale,
          (min[2]!+max[2]!)/2+(row-(layout.rows-1)/2)*layout.cellDepth-glyphCenterZ*layout.scale];
        const turns=request.quarterTurns,rotated=turns===0?local:turns===1?[local[2]!,local[1]!,-local[0]!]:turns===2?[-local[0]!,local[1]!,-local[2]!]:[-local[2]!,local[1]!,local[0]!];
        const pose=safePose??[0,0,0],center=request.centerMm.map(value=>value/1000),key=representationKey(`factory:material:lot:${ordinal}`);
        const rotatedPose=turns===0?pose:turns===1?[pose[2]!,pose[1]!,-pose[0]!]:turns===2?[-pose[0]!,pose[1]!,-pose[2]!]:[-pose[2]!,pose[1]!,pose[0]!];
        const orientation=turns===0?{x:0,y:0,z:0,w:1}:turns===1?{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2}:turns===2?{x:0,y:1,z:0,w:0}:{x:0,y:-Math.SQRT1_2,z:0,w:Math.SQRT1_2};
        return playBatchTransform(key,[center[0]!+rotated[0]!+rotatedPose[0]!,center[1]!+rotated[1]!+rotatedPose[1]!,center[2]!+rotated[2]!+rotatedPose[2]!],orientation,{x:layout.scale,y:layout.scale,z:layout.scale});
      };
      const materialLotInstances=(view:FactoryMaterialView,domain:FactoryDecorDomainRead,generation:number):import("../factory/presentation/batchPlayParts").FactoryPlayBatchInstance[]=>{
        const instances:import("../factory/presentation/batchPlayParts").FactoryPlayBatchInstance[]=[];
        for(const {lot,ordinal,layout} of materialLotLayouts(view)){
          const projection=factoryMaterialTemplates.get(lot.assetId),transform=materialLotTransform(lot,ordinal,layout,domain);
          if(!projection||!transform)continue;
          const key=representationKey(`factory:material:lot:${generation}:${instances.length}`);
          instances.push({projection,transform:Object.freeze({...transform,representationKey:key})});
        }
        return instances;
      };
      const materialPacketKey=(packet:FactoryMaterialView["packets"][number])=>`packet:${packet.lineId}:${packet.packetId}`;
      const materialPacketTransform=(packet:FactoryMaterialView["packets"][number],domain:FactoryDecorDomainRead,key:RepresentationKey):RepresentationTransformSnapshot=>{
        const line=domain.belts.find(value=>value.lineId===packet.lineId);
        if(!line)throw Error("Factory material packet line binding unavailable");
        return playBatchTransform(key,packet.worldPositionMm.map(value=>value/1000) as [number,number,number],directionFromZ(line.source.centerMm,line.target.centerMm),{x:.4,y:.4,z:.4});
      };
      const materialFamilyKeys=(view:FactoryMaterialView,host:FactoryHostView,domain:FactoryDecorDomainRead)=>{
        const lotPlacements=materialLotLayouts(view).map(({lot,ordinal,layout})=>{const transform=materialLotTransform(lot,ordinal,layout,domain);
          return [JSON.stringify([lot.instanceId,lot.role,lot.containerId,lot.itemId]),JSON.stringify([lot.assetId,transform?.positionRelative??null,transform?.orientation??null,transform?.scale??null])];});
        const cableRoutes=view.links.map(link=>JSON.stringify(link.routeMm)).sort();
        const packetGeometry=view.packets.map(({lineId,packetId,assetId})=>[lineId,packetId,assetId]);
        const lotPlacementBindings=Object.freeze(lotPlacements.map(([group,pose])=>Object.freeze([group!,pose!] as const)));
        return {cables:JSON.stringify(cableRoutes),lots:JSON.stringify(lotPlacements),packets:JSON.stringify(packetGeometry),cableRoutes:Object.freeze(cableRoutes),
          lotPlacements:Object.freeze(lotPlacementBindings.map(([group,pose])=>`${group}:${pose}`)),lotPlacementBindings,
          key:JSON.stringify([host.sessionId,host.epoch,JSON.stringify(cableRoutes),JSON.stringify(lotPlacements),JSON.stringify(packetGeometry)])};
      };
      const restoreAcceptedFactoryMaterialVisibility=(family:ReturnType<typeof materialFamilyKeys>,host:FactoryHostView,domain:FactoryDecorDomainRead):boolean=>{
        if(family.key!==factoryMaterialAcceptedKey||!host.confirmed||!domain.confirmed||domain.sessionId!==host.sessionId||domain.epoch!==host.epoch
          ||domain.nativeTick!==host.nativeTick||domain.phase!==host.physicsStatus||domain.terrainRevision!==host.terrain.revision
          ||domain.catalogDigest!==domain.material.catalog.catalogDigest)return false;
        let changed=false;
        for(const scene of factoryMaterialScenes.values()){
          const stableKey=scene.materialFamily==="cables"?"cables":scene.materialFamily==="lots"?"lots":undefined;
          if(!stableKey||scene.published||factoryMaterialScenes.get(stableKey)!==scene||factoryScenes.get(scene.id)!==scene||!factoryCosts.has(scene.id)
            ||scene.keys.some(key=>scene.retiredKeys?.has(key)))continue;
          const matches=stableKey==="cables"?family.cables===factoryMaterialAcceptedFamilies.cables:family.lots===factoryMaterialAcceptedFamilies.lots;
          if(!matches)continue;
          scene.published=true;for(const key of scene.keys)activeFactoryKeys.add(key);changed=true;
        }
        return changed;
      };
      const materialTemplateIds=(view:FactoryMaterialView):ReadonlySet<string>=>new Set([
        ...view.links.flatMap(link=>[link.assetId,link.endAssetId]),...view.lots.map(lot=>lot.assetId),...view.packets.map(packet=>packet.assetId)
      ]);
      const captureCurrentFactoryMaterial=()=>{
        if(!current()||disposed)return undefined;
        const snapshot=physics!.read(),host=read(),domain=factoryHandle?.readFactoryPresentation?.(host),facilities=snapshot.factoryFacilities;
        if(!domain||!facilities)return undefined;
        const view=factoryMaterialView.readFactoryMaterialProjection({domain,host,facilities});
        return Object.freeze({snapshot,host,domain,facilities,view});
      };
      const makeFactoryMaterialSummary=(view:FactoryMaterialView)=>Object.freeze({
        links:Object.freeze(view.links.map(link=>Object.freeze([link.linkId,link.containerId,link.containerRevision,link.stackId,link.lengthMm,link.routeMm]))),
        lots:Object.freeze(view.lots.map(lot=>Object.freeze([lot.instanceId,lot.role,lot.containerId,lot.containerRevision,lot.itemId,lot.itemVersion,lot.stackId,lot.stackCount,lot.quantityUnits]))),
        packets:Object.freeze(view.packets.map(packet=>Object.freeze([packet.lineId,packet.packetId,packet.bandContainerId,packet.containerRevision,
          packet.stackId,packet.itemId,packet.itemVersion,packet.quantityUnits,packet.positionMm,packet.worldPositionMm])))
      });
      const stageFactoryMaterialBatch=(id:string,family:"cables"|"lots",batch:import("../factory/presentation/batchPlayParts").FactoryPlayBatch,onAccepted:()=>void):FactoryScene|undefined=>{
        const source=batch.artifact;if(!source)return undefined;
        const artifact=createMeshArtifact({...source,frameId:frame});
        const scene:FactoryScene={id,keys:Object.freeze([artifact.representationKey]),artifacts:[],transforms:Object.freeze([materialIdentityTransform(artifact.representationKey)]),published:false,materialFamily:family};
        managedFactoryKeys.add(artifact.representationKey);
        requireAccepted(presentation.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),artifact,materialProfiles:batch.materialProfiles})),"Factory material batch stage");
        onAccepted();
        scene.artifacts.push(artifact);plainTerrainLeases.push({nodeKey:artifact.representationKey,lease:materialFactory.acquire(batch.materialProfiles,{vertexColors:true})});return scene;
      };
      const stageFactoryMaterialPacket=(id:string,packet:FactoryMaterialView["packets"][number],domain:FactoryDecorDomainRead,generation:number,onAccepted:()=>void):FactoryScene=>{
        const projection=factoryMaterialTemplates.get(packet.assetId),part=projection?.parts[0];if(!projection||!part)throw Error("Factory material packet template unavailable");
        const key=representationKey(`factory:material:packet:${generation}:${factoryMaterialScenes.size}:${fnv1aHash(packet.lineId+":"+packet.packetId)}`);
        const artifact=createMeshArtifact({...part.artifact,representationKey:key,frameId:frame});
        const scene:FactoryScene={id,keys:Object.freeze([key]),artifacts:[],transforms:Object.freeze([materialPacketTransform(packet,domain,key)]),published:false,
          materialAssetId:packet.assetId,materialPacketId:materialPacketKey(packet),materialFamily:"packets"};
        managedFactoryKeys.add(key);
        requireAccepted(presentation.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),artifact,materialProfiles:part.materialProfiles})),"Factory material packet stage");
        onAccepted();
        scene.artifacts.push(artifact);plainTerrainLeases.push({nodeKey:key,lease:materialFactory.acquire(part.materialProfiles,{vertexColors:true})});return scene;
      };
      const updateFactoryMaterialPackets=(view:FactoryMaterialView,domain:FactoryDecorDomainRead):boolean=>{
        let changed=false;const currentPackets=new Map(view.packets.map(packet=>[materialPacketKey(packet),packet]));
        for(const scene of factoryMaterialScenes.values()){
          if(scene.materialFamily!=="packets")continue;
          const packet=scene.materialPacketId?currentPackets.get(scene.materialPacketId):undefined;
          if(!packet||scene.materialAssetId!==packet.assetId){if(scene.published){scene.published=false;for(const key of scene.keys)activeFactoryKeys.delete(key);changed=true;}continue;}
          const key=scene.keys[0]!;const transform=materialPacketTransform(packet,domain,key);
          if(JSON.stringify(scene.transforms[0])!==JSON.stringify(transform)){scene.transforms=Object.freeze([transform]);changed=true;}
          if(!scene.published){scene.published=true;for(const itemKey of scene.keys)activeFactoryKeys.add(itemKey);changed=true;}
        }
        if(factoryMaterialAcceptedFamilies.packets===JSON.stringify(view.packets.map(({lineId,driveInstanceId,bandContainerId,containerRevision,packetId,stackId,itemId,itemVersion,itemDigest,quantityUnits,assetId})=>
          [lineId,driveInstanceId,bandContainerId,containerRevision,packetId,stackId,itemId,itemVersion,itemDigest,quantityUnits,assetId])))factoryMaterialSummary=makeFactoryMaterialSummary(view);
        return changed;
      };
      const runFactoryMaterialWorker=async()=>{
        while(factoryMaterialDesired&&factoryMaterialDesired.key!==factoryMaterialAcceptedKey){
          const request=factoryMaterialDesired;
          try{
            await loadFactoryMaterialTemplates(materialTemplateIds(request.view));
            const live=captureCurrentFactoryMaterial();if(!live)throw Error("Factory material current read unavailable");
            const liveKeys=materialFamilyKeys(live.view,live.host,live.domain);
            if(liveKeys.key!==request.key){
              if(liveKeys.key===factoryMaterialAcceptedKey){
                if(factoryMaterialDesired?.key===request.key)factoryMaterialDesired=undefined;
                if(restoreAcceptedFactoryMaterialVisibility(liveKeys,live.host,live.domain))refreshFactoryProjection();
              }else factoryMaterialDesired={key:liveKeys.key,view:live.view};
              continue;
            }
            const generation=factoryMaterialGeneration+1;if(!Number.isSafeInteger(generation))throw Error("Factory material render generation exhausted");
            const rebuildCables=liveKeys.cables!==factoryMaterialAcceptedFamilies.cables||(live.view.links.length>0&&!factoryMaterialScenes.has("cables"));
            const rebuildLots=liveKeys.lots!==factoryMaterialAcceptedFamilies.lots||(live.view.lots.length>0&&!factoryMaterialScenes.has("lots"));
            const cables=rebuildCables?materialCableInstances(live.view,generation):[],lots=rebuildLots?materialLotInstances(live.view,live.domain,generation):[];
            const packetsToStage=live.view.packets.filter(packet=>{const old=factoryMaterialScenes.get(materialPacketKey(packet));return !old||old.materialAssetId!==packet.assetId;});
            const cableEstimate=factoryPlayBatch.estimateFactoryPlayBatch(cables),lotEstimate=factoryPlayBatch.estimateFactoryPlayBatch(lots);
            const packetBytes=packetsToStage.reduce((sum,packet)=>{
              const part=factoryMaterialTemplates.get(packet.assetId)?.parts[0];if(!part)throw Error("Factory packet template unavailable");
              return sum+part.artifact.positions.byteLength+part.artifact.normals.byteLength+part.artifact.indices.byteLength+(part.artifact.attributes?.color?.byteLength??0);
            },0);
            const packetTriangles=packetsToStage.reduce((sum,packet)=>sum+(factoryMaterialTemplates.get(packet.assetId)?.parts[0]?.artifact.indices.length??0)/3,0);
            const packetDraws=packetsToStage.reduce((sum,packet)=>sum+(factoryMaterialTemplates.get(packet.assetId)?.parts[0]?.artifact.materialRanges.length??0),0);
            const stagingInstances=cables.length+lots.length+packetsToStage.length;
            const frameRebindBytes=(cableEstimate.drawCalls?cableEstimate.geometryBytes:0)+(lotEstimate.drawCalls?lotEstimate.geometryBytes:0);
            const stagingCost:FactoryCost={cpu:cableEstimate.cpuBytes+lotEstimate.cpuBytes+frameRebindBytes+packetBytes*3+stagingInstances*1024,
              mesh:cableEstimate.meshBytes+lotEstimate.meshBytes+packetBytes*2,
              triangles:cableEstimate.triangles+lotEstimate.triangles+packetTriangles,draws:cableEstimate.drawCalls+lotEstimate.drawCalls+packetDraws};
            if(![stagingCost.cpu,stagingCost.mesh,stagingCost.triangles,stagingCost.draws].every(Number.isSafeInteger))throw Error("Factory material batch cost invalid");
            const stagingKey="factory:material:staging";factoryCosts.set(stagingKey,stagingCost);
            try{admitFactory();}catch(error){factoryCosts.delete(stagingKey);throw error;}
            const staged:Array<Readonly<{stableKey:string;scene:FactoryScene;cost:FactoryCost}>>=[];let acceptedCommands=0;
            try{
              if(cables.length){const batch=factoryPlayBatch.createFactoryPlayBatch(representationKey(`factory:material:cables:${generation}`),cables);
                const scene=stageFactoryMaterialBatch(`factory:material:cables:${generation}`,"cables",batch,()=>{acceptedCommands++;});if(scene){staged.push({stableKey:"cables",scene,
                  cost:{cpu:batch.costs.cpuBytes,mesh:batch.costs.meshBytes,triangles:batch.costs.triangles,draws:batch.costs.drawCalls}});}}
              if(lots.length){const batch=factoryPlayBatch.createFactoryPlayBatch(representationKey(`factory:material:lots:${generation}`),lots);
                const scene=stageFactoryMaterialBatch(`factory:material:lots:${generation}`,"lots",batch,()=>{acceptedCommands++;});if(scene){staged.push({stableKey:"lots",scene,
                  cost:{cpu:batch.costs.cpuBytes,mesh:batch.costs.meshBytes,triangles:batch.costs.triangles,draws:batch.costs.drawCalls}});}}
              for(const packet of packetsToStage){const stableKey=materialPacketKey(packet),scene=stageFactoryMaterialPacket(`factory:material:${stableKey}:${generation}`,packet,live.domain,generation,()=>{acceptedCommands++;}),part=factoryMaterialTemplates.get(packet.assetId)!.parts[0]!;
                staged.push({stableKey,cost:{cpu:(part.artifact.positions.byteLength+part.artifact.normals.byteLength+part.artifact.indices.byteLength+(part.artifact.attributes?.color?.byteLength??0))*3,
                  mesh:(part.artifact.positions.byteLength+part.artifact.normals.byteLength+part.artifact.indices.byteLength+(part.artifact.attributes?.color?.byteLength??0))*2,
                  triangles:part.artifact.indices.length/3,draws:part.artifact.materialRanges.length},scene});}
              const current=captureCurrentFactoryMaterial();if(!current||disposed){
                try{for(const item of staged)dropFactoryScene(item.scene);}catch(error){failFactoryDecorClosed(error,"material");}
                factoryCosts.delete(stagingKey);if(factoryMaterialDesired?.key===request.key)factoryMaterialDesired=undefined;break;
              }
              if(materialFamilyKeys(current.view,current.host,current.domain).key!==request.key){
                try{for(const item of staged)dropFactoryScene(item.scene);}catch(error){failFactoryDecorClosed(error,"material");}
                factoryCosts.delete(stagingKey);const keys=materialFamilyKeys(current.view,current.host,current.domain);
                if(keys.key===factoryMaterialAcceptedKey){if(factoryMaterialDesired?.key===request.key)factoryMaterialDesired=undefined;
                  if(restoreAcceptedFactoryMaterialVisibility(keys,current.host,current.domain))refreshFactoryProjection();}
                else factoryMaterialDesired={key:keys.key,view:current.view};
                continue;
              }
              const prior=[...factoryMaterialScenes.entries()],nextScenes=new Map<string,FactoryScene>();
              if(!rebuildCables){const scene=factoryMaterialScenes.get("cables");if(scene)nextScenes.set("cables",scene);}
              if(!rebuildLots){const scene=factoryMaterialScenes.get("lots");if(scene)nextScenes.set("lots",scene);}
              for(const packet of live.view.packets){const stableKey=materialPacketKey(packet),scene=factoryMaterialScenes.get(stableKey);
                if(scene&&scene.materialAssetId===packet.assetId)nextScenes.set(stableKey,scene);}
              for(const item of staged){item.scene.published=true;factoryScenes.set(item.scene.id,item.scene);factoryCosts.set(item.scene.id,item.cost);
                for(const key of item.scene.keys)activeFactoryKeys.add(key);nextScenes.set(item.stableKey,item.scene);}
              for(const stableKey of factoryMaterialScenes.keys())if(!nextScenes.has(stableKey))factoryMaterialScenes.delete(stableKey);
              for(const [stableKey,scene] of nextScenes)factoryMaterialScenes.set(stableKey,scene);
              try{for(const [stableKey,scene] of prior)if(nextScenes.get(stableKey)!==scene)dropFactoryScene(scene);}
              catch(error){failFactoryDecorClosed(error,"material");}
              factoryCosts.delete(stagingKey);factoryMaterialGeneration=generation;factoryMaterialAcceptedKey=request.key;
              const family=materialFamilyKeys(live.view,live.host,live.domain);factoryMaterialAcceptedFamilies=family;
              factoryMaterialSummary=makeFactoryMaterialSummary(live.view);
              if(factoryMaterialDesired?.key===request.key)factoryMaterialDesired=undefined;
              delete documentPort.body.dataset.hestiaFactoryMaterialAdmission;
              refreshFactoryProjection();
            }catch(error){
              factoryCosts.delete(stagingKey);
              if(acceptedCommands)failFactoryDecorClosed(error,"material");
              throw error;
            }
          }catch(error){
            if(disposed){if(factoryMaterialDesired?.key===request.key)factoryMaterialDesired=undefined;break;}
            if(!current()){factoryMaterialRejectedKey=request.key;if(factoryMaterialDesired?.key===request.key)factoryMaterialDesired=undefined;break;}
            const reason=String(error);documentPort.body.dataset.hestiaFactoryMaterialAdmission=reason;
            factoryMaterialRejectedKey=request.key;if(factoryMaterialDesired?.key===request.key)factoryMaterialDesired=undefined;break;
          }
        }
      };
      let factoryMaterialRejectedKey="";
      const startFactoryMaterialWorker=()=>{
        if(factoryMaterialWorker||!factoryMaterialDesired||factoryMaterialDesired.key===factoryMaterialAcceptedKey||factoryMaterialDesired.key===factoryMaterialRejectedKey)return;
        factoryMaterialWorker=runFactoryMaterialWorker().finally(()=>{factoryMaterialWorker=undefined;startFactoryMaterialWorker();});
      };
      const requestFactoryMaterialUpdate=(view:FactoryMaterialView,host:FactoryHostView,domain:FactoryDecorDomainRead):boolean=>{
        const family=materialFamilyKeys(view,host,domain);let changed=updateFactoryMaterialPackets(view,domain);
        if(family.key===factoryMaterialAcceptedKey){
          if(factoryMaterialDesired?.key===family.key)factoryMaterialDesired=undefined;
          changed=restoreAcceptedFactoryMaterialVisibility(family,host,domain)||changed;factoryMaterialSummary=makeFactoryMaterialSummary(view);
          if(factoryMaterialDesired&&!factoryMaterialWorker)startFactoryMaterialWorker();return changed;
        }
        if(family.key===factoryMaterialDesired?.key)return changed;
        if(family.key===factoryMaterialRejectedKey)return changed;
        const remainingRoutes=new Map<string,number>();for(const route of family.cableRoutes)remainingRoutes.set(route,(remainingRoutes.get(route)??0)+1);
        const oldCablesRemain=factoryMaterialAcceptedFamilies.cableRoutes.every(route=>{const count=remainingRoutes.get(route)??0;if(count===0)return false;remainingRoutes.set(route,count-1);return true;});
        const currentLotPlacements=new Map(family.lotPlacementBindings);
        const oldLotsRemain=factoryMaterialAcceptedFamilies.lotPlacementBindings.every(([group,pose])=>currentLotPlacements.get(group)===pose);
        for(const scene of factoryMaterialScenes.values()){
          const stillCurrent=scene.materialFamily==="cables"?oldCablesRemain:scene.materialFamily==="lots"?oldLotsRemain:true;
          if(!stillCurrent&&scene.published){scene.published=false;for(const key of scene.keys)activeFactoryKeys.delete(key);changed=true;}
        }
        factoryMaterialDesired={key:family.key,view};
        startFactoryMaterialWorker();
        return changed;
      };
      const eligibleFactoryStorageInspections=(snapshot:HvpCurrentPhysicsSnapshot,facilities:NonNullable<HvpCurrentPhysicsSnapshot["factoryFacilities"]>,host:FactoryHostView,
        domain:FactoryDecorDomainRead):ReadonlySet<string>=>{
        const eligible=new Set<string>();
        if(host.input?.surface!=="cargo"||!host.confirmed||!domain.confirmed||domain.sessionId!==host.sessionId||domain.epoch!==host.epoch
          ||snapshot.ticks!==host.nativeTick||domain.nativeTick!==host.nativeTick||domain.phase!==host.physicsStatus
          ||domain.terrainRevision!==host.terrain.revision||domain.facilityRevision!==facilities.revision
          ||domain.catalogDigest!==domain.material.catalog.catalogDigest||facilities.state!=="Idle"||facilities.transactionId!==null||facilities.prepared!==null
          ||!((snapshot.status==="Running"||snapshot.status==="Paused")&&domain.phase===snapshot.status))return eligible;
        for(const installation of domain.installations){
          if(installation.definitionSourceId!=="B09"||installation.sourceDigest!==factoryStorageProfile.sourceDigest
            ||installation.profileDigest!==factoryStorageProfile.profileDigest||installation.massMg!==factoryStorageProfile.massMg
            ||installation.centerMm.length!==3||!Number.isSafeInteger(installation.quarterTurns)||installation.quarterTurns<0||installation.quarterTurns>3)continue;
          const scene=factoryScenes.get(installation.instanceId),play=scene?.play,definitionRef=play?.definitionRef;
          if(!scene||!scene.published||!play||!definitionRef||!scene.request||scene.request.instanceId!==installation.instanceId
            ||scene.request.definitionSourceId!==factoryStorageProfile.definitionRef.sourceId
            ||scene.request.quarterTurns!==installation.quarterTurns||scene.request.centerMm.some((value,axis)=>value!==installation.centerMm[axis])
            ||definitionRef.sourceId!==factoryStorageProfile.definitionRef.sourceId
            ||definitionRef.version!==factoryStorageProfile.definitionRef.version||definitionRef.digest!==factoryStorageProfile.definitionRef.digest
            ||scene.expectedSourceDigest!==installation.sourceDigest
            ||scene.expectedProfileDigest!==installation.profileDigest)continue;
          const owners=facilities.owners.filter(owner=>owner.instanceId===installation.instanceId);
          const observations=facilities.partObservations?.filter(row=>row.instanceId===installation.instanceId)??[];
          const sources=facilities.sources?.filter(source=>source.instanceId===installation.instanceId&&source.containerId===`storage_${installation.instanceId}`)??[];
          const owner=owners[0],observation=observations[0];
          if(owners.length!==1||!owner||owner.ownerId!==owner.instanceId
            ||owner.sourceDigest!==installation.sourceDigest||owner.sourceDigest!==factoryStorageProfile.sourceDigest
            ||owner.profileDigest!==installation.profileDigest||owner.profileDigest!==factoryStorageProfile.profileDigest||owner.massMg!==installation.massMg
            ||!Number.isSafeInteger(owner.installationRevision)||owner.installationRevision<1||owner.installationRevision>facilities.revision
            ||owner.centerMm.length!==3||owner.centerMm.some((value,axis)=>value!==installation.centerMm[axis])
            ||owner.quarterTurns!==installation.quarterTurns||owner.definitionRef.sourceId!==factoryStorageProfile.definitionRef.sourceId
            ||owner.definitionRef.version!==factoryStorageProfile.definitionRef.version||owner.definitionRef.digest!==factoryStorageProfile.definitionRef.digest
            ||observations.length!==1||!observation||!observation.confirmed||!observation.published||!observation.complete
            ||observation.definitionRef.sourceId!==factoryStorageProfile.definitionRef.sourceId
            ||observation.definitionRef.version!==factoryStorageProfile.definitionRef.version||observation.definitionRef.digest!==factoryStorageProfile.definitionRef.digest
            ||observation.sourceDigest!==owner.sourceDigest||observation.profileDigest!==owner.profileDigest
            ||observation.installationRevision!==owner.installationRevision||observation.terrainRevision!==domain.terrainRevision
            ||observation.facilityRevision!==facilities.revision||observation.parts.length!==factoryStorageProfile.source.parts.length
            ||new Set(observation.parts.map(part=>part.partId)).size!==factoryStorageProfile.source.parts.length
            ||factoryStorageProfile.source.parts.some(expected=>!observation.parts.some(part=>part.partId===expected.partId&&part.status==="Present"&&part.colliderHandles.length>0))
            ||sources.length!==1||sources[0]!.accessible!==true)continue;
          const {observationDigest,...proof}=observation;
          if(observationDigest!==factoryCanonicalSignature(proof))continue;
          eligible.add(installation.instanceId);
        }
        return eligible;
      };
      const loadFactoryStorageInspection=async(instanceId:string)=>{
        if(factoryStorageInspectionLoading.has(instanceId)||factoryStorageInspectionScenes.has(instanceId))return;
        const base=factoryScenes.get(instanceId);if(!base?.play?.definitionRef||!base.request)return;
        factoryStorageInspectionLoading.add(instanceId);
        const generation=factoryStorageInspectionGeneration+1,sceneId=`factory:storage-inspection:${instanceId}`,importKey=`${sceneId}:import`;
        if(!Number.isSafeInteger(generation)){factoryStorageInspectionLoading.delete(instanceId);return;}
        let staged:FactoryScene|undefined;
        try{
          factoryCosts.set(importKey,playImportPeak);admitFactory();
          const projection=await playAssets.loadPlayAssetProjection({assetId:"play_storage_inspection_open_v2",instanceId:`${instanceId}:inspection:${generation}`,
            signal:factoryAssetAbort.signal,expectedBinding:{definitionRef:base.play.definitionRef},renderMode:"vertex-colors"});
          const live=captureCurrentFactoryMaterial();
          if(!live||!eligibleFactoryStorageInspections(live.snapshot,live.facilities,live.host,live.domain).has(instanceId)||factoryScenes.get(instanceId)!==base){
            factoryCosts.delete(importKey);return;
          }
          const cost=playCost(projection),hiddenCost={...cost,triangles:0,draws:0};
          factoryCosts.delete(importKey);factoryCosts.set(sceneId,hiddenCost);admitFactory();
          staged=stagePlayScene(sceneId,projection,base.request);
          staged.nativeOwnerId=instanceId;staged.expectedSourceDigest=base.expectedSourceDigest;staged.expectedProfileDigest=base.expectedProfileDigest;staged.published=true;
          factoryScenes.set(sceneId,staged);factoryStorageInspectionScenes.set(instanceId,staged);factoryStorageInspectionGeneration=generation;refreshFactoryProjection();
          delete documentPort.body.dataset.hestiaFactoryStorageInspection;
        }catch(error){
          factoryCosts.delete(importKey);factoryCosts.delete(sceneId);
          if(staged){try{dropFactoryScene(staged);}catch(cleanup){failFactoryDecorClosed(cleanup,"material");}factoryStorageInspectionScenes.delete(instanceId);}
          if(staged||String(error).includes("RecoveryHold"))failFactoryDecorClosed(error,"material");
          if(!disposed&&current())documentPort.body.dataset.hestiaFactoryStorageInspection=String(error);
        }finally{factoryStorageInspectionLoading.delete(instanceId);}
      };
      const syncFactoryStorageInspection=(snapshot:HvpCurrentPhysicsSnapshot,facilities:HvpCurrentPhysicsSnapshot["factoryFacilities"],host:FactoryHostView,
        domain:FactoryDecorDomainRead|undefined):boolean=>{
        const requested=facilities&&domain?eligibleFactoryStorageInspections(snapshot,facilities,host,domain):new Set<string>();
        for(const instanceId of requested)if(!factoryStorageInspectionScenes.has(instanceId))void loadFactoryStorageInspection(instanceId);
        let changed=false;
        for(const [instanceId,openScene] of factoryStorageInspectionScenes){
          const open=requested.has(instanceId),wasOpen=factoryStorageInspectionVisible.has(instanceId),base=factoryScenes.get(instanceId);
          if(!base||!openScene.play){
            factoryStorageInspectionVisible.delete(instanceId);factoryStorageInspectionScenes.delete(instanceId);
            try{dropFactoryScene(openScene);}catch(error){failFactoryDecorClosed(error,"material");}
            changed=true;continue;
          }
          if(open===wasOpen)continue;
          const baseCost=factoryCosts.get(instanceId),openCost=factoryCosts.get(openScene.id);
          if(!baseCost||!openCost)continue;
          const baseDraws=base.play?.parts.reduce((sum,part)=>sum+part.artifact.materialRanges.length,0)??baseCost.draws;
          const baseTriangles=base.play?.parts.reduce((sum,part)=>sum+part.artifact.indices.length/3,0)??baseCost.triangles;
          const openDraws=openScene.play.parts.reduce((sum,part)=>sum+part.artifact.materialRanges.length,0);
          const openTriangles=openScene.play.parts.reduce((sum,part)=>sum+part.artifact.indices.length/3,0);
          const previousBase={...baseCost},previousOpen={...openCost};
          factoryCosts.set(instanceId,{...baseCost,draws:open?0:baseDraws,triangles:open?0:baseTriangles});
          factoryCosts.set(openScene.id,{...openCost,draws:open?openDraws:0,triangles:open?openTriangles:0});
          try{admitFactory();if(open)factoryStorageInspectionVisible.add(instanceId);else factoryStorageInspectionVisible.delete(instanceId);changed=true;}
          catch(error){factoryCosts.set(instanceId,previousBase);factoryCosts.set(openScene.id,previousOpen);
            if(open)documentPort.body.dataset.hestiaFactoryStorageInspection=String(error);
            else{factoryStorageInspectionVisible.delete(instanceId);factoryCosts.set(instanceId,{...previousBase,draws:0,triangles:0});
              factoryCosts.set(openScene.id,{...previousOpen,draws:0,triangles:0});for(const key of base.keys)activeFactoryKeys.delete(key);
              for(const key of openScene.keys)activeFactoryKeys.delete(key);documentPort.body.dataset.hestiaFactoryStorageInspection=String(error);changed=true;}}
        }
        return changed;
      };
      if(factoryHullRenderProjection){
        const id="factory_hull:crashsite";
        factoryCosts.set("factory:hull-projection",{cpu:FACTORY_HULL_RENDER_MESH_PEAK_BYTES,mesh:FACTORY_HULL_RENDER_MESH_PEAK_BYTES,
          triangles:FACTORY_HULL_TRIANGLES,draws:FACTORY_HULL_DRAWS});
        admitFactory();
        factoryHullScene=stagePlayScene(id,factoryHullRenderProjection,{instanceId:id,definitionSourceId:"hestia_crashsite_walkable_v1",
          centerMm:[6500,1500,7500],quarterTurns:0});
        if(factoryProjectionReady){factoryHullScene.published=true;for(const key of factoryHullScene.keys)activeFactoryKeys.add(key);factoryScenes.set(id,factoryHullScene);refreshFactoryProjection();}
      }
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
      let factoryPresentationDisposed=false;
      const disposeFactoryPresentation=()=>{
        if(factoryPresentationDisposed)return;
        factoryAssetAbort.abort();
        for(const scene of cargoVariants)if(!factoryScenes.has(scene.id))dropFactoryScene(scene);
        if(carrierScene&&!factoryScenes.has(carrierScene.id))dropFactoryScene(carrierScene);
        if(factoryHullScene&&!factoryScenes.has(factoryHullScene.id))dropFactoryScene(factoryHullScene);
        carrierScene=undefined;syncCarrierProjection=()=>{};syncInstalledProjection=()=>{};factoryDecorAttemptBinding=undefined;
        for(const stage of factoryStages.values())if(stage.scene&&!factoryScenes.has(stage.scene.id))dropFactoryScene(stage.scene);
        for(const scene of factoryScenes.values())dropFactoryScene(scene);
        if(ghost)dropFactoryScene(ghost);
        ghost=undefined;ghostDefinition=undefined;factoryHullScene=undefined;factoryScenes.clear();factoryStages.clear();factoryCosts.clear();factoryTransforms=[];
        factoryDecorFootprints=undefined;vegetation=[];plantSources=[];vegetationTransforms=[];vegetationArtifactRevisions.clear();
        factoryMaterialScenes.clear();factoryMaterialTemplates.clear();factoryMaterialDesired=undefined;factoryMaterialAcceptedKey="";factoryMaterialSummary=Object.freeze({links:[],lots:[],packets:[]});
        factoryStorageInspectionScenes.clear();factoryStorageInspectionLoading.clear();factoryStorageInspectionVisible.clear();
        presentation.updateProjection();factoryPresentationDisposed=true;
      };
      cleanupFactoryPresentation=disposeFactoryPresentation;
      let cargoVariantKey="",cargoVariantsPublished=false;
      if(initialFactoryCargo){
        const nativeCargo=physics!.read().factoryFacilities?.cargo;
        if(!nativeCargo||nativeCargo.profileDigest!==initialFactoryCargo.profileDigest)throw new Error("Factory Cargo native profile receipt missing");
        const origin=factoryAssets.readFactoryCargoProjectionOrigin(nativeCargo);
        factoryCosts.delete(initialFactoryCargo.ownerId);
        for(const opened of [false,true]){
          const id=`${initialFactoryCargo.ownerId}:${opened?"open":"closed"}`;
          factoryCosts.set(id,playImportPeak);admitFactory();
          const projection=await playAssets.loadPlayAssetProjection({assetId:opened?"play_wreck_cargo_open_v2":"play_wreck_cargo_v2",instanceId:id,signal:factoryAssetAbort.signal,
            expectedBinding:{visualOnlyAnchor:{kind:"visual-only-cargo",ownerId:nativeCargo.ownerId,containerId:nativeCargo.containerId,worldCenterMm:nativeCargo.positionMm,nativeBoundsMm:nativeCargo.site.boundsMm,quantityAuthority:"existing finite cargo readview",opened}},renderMode:"vertex-colors"});
          if(!current())throw Error("Factory Cargo import superseded");
          factoryCosts.set(id,playCost(projection));admitFactory();
          cargoVariants.push(stagePlayScene(id,projection,{instanceId:id,definitionSourceId:"Cargo",centerMm:origin,quarterTurns:0}));
        }
      }
      const stageCarrierScene=async(native:import("../hestia-prototype/physics/factoryFacilitySession").FactoryNativeCarrierRead|undefined):Promise<FactoryScene>=>{
        if(!native||!Number.isSafeInteger(carrierProjectionRevision+1))throw Error("Carrier projection unavailable");
        carrierProjectionRevision++;
        const profile=handlingProfiles.readCargoHandlingProfile(playCatalog,native.profileId);
        if(!profile||profile.digest!==native.profileDigest||profile.massMg!==native.massMg)throw Error("Carrier render profile binding mismatch");
        const kind=profile.sizeMm[0]===500?"light":profile.sizeMm[2]===1500?"heavy":"medium";
        const projection=await playAssets.loadPlayAssetProjection({assetId:`play_carrier_${kind}_v1`,instanceId:`carrier:slot:${carrierProjectionRevision}`,signal:factoryAssetAbort.signal,
          expectedBinding:{visualOnlyAnchor:{kind:"visual-only-carrier",owner:"existing Native carrier",profileSizeMm:profile.sizeMm,quantityAuthority:"closed CargoHandlingProfile and active custody readview"}},renderMode:"vertex-colors"});
        if(!current())throw Error("Carrier import superseded");
        factoryCosts.set("carrier:slot",playCost(projection));admitFactory();
        return stagePlayScene("carrier:slot",projection,{instanceId:native.ownerId,definitionSourceId:native.profileId,centerMm:native.positionMm,quarterTurns:1});
      };
      syncCarrierProjection=()=>{
        const native=physics!.read(),cargo=native.factoryFacilities?.cargo,carrier=native.factoryFacilities?.carrier;
        const cargoKey=JSON.stringify([cargo?.profileDigest,cargo?.opened,cargo?.positionMm]);let changed=false;
        if(cargoKey!==cargoVariantKey||(factoryProjectionReady&&!cargoVariantsPublished)){cargoVariantKey=cargoKey;changed=true;
          for(const [index,scene] of cargoVariants.entries()){
            scene.published=Boolean(factoryProjectionReady&&cargo&&cargo.profileDigest===initialFactoryCargo?.profileDigest&&index===(cargo.opened?1:0));
            for(const key of scene.keys)scene.published?activeFactoryKeys.add(key):activeFactoryKeys.delete(key);
            if(scene.published)factoryScenes.set(scene.id,scene);else factoryScenes.delete(scene.id);
          }
          cargoVariantsPublished=factoryProjectionReady;
        }
        if(carrierScene?.published&&carrier){const key=JSON.stringify(carrier.positionMm);if(key!==carrierPoseKey){carrierPoseKey=key;changed=true;carrierScene.transforms=factoryPose(carrierScene.keys,{centerMm:carrier.positionMm,quarterTurns:1});}}
        if(changed)refreshFactoryProjection();
      };
      const playIds:Readonly<Record<string,string>>={B06:"play_cutter_v2",B07:"play_former_v2",B05:"play_workbench_v1",B09:"play_storage_v2",
        "fp02.comp.small_brace":"play_brace_v1","fp06.line.belt_4m":"play_belt_v1","fp02.device.battery_4kwh":"play_battery_v1",
        "fp02.device.distribution_40kw":"play_distribution_v2","fp02.device.pv_pack_2kwp":"play_pv_v1","fp02.device.wind_pack_6kw":"play_wind_v1"};
      const loadInstalledPlay=async(request:Pick<FactoryFacilityRequest,"definitionRef"|"instanceId">)=>{
        const assetId=playIds[request.definitionRef.sourceId];if(!assetId)throw Error("Factory definition has no admitted Play model");
        const s1=["B06","B07"].includes(request.definitionRef.sourceId)
          ?await s1Assets.loadFactoryS1Assets({...request.definitionRef,instanceId:request.instanceId},{signal:factoryAssetAbort.signal,renderMode:"vertex-colors"}):undefined;
        const play=s1?.render??await playAssets.loadPlayAssetProjection({assetId,instanceId:request.instanceId,expectedBinding:{definitionRef:request.definitionRef},signal:factoryAssetAbort.signal,renderMode:"vertex-colors"});
        if(!current()){if(s1)s1Assets.disposeFactoryS1Assets(s1);throw Error("Installed Play import superseded");}
        return {play,...(s1?{s1}:{})};
      };
      const admitInstalledImport=(request:Pick<FactoryFacilityRequest,"definitionRef"|"instanceId">,baseCpu:number)=>{
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
      const buildFactoryDecorLedger=(products:readonly HvpVegetationProduct[],footprintBytes:number)=>{
        const base=sceneLedger({terrainMesh:terrainEntries.get(0)!.mesh,terrainMeshes:[...terrainEntries.values()].map(entry=>entry.mesh),
          waterMesh:water,joinMesh,farMesh,additionalMeshes:[...products.map(product=>product.mesh),dropMesh,avatarMesh,inertiaMesh,
            ...branchProducts.map(product=>product.mesh),...[...fragmentEntries.values()].map(entry=>entry.mesh)],vegetationSourceBytes,checkpointSourceBytes,
          visualEffects:true,groupedIndexBytes:[...terrainEntries.values()].reduce((n,entry)=>n+entry.group.indices.byteLength,
            joinLook.indices.byteLength+farLook.indices.byteLength+[...fragmentEntries.values()].reduce((n,entry)=>n+entry.group.indices.byteLength,0)),
          drawCalls:[...terrainEntries.values()].reduce((n,entry)=>n+entry.group.materialRanges.length,
            4+joinLook.materialRanges.length+farLook.materialRanges.length+products.reduce((n,product)=>n+product.profiles.length,0)
              +branchProducts.length+[...fragmentEntries.values()].reduce((n,entry)=>n+entry.group.materialRanges.length,0))});
        const previousBytes=factoryCosts.get("factory:decor-projection")?.cpu??0,delta=footprintBytes-previousBytes;
        return {...base,factoryCpuBytes:base.factoryCpuBytes+delta,totalCpuBytes:base.totalCpuBytes+delta};
      };
      const currentFactoryDecorOwners=(snapshot:HvpCurrentPhysicsSnapshot,
        facilities:NonNullable<HvpCurrentPhysicsSnapshot["factoryFacilities"]>,header:FactoryHostView,
        domain:FactoryDecorDomainRead):FactoryDecorInstallationBounds[]|undefined=>{
        if(!factorySourceProfile||!factoryHandle?.isQuiescent()||!factoryProjectionReady||!current()||!header.confirmed||!domain.confirmed
          ||!facilities||facilities.state!=="Idle"||facilities.transactionId!==null||facilities.prepared!==null
          ||snapshot.status!=="Running"&&snapshot.status!=="Paused"
          ||header.sessionId!==domain.sessionId||header.epoch!==domain.epoch||header.nativeTick!==snapshot.ticks||domain.nativeTick!==snapshot.ticks
          ||snapshot.terrainGeneration!==header.terrain.revision||header.terrain.sourceDigest!==prepared.sourceDigest
          ||domain.phase!==header.physicsStatus||domain.terrainRevision!==header.terrain.revision||domain.facilityRevision!==facilities.revision
          ||header.terrain.profileVersion!==factorySourceProfile.version||domain.installations.length!==facilities.owners.length)return undefined;
        const result:FactoryDecorInstallationBounds[]=[];
        for(const installation of domain.installations){
          const owner=facilities.owners.find(value=>value.instanceId===installation.instanceId),profile=installationProfiles.readRuntimeFactoryInstallationProfile(installation.definitionSourceId);
          if(!owner||profile.sourceDigest!==installation.sourceDigest||profile.profileDigest!==installation.profileDigest
            ||profile.massMg!==installation.massMg||factoryCanonicalJson(profile.definitionRef)!==factoryCanonicalJson(owner.definitionRef)
            ||owner.instanceId!==installation.instanceId||owner.sourceDigest!==installation.sourceDigest||owner.profileDigest!==installation.profileDigest
            ||owner.massMg!==installation.massMg||factoryCanonicalJson(owner.centerMm)!==factoryCanonicalJson(installation.centerMm)
            ||owner.quarterTurns!==installation.quarterTurns||!Number.isSafeInteger(owner.installationRevision)||owner.installationRevision<1
            ||owner.colliderHandles.length!==profile.colliders.length||new Set(owner.colliderHandles).size!==owner.colliderHandles.length
            ||factoryCanonicalJson(installation.boundsMm)!==factoryCanonicalJson(installationProfiles.transformFactoryBounds(
              profile.boundsMm,installation.centerMm,installation.quarterTurns)))return undefined;
          if(["B06","B07","B09"].includes(installation.definitionSourceId)){
            const observations=facilities.partObservations?.filter(value=>value.instanceId===installation.instanceId)??[],observation=observations[0];
            const expectedParts=profile.source.parts.map(part=>({partId:part.partId,status:"Present",colliderHandles:profile.colliders.flatMap((box,index)=>
              box.partId===part.partId?[owner.colliderHandles[index]]:[])}));
            if(observations.length!==1||!observation||!observation.confirmed||!observation.published||!observation.complete
              ||observation.installationRevision!==owner.installationRevision||observation.terrainRevision!==header.terrain.revision
              ||observation.facilityRevision!==facilities.revision||observation.sourceDigest!==owner.sourceDigest||observation.profileDigest!==owner.profileDigest
              ||factoryCanonicalJson(observation.definitionRef)!==factoryCanonicalJson(owner.definitionRef)
              ||factoryCanonicalJson(observation.parts)!==factoryCanonicalJson(expectedParts))return undefined;
            const {observationDigest,...proof}=observation;
            if(observationDigest!==factoryCanonicalSignature(proof))return undefined;
          }
          result.push({instanceId:installation.instanceId,ownerWitness:JSON.stringify([owner.sourceDigest,owner.profileDigest,owner.definitionRef.sourceId,
            ...owner.centerMm,owner.quarterTurns,owner.installationRevision]),boundsMm:installation.boundsMm});
        }
        return result;
      };
      const refreshFactoryDecorProjection=(snapshot:HvpCurrentPhysicsSnapshot,
        facilities:HvpCurrentPhysicsSnapshot["factoryFacilities"],header:FactoryHostView,
        domain:FactoryDecorDomainRead|undefined):boolean=>{
        const previousFootprints=factoryDecorFootprints;
        if(!factorySourceProfile||!previousFootprints||!domain||!facilities)return false;
        if(!factoryHandle?.isQuiescent()||!factoryProjectionReady||!current()||!header.confirmed||!domain.confirmed
          ||facilities.state!=="Idle"||facilities.transactionId!==null||facilities.prepared!==null
          ||snapshot.status!=="Running"&&snapshot.status!=="Paused"||header.sessionId!==domain.sessionId||header.epoch!==domain.epoch
          ||header.nativeTick!==snapshot.ticks||domain.nativeTick!==snapshot.ticks||domain.phase!==header.physicsStatus
          ||snapshot.terrainGeneration!==header.terrain.revision||header.terrain.sourceDigest!==prepared.sourceDigest
          ||domain.terrainRevision!==header.terrain.revision||domain.facilityRevision!==facilities.revision
          ||header.terrain.profileVersion!==factorySourceProfile.version)return false;
        const binding=JSON.stringify([header.sessionId,header.epoch,header.terrain.revision,header.terrain.sourceDigest,facilities.revision]);
        if(binding===factoryDecorAttemptBinding)return false;
        const owners=currentFactoryDecorOwners(snapshot,facilities,header,domain);if(!owners)return false;
        const hull=factoryDecorHullFootprint;
        if(factoryDecorFootprintsMatchOwners(previousFootprints,owners,hull,true)){
          factoryDecorAttemptBinding=binding;return false;
        }
        const footprintBytes=estimateFactoryDecorFootprintBytes(owners,hull);
        if(!Number.isSafeInteger(footprintBytes)||footprintBytes<0)throw Error("Factory decoration footprint count invalid");
        const changedRegions:{minX:number;maxX:number;minZ:number;maxZ:number}[]=[];
        const pushOldRegion=(index:number)=>{const offset=index*6;changedRegions.push({minX:previousFootprints.boundsMeters[offset]!,maxX:previousFootprints.boundsMeters[offset+3]!,
          minZ:previousFootprints.boundsMeters[offset+2]!,maxZ:previousFootprints.boundsMeters[offset+5]!});};
        const pushNewRegion=(owner:FactoryDecorInstallationBounds)=>changedRegions.push({minX:owner.boundsMm.min[0]/1000,maxX:owner.boundsMm.max[0]/1000,
          minZ:owner.boundsMm.min[2]/1000,maxZ:owner.boundsMm.max[2]/1000});
        const oldBoundsEqual=(index:number,owner:FactoryDecorInstallationBounds)=>{
          const offset=index*6;return owner.boundsMm.min[0]/1000===previousFootprints.boundsMeters[offset]
            &&owner.boundsMm.min[1]/1000===previousFootprints.boundsMeters[offset+1]
            &&owner.boundsMm.min[2]/1000===previousFootprints.boundsMeters[offset+2]
            &&owner.boundsMm.max[0]/1000===previousFootprints.boundsMeters[offset+3]
            &&owner.boundsMm.max[1]/1000===previousFootprints.boundsMeters[offset+4]
            &&owner.boundsMm.max[2]/1000===previousFootprints.boundsMeters[offset+5];
        };
        if(!factoryDecorFootprintGeometryMatchesOwners(previousFootprints,owners,hull)){
          for(let index=0;index<previousFootprints.ownerCount;index++){
            const next=owners.find(owner=>owner.instanceId===previousFootprints.ownerIds[index]);
            if(!next||!oldBoundsEqual(index,next)){pushOldRegion(index);if(next)pushNewRegion(next);}
          }
          for(const owner of owners)if(!previousFootprints.ownerIds.includes(owner.instanceId))pushNewRegion(owner);
        }
        const affected:number[]=[];
        for(let index=0;index<plantSources.length;index++){
          const source=plantSources[index]!,volume=source.decoration,originX=source.instance.position.x+volume.originMeters.x,
            originZ=source.instance.position.z+volume.originMeters.z,maxX=originX+volume.sizeX*volume.cellMeters,maxZ=originZ+volume.sizeZ*volume.cellMeters;
          if(changedRegions.some(region=>maxX>region.minX&&originX<region.maxX&&maxZ>region.minZ&&originZ<region.maxZ))affected.push(index);
        }
        const readerBytes=affected.reduce((bytes,index)=>bytes+(plantSources[index]!.instance.kind==="tree"?0:22*22*Int16Array.BYTES_PER_ELEMENT),0);
        const retainedCpu=ledger.totalCpuBytes-ledger.tempEstimateBytes;
        const preReaderCpu=Math.max(ledger.totalCpuBytes+footprintBytes+readerBytes,
          retainedCpu+footprintBytes+readerBytes+physicsPrepareBytes);
        if(!Number.isSafeInteger(readerBytes)||readerBytes<0||!Number.isSafeInteger(preReaderCpu)||preReaderCpu<0)
          throw Error("Factory decoration reader count invalid");
        factoryDecorAttemptBinding=binding;
        if(!admitFactoryDecor({totalCpuBytes:preReaderCpu,retainedMeshBytes:ledger.retainedMeshBytes,triangles:ledger.triangles,drawCalls:ledger.drawCalls}))return false;
        const nextFootprints=createFactoryDecorFootprints(owners,hull);
        if(nextFootprints.retainedBytes!==footprintBytes)throw Error("Factory decoration footprint admission changed");
        const readers=affected.map(index=>({index,...createFactoryDecorProjection(plantSources[index]!,vegetationProfile,nextFootprints)}));
        const readerOffsetBytes=readers.reduce((bytes,reader)=>bytes+reader.offsetBytes,0);
        if(readerOffsetBytes>readerBytes)throw Error("Factory decoration reader admission changed");
        const changes:Readonly<{index:number;old?:HvpVegetationProduct;faces:number;occupied:number}>[]=[];
        let projectedMeshBytes=0,projectedTempBytes=0,projectedTriangles=0,newDraws=0,oldTriangles=0,oldDraws=0;
        for(const reader of readers){
          const source=plantSources[reader.index]!,stats=countFactoryDecorFaces(reader.occupancy),key=representationKey(`${source.instance.id}:${source.instance.kind}`);
          const old=vegetation.find(product=>product.artifact.representationKey===key),cost=factoryDecorFaceBytes(stats.exposedFaces,false);
          oldTriangles+=old?old.mesh.indices.length/3:0;oldDraws+=old?old.profiles.length:0;
          projectedMeshBytes+=cost.mesh;projectedTempBytes+=cost.temp;projectedTriangles+=cost.triangles;
          if(stats.occupiedCells>0)newDraws++;
          changes.push({index:reader.index,...(old?{old}:{}),faces:stats.exposedFaces,occupied:stats.occupiedCells});
        }
        const projectedCpu=Math.max(ledger.totalCpuBytes+footprintBytes+readerOffsetBytes+2*projectedMeshBytes+projectedTempBytes,
          retainedCpu+footprintBytes+readerOffsetBytes+2*projectedMeshBytes+physicsPrepareBytes);
        const projectedRetained=ledger.retainedMeshBytes+projectedMeshBytes;
        const projectedSceneTriangles=ledger.triangles-oldTriangles+projectedTriangles;
        const projectedSceneDraws=ledger.drawCalls-oldDraws+newDraws;
        if(!Number.isSafeInteger(readerOffsetBytes)||readerOffsetBytes<0||!Number.isSafeInteger(projectedCpu)||projectedCpu<0
          ||!Number.isSafeInteger(projectedRetained)||projectedRetained<0||!Number.isSafeInteger(projectedSceneTriangles)
          ||projectedSceneTriangles<0||!Number.isSafeInteger(projectedSceneDraws)||projectedSceneDraws<0)
          throw Error("Factory decoration mesh count invalid");
        if(!admitFactoryDecor({totalCpuBytes:projectedCpu,retainedMeshBytes:projectedRetained,triangles:projectedSceneTriangles,drawCalls:projectedSceneDraws}))return false;
        const replacements=new Map<RepresentationKey,HvpVegetationProduct|undefined>(),stagedProducts:HvpVegetationProduct[]=[],renderChanges=new Set<RepresentationKey>();
        for(const change of changes){
          const source=plantSources[change.index]!,key=representationKey(`${source.instance.id}:${source.instance.kind}`);
          if(change.occupied===0){replacements.set(key,undefined);if(change.old)renderChanges.add(key);continue;}
          const oldRevision=change.old?Number(change.old.artifact.artifactRevision):0;
          const nextRevision=Math.max(vegetationArtifactRevisions.get(key)??0,oldRevision)+1;
          if(!Number.isSafeInteger(nextRevision))throw Error("Factory vegetation artifact revision overflow");
          const generated=meshHvpVegetation(source,undefined,{decoration:readers.find(reader=>reader.index===change.index)!.occupancy,
            artifactRevision:nextRevision,decorationOnly:true});
          if(generated.length!==1||generated[0]!.artifact.representationKey!==key)throw Error("Factory decoration replacement identity mismatch");
          const product=generated[0]!;
          const bytes=product.mesh.positions.byteLength+product.mesh.normals.byteLength+product.mesh.indices.byteLength+(product.mesh.colors?.byteLength??0);
          const faceBound=factoryDecorFaceBytes(change.faces,false);
          if(bytes>faceBound.mesh||product.mesh.tempEstimateBytes>faceBound.temp)throw Error("Factory decoration mesh exceeded its admitted face bound");
          if(change.old?.artifact.contentHash===product.artifact.contentHash)replacements.set(key,change.old);
          else{replacements.set(key,product);renderChanges.add(key);stagedProducts.push(product);}
        }
        const nextVegetation:HvpVegetationProduct[]=[];
        for(const product of vegetation){
          if(!replacements.has(product.artifact.representationKey)){nextVegetation.push(product);continue;}
          const replacement=replacements.get(product.artifact.representationKey);if(replacement)nextVegetation.push(replacement);
        }
        for(const [key,product] of replacements)if(product&&!vegetation.some(value=>value.artifact.representationKey===key))nextVegetation.push(product);
        const nextLedger=buildFactoryDecorLedger(nextVegetation,nextFootprints.retainedBytes);
        const publishedLedger={...nextLedger,tempEstimateBytes:physicsPrepareBytes,
          totalCpuBytes:nextLedger.totalCpuBytes-nextLedger.tempEstimateBytes+physicsPrepareBytes};
        const actualStagedBytes=stagedProducts.reduce((bytes,product)=>bytes+product.mesh.positions.byteLength+product.mesh.normals.byteLength
          +product.mesh.indices.byteLength+(product.mesh.colors?.byteLength??0),0);
        if(actualStagedBytes>projectedMeshBytes)throw Error("Factory decoration staging exceeded its admitted bound");
        const actualPeakCpu=Math.max(ledger.totalCpuBytes+footprintBytes+readerOffsetBytes+2*actualStagedBytes+projectedTempBytes,
          retainedCpu+footprintBytes+readerOffsetBytes+2*actualStagedBytes+physicsPrepareBytes);
        if(!admitFactoryDecor({totalCpuBytes:actualPeakCpu,retainedMeshBytes:ledger.retainedMeshBytes+actualStagedBytes,
          triangles:Math.max(ledger.triangles,nextLedger.triangles),drawCalls:Math.max(ledger.drawCalls,nextLedger.drawCalls)}))return false;
        let acceptedCommands=0;
        const dispatchDecor=(command:RenderCommand,operation:string)=>{
        const result=(()=>{try{return presentation.dispatch(command);}catch(error){return failFactoryDecorClosed(error);}})();
          requireAccepted(result,operation);acceptedCommands++;factoryDecorBackendDispatchPending=true;
        };
        try{
          if(renderChanges.size){
            for(const [key,product] of replacements){
              if(!renderChanges.has(key))continue;
              const old=vegetation.find(value=>value.artifact.representationKey===key);
              if(product){dispatchDecor(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),
                artifact:product.artifact,materialProfiles:product.profiles}),"Factory decoration replacement");
                vegetationArtifactRevisions.set(key,Number(product.artifact.artifactRevision));}
              else if(old){dispatchDecor(createRenderCommand({kind:"RemoveRepresentation",backendRevision:backendRevision(0),
                representationKey:key,expectedSourceRevision:old.artifact.sourceRevision,expectedArtifactRevision:old.artifact.artifactRevision,
                expectedContentHash:old.artifact.contentHash}),"Factory decoration retirement");
                vegetationArtifactRevisions.set(key,Number(old.artifact.artifactRevision));}
            }
            vegetation=nextVegetation;
            vegetationTransforms=projectHvpVegetation(vegetation,plants.map(plant=>({ownerId:plant.id,position:plant.position,orientation:{x:0,y:0,z:0,w:1}})));
            documentPort.body.dataset.hestiaPrototypeVegetationDigest=fnv1aHash(JSON.stringify({
              products:vegetation.map(product=>[product.artifact.representationKey,product.artifact.contentHash]),transforms:vegetationTransforms}));
          }
          factoryDecorFootprints=nextFootprints;
          factoryCosts.set("factory:decor-projection",{cpu:nextFootprints.retainedBytes,mesh:0,triangles:0,draws:0});
          ledger=publishedLedger;
          delete documentPort.body.dataset.hestiaPrototypeDecorationAdmission;
          return true;
        }catch(error){if(acceptedCommands)failFactoryDecorClosed(error);throw error;}
      };
      syncInstalledProjection=(deferProjection=false)=>{
        if(!factoryProjectionReady)return;
        // No await or external UI data between this private snapshot and sample.
        const snapshot=physics!.read(),facilities=snapshot.factoryFacilities,header=read();
        const domain=factoryHandle?.readFactoryPresentation?.(header);let changed=refreshFactoryDecorProjection(snapshot,facilities,header,domain);
        changed=syncFactoryStorageInspection(snapshot,facilities,header,domain)||changed;
        for(const scene of factoryScenes.values()){
          // Carrier and cargo projections share the scene table but are not installed owners.
          // Only installation scenes carry the source/profile binding set during stageProjection.
          if(!scene.play||!scene.request||!scene.published||!scene.expectedSourceDigest||!scene.expectedProfileDigest)continue;
          const ownerInstanceId=scene.nativeOwnerId??scene.id;
          const owner=facilities?.owners.find(o=>o.instanceId===ownerInstanceId&&o.sourceDigest===scene.expectedSourceDigest&&o.profileDigest===scene.expectedProfileDigest);
          const native=facilities?.partObservations?.find(p=>p.instanceId===ownerInstanceId);
          let poses=scene.play.parts.map(p=>({partId:p.partId,translationM:[0,0,0] as readonly number[]}));
          try{
            if(!owner)poses=[];
            else if(scene.s1){
              const machine=domain?.machines.find(m=>m.instanceId===ownerInstanceId);if(!native||!machine||!domain)throw Error("Current Native/domain machine read unavailable");
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
              const openVariant=scene.nativeOwnerId!==undefined,inspectionVisible=factoryStorageInspectionVisible.has(ownerInstanceId);
              if(openVariant!==inspectionVisible)poses=[];
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
        if(domain&&facilities)changed=requestFactoryMaterialUpdate(factoryMaterialView.readFactoryMaterialProjection({domain,host:header,facilities}),header,domain)||changed;
        else if(factoryMaterialScenes.size){
          try{for(const [stableKey,scene] of factoryMaterialScenes){factoryMaterialScenes.delete(stableKey);dropFactoryScene(scene);}}
          catch(error){failFactoryDecorClosed(error,"material");}
          factoryMaterialAcceptedKey="";factoryMaterialAcceptedFamilies={cables:"",lots:"",packets:"",key:"",cableRoutes:Object.freeze([]),lotPlacements:Object.freeze([]),lotPlacementBindings:Object.freeze([])};
          factoryMaterialSummary=Object.freeze({links:[],lots:[],packets:[]});changed=true;
        }
        if(changed)refreshFactoryProjection(deferProjection);
      };
      const construction:FactoryNativeConstructionPort=Object.freeze({
        openCargo:async()=>{const native=physics!.read(),cargo=native.factoryFacilities?.cargo;if(!cargo||!physics!.openFactoryCargo||!nativeFactoryConfirmed())throw new Error("Factory Cargo host unavailable");await physics!.openFactoryCargo({ownerId:cargo.ownerId,profileDigest:cargo.profileDigest,expectedTerrainRevision:native.terrainGeneration,expectedRevision:native.factoryFacilities!.revision});publishFactoryView!();},
        readFacts:()=>{const native=physics!.read(),view=read(),position=native.player?.position;
          if(!position)throw new Error("Factory requires the actual native player");
          return {binding:{sessionId:view.sessionId,epoch:view.epoch,terrainRevision:view.terrain.revision,sourceDigest:view.terrain.sourceDigest,baseDigest:view.terrain.baseDigest,facilityRevision:native.factoryFacilities?.revision??0},
            cargoAccess:native.factoryFacilities?.cargo,
            ...(native.factoryFacilities?.carrier?.phase==="Deposited"?{buildDepot:{containerId:native.factoryFacilities.carrier.containerId,profileId:native.factoryFacilities.carrier.profileId,profileDigest:native.factoryFacilities.carrier.profileDigest,accessible:native.factoryFacilities.carrier.accessible===true,bodyHandle:native.factoryFacilities.carrier.bodyHandle}}:{}),
            actor:{actorId:"hvp_player",ownerId:"fp02_wreck_owner",positionMm:[position.x*1000,position.y*1000,position.z*1000],canBuild:confirmed(true)&&(!factoryHandle||factoryProjectionReady)&&["Running","Paused"].includes(native.status)},
            terrain:{cellMm:125,originMm:[view.terrain.originMeters.x*1000,view.terrain.originMeters.y*1000,view.terrain.originMeters.z*1000],size:[view.terrain.sizeX,view.terrain.sizeY,view.terrain.sizeZ],readSlot:(x:number,y:number,z:number)=>hostPort.readTerrainSlot(x,y,z)}};},
        prepareNative:async(input:FactoryFacilityRequest)=>{if(!current()||!physics!.prepareFactoryFacility)throw new Error("Native Factory capability missing");
          const request=deepFreezeMetadata(JSON.parse(JSON.stringify(input)) as FactoryFacilityRequest),binding=read();
          const estimate=costFor(request.definitionRef.sourceId,request.materialBinding.length),native=physics!.read();
          const captureCostKey=`installation:capture:${request.transactionId}`;
          factoryCosts.set(captureCostKey,{cpu:native.collisionBytes*2+(native.colliderCount+native.bodyCount)*2048,mesh:0,triangles:0,draws:0});
          let loaded:Awaited<ReturnType<typeof loadInstalledPlay>>|undefined,nativePrepareStarted=false;
          try{admitInstalledImport(request,estimate.cpu);loaded=await loadInstalledPlay(request);const cost=playCost(loaded.play);
            factoryCosts.set(request.instanceId,{...cost,cpu:cost.cpu+(loaded.s1?.cost.cpu??0)+estimate.cpu});admitFactory();
            nativePrepareStarted=true;const receipt=await physics!.prepareFactoryFacility(request);
            factoryStages.set(request.transactionId,{request,binding,prepared:receipt,captureCostKey,...loaded});return receipt;}
          catch(error){if(loaded?.s1)s1Assets.disposeFactoryS1Assets(loaded.s1);
            // Bootstrap cannot prove the client's private rollback completed after a Native rejection.
            if(!nativePrepareStarted){factoryCosts.delete(captureCostKey);factoryCosts.delete(request.instanceId);}
            throw error;}},
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
          factoryStages.delete(id);factoryCosts.delete(stage.captureCostKey);refreshFactoryProjection();},
        finalizeProjection:(id:string)=>{const stage=factoryStages.get(id);if(!stage?.scene?.published)throw new Error("Factory finalize scene missing");factoryStages.delete(id);factoryCosts.delete(stage.captureCostKey);refreshFactoryProjection();},
        projectGhost:(request:FactoryPlacementRequest|null)=>{
          if(request&&ghost&&ghostDefinition===request.definitionSourceId){ghost.transforms=factoryPose(ghost.keys,request);refreshFactoryProjection();return;}
          const slot=request?ghostSlots.get(request.definitionSourceId):undefined;
          if(request&&(!slot||!Number.isSafeInteger(slot.revision+1)))throw new Error("Factory ghost slot unavailable or revision exhausted");
          if(request)factoryPose([],request);
          if(ghost){dropFactoryScene(ghost);ghost=undefined;ghostDefinition=undefined;refreshFactoryProjection();}if(!request)return;
          const id=slot!.id;factoryCosts.set(id,costFor(request.definitionSourceId));try{admitFactory();slot!.revision++;ghost=stageFactoryScene(request,id,true,slot!.revision);ghostDefinition=request.definitionSourceId;ghost.published=true;for(const key of ghost.keys)activeFactoryKeys.add(key);refreshFactoryProjection();}catch(error){factoryCosts.delete(id);throw error;}},
        dispose:disposeFactoryPresentation
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
        finalize:async(id:string)=>{if(!physics!.finalizeFactoryCarrier)throw Error("Factory carrier unavailable");await physics!.finalizeFactoryCarrier(id);if(carrierCaptureCostKey)factoryCosts.delete(carrierCaptureCostKey);carrierCaptureCostKey=undefined;carrierOperation=undefined;refreshFactoryProjection();publishFactoryView!();}
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
          if(!current()||binding.sessionId!==terrainRoot.read().sessionId||binding.epoch!==factoryHostEpoch||factorySurface===surface)return;
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
        save:async()=>{
          if(!factorySaveAvailable())throw Error("Factory Save is unavailable until its complete checkpoint memory admission is established");
          if(!physics!.checkpointFactory)throw Error("Factory Native checkpoint capability missing");
          const session=factoryHandle,store=factorySaveStore;
          if(!store||!factorySaveStoreInitialized||!session?.beginFactoryCheckpoint||session.canBeginFactoryCheckpoint?.()!==true){
            throw Error("Factory checkpoint capture unavailable");
          }
          type FactoryCapture=ReturnType<NonNullable<FactoryHostExtensionHandle["beginFactoryCheckpoint"]>>;
          let capture:FactoryCapture|undefined,retainedCpuBytes=0,cacheBytes=0,rawAdmissionComplete=false;
          let progressCandidate:HvpSalvageCheckpoint|undefined,witnessFailure:string|undefined;
          try{
            capture=session.beginFactoryCheckpoint((_rawFactory,rawCacheBytes,tree)=>{
              // The synchronous Factory admission has already checked the confirmed host and
              // acquired its barrier. Raise the Root busy fence before any budget work/copies.
              saveBusy=true;factoryPersistenceState="Saving";factoryPersistenceMessage="Capturing confirmed paused Factory state";
              const retained=retainedSaveCpuBytes(),units=64*(tree.objectCount+tree.arrayCount)+16*Math.max(0,tree.nodeCount-1);
              if(!Number.isSafeInteger(rawCacheBytes)||rawCacheBytes<0)throw Error("Factory checkpoint cache budget invalid");
              const earlyBytes=retained+tree.utf16Bytes+8*units+rawCacheBytes+physicsPrepareBytes;
              if(!Number.isSafeInteger(earlyBytes))throw Error("Factory checkpoint early memory budget overflow");
              if(measurement.enabled)measurement.record("factorySaveAdmission",performance.now(),0,{phase:"early",R:retained,T:tree.utf16Bytes,U:units,
                K:rawCacheBytes,D:null,P:null,oldBound:16*1024*1024,totalBytes:earlyBytes,nativeReserveBytes:physicsPrepareBytes,
                profileCacheReserveBytes:factoryProfileCacheReserveBytes,frameProjectionReferenceReserveBytes:factoryFrameProjectionReferenceReserveBytes,
                logicalCameraReserveBytes:factoryLogicalCameraReserveBytes});
              admitHvpResources({...ledger,totalCpuBytes:earlyBytes},caps);
              retainedCpuBytes=retained;cacheBytes=rawCacheBytes;rawAdmissionComplete=true;
            });
            if(!capture)throw Error("Factory checkpoint capture unavailable");
            const activeCapture=capture;
            const root=terrainRoot.read(),initialHost=read(),viewCapture=currentView(),initialNative=physics!.read(),initialFacilities=initialNative.factoryFacilities;
            const expectedFacilityRevision=initialFacilities?.revision;
            const assertCurrent=()=>{
              try{
                activeCapture.assertCurrent();
                const currentHost=read(),currentNative=physics!.read(),facilities=currentNative.factoryFacilities,input=physics!.lifecycle?.().factoryInput,compiler=terrainCompiler!.diagnostics();
                if(!rawAdmissionComplete||disposed||hvpMountEpoch!==myEpoch||!factorySaveAdmissionReady||saveHold||retainedSaveCpuBytes()!==retainedCpuBytes
                  ||terrainRoot.read()!==root||root.sessionId!==activeCapture.host.sessionId||root.epoch!==activeCapture.host.epoch||root.revision!==initialHost.terrain.revision
                  ||currentHost.sessionId!==initialHost.sessionId||currentHost.epoch!==initialHost.epoch
                  ||currentHost.terrain.revision!==initialHost.terrain.revision||currentHost.terrain.sourceDigest!==initialHost.terrain.sourceDigest
                  ||currentHost.terrain.baseDigest!==initialHost.terrain.baseDigest||currentNative.status!=="Paused"
                  ||currentNative.ticks!==activeCapture.host.nativeTick||currentNative.terrainGeneration!==root.revision
                  ||!facilities||expectedFacilityRevision===undefined||facilities.revision!==expectedFacilityRevision
                  ||facilities.state!=="Idle"||facilities.transactionId!==null||facilities.prepared!==null
                  ||currentNative.terrainTransaction!=="Idle"||currentNative.neighborTransaction!=="Idle"
                  ||currentNative.bodyResidencyTransaction!=="Idle"||currentNative.moving.state!=="Idle"
                  ||(currentNative.structural?.state!==undefined&&currentNative.structural.state!=="Idle")
                  ||documentPort.hidden||factoryPausePending()||playerInput!.active||playerInput!.activationPending||factoryInputError!==null
                  ||!input||!input.enabled||input.closing||input.commandDepth!==0||input.pendingIds.length!==0
                  ||input.desiredLevel.x!==0||input.desiredLevel.z!==0||input.desiredLevel.sprint||input.desiredLevel.jump
                  ||compiler.runningJobs!==0||compiler.queue!==0
                  ||factoryCanonicalJson(currentView())!==factoryCanonicalJson(viewCapture)){
                  throw Error("RecoveryHold: Factory save capture witness changed before storage commit");
                }
              }catch(error){witnessFailure=String(error);throw error;}
            };
            publishFactoryView!();
            assertCurrent();
            const native=await physics!.checkpointFactory();
            if(native.world.tick.ticks!==capture.host.nativeTick||native.world.tick.status!=="Paused"
              ||native.world.terrainGeneration!==root.revision||native.facilities.revision!==expectedFacilityRevision){
              throw Error("RecoveryHold: Native Factory checkpoint binding mismatch");
            }
            assertCurrent();
            const [terrainReceipts,structuralReceipts,movingReceipts]=await Promise.all([
              terrainConsumer!.checkpoint(),structuralConsumer!.checkpoint(),bodyCutConsumer!.checkpoint()
            ]);
            const east=await neighbor!.checkpoint();
            assertCurrent();
            observeSalvage();
            if(salvage&&["Save","Completed"].includes(salvage.read().stage!))progressCandidate=salvage.prepareSave(createPersistenceSignature(native.world));
            const terrainCheckpoint=await terrainRoot.checkpointAsync(factoryAssetAbort.signal);
            assertCurrent();
            const codec=await import("../factory/persistence/factoryCheckpoint");
            assertCurrent();
            if(!factorySourceProfile)throw Error("Factory checkpoint source profile missing");
            const checkpointInput={host:activeCapture.host,native:{version:"fp06-native-core-checkpoint-v1" as const,
              profiles:{...HVP_SAVE_PROFILES,source:factorySourceProfile.version},terrain:terrainCheckpoint,plants:sourcesForSave(),
              world:native.world,receipts:{terrain:terrainReceipts,structural:structuralReceipts,moving:movingReceipts},view:viewCapture,
              progress:progressCandidate??salvage?.checkpoint()??null,
              neighbor:east?{version:"hvp-neighbor-scene-v1" as const,terrain:east,lod:neighbor!.read().renderLod??neighbor!.read().lod}:null},
              nativeFactory:native.facilities};
            const admitCheckpoint=(metrics:import("../factory/persistence/factoryCheckpoint").FactoryCheckpointAdmissionMetrics):void=>{
                if(!rawAdmissionComplete)throw Error("Factory checkpoint raw admission was not completed");
                const units=64*(metrics.tree.objectCount+metrics.tree.arrayCount)+16*Math.max(0,metrics.tree.nodeCount-1),payload=metrics.tree.jsonUtf8Bytes;
                const working=Math.max(physicsPrepareBytes,metrics.decodeWorkingBytes+3*payload,5*payload+codec.FACTORY_SAVE_TRANSPORT_BYTES);
                const total=retainedCpuBytes+metrics.tree.utf16Bytes+8*units+cacheBytes+working;
                if(measurement.enabled)measurement.record("factorySaveAdmission",performance.now(),0,{phase:"full",R:retainedCpuBytes,T:metrics.tree.utf16Bytes,
                  U:units,K:cacheBytes,D:metrics.decodeWorkingBytes,P:payload,oldBound:codec.FACTORY_SAVE_TRANSPORT_BYTES,totalBytes:total,workingBytes:working,
                  profileCacheReserveBytes:factoryProfileCacheReserveBytes,frameProjectionReferenceReserveBytes:factoryFrameProjectionReferenceReserveBytes,
                  logicalCameraReserveBytes:factoryLogicalCameraReserveBytes});
                if(!Number.isSafeInteger(total)||total>codec.FACTORY_SAVE_CPU_BYTES)throw Error("Factory checkpoint CPU/decode budget");
                admitHvpResources({...ledger,totalCpuBytes:total},caps);
            };
            const checkpoint=activeCapture.factory.version==="fp06-factory-session-owner-v2"
              ? codec.encodeFactoryCheckpointV2({...checkpointInput,factory:activeCapture.factory},admitCheckpoint)
              : codec.encodeFactoryCheckpoint({...checkpointInput,factory:activeCapture.factory},admitCheckpoint);
            assertCurrent();
            const saved=await store.save(checkpoint,saveRevision,assertCurrent);
            saveRevision=saved.metadata.recordRevision;factorySlotAvailable=true;
            if(progressCandidate&&salvage)salvage.commitSave(progressCandidate,checkpoint.native.progress);
            factoryPersistenceState="Saved";factoryPersistenceMessage="Combined Factory checkpoint saved locally";
            return;
          }catch(error){
            const diagnostic=error instanceof Error?error.cause:undefined;
            if(measurement.enabled&&diagnostic!==null&&typeof diagnostic==="object"&&!Array.isArray(diagnostic)
              &&(diagnostic as {readonly kind?:unknown}).kind==="hvp-factory-checkpoint-preflight"){
              measurement.record("factorySaveRejected",performance.now(),0,{phase:"native-preflight",cause:diagnostic});
            }
            const reason=witnessFailure??String(error),recovery=witnessFailure!==undefined||/RecoveryHold|deadline|timed out|timeout|witness changed/i.test(reason);
            if(recovery){saveHold=true;factoryPersistenceState="RecoveryHold";}else{factoryPersistenceState="Rejected";}
            factoryPersistenceMessage=reason;throw error;
          }finally{
            try{capture?.release();}finally{saveBusy=false;if(current())publishFactoryView!();}
          }
        },
        continueSession:()=>{
          if(!factoryContinueAvailable())throw Error("Factory Continue is unavailable without a saved primary checkpoint");
          if(!windowPort.location?.assign)throw Error("Factory navigation is unavailable");
          if(!windowPort.confirm?.("Continue from the saved Factory checkpoint? Unsaved changes will be discarded."))return;
          if(!factoryContinueAvailable())throw Error("Factory Continue became unavailable while confirming");
          windowPort.location.assign("/factory.html?factoryLoad=primary");
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
      factoryMount = overrides.factoryExtension(hostPort,factoryRestore,factoryRestoreOwner);
      factoryHandle = await factoryMount;
      if (!current()) { await dispose(); return Object.freeze({ dispose }); }
      if(factoryRestore){
        const savedInstallations=factoryRestore.checkpoint.factory.installations;
        const savedCarrier=factoryRestore.checkpoint.nativeFactory.carrier;
        const adoptedWorldSourceBytes=factoryRestore.native.world.sourceBytes;
        const codec=await import("../factory/persistence/factoryCheckpoint");
        let retainedNativeProjection:{native:unknown;nativeFactory:unknown}|undefined={
          native:factoryRestore.checkpoint.native,nativeFactory:factoryRestore.checkpoint.nativeFactory
        };
        const residualTree=codec.inspectFactoryCheckpointMemoryTree(retainedNativeProjection);
        const residualUnits=64*(residualTree.objectCount+residualTree.arrayCount)+16*Math.max(0,residualTree.nodeCount-1);
        const retainedDecodedBytes=Math.max(0,factoryRestore.native.decodedBytes-coldNeighborAdoptedBytes-coldPlantAdoptedBytes);
        const residualSourceBytes=residualTree.utf16Bytes+residualUnits+retainedDecodedBytes;
        if(!Number.isSafeInteger(residualUnits)||!Number.isSafeInteger(retainedDecodedBytes)||!Number.isSafeInteger(residualSourceBytes)){
          throw Error("Combined Factory retained Native memory count invalid");
        }
        const sourceDelta=residualSourceBytes-ledger.checkpointSourceBytes;
        const sourceLedger={...ledger,checkpointSourceBytes:residualSourceBytes,totalCpuBytes:ledger.totalCpuBytes+sourceDelta};
        const sourceTotal=Math.max(sourceLedger.totalCpuBytes,sourceLedger.totalCpuBytes-sourceLedger.tempEstimateBytes+physicsPrepareBytes);
        if(measurement.enabled)measurement.record("factoryColdPlantAdoption",performance.now(),0,{phase:"residual",plantAdoptedBytes:coldPlantAdoptedBytes,
          decodedSourceBytes:factoryRestore.native.decodedBytes,neighborAdoptedBytes:coldNeighborAdoptedBytes,retainedDecodedBytes,
          checkpointSourceBytesBefore:ledger.checkpointSourceBytes,checkpointSourceBytesAfter:residualSourceBytes,
          residualTotalBytes:sourceTotal,mesherScratchBytes:sourceLedger.tempEstimateBytes,nativeReserveBytes:physicsPrepareBytes,capBytes:caps.maxCpuBytes});
        admitHvpResources({...sourceLedger,totalCpuBytes:sourceTotal},caps);
        ledger={...sourceLedger,totalCpuBytes:sourceTotal};checkpointSourceBytes=residualSourceBytes;
        // The mounted session now owns the Factory tree/cache; keep only the Native
        // projection through restore verification and asset staging.
        factoryRestore=undefined;factoryRestoreOwner=undefined;coldFactory=undefined;
        // Transfer admission from the V1 wire plus imported Owner generation to
        // the mounted Owner's live tree/cache before any restored asset import.
        admitFactory();
        publishFactoryView();
        const header=read();
        const restoredInstallationScenes:FactoryScene[]=[];
        const domain=factoryHandle.readFactoryPresentation?.(header),native=physics!.read(),facilities=native.factoryFacilities;
        if(!domain||factoryCanonicalJson(domain.installations)!==factoryCanonicalJson(savedInstallations)
          ||!facilities||facilities.state!=="Idle"||facilities.transactionId!==null||facilities.prepared!==null
          ||facilities.owners.length!==savedInstallations.length){throw Error("Combined Factory owner mount differs from its issued checkpoint");}
        for(const installation of savedInstallations){
          const owner=facilities.owners.find(value=>value.instanceId===installation.instanceId);
          if(!owner||owner.definitionRef.sourceId!==installation.definitionSourceId||owner.profileDigest!==installation.profileDigest
            ||owner.sourceDigest!==installation.sourceDigest||owner.massMg!==installation.massMg
            ||factoryCanonicalJson(owner.centerMm)!==factoryCanonicalJson(installation.centerMm)||owner.quarterTurns!==installation.quarterTurns){
            throw Error(`Combined Factory Native owner binding mismatch: ${installation.instanceId}`);
          }
          const request={definitionRef:owner.definitionRef,instanceId:owner.instanceId};
          const estimate=costFor(request.definitionRef.sourceId,owner.materialBinding.length);
          admitInstalledImport(request,estimate.cpu);
          let loaded:Awaited<ReturnType<typeof loadInstalledPlay>>|undefined;
          try{
            loaded=await loadInstalledPlay(request);
            const cost=playCost(loaded.play);
            factoryCosts.set(request.instanceId,{...cost,cpu:cost.cpu+(loaded.s1?.cost.cpu??0)+estimate.cpu});
            admitFactory();
          }catch(error){if(loaded?.s1)s1Assets.disposeFactoryS1Assets(loaded.s1);factoryCosts.delete(request.instanceId);throw error;}
          const scene=stagePlayScene(installation.instanceId,loaded.play,{instanceId:installation.instanceId,
            definitionSourceId:installation.definitionSourceId,centerMm:installation.centerMm,quarterTurns:installation.quarterTurns},loaded.s1);
          scene.expectedSourceDigest=installation.sourceDigest;scene.expectedProfileDigest=installation.profileDigest;
          factoryScenes.set(scene.id,scene);restoredInstallationScenes.push(scene);
        }
        const carrier=facilities.carrier;
        if(Boolean(savedCarrier)!==Boolean(carrier))throw Error("Combined Factory carrier presence mismatch after Native mount");
        if(carrier){
          if(!savedCarrier||carrier.ownerId!==savedCarrier.ownerId||carrier.profileId!==savedCarrier.profileId
            ||carrier.profileDigest!==savedCarrier.profileDigest||carrier.phase!==savedCarrier.phase||carrier.massMg!==savedCarrier.massMg
            ||carrier.containerId!==savedCarrier.containerId||factoryCanonicalJson(carrier.positionMm)!==factoryCanonicalJson(savedCarrier.positionMm)){
            throw Error("Combined Factory carrier binding mismatch after Native mount");
          }
          carrierScene=await stageCarrierScene(carrier);carrierScene.published=true;
          for(const key of carrierScene.keys)activeFactoryKeys.add(key);
          factoryScenes.set(carrierScene.id,carrierScene);carrierPoseKey="";
        }
        // Publish installed models together only after every owner and projection is staged.
        for(const scene of restoredInstallationScenes){scene.published=true;for(const key of scene.keys)activeFactoryKeys.add(key);}
        if(factoryHullScene){factoryHullScene.published=true;for(const key of factoryHullScene.keys)activeFactoryKeys.add(key);factoryScenes.set(factoryHullScene.id,factoryHullScene);}
        factoryProjectionReady=true;
        syncCarrierProjection();syncInstalledProjection();refreshFactoryProjection();
        publishFactoryView();
        // The Factory assets now own their retained caches. Drop the last raw Native
        // checkpoint projection before replacing it with the live source/root charge.
        retainedNativeProjection=undefined;
        const adoptedSourceBytes=HVP_SOURCE_SLOT_COUNT+terrainRoot.read().overlayBytes+adoptedWorldSourceBytes;
        const delta=adoptedSourceBytes-ledger.checkpointSourceBytes;
        const next={...ledger,checkpointSourceBytes:adoptedSourceBytes,totalCpuBytes:ledger.totalCpuBytes+delta};
        const totalCpuBytes=Math.max(next.totalCpuBytes,next.totalCpuBytes-next.tempEstimateBytes+physicsPrepareBytes);
        admitHvpResources({...next,totalCpuBytes},caps);ledger={...next,totalCpuBytes};
        checkpointSourceBytes=adoptedSourceBytes;
      }
      admitFactory();
      factorySaveAdmissionReady=true;
      if(coldRestore&&factoryPersistenceState==="Saved")factoryPersistenceMessage="Combined Factory checkpoint loaded and paused; Save checks memory before writing";
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
         const deferInstalledProjection=state.ticks!==physicsTick;
         const factoryPublishStarted=measurement.enabled?performance.now():0;
         publishFactoryView?.(deferInstalledProjection);
         if(measurement.enabled)measurement.record("factoryPublishView",factoryPublishStarted,performance.now()-factoryPublishStarted,{calls:1});
         const factoryFrameStateStarted=measurement.enabled?performance.now():0;
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
        if(measurement.enabled)measurement.record("factoryFrameState",factoryFrameStateStarted,performance.now()-factoryFrameStateStarted,{calls:1});
        if (deferInstalledProjection || playerInput!.active) {
          physicsTick = state.ticks;
          syncPhysicsTransforms();
          if(applyFactoryDecorProjection)applyFactoryDecorProjection();else presentation.updateProjection();
        }
        hud!.updatePhysics();
        hideFactoryLegacyHud();
        if(!saveBusy){observeSalvage();}
      } catch (error) {
        if(error===fatalFactoryDecorationError)return;
        void dispose().finally(() => { failureRoot = presentHvpFailure(documentPort, error); });
        return;
      }
      camera!.update(deltaSeconds);
      if(overrides.factoryExtension){
        try{presentation.updateCameraProjection();}
        catch(error){void dispose().finally(()=>{failureRoot=presentHvpFailure(documentPort,error);});return;}
      }
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
