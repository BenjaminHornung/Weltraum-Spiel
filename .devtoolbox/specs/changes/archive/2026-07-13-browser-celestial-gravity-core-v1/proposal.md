# Proposal: Browser Celestial Gravity Core v1

## Goal

Create a browser-native, deterministic and immutable domain core for canonical celestial definitions, the documented Aurelia starter catalog, analytical Kepler ephemerides, hierarchical runtime states and point-mass gravity.

## Motivation

The browser mainline already has deterministic hashing, absolute/local frame foundations and world-streaming contracts, but it has no executable celestial truth. Future system-map, predictor, SOI, timewarp and orbital-navigation work must not invent separate body values or derive physics from render scale.

This change implements the bounded foundations represented by living-plan items `P03.03.02`, `P03.03.03` and `P04.01.01` through `P04.01.03` without integrating them into flight, navigation, rendering or the normal runtime.

## Scope

- Stable ASCII IDs and explicit schema version 1 for catalog and nested definitions.
- Immutable definitions for bodies, orbit, rotation, gravity, atmosphere, visual scale, surface access and gameplay access.
- One canonical Aurelia catalog containing only documented and physically sufficient bodies:
  - `star.aurelia`
  - all seven documented planets
  - all four documented Hestia moons
  - the documented Eber, Kallisto and Minoa asteroids
- Canonical ordering, ID/parent/type indexes, byte-stable canonical JSON and a stable signature.
- Deterministic validation of physical scalars, schema versions, parent/orbit relationships and cycles.
- Analytical circular and bound-elliptic Kepler propagation with explicit convergence failure.
- Parent-relative and absolute, time-stamped runtime states with explicit frames.
- Pure point-mass gravity acceleration, dominant-source selection, surface gravity and escape velocity.
- Focused Vitest coverage and a normal-route Vite/Playwright import test that writes task-owned JSON and Markdown evidence.

## Non-goals

- No System Map, planet renderer, HUD, CSS, scene or visual integration.
- No changes under `Assets/**` and no Unity launch or Unity verification.
- No package or lockfile changes.
- No active gravity force on ships, drones or runtime entities.
- No FlightController, Planner, Executor, Autopilot or normal-runtime integration.
- No N-body integration, SOI switching, Patched Conics, trajectory planning, timewarp or route generation.
- No stations: the concept names stations but does not provide complete physical/orbital definitions.
- No unnamed or only generally mentioned outer-planet moons.
- No invented planet, moon, asteroid, station or body-specific physics values.
- No screenshots or artificial UI; this slice has no visual contract.

## Success criteria

- Equivalent catalog input order produces identical canonical JSON and signature.
- Future schema versions, malformed values, duplicate IDs, unknown parents and parent cycles fail closed with stable codes.
- Circular and bound-elliptic states include analytical position and velocity in SI units.
- Parent/child states compose without local-projection or render-scale leakage.
- Gravity uses only physical `mu`, physical radius and absolute positions.
- Equal dominant-source acceleration resolves by stable body ID.
- Public catalog, index, ephemeris and gravity results are deeply immutable.
- Focused unit tests, focused browser evidence, full unit suite, build and full E2E suite pass.
