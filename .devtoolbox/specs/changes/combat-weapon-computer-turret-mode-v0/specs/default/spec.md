# Capability: Combat Weapon Computer / Turret Mode v0

## ADDED Requirements

### Requirement: Prototype weapon computer slice

The change SHALL add a prototype-tauglicher Weapon Computer / Turret Computer mode that preserves existing manual fire while adding target selection, turret arc safety, data-driven projectile balance, and marker-based turret placeholders.

#### Scenario: Existing manual combat remains usable

- GIVEN the prototype ship is built with this change
- WHEN the player fires with Space
- THEN the ship fires through a turret-compatible weapon using a real muzzle
- AND the existing projectile, damage, and recoil systems remain in use.

#### Scenario: New systems are prototype-scoped

- GIVEN the Weapon Computer mode is available
- WHEN the prototype is run
- THEN the feature remains scoped to prototype IMGUI, editor tests, and runtime components
- AND it does not introduce a final ShipBuilder, enemy AI, multiplayer, or final artwork requirement.
