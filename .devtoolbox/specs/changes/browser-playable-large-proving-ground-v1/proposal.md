# browser-playable-large-proving-ground-v1

## Problem

The browser autopilot long-range proving ground exists in TestBridge evidence, but the normal playable runtime only exposes short targets and a small visible asteroid field.

## Change

Expose playable 500m, 1000m, and 2500m proving-ground targets through the normal browser target catalog. Add runtime obstacle truth for a long single-obstacle route and a corridor-style field, plus separate render-only landmarks so the large field is visible without making the renderer authoritative.

## Scope

- Browser runtime/world/render files only.
- Browser unit and E2E coverage.
- Evidence screenshots and markdown under `apps/weltraum-browser/evidence`.
