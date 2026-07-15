# Design: Browser Shared Trajectory Predictor Core v1

## Context and ownership

The predictor is a new leaf capability under apps/weltraum-browser/src/trajectory. Existing core, persistence, spatial and celestial modules may be consumed through direct leaf imports, but no existing owner is modified. Navigation and flight are evidence-only dependencies and are never imported.

## Units and numeric model

All values use SI units: meter, second, meter/second, meter/second squared, kilogram and mu in meter cubed/second squared. TypeScript number is the storage and calculation type. Public boundaries, every integration stage and every serialized result reject NaN and Infinity. Negative zero is canonicalized to zero.

Universe time uses UNIVERSE_TICKS_PER_SECOND = 120 from persistence/time.ts. Epochs and boundaries are nonnegative safe integers. stepTicks and sampleEverySteps are positive safe integers. Delta seconds equals delta ticks divided by 120. Wall clock, Date.now, performance.now and random values are forbidden as domain inputs.

## Frames and source motion

FrameId comes from spatial/ids.ts. Unsupported initialState.frameId, gravitySource.frameId or segment frameId inputs reject as RejectedInvalidRequest. Hazards are interpreted in that same inertial frame: hazard-local invalid or non-allowlisted frame data is normalized by hazard-policy validation to RejectedHazardPolicy with InvalidHazard, while a mismatch between otherwise allowlisted inertial IDs rejects as RejectedFrameMismatch. RenderRelative and hidden floating-origin conversion are outside scope.

The request contains exactly one point-mass source with a positive finite mu, explicit position, velocity, frameId and epochTick. At any integration stage the source position is source.position + source.velocity * ((stageTick - source.epochTick) / 120). Its velocity is constant. The result records this inertial-linear-source approximation explicitly.

## Segment timeline

GravityCoast and ConstantInertialAcceleration occupy half-open intervals [startTick,endTick) with endTick greater than startTick. Their final state is at endTick. Continuous intervals begin at initialState.epochTick and cover the prediction horizon without gaps. The predictor never inserts an implicit coast.

ImpulseDeltaV is zero-duration at an exact tick, changes only velocity and preserves position and mass. At a shared boundary the preceding interval completes, the impulse is applied, and the following interval starts from the post-impulse state. An impulse may be first or last. Duplicate impulse ticks are rejected in v1 to avoid caller-order semantics.

Each segment has a unique stable segmentId. Caller order must already match start tick, boundary phase and lexical segmentId. The predictor validates rather than sorts an invalid segment timeline. Every continuous duration and impulse offset from initial epoch must align exactly to stepTicks; partial final steps are rejected as RejectedStepMismatch.

## Integrator policy

TrajectoryIntegratorPolicy is a required immutable object with an explicit policy for GravityCoast and ConstantInertialAcceleration. The exported default factory chooses VelocityVerlet for GravityCoast and RungeKutta4 for ConstantInertialAcceleration. Either continuous type may explicitly select SemiImplicitEuler, VelocityVerlet or RungeKutta4. Segment results expose the resolved policy. There is no automatic switching.

For state derivatives, position derivative is velocity and velocity derivative is point-mass gravity plus the segment's optional constant inertial acceleration.

- SemiImplicitEuler evaluates acceleration at the step start, updates velocity, then position.
- VelocityVerlet evaluates acceleration at start, advances position, evaluates at the exact step end, then averages accelerations for velocity.
- RungeKutta4 evaluates the coupled six-component state and source position at all four deterministic stages.

## Samples and event ordering

Samples are emitted for the initial state, each global completed step divisible by sampleEverySteps, every segment boundary, every impulse post-state and the final state. A sample carries tick, phase, global step ordinal and stable ordinal so pre/post-event values at one tick remain unambiguous. Equivalent cadence, boundary and final reasons for an identical state may collapse. ImpulsePostState is non-equivalent and always receives a separate sample, whether its delta changes velocity, is zero or is numerically ineffective.

Segment results follow validated request order. Hazard inputs are normalized lexically by hazardId. Hazard events sort by first-entry step start, entry fraction and hazardId. Closest approaches sort by minimum clearance/distance and then hazardId. All ties use lexical stable IDs.

## Hazards

SphericalTrajectoryHazard has a unique hazardId, finite center, positive radius and nonnegative safety margin. Effective radius is radius plus margin and must remain finite. Invalid or duplicate hazards reject as RejectedHazardPolicy.

Every completed integration step is tested as a closed line segment against every effective sphere. This detects tunneling between emitted samples. The deterministic quadratic/projection calculation reports first entry, minimum center distance, minimum clearance and exit when present. Event locations retain integer stepStartTick and stepEndTick plus a finite fraction in [0,1]. A tangent within toleranceProfile.hazardGeometryEpsilonMeters counts as one stable contact; its entry and exit location are equal. Starting inside reports entry at fraction zero.

The predictor reports facts only and never changes control state or chooses gameplay behavior.

## Tolerances and failures

ToleranceProfile is required and cloned. It contains finite nonnegative relative-energy, relative-angular-momentum, circularity, closure and hazard-geometry tolerances plus a positive minimumGravityDistanceMeters. No hidden machine epsilon changes policy.

Validation maps to explicit result statuses: Completed, RejectedInvalidRequest, RejectedFrameMismatch, RejectedSegmentOverlap, RejectedStepMismatch, RejectedNumericalFailure, RejectedHazardPolicy and RejectedBudgetExceeded. Frame and hazard-policy validation occurs before propagation; rejections include stable issue codes/paths and no partial prediction arrays, samples or results. Singular gravity distance, nonfinite intermediate values or impossible canonicalization reject as numerical failure. Inputs are never clamped or repaired.

## Budgets

The public v1 limits are 4,096 segments, 4,096 hazards, 250,000 integration steps and 50,000 emitted samples. Validation computes prospective step and sample counts before allocating result arrays or integrating. Overflow, unsafe arithmetic or limit excess rejects as RejectedBudgetExceeded.

## Metrics

Metrics use source-relative position and velocity. They report initial/final specific orbital energy, initial/final specific angular-momentum magnitude, relative energy drift, relative angular-momentum drift, maximum step seconds/ticks, total steps and samples. Relative denominators use an explicit finite tolerance floor.

Circular closure is applicable only to a pure GravityCoast request whose initial radial velocity and speed error satisfy the circularity tolerance and whose horizon equals the deterministically rounded circular period tick. Applicable results report relative-position closure distance and tolerance outcome; otherwise closure fields are null. No NaN or Infinity is serialized.

## Canonical result and immutability

The implementation reuses the persistence canonical serializer and FNV-1a signature through direct leaf imports. It does not use the five-decimal stableStringify helper. Canonical payload includes every semantic request/result field and approximation/tolerance metadata, excludes canonicalSignature itself and excludes all wall/performance timing. Object keys are canonicalized; semantically unordered hazards are ID-sorted.

Caller input is cloned before validation/processing. Completed and rejected results are recursively frozen, including nested arrays and vectors. Mutation attempts cannot alter the result or its signature.

## Dependency and scope constraints

Allowed implementation paths are the requested trajectory source, trajectory unit tests, one E2E file, two evidence files, one browser-mainline document and this change directory. No existing spatial, physics-space, celestial, persistence, navigation, flight, runtime, package, lock, main, style, GitHub, infra, roadmap, voxel, world-generation, surface-lab or planet file changes are permitted.

## Known v1 limitations

The integrated orbit is relative to one inertially linearly propagated source. Step sweeps use straight chords rather than analytic curved collision paths. No SOI changes, patched conics, N-body effects, atmosphere, fuel, changing mass, body-fixed thrust, autopilot, map, timewarp state machine, background-runtime owner or safety decision is included.

## Review decision: trajectory inertial frame allowlist

The shared spatial `FrameId` parser proves only the generic `frame:` namespace; it does not carry frame-kind metadata, and `createSystemInertialFrameId(suffix)` permits arbitrary suffixes. The standalone predictor therefore uses a conservative trajectory-local positive allowlist for v1: exactly `frame:system` and non-empty canonical `frame:body-inertial.*` IDs are accepted. Unsupported initial-state, gravity-source or segment frame inputs reject as `RejectedInvalidRequest`; hazard-local invalid or non-allowlisted frame data is normalized by hazard-policy validation to `RejectedHazardPolicy` with `InvalidHazard`; and mismatches between two otherwise allowlisted inertial IDs reject as `RejectedFrameMismatch`. Frame validation occurs before propagation and produces no partial samples or results. This intentionally limits v1 callers instead of importing a frame graph, changing the spatial owner or guessing inertial semantics. A future shared frame-kind contract may widen the accepted set under its own change.
