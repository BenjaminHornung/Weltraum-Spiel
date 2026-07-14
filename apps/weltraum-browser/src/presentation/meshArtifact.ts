import { canonicalSignature } from "./canonical";
import {
  isContentHash,
  compareAscii,
  validateRevision,
  validateSemanticId,
  type ArtifactRevision,
  type ContentHash,
  type FrameId,
  type RepresentationKey,
  type SourceRevision
} from "./ids";
import type { AxisAlignedBounds, MaterialRange, MeshArtifactAttributes } from "./types";
import {
  deepFreezeMetadata,
  invalidResult,
  isFiniteFloat32,
  issue,
  type ValidationIssue,
  type ValidationResult,
  validResult,
  throwIfInvalid
} from "./validation";

export type MeshIndexArray = Uint16Array | Uint32Array;
export type MeshArtifactOwnership = "SnapshotOwned" | "AdoptedExclusive";

export interface MeshArtifact {
  readonly representationKey: RepresentationKey;
  readonly sourceRevision: SourceRevision;
  readonly artifactRevision: ArtifactRevision;
  readonly algorithmVersion: string;
  readonly frameId: FrameId;
  readonly contentHash: ContentHash;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: MeshIndexArray;
  readonly attributes?: MeshArtifactAttributes;
  readonly materialRanges: readonly MaterialRange[];
  readonly bounds: AxisAlignedBounds;
  readonly ownership: MeshArtifactOwnership;
}

export interface MeshArtifactInput extends Omit<MeshArtifact, "contentHash" | "materialRanges" | "bounds" | "attributes" | "ownership"> {
  readonly attributes?: MeshArtifactAttributes;
  readonly materialRanges: readonly MaterialRange[];
  readonly bounds: AxisAlignedBounds;
}

type MeshArtifactContent = Omit<MeshArtifact, "contentHash" | "representationKey" | "sourceRevision" | "artifactRevision" | "ownership">;

const vectorRecord = (vector: AxisAlignedBounds["min"]): AxisAlignedBounds["min"] =>
  Object.freeze({ x: vector.x, y: vector.y, z: vector.z });

const canonicalRanges = (ranges: readonly MaterialRange[]): readonly MaterialRange[] => Object.freeze(
  [...ranges]
    .map((range) => Object.freeze({
      materialProfileId: range.materialProfileId,
      startIndex: range.startIndex,
      indexCount: range.indexCount
    }))
    .sort((left, right) => left.startIndex - right.startIndex || compareAscii(left.materialProfileId, right.materialProfileId))
);

const canonicalAttributes = (attributes: MeshArtifactAttributes | undefined): MeshArtifactAttributes | undefined => {
  if (attributes === undefined) {
    return undefined;
  }
  return Object.freeze({ uv: attributes.uv, color: attributes.color });
};

const contentFields = (artifact: MeshArtifactContent): unknown => ({
  version: 1,
  algorithmVersion: artifact.algorithmVersion,
  frameId: artifact.frameId,
  positions: artifact.positions,
  normals: artifact.normals,
  indices: artifact.indices,
  attributes: artifact.attributes,
  materialRanges: [...artifact.materialRanges]
    .map((range) => ({ ...range }))
    .sort((left, right) => left.startIndex - right.startIndex || compareAscii(left.materialProfileId, right.materialProfileId)),
  bounds: artifact.bounds
});

export const calculateMeshArtifactContentHash = (
  artifact: MeshArtifactContent
): ContentHash => canonicalSignature(contentFields(artifact));

const validateFullExclusiveBuffer = (
  value: ArrayBufferView,
  path: string,
  usedBuffers: Set<ArrayBufferLike>,
  issues: ValidationIssue[]
): void => {
  const buffer = value.buffer;
  if (!(buffer instanceof ArrayBuffer)) {
    issues.push(issue("SharedBufferUnsupported", path, "must use an unshared ArrayBuffer"));
    return;
  }
  if ((buffer as ArrayBuffer & { readonly resizable?: boolean }).resizable === true) {
    issues.push(issue("ResizableBufferUnsupported", path, "must use a fixed-length ArrayBuffer"));
  }
  if (value.byteOffset !== 0 || value.byteLength !== buffer.byteLength) {
    issues.push(issue("SubviewBufferUnsupported", path, "must be a full view over its backing buffer"));
  }
  if (usedBuffers.has(buffer)) {
    issues.push(issue("AliasedBufferUnsupported", path, "must not share a backing buffer with another attribute"));
  }
  usedBuffers.add(buffer);
};

const validateFloatArray = (value: unknown, path: string, components: number, vertexCount: number | undefined, issues: ValidationIssue[]): void => {
  if (!(value instanceof Float32Array)) {
    issues.push(issue("UnsupportedAttributeType", path, "must be a Float32Array"));
    return;
  }
  if (value.length === 0 || value.length % components !== 0) {
    issues.push(issue("InvalidAttributeLength", path, `must contain complete ${components}-component values`));
  }
  if (vertexCount !== undefined && value.length !== vertexCount * components) {
    issues.push(issue("InconsistentAttributeLength", path, `must contain exactly ${components} values per vertex`));
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Number.isFinite(value[index])) {
      issues.push(issue("NonFiniteAttribute", `${path}[${index}]`, "must be finite"));
      break;
    }
  }
};

export const validateMeshArtifact = (artifact: MeshArtifact): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const add = (result: ValidationResult): void => {
    if (!result.valid) issues.push(...result.issues);
  };
  add(validateSemanticId(artifact.representationKey, "representationKey"));
  add(validateRevision(artifact.sourceRevision, "sourceRevision"));
  add(validateRevision(artifact.artifactRevision, "artifactRevision"));
  add(validateSemanticId(artifact.algorithmVersion, "algorithmVersion"));
  add(validateSemanticId(artifact.frameId, "frameId"));
  if (artifact.ownership !== "SnapshotOwned" && artifact.ownership !== "AdoptedExclusive") {
    issues.push(issue("InvalidOwnershipMode", "ownership", "must be SnapshotOwned or AdoptedExclusive"));
  }
  if (!isContentHash(artifact.contentHash)) {
    issues.push(issue("InvalidContentHash", "contentHash", "must use the canonical fnv1a64 format"));
  }

  validateFloatArray(artifact.positions, "positions", 3, undefined, issues);
  const vertexCount = artifact.positions instanceof Float32Array ? artifact.positions.length / 3 : 0;
  if (!Number.isInteger(vertexCount) || vertexCount < 3) {
    issues.push(issue("EmptyMeshUnsupported", "positions", "must contain at least three vertices"));
  }
  validateFloatArray(artifact.normals, "normals", 3, Number.isInteger(vertexCount) ? vertexCount : undefined, issues);
  if (!(artifact.indices instanceof Uint16Array) && !(artifact.indices instanceof Uint32Array)) {
    issues.push(issue("UnsupportedIndexWidth", "indices", "must be Uint16Array or Uint32Array"));
  } else {
    if (artifact.indices.length < 3 || artifact.indices.length % 3 !== 0) {
      issues.push(issue("InvalidIndexLength", "indices", "must contain one or more complete triangles"));
    }
    for (let index = 0; index < artifact.indices.length; index += 1) {
      if (artifact.indices[index] >= vertexCount) {
        issues.push(issue("IndexOutOfRange", `indices[${index}]`, "must reference an existing vertex"));
        break;
      }
    }
  }

  if (artifact.attributes?.uv !== undefined) {
    validateFloatArray(artifact.attributes.uv, "attributes.uv", 2, vertexCount, issues);
  }
  if (artifact.attributes?.color !== undefined) {
    validateFloatArray(artifact.attributes.color, "attributes.color", 3, vertexCount, issues);
  }

  const usedBuffers = new Set<ArrayBufferLike>();
  const arrays: readonly (readonly [ArrayBufferView, string])[] = [
    [artifact.positions, "positions"],
    [artifact.normals, "normals"],
    [artifact.indices, "indices"],
    ...(artifact.attributes?.uv === undefined ? [] : [[artifact.attributes.uv, "attributes.uv"]] as const),
    ...(artifact.attributes?.color === undefined ? [] : [[artifact.attributes.color, "attributes.color"]] as const)
  ];
  for (const [array, path] of arrays) {
    if (ArrayBuffer.isView(array)) validateFullExclusiveBuffer(array, path, usedBuffers, issues);
  }

  if (artifact.materialRanges.length === 0) {
    issues.push(issue("MissingMaterialCoverage", "materialRanges", "must cover the full index buffer"));
  }
  let expectedStart = 0;
  for (let index = 0; index < artifact.materialRanges.length; index += 1) {
    const range = artifact.materialRanges[index];
    add(validateSemanticId(range.materialProfileId, `materialRanges[${index}].materialProfileId`));
    if (!Number.isSafeInteger(range.startIndex) || range.startIndex < 0 || range.startIndex % 3 !== 0) {
      issues.push(issue("InvalidMaterialRange", `materialRanges[${index}].startIndex`, "must be a non-negative triangle-aligned integer"));
    }
    if (!Number.isSafeInteger(range.indexCount) || range.indexCount <= 0 || range.indexCount % 3 !== 0) {
      issues.push(issue("InvalidMaterialRange", `materialRanges[${index}].indexCount`, "must be a positive triangle-aligned integer"));
    }
    if (range.startIndex !== expectedStart) {
      issues.push(issue("MaterialCoverageGap", `materialRanges[${index}]`, "ranges must be sorted, non-overlapping, and gapless"));
    }
    expectedStart = range.startIndex + range.indexCount;
  }
  if (artifact.indices instanceof Uint16Array || artifact.indices instanceof Uint32Array) {
    if (expectedStart !== artifact.indices.length) {
      issues.push(issue("IncompleteMaterialCoverage", "materialRanges", "must cover the complete index buffer"));
    }
  }

  const boundsValues = [
    artifact.bounds.min.x, artifact.bounds.min.y, artifact.bounds.min.z,
    artifact.bounds.max.x, artifact.bounds.max.y, artifact.bounds.max.z
  ];
  if (!boundsValues.every(isFiniteFloat32)) {
    issues.push(issue("NonFiniteBounds", "bounds", "must contain finite Float32-compatible values"));
  }
  if (artifact.bounds.min.x > artifact.bounds.max.x || artifact.bounds.min.y > artifact.bounds.max.y || artifact.bounds.min.z > artifact.bounds.max.z) {
    issues.push(issue("InvalidBoundsOrder", "bounds", "min must not exceed max"));
  }
  if (artifact.positions instanceof Float32Array) {
    for (let index = 0; index + 2 < artifact.positions.length; index += 3) {
      const x = artifact.positions[index];
      const y = artifact.positions[index + 1];
      const z = artifact.positions[index + 2];
      if (x < artifact.bounds.min.x || x > artifact.bounds.max.x || y < artifact.bounds.min.y || y > artifact.bounds.max.y || z < artifact.bounds.min.z || z > artifact.bounds.max.z) {
        issues.push(issue("BoundsExcludeVertex", `positions[${index / 3}]`, "bounds must contain every vertex"));
        break;
      }
    }
  }

  if (issues.length === 0 && artifact.contentHash !== calculateMeshArtifactContentHash(artifact)) {
    issues.push(issue("ContentHashMismatch", "contentHash", "does not match canonical mesh content"));
  }
  return issues.length === 0 ? validResult() : invalidResult(issues);
};

const invalidInput = (path: string, message: string): never => {
  throwIfInvalid("MeshArtifactInput", invalidResult([issue("InvalidMeshArtifactInput", path, message)]));
  throw new Error("unreachable");
};

const requireFloat32Array = (value: unknown, path: string): Float32Array =>
  value instanceof Float32Array ? value : invalidInput(path, "must be a Float32Array");

const requireMeshIndexArray = (value: unknown, path: string): MeshIndexArray =>
  value instanceof Uint16Array || value instanceof Uint32Array
    ? value
    : invalidInput(path, "must be a Uint16Array or Uint32Array");

const copyFloat32Array = (value: unknown, path: string): Float32Array =>
  new Float32Array(requireFloat32Array(value, path));

const copyMeshIndexArray = (value: unknown, path: string): MeshIndexArray => {
  const typed = requireMeshIndexArray(value, path);
  return typed instanceof Uint16Array ? new Uint16Array(typed) : new Uint32Array(typed);
};

interface MeshArtifactBuffers {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: MeshIndexArray;
  readonly attributes?: MeshArtifactAttributes;
}

const snapshotBuffers = (input: MeshArtifactInput): MeshArtifactBuffers => ({
  positions: copyFloat32Array(input.positions, "positions"),
  normals: copyFloat32Array(input.normals, "normals"),
  indices: copyMeshIndexArray(input.indices, "indices"),
  attributes: input.attributes === undefined
    ? undefined
    : {
        uv: input.attributes.uv === undefined ? undefined : copyFloat32Array(input.attributes.uv, "attributes.uv"),
        color: input.attributes.color === undefined ? undefined : copyFloat32Array(input.attributes.color, "attributes.color")
      }
});

const adoptedBuffers = (input: MeshArtifactInput): MeshArtifactBuffers => ({
  positions: requireFloat32Array(input.positions, "positions"),
  normals: requireFloat32Array(input.normals, "normals"),
  indices: requireMeshIndexArray(input.indices, "indices"),
  attributes: input.attributes === undefined
    ? undefined
    : {
        uv: input.attributes.uv === undefined ? undefined : requireFloat32Array(input.attributes.uv, "attributes.uv"),
        color: input.attributes.color === undefined ? undefined : requireFloat32Array(input.attributes.color, "attributes.color")
      }
});

const buildMeshArtifact = (input: MeshArtifactInput, ownership: MeshArtifactOwnership, buffers: MeshArtifactBuffers): MeshArtifact => {
  const materialRanges = canonicalRanges(input.materialRanges);
  const attributes = canonicalAttributes(buffers.attributes);
  const bounds = Object.freeze({ min: vectorRecord(input.bounds.min), max: vectorRecord(input.bounds.max) });
  const content = {
    algorithmVersion: input.algorithmVersion,
    frameId: input.frameId,
    positions: buffers.positions,
    normals: buffers.normals,
    indices: buffers.indices,
    attributes,
    materialRanges,
    bounds
  } satisfies MeshArtifactContent;
  const withoutHash = {
    representationKey: input.representationKey,
    sourceRevision: input.sourceRevision,
    artifactRevision: input.artifactRevision,
    ...content,
    ownership
  };
  const artifact: MeshArtifact = Object.freeze({
    ...withoutHash,
    contentHash: calculateMeshArtifactContentHash(content)
  });
  throwIfInvalid("MeshArtifact", validateMeshArtifact(artifact));
  return deepFreezeMetadata(artifact);
};

/**
 * Creates the normal public MeshArtifact snapshot. Every caller Typed Array is
 * copied exactly once; the returned artifact never observes later caller
 * mutations. The backend may reference the snapshot arrays directly.
 */
export const createMeshArtifact = (input: MeshArtifactInput): MeshArtifact =>
  buildMeshArtifact(input, "SnapshotOwned", snapshotBuffers(input));

/**
 * Trusted worker-result move path. This function never copies mesh buffers.
 * It accepts only fully validated, exclusive, unshared, non-resizable full
 * ArrayBuffer views. Successful return transfers logical ownership to the
 * artifact/backend; callers must not mutate, detach, transfer, or reuse the
 * accepted buffers. Rejection leaves ownership with the caller.
 */
export const adoptMeshArtifactBuffers = (input: MeshArtifactInput): MeshArtifact =>
  buildMeshArtifact(input, "AdoptedExclusive", adoptedBuffers(input));

export const meshArtifactOwnedBuffers = (artifact: MeshArtifact): readonly ArrayBuffer[] => Object.freeze([
  artifact.positions.buffer as ArrayBuffer,
  artifact.normals.buffer as ArrayBuffer,
  artifact.indices.buffer as ArrayBuffer,
  ...(artifact.attributes?.uv === undefined ? [] : [artifact.attributes.uv.buffer as ArrayBuffer]),
  ...(artifact.attributes?.color === undefined ? [] : [artifact.attributes.color.buffer as ArrayBuffer])
]);

export const estimateMeshArtifactBytes = (artifact: MeshArtifact): number =>
  meshArtifactOwnedBuffers(artifact).reduce((total, buffer) => total + buffer.byteLength, 0);
