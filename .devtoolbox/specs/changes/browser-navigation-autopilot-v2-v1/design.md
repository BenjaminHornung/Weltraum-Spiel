# Design: Browser Navigation Autopilot v2 v1


## Design direction

The browser navigation core is not a port of `PrototypeWaypointAutopilot`. It is a new implementation that uses the Unity prototype to understand required behavior and known edge cases.

## Core components

```text
AutopilotRequest
TargetDescriptor
NavigationEnvironmentSnapshot
RoutePlanner
RouteValidator
RouteScorer
RoutePlan
AutopilotExecutor
AutopilotSupervisor
AutopilotTelemetry
```


## Cross-cutting rules

- Browser code must be runnable with Node/Vitest/Playwright gates.
- Gameplay truth must not live in Three.js scene objects.
- Core logic must be deterministic where tests depend on it.
- Legacy Unity behavior must be converted into feature intent before implementation.
- Known Unity bugs and documentation drift must be captured as bug traps.
