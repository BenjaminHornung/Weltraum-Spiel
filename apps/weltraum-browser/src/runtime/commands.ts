import type { AutopilotSpeedProfileId } from "../core/types";
import type { PreviewLockRejectionCode } from "../navigation/previewLock";
import type { TelemetrySnapshot } from "../sim/telemetry";
import type { ManualFlightInputState } from "./input";

export type BrowserRuntimeCommand =
  | { readonly type: "SelectTarget"; readonly targetId: string }
  | { readonly type: "SelectObjective"; readonly objectiveId: string }
  | { readonly type: "SetRouteProfile"; readonly profile: AutopilotSpeedProfileId }
  | { readonly type: "PreviewRoute" }
  | { readonly type: "ReplanRoute" }
  | { readonly type: "EngageRoutePreview"; readonly expectedPlanHash: string }
  /** @deprecated Use EngageRoutePreview with the visible preview hash. This command never invokes a planner. */
  | { readonly type: "EngageAutopilot"; readonly planner: "DirectLocal" | "ObstacleAvoidanceLocal" }
  | { readonly type: "CancelAutopilot" }
  | { readonly type: "SetManualFlightInput"; readonly input: Partial<ManualFlightInputState> }
  | { readonly type: "SetThrottle"; readonly throttle: number }
  | { readonly type: "ToggleRcs" }
  | { readonly type: "ToggleSas" }
  | { readonly type: "CycleControlMode" }
  | { readonly type: "CycleCameraMode" }
  | { readonly type: "DestroyPgTragwerk" };

export type BrowserRuntimeRejectionCode =
  | PreviewLockRejectionCode
  | "InvalidCommand"
  | "UnknownTarget"
  | "UnknownObjective"
  | "ObjectiveLocked"
  | "PlanLocked"
  | "UnsupportedRouteProfile"
  | "UnsupportedPlanner"
  | "PlanningRejected"
  | "PgTragwerkRejected"
  | "PgTragwerkUnavailable";

export type BrowserRuntimeCommandCode =
  | "TargetSelected"
  | "ObjectiveSelected"
  | "RouteProfileSet"
  | "RoutePreviewCreated"
  | "RoutePreviewReused"
  | "RouteReplanned"
  | "RoutePreviewEngaged"
  | "AutopilotCancelled"
  | "ManualInputUpdated"
  | "ThrottleUpdated"
  | "RcsToggled"
  | "SasToggled"
  | "ControlModeCycled"
  | "CameraModeCycled"
  | "PgTragwerkDestroyed"
  | BrowserRuntimeRejectionCode;

export interface BrowserRuntimeCommandResult {
  readonly success: boolean;
  readonly telemetry: TelemetrySnapshot;
  readonly code: BrowserRuntimeCommandCode;
  readonly rejectionCode: BrowserRuntimeRejectionCode | null;
  readonly message: string;
  readonly previewPlanHash: string | null;
  readonly lockedPlanHash: string | null;
}
