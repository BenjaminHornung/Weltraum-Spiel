# Ship Kit Turret Placeholders

## ADDED Requirements

### Requirement: Weapon marker contract

Imported and generated prototype ships SHALL use marker transforms/components for weapon binding instead of hardcoded gameplay paths.

#### Scenario: Required weapon markers are recognized

- GIVEN a ship hierarchy contains `WEAPON_TURRET_BASE_*`, `WEAPON_TURRET_YAW_*`, `WEAPON_TURRET_PITCH_*`, and `WEAPON_MUZZLE_*` transforms
- WHEN the weapon binder scans the hierarchy
- THEN it identifies the mount/base, yaw pivot, pitch pivot, and muzzle markers
- AND it binds them to a turret-compatible weapon.

#### Scenario: Optional muzzle flash marker is recognized

- GIVEN a ship hierarchy contains `WEAPON_MUZZLE_FLASH_*`
- WHEN the weapon binder scans the hierarchy
- THEN it records or binds the optional muzzle flash marker
- AND missing optional flash markers do not block firing.

#### Scenario: Existing thrust and RCS markers remain compatible

- GIVEN the ship kit contains `THRUST_NOZZLE_MAIN` and `RCS_NOZZLE_*` markers
- WHEN weapon markers are added
- THEN existing VFX/thruster binders continue to recognize the original marker names.

### Requirement: Idempotent weapon binder

`PrototypeShipKitWeaponBinder` SHALL bind weapon markers idempotently.

#### Scenario: Repeated bind does not duplicate components

- GIVEN a hierarchy with weapon markers
- WHEN `BindNow` is called more than once
- THEN it does not create duplicate turret weapon, mount, computer, or VFX child components
- AND the report still reflects found markers and bound weapon state.

#### Scenario: Missing markers are reported clearly

- GIVEN a hierarchy has no weapon muzzle marker
- WHEN binding runs
- THEN the report includes a warning or missing marker entry
- AND gameplay does not silently use the ship center as muzzle.

### Requirement: Generated fallback remains bindable

The runtime generated prototype fallback SHALL create or expose bindable turret/muzzle placeholders when imported markers are unavailable.

#### Scenario: Bootstrap creates a turret-compatible weapon

- GIVEN `PrototypeBootstrap` builds the generated prototype ship
- WHEN runtime components are inspected
- THEN at least one turret-compatible weapon exists
- AND it has a real muzzle transform that is not the ship root.

### Requirement: Blender/export limitations are explicit

The change SHALL document whether Blender marker/export updates were automated or left as manual follow-up.

#### Scenario: Blender automation unavailable

- GIVEN Blender files or export automation cannot be safely executed
- WHEN implementation completes
- THEN Unity-side bindable placeholders still exist
- AND `tests/test-protocol.md` lists the exact remaining Blender/manual export steps.
