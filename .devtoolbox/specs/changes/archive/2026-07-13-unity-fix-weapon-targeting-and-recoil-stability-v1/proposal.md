# Fix Weapon Targeting And Recoil Stability v1

## Problem

The prototype Weapon Computer still refreshes targets with repeated global scene scans, including a generic `Rigidbody` fallback. That makes combat targeting too expensive and can accidentally include projectiles, weapon visuals, or unrelated physics props as selectable combat targets.

Weapon recoil is intentionally physical, but an off-center gun or turret shot can inject angular impulse faster than the current SAS/RCS response makes visible, bounded compensation requests. The ship should keep recoil, but the flight-control layer needs a transparent post-shot stabilization request that uses existing RCS authority instead of hidden damping.

## Goal

Make target discovery registry-driven and cheap in normal play, and add a physically honest weapon-recoil stabilization path that turns estimated recoil angular impulse into a short-lived RCS/SAS torque request. Diagnostics must show the requested recoil compensation, actual RCS output, residual torque, and authority limits.

## Scope

- Add an explicit weapon target marker/registry path.
- Remove generic `Rigidbody` scene discovery from automatic Weapon Computer refresh.
- Keep target health aggregation for damage-state targets and neutral fallback health for explicit dummy/ship/marker targets.
- Keep Weapon Computer selection modes: `ManualOrder`, `Nearest`, `HighestHealth`, and `LowestHealth`.
- Add a weapon stabilization `FlightAssistRequestSource` and route post-fire torque requests through `PlayerShipController` and `RcsThrusterController`.
- Keep recoil as a real `ShipPhysicsCore.ApplyForceAtPosition(..., ForceMode.Impulse)` effect.
- Extend diagnostics, tests, README, physics docs, and test evidence for the combined combat-control change.

## Non-Goals

- No final enemy AI or line-of-sight/ballistic lead solver.
- No global object search in the normal targeting hot path.
- No direct `Rigidbody.angularVelocity = 0` recoil fix.
- No hidden Rigidbody angular damping or invisible global stabilization.
- No fake perfect compensation when RCS nozzles, fuel, or authority are insufficient.
