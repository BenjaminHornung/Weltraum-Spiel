# Design: Atmosphere Layer

## Separation

Atmosphere belongs in an environment layer, not inside ship thruster code. In vacuum, the layer produces zero force.

## First Formula

Use a simple drag approximation:

```text
dragForce = -velocity.normalized * 0.5 * rho * v^2 * Cd * area
```

Density can be a constant in prototype test volumes or later a function of altitude.

## Integration

Atmospheric force should route through `ShipPhysicsCore` as an environment force. Lift and heating can be separate future slices.

## Risks

Drag can hide momentum bugs if enabled by default. The default must remain vacuum.
