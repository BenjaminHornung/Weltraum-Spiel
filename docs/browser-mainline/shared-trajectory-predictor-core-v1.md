# Browser Shared Trajectory Predictor Core v1

## Decision and ownership boundary

`apps/weltraum-browser/src/trajectory/index.ts` is the public barrel for a pure TypeScript, renderer-independent trajectory predictor. It accepts one complete request and returns one immutable `Completed` or typed rejected result. The core reports prediction facts only; it does not issue flight commands, select gameplay behavior, render a path, or own runtime progression.

The trajectory package is a leaf capability. It reuses narrow persistence time/canonical helpers, spatial frame IDs and Celestial Hestia fixture data without changing those owners. Navigation, FlightController, autopilot, map, renderer, UI, world bootstrap, runtime and timewarp do not import or consume this V1 core.

## Public request and result contract

A `TrajectoryPredictionRequest` contains:

- a stable `trajectory:` prediction ID;
- an explicit initial state with frame ID, Universe tick, SI position, velocity and positive mass;
- exactly one finite point-mass gravity source with frame ID, source epoch, position, velocity and positive gravitational parameter `mu`;
- a caller-ordered segment timeline;
- a required integrator policy, fixed `stepTicks` and `sampleEverySteps` cadence;
- zero or more spherical hazards; and
- an explicit tolerance profile.

A completed result exposes the frame and tick range, the source approximation, resolved policy, tolerance profile, ordered segment results, deterministic samples, swept hazard events, closest approaches, numerical metrics and one canonical signature. A rejected result contains a typed status, stable issue code/path/message, the prediction ID when valid, the available budget estimate and its own canonical signature. Rejections never publish partial samples, segment results or hazard facts.

All public inputs are cloned before processing. Completed and rejected results, including nested arrays and vectors, are recursively frozen.

## SI units and the 120-tick model

All values use SI units: meters, seconds, meters per second, meters per second squared, kilograms and `mu` in meters cubed per second squared. TypeScript `number` is the calculation and storage type. Public values, integration stages, metrics and canonical output must remain finite; NaN and Infinity reject, and canonical serialization normalizes negative zero to zero.

Universe time uses the Persistence constant of exactly 120 ticks per game epoch second. Epochs and boundaries are nonnegative safe integers. `stepTicks` and `sampleEverySteps` are positive safe integers, and each fixed-step duration is `stepTicks / 120` seconds. Continuous durations and impulse offsets must align to the fixed tick grid. The predictor reads no wall clock, `Date.now`, `performance.now` or random value.

This 120 Hz contract does not change the current runtime loop cadence and does not wire the predictor into that loop.

## Conservative inertial-frame allowlist

V1 accepts only these trajectory-local inertial frame IDs:

- exactly `frame:system`; or
- a nonempty canonical `frame:body-inertial.*` ID such as `frame:body-inertial.planet.hestia`.

The initial state, gravity source, every segment and every hazard must use the same accepted frame. Unsupported initial-state, gravity-source or segment frame inputs are `RejectedInvalidRequest`. Hazard-local invalid or non-allowlisted frame data is normalized by hazard-policy validation to `RejectedHazardPolicy` with `InvalidHazard`. A mismatch between otherwise allowlisted inertial IDs is `RejectedFrameMismatch`. Frame validation occurs before propagation, so every rejection publishes no partial samples or segment results.

This positive allowlist is intentionally conservative because the shared `FrameId` parser proves identity syntax, not frame kind. V1 does not import a frame graph, infer inertial semantics or widen Spatial ownership.

## Dominant source and propagation approximation

Each request has exactly one point-mass gravity source. It is therefore the request's sole and dominant acceleration source; there is no source selection or switching. At every integrator stage its inertial position is propagated linearly:

```text
sourcePosition(stageTick) = sourcePosition(epochTick)
  + sourceVelocity * ((stageTick - sourceEpochTick) / 120)
```

Source velocity stays constant. The completed result records `InertialLinearPointMass`, the source epoch tick and the 120 Hz rate. This is not N-body gravity, an SOI model or an ephemeris refresh.

## Segment timeline and integrator policies

`GravityCoast` and `ConstantInertialAcceleration` occupy contiguous half-open intervals `[startTick, endTick)`. They must cover the requested horizon without gaps, overlaps or an implicit coast. Their final state is published at `endTick`.

`ImpulseDeltaV` is zero-duration at an exact aligned tick. It changes velocity only, preserving position, mass, frame and tick. At a shared boundary the preceding interval completes, the impulse is applied, and any following interval starts from the post-impulse state. Duplicate impulse ticks are rejected to avoid caller-order semantics.

Segment IDs are unique. Caller order must already match start tick, boundary phase and lexical segment ID; the validator does not repair or sort an invalid timeline.

The required policy names one integrator for each continuous kind. The default is:

| Segment | Default integrator |
| --- | --- |
| `GravityCoast` | `VelocityVerlet` |
| `ConstantInertialAcceleration` | `RungeKutta4` |

Either continuous kind may explicitly select `SemiImplicitEuler`, `VelocityVerlet` or `RungeKutta4`. Segment results expose the resolved integrator. There is no adaptive stepping or automatic policy switch.

- Semi-implicit Euler evaluates acceleration at the step start, updates velocity and then position.
- Velocity Verlet evaluates acceleration at the exact start and end and averages those accelerations for velocity.
- Runge-Kutta 4 evaluates the coupled position/velocity state and the linearly moving source at all four deterministic stages.

Constant inertial acceleration is added to point-mass gravity. It is not body-fixed thrust and does not consume fuel or change mass.

## Sampling and fixed budgets

Samples are emitted for the initial state, each global completed step divisible by `sampleEverySteps`, every segment boundary, every impulse post-state and the final state. Samples carry tick, phase, global step ordinal, stable ordinal and reasons. Equivalent cadence, boundary and final reasons for an identical state may collapse. `ImpulsePostState` is non-equivalent and always occupies a separate sample, whether its delta changes velocity, is zero or is numerically ineffective.

V1 preflights prospective counts before allocating result arrays or integrating:

| Resource | Maximum |
| --- | ---: |
| Segments | 4,096 |
| Hazards | 4,096 |
| Integration steps | 250,000 |
| Emitted samples | 50,000 |

Unsafe arithmetic, count overflow or a limit excess is `RejectedBudgetExceeded`. These are conservative standalone-core limits, not promises about runtime scheduling, background simulation throughput or player-visible horizon length.

## Swept spherical hazards and ordering

Each hazard has a unique stable ID, the common inertial frame, finite center, positive radius and nonnegative safety margin. Radius plus margin is the effective radius and must stay finite.

Every completed integration step is tested as a closed straight chord against every effective sphere. This catches tunneling between emitted samples. Facts include first entry, optional exit, minimum point, center distance, clearance, start-inside state and tangent state. Locations retain the integer step start/end ticks and a finite fraction in `[0,1]`. A tangent within the explicit geometry epsilon is one stable zero-duration contact; starting inside enters at fraction zero.

Hazard inputs are normalized lexically by hazard ID. Events order by entry step start tick, entry fraction and hazard ID. Closest approaches order by minimum clearance, center distance and hazard ID. Segment results retain validated request order. The predictor reports these facts but does not brake, divert, invalidate a plan or make a safety decision.

Straight-chord sweeps are conservative discrete-step geometry, not analytic curved collision paths.

## Metrics, canonical equality and immutability

Metrics are source-relative and include initial/final specific orbital energy, initial/final specific angular-momentum magnitude, relative energy and angular-momentum drift, maximum step ticks/seconds, total steps and total samples. Denominators use the explicit finite tolerance floor.

Circular closure is applicable only to a pure `GravityCoast` request whose initial radial velocity and speed satisfy the circularity tolerance and whose horizon is the deterministically rounded circular-period tick. Applicable results report closure distance and whether it is within the request tolerance; otherwise circular closure is `null`.

Canonicalization reuses the Persistence canonical serializer and FNV-1a signature through direct leaf imports. Object keys are lexical, negative zero is normalized, hazards are ID-sorted, wall/performance timing is absent, and `canonicalSignature` is excluded from its own payload. Equal semantic requests therefore produce equal frozen results and `fnv1a32:<8 lowercase hex>` signatures; hazard insertion order cannot change the canonical result.

Because the accepted request payload is signed, an exact-zero impulse and a nonzero but numerically ineffective impulse remain canonically distinguishable even when their propagated physical states are equal.

## Fail-closed rejection model

The public statuses are:

- `Completed`;
- `RejectedInvalidRequest`;
- `RejectedFrameMismatch`;
- `RejectedSegmentOverlap`;
- `RejectedStepMismatch`;
- `RejectedNumericalFailure`;
- `RejectedHazardPolicy`; and
- `RejectedBudgetExceeded`.

Stable issues identify invalid IDs, numbers, ticks, policies, segments, order, gaps, overlaps, duplicate IDs or impulse ticks, frame mismatches, hazards, tolerances, budgets, unsafe arithmetic and numerical failures. Singular gravity distance, nonfinite intermediate values and impossible canonicalization reject rather than clamp, repair or publish a partial trajectory.

## Browser verification evidence

The focused Playwright proof loads the normal `/` route in real Chromium, installs unfiltered console/page/request/HTTP collectors before navigation, proves `window.TestBridge` is absent and dynamically imports `/src/trajectory/index.ts` through Vite. It executes:

- a Hestia BodyInertial near-circular `GravityCoast` with default `VelocityVerlet` and circular closure;
- Hestia `ConstantInertialAcceleration` with default `RungeKutta4` followed by an exact `ImpulseDeltaV`;
- a one-step Hestia-frame chord that enters and exits a spherical hazard between endpoints; and
- the same acceleration/impulse request twice with identical complete canonical results and signatures.

Every scenario must be `Completed`, every published number must be finite, the result must remain frozen, and all four browser-health collections must remain empty before evidence is written.

- [Deterministic JSON evidence](../../apps/weltraum-browser/evidence/browser-shared-trajectory-predictor-core-v1-summary.json)
- [Readable Markdown evidence](../../apps/weltraum-browser/evidence/browser-shared-trajectory-predictor-core-v1.md)

Focused command from `apps/weltraum-browser`:

```powershell
npm run test:e2e -- tests/e2e/trajectory-predictor-core.spec.ts
```

The evidence is timestamp-free and contains no screenshot because this core has no visible representation.

## Explicit non-integration and non-goals

V1 does not implement or authorize:

- FlightController, navigation, autopilot, planner/executor, map, HUD, renderer or Three.js integration;
- runtime-loop ownership, timewarp state, background simulation, persistence wiring or multiplayer authority;
- SOI transitions, patched conics, maneuver nodes, gravity assists, N-body gravity or automatic source switching;
- atmosphere, drag, collision response, terrain, surface transfer or landing;
- fuel consumption, changing mass, engine constraints or body-fixed thrust;
- gameplay admission, hazard avoidance, replanning, encounter selection or safety decisions; or
- performance timing, adaptive integration or worker scheduling.

Those owners remain unchanged. Future integration requires its own contract and change rather than widening this standalone predictor implicitly.
