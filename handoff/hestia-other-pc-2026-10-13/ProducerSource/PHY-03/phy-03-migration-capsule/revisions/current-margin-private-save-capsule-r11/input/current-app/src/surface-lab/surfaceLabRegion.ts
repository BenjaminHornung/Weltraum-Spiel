export interface SurfaceLabRegionDescriptor {
  readonly chunkCounts: Readonly<{ x: number; z: number }>;
  readonly chunkCoordinates: readonly Readonly<{ x: number; y: number; z: number }>[];
  readonly chunkCount: number;
}

export const SURFACE_LAB_REGION_MESH_BUFFER_BUDGET_BYTES = 128 * 1024 * 1024;

const chunkCounts = Object.freeze({ x: 4, z: 4 });
const coordinateRange = (count: number): readonly number[] => Object.freeze(
  Array.from({ length: count }, (_, index) => index - Math.floor(count / 2))
);
const chunkCoordinates = Object.freeze(
  coordinateRange(chunkCounts.z).flatMap((z) => coordinateRange(chunkCounts.x)
    .map((x) => Object.freeze({ x, y: -1, z })))
);

export const SURFACE_LAB_REGION: SurfaceLabRegionDescriptor = Object.freeze({
  chunkCounts,
  chunkCoordinates,
  chunkCount: chunkCoordinates.length
});
