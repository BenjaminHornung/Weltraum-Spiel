# Proposal: Browser Persistence, Universe Time & Event Core v1

## Motivation

The browser mainline has deterministic domain cores, but no shared persistence boundary for global time, stable instance identity, mutable object state, schema evolution, or persistent domain events. Later save/load, background simulation, mission, and multiplayer work need these concepts to be explicit before any runtime integration is attempted.

## Outcome

Provide a pure TypeScript persistence core that:

- models Universe Time as explicit 120 Hz state with a game-owned epoch and deterministic advances;
- distinguishes global Universe Time from independently advanced mission-local time;
- validates stable, prefixed instance and definition identifiers without clocks or implicit randomness;
- validates a strict, versioned, JSON-safe `SaveGameEnvelopeV1` containing definition references and mutable instance state;
- resolves definition references against an explicitly supplied, version-bound snapshot;
- migrates immutable generic records through consecutive, registered, per-stage-validated steps;
- maintains a deterministic persistent event queue and explicit event acknowledgement state;
- validates explicit Active/Background/Dormant and intervention-mode transitions;
- canonicalizes, signs, serializes, and roundtrips snapshots independently of insertion order; and
- proves the contract through focused unit tests and a normal-route browser scenario with deterministic evidence.

## Scope

- Product code only under `apps/weltraum-browser/src/persistence/**`.
- Six focused unit suites named `tests/unit/persistence*.test.ts`.
- One normal-route Playwright spec and task-specific deterministic JSON/Markdown evidence.
- One browser-mainline persistence contract document.
- This DevToolbox change and test protocol.
- One approved allowlist exception: append the new Playwright spec to the existing `test:e2e:core` command in `apps/weltraum-browser/package.json`. Do not change dependencies, other scripts, or either package lockfile.

## Non-goals

- No save/load button, main menu, save slots, production storage, LocalStorage, IndexedDB, cloud synchronization, or multiplayer persistence.
- No runtime materialization, scene materialization, renderer/mesh/CSS/Canvas/Three.js state, active flight state integration, or TestBridge integration.
- No actual background simulation, drone missions, timewarp, automatic offline advancement, or system-clock advancement.
- No changes to Flight, Navigation, Runtime, Renderer, UI, Combat, Celestial, Settings, Resources, Ship Builder, World, or Unity/`Assets/**` cores.
- No Celestial, Resource, Part, Damage, Power, Cargo, Plan, or Mission schema design beyond stable references required by this neutral envelope.
- No real V2 product save schema or product migration. The required `v1 -> v2` step is an isolated generic fixture used only to prove the registry.
- No implicit change to the existing 30 Hz runtime/physics loop. The 120 Hz value is the canonical persistence and future multiplayer-ready time quantum only.

## Base and delivery boundaries

- Isolated worktree branch: `feature/browser-persistence-universe-time-event-core-v1`.
- Recorded `origin/main` base SHA: `7e1d0237cdf272bfb759f26e2be8cdb3a760e15c`.
- The feature branch is committed and pushed but never merged to `main` by this change.
- Package dependencies and lockfiles remain byte-identical.
- DevToolbox MCP calls are intentionally `NOT RUN`: its restricted workspace root excludes this Temp worktree. Tasks remain unchecked and cannot be toggled or closed without a successful completion preflight.

## Success

All 30 mandatory unit cases, typecheck, full unit/build regressions, focused and full Playwright suites, repeated byte-equivalent browser evidence, scope audits, and diff checks pass. Canonical roundtrips produce identical bytes and signatures. The final diff contains only the approved allowlist plus the single `test:e2e:core` script append, and the feature branch is pushed without merging.
