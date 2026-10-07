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

const mesh = (revision: number, peak = 1, representation = key): MeshArtifact => createMeshArtifact({
  representationKey: representation,
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
  it("checks full owned upserts and live revision after suspension before allocating", () => {
    const instance = backend();
    const owned = instance as unknown as { dispatchOwnedSteps(command: import("../../src/presentation").RenderCommand): Generator<string, import("../../src/presentation").RenderCommandResult, unknown> };
    const finish = <T>(steps: Generator<string, T, unknown>): T => { try { for (;;) { const n = steps.next(); if (n.done) return n.value; } } finally { steps.return(undefined as never); } };
    const first = mesh(1), command = { kind: "UpsertMeshArtifact" as const, backendRevision: backendRevision(0), artifact: first, materialProfiles: [material] };
    expect(finish(owned.dispatchOwnedSteps(command))).toMatchObject({ status: "Accepted", ownership: "MovedToBackend" });
    expect(finish(owned.dispatchOwnedSteps(command))).toMatchObject({ status: "AlreadyApplied", ownership: "AlreadyOwnedByBackend" });
    first.positions[0] = 99;
    expect(finish(owned.dispatchOwnedSteps(command))).toMatchObject({ status: "RejectedInvalidArtifact", ownership: "RetainedByCaller" });
    const pending = owned.dispatchOwnedSteps({ ...command, artifact: mesh(2) });
    expect(pending.next().done).toBe(false);
    expect(instance.dispatch({ kind: "ResetBackend", backendRevision: backendRevision(0), nextBackendRevision: backendRevision(1) }).status).toBe("Accepted");
    expect(finish(pending)).toMatchObject({ status: "RejectedStaleRevision", ownership: "RetainedByCaller" });
    expect(instance.readDiagnostics().activeRepresentations).toBe(0);
    const cancelled = owned.dispatchOwnedSteps({ ...command, backendRevision: backendRevision(1), artifact: mesh(3) });
    expect(cancelled.next().done).toBe(false); cancelled.return(undefined as never);
    expect(instance.readDiagnostics().activeRepresentations).toBe(0);
    instance.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(1) });
  });
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

  it("preserves ordinary replay semantics for a native-looking stage key", () => {
    const instance = backend();
    const nativeLooking = representationKey("hvp:fragment:stage7:p0");
    const artifact = mesh(1, 1, nativeLooking);
    expect(upsert(instance, artifact).status).toBe("Accepted");
    expect(upsert(instance, mesh(1, 1, nativeLooking)).status).toBe("AlreadyApplied");
    expect(instance.dispatch({
      kind: "RemoveRepresentation",
      backendRevision: backendRevision(0),
      representationKey: nativeLooking,
      expectedSourceRevision: artifact.sourceRevision,
      expectedArtifactRevision: artifact.artifactRevision,
      expectedContentHash: artifact.contentHash
    }).status).toBe("Accepted");
    expect(upsert(instance, mesh(1, 1, nativeLooking))).toMatchObject({
      status: "RejectedStaleRevision",
      reasonCode: "RepresentationRemovedAtRevision"
    });
  });
});
