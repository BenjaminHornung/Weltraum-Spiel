# Browser UI Concept Parity v1 Audit

Baseline captured from the real Browser/Three.js runtime before the UI parity edits. The baseline used the normal product URL `/`; `window.TestBridge` was absent.

> Repository cleanup note (2026-07-13): `Assets/**` below is the original
> capture-time path. The immutable Unity snapshot is available at
> `unity-legacy-final-2026-07:Assets/**`; retained reusable art is under `art/`.

## Concept References

| Concept target | Path |
| --- | --- |
| Flight HUD | `docs/UI-Screenshots/02-flug-hud-asteroidenguertel-cruise.png` |
| Navigation planner | `docs/UI-Screenshots/03-navigationsplaner-sternenkarte-route.png` |
| Combat/contact HUD | `docs/UI-Screenshots/07-kampf-hud-asteroidenfeld-feindkontakt.png` |

## Baseline Screenshots

| Baseline | Path |
| --- | --- |
| Flight HUD 1640x900 | `apps/weltraum-browser/evidence/ui-concept-parity-baseline-flight-1640x900.png` |
| Flight HUD 1440x900 | `apps/weltraum-browser/evidence/ui-concept-parity-baseline-flight-1440x900.png` |
| Flight HUD 1280x720 | `apps/weltraum-browser/evidence/ui-concept-parity-baseline-flight-1280x720.png` |
| Target selected | `apps/weltraum-browser/evidence/ui-concept-parity-baseline-target-selected-1440x900.png` |
| Objective enroute | `apps/weltraum-browser/evidence/ui-concept-parity-baseline-objective-enroute-1280x720.png` |
| Availability JSON | `apps/weltraum-browser/evidence/ui-concept-parity-baseline-availability.json` |

## Baseline Gaps

| Area | Gap | Acceptance Target | Planned Change |
| --- | --- | --- | --- |
| Flight HUD layout | HUD reads as rectangular debug panels, with radar represented as text in the right panel. | Left system stack, bottom-left circular radar, right target/autopilot stack, compact bottom action/message strip, clear center. | Split radar into its own HUD region, add angular cyan panel language, keep existing selectors. |
| Flight hierarchy | Speed/throttle/fuel/RCS are present but visually similar to low-priority debug text. | Larger speed/system readouts, visible gauges, stronger contrast. | Restyle metric cards, meters, and state badges with concept tokens. |
| Navigation planner | Baseline JSON reports no `#navigation-planner`. | Normal-runtime planner overlay with dominant map, route line, waypoints, details, profile controls, and Engage action. | Add player-facing overlay using current target and route preview state. |
| Combat/contact | Baseline JSON reports no `#combat-contact-hud`. | Scoped combat/contact presentation matching concept structure without claiming real combat truth. | Add `?uiScenario=combat-contact` UI-only shell with contact panel, reticle, and target card. |
| Evidence | Existing evidence proves gameplay flows but not concept parity structure. | Playwright screenshots plus DOM/layout JSON report. | Add `ui-concept-parity.spec.ts` with bounding-box and screenshot checks. |

## Out Of Scope

- Full combat, weapons, damage, mining, economy, mission, or cargo systems.
- Replacing runtime route truth with renderer-only UI state.
- TestBridge use for concept parity.
- Any `Assets/**`, package, lockfile, or Unity scene changes.
- Flight/autopilot invariant changes such as distance faking, snapping, zeroing velocity, acceleration retuning, or weakening terminal capture/planHash/no-silent-replan behavior.
