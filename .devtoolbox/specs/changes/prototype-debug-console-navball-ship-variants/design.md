# Design: Debug Console, Navball, and Ship Variants

## UI Split

Use three prototype-facing layers:

- `PrototypeFlightDebugConsole`: interactive controls and debug actions.
- `PrototypeFlightHud`: always-useful flight HUD and navball-light.
- `PrototypeDebugTelemetryPanel`: detailed foldout diagnostics.

This keeps operational controls separate from dense physics telemetry.

## Debug Console

Use runtime UI controls for existing systems:

- Toggles for RCS, SAS, precision controls, debug vectors, and debug gizmos.
- Selectors for SAS mode, flight assist mode, main thrust mode, and ship variant.
- Buttons for refuel, reset position, reset velocity, reset angular velocity, cut throttle, full throttle, capture SAS attitude, clear/apply damage, and spawn target where supported.
- Test pulse buttons for RCS translation, pitch, yaw, roll, main thrust, and gimbal.

Buttons should call clear methods on controller/debug components instead of duplicating keyboard logic.

## Navball-Light

Start with a 2D circle and projected markers. For each world vector:

```text
localDirection = shipTransform.InverseTransformDirection(worldDirection.normalized)
marker = new Vector2(localDirection.x, -localDirection.y) * radius
```

Initial markers:

- Forward/crosshair.
- Velocity prograde.
- Velocity retrograde.
- SAS hold direction when available.
- Desired, actual, and residual RCS force when debug markers are enabled.
- Optional target direction.

Future modes are reserved: WORLD, VELOCITY, TARGET, DOCKING, and ORBIT/GRAVITY.

## Ship Variants

Avoid expanding hardcoded `PrototypeBootstrap` branches. Introduce prototype data objects:

- `PrototypeShipVariant`.
- `PrototypeShipLayout`.
- Module definitions.
- Main thruster definitions.
- RCS block definitions.
- Gun definitions.

First variants:

- Baseline Balanced.
- Dual Main Thruster.
- Off-Center Main Thruster.
- One-Sided RCS.
- Heavy Cargo.
- No-RCS.

Variants should use existing primitive/generated assets and existing config systems.

## Main Thruster Bank

Multiple engines need an aggregate path. `MainThrusterBank` or an equivalent component should:

- Own multiple `MainThrusterModule` instances.
- Distribute throttle and gimbal commands.
- Aggregate thrust, fuel, force, torque, and thermal diagnostics.
- Support disabled or damaged engines later without changing the controller contract.

## RCS Diagnostics

Allocator diagnostics must distinguish:

- `LastDesiredForceWorld`.
- `LastDesiredTorqueWorld`.
- `LastActualForceWorld`.
- `LastActualTorqueWorld`.
- Residual force and residual torque.
- Max nozzle throttle.
- Saturated nozzle count.
- Allocator status such as `ok`, `limited-force`, `limited-torque`, `fuel-starved`, `no-rcs`, or `no-solution`.

This is required because asymmetric variants should expose physical limitations instead of making the debug overlay look cleaner than the actual allocator output.

## Reuse

Reuse existing controller states, `PrototypeDebugOverlay` telemetry, RCS allocator data, `PrototypeShipConfig`, `MainThrusterModule`, `ShipPhysicsCore`, and primitive bootstrap generation wherever possible. New UI/data classes should adapt these systems rather than replace them.

## Verification Strategy

Use Unity MCP validation and variant probes. Test variants should prove that symmetric layouts remain stable and asymmetric layouts are honestly reported through residual diagnostics.

## Risks

- UI can become noisy if console and telemetry are not separated.
- Navball projection can mislead if behind-ship markers are not visually distinguished.
- Variant support can grow into a ship editor; keep it prototype-only.
- Multiple main thrusters can accidentally bypass fuel, mass, or physics-core paths if aggregation is not careful.
- Test pulses can hide real input bugs if they do not go through the same controller/physics request paths.
