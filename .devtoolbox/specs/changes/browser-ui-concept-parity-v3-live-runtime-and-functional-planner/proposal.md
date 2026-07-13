# Proposal: Browser UI Concept Parity V3

## Problem

The V2 flight concept is visually strong but is only activated through a presentation-only query. That path replaces the live canvas with a static reference image, hides real scene layers, and substitutes several runtime values with fixed CSS content. Normal `/` still exposes the legacy debug-heavy HUD. The navigation planner also presents non-functional controls and recomputes during Engage instead of locking the visible preview.

## Outcome

Normal `/` is the authoritative concept-quality flight surface while Three.js/WebGL remains visible, live, and playable. Every player-visible flight and planner value is runtime-owned. The navigation planner provides a complete keyboard-accessible target/profile/preview/replan/engage workflow and locks exactly the visible preview hash with no planner call during Engage.

## Scope

- Browser runtime commands, telemetry, route-plan metadata, preview provenance, and lock admission.
- Normal flight, query-scoped combat, explicit diagnostics, player HUD, planner dialog, radar, and runtime SVG map.
- Focused unit/E2E coverage, required regressions, corrected V2 evidence, and fresh Product Design comparisons.

## Non-Goals

- No economy, credits, reputation, cargo, surface, or combat-system expansion.
- No changes under `unity-legacy-final-2026-07:Assets/**`, `package.json`, or lockfiles.
- No commit, push, archive, or unrelated cleanup without Benjamin's explicit authorization.
- No visual redesign beyond matching the supplied concepts; the live 3D player ship remains the only intentional visual exception.
