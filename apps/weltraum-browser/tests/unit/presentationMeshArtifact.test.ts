import { describe, expect, it } from "vitest";
import * as artifactModule from "../../src/presentation/meshArtifact";
import {
  artifactRevision,
  adoptMeshArtifactBuffers,
  createMeshArtifact,
  ephemeralRepresentationKey,
  frameId,
  materialProfileId,
  representationKey,
  sourceRevision,
  validateRepresentationKey,
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
  it("reads the public claimed hash before traversing hash content and preserves getter failures", () => {
    const artifact = createMeshArtifact(meshInput()), events: string[] = [], sentinel = new Error("claimed hash getter");
    let reads = 0;
    const observed = { ...artifact, get contentHash() { events.push("hash"); if (++reads === 2) throw sentinel; return artifact.contentHash; },
      get algorithmVersion() { events.push("algorithm"); return artifact.algorithmVersion; } };
    expect(() => validateMeshArtifact(observed)).toThrow(sentinel);
    expect(events).toEqual(["algorithm", "hash", "hash"]);
  });
  it("prepares owned snapshots and every validation hash in bounded steps with unchanged results", () => {
    const owned = artifactModule as unknown as {
      createMeshArtifactOwnedSteps(input: MeshArtifactInput): Generator<string, MeshArtifact, unknown>;
      validateMeshArtifactOwnedSteps(artifact: MeshArtifact): Generator<string, ReturnType<typeof validateMeshArtifact>, unknown>;
    };
    const finish = <T>(steps: Generator<string, T, unknown>): T => {
      try { for (;;) { const next = steps.next(); if (next.done) return next.value; } }
      finally { steps.return(undefined as never); }
    };
    const input = meshInput(), expected = createMeshArtifact(input);
    const actual = finish(owned.createMeshArtifactOwnedSteps(input));
    expect(actual).toEqual(expected); expect(actual.positions).not.toBe(input.positions);
    input.positions[0] = 42;
    expect(actual.positions[0]).toBe(-1);
    for (const change of [
      { contentHash: "fnv1a64:0000000000000000" },
      { positions: new Float32Array([NaN, 0, 0]) },
      { indices: new Uint16Array([0, 1, 99]) },
      { bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } } }
    ]) {
      const invalid = { ...actual, ...change } as MeshArtifact;
      expect(finish(owned.validateMeshArtifactOwnedSteps(invalid))).toEqual(validateMeshArtifact(invalid));
    }
    const count = 8193, large: MeshArtifactInput = { ...meshInput(),
      positions: new Float32Array(count * 3), normals: new Float32Array(count * 3),
      indices: Uint32Array.from({ length: count }, (_, index) => index), attributes: undefined,
      materialRanges: [{ ...input.materialRanges[0]!, indexCount: count }],
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } } };
    const steps = owned.createMeshArtifactOwnedSteps(large); let advances = 0;
    try { for (;;) { const next = steps.next(); if (next.done) {
      expect(next.value.contentHash).toBe(createMeshArtifact(large).contentHash); break;
    } advances += 1; } } finally { steps.return(undefined as never); }
    expect(advances).toBeGreaterThan(64);
    const cancelled = owned.createMeshArtifactOwnedSteps(large);
    expect(cancelled.next().done).toBe(false); cancelled.return(undefined as never);
    expect(cancelled.next().done).toBe(true);
  });
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

  it("accepts only closed HVP ephemeral representation keys without changing ordinary IDs", () => {
    const key = ephemeralRepresentationKey({ kind: "terrain", sector: 7 }, 2, 1);
    expect(key).toBe("hvp:terrain:s7:e2~1");
    expect(validateRepresentationKey(key)).toEqual({ valid: true });
    expect(validateMeshArtifact(createMeshArtifact({ ...meshInput(), representationKey: key })).valid).toBe(true);
    expect(representationKey("hvp:fragment:stage7:p0")).toBe("hvp:fragment:stage7:p0");
    expect(validateRepresentationKey("hvp:fragment:stage7:p0")).toEqual({ valid: true });

    const roles = [
      [{ kind: "fragment" } as const, "hvp:fragment:e2~3", 3],
      [{ kind: "branch", part: "branch" } as const, "hvp:branch:e2~4", 4],
      [{ kind: "branch", part: "foliage" } as const, "hvp:branch:foliage:e2~5", 5],
      [{ kind: "neighbor", part: "join" } as const, "hvp:neighbor:join:e2~6", 6],
      [{ kind: "neighbor", part: "far" } as const, "hvp:neighbor:far:e2~7", 7],
      [{ kind: "neighbor", part: "region" } as const, "hvp:neighbor:region:e2~8", 8],
      [{ kind: "neighbor", part: "proxy" } as const, "hvp:neighbor:proxy:e2~9", 9],
      [{ kind: "tool-preview" } as const, "hvp:tool:preview:e2~10", 10]
    ] as const;
    for (const [role, expected, serial] of roles) {
      const generated = ephemeralRepresentationKey(role, 2, serial);
      expect(generated).toBe(expected);
      expect(validateRepresentationKey(generated).valid).toBe(true);
      expect(generated.length).toBeLessThanOrEqual(128);
    }

    for (const invalid of [
      "hvp:unknown:e1~1",
      "hvp:neighbor:e0~1",
      "hvp:fragment:e01~1",
      "hvp:fragment:e1~0",
      "hvp:fragment:e1~01",
      "hvp:fragment:e1~9007199254740992",
      "hvp:terrain:s9007199254740992:e0~1",
      "hvp:fragment:e1~1\n"
    ]) {
      expect(validateRepresentationKey(invalid).valid).toBe(false);
    }
    expect(() => representationKey("hvp:fragment:e1~1")).toThrow();
    expect(() => ephemeralRepresentationKey({ kind: "fragment" }, 0, Number.MAX_SAFE_INTEGER + 1)).toThrow();
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
