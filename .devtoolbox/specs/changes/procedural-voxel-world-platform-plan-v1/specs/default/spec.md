# default Specification Delta

## ADDED Requirements

### Requirement: Research integration preserves provenance and scope

The planning change SHALL integrate only the four named Research commits after
verifying their remote SHA, common base, commit count and file allowlist.

#### Scenario: A Research commit is accepted

- **WHEN** a Research commit is applied to the planning branch
- **THEN** its diff SHALL contain only its named Research document and five
  Markdown DevToolbox artifacts
- **AND** no external Source, binary, image or capture SHALL be imported.

### Requirement: Platform planning defines renderer-independent world authority

The architecture SHALL define World State and Voxel State independently from
Three.js and SHALL treat Three.js as a replaceable rendering adapter.

#### Scenario: A runtime representation changes level of detail

- **WHEN** a coarse representation is replaced by a finer Surface Tile or local
  Voxel Brick
- **THEN** world identity and simulation authority SHALL remain stable
- **AND** the coarse representation SHALL remain active until the finer result
  is ready.

### Requirement: Planet and persistence representations remain explicit

The documentation SHALL separate planetary macro data, Surface Tiles and local
Voxel Bricks and SHALL persist reconstructable seeds, versions, semantic state
and deltas rather than renderer objects.

#### Scenario: Authored content modifies a procedural world

- **WHEN** a city or story hotspot occupies a procedural region
- **THEN** the authored layer SHALL override the procedural basis through a
  stable, versioned placement identity
- **AND** persistence SHALL record semantic changes and voxel deltas separately.

### Requirement: External references receive bounded decisions

Every named reference SHALL receive exactly one allowed Adoption Matrix
category without presenting Research as an implementation decision.

#### Scenario: Source reuse is considered

- **WHEN** a reference is classified as an isolated code reuse candidate
- **THEN** the plan SHALL require license, provenance, adapter and benchmark
  gates before reuse
- **AND** it SHALL not copy Source or license text into this repository.

### Requirement: Roadmap additions preserve plan integrity

The Living Master Plan SHALL record the current `origin/main` SHA and add all
requested work packages with unique IDs and existing valid status values.

#### Scenario: A work package is added

- **WHEN** the plan introduces a Voxel, streaming, observability, Birth Cluster
  or mass/orbit package
- **THEN** no existing ID SHALL change
- **AND** the new capability SHALL NOT be marked `DONE` or `FOUNDATION`.

### Requirement: Completion is evidence-gated

The change SHALL be considered ready for review only after fresh Docs-only
verification, diff review, push and PR creation against `main`.

#### Scenario: Runtime tests are evaluated

- **WHEN** the final diff contains only Markdown Docs and DevToolbox planning
  artifacts
- **THEN** Runtime builds and tests SHALL be reported as not applicable
- **AND** no test, package, binary or image output SHALL be generated.
