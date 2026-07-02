# Browser Autopilot Proving Ground v2 Proposal

## Motivation

Terminal capture v1 proved that the browser autopilot can enter and hold terminal arrival envelopes without snapping, velocity-zero shortcuts, or silent replans. The next risk is broader confidence: one or two routes do not show how the planner/executor behaves across different course shapes, speed preferences, obstacle pressure, and evidence-friendly classifications.

This change expands the browser-only autopilot proving ground so future implementation and review can compare deterministic scenarios instead of relying on ad hoc route checks.

## User Outcome

- Players and developers can exercise a named course catalog in the browser proving ground.
- Debug/evidence output can explain whether a run is nominal, degraded by known planner limits, or a hard failure.
- Autopilot speed profiles can change cruise behavior without weakening terminal capture safety.
- Existing terminal capture v1 guarantees remain visible and testable.

## Scope

- Additive browser proving-ground course catalog and profile model for `Safe`, `Balanced`, and `Fast` autopilot behavior.
- Scenario metrics and classifications suitable for Playwright/E2E evidence and markdown reporting.
- Deterministic plan identity (`planHash`) across equivalent inputs.
- Documentation/evidence updates for planned and executed browser-only validation.

## Non-Goals

- No Unity work.
- No `Assets/**` changes.
- No render smoothing, jitter, VFX, or nozzle work.
- No Cargo, Surface, Economy, or unrelated simulation features.
- No replacement of the current planner architecture.

## Hard Constraints

- Preserve GLBLoaded/procedural fallback/TestBridge query gating.
- Preserve terminal capture v1 semantics: no snap, no velocity zero shortcut, no silent replan, stable `planHash`, and HUD snapshot/ViewModel consumer behavior.
- `terminalSpeed` and `StopWithinEnvelope` remain hard gates regardless of speed profile.
- UI must continue to consume ViewModel/HUD snapshots rather than planner internals.
