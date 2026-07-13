# default Specification Delta

## ADDED Requirements

### Requirement: Reproducible external-project provenance

The project SHALL provide a research audit for all named external projects that
records canonical URL, inspected commit SHA and date, branch or tag, license and
license path, inspected source paths, and Build/Test/Demo/Browser status.

#### Scenario: A material external claim is made

- **WHEN** the audit states a material capability, limitation, maturity or
  architecture conclusion
- **THEN** the statement SHALL be classified as `README Claim`, `Code Evidence`,
  `Test Evidence`, `Benchmark Evidence`, `Observed Demo Evidence` or `Inference`
- **AND** it SHALL cite an exact source path, symbol, test, benchmark or observed
  browser artifact.

### Requirement: Architecture comparison preserves local product boundaries

The audit SHALL compare worker topology, data plane, control plane,
client/server authority, persistence, mesher sharing, renderer coupling and
local physics without selecting a foreign engine as the new product base by
default.

#### Scenario: A transferable idea is recommended

- **WHEN** an external idea is recommended for Weltraum-Spiel
- **THEN** the audit SHALL identify the local ownership boundary and adapter or
  contract seam
- **AND** it SHALL distinguish concept extraction from source-code reuse.

### Requirement: Project decisions are explicit and bounded

Each project SHALL receive the requested evaluation dimensions and exactly one
of the allowed final verdicts.

#### Scenario: Follow-up work is proposed

- **WHEN** the audit proposes implementation validation
- **THEN** it SHALL define no more than three concrete later spikes
- **AND** no spike SHALL be implemented by this research change.

### Requirement: Browser evidence does not overclaim architecture

#### Scenario: A browser demo exists and is reachable

- **WHEN** a browser demo is used as evidence
- **THEN** the audit SHALL record visible behavior, console status and network
  status separately
- **AND** temporary screenshots SHALL remain outside the repository
- **AND** internal architecture SHALL still require source evidence.
