# RD-03 phase 1 — READY_FOR_HEAD_WIRING

Real Three/WebGL2 control, bounded native asset importer, controlled replay,
single Three-only host, diagnostic UI, CLI and tests are implemented. **This is
not whole-RD03 completion.** Optimized RUN03/RUN04 remain **NOT_RUN** until HEAD
wires the real entry and supplies a new immutable phase-2 snapshot.

**Acceptance caveat:** an incorrectly broadened unit run created ten additive
synthetic oracle directories under RD00/RD01/RD02 run roots. This exceeded the
leaf's artifact scope; HEAD must review it. No foreign cleanup, old receipt or
wrapper modification was performed. Details below and in the external index.

ProductIntegrated is always false. No delegation, DevToolbox execution,
publication, product bootstrap, physics, save/database changes or new dependencies.

## Inputs and commit binding

- Worktree: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-worktrees/Hestia-RD-RD03`
- Branch: `feature/hestia-rd-rd03-2026-10-02`; workspace `wks_5862e4b1cc7fb4f5`
- Immutable parent/start: `16faf55a9782fb12d2f30df4547a619957792089`
- Start tree: `e094ea4e5631027ac26680ac06578ddfce41cdab`
- Product read-only: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`
- Accepted HEAD receipt: `HEAD/accepted-freezes/16faf55a9782fb12d2f30df4547a619957792089.json`
- Shared acceptance SHA-256: `ad81599d8f44f96e3d63f25cf657964a1b8d79ffb5af45b5f71b3100ceb249b3`
- Prepared exporter freeze remains immutable, not acceptance by itself:
  `HEAD/freezes/16faf55a9782fb12d2f30df4547a619957792089.json`
- Lock SHA-256: `9dc112529df87daa8a3d92a913932d2b0bad131055d8d684d86736bd4409b60c`
- Inventory SHA-256: `26bf86bba1cbd1955d069ab2eac8d491b6cade59d16a004f1d094cc117ebc9c6`
- Taskboard SHA-256: `cd5722dfff73393a2cb9d87fabf4c94f59da310300b79a7c2e87a1ec79b40448`

All 18 frozen shared-file hashes were checked before work and are checked again
in the terminal receipt. `CODE-RECEIPT.json` records the full implemented code
commit SHA/tree/parent, exact changed paths and final dependency/evidence hashes.
The receipt commit is documentation-only; it does not change the verified code.

## Implemented ownership and API

| File / export | Signature / responsibility |
|---|---|
| `src/experiments/three-control/index.ts` | `createThreeControlExperiment(context: LabExperimentContext): Promise<ThreeLabHost>`; standalone uses exactly the shared host |
| same | `mountThreeEffect(context: ThreeLabEffectContext, preset: LabPreset): Promise<ThreeLabEffect>`; borrowed context, detached owned root, no renderer/camera/loop |
| same | `projectFloat32(values: LabTypedPayload): Float32Array`; private projection, exported `GPU_PROJECTION_TOLERANCE_METERS = 1e-5` |
| `src/runner/threeHost.ts` | `createThreeLabHost(context, mounts): Promise<ThreeLabHost>`; static explicitly selected Three factories only |
| same | exported `ThreeLabHost`, `ThreeLabEffectContext`, `ThreeLabEffect`, `ThreeLabEffectFactory`, `ThreeOwnerPose`; `ownerPose(fixture, ownerId)`, `liveThreeHostCounts()` |
| `src/runner/scenarioRunner.ts` | `createScenarioRunner(scenario, handle, setResetTick)`; serialized render/advance/pause/seek/reset/settled commands |
| `src/runner/assets.ts` | `publicAssetRoot`, `readBoundedResponse`, `loadInventory`, `loadFixture`, `loadReplay`, pinned inventory digest |
| `src/runner/index.html`, `main.ts` | real native runner page, explicit source/tick controls and lab facts; no TestBridge or root Canvas2D mount |
| `scripts/run-lab.mjs` | inspect/evidence/bench; explicit IDs, immutable per-run manifest, terminal status/denominators, result validation and owned cleanup |

The host owns exactly one renderer, scene, camera and renderloop. Factory mounts
are staged privately and generation-checked before synchronous adoption. Throws
retain the previous complete source; aborted/late candidates are disposed. Frame
projection faults and context loss are explicit errors, never fallback/replan.
Read/frames during replacement remain blocked by the frozen `mountExperiment`.

Effects see getters for their current adopted fixture/frame/resetTick and stable
owner-ID pose queries. Replacing/resetting reconstructs detached effects.
Backward seek can adopt earlier revisions; ResetLab or backward time remounts
projection caches even if the fixture digest did not change. The selected
snapshot is awaited before reset context and `setFrame`. Time is tick/60, never
rAF/Date identity. No native Cut, rollback, World or source mutation is implied.

Fixture submeshes become real indexed BufferGeometry material groups, owner
transforms, linear colors/AO and Lambert materials. F01 uses its exported
readable-coast-v6 lights/fog, sRGB output and ACES exposure 1.05. Crop coverage
remains 0.125 m with UNKNOWN outside; presentation-only geometry grants no air
knowledge. F05 keeps canonical Float64 1.8 m bytes and gets a separate Float32
GPU projection. The tolerance was declared before RED and was not relaxed.

Native PCF shadows, sky, water shaders and native material hooks are explicitly
unsupported. No speculative wetness/occlusion API, onBeforeCompile chain, ECS,
shader plugin system or Rapier import/init was added. RD14 owns solids/water;
RD21/22 decor; RD31/33 particles. RD15/RD32 channels wait for RD14's concrete
owner contract; HEAD must freeze those narrow channels when that owner exists.

Normal disposal releases effect geometry/materials, renderer resources, listeners
and loop, retaining the canvas's one reusable WebGL2 context. Native driver/context
allocation bytes are unavailable, not zero. Forced context loss was reproduced
as a remount failure and removed. External context loss remains an explicit error.

## Verification / qualification

| Check | Result / scope |
|---|---|
| Frozen branch/start/tree, receipt, 18 shared files, inventory/taskboard | PASS before work; final receipt rechecks |
| Genuine missing-code RED | exit 1, missing `src/runner/assets`; suite import failure, not eight assertion failures |
| Focused `npm run test:unit -- tests/RD-03` | PASS, 13 CPU tests in two files |
| `npm run check` | PASS; whole lab TS, including real runner/control and browser specs |
| `npm run build` | PASS **root Canvas2D baseline only**, 13 modules, no optimized RD03 entry |
| CLI inspect F04 tick 1560, three samples | PASS; actual private imports and scenario samples |
| CLI mismatched fixture/scenario | expected exit 1 / FAILED; manifest and three planned/skipped samples retained |
| Controlled SIGINT-handler check | PASS after regression fix; ABORTED, 3 planned / 0 observed / 3 skipped; not OS-console Ctrl-C evidence |
| CLI evidence before wiring | NOT_RUN; actual native optimized HTML absent, 1 planned / 1 skipped |
| CLI bench without slot | NOT_RUN; 120 planned / 120 skipped; no timing values, empty/active overhead both NOT_RUN |
| DEV source-page WebGL2 diagnostic | PASS: nine F00/F01/F04/F05 views, backward seek/reset, 20 remount/dispose cycles and listener baseline restored |
| Optimized browser RUN03/RUN04 | NOT_RUN — phase 2 required, **not** NOT_APPLICABLE |
| GPU/target-hardware/performance/art gates | NOT_RUN; no exclusive slot, native allocation/timing claims or viewed-reference acceptance |
| Independent/human review | NOT_RUN; implementation leaf, no spawning |
| Self-review / whitespace / task boundary | terminal receipt records fresh results and exact paths |

RUN01 compares identical explicit ticks at 30/60/144 render cadences, paused
advance and seek without extra events. RUN02 exercises real CPU geometry
replacement plus a clearly labeled renderer-mocked host atomicity/late-abort
oracle. RUN03 checks payload/source/bounds/colors/projection plus the optimized
spec's real backend, image hashes, CSS image dimensions, DPR, drawing-buffer
resolution and timer availability. RUN04 has 20 CPU disposals and an actual
optimized browser lifecycle spec (pending). All sixteen snapshots/eight scenarios
import and project in focused tests. Bad/hash/oversize imports are rejected before
binary preallocation; advertised-size rejections cancel the response body.

The DEV evidence is **DEV-DIAGNOSTIC-NOT-OPTIMIZED-NOT-PERFORMANCE-NOT-TARGET-GPU**.
Source-page screenshots were inspected for rendering, not compared as accepted
art/reference matches. Screenshot CSS pixel dimensions are distinct from the
declared 1280×720 drawing buffer at DPR 1. The browser executable is pinned;
DEV browser version was not separately recorded. Actual device string and timer
availability are in the raw diagnostics; rAF is never a GPU timer. There is no
synchronous GPU readback on the normal frame path.

## Raw evidence and honest RED/GREEN

All leaf logs/data live under
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-03`, apart from the documented
inherited-test scope deviation. `commands.jsonl` records actual full binaries,
arguments, cwd, process-local environment, UTC timestamps, exits and log hashes.
`checks/evidence-index.json` indexes final data/media/source hashes. Key logs:

| Log | Exit | SHA-256 |
|---|---:|---|
| `focused-red.log` | 1 | `17c5986d552440e752d9db0e2df56db93a6b4f20e820667d4903ccbcac6918fe` |
| `focused-commit.log` | 0 | `066866fbca9089eb6133215d0b40f40eb5877e00b897831beb05c2cff0ae95fb` |
| `dev-diagnostic-reproduction.log` | 1 | `a58c3747813eef52f840130445d88a724d0209fedaa3a82c6339454267768112` |
| `dev-diagnostic-final.log` | 0 | `f85bba1cea2695f376c3c2f15e22dc42b067ff837c69d5c3c1cc827925aac59c` |
| `cli-abort-final.log` | 0 | `972140b95e7606131af1e224c6f11faa19d47cb8b16d1a95d7f1d8e1b80c6e89` |

Original RED test source: `checks/focused-red-unit.test.ts`, SHA-256
`f90c70db2cf134837fa4dc6157df694218b5c49c4718af6818ccd3efd11addea`.
This is the preserved initial source, not a claim that it equals current tests.

Two implementation findings were fixed and rerun: matrix decomposition changed
the exact quaternion by one final bit (direct composition now preserves the
input); forced context loss broke remount (`Cannot read properties of null
(reading 'alpha')`). Controlled abort also exposed `signal-exit` re-raising a
signal after a once-handler disappeared; the owned handler now stays registered
until finally cleanup. Its initial aborted run retained PLANNED manifest only;
the fresh regression run retained ABORTED terminal and denominator.

## Explicit inherited-test scope deviation

`npm run test:unit` passed 40 tests but was the wrong broad command for this leaf:
unchanged RD00/RD01/RD02 tests hard-code external oracle roots. It created eight
new RD00 oracle directories, RD01 `repair-output-guard-tbsWAP`, and RD02
`fx10-owned-path-TlVjRJ`. The ten exact paths/birthtimes are in
`checks/scope-deviation.json`. Synthetic links and Git-oracle files were created
inside those new test directories. No existing dependency receipt/wrapper was
modified by the leaf. No cleanup was attempted; no foreign live worktree was
read to repair this. The repository guard does not authorize this external
artifact deviation. HEAD review is required; this report does not accept it.

## Smallest HEAD-only wiring delta

1. Add real static imports/exports and RD03 registration for
   `createThreeControlExperiment`; variant/preset ID **fixture-control** and
   scenario **F00-CONTROL-REPLAY**. Keep root RD00 registration first and its page
   independent: do not mount Canvas2D alongside Three on this canvas.
2. Add `build.rolldownOptions.input` to existing Vite8 config, keeping publicDir,
   strict host/port, base `/` and outDir unchanged:

   ```ts
   input: {
     diagnostic: fileURLToPath(new URL('./index.html', import.meta.url)),
     runner: fileURLToPath(new URL('./src/runner/index.html', import.meta.url)),
   }
   ```

   The real optimized URL is **/src/runner/index.html**, not `/rd03`. Public asset
   URLs are `/inventory.json` and `/Fxx-NAME/...`, never `/fixtures/...` or nested
   HTML-relative payloads. The browser importer imports no Node exporter/stager.
3. Add desired package CLI aliases using the existing explicit C Node + Cpwsh
   convention: `lab:inspect`, `lab:evidence`, `lab:bench` invoke this real CLI.
   No dependencies/lock changes are needed. No shared LabFrameInput delta needed.
4. Provide the new immutable phase-2 SHA/tree/receipt after actual optimized
   build byte checks. Same leaf runs native optimized browser/lifecycle evidence.
   Only then consider relevant material-owner channels; no generic plugin system.

## Exact commands (lab cwd; fresh unique run IDs)

Pinned Node is `C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe`;
npm CLI is its `node_modules/npm/bin/npm-cli.js`; shell is
`C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe`; Git is
`C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe`; Chromium is
`C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe`.
Process PATH contains only those C tool directories; TMP/cache are owned RD03;
npm script shell is Cpwsh. Pinned versions: Node 22.23.2, Three/types 0.185.1,
TS 7.0.2, Vite 8.1.5, Vitest 4.1.11, Playwright 1.61.1.

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/run-lab.mjs' inspect --experiment RD-03 --variant fixture-control --fixture F04-DETACH --scenario F04-DETACH-REPLAY --run head-inspect-01 --tick 1560 --samples 3
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/verify-boundary.mjs' --task RD-03 --start 16faf55a9782fb12d2f30df4547a619957792089 --base b3c6523a94cd050f5a9a22dc27f4777fcc03363e --port-check
```

After HEAD wiring, start **only as a bounded managed background process**:

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './node_modules/vite/bin/vite.js' preview --host 127.0.0.1 --port 5280 --strictPort
```

Then run (CLI owns its browser/profile, never the managed server):

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/run-lab.mjs' evidence --experiment RD-03 --variant fixture-control --fixture F00-CONTROL --scenario F00-CONTROL-REPLAY --run head-evidence-01 --tick 120
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/run-lab.mjs' evidence --experiment RD-03 --variant fixture-control --fixture F01-HVP-COAST --scenario F01-HVP-COAST-REPLAY --run head-coast-01
$env:HESTIA_RD_TASK = 'RD-03'
$env:HESTIA_RD_BROWSER_RUN_ID = 'head-optimized-01'
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './node_modules/@playwright/test/cli.js' test tests/RD-03/browser.spec.ts
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/run-lab.mjs' bench --experiment RD-03 --variant fixture-control --fixture F00-CONTROL --scenario F00-CONTROL-REPLAY --run head-bench-not-run
```

Bench remains deliberately NOT_RUN: a concrete authorized exclusive-slot/target
measurement protocol is not available. This implementation does not invent a
lease or claim timing readiness. Empty/active overhead workloads are predeclared
but not measured. Capture/diagnose cannot be promoted to selection timing.

## Cleanup and residual risk

Only owned DEV managed services `bg_murlat6y_2z` and `bg_murlu1f6_30` were stopped;
owned browser contexts closed, profiles retained additively. Fresh port check
proved strict 127.0.0.1:5280 free. Native Vite CPU loaders closed. No foreign
process/tab cleanup, destructive deletion, push/PR/main merge/release/deploy.
Automatic untracked `.opencode/throughput.jsonl`/`.md` remain untouched/unpublished.

Residual gates: HEAD's review of the scope deviation; native optimized
RUN03/RUN04 and real browser abort/capability-loss cases after wiring; native
shader/art parity; actual exclusive target GPU measurements and overhead.
Host effects rely on honoring detached-root ownership; no future material
channels are silently authorized. Product integration remains false.
