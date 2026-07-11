# Design: Runtime-owned local navigation map

## Context

The planner map currently projects selected runtime geometry in `src/ui/plannerMap.ts`, while CSS and `/concept/planner-system-map-clean.png` add fake semantic bodies and target-specific marker positions. BrowserRuntime already owns ship state, planner targets, RoutePlan data, obstacles, and the active proving-ground world.

## Architecture

### Runtime snapshot boundary

Add immutable, deterministic contracts:

- `NavigationMapSnapshot`
- `NavigationMapEntitySnapshot`
- `NavigationMapShipSnapshot`
- `NavigationMapTargetSnapshot`
- `NavigationMapObstacleSnapshot`
- `NavigationMapRouteSnapshot`
- `NavigationMapViewportState`

The snapshot uses absolute `WorldCoordinate` positions in the absolute-system frame. Arrays whose order is not semantic are canonicalized by stable ID; RoutePlan nodes and segments retain planner order. A stable signature is computed from canonical serializable data. The snapshot is frozen so UI code cannot mutate runtime truth.

### Active ship presentation

The runtime map layer owns a non-renderer presentation descriptor for the current active ship. The default browser ship is identified as `Demo Scout GLB`, blueprint `demo-scout-mk1`, visual `demo-scout-mk1-glb`, symbol `demo-scout-top`, with local forward axis +X. The map renders that descriptor and exposes the display/identity text.

### World streaming adapter

A read-only world adapter groups `provingGroundAsteroidField` entities into deterministic 256 m chunks and drives `WorldChunkRegistry` plus `WorldStreaming` using the ship's absolute position. Full and Snapshot residents appear in map entity layers; Dormant entities do not. Render LOD affects presentation only and never entity existence or semantic position.

Policy:

- Full radius 256 m
- Snapshot radius 3200 m
- render bands 512/1600/3200 m
- hysteresis 32 m
- budgets 8 Full chunks, 64 Snapshot chunks, 64 visible chunks, 256 entities

### BrowserRuntime integration

`TelemetrySnapshot.navigationMap` remains optional for old fixtures, while BrowserRuntime always populates it. The snapshot uses current ship state, all runtime planner targets, selected target ID, `lockedPlan ?? ready routePreview.plan`, runtime obstacles, and the current world-streaming snapshot. Map rendering never calls the planner and never replans.

### Unified projection

The map UI receives only `NavigationMapSnapshot` plus UI-owned `NavigationMapViewportState`. X maps horizontally and Z vertically. The same view transform projects ship, targets, route nodes/segments, obstacle circles, and world entities.

- North-up: world rotation 0; ship marker rotation = 90 degrees minus heading.
- Ship-up: world rotation = 90 degrees minus heading; ship marker remains upright.
- Degenerate vertical-forward projection falls back to effective north-up.

Viewport state persists across telemetry renders and planner reopen. Focus fits all semantic geometry with 10% padding and a minimum 100 m span. Pointer drag and arrow keys pan. Wheel zoom is cursor-centered; buttons provide discrete zoom and focus. A 1-2-5 scale bar reports meters or kilometers from current projection scale.

### Runtime target interaction

Every target marker carries its exact runtime target ID. Marker activation reuses the existing planner target button command path by locating `#planner-target-options button[data-planner-target-id]` with exact dataset equality and invoking its existing click behavior. This preserves locking, dispatch, feedback, and preview behavior without changing `statusHud.ts`.

### Presentation separation

Map decoration remains CSS/HTML chrome. Semantic geometry lives in dedicated runtime SVG layers/elements only. Remove all static semantic background image references, fake semantic radial bodies, fixed ship/target/hazard coordinates, and all target-ID-specific CSS selectors.

## Scope boundaries

Allowed product paths are limited to:

- `apps/weltraum-browser/src/ui/plannerMap.ts`
- new `apps/weltraum-browser/src/navigation/map/**`
- `apps/weltraum-browser/src/world/**` adapters
- `apps/weltraum-browser/src/sim/telemetry.ts`
- `apps/weltraum-browser/src/runtime/browserRuntime.ts`
- planner HTML/CSS
- focused unit/E2E tests and evidence

Do not change `statusHud.ts`, flight physics, planner semantics, renderer ownership, `Assets/**`, packages, or lockfiles.

## Risks and safe stops

- If a required target action cannot reuse the existing button command path, stop before expanding scope into `statusHud.ts`.
- If streaming integration requires changing world-core semantics, stop and adapt only through the public registry/streaming contracts.
- Preserve optional telemetry compatibility for existing tests.
- Keep all commits within the isolated feature worktree.