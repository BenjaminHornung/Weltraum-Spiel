# architecture-fuel-mass-flow

## Why

Fuel should be more than a HUD number. In a modular space game, fuel mass affects ship mass, center of mass, available thrust time, and later ship design choices.

This change defines a fuel mass-flow model for main engines and RCS without jumping to a full rocket-science simulation.

## What

Introduce fuel as physical mass that is consumed proportionally to actual applied thrust. The model should support main engines, RCS thrusters, partial fuel availability, and future multiple tanks.

## Out of Scope

- No resource inventory.
- No crafting or refinery systems.
- No multi-fuel economy.
- No final Isp-based realism requirement.
- No UI beyond prototype debug/tuning display.

## Success Criteria

- Fuel mass participates in total ship mass.
- Main engine fuel use scales with applied throttle/thrust.
- RCS fuel use scales with allocated nozzle thrust.
- Last-step partial fuel produces partial thrust instead of a free full step.
- Zero fuel blocks fuel-consuming thrusters without hidden damping.
