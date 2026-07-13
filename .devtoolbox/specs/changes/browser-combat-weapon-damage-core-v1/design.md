# Design

## Module and public boundary

The implementation is a pure TypeScript domain module under `apps/weltraum-browser/src/combat/**`, exported only by `combat/index.ts`. It has no global registry, clock, random source, Renderer/Three.js query, or dependency on Ship Builder, Flight, Navigation, Runtime, Render, UI, Resources, Test Harness, or Unity. No existing root/core barrel is changed. A later adapter may translate persisted Ship Builder `FixedWeapon` and `TurretWeapon` components into these runtime snapshots; the Combat Core neither duplicates nor imports those persisted definitions.

Public constructors/factories validate, clone, canonicalize, and recursively freeze their returned values. Public transition functions never mutate caller inputs and return recursively frozen results. Invalid contract input throws a stable `CombatContractError` carrying a machine-readable code and field path; ordinary gameplay rejection such as blocked fire is returned as data.

## Identity, canonicalization, units, and frames

Entity, Weapon, Projectile, Proxy, Module, Frame, Hit, Damage Packet, and Event IDs are branded strings validated against `^[a-z0-9][a-z0-9._:-]{0,127}$`. Display names, object identity, node names, meshes, time, and randomness never establish identity. Derived Projectile, Hit, Packet, and Event identities are generated from a type prefix plus a combat-local canonical serialization of their stable input IDs, tick, and shot sequence. Canonical serialization recursively sorts object keys, preserves semantically ordered arrays, rejects unsupported/non-finite values, and is hashed with deterministic 64-bit FNV-1a rendered as lowercase hexadecimal. The resulting format is `<type-prefix>:<16-hex-digits>`.

All scalar quantities are explicit:

- distance/position/radius/range: meters;
- velocity/projectile speed: meters per second;
- lifetime/cooldown/fixed step: seconds;
- projectile mass: kilograms;
- yaw, pitch, arc, and tracking error: radians;
- damage, energy, and heat: finite domain units;
- time identity: non-negative safe-integer simulation ticks.

Vectors contain finite values. Target snapshots, mount poses, Projectile states, rays, collision proxies, and hit results carry a `frameId`; values in different frames are never transformed implicitly. A Target in a different frame is invalid for fire permission. Collision requests require delivery state and every proxy to share a frame and reject mismatches as contract errors.

`WeaponMountPose` contains Muzzle position, neutral Forward and Up, current Muzzle direction, and source velocity. Forward, Up, and Muzzle direction must be finite and non-zero. Forward and Up must be orthogonal within `1e-9`; they are normalized after validation and Right is derived as `normalize(cross(Up, Forward))`. There is no default pose at world origin, default forward, or zero-vector fallback.

## Weapon and target contracts

`WeaponCapabilitySnapshot` has an explicit Weapon ID and is a discriminated composition of:

- mount kind `Fixed` or `Turret`;
- delivery kind `Projectile` or `Beam`;
- finite positive maximum range, damage amount, and rate of fire, plus one explicit `DamageType`;
- a Fixed half-arc, or Turret yaw/pitch limits, plus a finite non-negative maximum tracking error;
- optional explicit Ammo and Energy requirements, each nullable, with at least one non-null;
- optional Heat rules with positive heat-per-shot and maximum heat plus non-negative cooling-per-second;
- Projectile rules with positive speed, radius, mass, lifetime, and maximum path range when delivery is Projectile.

Ammo-per-shot is a positive safe integer; runtime Ammo is a non-negative safe integer. Energy-per-shot is finite and positive; runtime Energy is finite and non-negative. A required runtime pool must be present, and a non-required pool is `null`. Hybrid weapons declare and consume both Ammo and Energy atomically. Heat state is present exactly when Heat rules are present. A shot is overheated when `currentHeat + heatPerShot > maximumHeat`; exact equality is allowed.

`WeaponRuntimeState` carries the matching Weapon ID, lifecycle `Operational | Disabled | Destroyed`, non-negative cooldown seconds, the required nullable resource pools, optional current Heat, and a non-negative safe-integer shot sequence. Only `Operational` can fire. `advanceWeaponRuntimeState(state, elapsedSeconds, capability)` accepts finite non-negative elapsed time, decreases cooldown and Heat by elapsed time times cooling rate, clamps both to zero, and does not refill Ammo or Energy.

`CombatTargetSnapshot` carries stable Target and Owner IDs, Frame ID, snapshot tick, finite position/velocity, `targetable`, and lifecycle `Active | Destroyed`. `selectCombatTargetById` accepts snapshots plus a stable ID, selects by ID only, throws `CombatContractError` for duplicate Target IDs, and returns the canonical frozen match or `null`; display/order/proximity do not affect selection.

## Fire permission and fire transition

`WeaponFireRequest` supplies Capability, matching Runtime State, Mount Pose, Target or `null`, evaluation tick, explicit relation/friendly-fire/permission policy, and explicit line-of-fire result `Clear | Blocked`. No permission, ownership, or line-of-fire fact is inferred from scene state.

`evaluateFirePermission` returns `allowed`, an ordered immutable `blockers` array, and `primaryReason` (`null` when allowed). It evaluates all applicable blockers and orders them exactly as follows:

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

With no Target, `NoTarget` is emitted and target validity/geometry checks are skipped. With a present but non-targetable, Destroyed, or frame-mismatched Target, `TargetInvalid` is emitted and geometry checks are skipped. State, resource, Heat, permission, and line-of-fire checks still run so every applicable non-geometric blocker is reported. Weapon lifecycle `Disabled` or `Destroyed`, relation policy, friendly-fire policy, and explicit permission denial map to `FirePermissionDenied`.

Range is inclusive and measured from Muzzle position to Target position. Fixed arc is the inclusive angle between neutral Forward and Target direction. Turret yaw and pitch use the normalized Forward/Up/Right basis: `yaw = atan2(dot(direction, Right), dot(direction, Forward))` and `pitch = asin(clamp(dot(direction, Up), -1, 1))`; absolute yaw/pitch must be within their inclusive limits. Tracking error is the inclusive angle between current Muzzle direction and Target direction. A Target exactly at the Muzzle is invalid geometry and yields `TargetInvalid` rather than a direction fallback.

`fireWeapon` reevaluates permission. A blocked result returns the original state value unchanged, no delivery, and no events. An accepted result atomically subtracts every required Ammo/Energy cost, adds Heat, sets cooldown to `1 / rateOfFirePerSecond`, increments shot sequence exactly once, and emits `WeaponFireEvent`. Projectile fire also creates `ProjectileState` and `ProjectileSpawnedEvent`; initial velocity is `sourceVelocity + muzzleDirection * projectileSpeed`, and the state carries an immutable `{ damageType, rawDamage }` payload copied from the capability. Beam fire creates an explicit immutable Ray plus the same payload. Fire never resolves a hit or changes damage state.

## Projectile, Beam, and collision authority

The authoritative collision-proxy union is:

- `SphereCollisionProxy`: Proxy ID, Entity ID, optional Module ID, Frame ID, finite center, positive radius;
- `AabbCollisionProxy`: Proxy ID, Entity ID, optional Module ID, Frame ID, finite minimum/maximum with strict `min < max` on every axis.

Renderer meshes, scene nodes, OBBs, capsules, and visual bounds are never accepted as collision truth. Proxies belonging to the delivery owner Entity are ignored.

Beam hit resolution performs Ray-vs-Sphere and Ray-vs-AABB tests, capped by Beam range. Projectile advancement uses constant velocity with an explicit finite positive `dt` and swept-Sphere tests: segment-vs-expanded-sphere for sphere proxies and segment-vs-AABB after expanding the AABB by Projectile radius. Each step distance is capped at the earliest of requested `dt`, remaining lifetime, and remaining maximum path range. Collision at the inclusive terminal boundary is evaluated before expiry. A Projectile produces at most one Hit or one `ProjectileExpiredEvent`, never both, and a hit consumes it.

The lowest non-negative intersection distance wins. Distances within `1e-9` are ties and are resolved by lexicographically ascending Proxy ID. AABB slab/normal ties use axis order X, then Y, then Z. Start overlap is a hit at distance zero. If the surface normal is degenerate, the normal is the normalized opposite of the Ray/Projectile travel direction; zero travel direction is a contract error.

`HitResult` explicitly contains Hit ID, delivery kind, Source/Target/Weapon/optional Projectile/Proxy/optional Module IDs, Tick, Frame ID, point, normal, distance, segment fraction, incoming direction, and `incomingSpeedMetersPerSecond`. Projectile speed is the finite positive magnitude of its velocity; the speed is `null` for the V1 instantaneous Beam Ray rather than an invented infinite or arbitrary value. Beam and Projectile hit resolution return frozen hit data plus `HitEvent`; neither applies damage.

## Damage routing and recoverability

`DamageType` is `Kinetic | Thermal | ElectricalEmp | Explosive | Cutting`. `createDamagePacketFromHit(hit, payload)` creates a frozen `DamagePacket` carrying stable Packet ID, Source/Target/Weapon/Hit and optional Module IDs, type, finite non-negative raw damage, and tick. `applyDamage(packet, damageableSnapshot)` requires matching Target/Module identity. Armor, Hull, and every Module carry finite non-negative current/max integrity and a complete five-entry Resistance map with each value in `[0, 1]`.

Damage application is deterministic and ordered:

1. Armor Resistance reduces raw damage; remaining Armor integrity absorbs as much of that reduced amount as available.
2. Only the penetrating remainder continues.
3. Hull Resistance is applied to the penetrating remainder and the resulting Hull damage is subtracted.
4. If and only if the Hit explicitly identifies a Module, that same penetrating remainder is independently reduced by the Module Resistance and applied to that Module. Module damage is not diverted from Hull damage.

An explicitly named Module ID must exist on the Target or `CombatContractError` is thrown. Without a Module ID, no Module is selected. No random or fallback Module selection occurs. Every integrity output is clamped to `[0, maximum]`; no negative, NaN, or Infinity result is possible.

Each Module defines role `MainThrust | Rcs | Weapon | Sensor | Cargo | Other`, finite degraded/disabled integrity thresholds with `0 <= disabledThreshold <= degradedThreshold <= maximum`, and `disabledRecoverability` as `Recoverable | RequiresReplacement`. Status derives from post-damage integrity: zero is `Destroyed`; at or below disabled threshold is `Disabled`; at or below degraded threshold is `Degraded`; otherwise `Operational`. `Destroyed` is always `RequiresReplacement` and is sticky under further damage. Damage never raises integrity or status.

Module effects are result semantics only:

- MainThrust outside Operational -> `MainThrustAuthorityReduced`;
- Rcs outside Operational -> `RcsAuthorityReduced`;
- Weapon Disabled or Destroyed -> `WeaponDisabled`;
- Sensor outside Operational -> `SensorDegraded`;
- Cargo Disabled or Destroyed -> `CargoBreach`;
- Other -> no effect.

No effect is applied to Flight, Runtime, cargo, sensors, or weapons by this change. `DamageApplicationResult` includes immutable before/after snapshots, Armor/Hull/optional Module deltas, effects, canonical signature, `DamageAppliedEvent`, an optional `ModuleStateChangedEvent`, and `TargetDestroyedEvent` only on the first transition from positive Hull integrity to zero.

## Events and ordering

The event union is `WeaponFireEvent | ProjectileSpawnedEvent | ProjectileExpiredEvent | HitEvent | DamageAppliedEvent | ModuleStateChangedEvent | TargetDestroyedEvent`. Each event has deterministic Event ID, non-negative safe-integer tick, Source and Target IDs where the event semantics provide them, stable result data, and no UI text.

`sortCombatEvents` compares, in order:

1. tick;
2. phase `WeaponFire`, `ProjectileSpawned`, `ProjectileExpired`, `Hit`, `DamageApplied`, `ModuleStateChanged`, `TargetDestroyed`;
3. Source ID;
4. Target ID;
5. Weapon ID;
6. Projectile ID;
7. Module ID;
8. Event ID.

Missing optional IDs compare as the empty string. This order is the sole canonical event order. Event creation and sorting clone/freeze inputs; repeated equivalent input produces byte-identical canonical JSON and signature.

## Browser evidence and safe scope

The Playwright test loads normal `/`, installs Console/Page/Network/HTTP error collection before navigation, verifies `window.TestBridge` is absent both before and after the scenario, dynamically imports `/src/combat/index.ts`, selects a Target, evaluates permission, fires a Projectile, advances it to a Hit, applies Damage, and verifies canonical events. The complete scenario runs twice and requires identical canonical JSON and signatures; inspected signatures are pinned as test constants. Evidence contains no timestamps, machine paths, or screenshots and is written only to the two task-owned evidence files.

Only the paths named in the task allowlist may change. Unity is not started. Package/lockfiles and existing Browser feature directories remain unchanged. The branch is committed once with the prescribed title/body and pushed to its feature branch only after fresh verification, diff review, and scope audit.
