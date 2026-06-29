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
  readonly planState: string;
  readonly routeState: string;
  readonly target: string;
  readonly distance: string;
  readonly autopilotState: string;
  readonly fuelState: string;
  readonly authorityState: string;
  readonly brakingState: string;
  readonly warningSummary: string;
  readonly warningChips: readonly StatusHudWarningChipViewModel[];
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

const fallbackWarning = { severity: "Medium" as const, label: "System warning", action: "Check ship status" };

const createWarningChips = (codes: readonly string[]): readonly StatusHudWarningChipViewModel[] =>
  unique(codes)
    .map((code) => ({ code, ...(chipCatalog[code] ?? fallbackWarning) }))
    .sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity] || left.code.localeCompare(right.code));

export const createStatusHudViewModel = (telemetry: TelemetrySnapshot): StatusHudViewModel => {
  const snapshot = telemetry.flightSnapshot;
  const target = telemetry.lockedPlan?.target;
  const warningCodes = unique([
    ...snapshot.failureReasonCodes,
    ...snapshot.fuel.reasonCodes,
    ...snapshot.authority.reasonCodes,
    ...snapshot.brakingReserve.reasonCodes
  ]);

  const warningChips = createWarningChips(warningCodes);

  return {
    mode: snapshot.authority.mode,
    planState: telemetry.executor.planHash ? `Plan active: ${telemetry.executor.status}` : "No active plan",
    routeState: `${snapshot.routeValid ? "valid" : "invalid"}${telemetry.executor.replanRequired ? " / replan required" : ""}`,
    target: target ? `${target.label} [${target.kind}]` : "none selected",
    distance: target ? formatMeters(telemetry.executor.distanceToTarget) : "n/a",
    autopilotState: telemetry.executor.replanRequired
    ? `${telemetry.executor.status} / replanRequired`
    : telemetry.executor.status,
    fuelState: `${snapshot.fuel.status}: ${snapshot.fuel.current}/${snapshot.fuel.capacity} kg (reserve ${snapshot.fuel.reserve})`,
    authorityState: `AP ${snapshot.authority.autopilotAvailable ? "ready" : "blocked"}, main ${snapshot.authority.mainThrustersAvailable ? "ready" : "blocked"}, RCS ${snapshot.authority.rcsAvailable ? "ready" : "blocked"}, SAS ${snapshot.authority.sasAvailable ? "ready" : "blocked"}`,
    brakingState: snapshot.brakingReserve.canBrake
    ? `ready: ${snapshot.brakingReserve.availableDeltaV} m/s available`
    : "blocked: check warnings",
    warningSummary: warningChips.length > 0 ? warningChips.map((chip) => chip.label).join(", ") : "none",
    warningChips
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
  setText("status", viewModel.autopilotState);
  setText("route-status", viewModel.routeState);
  setText("target-status", viewModel.target);
  setText("target-distance", viewModel.distance);
  setText("fuel-status", viewModel.fuelState);
  setText("authority-status", viewModel.authorityState);
  setText("brake-status", viewModel.brakingState);
  setText("failure-reasons", viewModel.warningSummary);
  renderWarningChips(viewModel);
  bindCommand("engage-autopilot", { type: "EngageAutopilot", planner: "ObstacleAvoidanceLocal" }, commandSink);
  bindCommand("cancel-autopilot", { type: "CancelAutopilot" }, commandSink);
};
