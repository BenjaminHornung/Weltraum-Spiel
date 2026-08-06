# Proposal: Hestia Voxel Runtime V2 Coast/Lush Visual Parity V1

## Change

`browser-hestia-voxel-v2-coast-lush-visual-parity-v1`

## Baseline

- Base commit: `b9ba0e14d897ca2392013c456bd1b88b58934381`.
- Branch: `experiment/browser-hestia-voxel-v2-coast-lush-visual-parity-v1`.
- Product path: `apps/weltraum-browser`.
- Historical baseline change: `browser-hestia-voxel-runtime-v2-spike-v1`; its NO-GO evidence remains unchanged.
- Reference package supplied at `docs/Konzeptart/Hestia` in the source checkout. The package contains 22 PNG candidates; Phase 0 classifies exactly six target-role images and records the exact source filenames.

## Problem

The functional V2 runtime is usable, but its production images still read as a
small technical voxel diorama: the world terminates at a rectangular footprint,
terrain repeats regular terraces, trees have mostly spherical crowns, flora is
confetti-like, water is a flat plane and the sky is an empty CSS gradient. The
supplied Hestia references instead establish a wide, layered, lush coast with
islands, channels, cliffs, rooted broad-canopy trees, grouped vegetation,
transparent turquoise water, clouds and atmospheric depth.

## Goal

Extend the existing V2 presentation and deterministic world composition toward
the supplied reference language without restarting the V2 core. The result must
provide credible macro, meso and micro forms across canonical beauty cameras,
retain the existing authority/edit/collision/worker/first-person contracts, and
remain honest about visual approval and performance.

The change is not complete until a candidate screenshot series is produced and
the repository owner explicitly accepts it. Without that response the status is
`AWAITING_OWNER_VISUAL_APPROVAL`, never `PASS` or `GO`.

## Scope

- Add one pure deterministic macro-world descriptor shared by Near, Mid and Far
  projections.
- Replace the regular near-field coast/river/terrace composition with irregular
  domain-warped/authored coast, islands, valleys, channels, cliffs, strata and
  biome material classification.
- Keep the 0.25m Near authority as the only edit/collision truth.
- Add bounded render-only Mid and Far terrain proxies using the same descriptor;
  no second mutable world and no full-world 0.25m authority.
- Add four connected voxel tree archetypes, biome-aware grouped placement,
  support-checked render-only small vegetation and deterministic local
  invalidation after Near edits.
- Replace the rectangle-like water presentation with a circular horizon-scale
  static water pass, channel/shore cues, shallow-depth color, Fresnel/glint and
  bounded procedural motion.
- Replace the empty gradient with a Three-owned sky/horizon/cloud/haze
  presentation and deterministic canonical camera presets.
- Reduce Near terrain draw calls through region-level geometry replacement and a
  shared palette-aware material path before accepting additional density.
- Preserve the query gate, normal route, Surface Lab, authority DDA, CAS edits,
  authority collision, worker scheduler, stale rejection and local remesh.

## Exclusions

- No Surface Nets, Marching Cubes, Dual Contouring, WebGPU, new physics library,
  fluid simulation, structural collapse, detached bodies, multiplayer,
  persistence, Unity/`Assets/**` changes or copied external assets/code.
- No blanket 0.125m resolution increase, object-per-voxel path, generic LOD
  engine or 32-band streaming system.
- No performance claim without fresh production evidence and no visual PASS
  claim without owner approval.

## Decision rule

The functional V2 tests must remain green. A candidate with visual gaps,
visible world boundaries, debug-diorama presentation or failed performance
gates remains `NO-GO` or `AWAITING_OWNER_VISUAL_APPROVAL` and may only be
published as a clearly marked draft/visual candidate.
