# Test Findings - player-hud-live-aspect-ratio-scaling-v1

## Result

The Player HUD now has live runtime aspect-ratio evidence beyond 16:9 and 4:3. Ultrawide, 16:10, portrait, and 640x480 captures are generated from the real `PrototypeBootstrap` runtime and pass panel separation, canvas containment, active control-row containment, and active button text overflow checks.

## Implemented

- Added compact bottom-bar labeling for `Kill Momentum` at narrow widths so the 640x480 HUD uses `Kill` instead of clipping the full command text.
- Enabled TextMeshPro auto-sizing for generated HUD text while keeping the existing minimum player-facing font size.
- Added `PrototypeBootstrapRuntimePlayerHudEvidenceCapturesAspectRatioMatrix` to the PlayMode HUD evidence test.
- Added live assertions that active fixed HUD rects remain inside the canvas and active Navigation/Combat control rows remain inside `ContextPanel`.
- Captured eight new screenshots under this change.

## Visual Review

Reviewed screenshots:

- `20-live-cruise-ultrawide-2560x1080.png`
- `22-live-cruise-portrait-900x1600.png`
- `23-live-cruise-minimum-640x480.png`
- `24-live-navigation-portrait-900x1600.png`
- `25-live-navigation-ultrawide-2560x1080.png`
- `26-live-combat-minimum-640x480.png`
- `27-live-help-portrait-900x1600.png`

No HUD window overlap was observed in the reviewed captures. The 640x480 Combat state keeps the context panel above the bottom flight bar, and the compact `Kill` button avoids the previous long-label risk. The portrait Help state hides the normal side/context/radar panels and stays clear of the bottom bar.

## Residual Risk

- The world/test-environment `ORIGIN` label is visually large and can dominate the center of portrait and minimum captures. This is not a HUD window overlap, but it should be handled in a later world-label readability pass.
- Builder, full mission reward screens, and input remapping remain deferred by the concept because the corresponding gameplay/menu systems are not implemented yet.
- DevToolbox generic root verification may still fail on `MSB1011` because the workspace contains multiple project/solution files; explicit solution build is the reliable build command for this Unity project.
- DevToolbox `verify_run` did fail only on those generic root commands in execution `a3b87f66eace4c21b494120a1d21fe23`; the scoped Unity MCP checks and explicit solution build passed.
- Task completion preflight was attempted for source line 3 and blocked on the same failed generic verifier state, so task checkboxes remain intentionally unchecked.
