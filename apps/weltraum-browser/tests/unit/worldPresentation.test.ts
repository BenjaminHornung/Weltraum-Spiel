import { describe, expect, it } from "vitest";
import { planHashFor, type ExecutorTelemetry, type ObstacleDescriptor, type RoutePlan, type TargetDescriptor } from "../../src/core";
import { createFlightSnapshot, createShipStateV2 } from "../../src/flight/state";
import type { PreviewLockValidationResult } from "../../src/navigation/previewLock";
import type { RoutePreviewSnapshot, TelemetrySnapshot } from "../../src/sim/telemetry";
import { createLocalPhysicsFrame } from "../../src/world/frames";
import { playableLargeFieldRuntimeObstacles } from "../../src/world/provingGroundWorld";
import {
  adaptWorldStreamingResidency,
  buildWorldPresentationSnapshot,
  type BuildWorldPresentationInput,
  type WorldPresentationDecorationDescriptor,
  type WorldPresentationResidencyCandidate
} from "../../src/world/worldPresentation";
import type { WorldStreamingSnapshot } from "../../src/world/worldStreaming";

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
};

const target = (id = "target-a", x = 300): TargetDescriptor => ({
  id,
  label: `Target ${id}`,
  kind: "Point",
  position: { x, y: 5, z: -10 },
  arrivalEnvelope: { radius: 3, terminalSpeed: 1.5, stopBehavior: "StopWithinEnvelope" }
});

const plan = (
  targetDescriptor = target(),
  segmentIds: readonly string[] = ["segment-z", "segment-a", "terminal"],
  hashOverride?: string
): RoutePlan => {
  const segments = segmentIds.map((id, index) => ({
    id,
    kind: index === segmentIds.length - 1 ? "Terminal" as const : index === 1 ? "Avoidance" as const : "Direct" as const,
    start: { x: index * 100, y: index, z: -index },
    end: { x: (index + 1) * 100, y: index + 1, z: -(index + 1) },
    desiredSpeed: 18 - index * 3,
    clearanceRadius: 4 + index,
    ...(index === 1 ? { brakeMarginMultiplier: 1.25 } : {})
  }));
  const withoutHash = {
    id: `route-${targetDescriptor.id}`,
    planner: "ObstacleAvoidanceLocal" as const,
    speedProfile: "Balanced" as const,
    createdAtTick: 12,
    target: targetDescriptor,
    segments,
    validation: { ok: true, issues: [], rejectedReasonCodes: [] },
    score: {
      distance: 300,
      segmentCount: segments.length,
      clearanceRisk: 0,
      fuelCostEstimate: 2,
      authorityRisk: 0,
      total: 302,
      reasons: []
    }
  };
  return { ...withoutHash, planHash: hashOverride ?? planHashFor(withoutHash) };
};

const admitted = (sourcePlanHash: string): PreviewLockValidationResult => ({
  ok: true,
  code: "Ready",
  message: "Ready",
  planHash: sourcePlanHash,
  firstSegmentStartTolerance: 0.5
});

const rejected = (sourcePlanHash: string, code: "FlightAdmissionRejected" | "TargetMismatch" = "FlightAdmissionRejected"): PreviewLockValidationResult => ({
  ok: false,
  code,
  message: "Blocked",
  planHash: sourcePlanHash,
  firstSegmentStartTolerance: 0.5
});

const previewFor = (
  routePlan: RoutePlan,
  options: {
    readonly state?: RoutePreviewSnapshot["state"];
    readonly stale?: boolean;
    readonly target?: TargetDescriptor | null;
    readonly admission?: PreviewLockValidationResult;
  } = {}
): RoutePreviewSnapshot => ({
  state: options.state ?? "Ready",
  planner: routePlan.planner,
  target: options.target === undefined ? routePlan.target : options.target,
  plan: routePlan,
  validation: routePlan.validation,
  rejectedReasonCodes: [],
  playerMessage: "Preview",
  provenance: null,
  stale: options.stale ?? false,
  staleReason: options.stale ? "ExplicitlyInvalidated" : null,
  lockAdmission: options.admission ?? admitted(routePlan.planHash)
});

const telemetry = (options: {
  readonly selectedTarget?: TargetDescriptor | null;
  readonly routePreview?: RoutePreviewSnapshot | null;
  readonly lockedPlan?: RoutePlan | null;
  readonly activeSegmentId?: string | null;
  readonly executorPlanHash?: string | null;
  readonly completedPlanHash?: string | null;
  readonly executorRouteLifecycle?: ExecutorTelemetry["routeLifecycle"];
  readonly executorStatus?: ExecutorTelemetry["status"];
  readonly distanceToTarget?: number;
  readonly offRouteDistance?: number;
  readonly obstacles?: readonly ObstacleDescriptor[];
} = {}): TelemetrySnapshot => {
  const ship = createShipStateV2({
    position: { x: -0, y: 2, z: 3 },
    velocity: { x: 4, y: 0, z: -1 },
    fuel: 80,
    authority: { mode: "Autopilot" }
  });
  const lockedPlan = options.lockedPlan ?? null;
  const flightSnapshot = createFlightSnapshot(ship, lockedPlan);
  const executor: ExecutorTelemetry = {
    tick: 13,
    status: options.executorStatus ?? (lockedPlan ? "Executing" : "Idle"),
    routeLifecycle: options.executorRouteLifecycle ?? (lockedPlan ? "Executing" : "Idle"),
    planHash: options.executorPlanHash === undefined ? lockedPlan?.planHash ?? null : options.executorPlanHash,
    completedPlanHash: options.completedPlanHash ?? null,
    activeSegmentId: options.activeSegmentId ?? null,
    distanceToTarget: options.distanceToTarget ?? 250,
    offRouteDistance: options.offRouteDistance ?? 0,
    replanRequired: false,
    invalidationReasons: [],
    failureReasonCodes: [],
    fuel: ship.fuel,
    flightSnapshot,
    position: ship.position,
    velocity: ship.velocity
  };
  return {
    ship,
    executor,
    lockedPlan,
    flightSnapshot,
    selectedTarget: options.selectedTarget === undefined ? target() : options.selectedTarget,
    routePreview: options.routePreview ?? null,
    obstacles: options.obstacles ?? []
  };
};

const build = (snapshot: TelemetrySnapshot, overrides: Partial<BuildWorldPresentationInput> = {}) =>
  buildWorldPresentationSnapshot({
    telemetry: snapshot,
    frame: createLocalPhysicsFrame("render-frame", { x: 100, y: 0, z: 0 }),
    renderFrameRevision: 1,
    ...overrides
  });

const streaming = (visibleLods: WorldStreamingSnapshot["visibleLods"]): WorldStreamingSnapshot => ({
  visibleLods
} as unknown as WorldStreamingSnapshot);

describe("world presentation snapshot", () => {
  it("projects a deterministic, immutable locked route without sorting its segments or mutating frozen telemetry", () => {
    const locked = plan();
    const source = deepFreeze(telemetry({
      lockedPlan: locked,
      routePreview: previewFor(plan(target("preview-other"))),
      activeSegmentId: "segment-a",
      obstacles: [
        { id: "obstacle-z", center: { x: 20, y: 0, z: 0 }, radius: 5, padding: 2 },
        { id: "obstacle-a", center: { x: 10, y: 0, z: 0 }, radius: 4, padding: 1 }
      ]
    }));
    const before = JSON.stringify(source);

    const first = build(source);
    const second = build(source);

    expect(first).toEqual(second);
    expect(first.signature).toBe(second.signature);
    expect(first.route).toMatchObject({
      sourcePlanHash: locked.planHash,
      lifecycle: "Locked",
      visibility: "Visible",
      activeSegmentId: "segment-a",
      truthBacked: true,
      executorAssociation: "Current"
    });
    expect(first.route?.segments.map((segment) => segment.sourceSegmentId)).toEqual(["segment-z", "segment-a", "terminal"]);
    expect(first.route?.segments.map((segment) => segment.progress)).toEqual(["Completed", "Active", "Pending"]);
    expect(first.obstacles.map((obstacle) => obstacle.sourceObstacleId)).toEqual(["obstacle-a", "obstacle-z"]);
    expect(first.shipState.position.x).toBe(0);
    expect(first.selectedTarget?.sourceTargetId).toBe("target-a");
    expect(first.selectedTarget).toMatchObject({ selected: true, locked: true, truthBacked: true });
    expect(first.navigationFocusTarget?.sourceTargetId).toBe("target-a");
    expect(first.navigationState).toMatchObject({ distanceToTarget: 250, offRouteDistance: 0 });
    expect(first.obstacles[0].visualProxyStyle).toEqual({
      geometry: "SolidLowPoly",
      outline: "Restrained",
      radiusSource: "RuntimeTruth"
    });
    expect(JSON.stringify(source)).toBe(before);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.route?.segments)).toBe(true);
  });

  it("preserves exact sourcePlanHash and geometry when the admitted preview is engaged", () => {
    const routePlan = plan();
    const preview = build(telemetry({ routePreview: previewFor(routePlan) }));
    const locked = build(telemetry({
      routePreview: previewFor(routePlan),
      lockedPlan: routePlan,
      executorPlanHash: routePlan.planHash,
      activeSegmentId: routePlan.segments[0].id
    }));
    const geometry = (snapshot: typeof preview) => snapshot.route?.segments.map(({ sourceSegmentId, kind, start, end, desiredSpeed, clearanceRadius, brakeMarginMultiplier }) =>
      ({ sourceSegmentId, kind, start, end, desiredSpeed, clearanceRadius, brakeMarginMultiplier }));

    expect(preview.route?.sourcePlanHash).toBe(routePlan.planHash);
    expect(locked.route?.sourcePlanHash).toBe(routePlan.planHash);
    expect(geometry(locked)).toEqual(geometry(preview));
    expect(preview.route?.lifecycle).toBe("Preview");
    expect(locked.route?.lifecycle).toBe("Locked");
  });

  it("hides stale previews and blocks non-admissible or target-mismatched previews without changing selected truth", () => {
    const routePlan = plan();
    const stale = build(telemetry({ routePreview: previewFor(routePlan, { stale: true, state: "Stale" }) }));
    const nonAdmissible = build(telemetry({ routePreview: previewFor(routePlan, { admission: rejected(routePlan.planHash) }) }));
    const newlySelected = target("target-new", 900);
    const mismatch = build(telemetry({ selectedTarget: newlySelected, routePreview: previewFor(routePlan) }));

    expect(stale.route).toMatchObject({ visibility: "Hidden", admissionReady: false });
    expect(nonAdmissible.route).toMatchObject({ visibility: "Blocked", blockerCode: "FlightAdmissionRejected", admissionReady: false });
    const cleared = build(telemetry({ selectedTarget: null, routePreview: previewFor(routePlan) }));

    expect(mismatch.route).toMatchObject({ visibility: "Hidden", blockerCode: "TargetMismatch", sourceTargetId: "target-a" });
    expect(mismatch.selectedTarget?.sourceTargetId).toBe("target-new");
    expect(mismatch.navigationFocusTarget?.sourceTargetId).toBe("target-new");
    expect(mismatch.route?.goal.sourceTargetId).toBe("target-a");
    expect(cleared.route).toMatchObject({ visibility: "Hidden", blockerCode: "TargetMismatch" });
    expect(cleared.selectedTarget).toBeNull();
    expect(cleared.navigationFocusTarget).toBeNull();
    expect(cleared.navigationBeacon).toBeNull();
  });

  it("uses target identity rather than coordinates and preserves exact source positions", () => {
    const samePositionA = target("same-position-a", 777);
    const samePositionB: TargetDescriptor = { ...target("same-position-b", 777), position: samePositionA.position };
    const routeForA = plan(samePositionA);
    const accepted = build(telemetry({ selectedTarget: samePositionA, routePreview: previewFor(routeForA) }));
    const mismatched = build(telemetry({ selectedTarget: samePositionB, routePreview: previewFor(routeForA) }));

    expect(accepted.selectedTarget?.position).toEqual({ x: 777, y: 5, z: -10 });
    expect(accepted.route?.goal.position).toEqual({ x: 777, y: 5, z: -10 });
    expect(accepted.navigationBeacon?.position).toEqual({ x: 777, y: 5, z: -10 });
    expect(accepted.route?.visibility).toBe("Visible");
    expect(mismatched.route?.visibility).toBe("Hidden");
    expect(mismatched.selectedTarget?.sourceTargetId).toBe("same-position-b");
    expect(mismatched.navigationBeacon?.sourceTargetId).toBe("same-position-b");
  });

  it("hash-scopes executor lifecycle and progress and hides previews associated with a completed plan", () => {
    const oldPlan = plan(target("old-target"), ["old-a", "old-b"]);
    const newTarget = target("new-target", 800);
    const newPlan = plan(newTarget, ["new-a", "new-b"]);
    const unrelated = build(telemetry({
      selectedTarget: newTarget,
      routePreview: previewFor(newPlan),
      executorPlanHash: oldPlan.planHash,
      activeSegmentId: "old-b",
      completedPlanHash: oldPlan.planHash,
      executorRouteLifecycle: "Holding",
      executorStatus: "Arrived"
    }));
    const completed = build(telemetry({
      selectedTarget: newTarget,
      routePreview: previewFor(newPlan),
      executorPlanHash: null,
      completedPlanHash: newPlan.planHash,
      executorRouteLifecycle: "Completed",
      executorStatus: "Arrived"
    }));

    expect(unrelated.route).toMatchObject({
      executorAssociation: null,
      executorLifecycle: null,
      activeSegmentId: null,
      visibility: "Visible"
    });
    expect(unrelated.route?.segments.map((segment) => segment.progress)).toEqual(["Pending", "Pending"]);
    expect(unrelated.navigationState.routeLifecycle).toBeNull();
    expect(unrelated.navigationState.executorStatus).toBe("Idle");
    expect(unrelated.navigationState.distanceToTarget).toBeNull();
    expect(unrelated.navigationState.offRouteDistance).toBeNull();
    expect(completed.route).toMatchObject({
      executorAssociation: "Completed",
      executorLifecycle: "Completed",
      activeSegmentId: null,
      visibility: "Hidden",
      blockerCode: "CompletedPlan"
    });
    expect(completed.navigationState.executorStatus).toBe("Arrived");
    expect(completed.navigationState.distanceToTarget).toBe(250);
    expect(completed.navigationState.offRouteDistance).toBe(0);
  });

  it("excludes unrelated executor distances from navigation truth and the semantic signature", () => {
    const previewTarget = target("distance-preview", 450);
    const previewPlan = plan(previewTarget);
    const oldPlan = plan(target("distance-old", 900));
    const first = build(telemetry({
      selectedTarget: previewTarget,
      routePreview: previewFor(previewPlan),
      executorPlanHash: oldPlan.planHash,
      distanceToTarget: 10,
      offRouteDistance: 2
    }));
    const changedOldTelemetry = build(telemetry({
      selectedTarget: previewTarget,
      routePreview: previewFor(previewPlan),
      executorPlanHash: oldPlan.planHash,
      distanceToTarget: 8_000,
      offRouteDistance: 700
    }));
    const noRoute = build(telemetry({
      routePreview: null,
      executorPlanHash: oldPlan.planHash,
      distanceToTarget: 12,
      offRouteDistance: 3
    }));

    expect(first.navigationState).toMatchObject({ distanceToTarget: null, offRouteDistance: null });
    expect(changedOldTelemetry.navigationState).toMatchObject({ distanceToTarget: null, offRouteDistance: null });
    expect(changedOldTelemetry.signature).toBe(first.signature);
    expect(noRoute.route).toBeNull();
    expect(noRoute.navigationState).toMatchObject({ distanceToTarget: null, offRouteDistance: null });
  });

  it("includes sourcePlanHash in the semantic signature while excluding frame origin and render revision", () => {
    const routeA = plan(target(), undefined, "source-hash-a");
    const routeB = plan(target(), undefined, "source-hash-b");
    const sourceA = telemetry({ routePreview: previewFor(routeA) });
    const sourceB = telemetry({ routePreview: previewFor(routeB) });
    const first = build(sourceA, { renderFrameRevision: 1 });
    const revisionOnly = build(sourceA, { renderFrameRevision: 99 });
    const originOnly = build(sourceA, {
      frame: createLocalPhysicsFrame("render-frame", { x: -20_000, y: 50, z: 2 })
    });
    const sourceHashChanged = build(sourceB);
    const semanticFrameChanged = build(sourceA, {
      frame: createLocalPhysicsFrame("different-semantic-frame", { x: 100, y: 0, z: 0 })
    });

    expect(revisionOnly.signature).toBe(first.signature);
    expect(originOnly.signature).toBe(first.signature);
    expect(sourceHashChanged.signature).not.toBe(first.signature);
    expect(semanticFrameChanged.signature).not.toBe(first.signature);
    expect(revisionOnly.renderFrameRevision).toBe(99);
  });

  it("sorts every unordered descriptor collection and is independent of its input order", () => {
    const obstacles: readonly ObstacleDescriptor[] = [
      { id: "obstacle-b", center: { x: 2, y: 0, z: 0 }, radius: 2, padding: 1 },
      { id: "obstacle-a", center: { x: 1, y: 0, z: 0 }, radius: 1, padding: 0 }
    ];
    const landmarks = [
      { sourceLandmarkId: "landmark-b", label: "B", position: { x: 2, y: 0, z: 0 } },
      { sourceLandmarkId: "landmark-a", label: "A", position: { x: 1, y: 0, z: 0 } }
    ];
    const decorations: readonly WorldPresentationDecorationDescriptor[] = [
      { sourceDecorationId: "decoration-b", position: { x: 2, y: 0, z: 0 }, scale: 2, batchKey: "asteroid" },
      { sourceDecorationId: "decoration-a", position: { x: 1, y: 0, z: 0 }, scale: 1, batchKey: "asteroid" }
    ];
    const candidates: readonly WorldPresentationResidencyCandidate[] = [
      { sourceId: "obstacle-b", chunkId: "chunk:1:0:0" },
      { sourceId: "decoration-a", chunkId: "chunk:0:0:0" },
      { sourceId: "obstacle-a", chunkId: "chunk:0:0:0" },
      { sourceId: "decoration-b", chunkId: "chunk:1:0:0" }
    ];
    const worldStreaming = streaming([
      { chunkId: "chunk:1:0:0", lod: "Medium" },
      { chunkId: "chunk:0:0:0", lod: "Near" }
    ]);
    const first = build(telemetry({ obstacles }), { landmarks, decorations, streaming: worldStreaming, streamingCandidates: candidates });
    const reversed = build(telemetry({ obstacles: [...obstacles].reverse() }), {
      landmarks: [...landmarks].reverse(),
      decorations: [...decorations].reverse(),
      streaming: streaming([...worldStreaming.visibleLods].reverse()),
      streamingCandidates: [...candidates].reverse()
    });

    expect(reversed).toEqual(first);
    expect(first.obstacles.map((value) => value.sourceObstacleId)).toEqual(["obstacle-a", "obstacle-b"]);
    expect(first.landmarks.map((value) => value.sourceLandmarkId)).toEqual(["landmark-a", "landmark-b"]);
    expect(first.decorations.map((value) => value.sourceDecorationId)).toEqual(["decoration-a", "decoration-b"]);
    expect(first.residency.map((value) => value.sourceId)).toEqual(["decoration-a", "decoration-b", "obstacle-a", "obstacle-b"]);
  });

  it("retains all truth obstacles when streaming culls proxies and keeps residency a pure sorted adapter", () => {
    const obstacles: readonly ObstacleDescriptor[] = [
      { id: "resident", center: { x: 1, y: 0, z: 0 }, radius: 3, padding: 1 },
      { id: "culled", center: { x: 2, y: 0, z: 0 }, radius: 4, padding: 2 }
    ];
    const candidates = deepFreeze([
      { sourceId: "resident", chunkId: "chunk:0:0:0" },
      { sourceId: "culled", chunkId: "chunk:1:0:0" }
    ] as const);
    const residency = adaptWorldStreamingResidency(candidates, streaming([{ chunkId: "chunk:0:0:0", lod: "Far" }]));
    const snapshot = build(telemetry({ obstacles }), {
      streaming: streaming([{ chunkId: "chunk:0:0:0", lod: "Far" }]),
      streamingCandidates: candidates
    });

    expect(residency).toEqual([
      { sourceId: "culled", chunkId: "chunk:1:0:0", renderEligible: false, renderLod: "Culled" },
      { sourceId: "resident", chunkId: "chunk:0:0:0", renderEligible: true, renderLod: "Far" }
    ]);
    expect(snapshot.obstacles).toHaveLength(2);
    expect(snapshot.runtimeTruthObstacleCount).toBe(2);
    expect(snapshot.truthBackedObstacleProxyCount).toBe(1);
    expect(snapshot.obstacles.find((value) => value.sourceObstacleId === "culled")?.renderEligible).toBe(false);
  });

  it("marks every decorative descriptor explicitly as render-only and radar/collision excluded", () => {
    const snapshot = build(telemetry(), {
      landmarks: [{ sourceLandmarkId: "landmark", label: "Landmark", position: { x: 1, y: 2, z: 3 } }],
      decorations: [{ sourceDecorationId: "asteroid", position: { x: 4, y: 5, z: 6 }, scale: 2, batchKey: "low-poly" }]
    });

    for (const decorative of [...snapshot.landmarks, ...snapshot.decorations]) {
      expect(decorative).toMatchObject({
        truthBacked: false,
        renderOnly: true,
        radarVisible: false,
        collisionRelevant: false
      });
    }
    expect(snapshot.decorativeObjectCount).toBe(2);
    expect(snapshot.rendererOwnsWorldTruth).toBe(false);
    expect(snapshot.navigationBeacon).toMatchObject({
      sourceTargetId: "target-a",
      truthBacked: true,
      renderOnly: false,
      radarVisible: true,
      collisionRelevant: false
    });
    expect(Array.isArray(snapshot.navigationBeacon)).toBe(false);
    expect(snapshot.landmarks).toHaveLength(1);
  });

  it("emits at most one semantic navigation beacon from authoritative focus", () => {
    const routeTarget = target("locked-target", 600);
    const selected = target("selected-other", 200);
    const locked = plan(routeTarget);
    const lockedSnapshot = build(telemetry({ selectedTarget: selected, lockedPlan: locked }));
    const noFocus = build(telemetry({ selectedTarget: null }));

    expect(lockedSnapshot.selectedTarget?.sourceTargetId).toBe("selected-other");
    expect(lockedSnapshot.navigationFocusTarget?.sourceTargetId).toBe("locked-target");
    expect(lockedSnapshot.navigationBeacon?.sourceTargetId).toBe("locked-target");
    expect(lockedSnapshot.navigationBeacon?.position).toEqual(routeTarget.position);
    expect(noFocus.navigationBeacon).toBeNull();
  });

  it("keeps absolute ship-target-route-obstacle relationships invariant across render origins and revisions", () => {
    const routeTarget = target("absolute-target", 500);
    const routePlan = plan(routeTarget, ["absolute-segment"]);
    const source = telemetry({
      selectedTarget: routeTarget,
      routePreview: previewFor(routePlan),
      obstacles: [{ id: "absolute-obstacle", center: { x: 250, y: 15, z: -30 }, radius: 20, padding: 5 }]
    });
    const first = build(source, {
      frame: createLocalPhysicsFrame("render-frame", { x: 0, y: 0, z: 0 }),
      renderFrameRevision: 1
    });
    const shifted = build(source, {
      frame: createLocalPhysicsFrame("render-frame", { x: 100_000, y: -4_000, z: 800 }),
      renderFrameRevision: 2
    });
    const relationship = (snapshot: typeof first) => ({
      ship: snapshot.shipState.position,
      target: snapshot.selectedTarget?.position,
      beacon: snapshot.navigationBeacon?.position,
      routeStart: snapshot.route?.segments[0].start,
      routeEnd: snapshot.route?.segments[0].end,
      obstacle: snapshot.obstacles[0].center,
      shipToTarget: {
        x: (snapshot.selectedTarget?.position.x ?? 0) - snapshot.shipState.position.x,
        y: (snapshot.selectedTarget?.position.y ?? 0) - snapshot.shipState.position.y,
        z: (snapshot.selectedTarget?.position.z ?? 0) - snapshot.shipState.position.z
      }
    });

    expect(relationship(shifted)).toEqual(relationship(first));
    expect(shifted.signature).toBe(first.signature);
    expect(shifted.renderFrameRevision).toBe(2);
  });

  it("normalizes negative zero and rejects non-finite geometry, duplicate IDs, and invalid active segments", () => {
    const normalized = build(telemetry({
      obstacles: [{ id: "zero", center: { x: -0, y: -0, z: -0 }, radius: -0, padding: -0 }]
    }));
    expect(normalized.obstacles[0]).toMatchObject({ center: { x: 0, y: 0, z: 0 }, radius: 0, padding: 0 });
    expect(Object.is(normalized.obstacles[0].center.x, -0)).toBe(false);

    expect(() => build(telemetry({
      obstacles: [{ id: "bad", center: { x: Number.NaN, y: 0, z: 0 }, radius: 1, padding: 0 }]
    }))).toThrow(/must be finite/);
    expect(() => build(telemetry({
      obstacles: [
        { id: "duplicate", center: { x: 0, y: 0, z: 0 }, radius: 1, padding: 0 },
        { id: "duplicate", center: { x: 1, y: 0, z: 0 }, radius: 1, padding: 0 }
      ]
    }))).toThrow(/Duplicate obstacle id/);
    expect(() => adaptWorldStreamingResidency([
      { sourceId: "duplicate", chunkId: null },
      { sourceId: "duplicate", chunkId: "chunk:0:0:0" }
    ])).toThrow(/Duplicate residency source id/);
    const locked = plan();
    expect(() => build(telemetry({ lockedPlan: locked, executorPlanHash: locked.planHash, activeSegmentId: "missing" }))).toThrow(/not present/);
  });

  it("keeps fixed proving-ground runtime truth and eligible proxy counts equal", () => {
    const snapshot = build(telemetry({ obstacles: playableLargeFieldRuntimeObstacles }));

    expect(playableLargeFieldRuntimeObstacles).toHaveLength(7);
    expect(snapshot.runtimeTruthObstacleCount).toBe(7);
    expect(snapshot.truthBackedObstacleProxyCount).toBe(7);
    expect(snapshot.obstacles.every((obstacle) => obstacle.renderEligible)).toBe(true);
  });
});
