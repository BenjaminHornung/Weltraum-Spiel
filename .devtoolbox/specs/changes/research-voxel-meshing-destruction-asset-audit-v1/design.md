# Design: Voxel Meshing, Destruction, and Asset Audit v1

## Research method

Repository facts are pinned to canonical URL, inspected commit, commit date,
branch or tag, license path, inspected source paths, and explicit build, test,
demo, and browser status. External repositories live only under a temporary
directory outside Weltraum-Spiel.

Every substantive claim is labeled as one of: `README Claim`, `Code Evidence`,
`Test Evidence`, `Benchmark Evidence`, `Observed Demo Evidence`, or `Inference`.
Marketing language is not adopted without matching evidence.

## Decision method

Each project is scored for Problem Fit, Architecture Fit, Browser Fit,
Determinism, Testability, Performance Evidence, License Fit, Integration Cost,
Maturity, and Main Risks, followed by exactly one allowed verdict.

The algorithm comparison covers Greedy Meshing, Marching Cubes, Surface Nets,
Dual Contouring with QEF, alternative Dual-Contouring vertex placement,
Transvoxel, uniform grids, octrees, and hybrid terrain/building meshing across
all requested quality, seam, worker, GPU, determinism, and risk dimensions.

## Synthesis boundary

The recommendation separates canonical editable data from derived render,
collision, navigation, and far-field projections. Terrain and hard structures
may use different canonical channels and meshing policies, but persistence,
chunk identity, material semantics, hashes, and mass-property inputs must share
one deterministic contract.

The asset compiler is offline-first:

`GLB/glTF -> normalize -> validate -> semantics -> materials -> voxelize ->`
`thin-feature policy -> sparse bricks -> structural graph -> mass properties ->`
`collision/nav/render LODs -> canonical manifest -> hashes`.

## Browser demo protocol

When a public or locally safe demo exists, use a real browser, inspect visible
behavior plus console/network state, and store screenshots only in temporary
storage. Browser observations remain separate from source or architecture
proof.

## Safety and stop conditions

- Do not run install/build scripts before inspecting manifests, lifecycle
  scripts, and `build.rs` where relevant.
- Do not provide credentials or execute unknown lifecycle scripts.
- Stop if research would require changing a forbidden path or bypassing a
  blocking DevToolbox preflight.
- Record `NOT RUN` rather than imply build, test, demo, or browser success.
