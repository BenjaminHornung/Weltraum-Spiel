# Tasks: fix-prototype-usability-flight-feel

## Spec

- [x] Create proposal.md
- [x] Create design.md
- [x] Create specs/ui-environment-declutter/spec.md
- [x] Create specs/navigation-autopilot-discoverability/spec.md
- [x] Create specs/flight-feel-rcs-maneuver-mode/spec.md
- [x] Create specs/physical-momentum-assist/spec.md
- [x] Create specs/ship-visual-vfx-readability/spec.md
- [x] Validate spec with specs_validate

## Discovery

- [ ] Inspect current UI window code and PlayerPrefs layout handling
- [x] Inspect current keybind overlay and README control mismatch
- [ ] Inspect current waypoint/autopilot input and diagnostics
- [x] Inspect current PlayerShipController input mapping
- [x] Inspect current gimbal/main-thruster and RCS control paths
- [x] Inspect current FlightAssistRequest/RCS allocator path
- [ ] Inspect current environment labels/minimap clutter
- [ ] Inspect current ship palette, module generation and VFX

## UI / Environment Declutter

- [ ] Make keybind overlay scrollable and screen-clamped
- [x] Add Navigation/Autopilot, Normal/Precision/Translation, and Momentum Assist keybind sections
- [ ] Add EnvironmentDisplayMode Minimal/Training/Full Debug
- [ ] Reduce default world labels and label sizes
- [ ] Add minimap filters and default labels off
- [ ] Update README UI/environment docs

## Autopilot Discoverability

- [ ] Add Navigation/Autopilot section to Debug Console
- [ ] Add target previous/next, engage, abort buttons
- [ ] Add compact HUD/autopilot hint
- [ ] Add HUD/Navball quick action buttons
- [ ] Add visible autopilot state/fuel/distance diagnostics

## Control Mode / Flight Feel

- [x] Replace Left Alt translation modifier with explicit FlightControlMode cycle
- [x] Add Normal / Precision / Translation UI buttons and HUD cycle action
- [x] Add single-source PrototypeFlightControlDiagnostics or equivalent UI state snapshot
- [x] Ensure HUD/Navball, Flight Diagnostics, Debug Console, and Keybind Overlay read the same SAS/RCS/control-mode state
- [x] In Precision and Translation force main thruster and gimbal off
- [x] In Translation mode map W/S/A/D/H/N to linear RCS translation without pitch/yaw
- [x] Preserve Normal Mode Shift/Ctrl as main throttle control
- [x] Ensure Shift/Ctrl do not change main throttle in Precision or Translation
- [ ] Add GimbalAssistMode and safer defaults
- [ ] Add control calibration diagnostics and invert toggles
- [x] Update README controls
- [x] Add tests for mode-specific key mapping
- [x] Add tests that Translation mode A/D and W/S do not rotate
- [x] Add tests that Precision/Translation force main throttle and gimbal off

## Physical Momentum Assist

- [ ] Add PrototypeMomentumAssist or equivalent
- [x] Add Kill Momentum button beside/under Navball
- [x] Wire Kill Momentum button to actual physical Momentum Assist toggle/engage method
- [x] Create and bind PrototypeMomentumAssist in PrototypeBootstrap when missing
- [x] Add Debug Console Momentum Assist section with Engage/Abort, state, speed, angular speed, brake direction, RCS desired force, main throttle request, and reason
- [x] Route damping through physical RCS/main/SAS/assist paths
- [x] Do not directly set Rigidbody velocity in Kill Momentum path
- [x] Add status diagnostics and abort behavior
- [x] Add no fuel / no authority handling
- [x] Add tests/probes for physical-only behavior

## Ship Visuals / VFX

- [ ] Increase module color contrast
- [ ] Make RCS blocks, main thruster, fuel tank, cockpit and gun visually distinct
- [ ] Improve RCS VFX visibility
- [ ] Improve main engine VFX visibility
- [ ] Keep debug vectors off by default
- [ ] Add optional module labels without clutter

## Verification

- [x] Unity MCP validate_script for changed scripts
- [x] Unity MCP refresh_unity and read_console
- [x] Unity MCP run_tests EditMode
- [ ] Manual Play Mode visual inspection: UI not clipped, labels not cluttering, Normal/Precision/Translation modes work, W/S/A/D map correctly by mode, Shift/Ctrl only affects Normal throttle, Kill Momentum brakes physically, Autopilot is discoverable, modules/VFX are readable
- [x] Write tests/test-protocol.md
- [x] Run verify_run or record external verification
- [ ] Run tasks_completion_preflight before toggling completed tasks
