# Prototype Physics Flight Model

This prototype uses generated primitives only, but the force model is intentionally transform-driven so the ship can be debugged in the Unity hierarchy.

## Main Thrust

Straight main thrust is COM-safe. The main engine computes the ship-forward base thrust vector and applies that force at `Rigidbody.worldCenterOfMass`:

```csharp
rb.AddForceAtPosition(transform.forward * thrust, rb.worldCenterOfMass, ForceMode.Force);
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

The visual exhaust convention is the opposite of the force convention: nozzle forward is the force direction, while each nozzle's visible exhaust plume points opposite `nozzle.transform.forward`.

For every active nozzle:

```csharp
force = nozzle.transform.forward * thrust;
torque = Vector3.Cross(nozzle.transform.position - rb.worldCenterOfMass, force);
```

Translation commands select nozzles whose actual force direction points with the requested ship-local axis. Attitude commands select nozzles whose cross-product torque points with the requested pitch, yaw, or roll axis. If a nozzle is moved, removed, or rotated, its force and torque contribution changes immediately. Missing nozzles cannot create phantom force.

## SAS And Inertia

SAS is an RCS angular counter-command. When effective SAS is on, the controller converts angular velocity into a counter attitude command and lets the same nozzle solver pick usable RCS jets. Manual attitude input keeps its coarse command dead zone, but SAS uses a small local angular-velocity dead zone near zero and a minimum active braking command outside that dead zone, so residual pitch, yaw, and roll are not dropped just because their counter-command is below the manual input threshold. After SAS has braked a non-manual axis into the tiny local settle band, that axis is snapped to zero angular velocity so late SAS activation visibly finishes converging. When SAS is off, there is no direct angular damping from the controller.

The ship rigidbody uses zero linear and angular damping in this prototype. Releasing controls does not bleed off linear velocity, and rotation persists in vacuum unless SAS/RCS torque counters it.
