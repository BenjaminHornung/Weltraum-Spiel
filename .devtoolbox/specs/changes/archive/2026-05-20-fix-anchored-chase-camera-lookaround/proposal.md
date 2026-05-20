# fix-anchored-chase-camera-lookaround

## Why

The current camera is closer to the desired chase feel, but mouse look can still move the camera mount around the ship. During RCS-heavy maneuvers this breaks the mental model: the camera should stay attached behind the ship and keep the ship centered, while still allowing the player to look around.

## What

Refine the prototype camera so mode 0 is an anchored chase camera. The camera position remains fixed behind and above the ship in the ship-local frame. Mouse look only changes the viewing direction/look offset, not the camera anchor position.

A temporary camera perspective switch can remain available for debugging, but the default flying mode must be the anchored chase view.

## Included

- Mode 0 anchored behind the ship using ship-local forward/up.
- Mouse look changes camera rotation/look target only.
- Ship remains centered in the default chase view.
- Reset restores anchored chase mode and clears look offsets.
- Camera perspective cycle remains as a debug-only aid.
- Unity MCP verification and spec test evidence.

## Out of Scope

- Cinemachine migration.
- Camera collision.
- Cockpit camera polish.
- Combat target lock camera.
- Orbital map camera.
- Full camera settings UI.

## Success Criteria

- During yaw, pitch, roll, and RCS translation, the mode 0 camera stays behind and above the ship.
- Mouse look does not move the camera around the ship; it only changes where the camera looks.
- The ship remains centered or nearly centered in mode 0.
- Reset returns to anchored chase mode.
- Debug perspective cycling remains available.
- Unity scripts compile with no script errors.
