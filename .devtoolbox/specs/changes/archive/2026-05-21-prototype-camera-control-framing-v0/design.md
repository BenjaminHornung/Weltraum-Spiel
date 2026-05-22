# Design

## Existing Pattern And Reuse

The change extends the existing prototype camera instead of adding a second camera stack. `SimpleFollowCamera` already owns camera mode switching, target binding, reset/snap behavior, and distance settings from `ShipStats`; reusing it avoids a parallel camera implementation and keeps all behavior prototype-only.

`PrototypeShipVisualSwitcher` already owns F6 visual cycling and knows when the visible render hierarchy changes. It should notify the active camera after applying a visual mode, but the camera should remain independent from visual-mode enum details.

## Camera Modes

`SimpleFollowCamera.CameraMode` should expose four modes:

- `ChaseLocked`: default, follows behind the ship using ship orientation and keeps the existing stable chase feel.
- `OrbitInspect`: target-centered inspection orbit around the ship or calculated visual bounds center. Right mouse drag changes orbit yaw/pitch and does not auto-recenter.
- `Side`: side view remains available and participates in zoom/framing.
- `FreeInspect`: camera position and view rotation are independent from the ship. Right mouse drag rotates view. Camera movement keys only apply while right mouse is held so normal ship controls are not accidentally intercepted.

Reset camera should return to `ChaseLocked`, clear free-look drift, and restore the current visual-bounds-based default distance.

## Zoom Model

Do not write back to `ShipStats.FollowDistance`. Compute an effective camera distance from:

- a base distance from target stats or visual bounds,
- a local zoom multiplier or offset,
- configurable min/max clamps,
- optional fast/fine modifiers for scroll input if conflict-free.

The effective distance should be observable by tests and UI diagnostics.

## Visual Bounds Framing

The camera should compute bounds from active renderers under the target hierarchy. Disabled renderers are ignored so hidden generated primitives do not inflate imported visual framing. Bounds should derive a radius and base distance using configurable multipliers and clamps.

`PrototypeShipVisualSwitcher` should call `SimpleFollowCamera.ReframeToTargetVisualBounds()` or `NotifyTargetVisualChanged()` after a visual mode is applied. This is a lightweight notification, not a dependency from the camera to the visual switcher.

## UI And Documentation

The debug console is the control surface for manual test convenience: previous/next camera mode, reset, reframe, zoom in, and zoom out. HUD diagnostics and keybind overlay should show the active camera mode and discoverable controls. README should describe mode cycling, mouse wheel zoom, FreeInspect controls, reset/refocus, and F6 visual interplay.

## Testing Strategy

EditMode tests should cover mode count/cycle, zoom state/effective distance, bounds reframe behavior for large and small renderers, and reset/refocus defaults. Runtime/manual protocol should cover generated primitives plus both imported demo visuals, each camera mode, zoom, free movement, and reset.

## Risks

- Existing dirty files for another active prototype change touch UI and config areas. Implementation must preserve those edits.
- FreeInspect movement keys can conflict with ship controls. The chosen guard is to move the camera only while right mouse is held.
- Bounds from runtime imported models can vary by active state. Tests should use generated renderer bounds and the runtime path should ignore inactive/disabled renderers.