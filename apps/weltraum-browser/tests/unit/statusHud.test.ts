import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applyFlightControllerStep, createFlightSnapshot, createShipStateV2, inactiveControlModeEffect, vec3 } from "../../src/core";
import { createStatusHudViewModel, renderStatusHud } from "../../src/ui/statusHud";

const elementIds = [
  "flight-hud",
  "plan-hash",
  "mode",
  "control-mode",
  "control-mode-effect",
  "camera-mode",
  "ship-visual-source",
  "throttle-status",
  "velocity-status",
  "rcs-sas-status",
  "status",
  "objective-label",
  "objective-status",
  "objective-target",
  "objective-distance",
  "objective-next-action",
  "objective-hint",
  "objective-options",
  "route-status",
  "target-status",
  "target-options",
  "target-distance",
  "radar-status",
  "fuel-status",
  "authority-status",
  "brake-status",
  "warning-chips",
  "failure-reasons",
  "runtime-message",
  "autopilot-action-state",
  "throttle-meter-fill",
  "fuel-meter-fill",
  "help-hint",
  "engage-autopilot",
  "cancel-autopilot"
] as const;

type StubElement = {
  textContent: string;
  onclick: ((event?: unknown) => void) | null;
  disabled: boolean;
  title: string;
  style: Record<string, string>;
  attributes: Map<string, string>;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getAttribute(name: string): string | null;
};

const createStubElement = (): StubElement => {
  const attributes = new Map<string, string>();
  return {
    textContent: "",
    onclick: null,
    disabled: false,
    title: "",
    style: {},
    attributes,
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    removeAttribute(name: string) {
      attributes.delete(name);
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    }
  };
};

const installDocumentStub = () => {
  const elements = new Map<string, StubElement>();
  for (const id of elementIds) {
    elements.set(id, createStubElement());
  }

  globalThis.document = {
    getElementById(id: string) {
      return elements.get(id) ?? null;
    }
  } as unknown as Document;

  return elements;
};

describe("renderStatusHud", () => {
  afterEach(() => {
    delete (globalThis as { document?: Document }).document;
  });

  it("renders owner FlightSnapshot values instead of recomputing from ship fields", () => {
    const elements = installDocumentStub();
    const ship = createShipStateV2({ fuel: 100, authority: { mode: "Autopilot" } });
    const ownerSnapshot = createFlightSnapshot(createShipStateV2({ fuel: 0, authority: { mode: "Manual", autopilotAvailable: false } }), null);

    renderStatusHud({
      ship,
      lockedPlan: null,
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 1,
        status: "OutOfFuel",
        planHash: "abcdef12",
        activeSegmentId: null,
        distanceToTarget: 0,
        offRouteDistance: 0,
        replanRequired: true,
        invalidationReasons: ownerSnapshot.failureReasonCodes,
        failureReasonCodes: ownerSnapshot.failureReasonCodes,
        fuel: ownerSnapshot.fuel,
        flightSnapshot: ownerSnapshot,
        position: ship.position,
        velocity: ship.velocity
      }
    });

    expect(elements.get("mode")?.textContent).toBe("Manual");
    expect(elements.get("control-mode")?.textContent).toBe("Cruise");
    expect(elements.get("control-mode-effect")?.textContent).toContain("main thrust enabled");
    expect(elements.get("camera-mode")?.textContent).toBe("ChaseLocked");
    expect(elements.get("ship-visual-source")?.textContent).toBe("Ship visual: Procedural fallback");
    expect(elements.get("help-hint")?.textContent).toContain("Desktop keyboard/mouse manual flight");
    expect(elements.get("help-hint")?.textContent).toContain("W/S pitch");
    expect(elements.get("help-hint")?.textContent).toContain("Mobile: target selection and autopilot only");
    expect(elements.get("route-status")?.textContent).toContain("select a target");
    expect(elements.get("objective-label")?.textContent).toBe("No navigation objective");
    expect(elements.get("objective-status")?.textContent).toBe("Inactive");
    expect(elements.get("objective-options")?.textContent).toBe("no objectives available");
    expect(elements.get("fuel-status")?.textContent).toContain("Blocked");
    expect(elements.get("status")?.textContent).toContain("Autopilot blocked: fuel");
    expect(elements.get("flight-hud")?.getAttribute("data-route-tone")).toBe("blocked");
    expect(elements.get("status")?.getAttribute("data-hud-tone")).toBe("blocked");
    expect(elements.get("fuel-status")?.getAttribute("data-hud-tone")).toBe("blocked");
    expect(elements.get("fuel-meter-fill")?.style.width).toBe("0%");
    expect(elements.get("failure-reasons")?.textContent).toContain("Fuel insufficient");
    expect(elements.get("failure-reasons")?.textContent).not.toContain("FuelInsufficient");
    expect(elements.get("warning-chips")?.textContent).toContain("Fuel insufficient");
  });

  it("summarizes route failures without exposing raw internal failure codes", () => {
    const elements = installDocumentStub();
    const ship = createShipStateV2({ authority: { mode: "Autopilot" } });
    const ownerSnapshot = { ...createFlightSnapshot(ship, null), routeValid: false, failureReasonCodes: ["OffLockedRoute" as const] };

    renderStatusHud({
      ship,
      lockedPlan: null,
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 1,
        status: "Diverged",
        planHash: "abcdef12",
        activeSegmentId: null,
        distanceToTarget: 0,
        offRouteDistance: 32,
        replanRequired: true,
        invalidationReasons: ownerSnapshot.failureReasonCodes,
        failureReasonCodes: ownerSnapshot.failureReasonCodes,
        fuel: ownerSnapshot.fuel,
        flightSnapshot: ownerSnapshot,
        position: ship.position,
        velocity: ship.velocity
      }
    });

    expect(elements.get("failure-reasons")?.textContent).toContain("Plan invalidated");
    expect(elements.get("warning-chips")?.textContent).toContain("Plan invalidated");
    expect(elements.get("failure-reasons")?.textContent).not.toContain("OffLockedRoute");
    expect(elements.get("warning-chips")?.textContent).not.toContain("OffLockedRoute");
  });

  it("creates a player-facing ViewModel for target, distance, plan state, and warnings", () => {
    const ship = createShipStateV2({ fuel: 0, authority: { mode: "Manual", autopilotAvailable: false } });
    const ownerSnapshot = createFlightSnapshot(ship, {
      id: "plan-a",
      planner: "DirectLocal",
      createdAtTick: 0,
      target: {
        id: "target-a",
        label: "Target A",
        kind: "Waypoint",
        position: ship.position,
        arrivalEnvelope: { radius: 3 }
      },
      segments: [],
      validation: { ok: true, issues: [], rejectedReasonCodes: [] },
      score: { distance: 0, segmentCount: 0, clearanceRisk: 0, fuelCostEstimate: 0, authorityRisk: 0, total: 0, reasons: [] },
      planHash: "abc123ef"
    });

    const viewModel = createStatusHudViewModel({
      ship,
      lockedPlan: {
        id: "plan-a",
        planner: "DirectLocal",
        createdAtTick: 0,
        target: {
          id: "target-a",
          label: "Target A",
          kind: "Waypoint",
          position: ship.position,
          arrivalEnvelope: { radius: 3 }
        },
        segments: [],
        validation: { ok: true, issues: [], rejectedReasonCodes: [] },
        score: { distance: 0, segmentCount: 0, clearanceRisk: 0, fuelCostEstimate: 0, authorityRisk: 0, total: 0, reasons: [] },
        planHash: "abc123ef"
      },
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 3,
        status: "OutOfFuel",
        planHash: "abc123ef",
        activeSegmentId: null,
        distanceToTarget: 42.42,
        offRouteDistance: 0,
        replanRequired: true,
        invalidationReasons: ownerSnapshot.failureReasonCodes,
        failureReasonCodes: ownerSnapshot.failureReasonCodes,
        fuel: ownerSnapshot.fuel,
        flightSnapshot: ownerSnapshot,
        position: ship.position,
        velocity: ship.velocity
      }
    });

    expect(viewModel.target).toBe("Target A [Waypoint]");
    expect(viewModel.distance).toBe("42.4 m");
    expect(viewModel.routeState).toContain("new plan required");
    expect(viewModel.autopilotState).toContain("Autopilot blocked: fuel");
    expect(viewModel.controlMode).toBe("Precision");
    expect(viewModel.controlModeEffectState).toContain("RCS attitude / main thrust blocked");
    expect(viewModel.controlModeEffectState).toContain("main thrust mode-blocked");
    expect(viewModel.cameraMode).toBe("ChaseLocked");
    expect(viewModel.throttleState).toContain("0%");
    expect(viewModel.velocityState).toContain("m/s");
    expect(viewModel.velocityState).not.toMatch(/\(-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?\)/);
    expect(viewModel.rcsSasState).toContain("RCS on");
    expect(viewModel.helpHint).toContain("CapsLock mode");
    expect(viewModel.radarState).toContain("local contact Target A");
    expect(viewModel.warningChips.map((chip) => chip.code)).toEqual(expect.arrayContaining(["FuelInsufficient", "FuelDepleted"]));
    expect(viewModel.flightStatus.title).toBe("Flight Status");
    expect(viewModel.flightStatus.mode.value).toBe("Manual");
    expect(viewModel.flightStatus.speed.value).toBe(viewModel.velocityState);
    expect(viewModel.flightStatus.throttleMeter).toEqual({ percent: 0, tone: "idle" });
    expect(viewModel.flightStatus.fuelMeter).toEqual({ percent: 0, tone: "blocked" });
    expect(viewModel.navigation.title).toBe("Navigation");
    expect(viewModel.navigation.target.value).toBe("Target A [Waypoint]");
    expect(viewModel.navigation.routeTone).toBe("blocked");
    expect(viewModel.routeTone).toBe("blocked");
    expect(viewModel.warnings.title).toBe("Warnings");
    expect(viewModel.warnings.summary).toContain("Fuel insufficient");
    expect(viewModel.actions.title).toBe("Route Action");
    expect(viewModel.actions.primaryCommandEnabled).toBe(false);
    expect(viewModel.actions.primaryDisabledReason).toContain("Cancel the current route");
    expect(viewModel.actions.stateLabel).toContain("Cancel");
    expect(viewModel.actions.stateTone).toBe("blocked");
    expect(viewModel.actionTone).toBe("blocked");
    expect(viewModel.debug.title).toBe("Diagnostics");
  });

  it("does not dispatch the primary HUD command until a route preview is ready", () => {
    const elements = installDocumentStub();
    const ship = createShipStateV2({ authority: { mode: "Autopilot" } });
    const ownerSnapshot = createFlightSnapshot(ship, null);
    const commands: unknown[] = [];

    renderStatusHud(
      {
        ship,
        lockedPlan: null,
        flightSnapshot: ownerSnapshot,
        executor: {
          tick: 1,
          status: "Idle",
          planHash: null,
          activeSegmentId: null,
          distanceToTarget: 0,
          offRouteDistance: 0,
          replanRequired: false,
          invalidationReasons: [],
          failureReasonCodes: [],
          fuel: ownerSnapshot.fuel,
          flightSnapshot: ownerSnapshot,
          position: ship.position,
          velocity: ship.velocity
        }
      },
      { dispatch: (command) => commands.push(command) }
    );

    elements.get("engage-autopilot")?.onclick?.();
    elements.get("cancel-autopilot")?.onclick?.();

    expect(commands).toEqual([{ type: "CancelAutopilot" }]);
    expect(elements.get("engage-autopilot")?.textContent).toBe("Hold route");
    expect(elements.get("engage-autopilot")?.disabled).toBe(true);
    expect(elements.get("engage-autopilot")?.getAttribute("aria-disabled")).toBe("true");
    expect(elements.get("engage-autopilot")?.title).toContain("Select a target");
    expect(elements.get("autopilot-action-state")?.textContent).toBe("Select a target first");
  });

  it("enables the primary HUD command only for a ready route preview", () => {
    const elements = installDocumentStub();
    const ship = createShipStateV2({ authority: { mode: "Autopilot" } });
    const ownerSnapshot = createFlightSnapshot(ship, null);
    const commands: unknown[] = [];
    const target = {
      id: "target-b",
      label: "Target B",
      kind: "Point" as const,
      position: ship.position,
      arrivalEnvelope: { radius: 3 }
    };

    renderStatusHud(
      {
        ship,
        lockedPlan: null,
        selectedTarget: target,
        routePreview: {
          state: "Ready",
          planner: "ObstacleAvoidanceLocal",
          target,
          plan: {
            id: "preview-b",
            planner: "ObstacleAvoidanceLocal",
            createdAtTick: 0,
            target,
            segments: [{ id: "direct-0", kind: "Direct", start: ship.position, end: target.position, desiredSpeed: 18, clearanceRadius: 3 }],
            validation: { ok: true, issues: [], rejectedReasonCodes: [] },
            score: { distance: 12, segmentCount: 1, clearanceRisk: 0, fuelCostEstimate: 0, authorityRisk: 0, total: 12, reasons: [] },
            planHash: "bead1234"
          },
          validation: { ok: true, issues: [], rejectedReasonCodes: [] },
          rejectedReasonCodes: [],
          playerMessage: "Route preview ready for Target B."
        },
        flightSnapshot: ownerSnapshot,
        executor: {
          tick: 1,
          status: "Idle",
          planHash: null,
          activeSegmentId: null,
          distanceToTarget: 0,
          offRouteDistance: 0,
          replanRequired: false,
          invalidationReasons: [],
          failureReasonCodes: [],
          fuel: ownerSnapshot.fuel,
          flightSnapshot: ownerSnapshot,
          position: ship.position,
          velocity: ship.velocity
        }
      },
      { dispatch: (command) => commands.push(command) }
    );

    elements.get("engage-autopilot")?.onclick?.();

    expect(commands).toEqual([{ type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" }]);
    expect(elements.get("engage-autopilot")?.textContent).toBe("Engage route");
    expect(elements.get("engage-autopilot")?.disabled).toBe(false);
    expect(elements.get("engage-autopilot")?.getAttribute("aria-disabled")).toBe("false");
    expect(elements.get("engage-autopilot")?.title).toBe("");
    expect(elements.get("autopilot-action-state")?.textContent).toBe("Ready");
    expect(elements.get("route-status")?.getAttribute("data-hud-tone")).toBe("ready");
    expect(elements.get("autopilot-action-state")?.getAttribute("data-hud-tone")).toBe("ready");
    expect(elements.get("flight-hud")?.getAttribute("data-action-tone")).toBe("ready");
  });

  it("keeps route engage disabled when the completed objective points to the next objective", () => {
    const elements = installDocumentStub();
    const ship = createShipStateV2({ authority: { mode: "Autopilot" } });
    const ownerSnapshot = createFlightSnapshot(ship, null);
    const target = {
      id: "range-500m",
      label: "Range 500m",
      kind: "Waypoint" as const,
      position: ship.position,
      arrivalEnvelope: { radius: 8 }
    };
    const commands: unknown[] = [];

    renderStatusHud(
      {
        ship,
        lockedPlan: null,
        selectedTarget: target,
        navigationObjective: {
          id: "reach-range-500m",
          label: "Reach Range 500m",
          targetId: "range-500m",
          targetLabel: "Range 500m",
          status: "complete",
          hint: "Reach Range 500m complete. Reach Range 1000m is available.",
          distanceMeters: 1,
          nextAction: "next objective available",
          options: [
            { id: "reach-range-500m", label: "Reach Range 500m", targetId: "range-500m", status: "complete", isActive: true },
            { id: "reach-range-1000m", label: "Reach Range 1000m", targetId: "range-1000m", status: "available", isActive: false }
          ]
        },
        routePreview: {
          state: "Ready",
          planner: "ObstacleAvoidanceLocal",
          target,
          plan: {
            id: "preview-complete",
            planner: "ObstacleAvoidanceLocal",
            createdAtTick: 0,
            target,
            segments: [{ id: "direct-0", kind: "Direct", start: ship.position, end: target.position, desiredSpeed: 18, clearanceRadius: 3 }],
            validation: { ok: true, issues: [], rejectedReasonCodes: [] },
            score: { distance: 1, segmentCount: 1, clearanceRisk: 0, fuelCostEstimate: 0, authorityRisk: 0, total: 1, reasons: [] },
            planHash: "done500m"
          },
          validation: { ok: true, issues: [], rejectedReasonCodes: [] },
          rejectedReasonCodes: [],
          playerMessage: "Route preview ready for Range 500m."
        },
        flightSnapshot: ownerSnapshot,
        executor: {
          tick: 1,
          status: "Arrived",
          routeLifecycle: "Holding",
          arrivalPhase: "Holding",
          planHash: null,
          completedPlanHash: "done500m",
          stationKeepingActive: true,
          activeSegmentId: null,
          distanceToTarget: 1,
          offRouteDistance: 0,
          replanRequired: false,
          invalidationReasons: [],
          failureReasonCodes: [],
          fuel: ownerSnapshot.fuel,
          flightSnapshot: ownerSnapshot,
          position: ship.position,
          velocity: ship.velocity
        }
      },
      { dispatch: (command) => commands.push(command) }
    );

    elements.get("engage-autopilot")?.onclick?.();

    expect(commands).toEqual([]);
    expect(elements.get("engage-autopilot")?.textContent).toBe("Hold route");
    expect(elements.get("engage-autopilot")?.disabled).toBe(true);
    expect(elements.get("autopilot-action-state")?.textContent).toBe("Next objective available");
    expect(elements.get("autopilot-action-state")?.getAttribute("data-hud-tone")).toBe("holding");
  });

  it("renders selected target and route-preview labels from snapshot fields", () => {
    const elements = installDocumentStub();
    const ship = createShipStateV2({ authority: { mode: "Autopilot" } });
    const ownerSnapshot = createFlightSnapshot(ship, null);
    const target = {
      id: "target-b",
      label: "Target B",
      kind: "Point" as const,
      position: ship.position,
      arrivalEnvelope: { radius: 3 }
    };

    renderStatusHud({
      ship,
      lockedPlan: null,
      selectedTarget: target,
      selectableTargets: [target],
      routePreview: {
        state: "Ready",
        planner: "ObstacleAvoidanceLocal",
        target,
        plan: {
          id: "preview-b",
          planner: "ObstacleAvoidanceLocal",
          createdAtTick: 0,
          target,
          segments: [{ id: "direct-0", kind: "Direct", start: ship.position, end: target.position, desiredSpeed: 18, clearanceRadius: 3 }],
          validation: { ok: true, issues: [], rejectedReasonCodes: [] },
          score: { distance: 12, segmentCount: 1, clearanceRisk: 0, fuelCostEstimate: 0, authorityRisk: 0, total: 12, reasons: [] },
          planHash: "bead1234"
        },
        validation: { ok: true, issues: [], rejectedReasonCodes: [] },
        rejectedReasonCodes: [],
        playerMessage: "Route preview ready for Target B."
      },
      runtimeMessage: "Selected Target B.",
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 1,
        status: "Idle",
        planHash: null,
        activeSegmentId: null,
        distanceToTarget: 0,
        offRouteDistance: 0,
        replanRequired: false,
        invalidationReasons: [],
        failureReasonCodes: [],
        fuel: ownerSnapshot.fuel,
        flightSnapshot: ownerSnapshot,
        position: ship.position,
        velocity: ship.velocity
      }
    });

    expect(elements.get("target-status")?.textContent).toBe("Target B [Point]");
    expect(elements.get("route-status")?.textContent).toContain("preview ready");
    expect(elements.get("radar-status")?.textContent).toContain("local contact Target B");
    expect(elements.get("runtime-message")?.textContent).toContain("Selected Target B");
    expect(elements.get("target-options")?.textContent).toContain("Target B ~0 m (selected)");
  });

  it("renders navigation objective state from telemetry fields", () => {
    const elements = installDocumentStub();
    const ship = createShipStateV2({ authority: { mode: "Autopilot" } });
    const ownerSnapshot = createFlightSnapshot(ship, null);

    renderStatusHud({
      ship,
      lockedPlan: null,
      navigationObjective: {
        id: "reach-range-500m",
        label: "Reach Range 500m",
        targetId: "range-500m",
        targetLabel: "Range 500m",
        status: "route-ready",
        hint: "Route preview ready for Range 500m; engage autopilot to progress.",
        distanceMeters: 514.1,
        nextAction: "engage autopilot",
        options: [
          { id: "reach-range-500m", label: "Reach Range 500m", targetId: "range-500m", status: "route-ready", isActive: true },
          { id: "reach-range-1000m", label: "Reach Range 1000m", targetId: "range-1000m", status: "locked", isActive: false }
        ]
      },
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 1,
        status: "Idle",
        planHash: null,
        activeSegmentId: null,
        distanceToTarget: 0,
        offRouteDistance: 0,
        replanRequired: false,
        invalidationReasons: [],
        failureReasonCodes: [],
        fuel: ownerSnapshot.fuel,
        flightSnapshot: ownerSnapshot,
        position: ship.position,
        velocity: ship.velocity
      }
    });

    expect(elements.get("objective-label")?.textContent).toBe("Reach Range 500m");
    expect(elements.get("objective-status")?.textContent).toBe("Route ready");
    expect(elements.get("objective-status")?.getAttribute("data-hud-tone")).toBe("ready");
    expect(elements.get("objective-target")?.textContent).toBe("Range 500m");
    expect(elements.get("objective-distance")?.textContent).toBe("514.1 m");
    expect(elements.get("objective-next-action")?.textContent).toBe("engage autopilot");
    expect(elements.get("objective-hint")?.textContent).toContain("engage autopilot");
    expect(elements.get("objective-options")?.textContent).toContain("Reach Range 500m (route ready)");
    expect(elements.get("objective-options")?.textContent).toContain("Reach Range 1000m (locked)");
  });

  it("formats large-field target choices, route distance, and radar scale for readable km previews", () => {
    const ship = createShipStateV2({ authority: { mode: "Autopilot" } });
    const ownerSnapshot = createFlightSnapshot(ship, null);
    const targets = [
      {
        id: "range-500m",
        label: "Range 500m",
        kind: "Point" as const,
        position: vec3(500, 0, 0),
        arrivalEnvelope: { radius: 8 }
      },
      {
        id: "range-1000m",
        label: "Range 1000m",
        kind: "Point" as const,
        position: vec3(1000, 0, 0),
        arrivalEnvelope: { radius: 8 }
      },
      {
        id: "range-2500m",
        label: "Range 2500m",
        kind: "Point" as const,
        position: vec3(2500, 0, 0),
        arrivalEnvelope: { radius: 8 }
      }
    ];
    const target = targets[2];

    const viewModel = createStatusHudViewModel({
      ship,
      lockedPlan: null,
      selectedTarget: target,
      selectableTargets: targets,
      routePreview: {
        state: "Ready",
        planner: "ObstacleAvoidanceLocal",
        target,
        plan: {
          id: "preview-2500",
          planner: "ObstacleAvoidanceLocal",
          createdAtTick: 0,
          target,
          segments: [
            { id: "leg-0", kind: "Direct", start: ship.position, end: vec3(1000, 0, 0), desiredSpeed: 18, clearanceRadius: 3 },
            { id: "leg-1", kind: "Direct", start: vec3(1000, 0, 0), end: vec3(2000, 0, 0), desiredSpeed: 18, clearanceRadius: 3 },
            { id: "leg-2", kind: "Direct", start: vec3(2000, 0, 0), end: target.position, desiredSpeed: 18, clearanceRadius: 3 }
          ],
          validation: { ok: true, issues: [], rejectedReasonCodes: [] },
          score: { distance: 2500, segmentCount: 3, clearanceRisk: 0, fuelCostEstimate: 0, authorityRisk: 0, total: 2500, reasons: [] },
          planHash: "face2500"
        },
        validation: { ok: true, issues: [], rejectedReasonCodes: [] },
        rejectedReasonCodes: [],
        playerMessage: "Route preview ready for Range 2500m."
      },
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 1,
        status: "Idle",
        planHash: null,
        activeSegmentId: null,
        distanceToTarget: 0,
        offRouteDistance: 0,
        replanRequired: false,
        invalidationReasons: [],
        failureReasonCodes: [],
        fuel: ownerSnapshot.fuel,
        flightSnapshot: ownerSnapshot,
        position: ship.position,
        velocity: ship.velocity
      }
    });

    expect(viewModel.distance).toBe("2.5 km");
    expect(viewModel.routeState).toBe("preview ready: 3 legs, route 2.5 km");
    expect(viewModel.radarState).toContain("local contact Range 2500m");
    expect(viewModel.radarState).toContain("auto range 2.5 km");
    expect(viewModel.radarState).toContain("terminal 2.5 km");
    expect(viewModel.targetOptions.map((option) => option.displayLabel)).toEqual(["Range 500m ~500 m", "Range 1000m ~1.0 km", "Range 2500m ~2.5 km"]);
    expect(viewModel.targetOptions[2].ariaLabel).toBe("Range 2500m, Point, range 2.5 km");
  });

  it("keeps completed station-keeping route hashes out of the player HUD", () => {
    const elements = installDocumentStub();
    const ship = createShipStateV2({ authority: { mode: "Autopilot" } });
    const ownerSnapshot = createFlightSnapshot(ship, null);
    const completedPlanHash = "completed-raw-hash-1234";

    renderStatusHud({
      ship,
      lockedPlan: null,
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 7,
        status: "Arrived",
        routeLifecycle: "Holding",
        arrivalPhase: "Holding",
        planHash: null,
        completedPlanHash,
        stationKeepingActive: true,
        canAcceptNewPlan: true,
        canSelectNewTarget: true,
        activeSegmentId: null,
        distanceToTarget: 0,
        offRouteDistance: 0,
        replanRequired: false,
        invalidationReasons: [],
        failureReasonCodes: [],
        fuel: ownerSnapshot.fuel,
        flightSnapshot: ownerSnapshot,
        position: ship.position,
        velocity: ship.velocity
      }
    });

    expect(elements.get("plan-hash")?.textContent).toBe("Plan completed");
    expect(elements.get("route-status")?.textContent).toBe("holding at target; new route ready");
    expect(elements.get("route-status")?.getAttribute("data-hud-tone")).toBe("holding");
    expect(elements.get("autopilot-action-state")?.textContent).toBe("Holding at target; select a new route");
    expect(elements.get("autopilot-action-state")?.getAttribute("data-hud-tone")).toBe("holding");

    const playerText = [
      "plan-hash",
      "mode",
      "status",
      "target-status",
      "route-status",
      "target-distance",
      "radar-status",
      "fuel-status",
      "warning-chips",
      "failure-reasons",
      "runtime-message",
      "ship-visual-source",
      "autopilot-action-state"
    ].map((id) => elements.get(id)?.textContent ?? "").join("\n");

    expect(playerText).toContain("Plan completed");
    expect(playerText).toContain("holding at target");
    expect(playerText).toContain("new route ready");
    expect(playerText).not.toContain(completedPlanHash);
  });

  it("shows manual flight state, actuator state, and camera mode from snapshots", () => {
    const ship = createShipStateV2({
      controlMode: "Translation",
      throttle: 0.42,
      rcsEnabled: true,
      sasEnabled: false,
      velocity: { x: 1, y: 2, z: 3 },
      actuatorTelemetry: {
        mainThrustActive: true,
        rcsTranslationActive: true,
        rcsRotationActive: false,
        sasCorrectionActive: false,
        controlModeEffect: {
          ...inactiveControlModeEffect("Translation"),
          mainThrustAllowed: false,
          rcsTranslationAllowed: true,
          rcsRotationAllowed: true,
          sasAllowed: false,
          blockedReasonCodes: ["MainThrustModeBlocked", "SasDisabled"]
        },
        lastAppliedAcceleration: { x: 1, y: 0, z: 0 },
        lastAppliedAngularAcceleration: { x: 0, y: 0, z: 0 }
      }
    });
    const ownerSnapshot = createFlightSnapshot(ship, null);

    const viewModel = createStatusHudViewModel({
      ship,
      lockedPlan: null,
      manualInput: {
        controlMode: "Translation",
        rcsEnabled: true,
        sasEnabled: false,
        mainThrottleCommand: 0.42,
        translationCommand: { x: 0, y: 1, z: 0 },
        rotationCommand: { x: 0, y: 0, z: 0 },
        cameraMode: "Side"
      },
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 1,
        status: "Idle",
        planHash: null,
        activeSegmentId: null,
        distanceToTarget: 0,
        offRouteDistance: 0,
        replanRequired: false,
        invalidationReasons: [],
        failureReasonCodes: [],
        fuel: ownerSnapshot.fuel,
        flightSnapshot: ownerSnapshot,
        position: ship.position,
        velocity: ship.velocity
      }
    });

    expect(viewModel.controlMode).toBe("Translation");
    expect(viewModel.cameraMode).toBe("Side");
    expect(viewModel.throttleState).toContain("42% / main burn");
    expect(viewModel.velocityState).toContain("3.74 m/s");
    expect(viewModel.velocityState).toBe("Speed 3.74 m/s");
    expect(viewModel.velocityState).not.toContain("(1.0, 2.0, 3.0)");
    expect(viewModel.rcsSasState).toContain("RCS on, SAS off");
    expect(viewModel.rcsSasState).toContain("RCS translate");
    expect(viewModel.controlModeEffectState).toContain("RCS translation / main thrust blocked");
    expect(viewModel.controlModeEffectState).toContain("RCS translation active");
    expect(viewModel.controlModeEffectState).toContain("SAS off");
  });

  it("shows RCS-disabled mode authority as blocked player text", () => {
    const ship = applyFlightControllerStep(
      createShipStateV2({ controlMode: "Precision", rcsEnabled: false, sasEnabled: true }),
      { controlMode: "Precision", rcsEnabled: false, rotationCommand: vec3(0, 0, 1) },
      1
    );
    const ownerSnapshot = createFlightSnapshot(ship, null);

    const viewModel = createStatusHudViewModel({
      ship,
      lockedPlan: null,
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 1,
        status: "Idle",
        planHash: null,
        activeSegmentId: null,
        distanceToTarget: 0,
        offRouteDistance: 0,
        replanRequired: false,
        invalidationReasons: [],
        failureReasonCodes: [],
        fuel: ownerSnapshot.fuel,
        flightSnapshot: ownerSnapshot,
        position: ship.position,
        velocity: ship.velocity
      }
    });

    expect(viewModel.controlModeEffectState).toContain("RCS attitude / main thrust blocked");
    expect(viewModel.controlModeEffectState).toContain("RCS rotation blocked: RCS off");
    expect(viewModel.controlModeEffectState).toContain("SAS blocked: no RCS authority");
    expect(viewModel.rcsSasState).toContain("RCS off, SAS on");
  });

  it("renders a concise visual-source line from explicit render snapshot metadata", () => {
    const ship = createShipStateV2({ authority: { mode: "Autopilot" } });
    const ownerSnapshot = createFlightSnapshot(ship, null);

    const viewModel = createStatusHudViewModel(
      {
        ship,
        lockedPlan: null,
        flightSnapshot: ownerSnapshot,
        executor: {
          tick: 1,
          status: "Idle",
          planHash: null,
          activeSegmentId: null,
          distanceToTarget: 0,
          offRouteDistance: 0,
          replanRequired: false,
          invalidationReasons: [],
          failureReasonCodes: [],
          fuel: ownerSnapshot.fuel,
          flightSnapshot: ownerSnapshot,
          position: ship.position,
          velocity: ship.velocity
        }
      },
      {
        state: "GLBLoaded",
        label: "Demo Scout GLB",
        candidateAssetPath: "Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb",
        sourceAssetPath: "Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb",
        browserAssetPath: "/ships/demo_scout_mk1.glb",
        fallbackReason: null,
        appliedScale: 3.2,
        axisCorrection: {
          from: "glb:-Z-forward,+Y-up",
          to: "+X-forward,+Y-up,+/-Z-lateral",
          rotationYRadians: -Math.PI / 2,
          mapping: "browserX=-glbZ,browserY=glbY,browserZ=glbX"
        }
      }
    );

    expect(viewModel.visualSourceLine).toBe("Ship visual: Demo Scout GLB");
  });

  it("keeps player HUD labels readable without TestBridge or raw failure-code text", () => {
    const elements = installDocumentStub();
    const ship = createShipStateV2({ fuel: 0, authority: { mode: "Manual", autopilotAvailable: false } });
    const ownerSnapshot = createFlightSnapshot(ship, null);

    renderStatusHud({
      ship,
      lockedPlan: null,
      flightSnapshot: ownerSnapshot,
      executor: {
        tick: 1,
        status: "OutOfFuel",
        planHash: null,
        activeSegmentId: null,
        distanceToTarget: 0,
        offRouteDistance: 0,
        replanRequired: false,
        invalidationReasons: ownerSnapshot.failureReasonCodes,
        failureReasonCodes: ownerSnapshot.failureReasonCodes,
        fuel: ownerSnapshot.fuel,
        flightSnapshot: ownerSnapshot,
        position: ship.position,
        velocity: ship.velocity
      }
    });

    const playerText = [
      "mode",
      "status",
      "target-status",
      "route-status",
      "fuel-status",
      "warning-chips",
      "failure-reasons",
      "runtime-message",
      "ship-visual-source",
      "autopilot-action-state"
    ].map((id) => elements.get(id)?.textContent ?? "").join("\n");

    expect(playerText).toContain("Manual");
    expect(playerText).toContain("Autopilot blocked: fuel");
    expect(playerText).toContain("Fuel insufficient");
    expect(playerText).toContain("Ship visual: Procedural fallback");
    expect(playerText).not.toContain("FuelInsufficient");
    expect(playerText).not.toContain("FuelDepleted");
    expect(playerText).not.toContain("TestBridge");
  });

  it("keeps the flight HUD DOM and CSS center-safe-area contract", () => {
    const html = readFileSync("index.html", "utf8");
    const css = readFileSync("src/style.css", "utf8");

    expect(html).toContain('id="flight-hud"');
    expect(html).toContain('data-testid="basic-hud"');
    expect(html).toContain('id="hud-top-strip"');
    expect(html).toContain('id="hud-left-panel"');
    expect(html).toContain('id="hud-right-panel"');
    expect(html).toContain('id="hud-bottom-strip"');
    expect(html).toContain('id="objective-status"');
    expect(html).toContain('data-testid="objective-label"');
    expect(html).toContain('class="hud-center-safe-area"');
    expect(html).toContain('id="debug-hud"');
    expect(css).toContain(".hud-center-safe-area");
    expect(css).toContain("background: transparent");
    expect(css).toContain("#hud-left-panel");
    expect(css).toContain("#hud-right-panel");
    expect(css).toContain("#hud-bottom-strip");
    expect(css).toContain(".objective-option-strip");
  });
});
