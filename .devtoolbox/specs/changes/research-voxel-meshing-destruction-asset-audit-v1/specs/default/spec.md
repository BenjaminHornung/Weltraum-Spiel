# Capability: Voxel Meshing, Destruction, and Asset Audit

## Requirement: Reproducible external-project evidence

The audit SHALL record for every named external project its canonical URL,
inspected commit SHA and date, branch or tag, license and exact license path,
inspected source paths, build status, test status, demo status, browser status,
known limitations, scored evaluation dimensions, and one allowed verdict.

### Scenario: Work was not executed

When a build, test, demo, or browser check is not executed, the field states
`NOT RUN` and gives the reason; repository claims are not promoted to observed
or test evidence.

## Requirement: Claim classification

Every material claim SHALL be attributable to README Claim, Code Evidence,
Test Evidence, Benchmark Evidence, Observed Demo Evidence, or Inference.
Unverified marketing terms SHALL not be repeated as facts.

## Requirement: Meshing decision coverage

The audit SHALL compare all requested meshing and representation approaches for
triangle count, sharp features, organic surfaces, multiple materials, chunk
boundaries, LOD transitions, incremental remesh, workers, WASM, WebGPU,
determinism, and implementation risk.

## Requirement: Project-specific coverage

The audit SHALL cover the requested godot_voxel, Tuntenfisch/Voxels, Terraxel,
three-mesh-bvh, meshoptimizer, FastNoiseLite, Goxel, Blockbench, MagicaVoxel,
paper, specification, and authoring-tool questions without inferring unobserved
architecture from screenshots or demos.

## Requirement: Decision-complete synthesis

The result SHALL contain a Meshing Decision Matrix, Terrain-vs-Building
strategy, LOD seam strategies, chunk data channels, incremental remesh,
collision/navigation projection, asset compiler, thin-feature policy,
authoring-tool matrix, destruction architecture D0-D6, mass/COM/inertia inputs,
license risks, golden asset corpus, and at most four later spikes.

## Requirement: Scoped repository change

Only the named research document and this change directory SHALL differ from
the pinned origin/main commit. No external source, asset, binary, capture,
lockfile, image, or build product SHALL enter Weltraum-Spiel.
