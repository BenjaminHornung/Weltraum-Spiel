# Browser Planetary Environment Core v1

## Decision and authority boundary

The browser mainline has a pure TypeScript planetary environment boundary at `apps/weltraum-browser/src/planetary-environment/index.ts`. It validates explicit versioned profiles and inputs, then computes immutable deterministic samples for later Suit Exposure, Scanner, Landing Readiness, Surface Movement, biome, outpost, and mission-hazard consumers.

This core describes environment truth only. It does not consume suit oxygen, damage or kill a player, authorize landing, generate terrain or vegetation, choose player-facing warnings, simulate weather, or render visuals. It imports no suit, surface, world generation, voxel, flight, celestial, spatial, renderer, Three.js, DOM, clock, random, or process-global profile authority.

## Public contract

`PlanetaryEnvironmentProfile` declares stable profile/body IDs, schema version 1, analytic atmosphere family, SI radius and gravity reference values, pressure and temperature references, scale height, lapse rate, strictly validated composition, density gas constant, radiation and stellar multipliers, contamination factors, visibility, and explicit altitude/temperature/pressure validity ranges.

`EnvironmentSampleInput` contains the exact profile ID, latitude, longitude, altitude, illumination phase, and optional explicit modifiers and wind vector. Latitude is restricted to `[-90, 90]`. Longitude is canonicalized to `[-180, 180)`. Illumination phase is restricted to `[0, 1)`. Negative zero is normalized; nonfinite and unsafe values fail closed.

`PlanetaryEnvironmentSample` contains pressure, temperature, density, sorted component partial pressures, effective oxygen partial pressure, pressure/thermal/model classes, radiation, contamination, corrosive/dust/spore loads, visibility, optional explicit wind, typed breathability, typed hazards, and a precision-preserving deterministic signature. All returned graphs are defensive deep-frozen copies.

## Analytic SI model

For atmospheric profiles within their declared altitude range:

```text
P(h) = P0 * exp(-h / H) * pressureMultiplier
T(h) = T0 - L * h + temperatureOffset
M    = sum(componentFraction * componentMolarMass)
rho  = P * M / (R * T)
Pi   = P * componentFraction
```

`P` is pascals, `h` and `H` are metres, `T` is kelvin, `M` is kilograms per mole, `R` is `8.31446261815324 J/(mol*K)`, and density is kilograms per cubic metre. Fractions must sum to 1 within `1e-12`; they are never silently normalized. Airless profiles require zero pressure, zero scale height, and no components.

Altitude, derived pressure, or derived temperature outside the profile's declared ranges returns an explicit `OutOfModel` sample. Values are not clamped or replaced with synthetic atmospheric data. Valid airless samples return `Vacuum` with zero pressure and density while retaining their declared surface-temperature model.

## Breathability and hazards

Breathability is an environment classification, not suit authority. V1 emits `Breathable`, `RespiratorRequired`, `PressureSuitRequired`, `Toxic`, `Corrosive`, `Vacuum`, or `Unknown`. Precedence is fail-closed: vacuum, corrosion, toxicity/biological contamination/hyperoxia, unknown composition, pressure bounds, then hypoxia/dust.

Typed hazards are ordered deterministically: `Vacuum`, `LowPressure`, `HighPressure`, `Hypoxia`, `Hyperoxia`, `ToxicAtmosphere`, `CorrosiveAtmosphere`, `ExtremeCold`, `ExtremeHeat`, `Radiation`, `Dust`, `Spores`, `LowVisibility`, and `UnknownComposition`. Every descriptor contains severity, measured value, threshold relation/value/unit, and machine facts only.

V1 reference thresholds are 1 Pa vacuum; 60-120 kPa breathable total pressure; 16-30 kPa effective oxygen partial pressure; 10 Pa toxic partial pressure; 0.01 corrosive exposure; 250/330 K extreme cold/heat; `0.0001 Sv/h` radiation; 0.5 dust/spore load; and 1,000 m low visibility.

## Required fixtures

| Fixture | Family | Expected distinguishing result |
| --- | --- | --- |
| Airless Moon | `Airless` | Vacuum pressure/density and radiation hazard |
| Thin CO2 Moon | `ThinExponential` | Exponential thin pressure, CO2 toxicity, dust |
| Earth-like reference | `EarthLike` | Nominal pressure and breathable oxygen partial pressure |
| High-pressure toxic world | `HighPressureToxic` | Extreme pressure, toxic and corrosive hazards |
| Hestia wet-spore atmosphere | `WetSpore` | Biological contamination and stable spore hazard |
| Unknown exotic composition | `UnknownExotic` | Unknown breathability/composition hazard |

Fixture factories create fresh validated graphs per call; there is no mutable global profile registry.

## Canonical determinism

Canonical JSON accepts only finite safe JSON-compatible plain data, normalizes negative zero, preserves array order, sorts object keys lexically, and retains JavaScript numeric precision without rounding. It rejects sparse arrays, cycles, symbols, unsupported prototypes, and nonfinite values. Signatures are `fnv1a32:<eight lowercase hex digits>` over canonical JSON bytes. The signature is calculated from the unsigned sample payload, avoiding self-signing.

## Evidence and verification

The dedicated Playwright config uses strict port `5232`, `reuseExistingServer: false`, one worker, no retries, and no screenshot/trace/video capture. Its single normal-route test proves `window.TestBridge` is absent, dynamically imports only `/src/planetary-environment/index.ts`, samples all six fixtures twice, compares canonical bytes and signatures, and requires browser health `0/0/0/0`.

- [JSON evidence](../../apps/weltraum-browser/evidence/browser-planetary-environment-core-v1-summary.json)
- [Markdown evidence](../../apps/weltraum-browser/evidence/browser-planetary-environment-core-v1.md)

Focused commands from `apps/weltraum-browser` use Node 22 explicitly:

```powershell
npx -y node@22 node_modules/typescript/bin/tsc -p tsconfig.json
npx -y node@22 node_modules/vitest/vitest.mjs run tests/unit/planetaryEnvironmentCore.test.ts --maxWorkers=1
npx -y node@22 node_modules/@playwright/test/cli.js test --config tests/e2e/configs/planetary-environment-core.playwright.config.ts --workers=1 --retries=0
```

Fresh post-fix verification used Node `22.23.1`:

- TypeScript completed with exit code `0`.
- The supported focused Vitest invocation passed `19/19` tests; the brief's literal `--minWorkers=1` form is not accepted by the repository's Vitest `4.1.9` CLI.
- Full Vitest passed `87` files and `839` tests with four workers.
- `npm run build` completed with exit code `0` (the existing large-chunk warning remained advisory).
- The focused Playwright test passed `1/1` twice with browser health `0/0/0/0` and byte-identical evidence files across both runs.
- JSON evidence SHA-256: `39ACF1F110A7DF82EA74383BFCB80A21658681F0DA4AAC63EBD16A9B13DD550E` (`3011` bytes).
- Markdown evidence SHA-256: `DD653535829B647CFAEF9AE8E1F3F0B2CC0BA03E073418C5C7E9B83E43F29E40` (`1672` bytes).
- The final exclusive-scope audit found `18` changed files and `0` paths outside the allowlist; forbidden-dependency, ambient-authority, secret, trailing-whitespace, package, and lockfile scans were clean.

DevToolbox completion preflight, task toggle, the required commit, and the non-force branch push remain root-owned closeout actions.
