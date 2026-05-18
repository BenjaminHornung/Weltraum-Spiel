# thruster-rcs-flight-controls

## Why

The prototype needs a spacecraft control model that can grow toward Kerbal Space Program-like flight instead of arcade forward/backward movement. The current control slice already moved throttle to `Left Shift`/`Left Control` and fixed the main-thrust straight-line torque bug, but the RCS attitude behavior is still not physically clear enough: with main thrust disabled, yaw should be produced by visible RCS force couples around the ship's center of mass, not by abstract or hardcoded rotation.

The next revision makes the prototype easier to debug visually and technically. The generated ship becomes larger and longer, RCS blocks expose directional nozzles, used nozzles emit colored particles, the main engine visibly gimbals, and the important physics calculations are documented centrally for future changes.

## What

Revise the prototype flight controls and debug model around these behaviors:

- Use a larger elongated placeholder ship so rotation, RCS placement, and gimbal movement are readable.
- Place four visible RCS blocks at the center of the generated ship's free side surfaces.
- Each RCS block is a small cube-like module with five possible nozzle directions; the attached face has no nozzle.
- RCS force and torque are calculated from actual nozzle transforms, force directions, and the Rigidbody center of mass.
- Missing or moved RCS nozzles change the physics outcome automatically; no fixed-position or name-only solver may be required for correctness.
- A/D yaw at 0% main throttle uses RCS force couples around the center of mass.
- Active RCS nozzles show colored particle/VFX output distinct from the main engine.
- The main thruster is a visible cube/module with a 20 degree gimbal range.
- The main thruster visual rotates with the current gimbal command, and the physics direction follows the same command.
- Mouse input no longer changes ship attitude; mouse movement is camera look/orbit only.
- SAS counters angular velocity after player attitude input stops; with SAS disabled, rotation persists in vacuum.
- Important physics rules are documented in a central flight-physics document and linked from README/spec docs.

## Included Features

- KSP-inspired keyboard layout for attitude, throttle, RCS, SAS, camera, and firing.
- Persistent main-throttle state and visible throttle percentage.
- COM-safe straight main thrust.
- Visible, transform-driven main-thruster gimbal with 20 degree range.
- Directional 5-way RCS modules with visible per-nozzle debug VFX.
- RCS torque/translation solver based on installed nozzle transforms and Rigidbody center of mass.
- Mouse camera look/orbit with no mouse steering.
- SAS angular stabilization using counter-thrust/torque behavior.
- Debug overlay updates for throttle, SAS, RCS, precision, turn input, forward acceleration, angular velocity, COM, selected RCS nozzles, and gimbal command.
- Central physics documentation for thrust, torque, RCS selection, SAS, and gimbal calculations.
- README update for controls, debug behavior, and limitations.

## Out of Scope

- No full Kerbal Space Program simulation.
- No orbital mechanics, orbital map, planets, or celestial bodies.
- No staging system.
- No final part editor.
- No full mass-tree solver.
- No aerodynamics.
- No full autopilot or target-following SAS.
- No final multi-thruster balancing UI.
- No damage, hit detection, or combat balancing.
- No asset-pack dependency for ship/RCS visuals.

## Success Criteria

- `W/S/A/D/Q/E` request pitch, yaw, and roll and do not change throttle.
- Mouse movement changes camera view/orbit only and does not steer the ship.
- `Left Shift` increases throttle, `Left Control` decreases throttle, `X` cuts throttle, and `Y` sets full throttle.
- Main thrust scales with throttle and fuel availability.
- Throttle-only input accelerates forward without circular flight or unintended angular velocity.
- The generated ship is visibly larger and elongated.
- Four visible RCS blocks are centered on the generated ship's side surfaces.
- Each generated RCS block exposes five possible nozzle directions except the attached face.
- RCS forces and torques are computed from real nozzle transforms and center of mass.
- Moving a thruster/nozzle transform changes the resulting torque/force calculation.
- A/D at 0% main throttle produces visible RCS yaw around the center of mass when RCS is enabled.
- SAS enabled counteracts angular velocity after attitude input stops.
- SAS disabled allows angular velocity to continue in vacuum instead of silently damping away.
- The main thruster visibly gimbals up to 20 degrees and the physics uses that gimbal command.
- Active RCS nozzles and main thruster have distinct visible VFX.
- README and a central physics document explain the calculation model and known prototype limitations.
