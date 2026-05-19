# Docking Physics System Test Protocol

## 2026-05-19 - Inspect Existing Physics Paths

- Unity MCP editor state was ready in `Assets/Scenes/PrototypeBootstrapHost.unity` on Unity 6000.4.7f1.
- Unity MCP custom tools were available, including script, asset, console, test, and physics tooling.
- `ShipPhysicsCore` is the shared force/torque application and diagnostics path through `ApplyForceAtCenterOfMass`, `ApplyForceAtPosition`, `NetAppliedWrench`, and `AppliedForceCount`.
- `FlightAssistRequest` already carries physical assist force and ship-local torque requests with a source and debug-only flag.
- `PlayerShipController.BuildFlightAssistRequest` currently returns zero physical assist in assisted modes, making it the narrow integration point for docking soft-capture requests.
- `RcsThrusterController.ApplyControls` merges non-debug assist force/torque into the existing bounded RCS allocator before forces reach `ShipPhysicsCore`.
- `PhysicsValidationProbe` and `PrototypePhysicsValidationTests` provide the deterministic generated ship fixture and EditMode pattern for docking rejection, soft-capture, and hard-lock tests.

Conclusion: docking should be implemented as a prototype component that computes port relative state, emits diagnostics, optionally builds a bounded `FlightAssistRequest`, and uses a joint only after the same eligibility constraints pass.

## 2026-05-19 - DockingPort Component

- Added `Assets/Scripts/Prototype/DockingPort.cs` through Unity MCP script creation.
- The component exposes local port position, local forward direction, capture radius, hard-lock radius, angle limits, relative-velocity limits, soft-capture gains, maximum assist force/torque, and hard-lock enablement.
- Unity MCP `validate_script` on `Assets/Scripts/Prototype/DockingPort.cs` returned 0 errors and 0 warnings.
- Unity MCP console query for errors returned 0 entries after script import.

## 2026-05-19 - Relative State Calculation

- Extended `DockingPort` with `DockingRelativeState`.
- Relative state includes source/target world frames, world/local offset, distance, opposing-port angle error, world/local relative point velocity, relative speed, positive closing speed, and local relative angular velocity.
- Unity MCP `validate_script` on `Assets/Scripts/Prototype/DockingPort.cs` returned 0 errors and 0 warnings.
- Unity MCP console query for errors returned 0 entries after the change.

## 2026-05-19 - Eligibility Diagnostics

- Extended `DockingPort` with `DockingEligibility`.
- Eligibility checks compare the stricter source/target settings for capture radius, hard-lock radius, soft/hard angle limits, soft/hard relative velocity limits, and source/target feature toggles.
- Diagnostics return explicit reasons such as `outside-capture-radius`, `angle-too-large`, `relative-velocity-too-high`, `soft-capture-eligible`, and `hard-lock-eligible`.
- Unity MCP `validate_script` on `Assets/Scripts/Prototype/DockingPort.cs` returned 0 errors and 0 warnings.
- Unity MCP console query for errors returned 0 entries after the change.
