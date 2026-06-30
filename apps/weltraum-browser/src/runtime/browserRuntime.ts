import { AutopilotExecutor, DirectLocalPlanner, FixedStepSimulationLoop, ObstacleAvoidanceLocalPlanner, createTelemetrySnapshot, vec3 } from "../core";
import type { ObstacleDescriptor, RoutePlan, RoutePlanningResult, ShipState, TargetDescriptor } from "../core";
import { autopilotAuthority, createShipState, defaultObstacles, noAutopilotAuthority, provingGroundTargets } from "../world/provingGroundWorld";
import type { BrowserRuntimeCommand } from "./commands";
import type { RoutePreviewSnapshot, TelemetrySnapshot } from "../sim/telemetry";

export type { BrowserRuntimeCommand } from "./commands";

export interface BrowserRuntimeController {
  advance(elapsedSeconds: number): TelemetrySnapshot;
  step(count?: number): TelemetrySnapshot;
  getTelemetry(): TelemetrySnapshot;
  getPlanHash(): string | null;
  getLockedPlan(): RoutePlan | null;
  dispatchCommand(command: unknown): TelemetrySnapshot;
  disturbShip(offsetX: number): TelemetrySnapshot;
}

export const createInitialShip = (): ShipState => createShipState({ authority: autopilotAuthority });

export const defaultTarget: TargetDescriptor = provingGroundTargets.navigationAlpha;

export const browserTargetCatalog: readonly TargetDescriptor[] = Object.values(provingGroundTargets);

export const browserObstacles: readonly ObstacleDescriptor[] = defaultObstacles;

export interface BrowserRuntimeOptions {
  readonly initialShip?: ShipState;
}

export const createBrowserRuntime = (options: BrowserRuntimeOptions = {}) => {
  const executor = new AutopilotExecutor({ divergenceDistance: 24 });
  let ship = options.initialShip ?? createInitialShip();
  const loop = new FixedStepSimulationLoop(ship, executor, { fixedDeltaSeconds: 1 / 30, maxSubSteps: 10 });
  let selectedTarget: TargetDescriptor | null = defaultTarget;
  let selectedPlanner: RoutePlan["planner"] = "ObstacleAvoidanceLocal";
  let routePreview: RoutePreviewSnapshot | null = null;
  let runtimeMessage: string | null = null;

  const plannerFor = (planner: RoutePlan["planner"]): DirectLocalPlanner | ObstacleAvoidanceLocalPlanner =>
    planner === "DirectLocal" ? new DirectLocalPlanner() : new ObstacleAvoidanceLocalPlanner();

  const createRoutePreview = (planner: RoutePlan["planner"], target: TargetDescriptor | null): RoutePreviewSnapshot => {
    if (!target) {
      return {
        state: "Unavailable",
        planner,
        target: null,
        plan: null,
        validation: null,
        rejectedReasonCodes: [],
        playerMessage: "Select a target to preview a route."
      };
    }

    const planningResult: RoutePlanningResult = plannerFor(planner).planResult({
      tick: loop.getTick(),
      ship: loop.getShip(),
      target,
      obstacles: planner === "ObstacleAvoidanceLocal" ? browserObstacles : undefined
    });

    if (planningResult.ok) {
      return {
        state: "Ready",
        planner,
        target,
        plan: planningResult.plan,
        validation: planningResult.validation,
        rejectedReasonCodes: [],
        playerMessage: `Route preview ready for ${target.label}.`
      };
    }

    return {
      state: "Unavailable",
      planner,
      target,
      plan: null,
      validation: planningResult.validation,
      rejectedReasonCodes: planningResult.rejection.reasonCodes,
      playerMessage: `Route preview unavailable for ${target.label}.`
    };
  };

  const refreshRoutePreview = (planner: RoutePlan["planner"] = selectedPlanner): RoutePreviewSnapshot => {
    selectedPlanner = planner;
    routePreview = createRoutePreview(planner, selectedTarget);
    return routePreview;
  };

  const snapshot = (): TelemetrySnapshot => ({
    ...createTelemetrySnapshot(loop.getShip(), loop.getTelemetry(), executor.getLockedPlan()),
    selectableTargets: browserTargetCatalog,
    selectedTarget,
    routePreview,
    runtimeMessage
  });

  const lockPlan = (plan: RoutePlan): RoutePlan => {
    executor.lockPlan(plan, loop.getShip(), loop.getTick());
    return plan;
  };

  const planForSelectedTarget = (planner: RoutePlan["planner"]): RoutePlan | null => {
    const preview = refreshRoutePreview(planner);
    if (preview.plan) {
      return preview.plan;
    }

    runtimeMessage = preview.playerMessage;
    return null;
  };

  const selectTarget = (targetId: unknown): void => {
    if (executor.getLockedPlan()) {
      runtimeMessage = "Cancel the current autopilot route before selecting another target.";
      return;
    }

    if (typeof targetId !== "string") {
      runtimeMessage = "Target selection unchanged: choose a known target.";
      return;
    }

    const target = browserTargetCatalog.find((candidateTarget) => candidateTarget.id === targetId) ?? null;
    if (!target) {
      runtimeMessage = "Target selection unchanged: choose a known target.";
      return;
    }

    selectedTarget = target;
    runtimeMessage = `Selected ${target.label}.`;
    refreshRoutePreview(selectedPlanner);
  };

  const engageAutopilot = (planner: unknown): void => {
    if (planner !== "DirectLocal" && planner !== "ObstacleAvoidanceLocal") {
      runtimeMessage = "Autopilot not engaged: choose a supported route mode.";
      return;
    }

    const lockedPlan = executor.getLockedPlan();
    if (lockedPlan) {
      runtimeMessage = "Autopilot not engaged: cancel the current locked route before engaging a new one.";
      return;
    }

    const plan = planForSelectedTarget(planner);
    if (!plan) {
      return;
    }

    lockPlan(plan);
    runtimeMessage = `Autopilot engaged for ${plan.target.label}.`;
  };

  const dispatchCommand = (command: unknown): TelemetrySnapshot => {
    if (!command || typeof command !== "object") {
      runtimeMessage = "Command ignored: use a supported cockpit action.";
      return snapshot();
    }

    const candidate = command as Partial<BrowserRuntimeCommand>;
    switch (candidate.type) {
      case "SelectTarget":
        selectTarget(candidate.targetId);
        return snapshot();
      case "EngageAutopilot":
        engageAutopilot(candidate.planner);
        return snapshot();
      case "CancelAutopilot": {
        const stoppedShip = executor.cancelPlan(loop.getShip(), loop.getTick());
        loop.setShip(stoppedShip);
        ship = stoppedShip;
        runtimeMessage = "Autopilot canceled. Route preview remains available for the selected target.";
        refreshRoutePreview(selectedPlanner);
        return snapshot();
      }
      default:
        runtimeMessage = "Command ignored: use a supported cockpit action.";
        return snapshot();
    }
  };

  ship = executor.cancelPlan(ship, loop.getTick());
  loop.setShip(ship);
  refreshRoutePreview(selectedPlanner);

  const controller: BrowserRuntimeController = {
    advance(elapsedSeconds: number) {
      ship = loop.advance(elapsedSeconds);
      return snapshot();
    },
    step(count = 1) {
      ship = loop.step(count);
      return snapshot();
    },
    getTelemetry: snapshot,
    getPlanHash() {
      return executor.getLockedPlan()?.planHash ?? null;
    },
    getLockedPlan() {
      return executor.getLockedPlan();
    },
    dispatchCommand,
    disturbShip(offsetX: number) {
      const current = loop.getShip();
      loop.setShip({
        ...current,
        position: vec3(current.position.x + offsetX, current.position.y + 64, current.position.z)
      });
      ship = loop.step(1);
      runtimeMessage = "Ship disturbed from the locked route.";
      return snapshot();
    }
  };

  return { controller, loop, executor, getShip: () => ship };
};

export const createSpikeRuntime = createBrowserRuntime;

export const createRuntimeShipForFlightCase = (flightCase: string | null): ShipState => {
  if (flightCase === "insufficient-fuel") {
    return createShipState({ fuel: 0 });
  }
  if (flightCase === "no-authority") {
    return createShipState({ authority: noAutopilotAuthority });
  }

  return createInitialShip();
};
