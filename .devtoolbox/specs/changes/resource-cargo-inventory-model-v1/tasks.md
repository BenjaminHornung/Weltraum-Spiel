# Resource Cargo Inventory Model v1 Tasks

Planning status: this change is documentation/specification only. Future implementation phases are intentionally unchecked.

## Phase 0: Planning Package

- [ ] Create `docs/spielkonzept/resource-cargo-inventory-model.md`.
- [ ] Create `docs/spielkonzept/resource-economy-balancing-v0.md`.
- [ ] Create DevToolbox proposal, design, tasks and `resource-cargo-inventory` spec.
- [ ] Validate `resource-cargo-inventory-model-v1`.

## Phase 1: Resource Catalog v0

- [ ] Define runtime catalog structure for stable resource IDs, display metadata, mass, volume, stack rules, tags, legality and base values.
- [ ] Add the minimal starter resource set.
- [ ] Add validation that resource IDs are unique and referenced IDs exist.
- [ ] Add migration notes for retired or renamed resource IDs.

## Phase 2: Generic Container Model

- [ ] Implement shared container data for suit, ship, drone, outpost, cargo module, external rack, mission cargo and mining node reservoirs.
- [ ] Enforce mass, volume, stack, allowed-tag and blocked-tag constraints.
- [ ] Expose current mass and volume as derived values.
- [ ] Add focused tests for full, partial and rejected capacity cases.

## Phase 3: Ship Cargo Component

- [ ] Add ship cargo storage using the generic container model.
- [ ] Read cargo capacity from installed cargo-module metadata when available.
- [ ] Expose aggregate cargo mass to future ship physics/autopilot consumers.
- [ ] Add tests for loading, unloading and mass aggregation.

## Phase 4: Suit Inventory Model

- [ ] Add suit inventory container rules for samples, tools, ammo and compact salvage.
- [ ] Enforce lower mass/volume limits than ship cargo.
- [ ] Preserve mission and ownership metadata on carried stacks.
- [ ] Add tests for suit-to-ship transfer readiness.

## Phase 5: Cargo Transfer Interaction

- [ ] Implement explicit transfer commands and result objects.
- [ ] Support suit-to-ship, ship-to-outpost, drone-to-ship and node-to-target transfers.
- [ ] Include capacity, ownership, faction, mission and legality rejection reasons.
- [ ] Add tests for atomic and partial transfer behavior.

## Phase 6: Mining Node Output

- [ ] Represent mining nodes as reservoirs with resource IDs, quantities, grade, owner and hazard metadata.
- [ ] Route extracted output into target containers instead of special-case inventory writes.
- [ ] Persist depletion and partial extraction.
- [ ] Add tests for node output, full target containers and ownership warnings.

## Phase 7: Ship Builder Cost Integration

- [ ] Reference resource IDs from ship-builder part cost metadata.
- [ ] Validate that all cost IDs exist in the resource catalog.
- [ ] Connect cargo module part metadata to ship cargo capacity.
- [ ] Keep visual part sockets and resource costs separate but cross-referenceable.

## Phase 8: Economy Price Table

- [ ] Define base price table by resource ID.
- [ ] Add simple location, faction relation, legality and condition modifiers.
- [ ] Add outpost demand profiles for starter locations.
- [ ] Add tests for legal, restricted, illegal and mission-locked resources.

## Phase 9: Evidence And Balancing Review

- [ ] Capture transfer and cargo-mass test evidence under the future implementation change.
- [ ] Review the starter resource list after a playable mining-transfer loop exists.
- [ ] Tune mass, volume and value values using observed playtest friction.
