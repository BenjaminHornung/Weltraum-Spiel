# Design: Live Runtime Surface and Exact Preview Locking

## Presentation boundary

`main.ts` assigns `data-ui-surface="flight|combat"`; scenario metadata no longer owns the default HUD. Flight concept styling is promoted to the flight surface. Static flight background replacement and fixed pseudo-values are removed. `debugHud=1` alone exposes diagnostics and world-space helpers.

## Command and telemetry boundary

Add `SetRouteProfile`, `PreviewRoute`, `ReplanRoute`, and `EngageRoutePreview { expectedPlanHash }`. Dispatch returns a typed result with success, telemetry, outcome/rejection code, player message, and preview/locked hashes. First-party callers migrate to the strict preview-hash workflow.

`RoutePlan` gains `speedProfile`. A preview stores source position, velocity, mass, fuel, source tick, and stable fingerprints for authority, target, and canonical environment. Telemetry exposes selected profile/planner, obstacles, provenance, and lock admission.

## Lock validation

A pure `validatePreviewForLock` is shared by telemetry and Engage. It ignores tick age. It validates stable fingerprints, velocity/mass/fuel, finite and continuous segments, the configured first-segment tolerance, current planning/route validation, and current flight/braking/authority state. It never invokes a planner.

Cancel retains the exact preview plan/hash and explicitly marks it stale. Preview and Replan are the only explicit commands that may refresh it.

## UI structure

Keep existing runtime IDs while replacing fake duplicated content. Use one responsive player composition and a native modal dialog. The dialog is a sibling of the inert game surface, traps/restores focus, and reports typed command failures inline.

The runtime map is a pure SVG projection. X maps horizontally and Z maps vertically; ship-up uses the ship's local +X forward vector projected into X/Z and falls back to north-up near zero magnitude. View state is retained outside telemetry rendering.

## Reuse

Reuse the existing concept assets, fonts, clipped-corner composition, telemetry view-model pipeline, planner validation, flight snapshot, executor, stable hash utilities, and Playwright infrastructure. Do not add packages or parallel planner/executor implementations.
