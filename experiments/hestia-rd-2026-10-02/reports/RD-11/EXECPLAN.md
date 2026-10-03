# ExecPlan: RD-11 Phase 1 — frozen Three node renderer comparison

## Goal
Deliver executable `createThreeWebGpuExperiment`, C1 `forceWebGL` and C2 observed
WebGPU modes, a native HTML/main entry and focused REN11–14 oracles. Commit a
local candidate for HEAD integration. ProductIntegrated=false always.

## Context
START `e42bf9e771e651306b6cece5e4116d4e4e25af9c`, tree
`487de40f20e51cd3dfd150fdc3af3ffe403954ed`; product read-only base
`b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. Read root AGENTS/README/current
state/PLANS/roadmap, input-package documents 01–04, tasks/RD-11.md,
orchestrators/SO-02.md and HEAD's SHA-bound SO02 preparation and freeze.
Accepted local RD03 assets/scenarioRunner/threeHost/three-control and RD10
comparison/capability reports are the source of compatibility, not live foreign
worktrees. Three and types stay 0.185.1; inspect installed source/types after
contained exact-lock installation. Prelaunch guard: 52 inputs, 18 shared files,
zero violations; automatic logs mean FAIL_ACCEPTED_NARROW_EXCEPTION, not clean.

## Non-goals
No nested agents or DevToolbox; no shared-file, lock, dependency-pin, product,
save, DB, golden, config, media/reference edits. No remote publication. No GPU
lease: performance/native memory/art/product acceptance NOT_RUN. No Phase 2
browser or optimized-entry claims before HEAD supplies a new immutable snapshot.

## Architecture decision
RD03's WebGLRenderer host is not GPU-capable. Add only a renderer-specific owner
under `src/experiments/three-webgpu/`: one renderer/scene/camera/rAF. Use existing
import/private payload copies, Float32 projection tolerance, mountExperiment and
scenario ordering (await replacement, resetTick, frame). Build detached complete
source candidates and clean failed/late candidates before atomic adoption.
Use MeshLambertNodeMaterial/TSL, not inherited onBeforeCompile. C0 unchanged.
F01 keeps ACES exposure 1.05, fog 48–170 and its bound lights; F04/F06 retain
synthetic noToneMapping/exposure 1/noFog lights. Freeze requested HalfFloat output
and samples=4 for C1/C2; report effective backend/MSAA/format, never assume them.
Unsupported shadows/sky/water hooks/AO dimensions remain explicit.

## Implementation phases
1. Prepare owned sink admission/command receipts and install missing exact-lock
   dependencies with contained PATH/cache/temp. Verify inputs and pinned APIs.
2. Write exact `tests/RD-11/unit.test.ts` and `browser.spec.ts` with REN11–14.
   First run behavioral negative/parity RED with controlled wrong implementation,
   then run unchanged oracles GREEN after the smallest renderer implementation.
3. Add native entry controls for frozen F01/F04/F06 replay, backend labels,
   source/reset/backseek, resize, terminal loss and disposal. Report port inventory.
4. Fresh focused units/types/root check; inherited-entry build only, owned output;
   binding checks and boundary with exact START/base. Inspect final diff, repair
   confirmed findings, repeat affected checks, stage exact allowlist, local commit.
5. Postcommit guard and candidate SHA/tree/parent/path/input/raw-log bindings.
   Handoff exact HEAD static registration/Vite/script deltas. Do not auto-start
   Phase 2; independent review belongs to HEAD, not this nondelegating leaf.

## Tests and evidence
Commands use explicit Node `C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe`
and `reports/RD-11/run.mjs <fresh-label> <operation>` from this lab. Operations:
`install`, `unit-red`, `unit`, `check`, `types`, `build`, `bindings`, `guard`,
`commit`, `candidate`. Units invoke Vitest directly with `tests/RD-11`, never
the broad inherited npm default. Focused tsc includes own files and imports.
Run outputs: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/phase1-e42bf9e7-20261003/`.
Admit native ancestors/links/dangling/case aliases immediately before each sink;
unique append-only raw logs and receipts bind source/test SHA and exits.
REN11 async/backend/fallback; REN12 exact material/depth/baked-AO structure plus
predeclared Phase 2 camera/ROI/missing-shader rejection; REN13 real frozen owner
and opening snapshots; REN14 controlled init/loss/resize/late abort/teardown.
Controlled CPU doubles never count as native GPU/browser proof.

## Risks
WebGPURenderer can fall back; compatibility can disable MSAA; node color setup
can double-apply vertex colors; terminal loss must not recover silently; init or
compile failure must not leave a loop/candidate. Renderer resource counts are
not native bytes. C0→C1 includes a material port, not a pure backend experiment.

## Rollback / safe stop
Stop only the affected unsupported mode. Material unresolved shared/contract or
authorization decisions go to HEAD. Keep failed evidence and prior receipts.
No file deletion or foreign process cleanup. Candidate is local-only/revertable.

## Progress log
- [x] Mandatory scope/source reads and START/prelaunch hashes verified.
- [x] Contained exact-lock dependencies and pinned API/source/type inspection.
- [x] Behavioral RED, implementation, unchanged-oracle GREEN (14→15→16 stronger oracles; original prefix retained).
- [x] Self-review: candidate async compile before adoption; adopted generation; owned device.lost destruction; failed-init fresh canvas; native MSAA binding restore; terminal diagnostics cannot block cleanup.
- [x] Inherited optimized build PASS (26 modules / three old entries), not RD11 optimized entry.
- [x] Typing attempted: FAIL_TIMEOUT even minimal public TSL smoke and root gate; no pin/gate weakening. HEAD resolution required.
- [x] Fresh units16/16, eight-file syntax check (NOT typing), raw622/shared18/public429 bindings, 429 exact public build copies / ten old-entry graph files and scope52 guard.
- [ ] Staged final diff/local commit/postcommit guard and candidate receipt; external receipts are authoritative for these final steps.
- [ ] Phase 2: HEAD-issued immutable wiring snapshot required; NOT_RUN.

## Definition of Done
Functional C1/C2 code and real native entry exist; unchanged REN11–14 unit
oracles pass with retained genuine RED evidence; own/root types and inherited
build verified; full inputs/shared18/public429 bindings unchanged; honest native
missing-feature/measurement inventory; final allowlist diff self-reviewed and
committed; postcommit guard and exact candidate handed to HEAD. Native browser,
screenshots/ROIs, optimized RD11 build and timing remain Phase 2 NOT_RUN.
