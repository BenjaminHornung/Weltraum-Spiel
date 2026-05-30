Return final markdown only. Do not answer with a preamble. Treat the attached bundle as authoritative. Call out uncertainty.

We are working in a Unity 6000.4 prototype space-flight project. The user reports that the player-facing GUI run with the imported Blender/GLB ship model still flips and brakes too early, even after PlayMode harness tests passed for terminal arrival/deadzone cases. The user believes the root problem is architectural: the trajectory preview/planner is diagnostic/heuristic while the runtime autopilot still decides maneuvers live in `PrototypeWaypointAutopilot.RunAutopilotStep()`. They want no guessing and no on-the-fly route decisions for the core route: the full route should be calculated ahead of time using physics calculations and real ship data, displayed in the GUI, then the autopilot should execute that same route.

Current repo context:
- `PrototypeTrajectoryPlanner` currently returns diagnostic `PrototypeTrajectoryPlan` data with segments, ETA, fuel, predictedPath, candidate scores, and burn plan. It is not the runtime authority.
- `PrototypeWaypointAutopilot.RunAutopilotStep()` refreshes the plan, but then uses many live gates for brake/flip/decel/hold/avoidance and mutates `LastTrajectoryPlan` after commands are chosen.
- `PrototypePlayerHud` displays a Navigation Planner panel, route/preview lines, maneuver label, stop distance, burn seconds, and available burn seconds. It does not yet show a detailed maneuver table with exact start times, durations, fuel, total ETA, or total planned fuel.
- Real ship data exists in runtime components:
  - `ShipStats`: current fuel, fuel kg/s, thrust, current mass, mass properties.
  - `ShipPhysicsCore`: central gravity/atmosphere force evaluation and force application wrappers.
  - `MainThrusterModule` / `MainThrusterBank`: actual thrust mode, gimbal, spool rates, thermal efficiency, fuel consumption.
  - `RcsThrusterController`: real RCS translation/torque authority, imported functional socket mode, allocator diagnostics and fuel usage.
  - `ModuleMassDescriptor` / `PrototypeModuleMassLayout`: imported functional ship mass descriptors for Blender/GLB demo ships.
  - `PrototypeImportedShipBinder`: binds sockets/nozzles/thrusters/RCS for imported ship visuals.
- Recent code passed focused PlayMode tests, but these tests likely do not reproduce the GUI imported-ship behavior, real model inertia/nozzle layout, and player-facing route execution.

Decision needed:
Design the safest implementation path to replace the current heuristic/live arrival behavior with a deterministic precomputed maneuver route that both preview and runtime use as a single source of truth, while still allowing bounded replanning when the real physics state diverges or an obstacle appears.

Please answer these questions:
1. What is the likely root architectural bug from the attached code?
2. Should the runtime autopilot execute precomputed maneuver segments from a new route/flight-plan model, or should `PrototypeTrajectoryPlanner` itself become the authoritative command source? Recommend one.
3. What exact data model should be introduced or extended? Include fields needed for maneuver start time, duration, phase/type, burn direction, throttle, expected delta-v, expected fuel, expected pose/velocity, tolerances, and abort/replan reasons.
4. How should the planner calculate with real ship data instead of estimates? Name which attached components should be sampled and which runtime actuator effects must be modeled before we trust the plan.
5. How should the GUI expose the plan so the user can see exactly which maneuver happens when, for how long, total ETA, total fuel, and current execution progress?
6. What should remain live/on-the-fly for safety only, and what must stop being decided ad hoc?
7. Give a staged implementation plan with small reviewable commits and focused tests. Include how to reproduce the imported Blender/GLB ship GUI issue in PlayMode or Unity MCP.
8. Identify risks in trying to make the route “fully exact” in Unity physics and how to state/verify determinism honestly without hand-waving.

Constraints:
- Do not propose another round of threshold-only brake/flip tuning as the main solution.
- Preserve player control safety: obstacle avoidance and major divergence may trigger replanning/abort, but ordinary accelerate/brake/flip/hold sequencing should come from the precomputed route.
- The GUI must make the planned route transparent: maneuver list, durations, ETA, fuel, and current segment.
- Prefer boring, incremental, testable changes over a rewrite.
- We need a practical plan for this codebase, not generic game-AI advice.
