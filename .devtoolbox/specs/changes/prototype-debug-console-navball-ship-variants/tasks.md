# Tasks: prototype-debug-console-navball-ship-variants

## Spec

- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit and push spec with spec title and changelog

## Discovery

- [x] Inspect current PrototypeDebugOverlay, PlayerShipController, PrototypeBootstrap, RcsThrusterController, MainThrusterModule, and existing UI/test patterns through Unity MCP
- [x] Identify existing controller methods and missing public methods needed by debug buttons
- [x] Identify existing diagnostics that can be reused before adding new telemetry

## Slice 1: Debug Console and RCS Diagnostics

- [x] Create PrototypeFlightDebugConsole
- [x] Add UI toggles for RCS, SAS, precision controls, debug vectors, and debug gizmos
- [x] Add UI selectors for SAS mode, flight assist mode, main thrust mode, and ship variant
- [x] Add debug buttons for refuel, cut/full throttle, reset position, reset velocity, reset angular velocity, capture SAS attitude, clear/apply damage, and spawn target where supported
- [x] Add test pulse buttons for RCS translation, pitch/yaw/roll, main thrust, and gimbal
- [x] Add RCS desired/actual/residual force and torque diagnostics
- [x] Add max nozzle throttle, saturated nozzle count, and allocator status diagnostics
- [x] Keep existing keyboard controls working

## Slice 2: Ship Variants and Main Thruster Bank

- [x] Create PrototypeShipVariant data model
- [x] Create PrototypeShipLayout data model
- [x] Add module, main thruster, RCS block, and gun layout definitions
- [x] Update PrototypeBootstrap to build from selected layout while preserving existing baseline behavior
- [x] Add MainThrusterBank or equivalent aggregate for multiple main thrusters
- [x] Add Baseline Balanced variant
- [x] Add Dual Main Thruster variant
- [x] Add Off-Center Main Thruster variant
- [x] Add One-Sided RCS variant
- [x] Add Heavy Cargo variant
- [x] Add No-RCS variant
- [x] Wire camera/controller/HUD/debug console after variant spawn

## Slice 3: Navball-Light HUD

- [x] Create PrototypeFlightHud
- [x] Add navball-light circle and forward/crosshair marker
- [x] Add velocity prograde and retrograde markers
- [x] Add SAS hold marker when available
- [x] Add optional target marker when target exists
- [x] Add optional desired/actual/residual force markers for debug mode
- [x] Add mode label structure for WORLD, VELOCITY, TARGET, DOCKING, and ORBIT/GRAVITY

## Documentation

- [x] Update README controls/debug section
- [x] Update physics docs with variant-test purpose and RCS residual diagnostics
- [x] Document which debug actions are debug-only

## Verification

- [x] Validate changed Unity scripts with Unity MCP
- [ ] Verify console buttons mirror existing keyboard behavior
- [ ] Verify debug vector toggles work at runtime
- [x] Verify Baseline variant remains stable
- [x] Verify Dual Main Thruster symmetric thrust has near-zero unintended torque
- [ ] Verify single-engine failure creates expected torque
- [x] Verify Off-Center Main Thruster shows COM-safe vs fully physical difference
- [x] Verify One-Sided RCS reports residual force/torque
- [x] Verify Navball prograde/retrograde markers respond to velocity direction
- [x] Verify no compile errors in Unity console
- [x] Add test evidence under this spec
- [x] Commit implementation with spec title and changelog
