# Prototype Camera Control Framing v0

## Motivation

Manual prototype testing needs a camera that can inspect the ship rather than only follow it. The current camera modes cycle through `ChaseLocked`, `Orbit`, and `Side`; visual changes from F6 can make generated and imported ship visuals appear too far away or poorly framed because camera distance is driven mostly by static ship stats and hard clamps.

## User Outcome

A tester can switch between a stable chase camera, orbit inspection, side view, and a true free inspection camera. Mouse wheel zoom works in every mode, F6 visual changes can reframe the camera from the currently visible ship bounds, and the in-game overlays plus README make the controls discoverable.

## Scope

- Extend prototype-only camera behavior in `SimpleFollowCamera`.
- Add `FreeInspect` and rename/clarify orbit behavior as `OrbitInspect` while preserving the default chase behavior.
- Add local camera zoom state that does not mutate `ShipStats` follow distances.
- Add visual-bounds-based camera framing and a notification path from `PrototypeShipVisualSwitcher`.
- Surface camera diagnostics and controls in prototype HUD/debug/keybind UI.
- Add or extend EditMode tests for camera cycling, zoom, bounds reframe, and reset behavior.
- Document runtime controls and F6/camera interplay.

## Non-Goals

- Do not change ship physics, Rigidbody setup, gameplay control force paths, or ship stats as persistent camera state.
- Do not introduce Cinemachine for this change.
- Do not make `FreeInspect` the default camera mode.
- Do not move imported visual hierarchy ownership out of the prototype visual switcher.

## Success Criteria

- `V` cycles `ChaseLocked -> OrbitInspect -> Side -> FreeInspect -> ChaseLocked`.
- Mouse wheel zoom visibly affects all camera modes and resets predictably.
- F6 switching between generated, imported demo scout, and imported demo cargo visuals leaves the ship usefully framed.
- Debug console, HUD diagnostics, keybind overlay, README, and tests describe the new behavior.
- Unity script validation, console check, and EditMode tests pass or any external blocker is documented.