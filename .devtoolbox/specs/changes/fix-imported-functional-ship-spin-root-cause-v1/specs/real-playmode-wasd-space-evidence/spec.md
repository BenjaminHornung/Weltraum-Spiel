# Capability: Real PlayMode WASD Space Evidence

## Requirement
The regression must be verified in Unity PlayMode with the actual `PlayerShipController` path and imported/default Blender scout visual.

## Expected Behavior
- Evidence runs in `Assets/Scenes/PrototypeBootstrapHost.unity`.
- The default imported scout is selected or rebuilt before movement checks.
- The test path exercises `Input/test hook -> PlayerShipController -> ApplyControls -> StablePrototype RCS -> ShipPhysicsCore`.
- Evidence records numeric diagnostics for idle, translation, attitude, SAS, main thrust, visual switching, and Space/fire.
- Evidence writes logs, CSV, protocol, and screenshots under this change.

## Required Artifacts
- `tests/test-protocol.md`
- `tests/logs/flight-spin-root-cause.log`
- `tests/performance/flight-control-spin-diagnostics.csv`
- `tests/screenshots/idle-sas-on.png`
- `tests/screenshots/translation-forward.png`
- `tests/screenshots/translation-left-right.png`
- `tests/screenshots/normal-attitude-sas-on.png`
- `tests/screenshots/imported-ship-translation.png`

## Scenarios
- WASD no longer causes wild spin.
- Space/fire no longer causes wild spin.
- F6 visual switching after movement does not remove Rigidbody, controller, RCS, camera binding, or stable nozzles.
