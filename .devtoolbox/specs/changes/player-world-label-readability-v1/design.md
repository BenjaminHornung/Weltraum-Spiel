# Design - player-world-label-readability-v1

## Decision

Change the normal `PrototypeEnvironmentDisplayMode.Training` label policy instead of masking labels in the Player HUD. The large labels are world objects created by `PrototypeTestEnvironment`, so the clean fix is to keep the world geometry and points while limiting nonessential text at the source.

## Label Policy

- `FullDebug`: unchanged; all labels remain available.
- `Training`: hide origin and station labels, keep only the first target and first beacon labels as short training aids.
- `Minimal`: unchanged; no labels.

This keeps the player view readable while preserving development visibility in FullDebug.

## Verification

EditMode tests assert that Training no longer creates `Label_ORIGIN` or `Label_Station`, FullDebug still creates those labels, and the origin/station points remain in the environment snapshot. Live PlayMode evidence reuses the real `PrototypeBootstrap` runtime and captures a new cruise/objective screenshot.
