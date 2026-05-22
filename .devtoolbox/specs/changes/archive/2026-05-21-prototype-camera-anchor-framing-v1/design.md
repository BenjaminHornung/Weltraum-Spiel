# prototype-camera-anchor-framing-v1

## Focus Model
`PrototypeCameraAnchor` provides a semantic focus point. When configured to prefer Rigidbody center of mass and a Rigidbody is present, focus is `rb.worldCenterOfMass + transform.TransformVector(focusOffsetLocal)`. Otherwise it is `transform.TransformPoint(focusOffsetLocal)`.

## Follow Camera
`SimpleFollowCamera` separates focus from visual bounds. `GetFocusPoint` chooses the highest-priority anchor under the target, then target Rigidbody center of mass, then visual bounds center, then target position. `RefreshVisualBounds` remains responsible for renderer-based radius and fit distance.

## Zoom and Reframe
Zoom preserves the view ray to the semantic focus point. Reframing can change base distance to fit visual bounds, but it does not force the look target to renderer bounds when anchor/COM exists. FreeInspect may keep its separate inspect focus behavior but diagnostics still report the semantic focus source.

## Bootstrap
`PrototypeBootstrap` ensures the built prototype ship has one `PrototypeCameraAnchor` configured for center-of-mass focus. Main camera setup reuses or creates a single active Main Camera, overwrites stale follow targets, calls `BindTarget`, `ReframeToTargetVisualBounds`, and `SnapNextFrame`.

## Visual Switcher
The visual switcher runtime manager is named `PrototypeShipVisualSwitcher_Manager`, is kept as manager-only state, and must not gain renderers, colliders, or Rigidbody. Imported visuals remain under the `PrototypeShip/ImportedShipVisual` hierarchy, stripped of runtime physics, and reframe the camera without changing the camera anchor.

## Diagnostics
HUD/debug camera sections show camera mode, focus source, focus point, visual bounds center/radius, effective distance, zoom, and target name. Debug buttons continue to expose reset framing, reframe visual bounds, snap camera, and cycle mode.

## Risks
- Existing tests use reflection against private camera fields; adding explicit diagnostics should reduce reflection reliance without breaking older tests.
- Asymmetric imported visuals may enlarge distance substantially; clamp logic must continue to prevent zoom-through while preserving focus.

