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
  estimateMeshArtifactBytes,
  ephemeralRepresentationKey,
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

const secondaryProfile = (): MaterialProfile => createMaterialProfile({
  id: materialProfileId("surface:secondary"),
  kind: "Unlit",
  baseColor: { r: 0.75, g: 0.5, b: 0.25 },
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
  sizes:readonly number[][]=[];
  setPixelRatio(): void {}
  setSize(width:number,height:number): void {this.sizes=[...this.sizes,[width,height]];}
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

const registerEphemeral = (backend: ThreeRenderBackend, representation: ReturnType<typeof ephemeralRepresentationKey>, serial: number, epoch: number) => backend.dispatch({
  kind: "RegisterEphemeralRepresentation" as const,
  backendRevision: backendRevision(0),
  representationKey: representation,
  serial,
  epoch
});

const ephemeralMesh = (representation: ReturnType<typeof ephemeralRepresentationKey>, revision = 1): MeshArtifact =>
  createMeshArtifact({ ...artifactInput(revision), representationKey: representation });

const smallerEphemeralMesh = (representation: ReturnType<typeof ephemeralRepresentationKey>, revision = 2): MeshArtifact =>
  createMeshArtifact({
    representationKey: representation,
    sourceRevision: sourceRevision(1),
    artifactRevision: artifactRevision(revision),
    algorithmVersion: "mesh:v1",
    frameId: frameId("local:camera"),
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint16Array([0, 1, 2]),
    materialRanges: [{ materialProfileId: materialId, startIndex: 0, indexCount: 3 }],
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } }
  });

const twoProfileEphemeralMesh = (representation: ReturnType<typeof ephemeralRepresentationKey>): MeshArtifact => createMeshArtifact({
  ...artifactInput(1),
  representationKey: representation,
  materialRanges: [
    { materialProfileId: materialId, startIndex: 0, indexCount: 3 },
    { materialProfileId: materialProfileId("surface:secondary"), startIndex: 3, indexCount: 3 }
  ]
});

const ephemeralRelease = (backend: ThreeRenderBackend, mesh: MeshArtifact, kind: "RemoveRepresentation" | "EvictRepresentation") => {
  const expected = {
    backendRevision: backendRevision(0),
    representationKey: mesh.representationKey,
    expectedSourceRevision: mesh.sourceRevision,
    expectedArtifactRevision: mesh.artifactRevision,
    expectedContentHash: mesh.contentHash
  };
  if (kind === "RemoveRepresentation") {
    return backend.dispatch({ kind, ...expected });
  }
  return backend.dispatch({ kind, ...expected });
};

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
  it("resizes only the live renderer without replacing resources and preserves viewport across reset",()=>{
    const {backend,renderers}=setup();
    const viewport=backend as ThreeRenderBackend&{resizeViewport:(width:number,height:number)=>{status:string}};
    const before=backend.readDiagnostics();
    expect(viewport.resizeViewport(1280,720).status).toBe("Accepted");
    expect(renderers[0]!.sizes.at(-1)).toEqual([1280,720]);
    expect(viewport.resizeViewport(1280,720).status).toBe("Accepted");
    expect(renderers[0]!.sizes).toHaveLength(2);
    const after=backend.readDiagnostics();
    for(const name of ["geometryAllocations","geometryDisposals","materialAllocations","materialDisposals","activeRepresentations","ownedCpuBytes"] as const){
      expect(after[name]).toBe(before[name]);
    }
    for(const dimensions of [[0,720],[1280,NaN],[1.5,720]]){
      expect(viewport.resizeViewport(dimensions[0]!,dimensions[1]!).status).toBe("RejectedInvalidArtifact");
    }
    expect(renderers[0]!.sizes).toHaveLength(2);
    expect(backend.dispatch({kind:"ResetBackend",backendRevision:backendRevision(0),nextBackendRevision:backendRevision(1)}).status).toBe("Accepted");
    expect(renderers[1]!.sizes).toEqual([[1280,720]]);
    expect(backend.dispatch({kind:"DisposeBackend",backendRevision:backendRevision(1)}).status).toBe("Accepted");
    expect(viewport.resizeViewport(640,360).status).toBe("BackendUnavailable");
    expect(renderers[1]!.sizes).toHaveLength(1);
  });
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

  it("retires a removed ephemeral key and rejects stale replays before allocation", () => {
    const { backend } = setup();
    const key = ephemeralRepresentationKey({ kind: "fragment" }, 0, 1);
    const mesh = twoProfileEphemeralMesh(key);
    const profiles = [profile(), secondaryProfile()];
    const original = {
      kind: "UpsertMeshArtifact" as const,
      backendRevision: backendRevision(0),
      artifact: mesh,
      materialProfiles: profiles
    };
    expect(registerEphemeral(backend, key, 1, 0).status).toBe("Accepted");
    expect(backend.dispatch(original)).toMatchObject({ status: "Accepted", ownership: "MovedToBackend" });

    expect(ephemeralRelease(backend, mesh, "RemoveRepresentation")).toMatchObject({ status: "Accepted", ownership: "ReleasedByBackend" });
    const afterRelease = backend.readDiagnostics();
    const rebuilt = { ...original, artifact: twoProfileEphemeralMesh(key) };
    const reordered = { ...rebuilt, materialProfiles: [profiles[1]!, profiles[0]!] };
    expect(backend.dispatch({ ...original })).toMatchObject({ status: "RejectedStaleRevision", reasonCode: "ExpiredEpoch", ownership: "RetainedByCaller" });
    expect(backend.dispatch(rebuilt)).toMatchObject({ status: "RejectedStaleRevision", reasonCode: "ExpiredEpoch", ownership: "RetainedByCaller" });
    expect(backend.dispatch(reordered)).toMatchObject({ status: "RejectedStaleRevision", reasonCode: "ExpiredEpoch", ownership: "RetainedByCaller" });
    expect(ephemeralRelease(backend, mesh, "RemoveRepresentation")).toMatchObject({ status: "RejectedStaleRevision", reasonCode: "ExpiredEpoch" });
    expect(ephemeralRelease(backend, mesh, "EvictRepresentation")).toMatchObject({ status: "RejectedStaleRevision", reasonCode: "ExpiredEpoch" });
    expect(backend.readDiagnostics()).toMatchObject({
      geometryAllocations: afterRelease.geometryAllocations,
      materialAllocations: afterRelease.materialAllocations,
      activeRepresentations: 0
    });
    expect(rebuilt.artifact.positions.buffer.byteLength).toBe(48);
    const nextKey = ephemeralRepresentationKey({ kind: "fragment" }, 0, 2);
    const nextMesh = twoProfileEphemeralMesh(nextKey);
    expect(nextMesh.contentHash).toBe(mesh.contentHash);
    expect(registerEphemeral(backend, nextKey, 2, 0).status).toBe("Accepted");
    expect(backend.dispatch({ ...original, artifact: nextMesh })).toMatchObject({ status: "Accepted", ownership: "MovedToBackend" });
    expect(backend.readDiagnostics().residentRepresentationKeys).toContain(nextKey);
    expect(backend.readDiagnostics().residentRepresentationKeys).not.toContain(key);
    const beforeFreshReplay = backend.readDiagnostics();
    expect(backend.dispatch({ ...original })).toMatchObject({ status: "RejectedStaleRevision", reasonCode: "ExpiredEpoch", ownership: "RetainedByCaller" });
    expect(backend.readDiagnostics()).toMatchObject({ geometryAllocations: beforeFreshReplay.geometryAllocations,
      materialAllocations: beforeFreshReplay.materialAllocations, residentRepresentationKeys: [nextKey] });
    expect(ephemeralRelease(backend, nextMesh, "RemoveRepresentation")).toMatchObject({ status: "Accepted", ownership: "ReleasedByBackend" });
    expect(backend.readDiagnostics()).toMatchObject({ activeRepresentations: 0, ownedCpuBytes: 0 });
  });

  it("cancels only never-uploaded ephemeral registrations without reusing their serial", () => {
    const { backend } = setup();
    const canceledKey = ephemeralRepresentationKey({ kind: "fragment" }, 0, 1);
    expect(registerEphemeral(backend, canceledKey, 1, 0).status).toBe("Accepted");
    expect(backend.dispatch({
      kind: "CancelEphemeralRepresentation",
      backendRevision: backendRevision(0),
      representationKey: canceledKey,
      serial: 1
    })).toMatchObject({ status: "Accepted" });
    expect(upsert(backend, ephemeralMesh(canceledKey))).toMatchObject({ status: "RejectedStaleRevision", reasonCode: "ExpiredEpoch" });
    expect(registerEphemeral(backend, canceledKey, 1, 0)).toMatchObject({ status: "RejectedStaleRevision" });

    const nextKey = ephemeralRepresentationKey({ kind: "fragment" }, 0, 2);
    expect(registerEphemeral(backend, nextKey, 2, 0).status).toBe("Accepted");
  });

  it("rejects a bare neighbor role without consuming the first serial", () => {
    const { backend } = setup();
    expect(backend.dispatch({
      kind: "RegisterEphemeralRepresentation",
      backendRevision: backendRevision(0),
      representationKey: "hvp:neighbor:e0~1" as ReturnType<typeof ephemeralRepresentationKey>,
      epoch: 0,
      serial: 1
    })).toMatchObject({ status: "RejectedInvalidArtifact", reasonCode: "InvalidEphemeralRepresentationKey" });

    const legitimate = ephemeralRepresentationKey({ kind: "fragment" }, 0, 1);
    expect(registerEphemeral(backend, legitimate, 1, 0).status).toBe("Accepted");
  });

  it("rejects forged, duplicate, skipped, and out-of-range serials without wrapping", () => {
    const { backend } = setup();
    const firstKey = ephemeralRepresentationKey({ kind: "fragment" }, 0, 1);
    expect(upsert(backend, ephemeralMesh(firstKey))).toMatchObject({ status: "RejectedStaleRevision", reasonCode: "ExpiredEpoch" });
    expect(registerEphemeral(backend, firstKey, 2, 0)).toMatchObject({ status: "RejectedInvalidArtifact", reasonCode: "EphemeralKeyBindingMismatch" });
    expect(registerEphemeral(backend, firstKey, 1, 0).status).toBe("Accepted");
    expect(registerEphemeral(backend, firstKey, 1, 0)).toMatchObject({ status: "RejectedStaleRevision", reasonCode: "EphemeralSerialMismatch" });

    const skippedKey = ephemeralRepresentationKey({ kind: "fragment" }, 0, 3);
    expect(registerEphemeral(backend, skippedKey, 3, 0)).toMatchObject({ status: "RejectedStaleRevision", reasonCode: "EphemeralSerialMismatch" });
    const maximumKey = ephemeralRepresentationKey({ kind: "fragment" }, 0, Number.MAX_SAFE_INTEGER);
    expect(registerEphemeral(backend, maximumKey, Number.MAX_SAFE_INTEGER, 0)).toMatchObject({ status: "RejectedStaleRevision", reasonCode: "EphemeralSerialMismatch" });
    const nextKey = ephemeralRepresentationKey({ kind: "fragment" }, 0, 2);
    expect(registerEphemeral(backend, nextKey, 2, 0).status).toBe("Accepted");
  });

  it("preserves resident and evicted registrations across one epoch advance", () => {
    const { backend } = setup();
    const residentKey = ephemeralRepresentationKey({ kind: "terrain", sector: 2 }, 0, 1);
    const parkedKey = ephemeralRepresentationKey({ kind: "neighbor", part: "water" }, 0, 2);
    const resident = ephemeralMesh(residentKey);
    const parked = ephemeralMesh(parkedKey);
    expect(registerEphemeral(backend, residentKey, 1, 0).status).toBe("Accepted");
    expect(registerEphemeral(backend, parkedKey, 2, 0).status).toBe("Accepted");
    expect(upsert(backend, resident).status).toBe("Accepted");
    expect(upsert(backend, parked).status).toBe("Accepted");
    expect(ephemeralRelease(backend, parked, "EvictRepresentation").status).toBe("Accepted");

    expect(backend.dispatch({ kind: "AdvanceEphemeralEpoch", backendRevision: backendRevision(0), nextEpoch: 1 }).status).toBe("Accepted");
    expect(backend.dispatch({ kind: "AdvanceEphemeralEpoch", backendRevision: backendRevision(0), nextEpoch: 3 })).toMatchObject({ status: "RejectedStaleRevision" });
    expect(upsert(backend, resident).status).toBe("AlreadyApplied");
    expect(upsert(backend, ephemeralMesh(parkedKey))).toMatchObject({ status: "Accepted", ownership: "MovedToBackend" });

    const candidateKey = ephemeralRepresentationKey({ kind: "tool-preview" }, 1, 3);
    expect(registerEphemeral(backend, candidateKey, 3, 1).status).toBe("Accepted");
  });

  it("counts a failed old-revision release alongside the new resident without listing the detached node", () => {
    const { backend } = setup();
    const key = ephemeralRepresentationKey({ kind: "fragment" }, 0, 1);
    const oldEphemeral = createMeshArtifact({ ...artifactInput(1), representationKey: key });
    const newEphemeral = smallerEphemeralMesh(key, 2);
    expect(registerEphemeral(backend, key, 1, 0).status).toBe("Accepted");
    expect(upsert(backend, oldEphemeral).status).toBe("Accepted");
    const oldNode = backend.representationRoot.children[0] as THREE.Mesh<THREE.BufferGeometry>;
    let disposeCalls = 0;
    oldNode.geometry.dispose = (): void => { disposeCalls += 1; throw new Error("injected old revision disposal failure"); };

    expect(upsert(backend, newEphemeral)).toMatchObject({ status: "BackendUnavailable", reasonCode: "EphemeralReleaseUncertain" });
    const diagnostics = backend.readDiagnostics();
    expect(oldNode.parent).toBeNull();
    expect(backend.representationRoot.children).toHaveLength(1);
    expect(diagnostics.residentRepresentationKeys).toEqual([key]);
    expect(diagnostics.visibleRepresentationKeys).toEqual([]);
    expect(diagnostics.ownedCpuBytes).toBe(estimateMeshArtifactBytes(oldEphemeral) + estimateMeshArtifactBytes(newEphemeral));
    expect(diagnostics.estimatedGpuBytes).toBe(estimateMeshArtifactBytes(oldEphemeral) + estimateMeshArtifactBytes(newEphemeral));
    expect(diagnostics.activeRepresentations).toBe(1);
    expect(upsert(backend, newEphemeral)).toMatchObject({ status: "BackendUnavailable", reasonCode: "EphemeralReleaseUncertain" });
    expect(ephemeralRelease(backend, newEphemeral, "RemoveRepresentation")).toMatchObject({ status: "BackendUnavailable" });
    expect(ephemeralRelease(backend, newEphemeral, "EvictRepresentation")).toMatchObject({ status: "BackendUnavailable" });
    expect(backend.dispatch({
      kind: "CancelEphemeralRepresentation",
      backendRevision: backendRevision(0),
      representationKey: key,
      serial: 1
    })).toMatchObject({ status: "BackendUnavailable" });
    expect(disposeCalls).toBe(1);
  });

  it("keeps ownership and replay blocked when Remove disposal throws", () => {
    const { backend } = setup();
    const key = ephemeralRepresentationKey({ kind: "fragment" }, 0, 1);
    const mesh = ephemeralMesh(key);
    expect(registerEphemeral(backend, key, 1, 0).status).toBe("Accepted");
    expect(upsert(backend, mesh).status).toBe("Accepted");
    const geometry = (backend.representationRoot.children[0] as THREE.Mesh<THREE.BufferGeometry>).geometry;
    let disposeCalls = 0;
    geometry.dispose = (): void => { disposeCalls += 1; throw new Error("injected geometry release failure"); };

    expect(ephemeralRelease(backend, mesh, "RemoveRepresentation")).toMatchObject({
      status: "BackendUnavailable",
      ownership: "AlreadyOwnedByBackend",
      reasonCode: "EphemeralReleaseUncertain"
    });
    expect(upsert(backend, ephemeralMesh(key))).toMatchObject({ status: "BackendUnavailable", reasonCode: "EphemeralReleaseUncertain" });
    expect(ephemeralRelease(backend, mesh, "RemoveRepresentation")).toMatchObject({ status: "BackendUnavailable", reasonCode: "EphemeralReleaseUncertain" });
    expect(backend.dispatch({
      kind: "CancelEphemeralRepresentation",
      backendRevision: backendRevision(0),
      representationKey: key,
      serial: 1
    })).toMatchObject({ status: "BackendUnavailable", reasonCode: "EphemeralReleaseUncertain" });
    expect(backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) })).toMatchObject({
      status: "BackendUnavailable",
      ownership: "AlreadyOwnedByBackend",
      reasonCode: "EphemeralReleaseUncertain"
    });
    expect(backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) })).toMatchObject({
      status: "BackendUnavailable",
      reasonCode: "EphemeralReleaseUncertain"
    });
    expect(disposeCalls).toBe(1);
    expect(backend.readDiagnostics()).toMatchObject({ backendState: "Disposed", activeRepresentations: 0, residentRepresentationKeys: [], geometryDisposals: 0 });
  });

  it("does not prune an ephemeral registration after Evict disposal failure or a later Remove", () => {
    const { backend } = setup();
    const key = ephemeralRepresentationKey({ kind: "neighbor", part: "proxy" }, 0, 1);
    const mesh = ephemeralMesh(key);
    expect(registerEphemeral(backend, key, 1, 0).status).toBe("Accepted");
    expect(upsert(backend, mesh).status).toBe("Accepted");
    const meshNode = backend.representationRoot.children[0] as THREE.Mesh;
    const material = Array.isArray(meshNode.material) ? meshNode.material[0]! : meshNode.material;
    let disposeCalls = 0;
    material.dispose = (): void => { disposeCalls += 1; throw new Error("injected material release failure"); };

    expect(ephemeralRelease(backend, mesh, "EvictRepresentation")).toMatchObject({
      status: "BackendUnavailable",
      ownership: "AlreadyOwnedByBackend",
      reasonCode: "EphemeralReleaseUncertain"
    });
    expect(ephemeralRelease(backend, mesh, "RemoveRepresentation")).toMatchObject({ status: "BackendUnavailable", reasonCode: "EphemeralReleaseUncertain" });
    expect(upsert(backend, ephemeralMesh(key))).toMatchObject({ status: "BackendUnavailable", reasonCode: "EphemeralReleaseUncertain" });
    expect(disposeCalls).toBe(1);
    expect(backend.readDiagnostics()).toMatchObject({
      activeRepresentations: 0,
      residentRepresentationKeys: [],
      ownedCpuBytes: estimateMeshArtifactBytes(mesh),
      estimatedGpuBytes: estimateMeshArtifactBytes(mesh),
      evictionCount: 0
    });
  });

  it("cleans each healthy resident once before terminal renderer teardown with uncertainty", () => {
    const { backend, renderers } = setup();
    const ordinary = artifact(1);
    expect(upsert(backend, ordinary).status).toBe("Accepted");
    const ordinaryGeometry = (backend.representationRoot.children[0] as THREE.Mesh<THREE.BufferGeometry>).geometry;
    let ordinaryDisposeCalls = 0;
    const ordinaryDispose = ordinaryGeometry.dispose.bind(ordinaryGeometry);
    ordinaryGeometry.dispose = (): void => { ordinaryDisposeCalls += 1; ordinaryDispose(); };

    const key = ephemeralRepresentationKey({ kind: "fragment" }, 0, 1);
    const uncertain = ephemeralMesh(key);
    expect(registerEphemeral(backend, key, 1, 0).status).toBe("Accepted");
    expect(upsert(backend, uncertain).status).toBe("Accepted");
    const uncertainGeometry = (backend.representationRoot.children[1] as THREE.Mesh<THREE.BufferGeometry>).geometry;
    let uncertainDisposeCalls = 0;
    uncertainGeometry.dispose = (): void => { uncertainDisposeCalls += 1; throw new Error("injected uncertain geometry release"); };
    expect(ephemeralRelease(backend, uncertain, "RemoveRepresentation").status).toBe("BackendUnavailable");

    expect(backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) })).toMatchObject({
      status: "BackendUnavailable",
      ownership: "AlreadyOwnedByBackend",
      reasonCode: "EphemeralReleaseUncertain"
    });
    expect(backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) })).toMatchObject({
      status: "BackendUnavailable",
      reasonCode: "EphemeralReleaseUncertain"
    });
    expect(ordinaryDisposeCalls).toBe(1);
    expect(uncertainDisposeCalls).toBe(1);
    expect(renderers[0]!.disposals).toBe(1);
    expect(backend.readDiagnostics()).toMatchObject({
      backendState: "Disposed",
      activeRepresentations: 0,
      residentRepresentationKeys: [],
      ownedCpuBytes: estimateMeshArtifactBytes(uncertain),
      estimatedGpuBytes: estimateMeshArtifactBytes(uncertain),
      geometryDisposals: 1
    });
  });

  it.each(["geometry", "material"] as const)("drains healthy resources when Dispose first discovers %s failure",failure=>{
    const {backend,renderers}=setup();
    const ordinary=artifact(1),ordinaryNodeKey=`representation:${ordinary.representationKey}`;
    expect(upsert(backend,ordinary).status).toBe("Accepted");
    const key=ephemeralRepresentationKey({kind:"fragment"},0,1),secondary=secondaryProfile();
    const mesh=createMeshArtifact({...artifactInput(1),representationKey:key,
      materialRanges:[{materialProfileId:secondary.id,startIndex:0,indexCount:6}]});
    expect(registerEphemeral(backend,key,1,0).status).toBe("Accepted");
    expect(upsert(backend,mesh,secondary).status).toBe("Accepted");
    const a=backend.representationRoot.getObjectByName(ordinaryNodeKey) as THREE.Mesh<THREE.BufferGeometry>;
    const b=backend.representationRoot.getObjectByName(`representation:${key}`) as THREE.Mesh<THREE.BufferGeometry>;
    const aMaterial=Array.isArray(a.material)?a.material[0]!:a.material;
    const bMaterial=Array.isArray(b.material)?b.material[0]!:b.material;
    let aGeometryDisposals=0,aMaterialDisposals=0,bGeometryDisposals=0,bMaterialDisposals=0;
    const originalAGeometryDispose=a.geometry.dispose.bind(a.geometry),originalAMaterialDispose=aMaterial.dispose.bind(aMaterial);
    a.geometry.dispose=()=>{aGeometryDisposals+=1;originalAGeometryDispose();};
    aMaterial.dispose=()=>{aMaterialDisposals+=1;originalAMaterialDispose();};
    const originalBGeometryDispose=b.geometry.dispose.bind(b.geometry);
    b.geometry.dispose=()=>{bGeometryDisposals+=1;if(failure==="geometry"){throw new Error("first Dispose geometry failure");}originalBGeometryDispose();};
    bMaterial.dispose=()=>{bMaterialDisposals+=1;if(failure==="material"){throw new Error("first Dispose material failure");}};

    expect(backend.dispatch({kind:"DisposeBackend",backendRevision:backendRevision(0)})).toMatchObject({
      status:"BackendUnavailable",ownership:"AlreadyOwnedByBackend",reasonCode:"EphemeralReleaseUncertain"});
    expect(backend.readDiagnostics()).toMatchObject({backendState:"Disposed",activeRepresentations:0,
      residentRepresentationKeys:[],ownedCpuBytes:estimateMeshArtifactBytes(mesh)});
    expect(aGeometryDisposals).toBe(1);expect(aMaterialDisposals).toBe(1);
    expect(bGeometryDisposals).toBe(1);expect(bMaterialDisposals).toBe(failure==="material"?1:0);
    expect(renderers[0]!.disposals).toBe(1);
    expect(backend.renderFrame().status).toBe("BackendUnavailable");
    expect(backend.dispatch({kind:"DisposeBackend",backendRevision:backendRevision(0)})).toMatchObject({
      status:"BackendUnavailable",reasonCode:"EphemeralReleaseUncertain"});
    expect(aGeometryDisposals).toBe(1);expect(aMaterialDisposals).toBe(1);
    expect(bGeometryDisposals).toBe(1);expect(bMaterialDisposals).toBe(failure==="material"?1:0);
    expect(renderers[0]!.disposals).toBe(1);
  });

  it("retains terminal uncertainty when renderer teardown throws without retrying", () => {
    const { backend, renderers } = setup();
    const key = ephemeralRepresentationKey({ kind: "fragment" }, 0, 1);
    const mesh = ephemeralMesh(key);
    expect(registerEphemeral(backend, key, 1, 0).status).toBe("Accepted");
    expect(upsert(backend, mesh).status).toBe("Accepted");
    const geometry = (backend.representationRoot.children[0] as THREE.Mesh<THREE.BufferGeometry>).geometry;
    geometry.dispose = (): void => { throw new Error("injected resource release failure"); };
    expect(ephemeralRelease(backend, mesh, "RemoveRepresentation").status).toBe("BackendUnavailable");

    let rendererDisposeCalls = 0;
    renderers[0]!.dispose = (): void => { rendererDisposeCalls += 1; throw new Error("injected renderer teardown failure"); };
    expect(backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) })).toMatchObject({
      status: "BackendUnavailable",
      reasonCode: "EphemeralReleaseUncertain"
    });
    expect(backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) })).toMatchObject({
      status: "BackendUnavailable",
      reasonCode: "EphemeralReleaseUncertain"
    });
    expect(rendererDisposeCalls).toBe(1);
    expect(backend.renderFrame().status).toBe("BackendUnavailable");
  });

  it("reports released ownership when Dispose itself clears an ephemeral-only scene", () => {
    const { backend } = setup();
    const key = ephemeralRepresentationKey({ kind: "fragment" }, 0, 1);
    const mesh = ephemeralMesh(key);
    expect(registerEphemeral(backend, key, 1, 0).status).toBe("Accepted");
    expect(upsert(backend, mesh).status).toBe("Accepted");

    expect(backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) })).toMatchObject({
      status: "Accepted",
      ownership: "ReleasedByBackend"
    });
    expect(backend.dispatch({ kind: "DisposeBackend", backendRevision: backendRevision(0) })).toMatchObject({
      status: "AlreadyApplied",
      reasonCode: "BackendAlreadyDisposed"
    });
    expect(backend.readDiagnostics()).toMatchObject({
      backendState: "Disposed",
      activeRepresentations: 0,
      geometryDisposals: 1,
      materialDisposals: 1,
      ownedCpuBytes: 0,
      estimatedGpuBytes: 0
    });
  });

  it("fails closed for material release on Remove and geometry release on Evict", () => {
    const removed = setup();
    const removeKey = ephemeralRepresentationKey({ kind: "fragment" }, 0, 1);
    const removeMesh = ephemeralMesh(removeKey);
    expect(registerEphemeral(removed.backend, removeKey, 1, 0).status).toBe("Accepted");
    expect(upsert(removed.backend, removeMesh).status).toBe("Accepted");
    const removeNode = removed.backend.representationRoot.children[0] as THREE.Mesh;
    const removeMaterial = Array.isArray(removeNode.material) ? removeNode.material[0]! : removeNode.material;
    let removeMaterialDisposals = 0;
    removeMaterial.dispose = (): void => { removeMaterialDisposals += 1; throw new Error("injected material release failure"); };
    expect(ephemeralRelease(removed.backend, removeMesh, "RemoveRepresentation")).toMatchObject({ status: "BackendUnavailable", reasonCode: "EphemeralReleaseUncertain" });
    expect(ephemeralRelease(removed.backend, removeMesh, "RemoveRepresentation")).toMatchObject({ status: "BackendUnavailable", reasonCode: "EphemeralReleaseUncertain" });
    expect(removeMaterialDisposals).toBe(1);

    const evicted = setup();
    const evictKey = ephemeralRepresentationKey({ kind: "neighbor", part: "water" }, 0, 1);
    const evictMesh = ephemeralMesh(evictKey);
    expect(registerEphemeral(evicted.backend, evictKey, 1, 0).status).toBe("Accepted");
    expect(upsert(evicted.backend, evictMesh).status).toBe("Accepted");
    const evictGeometry = (evicted.backend.representationRoot.children[0] as THREE.Mesh<THREE.BufferGeometry>).geometry;
    let evictGeometryDisposals = 0;
    evictGeometry.dispose = (): void => { evictGeometryDisposals += 1; throw new Error("injected geometry release failure"); };
    expect(ephemeralRelease(evicted.backend, evictMesh, "EvictRepresentation")).toMatchObject({ status: "BackendUnavailable", reasonCode: "EphemeralReleaseUncertain" });
    expect(ephemeralRelease(evicted.backend, evictMesh, "RemoveRepresentation")).toMatchObject({ status: "BackendUnavailable", reasonCode: "EphemeralReleaseUncertain" });
    expect(evictGeometryDisposals).toBe(1);
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
