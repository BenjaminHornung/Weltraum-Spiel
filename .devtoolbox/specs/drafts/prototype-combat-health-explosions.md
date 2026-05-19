# Draft Spec: prototype-combat-health-explosions

Status: draft only. Promote to `.devtoolbox/specs/changes/prototype-combat-health-explosions/` before implementation.

## Purpose

The prototype can shoot targets and show hit feedback, but targets cannot yet be defeated. Add minimal health, projectile damage, and visible destruction feedback so shooting has a clear result before adding enemy AI or mission loops.

## In Scope

- Prototype target health.
- Projectile damage value.
- Hit feedback remains visible.
- Target destroyed state.
- Simple explosion placeholder: particle burst, light flash, expanding primitive, or debris cubes.
- Target reset/respawn for repeated testing.
- Debug overlay or label showing target health if practical.

## Out of Scope

- No enemy AI.
- No player ship damage.
- No armor/material damage model.
- No networked combat.
- No weapon inventory.
- No loot or scoring.
- No final VFX.

## Acceptance Criteria

- Target dummy starts with configurable health.
- Projectile hits reduce target health.
- Target hit feedback still triggers.
- Target destruction triggers obvious visual feedback.
- Destroyed target stops receiving normal hit feedback or enters a clear destroyed state.
- Target can be reset for repeated test firing.
- Projectile lifetime cleanup remains intact.
- No full combat architecture is introduced.

## Risks

- Avoid letting this become a damage-system rewrite. The goal is readability and testability, not final combat.
- High-speed projectile collision remains a known limitation; if necessary, a simple sweep/raycast can be proposed in a later weapon spec.
