# Design: Docking Physics System

## Docking Port Data

A docking port should define:

```text
localPosition, localForward, captureRadius, maxAngleError, maxRelativeVelocity
```

## Phases

- Approach: measure relative state.
- Soft Capture: apply limited assist forces/torques if enabled.
- Hard Lock: create a joint or explicit connection when constraints pass.

## Integration

Soft capture should request forces through the flight-assist/physics-core path. Hard lock may use Unity joints initially, with clear debug status.

## Risks

Docking can become unstable if capture forces are too strong or joints fight Rigidbody physics. First implementation should be slow and heavily debugged.
