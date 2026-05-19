# Design: Thruster Response Model

## Response Curves

Use simple deterministic rate limiting first:

```text
actual = MoveTowards(actual, target, ratePerSecond * deltaTime)
```

This is sufficient for throttle spool and gimbal slew in the prototype.

## Main Engines

Track target throttle from player input separately from actual throttle used for force and fuel. Large engines can later have slower spool values.

## Gimbal

Track target gimbal yaw/pitch separately from actual gimbal yaw/pitch. Enforce configured max gimbal degrees before applying slew.

## RCS

RCS response can remain instant by default, but the data model should allow response time per block/nozzle later.

## Risks

Response can make controls feel laggy. Defaults should preserve the current prototype unless the inspector values are changed.
