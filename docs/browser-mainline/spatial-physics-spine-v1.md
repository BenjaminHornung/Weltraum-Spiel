# Browser Spatial and Physics Spine V1

## Purpose and boundary

This slice supplies deterministic browser-domain reference frames and a small gravity probe. It is renderer-independent TypeScript. It does not render planets, model terrain, voxels, atmosphere, collisions or thrust, integrate a spacecraft, or connect itself to the game loop.

All time, frame, source, epoch, and integration inputs are explicit. Floating origin and visual scale are projections only: neither can change a canonical position, frame ID, entity ID, gravity result, or physics state.

## Universe time

`RuntimeUniverseClock` wraps the existing Persistence `UniverseTime` contract. One second remains exactly 120 simulation ticks. The clock has no timer and never reads system time; it advances only through an `AdvanceTicks` or `AdvanceSeconds` command. Seconds commands include the existing explicit rounding mode. Snapshots are immutable and validated by Persistence, including safe-integer and overflow rules.

## Frame model

Frame definitions form an immutable, canonically sorted acyclic graph:

- `SystemInertial` is the single root.
- `BodyInertial` follows a Celestial runtime body origin.
- `BodyFixed` rotates with that body.
- `SurfaceLocal` is a geographic tangent frame anchored in body-fixed coordinates.
- `LocalPhysics` is an explicit derived simulation projection.
- `RenderRelative` is an explicit render projection and cannot be canonical world authority.

Every non-root definition has an explicit parent. Definitions are stable metadata; `FrameStateAtTime` holds the time-dependent absolute origin, orientation, origin velocity, and angular velocity. All IDs use the existing Persistence external-reference parser with the `frame:` namespace. Graphs reject duplicate IDs, unknown parents, invalid roots, cycles, and invalid render authority before creating a signature.

For a parent state and child-relative transform, composition is:

```text
o_child = o_parent + R_parent t
R_child = R_parent R_relative
v_child = v_parent + omega_parent x (R_parent t) + R_parent v_relative
omega_child = omega_parent + R_parent omega_relative
```

## Body-inertial and body-fixed conventions

Body-inertial origin and origin velocity come from the existing `CelestialRuntimeState`. Its axes remain aligned with system inertial, so its orientation is identity and angular velocity is zero.

Body-fixed V1 uses these explicit conventions:

- zero-tilt north pole is body-inertial `+Z`;
- axial tilt rotates about body-inertial `+X`;
- prime-meridian zero points toward body-fixed `+X`;
- prograde rotation is positive about the tilted north-pole axis;
- retrograde rotation is negative;
- orientation is `qTiltX * qSpinZ`;
- the spin phase is evaluated from an explicit `rotationEpoch` and wrapped with Euclidean modulo;
- angular velocity is the signed rotation rate along the tilted north-pole axis.

A body without an explicit Celestial rotation definition is unsupported in BodyFixed V1. No static or guessed rotation is invented.

## Geographic SurfaceLocalFrame

The spherical anchor is `(bodyId, latitudeRadians, longitudeRadians, altitudeMeters)`. Latitude includes both poles, longitude is canonicalized to `[-pi, pi)`, and body radius plus altitude must be positive. Terrain, ellipsoid, geoid, and tile height are not involved.

In body-fixed coordinates:

```text
Up    = (cos(latitude) cos(longitude), cos(latitude) sin(longitude), sin(latitude))
East  = (-sin(longitude), cos(longitude), 0)
North = (-sin(latitude) cos(longitude), -sin(latitude) sin(longitude), cos(latitude))
South = -North
```

The local axes are:

```text
+X East
+Y Up
+Z South
-Z North
```

This is a geographic tangent frame, not an actor-facing or camera-facing frame. Actor forward is represented by the actor's independent orientation relative to the frame. Creating or transforming that orientation never changes the surface anchor, surface basis, frame ID, or frame signature.

### Deterministic poles

The same closed-form equations are used at the north and south poles. The supplied canonical longitude explicitly selects East and the tangent meridian direction there. There is no cross-with-global-up fallback and no epsilon-dependent axis switch. Both poles therefore produce finite, deterministic bases that satisfy:

```text
East x Up = South
Up x South = East
South x East = Up
```

## Kinematic transforms

For local values in a frame whose system-inertial state is `(o, R, v_o, omega_f)`:

```text
p_abs = o + R p_local
v_abs = v_o + omega_f x (p_abs - o) + R v_local
q_abs = q_frame q_local
omega_abs = omega_f + R omega_local
```

The inverse subtracts target origin motion and `omega_f x radius` before applying the inverse rotation. Velocity conversion therefore requires the point position; simply rotating the relative velocity is incorrect. Direction rotates without translation. Pose and kinematic-state transforms preserve the actor's independent orientation and angular velocity.

## Gravity field

Gravity bindings are built from existing Celestial body definitions and runtime states. A field snapshot binds a sorted, duplicate-free source list to an explicit universe time and system-inertial frame. Each source acceleration is obtained from the existing Celestial gravity query; the adapter only sums returned acceleration vectors. Dominant-source selection calls the existing Celestial selector and is diagnostic only. It never changes spaces or bindings.

## Deterministic probe

The probe is translational test infrastructure for this spine. A step supplies its state, start and end frames, start gravity snapshot, and a positive fixed `dt`. The integer start/end tick span is authoritative. `dt` may be the canonical `deltaTicks / 120` value or the exact subtraction of the two explicit frame epochs when that subtraction remains within an epoch-scaled floating-point tolerance capped at 0.1% of the canonical span. Integration always uses the canonical tick-derived `dt`; materially imprecise epoch subtraction fails closed. Integration happens in system inertial with semi-implicit Euler:

```text
v_next = v_current + acceleration * dt
p_next = p_current + v_next * dt
```

The result is then expressed in the explicitly supplied end frame. There is no collision, atmosphere, thrust, active ship force, hidden clock, or implicit gravity refresh.

## Physics-space handoff

`SystemSpace`, `BodyLocalSpace`, and `SurfaceLocalSpace` descriptors bind stable `physics-space:` IDs to authoritative frame states. A handoff requires exact matching universe time and system root. It transforms the full local kinematic state through system inertial, reconstructs it from the target, and fails closed if position, velocity, orientation, or angular-velocity preservation exceeds tolerance.

The target frame ID changes explicitly. Values are not snapped, teleported, or zeroed. Source and target gravity-binding ID lists are explicit inputs and the result reports whether they differ; no dominant-source query changes them automatically.

## V1 tolerances

- quaternion norm and basis orthogonality: `1e-12`
- position: `1e-5 m + 2e-15` relative
- velocity: `1e-9 m/s + 2e-15` relative
- orientation angular error: `1e-10 rad`
- angular velocity: `1e-12 rad/s + 2e-15` relative
- universe time and epoch: exact equality

## Remaining non-goals

Ellipsoids, terrain/geoid height, plate tectonics, surface tiles, landing zones, player handoff, renderer integration, active flight, atmosphere, collision, thrust, automatic source switching, and normal game-loop clock wiring remain future work.
