# Proposal: Browser Ship Builder Domain Catalog v1

## Motivation

The Browser/Three.js mainline has no Ship Builder domain implementation. Existing concept, validation, formula, UX, acceptance, and test-flight documents define the intended boundaries, but Browser code cannot yet represent reusable part definitions, placed instances, explicit functional components, sockets, connections, catalog versions, or durable blueprint data.

Without a deterministic domain contract, a later Builder UI could accidentally infer capability from palette category or rendered meshes, persist unstable identities, trust derived caches, or create JSON that cannot be migrated safely.

## Outcome

Provide a Browser-native, renderer-independent TypeScript foundation that can:

- organize parts by extensible category without assigning gameplay capability;
- express capability only through explicit typed functional components;
- represent reusable definitions, stable placed instances, sockets, and first-class connections;
- parse and serialize versioned catalog and blueprint JSON with stable structured errors;
- produce insertion-order-independent canonical catalog signatures and blueprint layout hashes;
- expose immutable generated indexes without serializing them;
- supply an eight-category, sixteen-part starter catalog and scout/cargo/weapon fixtures;
- run in normal Vite browser runtime without TestBridge or Builder UI changes.

## Scope

- New code only under `apps/weltraum-browser/src/ship-builder/**`.
- Unit suites `shipBuilderCatalog`, `shipBuilderBlueprint`, and `shipBuilderSerialization`.
- One core-module Playwright smoke test and deterministic JSON/Markdown evidence.
- Browser-mainline domain documentation, catalog coverage mapping, intent-index and roadmap updates.
- This DevToolbox change and its execution/verification evidence.

## Non-goals

- Builder palette/editor/HUD/HTML/CSS, renderer meshes, runtime/simulation integration, Unity work, test-flight spawning, or active-ship promotion.
- Full compatibility, flight-readiness, validation, stat aggregation, resource/economy, power/heat, damage, or migration engines.
- Final balance or economy costs.
- Porting Unity classes one-to-one or treating meshes/overlap as gameplay truth.

## Fixed constraints

- Category is search/palette metadata only. No category branch may grant thrust, control, storage, weapons, sensors, docking, armor, or other capability.
- Serialized data is JSON-safe and function-free. Future behavior lives in code-side handlers keyed by component kind.
- IDs are validated caller-supplied stable strings, independent of timestamps, randomness, registration order, display names, and localization.
- Functional sockets and component socket references are explicit; no part/world origin, identity-direction, or zero-vector fallback.
- Blueprint layout and connections are authoritative. Caches, timestamps, and active-ship state are not authoritative layout hash inputs.
- The active checkout belongs to parallel UI/Unity work. Implementation occurs in the isolated `feature/browser-ship-builder-domain-catalog-v1` worktree and may modify only the approved allowlist.

## Success

The requested unit, build, and Playwright commands pass; catalog/blueprint canonical behavior is pinned; evidence parses; exactly the intended files change; all eight categories and at least sixteen typed part definitions exist; the three fixture blueprints reference valid definitions; and no UI/runtime/render/sim/Assets/package/lockfile file changes.