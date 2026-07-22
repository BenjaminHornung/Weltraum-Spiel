import {
  hashAdaptiveCanonical,
  serializeAdaptiveKey,
  validateAdaptivePlannerSnapshotSemantics,
  type AdaptiveValidatedRefinementRequest
} from "./canonical";
import {
  ancestorsOf,
  brickExtentQuantumForLevel,
  compareAdaptiveBrickKeys,
  createAdaptiveBrickKey,
  quantumBoundsForKey,
  validateQuantumBounds
} from "./coordinates";
import {
  ADAPTIVE_BRICK_CELL_COUNT,
  ADAPTIVE_PLAN_SCHEMA_VERSION,
  type AdaptiveBrickKey,
  type AdaptiveBudgetKind,
  type AdaptiveCoverage,
  type AdaptiveFallback,
  type AdaptivePlanRejection,
  type AdaptivePlannerSnapshot,
  type AdaptivePlanResult,
  type QuantumBounds
} from "./types";
import { deepFreeze, fail } from "./validation";

export const ADAPTIVE_BRICK_ESTIMATED_BYTES = ADAPTIVE_BRICK_CELL_COUNT * 32;
export const ADAPTIVE_BRICK_ESTIMATED_WORK = ADAPTIVE_BRICK_CELL_COUNT;
export const ADAPTIVE_MAX_DESIRED_BRICKS = 4_096;
export const ADAPTIVE_MAX_PLANNER_ENUMERATION_WORK = 4_096;
export const ADAPTIVE_MAX_PLANNER_TOPOLOGY_WORK = ADAPTIVE_MAX_DESIRED_BRICKS * 16;

const axes = ["x", "y", "z"] as const;
const keyId = (key: AdaptiveBrickKey): string => serializeAdaptiveKey(key);

const safeProduct = (values: readonly number[], path: string): number => {
  let result = 1;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) return fail("InvalidPlannerInput", path, "Planner arithmetic exceeded safe integers.");
    result *= value;
    if (!Number.isSafeInteger(result)) return fail("InvalidPlannerInput", path, "Planner arithmetic exceeded safe integers.");
  }
  return result;
};

const safeSum = (left: number, right: number, path: string): number => {
  const result = left + right;
  if (!Number.isSafeInteger(result)) return fail("InvalidPlannerInput", path, "Planner arithmetic exceeded safe integers.");
  return result;
};

const safeSpan = (min: number, max: number, path: string): number => {
  const result = max - min;
  if (!Number.isSafeInteger(result) || result <= 0) return fail("InvalidPlannerInput", path, "Planner bounds arithmetic exceeded safe integers.");
  return result;
};

const empty = deepFreeze([]) as readonly [];

const rejectBudget = (budget: AdaptiveBudgetKind, required: number, limit: number, snapshotProjectionDigest: string): AdaptivePlanRejection => {
  const payload = {
    schemaVersion: ADAPTIVE_PLAN_SCHEMA_VERSION,
    status: "rejected" as const,
    code: "BudgetExceeded" as const,
    budget,
    required,
    limit,
    desired: empty,
    keep: empty,
    materialize: empty,
    evict: empty,
    fallback: empty,
    coverage: empty,
    reasons: deepFreeze([`Required ${budget} budget ${required} exceeds limit ${limit}.`]),
    desiredKeys: empty,
    keepKeys: empty,
    materializeRequests: empty,
    evictCandidates: empty,
    parentFallbackKeys: empty,
    coverageStatus: deepFreeze({ coverage: empty, complete: false as const, uncoveredRequiredKeyCount: 0 as const }),
    deterministicReasons: deepFreeze([`Required ${budget} budget ${required} exceeds limit ${limit}.`]),
    snapshotProjectionDigest
  };
  return deepFreeze({ ...payload, planHash: hashAdaptiveCanonical(payload) });
};

const intersection = (left: QuantumBounds, right: QuantumBounds): QuantumBounds | null => {
  const min = { x: Math.max(left.min.x, right.min.x), y: Math.max(left.min.y, right.min.y), z: Math.max(left.min.z, right.min.z) };
  const max = { x: Math.min(left.max.x, right.max.x), y: Math.min(left.max.y, right.max.y), z: Math.min(left.max.z, right.max.z) };
  return min.x < max.x && min.y < max.y && min.z < max.z ? validateQuantumBounds({ min, max }) : null;
};

const containsBounds = (container: QuantumBounds, contained: QuantumBounds): boolean =>
  axes.every((axis) => container.min[axis] <= contained.min[axis] && container.max[axis] >= contained.max[axis]);

const boundsVolume = (bounds: QuantumBounds, path: string): number =>
  safeProduct(axes.map((axis) => safeSpan(bounds.min[axis], bounds.max[axis], `${path}/${axis}`)), path);

const subtractBounds = (source: QuantumBounds, blocker: QuantumBounds): readonly QuantumBounds[] => {
  const overlap = intersection(source, blocker);
  if (overlap === null) return [source];
  const pieces: QuantumBounds[] = [];
  const add = (min: { x: number; y: number; z: number }, max: { x: number; y: number; z: number }) => {
    if (min.x < max.x && min.y < max.y && min.z < max.z) pieces.push(validateQuantumBounds({ min, max }));
  };
  add(source.min, { x: overlap.min.x, y: source.max.y, z: source.max.z });
  add({ x: overlap.max.x, y: source.min.y, z: source.min.z }, source.max);
  add({ x: overlap.min.x, y: source.min.y, z: source.min.z }, { x: overlap.max.x, y: overlap.min.y, z: source.max.z });
  add({ x: overlap.min.x, y: overlap.max.y, z: source.min.z }, { x: overlap.max.x, y: source.max.y, z: source.max.z });
  add({ x: overlap.min.x, y: overlap.min.y, z: source.min.z }, { x: overlap.max.x, y: overlap.max.y, z: overlap.min.z });
  add({ x: overlap.min.x, y: overlap.min.y, z: overlap.max.z }, { x: overlap.max.x, y: overlap.max.y, z: source.max.z });
  return pieces;
};

const compareBounds = (left: QuantumBounds, right: QuantumBounds): number => {
  for (const edge of ["min", "max"] as const) for (const axis of axes) {
    const difference = left[edge][axis] - right[edge][axis];
    if (difference !== 0) return difference;
  }
  return 0;
};

const mergeBounds = (left: QuantumBounds, right: QuantumBounds): QuantumBounds | null => {
  for (const axis of axes) {
    const otherAxes = axes.filter((candidate) => candidate !== axis);
    if (!otherAxes.every((candidate) => left.min[candidate] === right.min[candidate] && left.max[candidate] === right.max[candidate])) continue;
    if (left.max[axis] !== right.min[axis] && right.max[axis] !== left.min[axis]) continue;
    return validateQuantumBounds({
      min: { x: Math.min(left.min.x, right.min.x), y: Math.min(left.min.y, right.min.y), z: Math.min(left.min.z, right.min.z) },
      max: { x: Math.max(left.max.x, right.max.x), y: Math.max(left.max.y, right.max.y), z: Math.max(left.max.z, right.max.z) }
    });
  }
  return null;
};

interface DesiredCandidate {
  readonly key: AdaptiveBrickKey;
  readonly priority: number;
  readonly requestId: string;
  readonly requiredForCoverage: boolean;
}

const compareDesired = (left: DesiredCandidate, right: DesiredCandidate): number =>
  right.priority - left.priority || (left.requestId < right.requestId ? -1 : left.requestId > right.requestId ? 1 : compareAdaptiveBrickKeys(left.key, right.key));

const buildDesired = (validated: readonly AdaptiveValidatedRefinementRequest[], snapshot: AdaptivePlannerSnapshot): readonly DesiredCandidate[] | null => {
  const candidates = new Map<string, DesiredCandidate>();
  const orderedRequests = [...validated].sort((left, right) =>
    right.request.priority - left.request.priority || (left.request.requestId < right.request.requestId ? -1 : left.request.requestId > right.request.requestId ? 1 : 0)
  );
  for (const { request, bounds } of orderedRequests) {
    const extent = brickExtentQuantumForLevel(request.targetLevel);
    for (let z: number = bounds.min.z; z < bounds.max.z; z += extent) for (let y: number = bounds.min.y; y < bounds.max.y; y += extent) for (let x: number = bounds.min.x; x < bounds.max.x; x += extent) {
      const key = createAdaptiveBrickKey({ bodyId: snapshot.bodyId, surfaceFrameId: snapshot.surfaceFrameId, regionId: snapshot.regionId, generatorVersion: snapshot.generatorVersion, level: request.targetLevel, originQuantum: { x, y, z } });
      const id = keyId(key);
      const existing = candidates.get(id);
      if (existing === undefined) {
        candidates.set(id, { key, priority: request.priority, requestId: request.requestId, requiredForCoverage: request.requiredForCoverage });
        if (candidates.size > ADAPTIVE_MAX_DESIRED_BRICKS) return null;
      } else if (request.requiredForCoverage && !existing.requiredForCoverage) {
        candidates.set(id, { ...existing, requiredForCoverage: true });
      }
    }
  }
  return deepFreeze([...candidates.values()].sort(compareDesired));
};

interface CoverageRegion {
  readonly bounds: QuantumBounds;
  readonly key: AdaptiveBrickKey;
  readonly kind: "selected" | "fallback";
}

const mergeCoverageRegions = (input: readonly CoverageRegion[]): readonly CoverageRegion[] => {
  const regions = [...input];
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let leftIndex = 0; leftIndex < regions.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < regions.length; rightIndex += 1) {
      const left = regions[leftIndex];
      const right = regions[rightIndex];
      if (left.kind !== right.kind || keyId(left.key) !== keyId(right.key)) continue;
      const merged = mergeBounds(left.bounds, right.bounds);
      if (merged === null) continue;
      regions.splice(rightIndex, 1);
      regions.splice(leftIndex, 1, { bounds: merged, key: left.key, kind: left.kind });
      changed = true;
      break outer;
    }
  }
  return regions.sort((left, right) => compareBounds(left.bounds, right.bounds) || compareAdaptiveBrickKeys(left.key, right.key) || (left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0));
};

const uniqueCoverageVolume = (desired: readonly DesiredCandidate[]): number => {
  const accepted = new Set<string>();
  let volume = 0;
  for (const candidate of [...desired].sort((left, right) => left.key.level - right.key.level || compareAdaptiveBrickKeys(left.key, right.key))) {
    if (ancestorsOf(candidate.key).some((ancestor) => accepted.has(keyId(ancestor)))) continue;
    accepted.add(keyId(candidate.key));
    volume = safeSum(volume, boundsVolume(quantumBoundsForKey(candidate.key), "budgets/maxCoverageQuantum"), "budgets/maxCoverageQuantum");
  }
  return volume;
};

const cappedAggregateWork = (counts: readonly number[], limit: number): number => {
  let result = 0;
  for (const count of counts) {
    if (count > limit - result) return limit + 1;
    result += count;
  }
  return result;
};

export interface PlanAdaptiveMicrovoxelsInput { readonly snapshot: AdaptivePlannerSnapshot; }

export const planAdaptiveMicrovoxels = ({ snapshot }: PlanAdaptiveMicrovoxelsInput): AdaptivePlanResult => {
  const { projection, snapshotProjectionDigest, refinementRequests: validatedRequests, budgets: budgetValues } =
    validateAdaptivePlannerSnapshotSemantics(snapshot);
  const resident = new Map(
    projection.resident.map((entry) => [keyId(entry.key), { key: entry.key, ready: entry.readiness === "ready" }] as const)
  );

  const enumerationWork = cappedAggregateWork(validatedRequests.map((entry) => entry.count), ADAPTIVE_MAX_PLANNER_ENUMERATION_WORK);
  if (enumerationWork > ADAPTIVE_MAX_PLANNER_ENUMERATION_WORK) {
    return rejectBudget("work", enumerationWork, ADAPTIVE_MAX_PLANNER_ENUMERATION_WORK, snapshotProjectionDigest);
  }
  const desiredCandidates = buildDesired(validatedRequests, snapshot);
  if (desiredCandidates === null) return rejectBudget("brick-count", ADAPTIVE_MAX_DESIRED_BRICKS + 1, ADAPTIVE_MAX_DESIRED_BRICKS, snapshotProjectionDigest);
  const desired = deepFreeze(desiredCandidates.map((entry) => entry.key));
  const requiredBricks = desired.length;
  if (requiredBricks > budgetValues.maxBricks) return rejectBudget("brick-count", requiredBricks, budgetValues.maxBricks, snapshotProjectionDigest);
  const requiredBytes = safeProduct([requiredBricks, ADAPTIVE_BRICK_ESTIMATED_BYTES], "budgets/maxBytes");
  if (requiredBytes > budgetValues.maxBytes) return rejectBudget("bytes", requiredBytes, budgetValues.maxBytes, snapshotProjectionDigest);
  const requiredWork = safeProduct([requiredBricks, ADAPTIVE_BRICK_ESTIMATED_WORK], "budgets/maxWork");
  if (requiredWork > budgetValues.maxWork) return rejectBudget("work", requiredWork, budgetValues.maxWork, snapshotProjectionDigest);
  const coverageVolume = uniqueCoverageVolume(desiredCandidates);
  if (coverageVolume > budgetValues.maxCoverageQuantum) return rejectBudget("coverage", coverageVolume, budgetValues.maxCoverageQuantum, snapshotProjectionDigest);

  const readyIds = new Set([...resident].filter(([, value]) => value.ready).map(([id]) => id));
  const authorityByTarget = new Map<string, { readonly authority: AdaptiveBrickKey; readonly kind: "selected" | "fallback" }>();
  for (const candidate of desiredCandidates) {
    const id = keyId(candidate.key);
    if (readyIds.has(id)) authorityByTarget.set(id, { authority: candidate.key, kind: "selected" });
    else {
      const ancestor = ancestorsOf(candidate.key).find((entry) => readyIds.has(keyId(entry)));
      if (ancestor !== undefined) authorityByTarget.set(id, { authority: ancestor, kind: "fallback" });
    }
  }

  const requiredFallbackAncestors = new Map<string, AdaptiveBrickKey>();
  for (const candidate of desiredCandidates) {
    if (!candidate.requiredForCoverage) continue;
    const assignment = authorityByTarget.get(keyId(candidate.key));
    if (assignment?.kind === "fallback") requiredFallbackAncestors.set(keyId(assignment.authority), assignment.authority);
  }
  const assignedCount = authorityByTarget.size;
  const topologyWork = safeSum(
    safeProduct([assignedCount, assignedCount], "planner/topologyWork"),
    safeProduct([requiredFallbackAncestors.size, requiredFallbackAncestors.size], "planner/topologyWork"),
    "planner/topologyWork"
  );
  if (topologyWork > ADAPTIVE_MAX_PLANNER_TOPOLOGY_WORK) {
    return rejectBudget("work", topologyWork, ADAPTIVE_MAX_PLANNER_TOPOLOGY_WORK, snapshotProjectionDigest);
  }
  const atomicFallbackAncestors: AdaptiveBrickKey[] = [];
  for (const ancestor of [...requiredFallbackAncestors.values()].sort((left, right) => left.level - right.level || compareAdaptiveBrickKeys(left, right))) {
    const bounds = quantumBoundsForKey(ancestor);
    if (!atomicFallbackAncestors.some((retained) => containsBounds(quantumBoundsForKey(retained), bounds))) atomicFallbackAncestors.push(ancestor);
  }
  for (const candidate of desiredCandidates) {
    const targetBounds = quantumBoundsForKey(candidate.key);
    const atomicAncestor = atomicFallbackAncestors.find((ancestor) => containsBounds(quantumBoundsForKey(ancestor), targetBounds));
    if (atomicAncestor !== undefined) authorityByTarget.set(keyId(candidate.key), { authority: atomicAncestor, kind: "fallback" });
  }

  const orderedAssignments = desiredCandidates
    .filter((candidate) => authorityByTarget.has(keyId(candidate.key)))
    .sort((left, right) => Number(right.requiredForCoverage) - Number(left.requiredForCoverage) || right.key.level - left.key.level || compareAdaptiveBrickKeys(left.key, right.key));
  const partition: CoverageRegion[] = [];
  for (const candidate of orderedAssignments) {
    const assignment = authorityByTarget.get(keyId(candidate.key));
    if (assignment === undefined) continue;
    let fragments: readonly QuantumBounds[] = [quantumBoundsForKey(candidate.key)];
    for (const accepted of partition) fragments = fragments.flatMap((fragment) => subtractBounds(fragment, accepted.bounds));
    for (const bounds of fragments) partition.push({ bounds, key: assignment.authority, kind: assignment.kind });
  }
  const regions = mergeCoverageRegions(partition);
  const coverage = deepFreeze(regions.map((entry) => deepFreeze({ bounds: entry.bounds, key: entry.key, kind: entry.kind } satisfies AdaptiveCoverage)));

  const fallback = deepFreeze(regions.filter((entry) => entry.kind === "fallback").map((entry) => {
    const requiredChildren = deepFreeze(desiredCandidates
      .filter((candidate) => {
        const assignment = authorityByTarget.get(keyId(candidate.key));
        return assignment?.kind === "fallback" && keyId(assignment.authority) === keyId(entry.key) && intersection(quantumBoundsForKey(candidate.key), entry.bounds) !== null;
      })
      .map((candidate) => candidate.key)
      .sort(compareAdaptiveBrickKeys));
    return deepFreeze({ ancestor: entry.key, requiredChildren, coverage: entry.bounds } satisfies AdaptiveFallback);
  }));

  const fallbackAuthorities = new Map<string, AdaptiveBrickKey>();
  for (const entry of fallback) fallbackAuthorities.set(keyId(entry.ancestor), entry.ancestor);
  const keep = deepFreeze([
    ...desired.filter((key) => readyIds.has(keyId(key))),
    ...fallbackAuthorities.values()
  ].sort(compareAdaptiveBrickKeys));
  const keepIds = new Set(keep.map(keyId));
  const materialize = deepFreeze(desiredCandidates.filter((candidate) => !readyIds.has(keyId(candidate.key))).map((candidate) => candidate.key));
  const evict = deepFreeze([...resident.values()].filter((entry) => !keepIds.has(keyId(entry.key))).map((entry) => entry.key).sort(compareAdaptiveBrickKeys));
  const uncovered = desiredCandidates.filter((candidate) => candidate.requiredForCoverage && !authorityByTarget.has(keyId(candidate.key))).length;
  const deterministicReasons = deepFreeze([
    `Requested ${desired.length} unique target bricks across ${validatedRequests.length} refinement requests.`,
    `${fallback.length} validated parent fallback regions remain active.`,
    `${uncovered} required target bricks have no validated fallback.`
  ]);
  const parentFallbackKeys = deepFreeze([...fallbackAuthorities.values()].sort(compareAdaptiveBrickKeys));
  const coverageStatus = deepFreeze({ coverage, complete: uncovered === 0, uncoveredRequiredKeyCount: uncovered });
  const payload = {
    schemaVersion: ADAPTIVE_PLAN_SCHEMA_VERSION,
    status: "accepted" as const,
    desired,
    keep,
    materialize,
    evict,
    fallback,
    coverage,
    reasons: deterministicReasons,
    desiredKeys: desired,
    keepKeys: keep,
    materializeRequests: materialize,
    evictCandidates: evict,
    parentFallbackKeys,
    coverageStatus,
    deterministicReasons,
    snapshotProjectionDigest
  };
  return deepFreeze({ ...payload, planHash: hashAdaptiveCanonical(payload) });
};
