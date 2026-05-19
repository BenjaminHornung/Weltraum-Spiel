# Capability: Stable Chase Camera

## Requirement: Default chase camera follows ship orientation

The prototype camera SHALL keep the default camera position behind and above the player ship using the ship's local orientation.

### Scenarios

- When the ship yaws with RCS, the default camera remains behind the ship relative to the new heading.
- When the ship pitches with RCS, the default camera remains behind and above the ship relative to the new attitude.
- When the ship rolls with RCS, the default camera remains in a ship-relative frame instead of drifting to a world-space orbit.

## Requirement: Camera does not steer the ship

Mouse camera input SHALL change only camera view offsets and SHALL NOT change player ship attitude or thrust.

### Scenarios

- Right mouse drag can look around the target.
- Releasing the mouse keeps the chosen view offset until reset or mode change.
- Ship rotation input remains keyboard/RCS driven.

## Requirement: Reset restores chase view

The camera reset key SHALL restore the default chase view behind the ship.

### Scenarios

- After mouse look, reset clears the orbit offsets and snaps back to chase.
- After camera mode changes, reset returns to mode 0 chase.

## Requirement: Existing prototype bootstrap remains compatible

The bootstrap-generated scene SHALL continue to create and bind a working camera to the player ship.

### Scenarios

- A generated prototype ship has a following camera after bootstrap.
- Existing distance and height settings continue to influence camera placement.
