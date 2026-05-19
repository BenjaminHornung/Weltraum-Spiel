# Prototype Physics Flight Model

This prototype uses generated primitives only, but the force model is intentionally transform-driven so the ship can be debugged in the Unity hierarchy.

## Ship Physics Core

Ship-level force application is routed through `ShipPhysicsCore`. This is a deliberately thin prototype component, not the final simulation architecture. It owns the ship `Rigidbody` reference for migrated systems and records the net applied force and torque for each physics step.

The shared diagnostic shape is a wrench:

```text
W = [Fx, Fy, Fz, Tx, Ty, Tz]
```

For a force applied at a world position, the diagnostic torque remains:

```csharp
torque = Vector3.Cross(position - rb.worldCenterOfMass, force);
```

Main thrust and RCS still own their behavior and tuning. The core is the common application and telemetry path, so future systems such as SAS modes, recoil, docking assist, damage, or autopilot can request physical effects without independently bypassing shared force accounting.

## Main Thrust

Main thrust has an explicit mode so the prototype can switch between stable gameplay thrust and stricter physical nozzle force without bypassing `ShipPhysicsCore`.

`ComSafeSteeringOnly` is the default. The main engine computes the ship-forward base thrust vector and applies that force at `Rigidbody.worldCenterOfMass` through `ShipPhysicsCore`:

```csharp
physicsCore.ApplyForceAtCenterOfMass(transform.forward * thrust, ForceMode.Force);
```

That means throttle-only forward thrust does not create torque when no gimbal input is present. Only the steering delta between the base direction and the gimballed direction is applied at the nozzle transform.

`FullyPhysicalNozzleForce` applies the full gimballed thrust vector at the main nozzle position through `ShipPhysicsCore`:

```csharp
physicsCore.ApplyForceAtPosition(gimballedDirection * thrust, nozzlePosition, ForceMode.Force);
```

That mode is more physically literal and can create torque from an off-center nozzle or shifted COM. Its diagnostic torque follows the same cross-product rule as other force-at-position paths.

## Gimbal

The visible `MainThrusterGimbal` cube rotates with the effective yaw and pitch gimbal command. The default gimbal limit remains 20 degrees, but the default response scalar is 0.35 so normal keyboard attitude input uses a softer cone while preserving the hard cap.

The physical thrust vector follows the same effective gimbal direction as the visual. In `ComSafeSteeringOnly`, the steering component is the only main-thruster source of torque:

```csharp
steeringForce = (gimballedDirection - baseDirection) * thrust;
torque = Vector3.Cross(nozzlePosition - rb.worldCenterOfMass, steeringForce);
```

## RCS Nozzles

RCS force comes from installed nozzle transforms named `RCS_Nozzle_*`. The solver does not assume fixed positions. Each nozzle supplies:

- `nozzle.transform.position`
- `nozzle.transform.forward` as the force direction
- the nearest parent `RcsThrusterBlock.Thrust` value

The visual exhaust convention is the opposite of the force convention: nozzle forward is the force direction, while each nozzle's visible exhaust plume points opposite `nozzle.transform.forward`.

For every active nozzle:

```csharp
force = nozzle.transform.forward * nozzleBlock.Thrust;
torque = Vector3.Cross(nozzle.transform.position - rb.worldCenterOfMass, force);
```

The generated `RCS_Top`, `RCS_Bottom`, `RCS_Left`, and `RCS_Right` blocks each carry an inspector-editable `RcsThrusterBlock`. Nozzles cache their nearest parent block and use that block's thrust when selected. The legacy controller-level `translationForce` and `attitudeForce` values remain as fallback magnitudes for nozzles that do not have a parent block, so older hand-built scenes continue to apply force.

Translation commands select nozzles whose actual force direction points with the requested ship-local axis. Attitude commands select nozzles whose cross-product torque points with the requested pitch, yaw, or roll axis. If a nozzle is moved, removed, or rotated, its force and torque contribution changes immediately. Missing nozzles cannot create phantom force.

## Module Mass, COM, And Inertia

Generated prototype modules carry `ModuleMassDescriptor` components. Each descriptor exposes dry mass, optional fuel mass, local position through its transform, and an approximate box size. `ShipStats.ApplyMassProperties` collects those descriptors every physics step, sums dry plus active fuel mass, calculates the local center of mass as the mass-weighted average of module positions, and applies the result to the Rigidbody.

The fuel tank descriptor uses the current ship fuel value, so main-thruster fuel use can reduce total mass immediately. The Rigidbody uses manual mass properties while descriptors are available:

```csharp
rb.mass = properties.TotalMassKg;
rb.centerOfMass = properties.LocalCenterOfMass;
rb.inertiaTensor = properties.InertiaTensor;
```

The inertia tensor is a diagonal prototype approximation. Each module contributes the standard cuboid inertia for its descriptor box size, plus a parallel-axis offset from the calculated center of mass. This keeps the behavior inspectable while making wide or long layouts rotate more slowly under the same torque.

The debug overlay reports descriptor module count, dry mass, fuel mass, local/world COM, and Rigidbody inertia tensor so placement and tuning changes are visible during prototype flight.

## Fuel Mass Flow

Fuel consumption is a prototype mass-flow model in kilograms per second at full thrust. The shared fuel API accepts a throttle-equivalent demand and calculates:

```text
fuelRequested = fullRateKgPerSecond * throttleEquivalent * deltaTime
fuelFraction = min(1, availableFuel / fuelRequested)
appliedThrust = requestedThrust * fuelFraction
```

If `fullRateKgPerSecond` is zero, the fuel request is zero and the fuel fraction stays at 1. This is the explicit fuel-free thrust mode, not a hidden thrust disable.

Main engines pass their final throttle command into this model. If the tank cannot cover the whole physics step, the engine consumes the remaining fuel, clamps the tank at zero, and applies only the covered thrust fraction.

RCS uses the final bounded allocator output as the source of truth. After translation, attitude, and SAS demands are merged into per-nozzle throttle values, the controller sums those final nozzle throttles once, requests fuel for that total, and scales every applied nozzle force by the available fuel fraction. This means a nozzle that contributes to combined commands consumes fuel once for its final throttle share rather than once per command source.

Fuel mass feeds the module mass model through the generated fuel-tank descriptor. `PlayerShipController` reapplies mass properties after thruster fuel use in the physics step, so consumed fuel reduces Rigidbody mass and fuel COM contribution. The debug overlay reports main and RCS fuel requested, fuel used, applied fraction, and RCS allocator throttle totals.

## SAS And Inertia

SAS is an RCS angular counter-command. When effective SAS is on, the controller converts angular velocity into a counter attitude command and lets the same nozzle solver pick usable RCS jets. Manual attitude input keeps its coarse command dead zone, and SAS is masked per pitch/yaw/roll axis whenever manual attitude input on that same axis exceeds the manual dead zone. SAS remains active on released axes, so a yaw input does not reduce yaw authority but can still allow SAS to damp pitch or roll.

SAS uses a small local angular-velocity dead zone near zero and a minimum active braking command outside that dead zone, so residual pitch, yaw, and roll are not dropped just because their counter-command is below the manual input threshold. After SAS has braked a non-manual axis into the tiny local settle band, that axis is snapped to zero angular velocity so late SAS activation visibly finishes converging. Translation RCS authority is not reduced by SAS. When SAS is off, there is no direct angular damping from the controller.

The ship rigidbody uses zero linear and angular damping in this prototype. Releasing controls does not bleed off linear velocity, and rotation persists in vacuum unless SAS/RCS torque counters it.

## Power And Heat

Prototype modules can carry an optional `PrototypeThermalModule`. The component declares power draw, heat generation, heat capacity, cooling rate, ambient temperature, maximum temperature, and an optional overheat effect. Thermal simulation defaults to off on generated modules, so the current flight prototype is unchanged unless a module is explicitly enabled.

The first-pass deterministic model is:

```text
temperature += heatGeneratedPerSecond / heatCapacity * deltaTime
temperature -= coolingRate * deltaTime
```

Cooling is clamped at ambient temperature. Active modules report current power draw for diagnostics. The generated main thruster has a configured overheat hook that can disable thrust when thermal simulation is enabled and the module temperature reaches its limit. The debug overlay shows main-thruster temperature, thermal state, heat, cooling, power draw, and overheat hook efficiency.

## Projectile Recoil And Sweep

Gun fire keeps projectile velocity relative to the moving ship:

```csharp
projectileVelocity = shipRigidbody.linearVelocity + muzzleTransform.forward * shipStats.ProjectileSpeed;
```

Each projectile has a configured mass. When recoil is enabled, `GunModule` applies the opposite muzzle-relative momentum to the firing ship at the muzzle position through `ShipPhysicsCore`:

```csharp
projectileMomentum = muzzleForward * projectileMass * projectileSpeed;
physicsCore.ApplyForceAtPosition(-projectileMomentum, muzzlePosition, ForceMode.Impulse);
```

The recoil path uses the same core force-at-position telemetry as thrusters, so offset guns can produce both linear impulse and torque diagnostics.

Projectiles store their previous physics position and sweep from that position to the current Rigidbody position each `FixedUpdate`. The sweep uses `Physics.SphereCastAll` with the projectile collider radius, then falls back to `Physics.RaycastAll` for a centerline check. A projectile reports only one hit, shares the same report path for sweep and `OnCollisionEnter`, and ignores its own collider plus all firing-ship colliders passed in at spawn.

`ProjectileHitData` is the handoff shape for later damage work. It exposes whether the hit came from sweep or collision, the hit collider, attached Rigidbody, optional `PrototypeTargetDummy`, hit point, normal, incoming velocity, and timestamp. This change does not add a damage model; target dummies still only play prototype hit feedback.

## Atmosphere Layer

The prototype remains vacuum by default. No atmosphere object is created by `PrototypeBootstrap`, and `PrototypeAtmosphereVolume` starts with simulation disabled and zero density. A ship only receives atmospheric force when its `ShipPhysicsCore` is explicitly configured with an enabled atmosphere volume or global field.

The first atmosphere force is drag:

```text
dragForce = -relativeVelocity.normalized * 0.5 * density * speed^2 * dragCoefficient * referenceArea
```

`PrototypeAtmosphereVolume` supplies density, drag coefficient, reference area, optional wind velocity, and optional spherical bounds. Lift and heating are represented as zero diagnostics for now so later slices can extend the same sample model without changing the default vacuum behavior.

`ShipPhysicsCore.ApplyEnvironmentForces` samples the configured atmosphere and applies non-zero drag at the center of mass through the same force-accounting path used by thrust, RCS, recoil, and other environment forces. The debug overlay reports atmosphere state, density, relative speed, drag coefficient, reference area, and the drag force vector.

## Optional Central Gravity

The prototype remains zero gravity by default. `ShipPhysicsCore` exposes optional central-body settings for a single configured body transform and gravitational parameter `mu`; if no body is assigned, the feature is disabled and no environment acceleration is applied.

When enabled, the core computes:

```text
acceleration = directionToBody * mu / r^2
```

The acceleration is applied at the ship center of mass with `ForceMode.Acceleration`, so the ship acceleration is independent of Rigidbody mass. The diagnostic force is still recorded as `acceleration * rb.mass` in the shared wrench telemetry so the overlay can compare environment force with thrust, RCS, and recoil in one place.

The debug overlay reports the active gravity body, distance, `mu`, acceleration vector, diagnostic force, and whether the gravity step applied. This slice intentionally keeps the model to one central body. Future orbital gameplay should prefer readable sphere-of-influence or patched-conic transitions before considering full N-body simulation.

## Physics Validation

EditMode tests in `Assets/Tests/Editor/PrototypePhysicsValidationTests.cs` exercise deterministic generated ship probes from `PhysicsValidationProbe`. They cover throttle-only main force, gimbal cross-product torque, RCS translation and yaw allocation, fuel scaling and mass-flow behavior, projectile recoil detection, projectile sweep/self-hit checks, thermal heat rise, idle cooling, overheat hook activation, and a 0.02 vs 0.01 timestep comparison.

Run the suite through Unity Test Runner EditMode or Unity MCP `run_tests(mode=EditMode)`. Store run output and deterministic probe evidence under the active spec folder, for example `.devtoolbox/specs/changes/validation-physics-test-suite/tests/test-protocol.md`.

## Deferred Physics Slices

The current prototype intentionally defers deeper simulation layers:

- SAS as a target-attitude PD controller,
- full projectile damage and hit impulse effects,
- orbit prediction, sphere-of-influence transitions, patched conics, and floating origin,
- docking constraints, damage effects, full heat/power networking, and trajectory preview.

Those systems should be added as separate spec changes so each one can be verified against the same force/torque accounting.
