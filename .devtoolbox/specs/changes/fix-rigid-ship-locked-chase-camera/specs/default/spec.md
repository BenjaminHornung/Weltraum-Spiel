# Spec: Rigid Ship-Locked Chase Camera

## Requirements

### Requirement: Default chase camera is rigidly ship-locked

The prototype SHALL use a rigid ship-locked chase camera as its default camera mode.

#### Scenario: Exact chase anchor is applied every camera update

- **Given** a player ship target with a position, rotation, follow distance, and follow height
- **When** the default camera mode updates in `LateUpdate`
- **Then** the camera position SHALL be set to `target.position + target.rotation * new Vector3(0, followHeight, -followDistance)`
- **And** the position SHALL be applied directly without `Lerp`, damping, or positional smoothing.

#### Scenario: Ship acceleration does not create camera lag

- **Given** the target ship moves a large distance between frames
- **When** the default camera mode updates once
- **Then** the camera SHALL immediately match the new ship-local chase anchor
- **And** the anchor error SHALL remain near zero.

### Requirement: Default chase camera rotation follows ship orientation

The default chase camera SHALL be locked to the ship orientation, including roll.

#### Scenario: Ship attitude change does not orbit the camera

- **Given** the ship changes pitch, yaw, or roll through flight controls
- **When** the default camera mode updates
- **Then** the camera rotation SHALL use the ship rotation as its base orientation
- **And** the camera SHALL remain at the same ship-local rear/up anchor.

#### Scenario: Rotation is set directly in default mode

- **Given** the default camera mode is active
- **When** the camera computes its target rotation
- **Then** the rotation SHALL be applied directly with the position as one exact pose update
- **And** the default mode SHALL NOT use `Slerp` or rotational smoothing.

### Requirement: Mouse look is momentary and anchor-safe

The default chase camera SHALL allow limited lookaround without changing the chase anchor.

#### Scenario: Right mouse look changes local view direction only

- **Given** the default camera mode is active
- **When** the player holds right mouse button and moves the mouse
- **Then** the camera SHALL apply a limited local yaw/pitch offset
- **And** the camera position SHALL remain exactly on the ship-local chase anchor.

#### Scenario: Right mouse release recenters the view

- **Given** the default camera mode has a non-zero local look yaw or pitch
- **When** right mouse button is released
- **Then** the local look offsets SHALL move back toward zero
- **And** the ship SHALL return to the center of the chase view.

### Requirement: Debug modes and reset remain available

The camera SHALL keep debug viewing affordances for prototype inspection.

#### Scenario: Camera mode cycling remains available

- **Given** the player presses `V`
- **When** the camera handles input
- **Then** it SHALL cycle to the next debug camera mode
- **And** debug modes MAY keep their existing orbit or side-view behavior.

#### Scenario: Camera reset restores rigid chase mode

- **Given** any camera mode or local look offset is active
- **When** the player presses Backquote/# reset
- **Then** the camera SHALL return to the default rigid chase mode
- **And** local look offsets SHALL reset to zero
- **And** the next update SHALL place the camera on the exact chase pose.

### Requirement: Camera diagnostics are visible

The prototype debug overlay SHALL include camera diagnostics.

#### Scenario: Debug overlay shows chase camera state

- **Given** the prototype debug overlay is visible
- **When** the camera is bound to a target
- **Then** the overlay SHALL show camera mode, anchor error, look yaw, and look pitch.

### Requirement: No new camera package is introduced

This slice SHALL fix the existing custom camera without adding Cinemachine.

#### Scenario: Package scope remains unchanged

- **Given** the implementation is complete
- **When** project packages are inspected
- **Then** no new Cinemachine package SHALL be required for the prototype to run.