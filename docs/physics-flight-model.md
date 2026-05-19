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

Impact impulses have an explicit optional path:

```csharp
physicsCore.ApplyImpactImpulse(impactEvent);
```

The impulse is applied at the hit point with `ForceMode.Impulse`. The core records the last impact impulse, hit point, torque impulse, and impact count separately from normal force diagnostics so combat hits can be inspected without hiding the source of the effect.

Continuous force diagnostics and impulse diagnostics are separate. `ForceMode.Impulse` records the supplied vector as Newton-seconds. `ForceMode.VelocityChange` is a Unity delta-velocity request, so diagnostic impulse is mass-scaled before it is added to `NetAppliedImpulse`:

```text
diagnosticImpulse = velocityChange * rb.mass
diagnosticAngularImpulse = cross(position - rb.worldCenterOfMass, diagnosticImpulse)
```

`VelocityChange` never increments the continuous force counters.

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

Main throttle now distinguishes the commanded target throttle from the actual throttle used for force, fuel, thermal activity, and engine VFX. The default spool-up and spool-down rates are zero, which means instant response for the prototype. Setting finite rates makes actual throttle move toward target throttle with:

```text
actualThrottle = MoveTowards(actualThrottle, targetThrottle, ratePerSecond * deltaTime)
```

## Gimbal

The visible `MainThrusterGimbal` cube rotates with the effective yaw and pitch gimbal command. The default gimbal limit remains 20 degrees, but the default response scalar is 0.35 so normal keyboard attitude input uses a softer cone while preserving the hard cap.

Gimbal yaw and pitch also expose target and actual commands. The default slew rate is zero for instant response. Finite slew values move the actual gimbal command toward the target command in degrees per second, then apply the existing max-angle clamp before calculating visual rotation and thrust direction.

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

The generated `RCS_Top`, `RCS_Bottom`, `RCS_Left`, and `RCS_Right` blocks each carry an inspector-editable `RcsThrusterBlock`. Nozzles cache their nearest parent block and use that block's thrust when allocated. The block exposes undamaged thrust, but the effective `Thrust` value is multiplied by attached `PrototypeModuleDamageState.CapabilityMultiplier`. Damaged RCS blocks therefore reduce real allocator authority instead of only changing a UI number. The legacy controller-level `translationForce` and `attitudeForce` values remain as fallback magnitudes for nozzles that do not have a parent block, so older hand-built scenes continue to apply force.

Translation, attitude, SAS, and physical flight-assist requests are combined into one desired force/torque wrench before allocation. The current allocator is still a bounded greedy prototype, but it applies each nozzle at most once per physics frame and reports desired, actual, and residual force/torque diagnostics. Status values are residual-aware: `ok`, `limited`, `residual`, `limited-residual`, `spooling-down`, `no nozzles`, `no authority`, `no solution`, and `no fuel` describe what actually happened in that frame.

RCS nozzles keep actual throttle state. With finite response rates, spool-up ramps actual thrust toward the target throttle. When a command is released, spool-down moves actual throttle toward zero and physically applies the remaining decaying nozzle force until the throttle settles. This can create intentional short residual thrust; it is visible through actual/residual force diagnostics and the `spooling-down` status.

The debug console can issue deterministic test pulses for RCS translation, attitude, main thrust, and gimbal checks. These pulses are development probes and bypass precision-control scaling so their output stays comparable across repeated tests.

If a nozzle is moved, removed, or rotated, its force and torque contribution changes immediately. Missing nozzles cannot create phantom force.

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

## Impact Damage

Projectile hits produce `PrototypeImpactEventData` from the existing `ProjectileHitData` handoff. The impact event records:

- hit point and normal,
- target collider and Rigidbody,
- nearest `ModuleMassDescriptor`,
- relative velocity,
- impulse estimate,
- timestamp.

Generated module descriptors also ensure a `PrototypeModuleDamageState` is present on each module proxy. The first damage state tracks max/current integrity, damage fraction, capability multiplier, last impact event, last applied damage, and a compact state label. This is intentionally scalar and deterministic; armor, part detachment, leaks, and visual destruction remain later slices.

When a projectile hit finds a damage state, it applies simple impulse-scaled damage to that module. When the hit target also has a `ShipPhysicsCore`, the projectile can route the impact impulse through `ApplyImpactImpulse`. Target dummy feedback still uses the same hit path, so the visual prototype remains unchanged while module damage and impulse diagnostics become inspectable.

The debug overlay reports damaged module count, the worst module integrity, the worst capability multiplier, last impact impulse, and last impact torque impulse.

## SAS And Inertia

SAS is a ship-local PD torque request routed through the same RCS allocator as manual attitude. There is no hidden Rigidbody angular damping layer. When effective SAS is on, `RcsThrusterController` computes local angular velocity, optional local attitude error, and a desired torque before the bounded nozzle allocator decides what can actually be applied.

`KillRotation` only damps angular velocity:

```text
desiredTorqueLocal = -Kd * localAngularVelocity
```

`HoldAttitude` captures a target rotation and adds proportional correction from the shortest rotation error:

```text
desiredTorqueLocal = Kp * angularErrorLocal - Kd * localAngularVelocity
```

The PD gains are inspector fields on `RcsThrusterController`. They are not multiplied by `fixedDeltaTime`; Unity's force integration handles timestep application after the allocator applies nozzle forces with `ForceMode.Force`.

Manual attitude input keeps its coarse command dead zone, and SAS torque is masked per pitch/yaw/roll axis whenever manual attitude input on that same axis exceeds the manual dead zone. SAS remains active on released axes, so a yaw input does not reduce yaw authority but can still allow SAS to damp pitch or roll. Diagnostics expose the mode, local angular velocity, local angular error, raw SAS torque, masked SAS torque, suppressed torque, manual torque, and final desired torque.

SAS uses a small local angular-velocity dead zone near zero. After SAS has braked a non-manual axis into the tiny local settle band, that axis is snapped to zero angular velocity so late SAS activation visibly finishes converging. Translation RCS authority is not reduced by SAS. When RCS is disabled, missing, or out of fuel, SAS still reports its torque request diagnostics, but no impossible stabilizing torque is applied.

The ship rigidbody uses zero linear and angular damping in this prototype. Releasing controls does not bleed off linear velocity, and rotation persists in vacuum unless SAS/RCS torque counters it.

## Flight Assist Layer

Flight assist is an explicit request layer above the existing allocator/core path. It does not write Rigidbody velocity, does not add hidden linear or angular damping, and does not bypass actuator limits.

The prototype names three modes:

- `Simulation`: default Newtonian behavior. No assist force or torque request is generated, so vacuum linear and angular momentum persist unless real actuators or environment forces act.
- `AssistedFlight`: reserved for physical assist behaviors such as velocity or rotation help. Any non-zero force or torque request is merged into the same RCS allocator demand used by manual input and SAS before `ShipPhysicsCore` applies concrete forces.
- `DebugAssist`: reserved for testing helpers. Requests are visible in diagnostics and marked debug-only/non-physical; the allocator excludes them from physical force application unless a future change intentionally adds a separately documented debug path.

`RcsThrusterController` records assist mode, request source, force, torque, and debug-only status separately from manual and SAS diagnostics. The debug overlay shows manual command, SAS command/torque, and assist request fields side by side so future flight bugs can identify which layer asked for a wrench.

## Docking Prototype

`DockingPort` is the first docking physics component. It defines a local port frame (`localPosition` and `localForward`) plus capture radius, hard-lock radius, angle limits, relative-velocity limits, soft-capture gains, maximum soft-capture force/torque, and hard-lock enablement. The world port position and forward direction are derived from the owning transform so moving a ship or module moves the port without separate bookkeeping.

Relative state is measured between two ports without applying any physics:

```text
offset = targetPortWorldPosition - sourcePortWorldPosition
angleError = Angle(sourceForward, -targetForward)
relativeVelocity = targetPointVelocity - sourcePointVelocity
closingSpeed = max(0, -dot(relativeVelocity, normalize(offset)))
```

Eligibility uses the stricter settings across both ports. Soft capture requires capture radius, soft angle, soft relative velocity, and both ports enabling soft capture. Hard lock requires hard-lock radius, hard angle, hard relative velocity, and both ports enabling hard lock. Diagnostics report concrete reasons such as `outside-capture-radius`, `angle-too-large`, `relative-velocity-too-high`, `soft-capture-eligible`, and `hard-lock-eligible`.

Soft capture does not teleport or write Rigidbody velocity. When eligible, it produces a bounded physical `FlightAssistRequest` with source `Docking`, mode `AssistedFlight`, and `debugOnlyNonPhysical = false`. The request is designed to flow through the existing flight-assist/RCS allocator path before concrete forces reach `ShipPhysicsCore`.

Hard lock is intentionally a documented placeholder in this slice. `BuildHardLockPrototype` only requests a lock when `DockingEligibility.canHardLock` is true, reports `hard-lock-placeholder`, and does not create a joint. If the experimental joint toggle is enabled before a joint implementation exists, diagnostics report `hard-lock-joint-not-yet-implemented` rather than silently adding an unstable constraint.

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

The recoil path uses the same core force-at-position application path as thrusters, but its diagnostics are recorded separately as `NetAppliedImpulse` and `NetAppliedAngularImpulse`. This keeps one-shot Newton-second recoil from being mixed into continuous `NetAppliedForce` and `NetAppliedTorque` values.

The configured projectile mass is passed into the spawned `Projectile`, so Rigidbody mass, recoil, impact impulse, and impulse-scaled damage all use the same value.

Projectiles store their previous physics position and sweep from that position to the current Rigidbody position each `FixedUpdate`. The sweep uses `Physics.SphereCastAll` with the projectile collider radius, then falls back to `Physics.RaycastAll` for a centerline check. A projectile reports only one hit, shares the same report path for sweep and `OnCollisionEnter`, and ignores its own collider plus all firing-ship colliders passed in at spawn.

`ProjectileHitData` remains the low-level hit shape. It exposes whether the hit came from sweep or collision, the hit collider, attached Rigidbody, optional `PrototypeTargetDummy`, hit point, normal, incoming velocity, and timestamp. `PrototypeImpactEventData` is built from that hit data for module damage and optional impulse routing.

## Optional Central Gravity

The prototype remains zero gravity by default. `ShipPhysicsCore` exposes optional central-body settings for a single configured body transform and gravitational parameter `mu`; if no body is assigned, the feature is disabled and no environment acceleration is applied.

When enabled, the core computes:

```text
acceleration = directionToBody * mu / r^2
```

The acceleration is applied at the ship center of mass with `ForceMode.Acceleration`, so the ship acceleration is independent of Rigidbody mass. The diagnostic force is still recorded as `acceleration * rb.mass` in the shared wrench telemetry so the overlay can compare environment force with thrust, RCS, and recoil in one place.

The debug overlay reports the active gravity body, distance, `mu`, acceleration vector, diagnostic force, and whether the gravity step applied. This slice intentionally keeps the model to one central body. Future orbital gameplay should prefer readable sphere-of-influence or patched-conic transitions before considering full N-body simulation.

## Floating Origin Infrastructure

Large-world state is represented separately from Unity's local float transforms. `LargeWorldTransformState` stores double-precision absolute position and velocity beside the local Unity position, rotation, and angular velocity. `FloatingOriginBody` owns that state for a participating object, while `FloatingOriginManager` optionally shifts the local origin when its configured focus body crosses the local distance threshold.

The manager is disabled by default and is not required by the current prototype scene. When enabled, a shift first captures each registered body's absolute state from the old origin, advances the absolute origin by the focus body's local offset, then reapplies every registered body at its new local position. Rigidbody linear and angular velocity are restored after the local position write so momentum survives the shift. Relative offsets between registered bodies are expected to remain stable.

This infrastructure intentionally avoids flight-control, thruster, weapon, and custom-physics ownership. Those systems continue to operate on normal local transforms and `Rigidbody.worldCenterOfMass` while the registered bodies remain near the active local origin.

Limitations for the first pass:

- World-space particle systems can visually pop during an origin shift unless their live particles are separately offset.
- Trail renderers and projectile sweep history use world positions; shift-aware compensation is needed before shifting active trails/projectiles in gameplay.
- Physics joints, constraints, and connected bodies must all be registered together or they can see an artificial separation jump.
- Streaming, multiplayer replication, planet-scale terrain, and custom double-precision physics remain out of scope.

## Physics Validation

EditMode tests in `Assets/Tests/Editor/PrototypePhysicsValidationTests.cs` exercise deterministic generated ship probes from `PhysicsValidationProbe`. They cover throttle-only main force, gimbal cross-product torque, RCS translation and yaw allocation, RCS spool diagnostics, manual/SAS torque priority, partial-fuel thrust scaling, configured-mass projectile recoil/impact checks, force-vs-impulse diagnostic separation, projectile sweep/self-hit checks, thermal heat rise, idle cooling, overheat hook activation, and a 0.02 vs 0.01 timestep comparison.

Run the suite through Unity Test Runner EditMode or Unity MCP `run_tests(mode=EditMode)`. Store run output and deterministic probe evidence under the active spec folder, for example `.devtoolbox/specs/changes/validation-physics-test-suite/tests/test-protocol.md`.

## Deferred Physics Slices

The current prototype intentionally defers deeper simulation layers:

- full fuel mass flow across all thruster systems and fuel-dependent COM changes,
- armor, leaks, part detachment, visual destruction, and full combat balance,
- orbit prediction, sphere-of-influence transitions, patched conics, and floating origin,
- additional SAS/autopilot modes, docking constraints, damage effects, full heat/power networking, and trajectory preview.

Those systems should be added as separate spec changes so each one can be verified against the same force/torque accounting.
