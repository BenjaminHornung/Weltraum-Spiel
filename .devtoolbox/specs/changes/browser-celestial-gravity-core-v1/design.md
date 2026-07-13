# ExecPlan: Browser Celestial Gravity Core v1

## Ziel

At completion, `apps/weltraum-browser/src/celestial/**` is a standalone deterministic TypeScript domain core for the Aurelia catalog, analytical ephemerides and gravity queries. It is importable through the real Vite browser while remaining disconnected from renderer, UI, flight, navigation and runtime owners.

## Kontext

Authoritative concept and architecture inputs:

- `docs/roadmap/living-master-plan.md`
- `docs/spielkonzept/startsystem.md`
- `docs/spielkonzept/celestial-runtime-data-contract.md`
- `docs/spielkonzept/orbital-simulation-model.md`
- `docs/spielkonzept/real-scale-world-architecture.md`
- `docs/architecture/coordinate-spaces-and-floating-origin.md`
- `docs/browser-mainline/feature-intent-index.md`
- `apps/weltraum-browser/src/core/**`
- `apps/weltraum-browser/src/world/**`
- reference changes `weltraum-001-celestial-backbone`, `weltraum-002-orbit-map-prototype` and archived `physics-gravity-orbits`

The browser mainline owns new product work. Unity is read-only reference and is not started.

## Nicht-Ziele

- No rendering, map projection, UI, scene, runtime, ship, planner, executor or autopilot changes.
- No application of gravity to active entities.
- No SOI, Patched Conics, N-body, timewarp, transfer windows, route planning or ship integration.
- No package/lock changes and no modification outside the task allow-list.
- No station or insufficiently described moon definitions.

## Architekturentscheidung

### Stable IDs and versions

- `CelestialBodyId` is a branded lowercase ASCII string matching dot/underscore-separated alphanumeric segments, for example `moon.hestia.luma`.
- Display names never participate in identity or ordering.
- The catalog ID is `catalog.aurelia.v1`.
- `CELESTIAL_SCHEMA_VERSION` is exactly `1` for the catalog and every nested domain definition.
- Version `0`, missing versions and future versions fail closed. This slice has no migration path.

### Physical units and constants

- Length and position: metres.
- Velocity: metres per second.
- Time and epoch: seconds.
- Mass: kilograms.
- `mu`: cubic metres per squared second.
- Angles in stored orbit/rotation definitions: degrees with unit-bearing field names; solver internals use radians.
- `G = 6.67430e-11 m^3 kg^-1 s^-2`.
- Mass/`mu` relative tolerance: `1%`, matching the prior celestial-backbone decision and accommodating rounded concept values.
- SI conversions use pinned non-body-specific reference constants: AU `149597870700 m`, solar radius `695700000 m`, solar mass `1.98847e30 kg`, Earth mass `5.9722e24 kg`, lunar mass `7.342e22 kg`, day `86400 s`.

### Executable starter content and source reconciliation

The executable catalog contains 15 bodies:

- Aurelia.
- Korus, Pyra, Hestia, Tharos, Aureon, Nereion and Umbra.
- Luma, Sela, Nixia and Oru.
- Eber, Kallisto and Minoa.

Documented relative masses are converted to kilograms through the pinned reference constants. Asteroid `mu` and moon `mu` are derived from documented masses via `G`; planet/star `mu` uses the explicitly documented rounded value and is checked against mass.

Concept limitations are represented without invented body-specific claims:

- The concept supplies no absolute epoch or orbital phase. Epoch is an explicit caller input, and all starter orbits use a documented canonical phase convention of mean anomaly zero at that epoch.
- Circular, coplanar zero-angle elements are the explicit v1 convention allowed by `orbital-simulation-model.md`; they are not asserted as measured astronomy.
- Documented periods are rounded descriptive values. Ephemerides derive period from parent `mu` and semi-major axis instead of storing a second authority.
- Visual tuning is unspecified. Every starter body uses a neutral identity scale (`1`) marked render-only; it is not a final map-art decision.
- Optional atmosphere/rotation fields remain `null` unless quantitative concept data is sufficient. Hestia's 36-hour rotation, 10-degree tilt and 1.45-bar atmosphere may be represented; incomplete composition/height data is not invented.
- Surface and gameplay profiles expose only conservative `Deferred`, `OrbitOnly` or `NoSolidSurface` metadata and never feed physics.
- The three named stations and unnamed outer moons stay out because their body/orbit values are incomplete.

### Parent graph

- `star.aurelia` is the single root and has no parent or orbit.
- Planets and named asteroids parent to `star.aurelia`.
- The four named moons parent to `planet.hestia`.
- A non-root body must have exactly one orbit whose `parentBodyId` equals its definition parent.
- Parent existence is validated before cycle detection.
- Public indexes are frozen records/arrays. No mutable `Map` or `Set` escapes the module.

### Orbit, epoch and Kepler semantics

- `OrbitDefinition` carries `semiMajorAxisMeters`, `eccentricity`, inclination, ascending-node longitude, periapsis argument and mean anomaly at the caller-supplied epoch.
- Bound elliptic input requires `semiMajorAxisMeters > 0` and `0 <= eccentricity < 1`.
- Inclination is within `[0, 180]`; other stored angles are within `[0, 360)`.
- Mean motion is `sqrt(parentMu / a^3)`.
- The Kepler solver uses Newton iteration, a fixed default tolerance of `1e-13` radians and a fixed maximum of 32 iterations. It exits only on the stated residual rule and otherwise throws `KeplerConvergenceFailure`.
- No clock, global timer, random value or frame delta is read. `epochSeconds` and `requestedTimeSeconds` are finite explicit inputs.
- The absolute-system frame is star-rooted at Aurelia origin. A child's relative state is in a `BodyCentered` frame referencing its parent; its absolute state is the vector sum of relative and parent absolute position/velocity.
- Root, parent and child runtime states must share the requested time exactly.

### Gravity semantics

- Point-mass acceleration is `mu / r^2` toward the source using absolute metres.
- A query with distance strictly less than the body's physical radius (or an explicit larger minimum query radius) fails closed with `InsideMinimumRadius`; no zero division or silent clamp occurs.
- `surfaceGravity` uses physical `mu / radius^2`.
- `escapeVelocity` uses `sqrt(2 * mu / radius)`.
- Dominant-source selection considers only sources marked eligible, compares acceleration magnitude and resolves exact ties by ascending code-unit body ID.
- Input sources are validated in canonical body-ID order so malformed-source error selection is insertion-order independent.
- Visual scale, map scale, local projection and floating-origin coordinates are not accepted as gravity inputs.

### Validation and error order

Creation fails on the first error in this stable sequence:

1. Catalog/nested schema version and root shape.
2. Catalog ID and body ID syntax.
3. Duplicate body IDs.
4. Per-body type, physical scalars and nested-profile values in canonical body-ID order.
5. Unknown parents.
6. Parent/orbit mismatch and root/orbit mismatch.
7. Parent cycles, starting from canonical body-ID order.

Math-query validation is similarly fixed: input shape/time, source ID/schema/scalars, frame/time compatibility, minimum-radius rule, then calculation/convergence.

Stable errors use `CelestialError` with `code` and canonical `path`.

### Canonical serialization

- Recursively sort object keys by code unit.
- Preserve domain-array order after catalog/index builders have canonically sorted it.
- Normalize negative zero to zero.
- Reject non-finite numbers, `undefined`, functions, symbols, sparse arrays, non-plain objects and cycles.
- Never round physical or ephemeris numbers.
- Catalog canonical JSON includes only schema version, catalog ID and canonical bodies; computed indexes, cached JSON and signature are excluded.
- Signatures use the existing core FNV-1a primitive and are eight lowercase hexadecimal characters.

### Immutability

All accepted inputs are defensively cloned. Definitions, nested profiles, arrays, indexes, runtime states, gravity results and canonical views are deeply frozen before publication.

## Implementierungsphasen

1. Create the DevToolbox change and freeze the contracts above.
2. Implement IDs, types, errors, canonical JSON and definition/catalog validation.
3. Seed and pin the 15-body starter catalog with source comments and no station data.
4. Implement Kepler math, root/child ephemerides and catalog-wide hierarchy composition.
5. Implement pure gravity helpers and deterministic dominant-source selection.
6. Add unit tests for all required acceptance cases and public immutability.
7. Add the normal-route dynamic-import Playwright test and task-owned evidence.
8. Run focused and full verification, inspect scope/diff, complete task preflight, commit and push.

## Tests und Evidence

Required commands from `apps/weltraum-browser`:

```text
npm ci
npx tsc -p tsconfig.json
npm run test -- tests/unit/celestialCatalog.test.ts
npm run test -- tests/unit/celestialValidation.test.ts
npm run test -- tests/unit/celestialEphemeris.test.ts
npm run test -- tests/unit/celestialGravity.test.ts
npm run test:e2e -- tests/e2e/celestial-gravity-core.spec.ts
npm run test
npm run build
npm run test:e2e
```

Repository gate: `git diff --check` plus allow-list audit against `origin/main`.

Evidence outputs:

- `apps/weltraum-browser/evidence/browser-celestial-gravity-core-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-celestial-gravity-core-v1.md`

No screenshot is required because there is no visual contract.

## Risiken

- Rounded source mass and `mu` values can appear contradictory if validated at machine precision; the explicit 1% tolerance prevents false conflicts while catching material errors.
- Trigonometric results are deterministic for identical inputs in the supported ECMAScript/browser runtime, but this slice does not claim cross-language bit identity.
- A catalog convenience API could accidentally become a hidden mutable registry; all indexes therefore remain frozen value objects.
- A future consumer could pass local/floating-origin coordinates as absolute values; the gravity API names absolute position fields explicitly and has no renderer/world adapter overload.
- Full E2E tests write other evidence files. Any test-generated changes outside this task's evidence prefix must be restored before commit.

## Rollback / Safe Stop

Stop without integrating if any required source value cannot be reconciled without inventing a body-specific value, if implementation requires a forbidden path, or if a normal-runtime/renderer dependency becomes necessary. Because the new module has no consumers, rollback is the removal of task-owned files only.

## Fortschrittslog

- [x] Worktree, source documents, current prototype state, design audits and reference specs inspected.
- [x] Catalog scope, conversion constants, error order and non-goals decided.
- [ ] DevToolbox change artifacts validated.
- [ ] Domain core implemented.
- [ ] Unit and browser evidence implemented.
- [ ] Focused and full verification passed.
- [ ] Scope audit, commit and push completed.

## Definition of Done

- All five change artifacts exist and the focused change validates when DevToolbox path access is available.
- The public barrel exports only task-owned celestial contracts/helpers.
- The 15-body catalog is canonical, immutable and source-backed; exclusions/conflicts are documented.
- All mandatory unit cases and the real Vite browser test pass.
- Evidence contains deterministic repeated results and no TestBridge/console/network errors.
- No forbidden path differs from `origin/main`.
- The feature branch is committed and pushed without merging to `main`.
