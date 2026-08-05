# Test Protocol: Hestia Voxel Runtime V2 Spike V1

## Preconditions

- Worktree:
  `C:\IFI_SourceCode\Temp\Weltraum-Spiel-worktrees\browser-hestia-voxel-runtime-v2-spike-v1`
- Branch: `experiment/browser-hestia-voxel-runtime-v2-spike-v1`
- Fresh base: `origin/main` at
  `15f3550bd604856b25d40a7ac700ec4d5106b89e`
- Browser package: `apps/weltraum-browser`
- Supported E2E runtime: Node 22; portable local proof uses
  `npx --yes node@22` and records the resolved version.
- Chromium/Chrome viewport: 1920 × 1080, device scale factor 1.
- Production metrics are collected from built `dist` through a bounded managed
  preview process, after Ready and a documented warm-up.
- No dependency, package-lock, Unity/`Assets/**`, TestBridge or prohibited
  historical import changes.

## Unit Matrix

1. Negative global coordinates map by floor division to stable signed chunks;
   global/local conversion round-trips at -33, -32, -1, 0, 31, 32 and 33.
2. Chunk keys/coordinates are stable and malformed keys fail closed.
3. Palette material zero is Air; all required records have stable unique IDs,
   complete presentation/physical/destructibility metadata and are immutable.
4. Same seed/version/chunk produces byte-identical cells and signatures; a
   changed seed changes at least one valid chunk without changing dimensions.
5. Authority adopts sparse chunks, never exposes mutable owned arrays, and
   copied halo/snapshot mutation cannot alter authority cells/signatures.
6. Edit ID and sequence ordering reject duplicates; compare-and-swap rejects a
   stale expected world revision without mutation.
7. Quantized `SubtractSphere` handles cell-centre/boundary inclusion, empty
   no-change, indestructible material and world-edge clipping.
8. Accepted edits return exact dirty local AABB and only changed chunks plus
   touched face-neighbours.
9. DDA reports first occupied hit with normal/distance, misses empty space and
   rejects out-of-range rays.
10. Collision resolves against authority when no render mesh exists and when a
    deliberately stale renderer revision is supplied to the test harness.
11. Mesher emits no face between equal occupied neighbours and correct faces at
    air boundaries with flat axis normals.
12. Coplanar equal material/AO faces greedily merge; different materials or AO
    signatures do not merge.
13. Two adjacent chunk halo snapshots emit no duplicate/internal seam face.
14. Identical snapshot/revision produces byte-identical position, normal,
    index, material, AO and material-range output.
15. Scheduler keeps one bounded worker, replaces older queued chunk revisions,
    rejects stale in-flight terminals, transfers buffers, accounts bytes and
    terminates cleanly on dispose.
16. Recursive static scan rejects prohibited Surface/Voxel/WorkerPool imports,
    Surface Nets family names, `three` outside `render-three/**` and V2
    TestBridge mutation.

## Focused Browser Matrix

The new spec is
`tests/e2e/hestia-voxel-runtime-v2-spike.spec.ts`, appears as an explicit token
in exactly one existing `package.json` E2E group and runs with `--retries=0`.

1. Load `/` and `/?surfaceLab=1`; assert established runtime markers and no V2
   mode/authority/worker side effects.
2. Load `/?voxelV2=1`; collect `console`, `pageerror`, `requestfailed` and HTTP
   status ≥400 events; require none.
3. Assert no own/inherited `window.TestBridge` and no V2 mutation function on
   `window` or read-only diagnostics elements.
4. Wait for visible Ready with bounded resident/visible chunks and current
   authority/mesh revisions.
5. Click the canvas for real pointer lock, use real WASD/sprint/jump/mouse events
   and assert authority-backed player pose/movement changes.
6. Fire using a real pointer event. Require hit feedback no later than the next
   displayed frame, exactly one focused accepted edit, one authority revision
   advance and a local affected-chunk count.
7. Rapidly supersede local mesh work. Assert no adopted mesh revision exceeds
   or trails the settled authority revision and any stale terminal cannot
   replace current geometry.
8. Remove occupancy affecting a movement/contact path and prove collision
   follows authority before or independently of replacement mesh adoption.
9. Complete 100 consecutive local cut inputs without reload, freeze, crash,
    permanent movement pause or unbounded queue. Accepted/rejected outcomes are
    recorded; the production run must keep authority and visible mesh converged
    after the stress window.
10. Re-check all browser/network error collections after stress.

Read-only DOM diagnostics may be sampled. Tests shall not call a TestBridge,
evaluate imported V2 mutation modules, invoke an authority method or dispatch a
synthetic command directly.

## Fixed Visual Matrix

Capture exact 1920 × 1080 PNGs under
`apps/weltraum-browser/evidence/hestia-voxel-runtime-v2-spike/`:

1. `01-coast-lagoon-vista.png`
2. `02-inland-river-valley-vista.png`
3. `03-first-person-spawn-interaction.png`
4. `04-before-terrain-cut.png`
5. `05-after-terrain-cut.png`

Beauty captures hide debug telemetry. Review each image for:

- visibly sub-Minecraft 0.25 m block scale rather than 1 m cubes;
- coherent lagoon/coast/river connection with no uphill water;
- foreground/midground/background macro depth;
- readable terraces, block cliffs and strata;
- deliberately spaced voxel trees and restrained flora accents;
- bright blue sky, turquoise water, greens and light/wet rock distinction;
- flat block construction with no smoothing/Surface Nets look;
- no chunk holes, duplicate seam faces, debug diorama composition, dominant
  technical overlays or spawn-water intersection;
- visible changed terrain between before/after captures produced by real fire.

Record screenshot SHA-256 and decoded dimensions in evidence JSON.

## Production Performance Protocol

1. Run a clean production build.
2. Start `vite preview` as a bounded managed process on an isolated port and
   wait for HTTP readiness.
3. Launch installed Chrome/Chromium at 1920 × 1080/DPR1 with V2 query.
4. Wait for Ready, all initial mesh work settled and at least 300 warm frame
   samples. Reset only telemetry sample windows through internal lifecycle code,
   never authority state; do not use a browser test mutation API.
5. Record current/p50/p95/max frame time and Long Tasks ≥50 ms.
6. Perform the focused cut and the 100-cut real-input stress while recording:
   authority edit, queue wait, generation, meshing, transfer bytes,
   upload/adoption, input-to-hit, input-to-authority and input-to-current-visible
   mesh.
7. Record resident/visible chunks, vertices, triangles, draw calls,
   pending/running/coalesced/stale and per-edit affected/remeshed chunk maxima.
8. Assert no full-world remesh: each local edit remeshes only changed chunks and
   necessary touched face-neighbours.
9. Stop browser/preview and report cleanup.

Preliminary `PASS` requires all:

- frame-time p95 ≤ 16.7 ms;
- no warm local-cut Long Task ≥50 ms;
- input-to-hit feedback ≤ one displayed frame;
- input-to-authority ≤16 ms;
- input-to-current-visible mesh p95 ≤100 ms;
- no full-world remesh after a local cut;
- 100 consecutive local cuts complete without freeze, crash, permanent pause
  or unbounded queue.

Any failed or unmeasurable item is reported exactly and lowers the decision to
`CONDITIONAL GO` or `NO-GO`; it is not replaced by a unit/debug/dev-server
number.

## Evidence Files

- `apps/weltraum-browser/evidence/hestia-voxel-runtime-v2-spike/production-telemetry.json`
- the five files in `.../screenshots/`
- this change's `tests/testfindings.md`

JSON shall include base/final SHA, dirty diff signature, branch, OS/CPU/logical
cores/memory, Node/npm, browser name/version/executable, Three/Vite/Playwright
versions, production build mode, viewport/DPR, warm-up/sample counts, every raw
sample or bounded distribution required to reproduce percentiles, threshold
results and final decision.

## Full Verification

Run from `apps/weltraum-browser` unless stated:

```text
npm ci
npm run build
npm run test
npm run test:e2e:core          # invoked with Node 22
npm run test:e2e:live          # invoked with Node 22
npm run test:e2e:ui            # invoked with Node 22
focused V2 unit selection
focused V2 E2E --retries=0     # twice, Node 22
production preview performance and 100-cut stress
git diff --check
parse summary/performance JSON
decode all five PNG dimensions
recursive forbidden-import scan
package-lock/Assets/TestBridge guards
```

The baseline Node-26 core failure (`trajectory-predictor-core.spec.ts` requires
Node major 22) is reproduced and recorded; final supported verification uses
Node v22.23.2 without changing that test.

## Completion Rule

Fresh evidence is required before each DevToolbox task toggle. One independent
technical review follows meaningful implementation. The final Plannotator gate
runs only after all fixes and fresh verification. `GO` permits a normal unmerged
PR; a functional but rejected spike may only use a clearly marked draft/failed
PR. No merge or deployment is performed.
