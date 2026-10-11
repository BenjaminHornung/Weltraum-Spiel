# W06 implementation report

Status: implementation/targeted verification PASS; final independent SPEC/QUALITY gate NOT_RUN (Root receipt pending). No W03 or later package writes are started.

Agent: `/root/fp06_integrator` — sole shared Host/Physics/Save/Contract integrator.
Branch: `codex/hestia-fp06-integrator-2026-10-11`.
Worktree: `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`.
Reviewed W01 predecessor: `a30630dd7963c165c673df7ea1b46d52735752ef` (W00 predecessor `656c52458eff15133025bb21dc3e5b7b708cfbf7`).
W06 code/evidence commit: `5b596f932dc769052e17603965d0179a4937d948`.
Evidence-only packaging/command clarification commit: `2c044e02f1f31a2db3de3a0df9156bd71a431a7a`. It corrects the exact executed Browser env/workdir and explicitly tracks the three formerly ignored successful-run artifacts, with a truthful packaging receipt. Product bytes unchanged.

W06 introduces `/factory.html` through the existing HVP composition with exactly one renderer/native World, confirmed six-tick clock, safe pause/lifecycle and explicit legacy-persistence refusal. Native holds are visible without work credit; transient waits remain quiescent for Neighbor repair, terminal RecoveryHold remains closed to Resume/work and can safely await disposal. All Factory native restart paths (Resume, Drop, Play and player pause-dialog continuation) share the actual confirmed ReadView guard. Post-end restart preserves the Factory route. Catalog loading grants no cargo/materials and installs no devices. Main/legacy routes retain their original imports/behavior; no source-site rewrite, engine/dependency/native-save changes or budget/timeout increases occur.

## Actual product changes

- `apps/weltraum-browser/factory.html`
- `apps/weltraum-browser/src/factory/factoryEntry.ts`
- `apps/weltraum-browser/src/factory/session/hostPort.ts`
- `apps/weltraum-browser/src/factory/session/factorySession.ts`
- `apps/weltraum-browser/tests/unit/factory/hostLifecycle.test.ts`
- `apps/weltraum-browser/tests/e2e/factory-host.spec.ts`
- `tools/factory/verify-evidence.mjs`
- `apps/weltraum-browser/src/hvp/hvpBootstrap.ts`
- `apps/weltraum-browser/tests/unit/hvp-bootstrap.test.ts`
- `apps/weltraum-browser/package.json`
- `apps/weltraum-browser/vite.config.ts`
- `.github/workflows/browser-mainline-ci.yml`

All remaining changed paths are the single actual W06 evidence run below (283 evidence files in the initial code commit;287 final evidence paths after the five-file packaging follow-up). Final NUL-separated Git scope audit proves exactly12 product +287 evidence files and no outside-scope paths. Worktree is clean after the final evidence-only commit. Historical W00/W01 evidence is unchanged. 234 pre-existing top-level browser evidence paths remain hash-identical; no restore was needed.

## Actual TDD and verification

Collected business REDs resolved imports and actually ran their assertion bodies; setup/import/cwd failures are preserved separately and are not counted as business RED.

| Phase | Command/test scope | Actual outcome |
|---|---|---|
| Initial clock RED | hostLifecycle.test.ts | 6 actual body failures, exit1 |
| Actual optional-bootstrap RED | hvp-bootstrap.test.ts, targeted hook |1FAIL/26skipped, exit1 |
| Initial real Browser entry RED | actual /factory.html before entry | normal route1PASS/Factory1FAIL, exit1 |
| Native-hold extension RED | hostLifecycle.test.ts |1FAIL/6PASS, exit1 |
| Recursive evidence / entrybudget REDs | own collected evidence cases |expected failures; logs preserved |
| Initial complete affected GREEN | two Host/clock files |36PASS, exit0,191.50s |
| Initial fresh full unit suite | npm --prefix apps/weltraum-browser run test |197 files/1835 tests PASS, exit0,646.37s; strictly before review fixes |
| Initial/final-preDrop build | npm --prefix apps/weltraum-browser run build |tsc+Vite PASS, exit0; actual dist/factory.html; existing chunkwarning unchanged |
| R1–R4 complete RED | actualBootstrap + session/manifest cases |8FAIL/39skipped; all three Resume/HUD paths and all four manifest negatives executed; exit1 |
| Additional player/terminal RED | actualBootstrap player pointerlock/terminal end |2FAIL/31skipped, then separate player-dialog1FAIL/32skipped; exit1 |
| Post R1–R4 targeted GREEN | two Host files -t W06/FP06 W06 |24PASS/26skipped, exit0,58.53s |
| Post R1–R4 complete affected GREEN | both full files |50PASS, exit0,214.34s; before final Dropguard extension |
| Real serial Browser flow | factory-host.spec.ts |7PASS, exit0,2.0min; one owned Context/page; before final Dropguard extension |
| Final Drop business RED | actualBootstrap all3hold Drop paths + valid-manifest budgetoracles |1FAIL/2PASS/48skipped, exit1; three separately recorded held-Drop dispatch failures |
| Final targeted GREEN | actual Drop/Resume/player/budgetoracles |4PASS/47skipped, exit0,22.09s |
| Final complete TypeScript | npm --prefix apps/weltraum-browser exec -- tsc -p apps/weltraum-browser/tsconfig.json |PASS, exit0, source/tests/config included |
| Existing CI group parser | unchanged actual parser + package scripts |42 concrete spec paths assigned exactly once, exit0 |
| Complete staged diff | git diff --cached --check reviewedbase |PASS, exit0 after evidence EOF normalization; first whitespace diagnosis and raw logs preserved |
| Scope | exact NUL-separated paths |12product/287final own evidence,299total paths, no outside paths |
| Whole recursive Factory admission | node tools/factory/verify-evidence.mjs apps/weltraum-browser/evidence/factory |PASS, exit0; actual final JSON below |

No broad full-suite/Browser repeat was performed after the final sole held-Drop guard extension: Root explicitly requested the genuine Host-negative/counterprobe, existing Resume/Play regression and full TypeScript validation. `browser-byte-binding.json` records the exact preDrop byte basis and three later changed paths. There is no claim that 1835 tests or seven Browser cases ran on the final Drop bytes.

The actual Browser cases passed normal/legacy import isolation (19.1s), Factory entry (12.7s), duplicate-host worker/renderer rejection (9.4s), native Pause plus12real presentation rAFs (24.2s), all3legacy Save/Load/new-load refusals (29.4s), Resume of that same paused session (14.2s), and actual native teardown (5.3s). Original30s test/5s expect/20s server startup, original retries/workers/Chromium/trace settings remain. An external Root helper leased only5174; no unknown5173 process was stopped. Explicit context tracing conflicted with Playwright's existing automatic tracing in one preserved failed harness run, then only redundant manual tracing was removed. Final Browser7/7 uses normal runner tracing. Port5174/CPU were released after runner exit and real free-port confirmation.

Visual screenshot was inspected: one existing HVP scene and one honest paused workshop panel. Actual native disposal receipt has stateDisposed, no errors and zero workers/timers/listeners/pendingJobs/bodies/colliders/ownedBytes. Construction/production/combined-save are honestly pending later packages, no test bridge or second World/renderer exists.

## Review and evidence

Actual run: `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z`.

`manifest.json` binds actual local sources/inputs/product snapshot/raw patch/logs/Browser images/receipts/traces with SHA256 and exact optional byte counts. Raw changed text remains in gzip; readable text strips trailing whitespace/extra blank EOF lines. Existing W00/W01 manifests pass unchanged. The Checker validates bounded local artifact admission, not historical HEAD bytes, test truth or gameplay release completeness. Historical productFiles are declared path/hash receipts; external fields are not dereferenced and no Git-history/network lookup is required. Existing CI checkout already has lfs:true/fetch-depth1.

Review provenance: independent-review-first.md (R1–R4 FAIL on first code), independent-review-followup.md (R1/R3/R4 closed, Drop finding), self-review.md, final product-final-hashes.json / product-final.patch.raw.gz / product-final-unified0.patch. Final independent restreview receipt is still pending Root. Raw failed browser traces/reports, all setup failures, collected RED/GREEN logs, Source-Lock/Grant/catalog snapshots and commit-bound evidence are retained, not overwritten.

Final admission stdout after committed packaging/command clarification:

```json
{"entries":394,"files":347,"jsonFiles":38,"manifests":4,"referencedFiles":342,"totalBytes":84825299,"limits":{"depth":12,"entries":4096,"files":4096,"fileBytes":33554432,"jsonBytes":8388608,"totalBytes":268435456},"historicalProductReceipts":"path/hash form only; immutable run artifacts are verified, historical HEAD bytes are not reread"}
```

No open product or packaging blocker remains within W06 after the Dropfix/follow-up; independent final receipt remains pending Root. Actual HEAD binding checks all286 manifest references against205 Gitblobs and81 LFS SHA256 oid/size receipts with no missing path or byte mismatch. The bounded local verifier also passes. The final clean HEAD is `2c044e02f1f31a2db3de3a0df9156bd71a431a7a`. Performance NOT_RUN: no comparable baseline/candidate gate; no performance PASS follows from software-renderer trace latency or harness reorganization. W03 is the next separately granted dependency-ready package; no W03 productwrites occurred.

## Complete actual final change list

- `.github/workflows/browser-mainline-ci.yml`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/artifact-admission-before-receipt.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/artifact-normalization.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/before-drop-product-hashes.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/browser-byte-binding.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/browser-host-clock.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/browser-host-disposal.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/browser-serial-timing-diagnostics.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/build-missing-import-build.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/build-missing-import-build.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/build-r1-final.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/build-r1-final.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/build-r1-final.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/build.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/build.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/build.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/ci-group-membership.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/ci-group-membership.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/command-outcomes.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/factory-flow-trace.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/factory-single-host.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-green-browser.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-green-browser.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-green-browser.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-output/.last-run.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-output/factory-host-T026–T028-rea-80886-only-confirmed-native-ticks-chromium/error-context.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-output/factory-host-T026–T028-rea-80886-only-confirmed-native-ticks-chromium/error-context.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-output/factory-host-T026–T028-rea-80886-only-confirmed-native-ticks-chromium/test-failed-1.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-output/factory-host-T026–T028-rea-80886-only-confirmed-native-ticks-chromium/trace.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/data/665fea70a0aa3c9a98164e6d167dcea49f711578.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/data/916fdd9374cb82e4a016cf92f6e86fe6373c7a72.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/data/916fdd9374cb82e4a016cf92f6e86fe6373c7a72.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/data/be49ba5020f38a708c122744cc8082f7a7fc46ed.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/index.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/assets/codeMirrorModule-LEHpjmcn.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/assets/defaultSettingsView-BNmKHKpQ.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/assets/urlMatch-BYQrIQwR.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/codeMirrorModule.DYBRYzYX.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/codicon.DCmgc-ay.ttf`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/defaultSettingsView.CjdS-WJx.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/index.CzXZzn5A.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/index.DMMX1gXU.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/index.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/manifest.webmanifest`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/playwright-logo.svg`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/snapshot.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/snapshot.v8KI4P3m.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/sw.bundle.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/uiMode.BZQ54Kgt.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/uiMode.Ut8wwJNp.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/uiMode.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-combined-30s-playwright-report/trace/xtermModule.DYP7pi_n.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-output/.last-run.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-output/factory-host-one-actual-Fa-a3b6a-ry-entry-reaches-Ready-once-chromium/error-context.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-output/factory-host-one-actual-Fa-a3b6a-ry-entry-reaches-Ready-once-chromium/error-context.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-output/factory-host-one-actual-Fa-a3b6a-ry-entry-reaches-Ready-once-chromium/trace.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/data/20f76aa3bee718d26c9bab518f710f500dd97755.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/data/c926ccd454ba501a9f82faeb4bdf470c5e18f688.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/data/c926ccd454ba501a9f82faeb4bdf470c5e18f688.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/index.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/assets/codeMirrorModule-LEHpjmcn.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/assets/defaultSettingsView-BNmKHKpQ.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/assets/urlMatch-BYQrIQwR.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/codeMirrorModule.DYBRYzYX.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/codicon.DCmgc-ay.ttf`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/defaultSettingsView.CjdS-WJx.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/index.CzXZzn5A.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/index.DMMX1gXU.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/index.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/manifest.webmanifest`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/playwright-logo.svg`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/snapshot.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/snapshot.v8KI4P3m.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/sw.bundle.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/uiMode.BZQ54Kgt.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/uiMode.Ut8wwJNp.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/uiMode.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-double-tracing-playwright-report/trace/xtermModule.DYP7pi_n.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-green-browser.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-green-browser.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-green-browser.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-output/.last-run.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-output/factory-host-T026–T028-rea-80886-only-confirmed-native-ticks-chromium/error-context.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-output/factory-host-T026–T028-rea-80886-only-confirmed-native-ticks-chromium/error-context.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-output/factory-host-T026–T028-rea-80886-only-confirmed-native-ticks-chromium/test-failed-1.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-output/factory-host-T026–T028-rea-80886-only-confirmed-native-ticks-chromium/trace.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/data/6e8cd61acd0638644537fd447bd40b1a55896bcd.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/data/6e8cd61acd0638644537fd447bd40b1a55896bcd.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/data/bc502a52899189ed74493eb26ce6595ab304c0e7.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/data/e9f5f9dbd2a8123011d47c59d02a2cf4e9a4c8b3.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/index.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/assets/codeMirrorModule-LEHpjmcn.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/assets/defaultSettingsView-BNmKHKpQ.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/assets/urlMatch-BYQrIQwR.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/codeMirrorModule.DYBRYzYX.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/codicon.DCmgc-ay.ttf`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/defaultSettingsView.CjdS-WJx.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/index.CzXZzn5A.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/index.DMMX1gXU.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/index.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/manifest.webmanifest`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/playwright-logo.svg`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/snapshot.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/snapshot.v8KI4P3m.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/sw.bundle.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/uiMode.BZQ54Kgt.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/uiMode.Ut8wwJNp.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/uiMode.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-import-hmr-playwright-report/trace/xtermModule.DYP7pi_n.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-browser-host-clock.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-browser-host-disposal.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-factory-single-host.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-output/.last-run.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-output/factory-host-Factory-expli-e6950-the-same-paused-native-host-chromium/error-context.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-output/factory-host-Factory-expli-e6950-the-same-paused-native-host-chromium/error-context.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-output/factory-host-Factory-expli-e6950-the-same-paused-native-host-chromium/test-failed-1.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-output/factory-host-Factory-expli-e6950-the-same-paused-native-host-chromium/trace.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-output/factory-host-Factory-refus-4c1b3-paths-with-an-honest-reason-chromium/error-context.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-output/factory-host-Factory-refus-4c1b3-paths-with-an-honest-reason-chromium/error-context.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-output/factory-host-Factory-refus-4c1b3-paths-with-an-honest-reason-chromium/test-failed-1.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-output/factory-host-Factory-refus-4c1b3-paths-with-an-honest-reason-chromium/trace.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-output/factory-host-T028-native-p-8acd7-through-presentation-frames-chromium/error-context.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-output/factory-host-T028-native-p-8acd7-through-presentation-frames-chromium/error-context.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-output/factory-host-T028-native-p-8acd7-through-presentation-frames-chromium/test-failed-1.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-output/factory-host-T028-native-p-8acd7-through-presentation-frames-chromium/trace.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/data/21349fede6917692095e52e269a65d764d598fc6.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/data/21349fede6917692095e52e269a65d764d598fc6.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/data/2b54e6f7352c4ba08859ac291f968bfd0e6cdd8f.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/data/357fb9400f619264e8b140cd9e8b52e9422be37e.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/data/4e670a4aeb458a07e529c18f5b0a4385e257f29b.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/data/63a501ff06c3883da65497811ad3eb0cf87e2a3b.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/data/63a501ff06c3883da65497811ad3eb0cf87e2a3b.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/data/665fea70a0aa3c9a98164e6d167dcea49f711578.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/data/7b9e4d457f62e544fe6fa8f4102042bb8400a478.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/data/9188fff3861eafe69d21716dea4d0130aff21f68.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/data/9188fff3861eafe69d21716dea4d0130aff21f68.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/data/e9f5f9dbd2a8123011d47c59d02a2cf4e9a4c8b3.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/index.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/assets/codeMirrorModule-LEHpjmcn.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/assets/defaultSettingsView-BNmKHKpQ.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/assets/urlMatch-BYQrIQwR.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/codeMirrorModule.DYBRYzYX.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/codicon.DCmgc-ay.ttf`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/defaultSettingsView.CjdS-WJx.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/index.CzXZzn5A.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/index.DMMX1gXU.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/index.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/manifest.webmanifest`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/playwright-logo.svg`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/snapshot.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/snapshot.v8KI4P3m.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/sw.bundle.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/uiMode.BZQ54Kgt.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/uiMode.Ut8wwJNp.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/uiMode.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/failed-independent-30s-playwright-report/trace/xtermModule.DYP7pi_n.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/first-review-product-hashes.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/first-review-product.patch.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/full-staged-diff-check-first.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/full-staged-diff-check-first.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/full-staged-diff-check-first.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-browser-r1-serial-runner-trace.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-browser-r1-serial-runner-trace.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-browser-r1-serial-runner-trace.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-browser-r1-serial.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-browser-r1-serial.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-browser-r1-serial.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-browser.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-browser.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-browser.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-final-session-evidence.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-final-session-evidence.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-final-session-evidence.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-focused.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-focused.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-focused.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-full-unit.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-full-unit.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-full-unit.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-host-regressions.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-host-regressions.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-host-regressions.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-r1-host-regressions.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-r1-host-regressions.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-r1-host-regressions.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-r1-targeted.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-r1-targeted.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-r1-targeted.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-r2-drop-and-resume-budget.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-r2-drop-and-resume-budget.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-r2-drop-and-resume-budget.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-session-evidence.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-session-evidence.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/green-session-evidence.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/historical-evidence-after-r1-browser.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/historical-evidence-before-browser.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/historical-evidence-before-r1-browser.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/incoming-bindings.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/incoming-catalog-canonical.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/incoming-source-lock.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/independent-review-first.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/independent-review-followup.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/manifest.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/packaging-receipt.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/playwright-environment-config.mts.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/playwright-output/.last-run.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/playwright-report/data/665fea70a0aa3c9a98164e6d167dcea49f711578.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/playwright-report/index.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/product-diff-check.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/product-final-hashes.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/product-final-unified0.patch`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/product-final.patch.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-browser.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-browser.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-browser.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-directory-budget.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-directory-budget.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-directory-budget.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-host-hook.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-host-hook.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-host-hook.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-native-hold.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-native-hold.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-native-hold.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-output/.last-run.json`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-output/factory-host-T026–T028-rea-80886-only-confirmed-native-ticks-chromium/error-context.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-output/factory-host-T026–T028-rea-80886-only-confirmed-native-ticks-chromium/error-context.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-output/factory-host-T026–T028-rea-80886-only-confirmed-native-ticks-chromium/test-failed-1.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-output/factory-host-T026–T028-rea-80886-only-confirmed-native-ticks-chromium/trace.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/data/7b743ee710a35fac345ccb1df984ce923b21510d.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/data/7b743ee710a35fac345ccb1df984ce923b21510d.md.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/data/95cc06a57f6d86ff67c289631875b2b1de671496.zip`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/data/e68eb121b05c2060be05dfadf10e145a8f30e2ab.png`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/index.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/assets/codeMirrorModule-LEHpjmcn.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/assets/defaultSettingsView-BNmKHKpQ.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/assets/urlMatch-BYQrIQwR.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/codeMirrorModule.DYBRYzYX.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/codicon.DCmgc-ay.ttf`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/defaultSettingsView.CjdS-WJx.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/index.CzXZzn5A.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/index.DMMX1gXU.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/index.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/manifest.webmanifest`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/playwright-logo.svg`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/snapshot.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/snapshot.v8KI4P3m.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/sw.bundle.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/uiMode.BZQ54Kgt.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/uiMode.Ut8wwJNp.js`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/uiMode.html`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-playwright-report/trace/xtermModule.DYP7pi_n.css`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r1-complete-paths.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r1-complete-paths.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r1-complete-paths.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r1-host-and-manifest.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r1-host-and-manifest.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r1-host-and-manifest.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r1-player-and-terminal-end.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r1-player-and-terminal-end.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r1-player-and-terminal-end.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r1-player-dialog-path.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r1-player-dialog-path.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r1-player-dialog-path.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r2-drop-and-budget-cause.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r2-drop-and-budget-cause.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-r2-drop-and-budget-cause.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-recursive-evidence.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-recursive-evidence.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-recursive-evidence.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-session.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-session.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/red-session.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/self-review.md`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/setup-fixture-call-red-session.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/setup-fixture-call-red-session.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/setup-fixture-call-red-session.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/setup-root-npm-green-session.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/setup-root-npm-green-session.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/setup-wrong-working-directory-red-session.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/setup-wrong-working-directory-red-session.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/setup-wrong-working-directory-red-session.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/typecheck-final.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/typecheck-final.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/typecheck-r2-final.exitcode`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/typecheck-r2-final.txt`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/typecheck-r2-final.txt.raw.gz`
- `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/w06-grant.json`
- `apps/weltraum-browser/factory.html`
- `apps/weltraum-browser/package.json`
- `apps/weltraum-browser/src/factory/factoryEntry.ts`
- `apps/weltraum-browser/src/factory/session/factorySession.ts`
- `apps/weltraum-browser/src/factory/session/hostPort.ts`
- `apps/weltraum-browser/src/hvp/hvpBootstrap.ts`
- `apps/weltraum-browser/tests/e2e/factory-host.spec.ts`
- `apps/weltraum-browser/tests/unit/factory/hostLifecycle.test.ts`
- `apps/weltraum-browser/tests/unit/hvp-bootstrap.test.ts`
- `apps/weltraum-browser/vite.config.ts`
- `tools/factory/verify-evidence.mjs`
