import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hestiaHydrologyDatasetId,
  type HydrologyInput,
  type HydrologyParameters,
  type HydrologySnapshot,
  type RiverSegment
} from "../../src/world-generation/hestia/hydrology/contracts";
import { estimateHydrologySnapshotRetainedBytes } from "../../src/world-generation/hestia/hydrology/canonical";
import { generateHestiaHydrology } from "../../src/world-generation/hestia/hydrology/generator";
import {
  HESTIA_HYDROLOGY_D8_ORDER,
  HESTIA_HYDROLOGY_GENERATOR_VERSION_V2,
  HESTIA_HYDROLOGY_GRID_V2,
  HESTIA_HYDROLOGY_MEMORY_BUDGET_BYTES_V2,
  HESTIA_HYDROLOGY_PARAMETERS_V2
} from "../../src/world-generation/hestia/hydrology/preset";
import { sampleHydrologyTerrainAdjustment } from "../../src/world-generation/hestia/hydrology/sampler";

type TerrainFixture = (globalXMeters: number, globalZMeters: number) => number;

const SAMPLE_COUNT = 129 * 129;
const CELL_COUNT = 128 * 128;
const EAST_EDGE_X_QUANTA = 127 * 16;
const FIXTURE_CENTER_METERS = 128;

const hydrologyInput = (
  terrainHeightSampler: TerrainFixture,
  overrides: Partial<Omit<HydrologyInput, "terrainHeightSampler">> = {}
): HydrologyInput => ({
  rootSeed: "hydrology-v2-unit-root",
  bodyId: "planet.hestia",
  surfaceFrameId: "frame:surface.hestia",
  datasetId: hestiaHydrologyDatasetId("dataset:hestia.hydrology.unit"),
  origin: { xQuanta: 0, zQuanta: 0 },
  seaLevelMeters: HESTIA_HYDROLOGY_PARAMETERS_V2.seaLevelMeters,
  parameters: HESTIA_HYDROLOGY_PARAMETERS_V2,
  terrainHeightSampler,
  grid: HESTIA_HYDROLOGY_GRID_V2,
  ...overrides
});

const eastSlopingPlane: TerrainFixture = (globalXMeters) => 100 - globalXMeters;
const convergingValley: TerrainFixture = (globalXMeters, globalZMeters) =>
  Math.abs(globalXMeters - FIXTURE_CENTER_METERS) * 0.2 - globalZMeters * 0.05 + 20;
const isolatedLake: TerrainFixture = (globalXMeters, globalZMeters) => {
  const radius = Math.max(
    Math.abs(globalXMeters - FIXTURE_CENTER_METERS),
    Math.abs(globalZMeters - FIXTURE_CENTER_METERS)
  );
  if (radius <= 6) return -2;
  if (radius <= 10) return 3;
  return 2 - radius * 0.001;
};

let planeSnapshotCache: HydrologySnapshot | undefined;
let valleySnapshotCache: HydrologySnapshot | undefined;
let lakeSnapshotCache: HydrologySnapshot | undefined;
const planeSnapshot = (): HydrologySnapshot =>
  planeSnapshotCache ??= generateHestiaHydrology(hydrologyInput(eastSlopingPlane));
const valleySnapshot = (): HydrologySnapshot =>
  valleySnapshotCache ??= generateHestiaHydrology(hydrologyInput(convergingValley));
const lakeSnapshot = (): HydrologySnapshot =>
  lakeSnapshotCache ??= generateHestiaHydrology(hydrologyInput(isolatedLake));

const traceToOutlet = (snapshot: HydrologySnapshot, startIndex: number): readonly number[] => {
  const path: number[] = [];
  const visited = new Set<number>();
  let current: number | null = startIndex;
  while (current !== null) {
    if (visited.has(current)) throw new Error(`Internal flow cycle at cell ${current}`);
    visited.add(current);
    path.push(current);
    current = snapshot.cells[current]!.downstreamCellIndex;
  }
  return path;
};

const expectRecursivelyFrozen = (value: unknown, seen = new Set<object>()): void => {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value as Record<string, unknown>)) expectRecursivelyFrozen(child, seen);
};

const ultimateRiverTermination = (
  snapshot: HydrologySnapshot,
  initial: RiverSegment
): Exclude<RiverSegment["termination"], "Confluence"> => {
  let segment = initial;
  const visited = new Set<string>();
  while (segment.termination === "Confluence") {
    expect(visited.has(segment.id)).toBe(false);
    visited.add(segment.id);
    const lastPoint = segment.points.at(-1);
    if (lastPoint === undefined) throw new Error("River segment has no points");
    const downstream = snapshot.cells[lastPoint.cellIndex]!.downstreamCellIndex;
    const continuation = snapshot.riverSegments.find((candidate) =>
      candidate.points[0]?.cellIndex === downstream);
    if (continuation === undefined) throw new Error("Confluence has no canonical continuation segment");
    segment = continuation;
  }
  return segment.termination;
};

describe("Hestia Hydrology Terrain Generator V2 mandatory contract matrix", () => {
  it("[01] sloped plane drains to the lowest boundary edge using global-coordinate samples", () => {
    const calls: [number, number][] = [];
    const snapshot = generateHestiaHydrology(hydrologyInput((globalX, globalZ) => {
      calls.push([globalX, globalZ]);
      return eastSlopingPlane(globalX, globalZ);
    }));

    expect(calls).toHaveLength(SAMPLE_COUNT);
    expect(calls[0]).toEqual([0, 0]);
    expect(calls.at(-1)).toEqual([256, 256]);
    expect(new Set(calls.map(([x, z]) => `${x}:${z}`)).size).toBe(SAMPLE_COUNT);
    for (const cell of snapshot.cells) {
      const outlet = snapshot.cells[traceToOutlet(snapshot, cell.stableLinearIndex).at(-1)!]!;
      expect(outlet.isBoundaryOutlet).toBe(true);
      expect(outlet.coordinate.xQuanta).toBe(EAST_EDGE_X_QUANTA);
    }
    planeSnapshotCache = snapshot;
  });

  it("[02] D8 flow graph contains no internal cycles, including non-river flow", () => {
    const snapshot = planeSnapshot();
    expect(snapshot.cells).toHaveLength(CELL_COUNT);
    for (const cell of snapshot.cells) {
      const path = traceToOutlet(snapshot, cell.stableLinearIndex);
      expect(new Set(path).size).toBe(path.length);
    }
  });

  it("[03] symmetric slope tie chooses the canonical deterministic direction", () => {
    const secondarySlope = Math.SQRT2 - 1;
    const tiedSlope: TerrainFixture = (globalX, globalZ) => 100 - globalX - secondarySlope * globalZ;
    const first = generateHestiaHydrology(hydrologyInput(tiedSlope));
    const second = generateHestiaHydrology(hydrologyInput((globalX, globalZ) => tiedSlope(globalX, globalZ)));
    const tiedCoordinate = { xQuanta: 64 * 16, zQuanta: 64 * 16 };
    const firstCell = first.cells.find((cell) =>
      cell.coordinate.xQuanta === tiedCoordinate.xQuanta && cell.coordinate.zQuanta === tiedCoordinate.zQuanta);
    const secondCell = second.cells.find((cell) =>
      cell.coordinate.xQuanta === tiedCoordinate.xQuanta && cell.coordinate.zQuanta === tiedCoordinate.zQuanta);
    expect(HESTIA_HYDROLOGY_D8_ORDER).toEqual(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
    expect(firstCell?.flowDirection).toBe("E");
    expect(secondCell?.flowDirection).toBe("E");
  });

  it("[04] isolated depression becomes a horizontal lake at the correct spill level", () => {
    const snapshot = lakeSnapshot();
    const lakes = snapshot.waterBodies.filter((body) => body.kind === "Lake");
    expect(lakes).toHaveLength(1);
    expect(lakes[0]!.spillElevation).toBe(3);
    expect(lakes[0]!.waterLevel).toBe(3);
    expect(new Set(lakes[0]!.sampleIndices.map((index) => snapshot.samples[index]!.waterSurfaceHeight))).toEqual(new Set([3]));
  });

  it("[05] isolated below-sea depression is not ocean", () => {
    const snapshot = lakeSnapshot();
    const center = snapshot.samples.find((sample) =>
      sample.coordinate.xMeters === FIXTURE_CENTER_METERS
      && sample.coordinate.zMeters === FIXTURE_CENTER_METERS);
    expect(center?.terrainHeight).toBe(-2);
    expect(center?.isOcean).toBe(false);
    expect(snapshot.waterBodies.find((body) => body.id === center?.waterBodyId)?.kind).toBe("Lake");
  });

  it("[06] boundary-connected below-sea area is ocean", () => {
    const snapshot = generateHestiaHydrology(hydrologyInput((globalX) => globalX <= 4 ? -1 : 2));
    const connected = snapshot.samples.filter((sample) => sample.coordinate.xMeters <= 4);
    expect(connected.length).toBeGreaterThan(0);
    expect(connected.every((sample) => sample.isOcean)).toBe(true);
    expect(connected.every((sample) =>
      snapshot.waterBodies.find((body) => body.id === sample.waterBodyId)?.kind === "Ocean")).toBe(true);
    expect(snapshot.samples.find((sample) => sample.coordinate.xMeters === 6)?.isOcean).toBe(false);
  });

  it("[07] river accumulation increases downstream", () => {
    const snapshot = valleySnapshot();
    expect(snapshot.riverSegments.length).toBeGreaterThan(0);
    for (const segment of snapshot.riverSegments) {
      for (let index = 1; index < segment.points.length; index += 1) {
        expect(segment.points[index]!.accumulation).toBeGreaterThan(segment.points[index - 1]!.accumulation);
      }
    }
  });

  it("[08] river water never rises and every segment chain terminates at lake, ocean, or boundary", () => {
    const snapshot = valleySnapshot();
    for (const segment of snapshot.riverSegments) {
      for (let index = 1; index < segment.points.length; index += 1) {
        expect(segment.points[index]!.waterSurfaceHeight)
          .toBeLessThanOrEqual(segment.points[index - 1]!.waterSurfaceHeight);
      }
      expect(["Lake", "Ocean", "Boundary"]).toContain(ultimateRiverTermination(snapshot, segment));
    }
  });

  it("[09] channel adjustment places adjusted terrain below original terrain", () => {
    const snapshot = valleySnapshot();
    const point = snapshot.riverSegments.flatMap((segment) => segment.points)[0];
    if (point === undefined) throw new Error("Valley fixture did not produce a river point");
    const adjustment = sampleHydrologyTerrainAdjustment(
      snapshot,
      point.coordinate.xMeters,
      point.coordinate.zMeters
    );
    const originalTerrain = snapshot.samples.find((sample) =>
      sample.coordinate.xQuanta === point.coordinate.xQuanta
      && sample.coordinate.zQuanta === point.coordinate.zQuanta)?.terrainHeight;
    expect(adjustment.channelDepth).toBeGreaterThan(0);
    expect(adjustment.adjustedTerrainHeight).toBeLessThan(originalTerrain!);
  });

  it("[10] lake water exists only in basin cells and all lake levels are horizontal", () => {
    const snapshot = lakeSnapshot();
    const lake = snapshot.waterBodies.find((body) => body.kind === "Lake");
    if (lake === undefined) throw new Error("Lake fixture did not produce a lake");
    const publishedLakeSamples = snapshot.samples.filter((sample) => sample.waterBodyId === lake.id);
    expect(publishedLakeSamples.map((sample) => sample.stableLinearIndex)).toEqual(lake.sampleIndices);
    expect(publishedLakeSamples.every((sample) =>
      sample.basinId !== null
      && sample.terrainHeight < lake.waterLevel - snapshot.parameters.comparisonEpsilonMeters
      && sample.waterSurfaceHeight === lake.waterLevel)).toBe(true);
  });

  it("[11] dry slopes receive no floating water", () => {
    const snapshot = lakeSnapshot();
    const riverPoints = snapshot.riverSegments.flatMap((segment) => segment.points);
    const drySample = snapshot.samples.find((sample) =>
      sample.waterBodyId === null
      && riverPoints.every((point) => Math.hypot(
        sample.coordinate.xMeters - point.coordinate.xMeters,
        sample.coordinate.zMeters - point.coordinate.zMeters
      ) > point.halfWidth));
    if (drySample === undefined) throw new Error("Missing dry global-coordinate fixture sample");
    const adjustment = sampleHydrologyTerrainAdjustment(
      snapshot,
      drySample.coordinate.xMeters,
      drySample.coordinate.zMeters
    );
    expect(drySample.waterBodyId).toBeNull();
    expect(drySample.waterSurfaceHeight).toBeNull();
    expect(adjustment).not.toHaveProperty("waterSurfaceHeight");
    expect(adjustment).not.toHaveProperty("waterBodyId");
  });

  it("[12] equivalent generation produces stable WaterBody and RiverSegment IDs", () => {
    const firstLake = lakeSnapshot();
    const secondLake = generateHestiaHydrology(hydrologyInput(isolatedLake));
    expect(secondLake.waterBodies.map((body) => body.id)).toEqual(firstLake.waterBodies.map((body) => body.id));

    const firstValley = valleySnapshot();
    const secondValley = generateHestiaHydrology(hydrologyInput(convergingValley));
    expect(secondValley.riverSegments.map((segment) => segment.id))
      .toEqual(firstValley.riverSegments.map((segment) => segment.id));
  });

  it("[13] same input has identical hashes and bytes while changed rootSeed or terrain changes hash", () => {
    const first = planeSnapshot();
    const second = generateHestiaHydrology(hydrologyInput(eastSlopingPlane));
    const changedSeed = generateHestiaHydrology(hydrologyInput(eastSlopingPlane, { rootSeed: "hydrology-v2-unit-root-changed" }));
    const changedTerrain = generateHestiaHydrology(hydrologyInput((globalX, globalZ) =>
      eastSlopingPlane(globalX, globalZ) + 0.25));

    expect(second.canonicalBytes).toBe(first.canonicalBytes);
    expect(second.contentHash).toBe(first.contentHash);
    expect(second.cells).toEqual(first.cells);
    expect(second.waterBodies).toEqual(first.waterBodies);
    expect(second.riverSegments).toEqual(first.riverSegments);
    expect(changedSeed.contentHash).not.toBe(first.contentHash);
    expect(changedTerrain.contentHash).not.toBe(first.contentHash);
  });

  it("[14] semantic caller and property order has no effect on IDs, collections, bytes, or hashes", () => {
    const reorderedParameters = {
      bankBlendFormulaVersion: HESTIA_HYDROLOGY_PARAMETERS_V2.bankBlendFormulaVersion,
      flatRoutingPolicyVersion: HESTIA_HYDROLOGY_PARAMETERS_V2.flatRoutingPolicyVersion,
      channelFormulaVersion: HESTIA_HYDROLOGY_PARAMETERS_V2.channelFormulaVersion,
      moistureFormulaVersion: HESTIA_HYDROLOGY_PARAMETERS_V2.moistureFormulaVersion,
      accumulationContributionPerCell: HESTIA_HYDROLOGY_PARAMETERS_V2.accumulationContributionPerCell,
      priorityFloodKeyOrder: [...HESTIA_HYDROLOGY_PARAMETERS_V2.priorityFloodKeyOrder] as const,
      d8DirectionOrder: [...HESTIA_HYDROLOGY_PARAMETERS_V2.d8DirectionOrder],
      riverWaterSurfaceDepthFraction: HESTIA_HYDROLOGY_PARAMETERS_V2.riverWaterSurfaceDepthFraction,
      halfWidthSqrtCoefficient: HESTIA_HYDROLOGY_PARAMETERS_V2.halfWidthSqrtCoefficient,
      carveDepthLog2Coefficient: HESTIA_HYDROLOGY_PARAMETERS_V2.carveDepthLog2Coefficient,
      spillElevationQuantizationPerMeter: HESTIA_HYDROLOGY_PARAMETERS_V2.spillElevationQuantizationPerMeter,
      comparisonEpsilonMeters: HESTIA_HYDROLOGY_PARAMETERS_V2.comparisonEpsilonMeters,
      moistureFalloffMeters: HESTIA_HYDROLOGY_PARAMETERS_V2.moistureFalloffMeters,
      channelBankSlope: HESTIA_HYDROLOGY_PARAMETERS_V2.channelBankSlope,
      maximumRiverHalfWidthMeters: HESTIA_HYDROLOGY_PARAMETERS_V2.maximumRiverHalfWidthMeters,
      minimumRiverHalfWidthMeters: HESTIA_HYDROLOGY_PARAMETERS_V2.minimumRiverHalfWidthMeters,
      maximumRiverDepthMeters: HESTIA_HYDROLOGY_PARAMETERS_V2.maximumRiverDepthMeters,
      minimumRiverDepthMeters: HESTIA_HYDROLOGY_PARAMETERS_V2.minimumRiverDepthMeters,
      riverSourceAccumulationCells: HESTIA_HYDROLOGY_PARAMETERS_V2.riverSourceAccumulationCells,
      minimumLakeDepthMeters: HESTIA_HYDROLOGY_PARAMETERS_V2.minimumLakeDepthMeters,
      seaLevelMeters: HESTIA_HYDROLOGY_PARAMETERS_V2.seaLevelMeters,
      gridSpacingMeters: HESTIA_HYDROLOGY_PARAMETERS_V2.gridSpacingMeters,
      version: HESTIA_HYDROLOGY_PARAMETERS_V2.version
    } satisfies HydrologyParameters;
    const reorderedInput: HydrologyInput = {
      terrainHeightSampler: (globalX, globalZ) => eastSlopingPlane(globalX, globalZ),
      parameters: reorderedParameters,
      seaLevelMeters: 0,
      origin: { zQuanta: 0, xQuanta: 0 },
      datasetId: hestiaHydrologyDatasetId("dataset:hestia.hydrology.unit"),
      surfaceFrameId: "frame:surface.hestia",
      bodyId: "planet.hestia",
      rootSeed: "hydrology-v2-unit-root",
      grid: { ...HESTIA_HYDROLOGY_GRID_V2 }
    };
    const canonical = planeSnapshot();
    const reordered = generateHestiaHydrology(reorderedInput);
    expect(reordered).toEqual(canonical);
    expect(reordered.canonicalBytes).toBe(canonical.canonicalBytes);
    expect(reordered.contentHash).toBe(canonical.contentHash);
  });

  it("[15] moisture is finite and within [0,1] across bounded global coordinates", () => {
    const snapshot = valleySnapshot();
    for (const globalZ of [0, 64, 128, 192, 256]) {
      for (const globalX of [0, 64, 128, 192, 256]) {
        const adjustment = sampleHydrologyTerrainAdjustment(snapshot, globalX, globalZ);
        expect(Number.isFinite(adjustment.moisture)).toBe(true);
        expect(adjustment.moisture).toBeGreaterThanOrEqual(0);
        expect(adjustment.moisture).toBeLessThanOrEqual(1);
      }
    }
  });

  it("[16] nonfinite terrain fails closed without publishing a partial snapshot", () => {
    expect(() => generateHestiaHydrology(hydrologyInput((globalX, globalZ) =>
      globalX === 20 && globalZ === 20 ? Number.NaN : 1)))
      .toThrow(/terrainHeightSampler returned a non-finite value/);
    expect(() => generateHestiaHydrology(hydrologyInput(() => Number.POSITIVE_INFINITY)))
      .toThrow(/non-finite/);
  });

  it("[17] unsafe and misaligned global coordinates fail closed", () => {
    expect(() => generateHestiaHydrology(hydrologyInput(eastSlopingPlane, {
      origin: { xQuanta: 1, zQuanta: 0 }
    }))).toThrow(/aligned to 16 global quanta/);
    const highestAlignedSafeInteger = Math.floor(Number.MAX_SAFE_INTEGER / 16) * 16;
    expect(() => generateHestiaHydrology(hydrologyInput(eastSlopingPlane, {
      origin: { xQuanta: highestAlignedSafeInteger, zQuanta: 0 }
    }))).toThrow(/safe integer range/);
  });

  it("[18] public result is recursively frozen and has no mutable caller aliases", () => {
    const mutableOrigin = { xQuanta: 0, zQuanta: 0 };
    const mutableDirections = [...HESTIA_HYDROLOGY_PARAMETERS_V2.d8DirectionOrder];
    const mutableParameters: HydrologyParameters = {
      ...HESTIA_HYDROLOGY_PARAMETERS_V2,
      d8DirectionOrder: mutableDirections,
      priorityFloodKeyOrder: [...HESTIA_HYDROLOGY_PARAMETERS_V2.priorityFloodKeyOrder] as const
    };
    const snapshot = generateHestiaHydrology(hydrologyInput(isolatedLake, {
      origin: mutableOrigin,
      parameters: mutableParameters
    }));
    const bytes = snapshot.canonicalBytes;
    mutableOrigin.xQuanta = 16;
    mutableDirections[0] = "W";

    expectRecursivelyFrozen(snapshot);
    expect(snapshot.origin.xQuanta).toBe(0);
    expect(snapshot.parameters.d8DirectionOrder[0]).toBe("N");
    expect(snapshot.canonicalBytes).toBe(bytes);
    expect(() => (snapshot.cells as unknown as unknown[]).push({})).toThrow(TypeError);
    expect(() => ((snapshot.origin as { xQuanta: number }).xQuanta = 32)).toThrow(TypeError);
  });

  it("[19] hydrology modules pass the exact forbidden import and API scan", () => {
    const sourceDirectory = resolve(process.cwd(), "src/world-generation/hestia/hydrology");
    const files = readdirSync(sourceDirectory).filter((file) => file.endsWith(".ts")).sort();
    expect(files).toEqual(["canonical.ts", "contracts.ts", "generator.ts", "index.ts", "preset.ts", "sampler.ts", "validation.ts"]);
    const forbidden: readonly [string, RegExp][] = [
      ["Three.js", /(?:from\s+["']three(?:[\/"'])|\bTHREE\b)/],
      ["DOM", /\b(?:window|document|HTMLElement|HTMLCanvasElement|requestAnimationFrame)\b/],
      ["camera", /\b(?:camera|Camera)\b/],
      ["runtime", /\b(?:runtimeState|flightController|TestBridge)\b/],
      ["Math.random", /\bMath\.random\b/],
      ["Date", /\bDate(?:\.now|\s*\()/],
      ["performance.now", /\bperformance\.now\b/],
      ["crypto.random", /\bcrypto\.(?:randomUUID|randomBytes|getRandomValues)\b/]
    ];
    for (const file of files) {
      const source = readFileSync(resolve(sourceDirectory, file), "utf8");
      for (const [name, pattern] of forbidden) expect(source, `${file} contains forbidden ${name}`).not.toMatch(pattern);
    }
  });

  it("[20] full 129x129 retained representation estimator and generation guard stay within 8 MiB", () => {
    const snapshot = planeSnapshot();
    const estimate = estimateHydrologySnapshotRetainedBytes(snapshot);
    expect(snapshot.samples).toHaveLength(129 * 129);
    expect(snapshot.cells).toHaveLength(128 * 128);
    expect(estimate.estimatorVersion).toBe("hydrology-retained-representation-v1");
    expect(estimate.budgetBytes).toBe(8 * 1024 * 1024);
    expect(HESTIA_HYDROLOGY_MEMORY_BUDGET_BYTES_V2).toBe(8 * 1024 * 1024);
    expect(estimate.totalBytes).toBe(estimate.snapshotGraphBytes + estimate.canonicalBytes);
    expect(estimate.totalBytes).toBeLessThanOrEqual(HESTIA_HYDROLOGY_MEMORY_BUDGET_BYTES_V2);
    expect(estimate.withinBudget).toBe(true);

    expect(HESTIA_HYDROLOGY_GRID_V2).toEqual({
      cellsX: 128, cellsZ: 128, samplesX: 129, samplesZ: 129,
      gridSpacingMeters: 2, extentXMeters: 256, extentZMeters: 256,
      globalQuantumMeters: 0.125, originAlignmentQuanta: 16
    });
    expect(HESTIA_HYDROLOGY_PARAMETERS_V2).toMatchObject({
      version: HESTIA_HYDROLOGY_GENERATOR_VERSION_V2,
      gridSpacingMeters: 2,
      seaLevelMeters: 0,
      minimumLakeDepthMeters: 0.15,
      riverSourceAccumulationCells: 48,
      minimumRiverDepthMeters: 0.20,
      maximumRiverDepthMeters: 2.50,
      minimumRiverHalfWidthMeters: 0.50,
      maximumRiverHalfWidthMeters: 4.00,
      channelBankSlope: 0.65,
      moistureFalloffMeters: 18,
      comparisonEpsilonMeters: 1e-9,
      spillElevationQuantizationPerMeter: 1_000_000,
      carveDepthLog2Coefficient: 0.35,
      halfWidthSqrtCoefficient: 0.60,
      riverWaterSurfaceDepthFraction: 0.50,
      accumulationContributionPerCell: 1,
      moistureFormulaVersion: "linear-distance-plus-depression-v1",
      channelFormulaVersion: "log2-sqrt-v1",
      flatRoutingPolicyVersion: "priority-flood-parent-v1",
      bankBlendFormulaVersion: "linear-slope-v1"
    });
  });

  it("preserves ocean truth on exact east and south sample boundaries without wetting dry adjacent cells", () => {
    const east = generateHestiaHydrology(hydrologyInput((globalX, globalZ) =>
      globalX === 256 && globalZ === 64 ? -1 : 2));
    const eastWet = sampleHydrologyTerrainAdjustment(east, 256, 64);
    const eastDry = sampleHydrologyTerrainAdjustment(east, 254, 64);
    expect(eastWet.waterSurfaceHeight).toBe(0);
    expect(east.waterBodies.find((body) => body.id === eastWet.waterBodyId)?.kind).toBe("Ocean");
    expect(eastDry).not.toHaveProperty("waterSurfaceHeight");
    expect(eastDry).not.toHaveProperty("waterBodyId");

    const south = generateHestiaHydrology(hydrologyInput((globalX, globalZ) =>
      globalZ === 256 && globalX === 192 ? -1 : 2));
    const southWet = sampleHydrologyTerrainAdjustment(south, 192, 256);
    const southDry = sampleHydrologyTerrainAdjustment(south, 192, 254);
    expect(southWet.waterSurfaceHeight).toBe(0);
    expect(south.waterBodies.find((body) => body.id === southWet.waterBodyId)?.kind).toBe("Ocean");
    expect(southDry).not.toHaveProperty("waterSurfaceHeight");
    expect(southDry).not.toHaveProperty("waterBodyId");
  });

  it("rejects a subnormal channel bank slope before generation", () => {
    const parameters = { ...HESTIA_HYDROLOGY_PARAMETERS_V2, channelBankSlope: Number.MIN_VALUE };
    expect(() => generateHestiaHydrology(hydrologyInput(eastSlopingPlane, { parameters })))
      .toThrow(/channelBankSlope must use the exact V2 preset value/);
  });

  it("rejects overflow-prone finite spill quantization before snapshot publication", () => {
    const enormousDepression: TerrainFixture = (globalX, globalZ) =>
      globalX === 128 && globalZ === 128 ? 1e303 - 1e292 : 1e303;
    expect(() => generateHestiaHydrology(hydrologyInput(enormousDepression)))
      .toThrow(/spill elevation quantization exceeds finite safe-integer precision/);
  });

  it("rejects a non-finite derived D8 slope from finite extreme terrain before snapshot publication", () => {
    const finiteExtremeSlope: TerrainFixture = (globalX) => globalX === 0 ? 1e308 : -1e308;
    expect(() => generateHestiaHydrology(hydrologyInput(finiteExtremeSlope)))
      .toThrow(/D8 slope must be finite/);
  });

  it("keeps an adversarial repeated-basin and drainage fixture within the retained-representation budget", () => {
    const repeatedBasinsAndDrainage: TerrainFixture = (globalX, globalZ) => {
      const withinX = globalX % 32;
      const withinZ = globalZ % 32;
      const regionalDrainage = 40 - globalZ * 0.03 + Math.abs(globalX - 128) * 0.01;
      const insideBasin = withinX >= 12 && withinX <= 20 && withinZ >= 12 && withinZ <= 20;
      const onRidge = withinX >= 10 && withinX <= 22 && withinZ >= 10 && withinZ <= 22;
      if (insideBasin) return regionalDrainage - 6;
      if (onRidge) return regionalDrainage + 8;
      return regionalDrainage;
    };
    const baseline = valleySnapshot();
    const pressured = generateHestiaHydrology(hydrologyInput(repeatedBasinsAndDrainage));
    const estimate = estimateHydrologySnapshotRetainedBytes(pressured);
    expect(pressured.waterBodies.length).toBeGreaterThan(baseline.waterBodies.length);
    expect(pressured.riverSegments.reduce((sum, segment) => sum + segment.points.length, 0))
      .toBeGreaterThan(baseline.riverSegments.reduce((sum, segment) => sum + segment.points.length, 0));
    expect(estimate.totalBytes).toBeLessThanOrEqual(HESTIA_HYDROLOGY_MEMORY_BUDGET_BYTES_V2);
    expect(estimate.withinBudget).toBe(true);
  });
});
