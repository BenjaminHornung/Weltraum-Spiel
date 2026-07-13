# Tasks

All tasks remain open until implementation evidence exists and the DevToolbox completion preflight can run from an authorized workspace.

## Phase 1 — Combat domain and fire control

- [ ] 1. Implement stable IDs, canonicalization, vectors/frames, immutable validation, public contracts, and fixtures under `apps/weltraum-browser/src/combat/**`.
  - Objective: establish the standalone adapter-friendly domain boundary for Weapon, Target, Projectile, Proxy, Hit, Damage, Module, and Event data.
  - Acceptance: branded IDs, explicit units/frames, strict pose/proxy/numeric validation, canonical FNV-1a signatures, recursive frozen outputs, and `CombatContractError`; no caller mutation, clock, random, renderer, Three.js, Ship Builder duplication/import, or root barrel edit.
  - Verification: TypeScript check plus focused immutability, invalid-number, signature-repeatability, and source-import assertions across the combat unit suites.
  - Stop/escalate: stop on any required edit outside the allowlist or any need to redefine existing Ship Builder `FixedWeapon`/`TurretWeapon` contracts.

- [ ] 2. Implement Weapon runtime advancement, stable Target selection, fire permission, and accepted fire transitions.
  - Objective: decide and execute Fixed/Turret Projectile/Beam fire from explicit runtime snapshots without performing Hit or Damage application.
  - Acceptance: exact blocker ordering; inclusive range/arc/yaw/pitch/tracking rules; explicit owner/friendly-fire/permission/line-of-fire inputs; hybrid Ammo+Energy atomicity; deterministic optional Heat and cooldown; blocked fire is inert; accepted fire emits the correct delivery/events and increments shot sequence once.
  - Verification: `npm run test -- tests/unit/combatFireControl.test.ts`.
  - Stop/escalate: no UI, runtime, resource regeneration, turret slew, random spread, or scene query may be introduced; stop before implementation if a product or architecture decision is missing from this change package.

## Phase 2 — Delivery and hit resolution

- [ ] 3. Implement Projectile fixed-step advancement, expiry, Beam rays, Sphere/AABB intersections, and explicit Hit Results.
  - Objective: produce deterministic delivery state and authoritative Hits independent of visuals.
  - Acceptance: constant-velocity Projectile integration with explicit positive `dt`; lifetime/path caps; swept-Sphere-vs-Sphere/AABB collision; boundary Hit before expiry; owner exclusion; nearest-hit and lexical/axis tie rules; start-overlap normal fallback; exactly one Hit or expiry; Beam parity; no Damage mutation.
  - Verification: `npm run test -- tests/unit/combatProjectiles.test.ts` and `npm run test -- tests/unit/combatHitResolution.test.ts`.
  - Stop/escalate: do not add OBB/capsule/mesh/renderer authority, physics-engine coupling, or VFX.

## Phase 3 — Damage and events

- [ ] 4. Implement Armor/Hull/Module damage, status/recoverability, semantic effects, and canonical events.
  - Objective: apply explicit Damage Packets as a pure post-Hit step and expose deterministic diagnostics/events.
  - Acceptance: all five Damage Types and complete Resistance maps; Armor first; penetrating damage independently reaches Hull and explicit Module; no implicit Module; bounded integrity; sticky Destroyed; configured Disabled recoverability; role effects without runtime application; exact event identity/phase/tie ordering and signatures.
  - Verification: `npm run test -- tests/unit/combatDamage.test.ts` and `npm run test -- tests/unit/combatEvents.test.ts`.
  - Stop/escalate: do not implement repair, detachment, economy consequences, Flight/Runtime effects, or random Module choice.

## Phase 4 — Browser evidence and documentation

- [ ] 5. Add the normal-route Playwright scenario, deterministic evidence files, and focused Browser documentation.
  - Objective: prove the public module runs in a real Vite Browser without a TestBridge or runtime integration.
  - Files: `apps/weltraum-browser/tests/e2e/combat-weapon-damage-core.spec.ts`; two `evidence/browser-combat-weapon-damage-core-v1*` files; `docs/browser-mainline/combat-weapon-damage-core-v1.md`.
  - Acceptance: error hooks install before `/`; TestBridge is absent before/after; `/src/combat/index.ts` imports; Target -> permission -> fire -> Projectile -> Hit -> Damage -> event flow runs twice; canonical JSON/signatures match and pinned constants pass; deterministic JSON/Markdown contain no timestamp/machine path/screenshot; docs capture API, units, blocker/collision/damage/event semantics, and non-goals.
  - Verification: `npm run test:e2e -- tests/e2e/combat-weapon-damage-core.spec.ts` and parse the generated JSON.
  - Stop/escalate: no normal-route production hook, static combat graphic, screenshot evidence, fake enemy, UI, or runtime wiring.

## Phase 5 — Fresh verification, review, and Git delivery

- [ ] 6. Run focused and full regression verification, inspect evidence/diff, and audit the allowlist.
  - Objective: collect fresh exit-code evidence that the implementation is correct, browser-compatible, and scope-safe.
  - Acceptance: all exact commands in `tests/test-protocol.md` pass; evidence JSON parses; no forbidden imports/paths; no package/lock/Assets or prohibited Browser changes; diff is reviewed and `git diff --check` is clean; original scenario reproduces deterministically.
  - Verification: use the complete command block and scope audits in `tests/test-protocol.md`; record actual results there without checking this task until DevToolbox preflight succeeds.
  - Stop/escalate: unexpected failures go to debugging; do not weaken tests, modify forbidden paths, or claim Done from worker reports alone.

- [ ] 7. Complete DevToolbox preflight when authorized, commit, and push the isolated feature branch.
  - Objective: close tasks only with Evidence and completion preflight, then deliver the reviewed branch without merging to `main`.
  - Acceptance: authorized DevToolbox `verify_run` and `tasks_completion_preflight` support task closure; commit title is `#WELTRAUM-000 Add browser combat weapon and damage core` with the prescribed concise body and one line per changed file; branch pushes to `origin/feature/browser-combat-weapon-damage-core-v1`; completion report contains base SHA, branch/commit, contracts, behavior, all test evidence, scope audit, limitations, and any continuing DevToolbox access blocker.
  - Verification: clean expected status after commit, remote branch confirmed, no merge to `main`.
  - Stop/escalate: while DevToolbox reports `unauthorized_path`, keep every checkbox open and report the limitation; never bypass completion preflight by manually marking tasks complete.
