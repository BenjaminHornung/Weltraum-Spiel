# Capability: Anchored Chase Camera Lookaround

## Requirement: Anchored chase position

Mode 0 SHALL keep the camera position anchored behind and above the player ship in the ship-local frame.

### Scenarios

- When the ship yaws, the chase camera anchor rotates with the ship heading.
- When the ship pitches, the chase camera anchor remains behind and above relative to the ship.
- When the ship rolls, the chase camera anchor remains attached to the ship-local frame.
- When mouse look is active, the mode 0 camera position remains at the same chase anchor.

## Requirement: Lookaround changes view, not anchor

Mouse look SHALL affect the camera look direction or look target without moving the mode 0 camera position around the ship.

### Scenarios

- Right mouse drag changes what the camera looks toward.
- Right mouse drag does not change the ship controls.
- Right mouse drag does not orbit the mode 0 camera around the ship.
- The ship remains centered or nearly centered in the default chase view.

## Requirement: Reset restores default chase

The camera reset key SHALL restore mode 0, clear look offsets, and snap back to the default anchored chase view.

## Requirement: Debug camera modes remain available

The temporary camera perspective cycle SHALL remain available for debugging, while mode 0 remains the default flight camera.
