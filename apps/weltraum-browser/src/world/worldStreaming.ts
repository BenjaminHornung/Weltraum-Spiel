import { fnv1aHash, stableStringify } from "../core/hash";
import { vec3, type Vec3 } from "../core/vector";
import type { WorldChunkId, WorldChunkMetadata, WorldChunkRegistrySnapshot } from "./chunkRegistry";
import { ABSOLUTE_SYSTEM_FRAME, type WorldCoordinate } from "./frames";
import { createSimulationBubble, type SimulationBubbleDescriptor, type SimulationUpdateMode } from "./simulationBubble";

export type RenderLodBand = "Near" | "Medium" | "Far" | "Culled";

export interface WorldStreamingBudgets {
  readonly maxFullChunks: number;
  readonly maxSnapshotChunks: number;
  readonly maxVisibleChunks: number;
  readonly maxEstimatedEntityCount?: number;
}

export interface WorldStreamingPolicy {
  readonly simulationBubbleId: string;
  readonly fullUpdateRadius: number;
  readonly snapshotRadius: number;
  readonly nearLodRadius: number;
  readonly mediumLodRadius: number;
  readonly farLodRadius: number;
  readonly simulationHysteresisMeters: number;
  readonly renderHysteresisMeters: number;
  readonly budgets: WorldStreamingBudgets;
}

export interface WorldChunkStreamingAssignment {
  readonly chunkId: WorldChunkId;
  readonly distanceMeters: number;
  readonly estimatedEntityCount: number;
  readonly requestedSimulationMode: SimulationUpdateMode;
  readonly finalSimulationMode: SimulationUpdateMode;
  readonly requestedRenderLod: RenderLodBand;
  readonly finalRenderLod: RenderLodBand;
}

export type WorldStreamingBudgetRejectionReason =
  | "FullChunkBudgetExceeded"
  | "SnapshotChunkBudgetExceeded"
  | "EstimatedEntityBudgetExceeded"
  | "VisibleChunkBudgetExceeded";

export interface WorldStreamingBudgetRejection {
  readonly chunkId: WorldChunkId;
  readonly domain: "Simulation" | "Render";
  readonly requestedState: SimulationUpdateMode | RenderLodBand;
  readonly finalState: SimulationUpdateMode | RenderLodBand;
  readonly reason: WorldStreamingBudgetRejectionReason;
  readonly estimatedEntityCount?: number;
}

export interface WorldStreamingBudgetSummary {
  readonly limits: WorldStreamingBudgets;
  readonly fullChunkCount: number;
  readonly snapshotChunkCount: number;
  readonly visibleChunkCount: number;
  readonly estimatedEntityCount: number;
  readonly rejections: readonly WorldStreamingBudgetRejection[];
}

export interface WorldStreamingVisibleLod {
  readonly chunkId: WorldChunkId;
  readonly lod: Exclude<RenderLodBand, "Culled">;
}

export type WorldStreamingSimulationTransitionType =
  | "ChunkActivated"
  | "ChunkPromotedToFull"
  | "ChunkDemotedToSnapshot"
  | "ChunkBecameDormant";

export type WorldStreamingRenderTransitionType =
  | "ChunkEnteredRenderRange"
  | "ChunkChangedLod"
  | "ChunkLeftRenderRange";

export interface WorldStreamingSimulationTransitionEvent {
  readonly type: WorldStreamingSimulationTransitionType;
  readonly domain: "Simulation";
  readonly chunkId: WorldChunkId;
  readonly previousMode: SimulationUpdateMode;
  readonly nextMode: SimulationUpdateMode;
}

export interface WorldStreamingRenderTransitionEvent {
  readonly type: WorldStreamingRenderTransitionType;
  readonly domain: "Render";
  readonly chunkId: WorldChunkId;
  readonly previousLod: RenderLodBand;
  readonly nextLod: RenderLodBand;
}

export type WorldStreamingTransitionEvent =
  | WorldStreamingSimulationTransitionEvent
  | WorldStreamingRenderTransitionEvent;

export interface WorldStreamingSnapshot {
  readonly observerAbsolutePosition: WorldCoordinate;
  readonly simulationBubble: SimulationBubbleDescriptor;
  readonly registrySignature: string;
  readonly policySignature: string;
  readonly registeredChunkCount: number;
  readonly fullChunkIds: readonly WorldChunkId[];
  readonly snapshotChunkIds: readonly WorldChunkId[];
  readonly dormantChunkCount: number;
  readonly visibleLods: readonly WorldStreamingVisibleLod[];
  readonly assignments: readonly WorldChunkStreamingAssignment[];
  readonly budgetSummary: WorldStreamingBudgetSummary;
  readonly transitions: readonly WorldStreamingTransitionEvent[];
  readonly signature: string;
}

export interface PlanWorldStreamingInput {
  readonly registry: WorldChunkRegistrySnapshot;
  readonly observerAbsolutePosition: WorldCoordinate;
  readonly policy: WorldStreamingPolicy;
  readonly previousSnapshot?: WorldStreamingSnapshot;
}

export type WorldStreamingErrorCode =
  | "INVALID_POLICY"
  | "INVALID_BUDGETS"
  | "INVALID_OBSERVER"
  | "INVALID_REGISTRY"
  | "INVALID_SNAPSHOT"
  | "INCOMPATIBLE_PREVIOUS_SNAPSHOT";

export class WorldStreamingError extends Error {
  public readonly code: WorldStreamingErrorCode;

  public constructor(code: WorldStreamingErrorCode, message: string) {
    super(message);
    this.name = "WorldStreamingError";
    this.code = code;
  }
}

interface CanonicalWorldStreamingPolicy extends WorldStreamingPolicy {
  readonly budgets: WorldStreamingBudgets;
}

interface MutableAssignment {
  readonly chunkId: WorldChunkId;
  readonly distanceMeters: number;
  readonly estimatedEntityCount: number;
  readonly requestedSimulationMode: SimulationUpdateMode;
  finalSimulationMode: SimulationUpdateMode;
  readonly requestedRenderLod: RenderLodBand;
  finalRenderLod: RenderLodBand;
}

const fail = (code: WorldStreamingErrorCode, message: string): never => {
  throw new WorldStreamingError(code, message);
};

const codeUnitCompare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== "object" || seen.has(value as object)) {
    return value;
  }

  seen.add(value as object);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteVec3 = (value: unknown): value is Vec3 =>
  isRecord(value) && [value.x, value.y, value.z].every((component) => typeof component === "number" && Number.isFinite(component));

const isDeeplyFrozen = (value: unknown, seen = new WeakSet<object>()): boolean => {
  if (value === null || typeof value !== "object" || seen.has(value as object)) {
    return true;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }

  seen.add(value as object);
  return Object.values(value as Record<string, unknown>).every((nested) => isDeeplyFrozen(nested, seen));
};

const cloneAbsolutePosition = (position: WorldCoordinate): WorldCoordinate =>
  deepFreeze({
    kind: "WorldCoordinate" as const,
    value: vec3(position.value.x, position.value.y, position.value.z),
    frame: {
      ...ABSOLUTE_SYSTEM_FRAME,
      originAbsolutePosition: vec3(
        ABSOLUTE_SYSTEM_FRAME.originAbsolutePosition.x,
        ABSOLUTE_SYSTEM_FRAME.originAbsolutePosition.y,
        ABSOLUTE_SYSTEM_FRAME.originAbsolutePosition.z
      )
    }
  });

const isValidObserver = (position: unknown): position is WorldCoordinate =>
  isRecord(position) &&
  position.kind === "WorldCoordinate" &&
  isRecord(position.frame) &&
  position.frame.type === "AbsoluteSystem" &&
  isFiniteVec3(position.frame.originAbsolutePosition) &&
  isFiniteVec3(position.value);

const assertValidObserver: (position: unknown) => asserts position is WorldCoordinate = (position) => {
  if (!isValidObserver(position)) {
    fail("INVALID_OBSERVER", "World streaming requires a finite absolute-world observer position");
  }
};

const assertNonNegativeSafeInteger = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return fail("INVALID_BUDGETS", `${label} must be a non-negative safe integer`);
  }
  return value;
};

const canonicalizePolicy = (policy: WorldStreamingPolicy): CanonicalWorldStreamingPolicy => {
  if (!isRecord(policy) || typeof policy.simulationBubbleId !== "string" || !policy.simulationBubbleId.trim()) {
    return fail("INVALID_POLICY", "World streaming policy requires a non-empty simulationBubbleId");
  }

  const radii = [
    policy.fullUpdateRadius,
    policy.snapshotRadius,
    policy.nearLodRadius,
    policy.mediumLodRadius,
    policy.farLodRadius,
    policy.simulationHysteresisMeters,
    policy.renderHysteresisMeters
  ];
  if (radii.some((radius) => typeof radius !== "number" || !Number.isFinite(radius) || radius < 0)) {
    return fail("INVALID_POLICY", "World streaming radii and hysteresis values must be finite and non-negative");
  }
  if (policy.fullUpdateRadius >= policy.snapshotRadius) {
    return fail("INVALID_POLICY", "Simulation radii must satisfy fullUpdateRadius < snapshotRadius");
  }
  if (!(policy.nearLodRadius < policy.mediumLodRadius && policy.mediumLodRadius < policy.farLodRadius)) {
    return fail("INVALID_POLICY", "Render radii must satisfy nearLodRadius < mediumLodRadius < farLodRadius");
  }
  if (policy.simulationHysteresisMeters * 2 >= policy.snapshotRadius - policy.fullUpdateRadius) {
    return fail("INVALID_POLICY", "Simulation hysteresis deadbands must not overlap");
  }
  if (
    policy.renderHysteresisMeters * 2 >= policy.mediumLodRadius - policy.nearLodRadius ||
    policy.renderHysteresisMeters * 2 >= policy.farLodRadius - policy.mediumLodRadius
  ) {
    return fail("INVALID_POLICY", "Render hysteresis deadbands must not overlap");
  }
  if (!isRecord(policy.budgets)) {
    return fail("INVALID_BUDGETS", "World streaming budgets are required");
  }

  const budgets: WorldStreamingBudgets = {
    maxFullChunks: assertNonNegativeSafeInteger(policy.budgets.maxFullChunks, "maxFullChunks"),
    maxSnapshotChunks: assertNonNegativeSafeInteger(policy.budgets.maxSnapshotChunks, "maxSnapshotChunks"),
    maxVisibleChunks: assertNonNegativeSafeInteger(policy.budgets.maxVisibleChunks, "maxVisibleChunks"),
    ...(policy.budgets.maxEstimatedEntityCount === undefined
      ? {}
      : {
          maxEstimatedEntityCount: assertNonNegativeSafeInteger(
            policy.budgets.maxEstimatedEntityCount,
            "maxEstimatedEntityCount"
          )
        })
  };

  return deepFreeze({
    simulationBubbleId: policy.simulationBubbleId,
    fullUpdateRadius: policy.fullUpdateRadius,
    snapshotRadius: policy.snapshotRadius,
    nearLodRadius: policy.nearLodRadius,
    mediumLodRadius: policy.mediumLodRadius,
    farLodRadius: policy.farLodRadius,
    simulationHysteresisMeters: policy.simulationHysteresisMeters,
    renderHysteresisMeters: policy.renderHysteresisMeters,
    budgets
  });
};

const assertValidBounds = (chunk: WorldChunkMetadata): void => {
  const center = chunk.bounds?.center?.value;
  const halfExtents = chunk.bounds?.halfExtents;
  if (
    !isFiniteVec3(center) ||
    !isFiniteVec3(halfExtents) ||
    ![halfExtents.x, halfExtents.y, halfExtents.z].every((component) => component > 0)
  ) {
    fail("INVALID_REGISTRY", `Chunk ${chunk.id} has invalid bounds`);
  }
  for (const axis of ["x", "y", "z"] as const) {
    const min = center[axis] - halfExtents[axis];
    const max = center[axis] + halfExtents[axis];
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      fail("INVALID_REGISTRY", `Chunk ${chunk.id} has non-finite or unordered AABB endpoints`);
    }
  }
};

const assertValidRegistry: (registry: unknown) => asserts registry is WorldChunkRegistrySnapshot = (registry) => {
  if (
    !isRecord(registry) ||
    typeof registry.chunkSizeMeters !== "number" ||
    !Number.isFinite(registry.chunkSizeMeters) ||
    registry.chunkSizeMeters <= 0 ||
    !Array.isArray(registry.chunks) ||
    typeof registry.signature !== "string" ||
    !registry.signature ||
    !isDeeplyFrozen(registry)
  ) {
    fail("INVALID_REGISTRY", "World streaming requires an immutable canonical registry snapshot");
  }

  const typedRegistry = registry as unknown as WorldChunkRegistrySnapshot;
  for (const chunk of typedRegistry.chunks) {
    if (
      !isRecord(chunk) ||
      typeof chunk.id !== "string" ||
      !Array.isArray(chunk.entityIds) ||
      chunk.entityIds.some((entityId) => typeof entityId !== "string")
    ) {
      fail("INVALID_REGISTRY", "Registry snapshot contains invalid chunk metadata");
    }
    assertValidBounds(chunk);
  }

  const expectedSignature = fnv1aHash(
    stableStringify({ chunkSizeMeters: typedRegistry.chunkSizeMeters, chunks: typedRegistry.chunks })
  );
  if (typedRegistry.signature !== expectedSignature) {
    fail("INVALID_REGISTRY", "Registry snapshot signature does not match its canonical contents");
  }
};

const axisGap = (position: number, center: number, halfExtent: number): number => {
  const min = center - halfExtent;
  const max = center + halfExtent;
  if (position < min) {
    return min - position;
  }
  if (position > max) {
    return position - max;
  }
  return 0;
};

const distanceToChunkBounds = (observer: Vec3, chunk: WorldChunkMetadata): number => {
  const center = chunk.bounds.center.value;
  const halfExtents = chunk.bounds.halfExtents;
  const distance = Math.hypot(
    axisGap(observer.x, center.x, halfExtents.x),
    axisGap(observer.y, center.y, halfExtents.y),
    axisGap(observer.z, center.z, halfExtents.z)
  );
  return Number.isFinite(distance) ? distance : Number.MAX_VALUE;
};

const nominalSimulationMode = (distanceMeters: number, policy: CanonicalWorldStreamingPolicy): SimulationUpdateMode =>
  distanceMeters <= policy.fullUpdateRadius
    ? "Full"
    : distanceMeters <= policy.snapshotRadius
      ? "Snapshot"
      : "Dormant";

const nominalRenderLod = (distanceMeters: number, policy: CanonicalWorldStreamingPolicy): RenderLodBand =>
  distanceMeters <= policy.nearLodRadius
    ? "Near"
    : distanceMeters <= policy.mediumLodRadius
      ? "Medium"
      : distanceMeters <= policy.farLodRadius
        ? "Far"
        : "Culled";

const applyBandHysteresis = <T extends string>(
  distanceMeters: number,
  previousBand: T,
  nominalBand: T,
  bands: readonly T[],
  boundaries: readonly number[],
  hysteresisMeters: number
): T => {
  const previousIndex = bands.indexOf(previousBand);
  const nominalIndex = bands.indexOf(nominalBand);
  if (previousIndex < 0 || nominalIndex < 0 || previousIndex === nominalIndex) {
    return nominalBand;
  }

  let resolvedIndex = previousIndex;
  if (nominalIndex > previousIndex) {
    while (
      resolvedIndex < nominalIndex &&
      distanceMeters > boundaries[resolvedIndex] + hysteresisMeters
    ) {
      resolvedIndex += 1;
    }
  } else {
    while (
      resolvedIndex > nominalIndex &&
      distanceMeters < boundaries[resolvedIndex - 1] - hysteresisMeters
    ) {
      resolvedIndex -= 1;
    }
  }
  return bands[resolvedIndex];
};

const compareCandidates = (a: MutableAssignment, b: MutableAssignment): number => {
  if (a.distanceMeters < b.distanceMeters) {
    return -1;
  }
  if (a.distanceMeters > b.distanceMeters) {
    return 1;
  }
  return codeUnitCompare(a.chunkId, b.chunkId);
};

const rejectionReasonOrder: Readonly<Record<WorldStreamingBudgetRejectionReason, number>> = Object.freeze({
  FullChunkBudgetExceeded: 0,
  SnapshotChunkBudgetExceeded: 1,
  EstimatedEntityBudgetExceeded: 2,
  VisibleChunkBudgetExceeded: 3
});

const stateOrder: readonly (SimulationUpdateMode | RenderLodBand)[] = Object.freeze([
  "Full",
  "Snapshot",
  "Dormant",
  "Near",
  "Medium",
  "Far",
  "Culled"
]);

const compareRejections = (a: WorldStreamingBudgetRejection, b: WorldStreamingBudgetRejection): number =>
  rejectionReasonOrder[a.reason] - rejectionReasonOrder[b.reason] ||
  codeUnitCompare(a.chunkId, b.chunkId) ||
  stateOrder.indexOf(a.requestedState) - stateOrder.indexOf(b.requestedState);

const transitionTypeOrder: Readonly<Record<WorldStreamingTransitionEvent["type"], number>> = Object.freeze({
  ChunkActivated: 0,
  ChunkPromotedToFull: 1,
  ChunkDemotedToSnapshot: 2,
  ChunkBecameDormant: 3,
  ChunkEnteredRenderRange: 4,
  ChunkChangedLod: 5,
  ChunkLeftRenderRange: 6
});

const compareTransitions = (a: WorldStreamingTransitionEvent, b: WorldStreamingTransitionEvent): number =>
  codeUnitCompare(a.chunkId, b.chunkId) || transitionTypeOrder[a.type] - transitionTypeOrder[b.type];

const transitionForSimulation = (
  chunkId: WorldChunkId,
  previousMode: SimulationUpdateMode,
  nextMode: SimulationUpdateMode
): WorldStreamingSimulationTransitionEvent | undefined => {
  if (previousMode === nextMode) {
    return undefined;
  }

  let type: WorldStreamingSimulationTransitionType;
  if (previousMode === "Dormant") {
    type = "ChunkActivated";
  } else if (nextMode === "Dormant") {
    type = "ChunkBecameDormant";
  } else if (nextMode === "Full") {
    type = "ChunkPromotedToFull";
  } else {
    type = "ChunkDemotedToSnapshot";
  }
  return { type, domain: "Simulation", chunkId, previousMode, nextMode };
};

const transitionForRender = (
  chunkId: WorldChunkId,
  previousLod: RenderLodBand,
  nextLod: RenderLodBand
): WorldStreamingRenderTransitionEvent | undefined => {
  if (previousLod === nextLod) {
    return undefined;
  }

  const type: WorldStreamingRenderTransitionType =
    previousLod === "Culled"
      ? "ChunkEnteredRenderRange"
      : nextLod === "Culled"
        ? "ChunkLeftRenderRange"
        : "ChunkChangedLod";
  return { type, domain: "Render", chunkId, previousLod, nextLod };
};

const diffAssignments = (
  previousAssignments: readonly WorldChunkStreamingAssignment[],
  nextAssignments: readonly WorldChunkStreamingAssignment[]
): readonly WorldStreamingTransitionEvent[] => {
  const previousById = new Map(previousAssignments.map((assignment) => [assignment.chunkId, assignment]));
  if (previousById.size !== nextAssignments.length) {
    return fail("INVALID_SNAPSHOT", "Compatible streaming snapshots must contain the same chunk assignments");
  }

  const transitions: WorldStreamingTransitionEvent[] = [];
  for (const next of nextAssignments) {
    const previous = previousById.get(next.chunkId);
    if (!previous) {
      return fail("INVALID_SNAPSHOT", `Previous streaming snapshot is missing assignment ${next.chunkId}`);
    }
    const simulationTransition = transitionForSimulation(
      next.chunkId,
      previous.finalSimulationMode,
      next.finalSimulationMode
    );
    const renderTransition = transitionForRender(next.chunkId, previous.finalRenderLod, next.finalRenderLod);
    if (simulationTransition) {
      transitions.push(simulationTransition);
    }
    if (renderTransition) {
      transitions.push(renderTransition);
    }
  }
  return Object.freeze(transitions.sort(compareTransitions));
};

type WorldStreamingSignaturePayload = Omit<WorldStreamingSnapshot, "transitions" | "signature">;

const signaturePayloadForSnapshot = (snapshot: WorldStreamingSignaturePayload): WorldStreamingSignaturePayload => ({
  observerAbsolutePosition: snapshot.observerAbsolutePosition,
  simulationBubble: snapshot.simulationBubble,
  registrySignature: snapshot.registrySignature,
  policySignature: snapshot.policySignature,
  registeredChunkCount: snapshot.registeredChunkCount,
  fullChunkIds: snapshot.fullChunkIds,
  snapshotChunkIds: snapshot.snapshotChunkIds,
  dormantChunkCount: snapshot.dormantChunkCount,
  visibleLods: snapshot.visibleLods,
  assignments: snapshot.assignments,
  budgetSummary: snapshot.budgetSummary
});

const signatureForSnapshot = (snapshot: WorldStreamingSignaturePayload): string =>
  fnv1aHash(stableStringify(signaturePayloadForSnapshot(snapshot)));

const simulationModes: readonly SimulationUpdateMode[] = Object.freeze(["Full", "Snapshot", "Dormant"]);
const renderLods: readonly RenderLodBand[] = Object.freeze(["Near", "Medium", "Far", "Culled"]);
const rejectionReasons: readonly WorldStreamingBudgetRejectionReason[] = Object.freeze([
  "FullChunkBudgetExceeded",
  "SnapshotChunkBudgetExceeded",
  "EstimatedEntityBudgetExceeded",
  "VisibleChunkBudgetExceeded"
]);
const simulationTransitionTypes: readonly WorldStreamingSimulationTransitionType[] = Object.freeze([
  "ChunkActivated",
  "ChunkPromotedToFull",
  "ChunkDemotedToSnapshot",
  "ChunkBecameDormant"
]);
const renderTransitionTypes: readonly WorldStreamingRenderTransitionType[] = Object.freeze([
  "ChunkEnteredRenderRange",
  "ChunkChangedLod",
  "ChunkLeftRenderRange"
]);

const isSimulationMode = (value: unknown): value is SimulationUpdateMode =>
  typeof value === "string" && simulationModes.includes(value as SimulationUpdateMode);

const isRenderLod = (value: unknown): value is RenderLodBand =>
  typeof value === "string" && renderLods.includes(value as RenderLodBand);

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const hasCanonicalUniqueIds = (values: unknown): values is readonly WorldChunkId[] => {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value)) {
    return false;
  }
  return values.every((value, index) => index === 0 || codeUnitCompare(values[index - 1], value) < 0);
};

const sameIds = (actual: readonly string[], expected: readonly string[]): boolean =>
  actual.length === expected.length && actual.every((value, index) => value === expected[index]);

const assertValidStreamingSnapshot: (snapshot: unknown) => asserts snapshot is WorldStreamingSnapshot = (snapshot) => {
  if (
    !isRecord(snapshot) ||
    !isValidObserver(snapshot.observerAbsolutePosition) ||
    !isRecord(snapshot.simulationBubble) ||
    typeof snapshot.registrySignature !== "string" ||
    !snapshot.registrySignature ||
    typeof snapshot.policySignature !== "string" ||
    !snapshot.policySignature ||
    !isNonNegativeSafeInteger(snapshot.registeredChunkCount) ||
    !hasCanonicalUniqueIds(snapshot.fullChunkIds) ||
    !hasCanonicalUniqueIds(snapshot.snapshotChunkIds) ||
    !isNonNegativeSafeInteger(snapshot.dormantChunkCount) ||
    !Array.isArray(snapshot.visibleLods) ||
    !Array.isArray(snapshot.assignments) ||
    !isRecord(snapshot.budgetSummary) ||
    !Array.isArray(snapshot.transitions) ||
    typeof snapshot.signature !== "string" ||
    !snapshot.signature
  ) {
    fail("INVALID_SNAPSHOT", "World streaming snapshot has an invalid structure");
  }

  const typed = snapshot as unknown as WorldStreamingSnapshot;
  const bubble = typed.simulationBubble;
  if (
    typeof bubble.id !== "string" ||
    !bubble.id.trim() ||
    !isValidObserver(bubble.center) ||
    !Number.isFinite(bubble.fullUpdateRadius) ||
    bubble.fullUpdateRadius < 0 ||
    !Number.isFinite(bubble.snapshotRadius) ||
    bubble.snapshotRadius < bubble.fullUpdateRadius ||
    stableStringify(bubble.center) !== stableStringify(typed.observerAbsolutePosition)
  ) {
    fail("INVALID_SNAPSHOT", "World streaming snapshot has an invalid simulation bubble");
  }

  const assignments: WorldChunkStreamingAssignment[] = [];
  const assignmentIds = new Set<string>();
  const assignmentsById = new Map<string, WorldChunkStreamingAssignment>();
  for (const value of typed.assignments) {
    if (
      !isRecord(value) ||
      typeof value.chunkId !== "string" ||
      !value.chunkId ||
      typeof value.distanceMeters !== "number" ||
      !Number.isFinite(value.distanceMeters) ||
      value.distanceMeters < 0 ||
      !isNonNegativeSafeInteger(value.estimatedEntityCount) ||
      !isSimulationMode(value.requestedSimulationMode) ||
      !isSimulationMode(value.finalSimulationMode) ||
      !isRenderLod(value.requestedRenderLod) ||
      !isRenderLod(value.finalRenderLod) ||
      assignmentIds.has(value.chunkId)
    ) {
      fail("INVALID_SNAPSHOT", "World streaming snapshot contains malformed or duplicate assignments");
    }
    assignmentIds.add(value.chunkId);
    const assignment = value as unknown as WorldChunkStreamingAssignment;
    assignments.push(assignment);
    assignmentsById.set(assignment.chunkId, assignment);
  }
  if (
    assignments.length !== typed.registeredChunkCount ||
    assignments.some(
      (assignment, index) => index > 0 && codeUnitCompare(assignments[index - 1].chunkId, assignment.chunkId) >= 0
    )
  ) {
    fail("INVALID_SNAPSHOT", "World streaming assignments must be complete, unique, and canonically ordered");
  }

  const expectedFullIds = assignments
    .filter((assignment) => assignment.finalSimulationMode === "Full")
    .map((assignment) => assignment.chunkId);
  const expectedSnapshotIds = assignments
    .filter((assignment) => assignment.finalSimulationMode === "Snapshot")
    .map((assignment) => assignment.chunkId);
  if (
    !sameIds(typed.fullChunkIds, expectedFullIds) ||
    !sameIds(typed.snapshotChunkIds, expectedSnapshotIds) ||
    typed.dormantChunkCount !== typed.registeredChunkCount - expectedFullIds.length - expectedSnapshotIds.length
  ) {
    fail("INVALID_SNAPSHOT", "World streaming residency summaries do not match the assignment set");
  }

  const expectedVisibleLods = assignments
    .filter((assignment) => assignment.finalRenderLod !== "Culled")
    .map((assignment) => ({ chunkId: assignment.chunkId, lod: assignment.finalRenderLod }));
  const visibleIds = new Set<string>();
  const visibleLodsValid = typed.visibleLods.every((value, index) => {
    if (
      !isRecord(value) ||
      typeof value.chunkId !== "string" ||
      !assignmentIds.has(value.chunkId) ||
      visibleIds.has(value.chunkId) ||
      !isRenderLod(value.lod) ||
      (value as { readonly lod: unknown }).lod === "Culled" ||
      (index > 0 && codeUnitCompare(typed.visibleLods[index - 1].chunkId, value.chunkId) >= 0)
    ) {
      return false;
    }
    visibleIds.add(value.chunkId);
    return true;
  });
  if (
    !visibleLodsValid ||
    typed.visibleLods.length !== expectedVisibleLods.length ||
    typed.visibleLods.some(
      (value, index) =>
        value.chunkId !== expectedVisibleLods[index].chunkId || value.lod !== expectedVisibleLods[index].lod
    )
  ) {
    fail("INVALID_SNAPSHOT", "World streaming visible LODs do not match the assignment set");
  }

  const budgetSummary = typed.budgetSummary;
  if (!isRecord(budgetSummary.limits) || !Array.isArray(budgetSummary.rejections)) {
    fail("INVALID_SNAPSHOT", "World streaming snapshot has an invalid budget summary");
  }
  const limits = budgetSummary.limits;
  if (
    !isNonNegativeSafeInteger(limits.maxFullChunks) ||
    !isNonNegativeSafeInteger(limits.maxSnapshotChunks) ||
    !isNonNegativeSafeInteger(limits.maxVisibleChunks) ||
    (limits.maxEstimatedEntityCount !== undefined && !isNonNegativeSafeInteger(limits.maxEstimatedEntityCount))
  ) {
    fail("INVALID_SNAPSHOT", "World streaming snapshot has invalid budget limits");
  }
  const expectedEntityCount = assignments
    .filter((assignment) => assignment.finalSimulationMode !== "Dormant")
    .reduce((sum, assignment) => sum + assignment.estimatedEntityCount, 0);
  if (
    budgetSummary.fullChunkCount !== expectedFullIds.length ||
    budgetSummary.snapshotChunkCount !== expectedSnapshotIds.length ||
    budgetSummary.visibleChunkCount !== expectedVisibleLods.length ||
    budgetSummary.estimatedEntityCount !== expectedEntityCount
  ) {
    fail("INVALID_SNAPSHOT", "World streaming budget counts do not match the assignment set");
  }

  const rejections: WorldStreamingBudgetRejection[] = [];
  for (const value of budgetSummary.rejections) {
    if (
      !isRecord(value) ||
      typeof value.chunkId !== "string" ||
      !assignmentIds.has(value.chunkId) ||
      !rejectionReasons.includes(value.reason as WorldStreamingBudgetRejectionReason) ||
      (value.estimatedEntityCount !== undefined && !isNonNegativeSafeInteger(value.estimatedEntityCount))
    ) {
      fail("INVALID_SNAPSHOT", "World streaming snapshot contains an invalid budget rejection");
    }
    if (
      (value.domain === "Simulation" &&
        (!isSimulationMode(value.requestedState) || !isSimulationMode(value.finalState))) ||
      (value.domain === "Render" && (!isRenderLod(value.requestedState) || !isRenderLod(value.finalState))) ||
      (value.domain !== "Simulation" && value.domain !== "Render")
    ) {
      fail("INVALID_SNAPSHOT", "World streaming budget rejection states do not match their domain");
    }
    rejections.push(value as unknown as WorldStreamingBudgetRejection);
  }
  if (rejections.some((value, index) => index > 0 && compareRejections(rejections[index - 1], value) > 0)) {
    fail("INVALID_SNAPSHOT", "World streaming budget rejections are not canonically ordered");
  }

  const transitions: WorldStreamingTransitionEvent[] = [];
  const transitionDomains = new Set<string>();
  for (const value of typed.transitions) {
    if (!isRecord(value) || typeof value.chunkId !== "string" || !assignmentIds.has(value.chunkId)) {
      fail("INVALID_SNAPSHOT", "World streaming snapshot contains an invalid transition");
    }
    const assignment =
      assignmentsById.get(value.chunkId) ??
      fail("INVALID_SNAPSHOT", "World streaming transition has no matching assignment");
    if (
      value.domain === "Simulation" &&
      simulationTransitionTypes.includes(value.type as WorldStreamingSimulationTransitionType) &&
      isSimulationMode(value.previousMode) &&
      isSimulationMode(value.nextMode) &&
      value.previousMode !== value.nextMode
    ) {
      const transition = value as unknown as WorldStreamingSimulationTransitionEvent;
      const expected = transitionForSimulation(transition.chunkId, transition.previousMode, transition.nextMode);
      if (
        !expected ||
        transition.type !== expected.type ||
        transition.nextMode !== assignment.finalSimulationMode
      ) {
        fail("INVALID_SNAPSHOT", "World streaming simulation transition does not match its direction or final assignment");
      }
      transitions.push(transition);
    } else if (
      value.domain === "Render" &&
      renderTransitionTypes.includes(value.type as WorldStreamingRenderTransitionType) &&
      isRenderLod(value.previousLod) &&
      isRenderLod(value.nextLod) &&
      value.previousLod !== value.nextLod
    ) {
      const transition = value as unknown as WorldStreamingRenderTransitionEvent;
      const expected = transitionForRender(transition.chunkId, transition.previousLod, transition.nextLod);
      if (!expected || transition.type !== expected.type || transition.nextLod !== assignment.finalRenderLod) {
        fail("INVALID_SNAPSHOT", "World streaming render transition does not match its direction or final assignment");
      }
      transitions.push(transition);
    } else {
      fail("INVALID_SNAPSHOT", "World streaming transition states do not match their domain and type");
    }
    const domainKey = `${value.chunkId}:${value.domain}`;
    if (transitionDomains.has(domainKey)) {
      fail("INVALID_SNAPSHOT", "World streaming snapshot contains duplicate transition domains");
    }
    transitionDomains.add(domainKey);
  }
  if (transitions.some((value, index) => index > 0 && compareTransitions(transitions[index - 1], value) > 0)) {
    fail("INVALID_SNAPSHOT", "World streaming transitions are not canonically ordered");
  }

  if (typed.signature !== signatureForSnapshot(typed)) {
    fail("INVALID_SNAPSHOT", "World streaming snapshot signature does not match its canonical payload");
  }
};

export const diffWorldStreamingSnapshots = (
  previous: WorldStreamingSnapshot,
  next: WorldStreamingSnapshot
): readonly WorldStreamingTransitionEvent[] => {
  assertValidStreamingSnapshot(previous);
  assertValidStreamingSnapshot(next);
  if (previous.registrySignature !== next.registrySignature || previous.policySignature !== next.policySignature) {
    return fail("INCOMPATIBLE_PREVIOUS_SNAPSHOT", "Streaming snapshots have incompatible registry or policy signatures");
  }
  return deepFreeze([...diffAssignments(previous.assignments, next.assignments)]);
};

export const planWorldStreaming = (input: PlanWorldStreamingInput): WorldStreamingSnapshot => {
  if (!isRecord(input)) {
    return fail("INVALID_POLICY", "World streaming planner input is required");
  }
  assertValidRegistry(input.registry);
  assertValidObserver(input.observerAbsolutePosition);
  const policy = canonicalizePolicy(input.policy);
  const policySignature = fnv1aHash(stableStringify(policy));

  if (input.previousSnapshot) {
    assertValidStreamingSnapshot(input.previousSnapshot);
  }
  if (
    input.previousSnapshot &&
    (input.previousSnapshot.registrySignature !== input.registry.signature ||
      input.previousSnapshot.policySignature !== policySignature)
  ) {
    return fail(
      "INCOMPATIBLE_PREVIOUS_SNAPSHOT",
      "Previous streaming snapshot has a different registry or policy signature; create a new baseline without it"
    );
  }

  const observerAbsolutePosition = cloneAbsolutePosition(input.observerAbsolutePosition);
  const previousById = new Map(
    input.previousSnapshot?.assignments.map((assignment) => [assignment.chunkId, assignment]) ?? []
  );
  const assignments: MutableAssignment[] = input.registry.chunks.map((chunk) => {
    const distanceMeters = distanceToChunkBounds(observerAbsolutePosition.value, chunk);
    const previous = previousById.get(chunk.id);
    const nominalSimulation = nominalSimulationMode(distanceMeters, policy);
    const nominalRender = nominalRenderLod(distanceMeters, policy);
    return {
      chunkId: chunk.id,
      distanceMeters,
      estimatedEntityCount: chunk.entityIds.length,
      requestedSimulationMode: previous
        ? applyBandHysteresis(
            distanceMeters,
            previous.requestedSimulationMode,
            nominalSimulation,
            ["Full", "Snapshot", "Dormant"] as const,
            [policy.fullUpdateRadius, policy.snapshotRadius],
            policy.simulationHysteresisMeters
          )
        : nominalSimulation,
      finalSimulationMode: nominalSimulation,
      requestedRenderLod: previous
        ? applyBandHysteresis(
            distanceMeters,
            previous.requestedRenderLod,
            nominalRender,
            ["Near", "Medium", "Far", "Culled"] as const,
            [policy.nearLodRadius, policy.mediumLodRadius, policy.farLodRadius],
            policy.renderHysteresisMeters
          )
        : nominalRender,
      finalRenderLod: nominalRender
    };
  });

  const rejections: WorldStreamingBudgetRejection[] = [];
  const entityBudget = policy.budgets.maxEstimatedEntityCount;
  let fullChunkCount = 0;
  let snapshotChunkCount = 0;
  let visibleChunkCount = 0;
  let estimatedEntityCount = 0;

  const fullCandidates = assignments
    .filter((assignment) => assignment.requestedSimulationMode === "Full")
    .sort(compareCandidates);
  for (const assignment of fullCandidates) {
    const countExceeded = fullChunkCount >= policy.budgets.maxFullChunks;
    const entityExceeded =
      entityBudget !== undefined && estimatedEntityCount + assignment.estimatedEntityCount > entityBudget;
    if (countExceeded || entityExceeded) {
      assignment.finalSimulationMode = "Snapshot";
      rejections.push({
        chunkId: assignment.chunkId,
        domain: "Simulation",
        requestedState: "Full",
        finalState: "Snapshot",
        reason: countExceeded ? "FullChunkBudgetExceeded" : "EstimatedEntityBudgetExceeded",
        estimatedEntityCount: assignment.estimatedEntityCount
      });
      continue;
    }

    assignment.finalSimulationMode = "Full";
    fullChunkCount += 1;
    estimatedEntityCount += assignment.estimatedEntityCount;
  }

  const snapshotCandidates = assignments
    .filter(
      (assignment) =>
        assignment.requestedSimulationMode === "Snapshot" ||
        (assignment.requestedSimulationMode === "Full" && assignment.finalSimulationMode === "Snapshot")
    )
    .sort(compareCandidates);
  for (const assignment of snapshotCandidates) {
    const countExceeded = snapshotChunkCount >= policy.budgets.maxSnapshotChunks;
    const entityExceeded =
      entityBudget !== undefined && estimatedEntityCount + assignment.estimatedEntityCount > entityBudget;
    if (countExceeded || entityExceeded) {
      assignment.finalSimulationMode = "Dormant";
      rejections.push({
        chunkId: assignment.chunkId,
        domain: "Simulation",
        requestedState: "Snapshot",
        finalState: "Dormant",
        reason: countExceeded ? "SnapshotChunkBudgetExceeded" : "EstimatedEntityBudgetExceeded",
        estimatedEntityCount: assignment.estimatedEntityCount
      });
      continue;
    }

    assignment.finalSimulationMode = "Snapshot";
    snapshotChunkCount += 1;
    estimatedEntityCount += assignment.estimatedEntityCount;
  }

  for (const assignment of assignments) {
    if (assignment.requestedSimulationMode === "Dormant") {
      assignment.finalSimulationMode = "Dormant";
    }
  }

  const visibleCandidates = assignments
    .filter((assignment) => assignment.requestedRenderLod !== "Culled")
    .sort(compareCandidates);
  for (const assignment of visibleCandidates) {
    if (visibleChunkCount >= policy.budgets.maxVisibleChunks) {
      assignment.finalRenderLod = "Culled";
      rejections.push({
        chunkId: assignment.chunkId,
        domain: "Render",
        requestedState: assignment.requestedRenderLod,
        finalState: "Culled",
        reason: "VisibleChunkBudgetExceeded"
      });
      continue;
    }
    assignment.finalRenderLod = assignment.requestedRenderLod;
    visibleChunkCount += 1;
  }
  for (const assignment of assignments) {
    if (assignment.requestedRenderLod === "Culled") {
      assignment.finalRenderLod = "Culled";
    }
  }

  const canonicalAssignments: readonly WorldChunkStreamingAssignment[] = assignments
    .sort((a, b) => codeUnitCompare(a.chunkId, b.chunkId))
    .map((assignment) => ({ ...assignment }));
  const fullChunkIds = canonicalAssignments
    .filter((assignment) => assignment.finalSimulationMode === "Full")
    .map((assignment) => assignment.chunkId);
  const snapshotChunkIds = canonicalAssignments
    .filter((assignment) => assignment.finalSimulationMode === "Snapshot")
    .map((assignment) => assignment.chunkId);
  const visibleLods: readonly WorldStreamingVisibleLod[] = canonicalAssignments
    .filter(
      (assignment): assignment is WorldChunkStreamingAssignment & { readonly finalRenderLod: Exclude<RenderLodBand, "Culled"> } =>
        assignment.finalRenderLod !== "Culled"
    )
    .map((assignment) => ({ chunkId: assignment.chunkId, lod: assignment.finalRenderLod }));
  const budgetSummary: WorldStreamingBudgetSummary = {
    limits: { ...policy.budgets },
    fullChunkCount,
    snapshotChunkCount,
    visibleChunkCount,
    estimatedEntityCount,
    rejections: rejections.sort(compareRejections)
  };
  const simulationBubble = createSimulationBubble({
    id: policy.simulationBubbleId,
    center: observerAbsolutePosition,
    fullUpdateRadius: policy.fullUpdateRadius,
    snapshotRadius: policy.snapshotRadius
  });
  const transitions = input.previousSnapshot
    ? diffAssignments(input.previousSnapshot.assignments, canonicalAssignments)
    : Object.freeze([] as WorldStreamingTransitionEvent[]);

  const signaturePayload = {
    observerAbsolutePosition,
    simulationBubble,
    registrySignature: input.registry.signature,
    policySignature,
    registeredChunkCount: canonicalAssignments.length,
    fullChunkIds,
    snapshotChunkIds,
    dormantChunkCount: canonicalAssignments.length - fullChunkIds.length - snapshotChunkIds.length,
    visibleLods,
    assignments: canonicalAssignments,
    budgetSummary
  };
  const signature = signatureForSnapshot(signaturePayload);

  return deepFreeze({
    ...signaturePayload,
    transitions,
    signature
  });
};

export const serializeWorldStreamingSnapshot = (snapshot: WorldStreamingSnapshot): string => {
  assertValidStreamingSnapshot(snapshot);
  return stableStringify(snapshot);
};
