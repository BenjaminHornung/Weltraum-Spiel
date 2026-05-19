# prototype-flight-tuning-diagnostics

## Why

The prototype now has main thrust, gimbal, RCS, SAS, projectiles, and camera behavior. Before adding more gameplay, flight values need to be easier to inspect and tune. Without better diagnostics it is hard to tell whether a maneuver feels wrong because of thrust, mass, inertia, SAS, gimbal, camera, or input mapping.

## What

Add lightweight tuning and diagnostic support for the existing prototype flight systems. The goal is not to redesign physics, but to make forces, commands, and important tuning values visible enough to iterate confidently.

## Included

- Better debug overlay fields for flight tuning.
- Optional visual debug gizmos for thrust and torque directions.
- Clear inspector values for main thrust, RCS thrust, SAS strength, and smoothing where available.
- Test evidence for representative thrust/RCS/SAS scenarios.

## Out of Scope

- New flight model architecture.
- Ship editor.
- Autopilot.
- Reaction wheels.
- New combat mechanics.
- Final balancing.

## Success Criteria

- A developer can see which systems are commanding force or torque during a maneuver.
- Main thrust, RCS thrust, and SAS effects are easier to tune from inspector/debug values.
- Diagnostic visuals can be enabled without affecting gameplay physics.
- Unity scripts compile and the prototype remains quick to test.
