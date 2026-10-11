# W07 shared source-bound stand region for two Cutter previews

Status: **SOURCE_VALID REGION; actual Native walk, support and LOS NOT_RUN by this agent.** This is a read-only source preflight. No product/E2E/input/reach/terrain/mask/Cargo/Resources changes, tests, builds, browser, Rapier or renderer jobs. Prior second-Cutter report remains byte-for-byte immutable, SHA256 `bfd82113829ba58f1421a88b3fa35cb7a67753e4338087fd7f7f59864c695366`.

The unchanged source permits a tapered region larger in Z than the old x[-6.4,-6.125], z[8.75,9] oracle: **flat actor-center X [-6.4,-6.1] m, with the allowed Z interval depending on the actual X and Y**. Three continuous source-valid sub-boxes are listed below. There is no honest wide0.7–0.9 m stand box on this same1.5 m ground: the unchanged natural hill immediately west of the approved band corridor reaches2.5–3.5 m and intersects the player hull. The two fixed service volumes and original4 m Cargo point limit also keep the reachable Z depth below0.5 m. A preflight cannot make a250–350 ms motion burst safe by widening these bounds.

## Actual unchanged contracts

First Cutter center [-6.25,1.5,5] m/q1; service X[-5.25,-4.25], Y[1.5,3.5], Z[3.5,6.5] m. Second preview center [-9.75,1.5,5] m/q1; service X[-8.75,-7.75], same Y/Z.

`prepareFactoryPlacement` measures **distance to each transformed service AABB**, not machine center, requiring≤3 m; it separately checks distance to Cargo access AABB≤4 m and rejects if actual `cargo.accessible===false`. Original immutable Cargo access point is [-5.5,2.25,12.625] m. `readCargo` additionally and authoritatively measures **actual Native actor-to-access-point Euclidean distance≤4 m**, then performs the real same-World LOS cast and current native Cargo support/access clearance. The point limit is stricter here than the planner's Cargo AABB distance.

For the present source height y≈2.41 m and x within the flat interval, the full continuous reach test is:

- Cargo: `(x+5.5)^2 + (y-2.25)^2 + (z-12.625)^2 <= 16`.
- First service: `(-5.25-x)^2 + (z-6.5)^2 <= 9`.
- Second service: `(x+7.75)^2 + (z-6.5)^2 <= 9`.

These formulas apply only to the reported region where x lies in the gap between both service boxes, z>6.5, and y lies inside their [1.5,3.5] interval. Elsewhere use the actual AABB distance, not these regional formulas. The allowed Z interval is therefore:

`z >= 12.625 - sqrt(16-(x+5.5)^2-(y-2.25)^2)`

`z <= 6.5 + min(sqrt(9-(-5.25-x)^2), sqrt(9-(x+7.75)^2))`.

For x=-6.5 (geometric service midpoint), the reach-only interval at y2.41 would be z[8.755323,9.227178] m; the real source/player hull blocks that X because the west side rises above1.5 m. Do not substitute the geometric midpoint for actual source admission.

## Continuous source-valid boxes

Distances below are worst values across all box corners with the conservative reach-check Y interval[2.38,2.44] m. Actual standing Native Y is expected around2.41 m; the interval is a reach robustness bound, not proof of Native support at every height. Entire horizontal player envelope (box extended by0.35 m on all X/Z sides) is covered and exactly limestone top1.5 m, entirely on unchanged approved masks. Air above that surface follows from the actual column source model. The region does not intersect either Cutter body or Cargo body/access.

| Region | Actor X m | Actor Z m | Worst Cargo point m | Worst first service m | Worst second service m | Full hull-envelope125 mm columns |
| --- | --- | --- | --- | --- | --- | --- |
| west depth window | [-6.4,-6.35] | [8.75,9.15] | 3.982678 | 2.888771 | 2.997082 | 54 |
| middle depth window | [-6.35,-6.225] | [8.725,9.075] | 3.996073 | 2.800112 | 2.992699 | 63 |
| east depth window | [-6.225,-6.1] | [8.7,9] | 3.995917 | 2.683398 | 2.995413 | 63 |
| full-flat width window | [-6.4,-6.1] | [8.75,9] | 3.982678 | 2.751818 | 2.995413 | 64 |

The outer boundaries leave only millimetres of reach margin in some corners; a normal controller should use actual Native pose, `cargo.accessible`, and actual current preview reason, with reasonable interior margin. A practical interior is x[-6.375,-6.15], z[8.8,9.0] m; the wider three-box union permits actual pose selection beyond the old hardcoded Z ceiling.

At exact scan y2.41, the following accepted25 mm samples show the tapered shape. These are observations, not a replacement for the continuous inequalities; the mathematical thresholds lie between sample rows/columns.

| Actor X m | Minimum accepted sampled Z m | Maximum accepted sampled Z m |
| --- | --- | --- |
| -6.4 | 8.75 | 9.175 |
| -6.375 | 8.75 | 9.15 |
| -6.35 | 8.725 | 9.15 |
| -6.325 | 8.725 | 9.125 |
| -6.3 | 8.725 | 9.125 |
| -6.275 | 8.725 | 9.1 |
| -6.25 | 8.7 | 9.075 |
| -6.225 | 8.7 | 9.075 |
| -6.2 | 8.7 | 9.05 |
| -6.175 | 8.7 | 9.05 |
| -6.15 | 8.7 | 9.025 |
| -6.125 | 8.7 | 9 |
| -6.1 | 8.675 | 9 |

A controller may choose the appropriate target window from current Native X rather than force all walks into a single tiny rectangle. The allowed X span remains approximately0.3 m for the fully flat0.35 m player envelope. A 250–350 ms burst that actually advances0.9–1.3 m exceeds this source region; therefore a successful normal-input path still requires a stop/correction based on acknowledged Native motion. This report changes no input or movement implementation and does not validate a new tap duration.

## Exact source-line and hull proof

The bounded query visits only2,091 possible actor centers in X[-7,-5.75]/Z[8.5,9.5],25 mm spacing.206 satisfy both service distances, the stricter original Cargo point distance, flat player-envelope support and source line clearance.398 other geometrically reachable points fail the flat envelope. Only214 source columns are cached during the scan; there is no wide96,000-pose exploration.

For every accepted point and each continuous-box corner, the script traverses every crossed X/Z125 mm grid-plane interval along the straight line to the immutable Cargo point. It compares the minimum line Y on each interval with that interval's exact source column top, rather than sampling a potentially missed voxel corner.

The stronger full-region proof is the complete rectangle containing **all three boxes and all their rays to Cargo**: X[-6.4,-5.5], Z[8.7,12.625] m. All256 intersected source columns are covered, maximum top1.5 m (other tops1 or1.25 m). Every corresponding straight line has Y≥2.25 m, so its source terrain clearance is at least0.75 m throughout, including grid boundaries. This is an exact source-geology LOS statement, **not a Native ray cast** or proof about arbitrary runtime members. Existing physical trees/legacy initial objects and first Cutter were already source-separated in the prior report; real current World membership and Cargo accessibility remain the Host authority.

## Actual command evidence

1. `node --disable-warning=ExperimentalWarning /workspace/.cloud-setup/fp06-w07-reachable-stand-region-query.mjs`:2026-10-11T15:05:32.194Z, exit0,77.077 ms inside script. Initial broad proposed boxes failed honestly on natural terrain/hull or reach; retained in original JSON/stdout.
2. `node --disable-warning=ExperimentalWarning /workspace/.cloud-setup/fp06-w07-reachable-stand-region-query-v2.mjs`:2026-10-11T15:06:53.584Z, exit0,67.092 ms, same bounded source scan with corrected exact sub-boxes. Four boxes pass continuous corner reach bounds, full flat envelope and complete source LOS strip.

Pinned Node22.23.3, cwd `/workspace`. Eleven current source bindings remained byte-stable during each query. Other writer-owned paths may change under their separate authorized scope; this report makes no blanket runtime-hold claim.

| Artifact | Bytes | SHA256 |
| --- | --- | --- |
| `fp06-w07-reachable-stand-region-query.mjs` | 9758 | `cac4596053c64dd559ccd3362afdbb82fadf007d2ae03fb631200e1d8ccf3fa5` |
| `fp06-w07-reachable-stand-region-query.json` | 18258 | `dcba5911b6d9b1ec2b08175bae5c0eff7018bfd7067cbe45f04ee502c66171ae` |
| `fp06-w07-reachable-stand-region-query.stdout.json` | 6484 | `aa139ae84374654992e6eef5fe69f6eff2ac94561923e30f2bf6c0c941a1a4ee` |
| `fp06-w07-reachable-stand-region-query-v2.mjs` | 9735 | `b4ca933759f35190590f5384b532c9e12482f7c1a5e2db2d692588df1e553375` |
| `fp06-w07-reachable-stand-region-query-v2.json` | 18248 | `1008a7a6e82482e05fea8e89c19165e6805d7e49016b902b040f1c1978220c65` |
| `fp06-w07-reachable-stand-region-query-v2.stdout.json` | 6561 | `5b569665f3890ef52cd8b4c070a49e2c3ad9461d66c4f25fdf5870849140c13e` |

| Current draft source binding | SHA256 |
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
| `apps/weltraum-browser/src/hvp/hvpBootstrap.ts` | `e744746124298f359f18efed2b6eeaa83e434177fe8dd509bf2519669d6174e3` |

These are source preflight receipts, not final package seals. Actual normal browser walk/stop, acknowledged Native actor pose, Cargo accessible=true, first-Cutter normal build and second-preview `BOM_MISSING` remain separate Integrator evidence requirements.
