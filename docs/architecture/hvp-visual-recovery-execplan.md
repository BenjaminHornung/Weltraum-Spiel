# ExecPlan: Restore the agreed HVP coast visual contract

## Current closeout status — R11, 2026-09-14

Implementation and all confirmed review fixes are complete. Both final technical
reviews are CLEAN; both independent visual reviews accept the bounded HVP-01/02
candidate. R11 reproduces all six accepted R10 image hashes exactly. The final
human diff gate is required before publication; its outcome is recorded by the
review tool, not inferred from automated checks. Baseline promotion and merge
remain separate and are not authorized by this closeout.

The user's subsequent instruction to finish, commit and push supersedes the
historical no-publication constraint below for this feature branch only. It does
not authorize HVP-03 work, baseline promotion, merge or deployment. Historical
progress entries below describe their own rounds; this section and the final
R11 verification supersede their pending technical statuses.

## Goal

Correct the existing HVP-01/02 candidate, not redefine the concept to match the
current renderer. The normal `?hestiaPrototype=1` route must show fine, hard
0.125 m terrain, asymmetric pale shores, transparent non-simulated water and
a daylight coastal continuation. Vegetation remains the next HVP-03 slice;
neither this correction nor passing tests constitutes art approval.

## Context

- Worktree: `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-HVP02-readable-coast`.
- Branch: `feature/hvp-02-readable-coast`; inspected HEAD:
  `6c161f83f767a60b4a62e85bd53cdcf00a79aaf1`. PR #67 is open, with no auto-merge.
- Authoritative plan:
  `C:\Users\hornung\.paseo\uploads\upload_971f39f4-b351-4510-bb72-36728e76b6af\HESTIA_VISIBLE_PLAYABLE_MASTERPLAN.md`.
  Sections 3.1 (lines 206-217), visual contract (345-494), caps (732-750),
  HVP-01/02 (1214-1405) apply. Code comments cannot narrow that agreement.
- Original images, actually opened for this correction, are in
  `C:\IFI_SourceCode\Temp\WeltraumSpiel\docs\Konzeptart\Hestia`:
  `ChatGPT Image 28. Juli 2026, 15_38_42 (4).png` (lagoon channel),
  `ChatGPT Image 28. Juli 2026, 15_38_41 (2).png` (wetland roots), and
  `ChatGPT Image 28. Juli 2026, 15_38_41 (3).png` (terraced coast).
  They are art references, not pixel-equal runtime baselines.
- User supplied C01/C02/C04 screenshots demonstrate the rejected coarse,
  dark scene. Browser MCP access to port 5173 returned CONNECTION_REFUSED;
  a fresh task-owned runtime is needed for new browser evidence.
- Proven source defects: runtime block size is 1 m (8 times the agreed edge
  length), small-object-array caps prohibit 0.125 m generation, water spans
  coplanar terrain at y=0, look maps much of the rock to blue/brown bands,
  background uses four cone primitives, and flight reticle survives HVP entry.
  Z-fighting is a hypothesis supported by coplanarity, not yet a live A/B proof.

## Non-goals

No engine replacement, smoothing/Surface Nets, dependencies, global terrain
migration, Adaptive constant-v1 or Structural-V1 changes, physics, saves,
vegetation, world streaming, publication or merge. No blanket cap increase,
test tolerance relaxation or automatic promotion of a candidate screenshot.

## Architecture decision

1. Restore the already specified local source boundary: versioned authored
   coast, named seed `hestia-hvp-lagoon-001`, immutable reader and compact
   Uint8 material pages, 16 cubed cells per 2 m leaf, X-fastest addressing.
   Known air and unknown coverage remain different. Public readers cannot
   mutate active typed arrays. Do not expand the region into millions of JS
   cell objects or fabricate Structural provenance.
2. The region has 256 x 128 x 256 slots = 8,388,608 slot bytes before metadata
   and products. Keep global controlled CPU payload <=256 MiB, mesh payload
   <=128 MiB, visible triangles <=500,000 and drawcalls <=300. Preflight
   allocations/output sizes and report actual logical bytes. Existing small
   reference-mesher caps remain; use compact production meshing instead of
   increasing them to accommodate an unsuitable representation.
3. Reuse HVP render-command, lifecycle and material-profile wiring. Mirror
   the existing structural greedy mesher's face ordering, winding and
   material-compatible rectangles, but do not pass invented StructuralObject
   input. Compact pages are HVP truth; meshes are derived products.
4. Derive water's occupied presentation mask from the same source at the
   agreed y=0 plane. Do not raise the canonical water level or move voxel
   vertices off-grid to conceal coplanarity. Exclude dry/coplanar top faces;
   keep water render-only, depth-write disabled and toggled by real UI.
5. Restore source-derived distant shore shapes and daylight palette/lighting
   through existing presentation paths. No cone islands standing in for a
   coast; proxies remain non-editable and outside the active authority.
   Keep exact C01/C02/C04 poses and FOVs; do not hide defects with new cameras.

## Implementation phases

1. Add failing cases for real 0.125 m runtime cells, compact material-page
   ownership/order, source-defined shoreline, water overlap and reticle leak.
2. Implement bounded authored pages and meshing in `src/hvp/`, reusing
   `hvpTerrain.ts` where compatible; at most focused source/page/mesh files
   where separation makes ownership clear. Wire `hvpBootstrap.ts` to them.
3. Correct `src/hestia-prototype/presentation/look.ts`, HVP look projection
   and background construction: pale dry limestone, darker neutral wet rock,
   localized soil/moss, turquoise water, warm key/cool fill/daylight distance.
   Correct reticle hide/restore and expose an accessible real HUD visibility
   option for beauty captures. Preserve routing and lifecycle failures.
4. Update only affected `tests/unit/hvp-*.test.ts` and HVP E2E assertions.
   Keep independent exposed-face/winding/cavity/negative-boundary oracles,
   genuine coverage failures, caps, double-mount/dispose and water-off cases.
   Numeric RGB literals and the rejected old render are not art authority.
5. Two independent technical reviews with distinct correctness and robustness
   mandates; reconcile findings before fresh verification and presentation.

## Tests and evidence

- Unit checks: compact page determinism, negative leaf coordinates, immutable
  reads, 0.125 m detail at named shore fixtures, asymmetric heights, channel
  continuity, slots/roles and exposed-face equivalence, no water/coplanar-solid
  overlap, outward winding, cap rejection before large allocation, route and
  lifetime regression. Test actual runtime data, not only metadata strings.
- `npx --no-install tsc -p tsconfig.json --noEmit`, `npm run build`,
  `npm run test`; targeted HVP E2E then relevant existing live/UI groups.
  Core Node-22 requirement must not be relaxed for local Node-26 drift.
- Browser proof uses configured Playwright MCP, real entry/buttons and
  C01/C02/C04 at 1920x1080 and 1280x720, DPR 1. Inspect images, including
  water on/off and shore close-ups; console and page failures must be reported.
- Candidate captures and manifest go outside historical approved baselines.
  Bind candidate source/diff, profile, dimensions and actual image hashes.
  Store CPU/mesh byte and triangle counts as diagnostics, not hardware PASS.
- Separate semantic tests, profile-bound regression and human art comparison.
  Missing new accepted baseline/art review stays pending, not a fabricated pass.

## Risks

Full-region generation/meshing can block input or exceed product budgets.
Count/preflight and use bounded pages rather than silently reducing fidelity.
Material grouping must not spread a giant index array into function arguments.
Runtime sampling must not conflate a proxy hit with an editable material cell.
The old tests encode dark palette and rejected geometry; change expectations
only with the restored source/visual contract and a concrete negative oracle.

## Rollback / safe stop

One writer only in this worktree. Preserve previous commits, other worktrees,
original concept art and historical captures. Leave reviewable local changes;
no reset/delete/rebase/commit/push/merge during this correction. If a required
contract cannot fit the stated caps, report a specific blocker, not a coarse
fallback. Final Plannotator tooling could not be discovered in the current
tool registry; the human gate remains required and is NOT RUN, not waived.

## Progress log

- [x] Original images and normative source/visual/cap sections inspected.
- [x] Runtime source defects and ineffective visual checks identified.
- [x] Compact terrain and presentation correction implemented.
  - `apps/weltraum-browser/src/hvp/hvpCoastSource.ts` (new): versioned authored
    source `hvp-authored-coast-v1`, seed `hestia-hvp-lagoon-001`, 256x128x256
    Uint8 X-fastest pages (8,388,608 bytes), exact 6-point channel polyline
    with segment distances and stable ties, asymmetric plateaus/hills,
    height-banded 0.125/0.25/0.5 terraces, registry-bound material bands,
    immutable readers, source-digest gate, y=0 water mask excluding
    dry/coplanar tops (11,621 cells, 181.6 m2).
  - `apps/weltraum-browser/src/hvp/hvpCoastMesher.ts` (new): structural-order
    material-compatible greedy meshing over typed arrays (26,982 quads from
    237,450 unit faces, 53,964 terrain tris), water mask mesh (190 quads,
    correct +y winding), 2 m distant islet continuation, 0.25 m shore apron
    burying the region plate edge, open-sea ring. Budgets enforced before
    output allocation; no bulk argument spread.
  - `hvpBootstrap.ts`: async chunked source build with Loading yields,
    slot-derived look roles, budget admission (11.1 MiB CPU, 3.1 MiB mesh,
    ~54k tris, 7 draw calls), daylight look scene, reticle hide/restore,
    invalid-source fail-closed, one mount/RAF loop preserved.
  - `look.ts` (`hvp:readable-coast-v2`): pale dry limestone, neutral dark wet
    rock, earthy soil, lively moss, turquoise water, daylight sky/fog/key/fill.
  - `hvpHud.ts`: real water toggle kept; accessible Hide-UI and labeled
    Inspect (Fly/Orbit) controls added.
  - `hvpTerrain.ts` kept as the frozen 1 m reference oracle path; misleading
    out-of-HVP02 comment corrected.
- [x] Both independent reviews reconciled by the orchestrator; all confirmed
  findings through the final R11 boundary-hardening pass were corrected and
  both affected technical re-reviews returned CLEAN.
  - 2026-09-10: both independent `worker-alternate` reviews have now run.
    Correctness: `ses_f75a27aafffe1LhPB73OlvQnva`; robustness:
    `ses_f75a279a9ffefoHEb3em0qESQg`. Verdict: corrections required.
  - Confirmed: cancellation is not registered during async Loading; an early
    pagehide test is required. The returned handle is only available after
    start resolves, so the suggested immediate external-dispose reproduction
    must be corrected to a genuinely reachable lifecycle event.
  - Confirmed: rectangular apron/authority appearance, inconsistent water
    levels/materials, and separately authored far islets violate the agreed
    continuation contract. These are required corrections, not accepted debt.
  - Confirmed: the static 7-draw figure and CPU/mesh totals exclude presentation
    geometry and transient copies. Replace with aggregate, correctly named
    accounting and admission; prior figures are not complete scene evidence.
  - Actual 16-cubed leaf access/order is still missing despite the page wording;
    implement the planned bounded leaf reads instead of merely rewording it.
    Bind published candidates to the validated source without widening the
    shared renderer contract or trusting unrelated snapshot reader closures.
  - New density constants have no accepted physical-profile provenance. They
    must not be described as approved Hestia physics or accepted authority;
    use existing verified profiles if present, otherwise explicitly retain
    only unapproved prototype tuning assumptions pending the HVP-04 gate.
  - Orchestrator opened all four candidate images and independently reached
    the live Ready route at port 5173. Native C04 pre-correction capture:
    `hvp-review-r1-c04-before.png`; no art/baseline acceptance implied.
- [x] Fresh tests and C01/C02/C04 candidate captures inspected.
  - 30 new source/mesher unit tests; affected bootstrap/look/E2E assertions
    updated to the restored contract without widening thresholds.
  - Full unit suite, typecheck, build, and 8/8 focused HVP E2E pass on the
    real runtime; rejected-baseline PNG stays byte-identical, candidate is
    proven different from it (drift gate) rather than matched to it.
  - Candidates under `apps/weltraum-browser/evidence/hvp-candidates/`
    (unversioned): hvp-c01-eye.png, hvp-c02-with/without-water.png,
    hvp-c04-wide.png.
- [x] Independent review reconciliation (worker pass, 2026-09-10; re-review
  by others still required before any gate).
  - F1 lifecycle: pagehide registered before expensive work; post-await
    disposed/epoch guard publishes nothing on canceled starts; failure UI
    never installs into torn-down or superseded mounts (epoch-guarded
    teardown/datasets/reticle). Regressions: pagehide-during-deferred,
    late-reject-after-dispose, late-failure-vs-newer-mount.
  - F2 continuation: apron/sea-ring/cone-cakes deleted. One source-defined
    coast: 0.125 m join ring (16-20 m, same columns/roles, ghost-culled
    join faces both sides, exact culling oracle), coarse far field from the
    SAME macro descriptor (radial open-sea ease from 30 m, three authored
    lobed islands, seam-clamped, inner faces culled), single y=0 water
    (authority 0.125 + continuation 0.5 grids, disjoint, area-conserved).
  - F3 motif: lobed/notched hills at authored positions/heights (notch
    witness ratios), coherent soil/moss patch fields (blob fractions, no
    hash speckle), two extra shoreline coves, warm hemisphere bounce via
    look profile (`hvp:readable-coast-v3`). Source is now
    `hvp-authored-coast-v2` (digest `f0c621f2`); old v1 digest not claimed.
  - F4 admission: aggregate ledger from actual products (slots, owned copy,
    masks, mesh bytes, grouped indices, mesher temp estimates, actual
    triangles/draw groups; GPU declared `unsupported`). Preflight reservation
    before materialization, mesher gates during, ledger admission before
    first dispatch; injectable caps with a pre-dispatch low-cap rejection
    test (zero Upserts). Measured full scope: CPU 33.6 MiB (cap 256),
    mesh 4.0 MiB (cap 128), triangles 69,230 (cap 500k), draw calls 10
    (cap 300). Prior 11.1 MiB/54k/7 figures are superseded (they excluded
    join/far/continuation and transients).
  - F5 pages: bounded 16^3 leaf reads in adaptive X-fastest local order
    (16x8x16 grid, address helper, negative/out-of-range RangeError),
    forward/reverse/shuffled byte+digest equivalence, combined leaf digest
    bound to the source digest; out-of-region reads Unknown via the owning
    prepared path. Global pages realigned to adaptive x,y,z order.
  - F6 provenance: single owned copy via prepareHvpCoastSource shared by
    mesh/water/reads; water digest mixes the source digest;
    assertHvpProductsBound checks all digests/algorithms pre-dispatch with
    mismatch negatives; no MeshArtifact schema change, no Structural
    provenance invented. Render identity beyond pre-dispatch binding
    remains a known gap for re-review.
  - F7 strict indices: malformed look ranges throw (no vertex-zero
    fallback), covered by a dedicated negative.
  - F8 densities: no reusable Hestia physics profiles found in-repo; registry
    entries now carry explicit `prototype-tuning-unapproved` provenance
    (digest-bound), pending the HVP-04 gate.
  - F9 hygiene: single column-sampling path (`readHvpSourceColumnWorld` +
    shared slab fill); seam continuity probed at the source level plus the
    exact culling oracle; drift gate kept strictly as a change detector
    (reworded, not acceptance); old `hvp-candidates/` PNGs preserved, new
    dumps under `evidence/hvp-candidates-r2/`; scratch specs removed.
  - R2 candidates (unversioned, `evidence/hvp-candidates-r2/`): hvp-c01-eye,
    hvp-c02-with/without-water, hvp-c04-wide. C04 shows one continuous
    limestone coast (authority/join/far tones unified), open sea with
    shallow shelves, three staggered islands, lagoon outlet, no plate edge,
    no cones, no water overlap. HUD totals match the ledger exactly
    (faces 33,963 / tris 69,230).
- [x] Independent visual candidate review completed for R10 and preserved by
  byte-identical R11 captures. Final human diff approval is a separate required
  publication gate. No accepted regression baseline is promoted by this task.
- [x] R3 AO integration (authorized narrow exception, HOLD lifted only for this).
  - User approved `AO übernehmen (Empfohlen)`: existing Lab AO plus relevant
    tests may enter the shared product mesh/material path as the ONLY
    exception to the former Lab-codeimport ban. Lab renderer, kernel,
    benchmarks, and all other Lab contracts stay out. No merge/art
    authorization; approval is not broader than that.
  - Frozen source: `hestia-voxel-kernel-lab @ 94bd8acd7ab12d21ff53987330a0e97f46166a17`
    (#VOXEL-LAB-004); files `src/voxel/blockAo.ts`, `src/voxel/aoGreedyFaceMesher.ts`,
    `src/render-three/aoVertexColors.ts` (AO_DARKNESS=0.60); oracle refs
    `tests/unit/palette-ao.test.ts`, `ao-greedy-mesher.test.ts`,
    `ao-render-products.test.ts`, `tests/contracts/wp04AoGolden.ts`,
    `tests/e2e/block-ao.spec.ts`. Read-only; no cherry-pick/merge/import.
  - Corrected diagnoses (orchestrator-verified, no blind fixes): three
    0.185.1 defaults already NoToneMapping + SRGBColorSpace (no sRGB fix);
    emitQuad corners carry identical correct face normals and
    FLAT_SHADED derivatives add no AO (no flatShading fix); HVP already
    rides the shared ThreeRenderBackend/MaterialFactory with its own
    key/hemisphere/fill rig under lightingMode None (no shadow-map/SSAO/
    PBR/postprocess additions); `MeshArtifact.attributes.color` (optional
    Float32 RGB) is validated/hashed/copied and uploaded by
    threeMeshFactory 35-38 while ThreeMaterialFactory never enables
    vertexColors — that flag gap is the integration point, no new
    MaterialProfile semantic schema required.
  - Earlier green figures/captures are NOT current or complete proof for R3;
    fresh verification and r3 candidates required.
- [x] R3 AO integration (worker pass; re-reviews still required).
  - ONE new product module `src/voxel/blockAmbientOcclusion.ts` (AO math +
    Lab-order corner bridge + darkness factor 0.60, no palette/debug/UI),
    consumed by the existing HVP greedy core: per-face AO signatures join
    the merge key (no smearing across regions), Lab-rule diagonals mapped
    to HVP corner order, grayscale Float32 vertex colors out. Unknown
    coverage samples occlude nothing (fail-open brightness, never invented
    shadow). Reference oracles run AO-off (stable merges); production
    terrain/join run AO-on; far/water stay uncolored (live mixed-scene
    proof). Winding verified outward for both diagonals on all six faces;
    a real F0 bridge bug was caught and fixed by that test.
  - Shared factory: `acquire(profiles, { vertexColors })` caches
    colored/uncolored variants per profile id without conflict; default
    path byte-identical. `prepareThreeMesh` enables the flag only when the
    artifact carries color. Mixed-scene both-orders/dispose/conflict
    covered; malformed colors fail closed at the artifact boundary.
  - HVP supplies AO colors through terrain/join artifacts (water/far
    uncolored); Inspect-only `AO: on/off` HUD toggle (aria-pressed,
    default ON) flips vertex modulation on the two AO nodes render-only.
    E2E A/B at C02 proves a brightness delta with everything else fixed
    (off brighter), plus a 1280x720 capture; r3 dumps are distinct files.
  - Measured R3 scope: terrain 47,832 quads (168,289 unit faces, unchanged
    coverage), join 14,699, water 625, far 652; CPU 52.2 MiB / mesh
    10.5 MiB / 127,616 tris / 10 draws — all inside caps, HUD totals match
    the ledger exactly. Source digest unchanged (`f0c621f2`): AO is render
    derivation bound by the artifact content hash, not new occupancy.
  - R3 candidates (unversioned, `evidence/hvp-candidates-r3/`):
    hvp-r3-c02-ao-on/off (A/B pair: crevices and underwater steps gain
    clear depth with AO, flat without).
- [x] R4 review-defect reconciliation (worker pass 2026-09-10; re-reviews
  still required). All six orchestrator findings addressed with proof:
  - F1 AO corner order: the color path double-rotated through the Lab
    bridge on faces 1/2/4 (orchestrator-reproduced). Fixed at the owning
    conversion (colors emitted directly in HVP pack order; misleading
    reorder helper deleted); diagonal input convention documented as
    HVP-order. Exact per-corner oracle on a hand-derived wall fixture
    (faces 1/2/4 concave + open controls on 0/3/5) pins factors to world
    positions independently of any bridge table.
  - F2 factory ownership: toggle now swaps whole material arrays between
    mount-owned plain-variant leases and stashed colored arrays; cached
    instances are never mutated. Toggle→reacquire, both orders, and
    teardown covered; geometry/commands proven unchanged across toggles.
  - F3 ledger/HUD honesty: ledger now counts backend artifact snapshot
    copies plus grouped arrays, separates retained logical mesh
    (artifact copies + wrapped far arrays, cap 128 MiB) from build-peak
    CPU (cap 256 MiB); GPU stays `unsupported`. HUD shows authority
    faces/verts/tris plus explicit all-scene totals (no mixed scopes).
    Pure exact-ledger and cap-just-below tests included.
  - F4 binding/evidence: `evidence/hvp-candidates-r4/` holds 7 captures
    (C01, C04 ×2 profiles incl. a real 1280x720 tech image, C02 water
    on/off + AO on/off) plus ONE manifest binding base commit, dirty flag,
    8 product-source file hashes, Lab commit/file list, source/render
    digests, cameras/FOV, AO/water state, browser/DPR/dims and PNG
    sha256/bytes. No self-hash; old sets labeled historical, pixels never
    reattributed. Manifest is env-gated (no CI churn).
  - F5 A/B oracles: localized concave-vs-same-face-open control, explicit
    uniform-darkening reject on open fixtures, toggle asserts zero Upserts
    plus byte-equal geometry, real-route E2E A/B retained.
  - F6 no-diorama: sea ring/islet-cakes/apron deleted in the prior pass;
    far field derives from the same macro descriptor (radial ease from
    30 m, three authored lobed islands, no square fade). Seam ownership is
    join-wins by construction with an exact authority-side culling oracle
    recomputed from public reads; join-side coverage pinned; far inner
    faces proven within one far cell of join truth (far 2 m granularity
    documented). Far carries dry/wet bands (soil/moss stay near-field by
    proxy contract) via a tolerant grouping variant that keeps
    order/divergence/contiguity checks; strict mode unchanged for the
    authority. Outer water shares the far-column helper (single truth);
    far/water partition test included. Measured R4 scope (HUD-exact):
    64,657 scene faces / 129,308 tris; ledger-derived draws (4 terrain +
    1 water + 4 join + far present roles) and CPU/mesh totals inside caps
    (R3 census magnitude: 52.2 MiB CPU / 10.5 MiB mesh); C04 shows one
    continuous limestone coast, open sea, staggered islands, no plate edge,
    no cones, no water overlap.
  - Verification for R4 (all under pinned Node v22.23.2): tsc clean, build
    clean, full unit 156 files / 1548 tests PASS, HVP E2E 9/9 PASS with
    zero console/page/request errors; r4 captures inspected (C04/C01/C02
    above). Runtime used the task-owned Vite on :5173 (previous instance
    expired, current bg_mtvigw8o_4 left running); no runtime started or
    stopped by this worker.

### Orchestrator R4 countercheck — 2026-09-10

The worker completion claim above is not acceptance. Its final handoff also
lists F6 stabilization and capture refresh as pending. The orchestrator checked
the actual worktree and found:

- Fresh pinned-Node-22 run of `hvp-ao`, `hvp-source-r2`, and
  `three-material-factory`: 3 files / 35 tests PASS (exit 0).
- SHA-256 of `hvpCoastSource.ts`, `hvpCoastMesher.ts`, `hvpBootstrap.ts`, and
  `hvp-candidates-r4/hvp-c04-wide.png` matches the corresponding manifest
  entries. This is a four-entry check, not full manifest validation.
- The opened R4 C04 image still shows a straight rectangular raised boundary
  around the detailed region. The preceding "no plate edge" claim is rejected.
  `meshHvpFarField` still snaps boundary columns down to the 2 m vertical grid;
  the F6 test permits `min(source samples) - 2.01`, which does not prove the
  required source-faithful transition. F6 remains OPEN; do not weaken the
  visual contract or hide the boundary with cameras, fog, or vegetation.
- The previous task-owned Vite process `bg_mtvigw8o_4` is no longer present.
  No replacement runtime was started during this check.
- Both affected independent re-reviews, final verification, and human
  diff/art review remain pending. No commit, push, merge, or art acceptance.

### R5 bounded correction — investigation / working steps

- Verified this exact worktree, branch and unchanged base `6c161f83` before
  writing; the earlier recovery is dirty/untracked and is preserved. Read
  current code, HVP history, normative handoff and all three original images.
- Root cause is the installed representation, not the authored heightfield:
  far tops are quantized twice (1 m then 2 m); the join treats its in-grid
  authority hole as air, including AO; water samples a third grid/height.
  The R4 C04 rectangular lip and turquoise island skirts are real defects.
- Working sequence: add emitted-surface red oracles; replace far volumetric
  quantization with source-height columns on a fixed horizontal proxy grid;
  cull both seam directions against installed neighbors, subdividing coarse
  seam risers at fine column boundaries; derive water on those same installed
  footprints. No source reshaping, apron, clamp, epsilon, camera or cap change.
- Retain the existing greedy corner/winding/AO/material path. Account for the
  internal join-water mask and far output scratch. The current bootstrap now
  dispatches far as a MeshArtifact, so its snapshot copy must also be counted
  (the old ledger comment saying far only wraps arrays is stale).
- Keep red reproduction, then focused checks and one stable full-unit/build
  pass. New R5 captures only from the stable candidate and authorized runtime.
  Parent owns independent reviews, fresh final verification and human gates;
  this writer delivers an unapproved candidate, not completed HVP/art work.

### R5 bounded correction — implemented result 2026-09-11 (unapproved candidate)

- Red oracles first (all failed on the R4 code, all pass after the fix):
  authority/join seam both-directions coverage (was 72,101 bad spans),
  far emitted terrace heights incl. fractional border tops (was 55,301
  mismatches), join/far seam both-directions coverage (was 81,920 bad spans),
  silent in-grid AO parity (was bright where the visible neighbor shades),
  installed water-vs-land partition on join+far footprints (was 1,315
  mismatches). Rasterized emitted quads only; no sampling-helper oracles.
- Fix, smallest representation correction at the projection boundary:
  `hvpFarColumnTopMeters` is now the installed 1 m footprint (horizontal snap,
  unchanged source terrace heights) shared by far mesh, join ghost, and water;
  far mesh emits direct source-height column tops plus risers split at
  0.125 m against the actual fine neighbor (no 1 m/2 m vertical quantization,
  no rim clamp); join culls/AO-shades against in-grid authority solidity via
  `silentSolidAt`; water gained the internal 320x320 0.125 m join ring so the
  outer 0.5 m grid starts exactly at 20 m. Greedy corner order, winding,
  material ranges, Lab AO math/signatures/diagonals/tests unchanged.
- Supersedes without rewriting history: the "join-wins by construction"
  comment, the "no plate edge" R4 claim, the "wrapped far arrays" ledger
  comment, and the "coarse 1 m proxy steps" test comment are replaced by the
  above. Algorithm versions bumped (`v2`) because bytes changed; authority
  source stays `hvp-authored-coast-v2` / digest `f0c621f2`, look stays
  `hvp:readable-coast-v3`. Water digest changed (`b5c151f8`) — expected, the
  join ring is new coverage, not a source change.
- Ledger now counts the join mask (320x320) and the far MeshArtifact snapshot
  copy the bootstrap actually dispatches; caps unchanged and admitted
  (scene 366,890 tris < 500k; Ready gate is fail-closed on caps).
- Verification under pinned Node v22.23.2 (exit 0 throughout): focused
  `hvp-source-r2` 26/26, `hvp-coast-source` 30/30, `hvp-ao` +
  `three-material-factory` 11/11, `hvp-bootstrap` 22/22, `hvp-look` 5/5;
  full unit 156 files / 1550 tests PASS (361.8 s); `tsc -p` clean; `vite
  build` clean (preexisting >500 kB chunk warning only). HVP E2E 9/9 PASS
  (36.5 s, zero console/page/request errors) via the existing Playwright
  webServer; the bundled headless shell failed to spawn (`spawn UNKNOWN`),
  so the run used the documented system-Chrome fallback path
  (`WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH`), no config change.
- New `evidence/hvp-candidates-r5/` (7 PNG + test-written `manifest.json`,
  base `6c161f83`, dirtyTracked true, source digest `f0c621f2`): C04 shows
  one continuous terraced coast with lagoon water and two far islands, no
  rectangular plate, no cut edges at ±16/±20; C01/C02 show fine terracing
  with water meeting wet-limestone shores. r1–r4 preserved untouched.
- Residual, not acceptance: far-field 1 m voxel stepping reads stark against
  the 0.125 m center in C04 foreground (approved horizontal coarseness, but
  visually blunt); far islands are bare stepped rock (vegetation is HVP03);
  C02 shore banks are steep voxel walls (source-driven, not a seam defect).
  Cold first far-mesh build in the Node test env takes ~10 s (browser scene
  reaches Ready in ~6 s); one preexisting far test needed an explicit
  120 s timeout, matching the sibling heavy-test pattern. No art acceptance,
  no baseline promotion, no merge. STOPs here for parent-organized
  independent reviews, reconciliation, fresh verification, human diff/art gate.

### Astra xhigh correction pass — 2026-09-14

This section records the subsequent `openai/gpt-6-astra` pass (xhigh per the
parent's runtime verification). The preceding R5 implementation and its test
history were produced by Muse, not this pass. They remain historical candidate
claims, not formal independent review or art acceptance.

**Scope and basis.** Rechecked the exact worktree root and
`feature/hvp-02-readable-coast` at `6c161f83f767a60b4a62e85bd53cdcf00a79aaf1`.
Read current untracked source/mesher/tests, bootstrap accounting/publication,
the adjacent Structural greedy implementation, HVP Git history, normative
visual/handoff documents and the three original concept images. The existing
11 tracked modified files and recovery's untracked files were preserved.
This pass changes only `tests/unit/hvp-source-r2.test.ts` and this ExecPlan;
no product source, authority descriptor, material, camera, cap or runtime
configuration was changed.

**F6 technical finding.** I did not reproduce the R4 artificial raised-wall
defect in the R5 geometry. R4 reduced fractional source heights to a 2 m
vertical grid and left hidden seam walls. R5 instead emits the source terrace
height at each installed 1 m far footprint, splits its join-facing risers at
0.125 m, and culls each direction against the installed neighbor. The join's
in-grid authority context also participates in AO. Water is partitioned at
the same installed footprints, at y=0. These are projection changes; they do
not make the far footprint equal to every finer sample inside it or establish
art acceptance. No additional projection change was justified by this pass.

**Oracle correction, not a claimed terrain red-to-green fix.** The former
`emittedQuads` oracle accepted two overlapping triangles with four correct
bounding-box vertices and a missing region. A new negative fixture first
failed with `expected [Function] to throw an error` (exit 1). The reader now
checks actual indexed triangle winding/area, an interior shared diagonal,
axis-aligned rectangle corners and exact 0.125 m grid positions before using
rectangle coverage. Seam checks clip intersecting faces to the checked span
instead of silently ignoring faces extending past a corner. Far/join holes
must be empty. The existing water partition oracle now also checks authority
coverage, in separate per-region cases rather than one longer test.

The strengthened tests check all 56,000 installed far top footprints against
the public authored column reader (not `hvpFarColumnTopMeters`); 294,912
0.125 m seam samples across the four sides of both boundaries, counting each
normal direction separately; and 326,400 authority/join/far water footprints.
The latter uses emitted land and emitted water, requiring exactly one land
top and water iff that top is below zero. It does not copy the mask helper's
classification. These checks pass without a geometric tolerance increase.
They prove the specified installed representation, not the full concept.

**Fresh commands/evidence in this pass.** Working directory for tests:
`apps/weltraum-browser`. All test commands used the pinned executable
`C:\IFI_SO~1\Utils\npm-tmp\opencode\hvp-node22\node_modules\node\bin\node.exe`:

- `node.exe .\node_modules\vitest\vitest.mjs run tests/unit/hvp-source-r2.test.ts --reporter=verbose`
  before edits: exit 0, 26/26, 21.48 s.
- Same runner with `-t 'rejects overlapping triangles'`: exit 1, one intended
  negative-oracle failure, 26 skipped; 0.727 s.
- First expanded run: exit 1, 26 passed and one 5,000 ms timeout (the combined
  three-region water case took 5,176 ms). No geometry assertion failed.
  Split it into authority/join/far cases; kept the original timeout, all
  footprints and assertions. No runner configuration or threshold changed.
- Final same full-file command: exit 0, 29/29, 23.40 s; individual water
  cases 1,947 / 906 / 2,255 ms. AO corner/diagonal/context and product-binding
  negatives in that file remained green.
- Read-only Node crypto verification: all 8 listed source files and all
  7 R5 PNG hashes/byte lengths matched the manifest; PNG IHDR dimensions also
  matched (six 1920x1080, one 1280x720), exit 0. An initial PowerShell quoting
  attempt failed with a Node SyntaxError before checking any files; corrected
  quoting produced the above result. No evidence files were written.
- Full unit/build/E2E/hardware checks: NOT RUN in this pass. Product bytes
  were not changed; the parent owns fresh verification after formal reviews.
  Earlier Muse successes and failures are not relabeled as Astra results.
- Final Git root/head/status checks confirmed the same worktree/branch/base.
  `git diff --check` and explicit `git diff --no-index --check -- NUL <path>`
  checks for both changed untracked files returned exit 0, no whitespace errors.

**Images and provenance limits.** Opened R4 C04, R5 C04/C01/C02 and all three
original references. R5 C04 no longer shows the R4 continuous raised straight
wall on either side of the fine patch. It still shows an abrupt fine-to-coarse
contour change, broad bare shelves, blunt far islands and repetitive stepped
hills. C01/C02 show fine steps and underwater geometry, but markedly simpler
terrain/light/water appearance than the concepts. Thus the preceding blanket
“no cut edges” / “approved horizontal coarseness” language is not an acceptance
finding. Coarse far presentation is allowed by the bounded brief; its current
visual quality still needs the owner's judgement. Vegetation is later HVP-03,
not a proposed cover for terrain defects.

R5 pixels remain current for the 8 hashed product inputs: no product bytes
changed in this pass. This is not complete provenance proof. The manifest
does not hash the full import closure, capture tests or configuration; it
hardcodes `chromium` and DPR rather than recording an observed browser version,
has empty per-capture state for C01/C04, and can collect existing C02 companion
files without proving they came from that same run. All opened R5 images keep
the HUD; they are not Hide-UI beauty captures. Their HUD reports 183,445 scene
faces / 366,890 triangles; that is candidate logical-count evidence, not new
hardware measurement. Preserve r1–r5; do not repair metadata by attributing
unobserved capture facts to old pixels.

**Additional source-contract concern, not silently expanded.** C04's channel
reads as closed at the northern end. The current source computes distance to
the finite polyline ending at `(0,16)`, so its carved margin terminates beyond
that endpoint rather than extending to the distant sea. This differs from the
normative channel-continuation intent; it is not the R4 vertical-quantization
seam bug. Parent should decide whether to authorize a separately bounded
authored-channel correction before changing that descriptor/source version.
No channel, vegetation or physics change was made here.

**Stop and ownership.** F6's installed height/seam/water mechanics are supported
by the focused checks above; overall F6 visual/art closure remains pending.
No runtime was started/stopped, browser tab touched, screenshot recaptured,
dependency installed, file deleted, commit/push/merge or configuration change
performed. No agent was delegated and no formal review/human gate executed.
Parent owns two formal native worker-alternate reviews, reconciliation, fresh
verification and the human diff/art gate. If fresh browser/beauty evidence is
required, provide a bounded Ready HVP route on this worktree at the documented
`http://127.0.0.1:5173/?hestiaPrototype=1`; parent owns its lifecycle. This pass
makes no fresh live-browser or full-HVP-completion claim.

## Definition of Done

The actual scene satisfies the above bounded coast correction, retains its
truth/coverage/budget boundaries, passes fresh relevant checks, and is shown
as a real candidate next to the original references. No statement of full HVP
completion, art acceptance, baseline promotion or merge precedes those gates.

### R6 review-finding reconciliation — 2026-09-14 (unapproved candidate, re-reviews pending)

One writer in this worktree for this pass. Root/head/base verified first:
`feature/hvp-02-readable-coast` at `6c161f83f767a60b4a62e85bd53cdcf00a79aaf1`.
No commit/push/merge/reset/config/DevToolbox changes. r1–r5 preserved
untouched; new evidence only under
`apps/weltraum-browser/evidence/hvp-candidates-r6/`.

- Triangle headroom (robustness HIGH residual, docs only): R5 scope is
  366,890 / 500,000 triangles, leaving exactly 133,110 before any HVP-03
  vegetation. Cap unchanged. No diagnostics schema was added (the ledger/HUD
  already expose triangles; no field owns headroom). Logical counts only,
  not hardware/GPU proof (GPU stays `unsupported`). HVP-03 must fit or
  re-budget within the remaining 133,110.
- Far material proxy pinned (correctness M1): `meshHvpFarField` downgrades
  soil/moss to limestone-dry; authority/join retain all four roles. New
  unit test pins far slots ⊆ {1,2} with 3/4 absent while terrain and join
  report exactly [1,2,3,4]. Geometry/source/art unchanged; the visible role
  seam at the 20 m boundary is recorded as accepted simplification, and the
  R6 C04 shows it honestly for human judgement.
- Rejected-baseline provenance (M2): `evidence/hvp-visible-coast-1920x1080.png`
  (hash `b47b7e48…d1e3`) was first added in commit
  `c068e6946577a44de55305fa32eba7a4650be586` ("HVP-01-FIX: close 8
  visible-coast blockers…"). The producing branch is NOT objectively
  provable from Git (`branch --contains` shows containment only, including
  origin/main after merge), so branch is recorded as unknown next to the
  hash in `tests/e2e/hvp-look.spec.ts`. PNG/hash unchanged, not promoted.
- Water predicate unified (L1): the join ring used `< 0` while
  authority/outer use `< -1e-9`. One-line change to `< -1e-9`, no helper.
  Behavior-preserving by construction (emitted tops are exact 0.125 m-grid
  multiples, so both predicates coincide); partition tests stay green.
- Far `unitFaceCount` corrected (L3): it reported `columnCount +
  quads.length` although columns are not faces, and fed only the
  conservative transient estimate. Exported `unitFaceCount` is now the real
  emitted rectangle count (`quads.length`, hence `=== faceCount` for far);
  the conservative column scratch is preserved under the honestly named
  local `conservativeColumnScratchFaces` with byte-identical
  `tempEstimateBytes`, so ledger admission safety is unchanged. New exact
  small-far test (halfMeters 21) failed first (917 vs 753) and passes now.
- Legacy look path (robustness LOW3): `createHvpLookTerrain`/
  `terrainFaceRole` now carry an explicit `@deprecated` reference-only
  notice ("do not wire to production"); no runtime or test-restructure
  change.
- AO toggle oracle (LOW4): the real-route C02 E2E now snapshots DOM-held
  geometry/state identifiers (faces, triangles, source/water digests,
  camera, state, look, seed, HUD detail/mode) before/after the Inspect-only
  AO toggle and asserts them unchanged while mean luminance still rises;
  re-enable restores the same snapshot. The f0c621f2 containment keeps the
  oracle from passing vacuously. No TestBridge, no created controls, no
  renderer internals.
- Water restore oracle (LOW5): the T02 E2E now captures the re-enabled
  frame and proves it differs from water-off (>0.01 changed pixels) and
  restores the water-on frame (<0.01) with existing helpers/thresholds.
  No threshold broadening, no presentation change.
- R6 evidence (LOW1/2 + Astra caveats): 9 captures, all byte-unique (no
  duplicate bytes under two names; C02 AO-on is a `claims` entry on the
  water-on file). HUD-free 1920x1080 full-page beauty for C01/C02/C04 via
  the real Hide UI button plus canvas oracles; HUD-visible 1280x720 C04
  technical. Manifest records observed `chromium 153.0.8010.37`, observed
  DPR 1, explicit state per capture, fixed cameras/FOV, source/look/
  water/AO state, base+dirty, product-source hashes, capture-test file
  hash (`tests/e2e/hvp-look.spec.ts`), and r4/r5 supersede notes. No
  full-closure binding claimed. C01/C02 water-on and AO-off canvases are
  byte-identical to R5 (source-stable); C04-wide and water-off canvases
  differ at byte level from R5 while a same-code repeat run reproduces R6
  bytes exactly — consistent with cross-run renderer/timing variance, not
  a product change (R6 product diffs are render-neutral by construction:
  epsilon-equivalent predicate, diagnostics-only counter, comment-only
  bootstrap edit). Human art review decides.
- Accepted residuals, no code change: AO bridge duplication (L2, already
  mitigated by the hand-derived world-corner test and Lab-verified),
  moss-slope forward difference, strict join roles — rationale: pinned by
  existing oracles, changing them would alter authored source/render.
- Channel endpoint: the northern channel reads closed because the carved
  margin terminates past the finite polyline endpoint `(0,16)`; the
  endpoint inherits the exact agreed channel and extends 1.5 m, with open
  sea later. Recorded as a human art/composition decision for the owner,
  not a code defect; no source/version change in this pass.

Verification (pinned `hvp-node22` Node v22.23.2, exit 0 throughout):
`tsc -p tsconfig.json --noEmit` clean;
`hvp-source-r2` 31/31 (incl. 1 failing-first red→green + 1 pin);
`hvp-coast-source` + `hvp-ao` + `three-material-factory` + `hvp-bootstrap` +
`hvp-look` 68/68; targeted HVP E2E (`hvp-look` + `hvp-visible-coast`) 9/9
with zero console/page/request errors via the existing Playwright webServer
(system-Chrome fallback path, no config change; port 5173 verified closed
afterwards). Full suite/build NOT rerun here; parent owns fresh aggregate
verification after re-reviews. STOPs here for both affected independent
re-reviews, then fresh verification and the human diff/art gate.

### R7 evidence-fitness correction — 2026-09-14 (unapproved candidate, re-reviews pending)

Evidence-only pass: no product source/geometry/look/camera/cap change
(ledger still 366,890 tris, 133,110 headroom). Supersedes R6 ONLY for
evidence fitness; the R6 record and images above are preserved as history.

- Wording correction: R6 "HUD-free beauty" overclaimed. `#debug-scene` is
  a fullscreen (`100vw`/`100vh`) canvas with the fixed HUD overlaid, and
  Playwright locator screenshots are composited page-region crops, so
  overlapping DOM is included by construction. A locator capture therefore
  cannot be UI-free while any control remains visible. R7 states the
  precise residual instead: canvas-region capture with HUD panels hidden,
  lone Show UI button remaining top-left by product design. Zero-UI pixels
  would need a product-side change (e.g. Hide UI also hiding its own
  button with a non-button restore path) — an owner decision, not taken
  here; no CSS/test mutation, cropping scripts, or evaluate-created
  controls were used.
- HUD-region proof (new, real-route, reads only): T08 captures C01 with
  panels shown and hidden, measures the real `#hvp-hud` box, and proves
  the scene outside that box stays fixed (outside changed ratio < 0.005)
  while the panels actually disappear (inside changed ratio > 0.2). This
  passed first try and confines the UI contribution to the measured box.
- Freshness guard (new `tests/e2e/hvp-evidence-guard.ts`, no product code):
  each emitter fails closed before any capture when its own output names
  already exist, when `WELTRAUM_HVP_RUN_ID` is unset, or when the
  `.hvp-run-id` token shows another run claimed the target. Nothing is
  ever deleted. Unit negatives (4/4 green, temp dirs only) plus a live
  reuse probe: re-running T02 into the completed r7 with a new run id
  fails with the explicit not-fresh error and leaves all r7 bytes
  untouched. Normal targetless runs stay write-free.
- Water oracle pairing fix: the R6 restore comparison mixed HUD states
  (hidden baseline vs visible restored) and measured a deterministic
  0.02828 overlay delta — identical to 16 decimals across two runs —
  proving HUD state, not water state, dominated. T02 now re-hides before
  the restored capture (hidden/hidden pair, matching the shipped bytes)
  with thresholds unchanged, plus the new real-button `Water: on`
  visibility assertion. The removed byte-equality side-quest is recorded
  as invalid, not as product behavior.
- R7 set (`apps/weltraum-browser/evidence/hvp-candidates-r7/`, fresh dir,
  run id `r7-2026-09-14-005` bound in manifest + token): 6 captures, all
  byte-unique and hash-bound — C01/C04/C02-water canvas-region beauty
  (1920x1080, panels hidden), C02 water-off + AO-off diagnostics
  (canvas-region, HUD visible), C04 page-level technical (1280x720, HUD
  visible). C02 AO-on remains a `claims` entry on the water-on file, no
  duplicate bytes. Manifest carries observed `chromium 153.0.8010.37`,
  DPR 1, fixed cameras/FOV, source/look/digests, base+dirty, product
  hashes, capture-test hash, and per-capture framing states. No
  full-closure, art, or golden claim.
- Verification (pinned Node v22.23.2): guard unit 4/4 exit 0; tsc clean;
  targeted HVP E2E 9/9 exit 0 with zero console/page/request errors
  (system-Chrome fallback, existing webServer, port 5173 verified closed
  after each run); manifest hashes/dims/uniqueness verified read-only;
  r6 untouched (all 9 entries still hash-match). Full unit/build NOT
  rerun; parent owns fresh aggregate verification. STOPs here for both
  affected independent evidence re-reviews, then human gate.

### R8 final evidence-integrity reconciliation — 2026-09-14 (unapproved candidate, final affected reviews pending)

R7 is superseded for the partial-manifest freshness hole only; product,
rendering, triangle count (`366,890`) and the no-art/no-merge acceptance boundary
are unchanged. The R8 guard rejects any known candidate or manifest on a first
claim, permits earlier same-run emitters, rejects an emitter's own existing
outputs, rejects foreign or blank run IDs, and never deletes files. The manifest
now requires all three primary and all three companion records and is marked
`complete: true`; unreadable companions fail before manifest write. The restored
Hide UI action is asserted hidden before the restored capture, and HUD-region
mapping uses the actual browser viewport width rather than `1920`.

Fresh evidence is emitted only to `apps/weltraum-browser/evidence/hvp-candidates-r8/`
with a unique run ID. It preserves the disclosed lone Show UI control and makes
no UI-free, HUD-free or clean-plate claim. Under pinned Node `v22.23.2`, the
guard unit is 5/5 PASS, typecheck is PASS, and the full targeted HVP run
(`hvp-visible-coast.spec.ts` + `hvp-look.spec.ts`, 9 tests) is 9/9 PASS with
zero reported console/page/request errors. The filtered T08 stale-C02 negative
fails as expected (exit 1) before writing a token or capture; the target held
only `hvp-c02-with-water.png` and was cleaned up. Targetless T02 is 1/1 PASS.
Port 5173 is closed after each run. Read-only manifest validation is PASS:
run `r8-2026-09-14-006`, `complete: true`, six byte-unique captures, expected
1920x1080/1280x720 dimensions, capture-test and product-source hashes/bytes,
token/source binding, observed Chromium `153.0.8010.37`, DPR 1, and the
disclosed capture labels were inspected. Full unit/build are NOT RUN in this
pass. STOP for the final affected reviews; no product publication or merge.

### R9 final HUD review reconciliation — 2026-09-14 (technically verified, human review pending)

Both final technical reviewers confirmed R8 evidence integrity and independently
found that Hide/Show replaced and then removed the control buttons' entire inline
style. The visibility command now toggles the native `hidden` attribute, preserving
button spacing and pointer behavior. The existing HUD unit test pins hidden state,
the always-visible restore control, and original button styles across the round trip.
The evidence emitter now explicitly lists R7 and R8 in historical supersession.
R1–R8 remain historical and untouched; fresh R9 captures are required because the
restored HUD layout changes. Terrain, water, AO, cameras and caps are unchanged.
Both `reviewer` and `reviewer-glm` affected re-reviews returned CLEAN. Fresh pinned
Node 22.23.2 verification passed: 157 Vitest files / 1,560 tests; TypeScript
`tsc -p tsconfig.json --noEmit`; Vite production build (202 modules, existing
500 kB chunk warning only); HVP E2E 9/9 plus shared-render lifecycle 1/1.
R9 contains six unique hash/dimension-bound captures, `complete: true`, current
eight product-source and capture-test bindings, unchanged terrain/water digests
and 366,890 triangles. Run ID: `r9-2026-09-14-5ee9e17ec7674b729286770bd6235523`.
The parent inspected the test/build logs and R9 HUD capture; restored button
spacing is visible. Logs: `C:/IFI_SourceCode/Utils/npm-tmp/opencode/hvp-r9-` with
suffixes `full-vitest.log`, `build.log`, and `e2e.log`. Port 5173 was closed before
and after testing. R1–R8 are preserved. Unrelated full E2E groups were NOT RUN.
Human diff/art review remains pending. No art acceptance, baseline promotion,
commit, push or merge is authorized by these technical results.

### R10 intermediate: source-owned outlet, wet bands and shelf interruptions — 2026-09-14

**Intermediate checkpoint, superseded by the final R10 ocean-edge follow-up below.**
The measurements and run ID in this intermediate section describe the first
candidate, now preserved at `C:/IFI_SourceCode/Utils/npm-tmp/opencode/hvp-r10-initial-candidate/`.
They are not the final contents of `evidence/hvp-candidates-r10/`.
The northern outlet, elevated wet-role defect and principal shelf interruptions
are corrected. The wet-layer mismatch is corrected, but the coarse far sampling
and finite outer-ocean edge remain visible. This section does not accept those
residuals, promote a baseline, or assert art/merge readiness. R1–R9 remain
byte-identical historical evidence, including the rejected baselines.

#### Current-source diagnosis and implementation

- **Northern outlet:** the six agreed active points ended at `(0,16)` and the
  finite-segment distance field rounded off there. Appended owning macro points
  `(3,23), (-1,31), (2,42), (0,56)` continue the same carve through the shelf to
  sea. The six active points, widths, cameras and FOV are unchanged. The carve
  uses the lower of its -1.5 m floor and the local seabed so it cannot raise the
  already deeper sea. Terrain, roles, join ghosts and installed water consume
  the same source. No overlay over dry land or artificial rim was added.
- **Water representation:** R9 already emitted one nonoverlapping water mesh
  with one Lambert profile, uniform upward normals, y=0, opacity 0.55 and
  depth-write disabled. There was no second water material to recolor. The real
  role mismatch was in the terrain beneath it: authority has two 0.125 m wet
  layers below submerged column tops; join/far emitted only one. Both now match
  the authority's 0.25 m band. Existing exact emitted seam and installed
  terrain/water partition oracles remain unchanged. This repairs that role
  discontinuity, not every visible resolution transition.
- **Wet height:** actual R9 authority bytes contained 28,003 wet cells, 3,075
  with upper faces at or above 0.375 m, reaching 2.5 m. The unbounded
  `channel.distance < outer + 0.25` alternative caused this. Removing that
  alternative retains the existing splash ceiling without changing the soil or
  moss policy. R10 has 25,387 wet cells, zero above that ceiling, maximum upper
  face 0.25 m. Elevated brown/green soil/moss patches still exist legitimately.
- **Repetitive shelves:** the original narrow gashes faced mostly away from
  the fixed views. The three existing hill descriptors retain their centers,
  heights and lobe functions, with additional facing notches at 1.55π, 1.35π
  and 1.1π. North/east use wider cuts; an existing eastern cove is shifted and
  widened to connect the cut to the bank, and a small west-facing cove breaks
  the foreground base shelf. Three adjacent angular samples each prove at
  least 0.75 m relief below both flanks. No smoothing or stochastic noise.

Source is now `hvp-authored-coast-v3`, digest `8e3a45c4`; water digest is
`d1f80f24`. Coast/join and far algorithms are v3; unchanged water meshing stays
`hvp-water-mask-v2`. Numeric content-generation revision remains 1. Bootstrap
projects its already-admitted resource ledger/caps into the prototype dataset
for the emitter; normal `/` has no new behavior. The emitter additionally binds
the unchanged camera file and the observed ledger. This is nine explicitly
listed product-source hashes, not a claim to hash the entire import closure.

Changed in this pass only (relative to the intentional R9 dirty state):

- `apps/weltraum-browser/src/hvp/hvpCoastSource.ts`
- `apps/weltraum-browser/src/hvp/hvpCoastMesher.ts`
- `apps/weltraum-browser/src/hvp/hvpBootstrap.ts`
- `apps/weltraum-browser/tests/unit/hvp-source-r2.test.ts`
- `apps/weltraum-browser/tests/unit/hvp-coast-source.test.ts`
- `apps/weltraum-browser/tests/unit/hvp-bootstrap.test.ts`
- `apps/weltraum-browser/tests/e2e/hvp-look.spec.ts`
- this ExecPlan, plus new `apps/weltraum-browser/evidence/hvp-candidates-r10/`.

#### Falsification and fresh verification

Pinned executable for every command below:
`C:/IFI_SourceCode/Utils/npm-tmp/opencode/hvp-node22/node_modules/node/bin/node.exe`
(`v22.23.2`). Commands run from `apps/weltraum-browser`.

Before product edits, `node node_modules/vitest/vitest.mjs run
tests/unit/hvp-source-r2.test.ts -t 'HVP R10' --reporter=verbose` returned exit 1:
7 failed, 1 passed, 31 skipped. Exact failures:

| Oracle | R9 failure |
| --- | --- |
| Source north path | `source north outlet is blocked before z=56: expected false to be true` |
| Emitted north path | `emitted north outlet is blocked before z=56: expected false to be true` |
| Wet-role census | `wet cells above splash margin; max=2.5m: expected 3075 to be +0` |
| Join submerged risers | `submerged riser roles diverge from authority's two wet layers: expected 318 to be +0` |
| Far submerged risers | same message, `expected 113704 to be +0` |
| North shelf sector | `camera-facing notch drops: -0.5,-0.5,-0.5: expected -0.5 to be greater than or equal to 0.75` |
| East shelf sector | `camera-facing notch drops: -1,-1.25,-1.25: expected -1.25 to be greater than or equal to 0.75` |

The initial west-sector sample at 1.25π already passed; it was not falsely
reported as red. After aligning that sample with the C01-facing 1.55π sector,
the still-unchanged western descriptor failed with drops `-1.5,-2,-2` before
its notch/cove edit. The independent rectangle reader now also reads emitted
material ranges. Existing coverage, duplicate/winding negatives, AO, binding,
budget and lifecycle tests were preserved. Intermediate verification exposed
a missing wet-slot import (fixed) and insufficiently broad relief in the
authored cuts (adjusted without lowering assertions).

| Final command/check | Result |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run tests/unit/hvp-source-r2.test.ts -t 'HVP R10' --reporter=dot` | PASS, exit 0, 8 passed / 31 intentionally filtered |
| `node node_modules/vitest/vitest.mjs run tests/unit/hvp --reporter=dot` | PASS, exit 0, 9 files / 130 tests, 155.34 s |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS, exit 0 |
| `node node_modules/typescript/bin/tsc -p tsconfig.json`, then `node node_modules/vite/bin/vite.js build` | PASS, exit 0, 202 modules; existing >500 kB bundle warning |
| `node node_modules/@playwright/test/cli.js test tests/e2e/hvp-visible-coast.spec.ts tests/e2e/hvp-look.spec.ts --workers=1` | PASS, exit 0, 9/9, 43.4 s; route-isolation, real controls and negative evidence tests included |
| Interactive prototype console check | PASS, 0 errors / 0 warnings |
| Whole-repository units / unrelated E2E groups / hardware benchmark | NOT RUN; focused HVP contracts cover this source-only recovery |
| Delegated reviews / human Plannotator gate / art acceptance | NOT RUN; sole writer/no delegation requested; `plannotator_final_review` unavailable in the tool registry; no acceptance asserted |

The first E2E invocation failed before any candidate directory existed:
bundled `chromium_headless_shell-1228` returned `browserType.launch: spawn
UNKNOWN` for all 9 tests. Retried once with the already-supported
`WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe`;
no dependency/config change. Child process PATH selected the pinned Node bin.
Passing-run environment also set:

```text
WELTRAUM_DUMP_HVP_DIR=evidence/hvp-candidates-r10
WELTRAUM_HVP_RUN_ID=r10-2026-09-14-0ee43b57-68ff-4b06-8d89-46266fee94cb
WELTRAUM_PLAYWRIGHT_ARTIFACT_GROUP=hvp-r10-chrome
```

#### R10 evidence and remaining boundary

`evidence/hvp-candidates-r10/manifest.json` and `.hvp-run-id` bind that fresh
UUID run to six complete byte-unique captures, five 1920×1080 and one 1280×720,
observed Chromium 153.0.8010.37 / DPR 1, source/capture hashes and exact fixed
C01/C02/C04 camera metadata. All six images were opened and inspected. C04 at
both resolutions shows an open northern cut through the former dry closure
into sea. C01 retains a legible channel direction and distinct broken hill
shelves. C02 retains fine hard underwater steps; the water-off and AO-off
companions visibly isolate those contributions. Beauty panels are hidden via
the real UI; the disclosed lone Show UI button remains.

Observed admitted scene: **344,926 triangles**, **155,074 triangles remaining**
under 500,000 for HVP-03; **11 draw calls**; **155,094,728 controlled CPU bytes**
under 268,435,456; **23,569,992 retained mesh bytes** under 134,217,728. These are
logical payload/build estimates, not hardware/GPU measurements. GPU bytes
remain `unsupported`.

**Unresolved visual finding 2:** the existing 1 m far footprint is still visibly
coarser than the 0.125 m join at the northern cut, and the finite ±120 m ocean
boundary still produces a straight distant water/sky edge. An independent
Three.js projection using unchanged C01 maps water-edge `(120,0,40)` to
approximately `(123.44,456.54)` pixels and `(120,0,120)` to `(658.72,444.69)`,
locating that edge in the visible far band. It is not a second material, an
overlapping water strip, or the former dry northern enclosure. The underwater
role fix and green partition tests do **not** prove that this remaining visual
transition is resolved. No camera/fog/tolerance workaround was applied, and no
claim is made that a further representation correction cannot fit the caps.
The full visual acceptance criteria therefore remain open.

Runtime cleanup: DevToolbox's read-only runtime plan returned `PathMissing`
(no runner project configuration); this Vite-only checkout used a bounded
managed local server for native Playwright inspection. Its process tree was
stopped before E2E; the E2E-owned server shut down after testing. Port 5173 was
checked closed. Task-created native-browser scratch captures/snapshots were
moved to the approved external temp directory. No pre-existing file was removed.
An initial SHA-256 inventory of 2,800 existing files checks preservation against
the actual starting dirty tree rather than HEAD; historical R1–R9 hashes and
all unrelated existing bytes are preserved. No publication actions occurred.

### R10 final: source-bound ocean extent and verified candidate — 2026-09-14

**Final candidate is technically verified; art acceptance remains unclaimed.**
The intermediate visual inspection identified the actual distant straight
line as the finite water boundary. A further independent emitted-edge oracle
found **1,366 visible boundary samples** before the unchanged 170 m lighting
envelope at the fixed C01/C02/C04 views. The red failure was:
`finite emitted water cuts visible before the unchanged 170 m envelope:
expected 1366 to be +0` (exit 1). This proves why correcting wet roles alone
was insufficient.

The existing owning outer extent is now ±240 m for both installed seabed and
water; the far mesher consumes the source's existing extent constant rather
than another literal. This adds actual source-derived terrain/water coverage,
not an overlapping cover or painted strip. Fog, lighting, cameras, FOV and
transparency are unchanged. Northern opening remains visible near the shore;
it is not concealed in the distant atmosphere.

Simply extending the old endlessly repeated seabed relief failed the existing
mesher gate with `meshHvpOccupancy BudgetExceeded: 423417 quads exceed 250000`.
The source's meso relief is therefore confined to the coastal shelf: unchanged
through radius 70 m, reducing to zero at 90 m, leaving the authored hill
functions intact. Deep sea derives the same quantized source floor instead of
repeating shore-sized ripples indefinitely. This is a small source descriptor
change, not a new terrain system, coarser authority, camera trick or raised cap.
All installed far heights still match the source at their real 1 m footprints;
the unchanged exact partition oracle now checks the entire expanded extent.

Final source remains authored v3 / authority-leaf digest `8e3a45c4`. The leaf
digest is unchanged from the intermediate because the follow-up is outside
authority; the full source/mesher SHA-256 bindings changed and are recorded in
the new manifest. Water digest is now **`02f8f480`**. Source v3 and mesh v3 were
work-in-progress candidates throughout, not published releases.

#### Final evidence and verification

Fresh run: **`r10-2026-09-14-c67d8ede-b7cb-4f71-8b03-717c6d35c695`**.
The first candidate directory was moved intact to the approved external temp
path above before the existing fail-closed emitter claimed a new, empty
`apps/weltraum-browser/evidence/hvp-candidates-r10/` with this new UUID token.
Final manifest: six complete, unique, hash/dimension-bound captures; nine
current product-source bindings plus capture-test binding; observed Chromium
153.0.8010.37 / DPR 1; unchanged fixed cameras. No R1–R9 bytes changed.

All six final images were opened. C04 at both resolutions shows the northern
channel continuing through the shore to sea. The distant artificial straight
water cut has disappeared in C01/C04. Water remains a single continuous tone
over its shared wet substrate; C02 still shows the hard underwater steps and
the AO-off/water-off companions isolate the real presentation changes. Facing
notches visibly interrupt the three principal hills, particularly in C04.
Far 1 m rocks/shelf stepping and substantial bare plateau remain stylistically
coarser than the concepts; some long shelves remain between the new cuts.
These are disclosed visual residuals, not art acceptance or claims of perfect
concept parity. No vegetation was introduced.

Final admitted ledger (same limits):

| Metric | Observed | Limit |
| --- | ---: | ---: |
| Scene triangles | **219,480** | 500,000 |
| Remaining HVP-03 triangle budget | **280,520** | shared scene ceiling |
| Draw calls | 11 | 300 |
| Controlled build-peak CPU bytes | 179,858,088 | 268,435,456 |
| Retained mesh bytes | 16,043,232 | 134,217,728 |
| GPU/hardware measurement | unsupported / NOT RUN | no claim |

Pinned Node 22.23.2 commands, same working directory as above:

- `node node_modules/vitest/vitest.mjs run tests/unit/hvp-source-r2.test.ts -t 'HVP R10' --reporter=dot`:
  PASS, exit 0, **10 passed**, 31 intentionally filtered. Includes extended
  full-scene resource admission using the real grouped look products.
- `node node_modules/vitest/vitest.mjs run tests/unit/hvp --reporter=dot`:
  9 files, 132 tests; 131 passed and one stale 240×240 water-area expectation
  failed. That expectation now uses the actual 480×480 outer domain (not a
  resource cap or tolerance relaxation). A tuple-spread TypeScript issue in
  the new projection oracle was also fixed with explicit coordinates.
- Affected-file rerun `node node_modules/vitest/vitest.mjs run tests/unit/hvp-source-r2.test.ts --reporter=dot`:
  PASS, exit 0, **41/41**, 33.74 s. Together with the unchanged eight passing
  files, final HVP unit coverage is **132/132**; no product edit followed this
  verification. The final full invocation's original exit 1 is not relabeled 0.
- `node node_modules/typescript/bin/tsc -p tsconfig.json`, then
  `node node_modules/vite/bin/vite.js build`: PASS, exit 0, 202 modules;
  existing large-bundle warning only.
- `node node_modules/@playwright/test/cli.js test tests/e2e/hvp-visible-coast.spec.ts tests/e2e/hvp-look.spec.ts --workers=1`:
  PASS, exit 0, **9/9**, 42.6 s. Same Chrome override and pinned child PATH;
  final run ID above and artifact group `hvp-r10-final`. This regenerated every
  final capture through the existing fail-closed emitter.

The required independent/human review tool availability remains as recorded
above: no delegation, no fabricated review approval, no art/baseline/publication
actions. Both task-owned managed Vite process trees were stopped, E2E's own
server exited, and port 5173 is closed. Final manifest hash/dimension/token
validation and dirty-start preservation inventory are read-only checks. Only
the eight listed in-scope source/test/doc files and final R10 evidence differ
from the initial 2,800-file inventory; task-created browser scratch is retained
outside the worktree.

### R11 final boundary hardening — 2026-09-14

The final independent R10 technical reviews accepted the source-owned outlet,
wet-role correction, terrain/water partition, resource accounting and visual
evidence. Both independent art reviews also accepted the bounded HVP-01/02
candidate against the original concepts; vegetation, richer sky/water polish
and hardware proof remain outside this slice. The robustness review found one
remaining allocation-boundary defect: `meshHvpWaterMask` gathered numeric
output arrays before applying the common mesh output caps. It also found the
join-water half extent duplicated as numeric `20` values and a duplicate AO
comment.

R11 keeps the R10 source geometry, materials, cameras and caps unchanged while:

- deriving every join-water dimension, source exclusion and join/far boundary
  from `HVP_JOIN_WATER_HALF_METERS`;
- validating authority, join and outer water-grid dimensions and exact buffer
  lengths before any grid loop, rejecting non-finite, non-positive,
  non-integral, unsafe or mismatched external mask data instead of rounding it;
- gating visited cells, actual merged quads, vertices and indices before the
  corresponding output arrays are materialized;
- using one source-constant-based mask-byte calculation for both preflight and
  the final resource ledger; and
- removing the duplicate AO documentation block.

Two focused negatives pin a too-small output budget and a zero-cell-size outer
grid; the latter would enter an unbounded loop on the previous implementation.
Pinned Node 22 focused verification passed 32/32 water/source tests, TypeScript
typecheck and `git diff --check`. Both affected final technical re-reviews
returned CLEAN. R1–R10 remain historical and are not rewritten.

### R11 final verification and publication scope — 2026-09-14

Fresh pinned Node 22.23.2 verification after both final technical reviews:

| Check | Result |
| --- | --- |
| Full Vitest | PASS, exit 0, 157 files / 1,572 tests |
| TypeScript `tsc -p tsconfig.json --noEmit` | PASS, exit 0 |
| Vite production build | PASS, exit 0, 202 modules; existing >500 kB warning |
| HVP E2E | PASS, exit 0, 9/9 |
| Shared render lifecycle | PASS, exit 0, 1/1 |
| Full live E2E group | PASS, exit 0, 23/23 |
| Full UI E2E group | PASS, exit 0, 12/12 |
| Manifest/source/capture hashes, byte counts and PNG dimensions | PASS |
| Diff whitespace and port 5173 cleanup | PASS |
| Core E2E / GPU hardware benchmarks | NOT RUN; outside the selected verification scope |

Current evidence: `apps/weltraum-browser/evidence/hvp-candidates-r11/`, run ID
`64aadf83-21a9-48dc-88f0-a670ee31a3c9`. Six unique captures, `complete: true`,
nine product-source bindings and the capture-test binding all match. Source
`8e3a45c4`, water `02f8f480`, fixed cameras, all six PNG hashes and resource
metrics equal R10: 219,480 triangles, 11 draws, 179,858,088 controlled CPU bytes,
16,043,232 retained mesh bytes. HVP-03 headroom is 280,520 triangles. These are
logical counts, not GPU performance evidence. The disclosed Show UI control
remains visible in panel-hidden captures; no UI-free claim is made.

The broader live/UI tests regenerated 52 existing non-HVP evidence files and
created `.devtoolbox/specs/changes/browser-hestia-microvoxel-surface-lab-v1/tests/task-5.1-live/`.
These test side effects are preserved locally and explicitly excluded from the
HVP commit. Only HVP implementation/tests, the authorized shared AO/material
integration, this plan and candidate evidence R1–R11 belong to publication.
No cleanup deletion, unrelated evidence promotion or main-checkout change is
part of this closeout. Test servers are stopped; port 5173 is closed.

### Post-push CI deadline correction — 2026-09-14

Commit `f081f16f` was pushed after human diff approval. Browser Mainline run
`34880036525` failed T08 while the other 22 live tests and the current-head,
dependency and repository-policy gates passed. Its trace proves a whole-test
deadline, not a stuck C04 control: the 30,000 ms timeout fired at 30.007 s
during the HUD image comparison; C04 click started at 30.079 s. Startup/Ready
took 5.237 s, the two preceding full-resolution screenshots took 5.196 s and
5.024 s, and the HUD comparison took 1.614 s. No interception or obscuration
was reported; the dedicated real-button preset test passed in the same run.

T08 now uses the existing T02/AO pattern, `test.setTimeout(120_000)`, scoped to
this screenshot-heavy test only. No product, assertion, pixel tolerance,
per-assertion timeout, camera, global CI setting or retry policy changes.
R11 remains the render evidence for unchanged product bytes; its capture-test
hash intentionally identifies the pre-timeout-adjustment script. Historical
manifests are not rewritten, and this test-only change does not claim a new
visual baseline. The failed CI run is the red reproduction; focused local
verification and a new-head CI run provide the follow-up evidence.

Both independent technical reviews returned CLEAN for this two-file correction.
Fresh pinned Node 22 / installed Chrome verification: T08 PASS (1/1, 7.3 s,
exit 0), including C04, the HUD-region proof and all negative assertions;
TypeScript noEmit and scoped diff-check PASS. No candidate evidence was written,
the existing dirty path set was preserved, and port 5173 was closed before and
after. New-head GitHub CI remains the required remote confirmation; the full
local unit/build/E2E suite is not repeated for a per-test deadline-only change.

### Production-mesh unit-test deadlines — 2026-09-14

Browser CI run `34889648488` on `a9e8ab6e` stopped before E2E: 1,568 unit tests
passed and four `hvp-source-r2.test.ts` cases exceeded Vitest's implicit 5 s
deadline. The complete-scene admission, far-role preservation, authority
water/land partition and product-binding negatives took 6,203 / 5,147 / 5,030 /
6,463 ms respectively. Only timeout errors were reported. Each builds real
production meshes; this is not a small-fixture or a performance acceptance test.
The same file's comparable full-region seam/coverage tests already use 120 s.

Those four test registrations now use that existing 120 s budget explicitly
(the partition registration covers authority, join and far parameter rows).
No assertion, fixture extent, resource ceiling, production code, retry or global
test setting changes. Tests still build independent products rather than adding
a shared mutable cache. R11 product and capture evidence remain unchanged.

Both independent technical reviews returned CLEAN. Fresh pinned Node 22 run of
the complete affected file passed 41/41 (exit 0, 35.52 s total); TypeScript
`tsc -p tsconfig.json --noEmit` also passed. No production or evidence files
were changed. The next exact-head CI must still confirm unit/build/E2E success.

### Remaining live-test timing boundaries — 2026-09-14

Run `34891993836` on `5c0ea370` passed all 1,572 units, build, 43 core E2E,
12 UI E2E and T08 (1.8 minutes). Three of 23 live tests failed. Independent
inspection of all three retained traces established:

- T03 exhausted its 30 s whole-test deadline at 30.018 s; the C01 click finished
  at 32.732 s and the screenshot began during teardown. Ready C01 and its canvas
  were present, so the screenshot failure was secondary cancellation.
- T05/T06 exhausted its deadline at 30.111 s. The background-editable assertion
  began at 33.064 s during context closure. Earlier snapshots explicitly contain
  `data-hestia-prototype-background-editable="false"`; no binding was missing.
- The visible-coast test demanded the HUD within 5 s before its existing 20 s
  Ready wait. The trace first shows Ready/HUD 7.592 s after navigation. Bootstrap
  creates the HUD after source/mesh construction; the test asserted too early.

All traces had one navigation, no failed requests or console/page errors; T05
recorded ReadPixels performance warnings. This is not a hardware performance
acceptance result or a diagnosis of a product unmount.

T03 and T05/T06 now use the same test-local 120 s budget as T02/AO/T08. The
visible-coast test waits for the unchanged 20 s Ready condition before its
unchanged 5 s HUD assertion. It also uses that local 120 s screenshot-test
budget for its two full-resolution captures and pixel comparisons; its observed
failure was assertion ordering, not an observed whole-test timeout. No runtime,
global/action/expect timeout, retry, image tolerance, baseline or assertion is
changed. R11 remains historical render evidence of unchanged product bytes.

Both independent technical reviews returned CLEAN. Fresh pinned Node 22 /
installed Chrome verification passed all nine HVP E2E tests (exit 0, 45.6 s):
T03 5.6 s, T05/T06 5.0 s, primary visible-coast 5.1 s. Runtime error checks,
TypeScript noEmit and scoped diff-check passed. No evidence recording flags
were set, the dirty path set did not change, and port 5173 was closed before
and after. The next exact-head CI remains the remote confirmation; these
technical fixes do not complete HVP-03 vegetation or HVP-04/05 playable physics.
