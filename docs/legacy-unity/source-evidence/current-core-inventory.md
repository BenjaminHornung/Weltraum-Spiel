# Weltraum Current Core Inventory

Analyzed commit: `e416eb880ff4b42fdf35a93c1b567dfbfa186bbb`

Branch for spike work: `spike/threejs-core-port-v1`

Unity editor was not used. This inventory is based on static source inspection with Git/LFS checkout smudge disabled because one archived screenshot LFS object is missing on the server.

## Scope

The browser/Three.js spike targets only the deterministic navigation core and debug presentation:

- fixed-step ship simulation
- route planning and plan identity
- locked-plan autopilot execution
- telemetry snapshots for tests and HUD-like readouts
- low-poly browser debug scene

It intentionally excludes Ship Builder, Surface-FPS, missions, economy, drones, production assets, and Unity-specific MonoBehaviour wiring.

## Core System Inventory

### Flight and Control

- `Assets/Scripts/Prototype/PlayerShipController.cs`
  - Main flight-control facade.
  - Relevant semantics: control modes (`Normal`, `Precision`, `Translation`), separate RCS/SAS toggles, throttle commands, and `FlightControlDiagnostics` for HUD/telemetry.
- `Assets/Scripts/Prototype/MainThrusterBank.cs`
  - Aggregates main thruster modules and distributes throttle/gimbal commands.
  - Stores diagnostics such as applied thrust, world force, and estimated torque.
- `Assets/Scripts/Prototype/RcsThrusterController.cs`
  - RCS force/torque actuator with allocator diagnostics.
  - Relevant diagnostics include allocator status and residual force/torque.

TypeScript spike mapping: represent authority as pure scalar capability (`thrust`, `fuelBurnRate`, `rcsAuthority`) and keep force integration deterministic, without a physics engine.

### Navigation and Autopilot

- `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`
  - Current runtime navigation/autopilot orchestrator.
  - Important behaviors: target selection, flight plan executor, navigation warning chips, explicit safety replan, legacy fallback checks, segment application, diagnostics, and plan refresh.
  - Key state concepts: current flight plan, executor enabled/strict flags, `FlightPlanRequiresReplan`, `FlightPlanRequiresAbort`, divergence status, and safety replan count.
- `Assets/Scripts/Prototype/PrototypeFlightPlan.cs`
  - Defines executable/locked flight plan state, active segment lookup, expected fuel, invalid plan construction, execution state, tracking command, and divergence reports.
- `Assets/Scripts/Prototype/PrototypeTrajectoryPlanner.cs`
  - Builds candidate routes and final flight plans.
  - Scores candidates by clearance, delta-v, heading change, damping, fuel, braking capability, and RCS authority.

TypeScript spike mapping: split planner and executor. Planner produces a route plan with a deterministic `planHash`; executor accepts one locked plan and reports divergence/replan-required without replacing it.

### Route, Waypoint, and Targeting

- `Assets/Scripts/Prototype/PrototypeWaypointManager.cs`
  - Maintains waypoint/target lists and selection.
- `Assets/Scripts/Prototype/PrototypeNavigationTarget.cs`
  - Target component with display name, position, arrival radius, and configuration helpers.
- `Assets/Scripts/Prototype/PrototypeWeaponTargetRegistry.cs`
  - Registers active target transforms and exposes versioned snapshots.
- `Assets/Scripts/Prototype/PrototypeWeaponTarget.cs`
  - Discovers targets from object hierarchies and filters ignored candidates.
- `Assets/_Weltraum/Runtime/Navigation/AutopilotContracts.cs`
  - Clean contract source for `TargetDescriptor`, `ArrivalEnvelope`, `RoutePlan`, `RouteSegment`, `RouteCandidate`, `RouteScore`, `AuthorityState`, `RouteRiskLevel`, and invalidation reason concepts.

TypeScript spike mapping: use a minimal `TargetDescriptor` plus arrival radius and deterministic route segments. Avoid hierarchy discovery and weapon-specific filtering in the spike.

### HUD and Telemetry

- `Assets/Scripts/Prototype/PrototypePlayerHud.cs`
  - Main HUD snapshot builder. Displays navigation plan state, timeline segments, progress, active segment, replan status, tracking error, command label, authority, obstacles, warning chips, and assist chips.
- `Assets/Scripts/Prototype/PrototypeFlightHud.cs`
  - Older IMGUI/navball HUD view with projection and quick actions.
- `Assets/Scripts/Prototype/PrototypeTrajectoryPreviewNavMap.cs`
  - Preview snapshot/nav-map binding for planned route visualization.
- `Assets/Scripts/Prototype/PrototypeRuntimeDataSnapshots.cs`
  - Pure telemetry DTO source: ship runtime state, target data, RCS nozzle data, trajectory candidates, contacts, visual bounds, and allocation data.
- `Assets/_Weltraum/Runtime/UI/StatusAuthorityContracts.cs`
- `Assets/_Weltraum/Runtime/UI/StatusSnapshots.cs`
  - Clean UI-facing status/authority snapshots and warning/failure-code contracts.

TypeScript spike mapping: expose `TelemetrySnapshot` through a browser `testBridge` and use the Three.js scene only as a consumer of this snapshot.

### Proving Ground and Evidence

- `Assets/Tests/PlayMode/PrototypeAutopilotProvingGroundPlayModeTests.cs`
  - Scenario matrix/evidence harness.
  - Writes JSON, Markdown, and CSV reports.
  - Current source still has an explicit acceptance-gate marker for strict gameplay acceptance, which appears to drift from `docs/legacy-unity/current-prototype-state-2026-06-15.md`.
- `docs/legacy-unity/current-prototype-state-2026-06-15.md`
  - States that exact point arrival is resolved.
- `README.md`
  - Still references proving-ground failures, creating documentation drift.

TypeScript spike mapping: preserve the evidence-driven posture with Vitest for pure core and Playwright for browser telemetry/screenshot output.

## Port Boundary

Ported in the spike:

- deterministic vector math
- fixed-step loop
- route plan identity and hashing
- direct local route planner
- obstacle-avoidance local route planner
- locked-plan executor with explicit divergence/replan telemetry
- telemetry snapshots
- low-poly browser debug scene

Stubbed or simplified:

- RCS allocation becomes scalar authority.
- Fuel is deterministic burn-per-thrust instead of Unity thruster module behavior.
- Obstacles are spherical clearance constraints.
- HUD is a simple DOM overlay plus telemetry bridge.

Excluded:

- Unity physics and MonoBehaviour lifecycles
- Ship Builder
- Surface-FPS
- missions/economy/drones
- production asset import
- weapon target hierarchy discovery
- automatic legacy fallback or silent replanning
