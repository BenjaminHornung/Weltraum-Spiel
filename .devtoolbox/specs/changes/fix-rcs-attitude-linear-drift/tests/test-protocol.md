# Test Protocol: fix-rcs-attitude-linear-drift

Execution: `8b1b6aeae9e74736adb6d7cfa586d0c4`

## Environment

- Unity MCP instance: `Weltraum Spiel@49c909b3e97ba6e8`
- Unity version: `6000.4.7f1`
- Scene: `Assets/Scenes/PrototypeBootstrapHost.unity`
- Target object: `PrototypeShip`
- Target script: `Assets/Scripts/Prototype/RcsThrusterController.cs`
- Probe setup: scripted Unity physics, `Physics.simulationMode = Script`, gravity disabled for probe, rigidbody reset to rest before each axis, 50 steps at `0.02s`.

## Reproduction Before Fix

Pure attitude commands from rest produced angular velocity, but pitch/yaw also produced large linear velocity and non-zero attitude force totals.

| Probe | Linear Velocity Magnitude | Angular Velocity Magnitude | Last Force At Position Total | Active Nozzles |
| --- | ---: | ---: | --- | --- |
| Pitch `attitude=(1,0,0)` | `1.869606` | `0.830793` | `(13.155, -6486.044, -404.799)` | 3 |
| Yaw `attitude=(0,1,0)` | `1.770332` | `1.149923` | `(5238.943, -1057.595, -3136.811)` | 3 |
| Roll `attitude=(0,0,1)` | `0.200828` | `17.740560` | `(1459.598, -1230.680, 452.397)` | 5 |

Root cause: attitude nozzle selection applies force at nozzle positions using `Rigidbody.AddForceAtPosition`. The selected nozzles create the intended torque, but their summed force is not zero, so pure pitch/yaw attitude commands also accelerate the rigidbody linearly.

## Fix

`RcsThrusterController.ApplyTorqueDemand` now accumulates the selected attitude nozzle forces and applies an equal opposite force at the rigidbody center of mass. This preserves selected nozzle IDs, VFX activation, and torque estimate while neutralizing net linear attitude force. Translation control still uses the existing COM-neutral `AddForce` path.

## Verification After Fix

Same deterministic probe after the change:

| Probe | Linear Velocity Magnitude | Angular Velocity Magnitude | Last Force At Position Total | Active Nozzles |
| --- | ---: | ---: | --- | --- |
| Pitch `attitude=(1,0,0)` | `0.000000` | `0.830793` | `(0.000, 0.000, 0.000)` | 3 |
| Yaw `attitude=(0,1,0)` | `0.000000` | `1.149923` | `(0.000, 0.000, 0.000)` | 3 |
| Roll `attitude=(0,0,1)` | `0.000000` | `17.740560` | `(0.000, 0.000, 0.000)` | 5 |
| Translate `translation=(1,0,0)` | `5.653173` | `0.000000` | `(19500.000, -0.324, -1.087)` | 3 |
| Translate `translation=(0,1,0)` | `5.653173` | `0.000000` | `(-0.062, 18352.590, -6590.330)` | 3 |
| Translate `translation=(0,0,1)` | `7.537569` | `0.000000` | `(1.508, 8787.102, 24470.120)` | 4 |

Active nozzle diagnostics remained populated. Examples:

- Pitch: `RCS_Nozzle_RCS_Top_Forward, RCS_Nozzle_RCS_Bottom_Back, RCS_Nozzle_RCS_Bottom_Down`
- Yaw: `RCS_Nozzle_RCS_Left_Forward, RCS_Nozzle_RCS_Right_Back, RCS_Nozzle_RCS_Right_Right`
- Roll: `RCS_Nozzle_RCS_Top_Left, RCS_Nozzle_RCS_Bottom_Right, RCS_Nozzle_RCS_Left_Left, RCS_Nozzle_RCS_Left_Down, RCS_Nozzle_RCS_Right_Up`

SAS braking probe:

- Initial local angular velocity: `(0.050000, -0.040000, 0.030000)`
- Before simulate: `LastSasCommand=(-0.086400, 0.069120, -0.060000)`, `LastTorque=(-809.098, 427.980, -1585.410)`, `LastForceAtPositionTotal=(0.000, 0.000, 0.000)`, active nozzles: 10
- After 1 step: linear velocity magnitude `0.000000`, local angular velocity `(0.048564, -0.038573, 0.008736)`

## Unity MCP Validation

- `validate_script` on `Assets/Scripts/Prototype/RcsThrusterController.cs`: 0 diagnostics, 0 warnings, 0 errors.
- Unity console after clearing stale editor messages and rerunning probes: 0 error entries.
- Script SHA after edit: `37d8a0b490e380e74a658c270c075c120695c62b57b6d4989f5891c4b21e3925`.

## Main-Agent Follow-up Verification

The main orchestration agent reran Unity MCP validation after the backend-worker implementation:

```text
validate_script Assets/Scripts/Prototype/RcsThrusterController.cs:
warnings: 0
errors: 0

refresh_unity scripts compile request:
ready after follow-up poll

read_console(types=["error"], filter_text="CS"):
0 entries
```

The final console also contained seven pre-existing `The referenced script (Unknown) on this Behaviour is missing!` entries without `CS` compile diagnostics. Those are scene/reference issues outside this spec and were not treated as compile failures.

The main-agent deterministic probe against the live `PrototypeShip` returned:

```text
allOk=True
attitude pitch+: linear=0.000000, angular=0.073954, forceTotal=(0.000, 0.000, 0.000), active=5
attitude pitch-: linear=0.000000, angular=0.016642, forceTotal=(0.000, 0.000, 0.000), active=3
attitude yaw+: linear=0.000000, angular=0.023034, forceTotal=(0.000, 0.000, 0.000), active=3
attitude yaw-: linear=0.000000, angular=0.023033, forceTotal=(0.000, 0.000, 0.000), active=3
attitude roll+: linear=0.000000, angular=0.355335, forceTotal=(0.000, 0.000, 0.000), active=5
attitude roll-: linear=0.000000, angular=0.355333, forceTotal=(0.000, 0.000, 0.000), active=5
translation +X/+Y/+Z: angular=0.000000, lastTorque=0.000000
sas brake: linear=0.000000, active=10
```

## Ready Task Lines

Ready to toggle after review:

- `Reproduce WASD pitch/yaw linear drift with Unity MCP`
- `Compare Q/E roll behavior as control case`
- `Identify whether drift comes from non-zero net attitude force, selected nozzle layout, or diagnostics mismatch`
- `Update RCS attitude force application to avoid linear drift`
- `Preserve pitch/yaw/roll torque behavior`
- `Preserve translation COM-neutral behavior`
- `Preserve selected RCS nozzle/VFX diagnostics`
- `Add test evidence under this spec`
- `Validate changed Unity scripts with Unity MCP`
- `Verify pure pitch from rest creates angular velocity and near-zero linear velocity`
- `Verify pure yaw from rest creates angular velocity and near-zero linear velocity`
- `Verify pure roll remains functional and near-zero linear velocity`
- `Verify pure RCS translation still has zero unintended torque`
- `Verify SAS attitude braking does not add linear drift`
- `Confirm Unity console has no compile errors`
