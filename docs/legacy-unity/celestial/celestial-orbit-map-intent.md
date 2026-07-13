# Celestial Orbit and Map Intent

## Purpose

This document preserves celestial-system and orbit-map behavior intent for a
browser-native data/simulation slice. Three.js objects and map glyphs are
rendered projections, never celestial truth.

## Behavior to preserve

- Celestial bodies use stable IDs, display metadata, type, parent ID, real
  radius/mass, gravitational parameter, orbit definition and visual-scale
  profile.
- Absolute state carries reference-frame ID, double-precision position and
  velocity in SI units, plus epoch seconds.
- Orbit definitions carry parent body, semi-major axis, eccentricity,
  inclination, ascending-node longitude, periapsis argument, mean anomaly at
  epoch and epoch time.
- The current preserved analytical intent covers bound elliptical orbits
  (`0 <= eccentricity < 1`) around a parent with positive gravitational
  parameter. Unsupported orbit classes must be explicit future work.
- Kepler state evaluation returns relative position and velocity at a requested
  epoch. Parent state composition produces absolute state.
- Orbit-map snapshots contain real-unit state and separately scaled map
  coordinates. Exaggerated body radii or map scale never alter physics values.
- Orbit-line sampling is derived presentation data from the same analytical
  definition and epoch, not a second orbit model.
- Registry/catalog validation rejects missing IDs, duplicate IDs, missing
  parents, cycles and invalid numeric/orbit/gravity values.

## State and diagnostics

Snapshots should expose catalog/source version, epoch, body ID/type/parent,
real radius, gravitational parameter, relative and absolute state, visual map
scale and sampled-orbit provenance. Failures should return structured body ID,
field and reason rather than silently substituting zero/root state.

## Failure cases

- Non-positive parent `mu` or semi-major axis fails evaluation.
- NaN/infinite values and eccentricity outside the supported range fail closed.
- Unknown parent, parent cycle or unresolved reference frame invalidates the
  affected snapshot.
- Solver non-convergence returns a failure; it cannot reuse stale renderer
  positions.
- Invalid sample count or period yields no orbit line and a diagnostic while
  preserving valid body state where possible.
- Floating-origin or visual-scale changes cannot mutate absolute state.

## Acceptance ideas

- Known circular and eccentric cases match reference position, velocity and
  period within declared tolerances.
- Identical catalog/epoch inputs yield identical snapshots and samples.
- Parent-child composition preserves relative and absolute states.
- Catalog tests reject duplicates, missing parents and cycles with stable
  reasons.
- Map scaling changes only map coordinates and apparent radii, never SI state.
- Large-coordinate tests retain useful precision through camera-origin shifts.

## Legacy evidence sources

- `Assets/Scripts/Prototype/Celestial/CelestialRuntimeData.cs`
- `Assets/Scripts/Prototype/Celestial/CelestialOrbitSolver.cs`
- `Assets/Scripts/Prototype/Celestial/CelestialOrbitMapSnapshotBuilder.cs`
- `Assets/Scripts/Prototype/Celestial/CelestialBodyCatalog.cs`
- `Assets/Scripts/Prototype/Celestial/CelestialBodyRegistry.cs`
