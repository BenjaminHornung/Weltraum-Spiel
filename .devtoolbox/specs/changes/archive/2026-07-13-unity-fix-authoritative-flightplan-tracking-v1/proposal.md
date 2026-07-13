# Proposal

## Problem

The current authoritative flight-plan slice made `PrototypeWaypointAutopilot` execute `PrototypeFlightPlan` segments before the legacy live gates, but execution is still mostly open-loop: a segment resolves a direction and throttle, then `ApplyAutopilotRequest()` applies that command. In the real GUI/imported-ship scene this can let the ship follow a stale or geometrically wrong segment instead of tracking the route displayed to the player.

## Outcome

The flight plan remains the normal autopilot authority. The HUD/preview and executor use the same `PrototypeFlightPlan.predictedSamples` and maneuver segments. Runtime execution tracks that reference trajectory with feedback from the real `Rigidbody` state. If tracking diverges, the system visibly replans from the actual state instead of silently falling back to another navigation authority or continuing an invalid burn.

## Scope

- Add a strict flight-plan execution mode that is enabled by default beside the existing executor flag.
- Add a trajectory tracker that samples/interpolates `PrototypeFlightPlan.predictedSamples`, computes tracking error, and produces main/RCS command intent.
- Route active executor segments through the tracker instead of open-loop segment direction/throttle commands.
- Add direction/progress/divergence guards that stop thrust and force replan when a plan is inconsistent.
- Surface tracking diagnostics in the player HUD/debug console and keep preview/executor plan identity visible.
- Add focused EditMode and PlayMode regression coverage plus DevToolbox evidence.

## Non-Goals

- Do not disable the flight-plan executor as the target architecture.
- Do not create a new obstacle system, UI framework, or performance/job-system slice.
- Do not promise bit-perfect Unity/PhysX prediction. The contract is precomputed planning plus closed-loop tracking and explicit replan when reality diverges.
