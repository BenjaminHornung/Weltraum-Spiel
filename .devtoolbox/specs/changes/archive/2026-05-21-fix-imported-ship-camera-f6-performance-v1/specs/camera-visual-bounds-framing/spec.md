# Camera Visual Bounds Framing

## Requirements

### Requirement: Camera bounds are cached outside the steady-state frame loop

`SimpleFollowCamera` MUST NOT rescan the complete target renderer hierarchy every `LateUpdate()` when the target and visual hierarchy have not changed.

#### Scenario: Clean cache during steady state

- Given the camera has already bound to a ship and computed visual bounds
- When multiple `LateUpdate()` calls run without dirtying the visual bounds
- Then the camera uses cached bounds
- And no full renderer hierarchy scan is required for each frame

### Requirement: Bounds can be explicitly invalidated

The camera MUST expose an explicit invalidation method such as `MarkVisualBoundsDirty()` or `InvalidateVisualBounds()` and recompute bounds on target bind, explicit reframe, visual change, and ship rebuild.

#### Scenario: Visual switch invalidates bounds

- Given an imported visual mode is activated
- When the switcher marks camera bounds dirty and requests a reframe
- Then the next bounds-dependent camera update uses the current visual hierarchy exactly once for the refresh

### Requirement: ChaseLocked focus remains anchored to flight reference

ChaseLocked mode MUST focus on an explicit camera anchor, rigidbody COM, or target position. Visual bounds center MAY influence distance and zoom safety but MUST NOT silently become the normal flight pivot.

#### Scenario: Imported bounds center is offset

- Given imported visual bounds are offset from the rigidbody COM
- When the camera is in ChaseLocked mode
- Then the look focus remains at the camera anchor/COM/target fallback
- And diagnostics expose the offset between visual bounds center and COM

### Requirement: Inspect modes may use visual center

OrbitInspect, FreeInspect, and Side mode MAY use cached visual bounds center for inspection framing, provided the bounds are cached and filtered.

### Requirement: Bounds exclude non-ship renderers

Camera bounds MUST exclude VFX, muzzle flash, weapon clearance/arc markers, debug labels/rings, hidden generated primitive renderers, and other explicit ignore participants.
