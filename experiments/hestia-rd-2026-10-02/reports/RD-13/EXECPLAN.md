# ExecPlan: RD13 bounded voxel rays, CPU phase

## Goal
Deliver a real, locally committed `createVoxelRayExperiment` and standalone entry:
dense WebGL2 GLSL3 rays and genuine greedy meshes of the same selected occupancy.
CPU source/admission/oracle/lifecycle tests and optimized entry compilation must pass.
Native rendering, art, performance and product integration are not accepted here.

## Context
START `d17d970403440ccbf02d378998f69a92c87d8f09`, tree
`b9ea6706b3435b659e018f96d99d80ceffc89fe1`; product read base
`b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
Binding brief: HEAD/SO02-RD13-REFINEMENT-5e4c1b8f.md, SHA256
`97fac44b60d07560fbad013f533c114314766391ed15684583aa1111c8e871e7`.
Read RD13, program 01, sources 02, contracts 03, measurement 04, SO02, root
AGENTS/README/current-mainline/PLANS. The later CPU launch is authoritative.
Reuse immutable fixture imports, `ownerPose`, `createThreeLabHost`,
`projectFloat32`, bounded assets/scenario runner, and pure `meshHvpOccupancy`.

## Non-goals
No delegation, DevToolbox creation, server, browser, port probe, GPU execution,
benchmark, native attestation, product edit, shared-contract/root/package edit,
dependency addition, publication or worktree deletion. ProductIntegrated=false.
RR03/04/05 cached media/author/licence gaps remain gaps; no imported demo code.

## Architecture decision
Only lab `src/experiments/voxel-rays`, `tests/RD-13`, `reports/RD-13` are writable.
Private recipe binding preserves X-fast original slots, coverage and owner/source
identities. Initial limit is 64 cells per axis, with one frozen F01 window, no
dynamic crop. Outside remains Unknown. Both projections are explicitly no-AO.
One borrowed Three host; ray solids are fullscreen triangles, not proxy boxes.
Hit-space shading/depth uses actual camera/light inputs. Original non-voxel
water/marker payloads remain presentation. No duplicate original solid meshes.
Local replacement retires owned roots immediately; failure is terminal and
retains its first cause. Explicit remount is the only recovery.

## Implementation phases
1. Bind source/freeze/dependencies; declare F01 selection and ray rules. Add
   meaningful RAY01-04 negatives and run/seal RED before implementation.
2. Implement private volume admission, independent analytical exposed-face
   oracle, actual greedy adapter, production DDA shader and fail-closed wrapper.
3. Implement usable controls/replay and authored native qualification tests;
   compile them but do not execute native code.
4. Run unchanged-test GREEN, fresh focused/root types and standalone Vite build;
   self-review, boundary/source guards, scoped local commit and postcommit guards.

## Tests and evidence
Own external run root:
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/phase1-d17d9704-20261004-a/`.
Commands use explicit pinned C-only Node/Git/tsc paths, own TEMP/cache and C-only
PATH. `npm ci --ignore-scripts --no-audit --no-fund` only, unchanged lock.
Vitest config and entry-build config reside in owned reports; outputs external.
Retain every command/log/exit/hash, identical RED/GREEN oracle test bytes,
fixture/profile/selection/source bindings, 52 boundary source pins, 986 baseline
raw-file checks, 18 shared pins, 429 public files, final parent/SHA/tree/paths.
Browser RAY01-04, actual attachment depth/water, normal/debug entry, native
shader execution/upload/shader link and visual captures: NOT RUN in Phase1.

## Risks
Shader authorship is not native correctness. F01 is selected terrain plus original
water, not full parity (vegetation/face AO omitted). Unknown is not clearance.
Inside geometric exits do not change source sidedness. Format/caps preflight is
distinct from terminal driver failures after allocation. GPU timing/VRAM unknown.

## Rollback / safe stop
Stop for a material unresolved contract or an unauthorized side effect; ordinary
CPU implementation continues. Keep failures and raw evidence. No destructive
cleanup. HEAD can reject the local candidate without changing product state.

## Progress log
- [x] Read mandatory context and actual reusable APIs.
- [x] Source/dependency bindings, selection and meaningful RED sealed.
- [x] Actual ray/greedy prototype, entry and native-test authorship implemented.
- [x] Identical sealed unit test bytes GREEN; 23/23 focused CPU tests passed.
- [x] Focused/root types and optimized standalone entry compiled; own source
      review corrected terminal link failures, non-finite comparison results and
      same-source replay visibility. Failed attempts remain in the run directory.
- Local commit and postcommit closure are recorded in external, write-once
  `postcommit-audit.json` and `commands/scope-postcommit.*`, not self-referenced
  inside this commit. See `PHASE1.md` for the verified CPU handoff and native gaps.

## Verification findings
The final RED rerun and GREEN use exactly the same 13,781-byte unit file,
SHA256 `6e639a6b8129150aff6dc8447e0a55a3bd5e44d8c880de944710cd800c00ad6a`.
RED: 12 tests, 11 meaningful failures, one passing canonical Float64 check.
GREEN: those 12 plus 11 CPU factory/pipeline checks, all passing.
The final standalone build compiles the real HTML entry and 26 modules; its
598.93 kB main chunk triggers the unchanged 500 kB warning. This is not a native
shader compile, a performance qualification or root-registration evidence.

## Definition of Done
Actual factory/GLSL/greedy/entry, meaningful passing unchanged focused tests,
compiled root types and optimized standalone entry, truthful NOT RUN native
gates, retained error receipts, local commit directly parented by START,
unchanged out-of-scope bytes, explicit HEAD wiring handoff. No all-program claim.
