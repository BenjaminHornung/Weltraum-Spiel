# Flight Control WASD/RCS Jitter Regression v2 Test Protocol

## Required Procedure
- Open `Assets/Scenes/PrototypeBootstrapHost.unity`.
- Enter Unity Play Mode.
- Select `ImportedDemoScout` when available, otherwise `ImportedDemoCargo`.
- Reset flight state before each movement block: zero position offset, identity rotation, zero linear/angular velocity, main throttle 0, RCS enabled, external assist cleared, autopilot/momentum assist disabled, weapon stabilization idle, and camera snapped to ChaseLocked.
- Drive input through `PlayerShipController` test hooks or equivalent Unity input so the same command construction and `FixedUpdate` path is exercised.

## Required Evidence
- `logs/unity-playmode-flight-control.log`
- `performance/flight-control-diagnostics.csv`
- `screenshots/idle-sas-on.png`
- `screenshots/translation-forward.png`
- `screenshots/translation-left-right.png`
- `screenshots/normal-attitude-sas-on.png`
- `screenshots/imported-ship-translation.png`

## Required CSV Columns
`time,visualMode,controlMode,sasEnabled,rcsEnabled,hasExternalAssist,externalAssistSource,rcsTranslationCommand.x,rcsTranslationCommand.y,rcsTranslationCommand.z,rcsAttitudeCommand.x,rcsAttitudeCommand.y,rcsAttitudeCommand.z,linearVelocity.x,linearVelocity.y,linearVelocity.z,angularVelocity.x,angularVelocity.y,angularVelocity.z,desiredForce.x,desiredForce.y,desiredForce.z,actualForce.x,actualForce.y,actualForce.z,residualForce.x,residualForce.y,residualForce.z,desiredTorque.x,desiredTorque.y,desiredTorque.z,actualTorque.x,actualTorque.y,actualTorque.z,residualTorque.x,residualTorque.y,residualTorque.z,allocatorStatus,activeNozzleCount,installedNozzleCount,mainThrottle,mainThrustCommand,cameraAnchorError,visualBoundsRefreshCount,nozzleRefreshCount`

## Passing Criteria
- Translation moves visibly and stably in expected directions with bounded angular velocity.
- Normal attitude rotates controllably without unintended translation or jitter escalation.
- SAS on damps after release; SAS off drifts physically without spin.
- Imported visual and F6 switching preserve Rigidbody, controller, RCS, main thruster, and camera binding.
- No stale external assist blocks manual input.
