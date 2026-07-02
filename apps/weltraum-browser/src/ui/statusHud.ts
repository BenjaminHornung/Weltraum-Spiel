import type { TelemetrySnapshot } from "../core";
import type { BrowserRuntimeCommand } from "../runtime/commands";
import type { ShipVisualSourceSnapshot } from "../render/three/shipVisual";

type ChipSeverity = "Critical" | "High" | "Medium" | "Low";

export interface StatusHudWarningChipViewModel {
  readonly code: string;
  readonly severity: ChipSeverity;
  readonly label: string;
  readonly action: string;
}

export interface StatusHudLabelValueViewModel {
  readonly label: string;
  readonly value: string;
}

export interface FlightStatusPanelViewModel {
  readonly title: "Flight Status";
  readonly mode: StatusHudLabelValueViewModel;
  readonly controlMode: StatusHudLabelValueViewModel;
  readonly throttle: StatusHudLabelValueViewModel;
  readonly speed: StatusHudLabelValueViewModel;
  readonly rcsSas: StatusHudLabelValueViewModel;
  readonly fuel: StatusHudLabelValueViewModel;
  readonly shipVisual: StatusHudLabelValueViewModel;
}

export interface NavigationPanelViewModel {
  readonly title: "Navigation";
  readonly plan: StatusHudLabelValueViewModel;
  readonly route: StatusHudLabelValueViewModel;
  readonly target: StatusHudLabelValueViewModel;
  readonly distance: StatusHudLabelValueViewModel;
  readonly radar: StatusHudLabelValueViewModel;
  readonly targetOptions: readonly StatusHudTargetOptionViewModel[];
}

export interface WarningPanelViewModel {
  readonly title: "Warnings";
  readonly summary: string;
  readonly chips: readonly StatusHudWarningChipViewModel[];
  readonly cockpitMessage: string;
}

export interface ActionPanelViewModel {
  readonly title: "Route Action";
  readonly primaryLabel: string;
  readonly primaryCommandEnabled: boolean;
  readonly primaryDisabledReason: string | null;
  readonly secondaryLabel: string;
  readonly stateLabel: string;
}

export interface DebugPanelViewModel {
  readonly title: "Diagnostics";
  readonly cameraMode: StatusHudLabelValueViewModel;
  readonly controlModeEffect: StatusHudLabelValueViewModel;
  readonly authority: StatusHudLabelValueViewModel;
  readonly braking: StatusHudLabelValueViewModel;
  readonly help: StatusHudLabelValueViewModel;
}

export interface StatusHudViewModel {
  readonly flightStatus: FlightStatusPanelViewModel;
  readonly navigation: NavigationPanelViewModel;
  readonly warnings: WarningPanelViewModel;
  readonly actions: ActionPanelViewModel;
  readonly debug: DebugPanelViewModel;
  readonly mode: string;
  readonly controlMode: string;
  readonly controlModeEffectState: string;
  readonly cameraMode: string;
  readonly throttleState: string;
  readonly velocityState: string;
  readonly rcsSasState: string;
  readonly helpHint: string;
  readonly planState: string;
  readonly routeState: string;
  readonly target: string;
  readonly distance: string;
  readonly radarState: string;
  readonly autopilotState: string;
  readonly fuelState: string;
  readonly authorityState: string;
  readonly brakingState: string;
  readonly warningSummary: string;
  readonly warningChips: readonly StatusHudWarningChipViewModel[];
  readonly runtimeMessage: string;
  readonly visualSourceLine: string;
  readonly targetOptions: readonly StatusHudTargetOptionViewModel[];
}

export interface StatusHudTargetOptionViewModel {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly isSelected: boolean;
}

export interface StatusHudCommandSink {
  dispatch(command: BrowserRuntimeCommand): unknown;
}

const chipCatalog: Record<string, Omit<StatusHudWarningChipViewModel, "code">> = {
  FuelInsufficient: { severity: "Critical", label: "Fuel insufficient", action: "Refuel or shorten route" },
  FuelDepleted: { severity: "Critical", label: "Fuel depleted", action: "Refuel before engaging" },
  FuelReserveViolated: { severity: "Critical", label: "Fuel reserve blocked", action: "Shorten route" },
  MainThrustersUnavailable: { severity: "Critical", label: "Main thrusters offline", action: "Repair ship" },
  AutopilotUnavailable: { severity: "Critical", label: "Autopilot unavailable", action: "Use manual flight or repair" },
  AuthorityInsufficient: { severity: "Critical", label: "Authority insufficient", action: "Restore flight authority" },
  BrakeReserveInsufficient: { severity: "Critical", label: "Brake reserve missing", action: "Shorten route or reduce speed" },
  OffLockedRoute: { severity: "High", label: "Plan invalidated", action: "Create a new plan" }
};

const severityOrder: Record<ChipSeverity, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const unique = (codes: readonly string[]): readonly string[] => [...new Set(codes)];

const formatMeters = (value: number): string => (Number.isFinite(value) ? `${value.toFixed(1)} m` : "unknown");

const formatSpeed = (velocity: { readonly x: number; readonly y: number; readonly z: number }): string => {
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  return `Speed ${speed.toFixed(2)} m/s`;
};

const fallbackWarning = { severity: "Medium" as const, label: "System warning", action: "Check ship status" };

const statusCatalog: Record<string, string> = {
  Idle: "Autopilot standby",
  Executing: "Autopilot executing",
  Arrived: "Arrived at selected target",
  Diverged: "Route invalidated",
  OutOfFuel: "Autopilot blocked: fuel",
  NoAuthority: "Autopilot blocked: authority",
  BrakeReserveInsufficient: "Autopilot blocked: brake reserve"
};

const createWarningChips = (codes: readonly string[]): readonly StatusHudWarningChipViewModel[] =>
  unique(codes)
    .map((code) => ({ code, ...(chipCatalog[code] ?? fallbackWarning) }))
    .sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity] || left.code.localeCompare(right.code));

const formatVisualSourceLine = (visualSource: ShipVisualSourceSnapshot | undefined): string => {
  if (!visualSource || visualSource.state === "ProceduralFallback" || visualSource.state === "GLBFailedFallback") {
    return "Ship visual: Procedural fallback";
  }
  if (visualSource.state === "GLBLoaded") {
    return "Ship visual: Demo Scout GLB";
  }
  return "Ship visual: Loading Demo Scout GLB";
};

const createActionPanel = (telemetry: TelemetrySnapshot, warningChips: readonly StatusHudWarningChipViewModel[]): ActionPanelViewModel => {
  const hasLockedRoute = Boolean(telemetry.executor.planHash || telemetry.lockedPlan);
  const hasReadyPreview = telemetry.routePreview?.state === "Ready" && Boolean(telemetry.routePreview.plan);
  const hasCriticalWarning = warningChips.some((chip) => chip.severity === "Critical");

  if (hasLockedRoute) {
    return {
      title: "Route Action",
      primaryLabel: "Route locked",
      primaryCommandEnabled: false,
      primaryDisabledReason: "Cancel the current route before engaging another route.",
      secondaryLabel: "Cancel autopilot",
      stateLabel: telemetry.executor.status === "Arrived" ? "Holding at target" : "Cancel current route before selecting another target"
    };
  }

  if (hasCriticalWarning) {
    return {
      title: "Route Action",
      primaryLabel: "Hold route",
      primaryCommandEnabled: false,
      primaryDisabledReason: "Resolve critical ship warnings before engaging autopilot.",
      secondaryLabel: "Cancel autopilot",
      stateLabel: "Resolve warnings before engaging"
    };
  }

  if (hasReadyPreview) {
    return {
      title: "Route Action",
      primaryLabel: "Engage route",
      primaryCommandEnabled: true,
      primaryDisabledReason: null,
      secondaryLabel: "Cancel autopilot",
      stateLabel: "Ready"
    };
  }

  return {
    title: "Route Action",
    primaryLabel: "Hold route",
    primaryCommandEnabled: false,
    primaryDisabledReason: "Select a target and wait for a valid route preview before engaging autopilot.",
    secondaryLabel: "Cancel autopilot",
    stateLabel: "Select a target first"
  };
};

const mainThrustBlockedLabel = (reasons: readonly string[]): string => {
  if (reasons.includes("MainThrustModeBlocked")) {
    return "main thrust mode-blocked";
  }
  if (reasons.includes("MainThrustUnavailable")) {
    return "main thrust unavailable";
  }
  if (reasons.includes("MainThrustFuelBlocked")) {
    return "main thrust fuel-blocked";
  }
  return "main thrust blocked";
};

const rcsBlockedLabel = (reasons: readonly string[], primary: "RCS translation" | "RCS rotation"): string => {
  if (reasons.includes("RcsDisabled")) {
    return `${primary} blocked: RCS off`;
  }
  if (reasons.includes("RcsUnavailable")) {
    return `${primary} blocked: RCS unavailable`;
  }
  if (primary === "RCS translation" && reasons.includes("RcsTranslationModeBlocked")) {
    return `${primary} blocked by mode`;
  }
  if (reasons.includes(primary === "RCS translation" ? "RcsTranslationNoAuthority" : "RcsRotationNoAuthority")) {
    return `${primary} blocked: no authority`;
  }
  return `${primary} blocked`;
};

const sasBlockedLabel = (reasons: readonly string[]): string => {
  if (reasons.includes("SasDisabled")) {
    return "SAS off";
  }
  if (reasons.includes("SasUnavailable")) {
    return "SAS unavailable";
  }
  if (reasons.includes("SasNoRcsAuthority") || reasons.includes("RcsDisabled") || reasons.includes("RcsUnavailable") || reasons.includes("RcsRotationNoAuthority")) {
    return "SAS blocked: no RCS authority";
  }
  return "SAS blocked";
};

const formatControlModeEffectState = (telemetry: TelemetrySnapshot): string => {
  const actuatorTelemetry = telemetry.ship.actuatorTelemetry;
  const effect = actuatorTelemetry.controlModeEffect;
  const reasons = effect.blockedReasonCodes;
  const mainState = effect.mainThrustAllowed
    ? `main thrust ${actuatorTelemetry.mainThrustActive ? "active" : "ready"}`
    : mainThrustBlockedLabel(reasons);
  const translationState = effect.rcsTranslationAllowed
    ? `RCS translation ${actuatorTelemetry.rcsTranslationActive ? "active" : "ready"}`
    : rcsBlockedLabel(reasons, "RCS translation");
  const rotationState = effect.rcsRotationAllowed
    ? `RCS rotation ${actuatorTelemetry.rcsRotationActive ? "active" : "ready"}`
    : rcsBlockedLabel(reasons, "RCS rotation");
  const sasState = effect.sasAllowed
    ? `SAS ${actuatorTelemetry.sasCorrectionActive ? "active" : "ready"}`
    : sasBlockedLabel(reasons);

  return `${effect.modeEffectLabel}; ${mainState}; ${translationState}; ${rotationState}; ${sasState}`;
};

export const createStatusHudViewModel = (telemetry: TelemetrySnapshot, visualSource?: ShipVisualSourceSnapshot): StatusHudViewModel => {
  const snapshot = telemetry.flightSnapshot;
  const selectedTarget = telemetry.selectedTarget ?? telemetry.lockedPlan?.target ?? telemetry.routePreview?.target ?? null;
  const preview = telemetry.routePreview;
  const target = telemetry.lockedPlan?.target ?? selectedTarget;
  const warningCodes = unique([
    ...snapshot.failureReasonCodes,
    ...snapshot.fuel.reasonCodes,
    ...snapshot.authority.reasonCodes,
    ...snapshot.brakingReserve.reasonCodes
  ]);

  const warningChips = createWarningChips(warningCodes);
  const routePlan = telemetry.lockedPlan ?? preview?.plan ?? null;
  const previewDistance = preview?.plan?.score.distance;
  const displayedDistance = telemetry.lockedPlan ? telemetry.executor.distanceToTarget : previewDistance;
  const routeState = telemetry.lockedPlan
    ? `${snapshot.routeValid ? "locked route valid" : "locked route invalid"}${telemetry.executor.replanRequired ? " / new plan required" : ""}`
    : telemetry.executor.stationKeepingActive && telemetry.executor.completedPlanHash
      ? "holding at target; new route ready"
    : preview?.state === "Ready" && preview.plan
      ? `preview ready: ${preview.plan.segments.length} leg${preview.plan.segments.length === 1 ? "" : "s"}`
      : (preview?.playerMessage ?? "select a target to preview a route");
  const targetOptions = (telemetry.selectableTargets ?? []).map((candidateTarget) => ({
    id: candidateTarget.id,
    label: candidateTarget.label,
    kind: candidateTarget.kind,
    isSelected: candidateTarget.id === selectedTarget?.id
  }));
  const manualInput = telemetry.manualInput;
  const cameraMode = manualInput?.cameraMode ?? "ChaseLocked";
  const controlMode = telemetry.ship.controlMode;
  const rcsEnabled = telemetry.ship.rcsEnabled;
  const sasEnabled = telemetry.ship.sasEnabled;
  const activeActuators = [
    telemetry.ship.actuatorTelemetry.mainThrustActive ? "main burn" : null,
    telemetry.ship.actuatorTelemetry.rcsTranslationActive ? "RCS translate" : null,
    telemetry.ship.actuatorTelemetry.rcsRotationActive ? "RCS rotate" : null,
    telemetry.ship.actuatorTelemetry.sasCorrectionActive ? "SAS correction" : null
  ].filter((item): item is string => Boolean(item));

  const planState = telemetry.executor.planHash
    ? "Plan locked"
    : telemetry.executor.completedPlanHash
      ? "Plan completed"
      : routePlan
        ? "Route preview ready"
        : "No active plan";
  const targetState = target ? `${target.label} [${target.kind}]` : "none selected";
  const distanceState = target && displayedDistance !== undefined ? formatMeters(displayedDistance) : "n/a";
  const radarState = target && routePlan
    ? `local contact ${target.label}: ${routePlan.segments.length} route leg${routePlan.segments.length === 1 ? "" : "s"}, terminal ${formatMeters(routePlan.score.distance)}`
    : "no route contact";
  const autopilotState = `${statusCatalog[telemetry.executor.status] ?? "Autopilot status unknown"}${telemetry.executor.replanRequired ? " / new plan required" : ""}`;
  const fuelState = `${snapshot.fuel.status}: ${snapshot.fuel.current}/${snapshot.fuel.capacity} kg (reserve ${snapshot.fuel.reserve})`;
  const authorityState = `AP ${snapshot.authority.autopilotAvailable ? "ready" : "blocked"}, main ${snapshot.authority.mainThrustersAvailable ? "ready" : "blocked"}, RCS ${snapshot.authority.rcsAvailable ? "ready" : "blocked"}, SAS ${snapshot.authority.sasAvailable ? "ready" : "blocked"}`;
  const brakingState = snapshot.brakingReserve.canBrake
    ? `ready: ${snapshot.brakingReserve.availableDeltaV} m/s available`
    : "blocked: check warnings";
  const warningSummary = warningChips.length > 0 ? warningChips.map((chip) => chip.label).join(", ") : "none";
  const runtimeMessage = telemetry.runtimeMessage ?? preview?.playerMessage ?? "ready";
  const visualSourceLine = formatVisualSourceLine(visualSource);
  const throttleState = `${Math.round(telemetry.ship.throttle * 100)}%${telemetry.ship.actuatorTelemetry.mainThrustActive ? " / main burn" : ""}`;
  const velocityState = formatSpeed(telemetry.ship.velocity);
  const rcsSasState = `RCS ${rcsEnabled ? "on" : "off"}, SAS ${sasEnabled ? "on" : "off"}${activeActuators.length > 0 ? ` / ${activeActuators.join(", ")}` : ""}`;
  const helpHint = "Desktop keyboard/mouse manual flight: W/S pitch, A/D yaw, Q/E roll, Shift/Ctrl throttle, X cut, Y/Z full, R RCS, T SAS, CapsLock mode, H/N translate, V camera, RMB+wheel inspect. Mobile: target selection and autopilot only in this slice.";
  const controlModeEffectState = formatControlModeEffectState(telemetry);
  const actionPanel = createActionPanel(telemetry, warningChips);
  const flightStatus: FlightStatusPanelViewModel = {
    title: "Flight Status",
    mode: { label: "Mode", value: snapshot.authority.mode },
    controlMode: { label: "Control Mode", value: controlMode },
    throttle: { label: "Throttle", value: throttleState },
    speed: { label: "Speed", value: velocityState },
    rcsSas: { label: "RCS / SAS", value: rcsSasState },
    fuel: { label: "Fuel", value: fuelState },
    shipVisual: { label: "Ship Visual", value: visualSourceLine }
  };
  const navigation: NavigationPanelViewModel = {
    title: "Navigation",
    plan: { label: "Plan", value: planState },
    route: { label: "Route", value: routeState },
    target: { label: "Target", value: targetState },
    distance: { label: "Distance", value: distanceState },
    radar: { label: "Radar", value: radarState },
    targetOptions
  };
  const warnings: WarningPanelViewModel = {
    title: "Warnings",
    summary: warningSummary,
    chips: warningChips,
    cockpitMessage: runtimeMessage
  };
  const debug: DebugPanelViewModel = {
    title: "Diagnostics",
    cameraMode: { label: "Camera", value: cameraMode },
    controlModeEffect: { label: "Control Effect", value: controlModeEffectState },
    authority: { label: "Authority", value: authorityState },
    braking: { label: "Brake Reserve", value: brakingState },
    help: { label: "Help", value: helpHint }
  };

  return {
    flightStatus,
    navigation,
    warnings,
    actions: actionPanel,
    debug,
    mode: snapshot.authority.mode,
    controlMode,
    controlModeEffectState,
    cameraMode,
    throttleState,
    velocityState,
    rcsSasState,
    helpHint,
    planState,
    routeState,
    target: targetState,
    distance: distanceState,
    radarState,
    autopilotState,
    fuelState,
    authorityState,
    brakingState,
    warningSummary,
    warningChips,
    runtimeMessage,
    visualSourceLine,
    targetOptions
  };
};

const setText = (id: string, value: string): void => {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
};

const renderWarningChips = (viewModel: StatusHudViewModel): void => {
  const element = document.getElementById("warning-chips");
  if (!element) {
    return;
  }

  if (viewModel.warningChips.length === 0) {
    element.textContent = "none";
    return;
  }

  if (typeof document.createElement === "function" && "replaceChildren" in element) {
    const chips = viewModel.warningChips.map((chip) => {
      const chipElement = document.createElement("span");
      chipElement.className = `warning-chip warning-chip--${chip.severity.toLowerCase()}`;
      chipElement.dataset.severity = chip.severity;
      chipElement.textContent = `${chip.label}: ${chip.action}`;
      return chipElement;
    });
    element.replaceChildren(...chips);
    return;
  }

  element.textContent = viewModel.warningChips.map((chip) => `${chip.label}: ${chip.action}`).join(" | ");
};

const renderTargetOptions = (viewModel: StatusHudViewModel, sink: StatusHudCommandSink | undefined): void => {
  const element = document.getElementById("target-options");
  if (!element) {
    return;
  }

  if (viewModel.targetOptions.length === 0) {
    element.textContent = "no targets available";
    return;
  }

  const renderKey = viewModel.targetOptions.map((target) => `${target.id}:${target.isSelected}`).join("|");
  const container = element as HTMLElement;
  if (container.dataset?.renderKey === renderKey) {
    return;
  }
  if (container.dataset) {
    container.dataset.renderKey = renderKey;
  }

  if (typeof document.createElement !== "function" || !("replaceChildren" in element)) {
    element.textContent = viewModel.targetOptions.map((target) => `${target.label}${target.isSelected ? " (selected)" : ""}`).join(" | ");
    return;
  }

  const buttons = viewModel.targetOptions.map((target) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = target.isSelected ? "target-option target-option--selected" : "target-option";
    button.dataset.targetId = target.id;
    button.setAttribute("aria-pressed", String(target.isSelected));
    button.textContent = `${target.label} (${target.kind})`;
    button.onclick = sink ? () => void sink.dispatch({ type: "SelectTarget", targetId: target.id }) : null;
    return button;
  });

  element.replaceChildren(...buttons);
};

const bindCommand = (
  id: string,
  command: BrowserRuntimeCommand,
  sink: StatusHudCommandSink | undefined,
  options: { readonly enabled?: boolean; readonly disabledReason?: string | null } = {}
): void => {
  const element = document.getElementById(id) as (HTMLElement & {
    disabled?: boolean;
    onclick: ((event: MouseEvent) => void) | null;
    title?: string;
  }) | null;
  if (!element) {
    return;
  }

  const isCommandEnabled = options.enabled ?? true;
  if ("disabled" in element) {
    element.disabled = !isCommandEnabled;
  }
  element.setAttribute("aria-disabled", String(!isCommandEnabled));
  if (!isCommandEnabled) {
    if (options.disabledReason) {
      element.setAttribute("title", options.disabledReason);
      element.title = options.disabledReason;
    } else {
      element.removeAttribute("title");
      element.title = "";
    }
    element.onclick = null;
    return;
  }

  element.removeAttribute("title");
  element.title = "";
  element.onclick = sink ? () => void sink.dispatch(command) : null;
};

export const renderStatusHud = (telemetry: TelemetrySnapshot, commandSink?: StatusHudCommandSink, visualSource?: ShipVisualSourceSnapshot): void => {
  const viewModel = createStatusHudViewModel(telemetry, visualSource);
  setText("plan-hash", viewModel.navigation.plan.value);
  setText("mode", viewModel.flightStatus.mode.value);
  setText("control-mode", viewModel.flightStatus.controlMode.value);
  setText("control-mode-effect", viewModel.debug.controlModeEffect.value);
  setText("camera-mode", viewModel.debug.cameraMode.value);
  setText("throttle-status", viewModel.flightStatus.throttle.value);
  setText("velocity-status", viewModel.flightStatus.speed.value);
  setText("rcs-sas-status", viewModel.flightStatus.rcsSas.value);
  setText("help-hint", viewModel.debug.help.value);
  setText("status", viewModel.autopilotState);
  setText("route-status", viewModel.navigation.route.value);
  setText("target-status", viewModel.navigation.target.value);
  setText("target-distance", viewModel.navigation.distance.value);
  setText("radar-status", viewModel.navigation.radar.value);
  setText("fuel-status", viewModel.flightStatus.fuel.value);
  setText("authority-status", viewModel.debug.authority.value);
  setText("brake-status", viewModel.debug.braking.value);
  setText("failure-reasons", viewModel.warnings.summary);
  setText("runtime-message", viewModel.warnings.cockpitMessage);
  setText("ship-visual-source", viewModel.flightStatus.shipVisual.value);
  setText("autopilot-action-state", viewModel.actions.stateLabel);
  renderWarningChips(viewModel);
  renderTargetOptions(viewModel, commandSink);
  setText("engage-autopilot", viewModel.actions.primaryLabel);
  setText("cancel-autopilot", viewModel.actions.secondaryLabel);
  bindCommand("engage-autopilot", { type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" }, commandSink, {
    enabled: viewModel.actions.primaryCommandEnabled,
    disabledReason: viewModel.actions.primaryDisabledReason
  });
  bindCommand("cancel-autopilot", { type: "CancelAutopilot" }, commandSink);
};
