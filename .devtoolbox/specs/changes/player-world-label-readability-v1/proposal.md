# Proposal - player-world-label-readability-v1

## Problem

The Player HUD panels now scale and separate correctly, but live screenshots still show large test-environment world labels, especially `ORIGIN`, crossing the center reticle and ship view. This is not a HUD panel overlap, but it competes with the player-facing reticle, target markers, and "few texts during flight" goal in `docs/player-facing-ui-concept-v0.md`.

## User Outcome

The Basic runtime view keeps the useful test-environment geometry, radar points, and gameplay targets, while nonessential debug-style world labels are hidden or reduced in the normal Training display mode. FullDebug can still show all labels for developer diagnostics.

## Scope

- Adjust `PrototypeTestEnvironment` label policy for normal Training mode.
- Keep all `PrototypeEnvironmentPoint` data so radar/minimap and tests still receive origin, station, target, beacon, gate, obstacle, and range data.
- Preserve FullDebug labels for developer diagnostics.
- Add focused tests for label policy.
- Capture live HUD screenshot evidence showing the center view no longer contains the oversized `ORIGIN` world label.

## Non-Goals

- No change to HUD panel layout.
- No change to radar blip data or navigation target discovery.
- No full visual redesign of environment landmarks.
- No fake mission/reward or builder UI.
