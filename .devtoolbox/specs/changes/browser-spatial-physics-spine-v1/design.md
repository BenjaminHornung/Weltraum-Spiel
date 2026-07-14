# ExecPlan: Browser Spatial Physics Spine V1

## Goal

Implement a deterministic browser-domain spine whose canonical state never depends on rendering, floating origin, visual scale, wall-clock time, or implicit source changes.

## Context

The new public barrels are `apps/weltraum-browser/src/spatial/index.ts` and `apps/weltraum-browser/src/physics-space/index.ts`. Existing Persistence APIs own universe-time, stable external IDs, canonical serialization, hashing, and validation primitives. Existing Celestial APIs own body catalogs, ephemerides, gravity-source creation, acceleration queries, and dominant-source selection. They are consumed, never copied or modified.

DevToolbox preparation of the isolated worktree returned `unauthorized_path`. No override is used and task completion is not toggled manually.

## Non-goals

Renderer, Three.js, DOM, terrain, voxels, atmosphere, collision, thrusters, active spacecraft, actor/camera facing, game-loop integration, navigation, executor, autopilot, hidden time, snaps, velocity zeroing, and source switching are excluded.

## Architecture decision

### Time and epochs

`RuntimeUniverseClock` wraps the existing Persistence `UniverseTime` and 120 Hz conversions. It changes only through explicit tick/second commands, returns immutable cloned snapshots, preserves safe-integer checks and explicit rounding modes, and never reads a system clock. Frame states, gravity snapshots, probe steps, and handoffs require exact matching universe times; epochs are not tolerance-compared.

### Math and canonical values

Spatial vectors and quaternions are renderer-free plain values. Constructors reject non-finite components. Quaternion construction rejects zero length, normalizes, and chooses a deterministic sign. Negative zero is normalized. Caller values are cloned before canonical deep-freezing. Stable JSON and signatures delegate to Persistence canonical APIs.

### Frame hierarchy

Every definition has a stable `frame:` ID and explicit parent ID except the single `SystemInertial` root. Definitions are separated from time-dependent states. Construction validates shape, IDs, duplicates, parents, root/kind rules, cycles, and authority, then stores code-unit-sorted immutable definitions and an input-order-independent signature. `RenderRelative` and `LocalPhysics` are derived projections; `RenderRelative` can never be canonical world authority.

A child-relative transform stores translation, orientation, origin velocity, and angular velocity expressed in its parent. Absolute composition is:

```text
o_child = o_parent + R_parent t
R_child = R_parent R_relative
v_child = v_parent + omega_parent x (R_parent t) + R_parent v_relative
omega_child = omega_parent + R_parent omega_relative
```

### Position, velocity, orientation, and angular velocity

For a frame with absolute origin `o`, orientation `R`, origin velocity `v_o`, and angular velocity `omega_f`:

```text
p_abs = o + R p_local
v_abs = v_o + omega_f x (p_abs - o) + R v_local
q_abs = q_frame q_local
omega_abs = omega_f + R omega_local
```

The inverse subtracts target origin motion and target rotational motion before inverse rotation. Linear velocity conversion therefore always takes the point position. Direction rotates only. Full pose/velocity conversion preserves independent actor orientation; no transform aligns it to a surface or camera.

### Body frames

`BodyInertial` follows the Celestial runtime state's canonical absolute origin and velocity, has identity orientation and zero angular velocity. Parent-relative runtime values are used for graph composition and cross-checked against absolute values.

`BodyFixed` shares the body-inertial origin. V1 treats zero-tilt north as body-inertial +Z, axial tilt as rotation about +X, and prime-meridian zero as +X. Orientation is `qTiltX * qSpinZ`; prograde spin is positive about the tilted +Z pole and retrograde spin is negative. Spin angle uses the explicit rotation epoch, prime-meridian angle, signed `2 pi / period`, and Euclidean modulo. Angular velocity is the signed rate along the tilted pole. Missing rotation is unsupported and fails closed.

### Geographic SurfaceLocalFrame

V1 supports spherical anchors `(bodyId, latitude, longitude, altitude)`. Latitude is in `[-pi/2, pi/2]`, longitude is canonicalized to `[-pi, pi)`, and radius plus altitude must be positive. In body-fixed coordinates:

```text
Up    = (cos(lat) cos(lon), cos(lat) sin(lon), sin(lat))
East  = (-sin(lon), cos(lon), 0)
North = (-sin(lat) cos(lon), -sin(lat) sin(lon), cos(lat))
South = -North
```

Local axes are `+X East`, `+Y Up`, `+Z South`; geographic North is `-Z`. This is a geographic tangent frame, never actor-facing or camera-facing. Longitude explicitly selects East and North/South at both poles, so no near-pole cross-product fallback or NaN-producing branch exists. Required handedness is `East x Up = South`, `Up x South = East`, and `South x East = Up`.

### Gravity

`GravitySourceBinding` is created from existing Celestial body/runtime data. `GravityFieldSnapshot` binds sorted, duplicate-free sources to an explicit time and system frame. Queries transform the point to system inertial, call the existing Celestial acceleration API for every source, sum returned acceleration vectors, and may call the existing dominant-source selector for diagnostics. Frames and visual scale cannot change physical acceleration.

### Probe integration

The V1 probe is translational only. Each step supplies state, positive fixed `dt`, matching start/end universe times and frame states, plus explicit gravity sources. The positive safe-integer start/end tick span is authoritative. `dt` is accepted when it is the canonical `deltaTicks / 120` value or exactly the explicit frame-epoch subtraction within an eight-ULP epoch-scaled tolerance capped at 0.1% of the canonical span. The integrator always uses the canonical tick-derived value, and materially imprecise epoch subtraction fails closed. It evaluates acceleration in canonical inertial space and applies semi-implicit Euler: `v1 = v0 + a dt`, then `p1 = p0 + v1 dt`; the result is converted to the explicitly supplied end frame. No force, collision, atmosphere, or hidden source update is allowed.

### Physics-space handoff

Spaces have stable `physics-space:` IDs and explicitly bind `SystemSpace`, `BodyLocalSpace`, or `SurfaceLocalSpace` to authoritative frames. A request supplies source/target descriptors, exact common time, full local pose/velocities, explicit tolerances, and source/target gravity binding IDs. The handoff transforms through system inertial, reconstructs the target state back to absolute, and fails closed if position, velocity, orientation, or angular-velocity error exceeds tolerance. It never snaps, teleports, zeros values, or implicitly changes gravity bindings; the result explicitly reports any requested binding-set change.

### Numerical tolerances

- quaternion norm and basis orthogonality: `1e-12`
- position: `1e-5 m + 2e-15 * scale`
- velocity: `1e-9 m/s + 2e-15 * scale`
- orientation angular error: `1e-10 rad`
- angular velocity: `1e-12 rad/s + 2e-15 * scale`
- time/epoch: exact

### Error order

Fail fast in this order: input shape; stable IDs; duplicate IDs; parent existence; root/kind rules; cycles/authority; time compatibility; finite math; overflow/tolerance; canonical serialization/signature.

## Implementation phases

1. Add spec artifacts and public time/math/canonical contracts.
2. Add frame validation/graph, body frames, geographic surface frames, and transforms.
3. Add gravity adapter, probe integrator, and checked space handoff.
4. Add focused unit tests and architecture audits.
5. Add real-browser test, deterministic evidence, and public documentation.
6. Run focused and full regression, scope audit, commit, and push.

## Tests and evidence

Unit tests cover the 24 mandatory cases, clock determinism, polar handedness, and actor-orientation independence. Playwright loads `/`, excludes `window.TestBridge`, imports both source barrels through Vite, executes the complete scenario twice, compares canonical outputs, checks numerical tolerances, and rejects console/page/request/HTTP errors. Evidence is written to the two allowed `browser-spatial-physics-spine-v1*` files without timestamps or screenshots.

## Risks

Quaternion composition order, rotating-frame origin velocity, polar conventions, runtime/epoch mismatch, and canonical sign ambiguity can silently corrupt roundtrips. Tests therefore assert formulas directly, both inverse directions, exact time checks, and byte equality.

## Rollback / safe stop

All mutations are restricted to the task allowlist in the isolated feature worktree. Stop on required changes outside that allowlist, incompatible existing public contracts, DevToolbox scope expansion, or unexplained regression. No other worktree is touched.

## Progress log

- [ ] Phase 1: contracts and specification
- [ ] Phase 2: spatial frame implementation
- [ ] Phase 3: physics-space implementation
- [ ] Phase 4: unit verification
- [ ] Phase 5: browser evidence and documentation
- [ ] Phase 6: full regression, audit, commit, and push

## Definition of Done

All requested public APIs and tests exist; focused and full TypeScript, Vitest, Vite build, and Playwright verification pass; deterministic evidence is current; diff/scope audits are clean; no forbidden path changed; the feature branch is committed and pushed without PR or merge.
