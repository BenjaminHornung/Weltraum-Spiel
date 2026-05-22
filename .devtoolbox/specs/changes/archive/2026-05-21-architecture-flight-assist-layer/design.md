# Design: Flight Assist Layer

## Principle

The base physics model keeps momentum. Assist features should create desired wrenches that real actuators try to satisfy. They should not quietly change global damping or overwrite Rigidbody velocity.

## Request Flow

```text
Input / SAS / Assist
        -> desired force + desired torque
        -> allocator / ShipPhysicsCore
        -> concrete force applications
```

## Modes

The first implementation may only define mode structure and diagnostics:

- Simulation Mode: no extra assist.
- Assisted Flight: optional velocity/rotation help.
- Debug Assist: clearly marked non-physical helpers for testing only.

## Diagnostics

Overlay and docs should show which layer requested force/torque so future bugs can be traced.

## Risks

If assist is mixed into input code, it becomes hard to know whether behavior is physics, SAS, or hidden correction. Keep the layer explicit.
