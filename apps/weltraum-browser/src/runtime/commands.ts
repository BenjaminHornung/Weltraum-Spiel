import type { ManualFlightInputState } from "./input";

export type BrowserRuntimeCommand =
  | { readonly type: "SelectTarget"; readonly targetId: string }
  | { readonly type: "SelectObjective"; readonly objectiveId: string }
  | { readonly type: "EngageAutopilot"; readonly planner: "DirectLocal" | "ObstacleAvoidanceLocal" }
  | { readonly type: "CancelAutopilot" }
  | { readonly type: "SetManualFlightInput"; readonly input: Partial<ManualFlightInputState> }
  | { readonly type: "SetThrottle"; readonly throttle: number }
  | { readonly type: "ToggleRcs" }
  | { readonly type: "ToggleSas" }
  | { readonly type: "CycleControlMode" }
  | { readonly type: "CycleCameraMode" };
