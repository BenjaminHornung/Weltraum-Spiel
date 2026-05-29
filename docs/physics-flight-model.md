# Prototype Physics Flight Model

This prototype uses the imported Blender Demo Scout as the default runtime ship, and the force model is intentionally transform-driven so the ship can be debugged in the Unity hierarchy. Generated primitives remain as an explicit fallback/debug build mode.

## Imported Functional Socket Binding

`PrototypeBootstrap` defaults to `PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault`. The runtime root remains `PrototypeShip`, but the Blender scout is instantiated under `PrototypeShip/ImportedShipVisual` and bound by `PrototypeFunctionalShipBinder`.

The binder runs `PrototypeShipSocketUtility.EnsureSocketsInHierarchy` on the imported model, then binds:

- main thrust from imported `THRUST_NOZZLE_MAIN*` sockets,
- RCS from imported `RCS_NOZZLE_*` sockets,
- engine and RCS VFX children at those sockets,
- the visible turret hierarchy from `WEAPON_TURRET_BASE_*`, `WEAPON_TURRET_YAW_*`, `WEAPON_TURRET_PITCH_*`,
- projectile origin and muzzle flash from `WEAPON_MUZZLE_*` and `WEAPON_MUZZLE_FLASH_*`.

In the imported default mode, missing required functional sockets do not silently fall back to root-space placeholders. A missing main nozzle disables the normal engine-nozzle fallback, and a missing weapon muzzle prevents firing instead of creating `PrototypeShip/Muzzle`.

Builder-facing hardpoints are normalized through the same socket layer. `PrototypeShipHardpointBinder` binds imported `CONN_*`, `HARDPOINT`, weapon-base, and connector sockets into `PrototypeShipHardpoint` components with stable ids, part/module/group metadata, direction, and runtime/builder flags. Generated primitive fallback ships create a `GeneratedConnectorRig` with unit-scale connector sockets derived from generated module mass descriptors, then run the same binder. Repeated binds update existing records and report duplicates instead of creating parallel hardpoints, and the generated fallback remains available as an explicit debug/build mode.

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

`ComSafeSteeringOnly` is the default. The main engine computes the nozzle-forward base thrust vector and applies that force at `Rigidbody.worldCenterOfMass` through `ShipPhysicsCore`:

```csharp
physicsCore.ApplyForceAtCenterOfMass(thrustTransform.forward * thrust, ForceMode.Force);
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

For imported ships, `EngineVfxController.Nozzle` is configured to the imported `THRUST_NOZZLE_MAIN*` transform. The normal imported path disables the root `EngineNozzle` fallback so a missing Blender marker is visible as a binding failure instead of a fake effect at the ship origin.

## Gimbal

The visible `MainThrusterGimbal` cube rotates with the effective yaw and pitch gimbal command. The default gimbal setup is intentionally calmer than the early prototype: 10 degree hard limit, 0.14 response scalar, and 30 degrees-per-second slew. `GimbalAssistMode` gates how much attitude input can feed the main-thruster gimbal; the default is `AutopilotOnly`, with Off, Low, Manual, and ExperimentalFull still available from diagnostics.

Gimbal yaw and pitch also expose target and actual commands. Finite slew values move the actual gimbal command toward the target command in degrees per second, then apply the existing max-angle clamp before calculating visual rotation and thrust direction. Precision and Translation control modes force the main-thruster command and gimbal commands to zero, so close-range maneuvering uses RCS/SAS instead of surprise main-engine steering.

The physical thrust vector follows the same effective gimbal direction as the visual. In `ComSafeSteeringOnly`, the steering component is the only main-thruster source of torque:

```csharp
steeringForce = (gimballedDirection - baseDirection) * thrust;
torque = Vector3.Cross(nozzlePosition - rb.worldCenterOfMass, steeringForce);
```

## RCS Nozzles

RCS force comes from installed nozzle transforms named `RCS_Nozzle_*` or imported `RCS_NOZZLE_*`. The solver does not assume fixed positions. Each nozzle supplies:

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

Imported default ships set `RcsThrusterController.UseImportedFunctionalSockets` to true and refresh nozzles from `PrototypeShip/ImportedShipVisual`. RCS VFX lookup accepts `VFX`, `PreviewRcsThrusterVfx`, and `RcsThrusterVfx` children, so the allocator activates effects at the actual imported nozzle positions rather than generated `RCS_Top`/`RCS_Left` locations.

Translation, attitude, SAS, and physical flight-assist requests are combined into one desired force/torque wrench before allocation. `FlightControlMode` is explicit: Normal/Cruise maps W/S/A/D/Q/E to pitch/yaw/roll while Shift/Ctrl adjust main throttle; Precision keeps W/S/A/D/Q/E as RCS attitude with main/gimbal forced off; Translation maps W/S to forward/back, A/D to left/right, H/N to up/down, and leaves Q/E as roll. Caps Lock and the HUD mode button cycle these modes; Left Alt is not part of the primary control model. The current allocator is still a bounded greedy prototype, but it applies each nozzle at most once per physics frame and reports desired, actual, and residual force/torque diagnostics. Status values are residual-aware: `ok`, `limited`, `residual`, `limited-residual`, `spooling-down`, `no nozzles`, `no authority`, `no solution`, and `no fuel` describe what actually happened in that frame.

RCS nozzles keep actual throttle state. With finite response rates, spool-up ramps actual thrust toward the target throttle. When a command is released, spool-down moves actual throttle toward zero and physically applies the remaining decaying nozzle force until the throttle settles. This can create intentional short residual thrust; it is visible through actual/residual force diagnostics and the `spooling-down` status.

The debug console can issue deterministic test pulses for RCS translation, attitude, main thrust, and gimbal checks. These pulses are development probes and bypass runtime input-layer state so their output stays comparable across repeated tests. Refuel, reset, damage, target spawning, variant spawning, debug assist, and pulse buttons are debug-only controls and should not be treated as player-facing gameplay input.

## Variant Diagnostics And HUD

Built-in prototype ship variants are generated to expose physics behavior under controlled layouts rather than to model a final ship editor. Baseline Balanced is the reference layout; Dual Main Thruster checks symmetric engine force; Off-Center Main Thruster compares COM-safe and fully physical nozzle-force modes; One-Sided RCS and No-RCS intentionally expose allocator residuals and missing-authority states; Heavy Cargo checks mass and inertia scaling.

`PrototypeShipBlueprint` adds the first data-driven generated-ship layer on top of those same variant and layout paths. A blueprint contains reusable module definitions and positioned module instances, validates required cockpit, fuel, main-thruster, RCS, and gun coverage, then converts into `PrototypeShipVariant` and `PrototypeShipLayout` instead of bypassing existing flight components. Scout Blueprint and Hauler Blueprint are built-in samples for deterministic testing: their dry mass, fuel capacity, main thrust, RCS block thrust, weapon tuning, module positions, COM, and inertia come from installed part data. They remain generated fallback/debug ships and do not alter imported Blender functional binding.

The main camera now owns the debug console, compact flight diagnostics, keybind helper, minimap, and `PrototypeFlightHud` after each bootstrap or variant spawn. These remain temporary draggable IMGUI windows so prototype testing can keep the play view clear without a final UI Toolkit migration. `F1`, `F2`, `F3`, `F4`, and `F5` toggle keybinds, diagnostics, debug console, HUD/Navball, and minimap.

The HUD projects world vectors into ship-local marker space:

```text
localDirection = shipTransform.InverseTransformDirection(worldDirection.normalized)
marker = new Vector2(localDirection.x, -localDirection.y) * radius
```

Forward, prograde, retrograde, SAS hold, and optional target markers use that projection. The default HUD keeps marker labels short and prints only the active mode label, for example `Mode: TARGET`, instead of the full reserved mode list. A compact quick-action strip exposes previous/next target, autopilot, Kill Momentum, Control Mode, and SAS while keeping the navball view readable. HUD, diagnostics, and debug console read SAS/RCS/control-mode state from the controller diagnostics snapshot instead of keeping local copies. When debug vector mode or RCS Test diagnostics are enabled, desired, actual, and residual RCS force markers use the same projection so a one-sided or fuel-limited allocator result can be inspected visually. The HUD reserves mode labels for `WORLD`, `VELOCITY`, `TARGET`, `DOCKING`, and `ORBIT/GRAVITY`; the current slice only displays prototype labels and does not implement a final 3D navball, docking director, or orbital map.

Debug UI presets are available from the debug console:

- Basic: minimal UI coverage for normal play-view inspection.
- Flight Test: compact flight diagnostics plus HUD/Navball.
- RCS Test: allocator diagnostics and debug force markers visible.
- Full Diagnostics: deeper foldout diagnostics and all existing debug buttons.

The generated primitive modules use a central prototype color palette so role information is readable during physics tests. Hull, cockpit, fuel tank, main engine, RCS block, gun, cargo/utility, target, and orientation markers use higher-contrast colors across built-in variants without importing final assets. RCS VFX is stronger and cyan/green while active nozzles fire; main-engine VFX uses a separate orange/blue exhaust and visible nozzle ring.

Generated visuals are now authored through `PrototypeShipPartVisualFactory`, which maps existing layout entries to reusable archetypes (`CockpitWedge`, `HullCore`, `FuelTankPod`, `MainEngineBell`, `RcsPod`, `GunMount`, `CargoBox`, `UtilityBlock`, `ConnectorHardpointMarker`) from lightweight runtime metadata. Unsupported entries now fall back to neutral hull/utility visuals instead of always appearing as plain cubes, preserving a readable prototype style while keeping `MainThrusterNozzle`, `RCS_Nozzle_*`, and `Muzzle` gameplay transforms unchanged.

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

## Weapon Turret, Muzzle Origin, And Recoil

The imported Demo Scout gun is a visible turret hierarchy. The yaw mesh is parented under `WEAPON_TURRET_YAW_PRIMARY`, and the barrel/muzzle mesh is parented under `WEAPON_TURRET_PITCH_PRIMARY`, so runtime aim changes are visible in the ship model.

`PrototypeTurretWeapon.EvaluateFireStatus` is side-effect-free by default. Aim motion is advanced through `TickAimAtTarget`, which slews yaw and pitch toward the requested target using `ShipStats.TurretSlewDegreesPerSecond`. `TryFireAt` fires only when the requested target is in arc, in range, off cooldown, and aligned within the prototype tolerance. Manual fire without an active Weapon Computer target still fires along the current muzzle forward direction.

Projectile, tracer, recoil, and muzzle flash origins are taken from `WEAPON_MUZZLE_PRIMARY` and `WEAPON_MUZZLE_FLASH_PRIMARY`. In the imported default path, missing muzzle markers produce `NoMuzzle`/missing-socket status instead of a root-space projectile at `Vector3.zero`.

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

`PrototypeMomentumAssist` adds a physical Kill Momentum helper above this request layer. It has explicit states (`Idle`, `AlignForBrake`, `MainBrake`, `RcsDamp`, `Complete`, `Aborted`, `NoAuthority`, `FuelInsufficient`) and never stops the ship by writing Rigidbody velocity or teleporting. At higher speeds, when main thrust is available and the ship is in Normal/Cruise control mode, it aligns for a main-engine brake and requests main throttle plus RCS/SAS-style torque through the normal controller path. At lower speeds, or whenever Precision/Translation has disabled main thrust, it damps linear and angular motion with physical RCS assist requests. HUD activation grants a short stale-input grace window, then manual flight input aborts the assist so the pilot can immediately take control.

`PrototypeWaypointAutopilot` is also routed through the explicit request layer. Engaging it switches the controller to Normal/Cruise, enables RCS/SAS, aborts Momentum Assist, clears stale manual-input state, and sends one aggregated `WaypointAutopilot` request per fixed step. That request can contain lateral RCS force, attitude torque, and main-throttle intent together, so final-approach lateral correction is not overwritten by burn alignment.

## Navigation Computer And Camera Focus

`PrototypeWaypointAutopilot` delegates trajectory decisions to `PrototypeTrajectoryPlanner` instead of treating every fixed step as a direct-target burn/brake reaction. The planner emits an executable `PrototypeFlightPlan` with predicted samples and maneuver segments, and strict flight-plan execution is the normal path. The preview route, Navigation Planner schedule, minimap route, and executor all read that same plan id/revision. In strict mode the autopilot does not silently fall back to a legacy direct burn; invalid plans, invalid segment directions, expired plans, target drift, obstacle changes, or tracking divergence force an explicit replan from the current Rigidbody state.

Execution is closed-loop against the plan samples rather than open-loop segment thrust. Each fixed step interpolates the active predicted sample, reads the real Rigidbody center of mass, velocity, rotation, and angular velocity, then computes:

```text
positionError = plannedPosition - actualPosition
velocityError = plannedVelocity - actualVelocity
desiredAcceleration = plannedFeedforward + Kp * positionError + Kd * velocityError
```

Main thrust is only allowed along a valid plan or brake direction. RCS handles cross-track, lateral, terminal, and hold correction. The tracker records active segment/sample, cross-track error, along-track error, velocity error, attitude error, desired acceleration, main component, RCS component, and replan reason for HUD/debug display. Moderate velocity catch-up stays a tracking correction; hard position/velocity divergence still requests a new plan.

Navigation Computer v2 separates the high-level autopilot phase from the active trajectory segment. Runtime phases are:

- `Direct`
- `AvoidancePlanning`
- `Avoiding`
- `ReacquireDirectPath`
- `Brake`
- `FinalApproach`
- `Hold`

The autopilot still sends physical `FlightAssistRequest` values only. It does not assign `Rigidbody.position`, `Rigidbody.rotation`, `Rigidbody.linearVelocity`, or `Rigidbody.angularVelocity` in the runtime navigation path.

Obstacle detection is handled by `PrototypeObstacleDetector`. Collider-backed obstacles first use `Physics.OverlapSphereNonAlloc` at the cast origin because Unity sphere casts do not report colliders that already overlap the initial sphere. The detector then uses `Physics.SphereCastNonAlloc` for path lookahead, colliding with trigger obstacles, selecting the nearest blocking `PrototypeNavigationObstacle`, filtering non-blocking hazards, and ignoring ship-owned colliders. `PrototypeNavigationObstacle` components without colliders are checked through a registry-backed geometric line/sphere fallback so debug/environment points can still block a route without per-frame scene scans.

When direct line of sight is blocked, the planner builds scored candidates: direct, left, right, up, down, and diagonal variants where useful. Candidate scoring combines collision clearance, estimated delta-v, heading change, lateral velocity reduction, fuel feasibility, braking feasibility, and RCS authority margin. The chosen candidate records its score and reason, emits an avoidance waypoint, and keeps the desired burn direction out of the obstacle corridor. The autopilot keeps a stable avoidance waypoint during the lock window so it does not oscillate between sides, then transitions through `ReacquireDirectPath` once clearance and line of sight are available.

Plans are reported as segments for diagnostics and UI:

- `Align`
- `Burn`
- `Coast`
- `AvoidanceBurn`
- `Brake`
- `FinalApproach`
- `Hold`

Each segment carries duration, direction, throttle, expected delta-v, expected fuel, predicted closest obstacle distance, and predicted miss distance to target. Main thrust is reserved for meaningful delta-v along the planned burn direction; if the ship is not aligned, main throttle stays at zero and the request is attitude/RCS-only. RCS is used for lateral correction, avoidance sidestep, final approach, and hold damping. RCS requests remain mass-based and are clamped to available translation authority; insufficient authority reports `LimitedRcsAuthority`, `HoldNoAuthority`, or `LimitedHoldAuthority`.

The player-facing Navigation Planner lists the executable maneuver chain as a compact schedule with `T+start-end`, actuator mode, expected delta-v, and fuel per step. `FinalApproach` and `Hold` suppress normal main-throttle correction and use RCS for small residual drift. Preview and execution share `PrototypeFlightPlan.predictedSamples`; when replanning replaces the plan, both the drawn route and executor route change together.

RCS requests are mass-based force requests:

```text
requestedRcsForceWorld = desiredAccelerationWorld * rb.mass
```

Lateral correction follows the same rule:

```text
desiredLateralAcceleration = -lateralVelocity / dampingSeconds
requestedForce = desiredLateralAcceleration * rb.mass
requestedForce = clampMagnitude(requestedForce, availableRcsTranslationAuthority)
```

Stopping decisions include planned stopping distance, burn estimate, and conservative alignment lead time. Arrival uses distance, full relative speed, and lateral speed together. It intentionally does not require `closingSpeed >= 0`, because a ship drifting slightly away inside the arrival radius should still be able to hold when total relative speed is low enough. Hold uses RCS damping for a confirmation window before completion; if the hold envelope cannot be maintained, the autopilot keeps reporting an authority limit rather than faking completion.

`PrototypeCameraAnchor` separates semantic focus from visual fit. `SimpleFollowCamera` resolves focus in this order:

1. Highest-priority `PrototypeCameraAnchor`
2. `Rigidbody.worldCenterOfMass`
3. Visual bounds center
4. Target transform position

Renderer bounds continue to drive perspective fit distance and safe minimum zoom, but they do not move the focus point when an anchor or COM is available. This keeps asymmetric/imported visuals from dragging the camera away from the ship center.

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

`PrototypeDockingApproachAssist` is the runtime bridge from those diagnostics to play. It binds a source port, chooses an explicit or discovered target port outside the ship hierarchy, and exposes the latest target, distance, closing speed, lateral offset, alignment, refusal, and routed-assist state to the player HUD. When soft capture is eligible and enabled, it forwards the existing `DockingSoftCaptureRequest.assistRequest` into `PlayerShipController.SetExternalFlightAssistRequest`; when disabled, ineligible, or missing a target it clears only docking-owned external assist requests. The component does not assign Rigidbody position or velocity.

`PrototypeBootstrap` adds a small component-backed docking approach target only when no other target port is available. The target is kinematic, faces the player source port, and is bound through component references/candidate lists rather than an existing demo hierarchy path.

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

## Trajectory Preview And Burn Planning

The first trajectory preview slice is debug-only and intentionally narrow. `TrajectoryPredictionState` captures local position, velocity, rotation, angular velocity, elapsed time, and remaining fuel. `TrajectoryPredictor` advances that state with a bounded fixed-step loop and finite-value guards so preview work cannot run unbounded in Play Mode or editor tooling.

Included forces for this slice:

- Local translation from the initial velocity.
- Optional central gravity through `ShipPhysicsCore.TryEvaluateCentralGravityAcceleration`, using the same `mu / r^2` formula and minimum-distance clamp as the live gravity step.
- Optional autopilot actuator inputs: main-thrust acceleration along the planned burn direction, optional RCS acceleration, and fuel consumption over fixed prediction steps.

Excluded forces and effects for this slice:

- SAS, manual flight assist, recoil, docking assist, atmosphere, drag, thermal effects, collision response, damage, and floating-origin shifts.
- Rotation integration beyond carrying the sampled rotation and angular velocity through the preview state.
- Orbit-map UI, maneuver-node editing, patched conics, sphere-of-influence transitions, and full N-body prediction.

`TrajectoryBurnPlan` records burn direction, duration, throttle, requested fuel, available estimated fuel, applied fuel fraction, and approximate delta-v from `thrust * throttle * fuelFraction * duration / mass`. Navigation Computer v2 uses those estimates inside candidate scoring and segment diagnostics; it is still a local prototype planner, not a full maneuver-node or orbital transfer planner.

`PrototypeTrajectoryPreviewNavMap` promotes the first slice from debug-only gizmos into a bounded player-facing nav-map source. It prefers the existing `PrototypeWaypointAutopilot.PredictedRoute` when that route is available, otherwise it samples `TrajectoryPredictor` with the same `ShipPhysicsCore` central-gravity hook and a small `TrajectoryBurnPlan` estimate. The component clamps the prediction step count, fixed horizon, and rendered point count, then reports `Disabled`, `Unavailable`, `Empty`, `Valid`, or `Truncated` so HUD/minimap tests can distinguish "off" from "no safe data".

The preview is toggleable through the minimap control surface and is bound by `PrototypeBootstrap` to both `PrototypePlayerHudRenderer` and `PrototypeMinimapOverlay`. HUD radar and minimap rendering use the existing route drawing surfaces with a separate preview color, and both paths filter non-finite points before any geometry is drawn.

This v1 layer intentionally does not add full N-body simulation, patched conics, sphere-of-influence transitions, maneuver-node editing, a persistent route planner, or unbounded prediction. It remains local prototype guidance over the current predictor and burn-plan infrastructure.

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
- orbit-map UI, sphere-of-influence transitions, patched conics, and full maneuver-node planning,
- additional SAS/autopilot modes, docking constraints, damage effects, full heat/power networking, and higher-fidelity trajectory preview.

Those systems should be added as separate spec changes so each one can be verified against the same force/torque accounting.
