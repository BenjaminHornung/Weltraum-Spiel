# Design: Prototype Target Hit Feedback

## Approach

Reuse existing `Projectile` and `GunModule` behavior. Add minimal target dummy behavior and hit feedback without creating a full combat architecture.

## Target Model

Targets can be simple primitive objects with collider and a small script. They may be spawned by `PrototypeBootstrap` as test objects.

## Hit Feedback

Feedback can be a material flash, brief light, small particle burst, or simple scale pulse. The goal is clarity, not final art.

## Risks

High projectile speed can make collision unreliable. If needed, use collision detection settings or simple trigger/raycast support, but avoid a full weapon simulation rewrite.
