# Browser Spatial Physics Spine V1 Specification

## Determinism and time

The system SHALL reuse Persistence universe-time, ID, canonicalization, signature, and validation APIs. It SHALL expose an explicit 120 Hz runtime clock with immutable snapshots, safe arithmetic, explicit second rounding, and no wall-clock access. GIVEN the same initial time and command sequence, WHEN commands are applied, THEN the final canonical snapshot SHALL be byte-identical.

## Frame graph

Frame definitions SHALL have stable ASCII IDs, explicit parents except one system root, immutable sorted storage, and an input-order-independent signature. Unknown parents, duplicates, multiple/missing roots, cycles, and canonical `RenderRelative` authority SHALL fail closed in the documented error order. Frame definitions SHALL remain separate from time-dependent states.

## Spatial math

Vectors and quaternions SHALL contain finite values and SHALL not use Three.js or DOM types. Quaternions SHALL be normalized without a zero fallback and SHALL have deterministic sign. Inputs SHALL not be mutated; outputs SHALL be immutable and normalize negative zero.

## Body frames

Body-inertial states SHALL follow existing Celestial runtime position and velocity with inertial identity orientation. Body-fixed states SHALL use the documented +Z north, +X tilt axis, +X prime meridian, signed prograde/retrograde rotation, explicit epoch, Euclidean angle wrapping, and explicit angular velocity. Missing rotation SHALL be rejected as unsupported.

## Geographic surface frames

A spherical surface frame SHALL use `+X East`, `+Y Up`, `+Z South`, with North at `-Z`. It SHALL be geographic rather than actor- or camera-facing. Actor orientation SHALL remain an independent pose relative to that frame. Longitude SHALL deterministically define tangent directions at both poles. At every valid anchor, including both poles, the orthonormal basis SHALL satisfy `East x Up = South`, `Up x South = East`, and `South x East = Up` without NaN.

## Transformations

Connected frames SHALL transform positions, directions, orientations, linear velocity, and angular velocity through system inertial. Linear velocity SHALL include frame-origin velocity and `omega x radius`. Forward/inverse roundtrips SHALL remain within the documented tolerances, preserve actor orientation, and never snap or zero values.

## Gravity and probes

Gravity SHALL delegate each source query and dominant-source diagnostic to existing Celestial APIs. Snapshots SHALL bind explicit source states, time, and system frame. A fixed-step translational probe SHALL use positive 120 Hz tick spans and documented semi-implicit Euler in inertial space. The integer tick span SHALL be authoritative; canonical tick-derived `dt` and sufficiently precise explicit frame-epoch subtraction SHALL produce the same canonical result, while materially imprecise epoch subtraction SHALL fail closed. Invalid `dt`, non-finite inputs, time mismatches, collision, atmosphere, thrust, and hidden source updates SHALL be rejected or excluded.

## Physics-space handoff

Handoffs among system, body-local, and surface-local spaces SHALL require exact matching source/target epochs and explicit frames. Absolute position, velocity, orientation, and angular velocity SHALL be preserved within tolerance and verified by reconstruction. The frame ID SHALL change explicitly. Gravity-binding changes SHALL only occur when present in the explicit result; dominant-source queries SHALL not trigger handoffs.

## Browser proof

The Playwright test SHALL load `/`, prove `window.TestBridge` is absent, import both public barrels through Vite, run clock/body/surface/transform/gravity/probe/handoff behavior twice, assert canonical equality and tolerances, and reject console, page, request, and HTTP failures. It SHALL produce timestamp-free JSON and Markdown evidence and no screenshot.
