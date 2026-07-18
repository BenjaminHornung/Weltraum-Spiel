# Capability: browser-hestia-hydrology-terrain-generator-v2

## Requirement: Fixed global-coordinate dataset

The hydrology generator shall expose a versioned `HydrologyGridDefinition` of
128x128 cells, 129x129 samples, 2.0 m spacing, and 256x256 m extent. Its origin
shall be an aligned global 0.125 m quantum coordinate (16 quanta per 2 m), and
all sample/cell identity shall derive from global coordinates rather than local
array positions.

### Scenario: Canonical grid

Given a valid aligned origin, when a V2 dataset is created, then every sample
has a deterministic global coordinate, canonical Z/X order, and the exact fixed
dimensions; an unaligned, unsafe, or non-finite coordinate is rejected.

## Requirement: Explicit hydrology contracts and preset

The direct hydrology modules shall define
`HestiaHydrologyDatasetId`, `HydrologyGridDefinition`,
`HydrologyCellCoordinate`, `HydrologyGlobalCoordinate`,
`HydrologyDatasetRevision`, `WaterBodyId`, `RiverSegmentId`,
`HydrologyParameters`, `HydrologyInput`, `HydrologySnapshot`, `HydrologyCell`,
`WaterBody`, `RiverSegment`, and `HydrologySample`. `HydrologyInput` shall
contain root seed, body/frame/dataset identity, global origin, sea level,
versioned parameters, and a pure finite `TerrainHeightSampler`.

The published preset shall contain exactly these explicit values: spacing 2.0,
sea level 0, minimum lake depth 0.15, river source accumulation 48, river depth
range 0.20..2.50, river half-width range 0.50..4.00, channel bank slope 0.65,
and moisture falloff 18 m. No hidden hydrology tuning constants are allowed.

### Scenario: Invalid input fails closed

Given a non-finite terrain result, unsafe global coordinate, invalid parameter,
or malformed identity, when generation is requested, then it rejects before a
partial snapshot, water body, river, or sampler result is published.

## Requirement: Deterministic sampling and ocean connectivity

The generator shall sample all 129x129 global coordinates and classify ocean by
deterministic 8-neighbor flood from boundary samples at or below sea level.
Only boundary-connected below-sea samples shall be ocean.

### Scenario: Isolated below-sea depression

Given a below-sea depression not connected to the boundary, when ocean
classification completes, then it is not ocean and may become a lake only under
the lake-depth contract.

### Scenario: Boundary-connected ocean

Given a below-sea sample component connected to the dataset boundary, when the
flood completes, then all connected eligible samples are ocean and no isolated
component is included.

## Requirement: Priority flood and D8 drainage

The solver shall use deterministic priority-flood ordering by filled elevation,
global Z, global X, and stable linear index. It shall publish filled elevation,
depression depth, spill elevation, and basin ownership. D8 directions shall use
N, NE, E, SE, S, SW, W, NW order, choose strongest negative filled-elevation
slope with canonical tie-breaking, permit boundary outlets, and contain no
internal cycles.

### Scenario: Symmetric tie

Given equal candidate slopes, when drainage is solved, then the earlier
canonical D8 direction is selected independent of input or caller order.

### Scenario: Flat sloped plane

Given a flat sloped plane, when accumulation and drainage complete, then all
flow drains to the lowest boundary edge without an internal cycle.

## Requirement: Topological accumulation

Every cell shall begin with accumulation 1. The solver shall process cells in
filled-elevation descending order, then global Z, then global X, and shall
produce accumulation independent of input array or caller order.

### Scenario: Downstream accumulation

Given a valid river source and downstream path, when accumulation is computed,
then accumulation never decreases along the path and the result is unchanged
when equivalent inputs are presented in a different order.

## Requirement: Static lakes and stable identities

A connected depression at least 0.15 m deep shall form a lake at its basin
component spill elevation. Lake water shall be perfectly horizontal, exist only
where terrain is below the contract water level by the comparison epsilon, and
receive a stable `WaterBodyId` derived from dataset identity, minimum global cell
coordinate, quantized spill elevation, and generator version.

### Scenario: Lake containment

Given an isolated depression and dry surrounding slope, when the snapshot is
published, then water exists only in basin cells, has one horizontal level, and
does not float above unchanged dry terrain.

## Requirement: Rivers and channel adjustment

Cells with accumulation at least 48 shall begin river segments. A segment shall
follow D8 until ocean, lake, boundary, or a confluence with a larger segment.
Its ID shall derive from its first global source cell. River water surface height
shall be downstream monotonic non-increasing. Channel depth and half-width shall
use the approved clamp equations and explicit preset bounds; adjusted terrain
shall be below original terrain in channel cells.

### Scenario: River termination and monotonicity

Given the deterministic valley fixture, when the river is traced, then it ends
at lake, ocean, or boundary, has no cycle, and never rises downstream.

### Scenario: Incised channel

Given a sampled channel cell, when `sampleHydrologyTerrainAdjustment` is called,
then it returns finite adjustment data and adjusted terrain below original
terrain rather than overlaying unchanged ground.

## Requirement: Pure moisture and terrain sampler

The sampler shall return finite channel distance, bank blend, adjusted terrain,
optional water surface/body identity, and moisture in `[0,1]`. Moisture shall be
deterministic from distance to ocean/lake/river and basin/depression depth with
18 m falloff, and shall not depend on Three.js, DOM, camera, runtime state,
wall-clock, or dynamic fluids.

### Scenario: Dry slope

Given a dry slope outside all water and channels, when sampled, then no floating
water surface is returned and moisture remains finite and within `[0,1]`.

## Requirement: Immutable deterministic snapshot

The published `HydrologySnapshot` shall be recursively frozen, canonicalized in
global Z/X order, and hashed from stable snapshot bytes. Same input and changed
caller order shall produce identical bytes and hashes; changed root seed or
terrain input shall produce a changed hash.

### Scenario: Repeated generation

Given identical input, when the generator runs twice, then snapshot bytes,
content hashes, IDs, cell order, and sampler outputs are identical.

## Requirement: Bounded memory and fail-closed output

One generated snapshot shall remain within the approved 8 MiB deterministic
retained-representation V2 contract cap for its frozen graph and packed
canonical representation. This estimator is not engine heap telemetry. A
budget failure, cycle, malformed output, hash mismatch, non-finite derived value,
or mutable alias shall reject the result rather than publish partial state.

### Scenario: Budgeted full dataset

Given the full 129x129 dataset, when the memory audit runs, then it records the
estimator method and assumptions, repeats deterministically, and stays at or
below 8 MiB.

## Requirement: Normal-route browser proof

The single E2E spec shall use the normal route without TestBridge, dynamically
import the hydrology module, run a deterministic valley with a lake and boundary
ocean, generate twice, compare hashes, prove river termination and downstream
monotonicity, and prove no floating `WaterSample`.

### Scenario: Browser health and evidence

Given the browser fixture, when the proof completes, then console errors, page
errors, request failures, and HTTP errors are all empty arrays; evidence is
timestamp-free JSON/Markdown with no screenshot and uses the approved evidence
prefix.
