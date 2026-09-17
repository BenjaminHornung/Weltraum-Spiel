# ExecPlan: Complete the visible, playable Hestia prototype

## Goal

Deliver the uploaded masterplan's bounded normal Hestia runtime: characteristic
coast and vegetation, walking/collision, canonical cutting, falling fragments,
recutting, save/restore and a salvage loop. Terrain inspection alone is NOT the
finished game. Keep CODE_VERIFIED, PLAYABLE_VERIFIED, VISUAL_TECH_VERIFIED,
ART_ACCEPTED and PERF_ACCEPTED separate.

## Context

Base: `30063007aeea9f8a7d48d2856ad1de7437b308fb`, HVP-02 PR #67,
all exact-head CI checks successful and PR still unmerged (verified 2026-09-15).
Worktree: `.worktrees/Hestia-HVP03-signature-vegetation`, branch
`feature/hvp-03-signature-vegetation`; the previous dirty worktree is untouched.
The owner's 2026-09-15 continuation authorizes implementation of remaining
packages in dependency order, not merge, baseline promotion or invented art approval.

Current uploads in `C:/Users/hornung/.paseo/uploads/`:
- `upload_5ed21cca-bc61-420d-a64b-a33942c893bb/HESTIA_VISIBLE_PLAYABLE_MASTERPLAN.md`
- `upload_ad5898d4-59b7-4fa4-8d54-a61d6af8d31d/05_TEST_CATALOG.md`
- `upload_f4a6f256-cfdd-4052-b073-37b3433fa86e/02_WORLD_AND_VISUAL_CONTRACT.md`
- `upload_146758a6-e7a8-44a1-bad6-49f4fb68aab3/04_PERFORMANCE_AND_EVIDENCE.md`
- `upload_786564f1-7c53-4871-ac75-134fef713b54/ORACLE_FIXTURES.json`
- `upload_c84c2d8f-4bb5-49dc-b447-6c25bf338a96/07_AGENT_HANDOFF.md`

Original lagoon and wetland-root concept pixels were opened from the main
checkout's `docs/Konzeptart/Hestia`; they are references, not runtime baselines.
Nearest AGENTS, README, current-mainline-state and .agent/PLANS read. The current
mainline status document is a historical main snapshot, not this branch's state.

## Non-goals

No engine replacement, global planet generator, individual leaf physics, new
asset toolchain, opportunistic legacy refactor or changes to user saves. No
unapproved migration of Adaptive constant-v1 / Structural-V1. Preserve R1-R11.

### Owner revision — richer vegetation and surface response (2026-09-15)

Candidate03 is NOT art-accepted. The owner rejects repetitive square-tree forms,
insufficient vegetation variety and flat lighting/water, and explicitly requests
efficient shader/post-processing work compatible with later Teardown-like
destruction. Reopened all four coastal/root/terrace concept images ending
15_38_42 (4)/(5) and 15_38_41 (2)/(3). Their richness comes from asymmetric
multi-level boughs, root buttresses, pendant vegetation, multiple understorey
heights, directional shadows, atmospheric contrast and reflective clear water.
A LUT cannot fix missing silhouettes; simply adding more voxels is not the plan.

Sequence for this bounded revision:
1. Pin palette batching and variant differences in focused tests; revise the
   existing authored kit, not a new tree/asset pipeline. Smaller variants use
   smaller bounded slot volumes. Keep real wood connectivity/support and air arches.
2. Bake decoration palette into existing vertex colors, reducing material groups
   to one per decoration owner without merging future fragment ownership.
3. Use the existing renderer-factory boundary for HVP-only native tone mapping,
   bounded lighting/shadows and water surface shading. No second renderer,
   SSR/SSAO stack, extra full-screen render targets or simulated waves in this pass.
4. Keep cosmetic surface shading independent of canonical wood/terrain cells.
   Test teardown and invalidation, inspect fixed views and compare actual logical
   costs/frame samples. Performance optimality or hardware acceptance is NOT claimed.

Before sample: current native C03, 1536x791 CSS / DPR1.25, 180 rAF intervals:
median16.7ms/p9516.8ms (vsync-limited wall time, NOT GPU time). Candidate03
logical totals:350188triangles,223draws,243363824CPUbytes. Retain the hard caps;
candidate03 images/manifests remain historical, new images get a fresh directory.

## Architecture decision

Reuse the existing HVP compact greedy mesher, AO, MaterialProfile and
MeshArtifact/projection command pipeline. HVP-03 owns a small versioned authored
wood-cell kit and separate massless decoration with stable attachment/support
IDs. No synthetic Structural source provenance or physics is claimed. Object
pose snapshots drive both wood and decoration through the real projection
adapter; later fragmentation remaps attachment ownership at its own gate.
All root feet are terrain-source anchored; root-arch negative space remains
actual air. Habitat masks preserve water and the salvage clearing. Scene-wide
triangle/draw/CPU/mesh admission includes vegetation before any new publication.

## Implementation phases

### Owner gameplay correction — 2026-09-15

The owner reports unfluid movement, small ledges requiring jumps, unclear/oversized
player-to-tree scale, insufficient ground-color/detail fidelity, and requests a
third-person model plus an actual plasma cutter for terrain/wood experimentation.
The prior green HVP-05 tests are not gameplay acceptance. Work sequence:

1. Reproduce narrow canonical voxel stairs, not only separate box obstacles;
   retain the 0.26 m step-height, ceiling, steep-slope and known-coverage guards.
2. Smooth only rendered solver readback; no predicted gameplay movement or solver
   position snapping. Preserve SimulationHold across focus/automatic Pause.
3. Add a one-draw 1.8 m suited figure and Ego/Third-Person switching, with camera
   clearance queried in the same solver World. Measure actual dimensions before
   changing the agreed physical player size or scaling the entire world.
4. Reinspect the reference palette and version the less yellow limestone/soil
   projection without altering mass/source slots or lowering image thresholds.
5. Follow HVP-06A/B for the cutter: canonical picking, protected/unknown/range
   checks, bounded preview, then paired render/collision adoption. Until later
   detachment packages, ordinary terrain cuts stay within Safe-Quarry policy;
   arbitrary undercut/wood fragmentation must not be faked or silently enabled.

Initial stair falsification: native Rapier autostep passed 0.25/0.5 m treads but
stopped on 0.125 m treads at z=-0.7533. Lowering its minimum width alone did not
fix it. Capsule/corner contact normal y=0.6685 misclassified the horizontal
tread. A bounded up/forward/down capsule sweep plus real tread-normal/height
query now passes, while 0.375 m ledges, 50-degree ramps and low ceilings remain
blocked. No floor is synthesized. The existing hold test also reproduced that
Pause hid SimulationHold; Pause now only changes Running to Paused.

| Package | Outcome | State |
|---|---|---|
| HVP-00/01/02 | Bound source, visible coast, water/look | technically verified predecessor; not full concept parity |
| HVP-03 | Connected roots/umbrella crowns, three variants, reeds/ground/accent clusters, C03, V2 rubric | code/visual-tech checked; owner art decision pending |
| HVP-04 | Runtime Rapier, fixed ticks, real terrain colliders | implemented; local solver and real-worker browser checks pass |
| HVP-05 | First/third person, walking/jumping/contacts | implemented; local capsule, stairs, shaft and input-ownership checks pass |
| HVP-06A/B | Canonical picking/preview and atomic mesh/collider cut | SafeQuarry runtime candidate; local tests/evidence pass, broader package acceptance not claimed |
| HVP-07 | Full local mass/inertia, principal-axis solver transfer, real contact impulse | locally verified candidate; hardware/owner acceptance pending |
| HVP-08 | Cut a supported structure, detach, fall and collide | bounded timber/attachment runtime locally verified; not arbitrary tree destruction |
| HVP-09A | Terrain support and detached-component preview | bounded worker analysis and actual C05 read-only preview locally verified |
| HVP-09B | Atomic terrain-to-fragment transfer | actual authored rock-arm undercut, paired root/static/dynamic/render ownership locally verified |
| HVP-10 | Moving recut | terrain and released timber/foliage ownership locally verified; dynamic sphere not implemented |
| HVP-11 | Complete save/restore | locally verified Root/World/owners/receipts, atomic live load and cold continuation |
| HVP-12 | Actual repeatable salvage gameplay | locally verified: real discovery/cut/contact delivery, half-progress cold reload and durable completion |
| HVP-13 | Bounded neighboring authority, projection LOD, sleeping-owner residency | locally verified including twenty browser round trips, live/cold restore; performance risk remains explicit |
| HVP-14 | Frozen device measurements, total acceptance and start guide | pending; no hardware/art acceptance inferred |

HVP-03 files: `src/hestia-prototype/presentation/vegetation.ts`, its focused unit
tests; `src/hvp/hvpBootstrap.ts`, `hvpCamera.ts`, `hvpHud.ts` for real wiring;
existing HVP E2E files for C03 and evidence (avoid a new unassigned test group).
Sequence: negative tests -> authored kit/habitats -> shared rendering/resources
-> actual C01/C02/C03/C04 inspection -> self-review and fresh tests -> owner rubric.
Later packages require their own concrete source/contract investigation before edits.

## Tests and evidence

HVP-03-T01: independent face-six BFS, remove root connection/anchor negative.
T02: independent free-arch volume; enclosing-AABB negative, later avatar pass pending.
T03/T04: ordered/reversed habitat queries and forbidden-position negatives.
T05: count wood mass/COM independently of leaf palette.
T06: real projection consumer, two immutable owner poses, attached world transform.
T07: actual C01/C03 references and owner rubric (not a tree-count substitute).
T08: 20 init/dispose cycles and owned handle counts.
Pinned Node22, full Vitest, tsc/build, HVP/affected E2E; browser inspection through
configured Playwright MCP. No accepted baseline is overwritten. Hardware claims
require the master's measured profiles and remain NOT_RUN otherwise.

## Risks

Tree silhouettes may still miss the references; stop and show actual images
rather than relabeling them accepted. Remaining triangle budget is 280,520, not
an allowance per asset. Leaves must not acquire wood mass/collision. Overhead
and attachment lifetimes need aggregate admission/teardown, not separate caps.

## Rollback / safe stop

One writer (this GPT-6 Astra assistant); no delegation or Plannotator runs in
this execution. Self-review replaces technical-agent dispatch; independent and
human review are NOT_RUN unless actually performed. Human visual decisions
are not self-granted. Stop at a material owner/art/physics-contract boundary,
retaining verified reversible work; never delete prior work or merge automatically.

## Progress log

- [x] Verified predecessor, fresh uploads, original concepts and isolated clean worktree.
- [x] HVP-03 source/negative tests and runtime wiring.
- [x] HVP-03 actual visual evidence, lifecycle and aggregate regression verification.
- [ ] Owner V2 rubric decision; no automatic ART_ACCEPTED.

### HVP-03 candidate 03 — 2026-09-15

Implemented directly by this GPT-6 Astra assistant, with self-review and actual
native browser/image inspection. No other agents or Plannotator were invoked.
Independent technical review and owner art approval are **NOT_RUN**. This is a
candidate for the first vegetation/visual gate, not a complete playable prototype.

- Four tree instances (hero plus three variants) have terrain-contact root anchors,
  connected local 0.125 m wood cells, free root-arch space, uneven umbrella leaf
  clusters and hanging details. The other 98 instances are habitat-filtered reed,
  broadleaf and violet/amber accent beds; the salvage clearing stays open.
- Wood and decoration use separate source volumes. Decoration has no physical
  mass/collider. Stable attachments identify their actual supporting wood cell or
  terrain cell separately from their presentation owner. Solver bodies, terrain
  cuts and fragment ownership transfer are still later-package work.
- Existing greedy meshing, material profiles, render artifacts and frame projection
  are reused. Index regrouping keeps one draw per material instead of one per
  emitted face run. Immutable owner poses drive wood and decoration together;
  missing owners and malformed poses fail closed. Water visibility preserves all
  plant representations; the AO command swaps wood material leases as well as
  terrain/join leases, without remeshing or mutating shared materials.
- C03-ROOTS is the specified `(3,2.5,4) -> (8,4.5,7), FOV 60` camera. Existing
  C01/C02/C04 poses, terrain occupancy, source digest and water geometry remain
  unchanged. Normal `/` remains the existing player route without TestBridge.
- Look v4 changes only the ground hemisphere bounce to keep crown/root undersides
  readable. A new C03 near-black diagnostic failed on the previous image with
  ratio `0.08881703317901235` against `<0.01`; the corrected look passes at the
  same pose, resolution and threshold. This is a diagnostic, not art acceptance.

Other confirmed/fixed implementation defects: bed volume bounds initially too
small; plant IDs initially contained invalid fractional punctuation; ungrouped
mesh material runs exceeded the draw budget; the expanded HUD contaminated T03's
sky metric. The fixes respectively bound the source grid, use integer source-cell
IDs, reuse material regrouping, and capture both T03 views with panels hidden via
the real UI. Original metric thresholds are unchanged. Candidate 01 records the
failed run; candidate 02 predates the corrected underside lighting. Neither is a
golden or the current source-bound image set.

#### Verification

Commands use the existing locked dependencies and pinned Node 22.23.2 from
`C:/IFI_SourceCode/Utils/npm-tmp/opencode/hvp-node22/node_modules/node/bin/node.exe`.
Run from `apps/weltraum-browser`:

| Check | Result |
|---|---|
| `node node_modules/vitest/vitest.mjs run --no-cache --configLoader=runner` | PASS, 158 files / 1,582 tests, exit 0, 348.26 s |
| `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` | PASS, exit 0 |
| `node node_modules/vite/bin/vite.js build` | PASS, 203 modules, exit 0; existing >500 kB warning |
| `node node_modules/@playwright/test/cli.js test tests/e2e/hvp-look.spec.ts tests/e2e/hvp-visible-coast.spec.ts --workers=1 --retries=0` | PASS, 10/10, exit 0, about 1 minute, installed Chrome |
| Strengthened full-set lifecycle: focused `hvp-vegetation.test.ts` rerun after the full suite | PASS, 10/10, exit 0, 34.65 s; 20 full-set generation/adoption/disposal cycles plus pose/anchor/habitat negatives |
| Final TypeScript rerun after strengthening that test | PASS, exit 0 |
| Self-review, final diff whitespace, all 8 source + 5 image SHA-256 bindings and run token | PASS |
| Full unrelated core/live/UI E2E groups on this new branch | NOT_RUN; targeted HVP group includes route isolation |
| Hardware/GPU memory/timing acceptance | NOT_RUN; GPU bytes unsupported |

T01 uses independent face-six traversal and removed-anchor negatives for all four
trees. T02 verifies actual free cells and rejects a filled AABB, but does not claim
an avatar or solver pass. T03/T04 cover reversed leaf queries, deterministic IDs,
forbidden habitats and ground support. T05 changes real palette profiles while
wood mass/COM and cells remain identical. T06 uses the real Three render backend
and HVP projection adapter with two owner poses, including rotation. T08 checks
real geometry/material allocations/disposals; the injected low-level renderer is
a no-op for unit tests, so these are not GPU-driver leak measurements. Source and
mesh generation run for the entire set on each of 20 cycles.

Current evidence: `apps/weltraum-browser/evidence/hvp03-candidate03/manifest.json`,
run `bd883cbc-0208-4d77-9e68-66977181dd03`, Chromium `153.0.8010.37`, DPR 1.
Five distinct captures: C01/C02/C03/C04 at 1920x1080 and C04 at 1280x720. The
manifest binds current source files and the capture test; the later strengthened
unit test does not change those bindings. Source `8e3a45c4`, vegetation
`c8856712`, look `hvp:readable-coast-v4`. Panels are hidden, but the real Show UI
control remains visible. All five images were opened and inspected, not merely
counted or compared by hash. R1-R11 in the predecessor remain untouched.

| Whole-scene metric | Observed | Limit |
|---|---:|---:|
| Triangles | 350,188 | 500,000 |
| Draw calls | 223 | 300 |
| Controlled build-peak CPU bytes | 243,363,824 | 268,435,456 |
| Retained mesh bytes | 23,889,432 | 134,217,728 |
| Vegetation source bytes (included in CPU accounting) | 11,124,096 | 16 MiB internal preflight |

Only 149,812 triangles, 77 draws and 25,071,632 controlled CPU bytes remain under
the shared ceilings. HVP-04 and later packages must fit or reduce real costs;
these are not new per-package allowances. No cap was raised.

#### V2 visual rubric — owner decisions pending

These observations prepare the ten required owner criteria. They are NOT an
independent review or self-issued ACCEPT; no average can override an owner REVISE.

| Criterion | Candidate observation / relevant views | Owner disposition |
|---|---|---|
| 1. Organic distance, fine hard near form | C01/C03 retain hard fine wood/terrain; C04 still has very regular terrace contours | PENDING |
| 2. S-channel and asymmetric light landforms | C02/C04 retain the open northern outlet and asymmetry | PENDING |
| 3. Water depth and shoreline transition | C02 underwater steps visible; water on/off regression passes | PENDING |
| 4. Connected root/umbrella reference silhouette | C01/C03 show connected arching roots, spreading crowns and vines; stylized repetition remains | PENDING |
| 5. Distinct dry/wet/biological materials | C01/C02 distinguish pale rock, shore, greens, wood and accents | PENDING |
| 6. Key/fill/distance without black AO gaps | C03 near-black regression fixed by versioned ground bounce; no shadow-map or reflection claim | PENDING |
| 7. Designed density and quiet zones | C04 shows localized bankside clusters and the clear salvage zone; outer shelves remain sparse | PENDING |
| 8. Credible coastal continuation | C04 keeps the source-derived sea and distant rock forms; coarse outer detail remains | PENDING |
| 9. Scale from eye height | C01/C03 show the roots and canopy from fixed low viewpoints; actual walking is HVP-05 | PENDING |
| 10. Consistency after destruction | No cuts, falling bodies or dynamic remap yet | NOT_EVALUABLE (later packages) |

Pending decision: accept this vegetation direction, request targeted visual
revision, or explicitly keep art pending while authorizing independent HVP-04
physics work under the master's owner-policy exception. No automatic golden
promotion or human approval is inferred. Servers are stopped and port 5173 is
closed; task-owned draft evidence is retained rather than deleted. No commit,
push, merge or release is claimed for this local candidate.

### Owner-requested visual revision — candidate07, 2026-09-15

The owner rejected candidate03's repetitive, square-looking vegetation and
requested richer concept-driven shading and water presentation with practical
costs for future destructible physics. Candidate03's technical checks are
historical, not art approval. Candidate07 is the new local candidate; it is still
PENDING_OWNER and does not implement HVP-04 physics or HVP-05 walking.

#### Implemented changes and boundaries

- Four genuinely different branch/crown architectures, bent multi-segment roots,
  broken canopy outlines and height variation, plus irregular low foliage,
  cattail-like amber reeds and violet spikes. Hard voxel cells and connected
  structural wood remain separate from noncolliding decoration.
- Decoration palette is baked into vertex colors, allowing one material group
  per owner instead of splitting every cosmetic tone into a draw. Smaller
  per-variant bounds reduce empty source storage; canonical palette cells remain
  intact. No shared mutable physics/render authority or new asset pipeline.
- HVP-only native ACES tonemapping, a gradient sky with one cached 256-square
  cloud texture, and one cached 1024-square PCF shadow map. Flora/objects cast;
  coast receives shadows and retains baked AO. Coast self-casting was rejected
  after actual C02 inspection showed shadow acne. Geometry, pose, visibility and
  removal changes invalidate the shadow cache; static frames reuse it.
- Static analytical normal ripples, view-dependent Fresnel and sun glints on
  the same flat transparent water sheet. No displaced vertices, simulated waves,
  collision or water physics. Opacity 0.55 and depth-write disabled are retained.
  Native `forceSinglePass` avoids a redundant transparent back/front draw for
  this flat sheet. No SSAO, SSR, full-screen LUT/RT chain or new dependencies.

#### Reproductions and verification

The new branch-variation/one-draw test first rejected the old single architecture.
The first effects candidate then failed four HVP E2E cases: ACES reduced the
underwater color-family ratio to 0.06364 below the unchanged 0.1 threshold, and
the new sky no longer matched the old single RGB background. Water color was
corrected in the versioned profile, not hidden with an opaque overlay. Sky tests
now recognize the authorized blue/bright-cloud family and still require terrain,
horizon and complete opaque output. A new sky-gradient-only negative explicitly
fails missing-terrain proof; old blank/corrupt/wrong-size/opacity negatives remain.
No numeric visual tolerance or source/camera/resource limit was lowered.

- Full fresh Vitest: PASS, 159 files / 1,585 tests, 412.85 s.
- TypeScript noEmit and Vite production build: PASS, 204 modules; existing
  >500 kB chunk warning remains.
- After the final HUD scope labels and flat-water single-pass optimization:
  focused effects tests 2/2, TypeScript/build, and all HVP E2E 10/10 PASS.
  The final E2E invocation used pinned Node 22.23.2, installed Chrome, one worker
  and zero retries, and generated candidate07 through the existing fresh-target
  guard. No old evidence recording flags were enabled.
- Nine listed source/test SHA-256 bindings independently recomputed and matched
  the final manifest. Actual C04/C03 final images inspected, not merely metadata.
- Native final browser console: zero errors/warnings. Self-review only;
  independent review, owner art acceptance and hardware/GPU acceptance NOT RUN.

Final evidence: `apps/weltraum-browser/evidence/hvp03-candidate07/`, run
`6ef816bf-51e2-41fe-a533-70f84c397543`. Five images cover C01/C02/C03/C04 at
1920x1080 and C04 at 1280x720, Chromium 153.0.8010.37, DPR 1. Source digest
`8e3a45c4`, vegetation digest `f2ae20dd`, look `hvp:readable-coast-v5`, effects
`hvp-surface-light-v1`. Earlier candidates/drafts remain historical and untouched.

#### Cost comparison, not a blanket performance claim

| Logical admitted scene metric | Rejected candidate03 | Candidate07 | Existing cap |
| --- | ---: | ---: | ---: |
| Triangles | 350,188 | 384,934 | 500,000 |
| Material draw groups | 223 | 118 | 300 |
| Controlled build-peak CPU bytes | 243,363,824 | 250,824,928 | 268,435,456 |
| Retained mesh bytes | 23,889,432 | 28,921,028 | 134,217,728 |
| Vegetation source bytes | 11,124,096 | 7,228,096 | included above |

Draw groups fell about 47% and vegetation source storage about 35%, but geometry
and controlled CPU usage increased. Only 115,066 triangles and 17,610,528
controlled CPU bytes remain; later physics must fit or reduce actual costs.
No limit was raised and no Teardown-like performance or destruction is claimed.

Matched warm native C03 diagnostic: CSS 1536x791, DPR 1.25, 180 rAF intervals.
Before: median 16.7 ms / p95 16.8 ms. Final: median 16.7 ms / p95 17.0 ms /
max 17.3 ms. This is vsync-limited scheduling, not GPU timing or an FPS gain.
A final steady C03 renderer sample reported 37 visible calls, 270,360 triangles,
111 geometries, 3 textures, cached shadow (no update), 1024 map and zero
full-screen targets. Its 0.2 ms render submission sample is not frame/GPU time.
These frustum-dependent calls differ from all-scene material groups; invalidated
shadow frames add passes. The manifest's periodic renderer sample is not
capture-synchronous and must not be compared as a matched-camera benchmark.

For owner inspection the task-owned Playwright tab is open at
`http://127.0.0.1:5173/?hestiaPrototype=1`, C04-WIDE. The bounded preview server
is intentionally left running for up to one hour; foreign tabs are untouched.
No commit, push, merge, golden promotion or physics completion is claimed.
Next decision remains the actual visual direction / owner policy for proceeding
to independent HVP-04 physics, not another claim that tests equal concept parity.

### HVP-06A/B implementation sequence

The owner's autonomous continuation authorizes the remaining core work in order,
without repeated art questions. It does not turn reference images into accepted
goldens. Current next slice is a real plasma-cutter command, not cosmetic sparks.

1. Add canonical half-open DDA and bounded box/sphere prepare tests. A sparse
   copy-on-write 16-cubed leaf overlay owns terrain edits; no mesh-derived cells.
2. Keep the existing WorkerPool/transfer/result gates. Prepare paired mesh and
   collider products from concrete source plus neighbor halo. Use the master's
   16 render sectors (8x8 m), while collision keeps its 4x4 m sectors.
3. Stage products beside the old generation; hold the single World between ticks
   during adoption, then publish root/render/collision together. Failed upload or
   collider preparation leaves the old generation; unproven rollback is RecoveryHold.
4. Enforce the exact early quarry x[-12,-10),z[-10,-8), top-only contiguous cuts
   <=0.5 m deep, 512 changed cells / eight content leaves. Protect other objects,
   base support and unknown coverage. Arbitrary tree/overhang detachment remains
   the later support/fragment package, visibly unavailable rather than faked.
5. Wire real pointer edges, reticle, material/readiness/status and a bounded preview.
   Verify idempotency, stale products, fault rollback, real changed geometry and
   real changed collision, then record fresh candidate evidence. No TestBridge cuts.

### HVP-06A/B local SafeQuarry cutter candidate — 2026-09-15

Implemented the real tool path directly, not a cosmetic beam or a TestBridge
command. Normal pointer-owned left-click uses the solver-owned eye/ray, canonical
0.125 m DDA and a 4 m reach. Keys/buttons 1/2/3 select cell, 0.5 m box or 0.25 m
radius sphere. Pure preview and actual command admission use the same bounded
shape and source policy. Lock-acquisition clicks are not tool commands.

- The terrain root uses copy-on-write 16-cubed leaves over the validated base;
  session/epoch/revision/digest/tool/idempotency bind every request. Changed
  content and halo dependency leaves are distinct. Known-air no-ops do not
  advance revisions; mixed protected/unknown requests reject as a whole.
- Actual mutations remain restricted to the master's SafeQuarry, removing at
  most 0.5 m of contiguous column top per action and respecting object supports
  and the dry waterline. General tree cutting, undercutting and terrain fragments
  remain HVP-07/08/09 work, not capabilities of this candidate.
- Initial terrain renders as sixteen 8 m sectors. Cuts rebuild only changed
  sectors plus their one-cell dependency halo; collision uses the existing
  4 m sectors. New typed jobs use the existing WorkerPool, transfer/result gates
  and a maximum of two concurrent heavy preparations, not a second job system.
- New render resources are prepared hidden; new World colliders are prepared
  disabled. The World stays held through commit. Canonical root, visible
  representation set and main-thread physics snapshot publish in one turn,
  then the World finalizes and resumes. Old resources retire afterward.
  A failed prepare/commit restores the old set; unproven rollback/cleanup enters
  RecoveryHold rather than reporting Applied. Disposal/epoch checks prevent
  late old-session metadata publication.
- Eight mutating commands and 256 receipts are bounded. Duplicate IDs return
  the same outcome, conflicts/backpressure remain visible, and confirmed edits
  are not discarded to coalesce derived work. No public authority schema was
  replaced with invented Structural provenance.

Self-review covered the real Root/worker/World/render call chain. Tests cover
negative/floor/corner picking, independent integer-sphere cells, caps, no-ops,
protected/unknown/stale source, dirty-sector locality, result tampering, receipt
identity/queue saturation, stage/commit/publication/cleanup faults, and actual
Rapier collider replacement/rollback/contact. These include synthetic injected
fault ports where stated; they are not GPU-driver fault or hardware acceptance.

Fresh full Vitest: **165 files / 1,637 tests PASS**, 387.71 s. TypeScript initially
found one stale unused monolithic-terrain import in the updated bootstrap test;
removing that import was the only correction. TypeScript noEmit and production
build then PASS (216 modules, existing large-bundle warning). Final HVP E2E:
**17/17 PASS**, 2.4 minutes, installed Chrome / pinned Node 22 / one worker /
zero retries. All three real brush modes commit revision 1 in Root and World;
only local sector hashes change, and the World finishes Idle. Paired C07
before/after images and JSON receipts are attached to that actual test run.
Existing walking, third-person, stairs/shaft, fall/contact, worker-failure,
water/AO/sky, route-isolation and image-negative tests remain green.

One first capture run failed the former monolithic scene's incidental
`calls < 150` assertion (actual 168), while the other 16 tests passed. Local
sector replacement adds material groups by design. The test now requires a
steady non-shadow-update sample to fit both the actual admitted product groups
and the unchanged 300-draw global cap; it does not silently raise that cap.
This is a locality/draw-count tradeoff, not an unmeasured performance win.

Current evidence: `apps/weltraum-browser/evidence/hvp06-candidate02/`, run
`91a6de9e-2a67-471e-831f-9237531d4abe`. Five fixed-view captures, 31 explicitly
listed source/test/package bindings, source `f30eca0a`, vegetation `473e49c5`,
look v6, initial terrain generation 0 with all 16 sector hashes. The separate
real-cut attachments prove mutation; the overview manifest does not pretend to
be a post-cut capture. Root/consumer/compiler/job/bootstrap/session and both
E2E SHA-256 entries were independently recomputed and matched. Actual C07
before/after images for all modes and the third-person image were inspected.

Initial scene: **377,608 triangles / 168 material draw groups / 248,186,456
controlled CPU bytes / 28,352,828 retained mesh bytes**, under unchanged limits.
The 48 additional groups versus the prior 120-group monolith are recorded, not
hidden. Native/GPU allocation and measured input-to-commit percentiles remain
unaccepted. Earlier failed candidate01 and all prior evidence remain historical.
No independent agent/human review, art approval, merge or baseline promotion.
Next: reuse validated Structural ingest, full inertia and connected-fragment
physics before permitting the requested tree/arm cutting.

### HVP-07 full inertia and contact-impulse checkpoint

The runtime now uses the existing Structural mass/connectivity/exact-cuboid
derivation through a real Adaptive air-descriptor plus AddBox ingest. It does
not fabricate a source binding or change legacy Structural-V1's diagonal-only
commit policy. A small HVP installer validates full-tensor principal axes with
deterministic Jacobi decomposition, transfers mass once to the pinned Rapier
solver, and removes partially installed resources on failure. Non-restorable
cleanup is explicitly reported, not relabeled as a rollback.

Verified contracts include the independent three-cell L and heterogeneous F7
mass/COM/tensor oracles, torque response at identity/45-degree/general rotation,
the negative diagonal-only tensor installation, real L-hole ray coverage,
exact 64-cuboid admission without enclosing-hull fallback, invalid ingest/run
limits, and real solver allocation/cleanup fault injection. The existing F7/R4
tests continue to use the same relocated runtime Rapier adapter.

The normal scene contains a source-bound 30-cell timber L (35.15625 kg) in the
same World as the player and falling cube. Its presentation follows actual
solver COM/orientation, not a tween. `F` sends a bounded contact impulse from the
actual player eye with a 4 m solid-occluded ray, at most 15 N-s, a 15-tick
cooldown and a predicted speed admission limit. The aim button only turns the
subsequent view toward the actual body; it moves neither avatar nor body.

A real-query regression exposed that the installed 0.12 wrapper's numeric
filter mask excluded the intended dynamic solid. Exact collider casts proved
the contact existed. HVP queries now pass explicit sensor/static predicates
through the existing runtime port, with dynamic-solid/sensor negatives for
both contact input and character movement. No solver version was changed or
unproven extra simulation step added to make a first-tick query pass.

Fresh verification after the final runtime guard and fixture corrections:

| Check | Result |
| --- | --- |
| Entire Vitest suite | PASS, 166 files / 1,651 tests, 445.97 s |
| TypeScript noEmit and production build | PASS, 216 modules; existing large-chunk warning |
| All HVP browser cases | PASS, 18/18, 2.6 minutes, zero retries |
| Actual contact-input case | PASS, grounded normal input, reported contact impulse and measured body movement |
| Actual cut/player/solver regressions | PASS, all three quarry brushes, matching generations, stairs/shaft/third person, startup failure and route isolation |

The first full invocation had 1,649/1,650 tests pass and exposed an inconsistent
transport-only bootstrap fixture that reserved an L mesh without an L body.
The fixture now supplies explicit test-only inertia data and a new negative
proves missing planned inertia rejects before any GPU publication. The later
complete pass above is the fresh result, not a relabeling of that earlier exit.

Final source-bound overview evidence: `apps/weltraum-browser/evidence/hvp07-candidate01/`,
run `8d24fdeb-eee4-4673-867a-35e560764b0d`. All five overview captures use a paused
solver; they are not the moving-body proof. The separate real-input attachment
`real-inertia-impulse` and its before/after JSON in the `hvp07-final` Playwright
report provide that proof; the actual image was opened. Seven critical source,
E2E and C04 SHA-256 bindings were independently recomputed and match the manifest.

Observed initial ledger: 377,628 triangles, 169 material groups, 248,192,728
controlled CPU bytes, 28,353,908 retained mesh bytes; unchanged 500k / 300 /
256 MiB / 128 MiB caps. World: three bodies and 86 colliders; native/GPU byte
measurement remains unsupported. The preparation sample reached 6.8 ms on the
main thread, so no claim is made that the proposed 4 ms p95 performance target
is accepted. Measured scheduling/backoff is not an optimum-throughput guarantee.

Self-review only; no independent agents or Plannotator were invoked. All changes
are still local, uncommitted and unpushed. Cutting remains bounded SafeQuarry
surface removal: arbitrary wood detachment, terrain fragments, recutting,
save/restore and the salvage loop are still subsequent packages, not implied
by this checkpoint. Continue with HVP-08 after this verified foundation.

### Physics continuation authorization and sequence — 2026-09-15

Owner: "ok dann so weitermachen" after the explicit proposal to leave art/detail
polish pending while prioritizing real physics and walking. This permits HVP-04
and HVP-05 work without inventing ART_ACCEPTED. Candidate07 appearance remains
the presentation baseline, not a golden. Implementation stays in this one owned
worktree; no second writer, agents or Plannotator.

The installed/locked solver is @dimforge/rapier3d-compat 0.12.0, Apache-2.0,
currently only transitive through @types/three. Pin that exact version directly;
move the existing structural solver adapter into src and update both callers.
Use canonical occupancy and the existing neutral greedy core (AO off) for 4m
static collision sectors, not Three.js meshes or a heightfield. Static wood
keeps its real arch holes; decoration/water get no collider. One owned World,
60Hz steps, max four catch-up steps, visible Hold/Paused, explicit teardown.
Resolve local tangent gravity from Hestia's actual catalog mu/radius squared;
9.81 is only the independent solver fixture. Add a visible source-sized drop
body with pose readback through the existing projection adapter.

Then add a real Rapier capsule controller with the master 1.8m/0.3m profile,
tick-bound input, explicit user pointer lock, exclusive inspection/pause input,
grounded jump and fail-closed collision coverage. Verify real stairs, ceiling,
holes, slope/edge behavior and browser movement before claiming playability.
First checks: solver fall/contact/cavity/CCD/mass, fixed-step scheduling and
cleanup; then runtime init failure, visible drop, controller cases and browser
evidence. Existing appearance/source budgets and unrelated routes remain gates.

### Owner architecture input: detail, clustering and asynchronous destruction

Before continuing the solver wiring, the owner requested different voxel sizes,
coalesced unedited surfaces, maximum useful destruction/physics parallelism and
client-scaled bounded work. The owner explicitly requires inspecting repository
and Git history first. This is a design requirement, not evidence that those
paths already run in the HVP scene.

Current-source and history findings (read 2026-09-15):

| Concern | Existing implementation and limitation |
| --- | --- |
| Multiple sizes | `src/voxel/adaptive/types.ts` and `coordinates.ts`: 16-cubed bricks, levels 0..4 map to 2/1/0.5/0.25/0.125 m cells. V1 base descriptor is still only `constant-v1`; HVP authored pages are a separate owner. |
| Surface clustering | `src/hvp/hvpCoastMesher.ts` already removes covered faces and greedily merges compatible material/AO rectangles. `src/voxel/structural/greedyMesher.ts` supplies the established structural pattern. |
| Physics clustering | `src/voxel/structural/physicsTransition.ts` already builds deterministic exact X/Y/Z greedy cuboids and validates covered volume. `physicsCommit.ts` validates live revision/content/occupancy and has rollback phases. These are not yet HVP gameplay integration. |
| Async infrastructure | `src/workers/workerPool.ts`, `queue.ts`, `resultGate.ts`: bounded priority lanes with fairness, ownership transfers, cancellation, worker/planning epochs, source revisions, digest and byte-budget rejection. |
| Existing consumer | `surfaceLabBootstrap.ts` chooses min(4, hardwareConcurrency) with queue32. `streamingWorker.ts` currently runs TransformBuffer or Hestia Surface-Nets mesh jobs, not HVP greedy/destruction jobs. Fixed pool size is not measured adaptive load control. |
| Proven history | `9a94edca` adaptive authority, `963cb387` structural continuation, `f081f16f` HVP greedy coast, `3ff9836e` pool replacement atomicity, `385f9b2f` real Surface-Lab worker consumer/authority epoch; also `c88cb4c2` and `e5470be4` physics ownership/commit hardening. Read logs and scoped commit diffs; do not recreate these subsystems. |

Implementation direction, subject to the existing contracts:

1. Keep canonical occupancy separate from render resolution and collision products.
   The fine source remains reconstructible even when its surface is one large quad.
   Lazy page materialization must use the same descriptor/journal, never invent
   new matter on contact. Smaller cosmetic details may be render attachments;
   physical/destructible cells below 0.125 m require an explicit versioned quantum,
   identity, mass/collision and persistence amendment, not a constant change.
2. Render: reuse greedy rectangles per dirty leaf plus the required neighbor halo.
   Storage: compact pages/approved runs, not millions of JS objects. Physics:
   exact collision sectors for static terrain, one body per connected detached
   component with bounded exact cuboids. Never expand every affected voxel into
   a rigid body or replace arches/holes with one filled bounding box.
3. Prepare edits, connectivity, mass, mesh and collider products as dependency-aware
   jobs over immutable revisions. Disjoint regions can run concurrently; jobs
   sharing input/output authority must serialize or fail stale validation. Reuse
   the existing WorkerPool protocol/queue/result gates with explicit new HVP job
   kinds; do not route HVP through the old Surface-Nets job merely to gain workers.
4. Keep one simulation owner for the coupled Rapier World, preferably off the UI
   thread. A pool worker is not an independent copy of that World. Main-thread
   input/UI and bounded rendering adopt read-only snapshots. Versioned command
   commits occur at safe simulation boundaries only after matching authority,
   collider and render preparations are ready. Cross-thread admission/acknowledgment
   must be explicit; no independently visible half-cut or stale collider.
5. Use hardwareConcurrency only as a startup hint. Bound concurrent heavy jobs,
   in-flight bytes, result adoption and uploads; sample frame/step/queue times
   with hysteresis before increasing work. The current HVP contract permits two
   heavy jobs, queue32 and eight pending mutating commands. More cores do NOT
   silently raise these global limits. Higher measured device profiles require
   a scoped capacity amendment. Coalesce obsolete derived rebuilds, never lose
   confirmed player commands. Overload gives immediate visible Pending/Backpressure.
6. Prioritize player contact/near cuts above distant mesh/detail work. Async work
   trades completion latency for bounded frame work; it cannot guarantee unlimited
   destruction at constant FPS. Native/WASM solver multithreading is a separate
   demonstrated capability, not a consequence of creating more browser Workers.

Use the uploaded performance contract's proposed HVP-PLAY-720-v1 targets rather
than inventing an FPS floor: frame p95<=20ms/p99<=33.4ms; solver p95<=4ms;
non-solver/render main-thread work p95<=4ms; commit/upload p95<=2ms; tool feedback
p95<=100ms; ordinary 512-cell cut p95<=250ms/p99<=500ms. These are device/profile
acceptance targets, NOT current measurements or guarantees. Input-to-consistent-
generation latency must be measured directly, not a sum of phase percentiles.

No existing constant-v1/Structural-V1 schema, resource cap, worker consumer or
solver topology was changed by this investigation. At that investigation checkpoint HVP-04 had a direct
exact solver pin, the shared adapter moved into src and initial red tests; the
tick/collider/session implementation was still in progress. The subsequent
runtime/player implementation and current package status supersede that checkpoint.

### Owner correction: understorey scale and silhouette — 2026-09-15

The owner accepts the scale relationship of the 1.80 m figure to the large root
trees, but rejects the small vegetation reading as miniature trees and the thick
oversized amber spikes. Reopened lagoon `(15_38_42 (4))` and wetland roots
`(15_38_41 (2))` from the supplied concept folder. Those references distinguish
ground-hugging leafy/fern clumps, thin teal grasses and slender orange/violet
flower spikes from the woody umbrella trees. This is not a world-scale change.

Correction sequence: pin actual source heights above local ground and low-leaf
occupancy with failing tests; replace elevated broadleaf stems/crowns with basal
fronds and reduce reed/flower thickness and height in the existing authored bed
generator; keep the avatar, all four woody trees, terrain and collision unchanged.
Retain 0.125 m source cells, one decoration draw per owner and no decoration
colliders. Inspect new captures both beside the figure and in the fixed cameras;
record costs without claiming completed concept parity. Cutter work remains a
separate next package, not a hidden part of this visual correction.

#### Corrected understorey candidate — 2026-09-15

The 1.80 m avatar and all four woody root trees keep their geometry and scale.
Only the existing non-woody bed generator changes, versioned as
`hvp-root-umbrella-v3`. Broad leaves are now basal fronds with small alternating
leaflets, not elevated crowns on bare stems. Teal reed blades and orange/violet
flower spikes are slimmer and shorter; amber heads are one cell wide rather
than the previous three-cell columns. Fronds stay on their own terrace instead
of spanning a cliff edge. Removed the now-unused box-stamping helper. No new
assets, dependencies, collision bodies, sub-0.125 m voxels or source authority.

The added independent census checks every occupied decoration cell against
the actual terrain beneath it. It first rejected broadleaf heights up to
2.125 m and amber heights up to 2.625 m, with most broadleaf mass elevated.
The corrected source passes these maximum-height guards: broadleaf 0.875 m,
reed 1.375 m, violet 1.125 m, amber 1.625 m. Every broadleaf bed also has at least
45% of its cells within 0.375 m of local ground; all beds remain non-woody and
noncolliding. Intermediate failures at cliff edges led to checking the complete
frond footprint rather than only sparse centerline samples. Guards were not relaxed.

Fresh verification for this correction: four focused unit files 42/42 PASS;
after unused-helper cleanup, vegetation 12/12, TypeScript noEmit and production
build PASS (210 modules, existing large-bundle warning). Final real HVP E2E
14/14 PASS, including third-person avatar scale, walking/jumping, shaft falling,
solver contact, worker failure and all existing water/AO/image negatives.
The earlier complete 1,616-unit suite belongs to the preceding player revision;
it was not rerun wholesale for this bounded flora correction. Self-review only;
independent/human review and hardware acceptance NOT RUN.

Final evidence: `apps/weltraum-browser/evidence/hvp05-understorey-candidate02/`,
run `077aab85-2632-4f07-acd6-db2291edc1ba`, with current source bindings and five
fixed-view captures. Vegetation digest `473e49c5`, unchanged terrain `f30eca0a`
and look v6. Changed vegetation/E2E plus unchanged avatar/session hashes were
independently checked against the manifest. Overview, eye-height and actual
third-person browser captures were inspected; no concept-parity acceptance is
inferred. Earlier candidate01 and all older evidence remain historical.

Whole scene: 377,022 triangles (previous 385,114), 120 admitted draw groups,
247,954,400 controlled CPU bytes and 28,303,604 retained mesh bytes, below the
unchanged caps. Real physics still has two bodies / 84 colliders; ornamental
plants add none. Native built-application preview reached Ready with zero
console errors/warnings and is intentionally left open at port 5173 for up to
one hour. No commit, push or merge occurred. Cutter/destruction remains the next
unimplemented package, not a capability of this visual correction.

### HVP-08 supported timber separation — 2026-09-16

Implemented directly in the normal Hestia session, not a detached solver demo.
The bounded 384-cell authored timber has a real anchored source and one supported
foliage attachment. The aim button only changes the player's initial aim and
selects the existing 0.5 m box mode; it does not move the avatar or body. A real
pointer-lock acquisition followed by one left-click selects canonical cells
behind an unobscured native 4 m contact query. Acquisition itself never cuts.

The same legitimate Adaptive-to-Structural ingest and existing source subtraction,
connectivity, full mass tensor and exact collider derivation from HVP-07 are reused.
The independent six-cell fixture proves three anchored cells, two falling cells
and one removed cell. Its larger runtime counterpart removes 64 cells / 75 kg,
retains 192 cells / 225 kg anchored and creates a 128-cell / 150 kg dynamic body.
Actual 45-degree native queries and independent rotated COM/velocity oracles
verify `T + R(p-c)` and `V + W x delta`, not just bookkeeping counts.

Children and their exact compound colliders are created disabled before any parent
removal. The single World is held while new normal MeshArtifacts are uploaded
hidden. Source, native membership and visible keys publish as one admitted
generation; only then is the old native parent removed and simulation resumed.
Foliage support moves to the unique surviving component and its real body pose;
every world-space attachment vertex is unchanged at the commit boundary before
gravity acts. The normal browser test then observes real downward motion while
the anchored part stays fixed. No tween or per-voxel rigid body is involved.

Self-review corrected rollback ordering: old graphics and saved transforms are
restored before the worker may resume the restored World. Actor/transport failure
or uncertain native cleanup results in visible RecoveryHold, not claimed success.
Tests inject plain and typed failures after real native collider creation, parent
removal before/after effect, reentrant mutation and forged partitions. Consumer
tests separately cover upload, commit, both publication steps, finalization and
old-resource retirement failures. Coexisting new/old resources and current terrain
overlays are admitted against the existing limits; no cap was increased.

Fresh verification after these fixes:
- All unit tests: PASS, 169 files / 1,671 tests, 456.85 s.
- TypeScript noEmit and Vite production build: PASS, 218 modules; the existing
  >500 kB bundle warning remains (embedded-WASM physics worker about 2.25 MB).
- Real HVP E2E: PASS, 19/19 in 2.9 minutes, one worker, zero retries. This includes
  the new timber/foliage cut, all three quarry brush modes, native impulse,
  walking/third-person/shaft, contact, startup failure and prior visual negatives.
- Whitespace diff check PASS. Critical source/consumer/bootstrap/E2E SHA-256
  values were independently recomputed against the final manifest.

Current overview evidence: `apps/weltraum-browser/evidence/hvp08-candidate01/`,
run `beb3af7b-9b51-470b-8fa7-ba92f569d7d3`, 38 explicit source/test/package bindings,
five fixed-view PNGs, observed Chromium 153.0.8010.37 / DPR 1. The overview is
paused generation 0, not itself proof of destruction. Separate normal-input
before/after images and JSON receipts are attached to the HVP-08 Playwright case
in `evidence/playwright-report/hvp08-final/`; both actual images were inspected.
Before: complete anchored beam; after: separated, rotating timber and foliage
beside the surviving post. All previous evidence remains historical.

Initial whole-scene cost: 377,780 triangles, 171 material groups, 248,239,528
controlled build-peak CPU bytes, 28,362,116 retained mesh bytes, under the unchanged
500,000 / 300 / 256 MiB / 128 MiB caps. World starts with four bodies and 88
colliders, then has five bodies after the demonstrated split. Native/GPU memory
and device performance acceptance remain unsupported / NOT RUN.

Scope remains explicit: terrain cutting is SafeQuarry-only; structural cutting
currently targets this bounded timber and preserves its anchor and attachment
support. General terrain detachment (HVP-09), moving recuts (HVP-10), save/restore,
salvage and final hardware/owner acceptance are still pending. No arbitrary root
tree cutting, concept parity, independent review, commit, push or merge is claimed.
Continue with the bounded terrain connectivity/transfer contracts next.

#### HVP-09A working sequence

Read the actual HVP-09A/B source, test and resource contracts before editing.
First implement a pure face-six support analysis over the issued cut's immutable
candidate root: at most 262,144 probes, explicit base anchors, real current-slot
vertical support witnesses, closed-component extraction only. Unknown or budget
termination returns no publishable fragments. Bind results to the exact before/
after snapshot and coverage, and reuse the existing legitimate Structural ingest,
full mass and exact-collider admission for each bounded detached component.
Keep those calculations pure so a worker does not import the Rapier/WASM owner.
Independent full-fixture BFS, corner/leaf-boundary/unknown/budget/anchor/staleness
and exact-fragment-cost negatives precede a real source-bound C05 preview.
Terrain mutation beyond the existing SafeQuarry remains blocked until HVP-09B
can stage root removal, old statics, fragment bodies and render membership together.

### HVP-09A canonical support preview — 2026-09-16

Implemented the bounded face-six search and typed `AnalyzeHvpTerrainSupport`
worker job through the existing pool/result gates. Air, missing coverage and
base support remain distinct. A current solid vertical chain to the protected
base can prove attachment; sector/leaf boundaries never count as anchors.
Unknown or exhausted search/admission returns no publishable fragments.
Each closed component passes the existing real Adaptive-to-Structural ingest,
full-mass/principal-axis and exact-cuboid admission (32,768 cells / 64 boxes).
Pure rigid-recipe preparation was separated from the native Rapier installer so
the heavy preparation worker does not acquire a second WASM World.

Support packets bind session, epoch, generation, source digest, dimensions,
changed seeds and the actual candidate snapshot. The accepted output is checked
for its binding, counts, ordered unique cells, material mass, bounds, digest and
actual source occupancy. Input/output caps are explicit. The complete 8 MiB
candidate copy currently yields between slabs; its copy/hash latency is not a
claim to meet the later measured main-thread or interaction p95 targets.

Authored source v5 (`b8fde6b0`) adds the C05 rock arm to canonical terrain cells,
not a preplaced rigid prop: a supported 3 x 0.5 x 0.5 m roof with real dry air
below. The original test failed because no 64-cell support existed. The new
test proves the air cavity, complete 384-cell component, one exact collider,
and independent material census (1,722.65625 kg, including the existing soil
surface rather than pretending every cell is limestone). The source's ordinary
terrace-height limit remains unchanged outside the precisely delimited site.
Mesh tests now account for the additional 1.25 square metres of exposed floor
under the roof and independently count actual source up-faces; no heightfield
assumption is used to suppress a valid cavity.

The normal HUD action **Felsarm-Stütze prüfen (ohne Schnitt)** pauses the existing
World, selects the specified C05 pose `(4,2.5,-9) -> (7,1.5,-6), FOV 50`, and
requests a hypothetical support cut. The accepted component is highlighted with
the existing bounded wireframe presentation. Root identity, all terrain product
hashes, World generation, native body/collider counts and poses remain unchanged.
Pending/error/stale status is explicit. This is a named read-only prototype
preview, not a gameplay ray hit, mutation permission or an already falling rock.

Fresh verification:
- Full Vitest: PASS, 170 files / 1,678 tests, 435.22 s.
- TypeScript noEmit and Vite build: PASS, 223 modules; existing large-chunk warning.
  Streaming worker 156.07 kB; single World worker 2,263.08 kB with pinned WASM.
- All HVP browser tests: PASS, 20/20, 3.1 minutes, one worker / zero retries.
  The new C05 test uses only real controls and proves all unchanged authorities
  while observing 384 cells, 64 hypothetical removals and 2,156 support probes.
  Earlier terrain cuts, timber falls, real contact impulse, walking, third person,
  shaft, failure paths, water/AO and route isolation remain green.
- Eight critical source/test SHA-256 values independently matched the manifest.
  Actual C05 wireframe/air-space capture opened and inspected; its regular authored
  support is functional prototype geometry, not concept-art acceptance.

Current overview evidence: `evidence/hvp09a-candidate01`, run
`b608167e-8c7e-4558-ac88-24c00c809142`, 41 listed source/test/package bindings,
Chromium 153.0.8010.37 / DPR 1. The separate C05 screenshot and unchanged-state
receipt are attached to the normal-input test in `playwright-report/hvp09a-final`.
Initial scene: 374,632 triangles, 169 logical draw groups, 247,067,736 controlled
CPU bytes, 28,116,392 retained mesh bytes, 4 bodies / 88 colliders. Existing caps
are unchanged. Vegetation digest changed to `f236834a` because habitat sampling
consumes the changed source; tree/plant generator code and avatar size did not change.

HVP-09B still must remove transferred cells from the root, replace old static
collision, create real fragment bodies and adopt their meshes in one held-world
transaction with verified rollback/RecoveryHold. No terrain fragmentation,
moving recut, save, salvage, owner ART or hardware acceptance is inferred here.
Historical evidence remains intact; no independent agents, Plannotator, commit,
push or merge were used for this checkpoint. Test servers exited after verification.

### HVP-09B real terrain-to-fragment transfer — 2026-09-16

The normal cutter now accepts the actual authored rock-support cells, in addition
to the existing SafeQuarry. This is not a pre-placed loose body: the support
worker analyzes the immutable post-cut root; its closed detached cells are
removed from the terrain in the same root generation and transferred to a newly
admitted native body. Arbitrary cliff/root-tree destruction and moving recuts
are not claimed by this bounded policy.

- `prepareTransfer` keeps direct removal separate from transferred occupancy,
  limits transfer to 32,768 cells/eight content leaves, rejects protected,
  duplicate, unknown or stale cells, and increments each affected content leaf
  once. Dependency-only halo leaves do not acquire content revisions.
- The existing dirty-sector compiler builds only affected 8 m render sectors
  and 4 m static-collision sectors from the final cut-plus-transfer root.
  Native fragment recipes independently validate canonical material/mass,
  full inertia, exact cuboid admission and source bytes before World mutation.
- New statics and bodies are staged disabled while the old World is held.
  Graphics are staged hidden. One synchronous owner publication couples root,
  admitted World snapshot and render membership. Old statics are retired last.
  Rollback verifies native handle membership; unproven cleanup retains
  `RecoveryHold`, blocks stepping/resume, and never reports an applied cut.
- Fragment drawing consumes actual native COM/pose through existing artifacts.
  Its controlled source/mesh/copy bytes and old/new coexistence are admitted
  under the unchanged caps, including subsequent structural cuts.
- `Neustart: Felsarm` explicitly confirms a fresh session before choosing the
  allowlisted rock-arm spawn. Camera/aim controls never teleport a live avatar.
  The actual eye ray selects the support; the bounded box spans that real
  support cross-section rather than issuing a hidden cut from a camera button.

The first full browser reproduction correctly rejected and restored a failed
artifact upload. Mixed rock/soil gives a fractional COM: a Float32 vertex
`-1.5056122541427612` fell outside ideal-double bound `-1.5056122448979607`.
A new actual-source/native-COM regression reproduced this exact error. The
presentation boundary now rounds bounds exactly like the uploaded Float32
positions; artifact validation and all tolerances remain unchanged. Synthetic
two-cell geometry had not reproduced the rounding direction and was replaced
by the actual authored mixed-density formation in that regression.

Fresh checks after the correction:

| Check | Actual result |
| --- | --- |
| Transfer/consumer/real-World focused tests | PASS, 18/18 |
| Full Vitest | PASS, 172 files / 1,686 tests, 442.58 s |
| TypeScript noEmit / Vite build | PASS, 225 modules; existing >500 kB chunk warning |
| All HVP real-browser cases | PASS, 21/21, 3.5 min, one worker / zero retries |
| Original real undercut reproduction | PASS, 21.9 s in the final suite |
| Diff whitespace | PASS |

The real undercut test goes through fresh-session confirmation, normal pointer
lock, target selection and one click. It proves 64 directly removed support
cells, 384 transferred roof cells, one additional native body, matching root
and World generation, only local render-sector changes, completed Idle
transaction, then a real downward/rotational pose change. Direct removed mass
and transferred mass are distinct receipt fields. Before/after images were
inspected; the rock can contact the actual player capsule as well as terrain,
not an invented animation or invisible support plane. Real-World unit cases
separately prove settling on the remaining floor and post-create rollback faults.

New overview evidence: `evidence/hvp09b-candidate01/`, run
`ca85d13a-d3c4-4e63-af56-61ec773fb156`, 44 explicit source/test/package bindings,
Chromium 153.0.8010.37 / DPR 1. Eight critical transfer/World/root/test hashes
were independently recomputed and matched. Paused overview generation zero is
not destruction proof; the final browser report additionally contains the
actual C05 before/fall PNGs and generation/material receipt attachment.
Initial totals remain 374,632 triangles, 169 logical draw groups, 247,067,736
controlled CPU bytes and 28,116,392 retained mesh bytes. Source `b8fde6b0`,
vegetation `f236834a`, look v6, effects v1. All older evidence remains historical.

This was self-reviewed direct work; independent review, owner art acceptance and
device-profile performance acceptance remain NOT RUN. Test servers are stopped.
No commit/push/merge or baseline promotion. Next: HVP-10 moving-fragment recuts,
then complete save/restore, the salvage loop and bounded residency/hardware gates.

### HVP-10 working sequence — local recuts, current native motion

Reuse the issued Structural subtract/partition and create-first/remove-last
World stage. Bind an actual unobscured 4 m native ray to object ID, content,
issued tick and local cell. Keep prepared geometry strictly local, while the
parent may move; only the final safe World stage reads pose/velocities. Heavy
local products use the bounded existing WorkerPool, not renderer-derived truth.
Replace only that parent, retain terrain-origin lineage and account separately
for removed material's linear/angular momentum. Last-cell removal, child recut,
stale/removed parent, duplicate/concurrent intent and rollback/RecoveryHold need
negative tests before normal-input browser proof. No cached world-pose adoption,
live teleports, new solver, global mesh rebuild or relaxation of body/cell caps.

### HVP-10 terrain-origin recut checkpoint — 2026-09-16

Dynamic terrain fragments and their descendants now accept normal cell/box
cutter intent. A native, unobscured four-metre ray is transformed through the
actual body pose into canonical local cells and bound to owner, source and issue
tick. No render triangle is an authority. Heavy local source/mesh preparation
runs through the existing typed worker pool while the single World keeps moving.
Input buffers transfer ownership and identity checks include the material-table
values; a real protocol test caught JSON key-order sensitivity, corrected by
encoding that identity as explicit tuples rather than dropping any binding.

Only final native stage/commit holds the World. The native owner revalidates the
current parent/source and prepared local products, then uses the CURRENT pose,
linear velocity and angular velocity, not the pose at issuance. Children inherit
rigid-motion velocities; removed linear/angular momentum is recorded about the
current parent COM. Exact child geometry is prepared before parent removal;
World and render publication happen in one main-thread turn, with rollback and
RecoveryHold on unproven cleanup. Last-cell removal and another cut of a child
are covered against actual Rapier bodies. Static terrain root/sector generations
do not change during these body-local operations.

Fresh verification:
- Full Vitest: PASS, 175 files / 1,704 tests, 413.40 s.
- TypeScript noEmit and Vite production build: PASS, 229 modules; existing
  large-chunk warning. Preparation worker 183.48 kB; World worker 2,283.02 kB
  includes the pinned WASM, not a second main-thread World.
- All HVP browser tests: PASS, 22/22, 3.4 minutes, one worker / zero retries.
  The new case first undercuts the real rock arm, then follows the observed
  fragment using normal relative mouse input, applies a real F contact impulse,
  and clicks again. It proves parent retirement, cell/mass partition, later
  commit tick, matching dynamic publication and unchanged static sector hashes.
- Early browser attempts stayed aimed at the vacated support and issued no body
  command. Passive event observation found no unexpected mouse movement. The
  test now follows the actual moving target; no body/camera write, freeze,
  timeout increase or weakened assertion was used to create a hit.
- Self-review and eight independently recomputed source/test SHA-256 bindings
  matched the new manifest. Actual before/after images were opened, including
  the post-recut fragment (`41aacb561078d4d37389acf76680bdedfa75c768.png` in the
  `playwright-report/hvp10-final/data` directory) with native Applied receipt.

Evidence: `evidence/hvp10-candidate01`, run
`e52dfa44-6b9c-4eac-8b89-dcb91ec4649f`, 50 explicit source/test/package bindings,
five paused overview images, Chromium 153.0.8010.37 / DPR 1. The overview is not
destruction evidence; the normal-input test carries its separate before/after
PNG and JSON receipt. Source `b8fde6b0`, vegetation `f236834a`, look v6 and initial
cost remain unchanged: 374,632 triangles, 169 groups, 247,067,736 controlled CPU
bytes and 28,116,392 retained mesh bytes. Periodic renderer counters are not
capture-synchronous GPU/performance measurements.

This checkpoint is intentionally narrower than complete HVP-10 acceptance:
released timber/foliage ownership is still to join the moving-cut path; dynamic
sphere cuts and arbitrary root-tree cutting are not implemented. Save/restore,
salvage, neighbor residency and hardware/owner art acceptance remain open.
Historical evidence is untouched, test servers exited, no independent reviewer,
Plannotator, commit, push, merge or golden promotion was used.

### HVP-10 released-timber recut checkpoint — 2026-09-16

Released wood now joins the same native moving-body registry as terrain fragments,
without duplicate bodies or stale handles in the anchored branch owner. Its
foliage follows the actual child containing the support cell; cutting that cell
retires the attachment instead of inventing another support. Real solver tests
prove world-space leaf continuity across COM changes, correct retirement, rollback
and valid second-generation representation IDs. The normal browser path detaches
the branch and then removes one voxel from its moving/settling child: 128 cells
become 127 plus the explicit removal, mass is conserved, and static terrain stays
unchanged. No arbitrary full root-tree cutting or dynamic sphere is claimed.

Fresh full verification: 175 Vitest files / 1,706 tests PASS (474.64 s), TypeScript
and Vite build PASS (229 modules; existing large-chunk warning), all 23 HVP E2E
PASS (3.9 minutes, one worker, zero retries). Real timber recut passed in 12.1 s,
terrain recut in 15.9 s. Actual report images were opened; the timber after-image
`149fc504816e2ba93480e565428890d8d95c8664.png` shows the voxel hole, brown wood,
the retained green attachment and native Applied receipt.

New bound overview evidence: `evidence/hvp10-candidate02`, run
`f5073bfb-3232-45bb-807c-1b482ebc74f7`, 50 source/test/package bindings and five
paused camera captures. Source/vegetation/look/effects remain b8fde6b0 / f236834a /
v6 / v1. Overview generation zero is not the destruction proof; that proof is the
separate normal-input before/after capture and JSON receipt. Previous captures
are preserved. Test servers exited; no commit, push, independent review or owner
art/hardware acceptance is claimed.

### HVP-11 working sequence — complete artifact, unchanged valid head

Read the master package and all twelve persistence cases. Reuse the existing
Structural region-save codec for validated source plus bound motion, and the
existing browser SaveRepository's checked payload/CAS transaction. The HVP payload
belongs in its neutral player-data envelope, in a separate HVP database/slot
namespace; no unrelated save migration or repository schema widening.

1. Add bounded, complete material-grid checkpoints and exact COW Root revisions;
   restored cells come from the artifact, not the current terrain generator.
2. Bind each live owner to canonical source, native COM pose/velocity/sleep state
   and attachment support at a held safe tick. Include avatar, source/profile
   versions, generation tokens and completed command outcomes; no solver handles.
3. Validate sizes, material/owner partition and complete motion coverage before
   constructing a fresh candidate World. Reject mismatches rather than supplying
   current defaults or zero velocities.
4. Coordinate save after in-flight mutation settles; persist one immutable encoded
   payload with an atomic expected-revision head. Storage failures retain the old
   complete save. Reuse the repository's existing payload cap rather than enlarge it.
5. Prepare the replacement fully before disposing an active session. Verify fresh
   artifact-only restore, actual reload/continue, missing-motion/tamper/quota/stale
   command negatives, and repeated lifetimes. Contact-cache future trajectories
   are not claimed bit-identical from matching pre-step state.

### HVP-11 complete artifact and live/cold restoration — 2026-09-16

The normal HVP controls now save to the existing IndexedDB/CAS repository in a
separate `weltraum-hestia-prototype-v1` database and `hvp-primary` slot. Existing
user repositories, schemas and the 16 MiB repository cap are unchanged. The
envelope is a legitimate player-only save with empty vehicle collections, not a
fake ship. Its universe ticks are bound to twice the actual 60 Hz solver ticks.

The artifact contains the full canonical base and copy-on-write terrain leaves,
actual plant volumes/supports, all current rigid sources/materials/full inertia
and native motion/sleep/CCD, avatar state, tick state, camera/FOV/toggles and all
three command-receipt journals. It does not reconstruct amputated content from
the original generator. Existing Structural source/motion codecs and canonical
persistence signatures are reused. HVP-12 progression is explicitly `null` until
that package is implemented; saving alone is not the finished gameplay loop.

Schema/profile/transport/decoded-memory checks precede bulk/native allocation.
Canonical base bytes are checked against their real source digest. Cross-owner
checks reject material present both in static Root and a moving body, duplicate
fragment cell ownership, foreign material profiles and invalid wood anchors.
Even an externally rehashed artifact cannot bypass those semantic checks. A
real mixed-material F7 body restores its canonical COM y=0.6875 m and exact
native pre-step state; ten fresh-World cycles also preserve the rotated L body's
pose, full inertia-derived behavior, velocities, sleep and collider materials.

Live load constructs a paused candidate World B while retaining A, stages hidden
replacement graphics, then publishes Root, World, input and render together.
Only afterward are A and its obsolete graphics retired. Missing acknowledgements,
failed upload/publication/native cleanup and stale A cannot produce false success;
unproven restoration remains RecoveryHold. A cold entry selected through the real
`Gespeicherte Sitzung neu öffnen` control consumes only saved canonical content
for the editable region, plants and bodies. Immutable outer presentation remains
bound to its saved, known profile. Resume and pointer lock stay explicit.

#### Reproductions corrected without weakening acceptance

- Pausing had erased the avatar's vertical velocity; the red fall-state test now
  preserves it through pause/checkpoint/restore.
- Cold-loaded fragment continuation exposed incorrect overlap accounting: old
  retired initial-mesher scratch was charged as simultaneously live. Replacement
  admission now counts actual retained A/B state, three conservative staged mesh
  copies and the full existing 96 MiB preparation reservation. A 258 MiB negative
  still fails the unchanged 256 MiB cap.
- Whole-suite verification caught the camera losing its preset FOV guarantee on
  resize. The controller now retains its actual owned preset/restored FOV and
  respects the active player camera. Quaternion tests compare its numeric
  components, not Three.js's private change callback.

#### Fresh evidence

- Full Vitest: PASS, **181 files / 1,745 tests**, exit 0, 491.25 s. The earlier
  1,742/1,744 run with two camera failures is not relabeled successful.
- TypeScript noEmit and Vite: PASS, **250 modules**, 1.54 s; existing >500 kB
  warning remains (World worker contains the pinned WASM payload).
- HVP browser suite: PASS, **26/26**, 5.7 minutes, one worker / zero retries,
  pinned Node 22.23.2 and installed Chrome.
- The real IndexedDB transaction was deliberately aborted **after put success**:
  old metadata and complete payload hash/bytes remained unchanged. A lost real
  candidate-World acknowledgement was cleaned up; the subsequent ordinary load
  succeeded with A intact until replacement.
- Actual terrain and released-timber descendants survived document replacement
  with exact saved poses, velocities, owners, attachments, generations and ticks.
  Both were cut again through normal input and successfully saved as revision 2.
- The complete actual saved envelope is attached to the normal-input test report;
  no test-created gameplay control or TestBridge was used.

Candidate: `apps/weltraum-browser/evidence/hvp11-candidate01/`, run
`accb4fd2-0ab1-436d-af5f-bb730d02fc6d`. It lists 63 explicit source/test/repository
bindings and five paused overview images; those generation-0 images are not the
save/restore proof. Actual restored terrain/timber overview images were opened
from the `hvp11-final` Playwright report, alongside the live cut images. Ten
critical persistence/native-restoration source hashes were independently
recomputed and matched the manifest. All earlier candidates remain untouched.

Initial scene remains 374,632 triangles, 169 material groups, 247,067,736
controlled CPU bytes and 28,116,392 retained mesh bytes under unchanged caps.
Loaded/replacement generations are admitted separately with their actual source
and coexistence costs. GPU/native allocation bytes and hardware acceptance are
still unsupported/NOT RUN; screenshots and submission timings are not a hardware
benchmark. Self-review only; independent review and owner ART_ACCEPTED are not
claimed. Test servers shut down. Work remains local and uncommitted.

Next: HVP-12's actual domain-driven salvage loop, then the remaining bounded
neighbor/residency and measured final acceptance work. Dynamic sphere recuts and
arbitrary root-tree detachment remain explicitly unsupported rather than silently
mapped to a different operation.

### HVP-12 implementation sequence — 2026-09-16

Compose the existing sequential mission/objective primitives into discovery,
confirmed marked cut, physical delivery and durable save. Use a separately named
salvage start with a small canonical wood connection and an eight-cell cargo
piece (600 kg/m3, 9.375 kg), not lighter fake density or a stronger impulse cap.
The existing large timber/root specimens and player scale stay unchanged.
Reuse the same structural split, one World, contact impulse and artifact save;
the new scenario is level content, not another physics implementation.

Progress must bind stable source/body/zone IDs and actual solver/commit receipts.
Many irrelevant cuts or direct UI flags cannot finish an objective. Persist
mission and world facts together; final completion publishes only after the same
atomic repository write succeeds. Failed or cancelled reset leaves the current
world and existing save untouched. No rewards, NPC, inventory or scripted motion
are introduced. A new-human usability run and art/hardware gates remain NOT_RUN
until actually performed; automated normal-input completion is a separate gate.

### HVP-12 verified local checkpoint — 2026-09-16

`gameplay/salvageLoop.ts` now consumes confirmed native player, cut, contact and
delivery facts through the existing sequential mission core. The four objectives
are not button counters. A separately named salvage start uses seventeen actual
wood cells: eight supported cells, one marked connecting cell, and eight cargo
cells. The cargo is 9.375 kg at the unchanged wood density. Root trees, the large
timber fixture, terrain, avatar scale, 15 Ns impulse limit and physics are not
weakened to make the task pass. The blue depot outline and orange link highlight
are accounted render markers, not invisible floors or scripted movement.

The player HUD shows the active instruction and confirmed objective states;
inspection controls are hidden during actual salvage walking. Fresh starts and
resets require normal confirmation. In the first real test a close, downward
impulse pinned the cargo outside the depot. Inspection of the actual image and
native motion identified the cause. Walking backward to a shallower contact
angle solved it through normal input; no mass, friction, impulse, zone, body
pose or assertion threshold was changed. The instruction now explains this.

The final browser case walks to the site, cuts the marked canonical connection,
saves halfway, closes/reopens the session from the artifact, and checks exact
partial mission/body restoration. It then uses real F contact impulses to place
the cargo at rest in the depot. An actual IndexedDB transaction abort after a
successful put leaves both the previous save bytes and the unfinished mission
intact. Only a subsequent successful CAS write (revision 2) completes the final
objective. Cold reopening preserves the completed mission and native bodies;
cancelling another restart leaves that world and save unchanged. No TestBridge,
private pose writes, fake progress, rewards or teleportation are involved.

Fresh final verification:

- Full Vitest: PASS, 182 files / 1,751 tests, 528.14 s.
- TypeScript noEmit and Vite production build: PASS, 257 modules, 1.31 s.
  The existing large-bundle warning remains; embedded Rapier World worker is
  2,313.16 kB and the main bundle 1,501.32 kB. No bundle-performance acceptance.
- All 27 HVP E2E tests: PASS, 7.3 minutes, one worker, zero retries, pinned Node
  22.23.2 and installed Chrome. The expanded salvage case passed in 54.0 s;
  all prior save/cut/recut/physics/player/visual negative cases also passed.
- Self-review and scoped evidence binding: eight critical source/test SHA-256
  values independently recomputed and matched the candidate manifest.

`evidence/hvp12-candidate01/manifest.json` binds run
`8ff177d7-aacc-4035-a21a-d73dd05ddc88`, 65 explicit source/test/package inputs,
Chromium 153.0.8010.37 / DPR 1, source `b8fde6b0`, vegetation `f236834a`, look v6
and effects v1. Its five paused coast overview images are NOT completion proof.
The actual normal-input report images were opened: marked-link play view
`playwright-report/hvp12-final/data/cb6ccaefbafbe7056418bdd1c936b6b1ae56f1a1.png`
and cold-reopened 4/4 completion with saved revision 2
`playwright-report/hvp12-final/data/4b444e2b2d1a5dd87c88f36424c011b5e6f7b847.png`.
The corresponding full-domain receipt attachment accompanies the test.

The ordinary coast remains within the same admitted limits; the salvage marker
adds only 60 triangles/two groups in its scenario and is included in admission.
GPU/native memory and named-device performance acceptance, independent review,
new-human usability and owner art acceptance remain NOT_RUN. Earlier evidence
is unchanged; test servers exited; all work is still local/uncommitted. Next are
bounded neighboring coverage/residency (HVP-13) and measured total acceptance
(HVP-14), without treating this one successful loop as the entire game's finish.

### HVP-13 working plan — bounded eastern neighbour (2026-09-16)

Read the exact HVP-13/14 package and all ten HVP-13 catalogue cases before edits.
Reuse `streaming/residency.ts`, content-key/cache primitives and the existing
typed WorkerPool. The master describes 64 collision sectors for the starting
32 m excerpt, not a global 64-sector limit; the global 4,096-collider cap and all
CPU/mesh/triangle/job/body caps remain unchanged.

1. Add one adjoining canonical region, x=[16,48), z=[-16,16), from the SAME
   global authored descriptor/material policy. Keep real 0.125 m cells and
   16-cubed leaves. Pin source-order/global-cell equality and full semantic keys
   (seed, generator, materials, edits, neighbours, projection algorithm).
2. Keep the edited starting Root authoritative; neighbour cells must be restored
   from their checkpoint after eviction, never substitute fresh seed output for
   saved data. Existing named-cut policies do not authorize arbitrary new sites.
3. Load ahead of the player's eastern boundary with distinct enter/exit thresholds.
   Publish canonical coverage, exact collision and bounded render products as one
   admitted generation. Missing/pending collision must keep the avatar on known
   coverage; existing far proxies never supply walking/picking authority.
4. Render LOD is projection-only. Remove overlapping join/far/water representations
   where the neighbour is installed; preserve source/collision/save identities and
   explicit region epochs across cancel/evict/recreate. Admit coexistence before
   allocation/publication; measure actual products before claiming they fit.
5. Pin active/near physics owners. Checkpoint eligible distant sleeping terrain
   fragments before native dematerialization; restore the same cells, material,
   owner, pose and sleep policy before making them available again. Other owner
   families may remain conservatively pinned, never silently discarded.
6. Extend the complete game checkpoint to include neighbour/parked ownership,
   retaining old-save safety and the existing stricter 16 MiB repository ceiling.
   Prove seams, stale rejection, hysteresis, real coverage hold, and twenty actual
   return trips with unchanged edits/owners and bounded owned-resource counts.

This section is an implementation plan, not completed residency or performance
evidence. HVP-14's frozen hardware profiles, five-run raw measurement populations,
manual usability and owner art decisions remain separate and pending.

### HVP-13 verified functional checkpoint — 2026-09-17

Implemented the adjoining eastern 32 m region through the existing bounded
WorkerPool, semantic content keys, MemoryContentCache and residency transitions.
Actual canonical cells remain 0.125 m. Fine/coarse meshes are projections only;
source, collision, saved edits and mass do not change with LOD. Indexed-surface
oracles verify the fine collar, coarse boundary and nonoverlapping water against
installed land, not a seed-only approximation. The old overlapping proxies are
replaced as part of the same admitted generation.

Native eastern coverage becomes available only after all 64 eastern collision
sectors and eight primary-edge replacements are prepared. World stepping is
held during coupled coverage/render publication. Active or nearby bodies pin
their region. Stale/cancelled outputs cannot enter cache, graphics or World;
failed admission is latched for an explicit retry rather than a frame-loop retry.
The source checkpoint precedes eviction. Edited evicted regions retain a bound
checkpoint projection, never substitute the old seed terrain or claim collision
coverage. A single bounded 32 MiB cache survives controller handoffs through real
leases, and neither retiring controller clears the replacement's live lease.

Sleeping distant terrain fragments now checkpoint complete canonical/native
state before solver dematerialization. Native and GPU membership changes occur
while the World is held; uncertainty enters RecoveryHold. GPU eviction uses the
backend's existing EvictRepresentation contract, not permanent Remove tombstones,
so the exact source/artifact identity can be rehydrated. Retained derived CPU
meshes and serialized dormant bytes remain charged: this is not a zero-memory
claim. Real live and cold-save journeys restore the same owner, cells, mass,
pose and sleep state before play resumes. Other owner families remain pinned.

Game saves now include resident or evicted edited eastern source and dormant
owners. Actual native collision hashes/coverage and source identities are checked
on cold restore. Hot restore between absent/resident generations keeps old A
until native B, graphics, Root, receipts and view are ready; unique visual aliases
and shared cache leases prevent stale revision collisions. Candidate restore
preparation is sequential where needed, with an explicit one-worker reservation;
normal two-worker paths keep their original allowance. No global cap increased.

#### Corrections found during integration and verification

- Replaced inappropriate overlap of completed worker scratch with publication
  memory by phase-correct coexistence accounting. Cache-shared array views are
  counted once, while GPU snapshots, grouped indices, native copies and retained
  original proxies are still charged. Admission runs before allocation/upload.
- Made complete Root checkpoint encoding yield every 16,384 source reads using
  the same RLE algorithm. Unchanged checkpoint reuse avoids reserializing 8 MiB
  on every crossing; eviction releases strong source references.
- Published Save/Load busy/rejected status synchronously, eliminating polling
  of an old status before the new operation actually began.
- Fixed a real pointer-lock/capture race: inspection camera input checks native
  pointerLockElement as well as the asynchronous player owner, and records a
  captured pointer only after capture succeeds. The red native-lock unit case
  previously attempted an invalid capture. No exception was swallowed.
- Test navigation now waits for actual player ownership/Walking and uses bounded
  short feedback intervals, not one-second sprint overshoot. The shaft test stops
  with the whole 0.3 m capsule clear of both rims before checking the original
  0.124–0.145 m floor band; previous diagnostic runs drove it into the far wall.
  Physics geometry, step/jump values, reach and numerical tolerances are unchanged.

Historical full runs `hvp13-candidate01` through `candidate04` contain failed
checks and are NOT relabeled passed. Some earlier runs also observed genuine
SimulationHold; its scheduling cause remains unproven. Read-only first-hold clock
diagnostics were added, but the four-step catch-up cap was not raised and no
automatic resume was introduced. Three controlled diagnostic runs and the final
full run below completed without that failure; this does not erase the residual
device-performance risk or establish PERF_ACCEPTED.

#### Fresh verification and evidence

- Full Vitest: **PASS, 189 files / 1,781 tests**, 695.53 s, pinned Node 22.23.2.
- TypeScript noEmit and Vite build: **PASS**, 264 modules; preparation worker
  198.63 kB, single World worker 2,370.04 kB including pinned WASM. Existing
  >500 kB bundle warning remains.
- After the final shaft-test placement correction: three focused shaft runs
  PASS, followed by **all 31 HVP E2E PASS**, 15.5 minutes, installed Chrome,
  one worker, zero retries and trace off. No product changes followed full units.
- The full browser run includes fine/coarse collision-identity checks, twenty
  real return trips with exact stable owned-resource/native counts, bounded cache,
  live/cold fragment park-wake, absent/resident hot and cold saves, all prior
  cuts/recuts/contact impulses, player/shaft, save failures and salvage completion.
- Source/test binding self-check: ten critical SHA-256 values independently
  recomputed and matched. Actual eastern walking, restored/completed salvage,
  third-person and physical cut report images opened and inspected. Independent
  review, owner art/new-human usability and hardware acceptance remain NOT_RUN.

Final local evidence is `evidence/hvp13-candidate05/`, run
`197b28ca-4992-48b5-a3df-9164df3f2064`, 77 listed source/test/package inputs,
Chromium 153.0.8010.37 / DPR 1, source `b8fde6b0`, vegetation `f236834a`, look v6,
effects v1. The five paused ordinary-coast overview images are not traversal or
saved-world proof; actual gameplay images and full generation/resource receipts
are attached in `playwright-report/hvp13-candidate05`. The eastern walking image
`data/58df8901609727e9cc0b317149dbcca12f57bb8d.png` shows Ready fine eastern
coverage, 152 actual colliders and 418,566 total triangles. The default overview
remains 374,632 triangles, 169 groups, 247,067,736 controlled build-peak CPU bytes
and 28,116,392 retained mesh bytes; all original caps remain enforced. Native/GPU
allocation and renderer submission samples are not substituted for GPU timing.

Test servers exited. Earlier captures and unrelated worktrees are preserved;
no commit, push, merge or baseline promotion is claimed. Next is HVP-14's actual
local device manifest, raw measured populations and explicit acceptance gaps,
not another inferred claim that a green scene equals the whole final game.

### HVP-14 working sequence — measurements are not art approval

Read the uploaded HVP-14 package, all twelve acceptance cases and the complete
performance contract before implementing the reporter. Reuse existing telemetry
counters, artifact signatures and Playwright setup; existing aggregate latency
summaries alone cannot supply the required raw-sample quantiles.

1. Freeze a neutral `HVP-DEVICE-01` from observed OS/CPU/GPU/driver/RAM/power and
   the actual browser/build/lock/WASM bindings. Do not infer GPU VRAM from the
   truncated Win32 AdapterRAM field or assign H1/H2/H3 eligibility.
2. Add fail-closed evidence checks first: measurement phase versus diagnostics,
   trace/screenshot exclusion, immutable fixture provenance, five distinct
   processes including failed runs, separate cut/no-op outcomes and SHA-256
   tamper rejection. Nearest-rank quantiles must use actual raw observations.
3. Gather bounded raw runtime diagnostics without changing simulation, source,
   image quality or budgets. Diagnostic runs and final five-process populations
   remain separate. Missing scenarios/samples and failed targets cannot become
   PERF_ACCEPTED. The earlier unexplained SimulationHold remains an open risk.
4. Run complete regression groups and inventory checks; keep legacy generated
   test outputs separate from accepted HVP baselines. Document start, controls,
   save/load and recovery using the real UI. Human art/new-user usability and
   unsupported hardware metrics remain explicitly NOT_RUN.

Observed local hardware on 2026-09-17: Windows 11 Enterprise 10.0.26200 x64,
Intel Core Ultra 7 255H (16 reported cores/logical processors), 33,811,132,416
bytes installed RAM. GPU enumeration reports NVIDIA RTX PRO 500 Blackwell
Generation Laptop GPU driver 32.0.15.9658 and Intel Arc Pro 140T GPU driver
32.0.101.8517; the browser's actual selected renderer still needs binding.
Active Windows scheme is Balanced; WMI reports AC online, neither charging nor
discharging. Intel display reports 1920x1200/60 Hz. These are observations, not
target-device acceptance, and the measurement profile remains 1280x720/DPR 1.

### HVP-14 measured startup diagnosis — no performance acceptance

The separate production-preview runner now freezes observed source/build/lock/
WASM/browser binary hashes before each population. The selected browser renderer
is the Intel Arc Pro 140T ANGLE/D3D11 adapter, not the enumerated NVIDIA device.
The actual product canvas is checked at CSS and physical 1280x720 / DPR 1.
Windows' initial emulated DPR was `1.0000000149011612`; native Chrome
`--force-device-scale-factor=1` produces the exact declared profile without
rounding observations or loosening checks. Failed initial probe directories
remain preserved, and every measured process is independently PID/start-time bound.

Diagnostic populations use three fresh headed browsers, 10 s warmup and 30 s
observation, no tracing, screenshots or forced GC. These are **DIAGNOSTIC**, not
the required final five-process populations. The reporter keeps failed runs,
rejects profile/source drift and ambiguous raw samples, separates actual cuts
from NoOp/Rejected/Deferred, and never equates diagnostics with ART/PERF acceptance.
Actual per-solver-step UserTiming records are opt-in and do not change fixed ticks.
Main-frame callback timing is explicitly only a partial diagnostic: complete
non-render main-thread CPU remains unsupported until all asynchronous work is bound.

`coldReadyMs` now ends after the first completed Ready renderer submission, not
the earlier HUD Ready label; `bootstrapReadyMs` preserves that older boundary.
GPU-fence/presentation latency is not claimed. The boundary regression was red
before the first-frame correction. No physical step/catch-up, source, camera,
detail level, pixel tolerance or resource cap is reduced to achieve a result.

Measured subphases identified avoidable work:

- Meshing now uses scalar face-neighbour coordinates rather than allocating
  coordinate arrays per occupied cell. Far-column sampling caches the same exact
  binary-fraction heights; its additional 921,600 scratch bytes are admitted.
  Three pre-change geometry/material/bounds SHA-256 pins at half-extents 21,
  21.5 and 240 still match, and malformed/oversized grids reject before allocation.
  Focused source/AO/mesh/neighbor tests: 87/87 PASS.
- Startup previously published the complete projection after each of 127 uploads
  despite rendering no Loading frames. A failing-first test observed 127 instead
  of one. Startup now defers only implicit publication until an explicit complete
  projection before Ready; subsequent mutations retain immediate publication.
  The test checks all uploaded representations are present and later updates run.
- Presentation FNV-1a64 now uses two exact uint32 limbs (prime = 2^40 + 435)
  rather than per-byte BigInt multiplication, and avoids per-element scratch
  subviews. Canonical encoding, hash format and validation remain unchanged.
  An independent byte-stream/BigInt oracle passes both before and after the change,
  including long typed arrays, offset views, all supported primitive forms and
  numeric edge values. Seven presentation/backend test files: 42/42 PASS.

Observed diagnostic startup results (all three runs retained, not averaged into
an acceptance decision):

| Population | First Ready submission (ms) | Projection publications |
| --- | --- | --- |
| diagnostic05, before bounded optimizations | 9,323.1 / 10,638.7 / 11,753.7 | 127 per run |
| diagnostic06, scalar/cached meshing | 8,604.0 / 10,255.2 / 10,346.9 | 127 per run |
| diagnostic07, one startup projection | 6,877.0 / 8,956.8 / 8,256.0 | 1 per run, 6.1–10.1 ms |
| diagnostic08, identical 64-bit hash arithmetic | 7,893.6 / 8,805.7 / 9,151.2 | 1 per run |

These populations show device/run variability; they do not establish a universal
speedup. **Every listed cold-start result still exceeds the proposed 5,000 ms
target.** Latest diagnostic plan hash:
`cae9f318147e0e5826db8eea252bad19ed0871037326548908db07d81c465d0e`,
run group `97f39901-0539-4ca4-9938-679e0ffbb7b0`, under
`evidence/hvp14-perf01-diagnostic08/`. Its collector passed, but its performance
report is INELIGIBLE as a diagnostic and cannot be promoted to PERF_ACCEPTED.

Full regression after these shared presentation changes and final PERF-01–08
populations are still pending. Existing all-green HVP-13 functional evidence is
historical, not a claim that these new optimizations have already passed all
regression groups. Owner art/new-user usability remain NOT_RUN. All temporary
measurement browsers and preview servers were closed by the runner.

### Owner F-key usability correction — 2026-09-17

The owner reported that F appeared to do nothing. Read-only inspection of the
existing east-edge session found a real rejected impulse: `Contact is not dynamic`.
The player was near x=6.8, while the example L body was near x=-8.7, well outside
four metres. The session was later paused/Inspection. One real MCP resume click
was refused by Pointer Lock; no repeated capture attempts, fake gameplay, reset
or bypass was used. The unsaved terrain generation/cut was preserved.

The native impulse implementation now shares its real closest-contact query with
an ephemeral target view (movable/fixed/no hit/pause/cooldown/speed limit). Pressing
F always re-queries the current native tick; a previous green indicator never
authorizes an impulse. Range 4 m, impulse 15 Ns, 250 ms cooldown, speed admission,
mass, collision, save format and fixed-step policy are unchanged.

The player view shows a projected native-contact dot, named example target,
mass/range, and German outcome text marked as the last attempt. This handles
third-person parallax without changing the solver ray. Fixed ground/anchored
objects explicitly explain that F only pushes loose bodies; F is not grab/drag.
The debug overview hides while walking and returns through Escape/Inspection.
The added HUD/reticle are owned and removed by session disposal. The start guide
contains an ordinary-spawn L-body example; aiming never teleports a distant player.

Verification: the initial native preview test failed because no target view
existed. After implementation, 23 native mass/occlusion, World save/replacement,
player-presentation and wording tests passed, plus 35 bootstrap/camera/wording
tests. TypeScript and a separate production build passed (266 modules; existing
large-chunk warning). Four real production-browser cases passed: F moved the
35.15625 kg L body, ground rejected the same key, Ego/third-person feedback was
visible; normal capsule/blur ownership, actual save/hot/cold load, and two complete
end/restart disposal cycles also passed. Positive and rejected-contact PNGs were
opened and inspected. No TestBridge or body/camera mutation was used by tests.

To avoid replacing assets underneath the owner's unsaved session, the build is
isolated in the approved temporary directory and the new preview uses port 5174.
The existing port-5173 tab and its World were not reloaded. The test development
server was stopped; the two-hour isolated production preview is left for the
owner. No concurrent performance population was run, no historical capture was
promoted, and no independent review, commit, push or art/performance approval is
claimed. HVP-14's earlier diagnostic failures and remaining workloads remain open.

### Cut latency and fallen-body sphere recut — 2026-09-17

Owner reports multi-second delay from cut click to visible change and asks that
fallen bodies stay cuttable. Measured on an isolated production preview (port
5175, existing HVP-09B support cut): input-to-Applied 4,878 ms before, 2,373 ms
after reusing immutable COW leaf copies for support analysis, 2,108 ms after a
numeric fast path in `Root.readSlot`, 1,667 ms after both. Phase split of the
final run: prepare 1 ms, support analysis 925 ms, sector compile 101 ms, native
prepare/stage 567 ms, commit/finalize/publish 30 ms. No caps, tolerances,
meshing, collision or save semantics changed; immediate Pending feedback was
already present and remains.

Fallen dynamic bodies were already ray-targetable while sleeping; mode 3
(Sphere) previously refused them. The same cell-centred spherical footprint as
terrain now flows through body hit, local plan, typed worker, native stage and
render admission, with mass/cell partition checks. A new sleeping-body unit
test pins footprint, survivors, staging and mass conservation. Browser proof:
support cut, wait sleep, mode 3 recut Applied with removed cells in (0,512].
Existing Box recuts unchanged.

Verification: 8 focused unit files 74/74, TypeScript clean, HVP-09B plus
HVP-10 terrain/timber and HVP-08 branch E2E 4/4 green on the clean rebuild.
Temporary phase/timing observers and profiler harnesses were removed; no new
baseline, commit, push, art or performance acceptance is claimed. Remaining
cost is dominated by support ingest/collision admission; further cuts need
either cached preparation or simplified colliders, explicitly not done here.

## Definition of Done

Each package must meet its listed tests and real runtime outcomes. The overall
task is complete only at the playable salvage/save/physics prototype and its
separately recorded art/hardware decisions, never at a green terrain screenshot.
