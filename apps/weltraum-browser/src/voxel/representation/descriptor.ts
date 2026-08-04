import { compareCanonicalCodeUnits, hashAdaptiveCanonical } from "../adaptive";
import {
  REPRESENTATION_LADDER_SCHEMA_VERSION,
  REPRESENTATION_MAX_BANDS,
  REPRESENTATION_MAX_DOMAINS_PER_BAND,
  REPRESENTATION_MAX_ESTIMATED_BYTES,
  REPRESENTATION_MAX_READINESS_REQUIREMENTS_PER_BAND,
  REPRESENTATION_MAX_SOURCE_BINDINGS_PER_BAND,
  REPRESENTATION_MAX_UPLOAD_UNITS,
  REPRESENTATION_MAX_WORK_UNITS,
  type RepresentationBand,
  type RepresentationCosts,
  type RepresentationDomain,
  type RepresentationLadderDescriptor,
  type RepresentationMeterBounds,
  type RepresentationProductKind,
  type RepresentationReadinessRequirement,
  type RepresentationSourceBindingKind
} from "./types";
import {
  deepFreeze,
  representationAdaptiveLevel,
  representationDenseArray,
  representationExactKeys,
  representationFail,
  representationFinite,
  representationId,
  representationNonNegativeSafeInteger,
  representationPositiveFinite,
  representationRecord,
  representationString
} from "./validation";

const productKinds = new Set<RepresentationProductKind>([
  "AdaptiveMicrovoxel", "VoxelRenderProxy", "DamageAwareObjectProxy", "SurfaceRegionProxy",
  "SurfaceTileProxy", "CelestialProxy", "StructuralMesh"
]);
const sourceBindingKinds = new Set<RepresentationSourceBindingKind>([
  "AdaptiveAuthority", "StructuralAuthority", "EditJournal"
]);
const readinessRequirements = new Set<RepresentationReadinessRequirement>([
  "SourceCurrent", "ProductComplete", "CoverageComplete"
]);
const domains = new Set<RepresentationDomain>(["Render", "Simulation", "Fallback"]);

const enumArray = <T extends string>(
  value: unknown,
  path: string,
  maximumLength: number,
  allowed: ReadonlySet<T>
): readonly T[] => {
  const entries = representationDenseArray(value, path, maximumLength);
  if (entries.length === 0) return representationFail("InvalidDescriptor", path, "At least one entry is required.");
  const result = entries.map((entry, index) => {
    if (typeof entry !== "string" || !allowed.has(entry as T)) {
      return representationFail("InvalidDescriptor", `${path}/${index}`, "Unsupported descriptor enum value.");
    }
    return entry as T;
  }).sort(compareCanonicalCodeUnits);
  for (let index = 1; index < result.length; index += 1) {
    if (result[index - 1] === result[index]) return representationFail("InvalidDescriptor", path, "Entries must be unique.");
  }
  return deepFreeze(result);
};

const meterPoint = (value: unknown, path: string) => {
  const record = representationRecord(value, path);
  representationExactKeys(record, ["x", "y", "z"], path);
  return deepFreeze({
    x: representationFinite(record.x, `${path}/x`),
    y: representationFinite(record.y, `${path}/y`),
    z: representationFinite(record.z, `${path}/z`)
  });
};

const coverageBounds = (value: unknown, path: string): RepresentationMeterBounds => {
  const record = representationRecord(value, path);
  representationExactKeys(record, ["min", "max"], path);
  const min = meterPoint(record.min, `${path}/min`);
  const max = meterPoint(record.max, `${path}/max`);
  for (const axis of ["x", "y", "z"] as const) {
    const extent = max[axis] - min[axis];
    if (!Number.isFinite(extent) || extent <= 0) {
      return representationFail("InvalidDescriptor", `${path}/${axis}`, "Coverage bounds must have positive finite extent.");
    }
  }
  return deepFreeze({ min, max });
};

const boundedCost = (value: unknown, path: string, maximum: number): number => {
  const result = representationNonNegativeSafeInteger(value, path);
  if (result > maximum) return representationFail("InvalidDescriptor", path, `Value exceeds finite limit ${maximum}.`);
  return result;
};

const costs = (value: unknown, path: string): RepresentationCosts => {
  const record = representationRecord(value, path);
  representationExactKeys(record, ["estimatedBytes", "workUnits", "uploadUnits"], path);
  return deepFreeze({
    estimatedBytes: boundedCost(record.estimatedBytes, `${path}/estimatedBytes`, REPRESENTATION_MAX_ESTIMATED_BYTES),
    workUnits: boundedCost(record.workUnits, `${path}/workUnits`, REPRESENTATION_MAX_WORK_UNITS),
    uploadUnits: boundedCost(record.uploadUnits, `${path}/uploadUnits`, REPRESENTATION_MAX_UPLOAD_UNITS)
  });
};

const band = (value: unknown, index: number): RepresentationBand => {
  const path = `descriptor/bands/${index}`;
  const record = representationRecord(value, path);
  representationExactKeys(record, [
    "bandId", "rank", "productKind", "algorithmVersion", "productVersion", "geometricErrorMeters",
    "coverageBoundsMeters", "sourceBindingKinds", "readinessRequirements", "allowedDomains",
    "visualAdaptiveLevel", "costs"
  ], path);
  if (typeof record.productKind !== "string" || !productKinds.has(record.productKind as RepresentationProductKind)) {
    return representationFail("InvalidDescriptor", `${path}/productKind`, "Unsupported representation product kind; Culled is selection-only.");
  }
  return deepFreeze({
    bandId: representationId(record.bandId, `${path}/bandId`),
    rank: representationNonNegativeSafeInteger(record.rank, `${path}/rank`),
    productKind: record.productKind as RepresentationProductKind,
    algorithmVersion: representationString(record.algorithmVersion, `${path}/algorithmVersion`),
    productVersion: representationString(record.productVersion, `${path}/productVersion`),
    geometricErrorMeters: representationPositiveFinite(record.geometricErrorMeters, `${path}/geometricErrorMeters`),
    coverageBoundsMeters: coverageBounds(record.coverageBoundsMeters, `${path}/coverageBoundsMeters`),
    sourceBindingKinds: enumArray(record.sourceBindingKinds, `${path}/sourceBindingKinds`, REPRESENTATION_MAX_SOURCE_BINDINGS_PER_BAND, sourceBindingKinds),
    readinessRequirements: enumArray(record.readinessRequirements, `${path}/readinessRequirements`, REPRESENTATION_MAX_READINESS_REQUIREMENTS_PER_BAND, readinessRequirements),
    allowedDomains: enumArray(record.allowedDomains, `${path}/allowedDomains`, REPRESENTATION_MAX_DOMAINS_PER_BAND, domains),
    visualAdaptiveLevel: record.visualAdaptiveLevel === null
      ? null
      : representationAdaptiveLevel(record.visualAdaptiveLevel, `${path}/visualAdaptiveLevel`),
    costs: costs(record.costs, `${path}/costs`)
  });
};

/** Validates, defensively copies, canonicalizes by rank, hashes, and recursively freezes schema V2. */
export const validateRepresentationLadderDescriptor = (value: unknown): RepresentationLadderDescriptor => {
  const record = representationRecord(value, "descriptor");
  representationExactKeys(record, ["schemaVersion", "descriptorId", "bands"], "descriptor");
  if (record.schemaVersion !== REPRESENTATION_LADDER_SCHEMA_VERSION) {
    return representationFail("InvalidDescriptor", "descriptor/schemaVersion", "Unsupported representation ladder schema.");
  }

  // The finite array gate deliberately precedes entry reads, copies, sorting, and hashing.
  const rawBands = representationDenseArray(record.bands, "descriptor/bands", REPRESENTATION_MAX_BANDS);
  if (rawBands.length === 0) return representationFail("InvalidDescriptor", "descriptor/bands", "A descriptor needs at least one band.");
  const bands = rawBands.map(band).sort((left, right) => left.rank - right.rank || compareCanonicalCodeUnits(left.bandId, right.bandId));
  const ids = new Set<string>();
  for (let index = 0; index < bands.length; index += 1) {
    const current = bands[index];
    if (current.rank !== index) return representationFail("InvalidDescriptor", "descriptor/bands", "Ranks must be unique and contiguous from zero.");
    if (ids.has(current.bandId)) return representationFail("InvalidDescriptor", "descriptor/bands", "Band IDs must be unique.");
    ids.add(current.bandId);
    if (index > 0 && current.geometricErrorMeters <= bands[index - 1].geometricErrorMeters) {
      return representationFail("InvalidDescriptor", "descriptor/bands", "Geometric error must strictly increase with rank.");
    }
  }
  const payload = deepFreeze({
    schemaVersion: REPRESENTATION_LADDER_SCHEMA_VERSION,
    descriptorId: representationId(record.descriptorId, "descriptor/descriptorId"),
    bands: deepFreeze(bands)
  });
  return deepFreeze({ ...payload, descriptorHash: hashAdaptiveCanonical(payload) });
};

export const createRepresentationLadderDescriptor = validateRepresentationLadderDescriptor;
