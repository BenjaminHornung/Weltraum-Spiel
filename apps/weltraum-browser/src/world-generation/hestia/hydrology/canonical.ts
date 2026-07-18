import { fnv1aHash } from "../../../core/hash";
import type { HydrologyMemoryBudgetEstimate, HydrologySnapshot } from "./contracts";
import { HESTIA_HYDROLOGY_MEMORY_BUDGET_BYTES_V2 } from "./preset";

const cloneAndFreeze = (value: unknown, ancestors: Set<object>, clones: WeakMap<object, object>): unknown => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("Hydrology snapshot numbers must be finite");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new RangeError("Hydrology snapshot cannot contain cycles");
    const existing = clones.get(value);
    if (existing !== undefined) return existing;
    ancestors.add(value);
    const clone: unknown[] = [];
    clones.set(value, clone);
    try {
      for (const entry of value) clone.push(cloneAndFreeze(entry, ancestors, clones));
      return Object.freeze(clone);
    } finally {
      ancestors.delete(value);
    }
  }
  if (typeof value === "object") {
    if (ArrayBuffer.isView(value)) throw new TypeError("Mutable typed-array aliases are not public hydrology values");
    if (ancestors.has(value as object)) throw new RangeError("Hydrology snapshot cannot contain cycles");
    const existing = clones.get(value as object);
    if (existing !== undefined) return existing;
    ancestors.add(value as object);
    const clone: Record<string, unknown> = {};
    clones.set(value as object, clone);
    try {
      const source = value as Record<string, unknown>;
      const sourcePrototype = Object.getPrototypeOf(source) as object | null;
      if (sourcePrototype !== null && sourcePrototype !== Object.prototype) {
        const clonedPrototype = cloneAndFreeze(sourcePrototype, ancestors, clones) as object;
        Object.setPrototypeOf(clone, clonedPrototype);
      } else if (sourcePrototype === null) {
        Object.setPrototypeOf(clone, null);
      }
      for (const key of Object.keys(source).sort()) {
        const entry = source[key];
        if (entry === undefined || typeof entry === "function" || typeof entry === "symbol" || typeof entry === "bigint") {
          throw new TypeError(`Unsupported hydrology snapshot value at ${key}`);
        }
        Object.defineProperty(clone, key, {
          value: cloneAndFreeze(entry, ancestors, clones),
          enumerable: true,
          configurable: true,
          writable: true
        });
      }
      return Object.freeze(clone);
    } finally {
      ancestors.delete(value as object);
    }
  }
  throw new TypeError("Unsupported hydrology snapshot value");
};

export const freezeHydrologyValue = <T>(value: T): Readonly<T> =>
  cloneAndFreeze(value, new Set<object>(), new WeakMap<object, object>()) as Readonly<T>;

type SnapshotContent = Omit<HydrologySnapshot, "canonicalBytes" | "contentHash">;

/**
 * Packs canonical UTF-8 bytes two per immutable JavaScript code unit. The first
 * code unit records whether the final packed unit contains one or two bytes, so
 * byte sequences with a trailing zero remain distinct. Unlike a public typed
 * array, the returned primitive cannot expose a mutable backing-store alias.
 */
const packCanonicalUtf8 = (canonicalJson: string): string => {
  const utf8 = new TextEncoder().encode(canonicalJson);
  const packed: string[] = [String.fromCharCode(utf8.length % 2)];
  const chunk: number[] = [];
  for (let index = 0; index < utf8.length; index += 2) {
    chunk.push((utf8[index]! << 8) | (utf8[index + 1] ?? 0));
    if (chunk.length === 8_192) {
      packed.push(String.fromCharCode(...chunk));
      chunk.length = 0;
    }
  }
  if (chunk.length > 0) packed.push(String.fromCharCode(...chunk));
  return packed.join("");
};

/** Fixed field order is part of the V2 byte contract. */
export const serializeCanonicalHydrologySnapshot = (snapshot: SnapshotContent): string => packCanonicalUtf8(JSON.stringify({
  generatorVersion: snapshot.generatorVersion,
  rootSeed: snapshot.rootSeed,
  bodyId: snapshot.bodyId,
  surfaceFrameId: snapshot.surfaceFrameId,
  datasetId: snapshot.datasetId,
  origin: [snapshot.origin.xQuanta, snapshot.origin.zQuanta],
  grid: [
    snapshot.grid.cellsX, snapshot.grid.cellsZ, snapshot.grid.samplesX, snapshot.grid.samplesZ,
    snapshot.grid.gridSpacingMeters, snapshot.grid.extentXMeters, snapshot.grid.extentZMeters,
    snapshot.grid.globalQuantumMeters, snapshot.grid.originAlignmentQuanta
  ],
  parameters: [
    snapshot.parameters.version,
    snapshot.parameters.gridSpacingMeters,
    snapshot.parameters.seaLevelMeters,
    snapshot.parameters.minimumLakeDepthMeters,
    snapshot.parameters.riverSourceAccumulationCells,
    snapshot.parameters.minimumRiverDepthMeters,
    snapshot.parameters.maximumRiverDepthMeters,
    snapshot.parameters.minimumRiverHalfWidthMeters,
    snapshot.parameters.maximumRiverHalfWidthMeters,
    snapshot.parameters.channelBankSlope,
    snapshot.parameters.moistureFalloffMeters,
    snapshot.parameters.comparisonEpsilonMeters,
    snapshot.parameters.spillElevationQuantizationPerMeter,
    snapshot.parameters.carveDepthLog2Coefficient,
    snapshot.parameters.halfWidthSqrtCoefficient,
    snapshot.parameters.riverWaterSurfaceDepthFraction,
    snapshot.parameters.d8DirectionOrder,
    snapshot.parameters.priorityFloodKeyOrder,
    snapshot.parameters.accumulationContributionPerCell,
    snapshot.parameters.moistureFormulaVersion,
    snapshot.parameters.channelFormulaVersion,
    snapshot.parameters.flatRoutingPolicyVersion,
    snapshot.parameters.bankBlendFormulaVersion
  ],
  // Cell sample fields are canonicalized once in samples; cell tuples contain
  // only the additional drainage fields in stable index order.
  cells: snapshot.cells.map((cell) => [
    cell.stableLinearIndex, cell.flowDirection,
    cell.downstreamCellIndex, cell.isBoundaryOutlet, cell.accumulation, cell.riverSegmentIds
  ]),
  // id, kind, minimum xQ,zQ,xM,zM, spill, level, sample indices, cell indices.
  waterBodies: snapshot.waterBodies.map((body) => [
    body.id, body.kind,
    body.minimumCoordinate.xQuanta, body.minimumCoordinate.zQuanta,
    body.minimumCoordinate.xMeters, body.minimumCoordinate.zMeters,
    body.spillElevation, body.waterLevel, body.sampleIndices, body.cellIndices
  ]),
  // id, source xQ,zQ,xM,zM, point tuples, termination, terminal body.
  riverSegments: snapshot.riverSegments.map((segment) => [
    segment.id,
    segment.sourceCoordinate.xQuanta, segment.sourceCoordinate.zQuanta,
    segment.sourceCoordinate.xMeters, segment.sourceCoordinate.zMeters,
    segment.points.map((point) => [
      point.cellIndex,
      point.coordinate.xQuanta, point.coordinate.zQuanta, point.coordinate.xMeters, point.coordinate.zMeters,
      point.accumulation, point.carveDepth, point.halfWidth, point.waterSurfaceHeight
    ]),
    segment.termination,
    segment.terminalWaterBodyId
  ]),
  samples: snapshot.samples.map((sample) => [
    sample.coordinate.xQuanta, sample.coordinate.zQuanta, sample.coordinate.xMeters, sample.coordinate.zMeters,
    sample.stableLinearIndex, sample.terrainHeight, sample.filledElevation, sample.depressionDepth,
    sample.spillElevation, sample.basinId, sample.isOcean, sample.waterBodyId, sample.waterSurfaceHeight
  ])
}));

export const hashCanonicalHydrologyBytes = (canonicalBytes: string): `fnv1a32:${string}` =>
  `fnv1a32:${fnv1aHash(canonicalBytes)}`;

const RETAINED_ESTIMATOR_CONTAINER_BYTES = 16;
const RETAINED_ESTIMATOR_REFERENCE_BYTES = 4;
const RETAINED_ESTIMATOR_NUMBER_BYTES = 8;
const RETAINED_ESTIMATOR_BOOLEAN_BYTES = 1;
const RETAINED_ESTIMATOR_STRING_HEADER_BYTES = 16;
const RETAINED_ESTIMATOR_UTF16_CODE_UNIT_BYTES = 2;

/**
 * Deterministic retained-representation estimate used as a fail-closed bound.
 * It counts each shared frozen object once, fixed-width value/reference slots,
 * immutable prototype aliases as references to their shared objects, each
 * distinct graph string once, and the packed canonical byte string in full at
 * two retained bytes per code unit.
 * This describes the retained public representation under the constants below;
 * it is not V8/browser heap telemetry and does not estimate temporary solver
 * working storage, engine object headers, allocator behavior, or garbage
 * collection.
 */
export const estimateHydrologySnapshotRetainedBytes = (
  snapshot: HydrologySnapshot
): HydrologyMemoryBudgetEstimate => {
  const seenObjects = new Set<object>();
  const seenStrings = new Set<string>();
  const estimate = (value: unknown): number => {
    if (value === null) return RETAINED_ESTIMATOR_REFERENCE_BYTES;
    if (typeof value === "number") return RETAINED_ESTIMATOR_NUMBER_BYTES;
    if (typeof value === "boolean") return RETAINED_ESTIMATOR_BOOLEAN_BYTES;
    if (typeof value === "string") {
      if (seenStrings.has(value)) return RETAINED_ESTIMATOR_REFERENCE_BYTES;
      seenStrings.add(value);
      return RETAINED_ESTIMATOR_STRING_HEADER_BYTES + value.length * RETAINED_ESTIMATOR_UTF16_CODE_UNIT_BYTES;
    }
    if (typeof value !== "object") throw new TypeError("Unsupported hydrology memory-estimate value");
    if (seenObjects.has(value)) return RETAINED_ESTIMATOR_REFERENCE_BYTES;
    seenObjects.add(value);
    if (Array.isArray(value)) {
      return RETAINED_ESTIMATOR_CONTAINER_BYTES
        + value.length * RETAINED_ESTIMATOR_REFERENCE_BYTES
        + value.reduce((total, entry) => total + estimate(entry), 0);
    }
    let bytes = RETAINED_ESTIMATOR_CONTAINER_BYTES;
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== null && prototype !== Object.prototype) {
      bytes += RETAINED_ESTIMATOR_REFERENCE_BYTES + estimate(prototype);
    }
    for (const key of Object.keys(value)) {
      if (key === "canonicalBytes") continue;
      bytes += RETAINED_ESTIMATOR_REFERENCE_BYTES + estimate((value as Record<string, unknown>)[key]);
    }
    return bytes;
  };
  const snapshotGraphBytes = estimate(snapshot);
  const canonicalBytes = RETAINED_ESTIMATOR_STRING_HEADER_BYTES
    + snapshot.canonicalBytes.length * RETAINED_ESTIMATOR_UTF16_CODE_UNIT_BYTES;
  const totalBytes = snapshotGraphBytes + canonicalBytes;
  return Object.freeze({
    estimatorVersion: "hydrology-retained-representation-v1",
    snapshotGraphBytes,
    canonicalBytes,
    totalBytes,
    budgetBytes: HESTIA_HYDROLOGY_MEMORY_BUDGET_BYTES_V2,
    withinBudget: totalBytes <= HESTIA_HYDROLOGY_MEMORY_BUDGET_BYTES_V2
  });
};
