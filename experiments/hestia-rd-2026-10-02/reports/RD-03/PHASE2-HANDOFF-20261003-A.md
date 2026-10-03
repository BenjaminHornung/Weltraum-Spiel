# RD-03 optimized phase-two functional handoff — 2026-10-03 A

Status: **OPTIMIZED_PHASE2_FUNCTIONAL_VERIFIED_READY_FOR_HEAD_REVIEW**. This is a local lab handoff, not complete RD-03 selection, target-hardware, art, performance or product acceptance. `productIntegrated: false`.

## Immutable input and scope

- Branch: `feature/hestia-rd-rd03-phase2-2026-10-02`.
- Direct commit parent / phase-two START: `32a0a6b12361c62a60aa31dc7bd24694f352d16c`; tree `993233eba8e62fa2310905ad6032dca6bfb01b02`.
- Product read-only base: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
- HEAD freeze: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/freezes/32a0a6b12361c62a60aa31dc7bd24694f352d16c.json`; SHA-256 `b5c30468d98c7f582a8ada9037db113242d90e2d9334a54878ff8487d5f4442d`. Its bytes matched CURRENT_FREEZE at admission; all 18 actual frozen root files matched.
- Only three own test paths and these two new report paths change. Runtime, CLI implementation, contracts, root configuration/registration, exporters, fixtures and refcards remain unchanged. No delegation, broad inherited test suite, DevToolbox write, publication or foreign cleanup.

The new commit's full SHA, tree, parent and exact five repository-relative paths are bound after commit in the new external `checks/phase2-20261003-a/TERMINAL-RECEIPT.json`; this report does not attempt a circular self-commit binding.

## One reproduced correction and permanent coverage

The original optimized RUN03 failed: element screenshot height was **703**, but `Math.round(css.height)` expected **702**. Native Playwright 1.61.1 encloses document-space edges, not rounded width/height. The test now asserts the exact pinned `floor(origin + 1e-3)` / `ceil(end - 1e-3)` edge differences including scroll position. No resolution, fidelity, tolerance, source, runtime or canonical geometry change was made. The original test pair passed after this correction; RED source, log and failed capture remain retained.

| Path | Change |
| --- | --- |
| `tests/RD-03/browser.spec.ts` | Exact native capture geometry; permanent optimized F00/F01/F04/F05 pause/seek/reset/revision replay, missing-WebGL2 and timer/context-loss coverage. Existing exclusive screenshot admission remains intact. |
| `tests/RD-03/unit.test.ts` | Actual CPU Three owner roots, deleted-owner absence, position/quaternion and namespace/revision bindings at every F04 snapshot. Existing canonical Float64/private Float32 checks remain. |
| `tests/RD-03/cli-browser-terminal.mjs` | Bounded native regression interposing only its own real CLI browser context: required-WebGL2 denial, native context loss, and controlled signal-handler abort after actual rendering; unconditional owned-context cleanup. |

New harness type errors were retained and corrected before the expanded browser run. They were test typing errors, not a second runtime correction.

## Actually exercised

- **PASS:** two focused unit files, 13 tests; fresh typecheck; unchanged native capture-admission regression, eight cases and reused-image callback count zero.
- **PASS:** actual optimized browser suite, five tests, zero retries/skips/flaky/unexpected results. Real RUN03 renders WebGL2 at 1280×720, DPR 1; CSS-space PNG is 1248×703.
- **PASS:** 31 explicit replay states / 31 PNGs across F00/F01/F04/F05. Paused Advance holds frame; visible Seek binds frame, reset tick, scenario/fixture digest, source revision and payload hashes; Reset returns to initial unpaused frame; each scenario disposes owned resources.
- F04 ticks: `0,359,360,719,720,1079,1080,1439,1440,1559,1560,1559,0`. F00/F01/F05 each: `0,120,240,900,1560,0`. Rotation, revisions, namespace and deleted-owner membership are verified against the **actual CPU Three projection**; browser evidence binds complete snapshots and actual renderer geometry/triangle counts. No claim of direct browser scene-object inspection.
- **PASS:** RUN04 20 real mount/dispose cycles, one canvas and zero owned renderer/loop/host-listener/geometry/texture/program counts after each disposal. Canvas UI listeners return to the original `three-lab-error` / `three-lab-rendered` baseline; absolute UI-listener zero is not claimed. Native GPU bytes are unknown, not zero.
- **PASS:** controlled missing WebGL2 fails explicitly before a renderer or loop exists. Controlled absent timer extension has no measurement value. Actual `WEBGL_lose_context` produces a visible loss, no hidden fallback, and owned disposal releases reported resources.
- **PASS:** CPU CLI inspect, six positive optimized CLI samples / PNGs, abort during CPU import, required-capability denial, actual native context loss, and controlled abort after real submitted WebGL2 frames. Signals are `process.emit('SIGINT')` handler probes, **not OS Ctrl-C** proof.

| CLI run | Actual terminal | Planned / attempted / skipped / failed |
| --- | --- | --- |
| `phase2-a-cli-inspect-f04` | PASS, CPU only | 3 / 3 / 0 / 0 |
| `phase2-a-cli-evidence-f04` | PASS, ticks 899–901, same revision | 3 / 3 / 0 / 0 |
| `phase2-a-cli-evidence-transition` | PASS, ticks 1079–1081, real revision at 1080 | 3 / 3 / 0 / 0 |
| `phase2-a-cli-abort-import` | ABORTED | 3 / 0 / 3 / 0 |
| `phase2-a-cli-missing-webgl2` | UNSUPPORTED | 3 / 0 / 3 / 0 |
| `phase2-a-cli-context-loss` | FAILED, expected fault | 2 / 2 / 0 / 1 |
| `phase2-a-cli-abort-rendered` | ABORTED after real rendering | 3 / 0 / 3 / 0 |
| `phase2-a-cli-bench-not-run` | NOT_RUN, no GPU slot | 120 / 0 / 120 / 0 |

The context-loss probe passed because the actual CLI failed closed. The CLI surfaces `TimeoutError: page.waitForFunction: Timeout 15000ms exceeded.` rather than a dedicated context-loss terminal reason; the native loss is separately bound by the real UI/probe. Its retained fault image is **not positive acceptance evidence**. No extra CLI correction was made.

## Optimized build, HTTP and device bindings

Fresh final production build passed: 22 modules, real root diagnostic HTML and `/src/runner/index.html`. All 434 dist files were byte-equal to the initial phase-two build; all 429 canonical public files matched source bytes. The five executable entries were fetched over the strict owned preview and matched dist exactly, again after the final build. CSS is inline and bound by HTML, not an invented external CSS artifact.

| HTTP path | Bytes | SHA-256 |
| --- | ---: | --- |
| `/src/runner/index.html` | 2475 | `2249f2ca8e209337c69baf6711225250800961f0fd11a395a84e45391813057c` |
| `/index.html` | 2126 | `23d648bc6bb531e1c84a9dca44dc42471bf008927ef2d41bd51d88fdb2985d2f` |
| `/assets/rd03-CMpvPTxY.js` | 8480 | `1f54fcfafe9314415c89ccecaff1dd50425900ae75b1976f7baace7528afd645` |
| `/assets/rd00-Yq_PicYR.js` | 5506 | `f1a14326e555ff9a0f0fe933f117e41cf59ebed34d7d1b9b75d8c8a480970e4f` |
| `/assets/three-control-BV4Dtd8b.js` | 549551 | `85918fb7cb3c0c9f166b1bfa284aa82b172a285b37219ba417f0d5b24bb580d0` |

Static Three chunk warning (549.55 kB) is retained, not optimized away and not timing proof. Lock SHA remains `9dc112529df87daa8a3d92a913932d2b0bad131055d8d684d86736bd4409b60c`; inventory SHA remains `26bf86bba1cbd1955d069ab2eac8d491b6cade59d16a004f1d094cc117ebc9c6`.

Observed browser: Chromium `151.0.7922.34`, backend `Three-WebGLRenderer-WebGL2`, unqualified ANGLE Intel Arc Pro 140T / D3D11 metadata. This is headless functional diagnostic evidence, not a qualified hardware lease. Available timer extension does not supply a GPU timing value. Four representative replay images were inspected for actual projection only; no human art acceptance occurred.

## Exact execution and raw receipts

All program paths/workdirs are inside `C:/IFI_SourceCode`. Native binary: `C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe`; npm CLI: its `node_modules/npm/bin/npm-cli.js`; Git: `C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe`; Chromium: `C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe`.

Every invocation used the unchanged owned `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-03/run-check.mjs`, lab cwd `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-worktrees/Hestia-RD-RD03/experiments/hestia-rd-2026-10-02`, process-local C-only PATH and owned TMP/cache. `commands.jsonl` and the terminal receipt retain **exact expanded executable, argv, cwd, environment, UTC, exit and raw-log SHA**, not just these short labels.

- Focused argv: `./node_modules/vitest/vitest.mjs run tests/RD-03/unit.test.ts tests/RD-03/host/unit.test.ts`.
- Type/build npm argv: `run check`; `run build`.
- Admission argv: `./tests/RD-03/capture-admission-regression.mjs phase2-a-admission`.
- Actual browser argv: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-worktrees/Hestia-RD-RD03/experiments/hestia-rd-2026-10-02/node_modules/@playwright/test/cli.js test tests/RD-03/browser.spec.ts`; `HESTIA_RD_TASK=RD-03`, `HESTIA_RD_BROWSER_RUN_ID=phase2-a-browser-expanded`, own fresh TMP/profile roots.
- Positive CLI argv: `./scripts/run-lab.mjs evidence --experiment RD-03 --variant fixture-control --fixture F04-DETACH --scenario F04-DETACH-REPLAY --run phase2-a-cli-evidence-transition --tick 1079 --samples 3`.
- Fault argv: `./tests/RD-03/cli-browser-terminal.mjs <missing-webgl2|context-loss|abort> <fresh explicit phase2-a-cli-id>`; concrete invocations are retained verbatim in the ledger/index.
- Boundary argv: `./scripts/verify-boundary.mjs --task RD-03 --start 32a0a6b12361c62a60aa31dc7bd24694f352d16c --base b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.

| Raw log label | Exit | SHA-256 |
| --- | ---: | --- |
| `phase2-a-browser-base` — genuine optimized RED | 1 | `ccbaf4f5a5b7c34097872762d66db9810c263ab686ebf08e1df558c4ddf6efb6` |
| `phase2-a-browser-green` — same original pair GREEN | 0 | `470e551df21e41f8d5d7c0bc6ad917ae3edbcd0c964d1856e52435e71f88723c` |
| `phase2-a-focused-expanded` | 0 | `69af9efce68fa9b1c96e80d2ed3568ce4b36b58538c09da7481831f74c59b985` |
| `phase2-a-types-expanded` — own harness typing RED | 1 | `4ba6c7ca645382f554504018d48326e69a08b53f7b159c47a6b00f9a7aa0275d` |
| `phase2-a-types-expanded-green` | 0 | `55c814d0e096397f099fe6af3df4cb48543573b7821b3361bbbe5963f2045252` |
| `phase2-a-admission` | 0 | `09ff72cef6545bd919822a05a55523cd7ab549053795ec1e830bdcf38e285048` |
| `phase2-a-browser-expanded` | 0 | `4945fc682bd593206fbdbde21c35efd01e6cc40153fe7d88d986157192cc92a4` |
| `phase2-a-build-final` | 0 | `331220e959b3b133a48a8f6564826c933b8f1145033c78bb313b6dbe4c0c4058` |
| `phase2-a-cli-inspect` | 0 | `d999ef7a8ad1d48928f8ba3a04c8ad02d7954aab3aee4dbd200a851b2692236c` |
| `phase2-a-cli-evidence` | 0 | `212ed0bb9e6133ea3522f9c610086ef2e4d0b6058bdf6fcdb081d3e19ba7c9d3` |
| `phase2-a-cli-evidence-transition` | 0 | `319c9762a695cf9025e5b4f2703f11f179e47bb1723c2919ae52e0b7df003ffc` |
| `phase2-a-cli-abort-import` | 0 | `f9f21f85c9b88ae314379c750f55b923db15ed82a8806397069ee2b320503cc5` |
| `phase2-a-cli-missing-webgl2` | 0 | `a86d7db495beda31503c855526a92f4456e342f7bcea050c6a4392b6fa09673b` |
| `phase2-a-cli-context-loss` — expected FAILED terminal | 0 | `0a533a914a9a72293cdd0a2dd59cec38b3f1513ac315f166f5d9d74ec8744018` |
| `phase2-a-cli-abort-rendered` | 0 | `3dd23dd88a5ea98319419e65c3719911e62ca1b7b14dfbd1a7e068d7bee79956` |
| `phase2-a-cli-bench-not-run` | 0 | `fb82e672c60865bd6226b88bdeb57409d198d71486ec910422b82cee11c6815a` |
| `phase2-a-evidence-bindings` | 0 | `d05f1f376cd37637f849f398dd60b0a83bab1881a2ed42fa6d8ba193ec1d9196` |
| `phase2-a-retained` | 0 | `e374a884b47ca25a84ab5b03f5b6f74b646f48c1d1f60600d26359c309f37e20` |
| `phase2-a-cleanup-port-free` | 0 | `ab398982083bd9ee341327f392a8002e062bec83f3e044f7b05c364718aecdbc` |

## Additive evidence and retention

Owned root: `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-03`. New authoritative index: `checks/phase2-20261003-a/evidence-index-phase2.json`, SHA `126f7359ebfbf88e9352da5ddbab2d48a6bc9e1b4649f4e17964dc0a7b3899be`. It binds 19 source/build-input files, all dist bytes, served bytes, tested sources, device diagnostics, 32 positive browser PNGs, six positive CLI PNGs, fault/status outputs and exact raw commands. Dist and profile bytes are not confused; new profiles/cache/temp are not claimed as fully indexed.

Old phase-one code truth remains `0857c4ce1232c66d7e7b4f4dbad20f6249d2e677`; old report/index/receipts were never rebound. Retention proof `checks/phase2-20261003-a/retained-verification.json` SHA `ed230b9c7bca079ddb6a6eb9ebd0e7ec4ca295b209b9f79cb96ece03465a70be` checks 18 shared roots, 429 canonical files, five old reports, 191 old evidence files plus the prior repair's 1209 old files including retained profile bytes (overlap, not a sum), old helpers, 12 old link targets as metadata only, and the old command-ledger prefix.

| Retained artifact | Unchanged SHA-256 |
| --- | --- |
| `reports/RD-03/CODE-RECEIPT.json` | `f5c9bce2ee1014435c0ca0831d289dc692bc843996af8edea02d1aeb49774118` |
| `checks/evidence-index.json` | `71f6d2ba982060f6e084255fa3e24865401fa0f52e3003705347a5b87dd78d8a` |
| `checks/FINAL-RECEIPT.json` | `8add12adb7017114ec496617de5ad2704b5cfe6b418d9ceea692923011a3e02a` |
| `checks/repair-so01-p1-20261003-a/TERMINAL-RECEIPT.json` | `4ab7aacc9b334261d0251d134ce927a9fcbd4f329c7749428c330603b25d9389` |

Historical broad-unit external artifact-scope **FAIL remains FAIL**, explicitly recorded in `checks/scope-deviation.json`. HEAD retained the ten additive program oracles after bounded metadata inspection; that is not historical complete mutation-freedom proof or retroactive PASS. No broad suite was rerun and no foreign directory was cleaned.

## Cleanup, review and remaining acceptance

Owned managed preview `bg_mus3tawa_3o` / pid 41660 only was stopped; final managed status `cancelled`, no kill errors. Fresh native port guard proves 127.0.0.1:5280 free. `SERVICE-LIFECYCLE.json` SHA `571381d291d38fdfeba46dd94ddf2cbf318070b888438ca216db56e810bf0915` binds startup/stop/output. The first literal readiness wait timed out on ANSI URL formatting; actual HTTP byte readiness passed, without a restart or polling loop. Owned CLI contexts and native Vite loaders closed; persistent profiles/probes remain retained. No foreign context/tab/process cleanup.

Leaf self-review only. HEAD's earlier independent SO01 capture-repair acceptance is historical, not a new phase-two review. The final staged diff, whitespace, post-commit scoped boundary and full Git identities are recorded separately in the terminal receipt.

- **NOT_RUN:** qualified GPU benchmark, empty/active timing qualification, native GPU allocation measurement, target-hardware and human art acceptance. Benchmark records honest 120 planned / 120 skipped samples and supplies no values. Captures do not qualify timing.
- **NOT APPLICABLE:** product integration/deployment/publication for this leaf; `productIntegrated` stays false.
- PCF/sky/water hooks and unsupported material parity remain explicit exclusions. Canonical Float64 F05 bytes, private Float32 projection tolerance `1e-5`, shared authority boundaries and quality remain unchanged.
- HEAD's actual static RD03 registration, package aliases and Vite8 real dual HTML inputs remain unchanged. Use `/src/runner/index.html`, `/inventory.json` and root `/Fxx-…/…`; no `/rd03` alias or `/fixtures` root. No additional shared-wiring delta is requested.

Next owner: HEAD review/integration of the new local child commit; art/performance/product acceptance stays separate and pending. This handoff adds no authorization for those activities.
