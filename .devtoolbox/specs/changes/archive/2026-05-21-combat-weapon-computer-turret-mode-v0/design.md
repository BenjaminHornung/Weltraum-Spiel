# Design: Combat Weapon Computer / Turret Mode v0

## Current Architecture

- `PlayerShipController` polls Space/gamepad fire input and forwards it to `GunModule.TryFire()`.
- `GunModule` owns cooldown, projectile spawning, ignored-collider setup, and recoil impulse dispatch through `ShipPhysicsCore.ApplyForceAtPosition(..., ForceMode.Impulse)`.
- `Projectile` already owns sweep/contact hit reporting, target dummy feedback, module damage, and impact impulse dispatch.
- `ShipStats` and `PrototypeShipConfig.PrototypeGunSettings` already carry speed, fire rate, lifetime, mass, recoil, and prototype scale values.
- `PrototypeBootstrap` builds a runtime prototype ship and binds camera/HUD/debug panels.
- `PrototypeShipKitVfxBinder` and the in-progress socket utilities show the marker-based binding pattern for imported assets.

## Chosen Shape

Add a small turret layer beside the existing gun path instead of replacing all combat code.

- `GunModule` remains the manual Space-fire adapter so existing controller behavior stays intact.
- A new `PrototypeTurretWeapon` owns turret transforms, local yaw/pitch limits, projectile spawning, deterministic hit chance, cooldown, recoil diagnostics, and no-muzzle/no-authority status.
- `PrototypeWeaponComputer` owns target discovery, selected-target state, priority selection, active target, optional auto-fire, and status strings. It drives one or more turret weapons but v0 only requires one weapon to work.
- `PrototypeWeaponComputerPanel` is a separate camera-bound IMGUI panel, keeping `PrototypeFlightHud` focused on navball/HUD.
- `PrototypeWeaponTarget` provides component-based target adaptation for `PrototypeModuleDamageState`, `PrototypeTargetDummy`, `ShipStats`, and Rigidbody-bearing ship-like targets without hardcoding names.
- `PrototypeTurretMount` / marker binding hold mount, yaw pivot, pitch pivot, muzzle, and optional muzzle flash references.
- `PrototypeShipKitWeaponBinder` scans `WEAPON_*` markers and socket metadata, creates/binds reusable runtime components idempotently, and records warnings instead of silently falling back to the ship center.

## Integration Decisions From Plan Review

- `GunModule -> PrototypeTurretWeapon` delegation is single-owner: if a `PrototypeTurretWeapon` is configured, `GunModule.TryFire()` delegates to it and does not run its own cooldown, projectile spawn, or recoil path. If no turret weapon exists, `GunModule` keeps the legacy path for compatibility.
- Cooldown is centralized in `PrototypeTurretWeapon`. Manual Space fire and auto-fire both call the same fire gate, so a shot can create at most one projectile and one recoil impulse.
- Recoil is applied exactly once per accepted shot by the component that spawns the projectile. It always calls `ShipPhysicsCore.ApplyForceAtPosition(..., ForceMode.Impulse)` at the muzzle.
- `PrototypeGunSettings` / `ShipStats` are the source of truth for balance values. `PrototypeTurretMount` stores transform references and optional local override limits only when explicitly configured by a binder/asset.
- `projectileDiameter` takes precedence when positive. Legacy `projectileScale` remains serialized and maps to diameter when diameter is unset or invalid, so existing assets keep current visual size.
- Priority modes are explicitly `ManualOrder`, `Nearest`, `HighestHealth`, and `LowestHealth`. Ties fall back to manual selection order, then stable instance id.
- Hit chance uses a deterministic roll provider (`System.Random` seed or forced test roll) owned by the weapon. `0` always produces a deterministic miss dispersion; `1` always aims at the solved target direction.
- Miss dispersion is a small deterministic angular offset from the direct target line. It still spawns a projectile and records `LastShotWasIntendedHit = false` so tests and UI can distinguish a miss from a blocked shot.
- Auto-fire runs from the Weapon Computer update path but uses the turret weapon cooldown based on `Time.time`. Long frames do not spawn catch-up bursts in v0.
- `leadTargetEnabled` is stored and surfaced as a v0 flag. True ballistic lead is not implemented in this change; v0 aims at current target position and documents that limitation.
- Target discovery scans scene components (`PrototypeModuleDamageState`, `PrototypeTargetDummy`, `ShipStats`, and Rigidbody-bearing roots) on refresh/manual panel update, filters destroyed/null targets, and lets weapon fire gates enforce engagement range.
- No-muzzle behavior denies fire, emits a clear warning/status once per bind/evaluation path, and never creates a root-centered fallback muzzle for firing.
- Arc safety validation is editor-testable and can also run during binder/bootstrap setup for warnings. Missing hull/safety data is reported as inconclusive, not passed.
- The weapon binder coexists with in-progress socket work by reusing `PrototypeShipSocketUtility` when present, adding missing socket components idempotently, and never renaming existing `THRUST_NOZZLE_MAIN` or `RCS_NOZZLE_*` markers.
- The panel must tolerate null camera, null/removed active target, missing Rigidbody, and empty target lists by showing status labels instead of throwing.

## Settings Compatibility

Extend `PrototypeGunSettings` rather than introducing a parallel settings root. Existing fields keep their names and meaning where possible:

- `projectileSpeed`, `projectileFireRate`, `projectileLifetime`, `projectileMass`, and `recoilEnabled` stay compatible.
- `projectileScale` remains accepted as legacy visual scale but is normalized through a new `projectileDiameter` field.
- New fields add `hitChance`, `engagementRangeMeters`, yaw/pitch limits, `turretSlewDegreesPerSecond`, `autoFireEnabled`, and `leadTargetEnabled`.
- `ShipStats` exposes the normalized runtime values so `GunModule`, turret weapons, HUD/debug, and tests read the same numbers.

## Projectile Diameter

`Projectile.Initialize` gains an overload that accepts configured mass and diameter. The projectile object visual scale, sphere collider radius, trail width, and sweep radius derive from the same diameter. Existing overloads remain for compatibility and default to the current collider/scale behavior.

## Hit Chance

Hit chance is a prototype balance value, not a real ballistics simulation. It is deterministic for tests by using an injectable/random-seeded roll path. A miss still creates a projectile but intentionally applies a small aim dispersion so the projectile can be observed and does not count as a magical no-shot.

## Turret Arc And Safety

- Aim is solved in mount-local coordinates.
- Yaw and pitch are clamped before pivot rotation is applied.
- Firing is denied when the active target is outside yaw/pitch limits, outside engagement range, on cooldown, or no real muzzle exists.
- v0 uses conservative nose-gun defaults: yaw -35/+35 degrees and pitch -10/+35 degrees.
- Validation samples the configured yaw/pitch arc and checks invalid values, hull bounds/self intersection risk, and barrel direction into hull bounds where a safety volume is available. If no hull/safety volume is available, the validation reports a warning instead of claiming a pass.

## Marker Binding

Imported marker names use a reusable convention:

- `WEAPON_TURRET_BASE_*`
- `WEAPON_TURRET_YAW_*`
- `WEAPON_TURRET_PITCH_*`
- `WEAPON_MUZZLE_*`
- `WEAPON_MUZZLE_FLASH_*`
- optional `WEAPON_CLEARANCE_*` / `WEAPON_ARC_LIMIT_*`

No gameplay script depends on a path such as `demo_scout_mk1/.../Turret/Muzzle`. Binder behavior is idempotent and can bind generated fallback transforms as well as imported demo ships.

## Reuse Justification

Reuse is maximized by keeping `Projectile`, `ShipPhysicsCore`, `ShipStats`, `PrototypeGunSettings`, existing bootstrap creation, and marker/socket utilities. New code is required only where no current component exists: target selection, turret arc logic, turret-specific marker binding, and the separate weapon computer panel.

## Risks

- Existing dirty socket/binder work overlaps this change; implementation must preserve those marker contracts.
- Unity/DevToolbox validation can be noisy in this project, so `tests/test-protocol.md` must separate true failures from known tooling blockers.
- Auto-fire can create frame-dependent bugs if cooldown math is not centralized in the weapon module.
- Imported Blender markers may not be automatable from this environment; any remaining manual Blender step must be documented honestly.

## Verification Plan

- Validate DevToolbox specs after authoring.
- Validate/compile changed C# scripts through Unity MCP when available.
- Run focused EditMode tests for new weapon computer/turret/projection/binder coverage.
- Run existing relevant editor tests for projectile physics, VFX binder, bootstrap/HUD, and functional sockets.
- Run explicit `dotnet build "Weltraum Spiel.sln"` / `dotnet test "Weltraum Spiel.sln"` as a secondary compile check, noting known MSB3277 warnings if present.
- Record all commands/results and Blender/preview limitations in `tests/test-protocol.md`.
