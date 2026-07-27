# Hestia First-Person Combat Slice V1 — Contract and Parallelization Plan

## Goal and pinned basis

This plan defines the binding implementation boundary for a first playable, player-facing Hestia surface combat slice. It is based on `origin/main` `a2b3beb1704a7e8eb1f270f2fa80731989ac9c2e` and the DevToolbox change `browser-hestia-first-person-combat-slice-v1`.

The feature is one deterministic, bounded `SurfaceRegion`. It is not a global voxel planet shell and does not implement orbit-to-surface travel. Its eventual normal browser entry is exactly `?surfacePlay=1`; the existing `?surfaceLab=1` path remains unchanged.

## Binding contracts

- `SurfacePlayIdentity` binds body, `SurfaceLocalFrame`, region, Hestia generator version/seed, and region revision.
- `SurfacePlayerSnapshot` and `SurfacePlayerCommand` carry stable identity, finite SI values, fixed simulation tick, movement/look/fire intent, and explicit recovery-only reset. They never encode a snap or velocity-zero fallback.
- `SurfaceCollisionQueryPort` binds ground/contact, capsule sweep, ray, and line queries to body, region, frame, revision, and tick without Three.js types.
- `SurfaceCombatSnapshot` projects Pulse Cutter resources, cooldown, target condition, latest accepted/rejected fire result, and ordered Combat Core event summaries. Combat Core remains damage authority.
- `SurfaceVoxelEditRequest` requests only revision-bound, quantized `SubtractSphere`; `SurfaceVoxelEditResult` distinguishes applied, no-change, and typed rejection and preserves authoritative revision/hash ownership.
- `SurfacePlayHudSnapshot` is strictly player-facing and excludes worker, queue, hash, brick, revision, and debug telemetry.
- Presentation ports consume derived player, terrain, target, weapon, and impact snapshots. They own no collision, world, damage, or edit transition.

Equal validated command inputs produce equal canonical command identity. Factories validate stable IDs, finite values, safe ticks/revisions, copy nested data defensively, and freeze published values. Contracts import no Three.js, DOM, browser global, or TestBridge API.

## Execution lanes

### Agent 1 — Locomotion and collision

Implement fixed-tick walk, sprint, jump, grounded state, Hestia gravity, capsule movement, ground/contact handling, slopes/steps, and deterministic collision. Prove stale frame/revision failure and input ownership. Do not implement rendering, damage, terrain edits, or route wiring.

### Agent 2 — Surface combat

Adapt the Pulse Cutter and Survey/Security drone to existing Combat Core permission, hit, damage, destruction, and event ordering. Own energy, heat, cooldown, and typed fire projection. Do not create a parallel damage core or mutate terrain.

### Agent 3 — Hestia presentation

Present bounded deterministic Hestia terrain, player, drone, held industrial cutter, impacts, lighting, and low-poly/microvoxel atmosphere from derived snapshots. Renderer lifecycle and resources remain presentation-only; Surface Lab remains independent.

### Agent 4 — Voxel impact authority

Translate accepted terrain ray hits into current Adaptive/Structural `SubtractSphere` commands. Own quantization, stale/duplicate/no-change/rejection handling, changed-brick ordering, revision/hash receipts, and remesh publication. Do not infer success from visual effects.

### Agent 5 — Suit HUD

Implement a small accessible HUD for mode, movement/grounded state, energy, heat, cooldown, target condition, and latest action/block. Do not expose debug telemetry or author gameplay state.

### Agent 6 — Integration and route

Integrate verified lanes behind exactly `?surfacePlay=1`, own startup/cleanup and mode/input isolation, preserve `?surfaceLab=1`, and update task state only after fresh evidence. This is the only cross-lane runtime integration owner.

### Agent 7 — E2E, evidence, docs, and closeout

Prove the normal player route, deterministic startup, locomotion/collision/gravity, drone damage/destruction, resource/cooldown behavior, revisioned terrain edit, HUD, reload/rejection paths, and Hestia visual identity. Reconcile documentation, run completion preflight, technical review, full verification, and final human review before closeout.

## Coordination rules

1. All follow-up agents pin the contract commit SHA reported by this change and must stop if public contract behavior needs to change.
2. Agents do not merge whole historical branches. Selective reuse must follow `tests/reuse-audit.md` and current-main API evidence.
3. Only Agent 0 and later Agents 6/7 may edit or toggle `tasks.md`.
4. One DevToolbox execution represents the complete change; workers add meaningful notes and never create per-task executions.
5. Parallel writes are allowed only for disjoint owner paths. Frame/revision semantics, shared authority, route wiring, and task state are sequential integration points.

## Verification gates

- Contract gate: TypeScript compile, focused contract Vitest, production build, diff/scope/forbidden-import/secret checks.
- Lane gate: focused unit evidence for each authority owner plus technical review.
- Integration gate: normal-route Playwright evidence without TestBridge and explicit Surface Lab/input-isolation regressions.
- Closeout gate: complete DevToolbox verification/preflight, one final reviewer pass, and final Plannotator approval before publication or completion claims.

## Deferred scope and residual risks

Global planet streaming, orbit transition, multiplayer, final keybinds/balance, broader damage taxonomy, cargo/ammo economy, and first-ship story remain deferred. Main implementation risks are stale frame/revision data, accidental presentation authority, incompatible historical branch assumptions, mismatch between Hestia generation resolution and Adaptive quantum, and input leakage into flight/planner modes.
