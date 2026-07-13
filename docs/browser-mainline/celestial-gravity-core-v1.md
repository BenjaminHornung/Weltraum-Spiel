# Browser Celestial Gravity Core v1

## Outcome

`apps/weltraum-browser/src/celestial` is the browser-mainline data and pure-math seam for the documented Aurelia starter system. It owns validated celestial identities, the canonical catalog, deterministic elliptic Kepler propagation, explicit reference frames, and local inverse-square gravity queries. It does not integrate with the flight runtime, navigation, renderer, UI, world bootstrap, or Unity legacy code.

## Source Reconciliation

The executable v1 catalog is deliberately narrower than the prose universe:

- Included: Aurelia; Korus, Pyra, Hestia, Tharos, Aureon, Nereion, and Umbra; Hestia's named moons Luma, Sela, Nixia, and Oru; the sufficiently specified named asteroids Eber, Kallisto, and Minoa.
- Excluded: unnamed outer-planet moons, stations, artificial structures, comets, and other bodies without a complete documented identity and the minimum physical/orbital fields required by this contract.
- Missing orbital phase and orientation data use one explicit canonical zero-phase convention: eccentricity, inclination, ascending node, periapsis argument, and mean anomaly at epoch are zero. This is a deterministic data convention, not an astronomical claim.
- The identity visual-scale profile is `1:1` and marked `renderOnly`. It is a neutral physics boundary, not a final art or map-scale decision.
- Hestia retains its documented 36-hour rotation, 10-degree axial tilt, 145 kPa atmosphere, and qualitative hazards. Unspecified rotation and atmosphere profiles remain `null` rather than being invented.
- Gameplay and surface-access fields are conservative deferred/orbit-only flags. They are not landing, economy, mining, or traversal implementations.

Pinned unit conversions are `1 AU = 149597870700 m`, solar radius `695700000 m`, solar mass `1.98847e30 kg`, Earth mass `5.9722e24 kg`, lunar mass `7.342e22 kg`, and one day `86400 s`. The gravitational constant is `6.67430e-11 m^3 kg^-1 s^-2`. Supplied mass and gravitational parameter pairs must agree within one percent.

## Stable Contract

Every catalog, body, nested profile, orbit, reference frame, runtime state, and gravity source carries schema version `1` where the public type declares it. Unknown versions, malformed IDs, non-finite or out-of-range numbers, duplicate IDs, missing parents, cycles, mismatched parent/orbit IDs, and inconsistent mass/`mu` pairs fail with `CelestialError` rather than being repaired.

Body and catalog IDs use lowercase ASCII alphanumeric segments separated by `.` or `_`. Catalog bodies and all derived index arrays are sorted lexically by stable ID. Catalog and ephemeris outputs are deeply frozen. Their canonical JSON sorts object keys, preserves finite numeric precision, normalizes negative zero, and rejects undefined values, sparse arrays, non-finite numbers, cycles, and non-plain objects. FNV-1a signatures are derived solely from that canonical payload.

The root star's absolute system state is the exact origin. Non-root bodies expose both a parent-relative body-centered state and a composed absolute-system state. Callers must provide finite `epochSeconds` and `requestedTimeSeconds`; no wall clock, random seed, renderer state, floating-origin state, or hidden replan participates in propagation. Floating-origin translation therefore remains an external render/runtime concern and cannot alter orbital truth.

## Kepler Boundary

The v1 propagator supports bound elliptic elements only: `0 <= eccentricity < 1`, positive semi-major axis, and finite angles. Mean motion and period use the parent body's physical gravitational parameter. Newton iteration defaults to a `1e-13` radian tolerance and at most 32 iterations. Invalid inputs or failure to converge throw stable typed errors. Hyperbolic/parabolic orbits, perturbations, N-body integration, patched conics, SOI transitions, collisions, landing, atmosphere, and terrain are deferred.

## Gravity Boundary

Gravity queries are pure functions of a validated source and an explicit absolute query position. Magnitude is `mu / r^2`; acceleration points toward the source. Visual scale never participates. Queries strictly inside the configured minimum radius fail instead of clamping or returning `NaN`/`Infinity`; the physical surface is valid. Dominant-source selection compares acceleration magnitude across eligible sources and resolves exact ties by lexical body ID. This selector is a deterministic local query, not an SOI or runtime-switching model.

## Verification And Evidence

Focused unit coverage lives in the four `tests/unit/celestial*.test.ts` suites. The browser smoke test opens the normal `/` page, proves `TestBridge` is absent, dynamically imports `/src/celestial/index.ts`, runs the same explicit-time catalog/ephemeris/gravity probe twice, checks canonical/signature equality, and rejects feature console, page, request, or HTTP errors. The task evidence separately records the normal page's pre-existing missing `/favicon.ico` console noise; the feature scope does not permit changing the app shell or static assets to repair it.

The focused browser run writes:

- `apps/weltraum-browser/evidence/browser-celestial-gravity-core-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-celestial-gravity-core-v1.md`

No screenshot is captured because the feature has no visible UI, scene, or rendering change.
