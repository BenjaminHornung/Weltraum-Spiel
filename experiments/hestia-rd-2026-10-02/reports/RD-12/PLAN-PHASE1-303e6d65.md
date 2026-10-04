# RD12 actual Babylon fixture adapter — Phase1

## Goal and context
Implement an executable `createBabylonExperiment` and standalone fixture replay
entry, not a placeholder. START `303e6d651482338cc876696792acdd344603232e`, tree
`7e051ab7576653c57ad362d2aa9ab7a872522126`. Product read base
`b3c6523a94cd050f5a9a22dc27f4777fcc03363e`; `productIntegrated: false` throughout.
HEAD owns later C3/C4 registration and root Vite wiring. Same leaf then performs
optimized native Phase2 against HEAD's new freeze and explicit lease.

## Constraints and non-goals
Only `src/experiments/babylon`, `tests/RD-12`, `reports/RD-12` are writable.
No agents, DevToolbox, servers, ports, browser, GPU lease, package/lock edits,
world/simulation/input/save implementation or changes to historical evidence.
The two automatic untracked throughput logs are an untouched narrow exception:
the original all-files gate remains `FAIL_ACCEPTED_NARROW_EXCEPTION`.
Use installed Babylon 9.29.0 public wrappers and version-scoped device monitoring.

## Architecture
One engine, RH scene, camera and engine loop. Frozen F01/F04/F06 manifests and
copied payloads are authority. Project to Float32 with 1e-5 tolerance; expand
linear RGB to RGBA once at upload with vertex alpha 1 and material opacity.
Disable autojoined candidates until compilation/readiness succeeds, then
synchronously adopt an entire generation. Rejection preserves the old generation.
Bound initialization/compilation/readiness by deadline and abort. First native
loss/error is terminal, no restoration or fallback. Publish only an identity
captured at `Scene.render` plus `endFrame`, not initialization or rAF counting.
Stock StandardMaterial is an approximation, not Lambert/BRDF/shadow/art parity.

## Ordered work and verification
1. Preserve complete START/raw/API/freeze manifests; install exact lock with
   `npm ci --ignore-scripts` using C-only binaries, cache and temporary directories.
2. Write fixed BAB01–04 tests and separate visual oracle v1; run owning behavioral
   RED before runtime implementation. Preserve original oracle bytes/hashes.
3. Implement projection, sequential private adoption, terminal lifecycle and
   visible native controls. Validate typed ticks before mutation; normal page
   has no TestBridge. Test-only bridge is explicitly gated by `?testBridge=1`.
4. Run ONLY RD12 tests, root types, focused public surface/spec types and an
   optimized build whose input is the actual RD12 HTML, with fresh receipt sinks.
5. Inspect final diff and fix confirmed findings; rerun affected checks and
   task guard with explicit START/base (52 inputs, shared18, zero violations).
6. Authorized local candidate commit must directly parent START. Record full
   candidate SHA/tree/changed paths, raw logs, assets and migrated API bindings.

## Risks / rollback
Babylon stock lighting, image processing, fog and transparent sorting can differ
from C0; declare those axes unproved/unsupported rather than altering source.
Native shader/translator cold-load and device-loss evidence is NOT_RUN Phase1.
Late SDK initialization cannot be synchronously cancelled: release any late
device without reviving the host. Cleanup is logical ownership, not released VRAM.
No destructive rollback; preserve attempts and revise only leaf files.

## Progress and definition of done
Startup, exact install, real factory/entry, owning RED→GREEN and self-review
complete. Fresh final CPU check: 17 PASS (13 sealed v2 core + four supplementary
ownership/material/error cases). Focused API/native-spec types, unchanged root
types and actual standalone optimized entry build PASS. No native invocation.
Original v1 accessor/type failure and shared-budget timeouts remain preserved;
v2 uses the actual `hasVertexAlpha` public surface, without changing titles,
numeric/visual thresholds, source inputs or references. The CPU-only test budget
is 120s; SDK init/material/readiness deadlines remain 15s.
Confirmed review fixes cover lit emission, direct sRGB clear output, staged
first-loss propagation, mid-frame terminal disposal and captured UI selections.
The final boundary/diff-check and direct-parent candidate identity are sealed in
the post-commit `candidate-phase1-final-01.json` described by the new HANDOFF.
Phase1 done means actual typed factory + entry, unchanged-oracle GREEN, optimized
entry assets, fresh boundary proof and pinned local handoff. Native/media/art/
performance/product and the whole programme remain NOT_RUN/NOT_READY, not PASS.
