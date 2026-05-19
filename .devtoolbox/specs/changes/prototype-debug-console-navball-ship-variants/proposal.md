# prototype-debug-console-navball-ship-variants

## Why

The prototype now has enough physics systems that raw telemetry alone is no longer enough. RCS allocation, main-thrust modes, module mass/COM/inertia, fuel, SAS, assist, gravity, atmosphere, projectile recoil, damage, docking, and diagnostics all need to be visible and testable in repeatable ways.

This change creates a prototype-facing debug and navigation layer so we can inspect physics behavior without relying only on keyboard shortcuts or one hardcoded ship layout.

## What

Build a minimal prototype layer for:

- `PrototypeFlightDebugConsole`: buttons, toggles, and selectors for existing controller and debug actions.
- `PrototypeFlightHud`: a navball-light HUD with core orientation and motion markers.
- `PrototypeDebugTelemetryPanel`: grouped or foldout telemetry for detailed diagnostics.
- `PrototypeShipVariant` and `PrototypeShipLayout`: data-driven prototype ship variants.
- A `MainThrusterBank` or equivalent aggregate path for multiple main thrusters.
- RCS desired/actual/residual diagnostics for allocator QA.
- Test pulses for reproducible force and torque checks.
- A small set of test variants: Baseline Balanced, Dual Main Thruster, Off-Center Main Thruster, One-Sided RCS, Heavy Cargo, and No-RCS.

## Out of Scope

- No final gameplay UI.
- No polished art pass.
- No full KSP-style 3D navball shader.
- No final ship editor.
- No final input-action remap UI.
- No complex docking or orbital navball modes beyond reserving structure for them.
- No multiplayer, online services, persistence, or savegame work.
- No new asset-pack dependency.

## Success Criteria

- Existing keyboard controls continue working.
- The debug console can toggle RCS, SAS, precision controls, flight assist mode, main thrust mode, and debug vectors/gizmos.
- The debug console can run debug actions such as refuel, cut throttle, full throttle, reset velocity, reset angular velocity, reset position, capture SAS attitude where supported, clear/apply damage where supported, and spawn a test target where supported.
- The debug console can trigger reproducible test pulses for RCS translation, attitude axes, main thrust, and gimbal.
- The navball-light shows ship forward, velocity prograde, velocity retrograde, SAS hold direction when available, and optional target direction when available.
- Ship variants can be selected and spawned without editing hardcoded bootstrap positions.
- At least Baseline Balanced, Dual Main Thruster, One-Sided RCS, and Off-Center Main Thruster variants exist in the first implementation slice.
- RCS diagnostics distinguish desired, actual, and residual force/torque.
- Unity MCP validation reports no C# compile errors after implementation.
