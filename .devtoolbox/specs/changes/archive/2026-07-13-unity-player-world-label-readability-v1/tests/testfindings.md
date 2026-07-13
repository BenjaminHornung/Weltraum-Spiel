# Test Findings - player-world-label-readability-v1

## Result

The normal Training test environment no longer creates the large `ORIGIN` and `STATION / HANGAR` world labels that were visually competing with the Player HUD center reticle. FullDebug keeps the labels for diagnostics, and the environment point data remains intact for radar/minimap use.

## Implemented

- Updated `PrototypeTestEnvironment.ShouldCreateEnvironmentLabel(...)` so Training mode only keeps the first Target and first Beacon labels.
- Added EditMode tests proving:
  - Training hides `Label_ORIGIN` and `Label_Station`.
  - Training keeps Origin and Station point data.
  - Training keeps only the first Target/Beacon labels.
  - Minimal remains label-free.
  - FullDebug still creates debug labels.
- Added live PlayMode evidence that asserts no `ORIGIN` or `STATION / HANGAR` world TextMesh exists before capture.
- Updated touched test helpers to Unity's non-obsolete `FindObjectsByType(..., FindObjectsInactive)` overloads.

## Visual Review

Reviewed `screenshots/30-live-cruise-no-origin-label-1280x720.png`. The previous large `ORIGIN` text is gone from the center view. HUD panels remain separated, and the remaining target label is small enough not to read as a HUD panel overlap.

## Residual Risk

- Training still shows the first target and first beacon labels. If these later become visually noisy in real gameplay, they should move behind target-selection or distance-based visibility rather than returning to always-on debug-style text.
- The old screenshots in earlier evidence folders still document the previous state at the time they were captured. New evidence for the corrected state lives under this change.
- DevToolbox generic `verify_run` still fails on root-level `dotnet build`, `dotnet test`, and `dotnet format` because the Unity workspace root contains multiple project/solution files. Scoped Unity MCP checks and the explicit solution build passed; tasks remain unchecked because completion preflight blocks on the generic verification result.
