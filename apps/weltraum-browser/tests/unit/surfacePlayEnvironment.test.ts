import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  HESTIA_SURFACE_ENVIRONMENT_NAMES,
  createHestiaSurfaceEnvironment,
  createHestiaSurfacePresentationSnapshot,
  type HestiaSurfaceRegionPresentationSnapshot
} from "../../src/surface-play/environment";
import { createSurfaceTerrainPresentationSnapshot } from "../../src/surface-play/contracts";

const identity = Object.freeze({
  bodyId: "planet.hestia",
  regionId: "region:hestia.surface-play.v1",
  surfaceFrameId: "frame:surface_hestia_surface_play_v1"
});

const coordinates = Object.freeze(
  [-2, -1, 0, 1].flatMap((z) => [-2, -1, 0, 1].map((x) => ({ x, y: -1, z })))
);

const presentation = (
  revision = 3,
  seed = "hestia-surface-play-v1",
  hashSuffix = "a"
): Readonly<HestiaSurfaceRegionPresentationSnapshot> => {
  const bricks = coordinates.map((coordinate, index) => ({
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
    rootSeed: seed,
    voxelSizeMeters: 0.5,
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
    const lighting = target.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.lighting) as THREE.Group;

    expect(root).toBeInstanceOf(THREE.Group);
    expect(terrain.userData.sourceTerrainRoot).toBe(target.terrainRoot.name);
    expect(target.terrainRoot.parent).toBe(target.scene);
    expect(water.children).toHaveLength(1);
    expect(water.children[0]).toBeInstanceOf(THREE.InstancedMesh);
    expect((water.children[0] as THREE.InstancedMesh).count).toBe(snapshot.waterPatches.length);
    expect(vegetation.children.length).toBeGreaterThan(2);
    expect(vegetation.children.every((child) => child instanceof THREE.InstancedMesh)).toBe(true);
    expect(vegetation.getObjectByName("hestia-surface-umbrella-tree-trunks")).toBeInstanceOf(THREE.InstancedMesh);
    const lowerCanopy = vegetation.getObjectByName("hestia-surface-umbrella-tree-lower-canopies") as THREE.InstancedMesh;
    const upperCanopy = vegetation.getObjectByName("hestia-surface-umbrella-tree-upper-canopies") as THREE.InstancedMesh;
    expect(lowerCanopy).toBeInstanceOf(THREE.InstancedMesh);
    expect(upperCanopy).toBeInstanceOf(THREE.InstancedMesh);
    expect(lowerCanopy.geometry).toBeInstanceOf(THREE.SphereGeometry);
    expect(lowerCanopy.geometry).not.toBeInstanceOf(THREE.ConeGeometry);

    expect(target.scene.background).toBeInstanceOf(THREE.Color);
    expect((target.scene.background as THREE.Color).getHex()).toBe(0x071d22);
    expect(target.scene.fog).toBeInstanceOf(THREE.Fog);
    expect((target.scene.fog as THREE.Fog).color.getHex()).toBe(0x0b2b30);
    const key = lighting.getObjectByName("hestia-surface-aurelia-key-light") as THREE.DirectionalLight;
    const rim = lighting.getObjectByName("hestia-surface-cool-rim-light") as THREE.DirectionalLight;
    expect(key.color.getHex()).toBe(0xffbf78);
    expect(key.intensity).toBe(2.3);
    expect(rim.color.getHex()).toBe(0x4d9fa4);
    expect(rim.intensity).toBe(0.72);
    environment.dispose();
  });

  it("keeps camera and visibility state outside world facts and rebuild identity", () => {
    const target = backend();
    const environment = createHestiaSurfaceEnvironment(target, identity);
    const snapshot = presentation();
    const inputHashes = snapshot.bricks.map((brick) => brick.terrainHash);
    environment.sync(snapshot);
    const signature = environment.readState().presentationSignature;
    const vegetation = target.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.vegetation) as THREE.Group;
    const originalChildren = [...vegetation.children];
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
    expect(vegetation.children).toEqual(originalChildren);
    expect(environment.sync(snapshot)).toBe("Unchanged");
    expect(vegetation.children).toEqual(originalChildren);
    environment.dispose();
  });

  it("rejects stale, conflicting and mismatched snapshots without replacing newer presentation", () => {
    const target = backend();
    const environment = createHestiaSurfaceEnvironment(target, identity);
    const current = presentation(4);
    expect(environment.sync(current)).toBe("Applied");
    const vegetation = target.scene.getObjectByName(HESTIA_SURFACE_ENVIRONMENT_NAMES.vegetation) as THREE.Group;
    const currentChildren = [...vegetation.children];

    expect(environment.sync(presentation(3, "older-seed", "older"))).toBe("Stale");
    expect(environment.sync(presentation(4, "conflicting-seed", "conflict"))).toBe("ConflictingRevision");
    const mismatched = createHestiaSurfacePresentationSnapshot({
      terrain: createSurfaceTerrainPresentationSnapshot({
        ...identity,
        regionId: "region:hestia.other",
        regionRevision: 5,
        visibleBrickIds: ["brick:other"]
      }),
      rootSeed: "other",
      voxelSizeMeters: 0.5,
      bricks: [{ brickId: "brick:other", coordinate: { x: 0, y: -1, z: 0 }, terrainHash: "other-hash" }]
    });
    expect(environment.sync(mismatched)).toBe("IdentityMismatch");
    expect(vegetation.children).toEqual(currentChildren);

    expect(environment.sync(presentation(5, "newer-seed", "newer"))).toBe("Applied");
    expect(vegetation.children).not.toEqual(currentChildren);
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
