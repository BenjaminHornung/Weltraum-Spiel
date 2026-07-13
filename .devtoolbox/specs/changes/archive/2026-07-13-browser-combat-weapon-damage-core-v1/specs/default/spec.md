# Browser Combat Weapon Damage Core Capability

## ADDED Requirements

### Requirement: Validated immutable combat contracts

The system SHALL expose runtime-validated, adapter-friendly, recursively immutable Combat contracts from `/src/combat/index.ts`, using branded save-safe IDs, explicit SI-derived units, non-negative safe-integer ticks, and explicit coordinate Frame IDs. It SHALL reject malformed IDs, non-finite values, invalid ranges, mismatched required state, non-orthogonal pose basis vectors, zero directions, and implicit Muzzle defaults with `CombatContractError`.

#### Scenario: Stable identities and frames

Equivalent validated inputs produce identical canonical IDs/signatures and frozen values, while different-frame targeting is invalid and different-frame collision input is rejected.

#### Scenario: Invalid numeric and pose data

NaN, Infinity, negative integrity/resource state, zero directions, invalid AABBs, non-positive capability values, and a default/omitted Muzzle pose are rejected without creating partial state.

#### Scenario: Caller ownership

Factories and transitions clone their inputs; mutating a caller-owned object after a call cannot change a result, returned values are recursively frozen, and no call mutates caller input.

### Requirement: Explicit Weapon and Target runtime state

The system SHALL model Fixed and Turret capabilities, Projectile and Beam delivery, explicit Damage Type/amount payload, explicit nullable Ammo and Energy requirements with at least one required, optional deterministic Heat, lifecycle, cooldown, shot sequence, Mount Pose, and stable-ID Target snapshots without importing or duplicating Ship Builder definitions.

#### Scenario: Hybrid resource requirement

A weapon requiring both Ammo and Energy is permitted only when both pools satisfy their costs; an accepted shot consumes both atomically, while either shortfall leaves all state unchanged.

#### Scenario: Deterministic cooldown and cooling

Advancing runtime state with the same elapsed seconds produces identical cooldown and Heat values clamped to zero, without Ammo refill or Energy regeneration.

#### Scenario: Stable target selection

Target selection uses only the requested stable Target ID and is independent of display names, input order, distance, and renderer state.

### Requirement: Deterministic fire permission

The system SHALL evaluate Target existence/validity, inclusive range, Fixed arc or Turret yaw/pitch, tracking alignment, cooldown, Ammo, Energy, Heat, lifecycle/permission/friendly-owner policy, and explicit line of fire. It SHALL return every applicable blocker in this exact order: `NoTarget`, `TargetInvalid`, `OutOfRange`, `OutsideArc`, `NotAligned`, `CooldownActive`, `AmmoEmpty`, `EnergyInsufficient`, `Overheated`, `FirePermissionDenied`, `LineOfFireBlocked`.

#### Scenario: Valid Fixed shot

An operational, aligned Fixed Projectile weapon with a valid in-frame Target, clear range/arc, ready cooldown, sufficient required resources/Heat margin, allowed policy, and clear line of fire is permitted and fires deterministically.

#### Scenario: Valid Turret shot

An operational Turret weapon whose Target is inside inclusive yaw/pitch and whose current Muzzle direction is within tracking error is permitted when all other gates are clear.

#### Scenario: Geometry blockers

A missing Target yields `NoTarget`; an out-of-range Target yields `OutOfRange`; a Fixed Target outside arc or Turret Target outside yaw/pitch yields `OutsideArc`; and a Turret not aligned with its otherwise valid Target yields `NotAligned`.

#### Scenario: Runtime and policy blockers

Active cooldown, empty Ammo, insufficient Energy, Heat that would exceed the limit, explicit permission/friendly-owner denial, and blocked line of fire yield their stable reasons without consuming state or creating delivery/events.

#### Scenario: Multiple blockers

The same multiply blocked request always returns the complete applicable reason set in the prescribed order and uses its first entry as primary reason.

#### Scenario: Accepted fire transition

Accepted fire consumes every required resource atomically, adds Heat, sets cooldown to the reciprocal fire rate, increments shot sequence once, emits `WeaponFireEvent`, and returns either explicit Projectile state plus `ProjectileSpawnedEvent` or an explicit Beam Ray without resolving damage.

### Requirement: Authoritative deterministic delivery and hits

The system SHALL use only explicit Sphere and frame-axis-aligned AABB collision proxies. Beam resolution SHALL use capped Ray intersections. Projectile advancement SHALL use explicit positive fixed `dt`, constant velocity, lifetime/path-range caps, and swept-Sphere intersections so a valid in-segment collision cannot tunnel through the supported proxies.

#### Scenario: Reproducible Projectile motion

The same Projectile and fixed-step inputs produce identical positions, traveled distance, remaining lifetime, state, and signatures.

#### Scenario: Projectile expiry

A Projectile reaching its lifetime or maximum path range without collision produces exactly one `ProjectileExpiredEvent` and no Hit.

#### Scenario: Swept boundary collision

A Sphere or expanded AABB intersected anywhere along the capped Projectile segment, including the expiry/range boundary, produces one explicit Hit before expiry.

#### Scenario: Nearest hit and stable tie

The nearest valid non-owner Proxy wins; intersections within `1e-9` resolve by lexicographically ascending Proxy ID, with AABB axis ties resolved X then Y then Z.

#### Scenario: Deterministic Beam

Resolving the same explicit Beam Ray against equivalent Sphere/AABB proxies returns the same nearest Hit and does not mutate Damage state.

#### Scenario: Explicit HitResult

A resolved Hit includes stable identity, delivery type, Source/Target/Weapon/Projectile/Proxy/Module identity where applicable, tick/frame, point, normal, distance, segment fraction, incoming direction, and finite Projectile speed or explicit `null` Beam speed, and emits exactly one `HitEvent`.

### Requirement: Deterministic Armor, Hull, and Module damage

The system SHALL support `Kinetic`, `Thermal`, `ElectricalEmp`, `Explosive`, and `Cutting` Damage with complete Armor/Hull/Module Resistance maps. A Damage Packet SHALL be deterministically derived from Hit plus delivery payload and carry matching Target/optional Module identity. Armor SHALL resist and absorb first; penetrating damage SHALL then be independently resisted and applied to Hull and, only when explicitly identified, the named Module.

#### Scenario: Armor and type Resistance

Armor reduces damage according to the packet type and its remaining integrity, and different Resistance entries allow ElectricalEmp and Kinetic packets with equal raw damage to produce different deterministic results.

#### Scenario: Explicit Module routing

An explicit existing Module receives its independently resisted share of penetrating damage while Hull receives its share; an omitted Module ID damages no Module and an unknown explicit ID is rejected.

#### Scenario: Module degradation and effects

Crossing configured integrity thresholds deterministically changes Module status from Operational to Degraded, Disabled, or Destroyed and returns only the semantic effects defined for its role.

#### Scenario: Disabled versus Destroyed

Disabled reports its configured recoverability, Destroyed always requires replacement, and further damage can never make a Destroyed Module operational.

#### Scenario: Safe state bounds

Damage never raises integrity and all Armor, Hull, and Module values stay within `[0, maximum]` without negative, NaN, or Infinity output.

#### Scenario: Damage events

Every application emits `DamageAppliedEvent`; a status transition additionally emits `ModuleStateChangedEvent`; the first positive-to-zero Hull transition emits `TargetDestroyedEvent`; later damage at zero does not repeat destruction.

### Requirement: Canonical events and signatures

The system SHALL derive Event identity from canonical stable inputs and sort events by tick, then phase `WeaponFire`, `ProjectileSpawned`, `ProjectileExpired`, `Hit`, `DamageApplied`, `ModuleStateChanged`, `TargetDestroyed`, then Source, Target, Weapon, Projectile, Module, and Event IDs.

#### Scenario: Canonical event ordering

Equivalent unsorted event inputs produce the same frozen ordered sequence, canonical JSON, and signature without UI text.

#### Scenario: Repeatability

Running the same Target-selection, fire, Projectile, Hit, Damage, and event scenario twice produces byte-identical canonical JSON and the same pinned signature.

### Requirement: Browser-only compatibility evidence

A Playwright test SHALL load normal `/`, verify TestBridge absence before and after the test, dynamically import `/src/combat/index.ts`, execute the deterministic end-to-end domain scenario twice, reject Console/Page/Network/HTTP errors, pin its canonical signatures, and write only deterministic task-owned JSON/Markdown evidence without screenshots or normal runtime integration.

#### Scenario: Renderer-independent source boundary

A source audit finds no Three.js, Render, scene-node, mesh, UI, Runtime, Ship Builder, or Test Harness import in `src/combat/**`, and no forbidden path has changed.
