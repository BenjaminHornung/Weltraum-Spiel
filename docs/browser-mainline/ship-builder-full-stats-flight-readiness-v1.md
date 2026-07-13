# Ship Builder Full Stats & Flight Readiness v1

## Scope

This browser-mainline slice adds deterministic Ship Builder stat analysis, handling diagnostics, and static flight-readiness assessments. It remains a pure domain boundary under `apps/weltraum-browser/src/ship-builder/`; it does not add UI, a route, renderer/runtime binding, a TestBridge surface, or a package dependency.

The public entry points are:

- `createShipStatPreview(input)`
- `createShipAnalysisPolicy(input)`
- `evaluateShipStats(source, catalog, options)`
- `evaluateHandlingDiagnostics(source, catalog, options)`
- `evaluateShipFlightReadiness(source, catalog, options)`

`evaluateShipFlightReadiness` nests the matching signed stat and handling reports. Catalog, blueprint layout, preview, policy, stat, and handling signatures therefore remain traceable through the final readiness payload.

## Stat and preview contracts

Every stat is a `{ availability, value, unit }` envelope. Availability is one of `Available`, `UnavailableMissingMetadata`, `UnavailableNoFuel`, `UnavailableNoThrust`, `UnavailableUnsupported`, or `Invalid`. An unavailable or invalid value is `null`; evaluators never serialize `NaN` or `Infinity` and never substitute an invented zero for unknown data.

Preview defaults are fuel fill `1.0`, cargo mass `0 kg`, and cargo volume `0 m^3`. Fuel and cargo increase loaded mass without altering dry mass. Fuel uses tank origins, while cargo mass is distributed across enabled stores in proportion to mass capacity. Requested cargo is not clamped: mass or volume above capacity remains visible and is diagnosed.

The default signed analysis policy uses:

- thrust-offset warning above `0.35 m`;
- weak braking below ratio `0.25`;
- hard overlap strictly above `0.75` of the smaller gameplay AABB volume;
- no default low-acceleration threshold;
- no default RCS-symmetry threshold.

Callers may enable the final two thresholds through an explicit signed policy.

## Propulsion, RCS, cargo, weapons, power, and heat

Main and RCS components may declare optional `propulsionSupply`. Fuel propulsion names one fuel kind and requires positive mass flow. `FuelFreeExperimental` requires zero mass flow but intentionally makes fuel-based delta-v and burn time unsupported. Omitted metadata remains catalog-valid so the unchanged starter catalog keeps signature `5aaa27fd`; fuel-dependent values are then explicitly unavailable.

For one complete compatible fuel mode, delta-v uses `ve = thrust / massFlow` and `deltaV = ve * ln(initialMass / finalMass)`. Burn time is compatible planned fuel mass divided by mass flow. Missing fuel, missing metadata, mixed modes, or fuel-free propulsion never produce infinity.

RCS translation and torque come from valid transformed nozzle points and directions, not declared axis labels. Translation is signed-axis positive force. Torque is `cross(nozzlePoint - loadedCOM, force)`, aggregated as positive pitch, yaw, and roll authority. A usable TestFlight RCS basis needs any positive translation contribution and any positive torque contribution; missing individual axes remain warnings.

Cargo mass and volume capacities aggregate independently. Weapon counts use enabled validated Builder fixed/turret components only; they do not import Combat Core. Power requirements and heat generation sum `PowerHeatReserved` reservations when present. Power generation, cooling capacity, and power/heat balances remain unavailable and nonblocking in V1.

## Diagnostics and machine fixes

Handling diagnostics are canonically ordered by phase, code, JSON path, and canonical details. Each diagnostic contains machine-readable severity, path, affected readiness levels, related IDs where relevant, and stable suggested-fix codes. Fixes are deduplicated in first-diagnostic order. They are codes such as `DeclarePropulsionSupply`, `AddRequiredFuel`, `AddUsableRcs`, `ResolveHardOverlap`, `AlignThrustAxisWithCenterOfMass`, and `IncreaseBrakingAuthority`; they are not player-facing copy.

The diagnostic domains cover control/structure, thrust and propellant basis, usable RCS, strict hard overlap, functional sockets, thrust offset, braking, optional acceleration and RCS symmetry policy, signed RCS-axis and torque gaps, cargo capacity, camera authority, and unavailable stats. Power-generation and cooling placeholders do not block readiness in this version.

## Readiness levels

- `DraftValid` is eligible for every successfully canonicalized schema-valid blueprint. Parser, reference, catalog, and future-version errors still throw instead of becoming readiness diagnostics.
- `TestFlightReady` requires control and valid required structure, usable main thrust, complete required fuel basis, valid functional sockets, no cargo over-capacity, no hard overlap, finite required stats, and any usable RCS translation plus torque.
- `ActiveShipReady` is static eligibility only. It inherits TestFlight requirements and additionally requires exactly one valid enabled Control-Core camera anchor, braking ratio at least `0.25`, and thrust offset at most `0.35 m`.

Individual signed RCS-axis gaps remain warnings at both higher levels. `ActiveShipReady` does not prove runtime handoff, a completed test flight, or dynamic resource state.

## Browser protocol and deterministic evidence

`apps/weltraum-browser/tests/e2e/ship-builder-full-stats-flight-readiness.spec.ts` attaches console-error, failed-request, and HTTP-error listeners before loading normal `/`. The document declares `<link rel="icon" href="data:,">`, preventing the browser's implicit `/favicon.ico` request without filtering or intercepting network events; the E2E test asserts this real document declaration. It proves `TestBridge` absent through both own-property and prototype-chain checks, confirms the body has no TestBridge reference, and dynamically imports `/src/ship-builder/index.ts` through Vite.

Scout, Cargo, Weapon, and a synthetic complete fuel-propulsion fixture are each evaluated twice through the public APIs. The test pins stat, handling, and readiness signatures and selected capability values; verifies finite JSON, recursive freezing, repeat equality, and unchanged mutable inputs; and requires zero browser error events.

The test writes exactly two task-specific evidence files, with stable ordering and one trailing newline, and without timestamps, durations, random values, absolute paths, or screenshots:

- `apps/weltraum-browser/evidence/browser-ship-builder-full-stats-flight-readiness-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-ship-builder-full-stats-flight-readiness-v1.md`

Focused verification from `apps/weltraum-browser`:

```text
npx tsc -p tsconfig.json
npm run test -- tests/unit/shipBuilderFullStats.test.ts
npm run test -- tests/unit/shipBuilderRcsAuthority.test.ts
npm run test -- tests/unit/shipBuilderHandlingDiagnostics.test.ts
npm run test -- tests/unit/shipBuilderFlightReadiness.test.ts
npm run test:e2e -- tests/e2e/ship-builder-full-stats-flight-readiness.spec.ts
```

## Explicit non-goals

- Builder palette, placement/editing UI, visual design, or screenshots.
- Flight execution, runtime state, completed-test-flight tracking, active-ship handoff, or navigation behavior.
- Renderer, mesh, collider, Three.js, Combat Core, resources, economy, celestial, settings, or test-harness integration.
- Dynamic fuel consumption, ammo, crew, generation, cooling, or authoritative power/heat balance.
- Player-facing diagnostic strings, final balance constants, catalog expansion, or changes to starter fixtures.
