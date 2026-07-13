# Browser UI Concept Parity v2

## Problem

`browser-ui-concept-parity-v1` improved browser HUD structure and evidence, but the rendered result still reads as rectangular web/debug panels over a debug-grid scene. It does not visually resemble the supplied concept screenshots at first glance.

## Goal

Rework the browser runtime presentation so the normal player-facing screenshots move substantially closer to the concept references:

- `docs/UI-Screenshots/02-flug-hud-asteroidenguertel-cruise.png`
- `docs/UI-Screenshots/03-navigationsplaner-sternenkarte-route.png`
- `docs/UI-Screenshots/07-kampf-hud-asteroidenfeld-feindkontakt.png`

The primary acceptance target is the flight HUD. Navigation planner and combat/contact shell are secondary but must also visibly improve.

## Scope

- Add or improve browser presentation visuals for real Playwright screenshots without using TestBridge.
- Rework HUD visual hierarchy, German concept labels, gauges, radar, target/autopilot cards, and warning treatment.
- Rework navigation planner and combat/contact shell toward the concept compositions.
- Add V2 Playwright evidence, layout report, and concept/v1/v2 visual audit.

## Non-Goals

- No Unity `unity-legacy-final-2026-07:Assets/**` edits.
- No Unity Editor launch.
- No package or lockfile changes unless strictly justified.
- No fake flight progress, snapped ship position, zeroed velocity, or planner/executor/FlightController invariant changes.
- No claim that combat gameplay exists when only a scoped presentation shell exists.
