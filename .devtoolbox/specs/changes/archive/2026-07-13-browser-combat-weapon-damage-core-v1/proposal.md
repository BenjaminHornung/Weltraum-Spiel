# Browser Combat Weapon Damage Core v1

## Motivation

The Browser mainline has persisted Ship Builder weapon components, but it does not yet have a shared runtime-domain contract for deciding whether a weapon may fire, advancing projectiles, resolving authoritative hits, or applying damage. Implementing those rules in render, UI, or encounter code would make visuals authoritative and would fragment combat behavior across consumers.

## Outcome

Provide a deterministic, immutable, renderer-independent TypeScript domain core for runtime weapon capability/state, target snapshots, fire permission, Projectile and Beam delivery, explicit hit results, Armor/Hull/Module damage, semantic module effects, and canonical combat events.

## Scope

- Runtime-validated stable IDs, units, coordinate frames, weapon poses, targets, collision proxies, damage states, and events.
- Fixed- and Turret-weapon permission checks with Projectile or Beam delivery, explicit Ammo/Energy requirements, optional deterministic Heat, and stable blocker ordering.
- Fixed-step swept Projectile collision and Beam ray collision against authoritative Sphere and frame-axis-aligned AABB proxies.
- Explicit two-step Hit Resolution and Damage Apply with Armor, Hull, explicitly hit Modules, recoverability, and semantic effects.
- Five focused unit suites, a normal-route Playwright scenario, deterministic JSON/Markdown evidence, and one focused Browser-domain document.

## Architecture boundary

All product implementation belongs under `apps/weltraum-browser/src/combat/**` and is publicly imported from `/src/combat/index.ts`. The module consumes adapter-friendly runtime snapshots and does not import Ship Builder, UI, Flight, Navigation, Runtime, Render, Resources, Test Harness, Three.js, or Unity code. Existing persisted `FixedWeapon` and `TurretWeapon` Ship Builder definitions are neither changed nor duplicated.

## Non-goals

- No Ship Builder adapter, Resource/Economy integration, Combat UI, VFX, enemy, encounter runtime, or normal-route TestBridge.
- No recoil/impulse physics, target-priority AI, turret slew simulation, random spread, repair operation, or gameplay balancing.
- No OBB, capsule, mesh, node, or renderer collision authority.
- No package/lockfile, Unity/Assets, Flight, Navigation, Runtime, Render, UI, Ship Builder, Resources, or Test Harness changes.

## Success

The required unit, TypeScript, build, and Browser checks pass; identical inputs produce identical frozen results, event sequences, evidence, and pinned signatures; collision and damage are independent pure steps; caller inputs remain unchanged; normal `/` remains free of TestBridge and browser errors; and only the explicit allowlist changes.
