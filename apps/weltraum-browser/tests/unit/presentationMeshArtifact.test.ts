import { describe, expect, it } from "vitest";
import {
  artifactRevision,
  adoptMeshArtifactBuffers,
  createMeshArtifact,
  frameId,
  materialProfileId,
  representationKey,
  sourceRevision,
  validateMeshArtifact,
  type MeshArtifactOwnership,
  type MeshArtifact,
  type MeshArtifactInput
} from "../../src/presentation";

const meshInput = (): MeshArtifactInput => ({
  representationKey: representationKey("planet:parent"),
  sourceRevision: sourceRevision(1),
  artifactRevision: artifactRevision(2),
  algorithmVersion: "mesh:v1",
  frameId: frameId("camera:local"),
  positions: new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint16Array([0, 1, 2]),
  attributes: {
    uv: new Float32Array([0, 0, 1, 0, 0.5, 1]),
    color: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
  },
  materialRanges: [{ materialProfileId: materialProfileId("terrain:base"), startIndex: 0, indexCount: 3 }],
  bounds: { min: { x: -1, y: -1, z: 0 }, max: { x: 1, y: 1, z: 0 } }
});

describe("MeshArtifact", () => {
  it("exports the two explicit ownership semantics", () => {
    const modes: readonly MeshArtifactOwnership[] = ["SnapshotOwned", "AdoptedExclusive"];
    expect(modes).toEqual(["SnapshotOwned", "AdoptedExclusive"]);
  });

  it("creates a SnapshotOwned artifact with one defensive copy per caller array", () => {
    const input = meshInput();
    const artifact = createMeshArtifact(input);
    const hash = artifact.contentHash;
    const snapshotPositions = Array.from(artifact.positions);
    const snapshotIndices = Array.from(artifact.indices);
    const snapshotUv = Array.from(artifact.attributes?.uv ?? []);
    const snapshotColor = Array.from(artifact.attributes?.color ?? []);

    expect(validateMeshArtifact(artifact)).toEqual({ valid: true });
    expect(artifact.ownership).toBe("SnapshotOwned");
    expect(artifact.positions).not.toBe(input.positions);
    expect(artifact.normals).not.toBe(input.normals);
    expect(artifact.indices).not.toBe(input.indices);
    expect(artifact.attributes?.uv).not.toBe(input.attributes?.uv);
    expect(artifact.attributes?.color).not.toBe(input.attributes?.color);
    expect(artifact.positions.buffer).not.toBe(input.positions.buffer);
    expect(artifact.indices.buffer).not.toBe(input.indices.buffer);
    expect(input.positions.buffer.byteLength).toBe(36);
    expect(input.indices.buffer.byteLength).toBe(6);

    input.positions[0] = 99;
    input.indices[0] = 2;
    input.attributes!.uv![0] = 99;
    input.attributes!.color![0] = 99;
    (input.bounds.min as { x: number }).x = 99;
    (input.materialRanges[0] as { startIndex: number }).startIndex = 3;
    expect(Array.from(artifact.positions)).toEqual(snapshotPositions);
    expect(Array.from(artifact.indices)).toEqual(snapshotIndices);
    expect(Array.from(artifact.attributes?.uv ?? [])).toEqual(snapshotUv);
    expect(Array.from(artifact.attributes?.color ?? [])).toEqual(snapshotColor);
    expect(artifact.bounds.min.x).toBe(-1);
    expect(artifact.materialRanges[0].startIndex).toBe(0);
    expect(artifact.contentHash).toBe(hash);
    expect(validateMeshArtifact(artifact)).toEqual({ valid: true });
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(Object.isFrozen(artifact.bounds)).toBe(true);
    expect(Object.isFrozen(artifact.materialRanges)).toBe(true);
  });

  it("adopts exclusive worker buffers without copying", () => {
    const input = meshInput();
    const artifact = adoptMeshArtifactBuffers(input);

    expect(artifact.ownership).toBe("AdoptedExclusive");
    expect(artifact.positions).toBe(input.positions);
    expect(artifact.normals).toBe(input.normals);
    expect(artifact.indices).toBe(input.indices);
    expect(artifact.attributes?.uv).toBe(input.attributes?.uv);
    expect(artifact.attributes?.color).toBe(input.attributes?.color);
    expect(artifact.positions.buffer).toBe(input.positions.buffer);
    expect(artifact.indices.buffer).toBe(input.indices.buffer);
    expect(validateMeshArtifact(artifact)).toEqual({ valid: true });
  });

  it("rejects adoption of a subview while leaving the caller buffer attached", () => {
    const input = meshInput();
    const backing = new ArrayBuffer(input.positions.byteLength + 4);
    const positions = new Float32Array(backing, 4, input.positions.length);
    positions.set(input.positions);

    expect(() => adoptMeshArtifactBuffers({ ...input, positions })).toThrow();
    expect(positions.buffer).toBe(backing);
    expect(positions.byteOffset).toBe(4);
    expect(positions.byteLength).toBe(input.positions.byteLength);
  });

  it("rejects a non-finite position", () => {
    const valid = createMeshArtifact(meshInput());
    const positions = new Float32Array(valid.positions);
    positions[1] = Number.NaN;
    const result = validateMeshArtifact({ ...valid, positions } as MeshArtifact);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.map((entry) => entry.code)).toContain("NonFiniteAttribute");
  });

  it("rejects an index outside the vertex range", () => {
    const valid = createMeshArtifact(meshInput());
    const result = validateMeshArtifact({ ...valid, indices: new Uint16Array([0, 1, 3]) } as MeshArtifact);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.map((entry) => entry.code)).toContain("IndexOutOfRange");
  });

  it("rejects inconsistent optional attribute lengths", () => {
    const valid = createMeshArtifact(meshInput());
    const result = validateMeshArtifact({ ...valid, attributes: { ...valid.attributes, uv: new Float32Array([0, 0]) } } as MeshArtifact);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.map((entry) => entry.code)).toContain("InconsistentAttributeLength");
  });

  it("requires bounds to contain every vertex", () => {
    const valid = createMeshArtifact(meshInput());
    const result = validateMeshArtifact({ ...valid, bounds: { min: { x: -0.5, y: -1, z: 0 }, max: valid.bounds.max } } as MeshArtifact);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.map((entry) => entry.code)).toContain("BoundsExcludeVertex");
  });

  it("rejects gaps and non-triangle-aligned material ranges", () => {
    const input: MeshArtifactInput = {
      ...meshInput(),
      materialRanges: [
        { materialProfileId: materialProfileId("terrain:a"), startIndex: 0, indexCount: 1 },
        { materialProfileId: materialProfileId("terrain:b"), startIndex: 2, indexCount: 1 }
      ]
    };
    expect(() => createMeshArtifact(input)).toThrow();
  });

  it("accepts Uint32 indices and rejects subviews or aliased buffers", () => {
    const uint32: MeshArtifactInput = { ...meshInput(), indices: new Uint32Array([0, 1, 2]) };
    expect(validateMeshArtifact(createMeshArtifact(uint32))).toEqual({ valid: true });

    const valid = createMeshArtifact(meshInput());
    const backing = new ArrayBuffer(48);
    const positions = new Float32Array(backing, 0, 9);
    positions.set(valid.positions);
    const subview = validateMeshArtifact({ ...valid, positions } as MeshArtifact);
    expect(subview.valid).toBe(false);
    if (!subview.valid) expect(subview.issues.map((entry) => entry.code)).toContain("SubviewBufferUnsupported");

    const sharedBacking = new ArrayBuffer(36);
    const aliasedPositions = new Float32Array(sharedBacking);
    aliasedPositions.set(valid.positions);
    const aliasedNormals = new Float32Array(sharedBacking);
    const alias = validateMeshArtifact({ ...valid, positions: aliasedPositions, normals: aliasedNormals } as MeshArtifact);
    expect(alias.valid).toBe(false);
    if (!alias.valid) expect(alias.issues.map((entry) => entry.code)).toContain("AliasedBufferUnsupported");
  });
});
