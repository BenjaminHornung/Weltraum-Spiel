# SurfaceLocalFrame Core V1 Capability

## Coordinate contract

The public versioned local frame SHALL be right-handed and Y-up: `+X East`, `+Y Up`, `+Z South`; `East × Up = South`; north-forward SHALL be `(0, 0, -1)`. Public basis and orientation outputs SHALL be finite, orthonormal, and proper rotations.

## Authority contract

Every frame SHALL consume explicit validated Body ID, Body-fixed Frame ID, Surface Frame ID, Frame Revision, Body Ellipsoid, Anchor, and any caller-supplied tick/time or body-fixed pose required for a transform. The core SHALL NOT derive ephemeris, read runtime globals, or silently substitute authority.

Authority ID/revision mismatches SHALL fail closed.

## Migration and coexistence contract

`src/surface-frame` SHALL be the versioned standalone V1 domain core and future authority for surface-local-frame data. Existing `src/spatial/surfaceLocalFrame.ts` SHALL remain a legacy spatial integration contract for this change. The contracts SHALL NOT be treated as byte- or identity-interchangeable, and consumers importing both SHALL use explicit aliases. Migration and runtime integration SHALL remain deferred and out of scope.

## Shape and anchor requirements

`createSurfaceBodyShape` SHALL support spheres and rotationally symmetric oblate ellipsoids with finite positive semi-major/semi-minor radii in meters. Invalid, degenerate, or prolate inputs SHALL be rejected without fallback.

`createSurfaceAnchor` SHALL validate geodetic latitude, longitude, ellipsoidal height, Body ID, Body-fixed Frame ID, stable Anchor ID, and Revision. It SHALL return canonical geodetic values plus derived body-fixed Cartesian position and the right-handed East/Up/South basis.

Poles and antimeridian SHALL have explicit deterministic behavior. Longitudes SHALL be canonicalized consistently.

## Transform requirements

The public API SHALL include at least:

- `createSurfaceBodyShape`
- `createSurfaceAnchor`
- `createSurfaceLocalFrame`
- `geodeticToBodyFixed`
- `bodyFixedToGeodetic`
- `bodyFixedToSurfaceLocal`
- `surfaceLocalToBodyFixed`
- `transformDirectionBodyFixedToLocal`
- `transformDirectionLocalToBodyFixed`
- `reanchorSurfaceLocalFrame`
- `projectAbsoluteSurfaceState`
- `restoreAbsoluteSurfaceState`
- canonical serialization and signature functions

Position transforms SHALL apply anchor translation and basis rotation. Direction/velocity transforms SHALL apply rotation only. Bidirectional operations SHALL round-trip within documented tolerances.

The geodetic inverse SHALL use a deterministic fixed maximum iteration count and explicit convergence tolerance. Non-convergence SHALL be rejected; there SHALL be no silent spherical or last-value fallback.

## Floating-origin requirements

Reanchoring SHALL preserve absolute body-fixed position, absolute body-fixed velocity, body/frame authority, and semantic target/site identity. It SHALL change only the local projection. It SHALL NOT snap position, zero velocity, or silently replan.

Projection/restore SHALL validate frame authority and preserve absolute state within documented tolerances.

## Determinism and immutability requirements

No public result SHALL contain NaN, Infinity, or negative zero. Caller inputs SHALL remain unchanged. Public result graphs SHALL be frozen.

Canonical serialization SHALL have an explicit schema/version, stable key/array order, and deterministic finite-number representation. Equal inputs SHALL produce byte-identical serialization and signatures. Relevant unequal inputs SHALL not be collapsed by coarse numeric rounding.

The module SHALL have no Date, Random, DOM, Three.js, runtime-global, or TestBridge dependency.

## Required scenarios

Tests SHALL cover sphere and ellipsoid; equator; both poles; antimeridian; negative/positive height; handedness; basis orthogonality; position and direction round trips; velocity projection; reanchor invariance; equal-input signature equality; input immutability; frozen results; invalid shape/anchor rejection; large planetary radii with small local deltas; and browser-repeat byte identity.

The browser proof SHALL use the normal route, assert TestBridge absent, dynamically import only `/src/surface-frame/index.ts`, project Player/Ship/Drone absolute body-fixed states between two distant anchors on a Hestia-like shape, and prove absolute state/identity invariance with changed local coordinates. It SHALL create no UI or screenshots.
