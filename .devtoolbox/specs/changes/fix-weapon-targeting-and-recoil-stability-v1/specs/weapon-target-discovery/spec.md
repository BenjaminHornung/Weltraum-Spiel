# Capability: Weapon Target Discovery

## ADDED Requirements

### Requirement: Registry-driven target discovery

The Weapon Computer SHALL discover combat targets from an explicit target registry in normal runtime refreshes.

#### Scenario: Marked target is listed

- GIVEN a scene object has an enabled `PrototypeWeaponTargetMarker`
- WHEN the Weapon Computer refreshes targets
- THEN the marked target appears in `AvailableTargets`.

#### Scenario: Rigidbody-only prop is ignored

- GIVEN a scene object has only a `Rigidbody` and no target marker or trusted combat target component
- WHEN the Weapon Computer refreshes targets
- THEN that object does not appear in `AvailableTargets`.

#### Scenario: Projectiles are ignored

- GIVEN a live projectile exists in the scene
- WHEN the Weapon Computer refreshes targets
- THEN the projectile does not appear as a target.

### Requirement: Trusted combat components can auto-register

Prototype combat target components MAY register themselves so tests and generated scenes do not require manual marker setup for every target.

#### Scenario: Target dummy auto-registers

- GIVEN an enabled `PrototypeTargetDummy`
- WHEN the Weapon Computer refreshes targets
- THEN the dummy is discoverable with neutral fallback health.

#### Scenario: Damage-state target preserves health aggregation

- GIVEN a target root has child `PrototypeModuleDamageState` components
- WHEN the target adapter is built
- THEN current and maximum integrity are aggregated for health priority sorting.

### Requirement: Hot path avoids global Rigidbody discovery

Automatic target refresh SHALL NOT use `Object.FindObjectsByType<Rigidbody>` or equivalent global Rigidbody scans.

#### Scenario: Refresh uses registry data

- GIVEN the registry has not changed
- WHEN `PrototypeWeaponComputer.Update` runs
- THEN it does not rebuild targets by global scene search.

#### Scenario: Manual refresh remains available

- GIVEN the operator clicks the Weapon Computer refresh button
- WHEN manual refresh runs
- THEN the target list is rebuilt from registry data without generic Rigidbody discovery.

### Requirement: Selection behavior is preserved

The Weapon Computer SHALL keep existing selected-target behavior and priority modes.

#### Scenario: Priority modes still choose selected targets

- GIVEN multiple selected registered targets with different distance and health values
- WHEN the priority mode is `ManualOrder`, `Nearest`, `HighestHealth`, or `LowestHealth`
- THEN the active target follows the selected mode.
