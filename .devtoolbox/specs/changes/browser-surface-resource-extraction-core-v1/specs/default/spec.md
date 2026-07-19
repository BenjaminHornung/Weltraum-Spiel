# Surface Resource Extraction Core V1

## Requirement: Versioned surface resource nodes

The core SHALL model versioned node definitions and immutable node state with stable IDs, Surface Frame ownership, local position, revision, Resource Core reservoir snapshot, exposure/depletion/claim state, active session identity, and canonical signatures.

### Scenario: Hidden composition before scan

Before a successful scan, callers SHALL NOT receive identified composition, grade, quantity estimates, hazards, or protected legal facts through node presentation outputs.

## Requirement: Deterministic scanning

Scanning SHALL return node ID/revision, confidence, identified resource, estimated grade and quantity, hazards, legal/ownership facts, required capability, environment signature, and a deterministic signature derived only from explicit inputs.

### Scenario: Identical scan inputs

Two scans with identical inputs SHALL produce byte-identical canonical results.

## Requirement: Explicit readiness and blocking

Preparation SHALL evaluate tool, capability, equipment, suit, planetary environment, depletion, revisions, legality, ownership, target capacity, hazard containment, and active-session conflicts.

The typed block reason set SHALL include ToolMissing, CapabilityMissing, EquipmentNotReady, SuitNotReady, EnvironmentUnsafe, NodeDepleted, NodeRevisionConflict, SessionRevisionConflict, IllegalExtraction, OwnershipDenied, TargetCapacityExceeded, HazardContainerRequired, ActiveSessionConflict, and InvalidPulse.

## Requirement: Revisioned extraction lifecycle

A stable extraction session SHALL move explicitly through Prepared, Active, Paused, Completed, Blocked, and Cancelled states. Begin, pause, resume, cancel, and pulse commands SHALL validate expected revisions and active-session ownership.

### Scenario: Ordered pulses

A pulse SHALL require an explicit tick delta and the next pulse index. Out-of-order, stale, invalid, or duplicate commands SHALL not mutate authority snapshots or double-transfer resources.

## Requirement: Deterministic extraction yield

Pulse yield SHALL use only the node definition, grade, equipment stats, pulse index, explicit deterministic seed/sequence, and environment modifiers. Global Random, Date/time, DOM, Three.js, and implicit mutable state are forbidden.

### Scenario: Identical pulse inputs

Identical pulse inputs SHALL produce identical extracted quantities, transfer results, snapshots, intents, and signatures.

## Requirement: Resource Core transfer authority

Extraction SHALL transfer material using the public Resource Core reservoir/container/transfer API. The extraction module SHALL NOT implement a second container model or transfer engine.

### Scenario: Transfer rejection

Capacity or hazardous-container rejection SHALL preserve atomicity: no reservoir depletion, container increment, or pulse advancement may occur.

## Requirement: Immutable outputs and intents

Definitions, states, scans, sessions, pulses, transfer-bearing results, fixtures, and mission/event intents SHALL be immutable/frozen snapshots. Intents SHALL describe outcomes without dispatching UI or runtime side effects.

## Requirement: Fixture and verification matrix

The module SHALL provide iron-silicate vein, water-ice deposit, geological sample core, contaminated biological sample, claimed illegal node, depleted node, insufficient suit-container capacity, and mining-drone transfer fixtures.

Focused unit tests SHALL cover scan confidence, hidden composition, readiness, legality/ownership, deterministic yield, pulse ordering, revision CAS, transfer success/rejections, depletion, active-session conflict, pause/resume/cancel, idempotency, immutability, and forbidden globals.

A Playwright proof on port 5237 SHALL use normal `/`, keep `window.TestBridge` absent, dynamically import only `/src/surface-extraction/index.ts`, execute scan → prepare → three pulses → transfer → depletion update twice byte-identically, and report browser health 0/0/0/0.
