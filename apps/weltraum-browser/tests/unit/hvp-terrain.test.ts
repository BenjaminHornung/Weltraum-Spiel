import { describe, expect, it } from "vitest";
import {
  HVP_CELL_SIZE_METERS,
  HVP_REGION_MAX,
  HVP_REGION_MIN,
  assertHvpCoverageComplete,
  createHvpSession,
  hvpBuildCoastBlockCells,
  hvpCellToWorldMin,
  hvpChannelCenterX,
  hvpCoastHeightMeters,
  hvpCoastSurfaceMeters,
  hvpHashCoastLeaf,
  hvpIsCellInRegion,
  hvpMeshBlocks,
  hvpServedCoverage,
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

describe("HVP T02 seed determinism", () => {
  it("preserves the current output for the default seed and stays pure", () => {
    expect(hvpCoastHeightMeters(2.5, -3.5)).toBe(hvpCoastHeightMeters(2.5, -3.5, 0));
    expect(hvpCoastHeightMeters(2.5, -3.5)).toBeCloseTo(0.8499, 4);
    expect(hvpCoastHeightMeters(2.5, -3.5)).toBe(hvpCoastHeightMeters(2.5, -3.5));
    expect(hvpCoastHeightMeters(2.5, -3.5, 7)).not.toBe(hvpCoastHeightMeters(2.5, -3.5, 0));
    expect(() => hvpCoastHeightMeters(0, 0, Number.NaN)).toThrow(TypeError);
  });

  it("hashes a 16³ leaf identically regardless of input order", () => {
    const leaf: { x: number; y: number; z: number }[] = [];
    for (let x = 0; x < 16; x += 1) {
      for (let y = 0; y < 16; y += 1) {
        for (let z = 0; z < 16; z += 1) {
          leaf.push({ x, y, z });
        }
      }
    }
    expect(leaf).toHaveLength(4096);
    const forward = hvpHashCoastLeaf(leaf, 0);
    const backward = hvpHashCoastLeaf([...leaf].reverse(), 0);
    expect(backward).toBe(forward);
    expect(forward).toMatch(/^[0-9a-f]{8}$/);
    let state = 0x12345678;
    const shuffled = [...leaf];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      state = (Math.imul(state, 1103515245) + 12345) >>> 0;
      const j = state % (i + 1);
      const a = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = a;
    }
    expect(hvpHashCoastLeaf(shuffled, 0)).toBe(forward);
    expect(hvpHashCoastLeaf(leaf, 7)).not.toBe(forward);
  });
});

describe("HVP coverage gate", () => {
  it("accepts complete bound coverage and rejects unknown cells fail-closed", () => {
    const { solids, knownAir } = hvpServedCoverage([cell(0), cell(1)]);
    expect(solids).toHaveLength(2);
    expect(knownAir.length).toBeGreaterThan(0);
    const session = createHvpSession({ solids, knownAir });
    expect(() => assertHvpCoverageComplete(session, solids, knownAir)).not.toThrow();

    const incomplete = createHvpSession({ solids });
    expect(() => assertHvpCoverageComplete(incomplete, solids, knownAir)).toThrow(/coverage incomplete/i);
    const wrongState = createHvpSession({ solids: [...solids, ...knownAir], knownAir: [] });
    expect(() => assertHvpCoverageComplete(wrongState, solids, knownAir)).toThrow(/coverage incomplete/i);
  });
});

describe("HVP T09 snapshot immutability", () => {
  it("freezes coast cells so retained mutations never reach fresh reads", () => {
    const first = hvpBuildCoastBlockCells(1);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
    const freshLength = first.length;
    const freshFirst = { ...first[0]! };
    expect(() => { (first[0] as { x: number }).x = 999; }).toThrow();
    expect(() => { (first as unknown[]).push(cell(999)); }).toThrow();
    const second = hvpBuildCoastBlockCells(1);
    expect(second).toHaveLength(freshLength);
    expect(second[0]).toEqual(freshFirst);
  });

  it("returns fresh mesh buffers per call and frozen envelopes", () => {
    const first = hvpMeshBlocks([cell(0), cell(1)], 1, "hvp:terrain");
    first.positions[0] = 999;
    const second = hvpMeshBlocks([cell(0), cell(1)], 1, "hvp:terrain");
    expect(second.positions[0]).not.toBe(999);
    expect(second.positions[0]).toBe(0);
    expect(Object.isFrozen(second.boundsMeters)).toBe(true);
  });

  it("copies session seeds so caller mutations never reach the authority", () => {
    const solids = [cell(0)];
    const knownAir = [cell(5, 0, 0)];
    const session = createHvpSession({ solids, knownAir });
    solids.push(cell(1));
    knownAir.push(cell(6, 0, 0));
    expect(session.readCell(cell(1))).toBe("UnknownCoverage");
    expect(session.readCell(cell(6, 0, 0))).toBe("UnknownCoverage");
    const coverage = hvpServedCoverage([cell(0)]);
    expect(Object.isFrozen(coverage.solids)).toBe(true);
    expect(Object.isFrozen(coverage.knownAir)).toBe(true);
  });
});

describe("HVP T11 capacity gate and block-size guard", () => {
  it("rejects zero, NaN, infinite, negative, and non-quantized block sizes with TypeError", () => {
    for (const bad of [0, -0, Number.NaN, Number.POSITIVE_INFINITY, -1, 0.3, 0.2]) {
      expect(() => hvpBuildCoastBlockCells(bad), `block size ${String(bad)}`).toThrow(TypeError);
      expect(() => hvpMeshBlocks([cell(0)], bad, "hvp:terrain"), `cell size ${String(bad)}`).toThrow(TypeError);
    }
    expect(() => hvpBuildCoastBlockCells(1)).not.toThrow();
    expect(() => hvpBuildCoastBlockCells(2)).not.toThrow();
    // Sub-meter refinement is HVP-02 scope: quantum-valid but over budget.
    expect(() => hvpBuildCoastBlockCells(0.5)).toThrow(/BudgetExceeded/);
  });

  it("rejects tiny-positive sizes that round to zero quanta with TypeError", () => {
    expect(() => hvpBuildCoastBlockCells(1e-12)).toThrow(TypeError);
    expect(() => hvpMeshBlocks([cell(0)], 1e-12, "hvp:terrain")).toThrow(TypeError);
  });

  it("fails with BudgetExceeded before allocating oversized outputs", () => {
    expect(() => hvpBuildCoastBlockCells(0.125)).toThrow(/BudgetExceeded/);
    const oversized: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < 70_001; i += 1) {
      oversized.push({ x: i, y: 0, z: 0 });
    }
    expect(() => hvpMeshBlocks(oversized, 1, "hvp:terrain")).toThrow(/BudgetExceeded/);
  });
});

describe("HVP-01 coastal S-channel", () => {
  it("follows the quantized centerline through every control point", () => {
    expect(hvpChannelCenterX(-16)).toBeCloseTo(-3);
    expect(hvpChannelCenterX(-10)).toBeCloseTo(-4);
    expect(hvpChannelCenterX(-4)).toBeCloseTo(3);
    expect(hvpChannelCenterX(3)).toBeCloseTo(2);
    expect(hvpChannelCenterX(9)).toBeCloseTo(-3);
    expect(hvpChannelCenterX(16)).toBeCloseTo(0);
    expect(hvpChannelCenterX(-13)).toBeCloseTo(-3.5);
  });

  it("holds the -1.5 m floor in the core and rises asymmetrically to the banks", () => {
    expect(hvpCoastSurfaceMeters(2, 3)).toBe(-1.5);
    expect(hvpCoastSurfaceMeters(2.7, 3)).toBe(-1.5);
    const baseEast = hvpCoastHeightMeters(4.5, 3);
    const baseWest = hvpCoastHeightMeters(-0.5, 3);
    const carveEast = hvpCoastSurfaceMeters(4.5, 3) - baseEast;
    const carveWest = hvpCoastSurfaceMeters(-0.5, 3) - baseWest;
    expect(carveEast).toBeLessThan(0);
    expect(carveWest).toBeLessThan(0);
    expect(carveEast).not.toBeCloseTo(carveWest, 10);
    expect(hvpCoastSurfaceMeters(2 + 9, 3)).toBe(hvpCoastHeightMeters(2 + 9, 3));
  });

  it("rejects a non-finite surface x with TypeError like the channel center z-check", () => {
    expect(() => hvpCoastSurfaceMeters(Number.NaN, 3)).toThrow(TypeError);
  });

  it("steps block tops from the dredged floor up to the banks in whole blocks", () => {
    const cells = hvpBuildCoastBlockCells(1);
    const topBy = (bx: number, bz: number): number => {
      let top = Number.NEGATIVE_INFINITY;
      for (const entry of cells) {
        if (entry.x === bx && entry.z === bz && entry.y > top) {
          top = entry.y;
        }
      }
      return top;
    };
    // The -1.5 m floor fills block -3 (top face at -2 m); banks step up in whole blocks.
    expect(topBy(2, 3)).toBe(-3);
    expect(topBy(2 + 4, 3)).toBeGreaterThanOrEqual(topBy(2, 3));
    expect(topBy(2 - 4, 3)).toBeGreaterThanOrEqual(topBy(2, 3));
    expect(Number.isInteger(topBy(2 + 4, 3))).toBe(true);
  });
});
