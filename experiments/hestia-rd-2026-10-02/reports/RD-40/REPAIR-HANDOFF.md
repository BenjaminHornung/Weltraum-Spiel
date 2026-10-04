# RD40 PHASE1 bounded same-leaf repair

ProductIntegrated=false. This is a repair child of `fb6e9678e312b7716025ab358b14a550ae56e12e` / tree `939e61f1dca900975d8408c891f6e589637b3ab1`, not product integration or the RD51/RD52 wholeprogramme package. Task START remains `c531783536cc0fc617e928781633101b43cd2bfa`; product readbase remains `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. HEAD wiring remains unimplemented and HEAD-owned.

## Findings and owning fixes

- P2 seek: all callers were read. DOM uses nonempty `valueAsNumber` and shared integer/range validation before dispatch; the session validates direct callers before stopping the clock or touching the runner. Input feedback is separate from terminal renderer `ERROR`. Invalid input preserves submitted frame, fixture, revision, weather, reset, camera, backend, generation and live owner; valid/backward seek is unchanged.
- P2 imports: `readEvidenceSelection` admits the entire six-file selection before any `arrayBuffer`: unique bounded basenames, count, expected JSON/PNG roles and MIME, exactly one binding JSON, five JSON files each <=1 MiB and one PNG <=32 MiB. Sidecar role/path uniqueness is checked before payload reads. JSON parsing, byte/source/runtime/viewport bindings and actual PNG decoding remain mandatory; extensions are not decoded-content proof. Bind has a synchronous owning guard, disabled button and `finally` cleanup. An old operation cannot reenable Bind during PREPARING/disposal.
- P3 pair startup: both buttons start disabled; the owning handlers guard inventory and valid initialized pair selections before registration. Only an actual first READY submission enables them. They stay available for normal PREPARING rapid/latest selection after initialization.

## Exact changed paths (lab-relative)

- `src/tools/variant-gallery/main.ts` — seek admission, serialized binding and pair startup guards.
- `src/tools/variant-gallery/session.ts` — owning seek validation and separate input feedback.
- `src/tools/variant-gallery/evidence.ts` — whole-selection pre-copy admission and role-bound reads.
- `src/tools/variant-gallery/index.html` — accessible input feedback and initially disabled switches.
- `tests/RD-40/repair.test.ts` — seven additive actual-main-listener/session CONTROLLED CPU regressions.
- `reports/RD-40/vitest.phase1.config.ts` — include only original13 and repair7, still one worker.
- `reports/RD-40/repair.mjs` — C-only sequential verification/local commit runner.
- `reports/RD-40/repair-receipt.mjs` — additive red/green, source/disk/build and protected-file receipts.
- `reports/RD-40/REPAIR-HANDOFF.md` — this additive handoff; original HANDOFF/PLAN preserved.

The original 13-test oracle is unchanged, SHA-256 `b542ba1faffceafd01c821939fb4adbeb97b9a94c6c41f3c0d7c4034712495bf`. Original browser oracle SHA-256 `91c06b7e1bdb0002a110a5e44563454bc36af701347e64e0f28baa03fafb5440` is unchanged and compiled, NOT_RUN. No shared/package/lock/config/registration/fixture/media/product files changed.

## Genuine RED, unchanged GREEN

Additive oracle SHA-256 `d6c28f0b947658063f5a8bd1a28e23df3bedac53f2bf5f5baa0d590c358be38c` is retained byte-for-byte from original-source RED through GREEN. It drives the real main.ts listeners with a small CONTROLLED DOM model and real gallery session/scenario runner, frozen F04 snapshots and controlled hosts. It is not native browser or renderer proof.

RED: `c5317835-phase1-repair-20261004-red-a`, exit 1, 4456 ms, six failures / one retained-behavior pass. Raw command-log SHA-256 `57d1c34190f51d65225c24fd1181f22a40ae93586380d3ba63fa8a3e1198c91d`. Failure messages prove blank seek dispatched zero, direct invalid seeks retired owners, a later declared oversized JSON was read/accepted, metadata/type defects escaped admission, repeated Bind copied twice while enabled, and delayed-inventory A/B handlers threw. The File metadata/PNG decoder doubles are explicitly CONTROLLED, not allocation-performance or native-image evidence.

RED source8 were byte-identical to the original candidate when executed. Bound proof: `c5317835-phase1-repair-20261004-red-proof-a/receipt.json`, SHA-256 `2f9842cdcb4591b37d100ac9c7e1d1384ab7d8c8981e013c8868f6549181071b`. Original HEAD proof `HEAD/rd40-phase1-head-fb6e9678.json` remains SHA-256 `53b114d1e5388a2c48c1072a09ef5f44315c8be3d0b5338aed930d64d035bd00`. Original producer receipt and build are retained, not rewritten or reclassified.

Fresh final outputs are under `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-40/c5317835-phase1-repair-20261004-verify-b/`. All actual commands, arguments, working directories, exits, UTC timings/durations, raw-log hashes, unit JSON/source binding and all 432 optimized build-file hashes are in the external postcommit receipt `c5317835-phase1-repair-20261004-candidate-a/receipt.json`. The complete candidate SHA/tree belong there, outside this commit, avoiding a self-referential committed receipt.

## Reproduction / verification commands

All commands run from the lab directory with the exact C-only Node binary `C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe`. Helpers use only C-only Node/Git/native pinned tsc, own fresh TEMP/TMP/cache and process-local C-only PATH/script shell. No installation/refetch is needed or performed. Each run ID is unique; all old/failed attempts are preserved. Original-source RED is historical: do not replay it on repaired source or mislabel the result.

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'reports/RD-40/repair.mjs' admission c5317835-phase1-repair-20261004-admission-a
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'reports/RD-40/repair.mjs' red c5317835-phase1-repair-20261004-red-a
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'reports/RD-40/repair-receipt.mjs' red c5317835-phase1-repair-20261004-red-proof-a c5317835-phase1-repair-20261004-red-a
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'reports/RD-40/repair.mjs' verify c5317835-phase1-repair-20261004-verify-b
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'reports/RD-40/repair-receipt.mjs' precommit c5317835-phase1-repair-20261004-precommit-b c5317835-phase1-repair-20261004-verify-b c5317835-phase1-repair-20261004-red-proof-a
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'reports/RD-40/repair.mjs' commit c5317835-phase1-repair-20261004-commit-a
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'reports/RD-40/repair-receipt.mjs' postcommit c5317835-phase1-repair-20261004-candidate-a c5317835-phase1-repair-20261004-verify-b c5317835-phase1-repair-20261004-red-proof-a
```

The verify runner executes sequentially: root native tsc `--noEmit -p tsconfig.json`; focused native tsc `--noEmit -p reports/RD-40/tsconfig.json`; pinned Vitest with the owned config and exactly `tests/RD-40/unit.test.ts tests/RD-40/repair.test.ts`; actual gallery-only Vite optimized build with the owned config/new external outDir; and `scripts/verify-boundary.mjs --task RD-40 --start c531783536cc0fc617e928781633101b43cd2bfa --base b3c6523a94cd050f5a9a22dc27f4777fcc03363e` (NO port-check).

Receipt validation independently compares every runtime-bound file (including source.ts self and CSS) with actual disk SHA-256, current shared18 and all original START645/fixture-media429 raw hashes with their pinned preserved receipts, unchanged original oracles, RED/GREEN oracle identity and fresh original52 guard. The all-files status is only `FAIL_ACCEPTED_NARROW_EXCEPTION` for the two regular automatic untracked logs, never a clean/all-files PASS. Logs are never read, copied, edited, ignored, committed, deleted or published.

`verify-a` is an intermediate successful GREEN/build run, retained separately from final `verify-b`. `precommit-a` is retained with its Git cwd-relative untracked-path warning (exit 0; source/protection checks passed). The receipt-only pathspec was corrected to lab-relative paths with `ls-files --full-name`; fresh `precommit-b` supersedes that inventory scan. No runtime, original oracle or repaired oracle bytes changed for this reporting fix.

## Review, limits and cleanup

The supplied SO05 independent 17-file STATIC review is the accepted repair input; its reproductions were NOT_RUN. These focused controlled reproductions are new. Exact-diff self-review follows repair; no new independent or human review is claimed. No delegation/children/DevToolbox, services, ports, browser, screenshots, GPU/performance, publication, deletion or product/world/save changes. Existing HEAD diagnostic preview is untouched. Attempts, builds, dependencies and receipts remain retained.

Browser/native acceptance and screenshots remain NOT_RUN. Original REN12 vertex-color-omission oracle remains FAIL, unchanged and not rerun; visual adoption DEFER. The existing >500 kB optimized-bundle warning is retained; no ungranted performance/code-splitting work.

Exactly minimal proposed HEAD wiring is unchanged: add `rd40: fileURLToPath(new URL('./src/tools/variant-gallery/index.html', import.meta.url))` to the lab root Vite entry map and `<a href='./src/tools/variant-gallery/index.html'>RD40 variant gallery</a>` to the lab root navigation. Only HEAD does this after admitting the actual repair commit, with a fresh build/freeze and separate browser/port authorization. No registration or shared contract change is needed.
