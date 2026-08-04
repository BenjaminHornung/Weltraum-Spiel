import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ContentHash } from "../../presentation";
import type {
  HestiaSurfaceRegionPresentationSnapshot,
  HestiaSurfaceScatterPresentationFact,
  HestiaSurfaceWaterPatchPresentationFact
} from "./hestiaSurfacePresentation";
import {
  HESTIA_COAST_LUSH_PRESET_ID,
  HESTIA_PRESET_ID,
  type HestiaGeneratorProfile
} from "../../world-generation/hestia";

export const HESTIA_SURFACE_ENVIRONMENT_NAMES = Object.freeze({
  root: "hestia-surface-environment",
  sky: "hestia-surface-sky",
  terrain: "hestia-surface-terrain",
  water: "hestia-surface-water",
  vegetation: "hestia-surface-vegetation",
  decorativeVegetation: "hestia-surface-decorative-vegetation",
  structuralVegetation: "hestia-surface-structural-vegetation",
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
  readonly skyDome: THREE.SphereGeometry;
  readonly waterPatch: THREE.CircleGeometry;
  readonly sprout: THREE.ConeGeometry;
  readonly capStem: THREE.CylinderGeometry;
  readonly capCrown: THREE.SphereGeometry;
  readonly coastUnderstory: THREE.BufferGeometry;
  readonly coastTree: THREE.BufferGeometry;
  readonly sky: THREE.ShaderMaterial;
  readonly water: THREE.MeshPhongMaterial;
  readonly waterWet: THREE.MeshPhongMaterial;
  readonly sproutMaterial: THREE.MeshStandardMaterial;
  readonly capStemMaterial: THREE.MeshStandardMaterial;
  readonly capCrownMaterial: THREE.MeshStandardMaterial;
  readonly coastVegetationMaterial: THREE.MeshStandardMaterial;
}

const coloredBox = (
  size: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>,
  position: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>,
  color: number
): THREE.BoxGeometry => {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  geometry.translate(position.x, position.y, position.z);
  const value = new THREE.Color(color);
  const colors = new Float32Array(geometry.getAttribute("position").count * 3);
  for (let index = 0; index < colors.length; index += 3) value.toArray(colors, index);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
};

const mergedGeometry = (
  name: string,
  parts: readonly THREE.BufferGeometry[]
): THREE.BufferGeometry => {
  const geometry = mergeGeometries([...parts], false);
  parts.forEach((part) => part.dispose());
  if (geometry === null) throw new Error(`Unable to build ${name}.`);
  geometry.name = name;
  return geometry;
};

const createResources = (): InstancedResourceSet => {
  const skyDome = new THREE.SphereGeometry(1, 32, 16);
  skyDome.name = "hestia-surface-sky-dome-geometry";
  const waterPatch = new THREE.CircleGeometry(1, 6);
  waterPatch.name = "hestia-surface-water-patch-geometry";
  waterPatch.rotateX(-Math.PI / 2);
  const waterPositions = waterPatch.getAttribute("position");
  const waterColors = new Float32Array(waterPositions.count * 3);
  const waterCenter = new THREE.Color(0x4cc6c2);
  const shoreRim = new THREE.Color(0xcbbf94);
  for (let index = 0; index < waterPositions.count; index += 1) {
    const color = Math.hypot(waterPositions.getX(index), waterPositions.getZ(index)) > 0.9
      ? shoreRim
      : waterCenter;
    color.toArray(waterColors, index * 3);
  }
  waterPatch.setAttribute("color", new THREE.BufferAttribute(waterColors, 3));
  const sprout = new THREE.ConeGeometry(0.2, 0.9, 5);
  sprout.name = "hestia-surface-mist-sprout-geometry";
  const capStem = new THREE.CylinderGeometry(0.07, 0.1, 0.55, 5);
  capStem.name = "hestia-surface-luminous-cap-stem-geometry";
  const capCrown = new THREE.SphereGeometry(0.28, 6, 3);
  capCrown.name = "hestia-surface-luminous-cap-crown-geometry";
  const coastUnderstory = mergedGeometry("hestia-coast-understory-block-geometry", [
    coloredBox({ x: 0.65, y: 0.75, z: 0.65 }, { x: -0.42, y: 0.375, z: 0.08 }, 0x497c35),
    coloredBox({ x: 0.8, y: 1.05, z: 0.8 }, { x: 0.15, y: 0.525, z: -0.12 }, 0x5f963f),
    coloredBox({ x: 0.55, y: 0.62, z: 0.55 }, { x: 0.62, y: 0.31, z: 0.28 }, 0x315f38)
  ]);
  const coastTree = mergedGeometry("hestia-coast-tiered-tree-block-geometry", [
    coloredBox({ x: 0.55, y: 4.2, z: 0.55 }, { x: 0, y: 2.1, z: 0 }, 0x65452d),
    coloredBox({ x: 3.4, y: 0.9, z: 3.4 }, { x: 0, y: 4.25, z: 0 }, 0x315f38),
    coloredBox({ x: 2.7, y: 0.9, z: 2.7 }, { x: 0.25, y: 5.05, z: -0.15 }, 0x447c3b),
    coloredBox({ x: 1.8, y: 0.85, z: 1.8 }, { x: -0.2, y: 5.8, z: 0.15 }, 0x5f963f)
  ]);

  const sky = new THREE.ShaderMaterial({
    uniforms: {
      uHorizonColor: { value: new THREE.Color(0xc5eaf4) },
      uZenithColor: { value: new THREE.Color(0x4b9fd8) },
      uCloudColor: { value: new THREE.Color(0xf7faf4) },
      uSunColor: { value: new THREE.Color(0xfff0c2) },
      uSunDirection: { value: new THREE.Vector3(-0.36, 0.84, 0.41).normalize() }
    },
    vertexShader: `
      varying vec3 vDirection;
      varying vec2 vSkyUv;

      void main() {
        vDirection = normalize(position);
        vec3 viewDirection = mat3(viewMatrix) * position;
        vec4 clipPosition = projectionMatrix * vec4(viewDirection, 1.0);
        vSkyUv = clipPosition.xy / max(abs(clipPosition.w), 0.0001) * 0.5 + 0.5;
        gl_Position = clipPosition.xyww;
      }
    `,
    fragmentShader: `
      uniform vec3 uHorizonColor;
      uniform vec3 uZenithColor;
      uniform vec3 uCloudColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDirection;
      varying vec3 vDirection;
      varying vec2 vSkyUv;

      float hash21(vec2 point) {
        point = fract(point * vec2(123.34, 456.21));
        point += dot(point, point + 45.32);
        return fract(point.x * point.y);
      }

      float valueNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        float a = hash21(cell);
        float b = hash21(cell + vec2(1.0, 0.0));
        float c = hash21(cell + vec2(0.0, 1.0));
        float d = hash21(cell + vec2(1.0, 1.0));
        return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
      }

      float cloudNoise(vec2 point) {
        float result = 0.0;
        float weight = 0.55;
        for (int octave = 0; octave < 4; octave += 1) {
          result += valueNoise(point) * weight;
          point = point * 2.03 + vec2(4.7, -2.9);
          weight *= 0.48;
        }
        return result;
      }

      float cloudMass(vec2 point, vec2 center, vec2 radius) {
        float distanceToCenter = length((point - center) / radius);
        return 1.0 - smoothstep(0.55, 1.0, distanceToCenter);
      }

      float cloudCluster(vec2 point, vec2 center, vec2 radius) {
        return max(
          cloudMass(point, center, radius),
          max(
            cloudMass(point, center + vec2(-radius.x * 0.48, radius.y * 0.08), radius * 0.68),
            cloudMass(point, center + vec2(radius.x * 0.42, radius.y * 0.12), radius * 0.74)
          )
        );
      }

      void main() {
        vec3 direction = normalize(vDirection);
        float skyHeight = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);
        float gradient = smoothstep(0.10, 0.88, skyHeight);
        vec3 color = mix(uHorizonColor, uZenithColor, gradient);

        float sunFacing = max(dot(direction, uSunDirection), 0.0);
        color += uSunColor * pow(sunFacing, 256.0) * 0.75;
        color += uSunColor * pow(sunFacing, 18.0) * 0.07;

        float cloudBand = smoothstep(0.02, 0.24, direction.y)
          * (1.0 - smoothstep(0.68, 0.92, direction.y));
        vec2 cloudCoordinates = direction.xz / max(direction.y + 0.32, 0.16);
        float detail = cloudNoise(cloudCoordinates * 1.30);
        float masses = max(
          max(cloudCluster(vSkyUv, vec2(0.16, 0.80), vec2(0.12, 0.07)),
              cloudCluster(vSkyUv, vec2(0.40, 0.88), vec2(0.15, 0.08))),
          max(cloudCluster(vSkyUv, vec2(0.70, 0.78), vec2(0.13, 0.07)),
              cloudCluster(vSkyUv, vec2(0.88, 0.88), vec2(0.10, 0.06)))
        );
        float cloud = max(
          smoothstep(0.60, 0.76, detail) * 0.42,
          smoothstep(0.18, 0.55, masses) * (0.62 + 0.38 * smoothstep(0.45, 0.70, detail))
        ) * cloudBand;
        color = mix(color, uCloudColor, cloud);

        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false
  });
  sky.name = "hestia-surface-sky-material";
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
  const waterWet = water.clone();
  waterWet.name = "hestia-surface-wet-depression-material";
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
  const coastVegetationMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0,
    flatShading: true,
    vertexColors: true
  });
  coastVegetationMaterial.name = "hestia-coast-block-vegetation-material";

  return {
    skyDome,
    waterPatch,
    sprout,
    capStem,
    capCrown,
    coastUnderstory,
    coastTree,
    sky,
    water,
    waterWet,
    sproutMaterial,
    capStemMaterial,
    capCrownMaterial,
    coastVegetationMaterial
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
  const skyGroup = new THREE.Group();
  const terrainGroup = new THREE.Group();
  const waterGroup = new THREE.Group();
  const vegetationGroup = new THREE.Group();
  const decorativeVegetationGroup = new THREE.Group();
  const structuralVegetationGroup = new THREE.Group();
  const lightingGroup = new THREE.Group();
  root.name = HESTIA_SURFACE_ENVIRONMENT_NAMES.root;
  skyGroup.name = `${HESTIA_SURFACE_ENVIRONMENT_NAMES.sky}-root`;
  terrainGroup.name = HESTIA_SURFACE_ENVIRONMENT_NAMES.terrain;
  waterGroup.name = HESTIA_SURFACE_ENVIRONMENT_NAMES.water;
  vegetationGroup.name = HESTIA_SURFACE_ENVIRONMENT_NAMES.vegetation;
  decorativeVegetationGroup.name = HESTIA_SURFACE_ENVIRONMENT_NAMES.decorativeVegetation;
  structuralVegetationGroup.name = HESTIA_SURFACE_ENVIRONMENT_NAMES.structuralVegetation;
  lightingGroup.name = HESTIA_SURFACE_ENVIRONMENT_NAMES.lighting;
  terrainGroup.userData.sourceTerrainRoot = backend.terrainRoot.name;
  vegetationGroup.add(decorativeVegetationGroup, structuralVegetationGroup);
  root.add(skyGroup, terrainGroup, waterGroup, vegetationGroup, lightingGroup);
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
  const sky = new THREE.Mesh(resources.skyDome, resources.sky);
  sky.name = HESTIA_SURFACE_ENVIRONMENT_NAMES.sky;
  sky.renderOrder = -1_000;
  sky.frustumCulled = false;
  skyGroup.add(sky);
  let activeProfile: HestiaGeneratorProfile = HESTIA_PRESET_ID;
  let state: Readonly<HestiaSurfaceEnvironmentState> = Object.freeze({
    fogEnabled: true,
    waterEnabled: true,
    vegetationEnabled: true,
    terrainHashes: Object.freeze([])
  });
  let disposed = false;

  const applyProfile = (profile: HestiaGeneratorProfile): void => {
    activeProfile = profile;
    const coast = profile === HESTIA_COAST_LUSH_PRESET_ID;
    sky.visible = coast;
    if (coast) {
      background.setHex(0xc5eaf4);
      fog.color.setHex(0xa8cfd8);
      fog.near = 28;
      fog.far = 112;
      hemisphere.color.setHex(0xddf4ff);
      hemisphere.groundColor.setHex(0x8f9b6f);
      hemisphere.intensity = 1.8;
      ambient.color.setHex(0xa7cad2);
      ambient.intensity = 0.35;
      key.color.setHex(0xffe7b3);
      key.intensity = 3;
      rim.color.setHex(0xa6d9f5);
      rim.intensity = 0.55;
      resources.water.color.setHex(0xffffff);
      resources.water.opacity = 0.52;
      resources.water.shininess = 70;
      resources.water.vertexColors = true;
      resources.waterWet.color.setHex(0x3fb0b1);
      resources.waterWet.opacity = 0.58;
      resources.waterWet.shininess = 62;
      resources.waterWet.vertexColors = false;
    } else {
      background.setHex(0x071d22);
      fog.color.setHex(0x0b2b30);
      fog.near = 24;
      fog.far = 122;
      hemisphere.color.setHex(0x7fb5ad);
      hemisphere.groundColor.setHex(0x09120f);
      hemisphere.intensity = 1.18;
      ambient.color.setHex(0x355e58);
      ambient.intensity = 0.48;
      key.color.setHex(0xffbf78);
      key.intensity = 2.3;
      rim.color.setHex(0x4d9fa4);
      rim.intensity = 0.72;
      resources.water.color.setHex(0x236f78);
      resources.water.opacity = 0.38;
      resources.water.shininess = 30;
      resources.water.vertexColors = false;
      resources.waterWet.color.setHex(0x236f78);
      resources.waterWet.opacity = 0.38;
      resources.waterWet.shininess = 30;
    }
    resources.water.needsUpdate = true;
    resources.waterWet.needsUpdate = true;
    backend.scene.background = background;
    backend.scene.fog = fog;
  };

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
    const createWaterMesh = (
      patches: readonly Readonly<HestiaSurfaceWaterPatchPresentationFact>[],
      material: THREE.MeshPhongMaterial,
      name: string
    ): void => {
      if (patches.length === 0) return;
      const mesh = new THREE.InstancedMesh(resources.waterPatch, material, patches.length);
      mesh.name = name;
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      patches.forEach((patch, index) => {
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
    if (activeProfile !== HESTIA_COAST_LUSH_PRESET_ID) {
      createWaterMesh(snapshot.waterPatches, resources.water, "hestia-surface-water-patches");
      return;
    }
    createWaterMesh(
      snapshot.waterPatches.filter((patch) => patch.source === "Shore"),
      resources.water,
      "hestia-surface-shore-water-patches"
    );
    createWaterMesh(
      snapshot.waterPatches.filter((patch) => patch.source === "WetDepression"),
      resources.waterWet,
      "hestia-surface-wet-depression-patches"
    );
  };

  const rebuildVegetation = (snapshot: Readonly<HestiaSurfaceRegionPresentationSnapshot>): void => {
    decorativeVegetationGroup.clear();
    const sprouts = snapshot.scatter.filter((fact) => fact.kind === "cyan_luminous_sprout");
    const caps = snapshot.scatter.filter((fact) => fact.kind === "cyan_luminous_cap");

    if (activeProfile === HESTIA_COAST_LUSH_PRESET_ID) {
      const silhouetteScale = (id: string): number => {
        let value = 0;
        for (let index = 0; index < id.length; index += 1) value = (value + id.charCodeAt(index)) % 3;
        return [0.9, 1.15, 1.4][value] ?? 1;
      };
      const understory = createScatterInstances(
        "hestia-coast-block-understory",
        resources.coastUnderstory,
        resources.coastVegetationMaterial,
        sprouts,
        (fact, position, rotation, scale) => {
          position.set(fact.positionMeters.x, fact.positionMeters.y, fact.positionMeters.z);
          yawRotation(rotation, fact.yawRadians);
          scale.setScalar(fact.uniformScale * silhouetteScale(fact.id));
        }
      );
      const trees = createScatterInstances(
        "hestia-coast-tiered-block-trees",
        resources.coastTree,
        resources.coastVegetationMaterial,
        caps,
        (fact, position, rotation, scale) => {
          position.set(fact.positionMeters.x, fact.positionMeters.y, fact.positionMeters.z);
          yawRotation(rotation, fact.yawRadians);
          scale.setScalar(fact.uniformScale * silhouetteScale(fact.id));
        }
      );
      [understory, trees].forEach((mesh) => {
        if (mesh !== undefined) decorativeVegetationGroup.add(mesh);
      });
      return;
    }

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

    [mistSprouts, capStems, capCrowns]
      .forEach((mesh) => {
        if (mesh !== undefined) decorativeVegetationGroup.add(mesh);
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

    applyProfile(snapshot.profile);
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

  applyProfile(HESTIA_PRESET_ID);
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
