# Test Protocol: infrastructure-floating-origin-large-world

Date: 2026-05-19

## Scope

- Floating-origin infrastructure scripts compile in Unity.
- Absolute position/velocity state is represented separately from Unity local transforms.
- Origin shifts preserve registered-object relative positions.
- Rigidbody linear and angular velocity are preserved through shifts.
- Feature-disabled behavior leaves local prototype coordinates untouched.
- Current prototype EditMode regression suite remains green.

## Unity MCP Inspection

- Active Unity instance: `Weltraum Spiel@49c909b3e97ba6e8`, Unity `6000.4.7f1`.
- Active scene: `Assets/Scenes/PrototypeBootstrapHost.unity`.
- Scene roots before runtime bootstrap: `PrototypeBootstrap`, `Main Camera`, `Directional Light`.
- Camera state: one Unity `Main Camera`, no Cinemachine brain/cameras.
- Pre-runtime component scan found no active `Rigidbody`, `ParticleSystem`, `TrailRenderer`, or `SimpleFollowCamera` objects because the prototype rig is generated at runtime.
- Code inspection found:
  - `PrototypeBootstrap` builds ship and target with local Unity positions.
  - `SimpleFollowCamera` follows `target.position` and `target.rotation`.
  - `EngineVfxController` creates world-space main-thrust particles.
  - `Projectile` keeps trail and sweep history in world space.
  - `ShipPhysicsCore`, main thrust, and RCS diagnostics use `Rigidbody.worldCenterOfMass`.

## Unity Script Validation

Command: Unity MCP `validate_script(level=standard, include_diagnostics=true)`

- `Assets/Scripts/Prototype/LargeWorldVector3d.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/LargeWorldTransformState.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/FloatingOriginBody.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/FloatingOriginManager.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: 0 errors, 2 existing-style warnings from overlay update/string diagnostics.
- `Assets/Tests/Editor/FloatingOriginValidationTests.cs`: 0 errors, 0 warnings.

Unity console after refresh: 0 errors, 0 warnings.

## EditMode Tests

Command: Unity MCP `run_tests(mode=EditMode, filter=FloatingOriginValidationTests)`

Result: Passed, 28/28 tests, duration `0.9880864s`, job `9927fd5cba2444cb8e69325a641e21e5`.

Relevant new tests:

- `FloatingOriginValidationTests.AbsoluteStateStoresLargePositionSeparateFromLocalTransform`: passed.
- `FloatingOriginValidationTests.OriginShiftPreservesRelativePositionsAndRigidbodyVelocity`: passed.
- `FloatingOriginValidationTests.DisabledFloatingOriginLeavesPrototypeLocalPositionUntouched`: passed.

The run also covered the existing prototype physics and atmosphere EditMode tests.

## Dotnet Verification

Command: `dotnet build '.\Weltraum Spiel.sln'`

Result: Passed, exit code 0. Existing Unity/MSB3277 reference warnings remain.

Command: `dotnet test '.\Weltraum Spiel.sln'`

Result: Passed, exit code 0. No test projects/packages required restore output.

## Notes

- One first-pass EditMode run failed because `Rigidbody.position` did not immediately synchronize the `Transform` in the test environment. `FloatingOriginBody.ApplyLocalPosition` now writes both `Rigidbody.position` and `transform.position` before restoring velocities.
- Particles, trails, projectile sweep history, and physics joints are documented as first-pass limitations before gameplay activation of origin shifts around those systems.
