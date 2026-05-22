# Design: Prototype Autopilot Arrival Tuning v1

## Prerequisite

This change starts only because `fix-autopilot-momentum-startup-state` is completed and verified on `main` at `a33d20a`. The existing work already normalized autopilot engagement, cleared conflicting Momentum Assist requests, routed commands through `FlightAssistRequest`, and preserved the no-direct-runtime-Rigidbody-write constraint.

## Reuse Baseline

Reuse the existing waypoint/control architecture instead of introducing a parallel autopilot stack:

- `PrototypeWaypointAutopilot` owns target-relative metrics, fuel feasibility, state, and actuator requests.
- `PlayerShipController.SetExternalFlightAssistRequest` composes autopilot and assist requests into the main flight loop.
- `FlightAssistRequest` already carries source, mode, force, torque, main throttle, and request-status helpers.
- `PrototypeMomentumAssist` already exposes `FuelInsufficient` and `NoAuthority` style diagnostics that can guide wording and state handling.
- `PrototypeFlightDebugConsole` already has a Navigation / Autopilot panel and should become the full telemetry surface.
- `PrototypeFlightHud` should remain compact and avoid a second dense telemetry panel.
- Existing EditMode tests already provide reusable fixtures for metric math, no-direct-Rigidbody-write source guards, low-fuel checks, manual override, final-approach force requests, and diagnostics snapshots.

Unity 6.4 local documentation confirms `Rigidbody.linearVelocity` is world-space velocity and generally should not be modified directly for ordinary physics control; `Rigidbody.AddForce` accumulates force for the next physics simulation step. This supports preserving the existing force/request-based architecture rather than adding velocity writes. Verified local docs: `E:\Unity\Documentation\en\ScriptReference\Rigidbody-linearVelocity.html` and `E:\Unity\Documentation\en\ScriptReference\Rigidbody.AddForce.html`.

## Chosen Shape

Add a small arrival-quality layer inside or immediately adjacent to `PrototypeWaypointAutopilot`:

1. Keep existing high-level autopilot states compatible for older tests and UI.
2. Add an explicit arrival phase diagnostic with the required names: `LongRangeBurn`, `Brake`, `LateralCorrection`, `FinalApproach`, and `Hold`.
3. Extend metrics to include relative speed, final-approach lateral tolerance, desired burn direction, requested throttle, requested RCS translation, and a failure or limitation reason.
4. Use a single `WaypointAutopilot` external request each physics step so main throttle, attitude, and lateral RCS requests cannot overwrite each other.
5. Prefer RCS translation and low throttle during final approach; use coarse main burn/brake if RCS is unavailable but report limited capability.

This avoids adding an orbital planner, path planner, docking controller, or map system while still making arrival behavior testable.

## Arrival Criteria

Arrival completion must be stricter than distance-only and stricter than distance-plus-closing-speed if lateral drift remains high:

```text
arrived = distance <= arrivalRadius
       && relativeSpeed <= arrivalSpeedTolerance
       && lateralSpeed <= lateralSpeedTolerance
```

`relativeSpeed` should use the full target-relative velocity magnitude. `closingSpeed` remains useful for brake timing, but completion must not use closing speed alone because a ship can slide sideways through the target sphere.

## Phase Decisions

The phase should be recomputed from live metrics every physics step:

- `LongRangeBurn`: target is far enough, stopping distance plus margin is below remaining distance, and fuel/thrust authority is available.
- `Brake`: current closing speed would overshoot or the ship is too close/too fast.
- `LateralCorrection`: lateral speed exceeds tolerance, especially near or inside final-approach distance.
- `FinalApproach`: target is near enough to prefer RCS translation and low main throttle.
- `Hold`: arrival tolerances are satisfied or nearly satisfied and the controller is damping remaining drift.

Brake should win over burn whenever the current stopping distance plus safety margin threatens the remaining distance. Lateral correction should be composed with brake/final requests, not replace them.

## Authority And Failure Reasons

Add explicit user-facing reasons for at least these cases:

- `FuelInsufficient`: fuel cannot support safe burn/brake/final approach.
- `NoAuthority`: no available main/RCS authority can affect the required correction.
- `LimitedFinalApproachNoRcs`: main burn/brake is possible, but precise RCS final approach is unavailable.
- `ManualOverride`: user input aborted after the engagement grace period.
- `MomentumAssistActive`: autopilot refuses or clears ownership rather than fighting active Momentum Assist.

Exact enum/string shape is an implementation detail, but diagnostics and tests must see stable names.

## Telemetry Surfaces

Debug Console full panel should show:

- state and phase
- target
- distance
- closing speed
- lateral speed
- stopping distance
- desired burn direction
- requested throttle
- requested RCS translation
- failure/no-fuel/no-authority reason

HUD should show compact status only: target, autopilot on/off, phase or state, and short reason when relevant. The debug overlay may include parity metrics if it remains concise.

## Test Strategy

Add deterministic EditMode coverage rather than relying only on manual play feel:

- Static metric/decision tests for arrival criteria, brake timing, lateral correction, and final approach request shape.
- Runtime-ish tests using existing fixture patterns for fuel insufficient, missing RCS limited final approach, manual override, and Momentum Assist ownership.
- Source guard tests that `PrototypeWaypointAutopilot.cs` does not assign Rigidbody position, rotation, linear velocity, or angular velocity.
- UI/text tests should focus on stable formatting helpers or exposed diagnostics, not fragile IMGUI layout.

Verification should run Unity MCP `validate_script`, `refresh_unity`, `read_console`, focused EditMode tests, full EditMode tests when practical, and explicit local `dotnet build/test "Weltraum Spiel.sln"` if Unity test changes compile outside the editor.

## Risks

- Over-tuning can become open-ended; this change should prefer deterministic thresholds and explainable telemetry over perfect flight feel.
- Existing unrelated UI/art changes are dirty in the worktree; implementation must preserve them and avoid broad README rewrites.
- RCS authority can be absent, disabled, or allocator-limited; diagnostics must reflect reduced capability rather than faking precision arrival.
