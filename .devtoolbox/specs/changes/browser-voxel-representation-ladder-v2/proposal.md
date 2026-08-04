# Proposal: Browser Voxel Representation Ladder V2

## Baseline and objective

Implement on `feature/browser-voxel-representation-ladder-v2` from freshly fetched `origin/main` at `15f3550bd604856b25d40a7ac700ec4d5106b89e`. The change adds a deterministic, renderer-independent, descriptor-driven derived representation ladder above the unchanged Adaptive Microvoxel Authority. The descriptor accepts 1..32 product bands and is proven with at least 12 bands; it is not a fixed six-level union.

## Authority boundary

`AdaptiveLevel`, `ADAPTIVE_LEVELS`, `MICROVOXEL_BASE_QUANTUM_METERS`, Adaptive keys, canonical FNV-1a64 JSON/hash semantics, journals, coverage proofs, provenance, Structural connectivity, mass, collision, persistence, and gameplay outcomes remain unchanged. Representation bands, cameras, viewport, quality settings, readiness, meshes, and proxies are selection inputs or derived products only. The module reuses public Adaptive canonical hashing and creates no second serializer, hash, voxel state, or world authority.

Low through Ultra may alter visual detail, distance, proxy choice, and render/stream/upload budgets only. Every hard interaction reason still requests Level-4 authority; render selection never determines edit geometry, structural truth, mass, collision, save state, or multiplayer truth.

## Scope

- Add pure TypeScript contracts under `apps/weltraum-browser/src/voxel/representation/**` for strict descriptors, screen-space error, hysteresis, proxy revision identity, hard pins, simulation/render separation, atomic fallback, lifecycle eviction, and immutable quality policies.
- Extend graphics settings additively to schema V2 with explicit V1-to-V2 migration, deterministic defaults, preservation of all V1 fields, fail-closed malformed/future handling, and independent `display.renderDistance` versus `voxelDetailDistance`.
- Keep new player controls hidden or truthfully Planned because no production representation runtime consumes them yet; a pure policy adapter and tests are not an Applied runtime claim.
- Add focused unit tests, one normal-route Playwright proof assigned exactly once to `test:e2e:core`, deterministic timestamp-free JSON/Markdown evidence, and bounded documentation/status updates.
- Use explicit finite caps for 32 bands, candidates, pins, source bindings, fallback groups, bytes, work, and upload units. Reject over-budget work atomically.

## Deferred and forbidden

No dependency or lockfile change; no Unity, Three.js, DOM, browser globals, wall-clock, randomness, worker/cache completion-order authority, renderer authority, runtime planet streaming, physics handoff, building-collapse runtime, proxy mesh generation, TestBridge, Adaptive/Structural semantic change, savegame/database integration, deployment, release, force-push, direct main push, or merge.

## Completion gate

Complete only after Node 22 install/build/unit/E2E matrices, two retry-free byte-identical focused browser runs, full core/live/ui groups, static scope/nondeterminism/import/secret/lockfile checks, deterministic evidence validation, one focused technical review, DevToolbox verification and per-task completion preflights, final Plannotator review, current-`origin/main` recheck/normal merge if needed, clean exact-head CI and Codex review, open PR, and no merge.
