# W07 independent second-Cutter source-site preflight

Status: **SOURCE_VALID; actual Native actor/LOS/support/placement NOT_RUN**. Read-only report, no repository writes or product changes. Query executed on 2026-10-11 against the current Integrator worktree; all bound source bytes remained stable during each query. CPU/GPU/Browser lease remains with Integrator.

The recommended second preview is **center `[-9750, 1500, 5000]` mm, quarterTurns `1`**. Starting from the normal Cutter button's `[-6250,1500,5000]` mm / q1, move the ghost **14 ArrowLeft quarter-grid steps**, with no rotation. This is a temporary W07 depletion oracle; it occupies space reserved for future bench work and must not become a second installed machine or a W09 layout change.

The exact current first default is East7.5/North6, not East6/North6. The recommended candidate is East7.5/North2.5. Both remain on the unchanged world transform x=-12.25+North, z=12.5-East. No masks, source slots, Cargo, Resources, art, installation profile or native budgets were changed.

## Source proof

| Bound | First installed Cutter | Second preview candidate |
| --- | --- | --- |
| World body X | [-7.25,-5.25] m | [-10.75,-8.75] m |
| World body Y | [1.5,4] m | [1.5,4] m |
| World body Z | [3.5,6.5] m | [3.5,6.5] m |
| World service X | [-5.25,-4.25] m | [-8.75,-7.75] m |
| World service Y | [1.5,3.5] m | [1.5,3.5] m |
| World service Z | [3.5,6.5] m | [3.5,6.5] m |

Second body/service are disjoint from the first body/service, including the planner's 0.5 mm overlap tolerance. The second service ends at x=-7.75 m, leaving 0.5 m before the first body begins at x=-7.25 m. Cargo body is x[-6.25,-4.75], z[12.625,13.625] m; Cargo access is x[-6.25,-4.75], z[11.625,12.625] m. Neither is intersected. Sweep AABBs lie inside the second body's horizontal projection.

All four complete 0.5×0.5 m feet pass **64/64 canonical125 mm source columns**, exactly top1.5 m and limestone slot1:

| Foot X | Foot Z | Columns | Approved-mask columns | Source top |
| --- | --- | --- | --- | --- |
| [-10.75,-10.25] | [6,6.5] | 16 | 16 | 1.5 m |
| [-9.25,-8.75] | [6,6.5] | 16 | 16 | 1.5 m |
| [-10.75,-10.25] | [3.5,4] | 16 | 0 | 1.5 m, unchanged natural source |
| [-9.25,-8.75] | [3.5,4] | 16 | 0 | 1.5 m, unchanged natural source |

Complete second body AABB: 384 covered columns, maximum top1.5 m (256 approved-mask columns, remaining natural source top1.25 or1.5 m). Complete service:192 covered columns, all approved-mask limestone top1.5 m. Four source-bound sweep AABBs:16/16/12/16 covered columns, maximum top1.5 m, below the lowest sweep altitude2.5 m. The source-column model is exact in this region: it excludes the separate rock-arm cavity x5.5..9.5/z-7..-5.5. All AABBs are inside unchanged source coverage x/z±16 m, y[-8,8] m. No adjustable feet or terrain edit is assumed; lower ground between the four fully supported feet is allowed by the existing planner.

The two retained physical vegetation trees are hero x8/z7 (maximum source grid half-width6 m) and east-young x12/z-6 (half-width4.25 m), outside this candidate. The two excluded wood owners are the already approved Factory initialization choice. Other plant decorations declare decorationPhysics=none. Legacy initial Drop (-9,-9), inertia (-9,-13), and branch (-12,-13.5) source locations are far away. **Current actual Native member locations/shape queries still require Integrator verification**; these source positions do not prove runtime membership.

## Actor reach

Actual initial Native actor reported by Integrator is `[-5.5,2.42,11.875]` m; normal WASD walk has not yet completed. The following are source-projected target poses, not actual Native readbacks:

| Actor XYZ m | Cargo point distance (≤4 m Native criterion) | Service AABB distance (≤3 m planner criterion) | 0.35 m square hull source |
| --- | --- | --- | --- |
| [-6.25,2.42,9] | 3.705675 m | 2.915476 m | 36/36 columns, all top1.5 m |
| **[-6.25,2.42,8.875]** | **3.828041 m** | **2.809026 m** | **36/36 columns, all top1.5 m** |
| [-6.25,2.42,8.75] | 3.950573 m | 2.704163 m | 36/36 columns, all top1.5 m |
| [-6.375,2.42,9] | 3.732981 m | 2.853178 m | 36/36 columns, all top1.5 m |

Preferred target z8.875 gives margin against both current reach limits. A stop around x=-6.15,z9.15 can exceed the second service3 m limit, so the real browser must read actual actor coordinates before asserting the depletion result. Moving too far below z8.75 can exceed the original Cargo point4 m limit. No teleport or test bridge is proposed.

Source ray preflight samples the straight target-to-Cargo-access-point line every≤0.0625 m. All61/63/65/61 samples respectively remain above the terrain; minimum source air gap≥0.7579 m. This is **not a Native LOS cast**. Actual `cargo.accessible` and actual actor position must remain the authoritative browser witness.

## Depletion oracle

At the candidate, use the ordinary ghost controls and expect **`BOM_MISSING`** after the first paid Cutter consumed the unique C26 chassis. That specific existing planner result proves the request passed its frame, actor/Cargo binding, service/source reach, installed facility overlap, player-body overlap, complete foot support, body/service/sweep terrain-air checks before it reached the finite BOM loop. Do not replace it with generic “Bau nicht möglich”, and do not call pure source success a Native install validation. Because C26 is absent, the current Host correctly never allocates a second Native candidate. Failed confirmation must preserve complete first installation, all material/container state, mass, reservation count, Cargo identity, native body/collider counts and owner handles; no new owner is expected.

## Actual queries and evidence

All commands used pinned Node22.23.3 (`/workspace/.cloud-setup/toolchain/node_modules/node/bin/node`), cwd `/workspace`, exit0; no tests/build/renderer/Rapier/materializer/browser or external process startup.

1. `node --disable-warning=ExperimentalWarning /workspace/.cloud-setup/fp06-w07-second-cutter-site-query.mjs`: 14:06:26.566Z,119.269 ms measured inside script; narrower2,200-pose query found zero candidates. Retained honestly, not a global impossibility claim.
2. `node --disable-warning=ExperimentalWarning /workspace/.cloud-setup/fp06-w07-second-cutter-site-query-v2.mjs`: 2026-10-11T14:07:01.746Z, 215.391 ms;6,724 quarter-grid poses x[-11.25,-1.25]/z[4,14] and all4 rotations.12 passed initial support/reach/disjoint filters;10 then failed full source clearance;2 source-valid candidates.10752 unique source columns. The alternative [-9250,1500,4500] mm/q0 is also source-valid, but requires rotation and extra moves; recommended q1 is simpler.
3. `node --disable-warning=ExperimentalWarning /workspace/.cloud-setup/fp06-w07-second-cutter-actor-query.mjs`: 2026-10-11T14:08:15.956Z, 47.022 ms; four explicit actor-target hull/air/reach checks.

| Artifact | Bytes | SHA256 |
| --- | --- | --- |
| `fp06-w07-second-cutter-site-query.mjs` | 7693 | `a69c38671d128a5535a504f22e6fc860cfbc833df56fc3fbd4da2e1dc9503c50` |
| `fp06-w07-second-cutter-site-query.json` | 5327 | `da7c08214f35e97d6ce5c341e3716323da5a7cd81f5dfcc07db1d1bfe8ed1a8c` |
| `fp06-w07-second-cutter-site-query-v2.mjs` | 7864 | `a709016ade44c9f604d1eceda1dbda9df8f4bbafdeb4c6f533d2cf40ce1460da` |
| `fp06-w07-second-cutter-site-query-v2.json` | 55515 | `ff223e8427b726a0b212311db80afa61f28b1d237fd6852058710ff038b2096f` |
| `fp06-w07-second-cutter-site-query-v2.stdout.json` | 45858 | `8e78b4d72dd05d81581fbacc630fd03fd4e4482b58c2122fa7df4e8a2ec28660` |
| `fp06-w07-second-cutter-actor-query.mjs` | 5927 | `2ff898df7a06b12510ccc88736b863cf9f323cab10237c0a2ed243fc3fb2570d` |
| `fp06-w07-second-cutter-actor-query.json` | 6756 | `216dbad7aefbf1e5713f2d91efd0c29c4962c4e6dd9cd161bff914e717b5c6ea` |

| Source binding | SHA256 |
| --- | --- |
| `apps/weltraum-browser/src/factory/fixtures/startSite.ts` | `53725bbf06af6be92ac1b3b3e250ee6548e37bb6abf8500b4cd50e09b1ec1a29` |
| `apps/weltraum-browser/src/hvp/hvpCoastSource.ts` | `13128d7ad3151da644ae909af0dbb0e2df0e91066c01f55ee566f7eedc1fdaca` |
| `apps/weltraum-browser/src/core/hash.ts` | `7514fc507d6c83404462d967ff4736790abf6425842b676cefedc4928a2febee` |
| `art/factory/fp02/cutter/source.scene.json` | `abd1ce25fd19ad61a9cb65de9f5ba10c303aa5c1a1aa16260de9dce9534fa5fd` |
| `apps/weltraum-browser/src/factory/construction/installationProfile.ts` | `64df3962d652649301e1a7f411516829e6e7fd915d5fa48f566f18090c32832f` |
| `apps/weltraum-browser/src/factory/construction/placement.ts` | `89194437192f2788e4ea7458af06f760583f8250ccce494a89e0cc225debd09e` |
| `apps/weltraum-browser/src/factory/fixtures/cargoSite.ts` | `83fa38b62b88c8f0c7f9351a1d30617b2704d4c04a21bb64fcc5084e8739ef0c` |
| `apps/weltraum-browser/src/factory/factoryEntry.ts` | `ad7f1bb598f26db5ba873abe762fc39a1798c8bf18a65f971409efd7b3f87202` |
| `apps/weltraum-browser/src/hestia-prototype/presentation/vegetation.ts` | `a6c6996706591f5fd77f31ea9a445fa421f6e1e02ee7162904a58834b5008dd3` |
| `apps/weltraum-browser/src/hestia-prototype/physics/factoryFacilitySession.ts` | `620a60b3d7d1e5edfef558fe07fac9af78cd9fc13385f9c45ad5fde1279d2eee` |
| `apps/weltraum-browser/src/hvp/hvpBootstrap.ts` | `4de5d525722ee6bcf18c94a091d6f8d33f0b937708465188fd1b65c52d528b55` |

Product and native source hashes are current draft observations, not immutable final package seals. Actual Native walk/LOS and the specific normal browser `BOM_MISSING` proof remain **NOT_RUN** as of this report. Historical write-scope clarification: besides the E2E split, Root expressly authorized the narrow MountRecovery follow-up before the final query: `src/factory/session/factorySession.ts` and `tests/unit/factory/hostLifecycle.test.ts` (Root control commit `98fe5e6e`, `packageScopes.W07.narrowMountRecoveryFollowup`). Those separately authorized paths were changing during this phase; the report does not claim all W07 runtime paths remained held. Neither path is among this query's 11 bound source files, and all 11 bound source byte hashes remained stable during each actual query. No source query was repeated for this scope correction, and no product file was changed by this read-only preflight agent.

Root delivery copy: only Markdown trailing spaces/final blank lines normalized. Independent original SHA256 `bfd82113829ba58f1421a88b3fa35cb7a67753e4338087fd7f7f59864c695366`, 10235 bytes; original remains `/workspace/.cloud-setup/fp06-w07-second-cutter-site-preflight.md`. Scope, evidence and verdict unchanged.
