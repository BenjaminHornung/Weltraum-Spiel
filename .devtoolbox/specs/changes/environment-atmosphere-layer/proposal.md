# environment-atmosphere-layer

## Why

Atmospheric flight may matter later for planets and landings, but it should not contaminate the space-flight core. Space physics and atmospheric physics need a clear boundary.

## What

Define an optional atmosphere layer for drag, lift, heating, and air density. The first implementation should be disabled unless a test atmosphere is explicitly configured.

## Out of Scope

- No planets in the current prototype.
- No CFD or realistic aerodynamics.
- No wings/fins gameplay yet.
- No reentry visuals.
- No terrain or landing systems.

## Success Criteria

- Vacuum remains the default.
- Atmosphere forces are applied only inside configured atmosphere volumes or fields.
- Drag depends on velocity, density, drag coefficient, and reference area.
- Heating/lift can be deferred but named in the model.
- Debug output shows atmospheric density and applied drag when enabled.
