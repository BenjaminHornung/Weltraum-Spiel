# Test Protocol: architecture-sas-pd-control

Date: 2026-05-19
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`

## Unity Script Validation

Tool: Unity MCP `refresh_unity`, `validate_script`, `read_console`

- `Assets/Scripts/Prototype/PlayerShipController.cs`: 0 errors, 1 pre-existing validation warning.
- `Assets/Scripts/Prototype/RcsThrusterController.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: 0 errors, 2 pre-existing validation warnings.
- Unity console error query: 0 entries.

Result: PASS

## SAS Kill Rotation Axis Stop

Tool: Unity MCP `execute_code`

Generated ship fixture, `SasControlMode.KillRotation`, initial local angular rate `0.3500 rad/s`, `520` physics steps at `0.02s`, tolerance `0.0100 rad/s`.

```text
pass=True
pitch: initial=0.3500 rad/s final=0.0000 tolerance=0.0100 maxTorque=3678.7 maxRequest=3680.3 pass=True
yaw: initial=0.3500 rad/s final=0.0000 tolerance=0.0100 maxTorque=3679.4 maxRequest=3680.3 pass=True
roll: initial=0.3500 rad/s final=0.0000 tolerance=0.0100 maxTorque=3679.4 maxRequest=3680.3 pass=True
```

Result: PASS

## No Thruster Authority

Tool: Unity MCP `execute_code`

Generated ship fixture with RCS disabled. SAS should still produce request diagnostics, but no force/torque may be applied.

```text
pass=True
initialYaw=0.3500 finalYaw=0.3500 diff=0.000000 maxRawRequest=3680.3 maxMaskedRequest=3680.3 maxAppliedTorque=0.000000 maxApplications=0 rcsEnabled=False
```

Result: PASS

## Manual Axis Override

Tool: Unity MCP `execute_code`

Generated ship fixture with SAS enabled and manual yaw command `0.75`. Yaw SAS torque is masked, pitch/roll SAS torque remains, and manual yaw torque remains in the final allocator demand.

```text
pass=True
rawSas=(-2103.051, -2628.813, 1892.745) maskedSas=(-2103.051, 0.000, 1892.745) suppressed=(0.000, -2628.813, 0.000)
manualAxes=(0.0, 1.0, 0.0) releasedAxes=(1.0, 0.0, 1.0)
manualTorque=(0.000, 4381.355, 0.000) totalTorque=(-2103.051, 4381.355, 1892.745)
appliedTorque=(-2082.114, 4367.969, 1875.139) applications=6
```

Result: PASS

## Build

Command: `dotnet build "Weltraum Spiel.sln"`

Result: PASS, with existing Unity/MSB3277 and serialized-field warnings.

## Dotnet Test

Command: `dotnet test "Weltraum Spiel.sln"`

Result: PASS. The Unity-generated solution restores successfully and exits 0; no separate .NET test cases are discovered by this solution.

## Unity EditMode Tests

Tool: Unity MCP `run_tests(mode=EditMode)`

Job: `df4c00e90dbb4751b91ab41f74801836`

```text
total=25 passed=25 failed=0 skipped=0
resultState=Passed
```

Result: PASS
