# Visual Bounds Framing

## Requirements

### Requirement: Camera Can Reframe To Current Target Visual Bounds

`SimpleFollowCamera` SHALL expose a public method such as `ReframeToTargetVisualBounds()` or `NotifyTargetVisualChanged()` that recomputes camera framing from visible renderers under the current target hierarchy.

### Requirement: Bounds Use Active Visible Renderers

Visual bounds SHALL include active enabled renderers under the ship target, including `ImportedShipVisual` children. Disabled renderers and hidden generated primitives SHALL not inflate the bounds.

#### Scenario: Hidden Generated Renderers Are Ignored

- **GIVEN** generated primitive renderers are disabled while an imported visual is active
- **WHEN** visual bounds are calculated
- **THEN** the generated primitive bounds SHALL not contribute to the camera radius or base distance.

### Requirement: Bounds Derive A Clamped Base Distance

The camera SHALL derive a visual radius from bounds and convert it to a base distance using an inspector-configurable multiplier and min/max clamps.

#### Scenario: Larger Visual Increases Base Distance

- **GIVEN** the current visual bounds radius grows
- **WHEN** the camera reframes
- **THEN** the base framing distance SHALL increase within configured clamps.

#### Scenario: Smaller Visual Decreases Base Distance

- **GIVEN** the current visual bounds radius shrinks
- **WHEN** the camera reframes
- **THEN** the base framing distance SHALL decrease within configured clamps.

### Requirement: F6 Visual Switch Notifies Camera

After `PrototypeShipVisualSwitcher` applies a new visual mode, it SHALL notify the active `SimpleFollowCamera` so visual framing is updated without changing Rigidbody, colliders, or gameplay rig state.

### Requirement: Reframe Does Not Hard-Teleport Unless Reset Or Snap Is Requested

Routine visual changes SHOULD keep camera motion usable and avoid abrupt teleporting except when reset, snap, or explicit reframe behavior requires an immediate reposition.

### Requirement: Generated And Imported Visuals Are Usably Framed

Generated primitives, imported demo scout, and imported demo cargo SHALL all be visible at a useful size after F6 switching and/or camera reset.