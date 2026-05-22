# architecture-main-thrust-modes

## Why

The prototype already uses a gameplay-stable main-thrust split: straight thrust is applied through the center of mass and only gimbal steering creates torque. That keeps throttle-only flight stable, but the long-term game also needs a physically honest mode where a gimballed engine applies its full force at the nozzle position.

This change defines both modes explicitly so future engine work can choose between accessibility and stricter physics without burying the decision in ad-hoc force code.

## What

Add a main-thrust mode model with two explicit behaviors:

- `ComSafeSteeringOnly`: straight thrust acts through the center of mass; only gimbal delta produces torque.
- `FullyPhysicalNozzleForce`: the full gimballed thrust vector is applied at the engine/nozzle transform.

The default for the current prototype remains `ComSafeSteeringOnly` unless a later tuning spec changes game feel.

## Out of Scope

- No new ship editor.
- No final engine module hierarchy.
- No fuel, heat, damage, or power changes.
- No automatic migration to fully physical behavior for the current prototype.
- No external physics solver.

## Success Criteria

- The two main-thrust modes are named and inspector-configurable.
- Throttle-only stability remains the default.
- Fully physical mode can be selected for experiments and uses actual nozzle position.
- Gimbal torque diagnostics show which mode produced the force/torque.
- README or physics docs explain the gameplay vs physical tradeoff.
- Unity MCP validation reports no C# compile errors when implemented.
