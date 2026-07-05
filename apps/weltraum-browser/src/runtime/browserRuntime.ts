import { AutopilotExecutor, DirectLocalPlanner, FixedStepSimulationLoop, ObstacleAvoidanceLocalPlanner, createTelemetrySnapshot, vec3 } from "../core";
import type { ObstacleDescriptor, PresentationSnapshot, RoutePlan, RoutePlanningResult, ShipState, TargetDescriptor } from "../core";
import { autopilotAuthority, createShipState, noAutopilotAuthority, playableLargeFieldRuntimeObstacles, provingGroundTargets } from "../world/provingGroundWorld";
import type { BrowserRuntimeCommand } from "./commands";
import { clamp01, createManualFlightInputState, mergeManualFlightInputState, nextCameraMode, nextControlMode, type ManualFlightInputState } from "./input";
import type { RoutePreviewSnapshot, TelemetrySnapshot } from "../sim/telemetry";

export type { BrowserRuntimeCommand } from "./commands";

export interface BrowserRuntimeController {
  advance(elapsedSeconds: number): TelemetrySnapshot;
  step(count?: number): TelemetrySnapshot;
  getTelemetry(): TelemetrySnapshot;
  getPlanHash(): string | null;
  getLockedPlan(): RoutePlan | null;
  getPresentationSnapshot(): PresentationSnapshot;
  dispatchCommand(command: unknown): TelemetrySnapshot;
  getManualInput(): ManualFlightInputState;
  disturbShip(offsetX: number): TelemetrySnapshot;
}

export const createInitialShip = (): ShipState => createShipState({ authority: autopilotAuthority });

export const defaultTarget: TargetDescriptor = provingGroundTargets.navigationAlpha;

export const browserTargetCatalog: readonly TargetDescriptor[] = Object.values(provingGroundTargets);

export const browserObstacles: readonly ObstacleDescriptor[] = playableLargeFieldRuntimeObstacles;

export interface BrowserRuntimeOptions {
  readonly initialShip?: ShipState;
}

export const createBrowserRuntime = (options: BrowserRuntimeOptions = {}) => {
  const executor = new AutopilotExecutor({ divergenceDistance: 24, allowManualInputWhenIdle: true });
  let ship = options.initialShip ?? createInitialShip();
  const loop = new FixedStepSimulationLoop(ship, executor, { fixedDeltaSeconds: 1 / 30, maxSubSteps: 10 });
  let selectedTarget: TargetDescriptor | null = defaultTarget;
  let selectedPlanner: RoutePlan["planner"] = "ObstacleAvoidanceLocal";
  let routePreview: RoutePreviewSnapshot | null = null;
  let runtimeMessage: string | null = null;
  let manualInput = createManualFlightInputState({
    controlMode: ship.controlMode,
    rcsEnabled: ship.rcsEnabled,
    sasEnabled: ship.sasEnabled,
    mainThrottleCommand: ship.mainThrottleCommand,
    translationCommand: ship.translationCommand,
    rotationCommand: ship.rotationCommand,
    cameraMode: "ChaseLocked"
  });

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
    runtimeMessage,
    manualInput
  });

  const applyManualInputToLoopShip = (): void => {
    const current = loop.getShip();
    const autopilotOwnsFlight = !executor.getTelemetry().canAcceptNewPlan || executor.getTelemetry().stationKeepingActive;
    const manualInputChanged =
      current.rcsEnabled !== manualInput.rcsEnabled ||
      current.sasEnabled !== manualInput.sasEnabled ||
      (!autopilotOwnsFlight && (
        current.controlMode !== manualInput.controlMode ||
        Math.abs(current.mainThrottleCommand - manualInput.mainThrottleCommand) > 1e-6 ||
        Math.abs(current.translationCommand.x - manualInput.translationCommand.x) > 1e-6 ||
        Math.abs(current.translationCommand.y - manualInput.translationCommand.y) > 1e-6 ||
        Math.abs(current.translationCommand.z - manualInput.translationCommand.z) > 1e-6 ||
        Math.abs(current.rotationCommand.x - manualInput.rotationCommand.x) > 1e-6 ||
        Math.abs(current.rotationCommand.y - manualInput.rotationCommand.y) > 1e-6 ||
        Math.abs(current.rotationCommand.z - manualInput.rotationCommand.z) > 1e-6
      ));
    if (!manualInputChanged) {
      ship = current;
      return;
    }

    const updatedShip = {
      ...current,
      controlMode: autopilotOwnsFlight ? current.controlMode : manualInput.controlMode,
      rcsEnabled: manualInput.rcsEnabled,
      sasEnabled: manualInput.sasEnabled,
      mainThrottleCommand: autopilotOwnsFlight ? current.mainThrottleCommand : manualInput.mainThrottleCommand,
      throttle: autopilotOwnsFlight ? current.throttle : manualInput.mainThrottleCommand,
      translationCommand: autopilotOwnsFlight ? current.translationCommand : manualInput.translationCommand,
      rotationCommand: autopilotOwnsFlight ? current.rotationCommand : manualInput.rotationCommand
    };
    loop.setShip(updatedShip);
    ship = updatedShip;
  };

  const updateManualInput = (input: Partial<ManualFlightInputState>): void => {
    manualInput = mergeManualFlightInputState(manualInput, input);
    applyManualInputToLoopShip();
  };

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
    if (!executor.getTelemetry().canSelectNewTarget) {
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

    if (!executor.getTelemetry().canAcceptNewPlan) {
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
        const driftPreservingShip = executor.cancelPlan(loop.getShip(), loop.getTick());
        loop.setShip(driftPreservingShip);
        ship = driftPreservingShip;
        manualInput = mergeManualFlightInputState(manualInput, {
          mainThrottleCommand: driftPreservingShip.mainThrottleCommand,
          translationCommand: driftPreservingShip.translationCommand,
          rotationCommand: driftPreservingShip.rotationCommand
        });
        runtimeMessage = "Autopilot canceled. Route preview remains available for the selected target.";
        refreshRoutePreview(selectedPlanner);
        return snapshot();
      }
      case "SetManualFlightInput":
        updateManualInput(typeof candidate.input === "object" && candidate.input ? candidate.input : {});
        return snapshot();
      case "SetThrottle": {
        const requestedThrottle = clamp01(typeof candidate.throttle === "number" ? candidate.throttle : manualInput.mainThrottleCommand);
        updateManualInput({ mainThrottleCommand: requestedThrottle });
        runtimeMessage = manualInput.controlMode !== "Cruise" && requestedThrottle > 0
          ? "Throttle ignored outside Cruise."
          : manualInput.mainThrottleCommand <= 0 ? "Throttle cut." : manualInput.mainThrottleCommand >= 1 ? "Throttle full." : "Throttle adjusted.";
        return snapshot();
      }
      case "ToggleRcs":
        updateManualInput({ rcsEnabled: !manualInput.rcsEnabled });
        runtimeMessage = `RCS ${manualInput.rcsEnabled ? "enabled" : "disabled"}.`;
        return snapshot();
      case "ToggleSas":
        updateManualInput({ sasEnabled: !manualInput.sasEnabled });
        runtimeMessage = `SAS ${manualInput.sasEnabled ? "enabled" : "disabled"}.`;
        return snapshot();
      case "CycleControlMode":
        updateManualInput({ controlMode: nextControlMode(manualInput.controlMode) });
        runtimeMessage = `Control mode ${manualInput.controlMode}.`;
        return snapshot();
      case "CycleCameraMode":
        updateManualInput({ cameraMode: nextCameraMode(manualInput.cameraMode) });
        runtimeMessage = `Camera mode ${manualInput.cameraMode}.`;
        return snapshot();
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
      applyManualInputToLoopShip();
      ship = loop.advance(elapsedSeconds);
      return snapshot();
    },
    step(count = 1) {
      applyManualInputToLoopShip();
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
    getPresentationSnapshot() {
      return loop.getPresentationSnapshot();
    },
    dispatchCommand,
    getManualInput() {
      return manualInput;
    },
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
