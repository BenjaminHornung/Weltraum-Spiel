# Test Protocol: prototype-ship-physics-core

Date: 2026-05-19
Execution: 8b63df40ff0f4988a215ea68b26f8263
Unity instance: Weltraum Spiel@49c909b3e97ba6e8
Scene: Assets/Scenes/PrototypeBootstrapHost.unity

## Implementation Notes

- Added `ShipPhysicsCore` with a minimal serializable `ShipWrench` for per-step net applied force/torque diagnostics.
- `PrototypeBootstrap` now adds/configures `ShipPhysicsCore` on `PrototypeShip` using the same `Rigidbody` configured for the ship.
- `MainThrusterModule` keeps the current gameplay-stable mode: straight thrust is applied at COM through the core, and only gimbal steering delta is applied at the nozzle through the core.
- `RcsThrusterController` keeps allocator ownership, selected nozzle IDs, active VFX, max throttle, and application-count diagnostics. Final allocated nozzle forces now call `ShipPhysicsCore.ApplyForceAtPosition`.
- `PlayerShipController` resets core diagnostics once per `FixedUpdate` and exposes net core force/torque/application count.
- `PrototypeDebugOverlay` displays and can draw core net force/torque diagnostics.
- `README.md` and `docs/physics-flight-model.md` document the central physics-core direction and explicitly defer module COM/inertia, fuel mass flow, SAS PD, recoil, gravity, docking, damage, heat/power, and trajectory prediction.
- No projectile, camera, keybind, fuel, gravity, damage, docking, or package behavior was intentionally changed.

## Unity MCP Script Validation

Validated through `validate_script(level=standard)`:

- `Assets/Scripts/Prototype/ShipPhysicsCore.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/MainThrusterModule.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/RcsThrusterController.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/PrototypeBootstrap.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/PlayerShipController.cs`: 0 errors, 1 validator warning: existing generic string-concatenation/GC warning.
- `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: 0 errors, 2 validator warnings: existing generic FixedUpdate/Rigidbody and string-concatenation/GC warnings.

Unity console after refresh/probe:

- `refresh_unity(scope=scripts, compile=request, wait_for_ready=true)`: compile requested; editor returned ready.
- `read_console(types=[error], filter_text=CS, count=20)`: 0 C# error log entries.
- Editor state after validation: `ready_for_tools=true`, `is_compiling=false`, `is_domain_reload_pending=false`.

## Worker Deterministic Unity MCP Probe

Worker probe executed in editor through Unity MCP `execute_code` after `PrototypeBootstrap.BuildPrototype()`.

```text
bootstrap.shipExists=True
bootstrap.coreExists=True
bootstrap.coreHasSameRb=True
bootstrap.player=True, gun=True, camera=True, follow=True, overlay=True
main.applied=45000.000
main.coreForce=(0.0000, 0.0000, 45000.0000)
main.coreTorqueMag=0.000000
main.coreApplications=1
rcs.translate+X.forceMag=9000.000, coreTorqueMag=0.176821, maxThrottle=1.000000, applications=3, active=3
rcs.translate+Y.forceMag=9000.000, coreTorqueMag=0.415772, maxThrottle=1.000000, applications=3, active=3
rcs.translate+Z.forceMag=9000.000, coreTorqueMag=0.121826, maxThrottle=0.692302, applications=2, active=2
rcs.translationParityDelta=0.000000
rcs.pitch.coreForceMag=0.308106, coreTorqueMag=5831.846000, maxThrottle=0.640886, applications=2, active=2
rcs.yaw.coreForceMag=0.249512, coreTorqueMag=5832.436000, maxThrottle=0.439871, applications=2, active=2
rcs.roll.coreForceMag=0.249513, coreTorqueMag=5832.436000, maxThrottle=0.439871, applications=2, active=2
rcs.combined.maxThrottle=0.799408, applications=11, active=11, installed=20, oversub=False
```

## Main-Agent Deterministic Unity MCP Probe

Main-agent verification rebuilt the actual `PrototypeShip`, checked that all core gameplay objects still exist, then called main thrust and RCS directly.

```text
core exists=True coreRefsRb=True hasPlayer=True hasGun=True hasCamera=True hasFollow=True hasOverlay=True
main throttle-only: thrust=22500.000 mainTorque=0.000000 coreForce=22500.000 coreTorque=0.000000 coreApps=1
translation +X: rcsForce=(8999.629,0.000,-0.001) |RF|=8999.629 rcsTorque=(0.000,0.001,-0.177) |RT|=0.177 coreForce=(8999.629,0.000,-0.001) |CF|=8999.629 coreTorque=(0.000,0.001,-0.177) |CT|=0.177 active=3/20 apps=3 maxThrottle=1.000000
translation +Y: rcsForce=(0.000,8998.729,-0.001) |RF|=8998.729 rcsTorque=(-0.001,0.000,0.416) |RT|=0.416 coreForce=(0.000,8998.729,-0.001) |CF|=8998.729 coreTorque=(-0.001,0.000,0.416) |CT|=0.416 active=3/20 apps=3 maxThrottle=1.000000
translation +Z: rcsForce=(0.000,0.000,8999.746) |RF|=8999.746 rcsTorque=(-0.122,0.000,0.000) |RT|=0.122 coreForce=(0.000,0.000,8999.746) |CF|=8999.746 coreTorque=(-0.122,0.000,0.000) |CT|=0.122 active=2/20 apps=2 maxThrottle=0.692302
attitude pitch +: rcsForce=(0.000,0.000,-0.308) |RF|=0.308 rcsTorque=(5831.846,0.000,0.000) |RT|=5831.846 coreForce=(0.000,0.000,-0.308) |CF|=0.308 coreTorque=(5831.846,0.000,0.000) |CT|=5831.846 active=2/20 apps=2 maxThrottle=0.640886
attitude yaw +: rcsForce=(0.000,0.000,0.250) |RF|=0.250 rcsTorque=(0.000,5832.436,0.000) |RT|=5832.436 coreForce=(0.000,0.000,0.250) |CF|=0.250 coreTorque=(0.000,5832.436,0.000) |CT|=5832.436 active=2/20 apps=2 maxThrottle=0.439871
attitude roll +: rcsForce=(0.000,-0.250,-0.001) |RF|=0.250 rcsTorque=(0.000,0.000,5832.436) |RT|=5832.436 coreForce=(0.000,-0.250,-0.001) |CF|=0.250 coreTorque=(0.000,0.000,5832.436) |CT|=5832.436 active=2/20 apps=2 maxThrottle=0.439871
combined +X + yaw: rcsForce=(9000.453,0.000,0.023) |RF|=9000.453 rcsTorque=(0.000,5833.191,0.646) |RT|=5833.191 coreForce=(9000.453,0.000,0.023) |CF|=9000.453 coreTorque=(0.000,5833.191,0.646) |CT|=5833.191 active=7/20 apps=7 maxThrottle=1.000000
SUMMARY mainOk=True parityRatio=1.000113 maxTranslationTorque=0.416 maxAttitudeForce=0.308 minAttitudeTorque=5831.846 combinedMaxThrottle=1.000000 combinedApps=7 combinedActive=7 coreFirstTranslationForce=8999.629 coreFirstTranslationTorque=0.177
PASS bootstrap=True main=True parity=True translationTorque=True attitude=True combinedBudget=True
```

## Results

- Bootstrap creates `ShipPhysicsCore`: PASS.
- Core references same ship `Rigidbody`: PASS.
- Throttle-only main thrust routes through core and has near-zero unintended torque: PASS, `coreTorque=0.000000`.
- RCS +X/+Y/+Z translation parity within tolerance: PASS, main-agent `parityRatio=1.000113`.
- Pure RCS translation near-zero unintended torque: PASS, max observed diagnostic torque `0.416 N*m` against roughly `9000 N` force scale.
- Pure RCS pitch/yaw/roll near-zero linear drift and nonzero torque: PASS, force magnitude `<= 0.308 N`, torque magnitude `>= 5831.846 N*m`.
- Combined RCS translation+attitude no nozzle oversubscription: PASS, application count matched active nozzle count and max throttle stayed `<= 1.0`.
- Bootstrap/camera/gun/overlay still present: PASS.
- RCS VFX/nozzle diagnostics preserved: PASS, active nozzle counts and application counts still reported by controller.

## Remaining Caveats

- Unity MCP validator still reports non-blocking generic warnings in `PlayerShipController` and `PrototypeDebugOverlay`; no C# errors were present.
- This is intentionally a narrow prototype core. It centralizes current force application and telemetry but does not introduce module mass/COM/inertia, fuel mass flow, SAS PD, recoil, gravity, docking, damage, or trajectory prediction.
