import { stableStringify } from "../core/hash";
import { vec3, type Vec3 } from "../core/vector";
import {
  createWorldChunkBounds,
  createWorldChunkMetadata,
  createWorldChunkRegistry,
  worldChunkIdFromCoordinate,
  type WorldChunkCoordinate,
  type WorldChunkId
} from "./chunkRegistry";
import { absoluteVelocity, createLocalPhysicsFrame, worldCoordinate } from "./frames";
import { shiftFloatingOriginProjection, type WorldEntityState } from "./floatingOrigin";
import {
  planWorldStreaming,
  serializeWorldStreamingSnapshot,
  type WorldChunkStreamingAssignment,
  type WorldStreamingBudgetSummary,
  type WorldStreamingPolicy,
  type WorldStreamingTransitionEvent,
  type WorldStreamingVisibleLod
} from "./worldStreaming";

export type WorldStreamingScenarioStepLabel = "initial" | "boundary" | "farther";

export interface WorldStreamingLodCounts {
  readonly Near: number;
  readonly Medium: number;
  readonly Far: number;
  readonly Culled: number;
}

export interface WorldStreamingScenarioStepResult {
  readonly label: WorldStreamingScenarioStepLabel;
  readonly observerAbsolutePosition: Vec3;
  readonly registeredChunkCount: number;
  readonly fullChunkIds: readonly WorldChunkId[];
  readonly snapshotChunkIds: readonly WorldChunkId[];
  readonly dormantChunkCount: number;
  readonly visibleLods: readonly WorldStreamingVisibleLod[];
  readonly lodCounts: WorldStreamingLodCounts;
  readonly assignments: readonly WorldChunkStreamingAssignment[];
  readonly budgetSummary: WorldStreamingBudgetSummary;
  readonly transitions: readonly WorldStreamingTransitionEvent[];
  readonly registrySignature: string;
  readonly policySignature: string;
  readonly signature: string;
  readonly canonicalSerializedSnapshot: string;
}

export interface WorldStreamingProjectionResult {
  readonly frameId: string;
  readonly originAbsolutePosition: Vec3;
  readonly observerAbsolutePosition: Vec3;
  readonly absoluteVelocity: Vec3;
  readonly projectedLocalPosition: Vec3;
  readonly registeredChunkCount: number;
  readonly chunkIds: readonly WorldChunkId[];
  readonly fullChunkIds: readonly WorldChunkId[];
  readonly snapshotChunkIds: readonly WorldChunkId[];
  readonly dormantChunkCount: number;
  readonly visibleLods: readonly WorldStreamingVisibleLod[];
  readonly assignments: readonly WorldChunkStreamingAssignment[];
  readonly budgetSummary: WorldStreamingBudgetSummary;
  readonly registrySignature: string;
  readonly policySignature: string;
  readonly signature: string;
}

export interface WorldStreamingFloatingOriginResult {
  readonly before: WorldStreamingProjectionResult;
  readonly after: WorldStreamingProjectionResult;
  readonly invariants: {
    readonly projectedLocalPositionChanged: boolean;
    readonly absoluteObserverPositionUnchanged: boolean;
    readonly absoluteVelocityUnchanged: boolean;
    readonly registryContentsUnchanged: boolean;
    readonly assignmentsUnchanged: boolean;
    readonly residencyUnchanged: boolean;
    readonly lodUnchanged: boolean;
    readonly budgetsUnchanged: boolean;
    readonly registrySignatureUnchanged: boolean;
    readonly policySignatureUnchanged: boolean;
    readonly streamingSignatureUnchanged: boolean;
  };
}

export interface WorldStreamingScenarioResult {
  readonly rendererOwnsWorldTruth: false;
  readonly chunkSizeMeters: number;
  readonly registeredChunkCount: number;
  readonly chunkIds: readonly WorldChunkId[];
  readonly registrySignature: string;
  readonly policy: WorldStreamingPolicy;
  readonly policySignature: string;
  readonly steps: readonly WorldStreamingScenarioStepResult[];
  readonly floatingOrigin: WorldStreamingFloatingOriginResult;
}

const CHUNK_SIZE_METERS = 256;

const CHUNK_COORDINATES: readonly WorldChunkCoordinate[] = Object.freeze([
  { x: -3, y: 0, z: 0 },
  { x: -2, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 2, y: 0, z: 0 },
  { x: 3, y: 0, z: 0 }
]);

const POLICY: WorldStreamingPolicy = Object.freeze({
  simulationBubbleId: "browser-world-streaming-scenario",
  fullUpdateRadius: 64,
  snapshotRadius: 300,
  nearLodRadius: 160,
  mediumLodRadius: 400,
  farLodRadius: 700,
  simulationHysteresisMeters: 16,
  renderHysteresisMeters: 16,
  budgets: Object.freeze({
    maxFullChunks: 1,
    maxSnapshotChunks: 2,
    maxVisibleChunks: 7,
    maxEstimatedEntityCount: 6
  })
});

const OBSERVER_STEPS: readonly { readonly label: WorldStreamingScenarioStepLabel; readonly position: Vec3 }[] =
  Object.freeze([
    { label: "initial", position: vec3(0, 0, 0) },
    { label: "boundary", position: vec3(240, 0, 0) },
    { label: "farther", position: vec3(520, 0, 0) }
  ]);

const sameJson = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);

const countLods = (assignments: readonly WorldChunkStreamingAssignment[]): WorldStreamingLodCounts => ({
  Near: assignments.filter((assignment) => assignment.finalRenderLod === "Near").length,
  Medium: assignments.filter((assignment) => assignment.finalRenderLod === "Medium").length,
  Far: assignments.filter((assignment) => assignment.finalRenderLod === "Far").length,
  Culled: assignments.filter((assignment) => assignment.finalRenderLod === "Culled").length
});

const createScenarioRegistry = () => {
  const registry = createWorldChunkRegistry({ chunkSizeMeters: CHUNK_SIZE_METERS });
  CHUNK_COORDINATES.forEach((coordinate, index) => {
    const id = worldChunkIdFromCoordinate(coordinate);
    registry.register(
      createWorldChunkMetadata({
        id,
        coordinate,
        bounds: createWorldChunkBounds(coordinate, CHUNK_SIZE_METERS),
        entityIds: [`entity:${id}:a`, `entity:${id}:b`],
        renderBatchKeys: [`batch:${index % 2}`, `batch:${id}`],
        revision: index + 1,
        importance: index,
        category: coordinate.y === 1 ? "orbital-marker" : "shipping-lane"
      })
    );
  });
  return registry.snapshot();
};

const projectionResult = (
  frameId: string,
  originAbsolutePosition: Vec3,
  observer: WorldEntityState,
  projectedLocalPosition: Vec3,
  chunkIds: readonly WorldChunkId[],
  snapshot: ReturnType<typeof planWorldStreaming>
): WorldStreamingProjectionResult => ({
  frameId,
  originAbsolutePosition,
  observerAbsolutePosition: observer.absolutePosition.value,
  absoluteVelocity: observer.absoluteVelocity.value,
  projectedLocalPosition,
  registeredChunkCount: snapshot.registeredChunkCount,
  chunkIds,
  fullChunkIds: snapshot.fullChunkIds,
  snapshotChunkIds: snapshot.snapshotChunkIds,
  dormantChunkCount: snapshot.dormantChunkCount,
  visibleLods: snapshot.visibleLods,
  assignments: snapshot.assignments,
  budgetSummary: snapshot.budgetSummary,
  registrySignature: snapshot.registrySignature,
  policySignature: snapshot.policySignature,
  signature: snapshot.signature
});

export const runWorldStreamingScenario = (): WorldStreamingScenarioResult => {
  const registry = createScenarioRegistry();
  let previousSnapshot: ReturnType<typeof planWorldStreaming> | undefined;
  const steps: WorldStreamingScenarioStepResult[] = OBSERVER_STEPS.map(({ label, position }) => {
    const snapshot = planWorldStreaming({
      registry,
      observerAbsolutePosition: worldCoordinate(position),
      policy: POLICY,
      ...(previousSnapshot ? { previousSnapshot } : {})
    });
    previousSnapshot = snapshot;
    return {
      label,
      observerAbsolutePosition: snapshot.observerAbsolutePosition.value,
      registeredChunkCount: snapshot.registeredChunkCount,
      fullChunkIds: snapshot.fullChunkIds,
      snapshotChunkIds: snapshot.snapshotChunkIds,
      dormantChunkCount: snapshot.dormantChunkCount,
      visibleLods: snapshot.visibleLods,
      lodCounts: countLods(snapshot.assignments),
      assignments: snapshot.assignments,
      budgetSummary: snapshot.budgetSummary,
      transitions: snapshot.transitions,
      registrySignature: snapshot.registrySignature,
      policySignature: snapshot.policySignature,
      signature: snapshot.signature,
      canonicalSerializedSnapshot: serializeWorldStreamingSnapshot(snapshot)
    };
  });

  const absoluteObserver = worldCoordinate(vec3(520, 0, 0));
  const observer: WorldEntityState = {
    id: "streaming-observer",
    absolutePosition: absoluteObserver,
    absoluteVelocity: absoluteVelocity(vec3(12, 0, -3))
  };
  const beforeFrame = createLocalPhysicsFrame("streaming-local-before", vec3(0, 0, 0));
  const afterFrame = createLocalPhysicsFrame("streaming-local-after", vec3(512, 0, 0));
  const projectionShift = shiftFloatingOriginProjection([observer], beforeFrame, afterFrame);
  const beforeSnapshot = planWorldStreaming({ registry, observerAbsolutePosition: absoluteObserver, policy: POLICY });
  const afterSnapshot = planWorldStreaming({ registry, observerAbsolutePosition: absoluteObserver, policy: POLICY });
  const before = projectionResult(
    beforeFrame.id,
    beforeFrame.originAbsolutePosition,
    observer,
    projectionShift.before[0].localPosition.value,
    registry.chunks.map((chunk) => chunk.id),
    beforeSnapshot
  );
  const after = projectionResult(
    afterFrame.id,
    afterFrame.originAbsolutePosition,
    observer,
    projectionShift.after[0].localPosition.value,
    registry.chunks.map((chunk) => chunk.id),
    afterSnapshot
  );

  return {
    rendererOwnsWorldTruth: false,
    chunkSizeMeters: registry.chunkSizeMeters,
    registeredChunkCount: registry.chunks.length,
    chunkIds: registry.chunks.map((chunk) => chunk.id),
    registrySignature: registry.signature,
    policy: POLICY,
    policySignature: steps[0].policySignature,
    steps,
    floatingOrigin: {
      before,
      after,
      invariants: {
        projectedLocalPositionChanged: !sameJson(before.projectedLocalPosition, after.projectedLocalPosition),
        absoluteObserverPositionUnchanged: sameJson(before.observerAbsolutePosition, after.observerAbsolutePosition),
        absoluteVelocityUnchanged: sameJson(before.absoluteVelocity, after.absoluteVelocity),
        registryContentsUnchanged:
          before.registeredChunkCount === after.registeredChunkCount && sameJson(before.chunkIds, after.chunkIds),
        assignmentsUnchanged: sameJson(before.assignments, after.assignments),
        residencyUnchanged:
          sameJson(before.fullChunkIds, after.fullChunkIds) &&
          sameJson(before.snapshotChunkIds, after.snapshotChunkIds) &&
          before.dormantChunkCount === after.dormantChunkCount,
        lodUnchanged: sameJson(before.visibleLods, after.visibleLods),
        budgetsUnchanged: sameJson(before.budgetSummary, after.budgetSummary),
        registrySignatureUnchanged: before.registrySignature === after.registrySignature,
        policySignatureUnchanged: before.policySignature === after.policySignature,
        streamingSignatureUnchanged: before.signature === after.signature
      }
    }
  };
};
