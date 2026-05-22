# Spec: Job Runtime Phases

## ADDED Requirements

### Requirement: Data-only job inputs and outputs

Job-system runtime phases SHALL operate only on value structs and `NativeArray` buffers.

#### Scenario: Job source has no Unity hierarchy references

- **GIVEN** job-system source files
- **WHEN** source guards inspect the job structs and execute methods
- **THEN** they SHALL find no `Transform`, `GameObject`, `Renderer`, `Rigidbody`, `Component`, `Collider`, `GetComponent`, `GetComponentsInChildren`, `FindObjectsByType`, `Instantiate`, or `Destroy` usage inside jobs.

### Requirement: Projectile integration job

Projectile integration SHALL compute next positions, previous positions, age, and alive flags from projectile snapshots.

#### Scenario: Job path matches scalar projectile integration

- **GIVEN** deterministic projectile snapshots
- **WHEN** scalar and job paths integrate the same timestep
- **THEN** output position, previous position, age, and alive status SHALL match within floating-point tolerance.

### Requirement: Target scoring job

Target scoring SHALL compute distance, angle alignment, health fraction, lead estimate, and priority score per target.

#### Scenario: Job path matches scalar target scoring

- **GIVEN** deterministic target snapshots and scoring settings
- **WHEN** scalar and job paths score all targets
- **THEN** scores and selected best target SHALL match.

### Requirement: Trajectory candidate job

Trajectory candidate evaluation SHALL score independent candidate trajectories.

#### Scenario: Job path matches scalar trajectory evaluation

- **GIVEN** deterministic candidate inputs
- **WHEN** scalar and job paths evaluate the candidates
- **THEN** candidate scores and selected best candidate SHALL match.

### Requirement: Sensor filtering job

Sensor/minimap filtering SHALL compute visibility, distance, direction, and priority per contact.

#### Scenario: Job path matches scalar sensor filtering

- **GIVEN** deterministic sensor contacts
- **WHEN** scalar and job paths filter contacts
- **THEN** visibility and priority outputs SHALL match.

### Requirement: RCS allocation scoring job

RCS allocator math SHALL compute independent nozzle scores and recommended throttle from cached nozzle data.

#### Scenario: Job path matches scalar RCS nozzle scoring

- **GIVEN** deterministic nozzle snapshots and desired force/torque
- **WHEN** scalar and job paths score nozzles
- **THEN** throttle and contribution scores SHALL match.

### Requirement: Measurable performance evidence

The change SHALL produce reproducible scalar/job timings and store them as test artifacts.

#### Scenario: Benchmark artifacts are generated

- **GIVEN** the performance validation test runs
- **WHEN** benchmarks complete
- **THEN** CSV and Markdown artifacts SHALL exist under the change `tests/performance` folder and include speedup ratios for all implemented phases.
