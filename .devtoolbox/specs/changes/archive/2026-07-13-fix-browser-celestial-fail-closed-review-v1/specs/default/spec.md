# Browser Celestial Fail-Closed Review v1 Spec

## Requirements

### CFR-001 Finite gravity publication

All public gravity calculations shall either publish finite scalar/vector values
or throw a stable `CelestialError`. Finite inputs that overflow during inverse-
square acceleration, surface gravity, or escape velocity shall fail with
`InvalidNumber` and shall not affect dominant-source selection.

### CFR-002 Finite Kepler publication

Kepler period and propagation shall validate every derived public scalar and
vector. A finite but unsupported numeric range shall fail with `CelestialError`
instead of publishing `NaN` or `Infinity`. The implementation shall not clamp the
semi-major axis.

### CFR-003 Dense catalog arrays

Catalog creation shall require a dense non-empty `bodies` array. The first sparse
index shall fail with `InvalidCatalog` at `/bodies/<index>` before mapping,
sorting, destructuring, or publishing catalog state.

### CFR-004 Exact favicon noise exception

The focused celestial browser test shall ignore a 404 HTTP response only when
the URL pathname is exactly `/favicon.ico`. Other 4xx/5xx responses shall remain
failures.

### CFR-005 Scope and regression evidence

Focused celestial unit tests, the full unit suite, the production build, and the
core E2E group shall pass without product integration, package, lockfile,
workflow, renderer, UI, runtime, or Unity changes.
