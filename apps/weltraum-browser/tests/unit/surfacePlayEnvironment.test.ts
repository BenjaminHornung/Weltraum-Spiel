import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  HESTIA_SURFACE_ENVIRONMENT_NAMES,
  createHestiaSurfaceEnvironment,
  createHestiaSurfacePresentationSnapshot,
  type HestiaSurfaceRegionPresentationSnapshot
} from "../../src/surface-play/environment";
import { HESTIA_COAST_LUSH_PRESET_ID } from "../../src/world-generation/hestia";
import { createSurfaceTerrainPresentationSnapshot } from "../../src/surface-play/contracts";
import {
  selectHestiaSurfaceWorld,
  type HestiaSurfaceWorldFacts
} from "../../src/surface-play/world";

const identity = Object.freeze({
  bodyId: "planet.hestia",
  regionId: "region:hestia.surface-play.v1",
  surfaceFrameId: "frame:surface_hestia_surface_play_v1"
});

const worlds = new Map<string, Readonly<HestiaSurfaceWorldFacts>>();
const worldFor = (
  revision: number,
  seed: string,
  worldIdentity: Readonly<{
    readonly bodyId: string;
    readonly regionId: string;
    readonly surfaceFrameId: string;
  }> = identity
): Readonly<HestiaSurfaceWorldFacts> => {
  const key = `${worldIdentity.bodyId}:${worldIdentity.regionId}:${worldIdentity.surfaceFrameId}:${revision}:${seed}`;
  const cached = worlds.get(key);
  if (cached !== undefined) return cached;
  const result = selectHestiaSurfaceWorld({
    identity: { ...worldIdentity, regionRevision: revision },
    rootSeed: seed,
    voxelSizeMeters: 0.5,
    frameOriginMeters: { x: 0, y: 0, z: 0 },
    waterSurfaceHeightMeters: 0,
    probe: {
      sampleGround: () => ({
        heightMeters: 8,
        normal: { x: 0, y: 1, z: 0 },
        capsuleClear: true
      })
    }
  });
  if (result.status !== "Selected") throw new Error(result.failure.message);
  worlds.set(key, result.world);
  return result.world;
};

const presentation = (
  revision = 3,
  seed = "hestia-surface-play-v1",
  hashSuffix = "a",
  profile?: typeof HESTIA_COAST_LUSH_PRESET_ID
): Readonly<HestiaSurfaceRegionPresentationSnapshot> => {
  const world = worldFor(revision, seed);
  const bricks = world.residentBrickCoordinates.map((coordinate, index) => ({
    brickId: `brick:hestia:${index}`,
    coordinate,
    terrainHash: `terrain-hash:${index}:${hashSuffix}`
  }));
  return createHestiaSurfacePresentationSnapshot({
    terrain: createSurfaceTerrainPresentationSnapshot({
      ...identity,
      regionRevision: revision,
      visibleBrickIds: bricks.map((brick) => brick.brickId)
    }),
    world,
    ...(profile === undefined ? {} : { profile }),
    bricks
  });
};

const backend = () => {
  const scene = new THREE.Scene();
  const terrainRoot = new THREE.Group();
  terrainRoot.name = "authoritative-hestia-terrain-root";
  const geometry = new THREE.BoxGeometry(4, 2, 4);
  const material = new THREE.MeshStandardMaterial({ color: 0x123456 });
  terrainRoot.add(new THREE.Mesh(geometry, material));
  scene.add(terrainRoot);
  return { scene, terrainRoot, geometry, material };
};

describe("Hestia surface environment", () => {
  it("builds stable presentation groups, restrained lights and instanced water and vegetation", () => {
    const target = backend();
    const environment = createHestiaSurfaceEnvironment(target, identity);
    const snapshot = presentation();

    expect(environment.sync(snapshot)).toBe("Applied");
    const root = target.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.root) as THREE.Group;
    const terrain = target.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.terrain) as THREE.Group;
    const water = target.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.water) as THREE.Group;
    const vegetation = target.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.vegetation) as THREE.Group;
    const decorativeVegetation = target.scene.getObjectByName(
      HESTIA_SURFACE_ENVIRONMENT_NAMES.decorativeVegetation
    ) as THREE.Group;
    const structuralVegetation = target.scene.getObjectByName(
      HESTIA_SURFACE_ENVIRONMENT_NAMES.structuralVegetation
    ) as THREE.Group;
    const sky = target.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.sky) as THREE.Mesh;
    const lighting = target.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.lighting) as THREE.Group;

    expect(root).toBeInstanceOf(THREE.Group);
    expect(sky).toBeInstanceOf(THREE.Mesh);
    expect(sky.frustumCulled).toBe(false);
    const skyMaterial = sky.material as THREE.ShaderMaterial;
    expect(skyMaterial).toBeInstanceOf(THREE.ShaderMaterial);
    expect(skyMaterial.side).toBe(THREE.BackSide);
    expect(skyMaterial.depthWrite).toBe(false);
    expect(skyMaterial.depthTest).toBe(false);
    expect((skyMaterial.uniforms.uHorizonColor?.value as THREE.Color).getHex()).toBe(0xc5eaf4);
    expect((skyMaterial.uniforms.uZenithColor?.value as THREE.Color).getHex()).toBe(0x4b9fd8);
    expect((skyMaterial.uniforms.uCloudColor?.value as THREE.Color).getHex()).toBe(0xf7faf4);
    expect(terrain.userData.sourceTerrainRoot).toBe(target.terrainRoot.name);
    expect(target.terrainRoot.parent).toBe(target.scene);
    expect(water.children).toHaveLength(1);
    expect(water.children[0]).toBeInstanceOf(THREE.InstancedMesh);
    expect((water.children[0] as THREE.InstancedMesh).count).toBe(snapshot.waterPatches.length);
    expect(vegetation.children).toEqual([decorativeVegetation, structuralVegetation]);
    expect(decorativeVegetation.children.length).toBeGreaterThan(0);
    expect(decorativeVegetation.children.every((child) => child instanceof THREE.InstancedMesh)).toBe(true);
    expect(structuralVegetation.children).toHaveLength(0);
    expect(vegetation.getObjectByName("hestia-surface-umbrella-tree-trunks")).toBeUndefined();
    expect(vegetation.getObjectByName("hestia-surface-umbrella-tree-lower-canopies")).toBeUndefined();
    expect(vegetation.getObjectByName("hestia-surface-umbrella-tree-upper-canopies")).toBeUndefined();

    expect(target.scene.background).toBeInstanceOf(THREE.Color);
    expect((target.scene.background as THREE.Color).getHex()).toBe(0x071d22);
    expect(target.scene.fog).toBeInstanceOf(THREE.Fog);
    expect((target.scene.fog as THREE.Fog).color.getHex()).toBe(0x0b2b30);
    expect((target.scene.fog as THREE.Fog).near).toBe(24);
    expect((target.scene.fog as THREE.Fog).far).toBe(122);
    const key = lighting.getObjectByName("hestia-surface-aurelia-key-light") as THREE.DirectionalLight;
    const rim = lighting.getObjectByName("hestia-surface-cool-rim-light") as THREE.DirectionalLight;
    expect(key.color.getHex()).toBe(0xffbf78);
    expect(key.intensity).toBe(2.3);
    expect(rim.color.getHex()).toBe(0x4d9fa4);
    expect(rim.intensity).toBe(0.72);
    environment.dispose();
  });

  it("projects the Coast/Lush palette, atmosphere and disjoint water sources", () => {
    const target = backend();
    const environment = createHestiaSurfaceEnvironment(target, identity);
    const coast = presentation(3, "hestia-surface-play-v1", "a", HESTIA_COAST_LUSH_PRESET_ID);

    expect(environment.sync(coast)).toBe("Applied");
    const sky = target.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.sky) as THREE.Mesh;
    const water = target.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.water) as THREE.Group;
    const decorativeVegetation = target.scene.getObjectByName(
      HESTIA_SURFACE_ENVIRONMENT_NAMES.decorativeVegetation
    ) as THREE.Group;
    expect(sky.visible).toBe(true);
    const skyMaterial = sky.material as THREE.ShaderMaterial;
    expect((skyMaterial.uniforms.uHorizonColor?.value as THREE.Color).getHex()).toBe(0xc5eaf4);
    expect((skyMaterial.uniforms.uZenithColor?.value as THREE.Color).getHex()).toBe(0x4b9fd8);
    expect((skyMaterial.uniforms.uCloudColor?.value as THREE.Color).getHex()).toBe(0xf7faf4);
    expect(skyMaterial.fragmentShader.match(/cloudCluster\(/g)).toHaveLength(5);
    expect((target.scene.fog as THREE.Fog).color.getHex()).toBe(0xa8cfd8);
    expect((target.scene.fog as THREE.Fog).near).toBe(28);
    expect((target.scene.fog as THREE.Fog).far).toBe(112);
    expect(water.children.length).toBeLessThanOrEqual(2);
    expect(water.children.every((child) => child instanceof THREE.InstancedMesh)).toBe(true);
    expect(water.children.map((child) => (child as THREE.InstancedMesh).material as THREE.MeshPhongMaterial))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ opacity: 0.52 }),
        expect.objectContaining({ opacity: 0.58 })
      ]));
    const shore = water.getObjectByName("hestia-surface-shore-water-patches") as THREE.InstancedMesh;
    expect((shore.material as THREE.MeshPhongMaterial).vertexColors).toBe(true);
    expect(shore.geometry.getAttribute("color")).toBeInstanceOf(THREE.BufferAttribute);
    const expectedVegetationNames = [
      ...(coast.scatter.some((fact) => fact.kind === "cyan_luminous_sprout")
        ? ["hestia-coast-block-understory"]
        : []),
      ...(coast.scatter.some((fact) => fact.kind === "cyan_luminous_cap")
        ? ["hestia-coast-tiered-block-trees"]
        : [])
    ];
    expect(decorativeVegetation.children.map((child) => child.name)).toEqual(expectedVegetationNames);
    expect(decorativeVegetation.children.every((child) => child instanceof THREE.InstancedMesh)).toBe(true);
    expect(water.children.length + decorativeVegetation.children.length).toBeLessThanOrEqual(4);
    const tieredTrees = decorativeVegetation.getObjectByName("hestia-coast-tiered-block-trees") as
      | THREE.InstancedMesh
      | undefined;
    if (tieredTrees !== undefined) {
      tieredTrees.geometry.computeBoundingBox();
      expect(tieredTrees.geometry.boundingBox?.max.y).toBeGreaterThanOrEqual(6);
    }
    environment.dispose();
  });

  it("keeps camera and visibility state outside world facts and rebuild identity", () => {
    const target = backend();
    const environment = createHestiaSurfaceEnvironment(target, identity);
    const snapshot = presentation();
    const inputHashes = snapshot.bricks.map((brick) => brick.terrainHash);
    environment.sync(snapshot);
    const signature = environment.readState().presentationSignature;
    const decorativeVegetation = target.scene.getObjectByName(
      HESTIA_SURFACE_ENVIRONMENT_NAMES.decorativeVegetation
    ) as THREE.Group;
    const originalChildren = [...decorativeVegetation.children];
    const camera = new THREE.PerspectiveCamera();

    camera.position.set(12, 8, -4);
    camera.rotation.set(0.2, 1.1, 0);
    environment.setFogEnabled(false);
    environment.setWaterEnabled(false);
    environment.setVegetationEnabled(false);

    expect(environment.readState()).toMatchObject({
      fogEnabled: false,
      waterEnabled: false,
      vegetationEnabled: false,
      presentationSignature: signature,
      terrainHashes: inputHashes
    });
    expect(snapshot.bricks.map((brick) => brick.terrainHash)).toEqual(inputHashes);
    expect(decorativeVegetation.children).toEqual(originalChildren);
    expect(environment.sync(snapshot)).toBe("Unchanged");
    expect(decorativeVegetation.children).toEqual(originalChildren);
    environment.dispose();
  });

  it("rejects stale, conflicting and mismatched snapshots without replacing newer presentation", () => {
    const target = backend();
    const environment = createHestiaSurfaceEnvironment(target, identity);
    const current = presentation(4);
    expect(environment.sync(current)).toBe("Applied");
    const decorativeVegetation = target.scene.getObjectByName(
      HESTIA_SURFACE_ENVIRONMENT_NAMES.decorativeVegetation
    ) as THREE.Group;
    const currentChildren = [...decorativeVegetation.children];

    expect(environment.sync(presentation(3, "older-seed", "older"))).toBe("Stale");
    expect(environment.sync(presentation(4, "conflicting-seed", "conflict"))).toBe("ConflictingRevision");
    const mismatchedWorld = worldFor(5, "other", { ...identity, regionId: "region:hestia.other" });
    const mismatchedBricks = mismatchedWorld.residentBrickCoordinates.map((coordinate, index) => ({
      brickId: index === 0 ? "brick:other" : `brick:other:${index}`,
      coordinate,
      terrainHash: `other-hash:${index}`
    }));
    const mismatched = createHestiaSurfacePresentationSnapshot({
      terrain: createSurfaceTerrainPresentationSnapshot({
        ...identity,
        regionId: "region:hestia.other",
        regionRevision: 5,
        visibleBrickIds: mismatchedBricks.map((brick) => brick.brickId)
      }),
      world: mismatchedWorld,
      bricks: mismatchedBricks
    });
    expect(environment.sync(mismatched)).toBe("IdentityMismatch");
    expect(decorativeVegetation.children).toEqual(currentChildren);

    expect(environment.sync(presentation(5, "newer-seed", "newer"))).toBe("Applied");
    expect(decorativeVegetation.children).not.toEqual(currentChildren);
    expect(environment.readState().regionRevision).toBe(5);
    environment.dispose();
  });

  it("disposes every owned geometry and material once while preserving terrain authority", () => {
    const target = backend();
    const priorBackground = new THREE.Color(0x010203);
    const priorFog = new THREE.Fog(0x040506, 2, 30);
    target.scene.background = priorBackground;
    target.scene.fog = priorFog;
    const terrainGeometryDispose = vi.spyOn(target.geometry, "dispose");
    const terrainMaterialDispose = vi.spyOn(target.material, "dispose");
    const environment = createHestiaSurfaceEnvironment(target, identity);
    environment.sync(presentation());
    const root = target.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.root) as THREE.Group;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      sourceMaterials.forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => vi.spyOn(geometry, "dispose"));
    materials.forEach((material) => vi.spyOn(material, "dispose"));

    environment.dispose();
    environment.dispose();

    expect(target.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.root)).toBeUndefined();
    expect(target.scene.background).toBe(priorBackground);
    expect(target.scene.fog).toBe(priorFog);
    expect(target.terrainRoot.parent).toBe(target.scene);
    expect(terrainGeometryDispose).not.toHaveBeenCalled();
    expect(terrainMaterialDispose).not.toHaveBeenCalled();
    geometries.forEach((geometry) => expect(geometry.dispose).toHaveBeenCalledOnce());
    materials.forEach((material) => expect(material.dispose).toHaveBeenCalledOnce());
    expect(environment.sync(presentation(6))).toBe("Disposed");
  });

  it("exposes presentation lifecycle only and no gameplay command surface", () => {
    const target = backend();
    const environment = createHestiaSurfaceEnvironment(target, identity);
    expect(Object.keys(environment).sort()).toEqual([
      "dispose",
      "readState",
      "setFogEnabled",
      "setVegetationEnabled",
      "setWaterEnabled",
      "sync"
    ]);
    expect(Object.keys(environment).join(" ")).not.toMatch(/fire|damage|collision|edit|command/i);
    environment.dispose();
  });
});
