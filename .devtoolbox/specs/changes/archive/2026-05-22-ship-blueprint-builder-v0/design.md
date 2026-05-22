# Design

## Approach

Add a narrow prototype blueprint layer that adapts data into existing generated ship paths. New code should live in prototype scripts and reuse `PrototypeShipLayout`, `PrototypeShipVariant`, `ShipStats`, `ModuleMassDescriptor`, `MainThrusterModule`, `RcsThrusterController`, `GunModule`, and generated fallback binding.

The model stays serializable C# data rather than a final asset database. Built-in sample blueprints are authored in code for deterministic tests and can later be moved to ScriptableObjects without changing the runtime adapter contract.

## Data Model

- `PrototypeShipModuleDefinition`: reusable part data such as category, mass role, local size, dry mass, fuel capacity, main thrust, RCS thrust, gun tuning, and visual archetype hint.
- `PrototypeShipModuleInstance`: instance id, definition id, local position, local rotation, and optional scale override.
- `PrototypeShipBlueprint`: blueprint id, display name, definition list, instance list, and validation/build helpers.
- `PrototypeShipBlueprintValidationReport`: deterministic errors, warnings, and derived counts.
- `PrototypeShipBlueprintBuildResult`: generated `PrototypeShipVariant`, validation report, and derived totals for tests/UI.

## Runtime Binding

Blueprints are converted to existing generated primitive ship data:

- structural/cockpit/fuel/cargo modules become `PrototypeModuleLayoutEntry` records with per-instance dry mass and fuel contribution;
- main thruster definitions become `PrototypeMainThrusterLayoutEntry` records and ship-level main thrust settings derived from installed thrusters;
- RCS definitions become `PrototypeRcsBlockLayoutEntry` records and RCS settings derived from installed blocks;
- gun definitions become `PrototypeGunLayoutEntry` records and gun settings derived from installed weapons.

This keeps current transform-driven main/RCS/weapon behavior intact. Generated fallback hardpoints remain created after the generated hierarchy exists, and imported functional binding is not modified.

## Validation

Validation must reject missing ids, duplicate definition ids, duplicate instance ids, missing definitions, empty ships, non-finite transforms/scales, missing cockpit, missing fuel capacity, missing main thrust, missing RCS authority, and missing weapon modules. It may warn for unusual but still spawnable values such as zero fuel consumption or very low mass.

## Samples

Provide at least two built-in sample blueprints:

- `Scout Blueprint`: close to the current generated prototype, light, balanced, one main engine, four RCS pods, one gun.
- `Hauler Blueprint`: heavier cargo/fuel-biased ship with shifted mass distribution, larger fuel reserve, different thrust, more inertia, and a slower weapon profile.

Both samples should produce playable generated variants that can be selected from existing debug variant paths or spawned directly in tests.

## Verification

Use deterministic EditMode tests for validation, sample conversion, mass/COM/fuel/thruster/RCS/weapon derivation, bootstrap spawn behavior, and source-path guards that prevent reintroducing hardcoded demo hierarchy assumptions. Use Unity MCP validation/tests where available, then DevToolbox task preflight and archive preflight.
