# Proposal

## Change
`browser-world-chunk-registry-streaming-core-v1`

## Problem
The Browser world currently has absolute coordinates, floating-origin projection, simulation bubble modes, and render-only low-poly descriptors, but no deterministic chunk registry or residency planner. Scaling beyond the fixed asteroid field would otherwise make chunk identity, ordering, residency, LOD, and budget outcomes dependent on runtime/render state.

## Goal
Provide a deterministic backend-only world chunk registry and streaming snapshot contract derived exclusively from absolute world state and explicit configuration. Equal inputs must yield byte-equivalent canonical output, stable transition ordering, and floating-origin-invariant signatures.

## Scope
- Canonical integer chunk coordinates, IDs, bounds, metadata, immutable registry snapshots, and spatial queries.
- Separate simulation residency (Full/Snapshot/Dormant) and render LOD (Near/Medium/Far/Culled).
- Explicit Full, Snapshot, visible, and optional entity budgets with deterministic overflow reporting.
- Stateful but deterministic hysteresis and ordered transition events.
- Query-gated TestBridge scenario, Playwright evidence, and architecture/roadmap documentation.

## Non-Goals
No network/backend service, database, async asset loading, persistence, terrain or planet generation, orbital/surface runtime, save/load, Three.js chunk rendering, UI/HUD controls, or replacement of the live runtime world.

## Constraints
Absolute world coordinates remain durable truth; local frames are projection only; the renderer never owns gameplay truth. The forbidden UI/render/runtime-HUD, Assets, package, and lockfile paths from the task must remain unchanged. If a correct solution requires one, stop and report the dependency.