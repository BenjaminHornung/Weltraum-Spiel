# prototype-autopilot-arrival-tuning-v1

## Why

`fix-autopilot-momentum-startup-state` is completed and verified on `main` at commit `a33d20a`, so the waypoint autopilot can now engage through the correct runtime control path. The next gap is arrival quality: the ship can start flying, but it still needs to arrive reliably, explainably, and without pretending success while it is overshooting or drifting past the target.

This change tunes the prototype waypoint autopilot around physical arrival behavior. The autopilot should reduce overshoot, brake earlier when current velocity demands it, cancel lateral velocity near the target when RCS authority exists, and expose compact HUD plus detailed debug-console telemetry that explains the current phase and failure reason.

## What

Improve the waypoint autopilot so arrival success requires all of the following at the same time:

- distance within the configured arrival radius
- target-relative speed within the configured arrival-speed tolerance
- lateral speed within a final-approach tolerance

Add explicit arrival phases for diagnostics and deterministic tests:

- `LongRangeBurn`
- `Brake`
- `LateralCorrection`
- `FinalApproach`
- `Hold`

The implementation may map these phases onto the existing `PrototypeWaypointAutopilotState` enum or add a separate phase surface, but the debug UI and tests must expose the phase names above.

## Scope

In scope:

- Earlier brake decisions based on current closing speed, stopping distance, and a safety margin.
- Lateral-speed damping requests through the existing `FlightAssistRequest` / RCS path.
- Final approach that prefers RCS translation and low main throttle.
- Reduced-capability / no-authority reporting when RCS is missing or disabled.
- Fuel-insufficient reporting when fuel prevents a safe physical arrival.
- Autopilot-vs-Momentum-Assist ownership so both assists do not fight over the ship.
- Debug Console autopilot panel expansion and compact HUD status.
- README updates and deterministic EditMode probes.

Out of scope:

- Orbital planner.
- Slingshot.
- Docking assist.
- Map UI.
- Mission routing.
- Teleporting, hidden damping, or direct runtime Rigidbody movement writes.

## Success Criteria

- `specs_validate` passes for this change before implementation.
- Autopilot completion requires distance, relative speed, and lateral-speed tolerance together.
- The controller does not complete while still drifting past the target.
- Final approach requests low throttle and RCS translation when RCS exists.
- Missing RCS still allows coarse burn/brake when possible, but reports limited final-approach capability.
- Low fuel reports `FuelInsufficient` before unsafe fake success.
- Active Momentum Assist is not fought by autopilot; ownership is explicit and visible.
- Debug Console shows state, target, distance, closing speed, lateral speed, stopping distance, desired burn direction, requested throttle, requested RCS translation, and failure/no-fuel/no-authority reason.
- HUD shows only compact status.
- Deterministic EditMode tests/probes cover the listed regression scenarios.
