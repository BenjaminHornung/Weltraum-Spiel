import {
  artifactRevision,
  createMeshArtifact,
  sourceRevision,
  validateSemanticId,
  type FrameId,
  type MaterialProfile,
  type MeshArtifact,
  type RepresentationKey,
  type RepresentationTransformSnapshot
} from "../../presentation";
import type { PlayAssetProjection } from "./playAssetLoader";

const MAX_BATCH_PARTS = 640;
const VERTEX_COLOR_PROFILE = "fp06_vertex_color";
const BATCH_ALGORITHM = "factory-play-batch-vertex-colors-v1";

const admittedPartIds: Readonly<Record<string, string>> = Object.freeze({
  play_cable_link_v1: "paid_route",
  play_cable_end_v1: "paid_route",
  play_steel_v1: "lot",
  play_semi_v1: "lot",
  play_profile_v1: "lot",
  play_sheet_v1: "lot",
  play_offcut_v1: "lot"
});

export interface FactoryPlayBatchInstance {
  readonly projection: PlayAssetProjection;
  readonly transform: RepresentationTransformSnapshot;
}

export interface FactoryPlayBatchCosts {
  readonly vertices: number;
  readonly indices: number;
  readonly indexBytes: 0 | 2 | 4;
  readonly geometryBytes: number;
  readonly cpuBytes: number;
  readonly meshBytes: number;
  readonly triangles: number;
  readonly drawCalls: 0 | 1;
}

export interface FactoryPlayBatchEstimate extends FactoryPlayBatchCosts {
  readonly materialProfiles: readonly MaterialProfile[];
  readonly frameId: FrameId | null;
}

export interface FactoryPlayBatch {
  readonly artifact: MeshArtifact | null;
  readonly materialProfiles: readonly MaterialProfile[];
  readonly costs: FactoryPlayBatchCosts;
}

interface BatchTransform {
  readonly position: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly rotation: readonly [number, number, number, number, number, number, number, number, number];
}

interface BatchSource {
  readonly artifact: MeshArtifact;
  readonly colors: Float32Array;
  readonly transform: BatchTransform;
  readonly vertices: number;
  readonly indices: number;
  readonly materialProfile: MaterialProfile;
}

const invalidBatch = (reason: string): never => {
  throw new Error(`Factory play batch rejected: ${reason}`);
};

const vector = (value: { readonly x: number; readonly y: number; readonly z: number }, positive = false): readonly [number, number, number] => {
  const result = [value.x, value.y, value.z] as const;
  if (!result.every(Number.isFinite) || (positive && result.some(component => component <= 0))) {
    return invalidBatch("invalid transform vector");
  }
  return result;
};

const readTransform = (transform: RepresentationTransformSnapshot): BatchTransform => {
  if (!validateSemanticId(transform.representationKey).valid) invalidBatch("invalid representation key");
  const position = vector(transform.positionRelative);
  const scale = vector(transform.scale, true);
  const { x, y, z, w } = transform.orientation;
  const magnitude = Math.hypot(x, y, z, w);
  if (![x, y, z, w].every(Number.isFinite) || Math.abs(magnitude - 1) > 1e-4) {
    return invalidBatch("invalid orientation");
  }

  const qx = x / magnitude, qy = y / magnitude, qz = z / magnitude, qw = w / magnitude;
  const rotation = [
    1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw),
    2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw),
    2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)
  ] as const;
  return Object.freeze({ position, scale, rotation });
};

const requireClosedVertexProfile = (projection: PlayAssetProjection, artifact: MeshArtifact): MaterialProfile => {
  const [part] = projection.parts;
  if (projection.parts.length !== 1 || !part || part.partId !== admittedPartIds[projection.assetId]) {
    return invalidBatch("source is outside the closed one-part batch set");
  }
  if (artifact.frameId !== projection.frameId || artifact.algorithmVersion !== "factory-play-glb-vertex-colors-v1") {
    return invalidBatch("source projection is not a validated vertex-color part");
  }
  const [profile] = part.materialProfiles;
  if (!profile || part.materialProfiles.length !== 1 || profile.id !== VERTEX_COLOR_PROFILE
    || profile.kind !== "BasicLit" || profile.baseColor.r !== 1 || profile.baseColor.g !== 1 || profile.baseColor.b !== 1
    || profile.opacity !== 1 || profile.doubleSided || profile.wireframe || !profile.depthWrite) {
    return invalidBatch("source material profile is not the closed vertex-color profile");
  }
  const color = artifact.attributes?.color;
  const range = artifact.materialRanges[0];
  if (!(color instanceof Float32Array) || color.length !== artifact.positions.length
    || artifact.materialRanges.length !== 1 || !range || range.materialProfileId !== profile.id
    || range.startIndex !== 0 || range.indexCount !== artifact.indices.length) {
    return invalidBatch("source vertex-color buffers are inconsistent");
  }
  return profile;
};

const sourceFor = (instance: FactoryPlayBatchInstance, transform: BatchTransform): BatchSource => {
  if (!Object.hasOwn(admittedPartIds, instance.projection.assetId)) {
    return invalidBatch("source asset is outside the closed batch set");
  }
  const projection = instance.projection;
  if (!Array.isArray(projection.parts) || projection.parts.length !== 1) {
    return invalidBatch("source must contain exactly one render part");
  }
  const part = projection.parts[0]!;
  const artifact = part.artifact;
  const positions = artifact.positions;
  const normals = artifact.normals;
  const indices = artifact.indices;
  if (!(positions instanceof Float32Array) || positions.length < 9 || positions.length % 3 !== 0
    || !(normals instanceof Float32Array) || normals.length !== positions.length
    || (!(indices instanceof Uint16Array) && !(indices instanceof Uint32Array))
    || indices.length < 3 || indices.length % 3 !== 0) {
    return invalidBatch("source mesh buffers are inconsistent");
  }
  const vertices = positions.length / 3;
  if (part.partId !== admittedPartIds[projection.assetId]) return invalidBatch("source part is outside the closed batch set");
  const materialProfile = requireClosedVertexProfile(projection, artifact);
  return Object.freeze({ artifact, colors: artifact.attributes!.color!, transform, vertices, indices: indices.length, materialProfile });
};

const readBatch = (instances: readonly FactoryPlayBatchInstance[]): Readonly<{
  sources: readonly BatchSource[];
  materialProfiles: readonly MaterialProfile[];
  frameId: FrameId | null;
  costs: FactoryPlayBatchCosts;
}> => {
  if (!Array.isArray(instances) || instances.length > MAX_BATCH_PARTS) {
    return invalidBatch("batch part count exceeds 640");
  }
  const keys = new Set<string>();
  const sources: BatchSource[] = [];
  let frame: FrameId | null = null, vertices = 0, indices = 0;
  for (const instance of instances) {
    if (!instance || typeof instance !== "object" || !instance.projection || !instance.transform) {
      return invalidBatch("missing instance projection or transform");
    }
    const transform = readTransform(instance.transform);
    if (keys.has(instance.transform.representationKey)) return invalidBatch("duplicate instance representation key");
    keys.add(instance.transform.representationKey);
    const source = sourceFor(instance, transform);
    const sourceFrame = source.artifact.frameId;
    if (frame !== null && sourceFrame !== frame) return invalidBatch("source frames do not match");
    frame ??= sourceFrame;
    sources.push(source);
    vertices += source.vertices;
    indices += source.indices;
    if (!Number.isSafeInteger(vertices) || !Number.isSafeInteger(indices)) return invalidBatch("buffer counts overflow");
  }
  if (sources.length === 0) {
    return Object.freeze({ sources: Object.freeze(sources), materialProfiles: Object.freeze([]), frameId: null,
      costs: Object.freeze({ vertices: 0, indices: 0, indexBytes: 0, geometryBytes: 0, cpuBytes: 0, meshBytes: 0, triangles: 0, drawCalls: 0 }) });
  }
  if (vertices > 0xffff_ffff) return invalidBatch("vertex count exceeds Uint32 indices");
  const indexBytes: 2 | 4 = vertices <= 0xffff ? 2 : 4;
  const geometryBytes = vertices * 36 + indices * indexBytes;
  const cpuBytes = geometryBytes * 3, meshBytes = geometryBytes * 2;
  if (![geometryBytes, cpuBytes, meshBytes].every(Number.isSafeInteger)) return invalidBatch("geometry cost overflows");
  const firstProfile = sources[0]!.materialProfile;
  if (sources.some(source => source.materialProfile.id !== firstProfile.id)) return invalidBatch("material profiles do not match");
  return Object.freeze({ sources: Object.freeze(sources), materialProfiles: Object.freeze([firstProfile]), frameId: frame,
    costs: Object.freeze({ vertices, indices, indexBytes, geometryBytes, cpuBytes, meshBytes, triangles: indices / 3, drawCalls: 1 }) });
};

const costsOnly = (estimate: FactoryPlayBatchEstimate): FactoryPlayBatchCosts => Object.freeze({
  vertices: estimate.vertices,
  indices: estimate.indices,
  indexBytes: estimate.indexBytes,
  geometryBytes: estimate.geometryBytes,
  cpuBytes: estimate.cpuBytes,
  meshBytes: estimate.meshBytes,
  triangles: estimate.triangles,
  drawCalls: estimate.drawCalls
});

/** Computes the exact combined geometry buffers and copy cost without allocating typed arrays. */
export const estimateFactoryPlayBatch = (instances: readonly FactoryPlayBatchInstance[]): FactoryPlayBatchEstimate => {
  const batch = readBatch(instances);
  return Object.freeze({ ...batch.costs, materialProfiles: batch.materialProfiles, frameId: batch.frameId });
};

/** Transforms the closed one-part render templates into one owned vertex-color mesh. */
export const createFactoryPlayBatch = (batchKey: RepresentationKey, instances: readonly FactoryPlayBatchInstance[]): FactoryPlayBatch => {
  if (!validateSemanticId(batchKey).valid) return invalidBatch("invalid batch representation key");
  // Recheck the estimate at the allocation boundary; the caller's earlier budget
  // admission is not trusted as a substitute for this synchronous preflight.
  const estimate = estimateFactoryPlayBatch(instances);
  if (estimate.drawCalls === 0) {
    return Object.freeze({ artifact: null, materialProfiles: Object.freeze([]), costs: costsOnly(estimate) });
  }
  const batch = readBatch(instances);
  if (batch.costs.geometryBytes !== estimate.geometryBytes || batch.costs.vertices !== estimate.vertices
    || batch.costs.indices !== estimate.indices || !batch.frameId) {
    return invalidBatch("source changed after preflight");
  }

  const positions = new Float32Array(estimate.vertices * 3);
  const normals = new Float32Array(estimate.vertices * 3);
  const colors = new Float32Array(estimate.vertices * 3);
  const indices = estimate.indexBytes === 2 ? new Uint16Array(estimate.indices) : new Uint32Array(estimate.indices);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let vertexOffset = 0, indexOffset = 0;
  for (const source of batch.sources) {
    const inputPositions = source.artifact.positions;
    const inputNormals = source.artifact.normals;
    const inputIndices = source.artifact.indices;
    const { position, scale, rotation } = source.transform;
    const [r00, r01, r02, r10, r11, r12, r20, r21, r22] = rotation;
    for (let vertex = 0; vertex < source.vertices; vertex += 1) {
      const offset = vertex * 3, target = (vertexOffset + vertex) * 3;
      const x = inputPositions[offset]!, y = inputPositions[offset + 1]!, z = inputPositions[offset + 2]!;
      positions[target] = r00! * x * scale[0] + r01! * y * scale[1] + r02! * z * scale[2] + position[0];
      positions[target + 1] = r10! * x * scale[0] + r11! * y * scale[1] + r12! * z * scale[2] + position[1];
      positions[target + 2] = r20! * x * scale[0] + r21! * y * scale[1] + r22! * z * scale[2] + position[2];
      const px = positions[target]!, py = positions[target + 1]!, pz = positions[target + 2]!;
      if (![px, py, pz].every(Number.isFinite)) return invalidBatch("transformed position is not finite");
      min[0] = Math.min(min[0]!, px); min[1] = Math.min(min[1]!, py); min[2] = Math.min(min[2]!, pz);
      max[0] = Math.max(max[0]!, px); max[1] = Math.max(max[1]!, py); max[2] = Math.max(max[2]!, pz);

      const nx = inputNormals[offset]! / scale[0], ny = inputNormals[offset + 1]! / scale[1], nz = inputNormals[offset + 2]! / scale[2];
      const tx = r00! * nx + r01! * ny + r02! * nz;
      const ty = r10! * nx + r11! * ny + r12! * nz;
      const tz = r20! * nx + r21! * ny + r22! * nz;
      const length = Math.hypot(tx, ty, tz);
      if (!Number.isFinite(length) || length <= 0) return invalidBatch("transformed normal is invalid");
      normals[target] = tx / length; normals[target + 1] = ty / length; normals[target + 2] = tz / length;
      colors[target] = source.colors[offset]!;
      colors[target + 1] = source.colors[offset + 1]!;
      colors[target + 2] = source.colors[offset + 2]!;
    }
    for (let index = 0; index < source.indices; index += 1) {
      const value = inputIndices[index]!;
      if (value >= source.vertices) return invalidBatch("source index is out of range");
      indices[indexOffset + index] = vertexOffset + value;
    }
    vertexOffset += source.vertices;
    indexOffset += source.indices;
  }

  const materialProfile = batch.materialProfiles[0]!;
  const artifact = createMeshArtifact({
    representationKey: batchKey,
    sourceRevision: sourceRevision(1),
    artifactRevision: artifactRevision(1),
    algorithmVersion: BATCH_ALGORITHM,
    frameId: batch.frameId,
    positions,
    normals,
    indices,
    attributes: { color: colors },
    materialRanges: [{ materialProfileId: materialProfile.id, startIndex: 0, indexCount: indices.length }],
    bounds: { min: { x: min[0]!, y: min[1]!, z: min[2]! }, max: { x: max[0]!, y: max[1]!, z: max[2]! } }
  });
  return Object.freeze({ artifact, materialProfiles: batch.materialProfiles, costs: batch.costs });
};
