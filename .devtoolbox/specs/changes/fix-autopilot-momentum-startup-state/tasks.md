# Tasks: fix-autopilot-momentum-startup-state

## Spec
- [x] Create DevToolbox change artifacts
- [x] Add startup reset/defaults spec
- [x] Add runtime state consistency spec
- [x] Add autopilot control routing spec
- [x] Add momentum assist runtime spec
- [x] Add gimbal default consistency spec
- [x] Validate specs

## Startup Reset
- [ ] Add deterministic bootstrap reset for reused PrototypeShip
- [ ] Make SAS default on and capture target at startup
- [ ] Reset throttle, control mode, assist requests, autopilot, and momentum assist during bootstrap
- [ ] Add startup reset EditMode tests

## Runtime State Consistency
- [ ] Extend PrototypeFlightControlDiagnostics with real SAS/RCS/autopilot/momentum state
- [ ] Refactor HUD, debug overlay, and debug console labels to use the diagnostics snapshot
- [ ] Add snapshot consistency tests

## Autopilot Routing
- [ ] Fix autopilot engagement from Precision and Translation modes
- [ ] Route autopilot actuator commands through a clean external request path or documented temporary adapter
- [ ] Add autopilot engagement/request tests

## Momentum Assist Runtime
- [ ] Add UI-safe momentum assist activation with stale-input grace
- [ ] Expose momentum assist state/reason/request diagnostics
- [ ] Ensure Normal mode can use main braking and Precision/Translation remain RCS-only
- [ ] Add momentum assist runtime tests and keep no-direct-velocity guard

## Gimbal Defaults
- [ ] Align PrototypeMainThrusterSettings.Default with calmer runtime gimbal values
- [ ] Add default gimbal consistency test

## Documentation and Verification
- [ ] Update README and physics/control docs
- [ ] Run Unity MCP refresh, script validation, console check, and EditMode tests
- [ ] Run explicit dotnet build/test against Weltraum Spiel.sln
- [ ] Record evidence in tests/test-protocol.md
- [ ] Run task completion preflight or document known false-blocker
- [ ] Commit and push the completed change
