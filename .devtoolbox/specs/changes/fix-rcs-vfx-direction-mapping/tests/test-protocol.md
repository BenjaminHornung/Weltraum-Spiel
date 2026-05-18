# Test Protocol: fix-rcs-vfx-direction-mapping

Date: 2026-05-18

## Change

- `PrototypeBootstrap.EnsureRcsNozzle` now places RCS `VFX` at `Vector3.back * 0.18f`.
- `PrototypeBootstrap.EnsureRcsNozzle` now rotates RCS `VFX` with `Quaternion.Euler(0f, 180f, 0f)`.
- RCS force/nozzle selection and controls were not changed.
- `docs/physics-flight-model.md` documents: nozzle forward = force direction; visual exhaust = opposite nozzle forward.

## Unity MCP Validation

- `validate_script` on `Assets/Scripts/Prototype/PrototypeBootstrap.cs`: pass, 0 errors, 0 warnings.
- `refresh_unity` with script compile request: pass; editor returned to idle/ready.
- `read_console` after compile: 0 compile errors. One existing MCP transport warning remained: `[WebSocket] Unexpected receive error: WebSocket is not initialised`.

## Deterministic RCS/VFX Probe

Unity MCP `execute_code` built `PrototypeShip`, applied commands through `RcsThrusterController.ApplyControls`, then compared:

- selected nozzle IDs from `RcsThrusterController.ActiveNozzleIds`
- active `VFX` GameObjects under `RCS_Nozzle_*`
- `Vector3.Dot(vfx.forward.normalized, (-nozzle.forward).normalized)`
- `Vector3.Distance(vfx.localPosition, Vector3.back * 0.18f)`

### Translation +X

- selected: `RCS_Nozzle_RCS_Top_Right, RCS_Nozzle_RCS_Bottom_Right, RCS_Nozzle_RCS_Right_Right`
- selected count: 3
- active VFX count: 3
- selected IDs match active VFX IDs: true
- min dot VFX forward vs negative nozzle forward: `1.000000`
- max forward error: `0.000000`
- max local position error: `0.000000`
- repeat selected IDs: unchanged

### Manual Yaw +Y

- selected: `RCS_Nozzle_RCS_Left_Forward, RCS_Nozzle_RCS_Right_Back, RCS_Nozzle_RCS_Right_Right`
- selected count: 3
- active VFX count: 3
- selected IDs match active VFX IDs: true
- min dot VFX forward vs negative nozzle forward: `1.000000`
- max forward error: `0.000000`
- max local position error: `0.000000`
- repeat selected IDs: unchanged

### SAS Yaw Counter

- input angular velocity: local `(0, 0.35, 0)` rad/s
- selected: `RCS_Nozzle_RCS_Left_Back, RCS_Nozzle_RCS_Left_Left, RCS_Nozzle_RCS_Right_Forward`
- selected count: 3
- active VFX count: 3
- selected IDs match active VFX IDs: true
- min dot VFX forward vs negative nozzle forward: `1.000000`
- max forward error: `0.000000`
- max local position error: `0.000000`
- repeat selected IDs: unchanged
- `LastSas`: `(0.000, -0.605, 0.000)`

## DevToolbox

- Initial `specs_validate` before implementation: pass, 24 parsed tasks.
- Final `specs_validate` after implementation and task toggles: pass.

## Limitations

- Verification was an editor-side deterministic MCP probe, not a human visual playthrough.
- Console contained one pre-existing MCP transport warning unrelated to the script compile result.
