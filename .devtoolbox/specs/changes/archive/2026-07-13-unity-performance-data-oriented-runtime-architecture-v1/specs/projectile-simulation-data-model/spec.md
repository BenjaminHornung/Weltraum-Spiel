# Projectile Simulation Data Model

## ADDED Requirements

### Requirement: Request/result separation

Projectile simulation SHALL separate input requests, active state records, and impact outputs.

#### Scenario: Distinct model lanes

- GIVEN a shot is accepted
- WHEN the projectile path is processed
- THEN the request record SHALL be distinct from the mutable active-record and the emitted impact record.

### Requirement: Blittable payloads for simulation lanes

The projectile simulation model used in job-ready phases SHALL avoid managed references and non-blittable members in job inputs.

#### Scenario: Burst-compatible projectile lane

- GIVEN a projectile record enters the job candidate path
- WHEN the struct schema is validated
- THEN it SHALL contain only blittable primitives, fixed-size arrays (where needed), and stable IDs.

### Requirement: Deterministic state transitions

Projectile active-record transitions SHALL be explicit and bounded for time step, hit detection, and lifetime expiry.

#### Scenario: Consistent completion path

- GIVEN an active projectile record reaches a terminal condition
- WHEN the step finalizes
- THEN it SHALL transition to `Hit`, `Expired`, or `Noop` deterministically and emit a bounded result event.

### Requirement: Safe first refactor path

The initial phase SHALL keep gameplay meaning identical while removing per-shot side effects from the hot path.

#### Scenario: Legacy fallback permitted

- GIVEN the model is in safe-refactor phase
- WHEN a projectile mode is not yet moved to job-thread execution
- THEN legacy main-thread handling MAY be used as a controlled fallback.
