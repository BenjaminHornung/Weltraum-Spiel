# RD11 Phase1 — LOCAL CANDIDATE / TYPE GATE BLOCKED

Implemented, not just planned: `createThreeWebGpuExperiment`, actual own native
HTML/main, explicit C1/C2, Lambert node/TSL port, frozen F01/F04/F06 replay,
private async-compiled source adoption, reset/backseek, resize, terminal loss and
idempotent cleanup. No delegation, tracking, shared wiring or remote action.
ProductIntegrated=false. Self-review only; HEAD independent review is pending.

## Candidate binding

Worktree `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-worktrees/Hestia-RD-RD11`,
branch `feature/hestia-rd-rd11-2026-10-02`. One local commit directly parents
START `e42bf9e771e651306b6cece5e4116d4e4e25af9c`, tree
`487de40f20e51cd3dfd150fdc3af3ffe403954ed`. Product base
`b3c6523a94cd050f5a9a22dc27f4777fcc03363e` stays read-only.
Exact resulting SHA/tree/directparent/changed paths and file hashes are in the
postcommit external receipt (avoids a commit self-reference):
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/phase1-e42bf9e7-20261003/candidate-local-candidate-01.json`.

## Verified / retained failures

CPU unit oracle: original14 retained byte-for-byte as prefix, append-only stronger
replacement compile and native-API-shape MSAA cases. Genuine behavioral RED then
unchanged oracle GREEN: initial corrected14 11pass/3fail→14pass; replacement15
14pass/1fail→15pass; quality16 15pass/1fail→16pass. No import/file/CLI failures
count as RED; no ROI thresholds or frozen source profiles changed. Raw receipts,
test-result SHA, original/current hashes and command paths/exits are retained.

Initial behavioral-red-01 had one invalid pause setup in addition to three real
failures; fixed only that setup before behavioral-red-02 and production repair.
baseline-01 failed historical Git text=auto LF/CRLF blob comparison; repair records
raw bytes AND filtered Git blob, then final checks additionally require all622
original raw SHAs equal this leaf's SHA-bound baseline-02. No bytes rewritten.

PASS: focused controlled units; inherited optimized build (26 modules, C0/RD00/
RD10 only, NOT this new entry); 52-input scope guard; original622/shared18/
public429/lock/inventory preservation and source/receipt bindings. Final fresh
unit/guard/diff/candidate receipts supplement `phase1-verification.json`.

FAIL_TIMEOUT: pinned TypeScript7.0.2 focused and root check. Native watchdog
attempts, trace and a minimal five-line public WebGPU/TSL import reproducer are
retained in reports/compiler-smoke.ts and external commands. Single-threaded and
single-public-namespace probes still stall. Root cause/pin remedy NOT established;
do not describe this as concurrency, successful typing or an app type error.
Two earlier wrappers hit shell deadlines; focused-types-01 eventually retained
a watchdog SIGTERM receipt, while focused-types-single-01 has NO observed native
exit receipt. Empty raw logs/start records remain, not fabricated exit codes. No SDK,
pin, package, lock or shared declaration was patched to weaken the gate.

Original all-files gate remains FAIL_ACCEPTED_NARROW_EXCEPTION for ONLY the two
automatic untracked regular root throughput logs. Never authored/staged/ignored/
copied/deleted by this leaf. Native/browser/screenshot/ROI/performance/art/Product
gates NOT_RUN in Phase1. See MIGRATION-INVENTORY.md for every known missing native
shadow/AO/material/sky/water feature and unmapped quality dimensions.

## Exact HEAD-owned wiring, before Phase2

1. Fresh recheck and independent review this candidate; resolve the proven type/
   tool compatibility blocker. Any pin/lock delta belongs to HEAD, with explicit
   newly accepted immutable binding; leaf does NOT propose an unproved version.
2. `src/registration.ts`: add import
   `import { createThreeWebGpuExperiment } from './experiments/three-webgpu';`
   and two static LAB_REGISTRATIONS rows: id `RD-11`, variantId/preset.id `C1`
   and `C2`, scenarioId `F01-HVP-COAST-REPLAY`, create actual factory. No Canvas2D
   substitute and no treating RD03 WebGL host as GPU-capable.
3. `vite.config.ts`: add actual multi-input
   `rd11: fileURLToPath(new URL('./src/experiments/three-webgpu/index.html', import.meta.url))`.
   Do not alter C0, the fixtures or the source/quality profiles.
4. Package scripts, only if HEAD wants named wrappers: `test:unit:rd11` invokes
   explicit C Node + `./node_modules/vitest/vitest.mjs run tests/RD-11 --configLoader native`;
   `test:native:rd11` invokes explicit C Node + `./node_modules/@playwright/test/cli.js test --config reports/RD-11/playwright.config.ts`.
   Existing root build then includes rd11. RD03-only run-lab.mjs is NOT an RD11
   launcher. No package/lock change needed for renderer APIs; typing blocker is
   a separate proved issue requiring HEAD's decision/fresh verification.
5. Provide a NEW named immutable HEAD snapshot, SHA and source tree, and that
   exact checkout to this SAME leaf. No Phase2 auto-start from CURRENT_FREEZE.

Ready native URL after HEAD wiring:
`http://127.0.0.1:5280/src/experiments/three-webgpu/index.html?mode=C1&scenario=F01-HVP-COAST-REPLAY`
(C2 explicit; F04-DETACH-REPLAY/F06-MATERIAL-REPLAY selectable). Native source HTML
exists now; current inherited build deliberately has NO optimized rd11 entry.
`window.TestBridge` absent normally; `?testBridge=1` permits controlled omission
and actual task-owned device destruction only.

Phase2 env contract: `HESTIA_RD11_PHASE2_SNAPSHOT`,
`HESTIA_RD11_PHASE2_SNAPSHOT_SHA256`, `HESTIA_RD11_OPTIMIZED_BUILD`,
`HESTIA_RD_BROWSER_RUN_ID` (new lowercase ID), task `RD-11`, process-local C-only
PATH/npm shell/cache/TEMP. Own ready config rejects mutable/current/Phase1
snapshot and a mismatched checkout before SDK output. All explicit captures and
JSON sinks re-admit leaf/ancestors; automatic screenshot/trace/video disabled.
Only after a fresh strict-free-port check, use managed bounded optimized preview
on5280 and execute exact own browser spec. No GPU benchmark lease is granted.

## Cleanup / limits

No browser/server/preview opened in Phase1. Managed compiler jobs completed by
watchdog with FAILED/SIGTERM receipts; two interrupted child IDs were checked
absent, and targeted parent-child query found no orphan. Current managed lookups
return no task records (not a fresh OS-wide process inventory). No foreign cleanup.
Keep owned logs/trace/cache/temp/dependencies/build/failed attempts append-only;
no file deletions, product saves/DB/goldens/config/plugin/media mutations,
push/PR/main merge/deploy/release/upload/subscription. Provider/settings requested
by launch are not independently attested by this implementation session.
