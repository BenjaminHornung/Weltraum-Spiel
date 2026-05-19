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

Straight main thrust is COM-safe. The main engine computes the ship-forward base thrust vector and applies that force at `Rigidbody.worldCenterOfMass` through `ShipPhysicsCore`:

```csharp
physicsCore.ApplyForceAtCenterOfMass(transform.forward * thrust, ForceMode.Force);
```

That means throttle-only forward thrust does not create torque when no gimbal input is present.

## Gimbal

The visible `MainThrusterGimbal` cube rotates with the effective yaw and pitch gimbal command. The default gimbal limit remains 20 degrees, but the default response scalar is 0.35 so normal keyboard attitude input uses a softer cone while preserving the hard cap.

The physical thrust vector follows the same effective gimbal direction as the visual. The straight component is still applied through COM; only the steering delta between the base direction and the gimballed direction is applied at the nozzle transform. That steering component is the only main-thruster source of torque:

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

## SAS And Inertia

SAS is an RCS angular counter-command. When effective SAS is on, the controller converts angular velocity into a counter attitude command and lets the same nozzle solver pick usable RCS jets. Manual attitude input keeps its coarse command dead zone, and SAS is masked per pitch/yaw/roll axis whenever manual attitude input on that same axis exceeds the manual dead zone. SAS remains active on released axes, so a yaw input does not reduce yaw authority but can still allow SAS to damp pitch or roll.

SAS uses a small local angular-velocity dead zone near zero and a minimum active braking command outside that dead zone, so residual pitch, yaw, and roll are not dropped just because their counter-command is below the manual input threshold. After SAS has braked a non-manual axis into the tiny local settle band, that axis is snapped to zero angular velocity so late SAS activation visibly finishes converging. Translation RCS authority is not reduced by SAS. When SAS is off, there is no direct angular damping from the controller.

The ship rigidbody uses zero linear and angular damping in this prototype. Releasing controls does not bleed off linear velocity, and rotation persists in vacuum unless SAS/RCS torque counters it.

## Physics Validation

EditMode tests in `Assets/Tests/Editor/PrototypePhysicsValidationTests.cs` exercise deterministic generated ship probes from `PhysicsValidationProbe`. They cover throttle-only main force, gimbal cross-product torque, RCS translation and yaw allocation, partial-fuel thrust scaling, projectile recoil detection, and a 0.02 vs 0.01 timestep comparison.

Run the suite through Unity Test Runner EditMode or Unity MCP `run_tests(mode=EditMode)`. Store run output and deterministic probe evidence under the active spec folder, for example `.devtoolbox/specs/changes/validation-physics-test-suite/tests/test-protocol.md`.

## Deferred Physics Slices

The current prototype intentionally defers deeper simulation layers:

- module mass distribution, center of mass, and inertia tensor approximation,
- full fuel mass flow across all thruster systems and fuel-dependent COM changes,
- SAS as a target-attitude PD controller,
- projectile recoil and hit impulse,
- gravity, orbit prediction, and floating origin,
- docking constraints, damage effects, heat, power, and trajectory preview.

Those systems should be added as separate spec changes so each one can be verified against the same force/torque accounting.
