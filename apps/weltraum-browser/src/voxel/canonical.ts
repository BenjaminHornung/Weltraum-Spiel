import {
  voxelContentHash,
  voxelMeshRepresentationKey,
  type VoxelContentHash,
  type VoxelMeshRepresentationKey
} from "./ids";
import type { VoxelBrickContent, VoxelMeshProductContent } from "./types";

const PREFIX = "weltraum-voxel-brick-v1\n";
const SPATIAL_TARGET_PREFIX = "weltraum-voxel-spatial-target-v1\n";
const MESH_IDENTITY_PREFIX = "weltraum-voxel-mesh-identity-v2\n";
const MESH_PRODUCT_PREFIX = "weltraum-voxel-mesh-product-v1\n";

const asciiBytes = (value: string): Uint8Array => {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0x7f) throw new TypeError("Canonical VoxelBrick metadata must be ASCII");
    bytes[index] = code;
  }
  return bytes;
};

const fnv1a64Hex = (bytes: Uint8Array): string => {
  // Independently established fixed vectors in voxelBrick.test.ts and voxelSurfaceNets.test.ts guard this helper from drift.
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
};

const canonicalHeader = (brick: VoxelBrickContent): string => JSON.stringify({
  schemaVersion: brick.schemaVersion,
  layoutVersion: brick.layoutVersion,
  indexOrder: brick.indexOrder,
  bodyId: brick.bodyId,
  surfaceFrameId: brick.surfaceFrameId,
  regionId: brick.regionId,
  brickCoordinate: [brick.brickCoordinate.x, brick.brickCoordinate.y, brick.brickCoordinate.z],
  voxelSizeMeters: brick.voxelSizeMeters,
  cellDimensions: [brick.cellDimensions.x, brick.cellDimensions.y, brick.cellDimensions.z],
  sampleDimensions: [brick.sampleDimensions.x, brick.sampleDimensions.y, brick.sampleDimensions.z],
  apronWidth: brick.apronWidth,
  generatorVersion: brick.generatorVersion,
  materialRegistryVersion: brick.materialRegistryVersion,
  sourceRevision: brick.sourceRevision,
  editRevision: brick.editRevision,
  density: { format: "Float32LE", elementCount: brick.densityBuffer.length },
  material: { format: "Uint8", elementCount: brick.materialBuffer.length }
});

/**
 * Self-delimiting canonical bytes. Float32 samples are explicitly little-endian,
 * so host endianness, object insertion order, and typed-array backing offsets do
 * not affect serialization.
 */
export const serializeCanonicalVoxelBrick = (brick: VoxelBrickContent): Uint8Array => {
  const prefix = asciiBytes(PREFIX);
  const header = asciiBytes(canonicalHeader(brick));
  const output = new Uint8Array(
    prefix.length + 4 + header.length + brick.densityBuffer.byteLength + brick.materialBuffer.byteLength
  );
  let offset = 0;
  output.set(prefix, offset);
  offset += prefix.length;
  new DataView(output.buffer).setUint32(offset, header.length, true);
  offset += 4;
  output.set(header, offset);
  offset += header.length;
  const view = new DataView(output.buffer);
  for (let index = 0; index < brick.densityBuffer.length; index += 1) {
    view.setFloat32(offset, brick.densityBuffer[index], true);
    offset += Float32Array.BYTES_PER_ELEMENT;
  }
  output.set(brick.materialBuffer, offset);
  return output;
};

export const calculateVoxelBrickContentHash = (brick: VoxelBrickContent): VoxelContentHash => {
  // Intentionally local rather than importing Presentation: the VoxelBrick contract is renderer-neutral.
  return voxelContentHash(`fnv1a64:${fnv1a64Hex(serializeCanonicalVoxelBrick(brick))}`);
};

const spatialIdentity = (
  brick: Pick<VoxelBrickContent, "bodyId" | "surfaceFrameId" | "regionId" | "brickCoordinate">
): string => JSON.stringify([
    brick.bodyId,
    brick.surfaceFrameId,
    brick.regionId,
    [brick.brickCoordinate.x, brick.brickCoordinate.y, brick.brickCoordinate.z]
  ]);

const hashPrefixedIdentity = (prefixValue: string, identity: string): string => {
  const prefix = asciiBytes(prefixValue);
  const json = asciiBytes(identity);
  const bytes = new Uint8Array(prefix.length + json.length);
  bytes.set(prefix, 0);
  bytes.set(json, prefix.length);
  return fnv1a64Hex(bytes);
};

/** Request-known spatial identity. It deliberately excludes generated content. */
export const calculateVoxelSpatialJobTargetKey = (
  brick: Pick<VoxelBrickContent, "bodyId" | "surfaceFrameId" | "regionId" | "brickCoordinate">
): string => `voxel_spatial:${hashPrefixedIdentity(SPATIAL_TARGET_PREFIX, spatialIdentity(brick))}`;

/** Post-generation representation identity. Callers must supply a validated canonical brick. */
export const calculateVoxelMeshRepresentationKey = (
  brick: Pick<VoxelBrickContent, "bodyId" | "surfaceFrameId" | "regionId" | "brickCoordinate">
    & Readonly<{ contentHash: VoxelContentHash }>,
  meshAlgorithmVersion: string
): VoxelMeshRepresentationKey => {
  if (typeof meshAlgorithmVersion !== "string" || meshAlgorithmVersion.length === 0) {
    throw new TypeError("meshAlgorithmVersion must be a nonempty ASCII identifier");
  }
  const identity = JSON.stringify([
    spatialIdentity(brick),
    brick.contentHash,
    meshAlgorithmVersion
  ]);
  return voxelMeshRepresentationKey(`voxel_mesh:${hashPrefixedIdentity(MESH_IDENTITY_PREFIX, identity)}`);
};

const canonicalVoxelMeshHeader = (product: VoxelMeshProductContent): string => JSON.stringify({
  schemaVersion: product.schemaVersion,
  representationKey: product.representationKey,
  sourceRevision: product.sourceRevision,
  artifactRevision: product.artifactRevision,
  algorithmVersion: product.algorithmVersion,
  frameId: product.frameId,
  materialRegistryVersion: product.materialRegistryVersion,
  positions: { format: "Float32LE", elementCount: product.positions.length },
  normals: { format: "Float32LE", elementCount: product.normals.length },
  indices: {
    format: product.indices instanceof Uint16Array ? "Uint16LE" : "Uint32LE",
    elementCount: product.indices.length
  },
  materialRanges: product.materialRanges.map((range) => [
    range.materialId,
    range.materialKey,
    range.startIndex,
    range.indexCount
  ]),
  bounds: { format: "Float32LE", elementCount: 6 }
});

export const serializeCanonicalVoxelMeshProduct = (product: VoxelMeshProductContent): Uint8Array => {
  const prefix = asciiBytes(MESH_PRODUCT_PREFIX);
  const header = asciiBytes(canonicalVoxelMeshHeader(product));
  const indexBytes = product.indices.length * product.indices.BYTES_PER_ELEMENT;
  const output = new Uint8Array(
    prefix.length
      + 4
      + header.length
      + 6 * Float32Array.BYTES_PER_ELEMENT
      + product.positions.byteLength
      + product.normals.byteLength
      + indexBytes
  );
  const view = new DataView(output.buffer);
  let offset = 0;
  output.set(prefix, offset);
  offset += prefix.length;
  view.setUint32(offset, header.length, true);
  offset += 4;
  output.set(header, offset);
  offset += header.length;

  const bounds = [
    product.bounds.min.x,
    product.bounds.min.y,
    product.bounds.min.z,
    product.bounds.max.x,
    product.bounds.max.y,
    product.bounds.max.z
  ];
  for (const value of bounds) {
    view.setFloat32(offset, value, true);
    offset += Float32Array.BYTES_PER_ELEMENT;
  }
  for (const value of product.positions) {
    view.setFloat32(offset, value, true);
    offset += Float32Array.BYTES_PER_ELEMENT;
  }
  for (const value of product.normals) {
    view.setFloat32(offset, value, true);
    offset += Float32Array.BYTES_PER_ELEMENT;
  }
  if (product.indices instanceof Uint16Array) {
    for (const value of product.indices) {
      view.setUint16(offset, value, true);
      offset += Uint16Array.BYTES_PER_ELEMENT;
    }
  } else {
    for (const value of product.indices) {
      view.setUint32(offset, value, true);
      offset += Uint32Array.BYTES_PER_ELEMENT;
    }
  }
  return output;
};

export const calculateVoxelMeshContentHash = (product: VoxelMeshProductContent): VoxelContentHash =>
  voxelContentHash(`fnv1a64:${fnv1a64Hex(serializeCanonicalVoxelMeshProduct(product))}`);
