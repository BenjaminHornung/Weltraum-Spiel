# Design: Prototype Module Configs

## Approach

Add a small configuration layer for prototype values while keeping the current generated primitive ship. Prefer simple serialized classes, MonoBehaviour fields, or ScriptableObjects only if they reduce clutter.

## Configuration Targets

Potential targets:

- Fuel amount and dry/fuel masses.
- Main thruster thrust, fuel consumption, and gimbal range.
- RCS block thrust values.
- Gun fire rate, projectile speed, projectile lifetime.
- Camera distance and height.

## Boundaries

This is not the ship editor. The generated ship shape and module list can remain fixed. Configs should make tuning safer without introducing final domain architecture.

## Risks

Over-abstracting now would slow prototype iteration. Keep the first version obvious and inspectable.
