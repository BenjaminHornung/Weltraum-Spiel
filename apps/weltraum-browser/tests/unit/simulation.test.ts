import { describe, expect, it } from "vitest";
import { AutopilotExecutor, DirectLocalPlanner, FixedStepSimulationLoop, createShipStateV2, inactiveControlModeEffect, vec3 } from "../../src/core";
import { createBrowserRuntime } from "../../src/runtime/browserRuntime";
import {
  createDemoScoutShipVisual,
  createProceduralShipVisual,
  demoScoutGlbDescriptor,
  proceduralScoutDescriptor,
  validateShipVisualDescriptor
} from "../../src/render/three/shipVisual";
import { createStatusHudViewModel } from "../../src/ui/statusHud";
import { createTestBridge } from "../../src/test-harness/browserBridge";
import { serializeTelemetry } from "../../src/sim/telemetry";
import type { ShipState, TargetDescriptor } from "../../src/core";
import { playableLargeFieldTargets, provingGroundTargets } from "../../src/world/provingGroundWorld";
import { autopilotProvingGroundCourses } from "../../src/world/autopilotProvingGroundCourses";

const ship: ShipState = createShipStateV2({
  position: vec3(0, 0, 0),
  velocity: vec3(0, 0, 0),
  fuel: 50,
  authority: { mode: "Autopilot" }
});

const target: TargetDescriptor = {
  id: "beta",
  label: "Beta",
  kind: "Point",
  position: vec3(60, 0, 0),
  arrivalEnvelope: { radius: 2, stopBehavior: "NoStopRequired" }
};

describe("FixedStepSimulationLoop", () => {
  const waitForVisualSourceState = async (visual: ReturnType<typeof createDemoScoutShipVisual>, state: string) => {
    let snapshot = visual.getSnapshot();
    for (let attempt = 0; attempt < 25 && snapshot.visualSource.state !== state; attempt += 1) {
      await Promise.resolve();
      snapshot = visual.getSnapshot();
    }
    return snapshot;
  };

  it("validates required ship visual markers and socket descriptors", () => {
    const validation = validateShipVisualDescriptor(proceduralScoutDescriptor);
    const glbManifestValidation = validateShipVisualDescriptor(demoScoutGlbDescriptor);

    expect(validation.ok).toBe(true);
    expect(validation.counts).toEqual({ hullParts: 4, mainEngines: 1, mainEngineNozzles: 0, rcs: 6, legacyRcsMarkers: 6, rcsNozzles: 0, muzzle: 1, cameraAnchors: 1 });
    expect(glbManifestValidation.ok).toBe(true);
    expect(glbManifestValidation.counts).toEqual({ hullParts: 4, mainEngines: 1, mainEngineNozzles: 1, rcs: 4, legacyRcsMarkers: 0, rcsNozzles: 20, muzzle: 1, cameraAnchors: 1 });
    expect(proceduralScoutDescriptor.hullParts).toContain("main-hull");
    expect(proceduralScoutDescriptor.cockpitMarker.id).toContain("cockpit");
    expect(proceduralScoutDescriptor.mainEngineMarkers.map((marker) => marker.id)).toContain("main-engine-aft");
    expect(proceduralScoutDescriptor.rcsMarkers.map((marker) => marker.id)).toEqual(
      expect.arrayContaining(["rcs-front-left", "rcs-front-right", "rcs-aft-left", "rcs-aft-right"])
    );
    expect(proceduralScoutDescriptor.muzzleMarker.id).toBe("muzzle-placeholder");
    expect(proceduralScoutDescriptor.cameraAnchor.id).toBe("chase-camera-anchor");

    const weakenedDescriptor = { ...proceduralScoutDescriptor, rcsMarkers: proceduralScoutDescriptor.rcsMarkers.slice(0, 3) };
    const weakenedValidation = validateShipVisualDescriptor(weakenedDescriptor);
    expect(weakenedValidation.ok).toBe(false);
    expect(weakenedValidation.missing).toContain("exactly six legacy RCS markers");
    expect(() => createProceduralShipVisual(weakenedDescriptor)).toThrow(/legacy RCS markers/);
  });

  it("keeps Demo Scout GLB manifest marker signs aligned to browser render coordinates", () => {
    expect(demoScoutGlbDescriptor.mainEngineMarkers[0]?.localPosition.x).toBeLessThan(0);
    expect(demoScoutGlbDescriptor.cockpitMarker.localPosition.x).toBeGreaterThan(0);
    expect(demoScoutGlbDescriptor.muzzleMarker.localPosition.x).toBeGreaterThan(0);
    expect(validateShipVisualDescriptor(demoScoutGlbDescriptor).ok).toBe(true);
  });

  it("publishes visual source state and scales main flame by acceleration magnitude", () => {
    const visual = createProceduralShipVisual();

    const initialSnapshot = visual.getSnapshot();
    expect(initialSnapshot.visualSource.state).toBe("ProceduralFallback");
    expect(initialSnapshot.visualSource.candidateAssetPath).toBe("art/source/ships/prototype-ship-kit/exports/demo-ships/demo_scout_mk1.glb");
    expect(initialSnapshot.visualSource.axisCorrection.mapping).toBe("identity");
    expect(initialSnapshot.descriptorValidation.ok).toBe(true);

    visual.updateVfx({
      mainThrustActive: true,
      rcsTranslationActive: false,
      rcsRotationActive: false,
      sasCorrectionActive: false,
      controlModeEffect: inactiveControlModeEffect("Cruise"),
      lastAppliedMainAcceleration: vec3(0, 12, 0),
      lastAppliedRcsTranslationAcceleration: vec3(),
      lastAppliedAcceleration: vec3(0, 12, 0),
      lastAppliedAngularAcceleration: vec3()
    }, { x: 0, y: 0, z: 0, w: 1 });

    const offAxisThrustSnapshot = visual.getSnapshot();
    expect(offAxisThrustSnapshot.vfx.mainThrustVisible).toBe(true);
    expect(offAxisThrustSnapshot.vfx.mainThrustScale).toBeGreaterThan(1);
    expect(offAxisThrustSnapshot.vfx.mainEngineBinding.id).toBe("main-engine-aft");
    expect(offAxisThrustSnapshot.vfx.rcsBindings.length).toBeGreaterThanOrEqual(4);
  });

  it("exposes deterministic loading metadata while the Demo Scout GLB adapter keeps fallback geometry visible", () => {
    const visual = createDemoScoutShipVisual({ autoLoad: false });

    const snapshot = visual.getSnapshot();

    expect(snapshot.visualSource.state).toBe("Loading");
    expect(snapshot.visualSource.browserAssetPath).toBe("/ships/demo_scout_mk1.glb");
    expect(snapshot.visualSource.appliedScale).toBe(3.2);
    expect(snapshot.visualSource.axisCorrection.mapping).toBe("browserX=-glbZ,browserY=glbY,browserZ=glbX");
    expect(snapshot.descriptorValidation.ok).toBe(true);
    expect(snapshot.markerBindings.every((binding) => binding.source === "ManifestFallback")).toBe(true);
  });

  it("falls back deterministically when the normal Demo Scout GLB browser asset load fails", async () => {
    const visual = createDemoScoutShipVisual({
      loadGltf: async (assetPath) => {
        expect(assetPath).toBe("/ships/demo_scout_mk1.glb");
        throw new Error("malformed test GLB");
      }
    });
    const snapshot = await waitForVisualSourceState(visual, "GLBFailedFallback");

    expect(snapshot.visualSource.state).toBe("GLBFailedFallback");
    expect(snapshot.visualSource.browserAssetPath).toBe("/ships/demo_scout_mk1.glb");
    expect(snapshot.visualSource.fallbackReason).toEqual(expect.any(String));
    expect(snapshot.visualSource.fallbackReason).toContain("malformed test GLB");
    expect(snapshot.visualSource.fallbackReason?.length).toBeGreaterThan(0);
    expect(snapshot.visualSource.appliedScale).toBe(1);
    expect(snapshot.visualSource.axisCorrection.mapping).toBe("identity");
    expect(snapshot.visualSource.axisCorrection.rotationYRadians).toBe(0);
    expect(snapshot.descriptorValidation.ok).toBe(true);
    expect(snapshot.markerCounts).toEqual({ hullParts: 4, mainEngines: 1, rcs: 6, muzzle: 1, cameraAnchors: 1 });
    expect(snapshot.markerBindings.every((binding) => binding.source === "ManifestFallback")).toBe(true);
    expect(snapshot.nozzleBindings).toHaveLength(6);
    expect(snapshot.nozzleBindings.every((binding) => binding.kind === "LegacyMarkerFallback")).toBe(true);
    expect(snapshot.vfx.rcsPuffs).toHaveLength(6);
    expect(snapshot.vfx.visibleRcsPuffCount).toBe(0);
    expect(snapshot.vfx.bindingKindCounts).toEqual({ DirectionalNozzle: 0, LegacyMarkerFallback: 6 });
    expect(snapshot.vfx.nozzleSourceCounts).toEqual({ GLBNode: 0, ManifestNozzleFallback: 0 });
    expect([...snapshot.markerBindings, snapshot.cameraAnchorBinding].every((binding) =>
      Number.isFinite(binding.localPosition.x) &&
      Number.isFinite(binding.localPosition.y) &&
      Number.isFinite(binding.localPosition.z)
    )).toBe(true);

    const { controller } = createBrowserRuntime();
    expect(createStatusHudViewModel(controller.getTelemetry(), snapshot.visualSource).visualSourceLine).toBe("Ship visual: Procedural fallback");
  });

  it("advances in deterministic fixed ticks", () => {
    const executorA = new AutopilotExecutor();
    const executorB = new AutopilotExecutor();
    const plan = new DirectLocalPlanner().plan({ tick: 0, ship, target });
    executorA.lockPlan(plan, ship);
    executorB.lockPlan(plan, ship);

    const loopA = new FixedStepSimulationLoop(ship, executorA, { fixedDeltaSeconds: 1 / 10, maxSubSteps: 20 });
    const loopB = new FixedStepSimulationLoop(ship, executorB, { fixedDeltaSeconds: 1 / 10, maxSubSteps: 20 });

    loopA.advance(0.5);
    loopB.step(5);

    expect(loopA.getTick()).toBe(5);
    expect(loopA.getShip().position.x).toBeCloseTo(loopB.getShip().position.x, 8);
    expect(loopA.getTelemetry().planHash).toBe(plan.planHash);
  });

  it("exposes elapsed-time fixed-step advancement through the app bridge", () => {
    const { controller } = createBrowserRuntime();
    controller.dispatchCommand({ type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" });

    const before = controller.getTelemetry();
    const partial = controller.advance(1 / 60);
    const afterOneTick = controller.advance(1 / 60);

    expect(partial.executor.tick).toBe(before.executor.tick);
    expect(afterOneTick.executor.tick).toBe(before.executor.tick + 1);
    expect(afterOneTick.executor.planHash).toBe(before.executor.planHash);
  });

  it("interpolates presentation pose from cloned fixed-step truth without mutating truth", () => {
    const executor = new AutopilotExecutor({ allowManualInputWhenIdle: true });
    const movingShip = createShipStateV2({ position: vec3(0, 0, 0), velocity: vec3(10, 0, 0), authority: { mode: "Manual", autopilotAvailable: false } });
    const loop = new FixedStepSimulationLoop(movingShip, executor, { fixedDeltaSeconds: 0.1, maxSubSteps: 4 });

    loop.advance(0.1);
    const truthAfterTick = loop.getShip();
    loop.advance(0.05);
    const presentation = loop.getPresentationSnapshot();

    expect(loop.getShip().position.x).toBeCloseTo(truthAfterTick.position.x, 8);
    expect(presentation.interpolationAlpha).toBeCloseTo(0.5, 8);
    expect(presentation.renderedShip.position.x).toBeGreaterThan(presentation.previousShip.position.x);
    expect(presentation.renderedShip.position.x).toBeLessThan(presentation.currentShip.position.x);
    (presentation.renderedShip.position as { x: number }).x = 999;
    (presentation.currentShip.position as { x: number }).x = 999;
    (presentation.currentShip.actuatorTelemetry.lastAppliedMainAcceleration as { x: number }).x = 999;
    (presentation.currentShip.actuatorTelemetry.lastAppliedRcsTranslationAcceleration as { x: number }).x = 999;
    expect(loop.getShip().position.x).toBeCloseTo(truthAfterTick.position.x, 8);
    expect(loop.getShip().actuatorTelemetry.lastAppliedMainAcceleration.x).toBe(0);
    expect(loop.getShip().actuatorTelemetry.lastAppliedRcsTranslationAcceleration.x).toBe(0);
  });

  it("publishes real flight telemetry before the first browser runtime step", () => {
    const { controller } = createBrowserRuntime();

    const initial = controller.getTelemetry();

    expect(initial.executor.tick).toBe(0);
    expect(initial.ship.fuel.current).toBeGreaterThan(0);
    expect(initial.flightSnapshot.fuel.current).toBe(initial.ship.fuel.current);
    expect(initial.flightSnapshot.mass.totalMass).toBe(initial.ship.mass.totalMass);
    expect(initial.flightSnapshot.authority.mode).toBe(initial.ship.authority.mode);
    expect(initial.flightSnapshot.authority.autopilotAvailable).toBe(true);
    expect(initial.flightSnapshot.routeValid).toBe(true);
    expect(initial.flightSnapshot.failureReasonCodes).not.toContain("FuelDepleted");
    expect(initial.flightSnapshot.failureReasonCodes).not.toContain("AutopilotUnavailable");
    expect(initial.executor.planHash).toBeNull();
    expect(initial.manualInput?.cameraMode).toBe("ChaseLocked");
    expect(initial.manualInput?.controlMode).toBe("Cruise");
    expect(initial.selectedTarget?.id).toBe(provingGroundTargets.navigationAlpha.id);
    expect(initial.routePreview?.state).toBe("Ready");
    expect(initial.routePreview?.plan?.target.id).toBe(provingGroundTargets.navigationAlpha.id);
    expect(initial.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-500m",
      label: "Reach Range 500m",
      targetId: playableLargeFieldTargets.range500.id,
      status: "available",
      nextAction: "select target"
    }));
    expect(initial.navigationObjective?.options).toEqual([
      expect.objectContaining({ id: "reach-range-500m", status: "available", isActive: true }),
      expect.objectContaining({ id: "reach-range-1000m", status: "locked", isActive: false }),
      expect.objectContaining({ id: "reach-range-2500m", status: "locked", isActive: false })
    ]);
  });

  it("progresses the large-field navigation objective from runtime target selection to executor completion", () => {
    const { controller } = createBrowserRuntime({
      initialShip: createShipStateV2({ position: vec3(498, 0, 0), authority: { mode: "Autopilot" } })
    });

    const selectedResult = controller.dispatchCommand({ type: "SelectObjective", objectiveId: "reach-range-500m" });
    const selected = selectedResult.telemetry;

    expect(selectedResult.success).toBe(true);
    expect(selectedResult.code).toBe("ObjectiveSelected");
    expect(selected.selectedTarget?.id).toBe(playableLargeFieldTargets.range500.id);
    expect(selected.routePreview?.state).toBe("Ready");
    expect(selected.routePreview?.plan?.target.id).toBe(playableLargeFieldTargets.range500.id);
    expect(selected.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-500m",
      status: "route-ready",
      nextAction: "engage autopilot"
    }));
    expect(selected.runtimeMessage).toContain("Reach Range 500m available");

    const engageResult = controller.dispatchCommand({ type: "EngageAutopilot", planner: "DirectLocal" });
    let telemetry = engageResult.telemetry;
    expect(engageResult.success).toBe(true);
    expect(engageResult.code).toBe("RoutePreviewEngaged");
    expect(telemetry.lockedPlan?.target.id).toBe(playableLargeFieldTargets.range500.id);
    expect(telemetry.navigationObjective?.status).toBe("enroute");

    for (let i = 0; i < 240 && telemetry.navigationObjective?.status !== "complete"; i += 1) {
      telemetry = controller.step(1);
    }

    expect(telemetry.executor.status).toBe("Arrived");
    expect(telemetry.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-500m",
      status: "complete",
      nextAction: "next objective available"
    }));
    expect(telemetry.navigationObjective?.options).toEqual([
      expect.objectContaining({ id: "reach-range-500m", status: "complete", isActive: true }),
      expect.objectContaining({ id: "reach-range-1000m", status: "available", isActive: false }),
      expect.objectContaining({ id: "reach-range-2500m", status: "locked", isActive: false })
    ]);
    expect(telemetry.navigationObjective?.hint).toContain("complete");
    expect(telemetry.navigationObjective?.hint).toContain("Reach Range 1000m is available");
  });

  it("keeps the engaged navigation objective active when another objective is clicked mid-route", () => {
    const { controller } = createBrowserRuntime({
      initialShip: createShipStateV2({ position: vec3(498, 0, 0), authority: { mode: "Autopilot" } })
    });

    controller.dispatchCommand({ type: "SelectObjective", objectiveId: "reach-range-500m" });
    controller.dispatchCommand({ type: "EngageAutopilot", planner: "DirectLocal" });
    const attemptedSwitchResult = controller.dispatchCommand({ type: "SelectObjective", objectiveId: "reach-range-1000m" });
    const attemptedSwitch = attemptedSwitchResult.telemetry;

    expect(attemptedSwitchResult.success).toBe(false);
    expect(attemptedSwitchResult.code).toBe("PlanLocked");
    expect(attemptedSwitch.runtimeMessage).toBe("Cancel the current autopilot route before changing objective target.");
    expect(attemptedSwitch.selectedTarget?.id).toBe(playableLargeFieldTargets.range500.id);
    expect(attemptedSwitch.lockedPlan?.target.id).toBe(playableLargeFieldTargets.range500.id);
    expect(attemptedSwitch.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-500m",
      status: "enroute"
    }));

    let telemetry = attemptedSwitch;
    for (let i = 0; i < 240 && telemetry.navigationObjective?.status !== "complete"; i += 1) {
      telemetry = controller.step(1);
    }

    expect(telemetry.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-500m",
      status: "complete"
    }));
    expect(telemetry.navigationObjective?.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "reach-range-500m", status: "complete", isActive: true }),
      expect.objectContaining({ id: "reach-range-1000m", status: "available", isActive: false }),
      expect.objectContaining({ id: "reach-range-2500m", status: "locked", isActive: false })
    ]));
  });

  it("keeps later objective choices visible but locked until prerequisites complete", () => {
    const { controller } = createBrowserRuntime();

    const attemptedLockedObjectiveResult = controller.dispatchCommand({ type: "SelectObjective", objectiveId: "reach-range-1000m" });
    const attemptedLockedObjective = attemptedLockedObjectiveResult.telemetry;

    expect(attemptedLockedObjectiveResult.success).toBe(false);
    expect(attemptedLockedObjectiveResult.code).toBe("ObjectiveLocked");
    expect(attemptedLockedObjective.runtimeMessage).toBe("Reach Range 1000m locked: complete Reach Range 500m first.");
    expect(attemptedLockedObjective.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-500m",
      status: "available",
      nextAction: "select target"
    }));
    expect(attemptedLockedObjective.selectedTarget?.id).toBe(provingGroundTargets.navigationAlpha.id);
    expect(attemptedLockedObjective.navigationObjective?.options).toEqual([
      expect.objectContaining({ id: "reach-range-500m", status: "available", isActive: true }),
      expect.objectContaining({ id: "reach-range-1000m", status: "locked", isActive: false }),
      expect.objectContaining({ id: "reach-range-2500m", status: "locked", isActive: false })
    ]);
  });

  it("unlocks and routes the 1000m objective after the 500m objective completes", () => {
    const { controller } = createBrowserRuntime({
      initialShip: createShipStateV2({ position: vec3(498, 0, 0), authority: { mode: "Autopilot" } })
    });

    controller.dispatchCommand({ type: "SelectObjective", objectiveId: "reach-range-500m" });
    let telemetry = controller.dispatchCommand({ type: "EngageAutopilot", planner: "DirectLocal" }).telemetry;
    for (let i = 0; i < 240 && telemetry.navigationObjective?.status !== "complete"; i += 1) {
      telemetry = controller.step(1);
    }

    expect(telemetry.navigationObjective?.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "reach-range-1000m", status: "available", isActive: false })
    ]));

    const selected1000mResult = controller.dispatchCommand({ type: "SelectObjective", objectiveId: "reach-range-1000m" });
    const selected1000m = selected1000mResult.telemetry;

    expect(selected1000mResult.success).toBe(true);
    expect(selected1000mResult.code).toBe("ObjectiveSelected");
    expect(selected1000m.selectedTarget?.id).toBe(playableLargeFieldTargets.range1000.id);
    expect(selected1000m.routePreview?.state).toBe("Ready");
    expect(selected1000m.routePreview?.plan?.target.id).toBe(playableLargeFieldTargets.range1000.id);
    expect(selected1000m.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-1000m",
      status: "route-ready",
      nextAction: "engage autopilot"
    }));
    expect(selected1000m.navigationObjective?.options).toEqual([
      expect.objectContaining({ id: "reach-range-500m", status: "complete", isActive: false }),
      expect.objectContaining({ id: "reach-range-1000m", status: "route-ready", isActive: true }),
      expect.objectContaining({ id: "reach-range-2500m", status: "locked", isActive: false })
    ]);
  });

  it("activates the unlocked 1000m objective when its visible planner target is selected", () => {
    const { controller } = createBrowserRuntime({
      initialShip: createShipStateV2({ position: vec3(498, 0, 0), authority: { mode: "Autopilot" } })
    });

    const selected500m = controller.dispatchCommand({ type: "SelectTarget", targetId: playableLargeFieldTargets.range500.id });
    let telemetry = controller.dispatchCommand({
      type: "EngageRoutePreview",
      expectedPlanHash: selected500m.previewPlanHash ?? ""
    }).telemetry;
    for (let i = 0; i < 240 && !telemetry.executor.stationKeepingActive; i += 1) {
      telemetry = controller.step(1);
    }

    expect(telemetry.executor.stationKeepingActive).toBe(true);
    expect(telemetry.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-500m",
      status: "complete"
    }));

    const selected1000mResult = controller.dispatchCommand({
      type: "SelectTarget",
      targetId: playableLargeFieldTargets.range1000.id
    });
    const selected1000m = selected1000mResult.telemetry;

    expect(selected1000mResult.success).toBe(true);
    expect(selected1000mResult.code).toBe("TargetSelected");
    expect(selected1000mResult.previewPlanHash).toMatch(/^[a-f0-9]{8}$/);
    expect(selected1000m.executor.stationKeepingActive).toBe(false);
    expect(selected1000m.selectedTarget?.id).toBe(playableLargeFieldTargets.range1000.id);
    expect(selected1000m.routePreview?.target?.id).toBe(playableLargeFieldTargets.range1000.id);
    expect(selected1000m.routePreview?.plan?.target.id).toBe(playableLargeFieldTargets.range1000.id);
    expect(selected1000m.routePreview?.plan?.planHash).toBe(selected1000mResult.previewPlanHash);
    expect(selected1000m.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-1000m",
      status: "route-ready",
      nextAction: "engage autopilot"
    }));
    expect(selected1000m.navigationObjective?.options).toEqual([
      expect.objectContaining({ id: "reach-range-500m", status: "complete", isActive: false }),
      expect.objectContaining({ id: "reach-range-1000m", status: "route-ready", isActive: true }),
      expect.objectContaining({ id: "reach-range-2500m", status: "locked", isActive: false })
    ]);

    telemetry = controller.step(30);
    expect(telemetry.executor.stationKeepingActive).toBe(false);
    expect(telemetry.routePreview?.plan?.planHash).toBe(selected1000mResult.previewPlanHash);
    expect(telemetry.routePreview?.lockAdmission).toEqual(expect.objectContaining({
      ok: true,
      code: "Ready",
      planHash: selected1000mResult.previewPlanHash
    }));
    expect(telemetry.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-1000m",
      status: "route-ready"
    }));

    const engaged1000m = controller.dispatchCommand({
      type: "EngageRoutePreview",
      expectedPlanHash: selected1000mResult.previewPlanHash ?? ""
    });
    telemetry = engaged1000m.telemetry;
    expect(engaged1000m.success).toBe(true);
    expect(telemetry.navigationObjective?.status).toBe("enroute");

    for (let i = 0; i < 12_000 && telemetry.navigationObjective?.status !== "complete"; i += 1) {
      telemetry = controller.step(1);
    }

    expect(telemetry.executor.status).toBe("Arrived");
    expect(telemetry.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-1000m",
      status: "complete"
    }));
    expect(telemetry.navigationObjective?.options).toEqual([
      expect.objectContaining({ id: "reach-range-500m", status: "complete", isActive: false }),
      expect.objectContaining({ id: "reach-range-1000m", status: "complete", isActive: true }),
      expect.objectContaining({ id: "reach-range-2500m", status: "available", isActive: false })
    ]);

    const completed1000mPlanHash = telemetry.executor.completedPlanHash;
    expect(completed1000mPlanHash).toBe(selected1000mResult.previewPlanHash);

    const selected2500mResult = controller.dispatchCommand({
      type: "SelectTarget",
      targetId: playableLargeFieldTargets.range2500.id
    });
    const selected2500m = selected2500mResult.telemetry;
    const preview2500mHash = selected2500mResult.previewPlanHash;

    expect(selected2500mResult.success).toBe(true);
    expect(selected2500mResult.code).toBe("TargetSelected");
    expect(preview2500mHash).toMatch(/^[a-f0-9]{8}$/);
    expect(preview2500mHash).not.toBe(completed1000mPlanHash);
    expect(selected2500m.executor.status).toBe("Idle");
    expect(selected2500m.executor.stationKeepingActive).toBe(false);
    expect(selected2500m.executor.completedPlanHash).toBe(completed1000mPlanHash);
    expect(selected2500m.selectedTarget?.id).toBe(playableLargeFieldTargets.range2500.id);
    expect(selected2500m.routePreview?.state).toBe("Ready");
    expect(selected2500m.routePreview?.stale).toBe(false);
    expect(selected2500m.routePreview?.plan?.target.id).toBe(playableLargeFieldTargets.range2500.id);
    expect(selected2500m.routePreview?.plan?.planHash).toBe(preview2500mHash);
    expect(selected2500m.routePreview?.lockAdmission).toEqual(expect.objectContaining({
      ok: true,
      code: "Ready",
      planHash: preview2500mHash
    }));
    expect(selected2500m.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-2500m",
      status: "route-ready",
      nextAction: "engage autopilot"
    }));
    expect(selected2500m.navigationObjective?.options).toEqual([
      expect.objectContaining({ id: "reach-range-500m", status: "complete", isActive: false }),
      expect.objectContaining({ id: "reach-range-1000m", status: "complete", isActive: false }),
      expect.objectContaining({ id: "reach-range-2500m", status: "route-ready", isActive: true })
    ]);

    const stable2500m = controller.step(30);
    expect(stable2500m.routePreview?.plan?.planHash).toBe(preview2500mHash);
    expect(stable2500m.routePreview?.lockAdmission).toEqual(expect.objectContaining({
      ok: true,
      code: "Ready",
      planHash: preview2500mHash
    }));
    expect(stable2500m.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-2500m",
      status: "route-ready"
    }));
  });

  it("keeps completed station holding active while no planning mutation occurs", () => {
    const { controller } = createBrowserRuntime({
      initialShip: createShipStateV2({ position: vec3(498, 0, 0), authority: { mode: "Autopilot" } })
    });
    const selected500m = controller.dispatchCommand({ type: "SelectTarget", targetId: playableLargeFieldTargets.range500.id });
    let telemetry = controller.dispatchCommand({
      type: "EngageRoutePreview",
      expectedPlanHash: selected500m.previewPlanHash ?? ""
    }).telemetry;
    for (let i = 0; i < 240 && !telemetry.executor.stationKeepingActive; i += 1) {
      telemetry = controller.step(1);
    }

    const holdingPlanHash = telemetry.routePreview?.plan?.planHash;
    const holdingSourceTick = telemetry.routePreview?.provenance?.sourceTick;
    const completedPlanHash = telemetry.executor.completedPlanHash;
    telemetry = controller.step(30);

    expect(telemetry.executor.status).toBe("Arrived");
    expect(telemetry.executor.routeLifecycle).toBe("Holding");
    expect(telemetry.executor.stationKeepingActive).toBe(true);
    expect(telemetry.executor.completedPlanHash).toBe(completedPlanHash);
    expect(telemetry.routePreview?.plan?.planHash).toBe(holdingPlanHash);
    expect(telemetry.routePreview?.provenance?.sourceTick).toBe(holdingSourceTick);
    expect(telemetry.selectedTarget?.id).toBe(playableLargeFieldTargets.range500.id);
    expect(telemetry.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-500m",
      status: "complete"
    }));
  });

  it("keeps a locked objective inactive when its target is selected as a generic destination", () => {
    const { controller } = createBrowserRuntime();

    const selectedResult = controller.dispatchCommand({
      type: "SelectTarget",
      targetId: playableLargeFieldTargets.range2500.id
    });
    const selected = selectedResult.telemetry;

    expect(selectedResult.success).toBe(true);
    expect(selectedResult.code).toBe("TargetSelected");
    expect(selected.selectedTarget?.id).toBe(playableLargeFieldTargets.range2500.id);
    expect(selected.routePreview?.state).toBe("Ready");
    expect(selected.routePreview?.plan?.target.id).toBe(playableLargeFieldTargets.range2500.id);
    expect(selected.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-500m",
      status: "available"
    }));
    expect(selected.navigationObjective?.options).toEqual([
      expect.objectContaining({ id: "reach-range-500m", status: "available", isActive: true }),
      expect.objectContaining({ id: "reach-range-1000m", status: "locked", isActive: false }),
      expect.objectContaining({ id: "reach-range-2500m", status: "locked", isActive: false })
    ]);
  });

  it("does not reactivate a completed objective when its target is selected again", () => {
    const { controller } = createBrowserRuntime({
      initialShip: createShipStateV2({ position: vec3(498, 0, 0), authority: { mode: "Autopilot" } })
    });

    const selected500m = controller.dispatchCommand({ type: "SelectTarget", targetId: playableLargeFieldTargets.range500.id });
    let telemetry = controller.dispatchCommand({
      type: "EngageRoutePreview",
      expectedPlanHash: selected500m.previewPlanHash ?? ""
    }).telemetry;
    for (let i = 0; i < 240 && telemetry.navigationObjective?.status !== "complete"; i += 1) {
      telemetry = controller.step(1);
    }

    const selected1000m = controller.dispatchCommand({
      type: "SelectTarget",
      targetId: playableLargeFieldTargets.range1000.id
    });
    expect(selected1000m.telemetry.navigationObjective?.id).toBe("reach-range-1000m");

    const reselected500m = controller.dispatchCommand({
      type: "SelectTarget",
      targetId: playableLargeFieldTargets.range500.id
    }).telemetry;

    expect(reselected500m.selectedTarget?.id).toBe(playableLargeFieldTargets.range500.id);
    expect(reselected500m.routePreview?.plan?.target.id).toBe(playableLargeFieldTargets.range500.id);
    expect(reselected500m.navigationObjective).toEqual(expect.objectContaining({
      id: "reach-range-1000m",
      status: "available"
    }));
    expect(reselected500m.navigationObjective?.options).toEqual([
      expect.objectContaining({ id: "reach-range-500m", status: "complete", isActive: false }),
      expect.objectContaining({ id: "reach-range-1000m", status: "available", isActive: true }),
      expect.objectContaining({ id: "reach-range-2500m", status: "locked", isActive: false })
    ]);
  });

  it("rejects target-first objective activation while a plan is locked without mutating route state", () => {
    const { controller } = createBrowserRuntime();
    const selected500m = controller.dispatchCommand({ type: "SelectTarget", targetId: playableLargeFieldTargets.range500.id });
    const engaged = controller.dispatchCommand({
      type: "EngageRoutePreview",
      expectedPlanHash: selected500m.previewPlanHash ?? ""
    }).telemetry;

    const attemptedSelection = controller.dispatchCommand({
      type: "SelectTarget",
      targetId: playableLargeFieldTargets.range1000.id
    });
    const after = attemptedSelection.telemetry;

    expect(attemptedSelection.success).toBe(false);
    expect(attemptedSelection.code).toBe("PlanLocked");
    expect(after.navigationObjective?.id).toBe(engaged.navigationObjective?.id);
    expect(after.navigationObjective?.options).toEqual(engaged.navigationObjective?.options);
    expect(after.selectedTarget?.id).toBe(engaged.selectedTarget?.id);
    expect(after.routePreview?.target?.id).toBe(engaged.routePreview?.target?.id);
    expect(after.routePreview?.plan?.planHash).toBe(engaged.routePreview?.plan?.planHash);
    expect(after.lockedPlan?.planHash).toBe(engaged.lockedPlan?.planHash);
  });

  it("routes browser UI autopilot commands through the runtime controller", () => {
    const { controller } = createBrowserRuntime();

    const selectedResult = controller.dispatchCommand({ type: "SelectTarget", targetId: provingGroundTargets.navigationBeta.id });
    const selected = selectedResult.telemetry;
    expect(selectedResult.success).toBe(true);
    expect(selectedResult.code).toBe("TargetSelected");
    expect(selected.selectedTarget?.id).toBe(provingGroundTargets.navigationBeta.id);
    expect(selected.routePreview?.plan?.target.id).toBe(provingGroundTargets.navigationBeta.id);
    expect(selected.executor.planHash).toBeNull();

    const engagedResult = controller.dispatchCommand({ type: "EngageAutopilot", planner: "DirectLocal" });
    const engaged = engagedResult.telemetry;
    expect(engagedResult.success).toBe(true);
    expect(engagedResult.code).toBe("RoutePreviewEngaged");
    expect(engaged.executor.status).toBe("Executing");
    expect(engaged.lockedPlan?.planner).toBe("ObstacleAvoidanceLocal");
    expect(engaged.lockedPlan?.target.id).toBe(provingGroundTargets.navigationBeta.id);
    expect(controller.getLockedPlan()?.planHash).toBe(engaged.executor.planHash);

    const canceledResult = controller.dispatchCommand({ type: "CancelAutopilot" });
    const canceled = canceledResult.telemetry;
    expect(canceledResult.success).toBe(true);
    expect(canceledResult.code).toBe("AutopilotCancelled");
    expect(canceled.executor.status).toBe("Idle");
    expect(canceled.executor.planHash).toBeNull();
    expect(canceled.selectedTarget?.id).toBe(provingGroundTargets.navigationBeta.id);
    expect(controller.getLockedPlan()).toBeNull();
  });

  it("ignores malformed browser UI commands without canceling the active plan", () => {
    const { controller } = createBrowserRuntime();
    controller.dispatchCommand({ type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" });
    const before = controller.getTelemetry();

    const afterResult = controller.dispatchCommand({ type: "UnknownCommand" } as never);
    const after = afterResult.telemetry;

    expect(afterResult.success).toBe(false);
    expect(afterResult.code).toBe("InvalidCommand");
    expect(after.executor.planHash).toBe(before.executor.planHash);
    expect(after.executor.status).toBe(before.executor.status);
    expect(controller.getLockedPlan()?.planHash).toBe(before.executor.planHash);
  });

  it("fails closed for unknown target selection without root fallback or locked-plan replacement", () => {
    const { controller } = createBrowserRuntime();
    const selected = controller.dispatchCommand({ type: "SelectTarget", targetId: provingGroundTargets.navigationBeta.id }).telemetry;
    const engaged = controller.dispatchCommand({ type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" }).telemetry;

    const afterUnknownTargetResult = controller.dispatchCommand({ type: "SelectTarget", targetId: "missing-target" });
    const afterMalformedTargetResult = controller.dispatchCommand({ type: "SelectTarget" } as never);
    const afterUnknownTarget = afterUnknownTargetResult.telemetry;
    const afterMalformedTarget = afterMalformedTargetResult.telemetry;

    expect(afterUnknownTargetResult.code).toBe("PlanLocked");
    expect(afterMalformedTargetResult.code).toBe("PlanLocked");
    expect(selected.selectedTarget?.id).toBe(provingGroundTargets.navigationBeta.id);
    expect(afterUnknownTarget.selectedTarget?.id).toBe(provingGroundTargets.navigationBeta.id);
    expect(afterMalformedTarget.selectedTarget?.id).toBe(provingGroundTargets.navigationBeta.id);
    expect(afterUnknownTarget.executor.planHash).toBe(engaged.executor.planHash);
    expect(afterMalformedTarget.executor.planHash).toBe(engaged.executor.planHash);
    expect(afterUnknownTarget.lockedPlan?.target.position).toEqual(provingGroundTargets.navigationBeta.position);
    expect(afterMalformedTarget.routePreview?.plan?.target.position).toEqual(provingGroundTargets.navigationBeta.position);
  });

  it("does not replace an already locked plan when engage is dispatched again", () => {
    const { controller } = createBrowserRuntime();
    const first = controller.dispatchCommand({ type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" }).telemetry;
    controller.dispatchCommand({ type: "SelectTarget", targetId: provingGroundTargets.navigationBeta.id });

    const secondResult = controller.dispatchCommand({ type: "EngageAutopilot", planner: "DirectLocal" });
    const second = secondResult.telemetry;

    expect(secondResult.success).toBe(false);
    expect(secondResult.code).toBe("PlanAlreadyLocked");
    expect(second.executor.planHash).toBe(first.executor.planHash);
    expect(second.lockedPlan?.target.id).toBe(provingGroundTargets.navigationAlpha.id);
    expect(second.selectedTarget?.id).toBe(provingGroundTargets.navigationAlpha.id);
    expect(second.routePreview?.plan?.target.id).toBe(provingGroundTargets.navigationAlpha.id);
    expect(second.runtimeMessage).toContain("Cancel");
  });

  it("allows a new target and route after completed terminal holding without canceling first", () => {
    const { controller } = createBrowserRuntime();
    const engaged = controller.dispatchCommand({ type: "EngageAutopilot", planner: "DirectLocal" }).telemetry;
    const firstPlanHash = engaged.executor.planHash;
    let holding = controller.getTelemetry();
    for (let i = 0; i < 1_800 && !holding.executor.stationKeepingActive; i += 1) {
      holding = controller.step(1);
    }

    expect(holding.executor.status).toBe("Arrived");
    expect(holding.executor.routeLifecycle).toBe("Holding");
    expect(holding.executor.planHash).toBeNull();
    expect(holding.executor.completedPlanHash).toBe(firstPlanHash);
    expect(holding.executor.canAcceptNewPlan).toBe(true);
    expect(holding.executor.canSelectNewTarget).toBe(true);
    expect(holding.lockedPlan).toBeNull();
    expect(controller.getLockedPlan()).toBeNull();

    const selected = controller.dispatchCommand({ type: "SelectTarget", targetId: provingGroundTargets.navigationBeta.id }).telemetry;
    const second = controller.dispatchCommand({ type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" }).telemetry;

    expect(selected.selectedTarget?.id).toBe(provingGroundTargets.navigationBeta.id);
    expect(second.executor.status).toBe("Executing");
    expect(second.executor.planHash).toMatch(/^[a-f0-9]{8}$/);
    expect(second.executor.planHash).not.toBe(firstPlanHash);
    expect(second.executor.completedPlanHash).toBe(firstPlanHash);
    expect(second.lockedPlan?.target.id).toBe(provingGroundTargets.navigationBeta.id);
    expect(second.executor.stationKeepingActive).toBe(false);
    expect(second.executor.canAcceptNewPlan).toBe(false);
    expect(second.executor.canSelectNewTarget).toBe(false);
  });

  it("keeps selected target, preview, and plan stable when selecting during a locked route", () => {
    const { controller } = createBrowserRuntime();
    const engaged = controller.dispatchCommand({ type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" }).telemetry;

    const afterSelectResult = controller.dispatchCommand({ type: "SelectTarget", targetId: provingGroundTargets.navigationBeta.id });
    const afterSelect = afterSelectResult.telemetry;

    expect(afterSelectResult.success).toBe(false);
    expect(afterSelectResult.code).toBe("PlanLocked");
    expect(afterSelect.executor.planHash).toBe(engaged.executor.planHash);
    expect(afterSelect.lockedPlan?.target.id).toBe(provingGroundTargets.navigationAlpha.id);
    expect(afterSelect.selectedTarget?.id).toBe(provingGroundTargets.navigationAlpha.id);
    expect(afterSelect.routePreview?.target?.id).toBe(provingGroundTargets.navigationAlpha.id);
    expect(afterSelect.routePreview?.plan?.planHash).toBe(engaged.executor.planHash);
    expect(afterSelect.runtimeMessage).toBe("Cancel the current autopilot route before selecting another target.");
  });

  it("does not expose legacy plan-lock helpers through controller or TestBridge", () => {
    const { controller } = createBrowserRuntime();
    const bridge = createTestBridge(controller);

    expect("useDirectPlan" in controller).toBe(false);
    expect("useObstacleAvoidancePlan" in controller).toBe(false);
    expect("useDirectPlan" in bridge).toBe(false);
    expect("useObstacleAvoidancePlan" in bridge).toBe(false);
  });

  it("exposes the gated proving-ground v2 helpers through TestBridge only", () => {
    const { controller } = createBrowserRuntime();
    const bridge = createTestBridge(controller);

    expect(bridge.listAutopilotProvingGroundCourses()).toEqual(expect.arrayContaining([
      "direct-medium-stop",
      "direct-long-stop",
      "direct-very-long-stop"
    ]));
    const safe = bridge.runAutopilotProvingGroundCourse("direct-long", "Safe");
    const balanced = bridge.runAutopilotProvingGroundCourse("direct-long", "Balanced");
    expect(balanced.classification).toBe("Pass");
    expect(balanced.ticksToArrival as number).toBeLessThan(safe.ticksToArrival as number);
    expect(balanced.finalSpeed).toBeLessThanOrEqual(0.5);
    expect(bridge.runAutopilotProvingGroundCourse("direct-long-fast").profile).toBe("Fast");
    expect(bridge.runAutopilotProvingGroundCourse("direct-long-fast", "Safe").profile).toBe("Safe");
    expect(bridge.runAutopilotProvingGroundMatrix("Balanced")).toHaveLength(autopilotProvingGroundCourses.length);
  });

  it("preserves browser vertical-slice snapshot fields during telemetry serialization", () => {
    const { controller } = createBrowserRuntime();
    const snapshot = controller.getTelemetry();

    const serialized = serializeTelemetry(snapshot);

    expect(serialized.selectedTarget?.id).toBe(snapshot.selectedTarget?.id);
    expect(serialized.selectableTargets?.map((targetOption) => targetOption.id)).toEqual(snapshot.selectableTargets?.map((targetOption) => targetOption.id));
    expect(serialized.routePreview?.target?.id).toBe(snapshot.routePreview?.target?.id);
    expect(serialized.routePreview?.plan?.planHash).toBe(snapshot.routePreview?.plan?.planHash);
    expect(serialized.routePreview?.playerMessage).toBe(snapshot.routePreview?.playerMessage);
    expect(serialized.navigationObjective).toEqual(snapshot.navigationObjective);
    expect(serialized.runtimeMessage).toBe(snapshot.runtimeMessage);
    expect(serialized.manualInput).toEqual(snapshot.manualInput);
    expect(serialized.ship.orientation).toEqual(snapshot.ship.orientation);
    expect(serialized.ship.controlMode).toBe(snapshot.ship.controlMode);
    expect(serialized.ship.actuatorTelemetry.mainThrustActive).toBe(snapshot.ship.actuatorTelemetry.mainThrustActive);
    expect(serialized.executor.arrivalPhase).toBe(snapshot.executor.arrivalPhase);
    expect(serialized.executor.completedPlanHash).toBe(snapshot.executor.completedPlanHash);
    expect(serialized.executor.canAcceptNewPlan).toBe(snapshot.executor.canAcceptNewPlan);
    expect(serialized.executor.canSelectNewTarget).toBe(snapshot.executor.canSelectNewTarget);
    expect(serialized.executor.desiredTerminalVelocity).toEqual(snapshot.executor.desiredTerminalVelocity);
    expect(typeof serialized.executor.currentSpeed).toBe("number");
  });

  it("applies manual flight commands through runtime-owned input state while idle", () => {
    const { controller } = createBrowserRuntime();

    controller.dispatchCommand({ type: "SetThrottle", throttle: 0.7 });
    controller.dispatchCommand({ type: "SetManualFlightInput", input: { rotationCommand: vec3(0, 0, 1) } });
    const afterBurn = controller.step(12);

    expect(afterBurn.executor.status).toBe("Idle");
    expect(afterBurn.manualInput?.mainThrottleCommand).toBe(0.7);
    expect(afterBurn.ship.throttle).toBe(0.7);
    expect(afterBurn.ship.position.x).toBeGreaterThan(0);
    expect(afterBurn.ship.velocity.x).toBeGreaterThan(0);
    expect(afterBurn.ship.orientation).not.toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(afterBurn.ship.actuatorTelemetry.mainThrustActive).toBe(true);
    expect(afterBurn.ship.actuatorTelemetry.rcsRotationActive).toBe(true);
    expect(afterBurn.ship.actuatorTelemetry.controlModeEffect.modeEffectLabel).toBe("main thrust enabled");

    const translationMode = controller.dispatchCommand({ type: "CycleControlMode" }).telemetry;
    expect(translationMode.manualInput?.controlMode).toBe("Precision");
    expect(translationMode.manualInput?.mainThrottleCommand).toBe(0);
    controller.dispatchCommand({ type: "SetManualFlightInput", input: { rotationCommand: vec3(0, 0, 1) } });
    const afterPrecisionRotate = controller.step(2);
    expect(afterPrecisionRotate.ship.actuatorTelemetry.mainThrustActive).toBe(false);
    expect(afterPrecisionRotate.ship.actuatorTelemetry.rcsRotationActive).toBe(true);
    expect(afterPrecisionRotate.ship.actuatorTelemetry.controlModeEffect.modeEffectLabel).toBe("RCS attitude / main thrust blocked");
    controller.dispatchCommand({ type: "CycleControlMode" });
    const translation = controller.dispatchCommand({ type: "SetManualFlightInput", input: { translationCommand: vec3(0, 1, 0) } }).telemetry;
    expect(translation.manualInput?.controlMode).toBe("Translation");
    const afterTranslate = controller.step(2);
    expect(afterTranslate.ship.actuatorTelemetry.rcsTranslationActive).toBe(true);
    expect(afterTranslate.ship.actuatorTelemetry.controlModeEffect.modeEffectLabel).toBe("RCS translation / main thrust blocked");

    const camera = controller.dispatchCommand({ type: "CycleCameraMode" }).telemetry;
    expect(camera.manualInput?.cameraMode).toBe("OrbitInspect");
  });

  it("does not persist SetThrottle commands issued outside Cruise", () => {
    const { controller } = createBrowserRuntime();

    controller.dispatchCommand({ type: "CycleControlMode" });
    const precisionThrottle = controller.dispatchCommand({ type: "SetThrottle", throttle: 0.8 }).telemetry;
    const afterPrecisionStep = controller.step(1);
    controller.dispatchCommand({ type: "CycleControlMode" });
    controller.dispatchCommand({ type: "CycleControlMode" });
    const backToCruise = controller.step(1);

    expect(precisionThrottle.manualInput?.controlMode).toBe("Precision");
    expect(precisionThrottle.manualInput?.mainThrottleCommand).toBe(0);
    expect(precisionThrottle.runtimeMessage).toBe("Throttle ignored outside Cruise.");
    expect(afterPrecisionStep.ship.throttle).toBe(0);
    expect(afterPrecisionStep.ship.mainThrottleCommand).toBe(0);
    expect(afterPrecisionStep.ship.actuatorTelemetry.mainThrustActive).toBe(false);
    expect(backToCruise.manualInput?.controlMode).toBe("Cruise");
    expect(backToCruise.manualInput?.mainThrottleCommand).toBe(0);
    expect(backToCruise.ship.throttle).toBe(0);
    expect(backToCruise.ship.actuatorTelemetry.mainThrustActive).toBe(false);
    expect(backToCruise.ship.velocity).toEqual(vec3());
  });

  it("cancels a non-zero-velocity autopilot into drift-preserving idle state", () => {
    const movingShip = createShipStateV2({ position: vec3(3, 0, 0), velocity: vec3(12, 0, 0), authority: { mode: "Autopilot" } });
    const { controller } = createBrowserRuntime({ initialShip: movingShip });

    const canceled = controller.dispatchCommand({ type: "CancelAutopilot" }).telemetry;
    const afterSteps = controller.step(5);

    expect(canceled.executor.status).toBe("Idle");
    expect(canceled.executor.planHash).toBeNull();
    expect(canceled.ship.position).toEqual(movingShip.position);
    expect(canceled.ship.velocity).toEqual(movingShip.velocity);
    expect(canceled.executor.position).toEqual(movingShip.position);
    expect(canceled.executor.velocity).toEqual(movingShip.velocity);
    expect(afterSteps.ship.position.x).toBeCloseTo(5, 8);
    expect(afterSteps.ship.velocity).toEqual(movingShip.velocity);
    expect(afterSteps.executor.position.x).toBeCloseTo(5, 8);
    expect(afterSteps.executor.velocity).toEqual(movingShip.velocity);
    expect(afterSteps.ship.actuatorTelemetry.mainThrustActive).toBe(false);
  });
});
