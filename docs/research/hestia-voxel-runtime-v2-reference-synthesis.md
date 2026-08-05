# Hestia Voxel Runtime V2 Reference Synthesis

## Purpose and evidence vocabulary

This document constrains the isolated runtime spike
`browser-hestia-voxel-runtime-v2-spike-v1`. It does not treat concept images,
historical branches, external projects or synthetic/unit measurements as live
Hestia acceptance evidence.

Every substantive item is tagged with one of:

- **Source claim** — directly supported by retrieved external text or metadata.
- **Code evidence** — directly observed in the freshly fetched repository or a
  named read-only historical ref.
- **Local benchmark evidence** — produced by a named command/runtime on this
  machine; valid only for that exact environment.
- **Inference** — an explicitly reasoned design conclusion, not a source fact.
- **Unavailable** — requested source body or proof could not be obtained.

## Immutable local visual inputs

**Code evidence** — Current `origin/main` contains five non-LFS Hestia PNGs at
1672 × 941. The canonical V2 trio is:

| Design role | Repository path | Git blob | SHA-256 |
|---|---|---|---|
| dark green/petrol atmosphere and vegetation depth | `docs/UI-Screenshots/38-hestia-nebelwald-outpost-konzept.png` | `458f094df31b0a1f74a26d4a4c87549d694fd063` | `916aa81f7c09e5f6f063fc910543db4ed708a5301ec27d998096de1f65f1fe1d` |
| archipelago/coast/water and macro landform | `docs/UI-Screenshots/36-hestia-archipel-landschaft-konzept.png` | `59aecef527a58bd211207e862abdf241e04887ac` | `f93b0cb630640fbeaa3b40ff1736366785489b2d493dd164b31d2fe503ca17d3` |
| restrained biome/palette breadth | `docs/UI-Screenshots/30-hestia-biom-atlas-regionen.png` | `1f2a726f2db7b869eaf4fb6c6cd1a83b09393043` | `3cd183cbf358e7be01ec0af0b09ca22d217ddf8a7f59ff3ce3e6446d8def1336` |

**Code evidence** — Secondary references
`23-biom-wald-ressourcen-scan.png` and
`40-surface-expedition-ressourcenspur-scanner.png` provide wet-rock and
cyan/teal accent cues but are not part of the canonical hash trio.

**Inference** — The runtime should combine the broad coast/water geometry of
image 36, the green/petrol atmospheric depth of image 38 and only the restrained
palette breadth of image 30. It should not reproduce UI, vehicles, outposts,
scanner overlays or composition-specific fiction from those images.

**Inference** — At 0.25 m per cell, Hestia forms should read as fine block
construction rather than Minecraft-scale one-metre cubes. Terraces, strata and
tree silhouettes therefore need multi-cell macro shapes while retaining flat
axis faces.

## Current repository architecture evidence

**Code evidence** — `docs/architecture/procedural-voxel-planet-runtime.md`
separates planetary macro data, tiles/regions and local mutable bricks; it also
separates render mesh, collider/navigation and other derived products. It warns
that stale/incomplete derived results must not replace newer truth or create
holes.

**Code evidence** —
`docs/research/voxel-meshing-destruction-asset-audit-v1.md` identifies sparse
uniform bricks as the mutable basis and requires revisioned neighbour/apron
invalidation and distinct persistence/render/collision products.

**Code evidence** —
`docs/research/browser-voxel-runtime-reference-audit-v1.md` finds that external
worker/voxel examples do not provide Hestia's complete authority, revision,
backpressure, cancellation and recovery contract.

**Code evidence** — The existing route in
`apps/weltraum-browser/src/main.ts` parses search parameters once, dynamically
gates TestBridge, routes exact Surface Lab and otherwise starts the normal
runtime. The browser package already contains Three.js 0.185.1, Vitest 4.1.10,
Playwright 1.61.1, Vite 8.1.5 and TypeScript 7.0.2.

**Code evidence** — Existing `src/core/hash.ts` hashes canonical string/JSON
inputs. It does not define an efficient raw `Uint8Array` content-signature
contract for 32 KiB chunks.

**Inference** — A single minimal FNV-1a-64 byte function belongs at the new
authority's content boundary. Converting cell bytes to generic string/JSON only
to reuse the current helper would add allocation and obscure ownership.

**Inference** — One exact `voxelV2=1` predicate plus one dynamic V2 import is
the smallest route change. V2 precedence when both V2 and Surface Lab are exact
is deterministic and leaves Surface Lab unchanged whenever V2 is absent.

## Historical failure and restart evidence

**Code evidence** — Read-only historical ref
`feature/browser-hestia-first-person-combat-integration-v1` at
`6ab40322c38565f204b9e337caf3ea0391efd33e` coupled authority, collision,
fixed-step runtime, Three presentation, Surface Nets and prepared structural
work inside the Surface Play slice.

**Code evidence** — Historical manual rejection notes report mirrored A/D,
10–30 second click stalls, generic unsafe rejection, permanent movement freeze
after tree contact/revision, slow sinking after accepted terrain cuts and a
detached tree body that did not establish terrain contact.

**Local benchmark evidence** — Historical recorded tree hotpaths published in
450 ms and 739 ms against their then-pinned ≤250 ms gate. These values describe
that rejected historical build only; they are not V2 baseline or target proof.

**Code evidence** — Historical edited-brick failure stacks named
`src/voxel/surfaceNets.ts` and Surface Play presentation/bootstrap call sites.

**Inference** — V2 must restart from a new authority/mesher/scheduler boundary,
not patch Surface Nets or reuse the old WorkerPool. Authority-backed collision
must remain available while renderer products are pending or rejected.

**Code evidence** — Open PR #53
`feature/browser-voxel-representation-ladder-v2` is a pure contract foundation.
Its own docs exclude a production representation consumer, worker/cache,
streaming, SurfaceRegion runtime, renderer, physics handoff and collapse.

**Inference** — PR #53 cannot supply runtime acceptance evidence and is not a
base, merge/cherry-pick source or implementation dependency for this spike.

## External source matrix

### Voxagon

**Source claim** — `https://blog.voxagon.se/` was reachable as an article
index. The fetched index exposed entries dated 2026-03-13, 2025-03-28,
2024-12-29, 2023-06-01 and 2021-02-22.

**Unavailable** — No per-article body was captured in the bounded research, so
no concrete Voxagon algorithm, contract or performance statement is cited.

**Inference** — The index is useful only as a future research lead; it does not
justify code reuse or a Hestia performance assumption.

### Acko / Teardown

**Source claim** — `https://acko.net/blog/teardown-frame-teardown/` was
retrieved and reports publication on 2023-01-24. The fetched text describes
Teardown as voxel-based destructible gameplay and discusses raytracing, global
illumination, real-time reflections and smoke/fire effects.

**Unavailable** — The bounded extraction did not establish a reusable
authority/revision/edit ordering contract or a browser performance figure.

**Inference** — The article supports destructible-voxel visual ambition, not
the architecture or acceptance numbers of this browser spike. V2 deliberately
does not add raytracing, GI, smoke/fire simulation or WebGPU.

### Voxel raymarching repository

**Source claim** — The GitHub page shell for
`https://github.com/jamescatania1/voxel-raymarching` was reachable, proving the
repository URL exists.

**Unavailable** — README/source details were not reliably extracted, so no
feature, license, algorithm or performance claim is made.

**Inference** — Object-local raymarching remains only a later adapter point;
this spike implements exposed-face block meshes.

### re-flora

**Source claim** — GitHub license metadata for
`https://github.com/tr-nc/re-flora` reports GNU General Public License version
3 (GPL-3.0, 29 June 2007).

**Unavailable** — The complete README/source/asset attribution set was not
reliably extracted from the reachable page shell.

**Inference** — Repository code must be treated as GPL-3.0, while individual
assets may have separate or embedded terms that require independent audit. No
re-flora source or asset is copied, adapted or bundled by V2.

### Assignment-supplied Reddit links

**Unavailable** — Direct and alternate fetches for all supplied Reddit bodies
were blocked by HTTP 403/network policy. This includes the posts identified by
the assignment as:

- `floating_voxel_detection`;
- `windy_voxel_forest`;
- `open-sourcing_work-in-progress_rust`;
- `blob-like_3d_formations`;
- `simulating_procedural_ponds`;
- `teardown_technical_dive`.

**Unavailable** — In particular, the blob-like formation body remains
`UNAVAILABLE`; its URL slug is not evidence for its contents.

**Inference** — No Reddit technique, code, asset or performance number enters
the implementation. The unavailable status is retained rather than filled with
memory or speculation.

## Fresh local baseline

**Local benchmark evidence** — On the clean base worktree, `npm ci` completed
with 59 packages and one existing moderate advisory; no package or lockfile was
changed.

**Local benchmark evidence** — `npm run build` passed with 165 modules and the
existing >500 KiB chunk warning.

**Local benchmark evidence** — `npm run test` passed 136 files and 1,333 tests
in 105.63 seconds on host Node 26.2.0.

**Local benchmark evidence** — The initial core E2E run on unsupported Node 26
passed 39 tests and failed one test solely because it asserted Node major 22.
Running that exact failed spec through portable Node 22.23.2 passed 1/1.

**Local benchmark evidence** — The existing live group passed 14/14 and the UI
group passed 12/12 under Node 22.23.2.

**Inference** — Final E2E evidence must use Node 22 explicitly and preserve the
Node-26 baseline finding. These baseline runs do not predict V2 frame/edit
latency; production V2 metrics must be collected separately after warm-up.

## Synthesis decisions

**Inference** — The smallest credible authority is a bounded 8 × 4 × 8
candidate-chunk world with sparse non-empty adoption, not a general streaming
planet. It fulfils the requested 64 × 32 × 64 m proof and keeps memory/work
measurable.

**Inference** — One V2 module worker is the bounded pool. More workers add
contention and scheduling complexity before a measured need exists.

**Inference** — Initial generation completes before initial meshing so halo
seam correctness does not depend on asynchronous completion order.

**Inference** — Material/AO identity remains in the neutral mesh, while the
Three adapter uses palette/AO vertex colours and one opaque material per chunk
to avoid draw-call multiplication by palette size.

**Inference** — Static sea-level water belongs in a separate transparent render
pass, not authority cells. This proves coast/river logic without pretending to
implement destructive fluid simulation.

**Inference** — Performance gates are local acceptance thresholds, not claims
derived from Voxagon, Teardown, Reddit, GitHub projects or historical Hestia
numbers. A failed/unavailable threshold produces `CONDITIONAL GO` or `NO-GO`.

## Explicitly unadopted material

**Code evidence** — V2 imports are forbidden from `surface-play`, `surface-lab`,
`voxel/adaptive`, `voxel/structural`, Surface Nets and existing WorkerPool
paths. A recursive static test enforces the boundary.

**Inference** — No external source/assets, old generator/mesher, PR #53 code or
historical integration implementation is copied, adapted, cherry-picked,
merged or overlaid. The synthesis supplies constraints only.
