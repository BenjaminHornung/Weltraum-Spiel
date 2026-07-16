import { describe, expect, it } from "vitest";
import {
  SURFACE_LAB_REGION,
  SURFACE_LAB_REGION_MESH_BUFFER_BUDGET_BYTES
} from "../../src/surface-lab/surfaceLabRegion";

describe("Surface Lab region descriptor", () => {
  it("owns the immutable 4 x 4 topology and preserves its z-major coordinate order", () => {
    expect(SURFACE_LAB_REGION.chunkCounts).toEqual({ x: 4, z: 4 });
    expect(SURFACE_LAB_REGION.chunkCount).toBe(16);
    expect(SURFACE_LAB_REGION_MESH_BUFFER_BUDGET_BYTES).toBe(128 * 1024 * 1024);
    expect(SURFACE_LAB_REGION.chunkCoordinates).toEqual([
      { x: -2, y: -1, z: -2 }, { x: -1, y: -1, z: -2 }, { x: 0, y: -1, z: -2 }, { x: 1, y: -1, z: -2 },
      { x: -2, y: -1, z: -1 }, { x: -1, y: -1, z: -1 }, { x: 0, y: -1, z: -1 }, { x: 1, y: -1, z: -1 },
      { x: -2, y: -1, z: 0 }, { x: -1, y: -1, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 1, y: -1, z: 0 },
      { x: -2, y: -1, z: 1 }, { x: -1, y: -1, z: 1 }, { x: 0, y: -1, z: 1 }, { x: 1, y: -1, z: 1 }
    ]);
    expect(Object.isFrozen(SURFACE_LAB_REGION)).toBe(true);
    expect(Object.isFrozen(SURFACE_LAB_REGION.chunkCounts)).toBe(true);
    expect(Object.isFrozen(SURFACE_LAB_REGION.chunkCoordinates)).toBe(true);
    expect(SURFACE_LAB_REGION.chunkCoordinates.every(Object.isFrozen)).toBe(true);
  });
});
