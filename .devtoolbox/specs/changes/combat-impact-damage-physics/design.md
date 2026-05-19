# Design: Impact Damage Physics

## Event Model

A hit should create a compact event:

```text
hitPoint, hitNormal, relativeVelocity, impactImpulse, moduleHit
```

The event can apply impulse and update module health or degradation.

## Module Effects

Initial physical effects can be simple:

- engine max thrust multiplier,
- RCS nozzle/block disabled or reduced,
- fuel tank capacity/leak marker,
- structural integrity value.

## Integration

Projectile sweep hits should feed this system later. `ShipPhysicsCore` should remain the path for applied impact impulses when possible.

## Risks

Damage can become too broad quickly. First implementation should target one or two physical degradations and strong debug output.
