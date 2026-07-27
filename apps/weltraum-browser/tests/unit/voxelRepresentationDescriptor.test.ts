import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_LEVELS,
  MICROVOXEL_BASE_QUANTUM_METERS,
  canonicalAdaptiveJson,
  hashAdaptiveCanonical,
  isDeepFrozen
} from "../../src/voxel/adaptive";
import {
  REPRESENTATION_LADDER_SCHEMA_VERSION,
  REPRESENTATION_MAX_BANDS,
  REPRESENTATION_MAX_DOMAINS_PER_BAND,
  REPRESENTATION_MAX_ESTIMATED_BYTES,
  REPRESENTATION_MAX_READINESS_REQUIREMENTS_PER_BAND,
  REPRESENTATION_MAX_SOURCE_BINDINGS_PER_BAND,
  REPRESENTATION_MAX_UPLOAD_UNITS,
  REPRESENTATION_MAX_WORK_UNITS,
  RepresentationValidationError,
  validateRepresentationLadderDescriptor
} from "../../src/voxel/representation";

const band = (rank: number) => ({
  bandId: `band.${String(rank).padStart(2, "0")}`,
  rank,
  productKind: ([
    "AdaptiveMicrovoxel", "VoxelRenderProxy", "DamageAwareObjectProxy", "SurfaceRegionProxy",
    "SurfaceTileProxy", "CelestialProxy"
  ] as const)[rank % 6],
  algorithmVersion: "algorithm.v2",
  productVersion: "product.v2",
  geometricErrorMeters: 0.125 * (2 ** rank),
  coverageBoundsMeters: { min: { x: -1, y: -2, z: -3 }, max: { x: 1, y: 2, z: 3 } },
  sourceBindingKinds: ["AdaptiveAuthority" as const, "EditJournal" as const],
  readinessRequirements: ["SourceCurrent" as const, "ProductComplete" as const],
  allowedDomains: ["Render" as const, "Fallback" as const],
  visualAdaptiveLevel: rank < 5 ? rank : null,
  costs: { estimatedBytes: 1_000 + rank, workUnits: 100 + rank, uploadUnits: 10 + rank }
});

const descriptor = (bands = Array.from({ length: 12 }, (_, rank) => band(rank))) => ({
  schemaVersion: REPRESENTATION_LADDER_SCHEMA_VERSION,
  descriptorId: "ladder.test.v2",
  bands
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("voxel representation descriptor V2", () => {
  it("accepts 12+ count-driven bands without changing Adaptive authority contracts", () => {
    const input = descriptor();
    const before = canonicalAdaptiveJson(input);
    const result = validateRepresentationLadderDescriptor(input);
    expect(result.bands).toHaveLength(12);
    expect(new Set(result.bands.map((entry) => entry.productKind))).toEqual(new Set([
      "AdaptiveMicrovoxel", "VoxelRenderProxy", "DamageAwareObjectProxy", "SurfaceRegionProxy",
      "SurfaceTileProxy", "CelestialProxy"
    ]));
    expect(result.bands.map((entry) => entry.rank)).toEqual(Array.from({ length: 12 }, (_, rank) => rank));
    expect(result.descriptorHash).toBe(hashAdaptiveCanonical({
      schemaVersion: result.schemaVersion,
      descriptorId: result.descriptorId,
      bands: result.bands
    }));
    expect(canonicalAdaptiveJson(input)).toBe(before);
    expect(isDeepFrozen(result)).toBe(true);
    expect(result.bands).not.toBe(input.bands);
    expect(ADAPTIVE_LEVELS).toEqual([0, 1, 2, 3, 4]);
    expect(MICROVOXEL_BASE_QUANTUM_METERS).toBe(0.125);
    expect(result.bands.length).not.toBe(ADAPTIVE_LEVELS.length);
  });

  it("rejects more than 32 bands before reading, copying, sorting, or hashing entries", () => {
    let reads = 0;
    const bands = Array.from({ length: REPRESENTATION_MAX_BANDS + 1 }, (_, rank) => band(rank));
    Object.defineProperty(bands, "0", { enumerable: true, get: () => { reads += 1; throw new Error("must not read"); } });
    expect(() => validateRepresentationLadderDescriptor(descriptor(bands))).toThrow(RepresentationValidationError);
    expect(reads).toBe(0);
  });

  it("rejects duplicate IDs/ranks, rank gaps, and non-monotone geometric errors", () => {
    const duplicateId = descriptor([band(0), { ...band(1), bandId: band(0).bandId }]);
    const duplicateRank = descriptor([band(0), { ...band(1), rank: 0 }]);
    const gap = descriptor([band(0), { ...band(1), rank: 2 }]);
    const nonmonotone = descriptor([band(0), { ...band(1), geometricErrorMeters: band(0).geometricErrorMeters }]);
    for (const invalid of [duplicateId, duplicateRank, gap, nonmonotone]) {
      expect(() => validateRepresentationLadderDescriptor(invalid)).toThrow(RepresentationValidationError);
    }
  });

  it("rejects unknown/accessor/inherited/symbol/sparse plain-data violations", () => {
    const unknown = { ...descriptor(), surprise: true };
    const accessor = descriptor();
    Object.defineProperty(accessor.bands[0], "bandId", { enumerable: true, get: () => "band.accessor" });
    const inheritedBand = Object.assign(Object.create({ inherited: true }), band(0));
    const symbol = descriptor();
    Object.defineProperty(symbol.bands[0], Symbol("hidden"), { enumerable: true, value: true });
    const sparseBands = [band(0), band(1)];
    delete sparseBands[1];
    for (const invalid of [unknown, accessor, descriptor([inheritedBand]), symbol, descriptor(sparseBands)]) {
      expect(() => validateRepresentationLadderDescriptor(invalid)).toThrow(RepresentationValidationError);
    }
  });

  it("rejects NaN, Infinity, negative, unsafe, Culled products, and over-cap nested values", () => {
    const cases = [
      { geometricErrorMeters: Number.NaN },
      { geometricErrorMeters: Number.POSITIVE_INFINITY },
      { geometricErrorMeters: -1 },
      { rank: Number.MAX_SAFE_INTEGER + 1 },
      { productKind: "Culled" },
      { sourceBindingKinds: Array.from({ length: REPRESENTATION_MAX_SOURCE_BINDINGS_PER_BAND + 1 }, () => "AdaptiveAuthority") },
      { readinessRequirements: Array.from({ length: REPRESENTATION_MAX_READINESS_REQUIREMENTS_PER_BAND + 1 }, () => "SourceCurrent") },
      { allowedDomains: Array.from({ length: REPRESENTATION_MAX_DOMAINS_PER_BAND + 1 }, () => "Render") },
      { costs: { ...band(0).costs, estimatedBytes: REPRESENTATION_MAX_ESTIMATED_BYTES + 1 } },
      { costs: { ...band(0).costs, workUnits: REPRESENTATION_MAX_WORK_UNITS + 1 } },
      { costs: { ...band(0).costs, uploadUnits: REPRESENTATION_MAX_UPLOAD_UNITS + 1 } },
      { coverageBoundsMeters: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 1, z: 1 } } }
    ];
    for (const patch of cases) {
      expect(() => validateRepresentationLadderDescriptor({
        ...descriptor(),
        bands: [{ ...band(0), ...patch }]
      })).toThrow(RepresentationValidationError);
    }
  });

  it("defensively copies and recursively freezes without freezing or changing the caller input", () => {
    const input = descriptor([band(0), band(1)]);
    const snapshot = clone(input);
    const result = validateRepresentationLadderDescriptor(input);
    expect(input).toEqual(snapshot);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.bands[0])).toBe(false);
    expect(isDeepFrozen(result)).toBe(true);
    input.bands[0].bandId = "caller.changed";
    expect(result.bands[0].bandId).toBe("band.00");
  });
});
