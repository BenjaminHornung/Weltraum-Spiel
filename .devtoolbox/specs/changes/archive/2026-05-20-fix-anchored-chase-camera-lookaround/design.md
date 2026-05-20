# Design: Anchored Chase Camera Lookaround

## Current Problem

`SimpleFollowCamera` mode 0 currently computes a ship-relative chase offset, but it also applies mouse-look yaw and pitch to that offset. This means looking around moves the camera mount point around the ship.

For flight, mode 0 should behave more like a camera mounted behind the ship: the camera follows the rear anchor, while the player can look around from that anchored point.

## Chosen Model

Keep `SimpleFollowCamera` and avoid Cinemachine. This is still a prototype camera.

Mode 0 behavior:

- Position anchor: `target.position - target.forward * distance + target.up * height`.
- The anchor does not use mouse-look yaw or pitch.
- Base look target remains near the ship, slightly forward along `target.forward`.
- Mouse look changes only an additive look direction/target offset from the anchored camera position.
- Rotation uses `target.up` so the camera frame remains ship-relative.
- Reset returns mode 0, zero look yaw/pitch, and snaps next frame.

Modes 1 and 2 can remain debug perspectives and may still use orbit-style offsets. They are not the main flight camera.

## Debug Perspective Cycle

`V` remains a temporary debug control to cycle camera modes. The default and reset mode is always mode 0 anchored chase.

## Verification Strategy

Use Unity MCP to validate and compile the script. Use deterministic editor probes to verify:

- Mode 0 camera position equals the ship-local anchor regardless of mouse-look offsets.
- The look target or rotation changes when look offsets are non-zero.
- Yaw, pitch, and roll of the ship move the anchor with the ship frame.
- Reset restores mode 0 and zero look offsets.

## Risks

- Strong look offsets can move the ship away from exact screen center. For this slice, keep offsets modest and still aimed near the ship.
- A later combat camera may need target lock or dead zones; that should be a separate spec.
