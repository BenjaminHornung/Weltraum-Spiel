# Capability: Runtime State Consistency

## Requirements

- `PrototypeFlightControlDiagnostics` must be the shared read-only display contract for flight-control UI state.
- The snapshot must include:
  - raw SAS enabled
  - effective SAS enabled
  - SAS physical authority or actual torque magnitude when available
  - RCS toggle enabled
  - RCS available
  - RCS allocator status
  - RCS actual force magnitude
  - RCS actual torque magnitude
  - control mode
  - main thruster allowed
  - gimbal allowed
  - waypoint autopilot engaged
  - waypoint autopilot state
  - momentum assist active
  - momentum assist state
- HUD, flight diagnostics/debug overlay, and debug console must read these fields or directly read the same snapshot owner.
- UI labels must distinguish:
  - SAS armed vs SAS effective
  - RCS enabled vs RCS available/actual allocator status
  - Autopilot state vs FlightAssistMode
  - Momentum assist state vs generic active flag

## Constraints

- UI components must not maintain stale duplicated SAS/RCS/control-mode labels.
- Snapshot creation should remain lightweight and safe for `OnGUI` reads.
- The source of truth should remain `PlayerShipController`, with optional bound references to autopilot and momentum assist.

## Acceptance

- HUD, debug overlay, and debug console display the same SAS, RCS, control mode, autopilot, and momentum state for the same frame.
- Tests can create a controller, bind assist components, and assert the snapshot matches those runtime states.
- No UI path reads a stale local boolean for SAS/RCS mode when the snapshot value exists.