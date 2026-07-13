# Fix Browser Celestial Fail-Closed Review v1

## Why

The merged browser celestial core promises stable `CelestialError` failures and
never publishing `NaN` or `Infinity`. Automated review found three malformed but
finite input paths that can violate that contract, plus one browser-test noise
filter that handles the known favicon 404 inconsistently.

## What Changes

- Reject non-finite derived gravity magnitudes, vectors, surface gravity, and
  escape velocity.
- Reject non-finite Kepler mean motion, period, position, and velocity results.
- Reject sparse catalog body arrays before mapping or sorting them.
- Apply the existing `/favicon.ico` 404 exception to HTTP response collection.
- Add focused regression coverage for every review finding.

## Non-Goals

- No clamping or arbitrary maximum celestial radius, mass, or `mu`.
- No catalog data, renderer, UI, runtime, navigation, flight, or Unity changes.
- No dependency, package, lockfile, workflow, or browser configuration changes.
