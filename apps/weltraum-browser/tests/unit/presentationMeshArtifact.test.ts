import { describe, expect, it } from "vitest";
import {
  artifactRevision,
  createMeshArtifact,
  frameId,
  materialProfileId,
  representationKey,
  sourceRevision,
  validateMeshArtifact,
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
  it("accepts a valid typed-array artifact without copying or mutating caller buffers", () => {
    const input = meshInput();
    const before = Array.from(input.positions);
    const artifact = createMeshArtifact(input);

    expect(validateMeshArtifact(artifact)).toEqual({ valid: true });
    expect(artifact.positions).toBe(input.positions);
    expect(artifact.normals).toBe(input.normals);
    expect(artifact.indices).toBe(input.indices);
    expect(artifact.attributes?.uv).toBe(input.attributes?.uv);
    expect(Array.from(input.positions)).toEqual(before);
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(Object.isFrozen(artifact.bounds)).toBe(true);
    expect(Object.isFrozen(artifact.materialRanges)).toBe(true);
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
