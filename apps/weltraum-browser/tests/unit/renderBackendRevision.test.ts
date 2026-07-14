import { describe, expect, it } from "vitest";
import {
  artifactRevision,
  adoptMeshArtifactBuffers,
  backendRevision,
  createMaterialProfile,
  createMeshArtifact,
  frameId,
  materialProfileId,
  representationKey,
  sourceRevision,
  type MeshArtifact,
  type MeshArtifactInput
} from "../../src/presentation";
import { ThreeRenderBackend, type ThreeRendererPort } from "../../src/render/three/backend";

const key = representationKey("chunk:primary");
const materialId = materialProfileId("chunk:material");
const material = createMaterialProfile({
  id: materialId,
  kind: "Unlit",
  baseColor: { r: 0.4, g: 0.6, b: 0.8 },
  opacity: 1,
  doubleSided: false,
  wireframe: false,
  depthWrite: true
});

const mesh = (revision: number, peak = 1): MeshArtifact => createMeshArtifact({
  representationKey: key,
  sourceRevision: sourceRevision(3),
  artifactRevision: artifactRevision(revision),
  algorithmVersion: "artifact:v1",
  frameId: frameId("camera:relative"),
  positions: new Float32Array([-1, -1, 0, 1, -1, 0, 0, peak, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint16Array([0, 1, 2]),
  materialRanges: [{ materialProfileId: materialId, startIndex: 0, indexCount: 3 }],
  bounds: { min: { x: -1, y: -1, z: 0 }, max: { x: 1, y: peak, z: 0 } }
});

const equivalentAdoptionInput = (value: MeshArtifact): MeshArtifactInput => ({
  representationKey: value.representationKey,
  sourceRevision: value.sourceRevision,
  artifactRevision: value.artifactRevision,
  algorithmVersion: value.algorithmVersion,
  frameId: value.frameId,
  positions: new Float32Array(value.positions),
  normals: new Float32Array(value.normals),
  indices: value.indices instanceof Uint16Array ? new Uint16Array(value.indices) : new Uint32Array(value.indices),
  attributes: value.attributes === undefined
    ? undefined
    : {
        uv: value.attributes.uv === undefined ? undefined : new Float32Array(value.attributes.uv),
        color: value.attributes.color === undefined ? undefined : new Float32Array(value.attributes.color)
      },
  materialRanges: value.materialRanges,
  bounds: value.bounds
});

class FakeRenderer implements ThreeRendererPort {
  setPixelRatio(): void {}
  setSize(): void {}
  render(): void {}
  dispose(): void {}
}

const backend = (): ThreeRenderBackend => {
  const instance = new ThreeRenderBackend({ canvas: {} as HTMLCanvasElement, rendererFactory: () => new FakeRenderer() });
  instance.dispatch({ kind: "InitializeBackend", backendRevision: backendRevision(0) });
  return instance;
};

const upsert = (instance: ThreeRenderBackend, artifact: MeshArtifact) => instance.dispatch({
  kind: "UpsertMeshArtifact" as const,
  backendRevision: backendRevision(0),
  artifact,
  materialProfiles: [material]
});

describe("ThreeRenderBackend revision safety", () => {
  it("treats a separate AdoptedExclusive artifact with equal content as AlreadyApplied", () => {
    const instance = backend();
    const snapshot = mesh(2);
    const adopted = adoptMeshArtifactBuffers(equivalentAdoptionInput(snapshot));
    expect(snapshot.ownership).toBe("SnapshotOwned");
    expect(adopted.ownership).toBe("AdoptedExclusive");
    expect(adopted.contentHash).toBe(snapshot.contentHash);
    expect(upsert(instance, snapshot)).toMatchObject({ status: "Accepted", ownership: "MovedToBackend" });
    expect(upsert(instance, adopted)).toMatchObject({ status: "AlreadyApplied", ownership: "RetainedByCaller" });
    expect(instance.readDiagnostics()).toMatchObject({ geometryAllocations: 1, activeRepresentations: 1 });
  });

  it("treats equal revision and content as idempotent without taking duplicate buffers", () => {
    const instance = backend();
    const first = mesh(2);
    const duplicateWithNewBuffers = mesh(2);
    expect(upsert(instance, first)).toMatchObject({ status: "Accepted", ownership: "MovedToBackend" });
    expect(upsert(instance, first)).toMatchObject({ status: "AlreadyApplied", ownership: "AlreadyOwnedByBackend" });
    expect(upsert(instance, duplicateWithNewBuffers)).toMatchObject({ status: "AlreadyApplied", ownership: "RetainedByCaller" });
    expect(instance.readDiagnostics()).toMatchObject({ geometryAllocations: 1, activeRepresentations: 1 });
  });

  it("rejects equal revision with different content and lower revisions fail-closed", () => {
    const instance = backend();
    upsert(instance, mesh(2));
    expect(upsert(instance, mesh(2, 1.5))).toMatchObject({ status: "RejectedContentConflict", ownership: "RetainedByCaller" });
    expect(upsert(instance, mesh(1))).toMatchObject({ status: "RejectedStaleRevision", ownership: "RetainedByCaller" });
    expect(instance.readDiagnostics()).toMatchObject({ activeRepresentations: 1, geometryAllocations: 1, rejectedArtifacts: 2, staleRejectCount: 1 });
  });

  it("accepts a higher revision atomically and rejects a stale remove", () => {
    const instance = backend();
    const old = mesh(1);
    const current = mesh(2, 1.5);
    upsert(instance, old);
    expect(upsert(instance, current).status).toBe("Accepted");
    expect(instance.dispatch({
      kind: "RemoveRepresentation",
      backendRevision: backendRevision(0),
      representationKey: key,
      expectedSourceRevision: old.sourceRevision,
      expectedArtifactRevision: old.artifactRevision,
      expectedContentHash: old.contentHash
    }).status).toBe("RejectedStaleRevision");
    expect(instance.readDiagnostics()).toMatchObject({ activeRepresentations: 1, replacementCount: 1, staleRejectCount: 1 });
  });

  it("rejects an invalid remove revision before touching the resident artifact", () => {
    const instance = backend();
    const current = mesh(2);
    upsert(instance, current);
    const result = instance.dispatch({
      kind: "RemoveRepresentation",
      backendRevision: backendRevision(0),
      representationKey: key,
      expectedSourceRevision: -0,
      expectedArtifactRevision: current.artifactRevision,
      expectedContentHash: current.contentHash
    } as unknown as Parameters<ThreeRenderBackend["dispatch"]>[0]);
    expect(result.status).toBe("RejectedInvalidArtifact");
    expect(instance.readDiagnostics().residentRepresentationKeys).toEqual([key]);
  });

  it("evicts an unpinned record and rehydrates the exact high-watermark with fresh buffers", () => {
    const instance = backend();
    const first = mesh(4);
    upsert(instance, first);
    expect(instance.dispatch({
      kind: "EvictRepresentation",
      backendRevision: backendRevision(0),
      representationKey: key,
      expectedSourceRevision: first.sourceRevision,
      expectedArtifactRevision: first.artifactRevision,
      expectedContentHash: first.contentHash
    })).toMatchObject({ status: "Accepted", ownership: "ReleasedByBackend" });
    expect(instance.readDiagnostics()).toMatchObject({ activeRepresentations: 0, evictionCount: 1 });
    expect(upsert(instance, mesh(4))).toMatchObject({ status: "Accepted", ownership: "MovedToBackend" });
    expect(instance.readDiagnostics()).toMatchObject({ activeRepresentations: 1, rehydrationCount: 1, geometryAllocations: 2, geometryDisposals: 1 });
  });

  it("rejects commands from an earlier backend generation after reset", () => {
    const instance = backend();
    upsert(instance, mesh(1));
    instance.dispatch({ kind: "ResetBackend", backendRevision: backendRevision(0), nextBackendRevision: backendRevision(1) });
    expect(upsert(instance, mesh(2))).toMatchObject({ status: "RejectedStaleRevision", ownership: "RetainedByCaller" });
    expect(instance.readDiagnostics()).toMatchObject({ backendRevision: 1, activeRepresentations: 0, staleRejectCount: 1 });
  });
});
