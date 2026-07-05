# Browser Live Large Field Flight Acceptance v1

## Why

The normal browser runtime already exposes large-field player targets and route previews. Existing evidence proves target visibility, selection, and preview state, but not the live player-facing flight loop in the rendered browser without TestBridge.

## What Changes

- Add a Playwright E2E acceptance test for the normal `/` runtime.
- Drive target selection and autopilot engagement through visible player HUD controls only.
- Record live distance reduction, player-facing autopilot state, no TestBridge/debug leakage, and screenshots.
- Keep planner, executor, package files, and Unity assets unchanged unless a real blocker is found.

## Non-Goals

- No Unity work.
- No planner rewrite or autopilot tuning.
- No TestBridge route, direct simulation stepping, ship snapping, velocity zeroing, or weakened terminal gates.
