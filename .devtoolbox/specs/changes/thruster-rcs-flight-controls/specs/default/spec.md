# Specification: KSP-like Thruster and RCS Controls

## Capability

The prototype flight model shall use a persistent main-throttle state and force-placement-based turning from RCS and gimballed main thrusters, while guaranteeing stable straight-line acceleration when no turn input is present.

## Requirements

### Main Throttle

- The ship shall have a persistent main-thruster throttle value from 0% to 100%.
- `W` shall increase the main-thruster throttle value.
- `S` shall decrease the main-thruster throttle value.
- `S` shall not mean reverse thrust.
- `S` shall not mean turnaround or retrograde assist.
- Main thrusters shall apply force continuously according to the current throttle while fuel is available.
- Main thrust shall scale with the throttle percentage.
- If fuel is empty, main thrust shall drop to zero even if throttle is above 0%.
- The GUI/debug overlay shall show the throttle percentage.

### Straight Main-Thrust Stability

- With no A/D, mouse, roll, or other turn input active, main-thruster force shall not introduce meaningful yaw, pitch, or roll torque.
- Pressing or holding `W` alone shall accelerate the ship primarily along the ship's forward direction.
- Forward acceleration shown in debug shall remain stable and positive while throttle increases and fuel is available.
- The ship shall not enter a circular flight path from W/main-throttle input alone.
- If force-at-position is used for main thrusters, the no-gimbal/no-turn thrust line shall pass through, or be compensated to act through, the Rigidbody center of mass.

### Main Thruster Gimbal

- Main thrusters shall expose whether they support gimbal.
- Main thrusters shall expose a gimbal limit in degrees.
- Main thrusters shall expose the current gimbal command or current gimbal angle.
- Gimbal angle shall be clamped by the configured gimbal limit.
- A/D turning input shall request main-thruster gimbal yaw when main throttle is above 0 and gimbal is available.
- Main-gimbal turning authority shall scale with main-throttle percentage.
- Main-thruster force may be applied at the thruster position only when the force line does not create unwanted torque without turn input; otherwise the prototype shall use a compensated force application for straight thrust and a separate gimbal torque contribution.

### RCS Thrusters and Pivot

- The generated ship shall have optional placeholder RCS thrusters.
- The bootstrap or RCS controller shall compute a prototype RCS control pivot from installed RCS thruster positions when the ship is created.
- The computed RCS pivot shall be exposed for debug display.
- If main throttle is 0 and RCS thrusters exist, A/D turning shall use RCS thruster authority around the computed RCS pivot/control center.
- RCS force shall be applied at RCS thruster positions where practical.
- RCS absence shall be handled without null errors and without phantom missing-thruster forces.

### Combined Turning

- A/D shall request left/right turning.
- If RCS exists, A/D shall fire left/right RCS authority.
- If one or more active main thrusters support gimbal and throttle is above 0, A/D shall also request gimbal deflection.
- At higher main throttle, gimbal-driven turning shall be stronger than at lower main throttle.
- The implementation shall not rely only on directly rotating the transform for A/D turning.

### Debug and Documentation

- Debug overlay shall show throttle percentage.
- Debug overlay shall show forward acceleration and angular velocity or equivalent straight-thrust telemetry.
- Debug overlay shall show RCS availability.
- Debug overlay shall show the computed RCS pivot/control center.
- Debug overlay shall show gimbal state and A/D turn input.
- README shall document that W/S adjust throttle, not forward/back movement.
- README shall document that A/D uses RCS and gimballed main thrust to turn.
- README shall state that the physics is a KSP-inspired prototype approximation, not a full simulation.

## Acceptance Criteria

- In play mode, holding or pressing `W` increases main-throttle percentage.
- In play mode, holding or pressing `S` decreases main-throttle percentage.
- In play mode, `S` does not apply reverse thrust and does not activate a turnaround assist.
- In play mode, W/main-throttle input alone accelerates forward without causing circular flight.
- In play mode, W/main-throttle input alone keeps angular velocity near zero compared with A/D turning.
- In play mode, forward acceleration does not flip positive/negative while W is held and fuel is available.
- In play mode, throttle percentage is visible in the GUI/debug overlay.
- In play mode, main thrust at 50% throttle is lower than at 100% throttle.
- In play mode, A/D changes the requested turn input.
- In play mode at 0% main throttle with RCS installed, A/D produces RCS-based turning authority.
- In play mode above 0% main throttle with gimbal enabled, A/D produces a non-zero gimbal command and gimbal-driven torque/force contribution that scales with throttle.
- In play mode, the computed RCS pivot/control center is available for debug display.
- Unity MCP refresh/compile completes without script compile errors.
- Existing bootstrap, fuel, speed overlay, gun, projectile, and camera behavior remain usable.
