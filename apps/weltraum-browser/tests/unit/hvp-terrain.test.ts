import { describe, expect, it } from "vitest";
import {
  HVP_CELL_SIZE_METERS,
  HVP_REGION_MAX,
  HVP_REGION_MIN,
  createHvpSession,
  hvpCellToWorldMin,
  hvpIsCellInRegion,
  hvpMeshBlocks,
  hvpWorldToCellIndex
} from "../../src/hvp/hvpTerrain";

const cell = (x: number, y = 0, z = 0): { x: number; y: number; z: number } => ({ x, y, z });

describe("HVP T03 two adjacent cubes expose 10 faces", () => {
  it("emits 10 quads with tight bounds for two neighboring cells", () => {
    const mesh = hvpMeshBlocks([cell(0), cell(1)], 1, "hvp:terrain");
    expect(mesh.faceCount).toBe(10);
    expect(mesh.positions).toHaveLength(10 * 4 * 3);
    expect(mesh.indices).toHaveLength(10 * 6);
    expect(mesh.boundsMeters.min).toEqual({ x: 0, y: 0, z: 0 });
    expect(mesh.boundsMeters.max).toEqual({ x: 2, y: 1, z: 1 });
  });
});

describe("HVP T04 hollow 3-cube keeps 26 cells and 60 faces", () => {
  it("exposes 54 outer plus 6 cavity faces without merging", () => {
    const cells: { x: number; y: number; z: number }[] = [];
    for (let x = 0; x < 3; x += 1) {
      for (let y = 0; y < 3; y += 1) {
        for (let z = 0; z < 3; z += 1) {
          if (x === 1 && y === 1 && z === 1) continue;
          cells.push(cell(x, y, z));
        }
      }
    }
    expect(cells).toHaveLength(26);
    const mesh = hvpMeshBlocks(cells, 1, "hvp:terrain");
    expect(mesh.faceCount).toBe(60);
    expect(mesh.cavityFaceCount).toBe(6);
    expect(mesh.outerFaceCount).toBe(54);
    expect(mesh.positions).toHaveLength(60 * 4 * 3);
    expect(mesh.indices).toHaveLength(60 * 6);
  });
});

describe("HVP T05 floor division maps world to 0.125m cells", () => {
  it("uses the HVP-TERRAIN-0125-v1 quantum and region", () => {
    expect(HVP_CELL_SIZE_METERS).toBe(0.125);
    expect(HVP_REGION_MIN).toEqual({ x: -16, y: -8, z: -16 });
    expect(HVP_REGION_MAX).toEqual({ x: 16, y: 8, z: 16 });
    expect(hvpWorldToCellIndex(0)).toBe(0);
    expect(hvpWorldToCellIndex(0.125)).toBe(1);
    expect(hvpWorldToCellIndex(-0.001)).toBe(-1);
    expect(hvpWorldToCellIndex(-16)).toBe(-128);
    expect(hvpCellToWorldMin(-128)).toBe(-16);
    expect(hvpIsCellInRegion(cell(-128, -64, -128))).toBe(true);
    expect(hvpIsCellInRegion(cell(128, 0, 0))).toBe(false);
    expect(hvpIsCellInRegion(cell(0, 64, 0))).toBe(false);
  });
});

describe("HVP T06 known air differs from unknown coverage", () => {
  it("never confuses observed empty cells with uncovered cells", () => {
    const session = createHvpSession({
      solids: [cell(0)],
      knownAir: [cell(5, 0, 0)]
    });
    expect(session.readCell(cell(0))).toBe("KnownSolid");
    expect(session.readCell(cell(5, 0, 0))).toBe("KnownAir");
    expect(session.readCell(cell(9, 0, 0))).toBe("UnknownCoverage");
    expect(session.readCell(cell(5, 0, 0))).not.toBe(session.readCell(cell(9, 0, 0)));
  });
});
