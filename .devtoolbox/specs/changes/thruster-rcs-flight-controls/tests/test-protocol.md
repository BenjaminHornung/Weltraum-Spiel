# Test Protocol: thruster-rcs-flight-controls

Date: 2026-05-18

## Unity MCP Compile

- `refresh_unity` with script compile requested: completed.
- `read_console` filtered to `error`: 0 entries.
- Remaining console warning observed separately was MCP transport-only (`MCP-FOR-UNITY WebSocket`), not a project script warning.

## Unity MCP Play Probe

Runtime probe from `Assets/Scenes/PrototypeBootstrapHost.unity`:

- Bootstrap: `PrototypeShip`, hull scale `(1.80, 1.10, 6.00)`, 4 RCS blocks, 20 RCS nozzles, camera/follow/overlay/light present.
- Main thrust: straight torque `0.000000`, forward force `45000.0`, gimbal angle `20.000`.
- RCS yaw at zero main throttle: torque dot ship-up `13510.380`, active nozzles `3`.
- Active yaw nozzle removal: count `20 -> 19`, yaw torque `13510.380 -> 6875.587`, changed `True`.
- RCS VFX: active during yaw `True`, active after clear `False`.
- SAS/inertia direct probe: SAS off command `0.000`, angular velocity after SAS-off call `1.250`; SAS on command `0.540`, SAS torque `7295.733`.
- Scripted physics SAS simulation: before `1.250`, after SAS on `1.024`, after SAS off `1.250`, on reduced `True`, off preserved `True`.
- Linear inertia: velocity after release/no-control call `12.000`.
- Gun/projectile: projectile delta `+1`.
- Mouse attitude input removed from `PlayerShipController`; mouse orbit/look is handled in `SimpleFollowCamera`.

## Unity MCP Review-Fix Probe

Runtime review-fix probe from `Assets/Scenes/PrototypeBootstrapHost.unity`:

- Compile/console: `read_console` filtered to `error`: 0 entries after script edits.
- Default bootstrap regression: 4 RCS blocks, 20 RCS nozzles, 20 installed active solver candidates.
- Disabled active nozzle: baseline active nozzles `3`, yaw torque `13510.380`; after disabling selected active nozzle, installed active candidates `19`, active nozzles `2`, yaw torque `6875.587`, `stillSelected=False`.
- Removed active nozzle: installed active candidates `19`, active nozzles `2`, yaw torque `6875.587`; solver output changed from baseline.
- Diagonal main gimbal: physics angle `19.897` degrees, visual angle `19.897` degrees.
- RCS VFX colliders: default VFX objects `20`, enabled VFX colliders `0`; during yaw active VFX `2`, active colliders `0`, inactive colliders `0`.
- Quick regressions: straight thrust torque `0.000000`, yaw RCS torque `6875.587` after one nozzle removal, gun fired `True`, projectile delta `+1`.

## DevToolbox

- `specs_validate` for `thruster-rcs-flight-controls`: passed, 66 task items parsed.
- Review-fix `specs_validate` for `thruster-rcs-flight-controls`: passed, 66 task items parsed.
