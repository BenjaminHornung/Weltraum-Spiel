# Tasks: thruster-rcs-flight-controls

## Prior Work
- [x] Supersede previous S-turnaround control path
- [x] Diagnose offset-nozzle circular-flight root cause
- [x] Confirm Unity force-at-position behavior for torque risk
- [x] Implement initial KSP-like keymap and COM-safe straight main thrust
- [x] Fix first review findings for missing-axis RCS, SAS gating, and camera reset docs
- [x] Supersede final verification because new physical RCS/gimbal feedback changed scope

## Spec Revision
- [x] Update proposal.md for directional RCS, larger ship, gimbal visuals, mouse camera, SAS inertia, and physics documentation
- [x] Update design.md with transform-driven RCS and main-gimbal physics model
- [x] Update behavioral spec.md with new RCS/nozzle/mouse/SAS acceptance criteria
- [x] Update tasks.md for the physical RCS/gimbal revision
- [x] Validate revised spec change

## Physics Documentation
- [x] Add docs/physics-flight-model.md
- [x] Document COM-safe main thrust formula
- [x] Document gimbal force/torque model
- [x] Document RCS translation nozzle selection
- [x] Document RCS attitude torque selection using cross product
- [x] Document SAS counter-thrust/inertia behavior
- [x] Link physics document from README

## Generated Ship and Visuals
- [x] Make the generated ship larger and elongated
- [x] Adjust camera defaults for the larger generated ship
- [x] Represent main thruster as a visible cube-like gimbal module
- [x] Create four side-centered RCS block modules
- [x] Give each RCS block five non-attached nozzle directions
- [x] Add distinct RCS nozzle VFX color separate from main thruster VFX
- [x] Ensure only active RCS nozzles emit VFX

## Main Thruster and Gimbal
- [x] Set default main gimbal range to 20 degrees
- [x] Rotate main thruster visual with gimbal command
- [x] Make main-thruster physics direction follow gimbal command
- [x] Preserve COM-safe straight no-gimbal thrust
- [x] Preserve throttle/fuel scaling and projectile/gun behavior

## RCS Physics
- [x] Refactor RCS nozzle data to use installed transforms and force directions
- [x] Implement transform-driven RCS translation selection
- [x] Implement transform-driven RCS attitude torque selection
- [x] Ensure A/D yaw at 0% main throttle rotates via RCS torque around COM
- [x] Ensure missing/moved RCS nozzles change solver output without hardcoded coordinate edits
- [x] Expose active RCS nozzle count or identifiers for debug overlay

## Mouse, Camera, and Controls
- [x] Remove mouse input from ship attitude control
- [x] Add mouse look/orbit behavior to SimpleFollowCamera
- [x] Keep Backquote camera reset and avoid plain digit3/# mismatch
- [x] Preserve keyboard attitude controls W/S/A/D/Q/E
- [x] Preserve throttle controls Left Shift/Left Control/X/Y
- [x] Preserve RCS controls R and H/N/I/K/J/L
- [x] Preserve Space fire and M reserved behavior

## SAS and Vacuum Inertia
- [x] Ensure SAS enabled counters angular velocity after attitude input stops
- [x] Prefer RCS/nozzle torque model for SAS counter behavior where practical
- [x] Ensure SAS disabled allows angular velocity to persist in vacuum
- [x] Ensure releasing controls does not reduce linear velocity by itself
- [x] Preserve T toggle and hold-F SAS inversion

## Telemetry and README
- [x] Update PrototypeDebugOverlay with COM, active nozzles, gimbal visual state, SAS, angular velocity, and translation/attitude input
- [x] Update README with new ship/RCS/gimbal/mouse/SAS behavior
- [x] Document current prototype limitations and no-hardcoded-position rule

## Verification
- [x] Unity MCP compile has no script errors
- [x] Unity MCP play-mode check confirms bootstrap creates larger ship/modules/camera/light/overlay
- [x] Verify mouse does not change ship attitude input
- [x] Verify mouse camera look/orbit works and Backquote resets camera
- [x] Verify throttle-only main thrust remains straight and stable
- [x] Verify main thruster visual gimbals and physics follows it
- [x] Verify four RCS blocks and five-way nozzles exist on generated ship
- [x] Verify A/D yaw at 0% main throttle uses RCS torque around COM
- [x] Verify moved/removed RCS nozzle changes solver output and missing nozzles produce no force
- [x] Verify RCS VFX only emits from active nozzles
- [x] Verify SAS enabled reduces angular velocity after input release
- [x] Verify SAS disabled preserves angular velocity after input release
- [x] Verify releasing controls does not reduce linear velocity by itself
- [x] Verify gun/projectile still fires
- [x] Re-run specs_validate
