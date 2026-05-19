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

## 2026-05-19 - Soft Capture Request

- Extended `DockingPort` with `DockingSoftCaptureRequest` and `BuildSoftCaptureRequest`.
- Soft capture returns `FlightAssistMode.AssistedFlight`, `FlightAssistRequestSource.Docking`, and `debugOnlyNonPhysical = false` only when soft-capture eligibility passes.
- Force and torque requests are bounded by `MaxSoftCaptureForce` and `MaxSoftCaptureTorque`.
- Corrected relative velocity to represent target-point velocity relative to source-point velocity so positive closing speed reports true approach.
- Unity MCP `validate_script` on `Assets/Scripts/Prototype/DockingPort.cs` and `Assets/Scripts/Prototype/FlightAssistRequest.cs` returned 0 errors and 0 warnings.
- Unity MCP console query for errors returned 0 entries after the change.

## 2026-05-19 - Hard Lock Placeholder

- Extended `DockingPort` with `DockingHardLockResult` and `BuildHardLockPrototype`.
- Hard lock is a documented placeholder in this slice: it requests a lock only when `DockingEligibility.canHardLock` is true and does not create a joint yet.
- If a future `hardLockCreatesJoint` option is enabled, the diagnostic reports `hard-lock-joint-not-yet-implemented` rather than silently creating an unstable constraint.
- Unity MCP `validate_script` on `Assets/Scripts/Prototype/DockingPort.cs` returned 0 errors and 0 warnings.
- Unity MCP console query showed no C# compile errors; the only returned entry was an unrelated TestResults save message.

## 2026-05-19 - README And Physics Docs

- Updated `README.md` with the prototype `DockingPort` capability and current hard-lock placeholder limit.
- Updated `docs/physics-flight-model.md` with port frame data, relative state equations, eligibility diagnostics, soft-capture request routing, and hard-lock placeholder behavior.

## 2026-05-19 - Unity MCP Script Validation

- Unity MCP editor state was ready and not compiling in `Assets/Scenes/PrototypeBootstrapHost.unity`.
- Unity MCP `validate_script` on `Assets/Scripts/Prototype/DockingPort.cs` returned 0 errors and 0 warnings.
- Unity MCP `validate_script` on `Assets/Scripts/Prototype/FlightAssistRequest.cs` returned 0 errors and 0 warnings.
- Unity MCP console query showed no C# compile errors; the only returned entry was the unrelated TestResults save message already observed earlier.

## 2026-05-19 - Rejection Cases

- Added `Assets/Tests/Editor/DockingPortValidationTests.cs`.
- `DockingEligibilityRejectsDistanceAngleAndHardVelocityCases` verifies:
  - distance outside capture radius reports `outside-capture-radius`;
  - opposing-port angle mismatch reports `angle-too-large`;
  - high relative speed prevents hard lock while still allowing soft capture when inside the soft velocity envelope.
- Unity MCP `validate_script` on `Assets/Tests/Editor/DockingPortValidationTests.cs` returned 0 errors and 1 nullable-style warning about `GetComponent` checks.
- Unity MCP EditMode test job `f8d4cf90807641b39170bfa609dd1439` passed 1/1.

## 2026-05-19 - Soft Capture Bounds

- Added `DockingSoftCaptureRequestIsPhysicalAndBounded`.
- The test verifies a soft-capture request is `AssistedFlight`, source `Docking`, not debug-only, and clamps both force and torque to the source port maximums.
- Unity MCP `validate_script` on `Assets/Tests/Editor/DockingPortValidationTests.cs` returned 0 errors and 1 nullable-style warning about `GetComponent` checks.
- Unity MCP EditMode test job `1d29658e21654ed695c623a6ba18c1f5` passed 1/1.

## 2026-05-19 - Hard Lock Gating

- Added `DockingHardLockPlaceholderOnlyRequestsWhenConstraintsPass`.
- The test verifies the hard-lock placeholder requests a lock only when hard-lock distance, angle, velocity, and feature constraints pass.
- The same test verifies aligned-but-too-far and misaligned cases do not request a lock.
- Unity MCP `validate_script` on `Assets/Tests/Editor/DockingPortValidationTests.cs` returned 0 errors and 1 nullable-style warning about `GetComponent` checks.
- Unity MCP EditMode test job `39b0dbf3e6be491f8d399c00d4e5d467` passed 3/3 for `DockingPortValidationTests`, including the hard-lock gating test.
