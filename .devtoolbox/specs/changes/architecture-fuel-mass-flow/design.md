# Design: Fuel Mass Flow

## Model

Keep the prototype simple: fuel consumption is configurable mass flow in kg/s at full thrust. The applied thrust fraction determines actual consumption.

```text
fuelRequested = fullRateKgPerSecond * appliedThrottle * deltaTime
fuelFraction = min(1, availableFuel / fuelRequested)
appliedThrust = requestedThrust * fuelFraction
```

If fuel use is configured as zero, it must explicitly mean no fuel cost rather than no thrust.

## Main Engines

Main engines consume fuel based on actual applied throttle and selected main-thrust mode. Gimbal itself does not consume extra fuel in this slice.

## RCS

RCS consumes fuel from allocated nozzle output. The allocator result is the source of truth, so each nozzle consumes at most its bounded throttle share.

## Mass Integration

Fuel mass should feed the module mass/COM model when that change exists. Until then, it can continue feeding total Rigidbody mass with clear documentation.

## Risks

Fuel, mass, and thrust ordering can create off-by-one-frame behavior. Verification must include almost-empty-tank cases.
