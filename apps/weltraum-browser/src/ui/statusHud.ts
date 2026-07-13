import type { AutopilotSpeedProfileId, PreviewLockRejectionCode, RoutePlan, RouteSegment, TelemetrySnapshot, Vec3 } from "../core";
import { createNavigationMapSnapshot, navigationMapRouteSnapshot } from "../navigation/map";
import type { BrowserRuntimeCommand, BrowserRuntimeCommandResult } from "../runtime/commands";
import type { ShipVisualSourceSnapshot } from "../render/three/shipVisual";
import type { NavigationObjectiveStatus } from "../sim/telemetry";
import { renderPlannerMap } from "./plannerMap";

type ChipSeverity = "Critical" | "High" | "Medium" | "Low";
export type StatusHudTone = "manual" | "ready" | "active" | "holding" | "blocked";
export type StatusHudMeterTone = "idle" | "ready" | "active" | "caution" | "blocked";

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
  readonly throttleMeter: StatusHudMeterViewModel;
  readonly speed: StatusHudLabelValueViewModel;
  readonly rcsSas: StatusHudLabelValueViewModel;
  readonly fuel: StatusHudLabelValueViewModel;
  readonly fuelMeter: StatusHudMeterViewModel;
  readonly shipVisual: StatusHudLabelValueViewModel;
}

export interface StatusHudMeterViewModel {
  readonly percent: number;
  readonly tone: StatusHudMeterTone;
}

export interface NavigationPanelViewModel {
  readonly title: "Navigation";
  readonly objective: StatusHudObjectiveViewModel;
  readonly plan: StatusHudLabelValueViewModel;
  readonly route: StatusHudLabelValueViewModel;
  readonly routeTone: StatusHudTone;
  readonly target: StatusHudLabelValueViewModel;
  readonly targetKind: StatusHudLabelValueViewModel;
  readonly distance: StatusHudLabelValueViewModel;
  readonly radar: StatusHudLabelValueViewModel;
  readonly radarRange: StatusHudLabelValueViewModel;
  readonly targetOptions: readonly StatusHudTargetOptionViewModel[];
}

export interface StatusHudObjectiveViewModel {
  readonly label: string;
  readonly target: string;
  readonly distance: string;
  readonly status: string;
  readonly statusTone: StatusHudTone;
  readonly hint: string;
  readonly nextAction: string;
  readonly options: readonly StatusHudObjectiveOptionViewModel[];
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
  readonly stateTone: StatusHudTone;
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
  readonly throttleMeter: StatusHudMeterViewModel;
  readonly fuelMeter: StatusHudMeterViewModel;
  readonly routeTone: StatusHudTone;
  readonly actionTone: StatusHudTone;
  readonly authorityState: string;
  readonly brakingState: string;
  readonly warningSummary: string;
  readonly warningChips: readonly StatusHudWarningChipViewModel[];
  readonly runtimeMessage: string;
  readonly visualSourceLine: string;
  readonly targetOptions: readonly StatusHudTargetOptionViewModel[];
  readonly objective: StatusHudObjectiveViewModel;
}

export interface CombatRuntimeViewModel {
  readonly speed: string;
  readonly throttle: string;
  readonly fuel: string;
  readonly targetLabel: string;
  readonly targetKind: string;
  readonly targetDistance: string;
  readonly autopilot: string;
  readonly controlMode: string;
  readonly controlAssist: string;
  readonly authority: string;
  readonly braking: string;
  readonly warnings: string;
  readonly radar: string;
}

export interface StatusHudTargetOptionViewModel {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly rangeLabel: string;
  readonly displayLabel: string;
  readonly ariaLabel: string;
  readonly isSelected: boolean;
}

export interface StatusHudObjectiveOptionViewModel {
  readonly id: string;
  readonly label: string;
  readonly targetId: string;
  readonly status: NavigationObjectiveStatus;
  readonly displayLabel: string;
  readonly ariaLabel: string;
  readonly isActive: boolean;
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

const formatDistance = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "unknown";
  }
  return Math.abs(value) >= 995 ? `${(value / 1000).toFixed(1)} km` : `${value.toFixed(1)} m`;
};

const formatRangeHint = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "range unknown";
  }
  return Math.abs(value) >= 995 ? `~${(value / 1000).toFixed(1)} km` : `~${Math.round(value)} m`;
};

const radarRangeForMeters = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "auto range unknown";
  }
  const distance = Math.abs(value);
  if (distance <= 250) {
    return "250 m";
  }
  if (distance <= 1000) {
    return "1.0 km";
  }
  if (distance <= 2500) {
    return "2.5 km";
  }
  return "5.0 km";
};

const distanceBetween = (left: Vec3, right: Vec3): number =>
  Math.hypot(right.x - left.x, right.y - left.y, right.z - left.z);

const segmentDistance = (segment: RouteSegment): number => distanceBetween(segment.start, segment.end);

const formatDuration = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }

  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3_600);
  const minutes = Math.floor((rounded % 3_600) / 60);
  const remainingSeconds = rounded % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

const etaForPlan = (plan: RoutePlan | null): number | null => {
  if (!plan) {
    return null;
  }

  let total = 0;
  for (const segment of plan.segments) {
    const distance = segmentDistance(segment);
    if (distance <= 0.000001) {
      continue;
    }
    if (!Number.isFinite(segment.desiredSpeed) || segment.desiredSpeed <= 0) {
      return null;
    }
    total += distance / segment.desiredSpeed;
  }
  return total;
};

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

export const calculateRouteProgressPercent = (telemetry: TelemetrySnapshot): number | null => {
  const lockedPlan = telemetry.lockedPlan;
  const previewPlan = evaluateRoutePreviewPresentation(telemetry).displayPlan;
  const plan = lockedPlan ?? previewPlan;
  if (!plan) {
    return null;
  }
  if (!lockedPlan) {
    return 0;
  }
  if (telemetry.executor.status === "Arrived" || telemetry.executor.routeLifecycle === "Completed" || telemetry.executor.routeLifecycle === "Holding") {
    return 100;
  }

  const segments = plan.segments.filter((segment) => segmentDistance(segment) > 0.000001);
  const routeDistance = segments.reduce((total, segment) => total + segmentDistance(segment), 0);
  if (routeDistance <= 0.000001) {
    return 0;
  }

  const activeIndex = segments.findIndex((segment) => segment.id === telemetry.executor.activeSegmentId);
  if (activeIndex < 0) {
    return 0;
  }

  const completedDistance = segments
    .slice(0, activeIndex)
    .reduce((total, segment) => total + segmentDistance(segment), 0);
  const activeSegment = segments[activeIndex];
  const segmentVector = {
    x: activeSegment.end.x - activeSegment.start.x,
    y: activeSegment.end.y - activeSegment.start.y,
    z: activeSegment.end.z - activeSegment.start.z
  };
  const shipVector = {
    x: telemetry.ship.position.x - activeSegment.start.x,
    y: telemetry.ship.position.y - activeSegment.start.y,
    z: telemetry.ship.position.z - activeSegment.start.z
  };
  const lengthSquared = segmentVector.x ** 2 + segmentVector.y ** 2 + segmentVector.z ** 2;
  const projection = lengthSquared > 0
    ? clampUnit((shipVector.x * segmentVector.x + shipVector.y * segmentVector.y + shipVector.z * segmentVector.z) / lengthSquared)
    : 0;
  const travelledDistance = completedDistance + projection * Math.sqrt(lengthSquared);
  return Math.max(0, Math.min(100, (travelledDistance / routeDistance) * 100));
};

export interface PlannerTimelineRowViewModel {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly detail: string;
  readonly time: string;
  readonly isActive: boolean;
  readonly isComplete: boolean;
  readonly isExecutorPhase: boolean;
}

export const createPlannerTimelineRows = (telemetry: TelemetrySnapshot, plan: RoutePlan | null): readonly PlannerTimelineRowViewModel[] => {
  const activeSegmentIndex = plan?.segments.findIndex((segment) => segment.id === telemetry.executor.activeSegmentId) ?? -1;
  const routeComplete = telemetry.executor.status === "Arrived" || telemetry.executor.routeLifecycle === "Completed" || telemetry.executor.routeLifecycle === "Holding";
  const rows: PlannerTimelineRowViewModel[] = [];
  for (const [index, segment] of (plan?.segments ?? []).entries()) {
    const distance = segmentDistance(segment);
    if (distance <= 0.000001) {
      continue;
    }
    rows.push({
      id: segment.id,
      kind: segment.kind,
      label: segment.kind.toUpperCase(),
      detail: `${formatDistance(distance)} at ${segment.desiredSpeed.toFixed(1)} m/s`,
      time: formatDuration(segment.desiredSpeed > 0 ? distance / segment.desiredSpeed : null),
      isActive: activeSegmentIndex === index,
      isComplete: routeComplete || (activeSegmentIndex > index && Boolean(telemetry.lockedPlan)),
      isExecutorPhase: false
    });
  }

  const arrivalPhase = telemetry.executor.arrivalPhase;
  if (arrivalPhase && arrivalPhase !== "None") {
    rows.push({
      id: `executor-${arrivalPhase}`,
      kind: "Phase",
      label: arrivalPhase.replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase(),
      detail: telemetry.executor.routeLifecycle ?? "Executor phase",
      time: "--:--",
      isActive: Boolean(telemetry.executor.terminalCaptureActive || telemetry.executor.terminalHoldingActive),
      isComplete: false,
      isExecutorPhase: true
    });
  }
  return rows;
};

const clampPercent = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

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

const objectiveStatusCatalog: Record<NavigationObjectiveStatus, string> = {
  inactive: "Inactive",
  locked: "Locked",
  available: "Available",
  "route-ready": "Route ready",
  enroute: "Enroute",
  complete: "Complete",
  blocked: "Blocked"
};

const objectiveToneCatalog: Record<NavigationObjectiveStatus, StatusHudTone> = {
  inactive: "manual",
  locked: "manual",
  available: "manual",
  "route-ready": "ready",
  enroute: "active",
  complete: "holding",
  blocked: "blocked"
};

const formatObjectiveOptionLabel = (option: {
  readonly label: string;
  readonly status: NavigationObjectiveStatus;
  readonly isActive: boolean;
}): string => {
  const statusLabel = objectiveStatusCatalog[option.status].toLowerCase();
  return `${option.label} (${statusLabel})`;
};

const createWarningChips = (codes: readonly string[]): readonly StatusHudWarningChipViewModel[] =>
  unique(codes)
    .map((code) => ({ code, ...(chipCatalog[code] ?? fallbackWarning) }))
    .sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity] || left.code.localeCompare(right.code));

const createThrottleMeter = (telemetry: TelemetrySnapshot): StatusHudMeterViewModel => {
  const percent = clampPercent(telemetry.ship.throttle * 100);
  const tone: StatusHudMeterTone = telemetry.ship.actuatorTelemetry.mainThrustActive ? "active" : percent > 0 ? "ready" : "idle";
  return { percent, tone };
};

const createFuelMeter = (telemetry: TelemetrySnapshot): StatusHudMeterViewModel => {
  const fuel = telemetry.flightSnapshot.fuel;
  const percent = fuel.capacity > 0 ? clampPercent((fuel.current / fuel.capacity) * 100) : 0;
  const tone: StatusHudMeterTone = fuel.status === "Blocked" ? "blocked" : fuel.current <= fuel.reserve || percent <= 25 ? "caution" : "ready";
  return { percent, tone };
};

const createObjectiveViewModel = (telemetry: TelemetrySnapshot): StatusHudObjectiveViewModel => {
  const objective = telemetry.navigationObjective;
  if (!objective) {
    return {
      label: "No navigation objective",
      target: "none",
      distance: "n/a",
      status: "Inactive",
      statusTone: "manual",
      hint: "Choose a large-field objective to begin.",
      nextAction: "choose objective",
      options: []
    };
  }

  return {
    label: objective.label,
    target: objective.targetLabel,
    distance: objective.distanceMeters === null ? "n/a" : formatDistance(objective.distanceMeters),
    status: objectiveStatusCatalog[objective.status],
    statusTone: objectiveToneCatalog[objective.status],
    hint: objective.hint,
    nextAction: objective.nextAction,
    options: objective.options.map((option) => ({
      id: option.id,
      label: option.label,
      targetId: option.targetId,
      status: option.status,
      displayLabel: formatObjectiveOptionLabel(option),
      ariaLabel: `${option.label}, ${objectiveStatusCatalog[option.status]}`,
      isActive: option.isActive
    }))
  };
};

type RoutePreviewPresentation =
  | { readonly state: "None"; readonly displayPlan: null; readonly admittedPlan: null; readonly message: string; readonly runtimeMessage: string }
  | { readonly state: "Locked"; readonly displayPlan: null; readonly admittedPlan: null; readonly message: string; readonly runtimeMessage: string }
  | { readonly state: "Rejected"; readonly displayPlan: RoutePlan | null; readonly admittedPlan: null; readonly message: string; readonly runtimeMessage: string }
  | { readonly state: "Admitted"; readonly displayPlan: RoutePlan; readonly admittedPlan: RoutePlan; readonly message: string; readonly runtimeMessage: string };

const rejectedRoutePreviewPresentation = (message: string, displayPlan: RoutePlan | null = null): RoutePreviewPresentation => ({
  state: "Rejected",
  displayPlan,
  admittedPlan: null,
  message,
  runtimeMessage: message
});

const rejectedLockAdmissionMessage = (code: PreviewLockRejectionCode): string => {
  switch (code) {
    case "MissingPreview":
      return "Create a route preview before engaging autopilot.";
    case "ExpectedPlanHashMismatch":
      return "The visible route changed. Review the current preview before engaging.";
    case "PlanAlreadyLocked":
      return "Cancel the current autopilot route before engaging another plan.";
    case "PreviewStale":
      return "The route preview is stale. Preview or replan before engaging.";
    case "RouteValidationRejected":
      return "The exact preview route no longer passes route validation.";
    case "VelocityMismatch":
      return "Ship velocity changed. Replan before engaging.";
    case "FlightAdmissionRejected":
      return "Current fuel, braking reserve, or flight authority cannot safely engage this route.";
    default:
      return "The route preview was rejected for engagement. Replan before engaging.";
  }
};

const displayableCurrentStateRejectionCodes: ReadonlySet<PreviewLockRejectionCode> = new Set([
  "VelocityMismatch",
  "FlightAdmissionRejected"
]);

const evaluateRoutePreviewPresentation = (telemetry: TelemetrySnapshot): RoutePreviewPresentation => {
  const preview = telemetry.routePreview;
  if (telemetry.lockedPlan || telemetry.executor.planHash) {
    const message = "A route is already locked.";
    return {
      state: "Locked",
      displayPlan: null,
      admittedPlan: null,
      message,
      runtimeMessage: telemetry.runtimeMessage && telemetry.runtimeMessage !== preview?.playerMessage
        ? telemetry.runtimeMessage
        : message
    };
  }
  if (!preview) {
    const message = telemetry.selectedTarget
      ? "Create a route preview before engaging autopilot."
      : "Select a target to preview a route.";
    return {
      state: "None",
      displayPlan: null,
      admittedPlan: null,
      message,
      runtimeMessage: telemetry.runtimeMessage ?? "ready"
    };
  }
  if (preview.state === "Stale" || preview.stale) {
    return rejectedRoutePreviewPresentation("The route preview is stale. Preview or replan before engaging.");
  }
  if (preview.state !== "Ready") {
    return rejectedRoutePreviewPresentation("No valid route preview is available.");
  }

  const plan = preview.plan;
  if (!plan) {
    return rejectedRoutePreviewPresentation("Create a route preview before engaging autopilot.");
  }
  if (preview.validation?.ok !== true || preview.rejectedReasonCodes.length > 0) {
    return rejectedRoutePreviewPresentation("The exact preview route no longer passes route validation.");
  }

  const admission = preview.lockAdmission;
  if (!admission) {
    return rejectedRoutePreviewPresentation("The route preview has no lock admission. Replan before engaging.");
  }
  if (!admission.ok) {
    const message = rejectedLockAdmissionMessage(admission.code);
    if (!displayableCurrentStateRejectionCodes.has(admission.code)) {
      return rejectedRoutePreviewPresentation(message);
    }
    if (admission.planHash !== plan.planHash) {
      return rejectedRoutePreviewPresentation("The visible route changed. Review the current preview before engaging.");
    }
    if (plan.planHash === telemetry.executor.completedPlanHash) {
      return rejectedRoutePreviewPresentation("Select or replan a new route before engaging.");
    }
    return rejectedRoutePreviewPresentation(message, plan);
  }
  if (admission.planHash !== plan.planHash) {
    return rejectedRoutePreviewPresentation("The visible route changed. Review the current preview before engaging.");
  }
  if (plan.planHash === telemetry.executor.completedPlanHash) {
    return rejectedRoutePreviewPresentation("Select or replan a new route before engaging.");
  }

  return {
    state: "Admitted",
    displayPlan: plan,
    admittedPlan: plan,
    message: preview.playerMessage,
    runtimeMessage: telemetry.runtimeMessage ?? preview.playerMessage
  };
};

const admittedNewRoutePreviewPlan = (telemetry: TelemetrySnapshot): RoutePlan | null =>
  evaluateRoutePreviewPresentation(telemetry).admittedPlan;

const createRouteTone = (telemetry: TelemetrySnapshot, warningChips: readonly StatusHudWarningChipViewModel[]): StatusHudTone => {
  if (warningChips.some((chip) => chip.severity === "Critical") || telemetry.executor.replanRequired || telemetry.executor.status === "Diverged") {
    return "blocked";
  }
  if (telemetry.executor.status === "Executing" || Boolean(telemetry.executor.planHash || telemetry.lockedPlan)) {
    return "active";
  }
  if (admittedNewRoutePreviewPlan(telemetry)) {
    return "ready";
  }
  const previewPresentation = evaluateRoutePreviewPresentation(telemetry);
  if (previewPresentation.state === "Rejected" && previewPresentation.displayPlan) {
    return "blocked";
  }
  if (telemetry.executor.status === "Arrived" || telemetry.executor.stationKeepingActive) {
    return "holding";
  }
  return "manual";
};

const formatVisualSourceLine = (visualSource: ShipVisualSourceSnapshot | undefined): string => {
  if (!visualSource || visualSource.state === "ProceduralFallback" || visualSource.state === "GLBFailedFallback") {
    return "Ship visual: Procedural fallback";
  }
  if (visualSource.state === "GLBLoaded") {
    return "Ship visual: Demo Scout GLB";
  }
  return "Ship visual: Loading Demo Scout GLB";
};

const createActionPanel = (telemetry: TelemetrySnapshot, warningChips: readonly StatusHudWarningChipViewModel[], routeTone: StatusHudTone): ActionPanelViewModel => {
  const previewPresentation = evaluateRoutePreviewPresentation(telemetry);
  const hasLockedRoute = Boolean(telemetry.executor.planHash || telemetry.lockedPlan);
  const hasReadyPreview = previewPresentation.state === "Admitted";
  const hasCriticalWarning = warningChips.some((chip) => chip.severity === "Critical");
  const nextObjectiveAvailable =
    telemetry.navigationObjective?.status === "complete" &&
    telemetry.navigationObjective.nextAction === "next objective available";

  if (hasLockedRoute) {
    return {
      title: "Route Action",
      primaryLabel: "Route locked",
      primaryCommandEnabled: false,
      primaryDisabledReason: "Cancel the current route before engaging another route.",
      secondaryLabel: "Cancel",
      stateLabel: telemetry.executor.status === "Arrived" ? "Holding at target" : "Cancel current route before selecting another target",
      stateTone: routeTone
    };
  }

  if (hasCriticalWarning) {
    return {
      title: "Route Action",
      primaryLabel: "Hold route",
      primaryCommandEnabled: false,
      primaryDisabledReason: "Resolve critical ship warnings before engaging autopilot.",
      secondaryLabel: "Cancel",
      stateLabel: "Resolve warnings before engaging",
      stateTone: "blocked"
    };
  }

  if (nextObjectiveAvailable) {
    return {
      title: "Route Action",
      primaryLabel: "Hold route",
      primaryCommandEnabled: false,
      primaryDisabledReason: "Select the next available objective before engaging another route.",
      secondaryLabel: "Cancel",
      stateLabel: "Next objective available",
      stateTone: "holding"
    };
  }

  if (routeTone === "holding" && !hasReadyPreview) {
    return {
      title: "Route Action",
      primaryLabel: "Hold route",
      primaryCommandEnabled: false,
      primaryDisabledReason: "Select a new target and wait for a route preview before engaging another route.",
      secondaryLabel: "Cancel",
      stateLabel: "Holding at target; select a new route",
      stateTone: "holding"
    };
  }

  if (hasReadyPreview) {
    return {
      title: "Route Action",
      primaryLabel: "Engage route",
      primaryCommandEnabled: true,
      primaryDisabledReason: null,
      secondaryLabel: "Cancel",
      stateLabel: "Ready",
      stateTone: "ready"
    };
  }

  if (previewPresentation.state === "Rejected") {
    return {
      title: "Route Action",
      primaryLabel: "Hold route",
      primaryCommandEnabled: false,
      primaryDisabledReason: previewPresentation.message,
      secondaryLabel: "Cancel",
      stateLabel: previewPresentation.message,
      stateTone: routeTone
    };
  }

  return {
    title: "Route Action",
    primaryLabel: "Hold route",
    primaryCommandEnabled: false,
    primaryDisabledReason: "Select a target and wait for a valid route preview before engaging autopilot.",
    secondaryLabel: "Cancel",
    stateLabel: "Select a target first",
    stateTone: "manual"
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
  const selectedTarget = telemetry.selectedTarget ?? telemetry.lockedPlan?.target ?? null;
  const target = telemetry.lockedPlan?.target ?? selectedTarget;
  const warningCodes = unique([
    ...snapshot.failureReasonCodes,
    ...snapshot.fuel.reasonCodes,
    ...snapshot.authority.reasonCodes,
    ...snapshot.brakingReserve.reasonCodes
  ]);

  const warningChips = createWarningChips(warningCodes);
  const routeTone = createRouteTone(telemetry, warningChips);
  const previewPresentation = evaluateRoutePreviewPresentation(telemetry);
  const displayPreviewPlan = previewPresentation.displayPlan;
  const admittedPreviewPlan = previewPresentation.admittedPlan;
  const routePlan = telemetry.lockedPlan ?? displayPreviewPlan;
  const previewDistance = displayPreviewPlan?.score.distance;
  const displayedDistance = telemetry.lockedPlan || telemetry.executor.stationKeepingActive
    ? telemetry.executor.distanceToTarget
    : previewDistance;
  const routeState = telemetry.lockedPlan
    ? `${snapshot.routeValid ? "locked route valid" : "locked route invalid"}${telemetry.executor.replanRequired ? " / new plan required" : ""}`
    : telemetry.executor.stationKeepingActive && telemetry.executor.completedPlanHash
      ? admittedPreviewPlan
        ? "holding at target; new route ready"
        : displayPreviewPlan
          ? `holding at target; preview blocked: ${previewPresentation.message}`
        : `holding at target; ${previewPresentation.message}`
    : admittedPreviewPlan
      ? `preview ready: ${admittedPreviewPlan.segments.length} leg${admittedPreviewPlan.segments.length === 1 ? "" : "s"}, route ${formatDistance(admittedPreviewPlan.score.distance)}`
      : displayPreviewPlan
        ? `preview blocked: ${previewPresentation.message}; ${displayPreviewPlan.segments.length} leg${displayPreviewPlan.segments.length === 1 ? "" : "s"}, route ${formatDistance(displayPreviewPlan.score.distance)}`
      : previewPresentation.message;
  const routePlayerState = routeTone === "blocked"
    ? "Blocked"
    : routeTone === "holding"
      ? "Holding"
      : routeTone === "active"
        ? "Autopilot active"
        : routeTone === "ready"
          ? "Preview ready"
          : selectedTarget
            ? "Target selected"
            : "Select target";
  const targetOptions = (telemetry.selectableTargets ?? []).map((candidateTarget) => ({
    id: candidateTarget.id,
    label: candidateTarget.label,
    kind: candidateTarget.kind,
    rangeLabel: formatRangeHint(distanceBetween(telemetry.ship.position, candidateTarget.position)),
    displayLabel: `${candidateTarget.label} ${formatRangeHint(distanceBetween(telemetry.ship.position, candidateTarget.position))}`,
    ariaLabel: `${candidateTarget.label}, ${candidateTarget.kind}, range ${formatRangeHint(distanceBetween(telemetry.ship.position, candidateTarget.position)).replace(/^~/, "")}`,
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
    : admittedPreviewPlan
        ? "Route preview ready"
      : displayPreviewPlan
        ? "Route preview blocked"
      : telemetry.executor.completedPlanHash
        ? "Plan completed"
        : "No active plan";
  const targetState = target ? `${target.label} [${target.kind}]` : "none selected";
  const targetLabel = target?.label ?? "No target";
  const targetKind = target?.kind ?? "Unselected";
  const distanceState = target && displayedDistance !== undefined ? formatDistance(displayedDistance) : "n/a";
  const routeContactCount = routePlan?.segments.filter((segment) => segmentDistance(segment) > 0.000001).length ?? 0;
  const obstacleContactCount = telemetry.obstacles?.length ?? 0;
  const radarContactCount = routeContactCount + obstacleContactCount + (target ? 1 : 0);
  const radarDistanceCandidates = [1];
  if (target) {
    radarDistanceCandidates.push(distanceBetween(telemetry.ship.position, target.position));
  }
  for (const obstacle of telemetry.obstacles ?? []) {
    radarDistanceCandidates.push(distanceBetween(telemetry.ship.position, obstacle.center) + obstacle.radius);
  }
  for (const segment of routePlan?.segments ?? []) {
    radarDistanceCandidates.push(distanceBetween(telemetry.ship.position, segment.end));
  }
  const radarRangeState = radarRangeForMeters(Math.max(...radarDistanceCandidates));
  const radarSummary = `${radarContactCount} contact${radarContactCount === 1 ? "" : "s"}`;
  const radarState = target
    ? `local contact ${target.label}; auto range ${radarRangeForMeters(distanceBetween(telemetry.ship.position, target.position))}${routePlan ? `; ${routePlan.segments.length} route leg${routePlan.segments.length === 1 ? "" : "s"}; terminal ${formatDistance(routePlan.score.distance)}` : ""}`
    : "no route contact";
  const autopilotState = `${statusCatalog[telemetry.executor.status] ?? "Autopilot status unknown"}${telemetry.executor.replanRequired ? " / new plan required" : ""}`;
  const fuelState = `${snapshot.fuel.status}: ${snapshot.fuel.current}/${snapshot.fuel.capacity} kg (reserve ${snapshot.fuel.reserve})`;
  const fuelSummary = `${snapshot.fuel.current}/${snapshot.fuel.capacity} kg`;
  const authorityState = `AP ${snapshot.authority.autopilotAvailable ? "ready" : "blocked"}, main ${snapshot.authority.mainThrustersAvailable ? "ready" : "blocked"}, RCS ${snapshot.authority.rcsAvailable ? "ready" : "blocked"}, SAS ${snapshot.authority.sasAvailable ? "ready" : "blocked"}`;
  const brakingState = snapshot.brakingReserve.canBrake
    ? `ready: ${snapshot.brakingReserve.availableDeltaV} m/s available`
    : "blocked: check warnings";
  const warningSummary = warningChips.length > 0 ? warningChips.map((chip) => chip.label).join(", ") : "none";
  const runtimeMessage = previewPresentation.runtimeMessage;
  const visualSourceLine = formatVisualSourceLine(visualSource);
  const throttleState = `${Math.round(telemetry.ship.throttle * 100)}%${telemetry.ship.actuatorTelemetry.mainThrustActive ? " / main burn" : ""}`;
  const throttleMeter = createThrottleMeter(telemetry);
  const fuelMeter = createFuelMeter(telemetry);
  const velocityState = formatSpeed(telemetry.ship.velocity);
  const rcsSasState = `RCS ${rcsEnabled ? "on" : "off"}, SAS ${sasEnabled ? "on" : "off"}${activeActuators.length > 0 ? ` / ${activeActuators.join(", ")}` : ""}`;
  const helpHint = "Desktop keyboard/mouse manual flight: W/S pitch, A/D yaw, Q/E roll, Shift/Ctrl throttle, X cut, Y/Z full, R RCS, T SAS, CapsLock mode, H/N translate, V camera, RMB+wheel inspect. Mobile: target selection and autopilot only in this slice.";
  const controlModeEffectState = formatControlModeEffectState(telemetry);
  const actionPanel = createActionPanel(telemetry, warningChips, routeTone);
  const objective = createObjectiveViewModel(telemetry);
  const flightStatus: FlightStatusPanelViewModel = {
    title: "Flight Status",
    mode: { label: "Mode", value: snapshot.authority.mode },
    controlMode: { label: "Control Mode", value: controlMode },
    throttle: { label: "Throttle", value: throttleState },
    throttleMeter,
    speed: { label: "Speed", value: velocityState },
    rcsSas: { label: "RCS / SAS", value: rcsSasState },
    fuel: { label: "Fuel", value: fuelSummary },
    fuelMeter,
    shipVisual: { label: "Ship Visual", value: visualSourceLine }
  };
  const navigation: NavigationPanelViewModel = {
    title: "Navigation",
    objective,
    plan: { label: "Plan", value: planState },
    route: { label: "Route", value: routePlayerState },
    routeTone,
    target: { label: "Target", value: targetLabel },
    targetKind: { label: "Target Kind", value: targetKind },
    distance: { label: "Distance", value: distanceState },
    radar: { label: "Radar", value: radarSummary },
    radarRange: { label: "Radar Range", value: radarRangeState },
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
    throttleMeter,
    fuelMeter,
    routeTone,
    actionTone: actionPanel.stateTone,
    authorityState,
    brakingState,
    warningSummary,
    warningChips,
    runtimeMessage,
    visualSourceLine,
    targetOptions,
    objective
  };
};

export const createCombatRuntimeViewModel = (telemetry: TelemetrySnapshot): CombatRuntimeViewModel => {
  const hud = createStatusHudViewModel(telemetry);
  const target = telemetry.selectedTarget ?? telemetry.lockedPlan?.target ?? null;
  const fuel = telemetry.flightSnapshot.fuel;
  const fuelPercent = fuel.capacity > 0 ? clampPercent((fuel.current / fuel.capacity) * 100) : 0;
  return {
    speed: `${Math.hypot(telemetry.ship.velocity.x, telemetry.ship.velocity.y, telemetry.ship.velocity.z).toFixed(2)} m/s`,
    throttle: `${Math.round(telemetry.ship.throttle * 100)}%`,
    fuel: `${fuel.current.toFixed(1)} / ${fuel.capacity.toFixed(1)} kg (${fuelPercent}%)`,
    targetLabel: target?.label ?? "No target",
    targetKind: target?.kind ?? "Unselected",
    targetDistance: target ? formatDistance(distanceBetween(telemetry.ship.position, target.position)) : "n/a",
    autopilot: hud.navigation.route.value,
    controlMode: telemetry.ship.controlMode,
    controlAssist: `RCS ${telemetry.ship.rcsEnabled ? "on" : "off"} · SAS ${telemetry.ship.sasEnabled ? "on" : "off"}`,
    authority: telemetry.flightSnapshot.authority.autopilotAvailable && telemetry.flightSnapshot.authority.mainThrustersAvailable
      ? "Flight authority ready"
      : "Flight authority blocked",
    braking: telemetry.flightSnapshot.brakingReserve.canBrake
      ? `${telemetry.flightSnapshot.brakingReserve.availableDeltaV.toFixed(1)} m/s available`
      : "Brake reserve blocked",
    warnings: hud.warningChips.length > 0 ? hud.warningSummary : "",
    radar: `${hud.navigation.radar.value} · ${hud.navigation.radarRange.value}`
  };
};

const setText = (id: string, value: string): void => {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
};

const setStateTone = (id: string, tone: StatusHudTone | StatusHudMeterTone): void => {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  element.setAttribute("data-hud-tone", tone);
};

const setMeter = (id: string, meter: StatusHudMeterViewModel): void => {
  const element = document.getElementById(id) as HTMLElement | null;
  if (!element) {
    return;
  }

  if (typeof element.style.setProperty === "function") {
    element.style.setProperty("width", `${meter.percent}%`, "important");
  } else {
    element.style.width = `${meter.percent}%`;
  }
  element.setAttribute("data-hud-tone", meter.tone);
};

const renderThrottleSegments = (meter: StatusHudMeterViewModel): void => {
  const element = document.getElementById("throttle-segments") as HTMLElement | null;
  if (!element) {
    return;
  }

  const segments = Array.from(element.children) as HTMLElement[];
  const activeCount = meter.percent <= 0 ? 0 : Math.min(segments.length, Math.ceil((meter.percent / 100) * segments.length));
  for (const [index, segment] of segments.entries()) {
    const isActive = index < activeCount;
    segment.classList.toggle("is-active", isActive);
    segment.dataset.active = String(isActive);
  }
  element.dataset.activeCount = String(activeCount);
  element.dataset.percent = String(meter.percent);
  element.setAttribute("aria-valuenow", String(meter.percent));
  element.setAttribute("aria-valuetext", `${meter.percent}% throttle, ${activeCount} of ${segments.length} segments active`);
};

const renderPresentationState = (viewModel: StatusHudViewModel): void => {
  const flightHud = document.getElementById("flight-hud");
  if (flightHud) {
    flightHud.setAttribute("data-route-tone", viewModel.routeTone);
    flightHud.setAttribute("data-action-tone", viewModel.actionTone);
  }

  setStateTone("status", viewModel.routeTone);
  setStateTone("route-status", viewModel.routeTone);
  setStateTone("autopilot-action-state", viewModel.actionTone);
  setStateTone("objective-status", viewModel.objective.statusTone);
  setStateTone("fuel-status", viewModel.fuelMeter.tone);
  setStateTone("throttle-status", viewModel.throttleMeter.tone);
  setMeter("fuel-meter-fill", viewModel.fuelMeter);
  setMeter("throttle-meter-fill", viewModel.throttleMeter);
  renderThrottleSegments(viewModel.throttleMeter);
};

const renderWarningChips = (viewModel: StatusHudViewModel): void => {
  const element = document.getElementById("warning-chips");
  if (!element) {
    return;
  }

  if (viewModel.warningChips.length === 0) {
    element.textContent = "";
    element.hidden = true;
    return;
  }

  element.hidden = false;

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

const renderObjectiveOptions = (viewModel: StatusHudViewModel, sink: StatusHudCommandSink | undefined): void => {
  const element = document.getElementById("objective-options");
  if (!element) {
    return;
  }

  if (viewModel.objective.options.length === 0) {
    element.textContent = "no objectives available";
    return;
  }

  const renderKey = viewModel.objective.options.map((objective) => `${objective.id}:${objective.status}:${objective.isActive}`).join("|");
  const container = element as HTMLElement;
  if (container.dataset?.renderKey === renderKey) {
    return;
  }
  if (container.dataset) {
    container.dataset.renderKey = renderKey;
  }

  if (typeof document.createElement !== "function" || !("replaceChildren" in element)) {
    element.textContent = viewModel.objective.options.map((objective) => objective.displayLabel).join(" | ");
    return;
  }

  const buttons = viewModel.objective.options.map((objective) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = objective.isActive ? "objective-option objective-option--selected" : "objective-option";
    button.dataset.objectiveId = objective.id;
    button.dataset.objectiveStatus = objective.status;
    button.setAttribute("aria-pressed", String(objective.isActive));
    button.setAttribute("aria-label", objective.ariaLabel);
    button.title = objective.ariaLabel;
    button.textContent = objective.displayLabel;
    button.onclick = sink ? () => void sink.dispatch({ type: "SelectObjective", objectiveId: objective.id }) : null;
    return button;
  });

  element.replaceChildren(...buttons);
};

const createTargetOptionButton = (
  target: StatusHudTargetOptionViewModel,
  sink: StatusHudCommandSink | undefined,
  className: string
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${className}${target.isSelected ? ` ${className}--selected` : ""}`;
  button.dataset.targetId = target.id;
  button.setAttribute("aria-pressed", String(target.isSelected));
  button.setAttribute("aria-label", target.ariaLabel);
  button.title = target.ariaLabel;
  button.textContent = target.displayLabel;
  button.onclick = sink ? () => void sink.dispatch({ type: "SelectTarget", targetId: target.id }) : null;
  return button;
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

  const renderKey = viewModel.targetOptions.map((target) => `${target.id}:${target.rangeLabel}:${target.isSelected}`).join("|");
  const container = element as HTMLElement;
  if (container.dataset?.renderKey === renderKey) {
    return;
  }
  if (container.dataset) {
    container.dataset.renderKey = renderKey;
  }

  if (typeof document.createElement !== "function" || !("replaceChildren" in element)) {
    element.textContent = viewModel.targetOptions.map((target) => `${target.displayLabel}${target.isSelected ? " (selected)" : ""}`).join(" | ");
    return;
  }

  const buttons = viewModel.targetOptions.map((target) => createTargetOptionButton(target, sink, "target-option"));

  element.replaceChildren(...buttons);
};

let plannerReturnFocus: HTMLElement | null = null;
let plannerFeedback = "";
let plannerFeedbackIsError = false;

const isRouteLocked = (telemetry: TelemetrySnapshot): boolean => Boolean(telemetry.lockedPlan || telemetry.executor.planHash);

const renderPlannerFeedback = (message: string, isError = false): void => {
  const element = document.getElementById("planner-feedback") as HTMLElement | null;
  if (!element) {
    return;
  }

  element.textContent = message;
  element.dataset.error = String(isError);
  element.setAttribute("role", isError ? "alert" : "status");
};

const isBrowserRuntimeCommandResult = (value: unknown): value is BrowserRuntimeCommandResult =>
  typeof value === "object" &&
  value !== null &&
  "success" in value &&
  typeof value.success === "boolean" &&
  "telemetry" in value &&
  typeof value.telemetry === "object" &&
  value.telemetry !== null &&
  "message" in value &&
  typeof value.message === "string";

const dispatchPlannerCommand = (
  command: BrowserRuntimeCommand,
  sink: StatusHudCommandSink | undefined,
  options: { readonly closeOnSuccess?: boolean } = {}
): BrowserRuntimeCommandResult | null => {
  if (!sink) {
    return null;
  }

  const dispatched = sink.dispatch(command);
  if (!isBrowserRuntimeCommandResult(dispatched)) {
    plannerFeedback = "The runtime did not return a typed command result.";
    plannerFeedbackIsError = true;
    renderPlannerFeedback(plannerFeedback, true);
    document.getElementById("planner-feedback")?.focus();
    return null;
  }

  const result = dispatched;
  plannerFeedback = result.message;
  plannerFeedbackIsError = !result.success;
  renderPlannerFeedback(plannerFeedback, plannerFeedbackIsError);
  if (!result.success) {
    document.getElementById("planner-feedback")?.focus();
    return result;
  }

  if (options.closeOnSuccess) {
    setNavigationPlannerOpen(false);
  }
  return result;
};

const setControlEnabled = (id: string, enabled: boolean, reason: string | null): void => {
  const element = document.getElementById(id) as HTMLButtonElement | null;
  if (!element) {
    return;
  }

  element.disabled = !enabled;
  element.setAttribute("aria-disabled", String(!enabled));
  if (!enabled && reason) {
    element.title = reason;
    element.setAttribute("aria-description", reason);
  } else {
    element.title = "";
    element.removeAttribute("aria-description");
  }
};

const setTextWithDetail = (id: string, value: string, detail: string): void => {
  setText(id, value);
  document.getElementById(id)?.setAttribute("title", detail);
};

const renderPlannerTargetOptions = (
  telemetry: TelemetrySnapshot,
  viewModel: StatusHudViewModel,
  sink: StatusHudCommandSink | undefined
): void => {
  const element = document.getElementById("planner-target-options");
  if (!element) {
    return;
  }

  if (viewModel.targetOptions.length === 0) {
    element.textContent = "no targets available";
    return;
  }

  const locked = isRouteLocked(telemetry);
  const renderKey = `${locked}|${viewModel.targetOptions.map((target) => `${target.id}:${target.rangeLabel}:${target.isSelected}`).join("|")}`;
  const container = element as HTMLElement;
  if (container.dataset?.renderKey === renderKey) {
    return;
  }
  if (container.dataset) {
    container.dataset.renderKey = renderKey;
  }

  if (typeof document.createElement !== "function" || !("replaceChildren" in element)) {
    element.textContent = viewModel.targetOptions.map((target) => `${target.displayLabel}${target.isSelected ? " (selected)" : ""}`).join(" | ");
    return;
  }

  const buttons = viewModel.targetOptions.map((target) => {
    const button = createTargetOptionButton(target, sink, "planner-target-option");
    button.removeAttribute("data-target-id");
    button.dataset.plannerTargetId = target.id;
    button.disabled = locked;
    button.setAttribute("aria-disabled", String(locked));
    if (locked) {
      button.title = "Cancel the locked route before changing target.";
      button.onclick = null;
    } else {
      button.onclick = () => void dispatchPlannerCommand({ type: "SelectTarget", targetId: target.id }, sink);
    }
    return button;
  });
  element.replaceChildren(...buttons);
};

const setHidden = (id: string, isHidden: boolean): void => {
  const element = document.getElementById(id) as HTMLElement | null;
  if (!element) {
    return;
  }

  element.hidden = isHidden;
};

const bindUiAction = (id: string, handler: () => void): void => {
  const element = document.getElementById(id) as (HTMLElement & { onclick: ((event: MouseEvent) => void) | null }) | null;
  if (!element) {
    return;
  }

  element.onclick = () => handler();
};

const setPlannerBackgroundInert = (isInert: boolean): void => {
  if (typeof document.querySelectorAll !== "function") {
    return;
  }

  const background = document.querySelectorAll<HTMLElement>(
    "#debug-scene, .hud-center-safe-area, #flight-hud > :not(#navigation-planner), #debug-hud"
  );
  for (const element of background) {
    element.inert = isInert;
    if (isInert) {
      element.setAttribute("inert", "");
    } else {
      element.removeAttribute("inert");
    }
  }
};

const setNavigationPlannerOpen = (isOpen: boolean): void => {
  const planner = document.getElementById("navigation-planner") as HTMLDialogElement | null;
  const flightHud = document.getElementById("flight-hud");
  if (flightHud) {
    flightHud.setAttribute("data-planner-open", String(isOpen));
  }
  if (document.body) {
    document.body.setAttribute("data-planner-open", String(isOpen));
  }
  if (!planner) {
    return;
  }

  if (isOpen) {
    if (!planner.open) {
      plannerReturnFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : document.getElementById("open-navigation-planner");
      setPlannerBackgroundInert(true);
      if (typeof planner.showModal === "function") {
        planner.showModal();
      } else {
        planner.setAttribute("open", "");
      }
      const selectedProfile = planner.querySelector<HTMLButtonElement>('.planner-profile-controls button[aria-pressed="true"]:not(:disabled)');
      (selectedProfile ?? planner.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus();
    }
    return;
  }

  if (planner.open && typeof planner.close === "function") {
    planner.close();
  } else {
    planner.removeAttribute("open");
  }
  setPlannerBackgroundInert(false);
  const focusTarget = plannerReturnFocus ?? document.getElementById("open-navigation-planner") ?? flightHud;
  focusTarget?.focus();
  plannerReturnFocus = null;
  plannerFeedback = "";
  plannerFeedbackIsError = false;
};

const bindPresentationUi = (): void => {
  bindUiAction("open-navigation-planner", () => setNavigationPlannerOpen(true));
  bindUiAction("planner-close", () => setNavigationPlannerOpen(false));

  const planner = document.getElementById("navigation-planner") as HTMLDialogElement | null;
  if (planner) {
    planner.oncancel = (event) => {
      event.preventDefault();
      setNavigationPlannerOpen(false);
    };
    planner.onkeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setNavigationPlannerOpen(false);
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = [...planner.querySelectorAll<HTMLElement>("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])")]
        .filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
  }

  const isCombatScenario = document.body?.dataset.uiScenario === "combat-contact";
  setHidden("combat-contact-hud", !isCombatScenario);
};

const renderPlannerTimeline = (telemetry: TelemetrySnapshot, plan: RoutePlan | null): void => {
  const timeline = document.getElementById("planner-timeline");
  if (!timeline || typeof document.createElement !== "function" || !("replaceChildren" in timeline)) {
    return;
  }

  const items: HTMLElement[] = [];
  for (const row of createPlannerTimelineRows(telemetry, plan)) {
    const item = document.createElement("li");
    item.className = `planner-step--${row.kind.toLowerCase()}${row.isActive ? " planner-step--active" : ""}${row.isComplete ? " planner-step--complete" : ""}`;
    item.dataset.timelineId = row.id;
    if (row.isExecutorPhase) {
      item.dataset.executorPhase = row.label;
    } else {
      item.dataset.segmentId = row.id;
      item.dataset.segmentKind = row.kind;
    }
    const marker = document.createElement("span");
    marker.className = "planner-step-marker";
    marker.setAttribute("aria-hidden", "true");
    const copy = document.createElement("span");
    copy.className = "planner-step-copy";
    const title = document.createElement("strong");
    title.textContent = row.label;
    const detail = document.createElement("span");
    detail.className = "planner-step-note";
    detail.textContent = row.detail;
    copy.append(title, detail);
    const time = document.createElement("time");
    time.textContent = row.time;
    item.append(marker, copy, time);
    items.push(item);
  }

  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "planner-step--empty";
    empty.textContent = "No route preview available";
    items.push(empty);
  }
  timeline.replaceChildren(...items);
  setText("planner-timeline-total", formatDuration(etaForPlan(plan)));
};

const renderPlannerMetrics = (telemetry: TelemetrySnapshot, plan: RoutePlan | null): void => {
  const fuel = telemetry.flightSnapshot.fuel;
  const fuelPercent = fuel.capacity > 0 ? clampPercent((fuel.current / fuel.capacity) * 100) : 0;
  const fuelEstimate = plan?.score.fuelCostEstimate ?? null;
  const remainingFuel = fuelEstimate === null ? null : Math.max(0, fuel.current - fuelEstimate);
  const remainingPercent = remainingFuel === null || fuel.capacity <= 0 ? null : clampPercent((remainingFuel / fuel.capacity) * 100);
  const brake = telemetry.flightSnapshot.brakingReserve;
  const avoidanceSegments = plan?.segments.filter((segment) => segment.kind === "Avoidance").length ?? 0;
  const obstacleCount = telemetry.obstacles?.length ?? 0;
  const profile = telemetry.selectedRouteProfile ?? plan?.speedProfile ?? "Balanced";

  setText("planner-fuel-value", `${fuel.current.toFixed(1)} / ${fuel.capacity.toFixed(1)}`);
  setText("planner-fuel-percent", `${fuelPercent}%`);
  setText("planner-brake-value", `${brake.availableDeltaV.toFixed(1)} m/s available`);
  setText("planner-brake-required", `${brake.requiredDeltaV.toFixed(1)} m/s required`);
  setText("planner-route-eta", formatDuration(etaForPlan(plan)));
  setText("planner-metric-distance", plan ? formatDistance(plan.score.distance) : "n/a");
  setText("planner-metric-fuel-estimate", fuelEstimate === null ? "n/a" : `${fuelEstimate.toFixed(2)} kg estimate`);
  setText("planner-metric-fuel-remaining", remainingFuel === null ? "n/a" : `${remainingFuel.toFixed(1)} kg (${remainingPercent}%)`);
  setText("planner-metric-brake-reserve", `${brake.availableDeltaV.toFixed(1)} m/s / ${brake.requiredDeltaV.toFixed(1)} m/s required`);
  setText("planner-metric-avoidance", plan ? `${avoidanceSegments > 0 ? `${avoidanceSegments} avoidance segment${avoidanceSegments === 1 ? "" : "s"}` : "Direct route"}; ${obstacleCount} obstacle${obstacleCount === 1 ? "" : "s"}` : `${obstacleCount} obstacle${obstacleCount === 1 ? "" : "s"}`);
  setText("planner-metric-route", plan ? `${profile} / ${plan.planner} / ${plan.planHash}` : `${profile} / no preview`);
};

const plannerMapTelemetryForVisiblePlan = (
  telemetry: TelemetrySnapshot,
  visiblePlan: RoutePlan | null
): TelemetrySnapshot => {
  const snapshot = telemetry.navigationMap;
  if (!snapshot) {
    return telemetry;
  }

  return {
    ...telemetry,
    navigationMap: createNavigationMapSnapshot({
      absoluteFrameId: snapshot.absoluteFrameId,
      ...(snapshot.floatingOriginFrameId === undefined ? {} : { floatingOriginFrameId: snapshot.floatingOriginFrameId }),
      ship: snapshot.ship,
      targets: snapshot.targets,
      selectedTargetId: snapshot.selectedTargetId,
      route: visiblePlan ? navigationMapRouteSnapshot(visiblePlan, snapshot.ship.absolutePosition.frame) : null,
      obstacles: snapshot.obstacles,
      entities: snapshot.entities,
      world: snapshot.world
    })
  };
};

const renderNavigationPlanner = (
  telemetry: TelemetrySnapshot,
  viewModel: StatusHudViewModel,
  sink: StatusHudCommandSink | undefined
): void => {
  const planner = document.getElementById("navigation-planner");
  if (planner) {
    planner.setAttribute("data-route-tone", viewModel.routeTone);
  }

  const locked = isRouteLocked(telemetry);
  const preview = telemetry.routePreview;
  const previewPresentation = evaluateRoutePreviewPresentation(telemetry);
  const displayPreviewPlan = previewPresentation.displayPlan;
  const admittedPreviewPlan = previewPresentation.admittedPlan;
  const visiblePlan = telemetry.lockedPlan ?? displayPreviewPlan;
  const selectedTarget = telemetry.selectedTarget ?? telemetry.lockedPlan?.target ?? preview?.target ?? null;
  const visiblePreviewHash = visiblePlan?.planHash ?? null;
  const admittedPreviewHash = admittedPreviewPlan?.planHash ?? null;
  const selectedProfile = telemetry.selectedRouteProfile ?? visiblePlan?.speedProfile ?? "Balanced";
  const lockReason = locked ? "Cancel the locked route before changing target, profile, or preview." : null;
  const planningReason = lockReason ?? (!selectedTarget ? "Select a target before creating a route preview." : null);
  const canEngage = previewPresentation.state === "Admitted";
  const engageReason = previewPresentation.state === "Admitted" ? null : previewPresentation.message;

  if (planner) {
    const plannerElement = planner as HTMLElement;
    plannerElement.dataset.visiblePreviewHash = visiblePreviewHash ?? "";
    plannerElement.dataset.locked = String(locked);
    plannerElement.dataset.profile = selectedProfile;
  }
  setText("planner-selected-target", selectedTarget ? `${selectedTarget.label} [${selectedTarget.kind}]` : "none selected");
  setText("planner-route-distance", visiblePlan ? formatDistance(visiblePlan.score.distance) : viewModel.navigation.distance.value);
  setText("planner-route-status", `${viewModel.navigation.route.value}; executor ${telemetry.executor.routeLifecycle ?? telemetry.executor.status}${telemetry.executor.activeSegmentId ? `; active ${telemetry.executor.activeSegmentId}` : ""}`);
  setText("planner-objective", `${viewModel.objective.label}: ${viewModel.objective.status}`);
  setText("planner-route-detail", visiblePlan
    ? `${visiblePlan.planner}; profile ${visiblePlan.speedProfile}; hash ${visiblePlan.planHash}; ${telemetry.lockedPlan ? "Locked" : admittedPreviewPlan ? "Ready" : "Blocked"}`
    : previewPresentation.message);
  setStateTone("planner-route-status", viewModel.routeTone);
  renderPlannerTargetOptions(telemetry, viewModel, sink);
  renderPlannerTimeline(telemetry, visiblePlan);
  renderPlannerMetrics(telemetry, visiblePlan);
  renderPlannerMap(plannerMapTelemetryForVisiblePlan(telemetry, visiblePlan));

  const lockReasonElement = document.getElementById("planner-lock-reason") as HTMLElement | null;
  if (lockReasonElement) {
    lockReasonElement.hidden = !lockReason;
    lockReasonElement.textContent = lockReason ?? "";
  }

  const profiles: readonly AutopilotSpeedProfileId[] = ["Safe", "Balanced", "Fast"];
  for (const profile of profiles) {
    const id = `planner-profile-${profile.toLowerCase()}`;
    const button = document.getElementById(id) as HTMLButtonElement | null;
    if (!button) {
      continue;
    }
    const isSelected = profile === selectedProfile;
    button.classList.toggle("planner-profile-controls__active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
    setControlEnabled(id, !locked, lockReason);
    button.onclick = locked ? null : () => void dispatchPlannerCommand({ type: "SetRouteProfile", profile }, sink);
  }

  setControlEnabled("planner-preview-route", !locked && Boolean(selectedTarget), planningReason);
  setControlEnabled("planner-replan-route", !locked && Boolean(selectedTarget), planningReason);
  setControlEnabled("planner-engage-route", canEngage, engageReason);
  const previewButton = document.getElementById("planner-preview-route") as HTMLButtonElement | null;
  const replanButton = document.getElementById("planner-replan-route") as HTMLButtonElement | null;
  const engageButton = document.getElementById("planner-engage-route") as HTMLButtonElement | null;
  if (previewButton) {
    previewButton.onclick = locked || !selectedTarget ? null : () => void dispatchPlannerCommand({ type: "PreviewRoute" }, sink);
  }
  if (replanButton) {
    replanButton.onclick = locked || !selectedTarget ? null : () => void dispatchPlannerCommand({ type: "ReplanRoute" }, sink);
  }
  if (engageButton) {
    engageButton.textContent = telemetry.lockedPlan ? "Route locked" : "Engage";
    engageButton.onclick = canEngage && admittedPreviewHash
      ? () => void dispatchPlannerCommand({ type: "EngageRoutePreview", expectedPlanHash: admittedPreviewHash }, sink, { closeOnSuccess: true })
      : null;
  }

  const presentationOwnsFeedback = previewPresentation.state === "Rejected" || previewPresentation.state === "Locked";
  const presentationFeedback = presentationOwnsFeedback
    ? previewPresentation.message
    : plannerFeedback || (previewPresentation.state === "Admitted"
      ? previewPresentation.message
      : previewPresentation.runtimeMessage);
  renderPlannerFeedback(
    presentationFeedback,
    previewPresentation.state === "Rejected" ? true : presentationOwnsFeedback ? false : plannerFeedbackIsError
  );
};

const renderFlightDistanceProgress = (telemetry: TelemetrySnapshot): void => {
  const element = document.getElementById("flight-nav-distance-scale") as HTMLElement | null;
  if (!element || typeof document.createElement !== "function" || !("replaceChildren" in element)) {
    return;
  }

  const progressPercent = calculateRouteProgressPercent(telemetry);
  const plan = telemetry.lockedPlan ?? evaluateRoutePreviewPresentation(telemetry).displayPlan;
  if (!plan || progressPercent === null) {
    element.hidden = true;
    element.replaceChildren();
    element.removeAttribute("data-active-segment-id");
    element.removeAttribute("data-progress-percent");
    return;
  }

  const ship = document.createElement("span");
  ship.className = "flight-nav-distance-scale__ship";
  ship.setAttribute("aria-hidden", "true");
  const track = document.createElement("span");
  track.className = "flight-nav-distance-scale__track";
  track.setAttribute("aria-hidden", "true");
  const fill = document.createElement("span");
  fill.className = "flight-nav-distance-scale__fill";
  fill.style.width = `${progressPercent.toFixed(4)}%`;
  track.append(fill);
  const target = document.createElement("span");
  target.className = "flight-nav-distance-scale__target";
  target.setAttribute("aria-hidden", "true");
  element.replaceChildren(ship, track, target);
  element.hidden = false;
  element.dataset.segmentCount = String(plan.segments.length);
  element.dataset.progressPercent = progressPercent.toFixed(4);
  element.dataset.progressState = telemetry.lockedPlan
    ? progressPercent >= 100 ? "arrived" : "executing"
    : "preview";
  element.style.setProperty("--route-progress", `${progressPercent.toFixed(4)}%`);
  element.setAttribute("aria-label", `Navigation route progress ${progressPercent.toFixed(1)} percent`);
  if (telemetry.executor.activeSegmentId) {
    element.dataset.activeSegmentId = telemetry.executor.activeSegmentId;
  } else {
    element.removeAttribute("data-active-segment-id");
  }
};

const renderRadarContacts = (telemetry: TelemetrySnapshot): void => {
  const element = document.getElementById("radar-runtime-contacts") as HTMLElement | null;
  if (!element || typeof document.createElement !== "function" || !("replaceChildren" in element)) {
    return;
  }

  const ship = telemetry.ship.position;
  const target = telemetry.selectedTarget ?? telemetry.lockedPlan?.target ?? null;
  const plan = telemetry.lockedPlan ?? evaluateRoutePreviewPresentation(telemetry).displayPlan;
  const obstacles = telemetry.obstacles ?? [];
  const rangeCandidates = [1];
  if (target) {
    rangeCandidates.push(distanceBetween(ship, target.position));
  }
  for (const obstacle of obstacles) {
    rangeCandidates.push(distanceBetween(ship, obstacle.center) + obstacle.radius);
  }
  for (const segment of plan?.segments ?? []) {
    rangeCandidates.push(distanceBetween(ship, segment.end));
  }
  const radarRange = Math.max(...rangeCandidates);
  const toRadar = (position: Vec3): { readonly left: number; readonly top: number } => ({
    left: 50 + ((position.x - ship.x) / radarRange) * 44,
    top: 50 - ((position.z - ship.z) / radarRange) * 44
  });
  const contacts: HTMLElement[] = [];
  const createContact = (className: string, position: Vec3, label: string): HTMLElement => {
    const contact = document.createElement("span");
    const projected = toRadar(position);
    contact.className = `radar-contact ${className}`;
    contact.style.left = `${projected.left.toFixed(3)}%`;
    contact.style.top = `${projected.top.toFixed(3)}%`;
    contact.title = label;
    contact.setAttribute("aria-label", label);
    return contact;
  };

  for (const obstacle of obstacles) {
    const contact = createContact("radar-contact--runtime-obstacle", obstacle.center, `${obstacle.id}, radius ${obstacle.radius.toFixed(1)} metres`);
    const diameter = Math.max(5, Math.min(18, (obstacle.radius / radarRange) * 88));
    contact.style.width = `${diameter.toFixed(2)}%`;
    contact.style.height = `${diameter.toFixed(2)}%`;
    contact.dataset.obstacleId = obstacle.id;
    contacts.push(contact);
  }
  if (plan) {
    for (const segment of plan.segments.filter((candidate) => segmentDistance(candidate) > 0.000001)) {
      const contact = createContact("radar-contact--runtime-route", segment.end, `${segment.kind} route point`);
      contact.dataset.segmentId = segment.id;
      contacts.push(contact);
    }
  }
  if (target) {
    const contact = createContact("radar-contact--runtime-target", target.position, target.label);
    contact.dataset.targetId = target.id;
    contacts.push(contact);
  }

  element.replaceChildren(...contacts);
  element.dataset.rangeMetres = radarRange.toFixed(3);
  element.dataset.targetCount = String(target ? 1 : 0);
  element.dataset.routeContactCount = String(plan?.segments.filter((segment) => segmentDistance(segment) > 0.000001).length ?? 0);
  element.dataset.obstacleCount = String(obstacles.length);
};

const renderCombatRuntime = (telemetry: TelemetrySnapshot): void => {
  const combat = createCombatRuntimeViewModel(telemetry);
  const hasWarnings = combat.warnings.length > 0;
  setText("combat-marker-target", combat.targetLabel.toUpperCase());
  setText("combat-marker-distance", combat.targetDistance);
  setText("combat-contact-name", combat.targetLabel);
  setText("combat-contact-range", combat.targetDistance);
  setText("combat-target-name", combat.targetLabel.toUpperCase());
  setText("combat-target-kind", combat.targetKind.toUpperCase());
  setText("combat-target-distance", combat.targetDistance);
  setText("combat-flight-speed", combat.speed);
  setText("combat-flight-throttle", combat.throttle);
  setText("combat-flight-fuel", combat.fuel);
  setText("combat-control-mode", combat.controlMode);
  setText("combat-control-assist", combat.controlAssist);
  setText("combat-authority-status", combat.authority);
  setText("combat-brake-status", combat.braking);
  setText("combat-autopilot-status", combat.autopilot);
  setText("combat-warning-status", hasWarnings ? combat.warnings : "");
  setHidden("combat-warning-row", !hasWarnings);
  setText("combat-radar-status", combat.radar);
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
  document.getElementById("flight-hud")?.setAttribute(
    "data-route-locked",
    String(Boolean(telemetry.lockedPlan || telemetry.executor.planHash))
  );
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
  setText("objective-label", viewModel.objective.label);
  setText("objective-status", viewModel.objective.status);
  setText("objective-target", viewModel.objective.target);
  setText("objective-distance", viewModel.objective.distance);
  setText("objective-hint", viewModel.objective.hint);
  setText("objective-next-action", viewModel.objective.nextAction);
  setTextWithDetail("route-status", viewModel.navigation.route.value, viewModel.routeState);
  setTextWithDetail("target-status", viewModel.navigation.target.value, viewModel.target);
  setText("target-kind", viewModel.navigation.targetKind.value);
  setText("target-distance", viewModel.navigation.distance.value);
  setTextWithDetail("radar-status", viewModel.navigation.radar.value, viewModel.radarState);
  setText("radar-range", viewModel.navigation.radarRange.value);
  setTextWithDetail("fuel-status", viewModel.flightStatus.fuel.value, viewModel.fuelState);
  setText("authority-status", viewModel.debug.authority.value);
  setText("brake-status", viewModel.debug.braking.value);
  setText("failure-reasons", viewModel.warnings.summary);
  setText("runtime-message", viewModel.warnings.cockpitMessage);
  setText("ship-visual-source", viewModel.flightStatus.shipVisual.value);
  setText("autopilot-action-state", viewModel.actions.stateLabel);
  renderPresentationState(viewModel);
  renderWarningChips(viewModel);
  renderObjectiveOptions(viewModel, commandSink);
  renderTargetOptions(viewModel, commandSink);
  renderFlightDistanceProgress(telemetry);
  renderRadarContacts(telemetry);
  renderCombatRuntime(telemetry);
  renderNavigationPlanner(telemetry, viewModel, commandSink);
  bindPresentationUi();
  setText("engage-autopilot", viewModel.actions.primaryLabel);
  setText("cancel-autopilot", viewModel.actions.secondaryLabel);
  const visiblePreviewHash = evaluateRoutePreviewPresentation(telemetry).admittedPlan?.planHash ?? null;
  bindCommand("engage-autopilot", { type: "EngageRoutePreview", expectedPlanHash: visiblePreviewHash ?? "" }, commandSink, {
    enabled: viewModel.actions.primaryCommandEnabled,
    disabledReason: viewModel.actions.primaryDisabledReason
  });
  bindCommand("cancel-autopilot", { type: "CancelAutopilot" }, commandSink);
};
