import { describe, expect, it } from "vitest";
import { vec3 } from "../../src/core/vector";
import {
  createWorldChunkBounds,
  createWorldChunkMetadata,
  createWorldChunkRegistry,
  worldChunkIdFromCoordinate,
  type WorldChunkCoordinate,
  type WorldChunkRegistrySnapshot
} from "../../src/world/chunkRegistry";
import { absoluteToLocal, createLocalPhysicsFrame, worldCoordinate } from "../../src/world/frames";
import {
  WorldStreamingError,
  diffWorldStreamingSnapshots,
  planWorldStreaming,
  serializeWorldStreamingSnapshot,
  type WorldStreamingPolicy,
  type WorldStreamingSnapshot
} from "../../src/world/worldStreaming";

const CHUNK_SIZE = 10;

const DEFAULT_POLICY: WorldStreamingPolicy = {
  simulationBubbleId: "player-bubble",
  fullUpdateRadius: 5,
  snapshotRadius: 20,
  nearLodRadius: 1,
  mediumLodRadius: 7,
  farLodRadius: 20,
  simulationHysteresisMeters: 0,
  renderHysteresisMeters: 0,
  budgets: {
    maxFullChunks: 100,
    maxSnapshotChunks: 100,
    maxVisibleChunks: 100
  }
};

const registryFor = (
  chunks: readonly {
    readonly coordinate: WorldChunkCoordinate;
    readonly entityIds?: readonly string[];
  }[],
  reverse = false
): WorldChunkRegistrySnapshot => {
  const registry = createWorldChunkRegistry({ chunkSizeMeters: CHUNK_SIZE });
  const entries = reverse ? [...chunks].reverse() : chunks;
  for (const chunk of entries) {
    registry.register(
      createWorldChunkMetadata({
        id: worldChunkIdFromCoordinate(chunk.coordinate),
        coordinate: chunk.coordinate,
        bounds: createWorldChunkBounds(chunk.coordinate, CHUNK_SIZE),
        entityIds: chunk.entityIds ?? [],
        renderBatchKeys: [],
        revision: 0
      })
    );
  }
  return registry.snapshot();
};

const plan = (
  registry: WorldChunkRegistrySnapshot,
  observerX = 0,
  policy: WorldStreamingPolicy = DEFAULT_POLICY,
  previousSnapshot?: WorldStreamingSnapshot
): WorldStreamingSnapshot =>
  planWorldStreaming({
    registry,
    observerAbsolutePosition: worldCoordinate(vec3(observerX, 0, 0)),
    policy,
    previousSnapshot
  });

const expectStreamingError = (action: () => unknown, code: WorldStreamingError["code"]): void => {
  try {
    action();
    throw new Error(`Expected WorldStreamingError ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(WorldStreamingError);
    expect((error as WorldStreamingError).code).toBe(code);
  }
};

describe("world streaming nominal planning", () => {
  it("keeps Full/Snapshot/Dormant independent from Near/Medium/Far/Culled", () => {
    const registry = registryFor([
      { coordinate: { x: 0, y: 0, z: 0 } },
      { coordinate: { x: 1, y: 0, z: 0 } },
      { coordinate: { x: 2, y: 0, z: 0 } },
      { coordinate: { x: 4, y: 0, z: 0 } }
    ]);

    const snapshot = plan(registry);

    expect(
      snapshot.assignments.map((assignment) => [
        assignment.chunkId,
        assignment.distanceMeters,
        assignment.finalSimulationMode,
        assignment.finalRenderLod
      ])
    ).toEqual([
      ["chunk:0:0:0", 0, "Full", "Near"],
      ["chunk:1:0:0", 5, "Full", "Medium"],
      ["chunk:2:0:0", 15, "Snapshot", "Far"],
      ["chunk:4:0:0", 35, "Dormant", "Culled"]
    ]);
    expect(snapshot.registeredChunkCount).toBe(4);
    expect(snapshot.fullChunkIds).toEqual(["chunk:0:0:0", "chunk:1:0:0"]);
    expect(snapshot.snapshotChunkIds).toEqual(["chunk:2:0:0"]);
    expect(snapshot.dormantChunkCount).toBe(1);
    expect(snapshot.visibleLods).toEqual([
      { chunkId: "chunk:0:0:0", lod: "Near" },
      { chunkId: "chunk:1:0:0", lod: "Medium" },
      { chunkId: "chunk:2:0:0", lod: "Far" }
    ]);
    expect(snapshot.transitions).toEqual([]);
  });

  it("uses minimum observer-to-AABB distance on multiple axes without squared-distance overflow", () => {
    const registry = registryFor([{ coordinate: { x: 1, y: 1, z: 1 } }]);
    const snapshot = plan(registry);

    expect(snapshot.assignments[0].distanceMeters).toBeCloseTo(Math.hypot(5, 5, 5));
    expect(snapshot.assignments[0].finalSimulationMode).toBe("Snapshot");
    expect(snapshot.assignments[0].finalRenderLod).toBe("Far");
  });

  it("deep-freezes canonical snapshots and never exposes renderer ownership", () => {
    const snapshot = plan(registryFor([{ coordinate: { x: 0, y: 0, z: 0 } }]));

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.observerAbsolutePosition.value)).toBe(true);
    expect(Object.isFrozen(snapshot.assignments)).toBe(true);
    expect(Object.isFrozen(snapshot.assignments[0])).toBe(true);
    expect(Object.isFrozen(snapshot.budgetSummary.rejections)).toBe(true);
    expect("rendererOwnsWorldTruth" in snapshot).toBe(false);
    expect("localFrame" in snapshot).toBe(false);
    expect("timestamp" in snapshot).toBe(false);
  });
});

describe("world streaming budgets", () => {
  it("allocates by distance then code-unit ID independent of registration order", () => {
    const chunks = [
      { coordinate: { x: 1, y: 0, z: 0 } },
      { coordinate: { x: -1, y: 0, z: 0 } },
      { coordinate: { x: 0, y: 0, z: 0 } }
    ] as const;
    const policy: WorldStreamingPolicy = {
      ...DEFAULT_POLICY,
      budgets: { maxFullChunks: 1, maxSnapshotChunks: 1, maxVisibleChunks: 1 }
    };

    const forward = plan(registryFor(chunks), 0, policy);
    const reversed = plan(registryFor(chunks, true), 0, policy);

    expect(forward).toEqual(reversed);
    expect(forward.fullChunkIds).toEqual(["chunk:0:0:0"]);
    expect(forward.snapshotChunkIds).toEqual(["chunk:-1:0:0"]);
    expect(forward.assignments.find((assignment) => assignment.chunkId === "chunk:1:0:0")?.finalSimulationMode).toBe(
      "Dormant"
    );
    expect(forward.visibleLods).toEqual([{ chunkId: "chunk:0:0:0", lod: "Near" }]);
    expect(forward.budgetSummary).toMatchObject({
      fullChunkCount: 1,
      snapshotChunkCount: 1,
      visibleChunkCount: 1,
      estimatedEntityCount: 0
    });
    expect(forward.budgetSummary.rejections.map((rejection) => [rejection.chunkId, rejection.reason])).toEqual([
      ["chunk:-1:0:0", "FullChunkBudgetExceeded"],
      ["chunk:1:0:0", "FullChunkBudgetExceeded"],
      ["chunk:1:0:0", "SnapshotChunkBudgetExceeded"],
      ["chunk:-1:0:0", "VisibleChunkBudgetExceeded"],
      ["chunk:1:0:0", "VisibleChunkBudgetExceeded"]
    ]);
  });

  it("skips oversized entity candidates and continues allocating smaller later candidates", () => {
    const registry = registryFor([
      { coordinate: { x: 0, y: 0, z: 0 }, entityIds: ["a", "b", "c"] },
      { coordinate: { x: 1, y: 0, z: 0 }, entityIds: ["small", "small"] }
    ]);
    const policy: WorldStreamingPolicy = {
      ...DEFAULT_POLICY,
      budgets: {
        maxFullChunks: 2,
        maxSnapshotChunks: 2,
        maxVisibleChunks: 2,
        maxEstimatedEntityCount: 2
      }
    };

    const snapshot = plan(registry, 0, policy);

    expect(snapshot.fullChunkIds).toEqual(["chunk:1:0:0"]);
    expect(snapshot.assignments.find((assignment) => assignment.chunkId === "chunk:0:0:0")).toMatchObject({
      estimatedEntityCount: 3,
      requestedSimulationMode: "Full",
      finalSimulationMode: "Dormant"
    });
    expect(snapshot.budgetSummary.estimatedEntityCount).toBe(1);
    expect(snapshot.budgetSummary.rejections.filter((rejection) => rejection.reason === "EstimatedEntityBudgetExceeded")).toEqual([
      {
        chunkId: "chunk:0:0:0",
        domain: "Simulation",
        requestedState: "Full",
        finalState: "Snapshot",
        reason: "EstimatedEntityBudgetExceeded",
        estimatedEntityCount: 3
      },
      {
        chunkId: "chunk:0:0:0",
        domain: "Simulation",
        requestedState: "Snapshot",
        finalState: "Dormant",
        reason: "EstimatedEntityBudgetExceeded",
        estimatedEntityCount: 3
      }
    ]);
  });

  it("applies visible budgeting independently from simulation residency", () => {
    const registry = registryFor([
      { coordinate: { x: 0, y: 0, z: 0 } },
      { coordinate: { x: 1, y: 0, z: 0 } },
      { coordinate: { x: 2, y: 0, z: 0 } }
    ]);
    const snapshot = plan(registry, 0, {
      ...DEFAULT_POLICY,
      budgets: { maxFullChunks: 3, maxSnapshotChunks: 3, maxVisibleChunks: 1 }
    });

    expect(snapshot.fullChunkIds).toEqual(["chunk:0:0:0", "chunk:1:0:0"]);
    expect(snapshot.snapshotChunkIds).toEqual(["chunk:2:0:0"]);
    expect(snapshot.visibleLods).toEqual([{ chunkId: "chunk:0:0:0", lod: "Near" }]);
    expect(snapshot.budgetSummary.rejections).toEqual([
      {
        chunkId: "chunk:1:0:0",
        domain: "Render",
        requestedState: "Medium",
        finalState: "Culled",
        reason: "VisibleChunkBudgetExceeded"
      },
      {
        chunkId: "chunk:2:0:0",
        domain: "Render",
        requestedState: "Far",
        finalState: "Culled",
        reason: "VisibleChunkBudgetExceeded"
      }
    ]);
  });

  it("supports explicit zero budgets", () => {
    const snapshot = plan(registryFor([{ coordinate: { x: 0, y: 0, z: 0 }, entityIds: ["entity"] }]), 0, {
      ...DEFAULT_POLICY,
      budgets: { maxFullChunks: 0, maxSnapshotChunks: 0, maxVisibleChunks: 0, maxEstimatedEntityCount: 0 }
    });

    expect(snapshot.fullChunkIds).toEqual([]);
    expect(snapshot.snapshotChunkIds).toEqual([]);
    expect(snapshot.dormantChunkCount).toBe(1);
    expect(snapshot.visibleLods).toEqual([]);
    expect(snapshot.budgetSummary).toMatchObject({
      fullChunkCount: 0,
      snapshotChunkCount: 0,
      visibleChunkCount: 0,
      estimatedEntityCount: 0
    });
    expect(snapshot.budgetSummary.rejections).toHaveLength(3);
  });
});

describe("world streaming hysteresis and transitions", () => {
  const hysteresisPolicy: WorldStreamingPolicy = {
    ...DEFAULT_POLICY,
    fullUpdateRadius: 10,
    snapshotRadius: 30,
    nearLodRadius: 10,
    mediumLodRadius: 20,
    farLodRadius: 30,
    simulationHysteresisMeters: 2,
    renderHysteresisMeters: 2
  };

  it("uses previous requested bands so boundary jitter does not churn", () => {
    const registry = registryFor([{ coordinate: { x: 0, y: 0, z: 0 } }]);
    const baseline = plan(registry, 15, hysteresisPolicy);
    const jitter = plan(registry, 16, hysteresisPolicy, baseline);
    const exactExit = plan(registry, 17, hysteresisPolicy, jitter);

    expect(baseline.assignments[0]).toMatchObject({ requestedSimulationMode: "Full", requestedRenderLod: "Near" });
    expect(jitter.assignments[0]).toMatchObject({ requestedSimulationMode: "Full", requestedRenderLod: "Near" });
    expect(exactExit.assignments[0]).toMatchObject({ requestedSimulationMode: "Full", requestedRenderLod: "Near" });
    expect(jitter.transitions).toEqual([]);
    expect(exactExit.transitions).toEqual([]);
  });

  it("emits each clear crossing exactly once and no events for identical final states", () => {
    const registry = registryFor([{ coordinate: { x: 0, y: 0, z: 0 } }]);
    const baseline = plan(registry, 15, hysteresisPolicy);
    const crossed = plan(registry, 18, hysteresisPolicy, baseline);
    const stationary = plan(registry, 18, hysteresisPolicy, crossed);
    const promoted = plan(registry, 12, hysteresisPolicy, stationary);

    expect(crossed.transitions.map((event) => event.type)).toEqual(["ChunkDemotedToSnapshot", "ChunkChangedLod"]);
    expect(crossed.assignments[0]).toMatchObject({ requestedSimulationMode: "Snapshot", requestedRenderLod: "Medium" });
    expect(stationary.transitions).toEqual([]);
    expect(promoted.transitions.map((event) => event.type)).toEqual(["ChunkPromotedToFull", "ChunkChangedLod"]);
  });

  it("traverses inward boundaries one at a time and stops at Snapshot/Medium at distance 9", () => {
    const registry = registryFor([{ coordinate: { x: 0, y: 0, z: 0 } }]);
    const dormant = plan(registry, 100, hysteresisPolicy);
    const movedInward = plan(registry, 14, hysteresisPolicy, dormant);

    expect(movedInward.assignments[0]).toMatchObject({
      distanceMeters: 9,
      requestedSimulationMode: "Snapshot",
      finalSimulationMode: "Snapshot",
      requestedRenderLod: "Medium",
      finalRenderLod: "Medium"
    });
    expect(movedInward.transitions.map((event) => event.type)).toEqual([
      "ChunkActivated",
      "ChunkEnteredRenderRange"
    ]);
  });

  it("traverses outward boundaries one at a time and stops at Snapshot/Far at distance 31", () => {
    const registry = registryFor([{ coordinate: { x: 0, y: 0, z: 0 } }]);
    const full = plan(registry, 0, hysteresisPolicy);
    const movedOutward = plan(registry, 36, hysteresisPolicy, full);

    expect(movedOutward.assignments[0]).toMatchObject({
      distanceMeters: 31,
      requestedSimulationMode: "Snapshot",
      finalSimulationMode: "Snapshot",
      requestedRenderLod: "Far",
      finalRenderLod: "Far"
    });
    expect(movedOutward.transitions.map((event) => event.type)).toEqual([
      "ChunkDemotedToSnapshot",
      "ChunkChangedLod"
    ]);
  });

  it("collapses direct multi-band teleports to one final event per domain", () => {
    const registry = registryFor([{ coordinate: { x: 0, y: 0, z: 0 } }]);
    const baseline = plan(registry, 0, hysteresisPolicy);
    const teleported = plan(registry, 100, hysteresisPolicy, baseline);

    expect(teleported.assignments[0]).toMatchObject({
      requestedSimulationMode: "Dormant",
      finalSimulationMode: "Dormant",
      requestedRenderLod: "Culled",
      finalRenderLod: "Culled"
    });
    expect(teleported.transitions.map((event) => event.type)).toEqual(["ChunkBecameDormant", "ChunkLeftRenderRange"]);
    expect(diffWorldStreamingSnapshots(baseline, teleported)).toEqual(teleported.transitions);
  });

  it("sorts events by chunk ID and then fixed event type", () => {
    const registry = registryFor([
      { coordinate: { x: 1, y: 0, z: 0 } },
      { coordinate: { x: -1, y: 0, z: 0 } }
    ]);
    const baseline = plan(registry, 0, hysteresisPolicy);
    const teleported = plan(registry, 100, hysteresisPolicy, baseline);

    expect(teleported.transitions.map((event) => [event.chunkId, event.type])).toEqual([
      ["chunk:-1:0:0", "ChunkBecameDormant"],
      ["chunk:-1:0:0", "ChunkLeftRenderRange"],
      ["chunk:1:0:0", "ChunkBecameDormant"],
      ["chunk:1:0:0", "ChunkLeftRenderRange"]
    ]);
  });

  it("orders activation and dormancy transitions across multiple moving chunks", () => {
    const registry = registryFor([
      { coordinate: { x: 0, y: 0, z: 0 } },
      { coordinate: { x: 10, y: 0, z: 0 } }
    ]);
    const baseline = plan(registry, 0, hysteresisPolicy);
    const moved = plan(registry, 100, hysteresisPolicy, baseline);

    expect(moved.transitions.map((event) => [event.chunkId, event.type])).toEqual([
      ["chunk:0:0:0", "ChunkBecameDormant"],
      ["chunk:0:0:0", "ChunkLeftRenderRange"],
      ["chunk:10:0:0", "ChunkActivated"],
      ["chunk:10:0:0", "ChunkEnteredRenderRange"]
    ]);
  });
});

describe("world streaming validation and canonical output", () => {
  it("rejects invalid radii, overlapping hysteresis, budgets, observers, and mutable registries", () => {
    const registry = registryFor([{ coordinate: { x: 0, y: 0, z: 0 } }]);

    expectStreamingError(
      () => plan(registry, 0, { ...DEFAULT_POLICY, fullUpdateRadius: DEFAULT_POLICY.snapshotRadius }),
      "INVALID_POLICY"
    );
    expectStreamingError(
      () => plan(registry, 0, { ...DEFAULT_POLICY, simulationHysteresisMeters: 7.5 }),
      "INVALID_POLICY"
    );
    expectStreamingError(
      () => plan(registry, 0, { ...DEFAULT_POLICY, budgets: { ...DEFAULT_POLICY.budgets, maxVisibleChunks: -1 } }),
      "INVALID_BUDGETS"
    );
    expectStreamingError(
      () =>
        planWorldStreaming({
          registry,
          observerAbsolutePosition: { ...worldCoordinate(vec3()), value: vec3(Number.NaN, 0, 0) },
          policy: DEFAULT_POLICY
        }),
      "INVALID_OBSERVER"
    );
    expectStreamingError(
      () =>
        planWorldStreaming({
          registry: { ...registry } as WorldChunkRegistrySnapshot,
          observerAbsolutePosition: worldCoordinate(vec3()),
          policy: DEFAULT_POLICY
        }),
      "INVALID_REGISTRY"
    );
  });

  it("rejects incompatible previous registry and policy signatures explicitly", () => {
    const registry = registryFor([{ coordinate: { x: 0, y: 0, z: 0 } }]);
    const previous = plan(registry);
    const changedRegistry = registryFor([
      { coordinate: { x: 0, y: 0, z: 0 } },
      { coordinate: { x: 1, y: 0, z: 0 } }
    ]);

    expectStreamingError(() => plan(changedRegistry, 0, DEFAULT_POLICY, previous), "INCOMPATIBLE_PREVIOUS_SNAPSHOT");
    expectStreamingError(
      () => plan(registry, 0, { ...DEFAULT_POLICY, farLodRadius: 21 }, previous),
      "INCOMPATIBLE_PREVIOUS_SNAPSHOT"
    );
  });

  it("rejects stale signatures and invalid requested/final bands in previous and diff snapshots", () => {
    const registry = registryFor([{ coordinate: { x: 0, y: 0, z: 0 } }]);
    const snapshot = plan(registry);
    const stale = { ...snapshot, signature: "00000000" } as WorldStreamingSnapshot;
    const invalidBand = {
      ...snapshot,
      assignments: [
        {
          ...snapshot.assignments[0],
          requestedRenderLod: "Invalid"
        }
      ]
    } as unknown as WorldStreamingSnapshot;

    expectStreamingError(() => plan(registry, 0, DEFAULT_POLICY, stale), "INVALID_SNAPSHOT");
    expectStreamingError(() => diffWorldStreamingSnapshots(snapshot, stale), "INVALID_SNAPSHOT");
    expectStreamingError(() => plan(registry, 0, DEFAULT_POLICY, invalidBand), "INVALID_SNAPSHOT");
    expectStreamingError(() => diffWorldStreamingSnapshots(snapshot, invalidBand), "INVALID_SNAPSHOT");
  });

  it("rejects duplicate assignments and missing residency IDs as invalid snapshots", () => {
    const registry = registryFor([{ coordinate: { x: 0, y: 0, z: 0 } }]);
    const snapshot = plan(registry);
    const duplicateAssignments = {
      ...snapshot,
      registeredChunkCount: 2,
      assignments: [snapshot.assignments[0], snapshot.assignments[0]]
    } as WorldStreamingSnapshot;
    const missingFullId = { ...snapshot, fullChunkIds: [] } as unknown as WorldStreamingSnapshot;

    expectStreamingError(() => plan(registry, 0, DEFAULT_POLICY, duplicateAssignments), "INVALID_SNAPSHOT");
    expectStreamingError(() => diffWorldStreamingSnapshots(snapshot, duplicateAssignments), "INVALID_SNAPSHOT");
    expectStreamingError(() => plan(registry, 0, DEFAULT_POLICY, missingFullId), "INVALID_SNAPSHOT");
    expectStreamingError(() => diffWorldStreamingSnapshots(snapshot, missingFullId), "INVALID_SNAPSHOT");
  });

  it("keeps transition history outside snapshot signatures while accepting well-formed transitions", () => {
    const registry = registryFor([{ coordinate: { x: 0, y: 0, z: 0 } }]);
    const snapshot = plan(registry);
    const withTransitionHistory = {
      ...snapshot,
      transitions: [
        {
          type: "ChunkActivated",
          domain: "Simulation",
          chunkId: snapshot.assignments[0].chunkId,
          previousMode: "Dormant",
          nextMode: "Full"
        }
      ]
    } as WorldStreamingSnapshot;

    expect(withTransitionHistory.signature).toBe(snapshot.signature);
    expect(serializeWorldStreamingSnapshot(withTransitionHistory)).toContain("ChunkActivated");
  });

  it("rejects transition types that contradict their state direction in every public snapshot consumer", () => {
    const registry = registryFor([{ coordinate: { x: 0, y: 0, z: 0 } }]);
    const snapshot = plan(registry);
    const wrongTypeForDirection = {
      ...snapshot,
      transitions: [
        {
          type: "ChunkBecameDormant",
          domain: "Simulation",
          chunkId: snapshot.assignments[0].chunkId,
          previousMode: "Dormant",
          nextMode: "Full"
        }
      ]
    } as WorldStreamingSnapshot;

    expectStreamingError(() => plan(registry, 0, DEFAULT_POLICY, wrongTypeForDirection), "INVALID_SNAPSHOT");
    expectStreamingError(() => diffWorldStreamingSnapshots(snapshot, wrongTypeForDirection), "INVALID_SNAPSHOT");
    expectStreamingError(() => serializeWorldStreamingSnapshot(wrongTypeForDirection), "INVALID_SNAPSHOT");
  });

  it("rejects transitions whose next state does not match the chunk's final assignment", () => {
    const registry = registryFor([{ coordinate: { x: 0, y: 0, z: 0 } }]);
    const snapshot = plan(registry);
    const mismatchedNextState = {
      ...snapshot,
      transitions: [
        {
          type: "ChunkActivated",
          domain: "Simulation",
          chunkId: snapshot.assignments[0].chunkId,
          previousMode: "Dormant",
          nextMode: "Snapshot"
        }
      ]
    } as WorldStreamingSnapshot;

    expectStreamingError(() => plan(registry, 0, DEFAULT_POLICY, mismatchedNextState), "INVALID_SNAPSHOT");
    expectStreamingError(() => diffWorldStreamingSnapshots(snapshot, mismatchedNextState), "INVALID_SNAPSHOT");
    expectStreamingError(() => serializeWorldStreamingSnapshot(mismatchedNextState), "INVALID_SNAPSHOT");
  });

  it("produces byte-equivalent canonical JSON independent of registration order and repeated runs", () => {
    const chunks = [
      { coordinate: { x: 2, y: 0, z: 0 }, entityIds: ["z", "a", "z"] },
      { coordinate: { x: -1, y: 0, z: 0 }, entityIds: ["b"] },
      { coordinate: { x: 0, y: 0, z: 0 } }
    ] as const;
    const first = plan(registryFor(chunks));
    const repeated = plan(registryFor(chunks));
    const reversed = plan(registryFor(chunks, true));

    expect(first.signature).toBe(repeated.signature);
    expect(first.signature).toBe(reversed.signature);
    expect(serializeWorldStreamingSnapshot(first)).toBe(serializeWorldStreamingSnapshot(repeated));
    expect(serializeWorldStreamingSnapshot(first)).toBe(serializeWorldStreamingSnapshot(reversed));
    expect(JSON.parse(serializeWorldStreamingSnapshot(first))).toEqual(first);
  });

  it("is floating-origin invariant because only the absolute observer enters the planner", () => {
    const registry = registryFor([
      { coordinate: { x: 100_000_000, y: 0, z: -100_000_000 } },
      { coordinate: { x: 100_000_001, y: 0, z: -100_000_000 } }
    ]);
    const absoluteObserver = worldCoordinate(vec3(1_000_000_000, 0, -1_000_000_000));
    const frameA = createLocalPhysicsFrame("local-a", vec3(999_999_900, 0, -1_000_000_100));
    const frameB = createLocalPhysicsFrame("local-b", vec3(1_000_000_000, 0, -1_000_000_000));

    expect(absoluteToLocal(absoluteObserver, frameA).value).not.toEqual(absoluteToLocal(absoluteObserver, frameB).value);
    const first = planWorldStreaming({ registry, observerAbsolutePosition: absoluteObserver, policy: DEFAULT_POLICY });
    const second = planWorldStreaming({ registry, observerAbsolutePosition: absoluteObserver, policy: DEFAULT_POLICY });

    expect(first.signature).toBe(second.signature);
    expect(first.assignments).toEqual(second.assignments);
    expect(first.observerAbsolutePosition.value).toEqual(absoluteObserver.value);
    expect(serializeWorldStreamingSnapshot(first)).not.toContain("local-a");
    expect(serializeWorldStreamingSnapshot(first)).not.toContain("local-b");
  });
});
