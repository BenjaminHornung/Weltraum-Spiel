import type { TelemetrySnapshot } from "../core";
import type { BrowserRuntimeCommand } from "../runtime/commands";

type ChipSeverity = "Critical" | "High" | "Medium" | "Low";

export interface StatusHudWarningChipViewModel {
  readonly code: string;
  readonly severity: ChipSeverity;
  readonly label: string;
  readonly action: string;
}

export interface StatusHudViewModel {
  readonly mode: string;
  readonly controlMode: string;
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

export const createStatusHudViewModel = (telemetry: TelemetrySnapshot): StatusHudViewModel => {
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

  return {
    mode: snapshot.authority.mode,
    controlMode,
    cameraMode,
    throttleState: `${Math.round(telemetry.ship.throttle * 100)}%${telemetry.ship.actuatorTelemetry.mainThrustActive ? " / main burn" : ""}`,
    velocityState: formatSpeed(telemetry.ship.velocity),
    rcsSasState: `RCS ${rcsEnabled ? "on" : "off"}, SAS ${sasEnabled ? "on" : "off"}${activeActuators.length > 0 ? ` / ${activeActuators.join(", ")}` : ""}`,
    helpHint: "Desktop keyboard/mouse manual flight: W/S pitch, A/D yaw, Q/E roll, Shift/Ctrl throttle, X cut, Y/Z full, R RCS, T SAS, CapsLock mode, H/N translate, V camera, RMB+wheel inspect. Mobile: target selection and autopilot only in this slice.",
    planState: telemetry.executor.planHash ? "Plan locked" : routePlan ? "Route preview ready" : "No active plan",
    routeState,
    target: target ? `${target.label} [${target.kind}]` : "none selected",
    distance: target && displayedDistance !== undefined ? formatMeters(displayedDistance) : "n/a",
    radarState: target && routePlan
      ? `local contact ${target.label}: ${routePlan.segments.length} route leg${routePlan.segments.length === 1 ? "" : "s"}, terminal ${formatMeters(routePlan.score.distance)}`
      : "no route contact",
    autopilotState: `${statusCatalog[telemetry.executor.status] ?? "Autopilot status unknown"}${telemetry.executor.replanRequired ? " / new plan required" : ""}`,
    fuelState: `${snapshot.fuel.status}: ${snapshot.fuel.current}/${snapshot.fuel.capacity} kg (reserve ${snapshot.fuel.reserve})`,
    authorityState: `AP ${snapshot.authority.autopilotAvailable ? "ready" : "blocked"}, main ${snapshot.authority.mainThrustersAvailable ? "ready" : "blocked"}, RCS ${snapshot.authority.rcsAvailable ? "ready" : "blocked"}, SAS ${snapshot.authority.sasAvailable ? "ready" : "blocked"}`,
    brakingState: snapshot.brakingReserve.canBrake
    ? `ready: ${snapshot.brakingReserve.availableDeltaV} m/s available`
    : "blocked: check warnings",
    warningSummary: warningChips.length > 0 ? warningChips.map((chip) => chip.label).join(", ") : "none",
    warningChips,
    runtimeMessage: telemetry.runtimeMessage ?? preview?.playerMessage ?? "ready",
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

const bindCommand = (id: string, command: BrowserRuntimeCommand, sink: StatusHudCommandSink | undefined): void => {
  const element = document.getElementById(id) as (HTMLElement & { onclick: ((event: MouseEvent) => void) | null }) | null;
  if (!element) {
    return;
  }

  element.onclick = sink ? () => void sink.dispatch(command) : null;
};

export const renderStatusHud = (telemetry: TelemetrySnapshot, commandSink?: StatusHudCommandSink): void => {
  const viewModel = createStatusHudViewModel(telemetry);
  setText("plan-hash", viewModel.planState);
  setText("mode", viewModel.mode);
  setText("control-mode", viewModel.controlMode);
  setText("camera-mode", viewModel.cameraMode);
  setText("throttle-status", viewModel.throttleState);
  setText("velocity-status", viewModel.velocityState);
  setText("rcs-sas-status", viewModel.rcsSasState);
  setText("help-hint", viewModel.helpHint);
  setText("status", viewModel.autopilotState);
  setText("route-status", viewModel.routeState);
  setText("target-status", viewModel.target);
  setText("target-distance", viewModel.distance);
  setText("radar-status", viewModel.radarState);
  setText("fuel-status", viewModel.fuelState);
  setText("authority-status", viewModel.authorityState);
  setText("brake-status", viewModel.brakingState);
  setText("failure-reasons", viewModel.warningSummary);
  setText("runtime-message", viewModel.runtimeMessage);
  renderWarningChips(viewModel);
  renderTargetOptions(viewModel, commandSink);
  bindCommand("engage-autopilot", { type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" }, commandSink);
  bindCommand("cancel-autopilot", { type: "CancelAutopilot" }, commandSink);
};
