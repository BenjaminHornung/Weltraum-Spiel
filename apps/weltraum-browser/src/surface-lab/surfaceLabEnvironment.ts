import * as THREE from "three";
import { surfaceFrameId, voxelBodyId, voxelRegionId } from "../voxel";
import { generateHestiaScatter, type HestiaScatterKind } from "../world-generation/hestia";
import type { ThreeRenderBackend } from "../render/three/backend";
import { SURFACE_LAB_REGION } from "./surfaceLabRegion";
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
  shoreline.moveTo(-1, -0.22);
  shoreline.lineTo(-0.78, -0.72);
  shoreline.lineTo(-0.22, -1);
  shoreline.lineTo(0.38, -0.87);
  shoreline.lineTo(0.92, -0.4);
  shoreline.lineTo(1, 0.18);
  shoreline.lineTo(0.63, 0.72);
  shoreline.lineTo(0.08, 0.96);
  shoreline.lineTo(-0.48, 0.78);
  shoreline.lineTo(-0.93, 0.32);
  shoreline.closePath();
  const geometry = new THREE.ShapeGeometry(shoreline);
  geometry.name = "surface-lab-water-patch-geometry";
  return geometry;
};

const createScatterMesh = (
  kind: HestiaScatterKind,
  records: ReturnType<typeof generateHestiaScatter>
): THREE.InstancedMesh | undefined => {
  const matching = records.filter((record) => record.kind === kind);
  if (matching.length === 0) return undefined;
  const geometry = kind === "black_trunk"
    ? new THREE.ConeGeometry(0.32, 2.8, 5)
    : kind === "cyan_luminous_sprout"
      ? new THREE.ConeGeometry(0.42, 1.35, 5)
      : new THREE.SphereGeometry(0.55, 6, 4);
  const material = new THREE.MeshStandardMaterial({
    color: kind === "black_trunk" ? 0x101817 : kind === "cyan_luminous_sprout" ? 0x39a9a5 : 0x65c9bd,
    emissive: kind === "black_trunk" ? 0x000000 : 0x082e2d,
    emissiveIntensity: 0.45,
    roughness: 0.9,
    flatShading: true
  });
  const mesh = new THREE.InstancedMesh(geometry, material, matching.length);
  mesh.name = `surface-lab-scatter-${kind}`;
  const transform = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matching.forEach((record, index) => {
    const heightOffset = kind === "cyan_luminous_cap" ? 1.2 : kind === "black_trunk" ? 1.4 : 0.65;
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
  const stepX = snapshot.regionExtentMeters.x / SURFACE_LAB_REGION.chunkCounts.x;
  const stepZ = snapshot.regionExtentMeters.z / SURFACE_LAB_REGION.chunkCounts.z;
  const positions: number[] = [];
  const divisionCount = Math.max(SURFACE_LAB_REGION.chunkCounts.x, SURFACE_LAB_REGION.chunkCounts.z);
  for (let index = 0; index <= divisionCount; index += 1) {
    if (index <= SURFACE_LAB_REGION.chunkCounts.x) {
      const x = -halfX + index * stepX;
      positions.push(x, 0.08, -halfZ, x, 0.08, halfZ);
    }
    if (index <= SURFACE_LAB_REGION.chunkCounts.z) {
      const z = -halfZ + index * stepZ;
      positions.push(-halfX, 0.08, z, halfX, 0.08, z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineDashedMaterial({
    color: 0x72b7aa,
    transparent: true,
    opacity: 0.42,
    depthTest: true,
    depthWrite: false,
    dashSize: 1.5,
    gapSize: 1.1
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
  const background = new THREE.Color(0x102728);
  backend.scene.background = background;

  const hemisphere = new THREE.HemisphereLight(0xa1cfbf, 0x18251c, 1.05);
  hemisphere.name = "surface-lab-hemisphere-light";
  const keyLight = new THREE.DirectionalLight(0xd0dfc0, 2.85);
  keyLight.name = "surface-lab-key-light";
  keyLight.position.set(-34, 48, 18);
  const rimLight = new THREE.DirectionalLight(0x4aa6aa, 0.95);
  rimLight.name = "surface-lab-rim-light";
  rimLight.position.set(32, 18, -26);
  const waterMaterial = new THREE.MeshPhongMaterial({
    color: 0x2d7478,
    emissive: 0x051c1f,
    emissiveIntensity: 0.18,
    specular: 0x5ba4a3,
    transparent: true,
    opacity: 0.24,
    shininess: 36,
    depthWrite: false,
    side: THREE.FrontSide
  });
  waterMaterial.name = "surface-lab-water-material";
  const water = new THREE.Mesh(createWaterPatchGeometry(), waterMaterial);
  water.name = "surface-lab-presentation-water";
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.04;
  water.renderOrder = 1;
  staticGroup.add(hemisphere, keyLight, rimLight, water);

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
  const fog = new THREE.Fog(0x163536, 42, 126);

  const applyVisibility = (): void => {
    water.visible = state.waterEnabled;
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
    const records = SURFACE_LAB_REGION.chunkCoordinates.flatMap((brickCoordinate) => generateHestiaScatter({
      rootSeed: snapshot.seed,
      bodyId: voxelBodyId(snapshot.bodyId),
      surfaceFrameId: surfaceFrameId(snapshot.surfaceFrameId),
      regionId: REGION_ID,
      brickCoordinate,
      voxelSizeMeters: snapshot.voxelSizeMeters
    }));
    (["black_trunk", "cyan_luminous_sprout", "cyan_luminous_cap"] as const).forEach((kind) => {
      const mesh = createScatterMesh(kind, records);
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
      opacity: 0.24,
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
