# Test Protocol: prototype-rcs-force-allocator

Date: 2026-05-19
Execution: 53434097f5714395a65000eff174d0c9

## Review Triage

Accepted external review finding for this slice: the previous RCS controller applied translation, manual attitude, and SAS through independent paths. Unity MCP inspection of `Assets/Scripts/Prototype/RcsThrusterController.cs` confirmed `ApplyControls` called separate translation and attitude routines, attitude/SAS used per-axis nozzle passes, and attitude then applied a linear counter-force. This allowed the same nozzle to be selected more than once per physics step, made total axis force depend on matching nozzle count, and could oversubscribe physical nozzle thrust when translation and attitude were combined.

## Implementation Notes

Changed `Assets/Scripts/Prototype/RcsThrusterController.cs` to aggregate each physics step into one desired world-space force plus one desired world-space torque. Per-nozzle allocation rows are built from the live nozzle transform direction, world position, lever arm from `Rigidbody.worldCenterOfMass`, and max thrust from `RcsThrusterBlock.Thrust` with the existing fallback force scale.

The prototype allocator uses a dependency-free fixed-pass greedy residual reducer. It scores each nozzle by weighted residual force/torque reduction, clamps each nozzle throttle to `[0, 1]`, and then applies at most one `Rigidbody.AddForceAtPosition(force, position, ForceMode.Force)` per selected nozzle. Pure translation weights torque cancellation higher; pure attitude/SAS weights force cancellation higher; mixed commands use balanced weights. Attitude authority is derived from existing `attitudeForce` multiplied by a representative live nozzle lever arm so tuning remains close to the prior controller.

Preserved active nozzle IDs and VFX activation. Added diagnostics for max allocated nozzle throttle and nozzle application count, exposed through `PlayerShipController`, and displayed in `PrototypeDebugOverlay`.

## Unity MCP Validation

- `validate_script Assets/Scripts/Prototype/RcsThrusterController.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Scripts/Prototype/PlayerShipController.cs`: 0 errors, 1 existing validator warning about string concatenation in Update.
- `validate_script Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: 0 errors, 2 existing validator warnings about Rigidbody operations / string concatenation.
- `refresh_unity(scope=scripts, compile=request, wait_for_ready=true)`: compile requested; editor returned ready.
- `read_console(types=error, filter_text=CS)`: 0 C# compile errors after compile.

## Deterministic Allocator Probe

Unity MCP `execute_code` created a temporary symmetric RCS rig with 48 live nozzles, each with `RcsThrusterBlock` thrust 6500 N and a VFX child, then called `RcsThrusterController.ApplyControls` directly. The temporary rig was destroyed after the probe.

```text
+X translation: force=(8348.466,0.000,-0.001) |force|=8348.466; torque=(0.000,54.294,-54.296) |torque|=76.785; active=4; apps=4; maxThrottle=0.510501; idsNonEmpty=True; vfxActive=4
+Y translation: force=(0.000,8348.466,-0.001) |force|=8348.466; torque=(-54.294,0.000,54.296) |torque|=76.785; active=4; apps=4; maxThrottle=0.510501; idsNonEmpty=True; vfxActive=4
+Z translation: force=(0.000,0.000,8348.468) |force|=8348.468; torque=(54.293,-54.293,0.000) |torque|=76.782; active=2; apps=2; maxThrottle=0.644278; idsNonEmpty=True; vfxActive=2
+Pitch torque: force=(0.000,-0.459,-0.001) |force|=0.459; torque=(22515.050,-0.003,0.919) |torque|=22515.050; active=2; apps=2; maxThrottle=0.865999; idsNonEmpty=True; vfxActive=2
+Yaw torque: force=(0.459,0.000,-0.001) |force|=0.459; torque=(0.003,22515.050,0.919) |torque|=22515.050; active=3; apps=3; maxThrottle=0.865928; idsNonEmpty=True; vfxActive=3
+Roll torque: force=(0.000,0.458,-0.001) |force|=0.458; torque=(0.921,0.000,22515.050) |torque|=22515.050; active=3; apps=3; maxThrottle=0.865928; idsNonEmpty=True; vfxActive=3
Combined +X/+Yaw: force=(9002.220,0.000,-0.002) |force|=9002.220; torque=(0.000,22517.960,-0.196) |torque|=22517.960; active=8; apps=8; maxThrottle=0.923646; idsNonEmpty=True; vfxActive=8
SAS yaw brake: force=(-0.198,0.000,-0.001) |force|=0.198; torque=(0.001,-9726.500,-0.397) |torque|=9726.500; active=2; apps=2; maxThrottle=0.374111; idsNonEmpty=True; vfxActive=2
```

## Prototype Ship Probe

Main-agent Unity MCP `execute_code` then rebuilt the actual `PrototypeShip` through `PrototypeBootstrap.BuildPrototype()` and probed the generated 20-nozzle ship directly.

```text
InstalledNozzles=20 RcsEnabled=True TranslationTarget=9000 AttitudeForceSetting=6500
translation +X: force=(8999.629,0.000,-0.001) |F|=8999.629 torque=(0.000,0.001,-0.177) |T|=0.177 active=3/20 apps=3 maxThrottle=1.000000
translation +Y: force=(0.000,8998.729,-0.001) |F|=8998.729 torque=(-0.001,0.000,0.416) |T|=0.416 active=3/20 apps=3 maxThrottle=1.000000
translation +Z: force=(0.000,0.000,8999.746) |F|=8999.746 torque=(-0.122,0.000,0.000) |T|=0.122 active=2/20 apps=2 maxThrottle=0.692302
attitude pitch +: force=(0.000,0.000,-0.308) |F|=0.308 torque=(5831.846,0.000,0.000) |T|=5831.846 active=2/20 apps=2 maxThrottle=0.640886
attitude yaw +: force=(0.000,0.000,0.250) |F|=0.250 torque=(0.000,5832.436,0.000) |T|=5832.436 active=2/20 apps=2 maxThrottle=0.439871
attitude roll +: force=(0.000,-0.250,-0.001) |F|=0.250 torque=(0.000,0.000,5832.436) |T|=5832.436 active=2/20 apps=2 maxThrottle=0.439871
combined +X + yaw: force=(9000.453,0.000,0.023) |F|=9000.453 torque=(0.000,5833.191,0.646) |T|=5833.191 active=7/20 apps=7 maxThrottle=1.000000
SAS brakes yaw: force=(0.000,0.000,0.311) |F|=0.311 torque=(0.000,-3526.986,0.000) |T|=3526.986 active=2/20 apps=2 maxThrottle=0.266011
SUMMARY parityRatio=1.000113 maxTranslationTorque=0.416 maxAttitudeForce=0.308 minAttitudeTorque=5831.846 combinedMaxThrottle=1.000000 combinedApps=7 combinedActive=7 sasForce=0.311 sasTorque=3526.986
PASS parity=True translationTorque=True attitude=True combinedBudget=True sas=True diagnostics=True
```

## Acceptance Notes

- +X/+Y/+Z translation parity: symmetric rig all three probe axes produced approximately 8348.47 N; generated prototype ship produced approximately 8999 N on all three axes with parity ratio 1.000113.
- Pure translation residual torque: generated prototype ship stayed below 0.5 N*m.
- Pure pitch/yaw/roll: generated prototype ship produced nonzero torque on each axis with less than 0.31 N linear residual.
- Combined translation + attitude: max nozzle throttle stayed at or below 1.0, and application count matched active nozzle count.
- SAS yaw brake used the allocator path and produced approximately 0.311 N linear residual with nonzero braking torque on the generated prototype ship.
- Active nozzle ID diagnostics and VFX activation were non-empty for nonzero commands.

## Remaining Caveats

This is intentionally a bounded prototype allocator, not a full optimizer. It uses greedy residual reduction, so tiny residual force/torque remains even on symmetric layouts. The residuals are small in deterministic probes and no nozzle is oversubscribed.

## Follow-up Architecture Input

The user provided a larger physics-core direction while this spec was being verified: central `ShipPhysicsCore`, shared wrench requests, module mass/COM/inertia, fuel mass flow, SAS as a real control layer, and future environment/damage/docking/trajectory systems. That direction is accepted as future planning input, but it is intentionally not folded into this allocator spec because this change's scope is the minimal RCS per-nozzle allocator.

## Task Lines Ready To Toggle

Review Triage:
- Record accepted external review findings in test evidence
- Confirm current RCS paths still apply command groups independently
- Confirm current axis force disparity for +X/+Y/+Z
- Confirm combined translation + attitude can select the same nozzle more than once

Implementation:
- Refactor RcsThrusterController to collect desired force/torque before applying RCS forces
- Build per-nozzle allocation data from transform direction, COM lever arm, and max thrust
- Implement bounded prototype allocation with throttle values in [0, 1]
- Apply at most one AddForceAtPosition per selected nozzle
- Preserve active nozzle IDs and VFX activation
- Preserve or update debug diagnostics for total RCS force and torque
- Remove or bypass old per-axis additive force paths
- Add test evidence under this spec

Verification:
- Validate changed Unity scripts with Unity MCP
- Verify full +X/+Y/+Z translation net force parity within tolerance
- Verify pure translation has near-zero unintended torque
- Verify pure pitch/yaw/roll have near-zero linear drift and non-zero angular velocity
- Verify combined translation + attitude does not oversubscribe any nozzle
- Verify SAS uses allocator behavior and does not add linear drift
- Verify active nozzle/VFX diagnostics remain populated
- Confirm Unity console has no compile errors
