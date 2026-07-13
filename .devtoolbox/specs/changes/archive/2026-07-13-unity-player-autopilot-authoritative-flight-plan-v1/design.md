# Design

## Ask-Pro Finding

The `$ask-pro` review identified the root problem as two competing authorities: `PrototypeTrajectoryPlanner` produces diagnostic route data while `PrototypeWaypointAutopilot.RunAutopilotStep()` still selects maneuvers live. The recommended fix is a new authoritative `PrototypeFlightPlan` route model that the planner builds, the HUD displays, and an executor follows segment by segment. `PrototypeTrajectoryPlanner` should not directly command actuators every frame.

## Architecture

```text
Ship runtime snapshot -> PrototypeTrajectoryPlanner -> PrototypeFlightPlan
                                      |                     |
                                      |                     v
                                      |              PrototypePlayerHud
                                      v
                         PrototypeFlightPlanExecutor
                                      |
                                      v
                         PrototypeWaypointAutopilot command output
```

## Main Types

- `PrototypeFlightPlan`: immutable-ish route contract with plan id, revision, created time, target, ship snapshot, segments, predicted samples, total ETA, fuel totals, executable status, and status label.
- `PrototypeManeuverSegment`: one timed executable maneuver with phase, command mode, start/end times, expected state, command vectors/throttle, fuel/delta-v, tolerances, and replan reasons.
- `PrototypeShipPlanningSnapshot`: captured real ship state and authority data from `Rigidbody`, `ShipStats`, `ShipPhysicsCore`, main thruster modules/bank, RCS controller, imported socket state, mass descriptors, and environment settings.
- `PrototypeFlightPlanExecutionState`: runtime progress and divergence summary surfaced to the HUD.
- `PrototypeFlightPlanExecutor`: active segment runner. It converts the current segment into existing autopilot command requests and advances by time/tolerances.
- `PrototypeFlightPlanDivergenceMonitor`: later slice for obstacle/divergence/replan/abort reasons.

## Migration Strategy

Start beside the current planner/autopilot path. Do not delete legacy live gates until the flight-plan path has parity evidence.

1. Add model and snapshot types with pure tests.
2. Add a snapshot builder that captures real ship data, including imported functional socket evidence.
3. Extend `PrototypeTrajectoryPlanner` to emit `PrototypeFlightPlan` while keeping `PrototypeTrajectoryPlan` compatibility.
4. Add HUD maneuver rows from the active flight plan.
5. Add executor behind a feature flag or serialized toggle.
6. Move accelerate/coast/flip/brake/final/hold sequencing to the executor and quarantine legacy gates as fallback/safety only.
7. Add imported-functional PlayMode regression and Unity MCP visual evidence.

## Determinism Contract

The system will not claim bit-perfect Unity/PhysX determinism. It will guarantee deterministic plan generation from a captured planning snapshot and bounded execution tolerances. If runtime state diverges beyond tolerance, the executor must expose a replan or abort reason and the HUD must show that the active plan changed.

## Why Not Another Threshold Fix

The imported Blender/GLB ship can differ in center of mass, inertia, nozzle placement, gimbal/spool behavior, and RCS allocation from the simplified harness. More threshold tuning can make tests pass without making the GUI route truthful. The fix must make the displayed route and executed route the same object.
