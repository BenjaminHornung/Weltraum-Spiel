# Proposal: Browser Simulation Scheduler Core V1

## Motivation

Background, dormant, mission, outpost, and later offline-simulation work needs one deterministic planner that decides which domain jobs should execute at an explicit universe-time snapshot. The planner must not own time, execute gameplay, or gain runtime, renderer, scene, DOM, or worker authority.

## Outcome

Add a pure TypeScript scheduler core under `apps/weltraum-browser/src/simulation-scheduler` that validates immutable job definitions/instances and snapshots, creates byte-stable budgeted plans, applies explicit commands and CAS-protected results, and emits only execution and persistent-event intents.

## Scope

- Public scheduler contracts, validation, deterministic planning, commands, result application, fixtures, canonical bytes/signatures, and diagnostics.
- Focused unit coverage plus normal-route Playwright proof on port 5231.
- JSON/Markdown evidence and browser-mainline documentation.
- Reuse only public exports from `src/persistence/index.ts` for UniverseTime, stable IDs/references, SimulationMode, canonical JSON/signatures, event contracts, validation, cloning, and deep freeze.

## Non-goals

No gameplay implementations, missions/economy/offline wall-time progression, automatic universe-time advancement, runtime containers, threads/workers, renderer/scene/DOM/UI/network/multiplayer, persistence schema V2, or modifications outside the approved write allowlist.

## Delivery

Start from pinned `BASE_SHA=75d78d4c8d12e2d85a8fb70864feb19dbe8d9c8f` on `feature/browser-simulation-scheduler-core-v1`. Complete as one tightly related DevToolbox task and one final commit named `#WELTRAUM-000 Add deterministic simulation scheduler core`, then push normally without PR or merge.
