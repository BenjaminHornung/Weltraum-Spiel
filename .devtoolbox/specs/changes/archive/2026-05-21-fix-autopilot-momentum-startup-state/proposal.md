# fix-autopilot-momentum-startup-state

## Why

The current prototype has the right pieces for control modes, autopilot, kill-momentum assist, HUD diagnostics, and flight tuning, but several runtime states can diverge or start in unsafe defaults. That makes the prototype feel unreliable: autopilot can engage in a mode where main throttle is clamped off, Kill Momentum can appear to do nothing, reused bootstrap ships can preserve old velocity, SAS starts off, and UI labels can disagree about the actual control state.

## What

Stabilize the current prototype without adding new gameplay scope:

- Reset the generated prototype ship to a deterministic spawn state on every bootstrap build.
- Make SAS enabled by default and capture the initial hold target.
- Extend the flight diagnostics snapshot so HUD, flight diagnostics, and debug console use one runtime source of truth.
- Fix autopilot engagement from Precision and Translation by switching to Cruise/Normal and routing actuator requests through a clean external-control path.
- Make Kill Momentum visibly engage, expose why it cannot act, and avoid immediate stale-input aborts.
- Align configured gimbal defaults with the calmer runtime behavior.

## Out of Scope

- No new ship builder or editor workflow.
- No new visual asset pass.
- No orbital-map feature work.
- No hidden velocity reset for runtime assists.
- No final autopilot architecture beyond a clean request path for this prototype.

## Success Criteria

- Starting or rebuilding the prototype leaves the ship at the configured spawn with zero linear and angular velocity, throttle zero, Normal control mode, RCS on, SAS on, and inactive assists.
- Autopilot engaged from Precision or Translation switches to Normal and can request main thrust.
- Kill Momentum button visibly changes state and either produces physical actuator requests or reports NoAuthority/FuelInsufficient/AlreadyStable.
- HUD, PrototypeDebugOverlay, and Debug Console show identical SAS/RCS/control-mode/autopilot/momentum state from the same snapshot.
- Gimbal defaults in config and runtime agree with the calmer tuning values.
- Unity scripts compile and targeted EditMode tests cover the startup reset, diagnostics consistency, autopilot engagement, and momentum assist behavior.