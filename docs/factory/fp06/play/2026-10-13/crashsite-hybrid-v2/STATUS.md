# Wreck V2 — authored asset candidate

The owner's critique of V1 is supported by the actual render: rectangular
side walls, disconnected roof slabs, a stepped glass stack, shallow loading
bay, square rear remnants and plain cuboid guns diverged from the selected
hybrid reference. V2 replaces the main shell with a volumetric stepped
cross-section, enclosed inclined canopy, layered cream armor, exposed ribs,
recessed cargo bay, broad loading ramp, broken circular engine remnants,
grounded supports and two detailed roof mounts.

Root is the sole implementation writer on
`codex/hestia-fp06-play-candidate-2026-10-12`, based on
`e70e7dad76903d2a23ebf4319eb4a0ce72290221`. The exact write set is in
`SCOPE.json`. V1 is preserved. The approved reference's SHA-256 is
`1fac13e62a049b137370c1705549342cb7087195a0c614ae6234e6717e7f208c`.

Two bounded local authoring passes were used. The first V2 pass is preserved
under `art/factory/crashsite-hybrid-v2/iteration-01`: initial shape/script,
specification, measurements and two actual renders. The second pass flattens
the canopy into readable panes, separates six hollow gun barrels, broadens
the tail fin, removes a visual threshold rail and adds small cooling fins
and local surface wear. All geometry retains hard axis-aligned voxel faces.
The silhouette grid is 125 mm, with 62.5 mm local art detail. These grids are
authoring choices, not replacements for the 250 mm build grid or HVP cells.

| Check | Result | Evidence |
|---|---|---|
| Actual GLB policy | PASS | `art/factory/crashsite-hybrid-v2/STATIC_VALIDATION.json` |
| Native source reopen | PASS | `apps/weltraum-browser/evidence/factory/crashsite-hybrid-v2/native-reopen.json` |
| TypeScript/Vite build | PASS | `apps/weltraum-browser/evidence/factory/crashsite-hybrid-v2/build.log` |
| Source/public/dist payload identity | PASS | GLB SHA-256 `da2f2ad01934c5b58b13659c9789b43dcbd6f4447a292cdc0d120a4473acc610` |
| Six actual Blender views / output hashes | PASS | `AUTHORING_REPORT.json`; final run completed with exit 0 |
| Independent source/export and visual review | PASS technical; OWNER_REVIEW_PENDING visual | `INDEPENDENT_REVIEW.md` |
| Human visual acceptance | OWNER_REVIEW_PENDING | Owner compares the actual views to the approved reference |
| Live wreck / native support / access / collision admission | NOT_RUN / NOT_ADMITTED | Closed gameplay asset loader and World owner unchanged |
| Finite turret ammunition and defense | NOT_RUN | Static visual intent only; no cargo or ammunition granted |

The saved native file is 1,923,084 bytes, SHA-256
`c3c3e441e361f062a6436f7c61c0c62cbfe5f704e5c3e5c34dec9f24dd500ac0`.
The GLB is 1,073,900 bytes: 19,552 triangles, 39,104 vertices, 34 material
primitives, six materials, no textures/animations, and eight semantic parts.
It spans 15.125 m along X. The ship remains permanently unable to fly.

The byte validator was written before first export and initially failed on
the absent GLB. This is an export-readiness check, not a red gameplay test or
aesthetic acceptance. It then inspected both actual exports. The native file
was reopened without saving and its hash remained unchanged. The build's
existing chunk-size warning is retained; no limit or dependency was changed.
Code/document whitespace checks pass. Raw logs are excluded from that check:
the Vite reporter's one trailing space is retained as original evidence.

The public asset is a candidate available in ordinary build output. This is
distinct from installation into the closed play loader. GLB never provides
World Authority. No native hull, cargo, collider, material history, recipe,
Save or terrain changes are included in this package. W09's previously
documented composition/native-hold blockers, the W10 dependency on W09, and
the incomplete W11 full-flow evidence remain open.

Asset production used actual Blender 4.3.2 with CPU Cycles, two threads,
48 samples and six 1440×900 views. `game-dev` CLI is unavailable; that fallback
is explicit in the specification and provenance. No paid model generation,
engine replacement, dependency upgrade, main merge, push or publication.
