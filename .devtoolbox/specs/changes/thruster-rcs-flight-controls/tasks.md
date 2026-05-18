# Tasks: thruster-rcs-flight-controls

## Spec Revision
- [x] Stop superseded S-turnaround verification path
- [x] Revise proposal.md for W/S throttle and KSP-like turning
- [x] Revise design.md for throttle, gimbal, RCS pivot, and force-at-position model
- [x] Revise behavioral spec.md
- [x] Validate revised spec change

## Discovery
- [x] Review current post-implementation movement scripts
- [x] Confirm Unity force-at-position and center-of-mass API guidance
- [x] Record revised implementation execution

## Runtime Bugfix
- [ ] Reproduce/diagnose W-only circular-flight acceleration bug
- [ ] Add straight-main-thrust acceptance requirement to spec
- [ ] Record bugfix execution
- [ ] Fix main-thrust force application so W-only acceleration is straight and stable
- [ ] Verify W-only thrust has near-zero unintended angular velocity
- [ ] Verify forward acceleration stays positive while W/throttle is active

## Implementation
- [ ] Replace binary main thrust command with persistent 0-100% throttle state
- [ ] Map W to throttle increase and S to throttle decrease
- [ ] Remove S turnaround/retrograde-assist behavior
- [ ] Update MainThrusterModule to apply throttle-scaled force at thruster position or compensated centerline as required for straight thrust
- [ ] Update MainThrusterModule to expose/currently report gimbal command and limit
- [ ] Update A/D to request left/right turn input, not direct reverse/assist behavior
- [ ] Update RcsThrusterController to compute installed-RCS pivot/control center at ship creation
- [ ] Update RcsThrusterController to apply RCS turning force at thruster positions where practical
- [ ] Combine RCS turning with main-thruster gimbal turning when throttle is above 0
- [ ] Ensure gimbal turning strength scales with throttle percentage
- [ ] Keep behavior safe if RCS thrusters are missing
- [ ] Update PrototypeBootstrap to wire required thruster positions/references
- [ ] Update PrototypeDebugOverlay with throttle percent, pivot, RCS availability, gimbal command, turn input, and straight-thrust telemetry
- [ ] Preserve existing bootstrap, camera, fuel, speed, gun, and projectile behavior

## Documentation
- [ ] Update README controls for W/S throttle percentage
- [ ] Document A/D RCS plus gimballed-main-thruster turning
- [ ] Document KSP-inspired approximation and current limitations

## Verification
- [ ] Unity MCP refresh/compile has no script errors
- [ ] Unity MCP play-mode check confirms bootstrap still creates ship/modules/camera/light/overlay
- [ ] Verify W increases throttle percentage
- [ ] Verify S decreases throttle percentage and does not activate reverse/assist
- [ ] Verify main thrust scales at 50% vs 100% throttle
- [ ] Verify W-only main thrust accelerates forward without circular flight
- [ ] Verify W-only main thrust does not flip forward acceleration positive/negative
- [ ] Verify A/D turn input fires RCS authority at 0% throttle when RCS exists
- [ ] Verify A/D produces gimbal command and stronger gimbal effect at higher throttle
- [ ] Verify computed RCS pivot/control center is exposed in debug overlay
- [ ] Verify gun/projectile still fires
- [ ] Re-run specs_validate
