# Proposal: Browser Navigation Map World Truth v1

## Goal

Replace the planner's hybrid static/runtime system-map presentation with a fully runtime-owned local navigation map driven by deterministic world snapshots.

## Motivation

The current map mixes live ship/route/obstacle geometry with a static semantic background and target-specific CSS coordinates. That creates two conflicting sources of world truth, prevents arbitrary runtime targets and streamed entities from appearing consistently, and makes map interaction and orientation behavior unreliable.

## Scope

- Add deterministic navigation-map snapshot contracts and projection utilities under `apps/weltraum-browser/src/navigation/map/**`.
- Adapt active WorldChunkRegistry/WorldStreaming state into map entities without making rendering authoritative.
- Populate the snapshot from BrowserRuntime telemetry using absolute WorldCoordinate values and frame identifiers.
- Render ship, targets, route, obstacles, and resident world entities through one projection pipeline.
- Replace the generic ship polygon with a descriptor-driven active-ship marker including display and visual identity.
- Add north-up/ship-up orientation, pan, zoom, focus, a real scale bar, and runtime target clicks.
- Rename the surface to LOCAL NAVIGATION MAP and remove fake semantic background bodies and target-specific coordinates.
- Add focused unit tests, normal-runtime Playwright coverage, and FHD/QHD evidence.

## Non-goals

- Flight physics changes.
- Planner or executor behavior changes.
- Silent replanning.
- Renderer-owned world truth.
- Unity `Assets/**`, package manifests, or lockfiles.
- A real celestial/system map before celestial data exists.
- Modifying exact preview-lock behavior.

## Acceptance

All requested unit, source-guard, and normal-`/` Playwright scenarios pass; the planner background contains no static semantic screenshot; all semantic geometry comes from one runtime snapshot and projection; arbitrary runtime target IDs are selectable without CSS changes.