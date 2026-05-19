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
