# Camera-RCS Cache Dirty Flags

## ADDED Requirements

### Requirement: Cache ownership and dirty tracking

Camera and RCS cache layers SHALL use dirty flags to avoid unnecessary recomputation.

#### Scenario: No recompute when clean

- GIVEN all relevant camera/RCS inputs are unchanged since last frame
- WHEN the runtime checks dirty flags
- THEN no forced rebuild of camera/RCS-derived caches SHALL occur.

### Requirement: Granular dirty partitions

Dirty flags SHALL be split by partition (camera geometry, thrust vector cache, RCS matrix cache) for minimum scope updates.

#### Scenario: Partial cache refresh

- GIVEN only RCS values changed
- WHEN recomputing
- THEN camera geometry caches SHALL remain untouched.

### Requirement: Main-thread apply and read consistency

Dirty flags SHALL be written on main thread and consumed by snapshot/apply passes with version checks.

#### Scenario: Version mismatch reject

- GIVEN a cached camera/RCS entry with outdated dirty version
- WHEN accessed during frame execution
- THEN it SHALL be treated as invalid and recomputed in the controlled apply path.

### Requirement: Hot path protection

Camera/RCS hot loops SHALL avoid unconditional array recreation and per-frame expensive derived recalculation.

#### Scenario: Stable cache across unchanged frames

- GIVEN N frames with no dirty change
- WHEN runtime simulation runs
- THEN cache entry object count and runtime allocations SHALL remain bounded and unchanged.
