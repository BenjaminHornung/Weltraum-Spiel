# Capability: Autopilot Large Local Test Range

## Capability

The project shall define a future deterministic local-space test range that validates waypoint autopilot behavior at kilometer scale after exact point arrival is fixed.

## Requirements

### Requirement: Exact-arrival prerequisite

The range SHALL depend on `fix-autopilot-exact-point-arrival-v1` passing before implementation or acceptance use begins.

The range SHALL NOT be used to relax current arrival thresholds or mask known exact-arrival failures.

#### Scenario: Implementation is blocked before exact arrival passes

- GIVEN `fix-autopilot-exact-point-arrival-v1` is incomplete or failing
- WHEN implementation of the large local test range is considered
- THEN the range remains blocked
- AND the current exact-arrival fix remains the active prerequisite.

### Requirement: Local-space-only navigation

The range SHALL test local Unity-space autopilot behavior at 1km, 5km, and 10km distances.

The range SHALL NOT model orbital navigation, gravity assist, planetary transfer mechanics, or a final game map.

#### Scenario: Long local transfer remains non-orbital

- GIVEN a 10km target inside the local test range
- WHEN the autopilot plans and flies to the target
- THEN the scenario evaluates local-space transfer, braking, obstacle handling, and hold behavior
- AND it does not evaluate gravity, orbit insertion, slingshot routing, or map streaming.

### Requirement: Deterministic scenario construction

The range SHALL construct ships, targets, obstacles, and initial runtime state deterministically for every scenario.

The range SHALL run from programmatic setup and SHALL NOT require authored Unity scenes or new assets.

#### Scenario: Repeatable large local scenario

- GIVEN the same scenario definition and baseline autopilot implementation
- WHEN the 5km direct scenario runs twice
- THEN start state, target state, obstacle state, sampled metrics, and pass/fail result are repeatable within declared physics tolerances.

### Requirement: Kilometer-distance matrix

The range SHALL include direct transfer scenarios at 1km, 5km, and 10km.

Each direct transfer scenario SHALL evaluate exact target error, final relative speed, lateral speed, angular speed, autopilot terminal state, and phase stability.

#### Scenario: Direct distance coverage

- GIVEN the exact-arrival baseline is passing
- WHEN the range runs direct 1km, 5km, and 10km scenarios
- THEN each scenario reaches and holds the requested point within its declared gate
- AND evidence records any distance-scaled degradation.

### Requirement: Lateral-start coverage

The range SHALL include lateral-start scenarios where the ship begins offset from the target line and/or with lateral velocity.

The range SHALL verify that lateral motion is removed before final completion.

#### Scenario: Lateral start settles before completion

- GIVEN the ship starts 5km from the target with non-trivial lateral velocity
- WHEN the autopilot completes the route
- THEN final lateral speed is within the declared gate
- AND the ship does not report completion while sliding past the target.

### Requirement: Obstacle-corridor coverage

The range SHALL include deterministic obstacle corridors that force avoid and reacquire behavior at kilometer scale.

Obstacle scenarios SHALL verify avoidance, reacquire, final direct approach, and arrival quality.

#### Scenario: Corridor reacquires the target

- GIVEN obstacles form a corridor between the ship and a 5km target
- WHEN the autopilot navigates through the corridor
- THEN evidence shows obstacle avoidance and reacquire phases
- AND the ship returns to a final direct approach before completion.

### Requirement: Return-to-origin coverage

The range SHALL include return-to-origin scenarios that start away from local origin, navigate to a target, then return to the origin or an origin-adjacent marker.

Return-to-origin scenarios SHALL verify accumulated drift, residual velocity, local coordinate magnitude, and terminal hold.

#### Scenario: Return does not accumulate local drift

- GIVEN the ship has completed an outbound 10km local transfer
- WHEN the return-to-origin scenario runs
- THEN the ship settles near the requested origin marker
- AND final offset and velocity remain within declared gates.

### Requirement: Floating Origin readiness evidence

The range SHALL collect readiness evidence for a future Floating Origin layer without implementing origin shifting.

Readiness evidence SHALL include maximum local coordinate magnitude, local precision symptoms, and assumptions that would need absolute/local state separation.

#### Scenario: Readiness notes are produced without shifting origin

- GIVEN a 10km local-space run completes
- WHEN evidence is written
- THEN the summary identifies maximum local coordinate magnitude and any precision-sensitive drift
- AND it does not perform an origin shift.

### Requirement: UI readability at kilometer scale

The range SHALL verify that existing autopilot navigation UI remains readable for 1km, 5km, and 10km scenarios.

UI readability evidence SHALL cover distance formatting, target labels, planner/radar text, arrival state, overlap, and truncation at common viewport sizes.

#### Scenario: Kilometer labels remain readable

- GIVEN the player-facing navigation UI is visible during a 10km scenario
- WHEN distance and arrival state are shown
- THEN kilometer-scale labels are legible and consistently formatted
- AND critical autopilot, planner, radar, and target text does not overlap or truncate.

### Requirement: Isolated additive implementation

The future range SHALL be additive and separate from the current autopilot proving-ground harness.

The future range SHALL NOT require modifying current autopilot harness files unless a later approved implementation change explicitly extracts shared utilities with its own verification.

#### Scenario: Existing harness remains authoritative

- GIVEN the large local range is added in a future change
- WHEN short-range exact-arrival behavior needs verification
- THEN `autopilot-proving-ground-harness-v1` remains the authority
- AND the large local range only extends coverage after that authority passes.
