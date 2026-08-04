import type { StructuralObject } from "./types";

export interface StructuralConnectivityWork {
  readonly mode: "Full" | "RevisionOnly" | "TopologyRetained" | "DeletionFrontier";
  readonly candidateCellCount: number;
  readonly sourceBrickCount: number;
  readonly rebuiltBrickCount: number;
  readonly reusedBrickCount: number;
  readonly removedCellCount: number;
  /** Fresh coordinate-based classifier cells. This is not total incremental work. */
  readonly fullVoxelTraversalCount: number;
  /** Cells reached by a coordinate frontier. Zero does not imply bounded total work. */
  readonly frontierVisitedCellCount: number;
  /** Coordinate neighbor lookups performed for full classification or a deletion boundary. */
  readonly coordinateNeighborProbeCount: number;
  /** Active cached Component ordinals visited while rebuilding incremental memberships. */
  readonly indexedActiveCellVisitCount: number;
  /** Cached adjacency relations queried or enumerated by the incremental classifier. */
  readonly cachedAdjacencyProbeCount: number;
}

const workByObject = new WeakMap<StructuralObject, Readonly<StructuralConnectivityWork>>();

export const publishStructuralConnectivityWork = (
  object: StructuralObject,
  work: StructuralConnectivityWork
): void => {
  workByObject.set(object, Object.freeze({ ...work }));
};

export const readStructuralConnectivityWork = (
  object: StructuralObject
): Readonly<StructuralConnectivityWork> | undefined => workByObject.get(object);
