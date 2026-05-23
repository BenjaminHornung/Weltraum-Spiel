# default Specification Delta

## ADDED Requirements

### Requirement: Player UI concept runtime audit matrix
The project SHALL provide an evidence matrix for `docs/player-facing-ui-concept-v0.md` sections 3-8 that maps each v0 player-facing UI requirement to current implementation and verification evidence.

#### Scenario: Requirement has implementation and test evidence
- **WHEN** the audit classifies a requirement as `Proven`
- **THEN** it SHALL cite at least one current code/test/runtime artifact that directly covers that requirement.

#### Scenario: Requirement is not fully proven
- **WHEN** the audit cannot prove a requirement from current evidence
- **THEN** it SHALL classify the item as `Partial`, `Missing`, `Deferred`, or `Contradicted`
- **AND** it SHALL explain the next implementation or verification step.

### Requirement: Runtime GameView screenshot matrix
The project SHALL store current Unity runtime GameView evidence for major Player HUD states under this change's `tests/screenshots/` directory.

#### Scenario: Player-facing state captured
- **WHEN** a screenshot is used as evidence
- **THEN** its accompanying protocol SHALL name the state, expected visible surfaces, and runtime probe summary.

#### Scenario: Aspect-ratio evidence captured
- **WHEN** aspect-ratio evidence is produced
- **THEN** it SHALL include a non-16:9 layout probe or screenshot that checks panel overlap/containment.

### Requirement: Verification evidence is scoped and reproducible
The project SHALL record exact Unity MCP and local commands/results used for this audit.

#### Scenario: Generic DevToolbox verifier is blocked by workspace shape
- **WHEN** the root verifier fails due multiple MSBuild files (`MSB1011`)
- **THEN** the audit SHALL record the limitation and the targeted replacement evidence.
