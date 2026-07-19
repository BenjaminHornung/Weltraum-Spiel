# Design: Browser Planetary Environment Core v1

## Design principles
- Domain-only seam in `apps/weltraum-browser/src/planetary-environment/**` with explicit public exports only from `index.ts`.
- Deterministic by construction: no `Date.now`, no random, no DOM/Three.js/Renderer, no global mutable profile singleton.
- Fail-closed validation: any unknown/malformed fields are rejected early and returned as stable issues.
- Strict signatures are deterministic and stable across semantically equivalent data.
- Canonical immutability boundary: input is validated; outputs are defensive deep-clones and frozen.

## Core architecture
- `PlanetaryEnvironmentProfile` defines static profile identity and atmosphere coefficients (`referenceRadiusM`, lapse rate, density model parameters, pressure/temperature limits, composition, radiation/exposure multipliers, contamination profile, etc.).
- `AtmosphericComponent` holds immutable chemical traits (`fraction`, `molarMass`, `breathabilityClass`, `toxic`, `corrosive`, `inert`, `greenhouse`, `unknownOrExotic`), with strict fraction validation and no implicit normalization.
- `EnvironmentSampleInput` is explicit: profile ID, latitude, longitude, altitude, illumination/time input, and optional terrain/environment modifiers.
- `PlanetaryEnvironmentSample` is deterministic derived output including pressure/temperature/density, partial pressures, hazard classes, corrosion/dust/spore load, visibility, wind if requested, and signature.
- `computeEnvironmentSample` and fixture helpers are pure functions with no module-level mutable caches.
- No world, renderer, surface, suit, or navigation runtime modules are imported.

## Reuse decisions from existing validated code
- Reuse canonical serialization and signature behavior patterns from `apps/weltraum-browser/src/resources/serialization.ts`.
- Reuse strict fail-closed validation patterns from `apps/weltraum-browser/src/ship-builder/validation.ts`.
- Adapt only through this change's new module boundary; do **not** edit those source files.

## Determinism and validation contracts
- Inputs are normalized only for documented canonicalization steps (e.g., longitude wrapping) and must be explicit in domain docs.
- Arrays are deterministically ordered before exposure (stable sort by stable ID/priority where semantic set-like behavior applies).
- Unknown fields are rejected and never promoted into outputs.
- `NaN`, `Infinity`, `-Infinity`, and unsafe numeric states are rejected.
- If model input goes out of physical/model bounds, the sample includes explicit out-of-model or vacuum states rather than clamped values.
- All public payloads are JSON-safe only; non-finite numbers and non-JSON types are rejected.

## Atmospheric model constraints
- V1 supports: airless/vacuum, thin exponential atmosphere, earth-like breathable, CO2-rich, high-pressure toxic, and moist spore/hestia-like atmosphere models.
- Formula and parameter ranges are explicit and versioned in profile fields.
- No fluid simulation, no weather system, and no cloud/storm runtime assumptions.
- Temperature uses lapse-rate model with hard limits; invalid setup returns fail-closed state/issue.

## Hazard model
- Hazard descriptors use stable IDs and machine-readable payloads only.
- Classifications include at minimum: `Vacuum`, `LowPressure`, `HighPressure`, `Hypoxia`, `Hyperoxia`, `ToxicAtmosphere`, `CorrosiveAtmosphere`, `ExtremeCold`, `ExtremeHeat`, `Radiation`, `Dust`, `Spores`, `LowVisibility`, `UnknownComposition`.
- Each hazard entry carries `severity`, measured value, threshold, and deterministic source facts.

## E2E and evidence surface decisions
- Normal route only (`/`) in browser evidence, no UI/assertion flow and no screenshots.
- No synthetic `testBridge` runtime path.
- Browser scenario dynamically imports only `/src/planetary-environment/index.ts`.
- Playwright evidence config on port `5232`, `reuseExistingServer: false`, deterministic run with explicit console/page/network capture and normal-route health checks.
