# Design: KSP-like Thruster and RCS Controls

## Context

The previous revision separated main thrusters and RCS, but still mapped `S` to a backward/turnaround assist. The corrected model is more Kerbal Space Program-like: the player controls main engine throttle, and turning authority comes from installed RCS thrusters plus gimballed main engines when they are producing thrust.

This remains a prototype approximation, not a final physics architecture.

## Control Model

Primary keyboard controls for this slice:

- `W`: increase main-thruster throttle toward 100%.
- `S`: decrease main-thruster throttle toward 0%.
- `A`/`D`: request left/right yaw/turn authority.
- Mouse X/Y: keep pitch/yaw as a playable attitude input if it does not conflict with the A/D test path.
- `Q`/`E`: roll.
- Existing fire/refuel/reset controls remain available.

Main throttle should be a persistent state, not a momentary button. The debug overlay should display it as a percentage.

## Main Thruster Model

Main thrusters belong to the main-thruster category. Each main thruster has:

- Max thrust.
- Current throttle contribution from the shared 0-100% main throttle.
- `supportsGimbal`.
- `gimbalLimitDegrees`.
- Current gimbal yaw/pitch request.
- A physical position used for force/torque calculation.

The prototype should apply main-thruster force at the thruster position, not just at the Rigidbody center. A gimballed thrust direction therefore naturally produces turning torque when the force line does not pass through the current control pivot/center of mass.

## RCS Model

RCS thrusters are optional installed controls. In this prototype they are still placeholder primitives, but their positions matter.

At ship creation/bootstrap time, compute a prototype RCS control pivot from installed RCS thruster positions. For the generated ship this can be the average local position of the active RCS thrusters, or a small helper object/value stored by the RCS controller. This is not the final mass-tree solver; it is a deterministic prototype pivot for control/debugging.

When main throttle is 0 and RCS thrusters exist, A/D turning should be driven by RCS forces around that computed pivot. Prefer force-at-position behavior over abstract direct yaw changes.

## Combined Main Gimbal and RCS Turning

When main throttle is above 0:

- A/D still requests turning.
- RCS can contribute if installed.
- Gimballed main thrusters should deflect within their gimbal limits.
- The higher the main-throttle percentage, the more torque can come from the gimballed main-thruster force.
- The debug overlay should expose enough data to see throttle, gimbal command, approximate pivot/control center, and turning input.

This gives the intended feel: at 0% throttle, only RCS can rotate the ship; at higher throttle, main-engine vectoring becomes stronger.

## Physics Strategy

Use Unity Rigidbody physics in `FixedUpdate`.

- Use sustained force modes for continuous thrust.
- Use force-at-position for thrusters where possible so placement matters.
- Keep gravity disabled.
- Keep the ship bootstrap-generated and quickly testable.

If Unity's exact rigidbody center-of-mass behavior makes a literal custom pivot risky for the prototype, prefer storing and displaying the computed control pivot while applying force at the real thruster positions. The acceptance target is behavior and debuggability, not a perfect solver.

## GUI and Debug

The overlay should include:

- Main throttle percentage.
- Current main thrust force.
- Gimbal enabled/limit/current command.
- A/D turn input.
- RCS installed/available state.
- Computed RCS pivot/control center.
- Current RCS force contribution.
- Current main-gimbal force/torque contribution if available.

A simple `OnGUI` readout is enough for this slice.

## Reuse Strategy

Reuse the current prototype components where they fit:

- Keep `ShipStats` for fuel and mass.
- Keep `MainThrusterModule` and `RcsThrusterController` but revise their responsibilities.
- Keep `PlayerShipController` as the input coordinator.
- Keep `PrototypeBootstrap` as the generated-scene source.
- Keep `PrototypeDebugOverlay` as the GUI/debug surface.
- Preserve gun/projectile/camera behavior.

## Risks

- Realistic force-at-position controls may feel weak or unstable with placeholder masses; expose tunable values.
- RCS pivot computation is a prototype approximation and should be documented as such.
- Gimbal turning can be hard to notice at low throttle; debug values are important.
- This is a large movement-system change and should be verified with Unity MCP play-mode probes before tasks are closed.
