# Test Protocol: fix-wasd-sas-residual-momentum

Date: 2026-05-18

## Scope

- Changed `RcsThrusterController` thresholding only.
- Manual attitude commands keep the existing `0.05` command dead zone.
- SAS commands now zero by local angular velocity at `0.01 rad/s`, use a stronger response multiplier, and apply a small minimum braking command while outside that dead zone so residual braking below the manual dead zone still reaches nozzle selection decisively.
- `PrototypeDebugOverlay` was not changed because it already shows angular velocity, SAS command, active nozzle count, active nozzle ids, and estimated RCS torque.
- Updated `docs/physics-flight-model.md` to document the split between manual command dead zone and SAS angular-velocity dead zone.

## Unity MCP Validation

- `validate_script(uri: Assets/Scripts/Prototype/RcsThrusterController.cs, level: standard, include_diagnostics: true)`:
  - Result: success
  - Errors: 0
  - Warnings: 0
- `refresh_unity(scope: scripts, mode: force, compile: request, wait_for_ready: true)`:
  - Result: success
  - Compile requested: true
  - Final editor state: `ready_for_tools: true`, `is_compiling: false`, `is_domain_reload_pending: false`
- `read_console(action: get, types: error/warning, count: 20, format: detailed)` after stopping play mode, clearing console, and recompiling:
  - Errors: 0
  - Warnings: 1
  - Warning source: MCP-for-Unity transport warning, `[WebSocket] Unexpected receive error: WebSocket is not initialised`

## Unity MCP In-Memory Probe

Probe setup:

- Created a temporary in-memory `SasProbeShip` with `Rigidbody` damping set to zero and a `RcsThrusterController`.
- Added six temporary `RCS_Nozzle_*` transforms with valid pitch, yaw, and roll torque candidates.
- Called `ApplyControls` directly with zero manual attitude input.
- Removed the temporary object after the probe.

Results:

```text
SAS-off inertia avBefore=(0.08, -0.06, 0.03) avAfter=(0.08, -0.06, 0.03) sas=(0.00, 0.00, 0.00) torque=(0.00, 0.00, 0.00) active=0 pass=True
pitch 0.15 av=(0.15, 0.00, 0.00) sas=(-0.26, 0.00, 0.00) torque=(-3369.60, 0.00, 0.00) active=1 brakingDot=-505.44 pass=True
yaw 0.15 av=(0.00, 0.15, 0.00) sas=(0.00, -0.26, 0.00) torque=(0.00, -3369.60, 0.00) active=1 brakingDot=-505.44 pass=True
roll 0.15 av=(0.00, 0.00, 0.15) sas=(0.00, 0.00, -0.26) torque=(0.00, 0.00, -3369.60) active=1 brakingDot=-505.44 pass=True
pitch 0.08 av=(0.08, 0.00, 0.00) sas=(-0.14, 0.00, 0.00) torque=(-1797.12, 0.00, 0.00) active=1 brakingDot=-143.77 pass=True
yaw 0.08 av=(0.00, 0.08, 0.00) sas=(0.00, -0.14, 0.00) torque=(0.00, -1797.12, 0.00) active=1 brakingDot=-143.77 pass=True
roll 0.08 av=(0.00, 0.00, 0.08) sas=(0.00, 0.00, -0.14) torque=(0.00, 0.00, -1797.12) active=1 brakingDot=-143.77 pass=True
pitch 0.03 av=(0.03, 0.00, 0.00) sas=(-0.06, 0.00, 0.00) torque=(-780.00, 0.00, 0.00) active=1 brakingDot=-23.4 pass=True
yaw 0.03 av=(0.00, 0.03, 0.00) sas=(0.00, -0.06, 0.00) torque=(0.00, -780.00, 0.00) active=1 brakingDot=-23.4 pass=True
roll 0.03 av=(0.00, 0.00, 0.03) sas=(0.00, 0.00, -0.06) torque=(0.00, 0.00, -780.00) active=1 brakingDot=-23.4 pass=True
near-deadzone av=(0.01, 0.014, -0.015) sas=(0.00, -0.06, 0.06) torque=(0.00, -780.00, 780.00) active=2
manual 0.04 sasOff torque=(0.00, 0.00, 0.00) active=0
manual 0.06 sasOff torque=(780.00, 0.00, 0.00) active=1
sas below 0.01 av=(0.009,-0.009,0) sas=(0.00, 0.00, 0.00) torque=(0.00, 0.00, 0.00) active=0
```

## DevToolbox Validation

- `specs_validate(workspaceRoot: E:\Unity\Weltraum Spiel\Weltraum Spiel, changeName: fix-wasd-sas-residual-momentum)`:
  - Initial pre-implementation result: passed
  - Final result before task toggles: passed
- `verify_run(executionId: 08a63610f2364400aa0eb703814a9c87)`:
  - Specs step: passed
  - Build/Test/Lint steps: failed with `MSB1011` / multiple project or solution files at the Unity workspace root
  - Assessment: generic .NET root commands are not useful verifiers for this Unity slice; Unity MCP script validation, Unity compile/console check, in-memory probes, and `specs_validate` are the applicable checks.

## Notes

- A pre-clear console read while Unity was still in play mode showed scene-level `The referenced script (Unknown) on this Behaviour is missing!` errors. After exiting play mode, clearing the console, and recompiling scripts, no console errors were present.
