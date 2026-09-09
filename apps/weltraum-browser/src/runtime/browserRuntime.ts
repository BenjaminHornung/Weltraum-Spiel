import { AutopilotExecutor, DirectLocalPlanner, FixedStepSimulationLoop, ObstacleAvoidanceLocalPlanner, autopilotSpeedProfileIds, createRoutePreviewProvenance, createTelemetrySnapshot, validatePreviewForLock, vec3 } from "../core";
import type { AutopilotSpeedProfileId, ObstacleDescriptor, PresentationSnapshot, PreviewLockValidationResult, RoutePlan, RoutePlanningResult, ShipState, TargetDescriptor } from "../core";
import { autopilotAuthority, createShipState, noAutopilotAuthority, playableLargeFieldRuntimeObstacles, playableLargeFieldTargets, provingGroundTargets } from "../world/provingGroundWorld";
import { createPgTragwerkPlayerSlice, type PgTragwerkPlayerSnapshot } from "../provingGround/pgTragwerkPlayerSlice";
import type { BrowserRuntimeCommand, BrowserRuntimeCommandCode, BrowserRuntimeCommandResult, BrowserRuntimeRejectionCode } from "./commands";
import { clamp01, createManualFlightInputState, mergeManualFlightInputState, nextCameraMode, nextControlMode, type ManualFlightInputState } from "./input";
import type { NavigationObjectiveOptionSnapshot, NavigationObjectiveSnapshot, NavigationObjectiveStatus, RoutePreviewSnapshot, TelemetrySnapshot } from "../sim/telemetry";
import {
  DEFAULT_ACTIVE_SHIP_PRESENTATION,
  createNavigationMapSnapshot,
  navigationMapObstacleSnapshot,
  navigationMapRouteSnapshot,
  navigationMapShipSnapshot,
  navigationMapTargetSnapshot
} from "../navigation/map";
import { worldCoordinate } from "../world/frames";
import {
  createProvingGroundNavigationMapWorldAdapter,
  type NavigationMapWorldAdapterSnapshot
} from "../world/navigationMapWorldAdapter";

export type { BrowserRuntimeCommand, BrowserRuntimeCommandResult } from "./commands";

export interface BrowserRuntimeController {
  advance(elapsedSeconds: number): TelemetrySnapshot;
  step(count?: number): TelemetrySnapshot;
  getTelemetry(): TelemetrySnapshot;
  getPlanHash(): string | null;
  getLockedPlan(): RoutePlan | null;
  getPresentationSnapshot(): PresentationSnapshot;
  dispatchCommand(command: unknown): BrowserRuntimeCommandResult;
  getManualInput(): ManualFlightInputState;
  getPgTragwerk(): PgTragwerkPlayerSnapshot;
  disturbShip(offsetX: number): TelemetrySnapshot;
}

export const createInitialShip = (): ShipState => createShipState({ authority: autopilotAuthority });

export const defaultTarget: TargetDescriptor = provingGroundTargets.navigationAlpha;

export const browserTargetCatalog: readonly TargetDescriptor[] = Object.values(provingGroundTargets);

export const browserObstacles: readonly ObstacleDescriptor[] = playableLargeFieldRuntimeObstacles;

export interface BrowserRuntimeOptions {
  readonly initialShip?: ShipState;
}

interface NavigationObjectiveDefinition {
  readonly id: string;
  readonly label: string;
  readonly targetId: string;
}

const navigationObjectives: readonly NavigationObjectiveDefinition[] = [
  { id: "reach-range-500m", label: "Reach Range 500m", targetId: playableLargeFieldTargets.range500.id },
  { id: "reach-range-1000m", label: "Reach Range 1000m", targetId: playableLargeFieldTargets.range1000.id },
  { id: "reach-range-2500m", label: "Reach Range 2500m", targetId: playableLargeFieldTargets.range2500.id }
];

const objectiveIndexFor = (objective: NavigationObjectiveDefinition): number =>
  navigationObjectives.findIndex((candidateObjective) => candidateObjective.id === objective.id);

const distanceBetween = (
  left: { readonly x: number; readonly y: number; readonly z: number },
  right: { readonly x: number; readonly y: number; readonly z: number }
): number => Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);

export const createBrowserRuntime = (options: BrowserRuntimeOptions = {}) => {
  type StoredRoutePreview = Omit<RoutePreviewSnapshot, "lockAdmission">;
  const executor = new AutopilotExecutor({ divergenceDistance: 24, allowManualInputWhenIdle: true });
  let ship = options.initialShip ?? createInitialShip();
  const loop = new FixedStepSimulationLoop(ship, executor, { fixedDeltaSeconds: 1 / 30, maxSubSteps: 10 });
  const navigationMapWorldAdapter = createProvingGroundNavigationMapWorldAdapter();
  const pgTragwerk = createPgTragwerkPlayerSlice();
  let previousNavigationMapWorld: NavigationMapWorldAdapterSnapshot | undefined;
  let selectedTarget: TargetDescriptor | null = defaultTarget;
  let selectedPlanner: RoutePlan["planner"] = "ObstacleAvoidanceLocal";
  let selectedRouteProfile: AutopilotSpeedProfileId = "Balanced";
  let routePreview: StoredRoutePreview | null = null;
  let runtimeMessage: string | null = null;
  let activeObjectiveId: string | null = navigationObjectives[0]?.id ?? null;
  let lastEngagedObjectiveId: string | null = null;
  let lastEngagedObjectiveTargetId: string | null = null;
  let lastEngagedObjectivePlanHash: string | null = null;
  const completedObjectiveIds = new Set<string>();
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

  const lockAdmissionFor = (
    preview: StoredRoutePreview | null,
    expectedPlanHash?: string | null,
    target: TargetDescriptor | null = selectedTarget,
    planner: RoutePlan["planner"] = selectedPlanner,
    speedProfile: AutopilotSpeedProfileId = selectedRouteProfile
  ): PreviewLockValidationResult => validatePreviewForLock({
    preview,
    expectedPlanHash,
    lockedPlan: executor.getLockedPlan(),
    ship: loop.getShip(),
    target,
    obstacles: browserObstacles,
    planner,
    speedProfile
  });

  const createRoutePreview = (planner: RoutePlan["planner"], target: TargetDescriptor | null): StoredRoutePreview => {
    if (!target) {
      return {
        state: "Unavailable",
        planner,
        target: null,
        plan: null,
        validation: null,
        rejectedReasonCodes: [],
        playerMessage: "Select a target to preview a route.",
        provenance: null,
        stale: false,
        staleReason: null
      };
    }

    const sourceTick = loop.getTick();
    const sourceShip = loop.getShip();
    const planningResult: RoutePlanningResult = plannerFor(planner).planResult({
      tick: sourceTick,
      ship: sourceShip,
      target,
      obstacles: planner === "ObstacleAvoidanceLocal" ? browserObstacles : undefined,
      speedProfile: selectedRouteProfile
    });

    if (planningResult.ok) {
      return {
        state: "Ready",
        planner,
        target,
        plan: planningResult.plan,
        validation: planningResult.validation,
        rejectedReasonCodes: [],
        playerMessage: `Route preview ready for ${target.label}.`,
        provenance: createRoutePreviewProvenance({
          ship: sourceShip,
          target,
          obstacles: browserObstacles,
          planner,
          speedProfile: selectedRouteProfile,
          sourceTick
        }),
        stale: false,
        staleReason: null
      };
    }

    return {
      state: "Unavailable",
      planner,
      target,
      plan: null,
      validation: planningResult.validation,
      rejectedReasonCodes: planningResult.rejection.reasonCodes,
      playerMessage: `Route preview unavailable for ${target.label}.`,
      provenance: null,
      stale: false,
      staleReason: null
    };
  };

  const releaseExecutorControl = (): void => {
    const driftPreservingShip = executor.cancelPlan(loop.getShip(), loop.getTick());
    loop.setShip(driftPreservingShip);
    ship = driftPreservingShip;
    manualInput = mergeManualFlightInputState(manualInput, {
      mainThrottleCommand: driftPreservingShip.mainThrottleCommand,
      translationCommand: driftPreservingShip.translationCommand,
      rotationCommand: driftPreservingShip.rotationCommand
    });
  };

  const refreshRoutePreview = (planner: RoutePlan["planner"] = selectedPlanner): StoredRoutePreview => {
    if (executor.getTelemetry().stationKeepingActive) {
      refreshCompletedObjectives();
      releaseExecutorControl();
    }
    selectedPlanner = planner;
    routePreview = createRoutePreview(planner, selectedTarget);
    return routePreview;
  };

  const currentRoutePreview = (): RoutePreviewSnapshot | null =>
    routePreview ? { ...routePreview, lockAdmission: lockAdmissionFor(routePreview) } : null;

  const objectiveTargetFor = (objective: NavigationObjectiveDefinition): TargetDescriptor | null =>
    browserTargetCatalog.find((candidateTarget) => candidateTarget.id === objective.targetId) ?? null;

  const completedByExecutor = (objective: NavigationObjectiveDefinition, executorTelemetry = executor.getTelemetry()): boolean =>
    lastEngagedObjectiveId === objective.id &&
    lastEngagedObjectiveTargetId === objective.targetId &&
    (executorTelemetry.status === "Arrived" || executorTelemetry.stationKeepingActive === true) &&
    (lastEngagedObjectivePlanHash === null ||
      executorTelemetry.completedPlanHash === lastEngagedObjectivePlanHash ||
      executorTelemetry.planHash === lastEngagedObjectivePlanHash);

  const refreshCompletedObjectives = (): void => {
    const objective = navigationObjectives.find((candidateObjective) => candidateObjective.id === lastEngagedObjectiveId);
    if (objective && completedByExecutor(objective)) {
      completedObjectiveIds.add(objective.id);
    }
  };

  const isObjectiveUnlocked = (objective: NavigationObjectiveDefinition): boolean => {
    const objectiveIndex = objectiveIndexFor(objective);
    if (objectiveIndex <= 0) {
      return true;
    }

    return navigationObjectives
      .slice(0, objectiveIndex)
      .every((previousObjective) => completedObjectiveIds.has(previousObjective.id));
  };

  const nextUnlockedObjectiveAfter = (objective: NavigationObjectiveDefinition): NavigationObjectiveDefinition | null => {
    const objectiveIndex = objectiveIndexFor(objective);
    if (objectiveIndex < 0) {
      return null;
    }

    return navigationObjectives
      .slice(objectiveIndex + 1)
      .find((candidateObjective) => !completedObjectiveIds.has(candidateObjective.id) && isObjectiveUnlocked(candidateObjective)) ?? null;
  };

  const firstBlockingObjectiveFor = (objective: NavigationObjectiveDefinition): NavigationObjectiveDefinition | null => {
    const objectiveIndex = objectiveIndexFor(objective);
    if (objectiveIndex <= 0) {
      return null;
    }

    return navigationObjectives
      .slice(0, objectiveIndex)
      .find((candidateObjective) => !completedObjectiveIds.has(candidateObjective.id)) ?? null;
  };

  const statusForObjectiveOption = (
    objective: NavigationObjectiveDefinition,
    activeObjective: NavigationObjectiveDefinition | null,
    activeStatus: NavigationObjectiveStatus | null
  ): NavigationObjectiveStatus => {
    if (objective.id === activeObjective?.id && activeStatus) {
      return activeStatus;
    }
    if (completedObjectiveIds.has(objective.id)) {
      return "complete";
    }
    return isObjectiveUnlocked(objective) ? "available" : "locked";
  };

  const createObjectiveOptions = (
    activeObjective: NavigationObjectiveDefinition | null,
    activeStatus: NavigationObjectiveStatus | null
  ): readonly NavigationObjectiveOptionSnapshot[] =>
    navigationObjectives.map((candidateObjective) => ({
      id: candidateObjective.id,
      label: candidateObjective.label,
      targetId: candidateObjective.targetId,
      status: statusForObjectiveOption(candidateObjective, activeObjective, activeStatus),
      isActive: candidateObjective.id === activeObjective?.id
    }));

  const createNavigationObjectiveSnapshot = (): NavigationObjectiveSnapshot | null => {
    refreshCompletedObjectives();
    const objective = navigationObjectives.find((candidateObjective) => candidateObjective.id === activeObjectiveId) ?? null;
    const options = createObjectiveOptions(objective, null);

    if (!objective) {
      return {
        id: "no-objective",
        label: "No navigation objective",
        targetId: "",
        targetLabel: "none",
        status: "inactive",
        hint: "Choose a large-field objective to begin.",
        distanceMeters: null,
        nextAction: "choose objective",
        options
      };
    }

    const lockedBy = firstBlockingObjectiveFor(objective);
    if (lockedBy) {
      return {
        id: objective.id,
        label: objective.label,
        targetId: objective.targetId,
        targetLabel: "locked",
        status: "locked",
        hint: `${objective.label} unlocks after ${lockedBy.label} is complete.`,
        distanceMeters: null,
        nextAction: "select objective",
        options: createObjectiveOptions(objective, "locked")
      };
    }

    const target = objectiveTargetFor(objective);
    if (!target) {
      return {
        id: objective.id,
        label: objective.label,
        targetId: objective.targetId,
        targetLabel: "missing target",
        status: "blocked",
        hint: "Objective target is unavailable.",
        distanceMeters: null,
        nextAction: "blocked",
        options: createObjectiveOptions(objective, "blocked")
      };
    }

    const lockedPlan = executor.getLockedPlan();
    const executorTelemetry = executor.getTelemetry();
    const distanceMeters = distanceBetween(loop.getShip().position, target.position);
    const selectedMatches = selectedTarget?.id === target.id;
    const lockedMatches = lockedPlan?.target.id === target.id;
    const lockedOtherTarget = Boolean(lockedPlan && !lockedMatches);
    const previewMatches = routePreview?.target?.id === target.id;
    const routeReady = previewMatches && routePreview?.state === "Ready" && Boolean(routePreview.plan) && lockAdmissionFor(routePreview).ok;

    let status: NavigationObjectiveStatus = "available";
    let hint = `Select ${target.label} to preview the route.`;
    let nextAction = "select target";

    if (completedObjectiveIds.has(objective.id) || completedByExecutor(objective, executorTelemetry)) {
      const nextObjective = nextUnlockedObjectiveAfter(objective);
      status = "complete";
      hint = nextObjective
        ? `${objective.label} complete. ${nextObjective.label} is available.`
        : `${objective.label} complete.`;
      nextAction = nextObjective ? "next objective available" : "complete";
    } else if (lockedMatches && executorTelemetry.status === "Executing") {
      status = "enroute";
      hint = `Autopilot enroute to ${target.label}; monitor distance until arrival.`;
      nextAction = "enroute";
    } else if (lockedOtherTarget) {
      status = "blocked";
      hint = "Cancel the current route before following this objective.";
      nextAction = "cancel route";
    } else if (routeReady) {
      status = "route-ready";
      hint = `Route preview ready for ${target.label}; engage autopilot to progress.`;
      nextAction = "engage autopilot";
    } else if (selectedMatches && routePreview?.state === "Unavailable") {
      status = "blocked";
      hint = routePreview.playerMessage;
      nextAction = "blocked";
    } else if (selectedMatches) {
      status = "available";
      hint = `Selected ${target.label}; wait for a route preview.`;
      nextAction = "preview route";
    }

    return {
      id: objective.id,
      label: objective.label,
      targetId: objective.targetId,
      targetLabel: target.label,
      status,
      hint,
      distanceMeters,
      nextAction,
      options: createObjectiveOptions(objective, status)
    };
  };

  const snapshot = (): TelemetrySnapshot => {
    const currentShip = loop.getShip();
    const lockedPlan = executor.getLockedPlan();
    const preview = currentRoutePreview();
    const mapRoutePlan = lockedPlan ?? (preview?.state === "Ready" ? preview.plan : null);
    const mapWorld = navigationMapWorldAdapter.snapshot(
      worldCoordinate(currentShip.position),
      previousNavigationMapWorld
    );
    previousNavigationMapWorld = mapWorld;
    const navigationMap = createNavigationMapSnapshot({
      ship: navigationMapShipSnapshot({
        absolutePosition: worldCoordinate(currentShip.position),
        orientation: currentShip.orientation,
        presentation: DEFAULT_ACTIVE_SHIP_PRESENTATION
      }),
      targets: browserTargetCatalog.map((target) => navigationMapTargetSnapshot(target)),
      selectedTargetId: selectedTarget?.id ?? null,
      route: mapRoutePlan ? navigationMapRouteSnapshot(mapRoutePlan) : null,
      obstacles: browserObstacles.map((obstacle) => navigationMapObstacleSnapshot(obstacle)),
      entities: mapWorld.entities,
      world: {
        registrySignature: mapWorld.registry.signature,
        streamingSignature: mapWorld.streaming.signature,
        fullChunkIds: mapWorld.streaming.fullChunkIds,
        snapshotChunkIds: mapWorld.streaming.snapshotChunkIds
      }
    });

    return {
      ...createTelemetrySnapshot(currentShip, loop.getTelemetry(), lockedPlan),
      selectableTargets: browserTargetCatalog,
      selectedTarget,
      routePreview: preview,
      selectedRouteProfile,
      selectedPlanner,
      obstacles: browserObstacles,
      navigationObjective: createNavigationObjectiveSnapshot(),
      runtimeMessage,
      manualInput,
      navigationMap
    };
  };

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
    const objective = navigationObjectives.find((candidateObjective) => candidateObjective.id === activeObjectiveId);
    if (objective && objective.targetId === plan.target.id) {
      lastEngagedObjectiveId = objective.id;
      lastEngagedObjectiveTargetId = plan.target.id;
      lastEngagedObjectivePlanHash = plan.planHash;
    }
    return plan;
  };

  interface CommandOutcome {
    readonly success: boolean;
    readonly code: BrowserRuntimeCommandCode;
    readonly rejectionCode: BrowserRuntimeRejectionCode | null;
    readonly message: string;
  }

  const accepted = (code: BrowserRuntimeCommandCode, message: string): CommandOutcome => ({ success: true, code, rejectionCode: null, message });
  const rejected = (code: BrowserRuntimeRejectionCode, message: string): CommandOutcome => ({ success: false, code, rejectionCode: code, message });

  const selectTarget = (targetId: unknown): CommandOutcome => {
    if (!executor.getTelemetry().canSelectNewTarget) {
      return rejected("PlanLocked", "Cancel the current autopilot route before selecting another target.");
    }

    if (typeof targetId !== "string") {
      return rejected("UnknownTarget", "Target selection unchanged: choose a known target.");
    }

    const target = browserTargetCatalog.find((candidateTarget) => candidateTarget.id === targetId) ?? null;
    if (!target) {
      return rejected("UnknownTarget", "Target selection unchanged: choose a known target.");
    }

    refreshCompletedObjectives();
    const activatedObjective = navigationObjectives.find((objective) =>
      objective.targetId === target.id &&
      !completedObjectiveIds.has(objective.id) &&
      isObjectiveUnlocked(objective)
    ) ?? null;
    if (activatedObjective) {
      activeObjectiveId = activatedObjective.id;
    }
    selectedTarget = target;
    const preview = refreshRoutePreview(selectedPlanner);
    const objectiveMessage = activatedObjective ? ` Activated ${activatedObjective.label}.` : "";
    return accepted("TargetSelected", `Selected ${target.label}.${objectiveMessage} ${preview.playerMessage}`);
  };

  const selectObjective = (objectiveId: unknown): CommandOutcome => {
    if (typeof objectiveId !== "string") {
      return rejected("UnknownObjective", "Objective unchanged: choose a known navigation objective.");
    }

    const objective = navigationObjectives.find((candidateObjective) => candidateObjective.id === objectiveId) ?? null;
    if (!objective) {
      return rejected("UnknownObjective", "Objective unchanged: choose a known navigation objective.");
    }

    const target = objectiveTargetFor(objective);
    if (!target) {
      return rejected("UnknownTarget", `${objective.label} is blocked: target unavailable.`);
    }

    if (!executor.getTelemetry().canSelectNewTarget) {
      return rejected("PlanLocked", "Cancel the current autopilot route before changing objective target.");
    }

    const lockedBy = firstBlockingObjectiveFor(objective);
    if (lockedBy) {
      return rejected("ObjectiveLocked", `${objective.label} locked: complete ${lockedBy.label} first.`);
    }

    activeObjectiveId = objective.id;
    selectedTarget = target;
    refreshRoutePreview(selectedPlanner);
    const previewState = routePreview?.state === "Ready" ? "Route preview ready" : "Route preview unavailable";
    return accepted("ObjectiveSelected", `${objective.label} available. ${previewState} for ${target.label}.`);
  };

  const setRouteProfile = (profile: unknown): CommandOutcome => {
    if (!executor.getTelemetry().canAcceptNewPlan) {
      return rejected("PlanLocked", "Cancel the current autopilot route before changing the speed profile.");
    }
    if (typeof profile !== "string" || !autopilotSpeedProfileIds.includes(profile as AutopilotSpeedProfileId)) {
      return rejected("UnsupportedRouteProfile", "Choose Safe, Balanced, or Fast.");
    }

    selectedRouteProfile = profile as AutopilotSpeedProfileId;
    const preview = refreshRoutePreview(selectedPlanner);
    return accepted("RouteProfileSet", `${selectedRouteProfile} route profile selected. ${preview.playerMessage}`);
  };

  const previewRoute = (): CommandOutcome => {
    if (!executor.getTelemetry().canAcceptNewPlan) {
      return rejected("PlanLocked", "Cancel the current autopilot route before previewing another route.");
    }
    const admission = lockAdmissionFor(routePreview);
    if (!executor.getTelemetry().stationKeepingActive && admission.ok) {
      return accepted("RoutePreviewReused", "The current route preview is still valid.");
    }

    const preview = refreshRoutePreview(selectedPlanner);
    return preview.plan
      ? accepted("RoutePreviewCreated", preview.playerMessage)
      : rejected("PlanningRejected", preview.playerMessage);
  };

  const replanRoute = (): CommandOutcome => {
    if (!executor.getTelemetry().canAcceptNewPlan) {
      return rejected("PlanLocked", "Cancel the current autopilot route before replanning.");
    }
    const preview = refreshRoutePreview(selectedPlanner);
    return preview.plan
      ? accepted("RouteReplanned", `Route replanned for ${preview.target?.label ?? "the selected target"}.`)
      : rejected("PlanningRejected", preview.playerMessage);
  };

  const engageRoutePreview = (expectedPlanHash: unknown): CommandOutcome => {
    if (typeof expectedPlanHash !== "string" || expectedPlanHash.length === 0) {
      return rejected("InvalidCommand", "Autopilot not engaged: the visible preview hash is required.");
    }

    const admission = lockAdmissionFor(routePreview, expectedPlanHash);
    if (!admission.ok) {
      return rejected(admission.code, admission.message);
    }

    const plan = routePreview?.plan;
    if (!plan) {
      return rejected("MissingPreview", "Create a route preview before engaging autopilot.");
    }

    lockPlan(plan);
    return accepted("RoutePreviewEngaged", `Autopilot engaged for ${plan.target.label}.`);
  };

  const engageLegacyPreview = (): CommandOutcome => {
    const visiblePlanHash = routePreview?.plan?.planHash;
    if (!visiblePlanHash) {
      const admission = lockAdmissionFor(routePreview);
      return admission.ok
        ? rejected("MissingPreview", "Create a route preview before engaging autopilot.")
        : rejected(admission.code, admission.message);
    }
    return engageRoutePreview(visiblePlanHash);
  };

  const completeCommand = (outcome: CommandOutcome): BrowserRuntimeCommandResult => {
    runtimeMessage = outcome.message;
    const telemetry = snapshot();
    return {
      ...outcome,
      telemetry,
      previewPlanHash: telemetry.routePreview?.plan?.planHash ?? null,
      lockedPlanHash: telemetry.lockedPlan?.planHash ?? null
    };
  };

  const cancelAutopilot = (): CommandOutcome => {
    const preservedPreview = routePreview;
    releaseExecutorControl();
    if (preservedPreview?.plan) {
      routePreview = {
        ...preservedPreview,
        state: "Stale",
        stale: true,
        staleReason: "Cancelled",
        playerMessage: "Autopilot canceled. The preserved route preview is stale; preview or replan before engaging again."
      };
    }
    return accepted("AutopilotCancelled", "Autopilot canceled. The previous route preview was preserved and marked stale.");
  };

  const destroyPgTragwerk = (): CommandOutcome => {
    const outcome = pgTragwerk.destroy();
    if (outcome.status === "Applied") {
      return accepted("PgTragwerkDestroyed", outcome.message);
    }
    if (outcome.status === "NoChange") {
      return rejected("PgTragwerkRejected", outcome.message);
    }
    return outcome.code === "PgSeedUnavailable"
      ? rejected("PgTragwerkUnavailable", outcome.message)
      : rejected("PgTragwerkRejected", outcome.message);
  };

  const dispatchCommand = (command: unknown): BrowserRuntimeCommandResult => {
    if (!command || typeof command !== "object") {
      return completeCommand(rejected("InvalidCommand", "Command ignored: use a supported cockpit action."));
    }

    const candidate = command as Partial<BrowserRuntimeCommand>;
    switch (candidate.type) {
      case "SelectTarget":
        return completeCommand(selectTarget(candidate.targetId));
      case "SelectObjective":
        return completeCommand(selectObjective(candidate.objectiveId));
      case "SetRouteProfile":
        return completeCommand(setRouteProfile(candidate.profile));
      case "PreviewRoute":
        return completeCommand(previewRoute());
      case "ReplanRoute":
        return completeCommand(replanRoute());
      case "EngageRoutePreview":
        return completeCommand(engageRoutePreview(candidate.expectedPlanHash));
      case "EngageAutopilot":
        return completeCommand(engageLegacyPreview());
      case "CancelAutopilot":
        return completeCommand(cancelAutopilot());
      case "SetManualFlightInput":
        updateManualInput(typeof candidate.input === "object" && candidate.input ? candidate.input : {});
        return completeCommand(accepted("ManualInputUpdated", "Manual flight input updated."));
      case "SetThrottle": {
        const requestedThrottle = clamp01(typeof candidate.throttle === "number" ? candidate.throttle : manualInput.mainThrottleCommand);
        updateManualInput({ mainThrottleCommand: requestedThrottle });
        const message = manualInput.controlMode !== "Cruise" && requestedThrottle > 0
          ? "Throttle ignored outside Cruise."
          : manualInput.mainThrottleCommand <= 0 ? "Throttle cut." : manualInput.mainThrottleCommand >= 1 ? "Throttle full." : "Throttle adjusted.";
        return completeCommand(accepted("ThrottleUpdated", message));
      }
      case "ToggleRcs":
        updateManualInput({ rcsEnabled: !manualInput.rcsEnabled });
        return completeCommand(accepted("RcsToggled", `RCS ${manualInput.rcsEnabled ? "enabled" : "disabled"}.`));
      case "ToggleSas":
        updateManualInput({ sasEnabled: !manualInput.sasEnabled });
        return completeCommand(accepted("SasToggled", `SAS ${manualInput.sasEnabled ? "enabled" : "disabled"}.`));
      case "CycleControlMode":
        updateManualInput({ controlMode: nextControlMode(manualInput.controlMode) });
        return completeCommand(accepted("ControlModeCycled", `Control mode ${manualInput.controlMode}.`));
      case "CycleCameraMode":
        updateManualInput({ cameraMode: nextCameraMode(manualInput.cameraMode) });
        return completeCommand(accepted("CameraModeCycled", `Camera mode ${manualInput.cameraMode}.`));
      case "DestroyPgTragwerk":
        return completeCommand(destroyPgTragwerk());
      default:
        return completeCommand(rejected("InvalidCommand", "Command ignored: use a supported cockpit action."));
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
    getPgTragwerk() {
      return pgTragwerk.snapshot();
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
