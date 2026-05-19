# architecture-sas-pd-control

## Why

Current SAS behavior is a useful prototype stabilizer, but the long-term game needs SAS as a real control layer that requests torque from available thrusters instead of directly hiding rotation or relying on timestep-tuned counter-input.

This change defines SAS as a physically constrained PD controller.

## What

Introduce SAS modes and torque requests built from attitude error and angular velocity:

- Kill Rotation,
- Hold Attitude,
- later Hold Prograde/Retrograde/Target/Docking Align.

The first implementation should focus on Kill Rotation and Hold Attitude, routed through the RCS allocator and `ShipPhysicsCore`.

## Out of Scope

- No full autopilot.
- No orbital navigation UI.
- No target selection system.
- No magical damping unless explicitly marked as debug assist.
- No hidden changes to manual controls.

## Success Criteria

- SAS computes desired torque using PD-style gains.
- SAS effectiveness depends on available RCS authority.
- Manual input can override or mask relevant axes without disabling all stabilization.
- SAS has timestep-stable behavior.
- Debug overlay shows SAS mode, torque request, error, and residual angular velocity.
