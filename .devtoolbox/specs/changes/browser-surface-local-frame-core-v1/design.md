# Design

## Boundary

`src/surface-frame` is a standalone pure domain module. It may use TypeScript/JavaScript arithmetic and Web-standard deterministic primitives, but it does not import runtime, renderer, flight, world-streaming, Hestia/Voxel, DOM, Three.js, or TestBridge modules. `index.ts` is the only browser-proof import surface.

### Migration and coexistence

`src/surface-frame` is the versioned standalone V1 domain core and future authority. Existing `src/spatial/surfaceLocalFrame.ts` remains a legacy spatial integration contract and is neither byte- nor identity-interchangeable with V1. Any consumer importing both contracts must apply explicit aliases. Migration into spatial/runtime ownership and runtime integration are deferred and out of scope for this change.

## Shape and geodetic model

A sphere is represented explicitly with equal semi-major and semi-minor radii. An ellipsoid is rotationally symmetric and oblate (`a >= b > 0`). Geodetic conversion uses standard ECEF/body-fixed formulas with first eccentricity squared `e² = 1 - b²/a²`.

Forward conversion uses prime-vertical radius `N = a / sqrt(1 - e² sin²φ)`. Inverse conversion uses a fixed bounded iteration with explicit angular/residual tolerances. The polar axis has a dedicated branch because longitude is undefined there; canonical longitude is zero only when both horizontal Cartesian components are exactly zero. Non-finite, center/undefined, or non-convergent inputs reject.

Canonical longitude is in `[-π, π)`, making `+π` serialize as `-π`. Latitude is bounded by `[-π/2, +π/2]`.

## Right-handed basis

For geodetic latitude `φ` and longitude `λ`:

- `east = (-sin λ, cos λ, 0)`
- `up = (cos φ cos λ, cos φ sin λ, sin φ)`
- `south = east × up`

Basis columns are local X/Y/Z expressed in body-fixed coordinates. Therefore local-to-body-fixed is a basis-column combination; body-fixed-to-local is the transpose/dot products. North-forward is local `(0,0,-1)`. The basis determinant is positive one. If an orientation quaternion is exposed, it is derived from this proper rotation matrix with a deterministic sign canonicalization.

## Authority and frame identity

Anchors carry Body ID, Body-fixed Frame ID, Anchor ID, and revision. Frames additionally carry Surface Frame ID and Frame Revision. Constructors reject empty identifiers, invalid integer revisions, and mismatched anchor/frame/body authority. Optional caller time context remains opaque immutable data and is never generated internally.

## Projection and reanchor

Absolute body-fixed state remains truth. A local state stores projected position and velocity plus semantic state identity and the frame authority required to restore it. Reanchor performs restore/validate against the old frame and projection into the new frame; no component is snapped or zeroed.

## Immutability

Constructors clone all caller-owned objects/arrays and recursively freeze every public result. Validation normalizes `-0` to `0` and rejects any non-finite number before outputs are built.

## Canonical bytes and signatures

SurfaceLocalFrame owns an explicit canonical serializer rather than using the existing five-decimal plan hash. The serializer recursively emits primitives, arrays, and object keys in lexical order; rejects unsupported values/cycles/non-finite numbers; and normalizes negative zero. Numbers use ECMAScript's deterministic shortest round-trippable decimal representation. Public signed payloads include schema and version. Signature uses a deterministic FNV-1a 32-bit hexadecimal digest over UTF-8 canonical bytes, namespaced with the SurfaceLocalFrame schema/version. This is an identity/checksum contract, not a cryptographic signature.

## Tolerances

Implementation tests and documentation will state measured tolerances separately for geodetic angular/height round trip, Cartesian position round trip, local position, and direction. Tolerances must remain small enough to distinguish meter/sub-meter local deltas at Hestia-like radii. Failures are explicit rather than silently relaxing tolerances.

## Alternatives rejected

- Reusing identity-only `world/frames.ts`: cannot represent tangent orientation and is outside write scope.
- Reusing flight quaternion helpers: creates an unwanted Flight dependency and is outside write scope.
- Reusing five-decimal shared hashing: loses precision relevant to anchors and persistence.
- `X East, Y Up, Z North`: improper/left-handed basis and cannot be represented by a normal quaternion.
- Runtime-global celestial lookup: violates explicit authority and deterministic testing.
