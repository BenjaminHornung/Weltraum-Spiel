import { hashAdaptiveCanonical } from "../../voxel/adaptive";
import {
  createSurfaceRigidBodyAabb,
  type SurfaceRigidBodyAabb
} from "./surfaceRigidBodyRegistry";
import type { SurfaceRigidBodyResidencyTier } from "./surfaceRigidBodyResidencyIndex";
import type { SurfaceRigidBodySpatialProxy } from "./surfaceRigidBodySpatialIndex";

export const SURFACE_RIGID_BODY_ISLAND_PLANNING_SCHEMA_VERSION =
  "surface-rigid-body-island-planning-v1" as const;
export const SURFACE_RIGID_BODY_ISLAND_PLAN_SCHEMA_VERSION =
  "surface-rigid-body-island-plan-v2" as const;
export const SURFACE_RIGID_BODY_ISLAND_RESULT_SCHEMA_VERSION =
  "surface-rigid-body-island-result-v2" as const;
export const SURFACE_RIGID_BODY_ISLAND_COMPLETION_SCHEMA_VERSION =
  "surface-rigid-body-island-completion-v2" as const;

export interface SurfaceRigidBodyIslandVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SurfaceRigidBodyIslandPlanningContext {
  readonly planningTick: number;
  readonly fixedDeltaSeconds: number;
  readonly gravityMetersPerSecondSquared: Readonly<SurfaceRigidBodyIslandVector>;
}

export interface SurfaceRigidBodyIslandBodyInput {
  readonly proxy: Readonly<SurfaceRigidBodySpatialProxy>;
  readonly tier: SurfaceRigidBodyResidencyTier;
  readonly lifecycle: "Falling" | "Resting";
  readonly residencyProvenanceHash: string;
  readonly linearVelocityMetersPerSecond: Readonly<SurfaceRigidBodyIslandVector>;
  readonly angularVelocityRadiansPerSecond: Readonly<SurfaceRigidBodyIslandVector>;
  readonly rotationPivotWorldMeters: Readonly<SurfaceRigidBodyIslandVector>;
  readonly accumulatedSimulationSeconds: number;
  readonly wakeRequested: boolean;
}

export interface SurfaceRigidBodyIslandSourceBodyFact {
  readonly bodyId: string;
  readonly recordHash: string;
  readonly aabb: Readonly<SurfaceRigidBodyAabb>;
  readonly tier: SurfaceRigidBodyResidencyTier;
  readonly lifecycle: "Falling" | "Resting";
  readonly residencyProvenanceHash: string;
  readonly linearVelocityMetersPerSecond: Readonly<SurfaceRigidBodyIslandVector>;
  readonly angularVelocityRadiansPerSecond: Readonly<SurfaceRigidBodyIslandVector>;
  readonly rotationPivotWorldMeters: Readonly<SurfaceRigidBodyIslandVector>;
  readonly accumulatedSimulationSeconds: number;
  readonly pendingSimulationSeconds: number;
  readonly wakeRequested: boolean;
  readonly dynamic: boolean;
  readonly angularSweepExpansionMeters: number;
  readonly sweptAabb: Readonly<SurfaceRigidBodyAabb>;
  readonly requiredSubstepCount: number;
}

export interface SurfaceRigidBodyIslandPlanningSession {
  readonly schemaVersion: typeof SURFACE_RIGID_BODY_ISLAND_PLANNING_SCHEMA_VERSION;
  readonly context: Readonly<SurfaceRigidBodyIslandPlanningContext>;
  readonly logicalBodyCount: number;
  readonly sourceContentHash: string;
  readonly contentHash: string;
}

export interface SurfaceRigidBodyIslandPlanningCursor {
  readonly sessionContentHash: string;
  readonly nextLeftOrdinal: number;
  readonly nextRightOrdinal: number;
  readonly sequence: number;
}

export interface SurfaceRigidBodyIslandPlanningBudget {
  readonly maximumPairTests: number;
}

export interface SurfaceRigidBodyIslandPlanningWork {
  readonly fromLeftOrdinal: number;
  readonly fromRightOrdinal: number;
  readonly toLeftOrdinal: number;
  readonly toRightOrdinal: number;
  readonly broadphasePairTestCount: number;
  readonly potentialContactCount: number;
}

export interface SurfaceRigidBodyIslandContactPair {
  readonly bodyIdA: string;
  readonly bodyIdB: string;
}

export interface SurfaceRigidBodyIslandSimulationFact {
  readonly bodyId: string;
  readonly pendingSimulationSeconds: number;
  readonly requiredSubstepCount: number;
}

export interface SurfaceRigidBodyContactIsland {
  readonly rootBodyId: string;
  readonly bodyIds: readonly string[];
  readonly sweepBodyIds: readonly string[];
  readonly dynamicBodyIds: readonly string[];
  readonly staticBodyIds: readonly string[];
  readonly simulation: readonly Readonly<SurfaceRigidBodyIslandSimulationFact>[];
  readonly requiredSubstepCount: number;
  readonly contentHash: string;
}

export interface SurfaceRigidBodyRefinementRequirement {
  readonly bodyId: string;
  readonly recordHash: string;
  readonly residencyProvenanceHash: string;
  readonly accumulatedSimulationSeconds: number;
  readonly targetSimulationSeconds: number;
  readonly overlappingBodyCount: number;
  readonly firstOverlappingBodyId: string | null;
  readonly overlapDigest: string;
  readonly reason: "WakeRequested" | "PredictiveContact";
}

export interface SurfaceRigidBodyDeferredFarProxy {
  readonly bodyId: string;
  readonly recordHash: string;
  readonly residencyProvenanceHash: string;
  readonly accumulatedSimulationSeconds: number;
  readonly targetSimulationSeconds: number;
}

export interface SurfaceRigidBodyIslandPlan {
  readonly schemaVersion: typeof SURFACE_RIGID_BODY_ISLAND_PLAN_SCHEMA_VERSION;
  readonly context: Readonly<SurfaceRigidBodyIslandPlanningContext>;
  readonly logicalBodyCount: number;
  readonly sourceBodies: readonly Readonly<SurfaceRigidBodyIslandSourceBodyFact>[];
  readonly planningCounters: Readonly<{
    readonly broadphasePairTestCount: number;
    readonly potentialContactCount: number;
  }>;
  readonly islands: readonly Readonly<SurfaceRigidBodyContactIsland>[];
  readonly sleepingOnlyBodyIds: readonly string[];
  readonly refinementRequired: readonly Readonly<SurfaceRigidBodyRefinementRequirement>[];
  readonly deferredFarProxies: readonly Readonly<SurfaceRigidBodyDeferredFarProxy>[];
  readonly contentHash: string;
}

export type SurfaceRigidBodyIslandPlanningResult =
  | Readonly<{
      readonly status: "Continued";
      readonly cursor: Readonly<SurfaceRigidBodyIslandPlanningCursor>;
      readonly work: Readonly<SurfaceRigidBodyIslandPlanningWork>;
    }>
  | Readonly<{
      readonly status: "Complete";
      readonly cursor: Readonly<SurfaceRigidBodyIslandPlanningCursor>;
      readonly work: Readonly<SurfaceRigidBodyIslandPlanningWork>;
      readonly plan: Readonly<SurfaceRigidBodyIslandPlan>;
    }>;

export type SurfaceRigidBodyIslandWorkPhase =
  | "IntegrateBodies"
  | "EvaluateContacts"
  | "CommitSubstep"
  | "Complete";

export interface SurfaceRigidBodyIslandCursorSeed {
  readonly sequence?: number;
  readonly completedRotations?: number;
}

export interface SurfaceRigidBodyIslandCursor {
  readonly planContentHash: string;
  readonly nextIslandRootBodyId: string | null;
  readonly completedRotations: number;
  readonly sequence: number;
}

export interface SurfaceRigidBodyIslandWorkBudget {
  readonly maximumBodySteps: number;
  readonly maximumPairTests: number;
  readonly maximumContactPairs: number;
  readonly maximumSubsteps: number;
}

export type SurfaceRigidBodyIslandWorkUnit =
  | Readonly<{
      readonly kind: "IntegrateBodies";
      readonly substepIndex: number;
      readonly examinedBodyCount: number;
      readonly bodyIds: readonly string[];
    }>
  | Readonly<{
      readonly kind: "EvaluateContacts";
      readonly substepIndex: number;
      readonly testedPairCount: number;
      readonly contactPairs: readonly Readonly<SurfaceRigidBodyIslandContactPair>[];
    }>
  | Readonly<{
      readonly kind: "CommitSubstep";
      readonly substepIndex: number;
    }>;

export interface SurfaceRigidBodyIslandWorkSlice {
  readonly workId: string;
  readonly planContentHash: string;
  readonly rootBodyId: string;
  readonly predecessorStateHash: string;
  readonly units: readonly SurfaceRigidBodyIslandWorkUnit[];
  readonly bodyStepCount: number;
  readonly broadphasePairTestCount: number;
  readonly contactPairCount: number;
  readonly completedSubstepCount: number;
  readonly contentHash: string;
}

export type SurfaceRigidBodyIslandWorkSelection =
  | Readonly<{ readonly status: "Complete"; readonly cursor: Readonly<SurfaceRigidBodyIslandCursor> }>
  | Readonly<{
      readonly status: "AwaitingReceipt";
      readonly cursor: Readonly<SurfaceRigidBodyIslandCursor>;
      readonly pendingWork: readonly Readonly<SurfaceRigidBodyIslandWorkSlice>[];
      readonly remainingIslandCount: number;
    }>
  | Readonly<{
      readonly status: "Scheduled";
      readonly work: Readonly<SurfaceRigidBodyIslandWorkSlice>;
      readonly cursor: Readonly<SurfaceRigidBodyIslandCursor>;
      readonly remainingIslandCount: number;
    }>;

export interface SurfaceRigidBodyIslandWorkReceipt {
  readonly workId: string;
  readonly planContentHash: string;
  readonly rootBodyId: string;
  readonly workContentHash: string;
  readonly predecessorStateHash: string;
  readonly resultStateArtifactHash: string;
  readonly resultStateHash: string;
  readonly resultHash: string;
}

export interface SurfaceRigidBodyIslandTerminalStateHash {
  readonly rootBodyId: string;
  readonly stateHash: string;
}

export interface SurfaceRigidBodyIslandCompletionSnapshot {
  readonly schemaVersion: typeof SURFACE_RIGID_BODY_ISLAND_COMPLETION_SCHEMA_VERSION;
  readonly planContentHash: string;
  readonly receipts: readonly Readonly<SurfaceRigidBodyIslandWorkReceipt>[];
  readonly terminalIslandStateHashes: readonly Readonly<SurfaceRigidBodyIslandTerminalStateHash>[];
  readonly preparedPhysicsStateHash: string;
  readonly contentHash: string;
}

export type SurfaceRigidBodyIslandReceiptDecision = Readonly<{
  readonly state: "Committed" | "AlreadyCommitted";
  readonly workId: string;
  readonly rootBodyId: string;
  readonly resultStateHash: string;
}>;

export type SurfaceRigidBodyIslandAdoptionDecision = Readonly<{
  readonly state: "Adopted" | "AlreadyAdopted";
  readonly planContentHash: string;
  readonly completionContentHash: string;
}>;

interface PairPosition { leftOrdinal: number; rightOrdinal: number }
interface PairProbe {
  readonly bodyA: Readonly<SurfaceRigidBodyIslandSourceBodyFact>;
  readonly bodyB: Readonly<SurfaceRigidBodyIslandSourceBodyFact>;
  readonly potential: boolean;
}
interface FarOverlapAccumulator { count: number; firstBodyId: string | null; digest: string }
interface PlanningState {
  readonly sourceBodies: readonly Readonly<SurfaceRigidBodyIslandSourceBodyFact>[];
  readonly sourceBodyById: ReadonlyMap<string, Readonly<SurfaceRigidBodyIslandSourceBodyFact>>;
  readonly sweepBodies: readonly Readonly<SurfaceRigidBodyIslandSourceBodyFact>[];
  readonly unionFind: CanonicalUnionFind;
  readonly farOverlapByBodyId: Map<string, FarOverlapAccumulator>;
  activeCursor: Readonly<SurfaceRigidBodyIslandPlanningCursor> | null;
  completedPlan: Readonly<SurfaceRigidBodyIslandPlan> | null;
  broadphasePairTestCount: number;
  potentialContactCount: number;
}
interface PlanningCursorState { consumed: boolean }
interface MutableIslandProgress {
  rootBodyId: string;
  substepIndex: number;
  phase: SurfaceRigidBodyIslandWorkPhase;
  nextBodyOrdinal: number;
  nextPairLeftOrdinal: number;
  nextPairRightOrdinal: number;
}
interface WorkCursorState { consumed: boolean }
interface IssuedWorkFact {
  readonly workId: string;
  readonly contentHash: string;
  readonly planContentHash: string;
  readonly rootBodyId: string;
  readonly predecessorStateHash: string;
  readonly bodyStepCount: number;
  readonly broadphasePairTestCount: number;
  readonly contactPairCount: number;
  readonly completedSubstepCount: number;
}
interface PendingWorkFact {
  readonly fact: Readonly<IssuedWorkFact>;
  readonly work: Readonly<SurfaceRigidBodyIslandWorkSlice>;
  readonly islandIndex: number;
  readonly resultingProgress: Readonly<MutableIslandProgress>;
}
interface PlanExecutionState {
  readonly sweepFactsByRoot: ReadonlyMap<string, readonly Readonly<SurfaceRigidBodyIslandSourceBodyFact>[]>;
  readonly dynamicSubstepsByRoot: ReadonlyMap<string, ReadonlyMap<string, number>>;
  readonly committedProgress: MutableIslandProgress[];
  readonly committedStateHashByRoot: Map<string, string>;
  readonly pendingWorkByRoot: Map<string, Readonly<PendingWorkFact>>;
  readonly issuedWork: Map<string, Readonly<IssuedWorkFact>>;
  readonly committedReceipts: Map<string, Readonly<SurfaceRigidBodyIslandWorkReceipt>>;
  activeCursor: Readonly<SurfaceRigidBodyIslandCursor> | null;
  schedulingComplete: boolean;
  remainingIslandCount: number;
  completionSnapshot: Readonly<SurfaceRigidBodyIslandCompletionSnapshot> | null;
  adoptedCompletionHash: string | null;
}

const HASH_PATTERN = /^fnv1a64-v1:[0-9a-f]{16}$/;
const BODY_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const planningStateBySession = new WeakMap<Readonly<SurfaceRigidBodyIslandPlanningSession>, PlanningState>();
const planningCursorState = new WeakMap<Readonly<SurfaceRigidBodyIslandPlanningCursor>, PlanningCursorState>();
const executionStateByPlan = new WeakMap<Readonly<SurfaceRigidBodyIslandPlan>, PlanExecutionState>();
const workCursorState = new WeakMap<Readonly<SurfaceRigidBodyIslandCursor>, WorkCursorState>();
const constructorIssuedCompletionSnapshots = new WeakSet<Readonly<SurfaceRigidBodyIslandCompletionSnapshot>>();

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const stableBodyId = (value: string, path: string): string => {
  if (typeof value !== "string" || !BODY_ID_PATTERN.test(value) || value.trim() !== value) {
    throw new TypeError(`${path} must be a stable ASCII identity.`);
  }
  return value;
};
const checkedHash = (value: string, path: string): string => {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new TypeError(`${path} must use fnv1a64-v1 format.`);
  }
  return value;
};
const finite = (value: number, path: string): number => {
  if (!Number.isFinite(value)) throw new TypeError(`${path} must be finite.`);
  return Object.is(value, -0) ? 0 : value;
};
const finitePositive = (value: number, path: string): number => {
  const checked = finite(value, path);
  if (checked <= 0) throw new TypeError(`${path} must be positive.`);
  return checked;
};
const finiteNonNegative = (value: number, path: string): number => {
  const checked = finite(value, path);
  if (checked < 0) throw new TypeError(`${path} must be non-negative.`);
  return checked;
};
const nonNegativeSafeInteger = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${path} must be a non-negative safe integer.`);
  return value;
};
const positiveSafeInteger = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${path} must be a positive safe integer.`);
  return value;
};
const incrementSafeInteger = (value: number, path: string): number => {
  if (value >= Number.MAX_SAFE_INTEGER) throw new RangeError(`${path} is exhausted.`);
  return value + 1;
};
const checkedVector = (source: Readonly<SurfaceRigidBodyIslandVector>, path: string): Readonly<SurfaceRigidBodyIslandVector> => Object.freeze({
  x: finite(source?.x, `${path}.x`),
  y: finite(source?.y, `${path}.y`),
  z: finite(source?.z, `${path}.z`)
});
const checkedContext = (source: Readonly<SurfaceRigidBodyIslandPlanningContext>): Readonly<SurfaceRigidBodyIslandPlanningContext> => Object.freeze({
  planningTick: nonNegativeSafeInteger(source?.planningTick, "planningTick"),
  fixedDeltaSeconds: finitePositive(source?.fixedDeltaSeconds, "fixedDeltaSeconds"),
  gravityMetersPerSecondSquared: checkedVector(source?.gravityMetersPerSecondSquared, "gravityMetersPerSecondSquared")
});

const requiredSubsteps = (pendingSeconds: number, fixedDeltaSeconds: number): number => {
  const count = Math.ceil(pendingSeconds / fixedDeltaSeconds);
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError("Pending simulation time exceeds safe continuation range.");
  }
  return count;
};

const axisDisplacementBounds = (
  velocity: number,
  acceleration: number,
  seconds: number
): Readonly<{ readonly minimum: number; readonly maximum: number }> => {
  const end = finite(
    velocity * seconds + 0.5 * acceleration * seconds * seconds,
    "predicted displacement"
  );
  let minimum = Math.min(0, end);
  let maximum = Math.max(0, end);
  if (acceleration !== 0) {
    const criticalTime = -velocity / acceleration;
    if (criticalTime > 0 && criticalTime < seconds) {
      const critical = finite(
        velocity * criticalTime + 0.5 * acceleration * criticalTime * criticalTime,
        "critical predicted displacement"
      );
      minimum = Math.min(minimum, critical);
      maximum = Math.max(maximum, critical);
    }
  }
  return Object.freeze({ minimum, maximum });
};

const maximumCornerRadius = (
  aabb: Readonly<SurfaceRigidBodyAabb>,
  pivot: Readonly<SurfaceRigidBodyIslandVector>
): number => {
  let maximum = 0;
  for (const x of [aabb.minimumX, aabb.maximumX]) {
    for (const y of [aabb.minimumY, aabb.maximumY]) {
      for (const z of [aabb.minimumZ, aabb.maximumZ]) {
        maximum = Math.max(maximum, Math.hypot(x - pivot.x, y - pivot.y, z - pivot.z));
      }
    }
  }
  return finiteNonNegative(maximum, "maximum rotation radius");
};

const angularExpansion = (
  aabb: Readonly<SurfaceRigidBodyAabb>,
  pivot: Readonly<SurfaceRigidBodyIslandVector>,
  angularVelocity: Readonly<SurfaceRigidBodyIslandVector>,
  seconds: number
): number => {
  const angularSpeed = finiteNonNegative(
    Math.hypot(angularVelocity.x, angularVelocity.y, angularVelocity.z),
    "angular speed"
  );
  if (angularSpeed === 0) return 0;
  const angle = finiteNonNegative(angularSpeed * seconds, "angular sweep angle");
  const radius = maximumCornerRadius(aabb, pivot);
  return finiteNonNegative(
    2 * radius * Math.sin(Math.min(Math.PI, angle) / 2),
    "angular sweep expansion"
  );
};

const sweptAabb = (
  aabb: Readonly<SurfaceRigidBodyAabb>,
  linearVelocity: Readonly<SurfaceRigidBodyIslandVector>,
  angularVelocity: Readonly<SurfaceRigidBodyIslandVector>,
  pivot: Readonly<SurfaceRigidBodyIslandVector>,
  gravity: Readonly<SurfaceRigidBodyIslandVector>,
  seconds: number,
  predictive: boolean
): Readonly<{ readonly aabb: Readonly<SurfaceRigidBodyAabb>; readonly angularExpansionMeters: number }> => {
  if (!predictive) return Object.freeze({ aabb, angularExpansionMeters: 0 });
  const x = axisDisplacementBounds(linearVelocity.x, gravity.x, seconds);
  const y = axisDisplacementBounds(linearVelocity.y, gravity.y, seconds);
  const z = axisDisplacementBounds(linearVelocity.z, gravity.z, seconds);
  const expansion = angularExpansion(aabb, pivot, angularVelocity, seconds);
  return Object.freeze({
    aabb: createSurfaceRigidBodyAabb({
      minimumX: finite(aabb.minimumX + x.minimum - expansion, "swept minimumX"),
      minimumY: finite(aabb.minimumY + y.minimum - expansion, "swept minimumY"),
      minimumZ: finite(aabb.minimumZ + z.minimum - expansion, "swept minimumZ"),
      maximumX: finite(aabb.maximumX + x.maximum + expansion, "swept maximumX"),
      maximumY: finite(aabb.maximumY + y.maximum + expansion, "swept maximumY"),
      maximumZ: finite(aabb.maximumZ + z.maximum + expansion, "swept maximumZ")
    }),
    angularExpansionMeters: expansion
  });
};

const checkedBody = (
  source: Readonly<SurfaceRigidBodyIslandBodyInput>,
  context: Readonly<SurfaceRigidBodyIslandPlanningContext>,
  index: number
): Readonly<SurfaceRigidBodyIslandSourceBodyFact> => {
  const path = `bodies.${index}`;
  const proxy = source?.proxy;
  if (!Object.isFrozen(proxy) || !Object.isFrozen(proxy?.aabb)) {
    throw new TypeError(`${path}.proxy and its AABB must be immutable facts.`);
  }
  const bodyId = stableBodyId(proxy.bodyId, `${path}.proxy.bodyId`);
  const recordHash = checkedHash(proxy.recordHash, `${path}.proxy.recordHash`);
  const aabb = createSurfaceRigidBodyAabb(proxy.aabb);
  if (source.tier !== "ActiveContact" && source.tier !== "SleepingExact" && source.tier !== "FarProxy") {
    throw new TypeError(`${path}.tier is unsupported.`);
  }
  if (source.lifecycle !== "Falling" && source.lifecycle !== "Resting") {
    throw new TypeError(`${path}.lifecycle is unsupported.`);
  }
  if (typeof source.wakeRequested !== "boolean") {
    throw new TypeError(`${path}.wakeRequested must be boolean.`);
  }
  const residencyProvenanceHash = checkedHash(source.residencyProvenanceHash, `${path}.residencyProvenanceHash`);
  const linearVelocityMetersPerSecond = checkedVector(source.linearVelocityMetersPerSecond, `${path}.linearVelocityMetersPerSecond`);
  const angularVelocityRadiansPerSecond = checkedVector(source.angularVelocityRadiansPerSecond, `${path}.angularVelocityRadiansPerSecond`);
  const rotationPivotWorldMeters = checkedVector(source.rotationPivotWorldMeters, `${path}.rotationPivotWorldMeters`);
  const accumulatedSimulationSeconds = finiteNonNegative(source.accumulatedSimulationSeconds, `${path}.accumulatedSimulationSeconds`);
  const pendingSimulationSeconds = finitePositive(
    accumulatedSimulationSeconds + context.fixedDeltaSeconds,
    `${path}.pendingSimulationSeconds`
  );
  const dynamic = source.tier === "ActiveContact" || (source.tier === "SleepingExact" && source.wakeRequested);
  const swept = sweptAabb(
    aabb,
    linearVelocityMetersPerSecond,
    angularVelocityRadiansPerSecond,
    rotationPivotWorldMeters,
    context.gravityMetersPerSecondSquared,
    pendingSimulationSeconds,
    dynamic || source.tier === "FarProxy"
  );
  return Object.freeze({
    bodyId,
    recordHash,
    aabb,
    tier: source.tier,
    lifecycle: source.lifecycle,
    residencyProvenanceHash,
    linearVelocityMetersPerSecond,
    angularVelocityRadiansPerSecond,
    rotationPivotWorldMeters,
    accumulatedSimulationSeconds,
    pendingSimulationSeconds,
    wakeRequested: source.wakeRequested,
    dynamic,
    angularSweepExpansionMeters: swept.angularExpansionMeters,
    sweptAabb: swept.aabb,
    requiredSubstepCount: requiredSubsteps(pendingSimulationSeconds, context.fixedDeltaSeconds)
  });
};

const intersects = (left: Readonly<SurfaceRigidBodyAabb>, right: Readonly<SurfaceRigidBodyAabb>): boolean =>
  left.minimumX <= right.maximumX && left.maximumX >= right.minimumX
  && left.minimumY <= right.maximumY && left.maximumY >= right.minimumY
  && left.minimumZ <= right.maximumZ && left.maximumZ >= right.minimumZ;

const compareSweepBodies = (
  left: Readonly<SurfaceRigidBodyIslandSourceBodyFact>,
  right: Readonly<SurfaceRigidBodyIslandSourceBodyFact>
): number => left.sweptAabb.minimumX - right.sweptAabb.minimumX || compareText(left.bodyId, right.bodyId);

const readPairProbe = (
  bodies: readonly Readonly<SurfaceRigidBodyIslandSourceBodyFact>[],
  position: PairPosition
): PairProbe | null => {
  while (position.leftOrdinal < bodies.length - 1) {
    if (position.rightOrdinal >= bodies.length) {
      position.leftOrdinal += 1;
      position.rightOrdinal = position.leftOrdinal + 1;
      continue;
    }
    const bodyA = bodies[position.leftOrdinal];
    const bodyB = bodies[position.rightOrdinal];
    if (bodyB.sweptAabb.minimumX > bodyA.sweptAabb.maximumX) {
      position.leftOrdinal += 1;
      position.rightOrdinal = position.leftOrdinal + 1;
      return Object.freeze({ bodyA, bodyB, potential: false });
    }
    position.rightOrdinal += 1;
    return Object.freeze({ bodyA, bodyB, potential: intersects(bodyA.sweptAabb, bodyB.sweptAabb) });
  }
  return null;
};

class CanonicalUnionFind {
  private readonly parent = new Map<string, string>();
  public constructor(bodyIds: readonly string[]) {
    for (const bodyId of bodyIds) this.parent.set(bodyId, bodyId);
  }
  public find(bodyId: string): string {
    const parent = this.parent.get(bodyId);
    if (parent === undefined) throw new Error(`Unknown union body ${bodyId}.`);
    if (parent === bodyId) return bodyId;
    const root = this.find(parent);
    this.parent.set(bodyId, root);
    return root;
  }
  public union(bodyIdA: string, bodyIdB: string): void {
    const rootA = this.find(bodyIdA);
    const rootB = this.find(bodyIdB);
    if (rootA === rootB) return;
    if (rootA < rootB) this.parent.set(rootB, rootA);
    else this.parent.set(rootA, rootB);
  }
}

const pair = (bodyIdA: string, bodyIdB: string): Readonly<SurfaceRigidBodyIslandContactPair> => Object.freeze(
  bodyIdA < bodyIdB ? { bodyIdA, bodyIdB } : { bodyIdA: bodyIdB, bodyIdB: bodyIdA }
);

const updateFarOverlap = (state: PlanningState, farBodyId: string, otherBodyId: string): void => {
  const accumulator = state.farOverlapByBodyId.get(farBodyId);
  if (accumulator === undefined) throw new Error(`Missing FarProxy ${farBodyId}.`);
  accumulator.count += 1;
  accumulator.firstBodyId = accumulator.firstBodyId === null || otherBodyId < accumulator.firstBodyId
    ? otherBodyId
    : accumulator.firstBodyId;
  accumulator.digest = hashAdaptiveCanonical({ previous: accumulator.digest, farBodyId, otherBodyId });
};

const createPlanningCursor = (
  session: Readonly<SurfaceRigidBodyIslandPlanningSession>,
  nextLeftOrdinal: number,
  nextRightOrdinal: number,
  sequence: number
): Readonly<SurfaceRigidBodyIslandPlanningCursor> => {
  const cursor = Object.freeze({ sessionContentHash: session.contentHash, nextLeftOrdinal, nextRightOrdinal, sequence });
  planningCursorState.set(cursor, { consumed: false });
  return cursor;
};

export const createSurfaceRigidBodyIslandPlanningSession = (
  sourceBodies: readonly Readonly<SurfaceRigidBodyIslandBodyInput>[],
  sourceContext: Readonly<SurfaceRigidBodyIslandPlanningContext>
): Readonly<SurfaceRigidBodyIslandPlanningSession> => {
  if (!Array.isArray(sourceBodies)) throw new TypeError("Rigid-body island inputs must be an array.");
  const planningContext = checkedContext(sourceContext);
  const sourceFacts = sourceBodies.map((input, index) => checkedBody(input, planningContext, index))
    .sort((left, right) => compareText(left.bodyId, right.bodyId));
  for (let index = 1; index < sourceFacts.length; index += 1) {
    if (sourceFacts[index - 1].bodyId === sourceFacts[index].bodyId) {
      throw new TypeError(`Duplicate rigid-body identity ${sourceFacts[index].bodyId}.`);
    }
  }
  const frozenFacts = Object.freeze(sourceFacts);
  const sourceContentHash = hashAdaptiveCanonical({ context: planningContext, sourceBodies: frozenFacts });
  const payload = Object.freeze({
    schemaVersion: SURFACE_RIGID_BODY_ISLAND_PLANNING_SCHEMA_VERSION,
    context: planningContext,
    logicalBodyCount: frozenFacts.length,
    sourceContentHash
  });
  const session = Object.freeze({ ...payload, contentHash: hashAdaptiveCanonical(payload) });
  const farOverlapByBodyId = new Map<string, FarOverlapAccumulator>();
  for (const bodyFact of frozenFacts) {
    if (bodyFact.tier === "FarProxy") {
      farOverlapByBodyId.set(bodyFact.bodyId, {
        count: 0,
        firstBodyId: null,
        digest: hashAdaptiveCanonical({ bodyId: bodyFact.bodyId, overlaps: 0 })
      });
    }
  }
  planningStateBySession.set(session, {
    sourceBodies: frozenFacts,
    sourceBodyById: new Map(frozenFacts.map((bodyFact) => [bodyFact.bodyId, bodyFact])),
    sweepBodies: Object.freeze([...frozenFacts].sort(compareSweepBodies)),
    unionFind: new CanonicalUnionFind(frozenFacts.filter((bodyFact) => bodyFact.tier !== "FarProxy").map((bodyFact) => bodyFact.bodyId)),
    farOverlapByBodyId,
    activeCursor: null,
    completedPlan: null,
    broadphasePairTestCount: 0,
    potentialContactCount: 0
  });
  return session;
};

export const createSurfaceRigidBodyIslandPlanningCursor = (
  session: Readonly<SurfaceRigidBodyIslandPlanningSession>,
  seed: Readonly<{ readonly sequence?: number }> = {}
): Readonly<SurfaceRigidBodyIslandPlanningCursor> => {
  const state = planningStateBySession.get(session);
  if (state === undefined) throw new TypeError("Rigid-body island planning session is not constructor-issued.");
  if (state.activeCursor !== null) throw new TypeError("Rigid-body island planning cursor already exists.");
  const cursor = createPlanningCursor(session, 0, 1, nonNegativeSafeInteger(seed.sequence ?? 0, "planningCursor.sequence"));
  state.activeCursor = cursor;
  return cursor;
};

const makeIsland = (
  rootBodyId: string,
  members: readonly Readonly<SurfaceRigidBodyIslandSourceBodyFact>[]
): Readonly<SurfaceRigidBodyContactIsland> => {
  const bodyIds = Object.freeze(members.map((fact) => fact.bodyId).sort(compareText));
  const dynamicBodyIds = Object.freeze(members.filter((fact) => fact.dynamic).map((fact) => fact.bodyId).sort(compareText));
  const dynamicSet = new Set(dynamicBodyIds);
  const staticBodyIds = Object.freeze(bodyIds.filter((bodyId) => !dynamicSet.has(bodyId)));
  const simulation = Object.freeze(members.filter((fact) => fact.dynamic)
    .sort((left, right) => compareText(left.bodyId, right.bodyId))
    .map((fact) => Object.freeze({
      bodyId: fact.bodyId,
      pendingSimulationSeconds: fact.pendingSimulationSeconds,
      requiredSubstepCount: fact.requiredSubstepCount
    })));
  const requiredSubstepCount = Math.max(0, ...simulation.map((fact) => fact.requiredSubstepCount));
  const sweepBodyIds = Object.freeze([...members].sort(compareSweepBodies).map((fact) => fact.bodyId));
  const payload = Object.freeze({
    rootBodyId,
    bodyIds,
    sweepBodyIds,
    dynamicBodyIds,
    staticBodyIds,
    simulation,
    requiredSubstepCount
  });
  return Object.freeze({ ...payload, contentHash: hashAdaptiveCanonical(payload) });
};

const initialIslandStateHash = (
  plan: Readonly<SurfaceRigidBodyIslandPlan>,
  island: Readonly<SurfaceRigidBodyContactIsland>,
  sourceBodyById: ReadonlyMap<string, Readonly<SurfaceRigidBodyIslandSourceBodyFact>>
): string => hashAdaptiveCanonical(Object.freeze({
  schemaVersion: "surface-rigid-body-island-initial-state-v1",
  planContentHash: plan.contentHash,
  rootBodyId: island.rootBodyId,
  islandContentHash: island.contentHash,
  sourceBodies: Object.freeze(island.bodyIds.map((bodyId) => {
    const fact = sourceBodyById.get(bodyId);
    if (fact === undefined) throw new Error(`Missing initial Physics fact ${bodyId}.`);
    return fact;
  }))
}));

const createPlan = (
  session: Readonly<SurfaceRigidBodyIslandPlanningSession>,
  state: PlanningState
): Readonly<SurfaceRigidBodyIslandPlan> => {
  const membersByRoot = new Map<string, Readonly<SurfaceRigidBodyIslandSourceBodyFact>[]>();
  for (const fact of state.sourceBodies) {
    if (fact.tier === "FarProxy") continue;
    const root = state.unionFind.find(fact.bodyId);
    const members = membersByRoot.get(root);
    if (members === undefined) membersByRoot.set(root, [fact]);
    else members.push(fact);
  }
  const islands: Readonly<SurfaceRigidBodyContactIsland>[] = [];
  const sleepingOnlyBodyIds: string[] = [];
  for (const [rootBodyId, members] of [...membersByRoot.entries()].sort(([left], [right]) => compareText(left, right))) {
    if (!members.some((fact) => fact.dynamic)) {
      sleepingOnlyBodyIds.push(...members.map((fact) => fact.bodyId));
    } else {
      islands.push(makeIsland(rootBodyId, members));
    }
  }
  const refinementRequired: Readonly<SurfaceRigidBodyRefinementRequirement>[] = [];
  const deferredFarProxies: Readonly<SurfaceRigidBodyDeferredFarProxy>[] = [];
  for (const fact of state.sourceBodies) {
    if (fact.tier !== "FarProxy") continue;
    const accumulator = state.farOverlapByBodyId.get(fact.bodyId);
    if (accumulator === undefined) throw new Error(`Missing FarProxy ${fact.bodyId}.`);
    if (fact.wakeRequested || accumulator.count > 0) {
      refinementRequired.push(Object.freeze({
        bodyId: fact.bodyId,
        recordHash: fact.recordHash,
        residencyProvenanceHash: fact.residencyProvenanceHash,
        accumulatedSimulationSeconds: fact.accumulatedSimulationSeconds,
        targetSimulationSeconds: fact.pendingSimulationSeconds,
        overlappingBodyCount: accumulator.count,
        firstOverlappingBodyId: accumulator.firstBodyId,
        overlapDigest: accumulator.digest,
        reason: fact.wakeRequested ? "WakeRequested" : "PredictiveContact"
      }));
    } else {
      deferredFarProxies.push(Object.freeze({
        bodyId: fact.bodyId,
        recordHash: fact.recordHash,
        residencyProvenanceHash: fact.residencyProvenanceHash,
        accumulatedSimulationSeconds: fact.accumulatedSimulationSeconds,
        targetSimulationSeconds: fact.pendingSimulationSeconds
      }));
    }
  }
  const payload = Object.freeze({
    schemaVersion: SURFACE_RIGID_BODY_ISLAND_PLAN_SCHEMA_VERSION,
    context: session.context,
    logicalBodyCount: state.sourceBodies.length,
    sourceBodies: state.sourceBodies,
    planningCounters: Object.freeze({
      broadphasePairTestCount: state.broadphasePairTestCount,
      potentialContactCount: state.potentialContactCount
    }),
    islands: Object.freeze(islands),
    sleepingOnlyBodyIds: Object.freeze(sleepingOnlyBodyIds.sort(compareText)),
    refinementRequired: Object.freeze(refinementRequired),
    deferredFarProxies: Object.freeze(deferredFarProxies)
  });
  const plan = Object.freeze({ ...payload, contentHash: hashAdaptiveCanonical(payload) });
  const sweepFactsByRoot = new Map<string, readonly Readonly<SurfaceRigidBodyIslandSourceBodyFact>[]>();
  const dynamicSubstepsByRoot = new Map<string, ReadonlyMap<string, number>>();
  const committedProgress: MutableIslandProgress[] = [];
  const committedStateHashByRoot = new Map<string, string>();
  for (const island of plan.islands) {
    sweepFactsByRoot.set(island.rootBodyId, Object.freeze(island.sweepBodyIds.map((bodyId) => {
      const fact = state.sourceBodyById.get(bodyId);
      if (fact === undefined) throw new Error(`Missing body fact ${bodyId}.`);
      return fact;
    })));
    dynamicSubstepsByRoot.set(island.rootBodyId, new Map(
      island.simulation.map((fact) => [fact.bodyId, fact.requiredSubstepCount])
    ));
    committedProgress.push({
      rootBodyId: island.rootBodyId,
      substepIndex: 0,
      phase: island.requiredSubstepCount === 0 ? "Complete" : "IntegrateBodies",
      nextBodyOrdinal: 0,
      nextPairLeftOrdinal: 0,
      nextPairRightOrdinal: 1
    });
    committedStateHashByRoot.set(
      island.rootBodyId,
      initialIslandStateHash(plan, island, state.sourceBodyById)
    );
  }
  executionStateByPlan.set(plan, {
    sweepFactsByRoot,
    dynamicSubstepsByRoot,
    committedProgress,
    committedStateHashByRoot,
    pendingWorkByRoot: new Map(),
    issuedWork: new Map(),
    committedReceipts: new Map(),
    activeCursor: null,
    schedulingComplete: false,
    remainingIslandCount: plan.islands.length,
    completionSnapshot: null,
    adoptedCompletionHash: null
  });
  return plan;
};

export const advanceSurfaceRigidBodyIslandPlanning = (
  session: Readonly<SurfaceRigidBodyIslandPlanningSession>,
  cursor: Readonly<SurfaceRigidBodyIslandPlanningCursor>,
  budget: Readonly<SurfaceRigidBodyIslandPlanningBudget>
): SurfaceRigidBodyIslandPlanningResult => {
  const state = planningStateBySession.get(session);
  const cursorState = planningCursorState.get(cursor);
  if (state === undefined || cursorState === undefined) {
    throw new TypeError("Rigid-body island planning state is not constructor-issued.");
  }
  if (state.activeCursor !== cursor || cursor.sessionContentHash !== session.contentHash) {
    throw new TypeError("Rigid-body island planning cursor is not active for this session.");
  }
  if (cursorState.consumed) throw new TypeError("Rigid-body island planning cursor was already consumed.");
  if (state.completedPlan !== null) throw new TypeError("Rigid-body island planning session is already complete.");
  const maximumPairTests = positiveSafeInteger(budget?.maximumPairTests, "planningBudget.maximumPairTests");
  const nextSequence = incrementSafeInteger(cursor.sequence, "Planning cursor sequence");
  const position: PairPosition = {
    leftOrdinal: nonNegativeSafeInteger(cursor.nextLeftOrdinal, "nextLeftOrdinal"),
    rightOrdinal: nonNegativeSafeInteger(cursor.nextRightOrdinal, "nextRightOrdinal")
  };
  const start = { ...position };
  const potentialPairs: Readonly<SurfaceRigidBodyIslandContactPair>[] = [];
  let broadphasePairTestCount = 0;
  while (broadphasePairTestCount < maximumPairTests) {
    const probe = readPairProbe(state.sweepBodies, position);
    if (probe === null) break;
    broadphasePairTestCount += 1;
    if (probe.potential) potentialPairs.push(pair(probe.bodyA.bodyId, probe.bodyB.bodyId));
  }
  const nextTotalPairTests = state.broadphasePairTestCount + broadphasePairTestCount;
  const nextPotentialContacts = state.potentialContactCount + potentialPairs.length;
  if (!Number.isSafeInteger(nextTotalPairTests) || !Number.isSafeInteger(nextPotentialContacts)) {
    throw new RangeError("Rigid-body island planning counters are exhausted.");
  }
  for (const contact of potentialPairs) {
    const bodyA = state.sourceBodyById.get(contact.bodyIdA);
    const bodyB = state.sourceBodyById.get(contact.bodyIdB);
    if (bodyA === undefined || bodyB === undefined) throw new Error("Potential pair lost source identity.");
    if (bodyA.tier !== "FarProxy" && bodyB.tier !== "FarProxy") {
      state.unionFind.union(bodyA.bodyId, bodyB.bodyId);
    } else {
      if (bodyA.tier === "FarProxy") updateFarOverlap(state, bodyA.bodyId, bodyB.bodyId);
      if (bodyB.tier === "FarProxy") updateFarOverlap(state, bodyB.bodyId, bodyA.bodyId);
    }
  }
  state.broadphasePairTestCount = nextTotalPairTests;
  state.potentialContactCount = nextPotentialContacts;
  const nextCursor = createPlanningCursor(session, position.leftOrdinal, position.rightOrdinal, nextSequence);
  cursorState.consumed = true;
  state.activeCursor = nextCursor;
  const work = Object.freeze({
    fromLeftOrdinal: start.leftOrdinal,
    fromRightOrdinal: start.rightOrdinal,
    toLeftOrdinal: position.leftOrdinal,
    toRightOrdinal: position.rightOrdinal,
    broadphasePairTestCount,
    potentialContactCount: potentialPairs.length
  });
  if (position.leftOrdinal < state.sweepBodies.length - 1) {
    return Object.freeze({ status: "Continued" as const, cursor: nextCursor, work });
  }
  const plan = createPlan(session, state);
  state.completedPlan = plan;
  return Object.freeze({ status: "Complete" as const, cursor: nextCursor, work, plan });
};

const createWorkCursor = (
  plan: Readonly<SurfaceRigidBodyIslandPlan>,
  nextIslandRootBodyId: string | null,
  completedRotations: number,
  sequence: number
): Readonly<SurfaceRigidBodyIslandCursor> => {
  const cursor = Object.freeze({
    planContentHash: plan.contentHash,
    nextIslandRootBodyId,
    completedRotations,
    sequence
  });
  workCursorState.set(cursor, { consumed: false });
  return cursor;
};

export const createSurfaceRigidBodyIslandCursor = (
  plan: Readonly<SurfaceRigidBodyIslandPlan>,
  seed: Readonly<SurfaceRigidBodyIslandCursorSeed> = {}
): Readonly<SurfaceRigidBodyIslandCursor> => {
  const execution = executionStateByPlan.get(plan);
  if (execution === undefined) throw new TypeError("Rigid-body island plan is not constructor-issued.");
  if (execution.activeCursor !== null) throw new TypeError("Rigid-body island work cursor already exists.");
  const cursor = createWorkCursor(
    plan,
    plan.islands[0]?.rootBodyId ?? null,
    nonNegativeSafeInteger(seed.completedRotations ?? 0, "completedRotations"),
    nonNegativeSafeInteger(seed.sequence ?? 0, "sequence")
  );
  execution.activeCursor = cursor;
  return cursor;
};

const nextIssuableIslandIndex = (
  plan: Readonly<SurfaceRigidBodyIslandPlan>,
  execution: Readonly<PlanExecutionState>,
  startIndex: number
): number | null => {
  for (let offset = 0; offset < execution.committedProgress.length; offset += 1) {
    const index = (startIndex + offset) % execution.committedProgress.length;
    const candidate = execution.committedProgress[index];
    if (
      candidate.phase !== "Complete" &&
      !execution.pendingWorkByRoot.has(plan.islands[index].rootBodyId)
    ) return index;
  }
  return null;
};

const workStartIndex = (plan: Readonly<SurfaceRigidBodyIslandPlan>, bodyId: string | null): number => {
  if (bodyId === null || plan.islands.length === 0) return 0;
  const exact = plan.islands.findIndex((island) => island.rootBodyId === bodyId);
  if (exact >= 0) return exact;
  const successor = plan.islands.findIndex((island) => island.rootBodyId > bodyId);
  return successor < 0 ? 0 : successor;
};

const checkedWorkBudget = (
  source: Readonly<SurfaceRigidBodyIslandWorkBudget>
): Readonly<SurfaceRigidBodyIslandWorkBudget> => Object.freeze({
  maximumBodySteps: positiveSafeInteger(source?.maximumBodySteps, "workBudget.maximumBodySteps"),
  maximumPairTests: positiveSafeInteger(source?.maximumPairTests, "workBudget.maximumPairTests"),
  maximumContactPairs: positiveSafeInteger(source?.maximumContactPairs, "workBudget.maximumContactPairs"),
  maximumSubsteps: positiveSafeInteger(source?.maximumSubsteps, "workBudget.maximumSubsteps")
});

const createWorkSlice = (
  plan: Readonly<SurfaceRigidBodyIslandPlan>,
  rootBodyId: string,
  predecessorStateHash: string,
  startProgress: Readonly<MutableIslandProgress>,
  units: readonly SurfaceRigidBodyIslandWorkUnit[],
  bodyStepCount: number,
  broadphasePairTestCount: number,
  contactPairCount: number,
  completedSubstepCount: number
): Readonly<SurfaceRigidBodyIslandWorkSlice> => {
  const workIdentity = hashAdaptiveCanonical({
    planContentHash: plan.contentHash,
    rootBodyId,
    predecessorStateHash,
    startProgress,
    units
  });
  const workId = `island-work:${workIdentity.slice("fnv1a64-v1:".length)}`;
  const payload = Object.freeze({
    workId,
    planContentHash: plan.contentHash,
    rootBodyId,
    predecessorStateHash,
    units,
    bodyStepCount,
    broadphasePairTestCount,
    contactPairCount,
    completedSubstepCount
  });
  return Object.freeze({ ...payload, contentHash: hashAdaptiveCanonical(payload) });
};

const issuedFact = (work: Readonly<SurfaceRigidBodyIslandWorkSlice>): Readonly<IssuedWorkFact> => Object.freeze({
  workId: work.workId,
  contentHash: work.contentHash,
  planContentHash: work.planContentHash,
  rootBodyId: work.rootBodyId,
  predecessorStateHash: work.predecessorStateHash,
  bodyStepCount: work.bodyStepCount,
  broadphasePairTestCount: work.broadphasePairTestCount,
  contactPairCount: work.contactPairCount,
  completedSubstepCount: work.completedSubstepCount
});

export const selectSurfaceRigidBodyIslandWork = (
  plan: Readonly<SurfaceRigidBodyIslandPlan>,
  cursor: Readonly<SurfaceRigidBodyIslandCursor>,
  sourceBudget: Readonly<SurfaceRigidBodyIslandWorkBudget>
): SurfaceRigidBodyIslandWorkSelection => {
  const execution = executionStateByPlan.get(plan);
  const cursorState = workCursorState.get(cursor);
  if (execution === undefined || cursorState === undefined) {
    throw new TypeError("Rigid-body island work state is not constructor-issued.");
  }
  if (execution.activeCursor !== cursor || cursor.planContentHash !== plan.contentHash) {
    throw new TypeError("Rigid-body island cursor is not active for this plan.");
  }
  if (cursorState.consumed) throw new TypeError("Rigid-body island cursor was already consumed.");
  if (execution.schedulingComplete) return Object.freeze({ status: "Complete" as const, cursor });
  const budget = checkedWorkBudget(sourceBudget);
  const startIndex = workStartIndex(plan, cursor.nextIslandRootBodyId);
  const islandIndex = nextIssuableIslandIndex(plan, execution, startIndex);
  if (islandIndex === null) {
    if (execution.pendingWorkByRoot.size > 0) {
      const pendingWork = Object.freeze([...execution.pendingWorkByRoot.values()]
        .sort((left, right) => compareText(left.fact.rootBodyId, right.fact.rootBodyId))
        .map((entry) => entry.work));
      return Object.freeze({
        status: "AwaitingReceipt" as const,
        cursor,
        pendingWork,
        remainingIslandCount: execution.remainingIslandCount
      });
    }
    if (
      execution.remainingIslandCount !== 0 ||
      execution.committedProgress.some((entry) => entry.phase !== "Complete")
    ) {
      throw new Error("Incomplete island work has no issuable or pending slice.");
    }
    execution.schedulingComplete = true;
    return Object.freeze({ status: "Complete" as const, cursor });
  }
  const nextSequence = incrementSafeInteger(cursor.sequence, "Work cursor sequence");
  const island = plan.islands[islandIndex];
  const original = execution.committedProgress[islandIndex];
  const scratch: MutableIslandProgress = { ...original };
  const startProgress = Object.freeze({ ...original });
  const sweepFacts = execution.sweepFactsByRoot.get(island.rootBodyId);
  const dynamicSubsteps = execution.dynamicSubstepsByRoot.get(island.rootBodyId);
  if (sweepFacts === undefined || dynamicSubsteps === undefined) {
    throw new Error(`Missing execution facts for island ${island.rootBodyId}.`);
  }
  const units: SurfaceRigidBodyIslandWorkUnit[] = [];
  let bodyStepCount = 0;
  let broadphasePairTestCount = 0;
  let contactPairCount = 0;
  let completedSubstepCount = 0;

  while (scratch.phase !== "Complete") {
    if (scratch.phase === "IntegrateBodies") {
      const bodyIds: string[] = [];
      const startOrdinal = scratch.nextBodyOrdinal;
      while (
        scratch.nextBodyOrdinal < island.simulation.length &&
        bodyStepCount < budget.maximumBodySteps
      ) {
        const fact = island.simulation[scratch.nextBodyOrdinal];
        scratch.nextBodyOrdinal += 1;
        bodyStepCount += 1;
        if (fact.requiredSubstepCount > scratch.substepIndex) bodyIds.push(fact.bodyId);
      }
      const examinedBodyCount = scratch.nextBodyOrdinal - startOrdinal;
      if (examinedBodyCount > 0) {
        units.push(Object.freeze({
          kind: "IntegrateBodies" as const,
          substepIndex: scratch.substepIndex,
          examinedBodyCount,
          bodyIds: Object.freeze(bodyIds)
        }));
      }
      if (scratch.nextBodyOrdinal < island.simulation.length) break;
      scratch.nextBodyOrdinal = 0;
      scratch.phase = "EvaluateContacts";
      if (bodyStepCount >= budget.maximumBodySteps) break;
    }

    if (scratch.phase === "EvaluateContacts") {
      const contactPairs: Readonly<SurfaceRigidBodyIslandContactPair>[] = [];
      const position: PairPosition = {
        leftOrdinal: scratch.nextPairLeftOrdinal,
        rightOrdinal: scratch.nextPairRightOrdinal
      };
      let testedPairCount = 0;
      while (
        broadphasePairTestCount < budget.maximumPairTests &&
        contactPairCount < budget.maximumContactPairs
      ) {
        const probe = readPairProbe(sweepFacts, position);
        if (probe === null) break;
        testedPairCount += 1;
        broadphasePairTestCount += 1;
        const activeA = (dynamicSubsteps.get(probe.bodyA.bodyId) ?? 0) > scratch.substepIndex;
        const activeB = (dynamicSubsteps.get(probe.bodyB.bodyId) ?? 0) > scratch.substepIndex;
        if (probe.potential && (activeA || activeB)) {
          contactPairs.push(pair(probe.bodyA.bodyId, probe.bodyB.bodyId));
          contactPairCount += 1;
        }
      }
      scratch.nextPairLeftOrdinal = position.leftOrdinal;
      scratch.nextPairRightOrdinal = position.rightOrdinal;
      if (testedPairCount > 0) {
        units.push(Object.freeze({
          kind: "EvaluateContacts" as const,
          substepIndex: scratch.substepIndex,
          testedPairCount,
          contactPairs: Object.freeze(contactPairs)
        }));
      }
      if (scratch.nextPairLeftOrdinal < sweepFacts.length - 1) break;
      scratch.nextPairLeftOrdinal = 0;
      scratch.nextPairRightOrdinal = 1;
      scratch.phase = "CommitSubstep";
      if (
        broadphasePairTestCount >= budget.maximumPairTests ||
        contactPairCount >= budget.maximumContactPairs
      ) break;
    }

    if (scratch.phase === "CommitSubstep") {
      if (completedSubstepCount >= budget.maximumSubsteps) break;
      units.push(Object.freeze({
        kind: "CommitSubstep" as const,
        substepIndex: scratch.substepIndex
      }));
      completedSubstepCount += 1;
      scratch.substepIndex += 1;
      scratch.phase = scratch.substepIndex >= island.requiredSubstepCount
        ? "Complete"
        : "IntegrateBodies";
      if (
        bodyStepCount >= budget.maximumBodySteps ||
        broadphasePairTestCount >= budget.maximumPairTests ||
        contactPairCount >= budget.maximumContactPairs ||
        completedSubstepCount >= budget.maximumSubsteps
      ) break;
    }
  }

  if (units.length === 0) {
    throw new Error(`Work budget made no progress for island ${island.rootBodyId}.`);
  }
  const nextIndex = (islandIndex + 1) % plan.islands.length;
  const wrapped = nextIndex <= islandIndex;
  const nextRotations = wrapped
    ? incrementSafeInteger(cursor.completedRotations, "Work cursor rotation")
    : cursor.completedRotations;
  const predecessorStateHash = execution.committedStateHashByRoot.get(island.rootBodyId);
  if (predecessorStateHash === undefined) {
    throw new Error(`Missing committed Physics state for island ${island.rootBodyId}.`);
  }
  const work = createWorkSlice(
    plan,
    island.rootBodyId,
    predecessorStateHash,
    startProgress,
    Object.freeze(units),
    bodyStepCount,
    broadphasePairTestCount,
    contactPairCount,
    completedSubstepCount
  );
  const fact = issuedFact(work);
  const existing = execution.issuedWork.get(work.workId);
  if (existing !== undefined && existing.contentHash !== fact.contentHash) {
    throw new Error(`Work identity collision for ${work.workId}.`);
  }
  if (execution.pendingWorkByRoot.has(island.rootBodyId)) {
    throw new Error(`Island ${island.rootBodyId} already has pending work.`);
  }
  const nextCursor = createWorkCursor(
    plan,
    plan.islands[nextIndex].rootBodyId,
    nextRotations,
    nextSequence
  );

  cursorState.consumed = true;
  execution.activeCursor = nextCursor;
  execution.issuedWork.set(work.workId, fact);
  execution.pendingWorkByRoot.set(island.rootBodyId, Object.freeze({
    fact,
    work,
    islandIndex,
    resultingProgress: Object.freeze({ ...scratch })
  }));
  return Object.freeze({
    status: "Scheduled" as const,
    work,
    cursor: nextCursor,
    remainingIslandCount: execution.remainingIslandCount
  });
};

const resultStateHashPayload = (
  fact: Readonly<IssuedWorkFact>,
  resultStateArtifactHash: string
): Readonly<Record<string, unknown>> => Object.freeze({
  schemaVersion: "surface-rigid-body-island-state-chain-v1",
  planContentHash: fact.planContentHash,
  rootBodyId: fact.rootBodyId,
  predecessorStateHash: fact.predecessorStateHash,
  workContentHash: fact.contentHash,
  resultStateArtifactHash
});

const chainedResultStateHash = (
  fact: Readonly<IssuedWorkFact>,
  resultStateArtifactHash: string
): string => hashAdaptiveCanonical(resultStateHashPayload(fact, resultStateArtifactHash));

const workResultHashPayload = (
  fact: Readonly<IssuedWorkFact>,
  resultStateArtifactHash: string,
  resultStateHash: string
): Readonly<Record<string, unknown>> => Object.freeze({
  schemaVersion: SURFACE_RIGID_BODY_ISLAND_RESULT_SCHEMA_VERSION,
  workId: fact.workId,
  planContentHash: fact.planContentHash,
  workContentHash: fact.contentHash,
  rootBodyId: fact.rootBodyId,
  predecessorStateHash: fact.predecessorStateHash,
  bodyStepCount: fact.bodyStepCount,
  broadphasePairTestCount: fact.broadphasePairTestCount,
  contactPairCount: fact.contactPairCount,
  completedSubstepCount: fact.completedSubstepCount,
  resultStateArtifactHash,
  resultStateHash
});

export const createSurfaceRigidBodyIslandWorkResultHash = (
  work: Readonly<SurfaceRigidBodyIslandWorkSlice>,
  resultStateArtifactHash: string
): string => {
  const artifactHash = checkedHash(resultStateArtifactHash, "resultStateArtifactHash");
  const fact = issuedFact(work);
  const resultStateHash = chainedResultStateHash(fact, artifactHash);
  return hashAdaptiveCanonical(workResultHashPayload(fact, artifactHash, resultStateHash));
};

export const createSurfaceRigidBodyIslandWorkReceipt = (
  work: Readonly<SurfaceRigidBodyIslandWorkSlice>,
  resultStateArtifactHash: string
): Readonly<SurfaceRigidBodyIslandWorkReceipt> => {
  const artifactHash = checkedHash(resultStateArtifactHash, "resultStateArtifactHash");
  const fact = issuedFact(work);
  const resultStateHash = chainedResultStateHash(fact, artifactHash);
  return Object.freeze({
    workId: fact.workId,
    planContentHash: fact.planContentHash,
    rootBodyId: fact.rootBodyId,
    workContentHash: fact.contentHash,
    predecessorStateHash: fact.predecessorStateHash,
    resultStateArtifactHash: artifactHash,
    resultStateHash,
    resultHash: hashAdaptiveCanonical(workResultHashPayload(fact, artifactHash, resultStateHash))
  });
};

const checkedReceipt = (
  plan: Readonly<SurfaceRigidBodyIslandPlan>,
  receipt: Readonly<SurfaceRigidBodyIslandWorkReceipt>,
  fact: Readonly<IssuedWorkFact>
): Readonly<SurfaceRigidBodyIslandWorkReceipt> => {
  if (receipt.planContentHash !== plan.contentHash) {
    throw new TypeError(`Receipt ${receipt.workId} belongs to another plan.`);
  }
  if (receipt.rootBodyId !== fact.rootBodyId) {
    throw new TypeError(`Receipt ${receipt.workId} belongs to another island root.`);
  }
  if (receipt.workContentHash !== fact.contentHash) {
    throw new TypeError(`Receipt ${receipt.workId} has a stale work content hash.`);
  }
  if (receipt.predecessorStateHash !== fact.predecessorStateHash) {
    throw new TypeError(`Receipt ${receipt.workId} has a disconnected predecessor state.`);
  }
  const resultStateArtifactHash = checkedHash(
    receipt.resultStateArtifactHash,
    `receipt(${receipt.workId}).resultStateArtifactHash`
  );
  const resultStateHash = checkedHash(
    receipt.resultStateHash,
    `receipt(${receipt.workId}).resultStateHash`
  );
  const expectedStateHash = chainedResultStateHash(fact, resultStateArtifactHash);
  if (resultStateHash !== expectedStateHash) {
    throw new TypeError(`Receipt ${receipt.workId} result state is disconnected from its state chain.`);
  }
  const expectedResultHash = hashAdaptiveCanonical(workResultHashPayload(
    fact,
    resultStateArtifactHash,
    expectedStateHash
  ));
  if (receipt.resultHash !== expectedResultHash) {
    throw new TypeError(`Receipt ${receipt.workId} result hash does not match its issued work.`);
  }
  return Object.freeze({
    workId: receipt.workId,
    planContentHash: receipt.planContentHash,
    rootBodyId: receipt.rootBodyId,
    workContentHash: receipt.workContentHash,
    predecessorStateHash: receipt.predecessorStateHash,
    resultStateArtifactHash,
    resultStateHash: expectedStateHash,
    resultHash: expectedResultHash
  });
};

export const acknowledgeSurfaceRigidBodyIslandWorkReceipt = (
  plan: Readonly<SurfaceRigidBodyIslandPlan>,
  receipt: Readonly<SurfaceRigidBodyIslandWorkReceipt>
): SurfaceRigidBodyIslandReceiptDecision => {
  const execution = executionStateByPlan.get(plan);
  if (execution === undefined) throw new TypeError("Rigid-body island plan is not constructor-issued.");
  if (receipt.planContentHash !== plan.contentHash) {
    throw new TypeError(`Receipt ${receipt.workId} belongs to another plan.`);
  }
  const fact = execution.issuedWork.get(receipt.workId);
  if (fact === undefined) throw new TypeError(`Receipt ${receipt.workId} was never issued by this plan.`);
  const checked = checkedReceipt(plan, receipt, fact);
  const committed = execution.committedReceipts.get(receipt.workId);
  if (committed !== undefined) {
    if (committed.resultHash !== checked.resultHash) {
      throw new TypeError(`A different receipt was already committed for ${receipt.workId}.`);
    }
    return Object.freeze({
      state: "AlreadyCommitted" as const,
      workId: checked.workId,
      rootBodyId: checked.rootBodyId,
      resultStateHash: checked.resultStateHash
    });
  }
  const pending = execution.pendingWorkByRoot.get(fact.rootBodyId);
  if (pending === undefined || pending.fact.workId !== receipt.workId) {
    throw new TypeError(`Receipt ${receipt.workId} is stale and no longer pending.`);
  }
  const predecessorStateHash = execution.committedStateHashByRoot.get(fact.rootBodyId);
  if (predecessorStateHash !== fact.predecessorStateHash) {
    throw new TypeError(`Receipt ${receipt.workId} no longer follows the committed predecessor state.`);
  }
  const currentProgress = execution.committedProgress[pending.islandIndex];
  if (currentProgress.rootBodyId !== fact.rootBodyId || currentProgress.phase === "Complete") {
    throw new TypeError(`Receipt ${receipt.workId} no longer matches committed island progress.`);
  }
  const completedIsland = pending.resultingProgress.phase === "Complete";
  const nextRemaining = execution.remainingIslandCount - (completedIsland ? 1 : 0);
  if (!Number.isSafeInteger(nextRemaining) || nextRemaining < 0) {
    throw new Error("Remaining island count became invalid.");
  }

  execution.committedProgress[pending.islandIndex] = { ...pending.resultingProgress };
  execution.committedStateHashByRoot.set(fact.rootBodyId, checked.resultStateHash);
  execution.committedReceipts.set(checked.workId, checked);
  execution.pendingWorkByRoot.delete(fact.rootBodyId);
  execution.remainingIslandCount = nextRemaining;
  return Object.freeze({
    state: "Committed" as const,
    workId: checked.workId,
    rootBodyId: checked.rootBodyId,
    resultStateHash: checked.resultStateHash
  });
};

const preparedPhysicsStateHash = (
  plan: Readonly<SurfaceRigidBodyIslandPlan>,
  terminalIslandStateHashes: readonly Readonly<SurfaceRigidBodyIslandTerminalStateHash>[]
): string => hashAdaptiveCanonical(Object.freeze({
  schemaVersion: "surface-rigid-body-prepared-physics-state-v1",
  planContentHash: plan.contentHash,
  terminalIslandStateHashes
}));

export const createSurfaceRigidBodyIslandCompletionSnapshot = (
  plan: Readonly<SurfaceRigidBodyIslandPlan>
): Readonly<SurfaceRigidBodyIslandCompletionSnapshot> => {
  const execution = executionStateByPlan.get(plan);
  if (execution === undefined) throw new TypeError("Rigid-body island plan is not constructor-issued.");
  if (
    execution.remainingIslandCount !== 0 ||
    execution.pendingWorkByRoot.size !== 0 ||
    execution.committedProgress.some((entry) => entry.phase !== "Complete")
  ) {
    throw new TypeError("Cannot complete before every island work slice is acknowledged and committed.");
  }
  if (execution.committedReceipts.size !== execution.issuedWork.size) {
    throw new TypeError("Completion requires one committed receipt for every issued work slice.");
  }
  const receipts = Object.freeze([...execution.committedReceipts.values()]
    .sort((left, right) => compareText(left.workId, right.workId)));
  const terminalIslandStateHashes = Object.freeze(plan.islands.map((island) => {
    const stateHash = execution.committedStateHashByRoot.get(island.rootBodyId);
    if (stateHash === undefined) throw new Error(`Missing terminal state for island ${island.rootBodyId}.`);
    return Object.freeze({ rootBodyId: island.rootBodyId, stateHash });
  }));
  const preparedStateHash = preparedPhysicsStateHash(plan, terminalIslandStateHashes);
  const payload = Object.freeze({
    schemaVersion: SURFACE_RIGID_BODY_ISLAND_COMPLETION_SCHEMA_VERSION,
    planContentHash: plan.contentHash,
    receipts,
    terminalIslandStateHashes,
    preparedPhysicsStateHash: preparedStateHash
  });
  const candidate = Object.freeze({
    ...payload,
    contentHash: hashAdaptiveCanonical(payload)
  });
  if (execution.completionSnapshot !== null) {
    if (execution.completionSnapshot.contentHash !== candidate.contentHash) {
      throw new TypeError("A different completion snapshot was already sealed for this plan.");
    }
    return execution.completionSnapshot;
  }
  execution.schedulingComplete = true;
  execution.completionSnapshot = candidate;
  constructorIssuedCompletionSnapshots.add(candidate);
  return candidate;
};

export const adoptSurfaceRigidBodyIslandCompletionSnapshot = (
  plan: Readonly<SurfaceRigidBodyIslandPlan>,
  snapshot: Readonly<SurfaceRigidBodyIslandCompletionSnapshot>
): SurfaceRigidBodyIslandAdoptionDecision => {
  const execution = executionStateByPlan.get(plan);
  if (execution === undefined) throw new TypeError("Rigid-body island plan is not constructor-issued.");
  if (snapshot.planContentHash !== plan.contentHash) {
    throw new TypeError("Rigid-body island completion snapshot belongs to another plan.");
  }
  const expectedPreparedStateHash = preparedPhysicsStateHash(plan, snapshot.terminalIslandStateHashes);
  const expectedContentHash = hashAdaptiveCanonical(Object.freeze({
    schemaVersion: snapshot.schemaVersion,
    planContentHash: snapshot.planContentHash,
    receipts: snapshot.receipts,
    terminalIslandStateHashes: snapshot.terminalIslandStateHashes,
    preparedPhysicsStateHash: snapshot.preparedPhysicsStateHash
  }));
  if (
    snapshot.schemaVersion !== SURFACE_RIGID_BODY_ISLAND_COMPLETION_SCHEMA_VERSION ||
    snapshot.preparedPhysicsStateHash !== expectedPreparedStateHash ||
    snapshot.contentHash !== expectedContentHash
  ) {
    throw new TypeError("Rigid-body island completion snapshot commitment is invalid.");
  }
  if (!constructorIssuedCompletionSnapshots.has(snapshot)) {
    throw new TypeError("Rigid-body island completion snapshot is not constructor-issued.");
  }
  if (execution.completionSnapshot !== snapshot) {
    throw new TypeError("Rigid-body island completion snapshot belongs to another plan.");
  }
  const alreadyAdopted = execution.adoptedCompletionHash === snapshot.contentHash;
  if (execution.adoptedCompletionHash !== null && !alreadyAdopted) {
    throw new TypeError("A different completion snapshot was already adopted.");
  }
  execution.adoptedCompletionHash = snapshot.contentHash;
  return Object.freeze({
    state: alreadyAdopted ? "AlreadyAdopted" as const : "Adopted" as const,
    planContentHash: plan.contentHash,
    completionContentHash: snapshot.contentHash
  });
};
