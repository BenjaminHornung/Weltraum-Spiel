import { describe, expect, it } from "vitest";
import { AutopilotExecutor, DirectLocalPlanner, FixedStepSimulationLoop, createShipStateV2, vec3 } from "../../src/core";
import { createBrowserRuntime } from "../../src/runtime/browserRuntime";
import { createProceduralShipVisual, proceduralScoutDescriptor, validateShipVisualDescriptor } from "../../src/render/three/shipVisual";
import { createTestBridge } from "../../src/test-harness/browserBridge";
import { serializeTelemetry } from "../../src/sim/telemetry";
import type { ShipState, TargetDescriptor } from "../../src/core";
import { provingGroundTargets } from "../../src/world/provingGroundWorld";

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
  it("validates required ship visual markers and socket descriptors", () => {
    const validation = validateShipVisualDescriptor(proceduralScoutDescriptor);

    expect(validation.ok).toBe(true);
    expect(validation.counts).toEqual({ hullParts: 4, mainEngines: 1, rcs: 6, muzzle: 1, cameraAnchors: 1 });
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
    expect(weakenedValidation.missing).toContain("at least four RCS markers");
    expect(() => createProceduralShipVisual(weakenedDescriptor)).toThrow(/RCS markers/);
  });

  it("publishes visual source state and scales main flame by acceleration magnitude", () => {
    const visual = createProceduralShipVisual();

    const initialSnapshot = visual.getSnapshot();
    expect(initialSnapshot.visualSource.state).toBe("GLBUnavailableFallback");
    expect(initialSnapshot.visualSource.candidateAssetPath).toBe("Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb");
    expect(initialSnapshot.descriptorValidation.ok).toBe(true);

    visual.updateVfx({
      mainThrustActive: true,
      rcsTranslationActive: false,
      rcsRotationActive: false,
      sasCorrectionActive: false,
      lastAppliedAcceleration: vec3(0, 12, 0),
      lastAppliedAngularAcceleration: vec3()
    });

    const offAxisThrustSnapshot = visual.getSnapshot();
    expect(offAxisThrustSnapshot.vfx.mainThrustVisible).toBe(true);
    expect(offAxisThrustSnapshot.vfx.mainThrustScale).toBeGreaterThan(1);
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
  });

  it("routes browser UI autopilot commands through the runtime controller", () => {
    const { controller } = createBrowserRuntime();

    const selected = controller.dispatchCommand({ type: "SelectTarget", targetId: provingGroundTargets.navigationBeta.id });
    expect(selected.selectedTarget?.id).toBe(provingGroundTargets.navigationBeta.id);
    expect(selected.routePreview?.plan?.target.id).toBe(provingGroundTargets.navigationBeta.id);
    expect(selected.executor.planHash).toBeNull();

    const engaged = controller.dispatchCommand({ type: "EngageAutopilot", planner: "DirectLocal" });
    expect(engaged.executor.status).toBe("Executing");
    expect(engaged.lockedPlan?.planner).toBe("DirectLocal");
    expect(engaged.lockedPlan?.target.id).toBe(provingGroundTargets.navigationBeta.id);
    expect(controller.getLockedPlan()?.planHash).toBe(engaged.executor.planHash);

    const canceled = controller.dispatchCommand({ type: "CancelAutopilot" });
    expect(canceled.executor.status).toBe("Idle");
    expect(canceled.executor.planHash).toBeNull();
    expect(canceled.selectedTarget?.id).toBe(provingGroundTargets.navigationBeta.id);
    expect(controller.getLockedPlan()).toBeNull();
  });

  it("ignores malformed browser UI commands without canceling the active plan", () => {
    const { controller } = createBrowserRuntime();
    controller.dispatchCommand({ type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" });
    const before = controller.getTelemetry();

    const after = controller.dispatchCommand({ type: "UnknownCommand" } as never);

    expect(after.executor.planHash).toBe(before.executor.planHash);
    expect(after.executor.status).toBe(before.executor.status);
    expect(controller.getLockedPlan()?.planHash).toBe(before.executor.planHash);
  });

  it("fails closed for unknown target selection without root fallback or locked-plan replacement", () => {
    const { controller } = createBrowserRuntime();
    const selected = controller.dispatchCommand({ type: "SelectTarget", targetId: provingGroundTargets.navigationBeta.id });
    const engaged = controller.dispatchCommand({ type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" });

    const afterUnknownTarget = controller.dispatchCommand({ type: "SelectTarget", targetId: "missing-target" });
    const afterMalformedTarget = controller.dispatchCommand({ type: "SelectTarget" } as never);

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
    const first = controller.dispatchCommand({ type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" });
    controller.dispatchCommand({ type: "SelectTarget", targetId: provingGroundTargets.navigationBeta.id });

    const second = controller.dispatchCommand({ type: "EngageAutopilot", planner: "DirectLocal" });

    expect(second.executor.planHash).toBe(first.executor.planHash);
    expect(second.lockedPlan?.target.id).toBe(provingGroundTargets.navigationAlpha.id);
    expect(second.selectedTarget?.id).toBe(provingGroundTargets.navigationAlpha.id);
    expect(second.routePreview?.plan?.target.id).toBe(provingGroundTargets.navigationAlpha.id);
    expect(second.runtimeMessage).toContain("cancel");
  });

  it("keeps selected target, preview, and plan stable when selecting during a locked route", () => {
    const { controller } = createBrowserRuntime();
    const engaged = controller.dispatchCommand({ type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" });

    const afterSelect = controller.dispatchCommand({ type: "SelectTarget", targetId: provingGroundTargets.navigationBeta.id });

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

  it("preserves browser vertical-slice snapshot fields during telemetry serialization", () => {
    const { controller } = createBrowserRuntime();
    const snapshot = controller.getTelemetry();

    const serialized = serializeTelemetry(snapshot);

    expect(serialized.selectedTarget?.id).toBe(snapshot.selectedTarget?.id);
    expect(serialized.selectableTargets?.map((targetOption) => targetOption.id)).toEqual(snapshot.selectableTargets?.map((targetOption) => targetOption.id));
    expect(serialized.routePreview?.target?.id).toBe(snapshot.routePreview?.target?.id);
    expect(serialized.routePreview?.plan?.planHash).toBe(snapshot.routePreview?.plan?.planHash);
    expect(serialized.routePreview?.playerMessage).toBe(snapshot.routePreview?.playerMessage);
    expect(serialized.runtimeMessage).toBe(snapshot.runtimeMessage);
    expect(serialized.manualInput).toEqual(snapshot.manualInput);
    expect(serialized.ship.orientation).toEqual(snapshot.ship.orientation);
    expect(serialized.ship.controlMode).toBe(snapshot.ship.controlMode);
    expect(serialized.ship.actuatorTelemetry.mainThrustActive).toBe(snapshot.ship.actuatorTelemetry.mainThrustActive);
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

    const translationMode = controller.dispatchCommand({ type: "CycleControlMode" });
    expect(translationMode.manualInput?.controlMode).toBe("Precision");
    controller.dispatchCommand({ type: "CycleControlMode" });
    const translation = controller.dispatchCommand({ type: "SetManualFlightInput", input: { translationCommand: vec3(0, 1, 0) } });
    expect(translation.manualInput?.controlMode).toBe("Translation");
    const afterTranslate = controller.step(2);
    expect(afterTranslate.ship.actuatorTelemetry.rcsTranslationActive).toBe(true);

    const camera = controller.dispatchCommand({ type: "CycleCameraMode" });
    expect(camera.manualInput?.cameraMode).toBe("OrbitInspect");
  });

  it("cancels a non-zero-velocity autopilot into drift-preserving idle state", () => {
    const movingShip = createShipStateV2({ position: vec3(3, 0, 0), velocity: vec3(12, 0, 0), authority: { mode: "Autopilot" } });
    const { controller } = createBrowserRuntime({ initialShip: movingShip });

    const canceled = controller.dispatchCommand({ type: "CancelAutopilot" });
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
