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

- [ ] Inspect current PrototypeDebugOverlay, PlayerShipController, PrototypeBootstrap, RcsThrusterController, MainThrusterModule, and existing UI/test patterns through Unity MCP
- [ ] Identify existing controller methods and missing public methods needed by debug buttons
- [ ] Identify existing diagnostics that can be reused before adding new telemetry

## Slice 1: Debug Console and RCS Diagnostics

- [ ] Create PrototypeFlightDebugConsole
- [ ] Add UI toggles for RCS, SAS, precision controls, debug vectors, and debug gizmos
- [ ] Add UI selectors for SAS mode, flight assist mode, main thrust mode, and ship variant
- [ ] Add debug buttons for refuel, cut/full throttle, reset position, reset velocity, reset angular velocity, capture SAS attitude, clear/apply damage, and spawn target where supported
- [ ] Add test pulse buttons for RCS translation, pitch/yaw/roll, main thrust, and gimbal
- [ ] Add RCS desired/actual/residual force and torque diagnostics
- [ ] Add max nozzle throttle, saturated nozzle count, and allocator status diagnostics
- [ ] Keep existing keyboard controls working

## Slice 2: Ship Variants and Main Thruster Bank

- [ ] Create PrototypeShipVariant data model
- [ ] Create PrototypeShipLayout data model
- [ ] Add module, main thruster, RCS block, and gun layout definitions
- [ ] Update PrototypeBootstrap to build from selected layout while preserving existing baseline behavior
- [ ] Add MainThrusterBank or equivalent aggregate for multiple main thrusters
- [ ] Add Baseline Balanced variant
- [ ] Add Dual Main Thruster variant
- [ ] Add Off-Center Main Thruster variant
- [ ] Add One-Sided RCS variant
- [ ] Add Heavy Cargo variant
- [ ] Add No-RCS variant
- [ ] Wire camera/controller/HUD/debug console after variant spawn

## Slice 3: Navball-Light HUD

- [ ] Create PrototypeFlightHud
- [ ] Add navball-light circle and forward/crosshair marker
- [ ] Add velocity prograde and retrograde markers
- [ ] Add SAS hold marker when available
- [ ] Add optional target marker when target exists
- [ ] Add optional desired/actual/residual force markers for debug mode
- [ ] Add mode label structure for WORLD, VELOCITY, TARGET, DOCKING, and ORBIT/GRAVITY

## Documentation

- [ ] Update README controls/debug section
- [ ] Update physics docs with variant-test purpose and RCS residual diagnostics
- [ ] Document which debug actions are debug-only

## Verification

- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify console buttons mirror existing keyboard behavior
- [ ] Verify debug vector toggles work at runtime
- [ ] Verify Baseline variant remains stable
- [ ] Verify Dual Main Thruster symmetric thrust has near-zero unintended torque
- [ ] Verify single-engine failure creates expected torque
- [ ] Verify Off-Center Main Thruster shows COM-safe vs fully physical difference
- [ ] Verify One-Sided RCS reports residual force/torque
- [ ] Verify Navball prograde/retrograde markers respond to velocity direction
- [ ] Verify no compile errors in Unity console
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
