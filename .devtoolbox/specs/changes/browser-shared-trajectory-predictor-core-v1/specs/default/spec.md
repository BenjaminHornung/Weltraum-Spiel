# Shared Trajectory Predictor Core v1 Specification

## ADDED Requirements

### Requirement: Explicit deterministic request contract
The system SHALL accept an immutable trajectory request containing predictionId, initial state, ordered segments, one gravity source, explicit per-segment-type integrator policy, positive stepTicks, positive sampleEverySteps, hazards and a tolerance profile. It SHALL use 120 integer Universe ticks per second and SHALL NOT read wall clock, renderer state or randomness.

#### Scenario: Valid explicit request
- GIVEN finite same-frame values and an aligned contiguous timeline
- WHEN prediction runs twice
- THEN both completed results have identical semantic fields and canonical signatures

#### Scenario: Invalid numeric or time input
- GIVEN a nonfinite value, unsafe tick, nonpositive step or nonpositive sample cadence
- WHEN validation runs
- THEN the request is rejected before propagation and no partial arrays are returned

### Requirement: Segment timeline
The system SHALL support GravityCoast, ConstantInertialAcceleration and ImpulseDeltaV only. Continuous segments SHALL be fixed-step, positive-duration and contiguous. Impulses SHALL occur at exact aligned boundary ticks, preserve position and mass and change only velocity. Gaps, unsorted segments, duplicate IDs, ambiguous duplicate impulse ticks and overlap SHALL reject fail-closed.

#### Scenario: Segment overlap
- GIVEN two continuous intervals whose occupied time overlaps
- WHEN prediction is requested
- THEN status is RejectedSegmentOverlap

#### Scenario: Step mismatch
- GIVEN a segment boundary or impulse that does not align to stepTicks
- WHEN prediction is requested
- THEN status is RejectedStepMismatch

### Requirement: Frame consistency
The system SHALL keep initial state, source, segments, hazards, samples and results in one explicit inertial FrameId and SHALL perform no hidden frame transform.

#### Scenario: Frame mismatch
- GIVEN any source or segment frame differing from initialState.frameId
- WHEN validation runs
- THEN status is RejectedFrameMismatch

### Requirement: Integrator policies
The system SHALL implement SemiImplicitEuler, VelocityVerlet and RungeKutta4. The request and result SHALL expose the selected policy. The exported default policy SHALL select VelocityVerlet for GravityCoast and RungeKutta4 for ConstantInertialAcceleration. The system SHALL NOT switch policy implicitly.

#### Scenario: Circular gravity coast
- GIVEN a near-circular one-source fixture and VelocityVerlet
- WHEN one expected period is predicted
- THEN closure and invariant drift satisfy the fixture tolerance

#### Scenario: Constant acceleration and impulse
- GIVEN an aligned ConstantInertialAcceleration interval followed or preceded by ImpulseDeltaV
- WHEN prediction completes
- THEN acceleration affects position/velocity through the selected integrator and the impulse changes velocity only at its exact tick

### Requirement: Linear point-mass source approximation
The system SHALL compute inverse-square gravity from one positive-mu source and SHALL linearly propagate source position from its explicit epoch and velocity at every integrator stage. Result metadata SHALL identify this approximation.

#### Scenario: Numerical singularity
- GIVEN source-relative distance at or below the explicit minimum gravity distance
- WHEN an acceleration evaluation is required
- THEN status is RejectedNumericalFailure and no nonfinite output exists

### Requirement: Swept spherical hazard facts
The system SHALL test every integrated step chord against each spherical hazard's radius plus safety margin. It SHALL report first entry, closest approach and exit when present. Tangency SHALL be inclusive and tolerance-defined. The system SHALL report facts without gameplay action.

#### Scenario: Tunneling
- GIVEN a chord crossing a sphere while neither emitted sample lies inside
- WHEN prediction completes
- THEN a hazard event is reported

#### Scenario: Stable tie
- GIVEN equal closest distances for two hazards
- WHEN closest approaches are ordered
- THEN lexical hazardId resolves the tie

### Requirement: Stable ordering and canonical signature
The system SHALL normalize semantically unordered hazards by stable ID, preserve deterministic timeline order for samples and segment results, and derive one canonical FNV signature from all semantic request/result data except the signature itself and performance timing. Equivalent cadence, boundary and final reasons for an identical state MAY collapse into one sample. Every ImpulsePostState SHALL occupy a separate sample because it is a non-equivalent semantic event, even when a zero or numerically ineffective delta leaves the physical state unchanged; impulses that change velocity remain separate too. An exact-zero delta and a nonzero but numerically ineffective delta SHALL remain canonically distinguishable through their accepted request payload.

#### Scenario: Nonzero but numerically ineffective impulse
- GIVEN an accepted request whose pre-impulse X velocity is 2 ** 53 and whose X delta is 1
- WHEN prediction completes twice and is compared with the otherwise identical exact-zero request
- THEN the nonzero impulse has a separate ImpulsePostState sample even though the stored pre/post velocities are equal
- AND identical runs are deep-equal with identical signatures while the exact-zero request has a different signature

#### Scenario: Hazard insertion order
- GIVEN equivalent requests differing only in hazard array insertion order
- WHEN both complete
- THEN canonical results and signatures are identical

### Requirement: Metrics and tolerance model
The system SHALL report specific orbital energy, specific angular-momentum magnitude, relative drift values, conditional circular closure, maximum step, step count and sample count with explicit tolerance metadata. It SHALL serialize null for inapplicable values and never NaN or Infinity.

#### Scenario: Inapplicable closure
- GIVEN a non-circular or accelerated prediction
- WHEN metrics are produced
- THEN circular closure is explicitly inapplicable and finite remaining metrics are present

### Requirement: Budgeted immutable operation
The system SHALL preflight segment, hazard, step, sample and combined hazard-sweep-work budgets before allocation or integration. V1 SHALL allow at most 250,000 hazard sweep chord checks and SHALL evaluate that limit without multiplication as `hazardCount > 0 && integrationStepCount > floor(250,000 / hazardCount)`. Limit excess SHALL reject without partial results. The system SHALL not mutate caller input and SHALL recursively freeze every result.

#### Scenario: Excessive horizon
- GIVEN a request exceeding the step or sample budget
- WHEN prediction is requested
- THEN status is RejectedBudgetExceeded without uncontrolled allocation

#### Scenario: Combined hazard sweep work limit
- GIVEN a request whose integration-step count multiplied by hazard count would exceed 250,000 chord checks
- WHEN prediction is requested
- THEN status is RejectedBudgetExceeded at `/hazards` before propagation and without partial results

#### Scenario: Mutation attempt
- GIVEN a completed result
- WHEN nested arrays or values are mutated by a caller
- THEN the result remains unchanged and its canonical signature remains valid

### Requirement: Isolation
The trajectory core SHALL contain no Three.js dependency and SHALL not integrate with navigation, flight, autopilot, map, runtime, timewarp or persistence ownership beyond reuse of pure leaf contracts.

#### Scenario: Static dependency audit
- GIVEN the trajectory source tree
- WHEN imports and forbidden APIs are scanned
- THEN no Three.js, navigation, flight, runtime, Date.now, performance.now or Math.random reference exists
