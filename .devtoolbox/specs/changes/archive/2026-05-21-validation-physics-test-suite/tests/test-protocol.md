# Test Protocol: validation-physics-test-suite

Date: 2026-05-19
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`
Unity instance: `Weltraum Spiel@49c909b3e97ba6e8`
Change execution: `ae2bf23d055a411faf7c057a80884528`

## Existing Probe And Evidence Conventions

- Existing physics evidence is stored under `.devtoolbox/specs/changes/<change>/tests/test-protocol.md`.
- Existing Unity verification uses Unity MCP script validation, console checks, and deterministic `execute_code` probes.
- Existing probes build either the generated `PrototypeShip` through `PrototypeBootstrap.BuildPrototype()` or temporary generated rigs, then report force, torque, active nozzle count, max nozzle throttle, and pass/fail summaries.
- Existing tolerances are documented next to measured outputs instead of hidden in a separate config file.

## Relevant Current Physics Paths

- `Assets/Scripts/Prototype/ShipPhysicsCore.cs`: shared force and torque accounting.
- `Assets/Scripts/Prototype/MainThrusterModule.cs`: main thrust and gimbal steering force application.
- `Assets/Scripts/Prototype/RcsThrusterController.cs`: transform-driven RCS allocator and nozzle diagnostics.
- `Assets/Scripts/Prototype/ShipStats.cs`: mass, thrust, fuel, and projectile tuning values.
- `Assets/Scripts/Prototype/GunModule.cs` and `Assets/Scripts/Prototype/Projectile.cs`: current projectile spawn and velocity behavior; no recoil impulse path exists yet.
- `Assets/Scripts/Prototype/PrototypeBootstrap.cs`: generated prototype ship setup used by prior deterministic probes.

## Implementation Notes

- Added `PhysicsValidationProbe`, a deterministic in-memory generated ship rig with a Rigidbody, `ShipPhysicsCore`, `MainThrusterModule`, `RcsThrusterController`, `GunModule`, a main nozzle, and four RCS blocks with 20 named nozzles.
- Added EditMode tests in `Assets/Tests/Editor/PrototypePhysicsValidationTests.cs`.
- Main thrust is checked for expected forward force and near-zero throttle-only torque.
- Gimbal steering torque is checked against `Vector3.Cross(nozzlePosition - rb.worldCenterOfMass, steeringForce)`.
- RCS allocation is checked for +X force, yaw torque, low residuals, active/application count parity, and max nozzle throttle `<= 1`.
- Fuel partial-step behavior is checked with `0.3 kg` available fuel, `0.6 kg/s` full-throttle demand, and a `1.0 s` physics step.
- Projectile momentum checking is explicitly deferred by test until a recoil impulse path exists in `GunModule`.
- Timestep stability compares cumulative main-thrust impulse and remaining fuel after one simulated second at `0.02 s` vs `0.01 s` steps.
- `ShipStats.ConsumeFuelForThrust` now reports an applied fuel fraction so partial fuel scales thrust and zero configured fuel cost remains fuel-free thrust rather than disabled thrust.

## Tolerances

- Force tolerance: `1 N`.
- Torque tolerance: `1 N*m`.
- Nozzle throttle tolerance: `0.0001` above the `1.0` cap.
- Fuel tolerance: `0.01 kg`, allowing small float accumulation differences across timestep splits.
- Timestep impulse tolerance: `0.01 N*s`.

## How To Run

- Preferred Unity path: run EditMode tests through Unity Test Runner or Unity MCP `run_tests(mode=EditMode)`.
- Deterministic probe path: run Unity MCP `execute_code` against `PhysicsValidationProbe` and save the output in this file.
- Store evidence under `.devtoolbox/specs/changes/validation-physics-test-suite/tests/`.

## Unity MCP Validation

- `validate_script Assets/Scripts/Prototype/ShipStats.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Scripts/Prototype/MainThrusterModule.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Scripts/Prototype/PhysicsValidationProbe.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Tests/Editor/PrototypePhysicsValidationTests.cs`: 0 errors, 0 warnings.

Unity Test Runner EditMode via MCP:

```text
total=7, passed=7, failed=0, skipped=0
PrototypePhysicsValidationTests.DeterministicGeneratedShipSetupCreatesExpectedPhysicsRig: Passed
PrototypePhysicsValidationTests.FuelPartialStepScalesThrustAndDoesNotGoNegative: Passed
PrototypePhysicsValidationTests.GimbalSteeringTorqueMatchesCrossProductEstimate: Passed
PrototypePhysicsValidationTests.MainThrottleAppliesForwardForceWithoutUnintendedTorque: Passed
PrototypePhysicsValidationTests.MainThrustTimestepComparisonKeepsImpulseAndFuelStable: Passed
PrototypePhysicsValidationTests.ProjectileMomentumCheckIsDeferredUntilRecoilExists: Passed
PrototypePhysicsValidationTests.RcsAllocatorProducesTranslationAttitudeAndBoundedNozzleUsage: Passed
```

Deterministic MCP probe:

```text
PASS deterministic setup has 20 nozzles
PASS physics core references generated rigidbody
main.applied=22500.000 force=(0.000, 0.000, 22500.000) torqueMag=0.000000
PASS main thrust applied force expected 22500 N
PASS main throttle torque within tolerance
gimbal.expectedTorque=(0.000, -21388.070, 0.000) estimated=(0.000, -21388.070, 0.000) net=(0.000, -21388.070, 0.000)
PASS gimbal torque equals cross product estimate
rcs.translation+X force=(8999.629, 0.000, -0.001) torque=(0.000, 0.001, 0.177) active=3/20 apps=3 maxThrottle=1.000000
PASS RCS +X force points positive X
PASS RCS +X residual torque within tolerance
PASS RCS +X max nozzle throttle bounded
rcs.yaw force=(0.000, 0.000, 0.250) torque=(0.000, 5832.436, 0.000) active=2/20 apps=2 maxThrottle=0.439871
PASS RCS yaw residual force within tolerance
PASS RCS yaw torque positive and nonzero
PASS RCS yaw max nozzle throttle bounded
fuel.partial applied=22500.000 expected=22500.000 remaining=0.000000
PASS fuel partial step scales thrust
PASS fuel partial step reaches zero without negative fuel
PASS projectile momentum check deferred because recoil path is absent
timestep impulse 0.02=45000.000000 0.01=45000.000000 fuel 0.02=299.400300 0.01=299.398800
PASS timestep impulse comparison 0.02 vs 0.01 stable
PASS timestep fuel comparison 0.02 vs 0.01 stable
SUMMARY failures=0
```

Unity console after the successful EditMode run contained only Unity Test Runner result-file/build-cleanup messages, not C# compile errors.

## Dotnet Checks

`dotnet build "Weltraum Spiel.sln"`:

```text
FAILED: MSB3644
The reference assemblies for .NETFramework,Version=v4.7.1 were not found.
Projects: Assembly-CSharp.csproj, Assembly-CSharp-Editor.csproj
```

This is an environment/targeting-pack blocker for Unity-generated .NET Framework projects in the local `dotnet` SDK, not a C# compile error from the changed scripts. Unity MCP script validation and Unity EditMode tests compiled and passed.

`dotnet test "Weltraum Spiel.sln"`:

```text
Determining projects to restore...
Nothing to do. None of the projects specified contain packages to restore.
```

The command exited successfully but did not report test execution; Unity Test Runner is the authoritative test path for this Unity project.
