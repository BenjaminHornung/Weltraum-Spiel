# Mouse Wheel Zoom

## Requirements

### Requirement: Local Zoom State

The camera SHALL implement mouse wheel zoom as local camera state. It SHALL NOT permanently modify `ShipStats.FollowDistance`, `ShipStats.FollowHeight`, or gameplay physics settings.

#### Scenario: Zoom Does Not Mutate Ship Stats

- **GIVEN** a target has configured follow distance and height
- **WHEN** the user scrolls the mouse wheel
- **THEN** the effective camera distance SHALL change
- **AND** the target stats SHALL remain unchanged.

### Requirement: Zoom Works In Every Camera Mode

Mouse wheel zoom SHALL work in `ChaseLocked`, `OrbitInspect`, `Side`, and `FreeInspect`.

#### Scenario: Zoom Changes Effective Distance

- **GIVEN** any camera mode is active
- **WHEN** the user scrolls up or down
- **THEN** the current effective distance SHALL move closer or farther within clamps.

### Requirement: Configurable Smooth Clamps

Zoom SHALL be clamped with inspector-configurable minimum and maximum distances. Defaults SHOULD allow close inspection around 2 m to 4 m and wide framing around 80 m to 160 m. Movement MAY be smoothed but SHALL remain direct enough for manual testing.

### Requirement: Reset Restores Default Framing

Camera reset SHALL restore zoom to the default distance derived from the current target stats or visual bounds.

### Requirement: Diagnostics Expose Zoom

Prototype diagnostics SHALL expose current camera mode, effective distance, zoom component, and current visual-bounds radius where available.

### Optional Requirement: Scroll Modifiers

If conflict-free, Shift + mouse wheel MAY zoom faster and Ctrl + mouse wheel MAY zoom finer. These modifiers are optional and SHALL not block the core zoom behavior.