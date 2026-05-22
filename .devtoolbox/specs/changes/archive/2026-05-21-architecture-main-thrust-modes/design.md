# Design: Architecture Main Thrust Modes

## Decision

Represent main engine force behavior with an explicit enum rather than a hidden boolean or comment-only convention:

```text
ComSafeSteeringOnly
FullyPhysicalNozzleForce
```

`ComSafeSteeringOnly` keeps the current prototype stable by applying base forward thrust through the Rigidbody center of mass and applying only the gimbal steering delta at the nozzle position.

`FullyPhysicalNozzleForce` applies the full gimballed force at the nozzle transform. It is more physically literal and can create torque from any nozzle/COM offset.

## Default

The default remains `ComSafeSteeringOnly` because the prototype is currently tuned around stable throttle-only flight. Fully physical mode is for controlled experiments and later difficulty/ship-design decisions.

## Integration

The mode belongs on the main thruster module or a small main-thruster settings object and routes force through `ShipPhysicsCore`. It must not bypass the central core.

## Diagnostics

The debug overlay should expose:

- selected main-thrust mode,
- applied straight force,
- applied steering/nozzle force,
- net torque from main thrust,
- gimbal yaw/pitch command.

## Risks

Fully physical mode can reintroduce circular flight if the engine is off-center, the COM is shifted, or gimbal is aggressive. That behavior is acceptable in the mode, but the default must remain stable.
