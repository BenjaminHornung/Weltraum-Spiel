# Original package reproduction

Q0 is freshly verified on 2026-10-07. PRODUCT_INTEGRATED=false; ART=PENDING_OWNER.

Published/start commit: `ebb913d133f4109a8898e70e9b0889edcc2d7662`, freshly confirmed against GitHub's `feature/resume-hestia-rd-2026-10-05` ref. Historical packaged execution anchor: `16a5d29a5cddea372abae139da618aa000a058be`; fixture product-read base: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. The original built execution remains `UNCOMMITTED_HASH_BOUND`, not retroactively labelled an ebb913d build.

## Archive and checker

Existing Git LFS hydrated only the original planner ZIP from its existing object store. It is exactly 68,078,891 bytes, SHA256 `87cddafc768dd24bbde7bf5a260dfeb1d184d66d600e967f09a22971034e4a4a`. Its 2,223 members pass path, case-collision, symlink and CRC checks before extraction into a fresh regular directory. MANIFEST SHA256 is exactly `254a797d75646c8f390832483dfabb05bb291c0bd84ace1c33e55f5156ddc170`.

The contained checker exits 0: 2,222 bound artifacts / 202,861,098 bytes and all 23 core cards. This is an archive/content verification, not 2,222 acceptance tests or a rerun of the 23-card program. Evidence: `package-archive.json`, `package-checker.log`, `package-checker-summary.json`. An initial checker invocation used the wrong working directory; the corrected invocation from the extracted root is the actual reproduction. The archive was not changed.

From this report directory, with the already located runtimes:

```powershell
& 'C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe' './reproduce_package.py' '../../planner-packages/2026-10-05/Hestia_RD_Planner_Final_2026-10-05.zip' './reproduction/new-package-directory' './new-archive-receipt.json'
Set-Location './reproduction/new-package-directory'
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/check-rd-results.mjs' './MANIFEST.json' '254a797d75646c8f390832483dfabb05bb291c0bd84ace1c33e55f5156ddc170'
& 'C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe' -m http.server 5280 --bind 127.0.0.1 --directory './dist'
```

Require a free 127.0.0.1:5280 and preserve foreign listeners. Stop only the owned foreground Python service with Ctrl+C. No package installation, Git checkout or node_modules is required for the included build/checker.

## Actual four-page smoke

`runs/package-smoke-02/report.json` freshly mounts the combined route, habitat preview, weather workbench and asset inspector in Chromium 151.0.7922.34 using pinned Playwright 1.61.1 / Node 22.23.2. Each received HTML SHA equals the extracted archive's HTML bytes; each produces actual native submitted-frame diagnostics and a canvas capture. Normal entries have no TestBridge. Each page is disposed before navigation and the owned browser/context close at the end. No JavaScript/shader/required-asset errors.

URLs: `/src/qa/combined-scene/index.html`, `/src/tools/foliage-workbench/index.html`, `/src/tools/weather-workbench/index.html`, `/src/tools/asset-inspector/index.html`.

The first smoke completed all four mounts/captures but its blanket console assertion failed on the browser-added absent `/favicon.ico` (HTTP 404). That invocation/log/captures remain under package-smoke-01. The second smoke suppresses only that optional favicon request; required assets and shader/JS errors still fail. It is a separate 4-page population, not a rewritten first PASS.

## Source development binding

The new worktree is `feature/hestia-rd-followup-ebb913d` at ebb913d. The prior worktree and its untracked `.opencode` are preserved. The parent checkout lacks ebb913d, so the existing R&D repository supplied the exact new worktree. Native task worktree creation cannot choose that other source checkout. A sandbox post-checkout shell/LFS index-refresh signal-pipe error was recorded; subsequent HEAD, clean content diff, ZIP hash and remote ref checks establish the successful unchanged checkout/hydration. No hook/filter/global configuration was edited.

Pinned dependencies were reused through a regular local copy, with no reparse points: Three 0.185.1, Babylon 9.29.0, TypeScript 7.0.2, Vite 8.1.5, Vitest 4.1.11, Playwright 1.61.1. The configured generic MCP browser was inspected first, but it runs a separate npx MCP toolchain; executable checks use the explicitly required repository-pinned Playwright and verified CIFI Chromium, without substitution/downloads. New build receipts record 83 source/package files before/after plus all artifact hashes and immutable original-package fixture origin.

`control-02` is the ordinary unchanged UI. `control-direction-02` is a separately declared test-input build: a validated bounded gust preset changes direction on each tick while rain .8/history, sources, populations, materials, camera, budgets and scheduler stay the same. Its source root is unchanged; a report-local build helper switches only the input sampler and binds its SHA. The unchanged route's original scenario digest describes its fixture replay; the authored input override is bound separately and is not claimed to be the original weather scenario.

All new tests/helpers/builds/runs stay beneath planner-followup-ebb913d. Historical archives/reports/raw populations remain read-only. The new results and remaining gates are in COMBINED_COSTS.md, RAY_FOLLOWUP.md and DECISION_DELTA.md.

## Repeating the new source probes

Use this report directory as cwd. The ignored runtime/node_modules must contain the exact versions above, copied from an already prepared pinned checkout; these commands do not install or upgrade anything. The whole-face comparison now imports an owned regular runtime/baseline copy instead of a fixed sibling-worktree path. Any unchanged ebb913d LAB directory is accepted as preparation input only if all83 source/package hashes match control-02-build.json and the unchanged fixture test helper has SHA25650876d5023aecc63326f66457113cca5fe2f07c830cb39710efe73b05e09a32b. The original package's fixtures are copied for the baseline loaders and independently validated by their unchanged inventory/replay contracts. An existing baseline destination is rejected; no overwrite or deletion.

```powershell
$rdNode = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe'
$rdBaselineLab = 'C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-RD-resume-2026-10-05/experiments/hestia-rd-2026-10-02'
& $rdNode './prepare-baseline.mjs' $rdBaselineLab
$env:HESTIA_FOLLOWUP_RUN_ID = 'focused-units-fresh-01'
& $rdNode './runtime/node_modules/vitest/vitest.mjs' run --config './vitest.followup.config.mjs'
& $rdNode './runtime/node_modules/typescript/bin/tsc' --project './tsconfig.followup.json' --noEmit
```

The absolute baseline example is a local input, not a required checkout name. On another machine, select any local ebb913d checkout with the bound bytes. Verify all83 files again inside the test. For unchanged original native ray assertions, set HESTIA_FOLLOWUP_SUITE=ray; the same configuration selects tests/RD-13/native.spec.ts without modifying it. REN12 remains the default existing suite. Every invocation requires a new HESTIA_FOLLOWUP_RUN_ID; the main runner reserves that directory and rejects EEXIST before executing tests. Pinned Playwright workers reload the configuration under TEST_WORKER_INDEX and reuse only the main runner's reservation.

```powershell
$env:HESTIA_FOLLOWUP_SUITE = 'ray'
$env:HESTIA_FOLLOWUP_RUN_ID = 'ray-original-assertions-fresh-01'
& $rdNode './runtime/node_modules/playwright/cli.js' test --config './playwright.followup.config.mjs'
```

Native probes require an actual A0 device grant and an owned loopback service serving the selected receipt-bound build. Build a fresh name with build.mjs; it rejects an existing build. The native-abort.html test page calls the real factory directly, bypassing mountExperiment, to verify ready/during-init/before-init abort paths and native cleanup before any explicit handle.dispose. It is report-local test input and is recorded separately in helperSourceHashes. The normal product/tool pages are unchanged. The ray-abort.mjs and ray-followup.mjs commands take a fresh run-ID and its served build name, and reject existing run directories. Do not label a helper population as the unchanged-original-six suite; both reports keep their own denominator and negative cases.

Final review-correction evidence: baseline-prepare-01 verifies/copies84 text files (83 receipt files plus fixture test helper); focused-units-03 is22/22; candidate-original-04 builds83 unchanged-during-build sources and bound helper inputs; fresh typecheck exits0 with empty output. The unchanged original native six run4/6, final helper10/12, direct factory Abort3/3 and missing/reused ID guards5/5 are separate populations. run-guards-01 proves the prior single-file unit report and both existing report directories keep byte-identical hashes. The raw adapted11/12 run and failed sandbox startup logs remain preserved. On this Windows sandbox, local Chromium and Vite's path-helper spawns required the authorized escalation after EPERM; no binary, dependency, source threshold or global configuration was replaced to make them execute.
