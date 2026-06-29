export type BrowserRuntimeCommand =
  | { readonly type: "EngageAutopilot"; readonly planner: "DirectLocal" | "ObstacleAvoidanceLocal" }
  | { readonly type: "CancelAutopilot" };
