# Capability: Prototype Legacy Boundary

## Summary

The project shall treat the current Prototype runtime as a legacy/reference boundary while Clean Core is built in parallel under `Assets/_Weltraum`.

This capability is planning-only for the audit change and does not authorize runtime, scene, prefab, or asset edits by itself.

## ADDED Requirements

### Requirement: Prototype remains legacy/reference

`Assets/Scripts/Prototype` and `Assets/Scenes/PrototypeBootstrapHost.unity` shall be treated as legacy/reference surfaces. New product architecture shall not be extended there unless a later approved spec explicitly allows a targeted adapter or fix.

#### Scenario: A future slice needs Prototype behavior

- GIVEN a future Clean Core slice needs current gameplay semantics
- WHEN the slice is designed
- THEN Prototype is used as reference and evidence
- AND the slice does not add new product logic to Prototype files by default.

### Requirement: Clean Core may read only through snapshots

Clean Core may read Prototype state only through immutable snapshots, DTOs, recorded evidence summaries, or command outputs emitted by approved adapters.

#### Scenario: Autopilot state is exposed later

- GIVEN a future navigation slice needs ship authority and route state
- WHEN the adapter is designed
- THEN it emits a snapshot or DTO
- AND Clean Core consumes that snapshot, not a Prototype MonoBehaviour instance.

### Requirement: Clean Core must not depend on Prototype implementation types

Clean Core shall not directly reference Prototype MonoBehaviours, Prototype scene wiring, or renderer classes such as IMGUI/uGUI presenters.

#### Scenario: A UI presenter is introduced later

- GIVEN a future HUD or map presenter is added
- WHEN the implementation is reviewed
- THEN the presenter may depend on ViewModels and Commands
- AND it must not call into Prototype internals as its business source.

### Requirement: Adapter seams are narrow and explicit

Only scene composition roots, presenters, snapshot mappers, and test/evidence harnesses may bridge Prototype to Clean Core.

#### Scenario: A bridge service is created later

- GIVEN a bridge service converts Prototype state into a core DTO
- WHEN the service is reviewed
- THEN it contains conversion and wiring only
- AND it does not own route planning, combat decisions, or ship authority rules.

### Requirement: Autopilot and Flight are the first authority-bearing migration targets

Autopilot and Flight semantics shall be migrated first as authority-bearing contracts, before UI polish, camera cleanup, or scene bootstrap refactors are treated as product work.

#### Scenario: A new product slice is planned

- GIVEN a future migration plan is being drafted
- WHEN the plan orders the first adapter slice
- THEN it starts with autopilot and flight snapshots
- AND it does not start with bootstrap or camera cosmetic work.

### Requirement: Proving-ground evidence is authoritative

Prototype proving-ground tests and related regression/evidence artifacts shall remain the authority for current behavior until a new Clean Core harness supersedes them.

#### Scenario: A future autopilot claim is made

- GIVEN someone claims a new planner/executor behavior is correct
- WHEN the claim is accepted
- THEN it is backed by targeted EditMode/PlayMode tests and evidence outputs
- AND it is not accepted on prose alone.

### Requirement: Legacy surfaces remain reference material only

Legacy IMGUI surfaces, debug overlays, and bootstrap-only wiring shall remain diagnostic/reference material and shall not become the product contract for future features.

#### Scenario: A debug surface is reused

- GIVEN a future slice needs a debug display
- WHEN the display is implemented
- THEN the display may observe the current state
- AND it must not own the gameplay rules it shows.
