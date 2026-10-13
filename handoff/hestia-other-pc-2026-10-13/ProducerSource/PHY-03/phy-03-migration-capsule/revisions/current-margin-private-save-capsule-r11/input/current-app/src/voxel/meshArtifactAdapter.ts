import {
  adoptMeshArtifactBuffers,
  createMeshArtifact,
  materialProfileId,
  type ArtifactRevision,
  type MaterialProfileId,
  type MeshArtifact
} from "../presentation";
import { validateVoxelMeshProduct } from "./surfaceNets";
import type { VoxelMeshProduct } from "./types";

export type VoxelMeshArtifactOwnership = "SnapshotOwned" | "AdoptedExclusive";

export interface VoxelMeshArtifactAdapterOptions {
  /** Resolves a neutral material key to the profile ID supplied to the renderer. */
  readonly materialProfileIdForKey: (materialKey: VoxelMeshProduct["materialRanges"][number]["materialKey"]) => MaterialProfileId | string;
  /** Overrides only the Presentation publication revision; neutral product identity remains unchanged. */
  readonly artifactRevision?: ArtifactRevision;
}

const inputForArtifact = (
  product: VoxelMeshProduct,
  materialRanges: ReturnType<typeof materializeMaterialRanges>,
  options: VoxelMeshArtifactAdapterOptions
) => ({
  representationKey: product.representationKey as unknown as Parameters<typeof createMeshArtifact>[0]["representationKey"],
  sourceRevision: product.sourceRevision as unknown as Parameters<typeof createMeshArtifact>[0]["sourceRevision"],
  artifactRevision: options.artifactRevision
    ?? product.artifactRevision as unknown as Parameters<typeof createMeshArtifact>[0]["artifactRevision"],
  algorithmVersion: product.algorithmVersion,
  frameId: product.frameId as unknown as Parameters<typeof createMeshArtifact>[0]["frameId"],
  positions: product.positions,
  normals: product.normals,
  indices: product.indices,
  materialRanges,
  bounds: {
    min: { x: product.bounds.min.x, y: product.bounds.min.y, z: product.bounds.min.z },
    max: { x: product.bounds.max.x, y: product.bounds.max.y, z: product.bounds.max.z }
  }
});

const materializeMaterialRanges = (
  product: VoxelMeshProduct,
  options: VoxelMeshArtifactAdapterOptions
) => product.materialRanges.map((range) => ({
  materialProfileId: materialProfileId(options.materialProfileIdForKey(range.materialKey)),
  startIndex: range.startIndex,
  indexCount: range.indexCount
}));

const validateProduct = (product: VoxelMeshProduct): void => {
  if (product.positions.length === 0) {
    throw new RangeError("VoxelMeshProduct with empty geometry cannot become a MeshArtifact");
  }
  const validation = validateVoxelMeshProduct(product);
  if (!validation.valid) {
    throw new RangeError(`VoxelMeshProduct is invalid: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
};

const convert = (
  product: VoxelMeshProduct,
  ownership: VoxelMeshArtifactOwnership,
  options: VoxelMeshArtifactAdapterOptions
): MeshArtifact => {
  const materialRanges = materializeMaterialRanges(product, options);
  // The resolver is external code; its mutations must be caught by the final
  // canonical validation before any ownership transfer or snapshot occurs.
  validateProduct(product);
  const input = inputForArtifact(product, materialRanges, options);
  return ownership === "SnapshotOwned" ? createMeshArtifact(input) : adoptMeshArtifactBuffers(input);
};

/** Copies all product buffers; empty products are rejected because MeshArtifact requires triangles. */
export const createMeshArtifactFromVoxelMeshProduct = (
  product: VoxelMeshProduct,
  options: VoxelMeshArtifactAdapterOptions
): MeshArtifact => convert(product, "SnapshotOwned", options);

/**
 * Moves only directly owned worker buffers. The caller must have exclusive,
 * fixed, unshared full-buffer views and must not reuse them after success;
 * failed validation leaves them untouched.
 */
export const adoptMeshArtifactFromVoxelMeshProduct = (
  product: VoxelMeshProduct,
  options: VoxelMeshArtifactAdapterOptions
): MeshArtifact => convert(product, "AdoptedExclusive", options);
