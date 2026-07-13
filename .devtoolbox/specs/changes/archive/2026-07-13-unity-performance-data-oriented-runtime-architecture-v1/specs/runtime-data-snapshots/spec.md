# Runtime Data Snapshots

## ADDED Requirements

### Requirement: Snapshot ownership and immutability

The runtime SHALL produce contiguous snapshots for hot-path participants, and each snapshot for a frame SHALL be immutable while worker phases execute.

#### Scenario: Immutable frame snapshot

- GIVEN a simulation step is started for frame `N`
- WHEN snapshot collection is completed
- THEN no worker-side write operation SHALL mutate snapshot-backed state for that same frame.

### Requirement: Bounded snapshot allocation

Hot paths SHALL avoid per-frame managed allocation growth during snapshotting.

#### Scenario: Capacity-limited snapshots

- GIVEN the system processes `M` active runtime participants in a frame
- WHEN the snapshot is built
- THEN snapshot buffers SHALL be reused where possible and MAY resize only under explicitly documented growth policy.

### Requirement: Stable IDs and frame versioning

Snapshot entries SHALL reference participants by stable runtime IDs and snapshot version for stale-read protection.

#### Scenario: Stale snapshot read rejection

- GIVEN a cached snapshot entry from frame `N-1`
- WHEN a job requests data during frame `N`
- THEN the runtime SHALL ignore stale entries unless an explicit transition path is defined by version bump.

### Requirement: Hot path data minimization

Snapshots SHALL include only fields required by hot-path numeric computation.

#### Scenario: Non-essential fields excluded

- GIVEN a hot-path consumer requests projectile or target work data
- WHEN the snapshot schema is inspected
- THEN only blittable, numeric, and ID-based fields SHALL be present in the required compute lane.
