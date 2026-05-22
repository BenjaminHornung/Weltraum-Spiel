# Design: Floating Origin Large World

## State Split

Use a future data shape like:

```text
absolutePosition: double precision
absoluteVelocity: double precision
localUnityPosition: Vector3 near origin
rotation: Quaternion
angularVelocity: Vector3
```

## Origin Shift

When the player or focus object exceeds a configured local threshold, shift the world origin and adjust local transforms so relative positions remain stable.

## Integration

This should be an infrastructure layer. It must not be mixed directly into flight controls, thrusters, or weapon code.

## Risks

Origin shifts can break particles, trails, cameras, and physics joints. The first implementation should target a tiny scene and verify visual continuity.
