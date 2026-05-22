# Design: Prototype Flight Tuning Diagnostics

## Approach

Keep the current physics implementation and add visibility around it. This change should reuse `PrototypeDebugOverlay`, existing controller debug properties, and optional Unity gizmos/debug lines.

## Diagnostics

Useful values include:

- Main throttle, thrust, gimbal command, and forward acceleration.
- RCS enabled state, selected nozzle count, total translation force, estimated torque, and block thrust values.
- SAS enabled/effective state, SAS command, angular velocity, and damping result.
- Rigidbody mass, center of mass, velocity, and angular velocity.

## Visuals

Optional gizmos may draw force and torque direction vectors. They should be debug-only and not require asset packs.

## Risks

Too much overlay noise can make the prototype harder to read. Keep the overlay compact and use toggles if needed.
