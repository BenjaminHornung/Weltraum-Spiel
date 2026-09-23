import { describe, expect, it, vi } from "vitest";
import { createSynchronousBatch } from "../../src/hestia-prototype/presentation/synchronousBatch";
import { createHvpPresentationBackend } from "../../src/hvp/hvpBootstrap";
import { ThreeRenderBackend } from "../../src/render/three/backend/threeRenderBackend";
import { artifactRevision, backendRevision, createMaterialProfile, createMeshArtifact, createRenderCommand,
  frameId, materialProfileId, representationKey, sourceRevision } from "../../src/presentation";

describe("HVP synchronous presentation batch", () => {
  it("coalesces nested requests at the outer boundary and preserves return identity", () => {
    const flush = vi.fn();
    const batch = createSynchronousBatch(flush);
    const value = {};
    expect(batch.run(() => {
      batch.request();
      expect(batch.run(() => { batch.request(); batch.request(); return 17; })).toBe(17);
      expect(flush).not.toHaveBeenCalled();
      return value;
    })).toBe(value);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("does not flush without requests and flushes outside requests immediately", () => {
    const flush = vi.fn();
    const batch = createSynchronousBatch(flush);
    expect(batch.run(() => batch.run(() => false))).toBe(false);
    expect(flush).not.toHaveBeenCalled();
    batch.request();
    batch.request();
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("preserves an action failure, flushes its pending work and remains usable", () => {
    const original = new Error("upload failed");
    const flush = vi.fn();
    const batch = createSynchronousBatch(flush);
    let caught: unknown;
    try {
      batch.run(() => { batch.request(); throw original; });
    } catch (error) { caught = error; }
    expect(caught).toBe(original);
    expect(flush).toHaveBeenCalledTimes(1);
    batch.request();
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("preserves a flush failure without a stale dirty flag or batch depth", () => {
    const original = new Error("projection failed");
    const flush = vi.fn().mockImplementationOnce(() => { throw original; });
    const batch = createSynchronousBatch(flush);
    let caught: unknown;
    try { batch.run(() => { batch.request(); }); } catch (error) { caught = error; }
    expect(caught).toBe(original);
    batch.run(() => undefined);
    expect(flush).toHaveBeenCalledTimes(1);
    batch.request();
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("retains both original causes when action and flush fail", () => {
    const actionError = new Error("upload failed");
    const flushError = new Error("projection failed");
    const batch = createSynchronousBatch(() => { throw flushError; });
    let caught: unknown;
    try { batch.run(() => { batch.request(); throw actionError; }); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors[0]).toBe(actionError);
    expect((caught as AggregateError).errors[1]).toBe(flushError);
    expect((caught as Error).message).toContain(actionError.message);
    expect((caught as Error).message).toContain(flushError.message);
  });

  it("preserves even an undefined thrown value", () => {
    const batch = createSynchronousBatch(() => undefined);
    let caught: unknown = Symbol("not thrown");
    try { batch.run(() => { throw undefined; }); } catch (error) { caught = error; }
    expect(caught).toBeUndefined();
  });

  it("keeps both causes even when an error cannot be formatted", () => {
    const original = { toString: () => { throw new Error("format failure"); } };
    const flushError = new Error("flush failure");
    const batch = createSynchronousBatch(() => { throw flushError; });
    let caught: unknown;
    try { batch.run(() => { batch.request(); throw original; }); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors).toEqual([original, flushError]);
  });

  it("rejects a thenable without executing it and still releases the batch", () => {
    const flush = vi.fn();
    const then = vi.fn();
    const batch = createSynchronousBatch(flush);
    expect(() => batch.run(() => { batch.request(); return { then }; })).toThrow("must be synchronous");
    expect(then).not.toHaveBeenCalled();
    expect(flush).toHaveBeenCalledTimes(1);
    batch.request();
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("flushes once when an outer action catches a nested failure", () => {
    const flush = vi.fn();
    const batch = createSynchronousBatch(flush);
    batch.run(() => {
      expect(() => batch.run(() => { batch.request(); throw new Error("inner"); })).toThrow("inner");
      batch.request();
    });
    expect(flush).toHaveBeenCalledTimes(1);
  });
});

const adapterFixture = (defer = false) => {
  const backend = new ThreeRenderBackend({ canvas: {} as HTMLCanvasElement,
    rendererFactory: () => ({ setPixelRatio: () => {}, setSize: () => {}, render: () => {}, dispose: () => {} }) });
  const active = new Set<string>();
  const adapter = createHvpPresentationBackend(backend, () => ({ position: { x: 0, y: 0, z: 3 },
    orientation: { x: 0, y: 0, z: 0, w: 1 }, verticalFovDegrees: 60, aspect: 1, near: 0.1, far: 100 }),
  representationKey("hvp:water"), () => [], key => active.has(key), undefined, defer);
  adapter.dispatch(createRenderCommand({ kind: "InitializeBackend", backendRevision: backendRevision(0) }));
  const material = createMaterialProfile({ id: materialProfileId("hvp:batch:material"), kind: "BasicLit",
    baseColor: { r: 0.5, g: 0.5, b: 0.5 }, opacity: 1, doubleSided: false, wireframe: false, depthWrite: true });
  const artifact = (name: string) => createMeshArtifact({ representationKey: representationKey(name),
    frameId: frameId("hvp:batch:frame"), sourceRevision: sourceRevision(1), artifactRevision: artifactRevision(1),
    algorithmVersion: "hvp-batch-test-v1", positions: new Float32Array([0,0,0, 1,0,0, 1,1,0, 0,1,0]),
    normals: new Float32Array([0,0,1, 0,0,1, 0,0,1, 0,0,1]), indices: new Uint16Array([0,1,2,0,2,3]),
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
    materialRanges: [{ materialProfileId: material.id, startIndex: 0, indexCount: 6 }] });
  const upsert = (mesh: ReturnType<typeof artifact>) => adapter.dispatch(createRenderCommand({
    kind: "UpsertMeshArtifact", backendRevision: backendRevision(0), artifact: mesh, materialProfiles: [material] }));
  const remove = (mesh: ReturnType<typeof artifact>) => adapter.dispatch(createRenderCommand({
    kind: "RemoveRepresentation", backendRevision: backendRevision(0), representationKey: mesh.representationKey,
    expectedSourceRevision: mesh.sourceRevision, expectedArtifactRevision: mesh.artifactRevision, expectedContentHash: mesh.contentHash }));
  const dispose = () => adapter.dispatch(createRenderCommand({ kind: "DisposeBackend", backendRevision: backendRevision(0) }));
  return { backend, adapter, active, artifact, upsert, remove, dispose };
};

describe("HVP actual presentation adapter batches", () => {
  it.each([1, 8, 32])("publishes %i real registrations once without early visibility", count => {
    const f = adapterFixture();
    const dispatch = vi.spyOn(f.backend, "dispatch");
    try {
      const old = f.artifact("hvp:batch:old");
      f.active.add(old.representationKey);
      expect(f.upsert(old).status).toBe("Accepted");
      dispatch.mockClear();
      const next = Array.from({ length: count }, (_, i) => f.artifact(`hvp:batch:new-${i}`));
      f.active.add(next[0]!.representationKey);
      f.adapter.batch(() => {
        for (const mesh of next) {
          expect(f.upsert(mesh).status).toBe("Accepted");
          expect(f.backend.representationRoot.getObjectByName(`representation:${mesh.representationKey}`)!.visible).toBe(false);
        }
        expect(dispatch.mock.calls.filter(([command]) => command.kind === "ApplyFrameProjection")).toHaveLength(0);
      });
      const publications = dispatch.mock.calls.map(([command]) => command.kind).filter(kind => kind.startsWith("Apply"));
      expect(publications).toEqual(["ApplyFrameProjection", "ApplyVisibilityPlan"]);
      expect(f.backend.readDiagnostics().residentRepresentationKeys).toHaveLength(count + 1);
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([old.representationKey, next[0]!.representationKey].sort());
      dispatch.mockClear();
      f.adapter.batch(() => { for (const mesh of next) { expect(f.remove(mesh).status).toBe("Accepted"); } });
      expect(dispatch.mock.calls.map(([command]) => command.kind).filter(kind => kind.startsWith("Apply")))
        .toEqual(["ApplyFrameProjection", "ApplyVisibilityPlan"]);
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([old.representationKey]);
    } finally { dispatch.mockRestore(); f.dispose(); }
    expect(f.backend.readDiagnostics().geometryDisposals).toBe(f.backend.readDiagnostics().geometryAllocations);
  });

  it.each([false, true])("keeps hidden partial uploads and original failures, then recovers (flush fails: %s)", failFlush => {
    const f = adapterFixture();
    const uploadError = new Error("third upload failed");
    const flushError = new Error("projection flush failed");
    const dispatchOriginal = f.backend.dispatch.bind(f.backend);
    let uploads = 0, rejectFlush = failFlush;
    let dispatch: { mockRestore(): void } | undefined;
    try {
      const old = f.artifact("hvp:batch:old");
      f.active.add(old.representationKey); f.upsert(old);
      dispatch = vi.spyOn(f.backend, "dispatch").mockImplementation(command => {
        if (command.kind === "UpsertMeshArtifact" && ++uploads === 3) { throw uploadError; }
        if (command.kind === "ApplyFrameProjection" && rejectFlush) { rejectFlush = false; throw flushError; }
        return dispatchOriginal(command);
      });
      const next = Array.from({ length: 4 }, (_, i) => f.artifact(`hvp:batch:next-${i}`));
      let caught: unknown;
      try { f.adapter.batch(() => { for (const mesh of next) { f.upsert(mesh); } }); } catch (error) { caught = error; }
      if (failFlush) {
        expect(caught).toBeInstanceOf(AggregateError);
        expect((caught as AggregateError).errors).toEqual([uploadError, flushError]);
      } else { expect(caught).toBe(uploadError); }
      expect(f.backend.readDiagnostics().residentRepresentationKeys).toHaveLength(3);
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([old.representationKey]);
      f.adapter.batch(() => { for (const mesh of next) { f.remove(mesh); } });
      expect(f.backend.readDiagnostics().residentRepresentationKeys).toEqual([old.representationKey]);
      f.active.add(next[3]!.representationKey);
      f.adapter.batch(() => { expect(f.upsert(next[3]!).status).toBe("Accepted"); });
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([old.representationKey, next[3]!.representationKey].sort());
    } finally { dispatch?.mockRestore(); f.dispose(); }
  });

  it("preserves deferred startup and the water visibility command", () => {
    const f = adapterFixture(true);
    const dispatch = vi.spyOn(f.backend, "dispatch");
    try {
      const water = f.artifact("hvp:water"), land = f.artifact("hvp:batch:land");
      f.active.add(water.representationKey); f.active.add(land.representationKey);
      f.upsert(water); f.upsert(land);
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([]);
      expect(dispatch.mock.calls.some(([command]) => command.kind === "ApplyFrameProjection")).toBe(false);
      f.adapter.batch(() => { f.adapter.setWaterEnabled(false); f.adapter.updateProjection(); });
      expect(dispatch.mock.calls.filter(([command]) => command.kind === "ApplyFrameProjection")).toHaveLength(1);
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([land.representationKey]);
      f.adapter.setWaterEnabled(true);
      expect(f.backend.readDiagnostics().visibleRepresentationKeys).toEqual([water.representationKey, land.representationKey].sort());
    } finally { dispatch.mockRestore(); f.dispose(); }
  });
});
