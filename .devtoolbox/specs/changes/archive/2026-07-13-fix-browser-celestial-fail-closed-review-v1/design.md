# Design

## Stable derived-value validation

The existing `requireFiniteNumber` and `requireFiniteVec3` validators remain the
single error boundary for calculated values. Derived scalar and vector outputs
are validated immediately after calculation and before freezing or publication.
An overflow therefore throws `CelestialError` with code `InvalidNumber` instead
of returning a partially valid result.

Gravity validates the point-query magnitude and acceleration vector, plus the
two public scalar helpers. Kepler validates mean motion, period, rotated position,
and rotated velocity. Inputs remain unbounded finite SI values; unsupported
numeric ranges fail instead of being clamped.

## Dense catalog boundary

`createCelestialCatalog` checks every body-array index with an own-property test
before `map` and `sort`. A hole fails deterministically with `InvalidCatalog` at
the first missing `/bodies/<index>` path.

## Browser noise parity

The normal-route E2E response listener applies the same exact known-noise rule as
the console listener: only a 404 whose parsed pathname is `/favicon.ico` is
ignored and recorded. Every other HTTP response at status 400 or above remains a
test failure.

## Safe stop

Stop if the fix requires changing public types, catalog values, dependencies, or
runtime behavior beyond rejecting invalid derived results.
