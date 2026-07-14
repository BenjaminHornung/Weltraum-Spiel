# Design

## Evidence hierarchy

1. Direct Visual Evidence from successfully materialized PNGs.
2. Documented Concept Rule from current repository documents.
3. Inference needed to turn the first two into implementable visual guidance.
4. Provisional values where neither images nor documents define a measured number.
5. Rejected or Deferred content that conflicts with current scope.

Concept art never proves runtime behavior. Numerical values are `Initial Preview Target` and `Not Yet Performance-Proven`.

## Source handling

- Use exact paths from `origin/main`.
- The actual image 40 is `docs/UI-Screenshots/40-surface-expedition-ressourcenspur-scanner.png`.
- The requested `docs/UI-Screenshots/41-hestia-biolumineszente-hoehlensysteme.png` is absent. The unrelated same-number cutter image is not a substitute.
- A file is visually reviewed only when its PNG signature and dimensions prove successful LFS materialization.

## Two-checkpoint delivery

Checkpoint 1 commits the image/source audit and initial DevToolbox artifacts. Checkpoint 2 adds the full Markdown preset, stable JSON handoff, compact runtime-agent handoff, final acceptance matrix, and tracking updates.

## Design boundaries

- Hestia reads as a humid, dark, biologically active archipelago world, not generic Earth forest or neon fantasy.
- A 4×4 chunk proving ground must prioritize one readable valley/depression, one raised faceted ridge, shallow water/wetness, controlled vegetation clusters, and visible seam inspection over planet-scale spectacle.
- Vegetation is reconstructible presentation scatter, not voxel/gameplay authority.
- Water is a fixed presentation plane with no fluid voxels, simulation, flow, physics, or gameplay authority.
- Fog creates depth but must not hide holes, seams, or missing geometry.
- Main ships are not implied to be universally surface-rated; cities, outposts, missions, characters, economy, and authored hotspots are deferred.

## Validation strategy

Validate exact scope, JSON parsing, Markdown links, image existence/LFS state, evidence labels, value consistency across all three handoffs, forbidden-path absence, and Git whitespace/staging hygiene. No product build is required for docs-only work.
