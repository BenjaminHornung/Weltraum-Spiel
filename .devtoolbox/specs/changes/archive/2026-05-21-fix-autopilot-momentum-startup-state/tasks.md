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
- [x] Add deterministic bootstrap reset for reused PrototypeShip
- [x] Make SAS default on and capture target at startup
- [x] Reset throttle, control mode, assist requests, autopilot, and momentum assist during bootstrap
- [x] Add startup reset EditMode tests

## Runtime State Consistency
- [x] Extend PrototypeFlightControlDiagnostics with real SAS/RCS/autopilot/momentum state
- [x] Refactor HUD, debug overlay, and debug console labels to use the diagnostics snapshot
- [x] Add snapshot consistency tests

## Autopilot Routing
- [x] Fix autopilot engagement from Precision and Translation modes
- [x] Route autopilot actuator commands through a clean external request path or documented temporary adapter
- [x] Add autopilot engagement/request tests

## Momentum Assist Runtime
- [x] Add UI-safe momentum assist activation with stale-input grace
- [x] Expose momentum assist state/reason/request diagnostics
- [x] Ensure Normal mode can use main braking and Precision/Translation remain RCS-only
- [x] Add momentum assist runtime tests and keep no-direct-velocity guard

## Gimbal Defaults
- [x] Align PrototypeMainThrusterSettings.Default with calmer runtime gimbal values
- [x] Add default gimbal consistency test

## Documentation and Verification
- [x] Update README and physics/control docs
- [x] Run Unity MCP refresh, script validation, console check, and EditMode tests
- [x] Run explicit dotnet build/test against Weltraum Spiel.sln
- [x] Record evidence in tests/test-protocol.md
- [x] Run task completion preflight or document known false-blocker
- [x] Commit and push the completed change
