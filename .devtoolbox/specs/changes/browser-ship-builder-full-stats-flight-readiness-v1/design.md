# ExecPlan: Browser Ship Builder Full Stats and Flight Readiness V1

## Ziel

Provide one pure browser-domain analysis boundary whose results are deterministic,
finite, immutable, canonically signed, and sufficient for later Builder UI and
runtime adapters without importing those layers.

## Kontext

Reuse `createShipBlueprint`, `evaluateShipBlueprintMassProperties`,
`validateShipBlueprintStructure`, canonical JSON/FNV-1a, yaw transforms, and
deep-freeze behavior. New product code stays under
`apps/weltraum-browser/src/ship-builder/**`; the existing starter catalog and
legacy structure/mass report payloads remain unchanged.

## Nicht-Ziele

No UI, placement, runtime, test-flight execution, active-ship handoff, resources,
economy, combat, navigation, renderer, settings, celestial, test-harness, Unity,
dependency, or lockfile work. `package.json` may change only by appending the named
Ship Builder E2E to the existing `test:e2e:core` group. No mesh, GLB, Three.js
bounds, random values, final balance constants, or player-facing copy.

## Architekturentscheidung

### Public boundaries

Export `createShipStatPreview`, `createShipAnalysisPolicy`, `evaluateShipStats`,
`evaluateHandlingDiagnostics`, and `evaluateShipFlightReadiness` from the barrel.
The top-level flight-readiness report nests the signed stat and handling reports so
callers cannot combine unrelated provenance.

`ShipStatValue<T>` is a discriminated envelope with `availability`, `value`, and
`unit`. Availability is exactly `Available`, `UnavailableMissingMetadata`,
`UnavailableNoFuel`, `UnavailableNoThrust`, `UnavailableUnsupported`, or `Invalid`.
Unavailable/invalid envelopes use `null`, never `NaN`, `Infinity`, or a fabricated zero.

Units are `kg`, `N`, `m/s^2`, `N*m`, `m/s`, `s`, `m^3`, `m`, `W`, `count`,
`ratio`, and `unitless`. RCS translation is force in Newton; COM and thrust-axis
points are meter vectors.

### Propulsion metadata

Main Thruster and RCS accept optional `propulsionSupply`:

- `{ mode: "Fuel", fuelKind: string }` requires positive mass flow.
- `{ mode: "FuelFreeExperimental" }` requires zero mass flow.

Omitted metadata remains catalog-valid but makes fuel-dependent values unavailable.
The starter catalog is not edited. Mixed main-propulsion modes or fuel kinds are
unsupported in V1 and block fuel-dependent readiness.

### Preview and policy

Canonical preview defaults are fuel fill `1.0`, cargo mass `0 kg`, and cargo volume
`0 m^3`. Negative/nonfinite values and fuel fractions outside `[0,1]` are boundary
errors. Over-capacity cargo is preserved, never clamped, and diagnosed.

The signed default policy contains:

- thrust-offset warning `> 0.35 m`;
- weak braking ratio `< 0.25`;
- hard overlap ratio `> 0.75` of the smaller gameplay AABB volume;
- `lowAccelerationMps2: null` and `minimumRcsSymmetryRatio: null`.

Caller policies may enable the two null thresholds without changing V1 defaults.

### Aggregation order and formulas

1. Canonicalize/copy blueprint, preview, and policy; traverse enabled instances in stable-ID order.
2. Reuse existing enabled-part dry-mass contributions without armor/cached/runtime mass.
3. Apply one fill fraction to all tanks. Distribute cargo mass across enabled Cargo Storage instances proportional to mass capacity; volume affects capacity validation only.
4. Calculate total-empty as dry plus fuel and total-loaded as empty plus requested cargo.
5. Calculate loaded COM from dry, tank fuel, and cargo mass at authoritative part origins. If requested mass cannot be positioned, mass remains known but COM is `Invalid`.
6. Sum usable main-thruster magnitudes. Empty/loaded acceleration is thrust divided by mass; forward/braking values use positive projections onto `+Z`/`-Z`.
7. Transform socket point/direction with yaw and blueprint grid scale. RCS signed-axis force uses positive dot projections. Torque is `cross(nozzlePoint - COM, force)` and pitch/yaw/roll aggregate absolute axis contributions.
8. Form the thrust-weighted nozzle point and normalized resultant direction. Thrust offset is shortest COM-to-axis distance.
9. For one complete fuel-based main mode, use `ve = thrust / massFlow`, `deltaV = ve * ln(initialMass/finalMass)`, and `burnTime = compatibleFuelMass/massFlow`. Missing/zero fuel, missing metadata, mixed modes, and fuel-free propulsion return explicit unavailable states.
10. Aggregate cargo capacities and enabled Builder weapon components. Weapon usability requires valid socket roles/types/directions; parser-level missing references still throw.
11. Sum `PowerHeatReserved` as `powerRequired` and `heatGenerated` only when at least one reservation exists. Generation, cooling, and balances remain unavailable and nonblocking.

All sums follow canonical traversal order. Every arithmetic branch guards division,
normalization, logarithms, and overflow before canonical signing.

### Canonical serialization

Preview, policy, stat, handling, and readiness payloads are recursively frozen and
hashed with existing canonical JSON/FNV-1a. Report provenance contains report version,
catalog signature, blueprint layout hash, preview signature, policy signature, and
source report signatures. Each signature covers the full payload except its own field.

### Diagnostics and fixes

Readiness precedence is: control/structure, main thrust, propulsion metadata/mode,
compatible/required fuel, usable RCS, hard overlap, functional sockets, thrust offset,
braking, low acceleration, missing signed RCS axes, optional RCS asymmetry, missing
pitch/yaw/roll, cargo capacity, camera, power, heat, and stat unavailable. Ties sort
by JSON path then canonical details.

Suggested fixes are stable codes only and are deduplicated in first-diagnostic order:
`AddControlCore`, `ConnectRequiredStructure`, `AddMainThruster`,
`DeclarePropulsionSupply`, `UseSingleSupportedPropellant`, `AddCompatibleFuelTank`,
`AddRequiredFuel`, `AddUsableRcs`, `ResolveHardOverlap`, `FixFunctionalSocket`,
`AlignThrustAxisWithCenterOfMass`, `IncreaseBrakingAuthority`,
`IncreaseAccelerationOrReduceMass`, signed-axis RCS fixes, `RebalanceRcsAuthority`,
pitch/yaw/roll fixes, cargo preview reductions, `AddUniqueCameraAnchor`, power/heat
capacity fixes, and `ProvideRequiredStatMetadata`.

### Readiness

- `DraftValid` is ready for every successfully canonicalized blueprint; incomplete product issues are warnings. Schema/reference/future-version errors still throw.
- `TestFlightReady` requires a Control Core, valid required structure, usable main thrust, complete required fuel basis, functional sockets, no cargo over-capacity, no hard overlap, finite required stats, and usable RCS. Usable RCS means at least one valid cluster with any positive translation contribution and any positive pitch/yaw/roll torque. Missing individual axes remain warnings.
- `ActiveShipReady` is static eligibility only. It inherits TestFlight requirements and additionally requires exactly one valid enabled Control-Core camera anchor, braking ratio at least `0.25`, and thrust offset at most `0.35 m`. Individual RCS gaps remain warnings.

Hard overlap uses part gameplay AABBs only. Touching and exactly 75% do not block.

## Implementierungsphasen

1. Freeze public contracts, optional propulsion parsing, preview/policy canonicalization, and legacy signature guards.
2. Implement full stat aggregation and canonical signed reports.
3. Implement ordered handling diagnostics, fix codes, overlap, and three-level readiness.
4. Add focused unit suites for all mandatory scenarios.
5. Verify the user-approved `/favicon.png` declaration in `apps/weltraum-browser/index.html`,
   then add normal-route Vite browser verification, deterministic evidence, and
   browser-mainline documentation.
6. Run full regression, scope audit, review, DevToolbox preflight, commit, and push.

## Tests und Evidence

Use the exact protocol in `tests/test-protocol.md`. Browser evidence is
`apps/weltraum-browser/evidence/browser-ship-builder-full-stats-flight-readiness-v1-summary.json`
and the matching Markdown file. It contains no timestamps, durations, random values,
or absolute machine paths. No screenshot is required.

## Risiken

- Accidentally materializing omitted optional fields would change `STARTER_CATALOG_SIGNATURE`.
- Unstable traversal or floating-point fallbacks would make signatures insertion-order dependent.
- Existing schematic fixtures overlap spatially; only the approved strict `>75%` rule may block.
- Full E2E rewrites legacy evidence by design. Run it with the repository's stable
  `CI=true` Playwright configuration, retain neither legacy rewrites nor failure
  artifacts, and prove the final unrelated-evidence manifest is byte-identical.
- Without an explicit favicon declaration Chrome requests `/favicon.ico`; the approved
  `/favicon.png` asset removes that real normal-route 404 without test interception.
- Power/heat and weapon blockage are intentionally incomplete metadata domains.

## Rollback / Safe Stop

Stop without resetting if starter signatures change, a forbidden path/import appears,
required metadata would need renderer/runtime inference, an unrelated evidence file
changes, or a DevToolbox completion preflight lacks fresh evidence. Never force-push
or merge to `main` without explicit user authorization and current green CI.

## Fortschrittslog

Progress is tracked only by the checkboxes in `tasks.md`; each completed checkbox
requires its listed fresh verification and DevToolbox preflight.

## Definition of Done

All focused/full commands pass, both new evidence files are deterministic, the strict
allowlist and legacy signature guards pass, review finds no unresolved correctness
issue, DevToolbox accepts completion, the feature branch is synchronized with current
`main`, and every required PR check passes before any explicitly authorized merge.
