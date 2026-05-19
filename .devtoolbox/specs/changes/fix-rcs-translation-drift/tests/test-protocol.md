# Test Protocol: fix-rcs-translation-drift

Execution id: `cdd4fea243744a048e4afe9ac9cab049`

Date: 2026-05-19

## Implementation Evidence

- Changed `Assets/Scripts/Prototype/RcsThrusterController.cs`.
- Verified Unity API signatures through Unity MCP reflection:
  - `Rigidbody.AddForce(Vector3 force, ForceMode mode)`
  - `Rigidbody.AddForceAtPosition(Vector3 force, Vector3 position, ForceMode mode)`
- Translation RCS keeps selected nozzles active for diagnostics/VFX but applies physical translation force through `Rigidbody.AddForce`.
- Attitude RCS still applies nozzle-position forces through `Rigidbody.AddForceAtPosition` and records estimated torque.
- Translation-only diagnostics report `LastTranslationForce` while leaving `LastTorque` at zero because no translation torque is applied.

## Unity MCP Script Validation

Unity MCP `validate_script` on `Assets/Scripts/Prototype/RcsThrusterController.cs`:

```text
success: true
warnings: 0
errors: 0
diagnostics: []
```

Unity MCP `validate_script` on `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`:

```text
success: true
warnings: 2
errors: 0
diagnostics:
- Consider using FixedUpdate() for Rigidbody operations
- String concatenation in Update() can cause garbage collection issues
```

Unity MCP console check:

```text
read_console(types=["error"], count=20): 7 entries
message: The referenced script (Unknown) on this Behaviour is missing!
read_console(types=["error"], filter_text="CS", count=20): 0 entries
```

No compile errors were reported by script validation or the console `CS` error filter. The remaining console errors are missing-script scene/reference errors and were not introduced by compilation.

## Deterministic Runtime Probe

Probe setup:

- Entered Play Mode through Unity MCP.
- Used the runtime `PrototypeShip` object with its installed `RcsThrusterController`.
- Disabled gravity on the ship Rigidbody during the probe, reset linear/angular velocity to zero before each case, and restored Rigidbody state afterward.
- Switched `Physics.simulationMode` to `Script`, called `RcsThrusterController.ApplyControls(...)`, and ran one `Physics.Simulate(0.02f)` step.
- Ran all six local translation axes with SAS off and SAS on.
- Ran a separate yaw-attitude command to verify attitude torque still uses off-center nozzle forces.

Translation results:

```text
SAS off
+X velLocal=(0.113044, 0.000000, 0.000000) lateral=0.000000 angMag=0.000000000 LastTranslationForce=(19500.000, -0.001, -0.002) LastTorque=(0.000000, 0.000000, 0.000000) Active=3
-X velLocal=(-0.113044, 0.000000, 0.000000) lateral=0.000000 angMag=0.000000000 LastTranslationForce=(-19500.000, 0.001, -0.002) LastTorque=(0.000000, 0.000000, 0.000000) Active=3
+Y velLocal=(0.000000, 0.113044, 0.000000) lateral=0.000000 angMag=0.000000000 LastTranslationForce=(0.001, 19500.000, -0.002) LastTorque=(0.000000, 0.000000, 0.000000) Active=3
-Y velLocal=(0.000000, -0.113044, 0.000000) lateral=0.000000 angMag=0.000000000 LastTranslationForce=(-0.001, -19500.000, -0.002) LastTorque=(0.000000, 0.000000, 0.000000) Active=3
+Z velLocal=(0.000000, 0.000000, 0.150725) lateral=0.000000 angMag=0.000000000 LastTranslationForce=(0.000, 0.000, 26000.000) LastTorque=(0.000000, 0.000000, 0.000000) Active=4
-Z velLocal=(0.000000, 0.000000, -0.150725) lateral=0.000000 angMag=0.000000000 LastTranslationForce=(0.000, 0.000, -26000.000) LastTorque=(0.000000, 0.000000, 0.000000) Active=4

SAS on
+X velLocal=(0.113044, 0.000000, 0.000000) lateral=0.000000 angMag=0.000000000 LastTranslationForce=(19500.000, -0.001, -0.002) LastTorque=(0.000000, 0.000000, 0.000000) Active=3
-X velLocal=(-0.113044, 0.000000, 0.000000) lateral=0.000000 angMag=0.000000000 LastTranslationForce=(-19500.000, 0.001, -0.002) LastTorque=(0.000000, 0.000000, 0.000000) Active=3
+Y velLocal=(0.000000, 0.113044, 0.000000) lateral=0.000000 angMag=0.000000000 LastTranslationForce=(0.001, 19500.000, -0.002) LastTorque=(0.000000, 0.000000, 0.000000) Active=3
-Y velLocal=(0.000000, -0.113044, 0.000000) lateral=0.000000 angMag=0.000000000 LastTranslationForce=(-0.001, -19500.000, -0.002) LastTorque=(0.000000, 0.000000, 0.000000) Active=3
+Z velLocal=(0.000000, 0.000000, 0.150725) lateral=0.000000 angMag=0.000000000 LastTranslationForce=(0.000, 0.000, 26000.000) LastTorque=(0.000000, 0.000000, 0.000000) Active=4
-Z velLocal=(0.000000, 0.000000, -0.150725) lateral=0.000000 angMag=0.000000000 LastTranslationForce=(0.000, 0.000, -26000.000) LastTorque=(0.000000, 0.000000, 0.000000) Active=4
```

Active translation nozzle IDs observed:

```text
+X: RCS_Nozzle_RCS_Top_Right, RCS_Nozzle_RCS_Bottom_Right, RCS_Nozzle_RCS_Right_Right
-X: RCS_Nozzle_RCS_Top_Left, RCS_Nozzle_RCS_Bottom_Left, RCS_Nozzle_RCS_Left_Left
+Y: RCS_Nozzle_RCS_Top_Up, RCS_Nozzle_RCS_Left_Up, RCS_Nozzle_RCS_Right_Up
-Y: RCS_Nozzle_RCS_Bottom_Down, RCS_Nozzle_RCS_Left_Down, RCS_Nozzle_RCS_Right_Down
+Z: RCS_Nozzle_RCS_Top_Forward, RCS_Nozzle_RCS_Bottom_Forward, RCS_Nozzle_RCS_Left_Forward, RCS_Nozzle_RCS_Right_Forward
-Z: RCS_Nozzle_RCS_Top_Back, RCS_Nozzle_RCS_Bottom_Back, RCS_Nozzle_RCS_Left_Back, RCS_Nozzle_RCS_Right_Back
```

Attitude result:

```text
Attitude yaw +Y
velLocal=(0.035655, 0.000000, 0.000016)
angLocal=(0.000000079, 0.022955280, 0.000456685)
angMag=0.022959820
LastTranslationForce=(0.000, 0.000, 0.000)
LastTorque=(0.001, 13489.960, -78.971)
Active=3
Ids=RCS_Nozzle_RCS_Left_Forward, RCS_Nozzle_RCS_Right_Back, RCS_Nozzle_RCS_Right_Right
```

## Acceptance Mapping

- Pure RCS translation on all local axes accelerates along the commanded local axis: pass.
- Pure RCS translation on all local axes leaves angular velocity at zero with SAS off: pass.
- Pure RCS translation on all local axes leaves angular velocity at zero with SAS on: pass.
- RCS attitude commands still produce intentional torque: pass.
- RCS translation VFX/nozzle selection still activates: pass, every translation row has active nozzle count and active nozzle IDs.
- Diagnostics do not report translation-created torque as applied rotational torque after neutralization: pass, every translation row has `LastTorque=(0,0,0)`.

## Main-Agent Follow-up Verification

After the backend-worker implementation, the main orchestration agent reran Unity MCP validation:

```text
validate_script Assets/Scripts/Prototype/RcsThrusterController.cs:
warnings: 0
errors: 0

refresh_unity scripts compile request:
ready / idle after follow-up poll

read_console(types=["error"]):
0 entries
```

A second deterministic probe created a temporary Rigidbody/RCS setup through Unity MCP and simulated all local translation axes:

```text
allOk=True
translation +/-X +/-Y +/-Z, SAS off/on:
along velocity > 0, lateral=0.000000, angular=0.000000, lastTorque=0.000000, activeNozzles>0, activeVfx>0

attitude yaw:
angular=2.337660, lastTorque=19500.000000, activeNozzles=2
```

ServiceRunner `verify_fresh` was also attempted. It passed spec validation but failed the generic .NET Build/Test/Lint steps with the known Unity-root `MSB1011` issue because the folder contains multiple project/solution files and the command does not select a Unity workspace. The applicable verification for this Unity-script change is the Unity MCP validation above.
