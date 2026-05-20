# Combat Weapon Computer / Turret Mode v0

## Problem

The prototype currently treats the player weapon as a single root-level gun with a simple muzzle fallback. That is enough for manual Space fire, but it does not support target selection, turret arcs, imported marker binding, deterministic hit chance, or data-driven projectile diameter and recoil tuning. The next combat slice needs a prototype-tauglicher weapon computer without turning into a final ShipBuilder or AI system.

## Goal

Add a spec-first Weapon Computer / Turret Computer mode that keeps existing Space-to-fire behavior working while introducing a reusable turret weapon module, target adapters, target priority selection, an IMGUI weapon computer panel, marker-based imported ship binding, safe turret arc limits, and data-driven projectile/recoil values.

## Scope

- Preserve existing manual fire behavior through Space and the current projectile/ShipPhysicsCore recoil path.
- Add a turret-compatible weapon module with mount/root, yaw pivot, pitch pivot, muzzle, and optional muzzle flash marker support.
- Extend weapon settings with projectile speed, diameter/radius, mass, rounds-per-second cooldown, lifetime, recoil, hit chance, engagement range, yaw/pitch limits, turret slew rate, and optional auto-fire/lead-target toggles.
- Add a Weapon Computer that can track selectable component/transform targets, prioritize them, expose active target/status/debug labels, and optionally auto-fire.
- Add a separate IMGUI Weapon Computer panel bound through `PrototypeBootstrap.SetupMainCamera`.
- Bind imported `WEAPON_*` markers through a `PrototypeShipKitWeaponBinder` style component without hardcoded per-ship paths.
- Extend projectile diameter handling so visible scale and sweep/hit radius use the same configured size.
- Add editor tests and test evidence for targeting, arcs, fire control, projectile diameter, recoil, binder, bootstrap, UI, and config clamping.

## Non-Goals

- No final ShipBuilder.
- No complete enemy AI or threat model.
- No network/multiplayer behavior.
- No final UI artwork; IMGUI remains acceptable for this prototype.
- No direct Rigidbody velocity writes for recoil or impacts.
- No hardcoded imported ship paths in gameplay logic.
- No renaming existing thrust/RCS marker contracts unless every binder and test is updated.

## Acceptance

- DevToolbox validation succeeds for this change or a concrete tooling blocker is recorded in `tests/test-protocol.md`.
- Existing manual Space fire still works and uses a real muzzle when one exists.
- The Weapon Computer can select multiple targets, pick an active target by priority mode, and surface health fallback labels.
- Turret aim is bounded by local yaw/pitch limits and refuses to fire outside arc or without a valid muzzle.
- Projectile speed, mass, diameter, fire rate, hit chance, lifetime, recoil, range, and turret limits are data-driven.
- Recoil remains an impulse through `ShipPhysicsCore` at the muzzle.
- Imported/generated ship markers bind idempotently through reusable marker/component logic.
- Editor tests cover config, targeting, arc, fire control, diameter, recoil, binder, bootstrap, and UI status behavior.
- README, physics docs, and `tests/test-protocol.md` document the new prototype behavior and known limits.
