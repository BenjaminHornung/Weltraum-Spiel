# Capability: Browser Observability Tooling Audit

## Summary

The project shall have an evidence-backed plan for objectively investigating
browser streaming, rendering, worker, memory, LOD, mesh-upload, and leak behavior
without changing gameplay truth.

This capability is research-only and does not authorize runtime or dependency
changes.

## ADDED Requirements

### Requirement: External projects are pinned and classified

The audit shall record identity, license, inspected source paths, execution
status, limitations, classified claims, scores, risks, and a verdict for every
required external project.

#### Scenario: A project receives an adoption verdict

- GIVEN an external project is evaluated
- WHEN the verdict is written
- THEN the exact inspected commit and license path are present
- AND every supporting statement has an evidence classification
- AND unverified marketing language is excluded.

### Requirement: Tool roles remain distinct

The audit shall define the purpose and non-purpose of Playwright, Chrome DevTools
MCP, Spector.js MCP, stats-gl, MemLab MCP, and project-owned runtime telemetry.

#### Scenario: A performance regression is investigated

- GIVEN a browser scenario has a slow or leaking run
- WHEN the toolchain is selected
- THEN runtime telemetry supplies domain truth
- AND browser, GPU, and heap tools supply their own independent evidence
- AND no single tool is described as proving every layer.

### Requirement: WebGL and WebGPU diagnostics are separated

The audit shall state which evidence works for WebGL, which works for WebGPU,
and where the audited toolset has a diagnostic gap.

#### Scenario: The renderer backend changes

- GIVEN a future build selects WebGPU
- WHEN graphics diagnostics are collected
- THEN WebGL-only Spector evidence is not presented as WebGPU proof
- AND backend identity is recorded with every capture.

### Requirement: Chrome tooling has a safe ephemeral setup

Chrome DevTools MCP guidance shall disable usage statistics and performance CrUX,
use an isolated profile, avoid permanent user configuration, and describe trace
and heap privacy risks.

#### Scenario: An agent starts a local Chrome investigation

- GIVEN no user profile access is required
- WHEN the MCP process starts
- THEN `--no-usage-statistics` and `--no-performance-crux` are active
- AND a temporary isolated profile is used
- AND artifacts stay in restricted temporary storage.

### Requirement: Runtime diagnostics are machine-readable and non-authoritative

The audit shall define the required chunk, queue, worker, mesh, cache, save,
frame, and Three.js counters as a versioned machine-readable snapshot.

#### Scenario: Diagnostics are sampled

- GIVEN the game has completed a simulation/render transition
- WHEN diagnostics are read
- THEN the snapshot reports owner-produced state without causing a transition
- AND unsupported values are explicit
- AND polling cannot alter gameplay outcomes.

### Requirement: Memory investigation uses a repeatable scenario

The audit shall define a snapshot series for Surface -> Orbit -> second Surface
-> return -> repeat, with stabilization, garbage-collection, dominator, retainer,
detached-DOM, growth, object-cost, and cache checks.

#### Scenario: A streaming leak is suspected

- GIVEN the same navigation cycle is repeated
- WHEN heap snapshots are compared
- THEN transient warm-up growth is separated from monotonic retained growth
- AND retained chunks, meshes, buffers, workers, listeners, and cache entries are
  traced to owning retainers.

### Requirement: Follow-up work is bounded

The audit shall recommend no more than three concrete tooling spikes.

#### Scenario: Research concludes

- GIVEN all required tools and platform docs have been evaluated
- WHEN recommendations are finalized
- THEN at most three spikes are listed
- AND none is presented as already implemented.
