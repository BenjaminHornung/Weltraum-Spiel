# Weapon Projectile Performance

## ADDED Requirements

### Requirement: Weapon projectile modes

Prototype weapons SHALL expose an explicit projectile mode with `Hitscan`, `SimulatedProjectile`, and `GuidedProjectile` values.

#### Scenario: Fast weapons default to hitscan

- GIVEN a gun setting does not explicitly request slow projectile travel
- WHEN settings are clamped or applied to `ShipStats`
- THEN the runtime projectile mode is `Hitscan`.

#### Scenario: Guided mode is a placeholder

- GIVEN a weapon setting requests `GuidedProjectile`
- WHEN the v1 runtime fires the weapon
- THEN the runtime does not create a per-shot network or Rigidbody bullet object
- AND it either routes through the documented simulated fallback or reports a clear unsupported mode diagnostic.

### Requirement: Fast shots avoid per-shot projectile GameObjects

Hitscan and lightweight simulated projectile firing SHALL NOT create a primitive projectile GameObject, Rigidbody, collider, material, light, or trail renderer for every shot.

#### Scenario: Hitscan shot fires without projectile component

- GIVEN a weapon is configured for `Hitscan`
- WHEN it fires
- THEN no `Projectile` component GameObject is created for the shot
- AND the result still records projectile velocity and recoil diagnostics.

#### Scenario: High fire rate remains bounded

- GIVEN a weapon fires hundreds of rounds per minute for several simulated seconds
- WHEN the runtime processes those shots
- THEN active simulated projectile records and pooled visual GameObjects remain bounded by lifetime and pool capacity
- AND no unbounded `PrototypeProjectile` GameObject count grows with total shots fired.

### Requirement: Runtime hit queries use NonAlloc casts

The projectile runtime SHALL use NonAlloc ray/sphere casts for hitscan and simulated projectile sweeps.

#### Scenario: Hitscan uses one bounded query

- GIVEN projectile radius is greater than zero
- WHEN a hitscan shot is processed
- THEN the runtime uses a bounded sphere cast query and selects the nearest valid hit.

#### Scenario: Simulated projectile sweeps previous-to-current

- GIVEN a simulated projectile advances during a tick
- WHEN it moves from previous position to current position
- THEN the runtime sweeps that segment with a NonAlloc query
- AND it removes the record on first valid hit or lifetime expiry.

### Requirement: Hot path avoids global discovery and owner collider scans

The projectile hot path SHALL NOT call `FindObjectsByType` or scan owner child colliders per shot.

#### Scenario: Owner collider filtering uses cached data

- GIVEN the same owner fires repeated shots
- WHEN the runtime checks hit validity
- THEN owner collider exclusion uses cached owner data or hierarchy checks
- AND per-shot `GetComponentsInChildren<Collider>()` is not required.
