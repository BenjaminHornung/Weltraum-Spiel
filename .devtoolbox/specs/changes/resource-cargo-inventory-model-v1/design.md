# Resource Cargo Inventory Model v1 Design

## Context

The project already has planning docs for on-planet resources, first-person surface play, factions/economy, settlements/outposts and modular ship-builder parts. Those docs all point at the same future systems:

- mining nodes output resources,
- suit inventory carries samples and small valuables,
- ship cargo carries profitable bulk,
- drones shuttle or mine resources,
- outposts store, buy, sell and restrict cargo,
- ship-builder parts need construction costs and cargo module capacity,
- fuel and ammo are recurring resource sinks,
- economy and faction rules depend on legality and ownership,
- cargo mass eventually affects ship performance and autopilot fuel estimates.

This design captures the data model before implementation so later slices can stay compatible.

## Goals

- Use one shared resource identity model across mining, inventory, cargo, builder, fuel, ammo, missions and economy.
- Give every container the same mass/volume/capacity vocabulary.
- Make transfers explicit operations with explainable pass/fail results.
- Keep the first resource set small enough for a playable v0.
- Preserve future hooks for ownership, legality, factions and autopilot mass estimates.

## Proposed Design

### Resource Identity

Every resource will be represented by a stable `resourceId` and metadata. Display names, icons and localization are attached data, not identity. Future implementation should avoid hardcoded display strings in recipes, mining nodes, shop entries or builder costs.

Planned fields:

- `resourceId`
- `displayName`
- `category`
- `massPerUnitKg`
- `volumePerUnitM3`
- `stackRule`
- `rarityTier`
- `tags`
- `legalStatus`
- `ownershipImplication`
- `baseValueCredits`
- `hazardFlags`
- `defaultUse`

### Containers

Suit inventory, ship cargo, drone cargo, outpost storage, cargo module volume, external racks, mission cargo and mining node reservoirs use one shared container vocabulary. They differ by capacity and access rules, not by unrelated data shapes.

Core container fields:

- `containerId`
- `containerType`
- `ownerId`
- `locationRef`
- `maxMassKg`
- `maxVolumeM3`
- `allowedResourceTags`
- `blockedResourceTags`
- `currentMassKg`
- `currentVolumeM3`
- `contents`
- `accessPolicy`
- `transferPorts`

### Transfers

Transfers should be modeled as explicit commands:

```text
TransferResource(sourceContainer, targetContainer, resourceId, quantity, actorId, context)
```

The result reports accepted/rejected quantity, mass and volume deltas, legal/ownership consequences and a clear rejection reason. This supports focused tests later without requiring UI or scenes.

### Economy And Balancing

The first catalog should include only enough resources to prove the loop:

- one bulk ore,
- one volatile/fuel input,
- one salvage/electronics component,
- one refined structural material,
- one refined fuel,
- one ammo material,
- one research sample,
- one mission cargo type.

Mid-game and late-game resources expand only when a new loop needs them.

### Ship Builder Integration

Ship builder costs reference resource IDs, not display names. Cargo module and external rack parts contribute mass/volume capacity metadata. Installed cargo and fuel mass must be aggregate-queryable later for ship physics and autopilot.

### Ownership And Legality

Ownership and legality are data on resource stacks and containers. They allow the same resource ID to be normal cargo, faction-owned cargo, protected sample, mission cargo or illegal goods depending on context.

## Alternatives Considered

### Separate Models Per System

Mining, suit inventory, ship cargo, economy and builder could each define local item types. This is rejected because it creates duplicate names, migration pain and fragile conversion logic.

### Slot-Only Inventory

Pure slot counts are easy for UI, but they do not support cargo mass, volume, ship physics, drone payloads or realistic logistics. The planned model can still expose slots as UI simplification while retaining mass and volume in data.

### Full Economy Simulation First

A dynamic supply-chain economy would be interesting, but it is too broad for the first slice. The design chooses stable IDs, base values and simple location/faction modifiers first.

## Data / Integration Notes

- Resource IDs must be stable across saves.
- Catalog migrations should map retired IDs forward.
- Mining nodes output resource IDs and quantities.
- Ship-builder costs and part metadata reference resource IDs.
- Economy price tables reference resource IDs, categories and tags.
- Cargo mass must be available as aggregate ship data.
- Mission cargo cannot be converted into ordinary trade goods unless a mission explicitly allows it.
- Illegal/restricted cargo should be representable before law enforcement is fully implemented.

## Risks

| Risk | Mitigation |
| --- | --- |
| Resource catalog grows too fast. | Keep v0 starter set small and require a gameplay sink for each new resource. |
| Display names leak into logic. | Require costs, nodes, economy and tests to use resource IDs. |
| Cargo model becomes UI-only. | Make mass/volume fields part of the data contract from the start. |
| Mission cargo bypasses normal rules. | Model mission cargo as resource stacks with extra restrictions. |
| Autopilot consumes too much inventory detail. | Expose aggregate mass/fuel values, not full contents. |

## Verification Strategy

This change is planning/spec-only:

- validate the DevToolbox change with `specs_validate resource-cargo-inventory-model-v1`,
- inspect that only allowed Markdown/spec files changed,
- do not run Unity tests,
- do not run dotnet build/test.
