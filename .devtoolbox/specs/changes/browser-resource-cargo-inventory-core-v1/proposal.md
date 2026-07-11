# Browser Resource Cargo Inventory Core v1

## Motivation
The Browser has no shared implementation for resource identity, cargo/inventory containers, or explicit transfers even though the planning package defines one cross-system model. Ad hoc cargo representations would fragment Ship Builder, flight, mining, drones, outposts, missions, and economy.

## Outcome
Provide a deterministic, immutable, extensible Browser module with one stable resource identity, one generic mass/volume container model, explicit atomic/partial transfer commands and results, and a small ResourceRequirement seam for later Ship Builder integration.

## Scope
- Runtime-validated resource/category catalogs and eight provisional starter resources.
- Validated stack rules and immutable resource stack state.
- Generic suit, ship, drone, outpost, cargo-module, external-rack, mission, and mining-reservoir containers with derived snapshots.
- Pure transfer engine with stable statuses, rejection codes, warnings, revisions, and signatures.
- Unit tests, a normal-page dynamic-import Playwright smoke test, deterministic JSON/Markdown evidence, and focused Browser mainline documentation.

## Non-goals
- No UI or normal runtime integration.
- No edits under `src/ship-builder/**`; only a validation seam is exported.
- No flight-mass/autopilot mutation, mining gameplay, economy consequences, rare resources, Unity/Assets work, package changes, or special-case container engines.

## Success
All required unit/E2E/build checks pass; catalog and container signatures are order-independent and byte-stable; rejected atomic commands leave inputs unchanged; accepted commands return new canonical states with exactly one revision increment; only allowlisted paths change.