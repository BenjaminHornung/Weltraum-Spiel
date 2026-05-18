# Specification: Physical RCS and Gimballed Thruster Controls

## Capability

The prototype flight model shall use transform-driven main thrusters and RCS nozzles so visible thruster placement, gimbal motion, and RCS force directions determine the Rigidbody forces and torques. Mouse input shall control camera view only, while keyboard controls drive ship attitude. SAS shall counter angular velocity when enabled and allow inertial rotation when disabled.

## Requirements

### Attitude and Throttle Controls

- `W` shall request pitch down.
- `S` shall request pitch up.
- `A` shall request yaw left.
- `D` shall request yaw right.
- `Q` shall request roll left.
- `E` shall request roll right.
- `W` and `S` shall not adjust main throttle.
- `Left Shift` shall increase the main-thruster throttle value over time.
- `Left Control` shall decrease the main-thruster throttle value over time.
- `X` shall cut main throttle to 0%.
- `Y` shall set main throttle to 100%.
- `Space` shall fire the current selected main gun.

### Mouse and Camera

- Mouse input shall not steer, rotate, yaw, pitch, or roll the ship.
- Mouse input shall be used for camera look/orbit around the ship.
- The camera shall remain able to follow the ship.
- `V` may cycle prepared camera mode state.
- Backquote shall reset camera framing.
- Plain `3` shall not be treated as `#` for camera reset.
- `M` shall remain reserved/documented for a future orbital map and shall not implement orbital map behavior.

### Generated Ship Scale and Visuals

- The generated ship shall be visibly larger than the first compact prototype.
- The generated ship shall use an elongated placeholder body so yaw/pitch/roll are visually readable.
- The generated ship shall still be built from primitive placeholder meshes.
- The bootstrap shall remain able to create the playable prototype from an empty or near-empty scene.
- Camera distance/framing shall be adjusted enough that the larger ship remains visible.

### Main Thruster and Gimbal

- The generated ship shall include a visible cube-like main thruster module.
- The main thruster shall expose a 20 degree gimbal range by default.
- The main thruster visual shall rotate according to the current gimbal command.
- The main-thruster physics direction shall match the current gimbal command.
- Straight no-gimbal main thrust shall apply through the Rigidbody center of mass or equivalent compensation.
- Straight throttle-only main thrust shall not create meaningful unintended angular velocity.
- Gimballed steering contribution may create intentional torque and shall scale with throttle and fuel availability.
- Main-thruster VFX shall remain visible and distinct from RCS VFX.

### Directional RCS Modules

- The generated ship shall include four visible RCS blocks centered on free side surfaces of the elongated ship.
- Each generated RCS block shall be represented as a small primitive module attached to the ship.
- Each generated RCS block shall expose up to five usable nozzle directions.
- The attached face of an RCS block shall not fire into the ship.
- RCS nozzles shall have visible debug VFX distinct from main-thruster VFX.
- Only RCS nozzles that are actively firing shall emit their VFX.
- RCS VFX absence shall not break physics behavior.

### Transform-Driven RCS Physics

- RCS force calculations shall use installed nozzle transforms or equivalent data derived from transforms.
- RCS torque calculations shall use the Rigidbody center of mass.
- Candidate RCS torque shall be calculated from the force and lever arm: `Vector3.Cross(nozzlePosition - rigidbody.worldCenterOfMass, force)`.
- Moving an RCS block/nozzle transform shall change the resulting force/torque calculation without requiring hardcoded coordinate changes.
- Removing or disabling a nozzle shall remove that nozzle from the solver.
- Missing nozzles shall not create phantom forces.
- If no installed nozzle can produce a requested translation or torque direction, no force shall be applied for that request.

### RCS Translation

- `R` shall toggle RCS enabled state.
- `H` shall request RCS translation forward.
- `N` shall request RCS translation backward.
- `I` shall request RCS translation down.
- `K` shall request RCS translation up.
- `J` shall request RCS translation left.
- `L` shall request RCS translation right.
- RCS translation shall affect the ship only when RCS is enabled and a matching installed nozzle can produce the requested force direction.
- Translation shall be calculated from actual nozzle direction alignment with the requested translation direction.

### RCS Attitude and A/D Rotation

- RCS attitude control shall use actual nozzle torque candidates rather than direct transform rotation.
- At 0% main throttle, A/D yaw shall be produced by RCS nozzles whose force vectors generate yaw torque around the center of mass.
- Pitch and roll attitude input shall use the same transform-driven RCS torque selection when RCS is enabled.
- Active RCS attitude nozzles shall be visible through RCS VFX.
- The debug overlay shall expose enough data to see active RCS nozzles or active nozzle count.

### SAS and Vacuum Inertia

- `T` shall toggle SAS.
- Holding `F` shall temporarily invert the effective SAS state.
- With SAS enabled, after player attitude input stops, the ship shall counter angular velocity and stabilize.
- SAS counter behavior should use the RCS/nozzle torque model where practical.
- With SAS disabled, ship angular velocity shall persist in vacuum after pitch/yaw/roll input stops.
- The controller shall not silently damp angular velocity when SAS is disabled.
- Releasing controls shall not reduce linear velocity by itself.

### Debug and Documentation

- Debug overlay shall show throttle percentage.
- Debug overlay shall show main gimbal command and gimbal limit.
- Debug overlay shall show RCS installed/enabled state.
- Debug overlay shall show active RCS nozzle count or identifiers.
- Debug overlay shall show center of mass or control center information.
- Debug overlay shall show requested attitude and translation input.
- Debug overlay shall show angular velocity and forward acceleration.
- README shall document the updated controls and mouse-camera behavior.
- README shall link to `docs/physics-flight-model.md`.
- `docs/physics-flight-model.md` shall document main thrust, gimbal, RCS force/torque, SAS, and transform-driven calculation rules.

## Acceptance Criteria

- In play mode, `W/S/A/D/Q/E` request pitch, yaw, and roll and do not change throttle.
- In play mode, mouse movement changes camera look/orbit only and does not change ship attitude input.
- In play mode, `Left Shift`, `Left Control`, `X`, and `Y` control throttle as specified.
- In play mode, throttle-only main thrust accelerates forward without causing circular flight.
- In play mode, the generated ship is larger, elongated, and remains camera-visible.
- In play mode, four side-centered RCS blocks are visible on the generated ship.
- In play mode, each generated RCS block has visible/nozzle data for five non-attached directions.
- In play mode, A/D yaw at 0% main throttle produces RCS-based torque around the center of mass, not direct transform rotation.
- In play mode, moving/removing an RCS nozzle affects the solver result and missing nozzles produce no force.
- In play mode, active RCS nozzles emit RCS-colored VFX and inactive nozzles do not.
- In play mode, the main thruster visual gimbals and the physics direction follows the gimbal command.
- In play mode, SAS enabled reduces angular velocity after input release.
- In play mode, SAS disabled allows angular velocity to persist after input release.
- In play mode, releasing controls does not reduce linear velocity by itself.
- In play mode, Space still fires visible projectiles.
- Unity MCP refresh/compile completes without script compile errors.
- `specs_validate` passes for this change.
