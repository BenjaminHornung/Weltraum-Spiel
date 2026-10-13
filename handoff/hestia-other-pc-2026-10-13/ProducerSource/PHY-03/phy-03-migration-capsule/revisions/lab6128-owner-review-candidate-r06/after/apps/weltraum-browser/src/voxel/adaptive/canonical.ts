import { fnv1a64Bytes } from "../../core/fnv1a64";
import {
  adaptiveDrainSteps,
  adaptiveDenseArraySteps,
  adaptiveMapSteps,
  adaptiveSortSteps,
  adaptiveFreezeArraySteps,
  adaptiveLevel,
  adaptivePlanningEpoch,
  authorityRevision,
  compareCanonicalCodeUnits,
  deepFreeze,
  fail,
  globalQuantumCoordinate,
  requireCanonicalString,
  requireExactKeys,
  requireDenseDataPropertyArray,
  requireFinite,
  requirePlainRecord,
  stableAuthorityId
} from "./validation";
import { brickExtentQuantumForLevel, compareAdaptiveBrickKeys, quantumBoundsForKey, validateAdaptiveBrickKey, validateQuantumBounds } from "./coordinates";
import { validateAdaptiveEditJournal, adaptiveValidateEditJournalSteps, type AdaptiveOwnedJournalOptions } from "./edits";
import { validateMaterializedAdaptiveBrick, adaptiveValidateMaterializedBrickSteps } from "./materialization";
import type {
  AdaptiveBaseFieldDescriptor,
  AdaptiveBaseFieldSample,
  AdaptiveBrickKey,
  AdaptiveEditJournal,
  AdaptivePlannerSnapshot,
  AdaptivePlanResult,
  AdaptiveRefinementReason,
  AdaptiveRefinementRequest,
  AdaptiveResidentValidationProof,
  MaterializedAdaptiveBrick,
  QuantumBounds
} from "./types";
import {
  ADAPTIVE_BASE_FIELD_DESCRIPTOR_DIGEST_SCHEMA_VERSION,
  ADAPTIVE_RESIDENT_VALIDATION_PROOF_SCHEMA_VERSION,
  ADAPTIVE_RESIDENT_VALIDATION_PROOF_VERSION,
  ADAPTIVE_SNAPSHOT_PROJECTION_SCHEMA_VERSION
} from "./types";

export const ADAPTIVE_MAX_RESIDENT_SUMMARIES = 4_096;
export const ADAPTIVE_MAX_ACTIVE_COVERAGE_ENTRIES = 4_096;
export const ADAPTIVE_MAX_REFINEMENT_REQUESTS = 4_096;
export const ADAPTIVE_MAX_PLAN_ARRAY_ENTRIES = 4_096;
export const ADAPTIVE_MAX_PLAN_AGGREGATE_ENTRIES = 65_536;

export type AdaptiveCanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly AdaptiveCanonicalValue[]
  | { readonly [key: string]: AdaptiveCanonicalValue };

const canonicalize = (value: unknown, path: string, ancestors: WeakSet<object>): AdaptiveCanonicalValue => {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return requireCanonicalString(value, path);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return fail("InvalidCanonicalValue", path, "Non-finite numbers are not canonical.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint" || value === undefined) {
    return fail("InvalidCanonicalValue", path, "Unsupported canonical value.");
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) return fail("InvalidCanonicalValue", path, "Cycles are not canonical.");
    const array = requireDenseDataPropertyArray(value, path, "InvalidCanonicalValue");
    ancestors.add(value);
    const result = Array.prototype.map.call(
      array,
      (entry: unknown, index: number) => canonicalize(entry, `${path}/${index}`, ancestors)
    ) as AdaptiveCanonicalValue[];
    ancestors.delete(value);
    return deepFreeze(result);
  }
  const record = requirePlainRecord(value, path);
  if (ancestors.has(record)) return fail("InvalidCanonicalValue", path, "Cycles are not canonical.");
  ancestors.add(record);
  const result = Object.create(null) as Record<string, AdaptiveCanonicalValue>;
  for (const key of Object.keys(record).sort(compareCanonicalCodeUnits)) {
    result[key] = canonicalize(record[key], `${path}/${key}`, ancestors);
  }
  ancestors.delete(record);
  return deepFreeze(result);
};

const serialize = (value: AdaptiveCanonicalValue): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(serialize).join(",")}]`;
  return `{${Object.keys(value)
    .sort(compareCanonicalCodeUnits)
    .map((key) => `${JSON.stringify(key)}:${serialize((value as Record<string, AdaptiveCanonicalValue>)[key])}`)
    .join(",")}}`;
};

export const canonicalAdaptiveJson = (value: unknown): string => serialize(canonicalize(value, "", new WeakSet<object>()));

export const hashAdaptiveCanonical = (value: unknown): string => {
  const bytes = new TextEncoder().encode(canonicalAdaptiveJson(value));
  return `fnv1a64-v1:${fnv1a64Bytes(bytes)}`;
};

const validateAdaptiveBaseFieldSample = (value: AdaptiveBaseFieldSample): AdaptiveBaseFieldSample => {
  const record = requirePlainRecord(value, "baseField/sample");
  requireExactKeys(
    record,
    ["density", "occupancy", "materialId", ...(Object.hasOwn(record, "semanticId") ? ["semanticId"] : [])],
    "baseField/sample"
  );
  if (Object.hasOwn(record, "semanticId") && record.semanticId === undefined) {
    return fail("InvalidBaseField", "baseField/sample/semanticId", "Present sample fields may not be undefined.");
  }
  const density = requireFinite(record.density as number, "baseField/sample/density");
  const occupancy = requireFinite(record.occupancy as number, "baseField/sample/occupancy");
  if (occupancy < 0 || occupancy > 1) {
    return fail("InvalidBaseField", "baseField/sample/occupancy", "Occupancy must be in [0, 1].");
  }
  return deepFreeze({
    density,
    occupancy,
    materialId: record.materialId === null
      ? null
      : stableAuthorityId(record.materialId as string, "baseField/sample/materialId"),
    semanticId: record.semanticId === undefined || record.semanticId === null
      ? null
      : stableAuthorityId(record.semanticId as string, "baseField/sample/semanticId")
  });
};

export const validateAdaptiveBaseFieldDescriptor = (
  value: AdaptiveBaseFieldDescriptor
): AdaptiveBaseFieldDescriptor => {
  const record = requirePlainRecord(value, "baseField");
  requireExactKeys(record, ["kind", "identity", "version", "sourceRevision", "sample"], "baseField");
  if (record.kind !== "constant-v1") {
    return fail("InvalidBaseField", "baseField/kind", "Unsupported base-field descriptor kind.");
  }
  return deepFreeze({
    kind: "constant-v1",
    identity: stableAuthorityId(record.identity as string, "baseField/identity"),
    version: stableAuthorityId(record.version as string, "baseField/version"),
    sourceRevision: authorityRevision(record.sourceRevision as number),
    sample: validateAdaptiveBaseFieldSample(record.sample as AdaptiveBaseFieldSample)
  });
};

export const createAdaptiveBaseFieldDescriptor = validateAdaptiveBaseFieldDescriptor;

export const evaluateAdaptiveBaseFieldDescriptor = (
  value: AdaptiveBaseFieldDescriptor
): AdaptiveBaseFieldSample => {
  const descriptor = validateAdaptiveBaseFieldDescriptor(value);
  switch (descriptor.kind) {
    case "constant-v1":
      return descriptor.sample;
    default:
      return fail("InvalidBaseField", "baseField/kind", "Unsupported base-field descriptor kind.");
  }
};

export const hashAdaptiveBaseFieldDescriptor = (value: AdaptiveBaseFieldDescriptor): string =>
  adaptiveDrainSteps(adaptiveBaseFieldDescriptorHashSteps(value));

/** Direct-module only: the SAME descriptor projection, with a borrowed full-payload hash. */
export function* adaptiveBaseFieldDescriptorHashSteps(value: AdaptiveBaseFieldDescriptor,
  owned?: AdaptiveOwnedJournalOptions): Generator<void, string, void> {
  owned?.reserve(8_192);
  const payload = {
    schemaVersion: ADAPTIVE_BASE_FIELD_DESCRIPTOR_DIGEST_SCHEMA_VERSION,
    descriptor: validateAdaptiveBaseFieldDescriptor(value)
  };
  return owned === undefined ? hashAdaptiveCanonical(payload) : yield* owned.hash(Object.freeze(payload));
}

export const serializeAdaptiveKey = (key: AdaptiveBrickKey): string => {
  return canonicalAdaptiveJson(validateAdaptiveBrickKey(key));
};

export const serializeAdaptiveEditJournal = (journal: AdaptiveEditJournal): string => {
  return canonicalAdaptiveJson(validateAdaptiveEditJournal(journal));
};

export const serializeMaterializedAdaptiveBrick = (brick: MaterializedAdaptiveBrick): string => {
  return canonicalAdaptiveJson(validateMaterializedAdaptiveBrick(brick));
};

const hashPattern = /^fnv1a64-v1:[0-9a-f]{16}$/;

const requireDenseArray = (value: unknown, path: string, maximumLength?: number): readonly unknown[] =>
  requireDenseDataPropertyArray(value, path, "InvalidPlannerInput", { maximumLength });

const issuedResidentValidationProofs = new WeakSet<object>();

const plannerHash = (value: unknown, path: string): string => {
  if (typeof value !== "string" || !hashPattern.test(value)) {
    return fail("InvalidPlannerInput", path, "Expected a canonical adaptive hash.");
  }
  return value;
};

const plannerNonNegativeInteger = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0) || value < 0) {
    return fail("InvalidPlannerInput", path, "Expected a non-negative safe integer.");
  }
  return value;
};

const copyCanonicalRecord = (value: unknown, path: string): Record<string, AdaptiveCanonicalValue> => {
  const canonical = canonicalize(value, path, new WeakSet<object>());
  if (canonical === null || Array.isArray(canonical) || typeof canonical !== "object") {
    return fail("InvalidPlannerInput", path, "Expected a canonical record.");
  }
  return canonical as Record<string, AdaptiveCanonicalValue>;
};

/**
 * Canonical, non-circular planner input projection. Validation proofs and every
 * proof-derived digest are deliberately omitted.
 */
export const createAdaptivePlannerSnapshotProjection = (snapshot: AdaptivePlannerSnapshot) =>
  adaptiveDrainSteps(adaptivePlannerSnapshotProjectionSteps(snapshot));

/** Direct-module only. Fixed-schema first-party records and index-only arrays stay immutable for
 * this generator lifetime; borrowed accounting/hash is NOT a provenance or publication shortcut. */
export function* adaptivePlannerSnapshotProjectionSteps(snapshot: AdaptivePlannerSnapshot,
  owned?: AdaptiveOwnedJournalOptions): Generator<void, AdaptiveSnapshotProjection, void> {
  owned?.reserve(32_768);
  const record = requirePlainRecord(snapshot, "snapshot");
  requireExactKeys(record, ["schemaVersion", "bodyId", "surfaceFrameId", "regionId", "generatorVersion", "authority", "planningEpoch", "resident", "activeCoverage", "refinementRequests", "budgets"], "snapshot");
  if (record.schemaVersion !== "adaptive-microvoxel-planner-snapshot-v1") {
    return fail("InvalidPlannerInput", "snapshot/schemaVersion", "Unsupported planner snapshot schema.");
  }
  const bodyId = stableAuthorityId(record.bodyId as string, "snapshot/bodyId");
  const surfaceFrameId = stableAuthorityId(record.surfaceFrameId as string, "snapshot/surfaceFrameId");
  const regionId = stableAuthorityId(record.regionId as string, "snapshot/regionId");
  const generatorVersion = stableAuthorityId(record.generatorVersion as string, "snapshot/generatorVersion");
  const planningEpoch = adaptivePlanningEpoch(record.planningEpoch as number);

  const authorityRecord = requirePlainRecord(record.authority, "snapshot/authority");
  requireExactKeys(authorityRecord, ["schemaVersion", "baseField", "editJournal", "brickRevision"], "snapshot/authority");
  if (authorityRecord.schemaVersion !== "adaptive-microvoxel-planner-authority-v1") {
    return fail("InvalidPlannerInput", "snapshot/authority/schemaVersion", "Unsupported planner authority schema.");
  }
  const baseField = validateAdaptiveBaseFieldDescriptor(authorityRecord.baseField as AdaptiveBaseFieldDescriptor);
  const editJournal = owned === undefined ? validateAdaptiveEditJournal(authorityRecord.editJournal as AdaptiveEditJournal)
    : yield* adaptiveValidateEditJournalSteps(authorityRecord.editJournal as AdaptiveEditJournal, owned);
  const brickRevision = authorityRevision(authorityRecord.brickRevision as number);
  const baseFieldDescriptorDigest = owned === undefined ? hashAdaptiveBaseFieldDescriptor(baseField)
    : yield* adaptiveBaseFieldDescriptorHashSteps(baseField, owned);

  const readinessValues = new Set(["ready", "stale", "invalid", "incomplete", "cancelled"]);
  const residentValues = yield* plannerDenseArraySteps(record.resident, "snapshot/resident", ADAPTIVE_MAX_RESIDENT_SUMMARIES, owned);
  const residents = yield* adaptiveSortSteps(yield* adaptiveMapSteps(residentValues, (value, index) => {
    owned?.reserve(8_192, true);
    const path = `snapshot/resident/${index}`;
    const entry = requirePlainRecord(value, path);
    const hasProof = Object.hasOwn(entry, "validationProof");
    requireExactKeys(entry, ["key", "readiness", "byteSize", "work", "contentHash", "provenanceHash", "baseFieldDescriptorDigest", "journalDigest", "sourceRevision", "editRevision", "brickRevision", ...(hasProof ? ["validationProof"] : [])], path);
    if (typeof entry.readiness !== "string" || !readinessValues.has(entry.readiness)) {
      return fail("InvalidPlannerInput", `${path}/readiness`, "Unsupported resident readiness.");
    }
    if (entry.readiness !== "ready" && hasProof) {
      return fail("InvalidPlannerInput", `${path}/validationProof`, "Only ready residency may carry a validation proof.");
    }
    const key = validateAdaptiveBrickKey(entry.key);
    if (key.bodyId !== bodyId || key.surfaceFrameId !== surfaceFrameId || key.regionId !== regionId || key.generatorVersion !== generatorVersion) {
      return fail("InvalidPlannerInput", `${path}/key`, "Resident key does not belong to the snapshot authority.");
    }
    return deepFreeze({
      key,
      readiness: entry.readiness,
      byteSize: plannerNonNegativeInteger(entry.byteSize, `${path}/byteSize`),
      work: plannerNonNegativeInteger(entry.work, `${path}/work`),
      contentHash: plannerHash(entry.contentHash, `${path}/contentHash`),
      provenanceHash: plannerHash(entry.provenanceHash, `${path}/provenanceHash`),
      baseFieldDescriptorDigest: plannerHash(entry.baseFieldDescriptorDigest, `${path}/baseFieldDescriptorDigest`),
      journalDigest: plannerHash(entry.journalDigest, `${path}/journalDigest`),
      sourceRevision: authorityRevision(entry.sourceRevision as number),
      editRevision: authorityRevision(entry.editRevision as number),
      brickRevision: authorityRevision(entry.brickRevision as number)
    });
  }, owned?.reserve), (left, right) => compareAdaptiveBrickKeys(left.key, right.key), owned?.reserve);
  for (let index = 1; index < residents.length; index += 1) {
    if (canonicalAdaptiveJson(residents[index - 1].key) === canonicalAdaptiveJson(residents[index].key)) {
      return fail("InvalidPlannerInput", "snapshot/resident", "Duplicate resident keys are rejected.");
    }
    if (owned !== undefined) { yield; }
  }

  const coverageValues = yield* plannerDenseArraySteps(record.activeCoverage, "snapshot/activeCoverage", ADAPTIVE_MAX_ACTIVE_COVERAGE_ENTRIES, owned);
  const activeCoverage = yield* adaptiveSortSteps(yield* adaptiveMapSteps(coverageValues, (value, index) => {
    owned?.reserve(8_192, true);
    const path = `snapshot/activeCoverage/${index}`;
    const entry = requirePlainRecord(value, path);
    requireExactKeys(entry, ["bounds", "key", "kind"], path);
    if (entry.kind !== "selected" && entry.kind !== "fallback") { return fail("InvalidPlannerInput", `${path}/kind`, "Unsupported coverage kind."); }
    return deepFreeze({ bounds: validateQuantumBounds(entry.bounds, `${path}/bounds`), key: validateAdaptiveBrickKey(entry.key), kind: entry.kind });
  }, owned?.reserve), (left, right) => compareCanonicalCodeUnits(canonicalAdaptiveJson(left), canonicalAdaptiveJson(right)), owned?.reserve);

  const refinementValues = yield* plannerDenseArraySteps(record.refinementRequests, "snapshot/refinementRequests", ADAPTIVE_MAX_REFINEMENT_REQUESTS, owned);
  // Owned refinement records are the controlled <=7-field schema with <=3-field nested shapes,
  // bounded IDs and finite scalars. Reuse the ORIGINAL fixed-record canonical copier/serializer;
  // arbitrary canonical extras are not an owned producer. No replacement general serializer.
  const refinementRequests = yield* adaptiveSortSteps(yield* adaptiveMapSteps(refinementValues, (value, index) => {
    owned?.reserve(8_192, true);
    return copyCanonicalRecord(value, `snapshot/refinementRequests/${index}`);
  }, owned?.reserve), (left, right) => compareCanonicalCodeUnits(canonicalAdaptiveJson(left), canonicalAdaptiveJson(right)), owned?.reserve);
  const budgetsRecord = requirePlainRecord(record.budgets, "snapshot/budgets");
  requireExactKeys(budgetsRecord, ["maxBricks", "maxBytes", "maxWork", "maxCoverageQuantum"], "snapshot/budgets");
  const budgets = deepFreeze({
    maxBricks: plannerNonNegativeInteger(budgetsRecord.maxBricks, "snapshot/budgets/maxBricks"),
    maxBytes: plannerNonNegativeInteger(budgetsRecord.maxBytes, "snapshot/budgets/maxBytes"),
    maxWork: plannerNonNegativeInteger(budgetsRecord.maxWork, "snapshot/budgets/maxWork"),
    maxCoverageQuantum: plannerNonNegativeInteger(budgetsRecord.maxCoverageQuantum, "snapshot/budgets/maxCoverageQuantum")
  });
  owned?.reserve(8_192, true);
  const authorityValue = {
    schemaVersion: "adaptive-microvoxel-planner-authority-v1" as const,
    bodyId, surfaceFrameId, regionId, generatorVersion, baseField, baseFieldDescriptorDigest,
    editJournal, journalDigest: editJournal.digest, sourceRevision: baseField.sourceRevision,
    editRevision: editJournal.revision, brickRevision, planningEpoch
  };
  const authority = owned === undefined ? deepFreeze(authorityValue) : Object.freeze(authorityValue);
  // Generic finalization keeps its original recursive order. Owned arrays are fully built
  // privately, then each index is locked before the fixed-schema result can escape.
  const result = {
    schemaVersion: ADAPTIVE_SNAPSHOT_PROJECTION_SCHEMA_VERSION,
    authority,
    resident: yield* adaptiveFreezeArraySteps(residents, owned?.reserve),
    activeCoverage: yield* adaptiveFreezeArraySteps(activeCoverage, owned?.reserve),
    refinementRequests: yield* adaptiveFreezeArraySteps(refinementRequests, owned?.reserve),
    budgets
  };
  return owned === undefined ? deepFreeze(result) : Object.freeze(result);
}

type AdaptiveSnapshotProjection = {
  readonly schemaVersion: typeof ADAPTIVE_SNAPSHOT_PROJECTION_SCHEMA_VERSION;
  readonly authority: Readonly<{schemaVersion:"adaptive-microvoxel-planner-authority-v1";
    bodyId:ReturnType<typeof stableAuthorityId>;surfaceFrameId:ReturnType<typeof stableAuthorityId>;
    regionId:ReturnType<typeof stableAuthorityId>;generatorVersion:ReturnType<typeof stableAuthorityId>;
    baseField:ReturnType<typeof validateAdaptiveBaseFieldDescriptor>;baseFieldDescriptorDigest:string;editJournal:AdaptiveEditJournal;
    journalDigest:string;sourceRevision:ReturnType<typeof authorityRevision>;editRevision:ReturnType<typeof authorityRevision>;
    brickRevision:ReturnType<typeof authorityRevision>;planningEpoch:ReturnType<typeof adaptivePlanningEpoch>}>;
  readonly resident: readonly (Omit<AdaptivePlannerSnapshot["resident"][number],"validationProof"|"readiness"> & {readonly readiness:string})[];
  readonly activeCoverage: readonly (Omit<AdaptivePlannerSnapshot["activeCoverage"][number],"kind"> & {readonly kind:string})[];
  readonly refinementRequests: readonly Record<string, AdaptiveCanonicalValue>[];
  readonly budgets: Readonly<{maxBricks:number;maxBytes:number;maxWork:number;maxCoverageQuantum:number}>;
};

function* plannerDenseArraySteps(value: unknown, path: string, maximumLength: number,
  owned?: AdaptiveOwnedJournalOptions): Generator<void, readonly unknown[], void> {
  return owned === undefined ? requireDenseArray(value, path, maximumLength)
    : yield* adaptiveDenseArraySteps(value, path, "InvalidPlannerInput", { maximumLength }, owned.reserve);
}

function* plannerPayloadHashSteps(payload: unknown, owned?: AdaptiveOwnedJournalOptions): Generator<void, string, void> {
  owned?.reserve(8_192);
  return owned === undefined ? hashAdaptiveCanonical(payload) : yield* owned.hash(Object.freeze(payload));
}

export const hashAdaptivePlannerSnapshotProjection = (snapshot: AdaptivePlannerSnapshot): string =>
  adaptiveDrainSteps(adaptivePlannerSnapshotHashSteps(snapshot));

export function* adaptivePlannerSnapshotHashSteps(snapshot: AdaptivePlannerSnapshot,
  owned?: AdaptiveOwnedJournalOptions): Generator<void, string, void> {
  return yield* plannerPayloadHashSteps(yield* adaptivePlannerSnapshotProjectionSteps(snapshot, owned), owned);
}

const semanticAxes = ["x", "y", "z"] as const;
const refinementReasons = new Set<AdaptiveRefinementReason>([
  "Inspection", "PlayerProximity", "CollisionRequired", "ToolInteraction", "Explosion", "ProjectileImpact", "MeteorImpact", "StructuralFracture"
]);

const semanticSafeSpan = (min: number, max: number, path: string): number => {
  const result = max - min;
  if (!Number.isSafeInteger(result) || result <= 0) return fail("InvalidPlannerInput", path, "Planner bounds arithmetic exceeded safe integers.");
  return result;
};

const semanticSafeProduct = (values: readonly number[], path: string): number => {
  let result = 1;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) return fail("InvalidPlannerInput", path, "Planner arithmetic exceeded safe integers.");
    result *= value;
    if (!Number.isSafeInteger(result)) return fail("InvalidPlannerInput", path, "Planner arithmetic exceeded safe integers.");
  }
  return result;
};

const alignedSphereBound = (center: number, radius: number, extent: number, edge: "min" | "max", path: string): number => {
  const offset = edge === "min" ? center - radius : center + radius;
  if (!Number.isSafeInteger(offset)) return fail("InvalidPlannerInput", path, "Sphere bound arithmetic must remain within safe integers.");
  const aligned = (edge === "min" ? Math.floor(offset / extent) : Math.ceil(offset / extent)) * extent;
  if (!Number.isSafeInteger(aligned)) return fail("InvalidPlannerInput", path, "Aligned sphere bounds must remain within safe integers.");
  return globalQuantumCoordinate(aligned, path);
};

export interface AdaptiveValidatedRefinementRequest {
  readonly request: AdaptiveRefinementRequest;
  readonly bounds: QuantumBounds;
  readonly count: number;
}

const validateRefinementRequest = (value: AdaptiveRefinementRequest, index: number): AdaptiveValidatedRefinementRequest => {
  const path = `snapshot/refinementRequests/${index}`;
  const record = requirePlainRecord(value, path);
  const optionalDeadline = Object.hasOwn(record, "deadlinePlanningEpoch") ? ["deadlinePlanningEpoch"] : [];
  requireExactKeys(record, ["requestId", "region", "targetLevel", "reason", "requiredForCoverage", ...optionalDeadline, "priority"], path);
  const requestId = stableAuthorityId(value.requestId, `${path}/requestId`);
  const targetLevel = adaptiveLevel(value.targetLevel);
  if (!refinementReasons.has(value.reason)) return fail("InvalidPlannerInput", `${path}/reason`, "Unsupported refinement reason.");
  if (typeof value.requiredForCoverage !== "boolean") return fail("InvalidPlannerInput", `${path}/requiredForCoverage`, "Coverage requirement must be boolean.");
  if (!Number.isFinite(value.priority)) return fail("InvalidPlannerInput", `${path}/priority`, "Priority must be finite.");
  const deadlinePlanningEpoch = value.deadlinePlanningEpoch === undefined ? undefined : adaptivePlanningEpoch(value.deadlinePlanningEpoch);
  const regionRecord = requirePlainRecord(value.region, `${path}/region`);
  const extent = brickExtentQuantumForLevel(targetLevel);
  let bounds: QuantumBounds;
  let region: AdaptiveRefinementRequest["region"];
  if (regionRecord.kind === "aabb") {
    requireExactKeys(regionRecord, ["kind", "bounds"], `${path}/region`);
    bounds = validateQuantumBounds(regionRecord.bounds, `${path}/region/bounds`);
    for (const axis of semanticAxes) if (bounds.min[axis] % extent !== 0 || bounds.max[axis] % extent !== 0) {
      return fail("InvalidPlannerInput", `${path}/region/bounds/${axis}`, "AABB coverage must align to target bricks.");
    }
    region = { kind: "aabb", bounds };
  } else if (regionRecord.kind === "sphere") {
    requireExactKeys(regionRecord, ["kind", "center", "radiusQuantum"], `${path}/region`);
    const centerRecord = requirePlainRecord(regionRecord.center, `${path}/region/center`);
    requireExactKeys(centerRecord, ["x", "y", "z"], `${path}/region/center`);
    const center = deepFreeze({
      x: globalQuantumCoordinate(centerRecord.x as number, `${path}/region/center/x`),
      y: globalQuantumCoordinate(centerRecord.y as number, `${path}/region/center/y`),
      z: globalQuantumCoordinate(centerRecord.z as number, `${path}/region/center/z`)
    });
    const radius = globalQuantumCoordinate(regionRecord.radiusQuantum as number, `${path}/region/radiusQuantum`);
    if (radius <= 0) return fail("InvalidPlannerInput", `${path}/region/radiusQuantum`, "Sphere radius must be positive.");
    bounds = validateQuantumBounds({
      min: {
        x: alignedSphereBound(center.x, radius, extent, "min", `${path}/region/sphereBounds/min/x`),
        y: alignedSphereBound(center.y, radius, extent, "min", `${path}/region/sphereBounds/min/y`),
        z: alignedSphereBound(center.z, radius, extent, "min", `${path}/region/sphereBounds/min/z`)
      },
      max: {
        x: alignedSphereBound(center.x, radius, extent, "max", `${path}/region/sphereBounds/max/x`),
        y: alignedSphereBound(center.y, radius, extent, "max", `${path}/region/sphereBounds/max/y`),
        z: alignedSphereBound(center.z, radius, extent, "max", `${path}/region/sphereBounds/max/z`)
      }
    }, `${path}/region/sphereBounds`);
    region = { kind: "sphere", center, radiusQuantum: radius };
  } else {
    return fail("InvalidPlannerInput", `${path}/region/kind`, "Refinement region must be an aabb or sphere.");
  }
  const count = semanticSafeProduct(semanticAxes.map((axis) => semanticSafeSpan(bounds.min[axis], bounds.max[axis], `${path}/region/${axis}`) / extent), `${path}/region`);
  const request = deepFreeze({ requestId, region, targetLevel, reason: value.reason, requiredForCoverage: value.requiredForCoverage, ...(deadlinePlanningEpoch === undefined ? {} : { deadlinePlanningEpoch }), priority: value.priority });
  return deepFreeze({ request, bounds, count });
};

const validateIssuedResidentProof = (
  value: unknown,
  residentPath: string,
  projectionResident: ReturnType<typeof createAdaptivePlannerSnapshotProjection>["resident"][number],
  projection: ReturnType<typeof createAdaptivePlannerSnapshotProjection>,
  snapshotProjectionDigest: string
): void => adaptiveDrainSteps(issuedResidentProofValidationSteps(value, residentPath, projectionResident, projection, snapshotProjectionDigest));

function* issuedResidentProofValidationSteps(
  value: unknown, residentPath: string, projectionResident: AdaptiveSnapshotProjection["resident"][number],
  projection: AdaptiveSnapshotProjection, snapshotProjectionDigest: string, owned?: AdaptiveOwnedJournalOptions
): Generator<void, void, void> {
  owned?.reserve(16_384);
  const path = `${residentPath}/validationProof`;
  if (typeof value !== "object" || value === null || !issuedResidentValidationProofs.has(value)) {
    return fail("InvalidPlannerInput", path, "Resident validation proof was not issued by the trusted constructor.");
  }
  const proof = requirePlainRecord(value, path);
  requireExactKeys(proof, ["schemaVersion", "proofVersion", "key", "contentHash", "provenanceHash", "baseFieldDescriptorDigest", "journalDigest", "sourceRevision", "editRevision", "brickRevision", "planningEpoch", "snapshotProjectionDigest", "proofDigest"], path);
  if (proof.schemaVersion !== ADAPTIVE_RESIDENT_VALIDATION_PROOF_SCHEMA_VERSION || proof.proofVersion !== ADAPTIVE_RESIDENT_VALIDATION_PROOF_VERSION) {
    return fail("InvalidPlannerInput", path, "Unsupported resident validation proof schema or version.");
  }
  const proofKey = validateAdaptiveBrickKey(proof.key);
  const payload = {
    schemaVersion: ADAPTIVE_RESIDENT_VALIDATION_PROOF_SCHEMA_VERSION,
    proofVersion: ADAPTIVE_RESIDENT_VALIDATION_PROOF_VERSION,
    key: proofKey,
    contentHash: plannerHash(proof.contentHash, `${path}/contentHash`),
    provenanceHash: plannerHash(proof.provenanceHash, `${path}/provenanceHash`),
    baseFieldDescriptorDigest: plannerHash(proof.baseFieldDescriptorDigest, `${path}/baseFieldDescriptorDigest`),
    journalDigest: plannerHash(proof.journalDigest, `${path}/journalDigest`),
    sourceRevision: plannerNonNegativeInteger(proof.sourceRevision, `${path}/sourceRevision`),
    editRevision: plannerNonNegativeInteger(proof.editRevision, `${path}/editRevision`),
    brickRevision: plannerNonNegativeInteger(proof.brickRevision, `${path}/brickRevision`),
    planningEpoch: plannerNonNegativeInteger(proof.planningEpoch, `${path}/planningEpoch`),
    snapshotProjectionDigest: plannerHash(proof.snapshotProjectionDigest, `${path}/snapshotProjectionDigest`)
  };
  const authority = projection.authority;
  if (
    canonicalAdaptiveJson(payload.key) !== canonicalAdaptiveJson(projectionResident.key)
    || payload.contentHash !== projectionResident.contentHash
    || payload.provenanceHash !== projectionResident.provenanceHash
    || payload.baseFieldDescriptorDigest !== projectionResident.baseFieldDescriptorDigest
    || payload.journalDigest !== projectionResident.journalDigest
    || payload.sourceRevision !== projectionResident.sourceRevision
    || payload.editRevision !== projectionResident.editRevision
    || payload.brickRevision !== projectionResident.brickRevision
    || payload.baseFieldDescriptorDigest !== authority.baseFieldDescriptorDigest
    || payload.journalDigest !== authority.journalDigest
    || payload.sourceRevision !== authority.sourceRevision
    || payload.editRevision !== authority.editRevision
    || payload.brickRevision !== authority.brickRevision
    || payload.planningEpoch !== authority.planningEpoch
    || payload.snapshotProjectionDigest !== snapshotProjectionDigest
    || (yield* plannerPayloadHashSteps(payload, owned)) !== plannerHash(proof.proofDigest, `${path}/proofDigest`)
  ) { return fail("InvalidPlannerInput", path, "Resident validation proof does not match the exact snapshot authority projection."); }
}

/** Original native find in generic mode; owned predicates compare only fully validated fixed keys. */
function* plannerResidentFindSteps(values: AdaptiveSnapshotProjection["resident"],
  match: (entry: AdaptiveSnapshotProjection["resident"][number]) => boolean,
  owned?: AdaptiveOwnedJournalOptions): Generator<void, AdaptiveSnapshotProjection["resident"][number] | undefined, void> {
  owned?.reserve(32_768);
  if (owned === undefined) { return values.find(match); }
  for (let index = 0; index < values.length; index += 1) {
    const entry = values[index];
    if (match(entry)) { return entry; }
    yield;
  }
  return undefined;
}

export interface ValidateAdaptivePlannerSnapshotSemanticsOptions {
  readonly allowProoflessReadyResidents?: boolean;
}

/** Shared complete semantic gate used by both proof issuance and planning. */
export const validateAdaptivePlannerSnapshotSemantics = (
  snapshot: AdaptivePlannerSnapshot,
  options: ValidateAdaptivePlannerSnapshotSemanticsOptions = {}
) => adaptiveDrainSteps(adaptivePlannerSnapshotSemanticsSteps(snapshot, options));

type AdaptiveSnapshotSemantics = {readonly projection:AdaptiveSnapshotProjection;readonly snapshotProjectionDigest:string;
  readonly refinementRequests:readonly AdaptiveValidatedRefinementRequest[];readonly budgets:AdaptiveSnapshotProjection["budgets"]};

/** Complete original semantic gate, including proof binding. One local result, not a cache. */
export function* adaptivePlannerSnapshotSemanticsSteps(snapshot: AdaptivePlannerSnapshot,
  options: ValidateAdaptivePlannerSnapshotSemanticsOptions = {}, owned?: AdaptiveOwnedJournalOptions
): Generator<void, AdaptiveSnapshotSemantics, void> {
  owned?.reserve(32_768);
  const projection = yield* adaptivePlannerSnapshotProjectionSteps(snapshot, owned);
  const snapshotProjectionDigest = yield* plannerPayloadHashSteps(projection, owned);

  for (let index = 0; index < snapshot.resident.length; index += 1) {
    const entry = snapshot.resident[index];
    const path = `snapshot/resident/${index}`;
    const projected = yield* plannerResidentFindSteps(projection.resident,
      candidate => canonicalAdaptiveJson(candidate.key) === canonicalAdaptiveJson(entry.key), owned);
    if (projected === undefined) { return fail("InvalidPlannerInput", `${path}/key`, "Resident key is absent from the canonical snapshot projection."); }
    const hasProof = Object.hasOwn(entry, "validationProof");
    if (entry.readiness === "ready" && !hasProof && options.allowProoflessReadyResidents !== true) {
      return fail("InvalidPlannerInput", `${path}/validationProof`, "Ready residency requires a validation proof.");
    }
    if (hasProof) {
      if (owned === undefined) { validateIssuedResidentProof(entry.validationProof, path, projected, projection, snapshotProjectionDigest); }
      else { yield* issuedResidentProofValidationSteps(entry.validationProof, path, projected, projection, snapshotProjectionDigest, owned); }
    }
    if (owned !== undefined) { yield; }
  }

  for (let index = 0; index < snapshot.activeCoverage.length; index += 1) {
    const path = `snapshot/activeCoverage/${index}`;
    const entry = snapshot.activeCoverage[index];
    const key = validateAdaptiveBrickKey(entry.key);
    if (key.bodyId !== projection.authority.bodyId || key.surfaceFrameId !== projection.authority.surfaceFrameId || key.regionId !== projection.authority.regionId || key.generatorVersion !== projection.authority.generatorVersion) {
      return fail("InvalidPlannerInput", `${path}/key`, "Brick identity does not belong to the planner snapshot region.");
    }
    if (canonicalAdaptiveJson(validateQuantumBounds(entry.bounds, `${path}/bounds`)) !== canonicalAdaptiveJson(quantumBoundsForKey(key))) {
      return fail("InvalidPlannerInput", `${path}/bounds`, "Active coverage bounds must exactly match its key.");
    }
    if (owned !== undefined) { yield; }
  }

  const requestValues = (yield* plannerDenseArraySteps(snapshot.refinementRequests,
    "snapshot/refinementRequests", ADAPTIVE_MAX_REFINEMENT_REQUESTS, owned)) as readonly AdaptiveRefinementRequest[];
  const refinementRequests = owned === undefined ? requestValues.map(validateRefinementRequest)
    : yield* adaptiveMapSteps(requestValues, (value, index) => {
    owned?.reserve(8_192, true);
    return validateRefinementRequest(value, index);
  }, owned?.reserve);
  owned?.reserve(64 + refinementRequests.length * 128);
  const requestIds = new Set<string>();
  for (const { request } of refinementRequests) {
    if (requestIds.has(request.requestId)) { return fail("InvalidPlannerInput", "snapshot/refinementRequests", "Duplicate request IDs are rejected."); }
    requestIds.add(request.requestId);
    if (owned !== undefined) { yield; }
  }

  owned?.reserve(4_096, true);
  const result = { projection, snapshotProjectionDigest,
    refinementRequests: owned === undefined ? refinementRequests : yield* adaptiveFreezeArraySteps(refinementRequests, owned.reserve),
    budgets: projection.budgets };
  return owned === undefined ? deepFreeze(result) : Object.freeze(result);
}

export interface CreateAdaptiveResidentValidationProofInput {
  readonly brick: MaterializedAdaptiveBrick;
  readonly brickRevision: number;
  readonly snapshot: AdaptivePlannerSnapshot;
}

const issueAdaptiveResidentValidationProof = (
  value: MaterializedAdaptiveBrick,
  revisionValue: number,
  projection: ReturnType<typeof createAdaptivePlannerSnapshotProjection>,
  snapshotProjectionDigest: string
): AdaptiveResidentValidationProof =>
  adaptiveDrainSteps(residentProofIssueSteps(value, revisionValue, projection, snapshotProjectionDigest));

/** Existing real issuer, never exposed as a projection-only or frozen-object admission API. */
function* residentProofIssueSteps(value: MaterializedAdaptiveBrick, revisionValue: number,
  projection: AdaptiveSnapshotProjection, snapshotProjectionDigest: string, owned?: AdaptiveOwnedJournalOptions
): Generator<void, AdaptiveResidentValidationProof, void> {
  owned?.reserve(16_384);
  const brick = owned === undefined ? validateMaterializedAdaptiveBrick(value)
    : yield* adaptiveValidateMaterializedBrickSteps(value, owned);
  const brickRevision = authorityRevision(revisionValue);
  const expected = yield* plannerResidentFindSteps(projection.resident,
    entry => canonicalAdaptiveJson(entry.key) === canonicalAdaptiveJson(brick.key), owned);
  if (expected === undefined || expected.readiness !== "ready") {
    return fail("InvalidPlannerInput", "proof/brick", "Validated brick must have one ready resident summary in the snapshot projection.");
  }
  const authority = projection.authority;
  if (
    expected.contentHash !== brick.contentHash
    || expected.provenanceHash !== brick.provenance.provenanceHash
    || expected.baseFieldDescriptorDigest !== brick.baseFieldDescriptorDigest
    || expected.journalDigest !== brick.provenance.journalDigest
    || expected.sourceRevision !== brick.sourceRevision
    || expected.editRevision !== brick.editRevision
    || expected.brickRevision !== brickRevision
    || authority.baseFieldDescriptorDigest !== brick.baseFieldDescriptorDigest
    || authority.journalDigest !== brick.provenance.journalDigest
    || authority.sourceRevision !== brick.sourceRevision
    || authority.editRevision !== brick.editRevision
    || authority.brickRevision !== brickRevision
  ) {
    return fail("InvalidPlannerInput", "proof/brick", "Materialized brick does not match the projected resident and authority context.");
  }
  owned?.reserve(8_192, true);
  const payload = {
    schemaVersion: ADAPTIVE_RESIDENT_VALIDATION_PROOF_SCHEMA_VERSION,
    proofVersion: ADAPTIVE_RESIDENT_VALIDATION_PROOF_VERSION,
    key: brick.key,
    contentHash: brick.contentHash,
    provenanceHash: brick.provenance.provenanceHash,
    baseFieldDescriptorDigest: brick.baseFieldDescriptorDigest,
    journalDigest: brick.provenance.journalDigest,
    sourceRevision: brick.sourceRevision,
    editRevision: brick.editRevision,
    brickRevision,
    planningEpoch: authority.planningEpoch,
    snapshotProjectionDigest
  };
  const proofValue = {
    ...payload,
    proofDigest: yield* plannerPayloadHashSteps(payload, owned)
  };
  const proof = (owned === undefined ? deepFreeze(proofValue) : Object.freeze(proofValue)) as unknown as AdaptiveResidentValidationProof;
  issuedResidentValidationProofs.add(proof as object);
  return proof;
}

export const createAdaptiveResidentValidationProof = ({ brick, brickRevision, snapshot }: CreateAdaptiveResidentValidationProofInput): AdaptiveResidentValidationProof =>
  adaptiveDrainSteps(adaptiveResidentValidationProofSteps({ brick, brickRevision, snapshot }));

export function* adaptiveResidentValidationProofSteps({ brick, brickRevision, snapshot }: CreateAdaptiveResidentValidationProofInput,
  owned?: AdaptiveOwnedJournalOptions): Generator<void, AdaptiveResidentValidationProof, void> {
  owned?.reserve(8_192);
  const { projection, snapshotProjectionDigest } = yield* adaptivePlannerSnapshotSemanticsSteps(snapshot, { allowProoflessReadyResidents: true }, owned);
  return yield* residentProofIssueSteps(brick, brickRevision, projection, snapshotProjectionDigest, owned);
}

export interface CreateAdaptiveResidentValidationProofsInput {
  readonly bricks: readonly MaterializedAdaptiveBrick[];
  readonly brickRevision: number;
  readonly snapshot: AdaptivePlannerSnapshot;
}

/** Issues several proofs against one exact projection without recomputing it per resident. */
export const createAdaptiveResidentValidationProofs = ({ bricks, brickRevision, snapshot }: CreateAdaptiveResidentValidationProofsInput): readonly AdaptiveResidentValidationProof[] =>
  adaptiveDrainSteps(adaptiveResidentValidationProofsSteps({ bricks, brickRevision, snapshot }));

/** One COMPLETE immutable semantic projection/digest is reused only by THIS batch lifetime.
 * Every brick receives the full original channel/provenance validation before the real WeakSet add.
 * Private partial proofs never escape a failed/cancelled generator. No cache or alternate issuer. */
export function* adaptiveResidentValidationProofsSteps({ bricks, brickRevision, snapshot }: CreateAdaptiveResidentValidationProofsInput,
  owned?: AdaptiveOwnedJournalOptions): Generator<void, readonly AdaptiveResidentValidationProof[], void> {
  owned?.reserve(8_192);
  const proofBricks = (yield* plannerDenseArraySteps(bricks, "proofs/bricks", ADAPTIVE_MAX_RESIDENT_SUMMARIES, owned)) as readonly MaterializedAdaptiveBrick[];
  const { projection, snapshotProjectionDigest } = yield* adaptivePlannerSnapshotSemanticsSteps(snapshot, { allowProoflessReadyResidents: true }, owned);
  if (owned === undefined) {
    return deepFreeze(proofBricks.map(brick => issueAdaptiveResidentValidationProof(brick, brickRevision, projection, snapshotProjectionDigest)));
  }
  owned.reserve(64 + proofBricks.length * 128, true);
  const result: AdaptiveResidentValidationProof[] = [];
  for (let index = 0; index < proofBricks.length; index += 1) {
    result.push(yield* residentProofIssueSteps(proofBricks[index], brickRevision, projection, snapshotProjectionDigest, owned));
    yield;
  }
  return yield* adaptiveFreezeArraySteps(result, owned.reserve);
}

export const hasAdaptiveResidentValidationProofBrand = (value: unknown): value is AdaptiveResidentValidationProof =>
  typeof value === "object" && value !== null && issuedResidentValidationProofs.has(value);

const validatePlanKeyArray = (value: unknown, path: string): readonly AdaptiveBrickKey[] =>
  requireDenseArray(value, path).map((entry) => validateAdaptiveBrickKey(entry));

const validatePlanCoverage = (value: unknown, path: string) =>
  requireDenseArray(value, path).map((entry, index) => {
    const entryPath = `${path}/${index}`;
    const record = requirePlainRecord(entry, entryPath);
    requireExactKeys(record, ["bounds", "key", "kind"], entryPath);
    if (record.kind !== "selected" && record.kind !== "fallback") {
      return fail("InvalidPlannerInput", `${entryPath}/kind`, "Unsupported coverage kind.");
    }
    return deepFreeze({
      bounds: validateQuantumBounds(record.bounds, `${entryPath}/bounds`),
      key: validateAdaptiveBrickKey(record.key),
      kind: record.kind
    });
  });

const validatePlanReasons = (value: unknown, path: string): readonly string[] =>
  requireDenseArray(value, path).map((entry, index) => {
    if (typeof entry !== "string") return fail("InvalidPlannerInput", `${path}/${index}`, "Plan reasons must be strings.");
    return requireCanonicalString(entry, `${path}/${index}`);
  });

const preflightAdaptivePlanArrayLimits = (record: Record<string, unknown>): void => {
  let aggregateEntries = 0;
  const account = (value: unknown, path: string): readonly unknown[] => {
    const entries = requireDenseArray(value, path, ADAPTIVE_MAX_PLAN_ARRAY_ENTRIES);
    if (entries.length > ADAPTIVE_MAX_PLAN_AGGREGATE_ENTRIES - aggregateEntries) {
      return fail(
        "InvalidPlannerInput",
        path,
        `Plan array aggregate exceeds the finite limit ${ADAPTIVE_MAX_PLAN_AGGREGATE_ENTRIES}.`
      );
    }
    aggregateEntries += entries.length;
    return entries;
  };

  for (const field of [
    "desired",
    "keep",
    "materialize",
    "evict",
    "coverage",
    "reasons",
    "desiredKeys",
    "keepKeys",
    "materializeRequests",
    "evictCandidates",
    "parentFallbackKeys",
    "deterministicReasons"
  ] as const) {
    account(record[field], `plan/${field}`);
  }

  const fallback = account(record.fallback, "plan/fallback");
  for (let index = 0; index < fallback.length; index += 1) {
    const path = `plan/fallback/${index}`;
    const entry = requirePlainRecord(fallback[index], path);
    requireExactKeys(entry, ["ancestor", "requiredChildren", "coverage"], path);
    account(entry.requiredChildren, `${path}/requiredChildren`);
  }

  const coverageStatus = requirePlainRecord(record.coverageStatus, "plan/coverageStatus");
  requireExactKeys(coverageStatus, ["coverage", "complete", "uncoveredRequiredKeyCount"], "plan/coverageStatus");
  account(coverageStatus.coverage, "plan/coverageStatus/coverage");
};

/** Cycle-safe structural validator for already-produced refinement plans. */
export const validateAdaptivePlanResult = (plan: AdaptivePlanResult): AdaptivePlanResult => {
  const record = requirePlainRecord(plan, "plan");
  const shared = ["schemaVersion", "status", "desired", "keep", "materialize", "evict", "fallback", "coverage", "reasons", "desiredKeys", "keepKeys", "materializeRequests", "evictCandidates", "parentFallbackKeys", "coverageStatus", "deterministicReasons", "snapshotProjectionDigest", "planHash"];
  requireExactKeys(record, record.status === "accepted" ? shared : [...shared, "code", "budget", "required", "limit"], "plan");
  if (record.schemaVersion !== "adaptive-microvoxel-plan-v1" || (record.status !== "accepted" && record.status !== "rejected")) {
    return fail("InvalidPlannerInput", "plan", "Unsupported plan schema or status.");
  }
  preflightAdaptivePlanArrayLimits(record);
  const desired = validatePlanKeyArray(record.desired, "plan/desired");
  const keep = validatePlanKeyArray(record.keep, "plan/keep");
  const materialize = validatePlanKeyArray(record.materialize, "plan/materialize");
  const evict = validatePlanKeyArray(record.evict, "plan/evict");
  const fallback = requireDenseArray(record.fallback, "plan/fallback").map((entry, index) => {
    const path = `plan/fallback/${index}`;
    const fallbackRecord = requirePlainRecord(entry, path);
    requireExactKeys(fallbackRecord, ["ancestor", "requiredChildren", "coverage"], path);
    return deepFreeze({
      ancestor: validateAdaptiveBrickKey(fallbackRecord.ancestor),
      requiredChildren: validatePlanKeyArray(fallbackRecord.requiredChildren, `${path}/requiredChildren`),
      coverage: validateQuantumBounds(fallbackRecord.coverage, `${path}/coverage`)
    });
  });
  const coverage = validatePlanCoverage(record.coverage, "plan/coverage");
  const reasons = validatePlanReasons(record.reasons, "plan/reasons");
  const desiredKeys = validatePlanKeyArray(record.desiredKeys, "plan/desiredKeys");
  const keepKeys = validatePlanKeyArray(record.keepKeys, "plan/keepKeys");
  const materializeRequests = validatePlanKeyArray(record.materializeRequests, "plan/materializeRequests");
  const evictCandidates = validatePlanKeyArray(record.evictCandidates, "plan/evictCandidates");
  const parentFallbackKeys = validatePlanKeyArray(record.parentFallbackKeys, "plan/parentFallbackKeys");
  const deterministicReasons = validatePlanReasons(record.deterministicReasons, "plan/deterministicReasons");
  const snapshotProjectionDigest = plannerHash(record.snapshotProjectionDigest, "plan/snapshotProjectionDigest");
  const coverageStatusRecord = requirePlainRecord(record.coverageStatus, "plan/coverageStatus");
  requireExactKeys(coverageStatusRecord, ["coverage", "complete", "uncoveredRequiredKeyCount"], "plan/coverageStatus");
  const statusCoverage = validatePlanCoverage(coverageStatusRecord.coverage, "plan/coverageStatus/coverage");
  if (typeof coverageStatusRecord.complete !== "boolean") {
    return fail("InvalidPlannerInput", "plan/coverageStatus", "Malformed coverage status.");
  }
  const uncoveredRequiredKeyCount = plannerNonNegativeInteger(coverageStatusRecord.uncoveredRequiredKeyCount, "plan/coverageStatus/uncoveredRequiredKeyCount");
  if (typeof record.planHash !== "string" || !hashPattern.test(record.planHash)) {
    return fail("InvalidPlannerInput", "plan/planHash", "Malformed plan hash.");
  }
  const commonPayload = {
    schemaVersion: "adaptive-microvoxel-plan-v1" as const,
    status: record.status,
    desired,
    keep,
    materialize,
    evict,
    fallback,
    coverage,
    reasons,
    desiredKeys,
    keepKeys,
    materializeRequests,
    evictCandidates,
    parentFallbackKeys,
    coverageStatus: deepFreeze({ coverage: statusCoverage, complete: coverageStatusRecord.complete, uncoveredRequiredKeyCount }),
    deterministicReasons,
    snapshotProjectionDigest
  };
  const payload = record.status === "accepted"
    ? commonPayload
    : (() => {
        if (record.code !== "BudgetExceeded" || !["brick-count", "bytes", "work", "coverage"].includes(record.budget as string)) {
          return fail("InvalidPlannerInput", "plan", "Unsupported plan rejection.");
        }
        const required = plannerNonNegativeInteger(record.required, "plan/required");
        const limit = plannerNonNegativeInteger(record.limit, "plan/limit");
        if (required <= limit) {
          return fail("InvalidPlannerInput", "plan", "Budget rejection requires the required amount to exceed its limit.");
        }
        const rejectionReason = `Required ${record.budget as string} budget ${required} exceeds limit ${limit}.`;
        if (
          desired.length !== 0 || keep.length !== 0 || materialize.length !== 0 || evict.length !== 0 || fallback.length !== 0 || coverage.length !== 0 ||
          desiredKeys.length !== 0 || keepKeys.length !== 0 || materializeRequests.length !== 0 || evictCandidates.length !== 0 || parentFallbackKeys.length !== 0 ||
          statusCoverage.length !== 0 || coverageStatusRecord.complete !== false || uncoveredRequiredKeyCount !== 0 ||
          canonicalAdaptiveJson(reasons) !== canonicalAdaptiveJson([rejectionReason]) ||
          canonicalAdaptiveJson(deterministicReasons) !== canonicalAdaptiveJson([rejectionReason])
        ) {
          return fail("InvalidPlannerInput", "plan", "Rejected plans must contain only the canonical empty rejection decision and reason.");
        }
        return { ...commonPayload, status: "rejected" as const, code: "BudgetExceeded" as const, budget: record.budget, required, limit };
      })();
  if (canonicalAdaptiveJson(desired) !== canonicalAdaptiveJson(desiredKeys) || canonicalAdaptiveJson(keep) !== canonicalAdaptiveJson(keepKeys) || canonicalAdaptiveJson(materialize) !== canonicalAdaptiveJson(materializeRequests) || canonicalAdaptiveJson(evict) !== canonicalAdaptiveJson(evictCandidates) || canonicalAdaptiveJson(coverage) !== canonicalAdaptiveJson(statusCoverage) || canonicalAdaptiveJson(reasons) !== canonicalAdaptiveJson(deterministicReasons)) {
    return fail("InvalidPlannerInput", "plan", "Plan aliases must carry identical canonical authority values.");
  }
  if (hashAdaptiveCanonical(payload) !== record.planHash) return fail("InvalidPlannerInput", "plan/planHash", "Plan hash mismatch.");
  return deepFreeze({ ...payload, planHash: record.planHash }) as AdaptivePlanResult;
};

export const serializeAdaptivePlan = (plan: AdaptivePlanResult): string => {
  return canonicalAdaptiveJson(validateAdaptivePlanResult(plan));
};
