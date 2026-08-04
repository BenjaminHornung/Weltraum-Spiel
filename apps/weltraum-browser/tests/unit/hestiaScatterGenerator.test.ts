import { describe, expect, it } from "vitest";
import { surfaceFrameId, voxelBodyId, voxelRegionId } from "../../src/voxel";
import * as hestiaPublicApi from "../../src/world-generation/hestia";
import {
  generateHestiaScatter,
  HESTIA_COAST_LUSH_PRESET_ID,
  HESTIA_MATERIAL_IDS,
  type HestiaGenerationInput,
  type HestiaScatterRecord
} from "../../src/world-generation/hestia";
import { hestiaScatterAcceptanceThreshold } from "../../src/world-generation/hestia/scatterGenerator";

const input = (
  x = 0,
  z = 0,
  rootSeed = "hestia-fixture-alpha",
  voxelSizeMeters: HestiaGenerationInput["voxelSizeMeters"] = 0.5
): HestiaGenerationInput => ({
  rootSeed,
  bodyId: voxelBodyId("planet.hestia"),
  surfaceFrameId: surfaceFrameId("frame:surface.hestia"),
  regionId: voxelRegionId("region:hestia.preview"),
  brickCoordinate: { x, y: 0, z },
  voxelSizeMeters
});

const ordering = (left: HestiaScatterRecord, right: HestiaScatterRecord): number =>
  left.sourceAnchorGlobal.z - right.sourceAnchorGlobal.z
  || left.sourceAnchorGlobal.x - right.sourceAnchorGlobal.x
  || left.id.localeCompare(right.id);

const coastInput = (x: number, z: number): HestiaGenerationInput => ({
  profile: HESTIA_COAST_LUSH_PRESET_ID,
  rootSeed: "hestia-surface-play-coast-lush-v1",
  bodyId: voxelBodyId("planet.hestia"),
  surfaceFrameId: surfaceFrameId("frame:surface_hestia_surface_play_v1"),
  regionId: voxelRegionId("region:hestia.surface-play.coast-lush.v1"),
  brickCoordinate: { x, y: 0, z },
  voxelSizeMeters: 0.5
});

describe("Hestia V1 reconstructable scatter", () => {
  it("pins direct V1 material eligibility thresholds without widening the public barrel", () => {
    expect(Object.hasOwn(hestiaPublicApi, "hestiaScatterAcceptanceThreshold")).toBe(false);
    expect(hestiaScatterAcceptanceThreshold(HESTIA_MATERIAL_IDS.SolidRock)).toBeUndefined();
    expect(hestiaScatterAcceptanceThreshold(HESTIA_MATERIAL_IDS.WetSoil)).toBe(0.18);
    expect(hestiaScatterAcceptanceThreshold(HESTIA_MATERIAL_IDS.MossCover)).toBe(0.28);
    expect(hestiaScatterAcceptanceThreshold(HESTIA_MATERIAL_IDS.DenseBiologicalSurface)).toBe(0.42);
    expect(hestiaScatterAcceptanceThreshold(HESTIA_MATERIAL_IDS.ShallowWaterBoundary)).toBeUndefined();
  });

  it("pins a three-material wet-soil, moss, and dense scatter gating fixture", () => {
    const records = generateHestiaScatter(input(-24, -32));
    const counts = [0, 1, 2, 3, 4].map(
      (materialId) => records.filter((record) => record.surfaceMaterialId === materialId).length
    );
    expect(counts).toEqual([0, 1, 12, 3, 0]);
    expect(new Set(records.map((record) => record.surfaceMaterialId))).toEqual(new Set([
      HESTIA_MATERIAL_IDS.WetSoil,
      HESTIA_MATERIAL_IDS.MossCover,
      HESTIA_MATERIAL_IDS.DenseBiologicalSurface
    ]));
  });
  it("returns identical strictly readonly ordered records for the same input", () => {
    const first = generateHestiaScatter(input());
    const second = generateHestiaScatter(input());
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(Object.isFrozen(first)).toBe(true);
    expect([...first].sort(ordering)).toEqual(first);
    for (const record of first) {
      expect(Object.keys(record).sort()).toEqual([
        "id", "kind", "positionMeters", "sourceAnchorGlobal", "surfaceMaterialId", "uniformScale", "yawRadians"
      ]);
      expect(Object.isFrozen(record)).toBe(true);
      expect(Object.isFrozen(record.positionMeters)).toBe(true);
      expect(Object.isFrozen(record.sourceAnchorGlobal)).toBe(true);
      expect(record.id).toMatch(/^hestia\.scatter\.v1:[0-9a-f]{8}:-?\d+:-?\d+$/);
      expect(["black_trunk", "cyan_luminous_sprout", "cyan_luminous_cap"]).toContain(record.kind);
      expect([1, 2, 3]).toContain(record.surfaceMaterialId);
      expect(record.yawRadians).toBeGreaterThanOrEqual(0);
      expect(record.yawRadians).toBeLessThan(Math.PI * 2);
      expect(record.uniformScale).toBeGreaterThanOrEqual(0.8);
      expect(record.uniformScale).toBeLessThan(1.35);
      expect(record.sourceAnchorGlobal.x % 4).toBe(0);
      expect(record.sourceAnchorGlobal.z % 4).toBe(0);
      expect(Math.abs(record.positionMeters.x - record.sourceAnchorGlobal.x * 0.5)).toBeLessThanOrEqual(0.7);
      expect(Math.abs(record.positionMeters.z - record.sourceAnchorGlobal.z * 0.5)).toBeLessThanOrEqual(0.7);
    }
    expect(() => (first as HestiaScatterRecord[]).push(first[0]!)).toThrow(TypeError);
    expect(() => ((first[0]!.positionMeters as { x: number }).x = 999)).toThrow(TypeError);
  });

  it("changes deterministic scatter when the root seed changes", () => {
    expect(generateHestiaScatter(input(0, 0, "hestia-fixture-beta"))).not.toEqual(generateHestiaScatter(input()));
  });

  it("uses half-open global anchor ownership without duplicate IDs across adjacent bricks", () => {
    const bricks = [input(0, 0), input(1, 0), input(0, 1), input(-1, 0), input(0, -1)];
    const records = bricks.flatMap((source) => generateHestiaScatter(source));
    const ids = records.map((record) => record.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const source of bricks) {
      const minX = source.brickCoordinate.x * 32;
      const minZ = source.brickCoordinate.z * 32;
      for (const record of generateHestiaScatter(source)) {
        expect(record.sourceAnchorGlobal.x).toBeGreaterThanOrEqual(minX);
        expect(record.sourceAnchorGlobal.x).toBeLessThan(minX + 32);
        expect(record.sourceAnchorGlobal.z).toBeGreaterThanOrEqual(minZ);
        expect(record.sourceAnchorGlobal.z).toBeLessThan(minZ + 32);
        expect(record.id.endsWith(`:${record.sourceAnchorGlobal.x}:${record.sourceAnchorGlobal.z}`)).toBe(true);
      }
    }
  });

  it("uses stable stride-8 quarter-metre ownership on X/Z negative and positive adjacent pairs", () => {
    for (const axis of ["x", "z"] as const) {
      for (const candidateStarts of [
        [-8, -7, -6, -5, -4, -3, -2],
        [1, 2, 3, 4, 5, 6, 7, 8]
      ]) {
        const pair = candidateStarts.map((lowerCoordinate) => {
          const lowerInput = input(
            axis === "x" ? lowerCoordinate : 0,
            axis === "z" ? lowerCoordinate : 0,
            "hestia-fixture-alpha",
            0.25
          );
          const upperInput = input(
            axis === "x" ? lowerCoordinate + 1 : 0,
            axis === "z" ? lowerCoordinate + 1 : 0,
            "hestia-fixture-alpha",
            0.25
          );
          return {
            lowerCoordinate,
            lowerInput,
            upperInput,
            lower: generateHestiaScatter(lowerInput),
            upper: generateHestiaScatter(upperInput)
          };
        }).find(({ lower, upper }) => lower.length > 0 && upper.length > 0);
        expect(pair, `${axis} must have a non-empty adjacent pair in the bounded signed fixture`).toBeDefined();
        if (pair === undefined) throw new Error("Missing bounded signed scatter ownership fixture");

        const { lowerCoordinate, lowerInput, upperInput, lower, upper } = pair;
        const minimum = lowerCoordinate * 32;
        const boundary = (lowerCoordinate + 1) * 32;
        const maximum = boundary + 32;
        const combined = [...lower, ...upper];

        expect(lower.every((record) =>
          record.sourceAnchorGlobal[axis] >= minimum
          && record.sourceAnchorGlobal[axis] < boundary
          && record.sourceAnchorGlobal.x % 8 === 0
          && record.sourceAnchorGlobal.z % 8 === 0
        )).toBe(true);
        expect(upper.every((record) =>
          record.sourceAnchorGlobal[axis] >= boundary
          && record.sourceAnchorGlobal[axis] < maximum
          && record.sourceAnchorGlobal.x % 8 === 0
          && record.sourceAnchorGlobal.z % 8 === 0
        )).toBe(true);
        expect(new Set(combined.map((record) => record.id)).size).toBe(combined.length);
        expect([...lower].sort(ordering)).toEqual(lower);
        expect([...upper].sort(ordering)).toEqual(upper);
        expect(generateHestiaScatter(lowerInput)).toEqual(lower);
        expect(generateHestiaScatter(upperInput)).toEqual(upper);
      }
    }
  });

  it("pins the complete ordered canonical scatter fixture as a V1 drift guard", () => {
    const fixture = generateHestiaScatter(input());
    // Complete V1 drift guard for acceptance, kind, jitter, fixed-point solve,
    // identity, transform ranges, and canonical ordering.
    expect(fixture).toEqual([
      {
        id: "hestia.scatter.v1:721b88b4:0:0",
        kind: "black_trunk",
        positionMeters: { x: -0.6558778096921741, y: -7.104675875997558, z: -0.4480123703833669 },
        yawRadians: 2.947253898029138,
        uniformScale: 1.332060036645271,
        surfaceMaterialId: 1,
        sourceAnchorGlobal: { x: 0, z: 0 }
      },
      {
        id: "hestia.scatter.v1:721b88b4:4:8",
        kind: "cyan_luminous_cap",
        positionMeters: { x: 1.9564065110869706, y: -6.744027585404902, z: 4.1642719503957775 },
        yawRadians: 0.1794913337230823,
        uniformScale: 1.296366096637212,
        surfaceMaterialId: 1,
        sourceAnchorGlobal: { x: 4, z: 8 }
      },
      {
        id: "hestia.scatter.v1:721b88b4:0:20",
        kind: "black_trunk",
        positionMeters: { x: -0.31722025861963626, y: -7.280930387644944, z: 9.890645180689171 },
        yawRadians: 1.5756582048316319,
        uniformScale: 1.2119971076725051,
        surfaceMaterialId: 1,
        sourceAnchorGlobal: { x: 0, z: 20 }
      },
      {
        id: "hestia.scatter.v1:721b88b4:4:20",
        kind: "black_trunk",
        positionMeters: { x: 2.2950640621595086, y: -6.599470150391681, z: 10.502929501468316 },
        yawRadians: 1.1678915877152922,
        uniformScale: 1.176303167664446,
        surfaceMaterialId: 1,
        sourceAnchorGlobal: { x: 4, z: 20 }
      },
      {
        id: "hestia.scatter.v1:721b88b4:8:24",
        kind: "black_trunk",
        positionMeters: { x: 4.196868650894612, y: -6.235777568967043, z: 12.40473409020342 },
        yawRadians: 4.942785105856675,
        uniformScale: 1.1633220587158577,
        surfaceMaterialId: 1,
        sourceAnchorGlobal: { x: 8, z: 24 }
      },
      {
        id: "hestia.scatter.v1:721b88b4:28:28",
        kind: "black_trunk",
        positionMeters: { x: 13.472564132045955, y: -5.013664462813505, z: 13.680429571354761 },
        yawRadians: 5.4555456870673416,
        uniformScale: 0.9318756228545682,
        surfaceMaterialId: 1,
        sourceAnchorGlobal: { x: 28, z: 28 }
      }
    ]);
  });

  it("generates deterministic Coast/Lush scatter with only Sprout and Cap kinds", () => {
    const inputs = [-4, -3, -2, -1].flatMap((z) => [2, 3, 4, 5].map((x) => coastInput(x, z)));
    const first = inputs.flatMap((source) => generateHestiaScatter(source));
    const second = inputs.flatMap((source) => generateHestiaScatter(source));
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(new Set(first.map((record) => record.id)).size).toBe(first.length);
    expect(first.every((record) =>
      record.id.startsWith("hestia.scatter.coast-lush.v1:")
      && (record.kind === "cyan_luminous_sprout" || record.kind === "cyan_luminous_cap")
      && record.positionMeters.y >= 1
    )).toBe(true);
    for (const source of inputs) {
      expect([...generateHestiaScatter(source)].sort(ordering)).toEqual(generateHestiaScatter(source));
    }
  });
});
