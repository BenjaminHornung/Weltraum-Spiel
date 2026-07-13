# Change: Player Autopilot Arrival Stability v2

## Why

The waypoint autopilot can enter a visually unstable arrival loop: it flips too aggressively toward retrograde, overshoots the brake attitude, alternates between acceleration and deceleration, and can circle near the target instead of declaring a settled arrival.

## What

- Stabilize brake/deceleration phase selection so brake remains latched until velocity is genuinely settled or arrival hold captures.
- Add an arrival deadzone/hold capture near the target so the ship damps residual motion instead of re-accelerating around the objective.
- Make the brake flip attitude command less aggressive and gate main-thruster decel by both retrograde angle and angular speed.
- Add focused closed-loop regression coverage for off-axis/high-speed arrival behavior.

## Non-goals

- No teleporting or direct Rigidbody velocity writes for completion.
- No changes to player HUD layout, minimap, mission reward UI, or RCS VFX direction in this slice.
