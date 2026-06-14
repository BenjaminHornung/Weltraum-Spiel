# Ship Builder Stat Formulas

Status: planning/spec-only, 2026-06-14.

This document defines simple deterministic v0 formulas for Ship Builder stats.
The formulas should be testable from part definitions and part instances without
final Blender art.

## 1. Units and conventions

- Mass: kilograms (`kg`)
- Force/thrust: newtons (`N`)
- Distance: meters (`m`)
- Time: seconds (`s`)
- Velocity: meters per second (`m/s`)
- Acceleration: meters per second squared (`m/s2`)
- Torque: newton meters (`N*m`)
- Grid: `0.5 m` default visible snap
- Axes: `+Z` forward, `+Y` up, `+X` right

All formulas must reject non-finite input. Negative mass, capacity, thrust,
volume, fire rate, damage, power, or heat capacity is invalid.

## 2. Mass formulas

### Dry mass

```text
dryMassKg = sum(instance.part.massDryKg)
```

Only enabled instances count. Disabled future modules do not contribute unless a
later repair/storage rule says otherwise.

### Fuel mass

```text
fuelMassKg = sum(instance.fuelTank.fuelCapacityKg * plannedFillFraction)
```

MVP default:

```text
plannedFillFraction = 1.0
```

If no fuel tank exists, fuel mass is `0` and fuel-dependent stats become
unavailable or invalid according to validation.

### Cargo capacity mass and volume

```text
cargoMassCapacityKg = sum(instance.cargo.cargoMassCapacityKg)
cargoVolumeCapacityM3 = sum(instance.cargo.cargoVolumeM3)
```

Future cargo fill:

```text
cargoLoadedMassKg = sum(resource.massPerUnitKg * quantity)
cargoLoadedVolumeM3 = sum(resource.volumePerUnitM3 * quantity)
```

Cargo mass must remain queryable as an aggregate for ship physics, fuel estimates,
and autopilot planning.

### Total mass

```text
totalMassEmptyKg = dryMassKg + fuelMassKg
totalMassFullKg = dryMassKg + fuelMassKg + cargoLoadedMassKg
```

If the UI needs a single MVP loaded mass before real cargo exists:

```text
totalLoadedMassKg = dryMassKg + fuelMassKg
```

Future cargo preview can use a selected cargo load fraction:

```text
previewCargoMassKg = cargoMassCapacityKg * cargoPreviewFillFraction
totalLoadedMassKg = dryMassKg + fuelMassKg + previewCargoMassKg
```

## 3. Main thrust and acceleration

### Main thrust

```text
mainThrustN = sum(enabled mainThruster.thrustNewton)
```

Only usable thrusters with valid nozzle direction count.

### Acceleration

```text
accelerationEmptyMps2 = mainThrustN / totalMassEmptyKg
accelerationLoadedMps2 = mainThrustN / totalLoadedMassKg
```

If mass is zero or thrust is missing, acceleration is unavailable and validation
reports the appropriate error.

## 4. RCS acceleration by axis

For each enabled RCS nozzle:

```text
worldOrShipAxisContribution = dot(nozzleForceDirection, axisDirection)
positiveContribution = max(0, worldOrShipAxisContribution) * nozzleForceN
negativeContribution = max(0, -worldOrShipAxisContribution) * nozzleForceN
```

For each axis:

```text
rcsForcePositiveAxisN = sum(positiveContribution)
rcsForceNegativeAxisN = sum(negativeContribution)
rcsAccelerationPositiveAxis = rcsForcePositiveAxisN / totalLoadedMassKg
rcsAccelerationNegativeAxis = rcsForceNegativeAxisN / totalLoadedMassKg
```

Axes:

- X: right/left translation
- Y: up/down translation
- Z: forward/back translation or braking support

Nozzle directions must come from socket metadata. No root or zero-vector fallback
is allowed.

## 5. RCS torque estimate

For each RCS nozzle:

```text
leverArm = nozzleWorldOrLocalPosition - centerOfMass
forceVector = nozzleForceDirection * nozzleForceN
torqueVector = cross(leverArm, forceVector)
```

Aggregate per axis:

```text
pitchTorqueNm = sum(abs(dot(torqueVector, localX)))
yawTorqueNm = sum(abs(dot(torqueVector, localY)))
rollTorqueNm = sum(abs(dot(torqueVector, localZ)))
```

Simple turn authority estimate:

```text
turnAuthorityPitch = pitchTorqueNm / inertiaEstimatePitch
turnAuthorityYaw = yawTorqueNm / inertiaEstimateYaw
turnAuthorityRoll = rollTorqueNm / inertiaEstimateRoll
```

MVP inertia estimate can use part bounds:

```text
inertiaEstimateAxis = totalLoadedMassKg * averagePerpendicularRadiusM^2
```

This is a handling estimate, not a final rigidbody inertia tensor.

## 6. Delta-v estimate

Use the rocket equation when fuel and fuel burn data exist:

```text
massInitialKg = dryMassKg + fuelMassKg + cargoLoadedMassKg
massFinalKg = dryMassKg + cargoLoadedMassKg
massFlowKgPerSecond = sum(active mainThruster.fuelBurnKgPerSecond)
effectiveExhaustVelocity = mainThrustN / massFlowKgPerSecond
deltaVMps = effectiveExhaustVelocity * ln(massInitialKg / massFinalKg)
```

If `massFlowKgPerSecond <= 0` and thrust exists, the stat should show
`fuel-free/experimental` or unavailable based on the propulsion metadata, not
infinite delta-v by accident.

If `massInitialKg <= massFinalKg`, delta-v is `0` or unavailable depending on why
fuel is missing.

## 7. Burn time

```text
burnTimeSeconds = fuelMassKg / massFlowKgPerSecond
```

If mass flow is zero, burn time is unavailable or marked fuel-free according to
metadata.

## 8. Center of mass

Simple v0 COM:

```text
centerOfMass = sum(partMassKg * instanceLocalPosition) / sum(partMassKg)
```

`partMassKg` should include:

- dry mass
- fuel mass at the tank position
- future cargo mass at cargo module position
- future ammo mass at weapon/ammo storage position

If total mass is zero, COM is invalid.

## 9. Thrust axis

For each main thruster:

```text
thrusterForcePoint = nozzleSocketPosition or instancePosition
thrusterForceDirection = normalized(nozzleForceDirection)
weightedDirection += thrusterForceDirection * thrustN
weightedPoint += thrusterForcePoint * thrustN
```

Aggregate:

```text
thrustAxisDirection = normalized(weightedDirection)
thrustAxisPoint = weightedPoint / mainThrustN
```

If no valid main thrust exists, thrust axis is unavailable.

## 10. COM/thrust offset

Compute the shortest distance from COM to the aggregate thrust axis:

```text
offsetVector = centerOfMass - thrustAxisPoint
parallel = dot(offsetVector, thrustAxisDirection) * thrustAxisDirection
lateralOffset = length(offsetVector - parallel)
```

Warning threshold:

```text
lateralOffset > 0.35 m
```

Later heavy ships can use size-scaled thresholds:

```text
threshold = max(0.35 m, shipBoundsRadius * 0.05)
```

## 11. Braking and weak braking estimate

MVP weak braking warning can use reverse usable authority:

```text
brakingForceN = reverseMainThrustN + rcsForceNegativeForwardAxisN
brakingAcceleration = brakingForceN / totalLoadedMassKg
```

Warn when:

```text
brakingAcceleration < accelerationLoadedMps2 * 0.25
```

or when absolute braking acceleration is below a chosen comfort threshold for
test flights.

## 12. Weapon DPS rough estimate

For each weapon:

```text
weaponDps = projectileDamage * fireRatePerSecond * barrelCount * uptimeFactor
```

MVP default:

```text
uptimeFactor = 1.0
```

Future uptime can include heat, ammo, power, arc blockage, reload time, and target
tracking limits.

Total weapon DPS:

```text
totalWeaponDps = sum(weaponDps for unblocked usable weapons)
```

If a turret is missing a muzzle, it is invalid and contributes `0`.

## 13. Recoil estimate

Per shot:

```text
recoilImpulseNs = projectileMassKg * projectileSpeedMps
```

If projectile mass is not modeled:

```text
recoilImpulseNs = weapon.recoilImpulseNewtonSecond
```

Average recoil force:

```text
averageRecoilForceN = recoilImpulseNs * fireRatePerSecond * barrelCount
```

Approximate recoil acceleration:

```text
recoilAccelerationMps2 = averageRecoilForceN / totalLoadedMassKg
```

Recoil torque can reuse the RCS torque pattern:

```text
recoilTorque = cross(muzzlePosition - centerOfMass, -muzzleDirection * averageRecoilForceN)
```

## 14. Cargo and exposed-load estimates

Cargo support warning:

```text
cargoSupportRatio = cargoMassCapacityKg / max(1, cargoLoadedMassKg)
```

Warn if loaded cargo exceeds capacity:

```text
cargoLoadedMassKg > cargoMassCapacityKg
cargoLoadedVolumeM3 > cargoVolumeCapacityM3
```

External cargo warning can come from part metadata:

```text
cargo.externalExposure == true
```

## 15. Heat and power placeholders

Power placeholder:

```text
powerBalance = sum(powerGeneratedFuture) - sum(powerDrawFuture)
```

Heat placeholder:

```text
heatBalance = sum(heatGeneratedFuture) - sum(coolingRateFuture)
```

MVP rule:

- Show these as planned values only if metadata exists.
- Do not block flight readiness on power/heat network rules until a later slice
  explicitly enables them.
- Never infer heat or power from visual mesh complexity.

## 16. Determinism and tests

Stats shall be deterministic and testable:

- same definitions plus same instances produce the same stats
- formulas do not read scene objects, renderer bounds, final art, or VFX helpers
- all inputs are finite-checked
- unavailable values are explicit

Later EditMode tests should cover:

- dry/fuel/loaded mass
- acceleration from thrust and mass
- RCS axis force coverage
- RCS torque estimate by lever arm
- delta-v and burn time
- COM and thrust-axis offset
- weapon DPS and recoil estimate
- cargo capacity and volume
- heat/power placeholder behavior
