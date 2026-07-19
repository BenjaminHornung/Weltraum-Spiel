# SurfaceLocalFrame Core V1

## Motivation

The browser mainline needs a pure deterministic surface-coordinate domain contract before first-person control, player/ship/drone handoff, surface targets, terrain/site coordinates, persistence, or planetary floating origin can be implemented safely. The existing spatial surface-frame contract is coupled to spatial frame-graph, celestial, and universe-time integration and cannot serve as the standalone versioned future authority.

## Outcome

Provide a versioned SurfaceLocalFrame V1 module that converts between explicit body-fixed authority data and a right-handed local tangent frame, projects/restores absolute surface state, reanchors without changing absolute truth, and emits canonical deterministic serialization/signatures.

`src/surface-frame` is the versioned standalone V1 domain core and future authority. Existing `src/spatial/surfaceLocalFrame.ts` remains a legacy spatial integration contract; it is not byte- or identity-interchangeable with V1, simultaneous imports require explicit aliases, and migration/runtime integration is deferred and out of scope.

## Scope

- Spherical and rotationally symmetric oblate ellipsoids in SI meters.
- Canonical geodetic anchors with derived body-fixed position and orthonormal basis.
- Public axes: `+X East`, `+Y Up`, `+Z South`; north-forward is `(0, 0, -1)`.
- Explicit body/frame IDs, revisions, shape, anchor, and caller-supplied authority context.
- Pure transforms, reanchoring, absolute-state projection/restore, canonical serialization/signatures.
- Focused unit coverage, a normal-route dynamic-import browser proof, deterministic JSON/Markdown evidence, and public documentation.

## Non-goals

- No runtime, renderer, controller, physics, Celestial, World/Streaming, Flight, Hestia/Voxel, terrain, or persistence-system integration.
- No ephemeris computation, runtime globals, Date, Random, DOM, Three.js, TestBridge, UI, or screenshots.
- No package, lockfile, config, or CI changes. The focused E2E is executed directly; assigning it to a package E2E group is deferred to a later mainline integration change.
- No PR, merge, or DevToolbox archive.
