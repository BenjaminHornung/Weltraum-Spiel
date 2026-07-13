import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applyFlightControllerStep, createFlightSnapshot, createShipStateV2, inactiveControlModeEffect, vec3 } from "../../src/core";
import type { RoutePlan, TelemetrySnapshot } from "../../src/core";
import {
  calculateRouteProgressPercent,
  createCombatRuntimeViewModel,
  createPlannerTimelineRows,
  createStatusHudViewModel,
  renderStatusHud
} from "../../src/ui/statusHud";
import {
  DEFAULT_ACTIVE_SHIP_PRESENTATION,
  createNavigationMapSnapshot,
  navigationMapObstacleSnapshot,
  navigationMapRouteSnapshot,
  navigationMapShipSnapshot,
  navigationMapTargetSnapshot
} from "../../src/navigation/map";
import { worldCoordinate } from "../../src/world/frames";

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
  "target-kind",
  "target-options",
  "target-distance",
  "radar-status",
  "radar-range",
  "fuel-status",
  "authority-status",
  "brake-status",
  "warning-chips",
  "failure-reasons",
  "runtime-message",
  "autopilot-action-state",
  "throttle-meter-fill",
  "throttle-segments",
  "fuel-meter-fill",
  "help-hint",
  "engage-autopilot",
  "open-navigation-planner",
  "cancel-autopilot",
  "navigation-planner",
  "planner-selected-target",
  "planner-route-distance",
  "planner-route-status",
  "planner-objective",
  "planner-lock-reason",
  "planner-feedback",
  "planner-preview-route",
  "planner-replan-route",
  "planner-engage-route",
  "planner-metric-distance",
  "planner-metric-fuel-estimate",
  "planner-metric-fuel-remaining",
  "planner-metric-brake-reserve",
  "planner-metric-avoidance",
  "planner-metric-route",
  "flight-nav-distance-scale",
  "planner-timeline",
  "planner-timeline-total",
  "planner-route-eta",
  "planner-route-detail",
  "planner-route-svg",
  "planner-map-viewport",
  "planner-map-focus",
  "planner-map-orbit",
  "planner-map-zoom",
  "radar-runtime-contacts",
  "combat-marker-target",
  "combat-marker-distance",
  "combat-contact-name",
  "combat-contact-range",
  "combat-target-name",
  "combat-target-kind",
  "combat-target-distance",
  "combat-flight-speed",
  "combat-flight-throttle",
  "combat-flight-fuel",
  "combat-control-mode",
  "combat-control-assist",
  "combat-authority-status",
  "combat-brake-status",
  "combat-autopilot-status",
  "combat-warning-row",
  "combat-warning-status",
  "combat-radar-status"
] as const;

type StubStyle = Record<string, string> & {
  setProperty(name: string, value: string): void;
};

type StubElement = {
  tagName: string;
  textContent: string;
  onclick: ((event?: unknown) => void) | null;
  disabled: boolean;
  hidden: boolean;
  title: string;
  className: string;
  children: StubElement[];
  dataset: Record<string, string>;
  style: StubStyle;
  attributes: Map<string, string>;
  classList: { toggle(name: string, force?: boolean): boolean };
  append(...children: StubElement[]): void;
  replaceChildren(...children: StubElement[]): void;
  focus(): void;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getAttribute(name: string): string | null;
};

const dataKeyFor = (attributeName: string): string =>
  attributeName
    .slice(5)
    .replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());

const createStubElement = (tagName = "div"): StubElement => {
  const attributes = new Map<string, string>();
  const dataset: Record<string, string> = {};
  const style = {
    setProperty(name: string, value: string) {
      style[name] = value;
    }
  } as StubStyle;
  const element: StubElement = {
    tagName: tagName.toUpperCase(),
    textContent: "",
    onclick: null,
    disabled: false,
    hidden: false,
    title: "",
    className: "",
    children: [],
    dataset,
    style,
    attributes,
    classList: {
      toggle(name: string, force?: boolean) {
        const classes = new Set(element.className.split(/\s+/).filter(Boolean));
        const shouldAdd = force ?? !classes.has(name);
        if (shouldAdd) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
        element.className = [...classes].join(" ");
        return shouldAdd;
      }
    },
    append(...children: StubElement[]) {
      element.children.push(...children);
    },
    replaceChildren(...children: StubElement[]) {
      element.children = [...children];
    },
    focus() {},
    hasAttribute(name: string) {
      return attributes.has(name);
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
      if (name.startsWith("data-")) {
        dataset[dataKeyFor(name)] = value;
      }
    },
    removeAttribute(name: string) {
      attributes.delete(name);
      if (name.startsWith("data-")) {
        delete dataset[dataKeyFor(name)];
      }
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    }
  };
  return element;
};

const descendantsOf = (element: StubElement): StubElement[] =>
  element.children.flatMap((child) => [child, ...descendantsOf(child)]);

const installDocumentStub = (uiSurface: "flight" | "combat" = "flight", richDom = false) => {
  const elements = new Map<string, StubElement>();
  for (const id of elementIds) {
    elements.set(id, createStubElement());
  }
  const body = createStubElement("body");
  body.dataset.uiSurface = uiSurface;
  if (uiSurface === "combat") {
    body.dataset.uiScenario = "combat-contact";
  }

  const documentStub: {
    body: StubElement;
    getElementById(id: string): StubElement | null;
    createElement?: (tagName: string) => StubElement;
    createElementNS?: (_namespace: string, tagName: string) => StubElement;
  } = {
    body,
    getElementById(id: string) {
      return elements.get(id) ?? null;
    }
  };
  if (richDom) {
    documentStub.createElement = (tagName: string) => createStubElement(tagName);
    documentStub.createElementNS = (_namespace: string, tagName: string) => createStubElement(tagName);
  }
  elements.get("throttle-segments")?.append(...Array.from({ length: 8 }, () => createStubElement("span")));
  globalThis.document = documentStub as unknown as Document;

  return elements;
};

const createTwoLegRouteTelemetry = (
  shipX: number,
  executorOverrides: Partial<TelemetrySnapshot["executor"]> = {}
): TelemetrySnapshot => {
  const ship = createShipStateV2({
    position: vec3(shipX, 0, 0),
    authority: { mode: "Autopilot" }
  });
  const target = {
    id: "target-progress",
    label: "Progress Target",
    kind: "Point" as const,
    position: vec3(200, 0, 0),
    arrivalEnvelope: { radius: 3 }
  };
  const plan: RoutePlan = {
    id: "progress-plan",
    planner: "ObstacleAvoidanceLocal",
    speedProfile: "Balanced",
    createdAtTick: 0,
    target,
    segments: [
      { id: "leg-0", kind: "Direct", start: vec3(0, 0, 0), end: vec3(100, 0, 0), desiredSpeed: 10, clearanceRadius: 3 },
      { id: "leg-1", kind: "Avoidance", start: vec3(100, 0, 0), end: vec3(200, 0, 0), desiredSpeed: 20, clearanceRadius: 3 }
    ],
    validation: { ok: true, issues: [], rejectedReasonCodes: [] },
    score: { distance: 200, segmentCount: 2, clearanceRisk: 0, fuelCostEstimate: 2, authorityRisk: 0, total: 200, reasons: [] },
    planHash: "progress-hash"
  };
  const flightSnapshot = createFlightSnapshot(ship, plan);
  return {
    ship,
    selectedTarget: target,
    lockedPlan: plan,
    flightSnapshot,
    executor: {
      tick: 4,
      status: "Executing",
      routeLifecycle: "Executing",
      arrivalPhase: "None",
      planHash: plan.planHash,
      activeSegmentId: "leg-1",
      distanceToTarget: Math.max(0, 200 - shipX),
      offRouteDistance: 0,
      replanRequired: false,
      invalidationReasons: [],
      failureReasonCodes: [],
      fuel: flightSnapshot.fuel,
      flightSnapshot,
      position: ship.position,
      velocity: ship.velocity,
      ...executorOverrides
    }
  };
};

const createNewPreviewAfterCompletionTelemetry = (): TelemetrySnapshot => {
  const ship = createShipStateV2({
    position: vec3(1_000, 0, 0),
    authority: { mode: "Autopilot" }
  });
  const target = {
    id: "range-2500m",
    label: "Range 2500m",
    kind: "Point" as const,
    position: vec3(2_500, 0, 0),
    arrivalEnvelope: { radius: 8 }
  };
  const plan: RoutePlan = {
    id: "preview-range-2500m",
    planner: "ObstacleAvoidanceLocal",
    speedProfile: "Balanced",
    createdAtTick: 12_345,
    target,
    segments: [
      {
        id: "direct-0",
        kind: "Direct",
        start: ship.position,
        end: target.position,
        desiredSpeed: 18,
        clearanceRadius: 3
      }
    ],
    validation: { ok: true, issues: [], rejectedReasonCodes: [] },
    score: {
      distance: 1_500,
      segmentCount: 1,
      clearanceRisk: 0,
      fuelCostEstimate: 0,
      authorityRisk: 0,
      total: 1_500,
      reasons: []
    },
    planHash: "new2500a"
  };
  const flightSnapshot = createFlightSnapshot(ship, null);

  return {
    ship,
    lockedPlan: null,
    selectedTarget: target,
    routePreview: {
      state: "Ready",
      planner: plan.planner,
      target,
      plan,
      validation: plan.validation,
      rejectedReasonCodes: [],
      playerMessage: "Route preview ready for Range 2500m.",
      provenance: null,
      stale: false,
      staleReason: null,
      lockAdmission: {
        ok: true,
        code: "Ready",
        message: "Route preview is ready to engage.",
        planHash: plan.planHash,
        firstSegmentStartTolerance: 1
      }
    },
    flightSnapshot,
    executor: {
      tick: 12_345,
      status: "Idle",
      routeLifecycle: "Idle",
      arrivalPhase: "None",
      planHash: null,
      completedPlanHash: "completed1000",
      stationKeepingActive: false,
      activeSegmentId: null,
      distanceToTarget: 1_500,
      offRouteDistance: 0,
      replanRequired: false,
      invalidationReasons: [],
      failureReasonCodes: [],
      fuel: flightSnapshot.fuel,
      flightSnapshot,
      position: ship.position,
      velocity: ship.velocity
    }
  };
};

const createNavigationMapForRoute = (
  telemetry: TelemetrySnapshot,
  route: RoutePlan | null
): NonNullable<TelemetrySnapshot["navigationMap"]> => createNavigationMapSnapshot({
  ship: navigationMapShipSnapshot({
    absolutePosition: worldCoordinate(telemetry.ship.position),
    orientation: telemetry.ship.orientation,
    presentation: DEFAULT_ACTIVE_SHIP_PRESENTATION
  }),
  targets: telemetry.selectedTarget ? [navigationMapTargetSnapshot(telemetry.selectedTarget)] : [],
  selectedTargetId: telemetry.selectedTarget?.id ?? null,
  route: route ? navigationMapRouteSnapshot(route) : null,
  obstacles: (telemetry.obstacles ?? []).map((obstacle) => navigationMapObstacleSnapshot(obstacle)),
  world: {
    registrySignature: "status-hud-route-gate-registry",
    streamingSignature: "status-hud-route-gate-streaming",
    fullChunkIds: [],
    snapshotChunkIds: []
  }
});

const createPoisonedMapPlan = (plan: RoutePlan): RoutePlan => ({
  ...plan,
  id: "poisoned-map-plan",
  planHash: "poisoned-map-hash",
  segments: [{
    ...plan.segments[0],
    id: "poisoned-map-segment",
    start: vec3(-9_000, 0, -9_000),
    end: vec3(9_000, 0, 9_000)
  }]
});

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
    expect(elements.get("route-status")?.textContent).toBe("Blocked");
    expect(elements.get("route-status")?.getAttribute("title")).toBe("A route is already locked.");
    expect(elements.get("objective-label")?.textContent).toBe("No navigation objective");
    expect(elements.get("objective-status")?.textContent).toBe("Inactive");
    expect(elements.get("objective-options")?.textContent).toBe("no objectives available");
    expect(elements.get("fuel-status")?.textContent).toBe("0/100 kg");
    expect(elements.get("fuel-status")?.getAttribute("title")).toContain("Blocked");
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
      speedProfile: "Balanced",
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
        speedProfile: "Balanced",
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
    expect(viewModel.navigation.target.value).toBe("Target A");
    expect(viewModel.navigation.targetKind.value).toBe("Waypoint");
    expect(viewModel.navigation.route.value).toBe("Blocked");
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
            speedProfile: "Balanced",
            createdAtTick: 0,
            target,
            segments: [{ id: "direct-0", kind: "Direct", start: ship.position, end: target.position, desiredSpeed: 18, clearanceRadius: 3 }],
            validation: { ok: true, issues: [], rejectedReasonCodes: [] },
            score: { distance: 12, segmentCount: 1, clearanceRisk: 0, fuelCostEstimate: 0, authorityRisk: 0, total: 12, reasons: [] },
            planHash: "bead1234"
          },
          validation: { ok: true, issues: [], rejectedReasonCodes: [] },
          rejectedReasonCodes: [],
          playerMessage: "Route preview ready for Target B.",
          provenance: null,
          stale: false,
          staleReason: null,
          lockAdmission: { ok: true, code: "Ready", message: "Route preview is ready to engage.", planHash: "bead1234", firstSegmentStartTolerance: 1 }
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

    expect(commands).toEqual([{ type: "EngageRoutePreview", expectedPlanHash: "bead1234" }]);
    expect(elements.get("engage-autopilot")?.textContent).toBe("Engage route");
    expect(elements.get("engage-autopilot")?.disabled).toBe(false);
    expect(elements.get("engage-autopilot")?.getAttribute("aria-disabled")).toBe("false");
    expect(elements.get("engage-autopilot")?.title).toBe("");
    expect(elements.get("autopilot-action-state")?.textContent).toBe("Ready");
    expect(elements.get("route-status")?.getAttribute("data-hud-tone")).toBe("ready");
    expect(elements.get("autopilot-action-state")?.getAttribute("data-hud-tone")).toBe("ready");
    expect(elements.get("flight-hud")?.getAttribute("data-action-tone")).toBe("ready");
  });

  it("promotes a new admitted preview over an older completed plan and engages its exact hash", () => {
    const elements = installDocumentStub("flight", true);
    const commands: unknown[] = [];
    const base = createNewPreviewAfterCompletionTelemetry();
    const admittedPlan = base.routePreview!.plan!;
    const telemetry: TelemetrySnapshot = {
      ...base,
      navigationMap: createNavigationMapForRoute(base, createPoisonedMapPlan(admittedPlan))
    };

    renderStatusHud(telemetry, {
      dispatch: (command) => commands.push(command)
    });

    elements.get("engage-autopilot")?.onclick?.();

    expect(elements.get("plan-hash")?.textContent).toBe("Route preview ready");
    expect(elements.get("route-status")?.textContent).toBe("Preview ready");
    expect(elements.get("route-status")?.getAttribute("data-hud-tone")).toBe("ready");
    expect(elements.get("engage-autopilot")?.textContent).toBe("Engage route");
    expect(elements.get("engage-autopilot")?.disabled).toBe(false);
    expect(elements.get("navigation-planner")?.dataset.visiblePreviewHash).toBe("new2500a");
    expect(elements.get("planner-route-detail")?.textContent).toContain("hash new2500a; Ready");
    expect(elements.get("planner-metric-route")?.textContent).toContain("new2500a");
    expect(elements.get("planner-engage-route")?.disabled).toBe(false);
    expect(elements.get("planner-route-svg")?.dataset.segmentCount).toBe(String(admittedPlan.segments.length));
    expect(elements.get("planner-route-svg")?.dataset.routePlanHash).toBe(admittedPlan.planHash);
    expect(descendantsOf(elements.get("planner-map-viewport")!).filter((node) => node.getAttribute("data-segment-id")).map((node) => node.getAttribute("data-segment-id"))).toEqual(
      admittedPlan.segments.map((segment) => segment.id)
    );
    expect(commands).toEqual([
      { type: "EngageRoutePreview", expectedPlanHash: "new2500a" }
    ]);
  });

  it("uses the authoritative FlightAdmissionRejected safety message without trusting preview copy", () => {
    const elements = installDocumentStub("flight", true);
    const commands: unknown[] = [];
    const base = createNewPreviewAfterCompletionTelemetry();
    const preview = base.routePreview!;
    const plan = preview.plan!;
    const safetyMessage = "Current fuel, braking reserve, or flight authority cannot safely engage this route.";
    const telemetry: TelemetrySnapshot = {
      ...base,
      runtimeMessage: "Route preview ready from untrusted runtime copy.",
      routePreview: {
        ...preview,
        playerMessage: "Route preview ready from untrusted preview copy.",
        lockAdmission: {
          ok: false,
          code: "FlightAdmissionRejected",
          message: "Untrusted admission copy.",
          planHash: plan.planHash,
          firstSegmentStartTolerance: 1
        }
      }
    };

    const viewModel = createStatusHudViewModel(telemetry);
    renderStatusHud(telemetry, { dispatch: (command) => commands.push(command) });
    elements.get("engage-autopilot")?.onclick?.();
    elements.get("planner-engage-route")?.onclick?.();

    expect(viewModel.runtimeMessage).toBe(safetyMessage);
    expect(viewModel.actions.primaryDisabledReason).toBe(safetyMessage);
    expect(elements.get("runtime-message")?.textContent).toBe(safetyMessage);
    expect(elements.get("planner-feedback")?.textContent).toBe(safetyMessage);
    expect(elements.get("planner-engage-route")?.title).toBe(safetyMessage);
    expect(commands).toEqual([]);
  });

  it("retains a VelocityMismatch display plan while keeping both Engage controls fail closed", () => {
    const elements = installDocumentStub("flight", true);
    const commands: unknown[] = [];
    const base = createNewPreviewAfterCompletionTelemetry();
    const preview = base.routePreview!;
    const plan = preview.plan!;
    const telemetry: TelemetrySnapshot = {
      ...base,
      runtimeMessage: preview.playerMessage,
      routePreview: {
        ...preview,
        lockAdmission: {
          ok: false,
          code: "VelocityMismatch",
          message: "Ship velocity changed. Replan before engaging.",
          planHash: plan.planHash,
          firstSegmentStartTolerance: 1
        }
      },
      navigationMap: createNavigationMapForRoute(base, createPoisonedMapPlan(plan))
    };

    const viewModel = createStatusHudViewModel(telemetry);
    renderStatusHud(telemetry, { dispatch: (command) => commands.push(command) });
    elements.get("engage-autopilot")?.onclick?.();
    elements.get("planner-engage-route")?.onclick?.();

    expect(viewModel.planState).toBe("Route preview blocked");
    expect(viewModel.routeTone).toBe("blocked");
    expect(viewModel.distance).toBe("1.5 km");
    expect(elements.get("navigation-planner")?.dataset.visiblePreviewHash).toBe(plan.planHash);
    expect(elements.get("planner-route-distance")?.textContent).toBe("1.5 km");
    expect(elements.get("planner-route-detail")?.textContent).toContain(`hash ${plan.planHash}; Blocked`);
    expect(elements.get("planner-route-svg")?.dataset.routePlanHash).toBe(plan.planHash);
    expect(elements.get("planner-route-svg")?.dataset.segmentCount).toBe(String(plan.segments.length));
    expect(descendantsOf(elements.get("planner-map-viewport")!).filter((node) => node.getAttribute("data-segment-id")).map((node) => node.getAttribute("data-segment-id"))).toEqual(
      plan.segments.map((segment) => segment.id)
    );
    expect(elements.get("engage-autopilot")?.disabled).toBe(true);
    expect(elements.get("planner-engage-route")?.disabled).toBe(true);
    expect(elements.get("planner-engage-route")?.title).toBe("Ship velocity changed. Replan before engaging.");
    expect(commands).toEqual([]);
  });

  it("fails closed instead of promoting invalid previews after a completed plan", () => {
    const base = createNewPreviewAfterCompletionTelemetry();
    const preview = base.routePreview!;
    const plan = preview.plan!;
    const poisonedReadyMessage = preview.playerMessage;
    const poisonedBase = { ...base, runtimeMessage: poisonedReadyMessage } satisfies TelemetrySnapshot;
    const poisonedMapPlan = createPoisonedMapPlan(plan);
    const mapObstacle = { id: "route-independent-map-obstacle", center: vec3(1_250, 0, 25), radius: 12, padding: 3 };
    const poisonedNavigationMap = createNavigationMapForRoute({ ...base, obstacles: [mapObstacle] }, poisonedMapPlan);
    const cases: readonly {
      readonly label: string;
      readonly telemetry: TelemetrySnapshot;
      readonly reason: string;
    }[] = [
      {
        label: "unavailable",
        telemetry: {
          ...poisonedBase,
          routePreview: {
            ...preview,
            state: "Unavailable",
            plan: null,
            validation: null,
            rejectedReasonCodes: ["RouteUnsolvable"],
            playerMessage: poisonedReadyMessage,
            lockAdmission: {
              ok: false,
              code: "MissingPreview",
              message: "Create a route preview before engaging autopilot.",
              planHash: null,
              firstSegmentStartTolerance: null
            }
          }
        },
        reason: "No valid route preview is available."
      },
      {
        label: "missing plan",
        telemetry: {
          ...poisonedBase,
          routePreview: { ...preview, plan: null }
        },
        reason: "Create a route preview before engaging autopilot."
      },
      {
        label: "stale",
        telemetry: {
          ...poisonedBase,
          routePreview: { ...preview, stale: true, staleReason: "ExplicitlyInvalidated" }
        },
        reason: "The route preview is stale. Preview or replan before engaging."
      },
      {
        label: "rejected admission",
        telemetry: {
          ...poisonedBase,
          routePreview: {
            ...preview,
            lockAdmission: {
              ok: false,
              code: "RouteValidationRejected",
              message: poisonedReadyMessage,
              planHash: plan.planHash,
              firstSegmentStartTolerance: 1
            }
          }
        },
        reason: "The exact preview route no longer passes route validation."
      },
      {
        label: "missing admission",
        telemetry: {
          ...poisonedBase,
          routePreview: { ...preview, lockAdmission: undefined as never }
        },
        reason: "The route preview has no lock admission. Replan before engaging."
      },
      {
        label: "admission hash mismatch",
        telemetry: {
          ...poisonedBase,
          routePreview: {
            ...preview,
            lockAdmission: { ...preview.lockAdmission, planHash: "other2500" }
          }
        },
        reason: "The visible route changed. Review the current preview before engaging."
      },
      {
        label: "same as completed",
        telemetry: {
          ...poisonedBase,
          executor: { ...base.executor, completedPlanHash: plan.planHash }
        },
        reason: "Select or replan a new route before engaging."
      },
      {
        label: "rejected validation",
        telemetry: {
          ...poisonedBase,
          routePreview: {
            ...preview,
            validation: {
              ok: false,
              issues: [{ code: "UnsafeRouteSegment", severity: "Reject", message: "Rejected route." }],
              rejectedReasonCodes: ["UnsafeRouteSegment"]
            }
          }
        },
        reason: "The exact preview route no longer passes route validation."
      }
    ];

    for (const invalidCase of cases) {
      const elements = installDocumentStub("flight", true);
      const commands: unknown[] = [];
      const telemetry = { ...invalidCase.telemetry, navigationMap: poisonedNavigationMap } satisfies TelemetrySnapshot;
      const viewModel = createStatusHudViewModel(telemetry);
      renderStatusHud(telemetry, {
        dispatch: (command) => commands.push(command)
      });

      elements.get("engage-autopilot")?.onclick?.();
      elements.get("planner-engage-route")?.onclick?.();

      expect(viewModel.planState, invalidCase.label).toBe("Plan completed");
      expect(viewModel.routeTone, invalidCase.label).toBe("manual");
      expect(viewModel.actions.primaryCommandEnabled, invalidCase.label).toBe(false);
      expect(elements.get("route-status")?.getAttribute("data-hud-tone"), invalidCase.label).toBe("manual");
      expect(elements.get("route-status")?.getAttribute("title"), invalidCase.label).toBe(invalidCase.reason);
      expect(elements.get("route-status")?.textContent, invalidCase.label).not.toBe("Preview ready");
      expect(elements.get("runtime-message")?.textContent, invalidCase.label).toBe(invalidCase.reason);
      expect(elements.get("autopilot-action-state")?.textContent, invalidCase.label).toBe(invalidCase.reason);
      expect(elements.get("planner-selected-target")?.textContent, invalidCase.label).toBe("Range 2500m [Point]");
      expect(elements.get("navigation-planner")?.dataset.visiblePreviewHash, invalidCase.label).toBe("");
      expect(elements.get("planner-route-detail")?.textContent, invalidCase.label).toBe(invalidCase.reason);
      expect(elements.get("planner-route-detail")?.textContent, invalidCase.label).not.toContain(plan.planHash);
      expect(elements.get("planner-timeline")?.children, invalidCase.label).toHaveLength(1);
      expect(elements.get("planner-timeline")?.children[0]?.textContent, invalidCase.label).toBe("No route preview available");
      expect(elements.get("planner-timeline-total")?.textContent, invalidCase.label).toBe("--:--");
      expect(elements.get("planner-route-eta")?.textContent, invalidCase.label).toBe("--:--");
      expect(elements.get("planner-metric-distance")?.textContent, invalidCase.label).toBe("n/a");
      expect(elements.get("planner-metric-route")?.textContent, invalidCase.label).toBe("Balanced / no preview");
      expect(elements.get("planner-metric-route")?.textContent, invalidCase.label).not.toContain(plan.planHash);
      expect(elements.get("planner-engage-route")?.disabled, invalidCase.label).toBe(true);
      expect(elements.get("planner-engage-route")?.title, invalidCase.label).toBe(invalidCase.reason);
      expect(elements.get("planner-engage-route")?.getAttribute("aria-description"), invalidCase.label).toBe(invalidCase.reason);
      expect(elements.get("planner-feedback")?.textContent, invalidCase.label).toBe(invalidCase.reason);
      const mapNodes = descendantsOf(elements.get("planner-map-viewport")!);
      expect(elements.get("planner-route-svg")?.dataset.segmentCount, invalidCase.label).toBe("0");
      expect(elements.get("planner-route-svg")?.dataset.routePlanHash, invalidCase.label).toBe("");
      expect(mapNodes.filter((node) => node.getAttribute("data-segment-id")), invalidCase.label).toHaveLength(0);
      expect(mapNodes.find((node) => node.getAttribute("data-target-id") === plan.target.id), invalidCase.label).toBeDefined();
      expect(elements.get("planner-route-svg")?.dataset.targetCount, invalidCase.label).toBe("1");
      expect(mapNodes.find((node) => node.getAttribute("data-obstacle-id") === mapObstacle.id), invalidCase.label).toBeDefined();
      expect(elements.get("planner-route-svg")?.dataset.obstacleCount, invalidCase.label).toBe("1");
      for (const id of ["route-status", "runtime-message", "autopilot-action-state", "planner-route-detail", "planner-feedback"] as const) {
        expect(elements.get(id)?.textContent, `${invalidCase.label}: ${id}`).not.toContain(poisonedReadyMessage);
        expect(elements.get(id)?.getAttribute("title") ?? "", `${invalidCase.label}: ${id} title`).not.toContain(poisonedReadyMessage);
      }
      expect(commands, invalidCase.label).toEqual([]);
    }
  });

  it("hides a poisoned raw map route without a preview while preserving the target contact", () => {
    const base = createNewPreviewAfterCompletionTelemetry();
    const plan = base.routePreview!.plan!;
    const telemetry: TelemetrySnapshot = {
      ...base,
      routePreview: null,
      runtimeMessage: "Normal runtime message.",
      navigationMap: createNavigationMapForRoute(base, createPoisonedMapPlan(plan))
    };
    const elements = installDocumentStub("flight", true);

    renderStatusHud(telemetry);

    const mapNodes = descendantsOf(elements.get("planner-map-viewport")!);
    expect(elements.get("planner-route-svg")?.dataset.segmentCount).toBe("0");
    expect(elements.get("planner-route-svg")?.dataset.routePlanHash).toBe("");
    expect(mapNodes.filter((node) => node.getAttribute("data-segment-id"))).toHaveLength(0);
    expect(mapNodes.find((node) => node.getAttribute("data-target-id") === plan.target.id)).toBeDefined();
    expect(elements.get("planner-route-svg")?.dataset.targetCount).toBe("1");
    expect(elements.get("runtime-message")?.textContent).toBe("Normal runtime message.");
  });

  it("keeps a locked plan authoritative when a poisoned raw preview coexists", () => {
    const base = createNewPreviewAfterCompletionTelemetry();
    const preview = base.routePreview!;
    const lockedPlan: RoutePlan = {
      ...preview.plan!,
      id: "locked-range-2500m",
      planHash: "locked2500"
    };
    const poisonedMapPlan = createPoisonedMapPlan(preview.plan!);
    const flightSnapshot = createFlightSnapshot(base.ship, lockedPlan);
    const poisonedReadyMessage = "Route preview ready for a poisoned stale route.";
    const telemetry: TelemetrySnapshot = {
      ...base,
      lockedPlan,
      routePreview: {
        ...preview,
        stale: true,
        staleReason: "ExplicitlyInvalidated",
        playerMessage: poisonedReadyMessage
      },
      runtimeMessage: poisonedReadyMessage,
      navigationMap: createNavigationMapForRoute(base, poisonedMapPlan),
      flightSnapshot,
      executor: {
        ...base.executor,
        status: "Executing",
        routeLifecycle: "Executing",
        planHash: lockedPlan.planHash,
        activeSegmentId: lockedPlan.segments[0]?.id ?? null,
        fuel: flightSnapshot.fuel,
        flightSnapshot
      }
    };
    const elements = installDocumentStub("flight", true);

    const viewModel = createStatusHudViewModel(telemetry);
    renderStatusHud(telemetry);

    expect(viewModel.planState).toBe("Plan locked");
    expect(viewModel.routeTone).toBe("active");
    expect(elements.get("route-status")?.textContent).toBe("Autopilot active");
    expect(elements.get("route-status")?.getAttribute("title")).toContain("locked route");
    expect(elements.get("runtime-message")?.textContent).toBe("A route is already locked.");
    expect(elements.get("navigation-planner")?.dataset.visiblePreviewHash).toBe(lockedPlan.planHash);
    expect(elements.get("planner-route-detail")?.textContent).toContain(`hash ${lockedPlan.planHash}; Locked`);
    expect(elements.get("planner-metric-route")?.textContent).toContain(lockedPlan.planHash);
    expect(elements.get("planner-engage-route")?.disabled).toBe(true);
    expect(elements.get("planner-engage-route")?.title).toBe("A route is already locked.");
    expect(elements.get("planner-feedback")?.textContent).toBe("A route is already locked.");
    const mapNodes = descendantsOf(elements.get("planner-map-viewport")!);
    expect(elements.get("planner-route-svg")?.dataset.segmentCount).toBe(String(lockedPlan.segments.length));
    expect(elements.get("planner-route-svg")?.dataset.routePlanHash).toBe(lockedPlan.planHash);
    expect(mapNodes.filter((node) => node.getAttribute("data-segment-id")).map((node) => node.getAttribute("data-segment-id"))).toEqual(
      lockedPlan.segments.map((segment) => segment.id)
    );
    expect(mapNodes.find((node) => node.getAttribute("data-target-id") === lockedPlan.target.id)).toBeDefined();
    for (const id of ["route-status", "runtime-message", "planner-route-detail", "planner-feedback"] as const) {
      expect(elements.get(id)?.textContent, id).not.toContain("poisoned stale route");
      expect(elements.get(id)?.getAttribute("title") ?? "", `${id} title`).not.toContain("poisoned stale route");
    }
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
            speedProfile: "Balanced",
            createdAtTick: 0,
            target,
            segments: [{ id: "direct-0", kind: "Direct", start: ship.position, end: target.position, desiredSpeed: 18, clearanceRadius: 3 }],
            validation: { ok: true, issues: [], rejectedReasonCodes: [] },
            score: { distance: 1, segmentCount: 1, clearanceRisk: 0, fuelCostEstimate: 0, authorityRisk: 0, total: 1, reasons: [] },
            planHash: "done500m"
          },
          validation: { ok: true, issues: [], rejectedReasonCodes: [] },
          rejectedReasonCodes: [],
          playerMessage: "Route preview ready for Range 500m.",
          provenance: null,
          stale: false,
          staleReason: null,
          lockAdmission: { ok: true, code: "Ready", message: "Route preview is ready to engage.", planHash: "done500m", firstSegmentStartTolerance: 1 }
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

  it("shows executor distance in terminal station keeping without re-exposing the completed raw route", () => {
    const elements = installDocumentStub("flight", true);
    const commands: unknown[] = [];
    const base = createNewPreviewAfterCompletionTelemetry();
    const preview = base.routePreview!;
    const plan = preview.plan!;
    const telemetry: TelemetrySnapshot = {
      ...base,
      navigationMap: createNavigationMapForRoute(base, createPoisonedMapPlan(plan)),
      executor: {
        ...base.executor,
        status: "Arrived",
        routeLifecycle: "Holding",
        arrivalPhase: "Holding",
        completedPlanHash: plan.planHash,
        stationKeepingActive: true,
        distanceToTarget: 1.25
      }
    };

    const viewModel = createStatusHudViewModel(telemetry);
    renderStatusHud(telemetry, { dispatch: (command) => commands.push(command) });
    elements.get("engage-autopilot")?.onclick?.();
    elements.get("planner-engage-route")?.onclick?.();

    expect(viewModel.distance).toBe("1.3 m");
    expect(elements.get("target-distance")?.textContent).toBe("1.3 m");
    expect(viewModel.planState).toBe("Plan completed");
    expect(elements.get("navigation-planner")?.dataset.visiblePreviewHash).toBe("");
    expect(elements.get("planner-route-detail")?.textContent).not.toContain(plan.planHash);
    expect(elements.get("planner-route-svg")?.dataset.routePlanHash).toBe("");
    expect(elements.get("planner-route-svg")?.dataset.segmentCount).toBe("0");
    expect(elements.get("radar-runtime-contacts")?.dataset.routeContactCount).toBe("0");
    expect(commands).toEqual([]);
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
          speedProfile: "Balanced",
          createdAtTick: 0,
          target,
          segments: [{ id: "direct-0", kind: "Direct", start: ship.position, end: target.position, desiredSpeed: 18, clearanceRadius: 3 }],
          validation: { ok: true, issues: [], rejectedReasonCodes: [] },
          score: { distance: 12, segmentCount: 1, clearanceRisk: 0, fuelCostEstimate: 0, authorityRisk: 0, total: 12, reasons: [] },
          planHash: "bead1234"
        },
        validation: { ok: true, issues: [], rejectedReasonCodes: [] },
        rejectedReasonCodes: [],
        playerMessage: "Route preview ready for Target B.",
        provenance: null,
        stale: false,
        staleReason: null,
        lockAdmission: { ok: true, code: "Ready", message: "Route preview is ready to engage.", planHash: "bead1234", firstSegmentStartTolerance: 1 }
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

    expect(elements.get("target-status")?.textContent).toBe("Target B");
    expect(elements.get("target-kind")?.textContent).toBe("Point");
    expect(elements.get("target-distance")?.textContent).toBe("12.0 m");
    expect(elements.get("target-status")?.getAttribute("title")).toBe("Target B [Point]");
    expect(elements.get("route-status")?.textContent).toBe("Preview ready");
    expect(elements.get("route-status")?.getAttribute("title")).toBe("preview ready: 1 leg, route 12.0 m");
    expect(elements.get("radar-status")?.textContent).toBe("1 contact");
    expect(elements.get("radar-range")?.textContent).toBe("250 m");
    expect(elements.get("radar-status")?.getAttribute("title")).toContain("local contact Target B");
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
          speedProfile: "Balanced",
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
        playerMessage: "Route preview ready for Range 2500m.",
        provenance: null,
        stale: false,
        staleReason: null,
        lockAdmission: { ok: true, code: "Ready", message: "Route preview is ready to engage.", planHash: "face2500", firstSegmentStartTolerance: 1 }
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
    expect(elements.get("route-status")?.textContent).toBe("Holding");
    expect(elements.get("route-status")?.getAttribute("title")).toBe("holding at target; Select a target to preview a route.");
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
    expect(playerText).toContain("Holding");
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
        lastAppliedMainAcceleration: { x: 0, y: 0, z: 0 },
        lastAppliedRcsTranslationAcceleration: { x: 1, y: 0, z: 0 },
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

  it("keeps executor-only phases untimed while retaining real segment travel times", () => {
    const elements = installDocumentStub("flight", true);
    const telemetry = createTwoLegRouteTelemetry(175, {
      routeLifecycle: "Holding",
      arrivalPhase: "Holding",
      terminalHoldingActive: true
    });
    const rows = createPlannerTimelineRows(telemetry, telemetry.lockedPlan);
    renderStatusHud(telemetry);

    const renderedRows = elements.get("planner-timeline")?.children ?? [];
    const renderedLeg0 = renderedRows.find((row) => row.dataset.timelineId === "leg-0");
    const renderedLeg1 = renderedRows.find((row) => row.dataset.timelineId === "leg-1");
    const renderedHolding = renderedRows.find((row) => row.dataset.timelineId === "executor-Holding");

    expect(rows.find((row) => row.id === "leg-0")?.time).toBe("00:10");
    expect(rows.find((row) => row.id === "leg-1")?.time).toBe("00:05");
    expect(rows.find((row) => row.id === "executor-Holding")).toMatchObject({
      label: "HOLDING",
      time: "--:--",
      isActive: true,
      isExecutorPhase: true
    });
    expect(rows.some((row) => row.label === "ALIGN" || row.label === "FLIP")).toBe(false);
    expect(elements.get("planner-timeline-total")?.textContent).toBe("00:15");
    expect(elements.get("planner-route-eta")?.textContent).toBe("00:15");
    expect(renderedLeg0?.children.at(-1)?.textContent).toBe("00:10");
    expect(renderedLeg1?.children.at(-1)?.textContent).toBe("00:05");
    expect(renderedHolding?.children.at(-1)?.textContent).toBe("--:--");
    expect(renderedHolding?.className).toContain("planner-step--active");
  });

  it("derives continuous route progress from live position on the same active segment", () => {
    const elements = installDocumentStub("flight", true);
    const earlier = createTwoLegRouteTelemetry(125);
    const later = createTwoLegRouteTelemetry(175);

    expect(calculateRouteProgressPercent(earlier)).toBeCloseTo(62.5, 6);
    expect(calculateRouteProgressPercent(later)).toBeCloseTo(87.5, 6);
    expect(calculateRouteProgressPercent(later)).toBeGreaterThan(calculateRouteProgressPercent(earlier) ?? 0);

    const preview = {
      ...earlier,
      lockedPlan: null,
      executor: { ...earlier.executor, status: "Idle" as const, routeLifecycle: "Idle" as const, planHash: null, activeSegmentId: null },
      routePreview: {
        state: "Ready" as const,
        planner: earlier.lockedPlan?.planner ?? "ObstacleAvoidanceLocal" as const,
        target: earlier.selectedTarget ?? null,
        plan: earlier.lockedPlan,
        validation: earlier.lockedPlan?.validation ?? null,
        rejectedReasonCodes: [],
        playerMessage: "Route preview ready.",
        provenance: null,
        stale: false,
        staleReason: null,
        lockAdmission: { ok: true as const, code: "Ready" as const, message: "Ready.", planHash: earlier.lockedPlan?.planHash ?? "", firstSegmentStartTolerance: 1 }
      }
    } satisfies TelemetrySnapshot;
    expect(calculateRouteProgressPercent(preview)).toBe(0);
    const idle = { ...earlier, lockedPlan: null, routePreview: null } satisfies TelemetrySnapshot;
    const arrived = createTwoLegRouteTelemetry(199, { status: "Arrived", routeLifecycle: "Holding" });
    expect(calculateRouteProgressPercent(idle)).toBeNull();
    expect(calculateRouteProgressPercent(arrived)).toBe(100);

    renderStatusHud(earlier);
    const progress = elements.get("flight-nav-distance-scale");
    const earlierTrack = progress?.children.find((child) => child.className === "flight-nav-distance-scale__track");
    const earlierWidth = earlierTrack?.children[0]?.style.width;
    expect(progress?.hidden).toBe(false);
    expect(progress?.dataset.progressState).toBe("executing");
    expect(progress?.dataset.activeSegmentId).toBe("leg-1");
    expect(Number(progress?.dataset.progressPercent)).toBeCloseTo(62.5, 6);
    expect(earlierWidth).toBe("62.5000%");

    renderStatusHud(later);
    const laterTrack = progress?.children.find((child) => child.className === "flight-nav-distance-scale__track");
    const laterWidth = laterTrack?.children[0]?.style.width;
    expect(Number(progress?.dataset.progressPercent)).toBeCloseTo(87.5, 6);
    expect(progress?.dataset.activeSegmentId).toBe("leg-1");
    expect(laterWidth).toBe("87.5000%");
    expect(laterWidth).not.toBe(earlierWidth);

    renderStatusHud(preview);
    expect(progress?.hidden).toBe(false);
    expect(progress?.dataset.progressState).toBe("preview");
    expect(progress?.dataset.progressPercent).toBe("0.0000");
    expect(progress?.dataset.activeSegmentId).toBeUndefined();
    expect(progress?.children.find((child) => child.className === "flight-nav-distance-scale__track")?.children[0]?.style.width).toBe("0.0000%");

    renderStatusHud(arrived);
    expect(progress?.dataset.progressState).toBe("arrived");
    expect(progress?.dataset.progressPercent).toBe("100.0000");
    expect(progress?.children.find((child) => child.className === "flight-nav-distance-scale__track")?.children[0]?.style.width).toBe("100.0000%");

    renderStatusHud(idle);
    expect(progress?.hidden).toBe(true);
    expect(progress?.children).toHaveLength(0);
    expect(progress?.dataset.progressPercent).toBeUndefined();
  });

  it("hides empty warning surfaces and restores them when runtime warnings appear", () => {
    const elements = installDocumentStub("combat");
    const base = createTwoLegRouteTelemetry(125);

    renderStatusHud(base);

    expect(elements.get("warning-chips")?.hidden).toBe(true);
    expect(elements.get("warning-chips")?.textContent).toBe("");
    expect(elements.get("combat-warning-row")?.hidden).toBe(true);
    expect(elements.get("combat-warning-status")?.textContent).toBe("");

    const warningSnapshot = {
      ...base.flightSnapshot,
      routeValid: false,
      failureReasonCodes: ["OffLockedRoute" as const]
    };
    renderStatusHud({
      ...base,
      flightSnapshot: warningSnapshot,
      executor: {
        ...base.executor,
        replanRequired: true,
        failureReasonCodes: ["OffLockedRoute"],
        flightSnapshot: warningSnapshot
      }
    });

    expect(elements.get("warning-chips")?.hidden).toBe(false);
    expect(elements.get("warning-chips")?.textContent).toContain("Plan invalidated");
    expect(elements.get("warning-chips")?.textContent.toLowerCase()).not.toBe("none");
    expect(elements.get("combat-warning-row")?.hidden).toBe(false);
    expect(elements.get("combat-warning-status")?.textContent).toBe("Plan invalidated");
  });

  it("renders long runtime target identity in normal flow without changing its content", () => {
    const elements = installDocumentStub("flight");
    const base = createTwoLegRouteTelemetry(125);
    const longLabel = "Navigation Alpha Extended Survey Waypoint";
    const longTarget = { ...base.lockedPlan!.target, label: longLabel };
    const css = readFileSync("src/style.css", "utf8");
    const v4Css = css.slice(css.lastIndexOf("/* V4 visual QA: concise telemetry, truthful meters, readable planner and combat density. */"));

    renderStatusHud({
      ...base,
      selectedTarget: longTarget,
      lockedPlan: { ...base.lockedPlan!, target: longTarget }
    });

    expect(elements.get("target-status")?.textContent).toBe(longLabel);
    expect(elements.get("target-kind")?.textContent).toBe("Point");
    expect(elements.get("target-distance")?.textContent).toBe("75.0 m");
    expect(elements.get("target-status")?.getAttribute("title")).toBe(`${longLabel} [Point]`);

    const targetStatusRule = v4Css.match(/\.hud-nav-card--target #target-status\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    const targetKindRule = v4Css.match(/#target-kind\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    const responsiveRouteRule = css.match(/\/\* Responsive flight cards stay in document flow as target content grows\. \*\/\s*body\[data-ui-surface="flight"\] \.hud-nav-card--route\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(targetStatusRule).toContain("overflow: visible");
    expect(targetStatusRule).toContain("overflow-wrap: anywhere");
    expect(targetStatusRule).toContain("text-overflow: clip");
    expect(targetStatusRule).toContain("white-space: normal");
    expect(targetStatusRule).not.toContain("ellipsis");
    expect(targetStatusRule).not.toContain("nowrap");
    expect(targetKindRule).toContain("overflow: visible");
    expect(targetKindRule).toContain("white-space: normal");
    expect(v4Css).toMatch(/\.hud-panel-section--navigation\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
    expect(v4Css).toMatch(/\.hud-nav-card--target\s*\{[\s\S]*?position:\s*relative\s*!important;[\s\S]*?top:\s*auto\s*!important;/);
    expect(v4Css).toMatch(/\.hud-nav-card--route\s*\{[\s\S]*?position:\s*relative\s*!important;[\s\S]*?top:\s*auto\s*!important;/);
    expect(responsiveRouteRule).toContain("position: relative");
    expect(responsiveRouteRule).toContain("top: auto");
    expect(responsiveRouteRule).toContain("height: auto");
    expect(responsiveRouteRule).not.toMatch(/top:\s*\d+(?:\.\d+)?px/);
  });

  it("keeps compact flight rails inside the measured center safe area", () => {
    const css = readFileSync("src/style.css", "utf8");
    const measuredContract = css.slice(css.lastIndexOf("/* Final measured safe-area contract for compact flight viewports. */"));

    expect(measuredContract).toMatch(/#flight-hud #hud-right-panel,[\s\S]*?\.hud-panel-section--navigation\s*\{[\s\S]*?background:\s*transparent\s*!important;[\s\S]*?background-color:\s*transparent\s*!important;[\s\S]*?background-image:\s*none\s*!important;[\s\S]*?backdrop-filter:\s*none\s*!important;[\s\S]*?filter:\s*none\s*!important;[\s\S]*?box-shadow:\s*none\s*!important;/);
    expect(measuredContract).toMatch(/@media \(min-width: 761px\) and \(max-width: 1100px\)\s*\{[\s\S]*?#hud-right-panel\s*\{[\s\S]*?width:\s*clamp\(280px, 26\.8vw, 336px\);/);
    expect(measuredContract).toMatch(/@media \(max-width: 760px\)\s*\{[\s\S]*?#hud-left-panel,[\s\S]*?#hud-right-panel\s*\{[\s\S]*?width:\s*210px;[\s\S]*?#hud-radar-panel\s*\{[\s\S]*?width:\s*240px;[\s\S]*?\.hud-nav-card--target,[\s\S]*?\.hud-nav-card--route\s*\{[\s\S]*?width:\s*100%;/);
  });

  it("renders throttle segments proportionally for zero, partial, and full thrust", () => {
    const elements = installDocumentStub();
    const base = createTwoLegRouteTelemetry(125);
    const segments = elements.get("throttle-segments");

    renderStatusHud({ ...base, ship: { ...base.ship, throttle: 0 } });
    expect(segments?.dataset.activeCount).toBe("0");
    expect(segments?.getAttribute("aria-valuenow")).toBe("0");
    expect(segments?.children.every((segment) => segment.dataset.active === "false")).toBe(true);

    renderStatusHud({ ...base, ship: { ...base.ship, throttle: 0.42 } });
    expect(segments?.dataset.activeCount).toBe("4");
    expect(segments?.getAttribute("aria-valuenow")).toBe("42");
    expect(segments?.children.filter((segment) => segment.dataset.active === "true")).toHaveLength(4);
    expect(segments?.getAttribute("aria-valuetext")).toContain("4 of 8 segments active");

    renderStatusHud({ ...base, ship: { ...base.ship, throttle: 1 } });
    expect(segments?.dataset.activeCount).toBe("8");
    expect(segments?.getAttribute("aria-valuenow")).toBe("100");
    expect(segments?.children.every((segment) => segment.className.includes("is-active"))).toBe(true);
  });

  it("keeps planner obstacles accessible without rendering colliding obstacle labels", () => {
    const elements = installDocumentStub("flight", true);
    const base = createTwoLegRouteTelemetry(125);
    const orientedShip = {
      ...base.ship,
      orientation: { x: 0, y: -Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }
    };
    const obstacles = [{ id: "runtime-rock-a", center: vec3(150, 0, 12), radius: 18, padding: 4 }];
    const telemetry: TelemetrySnapshot = {
      ...base,
      ship: orientedShip,
      obstacles,
      navigationMap: createNavigationMapSnapshot({
        ship: navigationMapShipSnapshot({
          absolutePosition: worldCoordinate(orientedShip.position),
          orientation: orientedShip.orientation,
          presentation: DEFAULT_ACTIVE_SHIP_PRESENTATION
        }),
        targets: base.selectedTarget ? [navigationMapTargetSnapshot(base.selectedTarget)] : [],
        selectedTargetId: base.selectedTarget?.id ?? null,
        route: base.lockedPlan ? navigationMapRouteSnapshot(base.lockedPlan) : null,
        obstacles: obstacles.map((obstacle) => navigationMapObstacleSnapshot(obstacle)),
        world: {
          registrySignature: "status-hud-test-registry",
          streamingSignature: "status-hud-test-streaming",
          fullChunkIds: [],
          snapshotChunkIds: []
        }
      })
    };
    const css = readFileSync("src/style.css", "utf8");
    const authoritativeCss = css.slice(css.lastIndexOf("/* V3 authoritative live planner and telemetry-owned flight contacts. */"));

    renderStatusHud(telemetry);

    const svg = elements.get("planner-route-svg");
    const viewport = elements.get("planner-map-viewport");
    const mapNodes = viewport ? descendantsOf(viewport) : [];
    const obstacle = mapNodes.find((node) => node.getAttribute("data-obstacle-id") === "runtime-rock-a");
    const shipMarker = mapNodes.find((node) => node.getAttribute("data-map-object") === "active-ship");
    const obstacleLabels = mapNodes.filter((node) => node.getAttribute("class")?.includes("planner-map-runtime-label--obstacle"));

    expect(svg?.dataset.obstacleLabels).toBe("accessible-only");
    expect(svg?.getAttribute("role")).toBe("group");
    expect(svg?.getAttribute("aria-label")).toBe("Runtime local navigation map");
    expect(obstacle?.tagName).toBe("CIRCLE");
    expect(obstacle?.getAttribute("role")).toBe("img");
    expect(obstacle?.getAttribute("data-radius-metres")).toBe("18");
    expect(obstacle?.getAttribute("data-label-visibility")).toBe("accessible-only");
    expect(obstacle?.getAttribute("aria-label")).toBe("runtime-rock-a, radius 18.0 metres");
    expect(obstacle?.children[0]?.tagName).toBe("TITLE");
    expect(obstacle?.children[0]?.textContent).toBe("runtime-rock-a, radius 18.0 metres");
    expect(shipMarker?.getAttribute("data-absolute-x")).toBe("125");
    expect(shipMarker?.getAttribute("data-heading-degrees")).toBe("90.0000");
    expect(shipMarker?.getAttribute("transform")).toContain("rotate(0.0000)");
    expect(shipMarker?.getAttribute("data-display-name")).toBe("Demo Scout GLB");
    expect(shipMarker?.getAttribute("data-blueprint-id")).toBe("demo-scout-mk1");
    expect(obstacleLabels).toHaveLength(0);
    expect(elements.get("navigation-planner")?.dataset.visiblePreviewHash).toBe("progress-hash");
    expect(elements.get("planner-route-detail")?.textContent).toContain("hash progress-hash; Locked");
    expect(authoritativeCss).toMatch(/\.planner-runtime-summary\s*\{[\s\S]*?position:\s*static;[\s\S]*?width:\s*100%;[\s\S]*?clip-path:\s*none;/);
    expect(authoritativeCss).toMatch(/#planner-route-detail\s*\{[\s\S]*?width:\s*100%;[\s\S]*?overflow-wrap:\s*anywhere;/);
  });

  it("uses runtime combat values and authoritatively suppresses fixed pseudo-content", () => {
    const elements = installDocumentStub("combat", true);
    const base = createTwoLegRouteTelemetry(125);
    const warningSnapshot = {
      ...base.flightSnapshot,
      routeValid: false,
      failureReasonCodes: ["OffLockedRoute" as const]
    };
    const telemetry: TelemetrySnapshot = {
      ...base,
      ship: { ...base.ship, velocity: vec3(3, 4, 0), throttle: 0.42 },
      flightSnapshot: warningSnapshot,
      executor: {
        ...base.executor,
        replanRequired: true,
        failureReasonCodes: ["OffLockedRoute"],
        flightSnapshot: warningSnapshot
      }
    };
    const combat = createCombatRuntimeViewModel(telemetry);
    const html = readFileSync("index.html", "utf8");
    const css = readFileSync("src/style.css", "utf8");
    const authoritativeCss = css.slice(css.lastIndexOf("/* V3 authoritative live planner and telemetry-owned flight contacts. */"));

    expect(combat.speed).toBe("5.00 m/s");
    expect(combat.throttle).toBe("42%");
    expect(combat.targetLabel).toBe("Progress Target");
    expect(combat.targetDistance).toBe("75.0 m");
    expect(combat.autopilot).toBe("Blocked");
    expect(combat.controlMode).toBe(telemetry.ship.controlMode);
    expect(combat.controlAssist).toContain("RCS on");
    expect(combat.authority).toContain("authority ready");
    expect(combat.braking).toContain("available");
    renderStatusHud(telemetry);

    expect(elements.get("velocity-status")?.textContent).toBe("Speed 5.00 m/s");
    expect(elements.get("throttle-status")?.textContent).toBe("42%");
    expect(elements.get("fuel-status")?.textContent).toBe(createStatusHudViewModel(telemetry).flightStatus.fuel.value);
    expect(elements.get("combat-marker-target")?.textContent).toBe("PROGRESS TARGET");
    expect(elements.get("combat-marker-distance")?.textContent).toBe("75.0 m");
    expect(elements.get("combat-contact-name")?.textContent).toBe("Progress Target");
    expect(elements.get("combat-contact-range")?.textContent).toBe("75.0 m");
    expect(elements.get("combat-target-name")?.textContent).toBe("PROGRESS TARGET");
    expect(elements.get("combat-target-kind")?.textContent).toBe("POINT");
    expect(elements.get("combat-target-distance")?.textContent).toBe("75.0 m");
    expect(elements.get("combat-flight-speed")?.textContent).toBe("5.00 m/s");
    expect(elements.get("combat-flight-throttle")?.textContent).toBe("42%");
    expect(elements.get("combat-flight-fuel")?.textContent).toBe(combat.fuel);
    expect(elements.get("combat-control-mode")?.textContent).toBe(telemetry.ship.controlMode);
    expect(elements.get("combat-control-assist")?.textContent).toBe(combat.controlAssist);
    expect(elements.get("combat-authority-status")?.textContent).toBe(combat.authority);
    expect(elements.get("combat-brake-status")?.textContent).toBe(combat.braking);
    expect(elements.get("combat-warning-status")?.textContent).toContain("Plan invalidated");
    expect(elements.get("combat-radar-status")?.textContent).toMatch(/contacts · 250 m/);
    expect(elements.get("combat-autopilot-status")?.textContent).toBe("Blocked");
    expect(elements.get("radar-runtime-contacts")?.children.some((contact) => contact.dataset.targetId === "target-progress")).toBe(true);

    const renderedCombatText = [
      "velocity-status",
      "throttle-status",
      "fuel-status",
      "combat-marker-target",
      "combat-marker-distance",
      "combat-contact-name",
      "combat-contact-range",
      "combat-target-name",
      "combat-target-kind",
      "combat-target-distance",
      "combat-flight-speed",
      "combat-flight-throttle",
      "combat-flight-fuel",
      "combat-control-mode",
      "combat-control-assist",
      "combat-authority-status",
      "combat-brake-status",
      "combat-warning-status",
      "combat-radar-status",
      "combat-autopilot-status"
    ].map((id) => elements.get(id)?.textContent ?? "").join("\n");
    expect(renderedCombatText).not.toContain("PIRATEN-JÄGER");
    expect(renderedCombatText).not.toContain("611 m");
    expect(renderedCombatText).not.toContain("248");
    expect(html).not.toContain("PIRATEN-JÄGER");
    expect(html).not.toContain("611 m");
    expect(html).toContain('class="combat-runtime-section" aria-label="Flight telemetry"');
    expect(html).toContain('class="combat-runtime-section" aria-label="Control telemetry"');
    expect(html).toContain('class="combat-runtime-section" aria-label="Navigation safety telemetry"');
    expect(css).not.toContain('content: "248"');
    expect(css).not.toContain('content: "78 %"');
    expect(css).not.toContain('content: "62 %"');
    expect(authoritativeCss).toContain("content: none !important");
    expect(authoritativeCss).toContain(".flight-nav-distance-scale__fill");
    expect(authoritativeCss).toMatch(/body\[data-ui-surface="combat"\] \.contact-panel\s*\{[\s\S]*?height:\s*auto;[\s\S]*?min-height:\s*0;/);
    expect(authoritativeCss).toMatch(/body\[data-ui-surface="combat"\] \.combat-runtime-sections\s*\{[\s\S]*?display:\s*grid;/);
  });

  it("keeps the flight HUD DOM and CSS center-safe-area contract", () => {
    const elements = installDocumentStub("flight");
    const html = readFileSync("index.html", "utf8");
    const css = readFileSync("src/style.css", "utf8");
    const authoritativeCss = css.slice(css.lastIndexOf("/* V3 authoritative live planner and telemetry-owned flight contacts. */"));
    const commands: unknown[] = [];
    const lockedTelemetry = createTwoLegRouteTelemetry(125);

    renderStatusHud(lockedTelemetry, { dispatch: (command) => commands.push(command) });

    expect(html).toContain('id="flight-hud"');
    expect(html).toContain('data-testid="basic-hud"');
    expect(html).toContain('id="hud-top-strip"');
    expect(html).toContain('id="hud-left-panel"');
    expect(html).toContain('id="hud-right-panel"');
    expect(html).toContain('id="hud-bottom-strip"');
    expect(html).toContain('id="objective-status"');
    expect(html).toContain('data-testid="objective-label"');
    expect(html).toContain('id="warning-chips" class="warning-chip-strip hud-warning-strip" aria-live="polite" data-testid="warning-state" hidden></div>');
    expect(html).toContain('id="combat-warning-row" hidden');
    expect(html).not.toMatch(/id="warning-chips"[^>]*>\s*none\s*</i);
    expect(html).not.toMatch(/id="combat-warning-status"[^>]*>\s*none\s*</i);
    expect(html).toContain('id="planner-route-svg" class="planner-route-svg" viewBox="0 0 1000 620" role="group" aria-label="Runtime route preview map"');
    expect(html).not.toMatch(/id="planner-route-svg"[^>]*role="img"/);
    expect(html).toMatch(/flight-target-row--identity[\s\S]*id="target-status"[\s\S]*id="target-kind"[\s\S]*flight-target-row--distance[\s\S]*id="target-distance"/);
    expect(html).toContain('id="throttle-segments" class="hud-segments" role="meter"');
    expect(html).toMatch(/radar-footer[\s\S]*id="radar-status"[\s\S]*id="radar-range"/);
    expect(html.match(/id="open-navigation-planner"/g)).toHaveLength(1);
    expect(html.match(/id="cancel-autopilot"/g)).toHaveLength(1);
    expect(html.match(/id="engage-autopilot"/g)).toHaveLength(1);
    expect(html).toMatch(/hud-nav-card--objective[\s\S]*flight-nav-actions[\s\S]*id="open-navigation-planner"[\s\S]*id="cancel-autopilot"[\s\S]*flight-nav-runtime/);
    expect(html).toMatch(/id="hud-bottom-strip"[\s\S]*id="engage-autopilot"[\s\S]*<\/footer>/);
    expect(html).not.toMatch(/id="hud-bottom-strip"[\s\S]*id="cancel-autopilot"[\s\S]*<\/footer>/);
    expect(html).toContain('<dialog id="navigation-planner"');
    expect(html).toContain('id="planner-engage-route"');
    expect(elements.get("open-navigation-planner")?.onclick).toBeTypeOf("function");
    expect(elements.get("cancel-autopilot")?.onclick).toBeTypeOf("function");
    expect(elements.get("flight-hud")?.getAttribute("data-route-locked")).toBe("true");
    elements.get("cancel-autopilot")?.onclick?.();
    expect(commands).toEqual([{ type: "CancelAutopilot" }]);

    renderStatusHud({
      ...lockedTelemetry,
      lockedPlan: null,
      executor: {
        ...lockedTelemetry.executor,
        status: "Idle",
        routeLifecycle: "Idle",
        planHash: null,
        activeSegmentId: null
      }
    });
    expect(elements.get("flight-hud")?.getAttribute("data-route-locked")).toBe("false");
    expect(html).toContain('class="hud-center-safe-area"');
    expect(html).toContain('id="debug-hud"');
    expect(css).toContain(".hud-center-safe-area");
    expect(css).toContain("background: transparent");
    expect(css).toContain("#hud-left-panel");
    expect(css).toContain("#hud-right-panel");
    expect(css).toContain("#hud-bottom-strip");
    expect(css).toContain(".objective-option-strip");
    expect(authoritativeCss).toContain('body[data-ui-surface="flight"] #open-navigation-planner.flight-nav-action');
    expect(authoritativeCss).toContain("display: flex !important");
    expect(authoritativeCss).toContain("pointer-events: auto");
    expect(authoritativeCss).toContain('body[data-ui-surface="combat"] #open-navigation-planner');
    expect(authoritativeCss).toMatch(/\.hud-nav-card--target\s*\{[\s\S]*?grid-template-rows:[\s\S]*?overflow:\s*visible;/);
    expect(authoritativeCss).toMatch(/\.flight-target-row--distance\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*space-between;/);
    expect(authoritativeCss).toMatch(/\.hud-metric-row--fuel #fuel-status,[\s\S]*?#fuel-status\s*\{[\s\S]*?position:\s*static;/);
    expect(authoritativeCss).toMatch(/\.hud-segments span\.is-active,[\s\S]*?background:\s*#23d6f2\s*!important;/);
    expect(authoritativeCss).toMatch(/\.radar-footer,[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\) auto;/);
    expect(authoritativeCss).toMatch(/body\[data-ui-surface="flight"\] \.flight-nav-actions\s*\{[\s\S]*?height:\s*60px;/);
    expect(authoritativeCss).toMatch(/#flight-hud\[data-route-locked="true"\] \.flight-nav-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
    expect(authoritativeCss).toMatch(/#cancel-autopilot\.flight-nav-action--cancel\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?pointer-events:\s*none;/);
    expect(authoritativeCss).toMatch(/#flight-hud\[data-route-locked="true"\] #cancel-autopilot\.flight-nav-action--cancel\s*\{[\s\S]*?display:\s*flex\s*!important;[\s\S]*?pointer-events:\s*auto;/);
    expect(authoritativeCss).toMatch(/body\[data-ui-surface="flight"\]:not\(\[data-debug-hud="true"\]\) #engage-autopilot\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?pointer-events:\s*none\s*!important;/);
    expect(authoritativeCss).toMatch(/body\[data-ui-surface="flight"\]:not\(\[data-debug-hud="true"\]\) #hud-bottom-strip,[\s\S]*?\.hud-bottom-group--actions\s*\{[\s\S]*?pointer-events:\s*none\s*!important;/);
    expect(authoritativeCss).toContain("#navigation-planner:not([open])");
    expect(authoritativeCss).toMatch(/#navigation-planner:not\(\[open\]\)\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?pointer-events:\s*none\s*!important;/);
    expect(authoritativeCss).toMatch(/#flight-hud\[data-planner-open="true"\] #navigation-planner\[open\]\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?pointer-events:\s*auto;/);
  });
});
