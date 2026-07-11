import { describe, expect, it } from "vitest";
import {
  DirectLocalPlanner,
  createRoutePreviewProvenance,
  createShipStateV2,
  environmentFingerprintFor,
  planHashFor,
  validatePreviewForLock,
  vec3
} from "../../src/core";
import type {
  AutopilotSpeedProfileId,
  ObstacleDescriptor,
  PreviewForLock,
  RoutePlan,
  ShipState,
  TargetDescriptor,
  ValidatePreviewForLockInput
} from "../../src/core";
import { createBrowserRuntime } from "../../src/runtime/browserRuntime";
import { provingGroundTargets } from "../../src/world/provingGroundWorld";

const baseShip = createShipStateV2({
  position: vec3(),
  velocity: vec3(),
  fuel: 100,
  authority: { mode: "Autopilot" }
});

const baseTarget: TargetDescriptor = {
  id: "preview-target",
  label: "Preview Target",
  kind: "Point",
  position: vec3(100, 0, 0),
  arrivalEnvelope: { radius: 2, stopBehavior: "NoStopRequired" }
};

const rehash = (plan: RoutePlan, changes: Partial<RoutePlan> = {}): RoutePlan => {
  const changed = { ...plan, ...changes, planHash: "" };
  return { ...changed, planHash: planHashFor(changed) };
};

const fixture = (options: {
  ship?: ShipState;
  target?: TargetDescriptor;
  obstacles?: readonly ObstacleDescriptor[];
  speedProfile?: AutopilotSpeedProfileId;
  plan?: RoutePlan;
} = {}): ValidatePreviewForLockInput => {
  const ship = options.ship ?? baseShip;
  const target = options.target ?? baseTarget;
  const obstacles = options.obstacles ?? [];
  const speedProfile = options.speedProfile ?? "Balanced";
  const plan = options.plan ?? new DirectLocalPlanner().plan({ tick: 7, ship, target, speedProfile });
  const preview: PreviewForLock = {
    plan,
    provenance: createRoutePreviewProvenance({
      ship,
      target,
      obstacles,
      planner: plan.planner,
      speedProfile,
      sourceTick: plan.createdAtTick
    }),
    stale: false
  };

  return {
    preview,
    expectedPlanHash: plan.planHash,
    lockedPlan: null,
    ship,
    target,
    obstacles,
    planner: plan.planner,
    speedProfile
  };
};

const expectRejected = (input: ValidatePreviewForLockInput, code: string) => {
  const result = validatePreviewForLock(input);
  expect(result.ok).toBe(false);
  expect(result.code).toBe(code);
  expect(result.message.length).toBeGreaterThan(0);
};

describe("validatePreviewForLock", () => {
  it("accepts a matching preview and reports the configured first-segment tolerance", () => {
    const input = fixture();
    const result = validatePreviewForLock(input);

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      code: "Ready",
      planHash: input.preview?.plan?.planHash,
      firstSegmentStartTolerance: 1
    }));
  });

  it("rejects missing previews, visible hash mismatch, another lock, and stale previews", () => {
    const input = fixture();

    expectRejected({ ...input, preview: null }, "MissingPreview");
    expectRejected({ ...input, expectedPlanHash: "deadbeef" }, "ExpectedPlanHashMismatch");
    expectRejected({ ...input, lockedPlan: input.preview?.plan ?? null }, "PlanAlreadyLocked");
    expectRejected({ ...input, preview: { ...input.preview!, stale: true } }, "PreviewStale");
  });

  it("rejects target, profile, planner, and environment drift", () => {
    const input = fixture();
    const changedTarget = { ...baseTarget, label: "Changed Target" };

    expectRejected({ ...input, target: changedTarget }, "TargetMismatch");
    expectRejected({ ...input, speedProfile: "Fast" }, "SpeedProfileMismatch");
    expectRejected({ ...input, planner: "ObstacleAvoidanceLocal" }, "PlannerMismatch");
    expectRejected({
      ...input,
      obstacles: [{ id: "new-rock", center: vec3(40, 20, 0), radius: 4, padding: 2 }]
    }, "EnvironmentMismatch");
  });

  it("rejects authority, velocity, mass, and fuel drift", () => {
    const input = fixture();
    const authorityChanged = createShipStateV2({ position: vec3(), fuel: 100, authority: { mode: "Autopilot", rcsAvailable: false } });
    const velocityChanged = { ...baseShip, velocity: vec3(0.001, 0, 0) };
    const massChanged = { ...baseShip, mass: { ...baseShip.mass, cargoMass: 1, totalMass: baseShip.mass.totalMass + 1 } };
    const fuelChanged = { ...baseShip, fuel: { ...baseShip.fuel, current: baseShip.fuel.current - 1 } };

    expectRejected({ ...input, ship: authorityChanged }, "AuthorityMismatch");
    expectRejected({ ...input, ship: velocityChanged }, "VelocityMismatch");
    expectRejected({ ...input, ship: massChanged }, "MassMismatch");
    expectRejected({ ...input, ship: fuelChanged }, "FuelMismatch");
  });

  it("rejects invalid, empty, and discontinuous segment sets", () => {
    const input = fixture();
    const plan = input.preview!.plan!;
    const invalid = rehash(plan, { segments: [{ ...plan.segments[0], desiredSpeed: 0 }] });
    const empty = rehash(plan, { segments: [] });
    const discontinuous = rehash(plan, {
      segments: [
        { ...plan.segments[0], id: "first", end: vec3(40, 0, 0) },
        { ...plan.segments[0], id: "second", start: vec3(41, 0, 0) }
      ]
    });

    expectRejected({ ...input, preview: { ...input.preview!, plan: invalid }, expectedPlanHash: invalid.planHash }, "InvalidSegment");
    expectRejected({ ...input, preview: { ...input.preview!, plan: empty }, expectedPlanHash: empty.planHash }, "InvalidSegment");
    expectRejected({ ...input, preview: { ...input.preview!, plan: discontinuous }, expectedPlanHash: discontinuous.planHash }, "SegmentDiscontinuity");
  });

  it("binds provenance source tick to plan creation tick and position to the first usable segment", () => {
    const input = fixture();
    const provenance = input.preview!.provenance!;
    expectRejected({
      ...input,
      preview: { ...input.preview!, provenance: { ...provenance, sourceTick: provenance.sourceTick + 1 } }
    }, "ProvenanceTickMismatch");

    const plan = input.preview!.plan!;
    const firstUsableAtOne = rehash(plan, {
      segments: [
        { ...plan.segments[0], id: "zero", start: vec3(1, 0, 0), end: vec3(1, 0, 0) },
        { ...plan.segments[0], id: "usable", start: vec3(1, 0, 0) }
      ]
    });
    expectRejected({
      ...input,
      preview: { ...input.preview!, plan: firstUsableAtOne },
      expectedPlanHash: firstUsableAtOne.planHash
    }, "ProvenancePositionMismatch");
  });

  it("accepts the exact start tolerance boundary and rejects the boundary plus epsilon", () => {
    const input = fixture();
    const plan = input.preview!.plan!;
    const clearancePlan = rehash(plan, {
      segments: [{ ...plan.segments[0], clearanceRadius: 30 }]
    });
    const boundaryInput = {
      ...input,
      preview: { ...input.preview!, plan: clearancePlan },
      expectedPlanHash: clearancePlan.planHash,
      ship: { ...baseShip, position: vec3(3, 0, 0) }
    };

    expect(validatePreviewForLock(boundaryInput)).toEqual(expect.objectContaining({ ok: true, firstSegmentStartTolerance: 3 }));
    expectRejected({ ...boundaryInput, ship: { ...baseShip, position: vec3(3 + 1e-6, 0, 0) } }, "FirstSegmentStartMismatch");
  });

  it("rejects exact planning-context, route-validation, and flight-admission failures", () => {
    const input = fixture();
    const plan = input.preview!.plan!;
    const invalidTarget = { ...baseTarget, label: "" };
    const invalidTargetPlan = rehash(plan, { target: invalidTarget });
    const invalidTargetInput = fixture({ target: invalidTarget, plan: invalidTargetPlan });
    expectRejected(invalidTargetInput, "PlanningContextRejected");

    const blockingObstacle = { id: "blocking-rock", center: vec3(50, 0, 0), radius: 5, padding: 1 };
    const unsafeRouteInput = fixture({ obstacles: [blockingObstacle], plan });
    expectRejected(unsafeRouteInput, "RouteValidationRejected");

    const lowReserveShip = createShipStateV2({
      position: vec3(),
      velocity: vec3(2, 0, 0),
      fuel: { current: 5.01, reserve: 5 },
      authority: { mode: "Autopilot" }
    });
    const lowReservePlan = new DirectLocalPlanner().plan({ tick: 7, ship: lowReserveShip, target: baseTarget, speedProfile: "Balanced" });
    expectRejected(fixture({ ship: lowReserveShip, plan: lowReservePlan }), "FlightAdmissionRejected");
  });

  it("canonicalizes obstacle ordering for the environment fingerprint", () => {
    const obstacles = [
      { id: "b", center: vec3(20, 1, 0), radius: 2, padding: 1 },
      { id: "a", center: vec3(10, -1, 0), radius: 3, padding: 2 }
    ];

    expect(environmentFingerprintFor(obstacles)).toBe(environmentFingerprintFor([...obstacles].reverse()));
  });
});

describe("browser runtime preview lifecycle", () => {
  it("allows target and profile changes to create unlocked previews", () => {
    const { controller } = createBrowserRuntime();
    const targetResult = controller.dispatchCommand({ type: "SelectTarget", targetId: provingGroundTargets.navigationBeta.id });

    expect(targetResult).toEqual(expect.objectContaining({ success: true, code: "TargetSelected", lockedPlanHash: null }));
    expect(targetResult.telemetry.routePreview).toEqual(expect.objectContaining({ state: "Ready", stale: false }));
    expect(targetResult.telemetry.routePreview?.target?.id).toBe(provingGroundTargets.navigationBeta.id);

    const profileResult = controller.dispatchCommand({ type: "SetRouteProfile", profile: "Fast" });
    expect(profileResult).toEqual(expect.objectContaining({ success: true, code: "RouteProfileSet", lockedPlanHash: null }));
    expect(profileResult.telemetry.selectedRouteProfile).toBe("Fast");
    expect(profileResult.telemetry.routePreview?.plan?.speedProfile).toBe("Fast");
    expect(profileResult.telemetry.routePreview).toEqual(expect.objectContaining({ state: "Ready", stale: false }));
  });

  it("keeps tick-aged state lockable when no relevant ship state changed", () => {
    const { controller } = createBrowserRuntime();
    const visibleHash = controller.getTelemetry().routePreview!.plan!.planHash;

    controller.step(120);
    const engaged = controller.dispatchCommand({ type: "EngageRoutePreview", expectedPlanHash: visibleHash });

    expect(engaged).toEqual(expect.objectContaining({
      success: true,
      code: "RoutePreviewEngaged",
      previewPlanHash: visibleHash,
      lockedPlanHash: visibleHash
    }));
  });

  it("reuses a fresh preview across tick age, replans only on command, and locks the exact visible hash", () => {
    const { controller } = createBrowserRuntime();
    const initial = controller.getTelemetry().routePreview!;
    const initialHash = initial.plan!.planHash;
    const initialProvenance = initial.provenance;

    controller.step(60);
    const reused = controller.dispatchCommand({ type: "PreviewRoute" });
    expect(reused).toEqual(expect.objectContaining({ success: true, code: "RoutePreviewReused", rejectionCode: null }));
    expect(reused.previewPlanHash).toBe(initialHash);
    expect(reused.telemetry.routePreview?.provenance).toEqual(initialProvenance);

    const replanned = controller.dispatchCommand({ type: "ReplanRoute" });
    expect(replanned).toEqual(expect.objectContaining({ success: true, code: "RouteReplanned", rejectionCode: null }));
    expect(replanned.previewPlanHash).not.toBe(initialHash);
    expect(replanned.telemetry.routePreview?.provenance?.sourceTick).toBeGreaterThan(initialProvenance!.sourceTick);

    const visibleHash = replanned.previewPlanHash!;
    const visibleProvenance = replanned.telemetry.routePreview?.provenance;
    const engaged = controller.dispatchCommand({ type: "EngageRoutePreview", expectedPlanHash: visibleHash });
    expect(engaged).toEqual(expect.objectContaining({
      success: true,
      code: "RoutePreviewEngaged",
      rejectionCode: null,
      previewPlanHash: visibleHash,
      lockedPlanHash: visibleHash
    }));
    expect(engaged.message).toContain("Autopilot engaged");
    expect(engaged.telemetry.executor.planHash).toBe(visibleHash);
    expect(engaged.telemetry.routePreview?.plan?.planHash).toBe(visibleHash);
    expect(engaged.telemetry.routePreview?.provenance).toEqual(visibleProvenance);
  });

  it("returns typed hash-mismatch and stale rejection results without replacing the preview", () => {
    const { controller } = createBrowserRuntime();
    const visibleHash = controller.getTelemetry().routePreview!.plan!.planHash;
    const mismatch = controller.dispatchCommand({ type: "EngageRoutePreview", expectedPlanHash: "deadbeef" });

    expect(mismatch).toEqual(expect.objectContaining({
      success: false,
      code: "ExpectedPlanHashMismatch",
      rejectionCode: "ExpectedPlanHashMismatch",
      previewPlanHash: visibleHash,
      lockedPlanHash: null
    }));
    expect(mismatch.message.length).toBeGreaterThan(0);

    controller.dispatchCommand({ type: "EngageRoutePreview", expectedPlanHash: visibleHash });
    const canceled = controller.dispatchCommand({ type: "CancelAutopilot" });
    const stale = controller.dispatchCommand({ type: "EngageRoutePreview", expectedPlanHash: visibleHash });
    expect(canceled.telemetry.routePreview).toEqual(expect.objectContaining({
      stale: true,
      staleReason: "Cancelled"
    }));
    expect(stale).toEqual(expect.objectContaining({
      success: false,
      code: "PreviewStale",
      rejectionCode: "PreviewStale",
      previewPlanHash: visibleHash,
      lockedPlanHash: null
    }));
  });

  it("cancel preserves the exact plan, hash, and provenance without refreshing it", () => {
    const { controller } = createBrowserRuntime();
    const before = controller.getTelemetry().routePreview!;
    controller.dispatchCommand({ type: "EngageRoutePreview", expectedPlanHash: before.plan!.planHash });

    const canceled = controller.dispatchCommand({ type: "CancelAutopilot" });

    expect(canceled.code).toBe("AutopilotCancelled");
    expect(canceled.lockedPlanHash).toBeNull();
    expect(canceled.previewPlanHash).toBe(before.plan!.planHash);
    expect(canceled.telemetry.routePreview?.plan).toEqual(before.plan);
    expect(canceled.telemetry.routePreview?.provenance).toEqual(before.provenance);
    expect(canceled.telemetry.routePreview).toEqual(expect.objectContaining({ stale: true, staleReason: "Cancelled" }));
  });

  it("rejects target, profile, preview, and replan changes while locked", () => {
    const { controller } = createBrowserRuntime();
    const visibleHash = controller.getTelemetry().routePreview!.plan!.planHash;
    controller.dispatchCommand({ type: "EngageRoutePreview", expectedPlanHash: visibleHash });

    const attempts = [
      controller.dispatchCommand({ type: "SelectTarget", targetId: provingGroundTargets.navigationBeta.id }),
      controller.dispatchCommand({ type: "SetRouteProfile", profile: "Fast" }),
      controller.dispatchCommand({ type: "PreviewRoute" }),
      controller.dispatchCommand({ type: "ReplanRoute" })
    ];

    expect(attempts.every((result) => !result.success && result.code === "PlanLocked")).toBe(true);
    expect(attempts.every((result) => result.previewPlanHash === visibleHash && result.lockedPlanHash === visibleHash)).toBe(true);
  });

  it("keeps legacy Engage compatible by locking the validated preview and ignoring its historical planner argument", () => {
    const { controller } = createBrowserRuntime();
    const before = controller.getTelemetry().routePreview!;
    expect(before.plan?.planner).toBe("ObstacleAvoidanceLocal");

    const engaged = controller.dispatchCommand({ type: "EngageAutopilot", planner: "DirectLocal" });

    expect(engaged.success).toBe(true);
    expect(engaged.code).toBe("RoutePreviewEngaged");
    expect(engaged.previewPlanHash).toBe(before.plan?.planHash);
    expect(engaged.lockedPlanHash).toBe(before.plan?.planHash);
    expect(engaged.telemetry.lockedPlan?.planner).toBe("ObstacleAvoidanceLocal");
    expect(engaged.telemetry.routePreview?.provenance).toEqual(before.provenance);
  });
});
