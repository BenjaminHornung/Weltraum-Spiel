# Design: Physical RCS and Gimballed Thruster Controls

## Context

This revision turns the control prototype from a mostly input-mapping slice into a more physically inspectable thruster model. The user feedback is that A/D yaw with the main engine disabled does not yet feel like a real axis rotation around the ship center. The generated ship also needs clearer scale and visual debug cues so RCS force selection and main-thruster gimbal behavior can be understood while playing.

This is still a prototype, not a final vessel simulation. The important decision is that force and torque must come from installed transforms: if a thruster or nozzle is moved, removed, or rotated, the calculation changes naturally.

## Central Physics Documentation

Add a central repo document, `docs/physics-flight-model.md`, for the formulas and decisions that affect ship motion.

It should explain:

- Main thrust force through center of mass for straight thrust.
- Gimballed main-thruster direction and torque contribution.
- RCS nozzle force selection for translation and attitude torque.
- Torque calculation: `torque = Vector3.Cross(nozzlePosition - rigidbody.worldCenterOfMass, force)`.
- SAS angular damping/counter-thrust approximation.
- Why the prototype uses installed transforms instead of hardcoded coordinates.
- Known limitations versus a full KSP-grade solver.

README should link to this document.

## Ship Visual Model

The generated prototype ship should be larger and easier to read in motion.

- Use an elongated main hull/cockpit/fuel shape rather than a compact small cluster.
- Keep primitive placeholder meshes only.
- Keep Inspector-tunable sizes where practical.
- Preserve generated bootstrap behavior from an empty scene.

RCS modules should be visually distinct small cubes attached to the ship. For the generated ship, place four RCS blocks at the center of the free side surfaces around the hull, such as left, right, top, and bottom. The exact implementation may use configurable transforms so this remains adaptable.

## Directional RCS Model

Each RCS block is a 5-way module. One face is attached to the ship and cannot fire; the other five directions can have nozzles.

Represent each usable outlet as data, not hardcoded control branches:

- Nozzle transform or world position.
- Force direction transform or vector.
- Max thrust.
- Optional ParticleSystem/VFX reference.
- Owning RCS block.

The solver must not depend on fixed generated coordinates. It may create generated defaults, but runtime force/torque decisions use actual nozzle positions and directions.

## RCS Translation Solver

For translation input, choose nozzles whose force direction aligns with the requested translation direction.

A simple prototype algorithm is acceptable:

1. Convert requested local translation to a world-space desired force direction.
2. For each installed nozzle, compute `alignment = dot(nozzleForceDirection, desiredDirection)`.
3. Use nozzles with positive alignment above a threshold.
4. Apply `force = nozzleForceDirection * maxThrust * inputMagnitude * alignment` at the nozzle position.
5. Prefer balanced/no-op torque pairs where practical, but do not hardcode a perfect solver.
6. If no installed nozzle can produce the requested force direction, apply no force.

This prevents phantom force when a matching RCS outlet is missing.

## RCS Attitude Solver

For attitude input and SAS, choose nozzles by the torque they can produce around the Rigidbody center of mass.

Prototype algorithm:

1. Convert pitch/yaw/roll input into a desired local torque axis, then to world space.
2. For each installed nozzle, compute `force = nozzleDirection * maxThrust`.
3. Compute `candidateTorque = Cross(nozzlePosition - worldCenterOfMass, force)`.
4. Use nozzles whose candidate torque aligns with the desired torque axis.
5. Scale applied force by input magnitude and alignment.
6. Emit VFX only for nozzles actually used.

At 0% main throttle, A/D yaw should therefore be visibly produced by RCS nozzles whose force vectors create yaw torque around the center of mass.

## Main Thruster and Gimbal Model

The main thruster should be a visible cube-like module at the rear of the ship. It has a 20 degree gimbal range in this prototype.

- The visual thruster/gimbal transform rotates with current pitch/yaw gimbal command.
- The physics direction follows the same gimbal command.
- Straight no-gimbal thrust still acts through the center of mass to avoid the previous circular-flight bug.
- The steering/gimbal contribution may create torque intentionally at the main-thruster nozzle or through an equivalent torque model.
- Gimbal strength scales with throttle and fuel availability.
- Gimbal values should be exposed in the overlay.

## Mouse and Camera

Mouse input must no longer steer the ship.

- Keyboard controls drive ship attitude.
- Mouse delta changes camera look/orbit only.
- The camera can orbit/look around the ship so the player can inspect targets or debug RCS/VFX.
- Backquote is the reset key for camera framing. Plain `3` should not be treated as `#`.
- Complex free/orbital/cockpit camera behavior remains out of scope.

## SAS and Vacuum Inertia

SAS is a stabilization assist, not an autopilot.

- With SAS enabled, after player attitude input stops, the ship should counter angular velocity and settle toward a stable attitude.
- The counter behavior should use the same RCS/nozzle torque model where practical so debug VFX can show anti-thrust effects.
- With SAS disabled, the ship should keep rotating in vacuum after pitch/yaw/roll input stops; the controller must not silently damp angular velocity away.
- Linear velocity should not decay just because controls are released.
- `F` held temporarily inverts the effective SAS state.

## Debug and Overlay

The overlay should show enough information to debug physical control:

- Main throttle percentage.
- Main gimbal command and limit.
- RCS enabled/installed state.
- Active RCS nozzle count or names.
- Center of mass in world/local space.
- Requested attitude/translation input.
- Angular velocity.
- Forward acceleration.
- SAS effective state.
- Precision mode.

## VFX

Use URP-compatible placeholder effects only.

- Main thruster VFX remains visually distinct from RCS VFX.
- RCS nozzle particles use a different color from the main engine, such as cyan/blue-white.
- Only nozzles that are actively firing should emit particles or show glow.
- VFX must remain optional debug polish; physics must not depend on particle components existing.

## Reuse Strategy

Reuse current prototype components and evolve them:

- `PrototypeBootstrap` creates the larger generated ship, RCS blocks/nozzles, main thruster visual, and VFX references.
- `RcsThrusterController` owns installed nozzle data and force/torque selection.
- `MainThrusterModule` owns straight thrust, gimbal direction, and main-thruster visual rotation.
- `PlayerShipController` owns keyboard controls, removes mouse steering, and forwards commands.
- `SimpleFollowCamera` owns mouse camera look/orbit.
- `PrototypeDebugOverlay` displays physics and control telemetry.

## Risks

- A full control allocation solver is beyond this slice; the prototype solver may feel imperfect but must be transform-driven and debuggable.
- RCS force pairs may create small translation while rotating; acceptable if documented and visible.
- SAS using RCS counter-thrust may feel pulsed or weak; expose tunable damping/thrust values.
- Larger ship scale may require camera distance and marker adjustments.
- German keyboard `#` handling is layout-sensitive; this revision uses Backquote reset only unless a real Input System key is available.
