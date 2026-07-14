import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  artifactRevision,
  adoptMeshArtifactBuffers,
  backendRevision,
  createFrameProjectionSnapshot,
  createMaterialProfile,
  createMeshArtifact,
  createVisibilityPlan,
  frameId,
  frameRevision,
  materialProfileId,
  representationKey,
  sourceRevision,
  visibilityPlanRevision,
  type MaterialProfile,
  type MeshArtifact,
  type MeshArtifactInput
} from "../../src/presentation";
import { ThreeRenderBackend, type ThreeRendererPort } from "../../src/render/three/backend";

const key = representationKey("planet:parent");
const materialId = materialProfileId("surface:unlit");

const profile = (red = 0.25): MaterialProfile => createMaterialProfile({
  id: materialId,
  kind: "Unlit",
  baseColor: { r: red, g: 0.5, b: 0.75 },
  opacity: 1,
  doubleSided: true,
  wireframe: false,
  depthWrite: true
});

const artifactInput = (revision: number, offset = 0): MeshArtifactInput => ({
  representationKey: key,
  sourceRevision: sourceRevision(1),
  artifactRevision: artifactRevision(revision),
  algorithmVersion: "mesh:v1",
  frameId: frameId("local:camera"),
  positions: new Float32Array([-1 + offset, -1, 0, 1 + offset, -1, 0, 1 + offset, 1, 0, -1 + offset, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  materialRanges: [{ materialProfileId: materialId, startIndex: 0, indexCount: 6 }],
  bounds: { min: { x: -1 + offset, y: -1, z: 0 }, max: { x: 1 + offset, y: 1, z: 0 } }
});

const artifact = (revision: number, offset = 0): MeshArtifact => createMeshArtifact(artifactInput(revision, offset));

class FakeRenderer implements ThreeRendererPort {
  renders = 0;
  disposals = 0;
  setPixelRatio(): void {}
  setSize(): void {}
  render(): void { this.renders += 1; }
  dispose(): void { this.disposals += 1; }
}

const setup = (): { readonly backend: ThreeRenderBackend; readonly renderers: FakeRenderer[] } => {
  const renderers: FakeRenderer[] = [];
  const backend = new ThreeRenderBackend({
    canvas: {} as HTMLCanvasElement,
    lightingMode: "None",
    rendererFactory: () => {
      const renderer = new FakeRenderer();
      renderers.push(renderer);
      return renderer;
    }
  });
  expect(backend.dispatch({ kind: "InitializeBackend", backendRevision: backendRevision(0) }).status).toBe("Accepted");
  return { backend, renderers };
};

const upsert = (backend: ThreeRenderBackend, mesh: MeshArtifact, material = profile()) => backend.dispatch({
  kind: "UpsertMeshArtifact" as const,
  backendRevision: backendRevision(0),
  artifact: mesh,
  materialProfiles: [material]
});

const projectAndShowFallback = (backend: ThreeRenderBackend): void => {
  const snapshot = createFrameProjectionSnapshot({
    frameId: frameId("local:camera"),
    frameRevision: frameRevision(1),
    cameraPositionRelative: { x: 0, y: 0, z: 5 },
    cameraOrientation: { x: 0, y: 0, z: 0, w: 1 },
    projectionParameters: { kind: "Perspective", verticalFovDegrees: 50, aspect: 16 / 9, near: 0.1, far: 100 },
    representationTransforms: [{
      representationKey: key,
      positionRelative: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    }]
  });
  backend.dispatch({ kind: "ApplyFrameProjection", backendRevision: backendRevision(0), snapshot });
  backend.dispatch({
    kind: "ApplyVisibilityPlan",
    backendRevision: backendRevision(0),
    plan: createVisibilityPlan({
      planRevision: visibilityPlanRevision(1),
      visibleRepresentationKeys: [representationKey("planet:child")],
      fallbackRepresentationKeys: [key],
      hiddenRepresentationKeys: []
    })
  });
};

describe("ThreeRenderBackend resource lifecycle", () => {
  it("references SnapshotOwned arrays without a second backend copy", () => {
    const { backend } = setup();
    const input = artifactInput(1);
    const mesh = createMeshArtifact(input);
    const before = Array.from(mesh.positions);
    expect(upsert(backend, mesh)).toMatchObject({ status: "Accepted", ownership: "MovedToBackend" });
    const node = backend.representationRoot.children[0] as THREE.Mesh<THREE.BufferGeometry>;
    expect(mesh.ownership).toBe("SnapshotOwned");
    expect(mesh.positions).not.toBe(input.positions);
    expect(node.geometry.getAttribute("position").array).toBe(mesh.positions);
    expect(node.geometry.getAttribute("normal").array).toBe(mesh.normals);
    expect(node.geometry.index?.array).toBe(mesh.indices);
    expect(Array.from(mesh.positions)).toEqual(before);
  });

  it("references AdoptedExclusive arrays without copying them", () => {
    const { backend } = setup();
    const input = artifactInput(1);
    const mesh = adoptMeshArtifactBuffers(input);
    expect(upsert(backend, mesh)).toMatchObject({ status: "Accepted", ownership: "MovedToBackend" });
    const node = backend.representationRoot.children[0] as THREE.Mesh<THREE.BufferGeometry>;
    expect(mesh.ownership).toBe("AdoptedExclusive");
    expect(mesh.positions).toBe(input.positions);
    expect(node.geometry.getAttribute("position").array).toBe(input.positions);
    expect(node.geometry.getAttribute("normal").array).toBe(input.normals);
    expect(node.geometry.index?.array).toBe(input.indices);
  });

  it("does not detach or mutate snapshot/adopted buffers during release lifecycle", () => {
    const removed = setup();
    const removedInput = artifactInput(1);
    const removedMesh = adoptMeshArtifactBuffers(removedInput);
    upsert(removed.backend, removedMesh);
    const removedPositions = Array.from(removedInput.positions);
    expect(removed.backend.dispatch({
      kind: "RemoveRepresentation",
      backendRevision: backendRevision(0),
      representationKey: key,
      expectedSourceRevision: removedMesh.sourceRevision,
      expectedArtifactRevision: removedMesh.artifactRevision,
      expectedContentHash: removedMesh.contentHash
    }).status).toBe("Accepted");
    expect(removedInput.positions.byteLength).toBe(48);
    expect(Array.from(removedInput.positions)).toEqual(removedPositions);

    const reset = setup();
    const resetInput = artifactInput(1);
    const resetMesh = createMeshArtifact(resetInput);
    upsert(reset.backend, resetMesh);
    const resetPositions = Array.from(resetMesh.positions);
    expect(reset.backend.dispatch({
      kind: "ResetBackend",
      backendRevision: backendRevision(0),
      nextBackendRevision: backendRevision(1)
    }).status).toBe("Accepted");
    expect(resetMesh.positions.byteLength).toBe(48);
    expect(Array.from(resetMesh.positions)).toEqual(resetPositions);

    const disposed = setup();
    const disposedInput = artifactInput(1);
    const disposedMesh = adoptMeshArtifactBuffers(disposedInput);
    upsert(disposed.backend, disposedMesh);
    const disposedPositions = Array.from(disposedInput.positions);
    expect(disposed.backend.dispatch({
      kind: "DisposeBackend",
      backendRevision: backendRevision(0)
    }).status).toBe("Accepted");
    expect(disposedInput.positions.byteLength).toBe(48);
    expect(Array.from(disposedInput.positions)).toEqual(disposedPositions);
  });

  it("prepares a replacement before disposing the previous geometry", () => {
    const { backend } = setup();
    expect(upsert(backend, artifact(1)).status).toBe("Accepted");
    expect(upsert(backend, artifact(2, 0.25)).status).toBe("Accepted");
    expect(backend.readDiagnostics()).toMatchObject({
      activeRepresentations: 1,
      geometryAllocations: 2,
      geometryDisposals: 1,
      replacementCount: 1,
      materialAllocations: 1,
      materialDisposals: 0
    });
  });

  it("retains the old mesh when replacement resource preparation conflicts", () => {
    const { backend } = setup();
    const first = artifact(1);
    upsert(backend, first);
    const oldNode = backend.representationRoot.children[0];
    expect(upsert(backend, artifact(2, 0.25), profile(0.9))).toMatchObject({
      status: "RejectedContentConflict",
      ownership: "RetainedByCaller"
    });
    expect(backend.representationRoot.children).toEqual([oldNode]);
    expect(backend.readDiagnostics()).toMatchObject({ activeRepresentations: 1, geometryAllocations: 1, geometryDisposals: 0 });
  });

  it("keeps remove idempotent and releases geometry and the final material lease", () => {
    const { backend } = setup();
    const mesh = artifact(1);
    upsert(backend, mesh);
    const remove = {
      kind: "RemoveRepresentation" as const,
      backendRevision: backendRevision(0),
      representationKey: key,
      expectedSourceRevision: mesh.sourceRevision,
      expectedArtifactRevision: mesh.artifactRevision,
      expectedContentHash: mesh.contentHash
    };
    expect(backend.dispatch(remove)).toMatchObject({ status: "Accepted", ownership: "ReleasedByBackend" });
    expect(backend.dispatch(remove).status).toBe("AlreadyApplied");
    expect(backend.readDiagnostics()).toMatchObject({
      activeRepresentations: 0,
      geometryDisposals: 1,
      materialDisposals: 1,
      removeCount: 1,
      estimatedGpuBytes: 0,
      ownedCpuBytes: 0
    });
  });

  it("rejects eviction and removal of a pinned ready fallback", () => {
    const { backend } = setup();
    const mesh = artifact(1);
    upsert(backend, mesh);
    projectAndShowFallback(backend);
    const expected = {
      backendRevision: backendRevision(0),
      representationKey: key,
      expectedSourceRevision: mesh.sourceRevision,
      expectedArtifactRevision: mesh.artifactRevision,
      expectedContentHash: mesh.contentHash
    };
    expect(backend.dispatch({ kind: "EvictRepresentation", ...expected })).toMatchObject({ status: "RejectedContentConflict", reasonCode: "PinnedFallback" });
    expect(backend.dispatch({ kind: "RemoveRepresentation", ...expected })).toMatchObject({ status: "RejectedContentConflict", reasonCode: "PinnedFallback" });
    expect(backend.readDiagnostics()).toMatchObject({ activeFallbacks: 1, activeRepresentations: 1, evictionRejectCount: 1 });
  });

  it("keeps a planned fallback pinned after eviction until it is rehydrated", () => {
    const { backend } = setup();
    const mesh = artifact(1);
    upsert(backend, mesh);
    const expected = {
      backendRevision: backendRevision(0),
      representationKey: key,
      expectedSourceRevision: mesh.sourceRevision,
      expectedArtifactRevision: mesh.artifactRevision,
      expectedContentHash: mesh.contentHash
    };
    expect(backend.dispatch({ kind: "EvictRepresentation", ...expected }).status).toBe("Accepted");
    projectAndShowFallback(backend);
    expect(backend.dispatch({ kind: "RemoveRepresentation", ...expected })).toMatchObject({
      status: "RejectedContentConflict",
      reasonCode: "PinnedFallback"
    });
    expect(backend.readDiagnostics()).toMatchObject({ activeFallbacks: 1, activeRepresentations: 0 });
    expect(upsert(backend, artifact(1))).toMatchObject({ status: "Accepted", ownership: "MovedToBackend" });
  });

  it("disposes a renderer whose configuration throws", () => {
    const renderer = new FakeRenderer();
    renderer.setSize = (): void => { throw new Error("configuration failed"); };
    const backend = new ThreeRenderBackend({
      canvas: {} as HTMLCanvasElement,
      rendererFactory: () => renderer
    });
    expect(backend.dispatch({ kind: "InitializeBackend", backendRevision: backendRevision(0) }).status).toBe("BackendUnavailable");
    expect(renderer.disposals).toBe(1);
  });

  it("disposes all resources on reset and rebuilds the same visible keys", () => {
    const { backend, renderers } = setup();
    const first = artifact(1);
    upsert(backend, first);
    projectAndShowFallback(backend);
    expect(backend.readDiagnostics().visibleRepresentationKeys).toEqual([key]);
    const reset = {
      kind: "ResetBackend",
      backendRevision: backendRevision(0),
      nextBackendRevision: backendRevision(1)
    } as const;
    expect(backend.dispatch(reset)).toMatchObject({ status: "Accepted", ownership: "ReleasedByBackend" });
    expect(backend.dispatch(reset)).toMatchObject({ status: "AlreadyApplied", reasonCode: "ResetAlreadyApplied" });
    expect(backend.readDiagnostics()).toMatchObject({ activeRepresentations: 0, resetCount: 1, estimatedGpuBytes: 0 });
    expect(renderers[0].disposals).toBe(1);

    const replay = artifact(1);
    expect(backend.dispatch({
      kind: "UpsertMeshArtifact",
      backendRevision: backendRevision(1),
      artifact: replay,
      materialProfiles: [profile()]
    }).status).toBe("Accepted");
    const snapshot = createFrameProjectionSnapshot({
      frameId: frameId("local:camera"), frameRevision: frameRevision(1),
      cameraPositionRelative: { x: 0, y: 0, z: 5 }, cameraOrientation: { x: 0, y: 0, z: 0, w: 1 },
      projectionParameters: { kind: "Perspective", verticalFovDegrees: 50, aspect: 16 / 9, near: 0.1, far: 100 },
      representationTransforms: [{ representationKey: key, positionRelative: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } }]
    });
    backend.dispatch({ kind: "ApplyFrameProjection", backendRevision: backendRevision(1), snapshot });
    backend.dispatch({ kind: "ApplyVisibilityPlan", backendRevision: backendRevision(1), plan: createVisibilityPlan({ planRevision: visibilityPlanRevision(1), visibleRepresentationKeys: [key], fallbackRepresentationKeys: [], hiddenRepresentationKeys: [] }) });
    expect(backend.readDiagnostics().visibleRepresentationKeys).toEqual([key]);
    expect(Object.isFrozen(backend.readDiagnostics())).toBe(true);
  });
});
