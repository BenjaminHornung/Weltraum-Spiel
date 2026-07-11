# Browser Resource Cargo Inventory Core v1

## Scope

`apps/weltraum-browser/src/resources/index.ts` exports the Browser's standalone resource, container, and explicit-transfer contract. It is data-only: callers construct validated immutable catalog/container snapshots and invoke pure transfer functions. The module has no hidden registry and does not import browser runtime, UI, render, simulation, flight, or Ship Builder code.

## Starter Catalog (Provisional Values)

All starter quantities, masses, volumes, and base values are provisional v1 data for deterministic contract coverage rather than tuned economy balance.

| Resource ID | Category | kg/unit | m³/unit | Base credits | Stack rule |
| --- | --- | ---: | ---: | ---: | --- |
| `ore_iron_silicate` | `raw_ore` | 8 | 0.004 | 4 | Bulk, max 500, split allowed |
| `volatile_water_ice` | `volatile_fuel` | 1 | 0.0012 | 6 | Bulk, max 500, split allowed |
| `component_scrap_electronics` | `component` | 0.75 | 0.001 | 24 | Bulk, max 50, split allowed |
| `material_structural_plate` | `refined_material` | 5 | 0.003 | 30 | Bulk, max 100, split allowed |
| `fuel_refined_propellant` | `fuel` | 1 | 0.0013 | 8 | Bulk, max 1000, split allowed |
| `ammo_ballistic_powder` | `ammo_material` | 0.5 | 0.0006 | 18 | Bulk, max 100, split allowed |
| `sample_geology_core` | `research_sample` | 0.25 | 0.0004 | 120 | Discrete, max 1, split forbidden |
| `cargo_mission_sealed_crate` | `mission_cargo` | 50 | 0.08 | 0 | Sealed, max 1, split forbidden |

Categories are validated catalog records rather than a closed enum. Definitions carry typed metadata for tags, hazards, legal status, ownership implications, default use, and namespaced extensions.

## Generic Container Contract

One `ResourceContainerDefinition` / `ResourceContainerState` / `ResourceContainerSnapshot` model supports all eight kinds:

1. `Suit`
2. `ShipCargo`
3. `DroneCargo`
4. `OutpostStorage`
5. `CargoModule`
6. `ExternalRack`
7. `MissionCargo`
8. `MiningNodeReservoir`

Definitions set mass, volume, and stack-count capacity. Generic policies can allow or block categories, tags, and hazards; restrict actors or owners; require `Any` or `OwnerOnly` ownership; and set partial transfer to `Allowed` or `Forbidden`. Optional inbound, outbound, or bidirectional transfer ports can restrict actors without creating per-container transfer engines.

Snapshots derive mass, volume, remaining capacity, resource totals, hazard/legal summaries, and a canonical signature from state. Mission, ownership, legal, sealed, and namespaced extension metadata remain on the relevant state/stack data. A `MiningNodeReservoir` additionally derives depletion from immutable initial and remaining contents.

## Transfer Contract

`transferResource(command, catalog, source, target)` returns one stable status:

- `Accepted`
- `PartiallyAccepted`
- `Rejected`

The public rejection vocabulary is:

`UnknownResource`, `UnknownSourceStack`, `QuantityInvalid`, `InsufficientQuantity`, `SourceRevisionConflict`, `TargetRevisionConflict`, `TargetMassExceeded`, `TargetVolumeExceeded`, `TargetStackLimitExceeded`, `ResourceCategoryBlocked`, `ResourceTagBlocked`, `HazardBlocked`, `AccessDenied`, `OwnershipDenied`, `MissionLocked`, `SealedStackCannotSplit`, `PartialTransferNotAllowed`, and `SameContainerTransfer`.

Validation precedence is fixed as: `QuantityInvalid`, `UnknownResource`, `SameContainerTransfer`, `SourceRevisionConflict`, `TargetRevisionConflict`, `UnknownSourceStack`, `InsufficientQuantity`, `AccessDenied`, `OwnershipDenied`, `MissionLocked`, `ResourceCategoryBlocked`, `ResourceTagBlocked`, `HazardBlocked`, `TargetMassExceeded`, `TargetVolumeExceeded`, `TargetStackLimitExceeded`, `SealedStackCannotSplit`, and `PartialTransferNotAllowed`.

Accepted transfers increment each source and target revision exactly once. Partial transfers require the command, both containers, and the resource's stack rule to permit splitting. A rejected transfer keeps the original source and target snapshots, revisions, signatures, and contents unchanged. Full and partial results preserve compatible stack metadata; retained source stack IDs remain stable, supplied target IDs are honored when compatible, and derived target IDs are deterministic.

## Deterministic And Immutable Guarantees

- Input definitions, stacks, states, and extension objects are validated, cloned, canonically ordered, and frozen.
- Canonical JSON recursively sorts object keys while retaining semantic array order; signatures are synchronous and byte-stable.
- Equivalent catalog registration order and input stack order produce the same canonical data/signatures.
- The module has no clock, random IDs, mutable global registry, runtime side effect, or UI state.
- Rejections are atomic; accepted snapshots are new values rather than mutations of caller input.

## Extension Seams

- `ResourceRequirement` validates finite positive quantities against a supplied catalog. It is intentionally neutral so later Ship Builder/recipe code can consume the contract without importing an implementation.
- `extractFromMiningReservoir` uses the same pure transfer engine and only accepts a `MiningNodeReservoir` source; its snapshot exposes deterministic depletion. It does not implement mining gameplay.

## Evidence

`apps/weltraum-browser/tests/e2e/resource-cargo-core.spec.ts` loads the normal `/` page, proves `TestBridge` is absent from the window/body/debug HUD, dynamically imports `/src/resources/index.ts`, and runs deterministic full, capacity-limited partial, mission-locked, and sealed-split flows. It writes only:

- `apps/weltraum-browser/evidence/browser-resource-cargo-inventory-core-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-resource-cargo-inventory-core-v1.md`

## Explicitly Deferred

- Player UI, inventory screens, HUD, runtime wiring, render/simulation integration, and normal-page interaction.
- Economy pricing, sales, fines, factions, missions consequences, or cargo market behavior.
- Mining gameplay, extraction progression, world nodes, drones, or outpost gameplay loops.
- Flight mass/authority/autopilot mutation and cargo effects on current flight behavior.
- Ship Builder integration, recipes, part unlocks, or builder UI; only the neutral `ResourceRequirement` seam is present.
