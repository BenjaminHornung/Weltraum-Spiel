import * as THREE from "three";
import type { ContentHash } from "../../presentation";
import type { HestiaSurfaceRegionPresentationSnapshot, HestiaSurfaceScatterPresentationFact } from "./hestiaSurfacePresentation";

export const HESTIA_SURFACE_ENVIRONMENT_NAMES = Object.freeze({
  root: "hestia-surface-environment",
  terrain: "hestia-surface-terrain",
  water: "hestia-surface-water",
  vegetation: "hestia-surface-vegetation",
  lighting: "hestia-surface-lighting"
} as const);

export interface HestiaSurfaceEnvironmentIdentity {
  readonly bodyId: string;
  readonly regionId: string;
  readonly surfaceFrameId: string;
}

export interface HestiaSurfaceEnvironmentBackend {
  readonly scene: THREE.Scene;
  readonly terrainRoot: THREE.Object3D;
}

export interface HestiaSurfaceEnvironmentState {
  readonly fogEnabled: boolean;
  readonly waterEnabled: boolean;
  readonly vegetationEnabled: boolean;
  readonly regionRevision?: number;
  readonly presentationSignature?: ContentHash;
  readonly terrainHashes: readonly string[];
}

export type HestiaSurfaceEnvironmentSyncResult =
  | "Applied"
  | "Unchanged"
  | "Stale"
  | "ConflictingRevision"
  | "IdentityMismatch"
  | "Disposed";

export interface HestiaSurfaceEnvironment {
  readState(): Readonly<HestiaSurfaceEnvironmentState>;
  setFogEnabled(enabled: boolean): void;
  setWaterEnabled(enabled: boolean): void;
  setVegetationEnabled(enabled: boolean): void;
  sync(snapshot: Readonly<HestiaSurfaceRegionPresentationSnapshot>): HestiaSurfaceEnvironmentSyncResult;
  dispose(): void;
}

interface InstancedResourceSet {
  readonly waterPatch: THREE.CircleGeometry;
  readonly treeTrunk: THREE.CylinderGeometry;
  readonly treeCanopy: THREE.SphereGeometry;
  readonly sprout: THREE.ConeGeometry;
  readonly capStem: THREE.CylinderGeometry;
  readonly capCrown: THREE.SphereGeometry;
  readonly water: THREE.MeshPhongMaterial;
  readonly trunk: THREE.MeshStandardMaterial;
  readonly canopy: THREE.MeshStandardMaterial;
  readonly sproutMaterial: THREE.MeshStandardMaterial;
  readonly capStemMaterial: THREE.MeshStandardMaterial;
  readonly capCrownMaterial: THREE.MeshStandardMaterial;
}

const createResources = (): InstancedResourceSet => {
  const waterPatch = new THREE.CircleGeometry(1, 6);
  waterPatch.name = "hestia-surface-water-patch-geometry";
  waterPatch.rotateX(-Math.PI / 2);
  const treeTrunk = new THREE.CylinderGeometry(0.15, 0.24, 2.7, 5);
  treeTrunk.name = "hestia-surface-tree-trunk-geometry";
  const treeCanopy = new THREE.SphereGeometry(1, 7, 4);
  treeCanopy.name = "hestia-surface-tree-canopy-geometry";
  const sprout = new THREE.ConeGeometry(0.2, 0.9, 5);
  sprout.name = "hestia-surface-mist-sprout-geometry";
  const capStem = new THREE.CylinderGeometry(0.07, 0.1, 0.55, 5);
  capStem.name = "hestia-surface-luminous-cap-stem-geometry";
  const capCrown = new THREE.SphereGeometry(0.28, 6, 3);
  capCrown.name = "hestia-surface-luminous-cap-crown-geometry";

  const water = new THREE.MeshPhongMaterial({
    color: 0x236f78,
    emissive: 0x061e25,
    emissiveIntensity: 0.14,
    specular: 0x5ca7a7,
    transparent: true,
    opacity: 0.38,
    shininess: 30,
    depthWrite: false,
    side: THREE.FrontSide
  });
  water.name = "hestia-surface-water-material";
  const trunk = new THREE.MeshStandardMaterial({
    color: 0x07100f,
    roughness: 0.96,
    metalness: 0,
    flatShading: true
  });
  trunk.name = "hestia-surface-tree-trunk-material";
  const canopy = new THREE.MeshStandardMaterial({
    color: 0x0b302c,
    roughness: 0.94,
    metalness: 0,
    flatShading: true
  });
  canopy.name = "hestia-surface-tree-canopy-material";
  const sproutMaterial = new THREE.MeshStandardMaterial({
    color: 0x297b75,
    emissive: 0x082c2e,
    emissiveIntensity: 0.32,
    roughness: 0.9,
    flatShading: true
  });
  sproutMaterial.name = "hestia-surface-mist-sprout-material";
  const capStemMaterial = new THREE.MeshStandardMaterial({
    color: 0x173d39,
    emissive: 0x061a1b,
    emissiveIntensity: 0.18,
    roughness: 0.92,
    flatShading: true
  });
  capStemMaterial.name = "hestia-surface-luminous-cap-stem-material";
  const capCrownMaterial = new THREE.MeshStandardMaterial({
    color: 0x54a9a5,
    emissive: 0x0c393b,
    emissiveIntensity: 0.42,
    roughness: 0.82,
    flatShading: true
  });
  capCrownMaterial.name = "hestia-surface-luminous-cap-crown-material";

  return {
    waterPatch,
    treeTrunk,
    treeCanopy,
    sprout,
    capStem,
    capCrown,
    water,
    trunk,
    canopy,
    sproutMaterial,
    capStemMaterial,
    capCrownMaterial
  };
};

const setInstanceTransforms = (
  mesh: THREE.InstancedMesh,
  facts: readonly Readonly<HestiaSurfaceScatterPresentationFact>[],
  transform: (
    fact: Readonly<HestiaSurfaceScatterPresentationFact>,
    position: THREE.Vector3,
    rotation: THREE.Quaternion,
    scale: THREE.Vector3
  ) => void
): void => {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  facts.forEach((fact, index) => {
    transform(fact, position, rotation, scale);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
};

const createScatterInstances = (
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  facts: readonly Readonly<HestiaSurfaceScatterPresentationFact>[],
  transform: Parameters<typeof setInstanceTransforms>[2]
): THREE.InstancedMesh | undefined => {
  if (facts.length === 0) return undefined;
  const mesh = new THREE.InstancedMesh(geometry, material, facts.length);
  mesh.name = name;
  setInstanceTransforms(mesh, facts, transform);
  return mesh;
};

const yawRotation = (rotation: THREE.Quaternion, yawRadians: number): void => {
  rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yawRadians);
};

export const createHestiaSurfaceEnvironment = (
  backend: HestiaSurfaceEnvironmentBackend,
  identity: HestiaSurfaceEnvironmentIdentity
): HestiaSurfaceEnvironment => {
  const root = new THREE.Group();
  const terrainGroup = new THREE.Group();
  const waterGroup = new THREE.Group();
  const vegetationGroup = new THREE.Group();
  const lightingGroup = new THREE.Group();
  root.name = HESTIA_SURFACE_ENVIRONMENT_NAMES.root;
  terrainGroup.name = HESTIA_SURFACE_ENVIRONMENT_NAMES.terrain;
  waterGroup.name = HESTIA_SURFACE_ENVIRONMENT_NAMES.water;
  vegetationGroup.name = HESTIA_SURFACE_ENVIRONMENT_NAMES.vegetation;
  lightingGroup.name = HESTIA_SURFACE_ENVIRONMENT_NAMES.lighting;
  terrainGroup.userData.sourceTerrainRoot = backend.terrainRoot.name;
  root.add(terrainGroup, waterGroup, vegetationGroup, lightingGroup);
  backend.scene.add(root);

  const previousBackground = backend.scene.background;
  const previousFog = backend.scene.fog;
  const background = new THREE.Color(0x071d22);
  const fog = new THREE.Fog(0x0b2b30, 24, 122);
  backend.scene.background = background;
  backend.scene.fog = fog;

  const hemisphere = new THREE.HemisphereLight(0x7fb5ad, 0x09120f, 1.18);
  hemisphere.name = "hestia-surface-hemisphere-light";
  const ambient = new THREE.AmbientLight(0x355e58, 0.48);
  ambient.name = "hestia-surface-ambient-light";
  const key = new THREE.DirectionalLight(0xffbf78, 2.3);
  key.name = "hestia-surface-aurelia-key-light";
  key.position.set(-28, 42, 17);
  const rim = new THREE.DirectionalLight(0x4d9fa4, 0.72);
  rim.name = "hestia-surface-cool-rim-light";
  rim.position.set(27, 15, -31);
  lightingGroup.add(hemisphere, ambient, key, rim);

  const resources = createResources();
  let state: Readonly<HestiaSurfaceEnvironmentState> = Object.freeze({
    fogEnabled: true,
    waterEnabled: true,
    vegetationEnabled: true,
    terrainHashes: Object.freeze([])
  });
  let disposed = false;

  const applyVisibility = (): void => {
    waterGroup.visible = state.waterEnabled;
    vegetationGroup.visible = state.vegetationEnabled;
    backend.scene.fog = state.fogEnabled ? fog : previousFog;
  };

  const updateState = (partial: Partial<HestiaSurfaceEnvironmentState>): void => {
    if (disposed) return;
    state = Object.freeze({ ...state, ...partial });
    applyVisibility();
  };

  const rebuildWater = (snapshot: Readonly<HestiaSurfaceRegionPresentationSnapshot>): void => {
    waterGroup.clear();
    if (snapshot.waterPatches.length === 0) return;
    const mesh = new THREE.InstancedMesh(resources.waterPatch, resources.water, snapshot.waterPatches.length);
    mesh.name = "hestia-surface-water-patches";
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    snapshot.waterPatches.forEach((patch, index) => {
      position.set(patch.positionMeters.x, patch.positionMeters.y, patch.positionMeters.z);
      rotation.identity();
      scale.setScalar(patch.uniformScale);
      matrix.compose(position, rotation, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.renderOrder = 1;
    waterGroup.add(mesh);
  };

  const rebuildVegetation = (snapshot: Readonly<HestiaSurfaceRegionPresentationSnapshot>): void => {
    vegetationGroup.clear();
    const trees = snapshot.scatter.filter((fact) => fact.kind === "black_trunk");
    const sprouts = snapshot.scatter.filter((fact) => fact.kind === "cyan_luminous_sprout");
    const caps = snapshot.scatter.filter((fact) => fact.kind === "cyan_luminous_cap");

    const treeTrunks = createScatterInstances(
      "hestia-surface-umbrella-tree-trunks",
      resources.treeTrunk,
      resources.trunk,
      trees,
      (fact, position, rotation, scale) => {
        position.set(fact.positionMeters.x, fact.positionMeters.y + 1.35 * fact.uniformScale, fact.positionMeters.z);
        yawRotation(rotation, fact.yawRadians);
        scale.setScalar(fact.uniformScale);
      }
    );
    const lowerCanopies = createScatterInstances(
      "hestia-surface-umbrella-tree-lower-canopies",
      resources.treeCanopy,
      resources.canopy,
      trees,
      (fact, position, rotation, scale) => {
        position.set(fact.positionMeters.x, fact.positionMeters.y + 2.72 * fact.uniformScale, fact.positionMeters.z);
        yawRotation(rotation, fact.yawRadians);
        scale.set(1.28, 0.28, 1.05).multiplyScalar(fact.uniformScale);
      }
    );
    const upperCanopies = createScatterInstances(
      "hestia-surface-umbrella-tree-upper-canopies",
      resources.treeCanopy,
      resources.canopy,
      trees,
      (fact, position, rotation, scale) => {
        const offset = 0.32 * fact.uniformScale;
        position.set(
          fact.positionMeters.x + Math.cos(fact.yawRadians) * offset,
          fact.positionMeters.y + 3.08 * fact.uniformScale,
          fact.positionMeters.z + Math.sin(fact.yawRadians) * offset
        );
        yawRotation(rotation, fact.yawRadians);
        scale.set(0.9, 0.23, 0.76).multiplyScalar(fact.uniformScale);
      }
    );
    const mistSprouts = createScatterInstances(
      "hestia-surface-mist-sprouts",
      resources.sprout,
      resources.sproutMaterial,
      sprouts,
      (fact, position, rotation, scale) => {
        position.set(fact.positionMeters.x, fact.positionMeters.y + 0.45 * fact.uniformScale, fact.positionMeters.z);
        yawRotation(rotation, fact.yawRadians);
        scale.setScalar(fact.uniformScale);
      }
    );
    const capStems = createScatterInstances(
      "hestia-surface-luminous-cap-stems",
      resources.capStem,
      resources.capStemMaterial,
      caps,
      (fact, position, rotation, scale) => {
        position.set(fact.positionMeters.x, fact.positionMeters.y + 0.28 * fact.uniformScale, fact.positionMeters.z);
        yawRotation(rotation, fact.yawRadians);
        scale.setScalar(fact.uniformScale);
      }
    );
    const capCrowns = createScatterInstances(
      "hestia-surface-luminous-cap-crowns",
      resources.capCrown,
      resources.capCrownMaterial,
      caps,
      (fact, position, rotation, scale) => {
        position.set(fact.positionMeters.x, fact.positionMeters.y + 0.62 * fact.uniformScale, fact.positionMeters.z);
        yawRotation(rotation, fact.yawRadians);
        scale.set(1, 0.45, 1).multiplyScalar(fact.uniformScale);
      }
    );

    [treeTrunks, lowerCanopies, upperCanopies, mistSprouts, capStems, capCrowns]
      .forEach((mesh) => {
        if (mesh !== undefined) vegetationGroup.add(mesh);
      });
  };

  const sync = (
    snapshot: Readonly<HestiaSurfaceRegionPresentationSnapshot>
  ): HestiaSurfaceEnvironmentSyncResult => {
    if (disposed) return "Disposed";
    if (snapshot.terrain.bodyId !== identity.bodyId
      || snapshot.terrain.regionId !== identity.regionId
      || snapshot.terrain.surfaceFrameId !== identity.surfaceFrameId) {
      return "IdentityMismatch";
    }
    if (state.regionRevision !== undefined) {
      if (snapshot.terrain.regionRevision < state.regionRevision) return "Stale";
      if (snapshot.terrain.regionRevision === state.regionRevision) {
        return snapshot.presentationSignature === state.presentationSignature
          ? "Unchanged"
          : "ConflictingRevision";
      }
    }

    rebuildWater(snapshot);
    rebuildVegetation(snapshot);
    state = Object.freeze({
      ...state,
      regionRevision: snapshot.terrain.regionRevision,
      presentationSignature: snapshot.presentationSignature,
      terrainHashes: Object.freeze(snapshot.bricks.map((brick) => brick.terrainHash))
    });
    applyVisibility();
    return "Applied";
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    backend.scene.remove(root);
    if (backend.scene.background === background) backend.scene.background = previousBackground;
    if (backend.scene.fog === fog) backend.scene.fog = previousFog;
    Object.values(resources).forEach((resource) => resource.dispose());
    root.clear();
  };

  applyVisibility();
  return {
    readState: () => state,
    setFogEnabled: (enabled) => updateState({ fogEnabled: enabled }),
    setWaterEnabled: (enabled) => updateState({ waterEnabled: enabled }),
    setVegetationEnabled: (enabled) => updateState({ vegetationEnabled: enabled }),
    sync,
    dispose
  };
};
