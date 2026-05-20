# Turret Module Arc Safety

## ADDED Requirements

### Requirement: Turret transform contract

A turret weapon SHALL support separate mount/root, yaw pivot, pitch pivot, muzzle, and optional muzzle flash transforms.

#### Scenario: Real muzzle is required for firing

- GIVEN a turret weapon has no configured or discovered muzzle transform
- WHEN fire is requested
- THEN no projectile is spawned
- AND status reports `no muzzle`
- AND no silent fallback to the ship center occurs.

#### Scenario: Existing Space fire remains compatible

- GIVEN the player presses Space with the prototype ship
- WHEN a turret-compatible weapon is available
- THEN the existing manual fire path still emits a projectile from the configured real muzzle
- AND existing projectile/recoil behavior remains physical.

### Requirement: Local yaw and pitch limits

A turret weapon SHALL solve aim in local mount or ship coordinates and clamp yaw and pitch to configured limits.

#### Scenario: Target inside arc is accepted

- GIVEN a selected target lies within configured yaw and pitch limits
- WHEN the turret evaluates aim
- THEN status reports `in arc`
- AND fire is allowed when all other fire gates pass.

#### Scenario: Target outside arc is denied

- GIVEN a selected target lies outside configured yaw or pitch limits
- WHEN the turret evaluates aim
- THEN status reports `out of arc`
- AND fire is not allowed.

#### Scenario: Pivots never exceed configured limits

- GIVEN the target direction requests yaw or pitch beyond the allowed range
- WHEN the turret applies aim
- THEN yaw and pitch are clamped to configured bounds
- AND no pivot is rotated past those bounds.

### Requirement: Cooldown and authority status

A turret weapon SHALL expose fire-control status for cooldown, no selected target, no muzzle, no authority, and optional line blocked.

#### Scenario: Cooldown blocks repeated fire

- GIVEN rounds per second is configured
- WHEN fire is requested again before the cooldown expires
- THEN no additional projectile is spawned
- AND status reports `cooldown`.

#### Scenario: No authority blocks fire

- GIVEN a turret weapon has no valid yaw/pitch authority or cannot rotate toward the target
- WHEN fire is requested
- THEN no projectile is spawned
- AND status reports `no authority`.

### Requirement: Arc safety validation

The prototype SHALL provide an editor-testable validation path that samples the configured turret arc.

#### Scenario: Valid sample set remains bounded

- GIVEN a turret weapon with conservative nose-gun defaults
- WHEN the validation samples yaw/pitch combinations across the configured arc
- THEN every sampled yaw and pitch is finite and within configured limits
- AND the validation reports whether muzzle/barrel safety checks pass or are blocked by missing hull/safety volume data.

#### Scenario: Hull self-intersection is not reported as safe

- GIVEN a hull bounds or safety volume is available
- WHEN a sampled muzzle position lies inside the hull bounds or the barrel direction points into the hull
- THEN validation fails or reports the arc as unsafe
- AND the unsafe arc is documented instead of silently accepted.

### Requirement: Debug visuals are non-authoritative

Turret arc gizmos and debug visualization SHALL help inspect limits but SHALL NOT affect gameplay decisions.

#### Scenario: Gizmos do not change fire permission

- GIVEN debug drawing is enabled or disabled
- WHEN the turret evaluates a target
- THEN in-arc/out-of-arc and fire permission are unchanged.
