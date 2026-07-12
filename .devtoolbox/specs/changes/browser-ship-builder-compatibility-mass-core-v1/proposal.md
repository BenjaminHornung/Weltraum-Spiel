# Proposal: Browser Ship Builder Compatibility & Mass Core v1

## Motivation

The browser Ship Builder can serialize immutable catalogs and authoritative blueprints, but it cannot yet evaluate whether explicit connections are compatible, whether enabled parts form one reachable structure, or what dry mass, center of mass, and grid extent the blueprint has. Later Builder UI and runtime work need these answers from deterministic domain data rather than mesh proximity, renderer bounds, categories, or flight state.

## Outcome

Provide a pure TypeScript domain layer that:

- validates explicit connection endpoints against an explicit immutable policy;
- reports stable structured compatibility and structural diagnostics;
- builds deterministic connected components and root reachability;
- evaluates enabled-instance dry mass, grid/meter center of mass, and yaw-aware grid bounds;
- produces deeply immutable JSON-safe reports with canonical signatures;
- proves the three existing starter fixtures through unit and normal-route browser evidence.

## Scope

- Product code only under `apps/weltraum-browser/src/ship-builder/**`.
- Focused `shipBuilderCompatibility`, `shipBuilderValidation`, and `shipBuilderMassProperties` unit suites.
- One normal-route Vite/Playwright smoke and task-specific JSON/Markdown evidence.
- Browser-mainline compatibility/mass documentation, intent-index, and roadmap updates.
- This DevToolbox change and its test protocol.

## Non-goals

- No Builder UI, HUD, runtime, renderer, simulation, flight controller, navigation, planner, executor, telemetry, or TestBridge integration.
- No `Assets/**`, Unity startup, package/lockfile changes, production art binding, compatibility-alias import logic, or mesh/collider/proximity inference.
- No overlap validation, flight-readiness, thrust/RCS/authority, fuel/cargo/ammo/crew/resource mass, economy, recipes, final balance, or active-ship mutation.
- No serialized Catalog, PartSocket, PartDefinition, PartInstance, Connection, or Blueprint schema changes.

## Success

All required focused/full tests, builds, browser smokes, solution checks, DevToolbox verification, and allowlist audits pass. Existing catalog signature and fixture layout hashes remain unchanged. Scout, Cargo, and Weapon fixtures each report one connected component and the expected dry mass, COM, bounds, and occupied endpoints. The feature branch is pushed but not merged to main.
