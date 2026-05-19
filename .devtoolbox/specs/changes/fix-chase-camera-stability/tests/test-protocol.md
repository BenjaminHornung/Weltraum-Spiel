# Test Protocol: fix-chase-camera-stability

Date: 2026-05-19

## Scope

- Changed `Assets/Scripts/Prototype/SimpleFollowCamera.cs` only.
- Mode 0 now computes its default chase offset from `target.forward` and `target.up`.
- Mode 0 look rotation now uses the ship up vector.
- Mouse-look offsets remain camera-only and reset clears them back to mode 0 chase.
- Existing mode cycling code path was preserved.
- Cinemachine was not introduced.

## Unity MCP Validation

- `validate_script(uri: Assets/Scripts/Prototype/SimpleFollowCamera.cs, level: standard, include_diagnostics: true)`:
  - Result: success
  - Errors: 0
  - Warnings: 0
- `refresh_unity(scope: scripts, mode: force, compile: request, wait_for_ready: true)`:
  - Result: success
  - Compile requested: true
  - Final editor state: `ready_for_tools: true`, `is_compiling: false`, `is_domain_reload_pending: false`
- `read_console(action: get, types: error, count: 20, format: detailed)` after clearing the console and recompiling:
  - Errors: 0

## Unity MCP Deterministic Probe

Probe setup:

- Created temporary in-memory target and camera objects in the Unity Editor.
- Added `SimpleFollowCamera` to the temporary camera and called `BindTarget`.
- Reflected the private desired-position and reset helpers to verify deterministic camera math without creating asset test scripts.
- Removed all temporary probe objects afterward.

Results:

```text
PASS default chase offset - delta=0.000 desired=(0.000, 6.000, -18.000) expected=(0.000, 6.000, -18.000)
PASS yaw follows ship forward/up - delta=0.000 desired=(-18.000, 6.000, 0.000) expected=(-18.000, 6.000, 0.000)
PASS pitch follows ship forward/up - delta=0.000 desired=(0.000, 16.971, -8.485) expected=(0.000, 16.971, -8.485)
PASS roll follows ship forward/up - delta=0.000 desired=(-6.000, 0.000, -18.000) expected=(-6.000, 0.000, -18.000)
PASS combined yaw/pitch/roll follows ship frame - delta=0.000 desired=(-11.792, 14.779, -1.593) expected=(-11.792, 14.779, -1.593)
PASS reset restores mode 0 - mode=0
PASS reset clears mouse look offsets - yaw=0.000 pitch=0.000
PASS reset returns chase offset - delta=0.000
PASS BindTarget stores target - target bound=True
PASS bootstrap-compatible camera binding - targetBound=True mode=0
```

## Notes

- A pre-clear console read showed repeated scene-level `The referenced script (Unknown) on this Behaviour is missing!` errors while the editor was already in play mode. After exiting play mode, clearing the console, and recompiling scripts, no console errors were present.
- The probe checks the bootstrap-compatible binding contract by verifying `SimpleFollowCamera.BindTarget` stores the target and starts in mode 0, matching the call used by `PrototypeBootstrap.SetupMainCamera`.
