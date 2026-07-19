# Surface Local Frame Core V1

## Scope

`apps/weltraum-browser/src/surface-frame` is the browser-mainline pure domain seam for explicit local-frame projection on rotating oblate or spherical body surfaces. This change introduces a browser-visible proof that the module preserves absolute surface truth while changing local coordinates when reanchoring, without any runtime, renderer, or UI integration.

The public entry points are:

- `createSurfaceBodyShape(input)`
- `createSurfaceAnchor(input)`
- `createSurfaceLocalFrame(input)`
- `projectAbsoluteSurfaceState(input, frame)`
- `reanchorSurfaceLocalFrame(state, fromFrame, toFrame)`
- `restoreAbsoluteSurfaceState(state, frame)`
- `canonicalSerializeSurfaceLocalFrame(value)`
- `surfaceLocalFrameSignature(value)`
- `bodyFixedToSurfaceLocal(position, frame)`
- `surfaceLocalToBodyFixed(position, frame)`
- `transformDirectionBodyFixedToLocal(direction, frame)`
- `transformDirectionLocalToBodyFixed(direction, frame)`

## Migration And Authority Boundary

`src/surface-frame` is the versioned standalone V1 domain core and the future authority for surface-local-frame data. The existing `src/spatial/surfaceLocalFrame.ts` remains a legacy spatial integration contract; the two modules are not byte- or identity-interchangeable, and any file importing both must use explicit aliases. Migration into spatial/runtime ownership and all runtime integration are deferred and out of scope for V1.

## Contract In Brief

- The module uses explicit, validated authority identifiers and revisions for body, frame, anchor, and frame revision.
- Shapes are validated for finite positive radii with `semiMinorAxisMeters <= semiMajorAxisMeters`.
- Geodetic latitude and longitude are canonicalized with finite-number checks and an explicit non-convergence path.
- Public basis uses right-handed local axes `+X East`, `+Y Up`, `+Z South`.
- Projection and reanchor only change local coordinates while preserving absolute truth, semantic identity, and authority.
- Outputs are deeply frozen, finite, and deterministic; canonical serialization orders keys consistently.
- Public signatures are deterministic over canonical payload bytes and namespaced in the surface-frame schema.

## Canonical Geodetic Behavior

- At both exact geodetic poles (`latitudeRadians === +pi/2` or `-pi/2`), longitude is undefined geometrically and is therefore canonicalized to `0`. The derived body-fixed `x` and `y` components are also exactly `0`; inverse conversion of an on-axis polar position returns longitude `0`.
- Longitude is canonicalized to the half-open interval `[-pi, pi)`. Consequently `+pi` and every equivalent wrapped longitude serialize as `-pi`; negative zero is normalized to positive zero.

## Numerical Tolerances

- Oblate inverse geodetic conversion performs at most 16 iterations and requires angular convergence within `1e-13` radians.
- Its reconstructed Cartesian residual must be at most `max(1e-7 m, semiMajorAxisMeters * Number.EPSILON * 8)`; otherwise conversion fails explicitly with no spherical or last-value fallback.
- Focused round-trip coverage checks latitude and longitude to 12 decimal places, ellipsoidal height and reconstructed Cartesian position to 6 decimal places, ordinary local position to 8 decimal places, and direction to 11 decimal places.
- Absolute-state reanchor coverage checks restored body-fixed position to 7 decimal places and velocity/directions to 10 decimal places. The browser proof uses the explicit bounds `< 5e-8 m` for restored position error, `< 1e-9 m/s` for restored velocity error, `< 1e-12` sign-invariant quaternion magnitude for restored orientation, and `< 1e-12` vector magnitude for every restored named direction.

## Browser Protocol

`apps/weltraum-browser/tests/e2e/surface-local-frame-core.spec.ts` executes on normal `/`:

- Navigates to the exact normal route `/` without a query string, waits for the normal page scene, and verifies `window.TestBridge` is absent via both own-property and `"TestBridge" in window` checks; it also confirms no TestBridge text or debug HUD is visible.
- Dynamically imports exactly one application module, `/src/surface-frame/index.ts`, from browser page context. It does not import runtime, renderer, navigation, world, flight, or TestBridge modules.
- Builds one Hestia-like oblate ellipsoid shape and two distant anchors.
- Projects `Player`, `Ship`, and `Drone` absolute states into Frame Alpha.
- Reanchors to Frame Beta and restores back to absolute.
- Asserts each entity's local position, velocity, and optional orientation changed under reanchor, while restored absolute body-fixed position remains within `< 5e-8 m` error, restored absolute body-fixed velocity remains within `< 1e-9 m/s` error, and restored optional orientation remains within `< 1e-12` sign-invariant quaternion magnitude.
- Verifies the named directions `forward`, `up`, `starboard`, and `down` remain present through projection, reanchor, and restore, preserve their IDs, contain only finite components, and restore within `< 1e-12` vector magnitude.
- Proves deterministic behavior by running the full scenario twice and comparing canonical payload/signature values.
- Requires zero console errors, page errors, failed requests, and HTTP error responses, then writes deterministic JSON and Markdown evidence with no timestamp or random input.

No UI interactions, no screenshots, no runtime module imports, and no TestBridge query are used.

## Evidence

The focused Playwright proof writes:

- `apps/weltraum-browser/evidence/browser-surface-local-frame-core-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-surface-local-frame-core-v1.md`

Focused verification command:

```text
npx playwright test tests/e2e/surface-local-frame-core.spec.ts --workers=1
```

## Non-Goals

- Runtime, runtime-owned navigation, flight, world, floating-origin, renderer, Three.js, graphics, or persistence integration.
- TestBridge query routing, synthetic fixtures, or synthetic scene assertions.
- UI behavior changes, screenshots, or visual regression baselines.
- Any deterministic-free behavior (timestamps, wall-clock, or randomness).
