# Browser Combat Weapon Damage Core v1

## Scope

`apps/weltraum-browser/src/combat/index.ts` exports a standalone, renderer-independent Combat domain core. Callers provide validated runtime snapshots for weapons, mount poses, targets, collision proxies, and damageable state. The module decides Fire permission, creates Projectile or Beam delivery, resolves authoritative Hits, applies Armor/Hull/Module damage, and produces canonical semantic events without importing Browser Runtime, UI, Render, Flight, Navigation, Resources, Ship Builder, Test Harness, Three.js, or Unity code.

The v1 public boundary uses explicit stable IDs, non-negative safe-integer simulation ticks, SI-derived units, and coordinate Frame IDs. Public factories clone, validate, canonicalize, and recursively freeze results. Public transitions are pure and never mutate caller-owned input.

## Public Contracts

- `createWeaponCapability`, `createWeaponRuntimeState`, and `createWeaponMountPose` define Fixed or Turret weapons with Projectile or Beam delivery, Damage Type/amount, rate, range, alignment, explicit Ammo/Energy requirements, optional Heat, lifecycle, cooldown, and shot sequence.
- `createCombatTarget` and `selectCombatTargetById` provide stable-ID-only Target selection from explicit snapshots.
- `evaluateFirePermission`, `advanceWeaponRuntimeState`, and `fireWeapon` decide and perform immutable Fire transitions.
- `createCollisionProxy`, `advanceProjectile`, and `resolveBeamHit` use only authoritative Sphere and frame-axis-aligned AABB proxies.
- `createDamagePacketFromHit`, `createDamageableSnapshot`, and `applyDamage` keep Hit Resolution and Damage Apply as separate steps.
- `sortCombatEvents` and `createCanonicalCombatEventSequence` provide one stable event order, canonical JSON, and a deterministic 64-bit FNV-1a signature.

Stable derived Projectile, Hit, Damage Packet, and Event IDs use the format `<type-prefix>:<16-lowercase-hex-digits>`. No display name, object identity, renderer node, clock, or random value participates in identity.

## Fire And Delivery Rules

Fire permission returns every applicable blocker in this exact order:

1. `NoTarget`
2. `TargetInvalid`
3. `OutOfRange`
4. `OutsideArc`
5. `NotAligned`
6. `CooldownActive`
7. `AmmoEmpty`
8. `EnergyInsufficient`
9. `Overheated`
10. `FirePermissionDenied`
11. `LineOfFireBlocked`

Range, Fixed half-arc, Turret yaw/pitch limits, and tracking alignment are inclusive. Hybrid weapons require and atomically consume both Ammo and Energy. Heat at the exact maximum is allowed; a shot that would exceed it is blocked. A blocked shot returns unchanged state and no delivery/events. An accepted shot sets cooldown to the reciprocal fire rate, increments shot sequence once, and creates a `WeaponFireEvent`; Projectile fire additionally creates immutable Projectile state and `ProjectileSpawnedEvent`, while Beam fire creates an explicit Ray. Fire does not resolve a Hit or apply Damage.

Projectile advancement uses explicit positive fixed-step seconds, constant velocity, and the earliest lifetime/path-range cap. Swept-Sphere intersections prevent tunneling through Sphere and expanded AABB proxies. Beam uses capped Ray intersections. Owner proxies are ignored, different Frames are rejected, nearest distance wins, and equal-distance Proxy ties use lexical Proxy ID. A boundary collision resolves before expiry. Each Projectile step yields one Active state, one Hit, or one expiry event.

## Hit, Damage, And Event Rules

`HitResult` records Source, Target, Weapon, optional Projectile, Proxy, optional explicit Module, tick/frame, point, normal, distance, segment fraction, incoming direction, and Projectile speed (or `null` for Beam). Hit Resolution emits `HitEvent` and never mutates damageable state.

Damage supports `Kinetic`, `Thermal`, `ElectricalEmp`, `Explosive`, and `Cutting` with complete per-layer Resistance maps. Armor Resistance and remaining Armor integrity apply first. The penetrating remainder then reaches Hull and, only for an explicit existing Module ID, that Module independently after their own Resistances. There is no fallback or random Module selection. Integrity stays within `[0, maximum]`; Destroyed is sticky. Module roles return semantic effects only and do not mutate Flight, Runtime, cargo, sensors, or weapons.

Canonical events sort by tick, then phase `WeaponFire`, `ProjectileSpawned`, `ProjectileExpired`, `Hit`, `DamageApplied`, `ModuleStateChanged`, `TargetDestroyed`, then stable identity fields and Event ID. Equivalent input produces byte-identical canonical JSON, IDs, ordering, and signatures.

## Browser Evidence

`apps/weltraum-browser/tests/e2e/combat-weapon-damage-core.spec.ts` loads normal `/`, registers Console/Page/Network/HTTP failure collectors before navigation, waits for `#debug-scene`, and proves `window.TestBridge` is absent by own-property and prototype-chain checks before and after the scenario. It dynamically imports only `/src/combat/index.ts` in Browser context and runs the same Target -> Fire -> Projectile -> Hit -> Damage -> Events scenario twice.

Chrome implicitly requests `/favicon.ico` although the existing normal-route document declares no favicon. The focused test handles only that browser-generated request locally with a deterministic `204` before navigation; every app and dynamically imported Combat-module request remains visible to the four failure collectors. No production HTML or runtime hook is changed.

The test pins deterministic signatures and derived IDs, requires byte-identical repeated canonical JSON, verifies exact event phase order and bounded Armor/Hull/Module outcomes, and overwrites only:

- `apps/weltraum-browser/evidence/browser-combat-weapon-damage-core-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-combat-weapon-damage-core-v1.md`

No screenshot is required because this slice adds no visible Combat runtime or UI.

## Verification Commands

Run from `apps/weltraum-browser`:

```text
npx tsc -p tsconfig.json
npm run test -- tests/unit/combatFireControl.test.ts
npm run test -- tests/unit/combatProjectiles.test.ts
npm run test -- tests/unit/combatHitResolution.test.ts
npm run test -- tests/unit/combatDamage.test.ts
npm run test -- tests/unit/combatEvents.test.ts
npm run test:e2e -- tests/e2e/combat-weapon-damage-core.spec.ts
npm run test
npm run build
npm run test:e2e
```

The focused Browser scenario is the evidence owned by this note. Full-regression status is established separately by the final verification controller.

## Explicitly Deferred

- Browser Runtime, player/debug UI, render/VFX, Flight, Navigation, enemy/encounter, and normal-route integration.
- Ship Builder adapters, Resources/Economy consumption, persistence migration, and gameplay balancing.
- Random spread, target-priority AI, turret slew simulation, recoil/impulse physics, repair, and detachment.
- OBB, capsule, mesh, scene-node, or physics-engine collision authority.
