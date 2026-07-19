# Capability: Browser Planetary Environment Core v1

## Scope and hard boundaries
- Implement only a pure domain core in `apps/weltraum-browser/src/planetary-environment/**`.
- No package-lock, root config, package scripts, Unity files, renderer/world runtime files, or forbidden domain files are changed.
- No runtime authority for suit, fuel, landing, health, UI text, or weather visuals is introduced.
- No dependence on `src/suit/**`, `src/surface-lab/**`, `src/world-generation/**`, `src/voxel/**`, `src/flight/**`, `src/celestial/**`, `src/spatial/**`, TestBridge, renderer, or legacy surface modules.
- Browser evidence must be normal route only, without screenshots.

## Requirement: Planetary Environment Domain Models
The module SHALL define and expose versioned, deterministic, pure domain models for profile, composition, sample input, and sample output.

### Scenario 01: Profile identity and schema
A profile includes stable profile ID, body ID, schema/version, reference radius, gravity reference value, atmosphere presence, surface reference pressure, reference temperature, scale height, lapse rate, composition, density parameters, radiation baseline, stellar multiplier, contamination classes, dust/spore/corrosive factors, default visibility, and valid altitude range.

### Scenario 02: Atmospheric component integrity
Each component has stable component ID, fraction, molar mass, oxygen-like/breathable chemical flag, toxic/corrosive/inert/greenhouse/unknown flags and strict normalization/validation of fractions.

### Scenario 03: Input authority boundary
`EnvironmentSampleInput` includes profile ID, explicit latitude/longitude/altitude, explicit universe time or neutral illumination phase input, and optional terrain/environment modifiers with no implicit globals and no runtime clock access.

### Scenario 04: Sample payload shape
`PlanetaryEnvironmentSample` includes total pressure, temperature, density, component partial pressures, effective oxygen partial pressure, pressure class, thermal class, radiation, contamination, corrosive exposure, dust/spore load, visibility, optional wind vector only with explicit wind input model, breathability assessment, hazard descriptors, and deterministic signature.

## Requirement: Atmosphere models and physical bounds
The module SHALL support analytic V1 atmosphere families and explicitly reject invalid configurations without silent correction.

### Scenario 05: Airless atmosphere path
Profiles with zero/near-zero atmosphere resolve to deterministic vacuum/out-of-model classes without negative pressure or synthetic fallback artifacts.

### Scenario 06: Exponential thin atmosphere
Thin atmosphere mode applies documented exponential decay and returns deterministic pressures/densities at altitude.

### Scenario 07: Earth-like and CO2-rich models
Breathable and CO2-rich modes include pressure, density, temperature, and composition behavior consistent with declared parameters and valid model ranges.

### Scenario 08: High pressure toxic and wet spore modes
High-pressure toxic and wet-spore models produce corresponding pressure class, toxic/corrosive descriptors, and contamination effects.

### Scenario 09: Invalid atmospheric configuration is out-of-model not clamped
Inputs outside documented model limits return deterministic out-of-model or vacuum state with fail-closed indicators instead of clamped values.

## Requirement: Breathability and hazard determinism
The module SHALL compute machine-readable hazard/breathability classes only from deterministic physical fields.

### Scenario 10: Breathability classes
A sample classifies as one of `Breathable`, `RespiratorRequired`, `PressureSuitRequired`, `Toxic`, `Corrosive`, `Vacuum`, or `Unknown` based on pressure/oxygen/toxic/corrosive/contamination signals.

### Scenario 11: Hazard typing
Each environment hazard entry includes a typed stable ID, severity, measured value, threshold, and machine facts for deterministic post-processing.

### Scenario 12: Hestia-like spore behavior
Wet-spore atmosphere models generate stable spore contamination and toxicity descriptors without rendering effects.

## Requirement: Determinism and numeric safety
All outputs must be stable for equal input and reject unstable numeric states.

### Scenario 13: Deterministic signature
Equivalent inputs produce byte-identical outputs and signatures. Changed inputs produce changed sample bytes/signature.

### Scenario 14: Immutable results
Returned samples are deeply frozen and resistant to caller mutation; callers cannot mutate source state through returned references.

### Scenario 15: Non-finite rejection
`NaN`, `Infinity`, `-Infinity`, and unsafe numeric values are rejected at module entry.

### Scenario 16: Unknown field rejection
Unknown fields are rejected for strict public contracts; no silent passthrough in profile/input/sample objects.

## Requirement: Testing and fixture behavior
Unit and browser tests SHALL assert core behavior and fixed fixture coverage.

### Scenario 17: Fixture coverage
The six required fixtures exist and are distinct:
1. Airless Moon
2. Thin CO2 Moon
3. Earth-like reference
4. High-pressure toxic world
5. Hestia wet-spore atmosphere
6. unknown exotic composition

### Scenario 18: Physics and profile checks
Validation, composition sum, partial pressures, vacuum behavior, altitude pressure decay, density, lapse rate, breathability classes, toxic/contamination overrides, and radiation calculations are all tested.

### Scenario 19: Canonical fixture identity checks
Equal-input signatures are identical; changed inputs change signature and sample bytes.

### Scenario 20: Canonical safety checks
No forbidden dependency imports, and all required modules are unit-tested for source boundaries.

## Requirement: Browser evidence contract
Playwright evidence SHALL prove normal-route execution with deterministic re-run behavior and zero runtime errors.

### Scenario 21: Normal-route health and test import boundary
The e2e spec runs on `/` and imports only `/src/planetary-environment/index.ts`; it fails on console errors, page errors, failed requests, and 4xx/5xx responses.

### Scenario 22: No test bridge and no runtime assertions on UI
`window.TestBridge` is absent; the test does not use screenshots, UI interactions, or DOM-only rendering assumptions.

### Scenario 23: Deterministic double run
The focused E2E scenario runs twice with identical JSON evidence bytes, identical signatures, and no browser errors in either run.

## Requirement: Browser ports and execution
The dedicated Playwright config uses port `5232` with `reuseExistingServer: false`.

### Scenario 24: Playwright config constraints
The config file for this change enforces strict local test server settings and dedicated `test/e2e` path imports for the six fixtures.

## Requirement: Deliverables and completion boundaries
The change includes documentation and evidence in-browser for a non-UI core slice.

### Scenario 25: Required deliverables
- `apps/weltraum-browser/src/planetary-environment/index.ts` is the sole public entrypoint.
- Tests: one or more `planetaryEnvironment*.test.ts` unit files covering all required cases and all six required fixtures, plus one dedicated E2E spec.
- Evidence and contract document are generated for this change.
- No package/runtime dependency change outside allowlist.
