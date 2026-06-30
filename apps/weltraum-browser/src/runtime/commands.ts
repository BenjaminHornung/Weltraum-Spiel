export type BrowserRuntimeCommand =
  | { readonly type: "SelectTarget"; readonly targetId: string }
  | { readonly type: "EngageAutopilot"; readonly planner: "DirectLocal" | "ObstacleAvoidanceLocal" }
  | { readonly type: "CancelAutopilot" };
