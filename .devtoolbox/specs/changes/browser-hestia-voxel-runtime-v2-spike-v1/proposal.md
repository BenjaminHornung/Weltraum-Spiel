# Proposal: Hestia Voxel Runtime V2 Spike V1

## Change

`browser-hestia-voxel-runtime-v2-spike-v1`

## Problem

The historical Hestia Surface Play experiment coupled authority, collision,
fixed-step movement, Surface Nets presentation and structural work. Automated
green paths did not prevent real-play failures: mirrored lateral movement,
10–30 second edit stalls, permanent movement freezes, sinking after cuts and
450/739 ms tree-edit publication. Current `origin/main` therefore has no
accepted executable proof that a browser voxel authority can support a lush,
walkable and locally destructible Hestia scene while staying responsive.

PR #53 provides pure representation contracts only. It has no live runtime,
worker/cache/renderer/physics/streaming/collapse proof and remains unmerged.
Reusing either historical implementation would import the rejected coupling
and invalidate a clean V2 measurement.

## Goal

Create a new, isolated runtime at `/?voxelV2=1` with:

- one CPU-side palette-indexed `Uint8Array` authority at 0.25 m resolution;
- deterministic composed coast, lagoon, river valley, terraces, strata, voxel
  trees, flora and dry spawn over at least 64 × 32 × 64 metres;
- exposed-face material-aware greedy block meshing with halo seams and block AO;
- a V2-owned bounded module-worker scheduler with coalescing and stale rejection;
- authority-backed first-person movement, collision, DDA cutter and local-only
  asynchronous remeshing;
- Three.js confined to `render-three/**`, with static transparent water;
- read-only browser telemetry, five fixed 1920×1080 visual captures and a
  production-build 100-cut performance decision.

The spike must leave `/` and `/?surfaceLab=1` unchanged, add no dependency or
lockfile change, import none of the prohibited historical Voxel/Surface trees,
and publish an evidence-based `GO`, `CONDITIONAL GO` or `NO-GO` without waiving
failed or unavailable thresholds.

## Scope

Implementation is limited to `apps/weltraum-browser/src/voxel-v2/`, one minimal
dynamic route seam in `src/main.ts`, focused tests, one exactly-once E2E group
token, required documentation/specs and evidence. The branch is
`experiment/browser-hestia-voxel-runtime-v2-spike-v1`, based directly on fresh
`origin/main` SHA `15f3550bd604856b25d40a7ac700ec4d5106b89e`.

## Exclusions

No old Surface Nets/WorkerPool, second authority, renderer/collider truth,
full-world edit remesh, package changes, Unity assets, WebGPU, physics package,
global streaming/LOD, structural collapse, detached bodies, fluid simulation,
multiplayer, persistence/save migration or copied/adapted GPL code/assets.

## Decision rule

`GO` requires functional correctness, clean P0/P1 review and all preliminary
performance thresholds in the test protocol. A functional spike that misses a
threshold is not promoted as accepted; it is reported honestly as
`CONDITIONAL GO` or `NO-GO` with the measured bottleneck and may only receive a
clearly marked draft/failed-spike PR.
