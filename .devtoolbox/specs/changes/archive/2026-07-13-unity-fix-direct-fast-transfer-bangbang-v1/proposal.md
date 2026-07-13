# Proposal

## Problem

Waypoint autopilot local routes currently rely on a heuristic FlightPlan that can contain short Burn, Coast, Brake, FinalApproach, and Hold phases. For free direct waypoints this makes the main thruster pulse on and off, introduces arbitrary Coast windows, and lets terminal fallback gates compete with the intended brake profile.

The desired flight feel for a free local waypoint is a predictable fastest-route profile: align to the target, burn at full main thrust to an analytical switch point, flip, brake at full main thrust, then stabilize with RCS-only final hold.

## Outcome

Direct free waypoint routes produce and execute a DirectFastTransfer FlightPlan with this visible sequence:

- AlignForBurn
- FullMainBurn at 100 percent main throttle while aligned
- FlipToRetrograde with main throttle off
- FullMainBrake at 100 percent main throttle while retrograde aligned
- RcsFinalHold with main throttle off

The route contains no arbitrary Coast segment unless a real constraint such as a speed cap, obstacle, intercept/wait, timewarp segment, or explicit safety reason requires it.

## Scope

This change covers the planner, FlightPlan data model, tracker/executor behavior, arrival point consistency, focused tests, and DevToolbox evidence for free local waypoint navigation.

Relevant source and test areas:

- `Assets/Scripts/Prototype/PrototypeTrajectoryPlanner.cs`
- `Assets/Scripts/Prototype/PrototypeFlightPlan.cs`
- `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`
- `Assets/Scripts/Prototype/TrajectoryBurnPlan.cs`
- `Assets/Scripts/Prototype/TrajectoryPredictor.cs`
- `Assets/Tests/Editor/PrototypeFlightPlanValidationTests.cs`
- `Assets/Tests/Editor/PrototypeWaypointAutopilotValidationTests.cs`
- `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`
- `README.md`
- `docs/physics-flight-model.md`

## Non-Goals

- No new UI system or feature slice.
- No new performance-job architecture.
- No direct Rigidbody state writes for autopilot movement.
- No removal of existing obstacle, docking, or conservative fallback behavior outside DirectFastTransfer.
- No attempt to tune the current heuristic segment plan into a fastest-route profile instead of adding a clear mode split.
