# Resource Cargo Inventory Core Capability

## ADDED Requirements

### Requirement: Stable extensible resource catalog
The system SHALL expose runtime-validated stable resource/category/catalog identities, extensible category records, validated discriminated stack rules, immutable catalog snapshots, and byte-stable canonical signatures independent of registration order.

#### Scenario: Starter catalog
Creating the starter catalog yields exactly addressable definitions for `ore_iron_silicate`, `volatile_water_ice`, `component_scrap_electronics`, `material_structural_plate`, `fuel_refined_propellant`, `ammo_ballistic_powder`, `sample_geology_core`, and `cargo_mission_sealed_crate`, with explicit provisional finite non-negative mass, volume, and value metadata.

#### Scenario: Invalid catalog data
Duplicate IDs, unknown categories, malformed IDs, invalid stack rules, and negative or non-finite numeric metadata are rejected deterministically.

#### Scenario: Requirement seam
Resource requirements validate finite positive quantities and reject resource IDs absent from the supplied catalog without importing Ship Builder code.

### Requirement: Generic immutable containers
The system SHALL represent suit, ship cargo, drone cargo, outpost storage, cargo module, external rack, mission cargo, and mining node reservoir with one definition/state/snapshot model and derived mass, volume, stack, totals, hazard, legality, capacity, depletion, and signature fields.

#### Scenario: Order-independent snapshot
Equivalent contents in different input stack orders produce the same canonical contents, aggregates, canonical JSON, and signature while leaving input arrays unchanged.

#### Scenario: Policy filtering
Explicit blocked categories, tags, or hazards make the target ineligible; allowed risky hazards may produce warnings but no invented external consequences.

#### Scenario: Mission and reservoir metadata
Mission/sealed/ownership/legal metadata survives snapshots and transfers, and reservoir depletion derives deterministically from remaining canonical contents.

### Requirement: Explicit pure transfer commands
`transferResource(command, resourceCatalog, sourceState, targetState)` SHALL return Accepted, PartiallyAccepted, or Rejected with accepted/rejected quantity, signatures, deltas, revisions, ordered issues/warnings, and updated states, without mutating inputs.

#### Scenario: Full acceptance
A permitted request with sufficient quantity and capacity transfers the full quantity, preserves metadata, returns new canonical states, and increments source and target revisions exactly once.

#### Scenario: Capacity partial acceptance
AllowPartial mode accepts the deterministic maximum permitted by mass/volume/stack capacity only when stack and both relevant policies permit splitting; the retained source stack keeps its stack ID.

#### Scenario: Atomic rejection
Atomic mode with any shortfall returns Rejected, zero accepted quantity, unchanged revisions/signatures/state values, and stable issues.

#### Scenario: Conflicts and replay
Source or target revision mismatch rejects. Replaying an accepted command against the old expected revisions rejects deterministically.

#### Scenario: Mission lock and same container
Mission-locked/sealed split attempts and same-container requests reject with the specified stable code.

### Requirement: Stable diagnostics
The engine SHALL use the requested stable rejection vocabulary: UnknownResource, UnknownSourceStack, QuantityInvalid, InsufficientQuantity, SourceRevisionConflict, TargetRevisionConflict, TargetMassExceeded, TargetVolumeExceeded, TargetStackLimitExceeded, ResourceCategoryBlocked, ResourceTagBlocked, HazardBlocked, AccessDenied, OwnershipDenied, MissionLocked, SealedStackCannotSplit, PartialTransferNotAllowed, and SameContainerTransfer. Issue and warning ordering SHALL be stable.

### Requirement: Browser-only compatibility evidence
A Playwright test SHALL load normal `/`, verify TestBridge absence, dynamically import the resource index module, run full suit-to-ship, partial, and mission-locked rejection flows, verify deterministic signatures, and write task-owned JSON/Markdown evidence without changing normal runtime behavior.