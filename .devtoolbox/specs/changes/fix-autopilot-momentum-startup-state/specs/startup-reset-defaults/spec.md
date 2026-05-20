# Capability: Startup Reset Defaults

## Requirements

- On every `PrototypeBootstrap.BuildPrototype()` run, the prototype ship must be reset to a deterministic spawn state even when an existing `PrototypeShip` is reused.
- The ship transform must be set to `shipStartPosition` and identity rotation unless the bootstrap configuration explicitly provides another spawn rotation.
- The ship `Rigidbody` must have zero `linearVelocity` and zero `angularVelocity` after bootstrap reset.
- Main throttle must be zero after bootstrap reset.
- External assist requests must be cleared after bootstrap reset.
- Waypoint autopilot and momentum assist must be aborted or reset to inactive after bootstrap reset.
- Control mode must be `Normal` / Cruise after bootstrap reset.
- RCS must be enabled after bootstrap reset.
- SAS must be enabled by default after bootstrap reset.
- SAS target rotation must be captured after the reset rotation is applied.

## Constraints

- Direct velocity assignment is allowed for this spawn/bootstrap reset only.
- Runtime assists such as Kill Momentum must not use direct velocity zeroing.
- Reset behavior must be testable in EditMode without requiring a hand-authored scene.

## Acceptance

- Rebuilding the prototype on an existing moving ship clears linear and angular velocity.
- Rebuilding resets throttle to zero and mode to Normal.
- Rebuilding leaves RCS and SAS enabled.
- Before player input, reported speed is exactly zero within Unity float tolerance.