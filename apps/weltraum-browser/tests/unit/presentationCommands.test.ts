import { describe, expect, it } from "vitest";
import {
  artifactRevision,
  backendRevision,
  createFrameProjectionSnapshot,
  createMaterialProfile,
  createMeshArtifact,
  createRenderCommand,
  frameId,
  frameRevision,
  materialProfileId,
  renderCommandSignature,
  representationKey,
  sourceRevision,
  validateFrameProjectionSnapshot,
  validateRenderCommand,
  type ApplyFrameProjectionCommand,
  type MaterialProfile,
  type MeshArtifact
} from "../../src/presentation";

const profile = (id = "material:base"): MaterialProfile => createMaterialProfile({
  id: materialProfileId(id),
  kind: "Unlit",
  baseColor: { r: 0.25, g: 0.5, b: 0.75 },
  opacity: 1,
  doubleSided: false,
  wireframe: false,
  depthWrite: true
});

const artifact = (profileId = "material:base"): MeshArtifact => createMeshArtifact({
  representationKey: representationKey("mesh:child"),
  sourceRevision: sourceRevision(1),
  artifactRevision: artifactRevision(1),
  algorithmVersion: "mesh:v1",
  frameId: frameId("camera:local"),
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint16Array([0, 1, 2]),
  materialRanges: [{ materialProfileId: materialProfileId(profileId), startIndex: 0, indexCount: 3 }],
  bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } }
});

const twoProfileArtifact = (): MeshArtifact => createMeshArtifact({
  representationKey: representationKey("mesh:child"),
  sourceRevision: sourceRevision(1),
  artifactRevision: artifactRevision(1),
  algorithmVersion: "mesh:v1",
  frameId: frameId("camera:local"),
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 1]),
  materialRanges: [
    { materialProfileId: materialProfileId("material:a"), startIndex: 0, indexCount: 3 },
    { materialProfileId: materialProfileId("material:b"), startIndex: 3, indexCount: 3 }
  ],
  bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } }
});

describe("presentation commands", () => {
  it("creates immutable upserts while preserving exact artifact buffers", () => {
    const mesh = artifact();
    const command = createRenderCommand({
      kind: "UpsertMeshArtifact",
      backendRevision: backendRevision(0),
      artifact: mesh,
      materialProfiles: [profile()]
    });
    expect(Object.isFrozen(command)).toBe(true);
    expect(Object.isFrozen(command.materialProfiles)).toBe(true);
    expect(command.artifact.positions).toBe(mesh.positions);
    expect(validateRenderCommand(command)).toEqual({ valid: true });
  });

  it("requires exactly the material profiles referenced by the artifact", () => {
    const command = {
      kind: "UpsertMeshArtifact",
      backendRevision: backendRevision(0),
      artifact: artifact(),
      materialProfiles: [profile("material:other")]
    } as const;
    const result = validateRenderCommand(command);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.map((entry) => entry.code)).toContain("MaterialProfileCoverageMismatch");
  });

  it("produces input-order-independent signatures for set-like profile and transform inputs", () => {
    const firstMesh = twoProfileArtifact();
    const secondProfile = profile("material:b");
    const firstProfile = profile("material:a");
    const commandA = createRenderCommand({
      kind: "UpsertMeshArtifact",
      backendRevision: backendRevision(0),
      artifact: firstMesh,
      materialProfiles: [secondProfile, firstProfile]
    });
    const commandB = createRenderCommand({ ...commandA, materialProfiles: [firstProfile, secondProfile] });
    expect(renderCommandSignature(commandA)).toBe(renderCommandSignature(commandB));

    const base = {
      frameId: frameId("camera:local"),
      frameRevision: frameRevision(1),
      cameraPositionRelative: { x: 0, y: 0, z: 3 },
      cameraOrientation: { x: 0, y: 0, z: 0, w: 1 },
      projectionParameters: { kind: "Perspective" as const, verticalFovDegrees: 50, aspect: 16 / 9, near: 0.1, far: 100 }
    };
    const left = { representationKey: representationKey("mesh:a"), positionRelative: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } };
    const right = { ...left, representationKey: representationKey("mesh:b") };
    const projectionA = createFrameProjectionSnapshot({ ...base, representationTransforms: [right, left] });
    const projectionB = createFrameProjectionSnapshot({ ...base, representationTransforms: [left, right] });
    const projectionCommandA = createRenderCommand({ kind: "ApplyFrameProjection", backendRevision: backendRevision(0), snapshot: projectionA });
    const projectionCommandB = createRenderCommand({ kind: "ApplyFrameProjection", backendRevision: backendRevision(0), snapshot: projectionB });
    expect(renderCommandSignature(projectionCommandA)).toBe(renderCommandSignature(projectionCommandB));
  });

  it("rejects an invalid frame revision and invalid reset generation", () => {
    const snapshot = createFrameProjectionSnapshot({
      frameId: frameId("camera:local"),
      frameRevision: frameRevision(1),
      cameraPositionRelative: { x: 0, y: 0, z: 3 },
      cameraOrientation: { x: 0, y: 0, z: 0, w: 1 },
      projectionParameters: { kind: "Perspective", verticalFovDegrees: 50, aspect: 1, near: 0.1, far: 100 },
      representationTransforms: []
    });
    const invalidSnapshot = { ...snapshot, frameRevision: -1 } as unknown as typeof snapshot;
    expect(validateFrameProjectionSnapshot(invalidSnapshot).valid).toBe(false);
    const command: ApplyFrameProjectionCommand = { kind: "ApplyFrameProjection", backendRevision: backendRevision(0), snapshot: invalidSnapshot };
    expect(validateRenderCommand(command).valid).toBe(false);
    expect(validateRenderCommand({ kind: "ResetBackend", backendRevision: backendRevision(0), nextBackendRevision: backendRevision(2) }).valid).toBe(false);
  });

  it("fails closed for unknown command kinds and malformed command payloads", () => {
    const unknown = validateRenderCommand({ kind: "TeleportWorld", backendRevision: 0 });
    expect(unknown.valid).toBe(false);
    if (!unknown.valid) expect(unknown.issues.map((entry) => entry.code)).toContain("UnsupportedCommandKind");

    const malformed = validateRenderCommand({ kind: "UpsertMeshArtifact", backendRevision: 0 });
    expect(malformed.valid).toBe(false);
    if (!malformed.valid) expect(malformed.issues.map((entry) => entry.code)).toContain("MalformedCommandPayload");
  });

  it("rejects projection values outside the finite Float32 range", () => {
    const snapshot = createFrameProjectionSnapshot({
      frameId: frameId("camera:local"),
      frameRevision: frameRevision(2),
      cameraPositionRelative: { x: 0, y: 0, z: 3 },
      cameraOrientation: { x: 0, y: 0, z: 0, w: 1 },
      projectionParameters: { kind: "Perspective", verticalFovDegrees: 50, aspect: 1, near: 0.1, far: 100 },
      representationTransforms: []
    });
    expect(validateFrameProjectionSnapshot({
      ...snapshot,
      projectionParameters: { ...snapshot.projectionParameters, far: 1e100 }
    }).valid).toBe(false);
  });
});
