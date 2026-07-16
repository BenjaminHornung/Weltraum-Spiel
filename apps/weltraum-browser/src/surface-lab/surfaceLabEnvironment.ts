import * as THREE from "three";
import { surfaceFrameId, voxelBodyId, voxelRegionId } from "../voxel";
import {
  generateHestiaScatter,
  type HestiaScatterKind,
  type HestiaScatterRecord
} from "../world-generation/hestia";
import type { ThreeRenderBackend } from "../render/three/backend";
import type { SurfaceLabTelemetrySnapshot } from "./surfaceLabTelemetry";

export interface SurfaceLabPresentationState {
  readonly fogEnabled: boolean;
  readonly waterEnabled: boolean;
  readonly vegetationEnabled: boolean;
  readonly wireframeEnabled: boolean;
  readonly boundariesEnabled: boolean;
}

export interface SurfaceLabEnvironment {
  readState(): SurfaceLabPresentationState;
  setFogEnabled(enabled: boolean): void;
  setWaterEnabled(enabled: boolean): void;
  setVegetationEnabled(enabled: boolean): void;
  setWireframeEnabled(enabled: boolean): void;
  setBoundariesEnabled(enabled: boolean): void;
  sync(snapshot: SurfaceLabTelemetrySnapshot): void;
  dispose(): void;
}

export type SurfaceLabEnvironmentBackend = Pick<ThreeRenderBackend, "scene" | "representationRoot">;

export interface SurfaceLabEnvironmentDependencies {
  readonly createWireframeGeometry: (source: THREE.BufferGeometry) => THREE.WireframeGeometry;
}

const PRESENTATION_GROUP_NAME = "surface-lab-presentation";
const REGION_ID = voxelRegionId("region:hestia.surface-lab.v1");
const CHUNK_COORDINATES = Object.freeze(
  [-2, -1, 0, 1].flatMap((z) => [-2, -1, 0, 1].map((x) => Object.freeze({ x, y: -1, z })))
);
const SHORELINE_POINTS = Object.freeze([
  Object.freeze({ x: -1, y: -0.22 }),
  Object.freeze({ x: -0.78, y: -0.72 }),
  Object.freeze({ x: -0.22, y: -1 }),
  Object.freeze({ x: 0.38, y: -0.87 }),
  Object.freeze({ x: 0.92, y: -0.4 }),
  Object.freeze({ x: 1, y: 0.18 }),
  Object.freeze({ x: 0.63, y: 0.72 }),
  Object.freeze({ x: 0.08, y: 0.96 }),
  Object.freeze({ x: -0.48, y: 0.78 }),
  Object.freeze({ x: -0.93, y: 0.32 })
]);
const TERRAIN_PRESENTATION_PALETTE = Object.freeze([
  Object.freeze({ source: Object.freeze([0.08, 0.12, 0.11]), target: Object.freeze([0.13, 0.19, 0.19]) }),
  Object.freeze({ source: Object.freeze([0.18, 0.23, 0.18]), target: Object.freeze([0.24, 0.27, 0.19]) }),
  Object.freeze({ source: Object.freeze([0.18, 0.38, 0.27]), target: Object.freeze([0.2, 0.43, 0.25]) }),
  Object.freeze({ source: Object.freeze([0.08, 0.31, 0.3]), target: Object.freeze([0.08, 0.36, 0.33]) }),
  Object.freeze({ source: Object.freeze([0.12, 0.42, 0.46]), target: Object.freeze([0.12, 0.47, 0.51]) })
]);
const CLUSTER_NEIGHBOR_DISTANCE_SQUARED = 7 * 7;

const disposeObjectResources = (root: THREE.Object3D): void => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const renderable = object as THREE.Mesh;
    if (renderable.geometry !== undefined) geometries.add(renderable.geometry);
    const sourceMaterials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    sourceMaterials.filter((material): material is THREE.Material => material !== undefined).forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
};

const clearOwnedGroup = (group: THREE.Group): void => {
  disposeObjectResources(group);
  group.clear();
};

const createWaterPatchGeometry = (): THREE.ShapeGeometry => {
  const shoreline = new THREE.Shape();
  shoreline.moveTo(SHORELINE_POINTS[0]!.x, SHORELINE_POINTS[0]!.y);
  SHORELINE_POINTS.slice(1).forEach((point) => shoreline.lineTo(point.x, point.y));
  shoreline.closePath();
  const geometry = new THREE.ShapeGeometry(shoreline);
  geometry.name = "surface-lab-water-patch-geometry";
  return geometry;
};

const createShorelineGeometry = (): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints(SHORELINE_POINTS.map((point) => new THREE.Vector3(point.x, 0, -point.y)));
  geometry.name = "surface-lab-waterline-geometry";
  return geometry;
};

const clusterScatterRecords = (records: readonly HestiaScatterRecord[]): readonly HestiaScatterRecord[] => {
  const clustered = records.filter((record, index) => records.some((candidate, candidateIndex) => {
    if (candidateIndex === index) return false;
    const deltaX = candidate.positionMeters.x - record.positionMeters.x;
    const deltaZ = candidate.positionMeters.z - record.positionMeters.z;
    return deltaX * deltaX + deltaZ * deltaZ <= CLUSTER_NEIGHBOR_DISTANCE_SQUARED;
  }));
  return clustered.length > 0 ? clustered : records;
};

const createScatterMesh = (
  kind: HestiaScatterKind,
  records: readonly HestiaScatterRecord[]
): THREE.InstancedMesh | undefined => {
  const matching = records.filter((record) => record.kind === kind);
  if (matching.length === 0) return undefined;
  const geometry = kind === "black_trunk"
    ? new THREE.CylinderGeometry(0.12, 0.24, 3.2, 5)
    : kind === "cyan_luminous_sprout"
      ? new THREE.ConeGeometry(0.34, 1.15, 5)
      : new THREE.SphereGeometry(0.46, 6, 4);
  const material = new THREE.MeshStandardMaterial({
    color: kind === "black_trunk" ? 0x172521 : kind === "cyan_luminous_sprout" ? 0x378b80 : 0x65aaa0,
    emissive: kind === "black_trunk" ? 0x000000 : 0x071e1d,
    emissiveIntensity: 0.2,
    roughness: 0.9,
    flatShading: true
  });
  const mesh = new THREE.InstancedMesh(geometry, material, matching.length);
  mesh.name = `surface-lab-scatter-${kind}`;
  mesh.userData.sourceScatterIds = Object.freeze(matching.map((record) => record.id));
  const transform = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matching.forEach((record, index) => {
    const heightOffset = kind === "cyan_luminous_cap" ? 1.05 : kind === "black_trunk" ? 1.6 : 0.58;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), record.yawRadians);
    scale.setScalar(record.uniformScale);
    transform.compose(
      new THREE.Vector3(record.positionMeters.x, record.positionMeters.y + heightOffset * record.uniformScale, record.positionMeters.z),
      rotation,
      scale
    );
    mesh.setMatrixAt(index, transform);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
};

const createBoundaryGrid = (snapshot: SurfaceLabTelemetrySnapshot): THREE.Group => {
  const group = new THREE.Group();
  group.name = "surface-lab-chunk-boundaries";
  const halfX = snapshot.regionExtentMeters.x / 2;
  const halfZ = snapshot.regionExtentMeters.z / 2;
  const stepX = snapshot.regionExtentMeters.x / 4;
  const stepZ = snapshot.regionExtentMeters.z / 4;
  const positions: number[] = [];
  for (let index = 0; index <= 4; index += 1) {
    const x = -halfX + index * stepX;
    positions.push(x, 0.08, -halfZ, x, 0.08, halfZ);
    const z = -halfZ + index * stepZ;
    positions.push(-halfX, 0.08, z, halfX, 0.08, z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineDashedMaterial({
    color: 0x72b7aa,
    transparent: true,
    opacity: 0.2,
    depthTest: true,
    depthWrite: false,
    dashSize: 1.1,
    gapSize: 1.7
  });
  material.name = "surface-lab-chunk-boundary-material";
  const boundaries = new THREE.LineSegments(geometry, material);
  boundaries.computeLineDistances();
  group.add(boundaries);
  return group;
};

export const createSurfaceLabEnvironment = (
  backend: SurfaceLabEnvironmentBackend,
  overrides: Partial<SurfaceLabEnvironmentDependencies> = {}
): SurfaceLabEnvironment => {
  const dependencies: SurfaceLabEnvironmentDependencies = {
    createWireframeGeometry: overrides.createWireframeGeometry ?? ((source) => new THREE.WireframeGeometry(source))
  };
  const presentationRoot = new THREE.Group();
  presentationRoot.name = PRESENTATION_GROUP_NAME;
  const staticGroup = new THREE.Group();
  const vegetationGroup = new THREE.Group();
  const boundaryGroup = new THREE.Group();
  const wireframeGroup = new THREE.Group();
  staticGroup.name = "surface-lab-atmosphere";
  vegetationGroup.name = "surface-lab-vegetation";
  boundaryGroup.name = "surface-lab-boundaries";
  wireframeGroup.name = "surface-lab-wireframe";
  presentationRoot.add(staticGroup, vegetationGroup, boundaryGroup, wireframeGroup);
  backend.scene.add(presentationRoot);

  const previousBackground = backend.scene.background;
  const previousFog = backend.scene.fog;
  const background = new THREE.Color(0x0c2224);
  backend.scene.background = background;

  const hemisphere = new THREE.HemisphereLight(0xb7d8c6, 0x21372d, 1.35);
  hemisphere.name = "surface-lab-hemisphere-light";
  const keyLight = new THREE.DirectionalLight(0xd6e5c8, 3.2);
  keyLight.name = "surface-lab-key-light";
  keyLight.position.set(-30, 52, 24);
  const rimLight = new THREE.DirectionalLight(0x55a2a3, 1.1);
  rimLight.name = "surface-lab-rim-light";
  rimLight.position.set(34, 20, -28);
  const waterMaterial = new THREE.MeshPhongMaterial({
    color: 0x286c73,
    emissive: 0x041719,
    emissiveIntensity: 0.14,
    specular: 0x68aaa8,
    transparent: true,
    opacity: 0.3,
    shininess: 44,
    depthWrite: false,
    side: THREE.FrontSide
  });
  waterMaterial.name = "surface-lab-water-material";
  const water = new THREE.Mesh(createWaterPatchGeometry(), waterMaterial);
  water.name = "surface-lab-presentation-water";
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.04;
  water.renderOrder = 1;
  const shorelineMaterial = new THREE.LineBasicMaterial({
    color: 0x77aaa5,
    transparent: true,
    opacity: 0.38,
    depthTest: true,
    depthWrite: false
  });
  shorelineMaterial.name = "surface-lab-waterline-material";
  const shoreline = new THREE.LineLoop(createShorelineGeometry(), shorelineMaterial);
  shoreline.name = "surface-lab-presentation-waterline";
  shoreline.position.y = 0.09;
  shoreline.renderOrder = 2;
  staticGroup.add(hemisphere, keyLight, rimLight, water, shoreline);

  let state: SurfaceLabPresentationState = Object.freeze({
    fogEnabled: true,
    waterEnabled: true,
    vegetationEnabled: true,
    wireframeEnabled: false,
    boundariesEnabled: false
  });
  let scatterSignature = "";
  let geometrySignature: string | undefined;
  let extentSignature = "";
  let activePlanningEpoch: number | undefined;
  let latestSettledSnapshot: SurfaceLabTelemetrySnapshot | undefined;
  let disposed = false;
  const fog = new THREE.Fog(0x173638, 28, 104);
  const restoredTerrainMaterials = new Map<THREE.MeshLambertMaterial, Readonly<{
    color: THREE.Color;
    flatShading: boolean;
  }>>();

  const applyTerrainPresentation = (): void => {
    backend.representationRoot.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshLambertMaterial) || restoredTerrainMaterials.has(material)) return;
        const mapping = TERRAIN_PRESENTATION_PALETTE.find(({ source }) => {
          const deltaR = material.color.r - source[0]!;
          const deltaG = material.color.g - source[1]!;
          const deltaB = material.color.b - source[2]!;
          return deltaR * deltaR + deltaG * deltaG + deltaB * deltaB < 1e-8;
        });
        if (mapping === undefined) return;
        restoredTerrainMaterials.set(material, Object.freeze({
          color: material.color.clone(),
          flatShading: material.flatShading
        }));
        material.color.setRGB(mapping.target[0]!, mapping.target[1]!, mapping.target[2]!);
        material.flatShading = true;
        material.needsUpdate = true;
      });
    });
  };

  const applyVisibility = (): void => {
    water.visible = state.waterEnabled;
    shoreline.visible = state.waterEnabled;
    vegetationGroup.visible = state.vegetationEnabled;
    wireframeGroup.visible = state.wireframeEnabled;
    boundaryGroup.visible = state.boundariesEnabled;
    backend.scene.fog = state.fogEnabled ? fog : previousFog;
  };

  const rebuildScatter = (snapshot: SurfaceLabTelemetrySnapshot): void => {
    const signature = `${snapshot.seed}:${snapshot.voxelSizeMeters}`;
    if (scatterSignature === signature) return;
    scatterSignature = signature;
    clearOwnedGroup(vegetationGroup);
    const records = CHUNK_COORDINATES.flatMap((brickCoordinate) => generateHestiaScatter({
      rootSeed: snapshot.seed,
      bodyId: voxelBodyId(snapshot.bodyId),
      surfaceFrameId: surfaceFrameId(snapshot.surfaceFrameId),
      regionId: REGION_ID,
      brickCoordinate,
      voxelSizeMeters: snapshot.voxelSizeMeters
    }));
    const clusteredRecords = clusterScatterRecords(records);
    (["black_trunk", "cyan_luminous_sprout", "cyan_luminous_cap"] as const).forEach((kind) => {
      const mesh = createScatterMesh(kind, clusteredRecords);
      if (mesh !== undefined) vegetationGroup.add(mesh);
    });
  };

  const rebuildBoundaries = (snapshot: SurfaceLabTelemetrySnapshot): void => {
    const signature = `${snapshot.regionExtentMeters.x}:${snapshot.regionExtentMeters.z}`;
    if (extentSignature === signature) return;
    extentSignature = signature;
    clearOwnedGroup(boundaryGroup);
    const replacement = createBoundaryGrid(snapshot);
    while (replacement.children.length > 0) boundaryGroup.add(replacement.children[0]!);
    water.scale.set(snapshot.regionExtentMeters.x * 0.32, snapshot.regionExtentMeters.z * 0.28, 1);
    water.position.x = snapshot.regionExtentMeters.x * 0.06;
    water.position.z = -snapshot.regionExtentMeters.z * 0.04;
    shoreline.scale.set(snapshot.regionExtentMeters.x * 0.32, 1, snapshot.regionExtentMeters.z * 0.28);
    shoreline.position.x = water.position.x;
    shoreline.position.z = water.position.z;
  };

  const clearWireframe = (): void => {
    geometrySignature = undefined;
    clearOwnedGroup(wireframeGroup);
  };

  const rebuildWireframe = (snapshot: SurfaceLabTelemetrySnapshot): void => {
    const settled = snapshot.lifecycle === "Ready" || snapshot.lifecycle === "Failed";
    if (!state.wireframeEnabled || !settled || snapshot.meshHashes.length === 0) return;
    const signature = `${snapshot.planningEpoch}:${snapshot.meshHashes.join("|")}`;
    if (geometrySignature === signature) return;
    geometrySignature = signature;
    clearOwnedGroup(wireframeGroup);
    backend.representationRoot.updateWorldMatrix(true, true);
    const material = new THREE.LineBasicMaterial({
      color: 0x85d3c4,
      transparent: true,
      opacity: 0.13,
      depthTest: true,
      depthWrite: false
    });
    material.name = "surface-lab-wireframe-material";
    let linesCreated = 0;
    backend.representationRoot.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !(object.geometry instanceof THREE.BufferGeometry)) return;
      const lines = new THREE.LineSegments(dependencies.createWireframeGeometry(object.geometry), material);
      lines.matrix.copy(object.matrixWorld);
      lines.matrixAutoUpdate = false;
      wireframeGroup.add(lines);
      linesCreated += 1;
    });
    if (linesCreated === 0) material.dispose();
  };

  const updateState = (partial: Partial<SurfaceLabPresentationState>): void => {
    if (disposed) return;
    const wasWireframeEnabled = state.wireframeEnabled;
    state = Object.freeze({ ...state, ...partial });
    applyVisibility();
    if (!wasWireframeEnabled && state.wireframeEnabled && latestSettledSnapshot !== undefined) {
      rebuildWireframe(latestSettledSnapshot);
    }
  };

  const sync = (snapshot: SurfaceLabTelemetrySnapshot): void => {
    if (disposed) return;
    applyTerrainPresentation();
    rebuildBoundaries(snapshot);
    rebuildScatter(snapshot);
    const generationStarted = snapshot.lifecycle === "Requesting" || snapshot.lifecycle === "Regenerating";
    if (activePlanningEpoch !== snapshot.planningEpoch || generationStarted) {
      activePlanningEpoch = snapshot.planningEpoch;
      latestSettledSnapshot = undefined;
      clearWireframe();
    }
    if (snapshot.lifecycle === "Ready" || snapshot.lifecycle === "Failed") {
      latestSettledSnapshot = snapshot;
      rebuildWireframe(snapshot);
    }
    applyVisibility();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    backend.scene.remove(presentationRoot);
    if (backend.scene.fog === fog) backend.scene.fog = previousFog;
    if (backend.scene.background === background) backend.scene.background = previousBackground;
    restoredTerrainMaterials.forEach((original, material) => {
      material.color.copy(original.color);
      material.flatShading = original.flatShading;
      material.needsUpdate = true;
    });
    restoredTerrainMaterials.clear();
    disposeObjectResources(presentationRoot);
    presentationRoot.clear();
  };

  applyVisibility();
  return {
    readState: () => state,
    setFogEnabled: (enabled) => updateState({ fogEnabled: enabled }),
    setWaterEnabled: (enabled) => updateState({ waterEnabled: enabled }),
    setVegetationEnabled: (enabled) => updateState({ vegetationEnabled: enabled }),
    setWireframeEnabled: (enabled) => updateState({ wireframeEnabled: enabled }),
    setBoundariesEnabled: (enabled) => updateState({ boundariesEnabled: enabled }),
    sync,
    dispose
  };
};
