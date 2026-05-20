# Design: Fix Prototype Usability and Flight Feel

## Existing Surfaces to Reuse

This change should reuse the current prototype systems instead of creating parallel UI, input, or physics stacks.

- `PrototypeKeybindOverlay` already owns the F1 help surface and has a simple IMGUI window shape. It should gain scroll state, screen clamping, and new sections rather than being replaced.
- `PrototypeFlightDebugConsole`, `PrototypeFlightHud`, and `PrototypeDebugOverlay` already draw runtime diagnostics and compact flight UI. New navigation controls, quick actions, calibration, and mode/status lines should extend these surfaces.
- `PrototypeTestEnvironment` already generates origin, gates, station/hangar, rings, targets, beacons, obstacles, labels, and lighting. Environment display modes should control this generator's default visibility and label scale.
- `PrototypeMinimapOverlay` already tracks environment points and labels. Filter toggles, label defaults, and opacity belong there.
- `PrototypeWaypointAutopilot` already owns G/Tab/B input, target cycling, state, fuel checks, stopping distance, and manual abort. Discoverability should add UI controls around that existing behavior.
- `PlayerShipController` currently treats Caps Lock as a Precision/RCS Maneuver toggle and still uses Left Alt as a temporary translation modifier. This should become an explicit `FlightControlMode` cycle with Normal, Precision, and Translation states.
- `MainThrusterModule` already provides gimbal limit, response scalar, and slew fields. Gimbal behavior should become mode-gated and default-calmer rather than removed.
- `FlightAssistRequest`, `RcsThrusterController`, `ShipPhysicsCore`, `MainThrusterModule`, and `MainThrusterBank` already provide physical force/torque routes. Kill Momentum must use these routes.
- `PrototypeModuleColorPalette`, `PrototypeBootstrap`, `RcsThrusterController`, and `EngineVfxController` already own primitive module materials and VFX activation. Visual readability should tune these rather than import assets.

Local Unity 6.4 docs confirmed that `GUILayout.BeginScrollView` returns an updated scroll position and must be paired with `GUILayout.EndScrollView`. Local Unity docs also confirmed `Rigidbody.AddForce` accumulates force for the next physics simulation step, which matches the physical-only momentum assist constraint.

## Capability Split

The change is split into five capability specs so UI clutter, navigation discoverability, flight feel, momentum assist, and visuals can be implemented and verified independently.

1. `ui-environment-declutter` covers keybind overlay layout, environment display modes, world labels, minimap filters, and quiet defaults.
2. `navigation-autopilot-discoverability` covers debug console controls, HUD quick actions, compact hints, status/toast messaging, and README parity.
3. `flight-feel-rcs-maneuver-mode` covers the explicit Normal/Precision/Translation control mode model, input rules, gimbal defaults, single-source UI state, and control calibration diagnostics.
4. `physical-momentum-assist` covers Kill Momentum state, UI integration, physical actuator routing, no-fuel/no-authority handling, and tests preventing direct velocity zeroing.
5. `ship-visual-vfx-readability` covers primitive module contrast, optional module labels, engine/RCS VFX readability, and debug-vector defaults.

## Control and Assist Model

Manual input keeps highest practical authority. Existing behavior already aborts autopilot on manual flight input; Momentum Assist should follow the same principle unless a specific debug action is explicitly documented. Manual RCS translation-layer input counts as manual flight input for abort/override semantics.

A small explicit control-request layer is preferred over hidden side effects. Autopilot, Momentum Assist, manual input, and debug pulses should expose source, priority, main throttle request, attitude request, RCS translation request, and SAS/assist request intent where practical. If the existing `FlightAssistRequest` can be extended cleanly, reuse it; otherwise add the smallest adjacent request DTO needed to keep command ownership visible.

Kill Momentum must not call reset helpers, teleport, or assign `Rigidbody.linearVelocity`/`angularVelocity` to zero. Existing reset methods may remain available in debug UI, but the new gameplay/test assist must request opposing force or torque through main thrust, RCS, SAS, or the physical assist path and allow Unity physics to integrate the result.

## Input Model

Cruise Mode remains the long-distance mode:

- Shift/Ctrl adjust persistent main throttle.
- W/S/A/D/Q/E command pitch, yaw, and roll.
- H/N may remain legacy RCS translation aliases.
- Autopilot and main-thruster burn/brake continue to work.
- Gimbal defaults are calm and can be set to AutopilotOnly or Low.

Precision and Translation are the close-range modes:

- Caps Lock cycles Normal -> Precision -> Translation -> Normal.
- HUD/Navball quick action cycles the same mode.
- Debug Console exposes explicit Normal, Precision, and Translation buttons.
- Main throttle command is forced to 0 in Precision and Translation.
- Shift/Ctrl do not adjust main throttle in Precision and Translation.
- Gimbal yaw/pitch commands are forced to 0 in Precision and Translation.
- RCS is forced on or automatically available when installed.
- Leaving Precision/Translation should not unexpectedly restore main throttle.

Control mode replaces the temporary Left Alt translation-layer model:

- Normal: W/S pitch, A/D yaw, Q/E roll, Shift/Ctrl adjust main throttle, main thruster allowed, and legacy RCS aliases may remain.
- Precision: W/S pitch, A/D yaw, Q/E roll through RCS attitude control, main/gimbal off, Shift/Ctrl ignored for throttle.
- Translation: W/S translate forward/back, A/D translate left/right, H/N translate up/down, Q/E roll if conflict-free, main/gimbal off, Shift/Ctrl ignored for throttle.
- Left Alt is not a required mode switch because it conflicts with Unity/window behavior and is awkward for combined controls.

All UI state should come from a single source. Prefer a small read-only `PrototypeFlightControlDiagnostics` snapshot on `PlayerShipController` so HUD/Navball, Flight Diagnostics, Debug Console, and Keybind Overlay render the same SAS/RCS/control mode/autopilot/Momentum Assist values.

## UI Model

The default UI should explain the next useful control without taking over the view. Full diagnostics remain available, but the default is Training or Minimal rather than Full Debug.

The keybind overlay must be scrollable and height-clamped so long sections do not clip on small Game views. The HUD/Navball quick action bar should stay small, located near or under the navball, and expose only the immediate actions: previous target, next target, autopilot toggle, Kill Momentum, control mode cycle, SAS toggle, and the active control mode label.

## Visual Model

Primitive-only visuals remain acceptable. The goal is role readability, not art direction. Module colors should use higher contrast, simple shape accents, stripes, rings, or optional small labels when needed. Debug vectors should not visually compete with engine and RCS VFX in default mode.

## Verification Strategy

- Run `specs_validate` before implementation and again after material spec edits.
- Create `execution_create` entries for implementation task slices after the spec is valid.
- Use `execution_add_notes` for decisions such as request-layer reuse, control mode state ownership, gimbal default choice, and any accepted console warnings.
- Validate every changed script with Unity MCP `validate_script`.
- Use Unity MCP `refresh_unity` with compile, then `read_console` for errors and warnings.
- Run Unity MCP EditMode tests.
- Add or update EditMode probes for Normal/Precision/Translation key routing, gimbal defaults, physical-only Kill Momentum, consistent UI diagnostics, and visual/default clutter semantics where practical.
- Capture manual Play Mode sight-check results and screenshots when possible.
- Write `.devtoolbox/specs/changes/fix-prototype-usability-flight-feel/tests/test-protocol.md`.
- Run `tasks_completion_preflight` before any `tasks_toggle` completion.
