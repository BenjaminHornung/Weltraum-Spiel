import { hashAdaptiveCanonical } from "../../voxel/adaptive";

export const SURFACE_RIGID_BODY_RESIDENCY_INDEX_SCHEMA_VERSION =
  "surface-rigid-body-residency-index-v1" as const;
export const SURFACE_RIGID_BODY_RESIDENCY_CURSOR_SCHEMA_VERSION =
  "surface-rigid-body-residency-cursor-v1" as const;

export type SurfaceRigidBodyResidencyTier =
  | "ActiveContact"
  | "SleepingExact"
  | "FarProxy";

export interface SurfaceRigidBodyResidencyFact {
  readonly bodyId: string;
  readonly lifecycle: "Falling" | "Resting";
  readonly distanceSquaredToInterestMeters: number;
  readonly interactionRequested: boolean;
  readonly supportInvalidated: boolean;
}

export interface SurfaceRigidBodyResidencyPolicy {
  readonly activeContactRadiusMeters: number;
  readonly exactSleepingRadiusMeters: number;
}

export interface SurfaceRigidBodyResidencyEntry {
  readonly bodyId: string;
  readonly lifecycle: "Falling" | "Resting";
  readonly tier: SurfaceRigidBodyResidencyTier;
}

export interface SurfaceRigidBodyResidencyIndex {
  readonly schemaVersion: typeof SURFACE_RIGID_BODY_RESIDENCY_INDEX_SCHEMA_VERSION;
  readonly revision: number;
  readonly contentHash: string;
  readonly entries: readonly Readonly<SurfaceRigidBodyResidencyEntry>[];
  readonly activeContactBodyIds: readonly string[];
  readonly sleepingExactBodyIds: readonly string[];
  readonly farProxyBodyIds: readonly string[];
}

export interface SurfaceRigidBodyResidencyCursor {
  readonly schemaVersion: typeof SURFACE_RIGID_BODY_RESIDENCY_CURSOR_SCHEMA_VERSION;
  readonly indexRevision: number;
  readonly indexContentHash: string;
  readonly nextBodyId: string | null;
  readonly completedCycles: number;
}

export type SurfaceRigidBodyResidencyWork =
  | Readonly<{
      readonly status: "Idle";
      readonly cursor: Readonly<SurfaceRigidBodyResidencyCursor>;
    }>
  | Readonly<{
      readonly status: "Scheduled";
      readonly entries: readonly Readonly<SurfaceRigidBodyResidencyEntry>[];
      readonly cursor: Readonly<SurfaceRigidBodyResidencyCursor>;
      readonly remainingInCycle: number;
    }>;

const constructorIssuedIndexes = new WeakSet<Readonly<SurfaceRigidBodyResidencyIndex>>();
const canonicalIndexByExternal = new WeakMap<object, Readonly<SurfaceRigidBodyResidencyIndex>>();
const indexByCursor = new WeakMap<
Readonly<SurfaceRigidBodyResidencyCursor>,
Readonly<SurfaceRigidBodyResidencyIndex>
>();
const consumedCursors = new WeakSet<Readonly<SurfaceRigidBodyResidencyCursor>>();

const stableBodyId = (value: string, path: string): string => {
  if (
    typeof value !== "string"
    || !/^[A-Za-z0-9._:-]{1,128}$/.test(value)
    || value.trim() !== value
  ) {
    throw new TypeError(`${path} must be a stable 1-128 character ASCII identity.`);
  }
  return value;
};

const contentHash = (value: string, path: string): string => {
  if (typeof value !== "string" || !/^fnv1a64-v1:[0-9a-f]{16}$/.test(value)) {
    throw new TypeError(`${path} must use fnv1a64-v1:<16 lowercase hex> format.`);
  }
  return value;
};

const nonNegativeSafeInteger = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${path} must be a non-negative safe integer.`);
  }
  return value;
};

const finiteNonNegative = (value: number, path: string): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${path} must be finite and non-negative.`);
  }
  return Object.is(value, -0) ? 0 : value;
};

const finitePositive = (value: number, path: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${path} must be finite and positive.`);
  }
  return value;
};

const booleanFact = (value: boolean, path: string): boolean => {
  if (typeof value !== "boolean") throw new TypeError(`${path} must be boolean.`);
  return value;
};

const lifecycle = (value: string, path: string): "Falling" | "Resting" => {
  if (value !== "Falling" && value !== "Resting") {
    throw new TypeError(`${path} must be Falling or Resting.`);
  }
  return value;
};

const residencyTier = (value: string, path: string): SurfaceRigidBodyResidencyTier => {
  if (value !== "ActiveContact" && value !== "SleepingExact" && value !== "FarProxy") {
    throw new TypeError(`${path} must be a supported residency tier.`);
  }
  return value;
};

const classify = (
  fact: Readonly<SurfaceRigidBodyResidencyFact>,
  activeContactRadiusSquared: number,
  exactSleepingRadiusSquared: number
): SurfaceRigidBodyResidencyTier => {
  if (fact.interactionRequested || fact.supportInvalidated) return "ActiveContact";
  if (fact.lifecycle === "Falling") {
    return fact.distanceSquaredToInterestMeters <= activeContactRadiusSquared
      ? "ActiveContact"
      : "FarProxy";
  }
  return fact.distanceSquaredToInterestMeters <= exactSleepingRadiusSquared
    ? "SleepingExact"
    : "FarProxy";
};

const createIndexFromEntries = (
  revision: number,
  sourceEntries: readonly Readonly<SurfaceRigidBodyResidencyEntry>[]
): Readonly<SurfaceRigidBodyResidencyIndex> => {
  const entries = Object.freeze([...sourceEntries]);
  const activeContactBodyIds: string[] = [];
  const sleepingExactBodyIds: string[] = [];
  const farProxyBodyIds: string[] = [];
  for (const entry of entries) {
    switch (entry.tier) {
      case "ActiveContact":
        activeContactBodyIds.push(entry.bodyId);
        break;
      case "SleepingExact":
        sleepingExactBodyIds.push(entry.bodyId);
        break;
      case "FarProxy":
        farProxyBodyIds.push(entry.bodyId);
        break;
    }
  }
  const immutableActive = Object.freeze(activeContactBodyIds);
  const immutableSleeping = Object.freeze(sleepingExactBodyIds);
  const immutableFar = Object.freeze(farProxyBodyIds);
  const payload = Object.freeze({
    schemaVersion: SURFACE_RIGID_BODY_RESIDENCY_INDEX_SCHEMA_VERSION,
    revision,
    entries
  });
  const index = Object.freeze({
    schemaVersion: SURFACE_RIGID_BODY_RESIDENCY_INDEX_SCHEMA_VERSION,
    revision,
    contentHash: hashAdaptiveCanonical(payload),
    entries,
    activeContactBodyIds: immutableActive,
    sleepingExactBodyIds: immutableSleeping,
    farProxyBodyIds: immutableFar
  });
  constructorIssuedIndexes.add(index);
  return index;
};

export const createSurfaceRigidBodyResidencyIndex = (
  facts: readonly Readonly<SurfaceRigidBodyResidencyFact>[],
  policy: Readonly<SurfaceRigidBodyResidencyPolicy>
): Readonly<SurfaceRigidBodyResidencyIndex> => {
  if (!Array.isArray(facts)) throw new TypeError("Residency facts must be an array.");
  const activeContactRadiusMeters = finitePositive(
    policy?.activeContactRadiusMeters,
    "residencyPolicy.activeContactRadiusMeters"
  );
  const exactSleepingRadiusMeters = finitePositive(
    policy?.exactSleepingRadiusMeters,
    "residencyPolicy.exactSleepingRadiusMeters"
  );
  if (exactSleepingRadiusMeters < activeContactRadiusMeters) {
    throw new TypeError("Exact sleeping radius must cover the active-contact radius.");
  }
  const activeContactRadiusSquared = activeContactRadiusMeters ** 2;
  const exactSleepingRadiusSquared = exactSleepingRadiusMeters ** 2;
  if (!Number.isFinite(activeContactRadiusSquared) || !Number.isFinite(exactSleepingRadiusSquared)) {
    throw new TypeError("Residency policy radii are too large.");
  }
  const entries = facts.map((fact, index): Readonly<SurfaceRigidBodyResidencyEntry> => {
    const checkedFact = Object.freeze({
      bodyId: stableBodyId(fact?.bodyId, `residencyFacts.${index}.bodyId`),
      lifecycle: lifecycle(fact?.lifecycle, `residencyFacts.${index}.lifecycle`),
      distanceSquaredToInterestMeters: finiteNonNegative(
        fact?.distanceSquaredToInterestMeters,
        `residencyFacts.${index}.distanceSquaredToInterestMeters`
      ),
      interactionRequested: booleanFact(
        fact?.interactionRequested,
        `residencyFacts.${index}.interactionRequested`
      ),
      supportInvalidated: booleanFact(
        fact?.supportInvalidated,
        `residencyFacts.${index}.supportInvalidated`
      )
    });
    return Object.freeze({
      bodyId: checkedFact.bodyId,
      lifecycle: checkedFact.lifecycle,
      tier: classify(checkedFact, activeContactRadiusSquared, exactSleepingRadiusSquared)
    });
  }).sort((left, right) => left.bodyId < right.bodyId ? -1 : left.bodyId > right.bodyId ? 1 : 0);
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index - 1].bodyId === entries[index].bodyId) {
      throw new TypeError(`Duplicate rigid-body residency identity ${entries[index].bodyId}.`);
    }
  }
  return createIndexFromEntries(0, entries);
};

const arraysEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const validateSurfaceRigidBodyResidencyIndex = (
  index: Readonly<SurfaceRigidBodyResidencyIndex>
): Readonly<SurfaceRigidBodyResidencyIndex> => {
  if (constructorIssuedIndexes.has(index)) return index;
  if (index === null || typeof index !== "object" || Array.isArray(index)) {
    throw new TypeError("Residency index must be an object.");
  }
  const cached = canonicalIndexByExternal.get(index);
  if (cached !== undefined) return cached;
  if (index.schemaVersion !== SURFACE_RIGID_BODY_RESIDENCY_INDEX_SCHEMA_VERSION) {
    throw new TypeError("Residency index schema version is unsupported.");
  }
  const revision = nonNegativeSafeInteger(index.revision, "residencyIndex.revision");
  if (!Array.isArray(index.entries)) {
    throw new TypeError("Residency index entries must be an array.");
  }
  const entries = index.entries.map((source, ordinal) => Object.freeze({
    bodyId: stableBodyId(source?.bodyId, `residencyIndex.entries.${ordinal}.bodyId`),
    lifecycle: lifecycle(source?.lifecycle, `residencyIndex.entries.${ordinal}.lifecycle`),
    tier: residencyTier(source?.tier, `residencyIndex.entries.${ordinal}.tier`)
  }));
  for (let ordinal = 1; ordinal < entries.length; ordinal += 1) {
    if (entries[ordinal - 1].bodyId >= entries[ordinal].bodyId) {
      throw new TypeError("Residency index entries must use unique canonical body-ID order.");
    }
  }
  const canonical = createIndexFromEntries(revision, entries);
  for (const [path, source, expected] of [
    ["activeContactBodyIds", index.activeContactBodyIds, canonical.activeContactBodyIds],
    ["sleepingExactBodyIds", index.sleepingExactBodyIds, canonical.sleepingExactBodyIds],
    ["farProxyBodyIds", index.farProxyBodyIds, canonical.farProxyBodyIds]
  ] as const) {
    if (!Array.isArray(source)) {
      throw new TypeError(`Residency index ${path} must be an array.`);
    }
    const checked = source.map((bodyId, ordinal) =>
      stableBodyId(bodyId, `residencyIndex.${path}.${ordinal}`));
    if (!arraysEqual(checked, expected)) {
      throw new TypeError(`Residency index ${path} does not match its canonical entries.`);
    }
  }
  if (canonical.contentHash !== contentHash(index.contentHash, "residencyIndex.contentHash")) {
    throw new TypeError("Residency index content hash mismatch.");
  }
  canonicalIndexByExternal.set(index, canonical);
  return canonical;
};

const createCursor = (
  index: Readonly<SurfaceRigidBodyResidencyIndex>,
  nextBodyId: string | null,
  completedCycles: number
): Readonly<SurfaceRigidBodyResidencyCursor> => {
  const cursor = Object.freeze({
    schemaVersion: SURFACE_RIGID_BODY_RESIDENCY_CURSOR_SCHEMA_VERSION,
    indexRevision: index.revision,
    indexContentHash: index.contentHash,
    nextBodyId,
    completedCycles
  });
  indexByCursor.set(cursor, index);
  return cursor;
};

export const createSurfaceRigidBodyResidencyCursor = (
  index: Readonly<SurfaceRigidBodyResidencyIndex>,
  sourceCompletedCycles = 0
): Readonly<SurfaceRigidBodyResidencyCursor> => {
  const canonical = validateSurfaceRigidBodyResidencyIndex(index);
  const completedCycles = nonNegativeSafeInteger(
    sourceCompletedCycles,
    "completedCycles"
  );
  return createCursor(
    canonical,
    canonical.entries[0]?.bodyId ?? null,
    completedCycles
  );
};

const validateCursor = (
  index: Readonly<SurfaceRigidBodyResidencyIndex>,
  cursor: Readonly<SurfaceRigidBodyResidencyCursor>
): void => {
  if (
    cursor?.schemaVersion !== SURFACE_RIGID_BODY_RESIDENCY_CURSOR_SCHEMA_VERSION
    || cursor.indexRevision !== index.revision
    || cursor.indexContentHash !== index.contentHash
    || indexByCursor.get(cursor) !== index
    || consumedCursors.has(cursor)
  ) {
    throw new TypeError("Residency cursor is unavailable, foreign, stale, or consumed.");
  }
  nonNegativeSafeInteger(cursor.completedCycles, "residencyCursor.completedCycles");
  if (cursor.nextBodyId !== null) {
    stableBodyId(cursor.nextBodyId, "residencyCursor.nextBodyId");
  }
};

const lowerBoundBodyId = (
  entries: readonly Readonly<SurfaceRigidBodyResidencyEntry>[],
  bodyId: string
): number => {
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (entries[middle].bodyId < bodyId) low = middle + 1;
    else high = middle;
  }
  return low;
};

export const selectSurfaceRigidBodyResidencyWork = (
  index: Readonly<SurfaceRigidBodyResidencyIndex>,
  sourceCursor: Readonly<SurfaceRigidBodyResidencyCursor>,
  maximumEntries: number
): SurfaceRigidBodyResidencyWork => {
  const canonical = validateSurfaceRigidBodyResidencyIndex(index);
  if (!Number.isSafeInteger(maximumEntries) || maximumEntries <= 0) {
    throw new TypeError("Residency work batch size must be a positive safe integer.");
  }
  validateCursor(canonical, sourceCursor);
  const entries = canonical.entries;
  if (entries.length === 0) {
    consumedCursors.add(sourceCursor);
    return Object.freeze({
      status: "Idle" as const,
      cursor: createCursor(canonical, null, sourceCursor.completedCycles)
    });
  }
  const startIndex = sourceCursor.nextBodyId === null
    ? 0
    : lowerBoundBodyId(entries, sourceCursor.nextBodyId);
  if (
    startIndex >= entries.length
    || entries[startIndex].bodyId !== sourceCursor.nextBodyId
  ) {
    throw new TypeError("Residency cursor does not identify an entry in its bound index.");
  }
  const count = Math.min(maximumEntries, entries.length - startIndex);
  const endOrdinal = startIndex + count;
  const completesCycle = endOrdinal === entries.length;
  if (completesCycle && sourceCursor.completedCycles === Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Residency cursor completed-cycle count is exhausted.");
  }
  const completedCycles = sourceCursor.completedCycles + (completesCycle ? 1 : 0);
  const nextIndex = endOrdinal % entries.length;
  const selected = Object.freeze(entries.slice(startIndex, endOrdinal));
  consumedCursors.add(sourceCursor);
  return Object.freeze({
    status: "Scheduled" as const,
    entries: selected,
    cursor: createCursor(canonical, entries[nextIndex].bodyId, completedCycles),
    remainingInCycle: entries.length - endOrdinal
  });
};
