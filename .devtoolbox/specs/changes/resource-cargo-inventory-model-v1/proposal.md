# Resource Cargo Inventory Model v1 Proposal

## Summary

Create a planning-only package for a shared resource, cargo and inventory model. The package connects planet mining, suit inventory, ship cargo, drones, outposts, modular ship parts, fuel, ammo, repairs, ship-builder costs, mission cargo and economy through one resource identity vocabulary and one container/transfer contract.

## Motivation

Recent planning docs define planet resources, mining, on-foot inventory limits, outpost cargo services and modular ship-builder parts. Those systems will drift if each implementation slice creates local resource names, private cargo rules or one-off capacity logic.

This change establishes the planning contract before runtime implementation begins:

- resource IDs are stable and shared,
- containers enforce mass and volume,
- transfers are explicit and testable,
- ship cargo mass can later feed physics and autopilot estimates,
- builder costs, mining nodes and economy tables reference the same IDs.

## Scope

In scope:

- resource identity model fields,
- starter resource catalog direction,
- container types and common capacity rules,
- transfer rules between suit, ship, drone, node and outpost storage,
- mission cargo, ownership and faction restrictions,
- resource uses for fuel, ammo, repairs, builder costs, upgrades, research, trade and smuggling,
- v0 economy and balancing guidance,
- future implementation slices,
- formal DevToolbox spec requirements.

Out of scope:

- runtime code,
- tests,
- Unity scenes,
- assets,
- UI,
- prefabs,
- ScriptableObjects,
- final pricing formulas,
- final crafting trees,
- final market simulation,
- autopilot implementation changes.

## User / Developer Outcome

Future implementation work can add mining, cargo transfer, ship builder costs, fuel/ammo and economy without inventing duplicate data models. Designers get a small starter resource set and clear growth path. Developers get explicit contracts for IDs, containers, transfers, capacity checks, ownership and aggregate cargo mass.

## Non-Goals

- Do not implement inventory or cargo runtime behavior in this change.
- Do not create Unity assets, scenes, prefabs, ScriptableObjects, tests or UI.
- Do not modify current autopilot or harness files.
- Do not create a full production-chain economy.
- Do not define a final balance table for every future resource.

## Success Criteria

- The two concept docs exist and explain the shared model and balancing v0.
- The DevToolbox proposal, design, tasks and spec exist under `resource-cargo-inventory-model-v1`.
- Formal requirements cover shared resource identity, containers, transfers, cargo mass, ship-builder costs, mining outputs and economy/faction references.
- `specs_validate resource-cargo-inventory-model-v1` succeeds.
- Only allowed Markdown/spec files are committed.
