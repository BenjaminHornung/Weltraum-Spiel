# Camera Free Inspection Mode

## Requirements

### Requirement: Four Prototype Camera Modes

`SimpleFollowCamera` SHALL expose four camera modes in this order: `ChaseLocked`, `OrbitInspect`, `Side`, `FreeInspect`.

#### Scenario: V Cycles All Modes

- **GIVEN** the active mode is `ChaseLocked`
- **WHEN** the user presses `V` repeatedly
- **THEN** the mode sequence SHALL be `OrbitInspect`, `Side`, `FreeInspect`, and then `ChaseLocked` again.

### Requirement: ChaseLocked Preserves Existing Follow Behavior

`ChaseLocked` SHALL remain the default mode and SHALL keep the existing stable behind-ship framing and limited right-mouse look offset.

#### Scenario: Default Camera Is ChaseLocked

- **GIVEN** the prototype scene creates or binds the follow camera
- **WHEN** no camera input has been applied
- **THEN** the camera mode SHALL be `ChaseLocked`.

### Requirement: OrbitInspect Allows Ship-Centered Inspection

`OrbitInspect` SHALL keep the camera focused on the ship or current visual bounds center. Right mouse drag SHALL rotate freely around that focus and SHALL not auto-recenter like chase look offset.

#### Scenario: Orbit Drag Persists

- **GIVEN** the camera is in `OrbitInspect`
- **WHEN** the user right-drags around the ship
- **THEN** the camera SHALL preserve the inspection yaw/pitch until changed, reset, or mode-specific refocus occurs.

### Requirement: Side View Remains Available

`Side` SHALL remain available as a side-framing camera mode and SHALL participate in zoom and reset behavior.

### Requirement: FreeInspect Moves Independently Without Stealing Normal Controls

`FreeInspect` SHALL let the camera inspect the ship from arbitrary positions. Right mouse drag SHALL rotate the camera view. Camera translation with WASD and vertical keys SHALL only be active while right mouse is held, or another explicit active-controls state is shown.

#### Scenario: FreeInspect Movement Guard

- **GIVEN** the camera is in `FreeInspect`
- **WHEN** right mouse is not held
- **THEN** WASD SHALL not be consumed as camera movement.

#### Scenario: FreeInspect Active Movement

- **GIVEN** the camera is in `FreeInspect`
- **WHEN** right mouse is held and the user presses WASD or Q/E
- **THEN** the camera SHALL move relative to its current orientation without changing the ship Rigidbody or gameplay control state.

### Requirement: Reset And Refocus

Reset camera SHALL return to `ChaseLocked`, reset look/orbit/free offsets to a useful default, and use the current visual-bounds-aware framing distance.

#### Scenario: Reset From FreeInspect

- **GIVEN** the camera is in `FreeInspect` away from the ship
- **WHEN** the user triggers camera reset/refocus
- **THEN** the camera SHALL return to useful chase/default framing around the ship.