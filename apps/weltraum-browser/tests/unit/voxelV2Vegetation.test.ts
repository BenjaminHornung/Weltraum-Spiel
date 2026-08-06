import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CHUNK_EDGE, VOXEL_SIZE_METERS } from "../../src/voxel-v2/domain/constants";
import { createMacroWorldDescriptor } from "../../src/voxel-v2/domain/macroDescriptor";
import type { EditChunkChange } from "../../src/voxel-v2/domain/types";
import { VOXEL_V2_WATER_PRESENTATION } from "../../src/voxel-v2/render-three/voxelV2Renderer";
import {
  createVoxelV2VegetationProjection,
  groupVoxelV2Vegetation,
  removeVoxelV2VegetationAnchors,
  voxelV2VegetationInvalidationKeys
} from "../../src/voxel-v2/render-three/voxelV2Vegetation";

const descriptor = createMacroWorldDescriptor("vegetation-test", "macro-v1");

const changeForCell = (x: number, y: number, z: number): EditChunkChange => {
  const chunk = {
    x: Math.floor(x / CHUNK_EDGE),
    y: Math.floor(y / CHUNK_EDGE),
    z: Math.floor(z / CHUNK_EDGE)
  };
  const local = {
    x: x - chunk.x * CHUNK_EDGE,
    y: y - chunk.y * CHUNK_EDGE,
    z: z - chunk.z * CHUNK_EDGE
  };
  return {
    key: `${chunk.x},${chunk.y},${chunk.z}`,
    coord: chunk,
    authorityRevision: 1,
    dirtyLocalAabb: { min: local, max: local },
    changedCells: [{ x, y, z }],
    contentSignature: "test"
  };
};

describe("Voxel V2 render-only vegetation", () => {
  it("projects deterministic bounded Mid/Far products with stable parent paths", () => {
    const first = createVoxelV2VegetationProjection(descriptor);
    const second = createVoxelV2VegetationProjection(createMacroWorldDescriptor("vegetation-test", "macro-v1"));

    expect(Object.isFrozen(first)).toBe(true);
    expect(first).toEqual(second);
    expect(first.anchors.length).toBeGreaterThan(0);
    expect(first.instances.length).toBeGreaterThan(first.anchors.length);
    expect(new Set(first.anchors.map((anchor) => anchor.band))).toEqual(new Set(["near", "mid", "far"]));
    expect(new Set(first.instances.map((instance) => instance.kind))).toEqual(new Set(["trunk", "canopy", "branch", "flora"]));
    for (const branch of first.instances.filter((instance) => instance.kind === "branch")) {
      expect(branch.scale.y).toBeGreaterThan(branch.scale.x);
      expect(branch.rotation.x).toBeCloseTo(Math.PI / 2, 6);
      expect(branch.rotation.y).toBeCloseTo(0, 6);
      const anchor = first.anchors.find((candidate) => candidate.id === branch.anchorId)!;
      const base = new THREE.Vector3(
        (anchor.base.x + 0.5) * VOXEL_SIZE_METERS,
        0,
        (anchor.base.z + 0.5) * VOXEL_SIZE_METERS
      );
      const intended = new THREE.Vector3(branch.position.x, 0, branch.position.z).sub(base).normalize();
      const transformed = new THREE.Vector3(0, 1, 0)
        .applyEuler(new THREE.Euler(branch.rotation.x, branch.rotation.y, branch.rotation.z))
        .normalize();
      expect(transformed.dot(intended)).toBeGreaterThan(0.99);
    }

    const instanceIds = new Set(first.instances.map((instance) => instance.id));
    for (const instance of first.instances) {
      if (instance.parentId !== null) expect(instanceIds.has(instance.parentId)).toBe(true);
    }
    for (const anchor of first.anchors) {
      const radius = Math.hypot(
        (anchor.base.x + 0.5) * VOXEL_SIZE_METERS,
        (anchor.base.z + 0.5) * VOXEL_SIZE_METERS
      );
      expect(radius).toBeGreaterThanOrEqual(anchor.band === "near" ? 0 : anchor.band === "mid" ? 40 : 96);
      expect(radius).toBeLessThanOrEqual(320);
      const sample = descriptor.sample(
        (anchor.base.x + 0.5) * VOXEL_SIZE_METERS,
        (anchor.base.z + 0.5) * VOXEL_SIZE_METERS
      );
      expect(sample.isWater).toBe(false);
      expect(sample.spawnClearing).toBe(false);
    }
  });

  it("groups render products without creating per-instance resources", () => {
    const projection = createVoxelV2VegetationProjection(descriptor);
    const batches = groupVoxelV2Vegetation(projection);
    const keys = batches.map((batch) => `${batch.band}:${batch.kind}`);

    expect(batches.length).toBeLessThanOrEqual(12);
    expect(new Set(keys).size).toBe(keys.length);
    expect(batches.every((batch) => batch.instances.length > 0)).toBe(true);
    expect(keys).toEqual([...keys].sort());
  });

  it("omits water and spawn-clearing products instead of rewriting their bases", () => {
    const source = createMacroWorldDescriptor("vegetation-test", "macro-v1");
    const unsupported = {
      ...source,
      sample: (xMeters: number, zMeters: number) => ({
        ...source.sample(xMeters, zMeters),
        isWater: true,
        spawnClearing: true,
        terrainFamily: "water" as const
      })
    };

    const projection = createVoxelV2VegetationProjection(unsupported);
    expect(projection.anchors).toHaveLength(0);
    expect(projection.instances).toHaveLength(0);
  });

  it("intersects dirty bounds after signed chunk-to-global conversion", () => {
    const projection = createVoxelV2VegetationProjection(descriptor);
    const negativeAnchor = projection.anchors.find((anchor) => anchor.base.x < 0 || anchor.base.z < 0);
    expect(negativeAnchor).toBeDefined();
    const matching = changeForCell(negativeAnchor!.base.x, negativeAnchor!.base.y, negativeAnchor!.base.z);
    const supportChange = changeForCell(negativeAnchor!.base.x, negativeAnchor!.base.y - 1, negativeAnchor!.base.z);

    expect(voxelV2VegetationInvalidationKeys(projection, [matching])).toContain(negativeAnchor!.id);
    expect(voxelV2VegetationInvalidationKeys(projection, [supportChange])).toContain(negativeAnchor!.id);
    expect(voxelV2VegetationInvalidationKeys(projection, [changeForCell(negativeAnchor!.base.x, negativeAnchor!.base.y + 1, negativeAnchor!.base.z)])).toEqual([]);
    expect(voxelV2VegetationInvalidationKeys(projection, [])).toEqual([]);

    const filtered = removeVoxelV2VegetationAnchors(projection, [negativeAnchor!.id]);
    expect(filtered.anchors.some((anchor) => anchor.id === negativeAnchor!.id)).toBe(false);
    expect(filtered.instances.some((instance) => instance.anchorId === negativeAnchor!.id)).toBe(false);
  });
});

describe("Voxel V2 water presentation", () => {
  it("keeps bounded physical Fresnel/glint configuration data", () => {
    expect(VOXEL_V2_WATER_PRESENTATION.clearcoat).toBeGreaterThan(0);
    expect(VOXEL_V2_WATER_PRESENTATION.ior).toBeGreaterThan(1);
    expect(VOXEL_V2_WATER_PRESENTATION.reflectivity).toBeGreaterThan(0);
    expect(VOXEL_V2_WATER_PRESENTATION.opacity).toBeGreaterThan(0);
    expect(VOXEL_V2_WATER_PRESENTATION.opacity).toBeLessThan(1);
  });
});
