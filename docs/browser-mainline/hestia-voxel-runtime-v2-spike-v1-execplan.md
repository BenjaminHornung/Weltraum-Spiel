# ExecPlan: Hestia Voxel Runtime V2 Spike V1

## Goal

Deliver an isolated, executable browser spike at `/?voxelV2=1` that proves a
single deterministic palette-indexed voxel authority can generate, render,
walk, collide, edit, remesh and measure a 64 × 32 × 64 metre Hestia coast and
river-valley scene without reusing the rejected Surface Play runtime.

The spike starts from freshly fetched `origin/main` at
`15f3550bd604856b25d40a7ac700ec4d5106b89e`. It must leave `/` and
`/?surfaceLab=1` unchanged, keep all V2 implementation files under
`apps/weltraum-browser/src/voxel-v2/`, use only the existing `three` dependency
plus browser APIs, and produce reproducible unit, Chromium, screenshot and
performance evidence. The outcome is a measured `GO`, `CONDITIONAL GO` or
`NO-GO`; targets are never waived or replaced by debug-only measurements.

## Context

### Repository and branch

- Repository: `BenjaminHornung/Weltraum-Spiel`
- Worktree:
  `C:\IFI_SourceCode\Temp\Weltraum-Spiel-worktrees\browser-hestia-voxel-runtime-v2-spike-v1`
- Branch: `experiment/browser-hestia-voxel-runtime-v2-spike-v1`
- Base: freshly fetched `origin/main`
- Base SHA: `15f3550bd604856b25d40a7ac700ec4d5106b89e`
- Historical branch
  `feature/browser-hestia-first-person-combat-integration-v1` at
  `6ab40322c38565f204b9e337caf3ea0391efd33e` and open PR #53 are read-only
  research evidence. They are not bases, overlays or implementation sources.

The original checkout is dirty and is not a write target. All implementation,
tests, evidence, commits and publication occur only in the worktree above.

### Governing artifacts

- `AGENTS.md`
- `.agent/PLANS.md`
- `docs/current-mainline-state.md`
- `docs/roadmap/living-master-plan.md`
- `docs/architecture/procedural-voxel-planet-runtime.md`
- `docs/research/voxel-meshing-destruction-asset-audit-v1.md`
- `docs/research/browser-voxel-runtime-reference-audit-v1.md`
- DevToolbox change
  `.devtoolbox/specs/changes/browser-hestia-voxel-runtime-v2-spike-v1/`

`docs/current-prototype-state.md` does not exist on this baseline;
`docs/current-mainline-state.md` is the current source.

### Immutable visual references

The synthesis records Git blob IDs and SHA-256 values for these existing
repository images. They are design inputs, never runtime proof:

- `docs/UI-Screenshots/38-hestia-nebelwald-outpost-konzept.png` — atmosphere
- `docs/UI-Screenshots/36-hestia-archipel-landschaft-konzept.png` — coast,
  water and macro landform
- `docs/UI-Screenshots/30-hestia-biom-atlas-regionen.png` — restrained palette
  breadth

### Current integration seam

`apps/weltraum-browser/src/main.ts` already parses `URLSearchParams`, gates the
TestBridge dynamically and selects the exact `surfaceLab=1` route before the
normal runtime. V2 adds one exact query predicate and one dynamic import. When
both `voxelV2=1` and `surfaceLab=1` are present, V2 intentionally has explicit
precedence; Surface Lab behavior is unchanged whenever V2 is absent.

The existing `#debug-scene` canvas may be reused. V2 owns query-gated DOM and
CSS through `data-runtime-mode="voxel-v2"`; it does not replace static HTML or
expose `window.TestBridge`. Read-only DOM diagnostics are allowed.

### Baseline evidence

Before V2 edits:

- `npm ci`: PASS, 59 packages; one existing moderate npm advisory.
- `npm run build`: PASS, with the existing large-chunk warning.
- `npm run test`: PASS, 136 files and 1,333 tests.
- Default host Node is unsupported v26.2.0. One core E2E asserted Node 22 and
  failed for that reason after 39 passing tests.
- Portable `npx --yes node@22` supplies Node v22.23.2 without repository or
  lockfile mutation. The failed spec then passed 1/1.
- Node-22 live E2E baseline: PASS 14/14.
- Node-22 UI E2E baseline: PASS 12/12.

Final browser verification therefore uses Node 22 explicitly. The Node-26
baseline failure remains documented rather than hidden or modified.

## Non-goals

- No imports from `src/surface-play/**`, `src/surface-lab/**`,
  `src/voxel/adaptive/**` or `src/voxel/structural/**`.
- No Surface Nets, Marching Cubes, Dual Contouring, SDF or existing WorkerPool.
- No merge, cherry-pick, overlay or mutation of historical branches or PR #53.
- No second authority, render-mesh truth, object per voxel or full-world remesh
  after a local edit.
- No package or lockfile changes, new dependencies, Unity/`Assets/**` changes,
  WebGPU, physics dependency, global streaming/LOD framework, structural
  connectivity, detached-body simulation, fluid simulation, multiplayer or
  save migration.
- No dynamic tree/building collapse. Edited trees may float in this spike.
- No GPL source or assets copied or adapted from re-flora. Its repository
  license and asset caveat are documentation evidence only.
- No implementation of far proxies or object-local raymarching. Only clean
  adapter boundaries are documented for later changes.

## Architecture decision

### Ownership and dimensions

`VoxelAuthority` is the sole mutable world owner. The bounded world is
256 × 128 × 256 cells at 0.25 metres per cell (64 × 32 × 64 metres), centred
around global X/Z zero with Y starting at zero. Chunks are 32³ cells (8 metres
per edge), addressed by signed chunk coordinates and stable `x,y,z` keys.

Candidate generation covers 8 × 4 × 8 chunks. Workers generate copied
`Uint8Array` products; the main-thread authority adopts only non-empty chunks.
Authority records contain chunk key and coordinate, source revision, authority
revision, private cells, last dirty local AABB and a deterministic content
signature. No API returns a mutable authority-owned typed array. Derived work
receives copied snapshots and the requested revision.

The one raw-byte FNV-1a-64 function belongs at the V2 authority/content
boundary because the existing generic hash helper serializes strings/JSON and
is not a safe or efficient contract for 32 KiB voxel buffers. It is not a
value normalizer and is used once for authoritative cell signatures.

### Palette and generation

Palette material zero is Air. Stable records cover grass/moss, soil, light
rock, wet/dark rock, sand, wet shoreline boundary, wood, leaves and three
flora accents. Every record owns ID, name, base colour, roughness, emissive,
physical class and destructibility.

Generation is a pure, deterministic composition of explicit macro functions:
coast/lagoon mask, connected river channel, broad valley, terraces, stepped
cliffs, height-dependent strata, clearings, dry spawn, fixed tree templates
and sparse flora accents. Seed/version affect stable integer hashing used for
placement variation, not camera position, load order or runtime timing. There
is no generic noise framework.

Water is static world-logical presentation at a fixed sea level. It is not an
authority material and cannot create uphill water or occupy the dry spawn.

### Derived mesh contract

Initial generation completes before initial meshing so every chunk halo is
authoritative. A mesh request receives one copied 34³ one-cell-halo snapshot,
chunk key and requested authority revision.

The domain mesher emits only exposed axis-aligned faces. It greedily merges
coplanar cells only when material and corner-AO signature match. Material
boundaries remain distinct, normals are flat axes, indices and vertex order
are deterministic, and neighbour faces disappear identically at chunk seams.
Products contain typed positions, normals, indices, per-vertex material IDs,
AO values and deterministic material ranges. Identical inputs must produce
byte-identical buffers.

The Three adapter converts palette IDs and AO to vertex colours and uses one
opaque draw material per chunk, preserving material ownership in the neutral
mesh product without multiplying draw calls by palette size. Static water is
a separate transparent Three material/pass. No domain module imports `three`;
only `render-three/**` may do so.

### Worker scheduling

One V2-owned module worker is the bounded worker pool for this spike. The
scheduler owns a bounded/coalescing queue keyed by operation and chunk. Every
request carries chunk key and requested revision. A newer queued request
replaces an older queued request; an in-flight old result is rejected at
adoption. Generation and mesh buffers use transferables. Queue wait,
generation, meshing, transfer bytes, coalesced jobs, stale results and pending
depth are exposed as read-only telemetry. `dispose()` rejects new work,
terminates the worker and clears pending promises.

Local edits enqueue only directly changed chunks and face-neighbours whose
shared boundary intersects the dirty AABB. No local edit may enqueue every
resident chunk.

### Player, collision and cutter

The first-person controller owns pointer lock, WASD, sprint, jump, mouselook
and a visible reticle. Simulation uses a 60 Hz fixed step. Each animation frame
processes a bounded number of steps but retains all unprocessed accumulator
time and reports backlog; it never silently deletes time. The player uses an
authority-backed AABB with bounded substeps and a maximum 0.5-metre step.
Velocity is zeroed only on a proven blocking contact or stable ground rest.
Collision never reads Three meshes and never pauses while remeshing.

The cutter performs authority DDA from the current camera. Hit feedback is
published immediately. `SubtractSphere` is quantized to voxel centres with an
explicit edit ID, monotonic sequence and compare-and-swap expected world
revision. Duplicate IDs and sequences, stale revisions, misses and out-of-range
requests fail closed. Accepted edits update cell bytes and signatures,
increment authority/chunk revision, return exact dirty local AABBs and affected
chunks, then schedule asynchronous local remesh. Renderer adoption checks the
current authority revision again before replacing a chunk mesh.

### Diagnostics and evidence

V2 publishes only read-only DOM text/datasets: readiness, player pose and
movement, authority/world revision, visible mesh revision, accepted/rejected
edits, hit feedback, queue/stale/coalesced counters, resident/visible chunks,
triangles, vertices, draw calls, frame distribution and latency samples. It
does not publish mutation functions or a test bridge.

Presentation-only query camera fixtures may provide deterministic coast and
river beauty views. They do not mutate the authority. Interaction and cut
evidence must use visible real controls/events in first-person mode.

## Implementation phases

### Phase 1 — Spec, research and boundary lock

Files:

- `docs/browser-mainline/hestia-voxel-runtime-v2-spike-v1-execplan.md`
- `docs/research/hestia-voxel-runtime-v2-reference-synthesis.md`
- `docs/architecture/hestia-voxel-runtime-v2-boundary.md`
- `.devtoolbox/specs/changes/browser-hestia-voxel-runtime-v2-spike-v1/**`

Actions:

1. Create proposal, design, behavioural delta, tasks, test protocol and initial
   findings.
2. Tag every research statement as Source claim, Code evidence, Local
   benchmark evidence, Inference or Unavailable. Keep all Reddit bodies,
   including the blob source, Unavailable unless genuinely fetched.
3. Record concept image Git blobs and SHA-256 values.
4. Validate the change and create exactly one DevToolbox execution for the
   complete assignment.

Verification: DevToolbox status/artifact/task load and `specs_validate` PASS.

### Phase 2 — Pure authority and world composition

Planned files under `apps/weltraum-browser/src/voxel-v2/`:

- `domain/constants.ts`
- `domain/coordinates.ts`
- `domain/palette.ts`
- `domain/contentSignature.ts`
- `domain/types.ts`
- `domain/generator.ts`
- `domain/authority.ts`
- `domain/dda.ts`
- `domain/collision.ts`
- focused `*.test.ts` files beside or under the V2 tree

Actions:

1. Implement signed global/chunk/local mapping and immutable palette records.
2. Implement deterministic analytic world generation and stable tree/flora
   templates.
3. Implement sparse authoritative chunk adoption and copy-only snapshots.
4. Implement ordered/CAS `SubtractSphere`, dirty bounds and boundary-neighbour
   invalidation.
5. Implement DDA and render-independent collision queries.

Verification: focused Vitest for negative coordinates, local/global mapping,
palette, seed/hash determinism and difference, edit ordering/duplicates,
sphere boundaries, affected chunks, DDA hit/miss and collision without mesh.

### Phase 3 — Greedy mesher and worker scheduler

Planned files:

- `domain/mesher.ts`
- `worker/protocol.ts`
- `worker/voxelV2.worker.ts`
- `worker/scheduler.ts`
- focused mesher/scheduler tests

Actions:

1. Implement deterministic material/AO-aware greedy face merging over halo
   snapshots.
2. Implement worker generation and meshing operations with transferable
   buffers.
3. Implement one-worker bounded latest-revision scheduler, coalescing,
   stale-result rejection, disposal and immutable telemetry snapshots.

Verification: no internal faces, material-aware merge, halo seam elimination,
byte-identical buffers, newest-job coalescing, stale result rejection,
transfer-byte accounting and disposal tests.

### Phase 4 — Runtime, Three projection and route

Planned files:

- `runtime/playerController.ts`
- `runtime/ports.ts`
- `runtime/voxelV2Runtime.ts`
- `render-three/voxelV2Renderer.ts`
- `demo/voxelV2.css`
- `demo/startVoxelV2.ts`
- `query.ts`
- minimal edit to `apps/weltraum-browser/src/main.ts`

Actions:

1. Add exact query routing with V2 precedence only when `voxelV2=1`.
2. Generate/adopt all candidate chunks through the worker, then mesh from
   copied halos.
3. Render chunk BufferGeometry with palette/AO vertex colours, one transparent
   water pass, sky/fog/lights and presentation-only vista cameras.
4. Wire fixed-step movement, authority collision, pointer lock and cutter.
5. Publish clean, read-only diagnostics and precise timing telemetry.
6. Dispose listeners, observer, animation frame, geometries/materials,
   scheduler and worker on unload/failure.

Verification: focused unit tests, TypeScript/build, normal route and Surface Lab
smoke checks, V2 Ready smoke in Chromium, no browser errors or TestBridge.

### Phase 5 — E2E, visual and performance evidence

Files:

- `apps/weltraum-browser/tests/e2e/hestia-voxel-runtime-v2-spike.spec.ts`
- one exact E2E group token in `apps/weltraum-browser/package.json`
- `apps/weltraum-browser/evidence/hestia-voxel-runtime-v2-spike/**`
- DevToolbox test protocol/findings evidence references

Actions:

1. Use visible Chromium controls/events to prove Ready, movement, pointer-lock
   fire feedback, one accepted edit, authority revision advance, current-only
   mesh adoption and collision following occupancy.
2. Perform 100 consecutive local cuts without a mutating TestBridge. Assert
   liveness, bounded pending work and eventual mesh/authority convergence.
3. Capture fixed 1920×1080 PNGs for coast/lagoon, inland river/valley,
   first-person spawn, before terrain cut and after terrain cut. Beauty images
   have no debug HUD.
4. Run a production Vite build and bounded `vite preview` under managed process
   lifecycle. Measure after warm-up in real Chrome/Chromium at 1920×1080.
5. Write parseable JSON evidence including machine/browser/build metadata,
   frame and Long Task distributions, pipeline latencies, work/geometry counts
   and final threshold decision.

Verification: focused E2E twice without retry, production benchmark, evidence
JSON parse, screenshot dimensions and visual matrix review.

### Phase 6 — Review, reconciliation and publication

Actions:

1. Run one independent correctness/regression reviewer; fix confirmed P0/P1
   and proportionate P2 findings.
2. Run fresh focused and full verification, including all core/live/ui groups
   under Node 22.
3. Run DevToolbox verification and completion preflight before each task
   toggle; record final result in the single execution.
4. Run the final human Plannotator repository review once after all technical
   fixes and fresh verification.
5. On clean full PASS and `GO`, create small validated commits, push the
   experiment branch and open a normal unmerged PR. If functional but targets
   fail, publish only a clearly marked draft/failed-spike PR. Never merge.

## Tests and evidence

### Focused unit gates

The V2 suite must explicitly cover:

- negative chunk mapping and global/local round-trip;
- palette stability and Air zero;
- same seed/hash equality and different seed/hash inequality;
- edit sequence, duplicate ID/sequence and stale revision rejection;
- quantized `SubtractSphere` boundaries, dirty AABB and affected neighbours;
- no internal faces, material-aware greedy merge and halo seams;
- byte-identical mesh products;
- scheduler stale-result rejection and newest-request coalescing;
- DDA hit, miss and range limit;
- collision using authority while renderer state is absent/stale;
- recursive static forbidden-import guard for all V2 source.

### Browser gates

The new E2E spec is assigned to exactly one existing group and uses no retries.
It proves:

- V2 Ready and no page/console/browser errors;
- `/` and `/?surfaceLab=1` remain their existing runtimes;
- no `window.TestBridge` on V2;
- authoritative player movement via real keyboard/mouse events;
- immediate real-fire hit feedback;
- exactly one accepted edit in the focused cut scenario;
- authority revision advance and current-revision mesh convergence;
- no stale mesh replacement;
- collision changes from authority occupancy, not render mesh timing;
- 100-cut liveness with bounded queue and no permanent pause;
- all five required screenshots.

### Performance thresholds

After warm-up in a production build at 1920×1080:

- frame-time p95 ≤ 16.7 ms;
- no warm local-cut Long Task ≥ 50 ms;
- input-to-hit feedback ≤ one displayed frame;
- input-to-authority command ≤ 16 ms;
- local-cut input-to-current-visible-mesh p95 ≤ 100 ms;
- no full-world remesh after local edits;
- 100 consecutive cuts without freeze, crash, permanent pause or unbounded
  queue.

Evidence records current/p50/p95/max frame time; Long Tasks; authority edit,
queue wait, generation, meshing, transfer, upload/adoption, input-to-hit,
input-to-authority and input-to-visible samples; resident/visible chunks,
vertices, triangles, draw calls, pending, coalesced and stale counters.

### Final command matrix

Run from `apps/weltraum-browser` unless stated otherwise:

```text
npm ci
npm run build
npm run test
npx --yes node@22 node_modules/@playwright/test/cli.js test <focused-v2-spec> --retries=0
npx --yes node@22 node_modules/@playwright/test/cli.js test <focused-v2-spec> --retries=0
npm run test:e2e:core (through Node 22 Playwright CLI equivalent)
npm run test:e2e:live (through Node 22 Playwright CLI equivalent)
npm run test:e2e:ui (through Node 22 Playwright CLI equivalent)
production preview benchmark and 100-cut stress run
git diff --check
JSON parse and screenshot dimension checks
forbidden-import scan
package-lock/Assets/TestBridge/diff guards
```

Do not change tests or scripts to conceal the Node-26 baseline mismatch.

## Risks

- A 64 × 32 × 64 metre authority contains 8.4 million candidate cells. Sparse
  adoption and one-worker generation are required to avoid main-thread stalls.
- Initial 34³ halo copies are bounded but can create transient memory pressure.
  Queue depth and transferred bytes must be measured.
- Greedy AO compatibility can reduce merge efficiency. If p95 fails, report
  the real geometry/work trade-off rather than dropping AO silently.
- Renderer upload and vertex-colour creation remain main-thread work and may
  dominate local-cut latency even when worker meshing is fast.
- Headless pointer-lock behavior can differ from interactive Chrome. Evidence
  must use a real Chromium browser path and report any unavailable assertion.
- Large transparent water plus fog can obscure shoreline errors. Beauty review
  must compare authority-derived coast topology, not only colour.
- A fast worker may coalesce rather than produce stale output in E2E. Unit
  tests prove the stale branch; E2E must at minimum prove no stale adoption and
  final mesh/authority convergence under rapid edits.
- Existing bundle-size warning and npm advisory are baseline conditions, not
  V2 regressions unless they worsen.

## Rollback / safe stop

Stop implementation and report the blocker rather than broadening scope if any
of these occurs:

- a prohibited import or old Surface Nets/WorkerPool dependency is required;
- rendering or collision would become world authority;
- a second authority or alternate edit journal is introduced;
- local edits require full-world remesh;
- package/lockfile, Unity assets or GPL-derived source/assets would change;
- normal `/` or Surface Lab behavior regresses;
- performance evidence is debug-only or cannot measure the binding targets;
- an unresolved P0/P1 authority, ordering, seam, liveness or main-thread issue
  remains;
- product contract, acceptance threshold or prohibited scope must change.

All V2 source is isolated and query-gated, so a safe code rollback consists of
reverting the minimal `main.ts` route edit, package E2E token and newly added V2
source/tests/docs/evidence. Do not delete the worktree or branch without
explicit authorization.

## Progress log

- [x] Fresh remote and historical refs verified; base pinned to
  `15f3550bd604856b25d40a7ac700ec4d5106b89e`.
- [x] Dedicated clean experiment worktree created from `origin/main`.
- [x] Current architecture, route, dependency, test and historical evidence
  inspected read-only.
- [x] Baseline install/build/unit/live/UI evidence recorded; Node-26 core
  mismatch isolated and reproduced successfully under Node 22.
- [x] Phase 1 — Spec, research and boundary lock. DevToolbox validation passed.
  Initial execution `e0db265e132744dc98fa6b4c82db4e02` became technically
  unusable after a synchronous verification timeout corrupted its history.
  Recovery execution `0c78a1dfa78a40ba9cac3e7f55461602` is the sole execution
  used from that point onward; no further execution may be created.
- [x] Phase 2 — Pure authority and world composition. Focused authority,
  generation, edit, DDA and collision verification passed 19/19 tests and
  TypeScript passed before Tasks 2.1 and 2.2 completion preflight/toggle.
- [x] Phase 3 — Greedy mesher and worker scheduler. Focused mesher and
  scheduler tests pass 10/10 after independent review fixes; Tasks 3.1 and
  3.2 were completed through recovery-execution preflight/toggle.
- [x] Phase 4 — Runtime, Three projection and route. V2 is executable at the
  exact query gate; normal and Surface Lab route smoke passed; Three is isolated
  to `render-three/**` and the worker is a separate production asset.
- [x] Phase 5 — E2E, visual and performance evidence. Two no-retry dev runs and
  a production-preview run passed execution; five 1920×1080 PNGs and parseable
  telemetry exist. The binding production frame p95 measured 16.8 ms against
  the ≤16.7 ms target, so the threshold decision is NO-GO rather than waived.
- [ ] Phase 6 — Review, reconciliation and publication.

Meaningful implementation deviations, blockers and new evidence are appended
here before dependent work continues. Material changes to goal, public behavior,
schema, deployment, side effects or acceptance criteria require user
reconfirmation and plan resubmission.

### Recorded deviations and residuals

- The original DevToolbox execution became unusable after a synchronous
  verification timeout corrupted its history. The one permitted recovery
  execution `0c78a1dfa78a40ba9cac3e7f55461602` owns all remaining tasks; no
  further execution was created.
- Production telemetry uses the real Chrome rAF interval for frame time rather
  than worker-only duration. This measured a strict p95 of 16.8 ms, a real
  acceptance failure. Initialization recorded one separate 557 ms Long Task;
  the warm local-cut Long Task delta was zero.
- The 100-input stress completed with accepted/rejected outcomes (latest run:
  96 accepted, 4 rejected after the focused edit), with Ready state, empty
  queue and visible/authority convergence. Misses remain fail-closed negative
  cases rather than synthetic edits.

## Definition of Done

- The V2 authority, generation, meshing, scheduler, renderer, player, collision
  and cutter satisfy the behavioural contracts above under the exact query
  gate without prohibited imports or a second truth owner.
- `/` and `/?surfaceLab=1` pass unchanged smoke and full grouped verification.
- Focused unit and V2 E2E pass twice without retry; full unit/build/core/live/UI
  checks are fresh under the supported Node version.
- Five 1920×1080 screenshots and parseable production telemetry exist at stable
  repository evidence paths and are cited in test findings.
- Every threshold has measured PASS/FAIL/UNAVAILABLE evidence; the final
  `GO`/`CONDITIONAL GO`/`NO-GO` follows those measurements honestly.
- Technical review has no unresolved P0/P1, DevToolbox tasks close only after
  fresh evidence/preflight, and final Plannotator review is clean.
- Only after those gates: validated commits are pushed and an unmerged normal
  PR is opened for `GO`; a clearly marked draft/failed-spike PR is the maximum
  publication for a functional but rejected result.
- The final report includes fresh main SHA, worktree/branch, change/execution
  IDs, commits, files by area, architecture/import whitelist, evidence paths,
  exact environment/browser/build/resolution metrics, test matrix, P0/P1/P2,
  decision, PR link and the next three independent changes:
  A) streaming plus three real representation levels/far proxies;
  B) asynchronous structural connectivity plus one detached object and physics
  adapter benchmark; and C) coast/lush art, vegetation and water refinement.
