# CEL-01-WXG-00: profiles and weather read contract

Run from this spike under `C:/IFI_SourceCode`:

```powershell
$node = 'C:\IFI_SourceCode\Utils\npm-tmp\opencode\node-v22.23.2-win-x64\node.exe'
& $node scripts/repro.mjs --run-id my-unique-functional-run
```

Hypothesis: separate versioned physics/optics candidates and a small immutable read boundary can connect existing celestial/Universe/frame contracts without changing product atmosphere schemas or building a weather engine. Execution is **LOCAL_WINDOWS_ISOLATED** on fixed `17b1db4201a28e7b607c30707bdc2b75e3484a10`, branch `feature/cel-01-wxg-00-2026-10-09`. Product integration **NO**.

Node 22.23.2, npm 10.9.8, Python 3.12.13, Git 2.56.0.windows.1 and TypeScript 7.0.2 are pinned/observed and bytebound in `DependencyBindings.json`. TypeScript is a development-only dependency; no runtime package dependency. `package-lock.json` retains registry integrity/licenses, and all 533 installed compiler files are bound. On a fresh own spike only, install with the pinned Node/npm CLI using `npm ci --ignore-scripts --no-audit --no-fund --offline=false --cache .runtime/npm-cache`; do not install into product/A0. `tool-bindings.mjs --check` verifies the existing package rather than regenerating its receipt.

## Import surface

Build is `scripts/build.mjs`: TypeScript `--singleThreaded`, strict checking of own code and unchanged product snapshot; it emits real ES modules and declarations into `dist`. Consumer entry points are `dist/src/contracts.js`, `dist/src/fixtures.js`, `dist/src/types.d.ts` and `dist/src/model-pin.js`. `createWeatherReadView(bundle)`, `validateBundle(bundle)`, `assertCurrentResult(result, query, view)`, `contentDigest(payload)` and `createFixtureBundle(IMPLEMENTATION_DIGEST)` are the finite API. `fixtures/profiles.json` plus the unchanged snapshot catalogue reconstruct the six importable fixture bundles.

Physics, optics and weather references are `{id, version, digest}`. A weather profile binds the celestial body/ephemeris/star, physics/optics, frozen PLT `deterministicMathV1`, actual read implementation, climate and PlanetaryMacroData projection. Existing `AtmosphereDefinition` remains untouched. SHA256 of the sorted finite celestial canonical JSON is the structured contract encoding; PLT NM/v1 remains its own finite-number record policy, not a claim that JSON is an NM record. No new trig/RNG/weather math profile is defined.

| Fixture | Existing body source | Read | Data boundary |
|---|---|---|---|
| Hestia | planet.hestia | Unsupported | 145000 Pa, radius/rotation/hazards from catalogue; gas/thermodynamics unavailable |
| Airless | planet.korus | NoAtmosphere | Explicit synthetic airless classification; catalogue null does not mean airless |
| Dust | planet.tharos | Known | Authored synthetic gas/optical/aerosol sample only |
| Methane | planet.nereion | Unsupported | Synthetic CH4 mixture; no saturation function, no methane rain |
| GasGiant | planet.aureon | Known | Synthetic pressure-level sample, no elevation/ground/geography requirement |
| TidallyLocked | planet.pyra | Known | Synthetic synchronous rotation derived by unchanged orbitalPeriodSeconds; authored sample |

All non-catalogue constants/ranges/samples are labelled TestAssumption. Their Kelvin/Pascal/meter ranges are schema test bounds, not science-backed atmosphere limits. `Known` means a bound diagnostic record is available; it is not a meteorological prediction. No saturation implementation is supplied. The original Kepler/Surface math is reused for authoring/frame validation; it does not extend PLT deterministicMathV1 or establish cross-device trig determinism.

## Read/identity policy

Queries use existing safe integer 120 Hz SimulationTick and `BodyFixed` `SpatialVector3`, with solid-body altitude or positive pressure coordinates for no-solid-surface bodies. SurfaceLocal is projected through the unchanged surface contract. No camera or second clock is accepted. Exact-point records describe macro granularity (`supportRadiusMeters`), not continuous fine coverage.

NoAtmosphere, Known, Pending, UnknownCoverage and Unsupported are distinct unions. A different unmaterialized tick returns Pending, unavailable spatial records return UnknownCoverage and finer accuracy returns Unsupported. Reads do no catchup loop, mutation, dormancy-driven model change or replan. Existing clock/overflow/timescale validation is reused; no finite-catchup solver is invented. Graphics quality/request IDs are absent from canonical inputs. One real worker reorders queries without changing output bytes.

WeatherSnapshotId hashes the full bound result: world/session/source owner/epochs/revisions, complete record source digest, atmosphere epoch, events/cursor/checkpoint, exact profile/model/climate/geography refs, tick/weatherStep, query and actual state/sample. Different profiles/events/source epochs at the same tick change identity. `assertCurrentResult` verifies full expected bytes, including stale/forged payload rejection. Returned data is detached and deeply frozen before asynchronous work.

## Evidence

`../..\.devtoolbox/specs/changes/cel-01-wxg-00-2026-10-09/tests/runs/local-functional-04/summary.json`: 72/72 tests, build/typecheck, independent Python oracle and tool-bytecheck, exit 0. Repro refuses existing run IDs and preserves raw stdout/stderr/exit codes. Tested source/fixture/type inputs, 32 runtime modules and 31 declarations are verified against their exact run bytes before receipt creation. The independent Python lexical JSON/SHA256 oracle checks six schema/read goldens and explicit diagnostic values; it is not a weather-physics oracle. Original failed controls/initial 61-of-64 run are retained in the change tests folder.

`SourceBindings.json` binds 27 unchanged product source files and seven closed PLT files, upstream receipt/profile/lock/WASM anchors and all 102 producer dirty files. Scalar/SIMD WASM is verified upstream only; not imported or executed here. Shader/GPU/browser work is not required by this pure contract slice.

Fresh DevToolbox product typecheck exits 1, MODULE_NOT_FOUND for product `node_modules/typescript/bin/tsc`; no product dependencies are installed to hide it. Spec validation passes. Completion preflight is advisory/degraded, distinct from the passing own slice. `REPORT.md` and `HANDOFF.md` retain those separate boundaries.

No hardware/reference/ARM/header/SAB/deployment qualification. No HVP/42/1400 series or performance claim. No commit/push/merge/publication; human exact-diff Plannotator approval remains required before any future commit/first push.
