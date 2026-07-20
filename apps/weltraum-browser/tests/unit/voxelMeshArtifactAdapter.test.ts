import { describe, expect, it } from "vitest";
import { artifactRevision, type ArtifactRevision } from "../../src/presentation";
import {
  adoptMeshArtifactFromVoxelMeshProduct,
  createMeshArtifactFromVoxelMeshProduct
} from "../../src/voxel/meshArtifactAdapter";
import { calculateVoxelMeshContentHash } from "../../src/voxel/canonical";
import { voxelMaterialKey, voxelMeshRepresentationKey, sourceRevision, surfaceFrameId } from "../../src/voxel/ids";
import { VOXEL_MESH_ALGORITHM_VERSION, VOXEL_MESH_SCHEMA_VERSION, type VoxelMeshProduct } from "../../src/voxel/types";

const product = (): VoxelMeshProduct => {
  const content = {
    schemaVersion: VOXEL_MESH_SCHEMA_VERSION,
    representationKey: voxelMeshRepresentationKey("voxel_mesh:0123456789abcdef"),
    sourceRevision: sourceRevision(4),
    artifactRevision: 0 as VoxelMeshProduct["artifactRevision"],
    algorithmVersion: VOXEL_MESH_ALGORITHM_VERSION,
    frameId: surfaceFrameId("surface:local"),
    materialRegistryVersion: "hestia.materials.v1" as VoxelMeshProduct["materialRegistryVersion"],
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint16Array([0, 1, 2]),
    materialRanges: [{ materialId: 0 as VoxelMeshProduct["materialRanges"][number]["materialId"], materialKey: voxelMaterialKey("dark_rock"), startIndex: 0, indexCount: 3 }],
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } }
  };
  return Object.freeze({ ...content, contentHash: calculateVoxelMeshContentHash(content) });
};

const options = { materialProfileIdForKey: (key: string) => `surface:${key}` };

describe("VoxelMeshProduct MeshArtifact adapter", () => {
  it("snapshots shared buffers and adopts only exclusive full buffers without changing identity", () => {
    const shared = product();
    const snapshot = createMeshArtifactFromVoxelMeshProduct(shared, options);
    expect(snapshot.ownership).toBe("SnapshotOwned");
    expect(snapshot.representationKey).toBe(shared.representationKey);
    expect(snapshot.positions).not.toBe(shared.positions);
    expect(snapshot.materialRanges[0].materialProfileId).toBe("surface:dark_rock");
    expect(snapshot.contentHash).toBe(createMeshArtifactFromVoxelMeshProduct(shared, options).contentHash);
    shared.positions[0] = 99;
    expect(snapshot.positions[0]).toBe(0);

    const owned = product();
    const adopted = adoptMeshArtifactFromVoxelMeshProduct(owned, options);
    expect(adopted.ownership).toBe("AdoptedExclusive");
    expect(adopted.positions).toBe(owned.positions);
    expect(adopted.indices).toBe(owned.indices);
    expect(adopted.representationKey).toBe(owned.representationKey);
    expect(adopted.contentHash).toBe(snapshot.contentHash);
    expect(Array.from(adopted.positions)).toEqual(Array.from(snapshot.positions));
    expect(Array.from(adopted.indices)).toEqual(Array.from(snapshot.indices));
    expect(adopted.materialRanges).toEqual(snapshot.materialRanges);
  });

  it("overrides only the Presentation artifact revision for snapshots and adoptions", () => {
    const neutral = product();
    const defaultSnapshot = createMeshArtifactFromVoxelMeshProduct(neutral, options);
    const revision = artifactRevision(7);
    const overriddenSnapshot = createMeshArtifactFromVoxelMeshProduct(product(), { ...options, artifactRevision: revision });
    const overriddenAdoption = adoptMeshArtifactFromVoxelMeshProduct(product(), { ...options, artifactRevision: revision });

    expect(neutral.artifactRevision).toBe(0);
    expect(defaultSnapshot.artifactRevision).toBe(0);
    expect(overriddenSnapshot.artifactRevision).toBe(7);
    expect(overriddenAdoption.artifactRevision).toBe(7);
    for (const artifact of [overriddenSnapshot, overriddenAdoption]) {
      expect(artifact.representationKey).toBe(defaultSnapshot.representationKey);
      expect(artifact.sourceRevision).toBe(defaultSnapshot.sourceRevision);
      expect(artifact.contentHash).toBe(defaultSnapshot.contentHash);
      expect(artifact.algorithmVersion).toBe(defaultSnapshot.algorithmVersion);
      expect(artifact.frameId).toBe(defaultSnapshot.frameId);
      expect(artifact.positions).toEqual(defaultSnapshot.positions);
      expect(artifact.normals).toEqual(defaultSnapshot.normals);
      expect(artifact.indices).toEqual(defaultSnapshot.indices);
      expect(artifact.materialRanges).toEqual(defaultSnapshot.materialRanges);
      expect(artifact.bounds).toEqual(defaultSnapshot.bounds);
    }
    expect(overriddenSnapshot.ownership).toBe("SnapshotOwned");
    expect(overriddenAdoption.ownership).toBe("AdoptedExclusive");
    expect(() => createMeshArtifactFromVoxelMeshProduct(product(), {
      ...options,
      artifactRevision: -1 as ArtifactRevision
    })).toThrow("MeshArtifact is invalid");
  });

  it("fails closed for mapper mutation, empty products, invalid profile mapping, and adoption subviews", () => {
    const invalid = product();
    invalid.positions[0] = 0.5;
    expect(() => createMeshArtifactFromVoxelMeshProduct(invalid, options)).toThrow();
    expect(() => createMeshArtifactFromVoxelMeshProduct(product(), { materialProfileIdForKey: () => "INVALID PROFILE" })).toThrow();

    const mutated = product();
    expect(() => createMeshArtifactFromVoxelMeshProduct(mutated, {
      materialProfileIdForKey: () => {
        mutated.positions[0] = 0.25;
        return "surface:dark_rock";
      }
    })).toThrow();

    const empty = {
      ...product(),
      positions: new Float32Array(),
      normals: new Float32Array(),
      indices: new Uint16Array(),
      materialRanges: [],
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }
    } as unknown as VoxelMeshProduct;
    expect(() => createMeshArtifactFromVoxelMeshProduct(empty, options)).toThrow("empty geometry");

    const subview = product();
    const backing = new ArrayBuffer(subview.positions.byteLength + 4);
    const positions = new Float32Array(backing, 4, subview.positions.length);
    positions.set(subview.positions);
    expect(() => adoptMeshArtifactFromVoxelMeshProduct({ ...subview, positions }, options)).toThrow();
    expect(positions.buffer).toBe(backing);
  });
});
