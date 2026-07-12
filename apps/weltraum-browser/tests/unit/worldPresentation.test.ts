import { describe, expect, it } from "vitest";
import {
  planHashFor,
  type ExecutorTelemetry,
  type ObstacleDescriptor,
  type RoutePlan,
  type TargetDescriptor
} from "../../src/core";
import { createFlightSnapshot, createShipStateV2 } from "../../src/flight/state";
import {
  createNavigationMapSnapshot,
  navigationMapObstacleSnapshot,
  navigationMapRouteSnapshot,
  navigationMapShipSnapshot,
  navigationMapTargetSnapshot,
  type NavigationMapEntitySnapshot,
  type NavigationMapRouteSnapshot,
  type NavigationMapSnapshot
} from "../../src/navigation/map";
import type { PreviewLockValidationResult } from "../../src/navigation/previewLock";
import type { RoutePreviewSnapshot, TelemetrySnapshot } from "../../src/sim/telemetry";
import { worldCoordinate } from "../../src/world/frames";
import { createProvingGroundNavigationMapWorldAdapter } from "../../src/world/navigationMapWorldAdapter";
import {
  playableLargeFieldVisualLandmarks,
  playableLargeFieldRuntimeObstacles,
  provingGroundAsteroidField
} from "../../src/world/provingGroundWorld";
import {
  buildWorldPresentationSnapshot,
  type BuildWorldPresentationInput
} from "../../src/world/worldPresentation";

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

const rejected = (sourcePlanHash: string): PreviewLockValidationResult => ({
  ok: false,
  code: "FlightAdmissionRejected",
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

const entity = (
  id: string,
  x: number,
  options: {
    readonly chunkId?: NavigationMapEntitySnapshot["chunkId"];
    readonly residence?: NavigationMapEntitySnapshot["residence"];
    readonly renderLod?: NavigationMapEntitySnapshot["renderLod"];
    readonly presentationKey?: string;
  } = {}
): NavigationMapEntitySnapshot => ({
  id,
  absolutePosition: worldCoordinate({ x, y: 2, z: -x / 2 }),
  chunkId: options.chunkId ?? `chunk:${Math.floor(x / 256)}:0:0`,
  residence: options.residence ?? "Full",
  renderLod: options.renderLod ?? "Near",
  presentationKey: options.presentationKey ?? "asteroid"
});

interface TelemetryOptions {
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
  readonly rawShipPosition?: { readonly x: number; readonly y: number; readonly z: number };
  readonly navigationMap?: NavigationMapSnapshot | null;
  readonly mapRoute?: NavigationMapRouteSnapshot | null;
  readonly mapTargets?: readonly TargetDescriptor[];
  readonly mapSelectedTargetId?: string | null;
  readonly mapObstacles?: readonly ObstacleDescriptor[];
  readonly mapEntities?: readonly NavigationMapEntitySnapshot[];
  readonly mapShipPosition?: { readonly x: number; readonly y: number; readonly z: number };
  readonly mapAbsoluteFrameId?: string;
  readonly mapFloatingOriginFrameId?: string;
  readonly mapWorld?: NavigationMapSnapshot["world"];
}

const telemetry = (options: TelemetryOptions = {}): TelemetrySnapshot => {
  const ship = createShipStateV2({
    position: options.rawShipPosition ?? { x: -0, y: 2, z: 3 },
    velocity: { x: 4, y: 0, z: -1 },
    fuel: 80,
    authority: { mode: "Autopilot" }
  });
  const lockedPlan = options.lockedPlan ?? null;
  const routePreview = options.routePreview ?? null;
  const selectedTarget = options.selectedTarget === undefined ? target() : options.selectedTarget;
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

  let navigationMap: NavigationMapSnapshot | undefined;
  if ("navigationMap" in options) {
    navigationMap = options.navigationMap ?? undefined;
  } else {
    const targetDescriptors = options.mapTargets ?? [
      target(),
      ...(selectedTarget ? [selectedTarget] : []),
      ...(lockedPlan ? [lockedPlan.target] : []),
      ...(routePreview?.target ? [routePreview.target] : []),
      ...(routePreview?.plan ? [routePreview.plan.target] : [])
    ];
    const targetById = new Map(targetDescriptors.map((descriptor) => [descriptor.id, descriptor] as const));
    const mapEntities = options.mapEntities ?? [];
    const mapRoutePlan = lockedPlan ?? (routePreview?.state === "Ready" ? routePreview.plan : null);
    const mapRoute = "mapRoute" in options
      ? options.mapRoute ?? null
      : mapRoutePlan ? navigationMapRouteSnapshot(mapRoutePlan) : null;
    const fullChunkIds = [...new Set(mapEntities.filter((value) => value.residence === "Full").map((value) => value.chunkId))].sort();
    const snapshotChunkIds = [...new Set(mapEntities.filter((value) => value.residence === "Snapshot").map((value) => value.chunkId))].sort();
    navigationMap = createNavigationMapSnapshot({
      absoluteFrameId: options.mapAbsoluteFrameId ?? "absolute-system",
      ...(options.mapFloatingOriginFrameId ? { floatingOriginFrameId: options.mapFloatingOriginFrameId } : {}),
      ship: navigationMapShipSnapshot({
        absolutePosition: worldCoordinate(options.mapShipPosition ?? ship.position),
        orientation: ship.orientation,
        presentation: {
          displayName: "Demo Scout",
          blueprintId: "demo-scout",
          visualId: "demo-scout-glb",
          symbolKey: "ship",
          forwardAxis: "+X"
        }
      }),
      targets: [...targetById.values()].map((descriptor) => navigationMapTargetSnapshot(descriptor)),
      selectedTargetId: options.mapSelectedTargetId === undefined ? selectedTarget?.id ?? null : options.mapSelectedTargetId,
      route: mapRoute,
      obstacles: (options.mapObstacles ?? options.obstacles ?? []).map((obstacle) => navigationMapObstacleSnapshot(obstacle)),
      entities: mapEntities,
      world: options.mapWorld ?? {
        registrySignature: "registry-signature",
        streamingSignature: "streaming-signature",
        fullChunkIds,
        snapshotChunkIds
      }
    });
  }

  return {
    ship,
    executor,
    lockedPlan,
    flightSnapshot,
    selectedTarget,
    selectableTargets: [target(), ...(selectedTarget ? [selectedTarget] : [])],
    routePreview,
    obstacles: options.obstacles ?? [],
    ...(navigationMap ? { navigationMap } : {})
  };
};

const build = (snapshot: TelemetrySnapshot, overrides: Partial<BuildWorldPresentationInput> = {}) =>
  buildWorldPresentationSnapshot({
    telemetry: snapshot,
    renderFrameRevision: 1,
    landmarkEntityIds: playableLargeFieldVisualLandmarks.map((landmark) => landmark.id),
    ...overrides
  });

describe("world presentation snapshot", () => {
  it("requires TelemetrySnapshot.navigationMap and never falls back to raw telemetry geometry", () => {
    expect(() => build(telemetry({ navigationMap: null }))).toThrow(/TelemetrySnapshot\.navigationMap is required/);
  });

  it("projects a deterministic immutable locked route from canonical map geometry", () => {
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
    expect(first.frameId).toBe("absolute-system");
    expect(first.sourceNavigationMapSignature).toBe(source.navigationMap?.signature);
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
    expect(first.selectedTarget).toMatchObject({ sourceTargetId: "target-a", selected: true, locked: true, truthBacked: true });
    expect(first.navigationState).toMatchObject({ distanceToTarget: 250, offRouteDistance: 0 });
    expect(first.obstacles[0].visualProxyStyle.radiusSource).toBe("NavigationMapTruth");
    expect(JSON.stringify(source)).toBe(before);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.route?.segments)).toBe(true);
  });

  it("preserves exact map planHash and segment geometry from preview through engage", () => {
    const routePlan = plan();
    const preview = build(telemetry({ routePreview: previewFor(routePlan) }));
    const locked = build(telemetry({
      routePreview: previewFor(routePlan),
      lockedPlan: routePlan,
      executorPlanHash: routePlan.planHash,
      activeSegmentId: routePlan.segments[0].id
    }));
    const geometry = (snapshot: typeof preview) => snapshot.route?.segments.map(({
      sourceSegmentId,
      kind,
      start,
      end,
      desiredSpeed,
      clearanceRadius,
      brakeMarginMultiplier
    }) => ({ sourceSegmentId, kind, start, end, desiredSpeed, clearanceRadius, brakeMarginMultiplier }));

    expect(preview.route?.sourcePlanHash).toBe(routePlan.planHash);
    expect(locked.route?.sourcePlanHash).toBe(routePlan.planHash);
    expect(geometry(locked)).toEqual(geometry(preview));
    expect(preview.route?.lifecycle).toBe("Preview");
    expect(locked.route?.lifecycle).toBe("Locked");
  });

  it("uses map ship, target, obstacle, and route geometry while raw telemetry only enriches metadata", () => {
    const routePlan = plan();
    const mapTarget = { ...target(), position: { x: 777, y: 21, z: -42 } };
    const mapObstacle = { id: "map-obstacle", center: { x: 123, y: 4, z: -12 }, radius: 8, padding: 3 };
    const canonical = telemetry({
      selectedTarget: target(),
      routePreview: previewFor(routePlan),
      obstacles: [{ id: "raw-obstacle", center: { x: 999, y: 0, z: 0 }, radius: 99, padding: 9 }],
      mapTargets: [mapTarget],
      mapObstacles: [mapObstacle],
      mapShipPosition: { x: 44, y: 5, z: -7 }
    });
    const rawSpatialDrift = telemetry({
      selectedTarget: { ...target(), position: { x: -9_000, y: 800, z: 1_200 } },
      routePreview: previewFor(routePlan),
      obstacles: [{ id: "different-raw", center: { x: -5_000, y: 0, z: 0 }, radius: 1, padding: 0 }],
      rawShipPosition: { x: 9_000, y: 500, z: -900 },
      navigationMap: canonical.navigationMap
    });

    const first = build(canonical);
    const second = build(rawSpatialDrift);

    expect(first.shipState.position).toEqual({ x: 44, y: 5, z: -7 });
    expect(first.selectedTarget?.position).toEqual(mapTarget.position);
    expect(first.route?.goal.position).toEqual(mapTarget.position);
    expect(first.obstacles).toHaveLength(1);
    expect(first.obstacles[0]).toMatchObject({ sourceObstacleId: "map-obstacle", center: mapObstacle.center });
    expect(second.shipState.position).toEqual(first.shipState.position);
    expect(second.selectedTarget?.position).toEqual(first.selectedTarget?.position);
    expect(second.obstacles).toEqual(first.obstacles);
    expect(second.signature).toBe(first.signature);
  });

  it("hides and empties routes on missing, hash, target, order, or geometry contradictions", () => {
    const routePlan = plan();
    const preview = previewFor(routePlan);
    const canonical = navigationMapRouteSnapshot(routePlan);
    const otherTarget = target("other", 900);
    const geometryMismatch: NavigationMapRouteSnapshot = {
      ...canonical,
      segments: [
        {
          ...canonical.segments[0],
          end: worldCoordinate({ x: 999, y: 9, z: -9 })
        },
        ...canonical.segments.slice(1)
      ]
    };

    const contradictions = [
      telemetry({ routePreview: preview, mapRoute: null }),
      telemetry({ routePreview: preview, mapRoute: { ...canonical, planHash: "wrong-hash" } }),
      telemetry({
        routePreview: preview,
        mapTargets: [target(), otherTarget],
        mapRoute: { ...canonical, targetId: otherTarget.id }
      }),
      telemetry({ routePreview: preview, mapRoute: { ...canonical, segments: [...canonical.segments].reverse() } }),
      telemetry({
        routePreview: previewFor(routePlan, { admission: rejected(routePlan.planHash) }),
        mapRoute: geometryMismatch
      })
    ];

    for (const contradiction of contradictions) {
      expect(build(contradiction).route).toMatchObject({
        visibility: "Hidden",
        blockerCode: "NavigationMapRouteMismatch",
        admissionReady: false,
        activeSegmentId: null,
        segments: []
      });
    }
  });

  it("keeps stale or otherwise hidden non-canonical routes hidden with empty geometry", () => {
    const stalePlan = plan(target("stale-target", 500), ["stale-a", "stale-terminal"]);
    const currentPlan = plan(target("current-target", 800), ["current-a", "current-terminal"]);
    const snapshot = build(telemetry({
      selectedTarget: stalePlan.target,
      routePreview: previewFor(stalePlan, { stale: true, state: "Stale" }),
      mapTargets: [stalePlan.target, currentPlan.target],
      mapRoute: navigationMapRouteSnapshot(currentPlan)
    }));

    expect(snapshot.route).toMatchObject({
      sourcePlanHash: stalePlan.planHash,
      visibility: "Hidden",
      admissionReady: false
    });
    expect(snapshot.route?.segments).toEqual([]);
    expect(snapshot.route?.activeSegmentId).toBeNull();
  });

  it("hash-scopes executor lifecycle, distances, and completed-plan hiding", () => {
    const oldPlan = plan(target("old-target"), ["old-a", "old-b"]);
    const newPlan = plan(target("new-target", 800), ["new-a", "new-b"]);
    const unrelated = build(telemetry({
      selectedTarget: newPlan.target,
      routePreview: previewFor(newPlan),
      executorPlanHash: oldPlan.planHash,
      activeSegmentId: "old-b",
      completedPlanHash: oldPlan.planHash,
      executorRouteLifecycle: "Holding",
      executorStatus: "Arrived"
    }));
    const completed = build(telemetry({
      selectedTarget: newPlan.target,
      routePreview: previewFor(newPlan),
      executorPlanHash: null,
      completedPlanHash: newPlan.planHash,
      executorRouteLifecycle: "Completed",
      executorStatus: "Arrived"
    }));

    expect(unrelated.route).toMatchObject({ executorAssociation: null, executorLifecycle: null, activeSegmentId: null, visibility: "Visible" });
    expect(unrelated.navigationState).toMatchObject({ executorStatus: "Idle", distanceToTarget: null, offRouteDistance: null });
    expect(completed.route).toMatchObject({
      executorAssociation: "Completed",
      executorLifecycle: "Completed",
      visibility: "Hidden",
      blockerCode: "CompletedPlan"
    });
    expect(completed.navigationState).toMatchObject({ executorStatus: "Arrived", distanceToTarget: 250, offRouteDistance: 0 });
  });

  it("excludes render revision and floating-origin frame from the semantic signature", () => {
    const routePlan = plan();
    const first = build(telemetry({
      routePreview: previewFor(routePlan),
      mapFloatingOriginFrameId: "floating-a"
    }), { renderFrameRevision: 1 });
    const floatingOnly = build(telemetry({
      routePreview: previewFor(routePlan),
      mapFloatingOriginFrameId: "floating-b"
    }), { renderFrameRevision: 99 });
    const absoluteFrameChanged = build(telemetry({
      routePreview: previewFor(routePlan),
      mapAbsoluteFrameId: "different-absolute-frame"
    }));
    const sourceHashChangedPlan = plan(target(), undefined, "source-hash-changed");
    const sourceHashChanged = build(telemetry({ routePreview: previewFor(sourceHashChangedPlan) }));

    expect(floatingOnly.signature).toBe(first.signature);
    expect(floatingOnly.sourceNavigationMapSignature).toBe(first.sourceNavigationMapSignature);
    expect(floatingOnly.renderFrameRevision).toBe(99);
    expect(absoluteFrameChanged.frameId).toBe("different-absolute-frame");
    expect(absoluteFrameChanged.signature).not.toBe(first.signature);
    expect(sourceHashChanged.signature).not.toBe(first.signature);
  });

  it("sorts map collections and projects residence, LOD, presentation key, and roles deterministically", () => {
    const obstacles: readonly ObstacleDescriptor[] = [
      { id: "obstacle-b", center: { x: 2, y: 0, z: 0 }, radius: 2, padding: 1 },
      { id: "obstacle-a", center: { x: 1, y: 0, z: 0 }, radius: 1, padding: 0 }
    ];
    const entities = [
      entity("landmark-b", 400, { residence: "Snapshot", renderLod: "Culled" }),
      entity("ambient-a", 40, { residence: "Full", renderLod: "Near" })
    ];
    const first = build(telemetry({ mapObstacles: obstacles, mapEntities: entities }), {
      landmarkEntityIds: ["landmark-b"]
    });
    const reversed = build(telemetry({
      mapObstacles: [...obstacles].reverse(),
      mapEntities: [...entities].reverse()
    }), { landmarkEntityIds: ["landmark-b"] });

    expect(reversed).toEqual(first);
    expect(first.obstacles.map((value) => value.sourceObstacleId)).toEqual(["obstacle-a", "obstacle-b"]);
    expect(first.entities.map((value) => value.sourceEntityId)).toEqual(["ambient-a", "landmark-b"]);
    expect(first.entities[0]).toMatchObject({
      chunkId: "chunk:0:0:0",
      residence: "Full",
      renderLod: "Near",
      presentationKey: "asteroid",
      role: "Ambient",
      renderEligible: true,
      truthBacked: true,
      renderOnly: false
    });
    expect(first.entities[1]).toMatchObject({ role: "Landmark", residence: "Snapshot", renderLod: "Culled", renderEligible: false });
    expect(first.worldEntityCount).toBe(2);
    expect(first.residentWorldEntityCount).toBe(2);
    expect(first.renderEligibleWorldEntityCount).toBe(1);
    expect(first.landmarkWorldEntityCount).toBe(1);
    expect(first.ambientWorldEntityCount).toBe(1);
  });

  it("classifies all fourteen proving-ground slots as eight landmarks and six ambient entities", () => {
    const mapWorld = createProvingGroundNavigationMapWorldAdapter().snapshot(worldCoordinate({ x: 0, y: 0, z: 0 }));
    const snapshot = build(telemetry({
      mapEntities: mapWorld.entities,
      mapWorld: {
        registrySignature: mapWorld.registry.signature,
        streamingSignature: mapWorld.streaming.signature,
        fullChunkIds: mapWorld.streaming.fullChunkIds,
        snapshotChunkIds: mapWorld.streaming.snapshotChunkIds
      }
    }));

    expect(mapWorld.entities).toHaveLength(14);
    expect(snapshot.entities).toHaveLength(14);
    expect(snapshot.entities.map((value) => value.sourceEntityId)).toEqual(
      provingGroundAsteroidField.map((value) => value.id).sort()
    );
    expect(snapshot.landmarkWorldEntityCount).toBe(8);
    expect(snapshot.ambientWorldEntityCount).toBe(6);
  });

  it("uses only map obstacles and retains fixed proving-ground truth counts", () => {
    const snapshot = build(telemetry({
      obstacles: [{ id: "raw-only", center: { x: 9_999, y: 0, z: 0 }, radius: 99, padding: 9 }],
      mapObstacles: playableLargeFieldRuntimeObstacles
    }));

    expect(playableLargeFieldRuntimeObstacles).toHaveLength(7);
    expect(snapshot.runtimeTruthObstacleCount).toBe(7);
    expect(snapshot.truthBackedObstacleProxyCount).toBe(7);
    expect(snapshot.obstacles.some((obstacle) => obstacle.sourceObstacleId === "raw-only")).toBe(false);
  });

  it("emits at most one semantic beacon and keeps selected target separate from route focus", () => {
    const routeTarget = target("locked-target", 600);
    const selected = target("selected-other", 200);
    const locked = plan(routeTarget);
    const snapshot = build(telemetry({
      selectedTarget: selected,
      lockedPlan: locked,
      mapTargets: [selected, routeTarget],
      mapSelectedTargetId: selected.id
    }));

    expect(snapshot.selectedTarget?.sourceTargetId).toBe("selected-other");
    expect(snapshot.navigationFocusTarget?.sourceTargetId).toBe("locked-target");
    expect(snapshot.navigationBeacon?.sourceTargetId).toBe("locked-target");
    expect(Array.isArray(snapshot.navigationBeacon)).toBe(false);
  });

  it("normalizes negative zero and rejects invalid canonical map values and active segment IDs", () => {
    const valid = telemetry({
      mapObstacles: [{ id: "zero", center: { x: -0, y: -0, z: -0 }, radius: -0, padding: -0 }]
    });
    const normalized = build(valid);
    expect(normalized.obstacles[0]).toMatchObject({ center: { x: 0, y: 0, z: 0 }, radius: 0, padding: 0 });
    expect(Object.is(normalized.obstacles[0].center.x, -0)).toBe(false);

    const invalidMap = {
      ...valid.navigationMap!,
      obstacles: [{
        ...valid.navigationMap!.obstacles[0],
        center: {
          ...valid.navigationMap!.obstacles[0].center,
          value: { x: Number.NaN, y: 0, z: 0 }
        }
      }]
    } as NavigationMapSnapshot;
    expect(() => build(telemetry({ navigationMap: invalidMap }))).toThrow(/must be finite/);

    const locked = plan();
    expect(() => build(telemetry({
      lockedPlan: locked,
      executorPlanHash: locked.planHash,
      activeSegmentId: "missing"
    }))).toThrow(/not present in navigation map route/);
  });

  it("aborts target contradictions instead of substituting raw target geometry", () => {
    const routePlan = plan();
    expect(() => build(telemetry({
      selectedTarget: routePlan.target,
      routePreview: previewFor(routePlan),
      mapTargets: [target("other-target", 900)],
      mapSelectedTargetId: routePlan.target.id,
      mapRoute: null
    }))).toThrow(/selected target contradiction/);
  });
});
