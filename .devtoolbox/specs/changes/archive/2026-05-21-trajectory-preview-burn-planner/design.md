# Design: Trajectory Preview and Burn Planner

## Prediction Rule

The predictor must share formulas with real physics. If gravity, atmosphere, or assist behavior differs, the preview must state what is included.

## First Slice

A debug predictor can simulate:

```text
state = position, velocity, rotation, angularVelocity
for N steps: integrate forces/accelerations with fixed dt
```

Start with translation and gravity before adding attitude, burns, or atmospheric effects.

## Burn Planner

A planned burn should describe direction, duration, throttle, and expected fuel use. UI-heavy planning is deferred.

## Risks

Prediction drift is dangerous for player trust. Verification should compare prediction against real simulation over short horizons.
