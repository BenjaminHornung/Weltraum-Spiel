# Target Registry Data Model

## ADDED Requirements

### Requirement: Stable target registry

The target registry SHALL use stable IDs and a normalized schema for all runtime target entries.

#### Scenario: Stable ID registration

- GIVEN a valid ship or damageable body appears
- WHEN it is registered
- THEN it SHALL receive a stable registry ID that does not change within the session lifespan unless explicitly deregistered.

### Requirement: Fast filtering and metadata

Target lookup for hot loops SHALL use compact metadata, not full component discovery.

#### Scenario: Filter without scene scan

- GIVEN a hit/cull worker needs target state
- WHEN filtering target candidates
- THEN it SHALL read compact registry metadata and avoid per-item Unity scene search.

### Requirement: Dirty-state handling

Target registry updates SHALL mark entries dirty and propagate minimum required invalidation.

#### Scenario: Dirty target update

- GIVEN a target transform or team state changes
- WHEN a snapshot is prepared
- THEN only affected target entries and dependent caches SHALL be marked dirty.

### Requirement: Main-thread ownership writes

Target registry writes (add/remove/update) that involve Unity object lifecycle SHALL stay on main thread.

#### Scenario: Safe owner mutation

- GIVEN a target is destroyed or disabled
- WHEN registry cleanup runs
- THEN cleanup SHALL be requested on main-thread apply boundary, not in burst/job math paths.
