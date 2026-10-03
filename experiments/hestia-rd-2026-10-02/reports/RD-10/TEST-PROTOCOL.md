# RD-10 Phase 1 verification and evidence

Terminal candidate state: **READY_FOR_HEAD_WIRING**, not whole-RD10 acceptance.
ProductIntegrated=false. No delegation, fabricated child start, foreign
checkout access, publication or service/global/product configuration writes.
One sequential heavy job at a time; no GPU/benchmark lease was claimed.

## Environment and exact commands

All commands use this working directory:
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-worktrees/Hestia-RD-RD10/experiments/hestia-rd-2026-10-02`.
Prefix each invocation below with the explicit command:

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe'
```

| Invocation after the prefix | Result / exit |
|---|---|
| `reports/RD-10/run.mjs install-01 install` | PASS/0: own lab npm ci, legacy-peer-deps, ignore-scripts, no-audit, no-fund; no pin/lock change |
| `reports/RD-10/run.mjs unit-behavior-red-final unit` | EXPECTED_FAIL/1:14 observed,6 behavior assertions failed,8 passed,0 skipped |
| `reports/RD-10/run.mjs unit-behavior-green-final unit` | PASS/0: same oracle,14 observed/passed,0 failed/skipped |
| `reports/RD-10/run.mjs check-final check` | PASS/0: own lab root noEmit types; executes no sibling tests |
| `reports/RD-10/run.mjs types-final types` | PASS/0: focused RD10 noEmit types |
| `reports/RD-10/run.mjs build-existing-entries-01 build` | PASS/0: actual RD00/RD03 entries only, **not RD10 optimized evidence** |
| `reports/RD-10/run.mjs inspection-03 inspect` | PASS/0:18 shared bytes,13 official/immutable source records, actual fixture/payload/scenario byte bindings |
| `reports/RD-10/run.mjs port-dev-final port` | PASS/0: free strict127.0.0.1:5280 before managed start |
| `reports/RD-10/run.mjs serve-dev-final serve` | Managed ready; deliberate cleanup/cancelled exit1, **not successful server completion** |
| `reports/RD-10/run.mjs browser-dev-final browser` | PASS/0:4 observed/passed,0 failed/skipped; explicitly DEV/unqualified |
| `reports/RD-10/run.mjs port-after-dev-final port` | PASS/0: free5280 after owned service cleanup |
| `reports/RD-10/run.mjs audit-final audit` | PASS/0: raw log, source/oracle/browser/screenshot hashes verified; reports generated once |

Final boundary/local-commit receipts are in the external `candidate.json` and
`commands/guard-final`, `commands/candidate-final`. The boundary command uses
exact `--task RD-10 --start 4788520ef7cecc5db62da8d51f0daaa8ac8bdd09
--base b3c6523a94cd050f5a9a22dc27f4777fcc03363e`; no sibling wrappers were run.
The final full candidate SHA/tree/parent/file hash list is external to avoid
self-referential commit bytes.

Every ordinary command has exact binary/args/cwd, exit, timestamps, source/test
bindings, raw.log bytes and SHA256 at
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10/commands/<label>/`.
PATH contains only the pinned C-tree Node/Git/PowerShell locations; npm shell
is C-tree PowerShell. TEMP/cache and browser profiles/output are task-owned.
No newly installed dependency, global config, package/lock or source input edit.

## Behavioral RED/GREEN

Permanent `unit.test.ts` and `browser.spec.ts` were created before the factory.
The three temporary own-factory faults were: (1) missing GPU falsely returns
supported/Native-WebGPU/submission1, (2) GPU time is fabricated measured0,
(3) localStorage write is intercepted by a task-local Node guarded double.
No actual product/global configuration or browser run was used for these faults.

Primary final RED factory SHA256:
`8a21a426c9bd59f18f6d389a7fdd27fc2cb8e18e7cb07446107df95d3217e581`.
Restored GREEN factory SHA256:
`b74bec31f5a21ccee00e325ea12999854e700926d427bf8605bc582b5ec25578`.
Unchanged final oracle SHA256:
`7d607e443e00e2db4202612734f8115ed50fd446588320a9247e777561e07b3b`.
Final RED raw log SHA256:
`bf2cecfa58e9108ffa7e995f92cf8e9b1ad6464f9ff94b8ca80e8e756b97a8c3`.
Final GREEN raw log SHA256:
`998dbb211054dc9467b29069a5cb5f019b71b742f920b7e69947c89e41000a4f`.

The RED failures are CAP01 missing GPU, CAP02 unknown identity, software
identity, extension timer, adapter timer (4 total), and CAP03 guarded storage.
Device/pipeline/submission, rejected/null adapter, partial compile cleanup,
double mount, fresh-canvas restriction, aborted late device cleanup,
60Hz/revision validation and real F01/F04/F06 private imports also run.

Earlier raw failures are retained, not recast as success: `types-01` failed
compile and is **not behavior RED**; fixed native DOM canvas-overload narrowing,
async state check and browser-double typing. First12-test controlled RED had
12 failures because assertion exits skipped disposal and contaminated later
tests; afterEach now always disposes owned handles. Its original denominator
remains12/12 failed. Second unchanged-oracle pair was5/12 expected failures
then12/12 GREEN. Final expanded14-test pair above is the acceptance oracle.
`inspection-01/02` failed over-specific source-token assertions, not runtime
tests; inspected actual local/official code (`await backend.init` and Babylon's
promise requestAdapter chain), corrected matching, inspection03 PASS. An ANSI
escape split the first server readiness regex; one changed regex matched the
actual loopback line. No identical failed command was blindly repeated.

## Browser evidence and cleanup

Fresh task-owned persistent profiles, pinned Chromium151.0.7922.34, headless,
1280×720/DPR1,320×180 probe canvas. No capability-policy toggles or shader/CDN
requests. Browser requests stay at the strict loopback origin; profile/context
cleanup targets only instances created by these tests.

Final run path:
`RD-10/browser/browser-dev-final/results/browser-NATIVE01-actual-na-bc898-e-availability-and-captures/`.
CAP01 runs3 controlled attempts; CAP02 one masked extension/identity attempt;
CAP03 four real repeated open/close cycles; NATIVE01 both unmodified real modes.
Total10 owned cycles,0 failed,0 skipped. Context/device initialization and
actual triangle submission—not API property presence—are observed.
Disposed report counters and mounted count reach0; native driver bytes remain
unsupported, not inferred from these logical counters.

Screenshot hashes: WebGL2
`b1a1085b73a61ed5cb695c913dcdc2dabb69110f44b09476b445361e4b580863`;
WebGPU `cd9d94995d51cd24d4ce792eec9fe1e1e6c5370d501d342d6552541485f9c3ce`.
Both final screenshots inspected: triangle, mode/actual backend, explicit
diagnostic/non-target qualification and truthful report visible.

Managed own server IDs `bg_mus9izst_4e` (initial DEV) and `bg_musa3e3s_4h`
(final DEV) are cancelled, exit1 by deliberate owned shutdown. Their managed
raw output/hash/exit receipts are retained. Each browser context closed via
its owning fixture; no foreign tab, browser/context/process shutdown.
5280 is free after cleanup. Retained artifacts: npm cache/temp, fresh profiles,
raw logs, source text, screenshots; own lab node_modules/dist/.vite are retained.
No original evidence or automatic throughput logs were deleted or staged.

## Limits / skipped checks

Self-review corrected the comparison API notation to exact package entry plus
named export (`three`/`WebGLRenderer`, `three/webgpu`/`WebGPURenderer`, material
entry `three/tsl`), not nonexistent package subpaths. Original inspection03
freeze bytes/hash are retained externally as
`inspection/inspection-03/comparison-freeze-before-api-notation-review.json`.
Corrected freeze SHA256 is
`af25f55d1501ca24ab87f79d066c372788de603533f5e152aec74b2d44f32e1f`;
capability/handoff bindings updated explicitly; runtime/test bytes unchanged.
Source inspector now uses the same corrected notation. Fresh terminal receipt
rechecks all source/raw/report/freeze bindings before claiming completion.

Post-review closing commands (same CNode prefix/cwd above):
`binding-final validate` PASS (18 frozen files,13 raw sources, unchanged oracle,
corrected report hashes); `unit-review-final unit` PASS14/14,0fail/skip;
`check-review-final check` PASS; `build-review-existing-entries build` PASS
RD00/RD03 only, identical asset hashes, existing >500k warning retained.
`binding-terminal validate` rechecked current installed source, all retained
raw sources, report/freeze/oracle bindings and rebuilt file/gzip bytes PASS.
`port-terminal port` PASS: strict127.0.0.1:5280 free. Staged boundary and post-commit `candidate`
receipt are authoritative for final cleanup/scope/SHA/tree/parent/path bindings.

- Optimized RD10 browser: **NOT_RUN_PENDING_WIRING**, not NOT_APPLICABLE.
- C0/C1/C2 render comparisons, timers, target GPU, native GPU bytes, performance
  lease, human art/product acceptance: NOT_RUN or UNSUPPORTED as stated.
- CAP03 guards task-local APIs and selected lock/frozen bytes, not an exhaustive
  browser/agent global-config audit. Actual global config was not mutated.
- Broad inherited units/product app install/build/tests: NOT_RUN, prohibited.
- Independent/human review: NOT_RUN; self-diff/source/evidence review only.
- Root build's existing >500kB chunk warning retained, no out-of-scope refactor.
- DevToolbox execution/spec tracking NOT_RUN: not authorized for this leaf;
  equivalent scoped plan, receipts, fresh tests/build/hash/guard are provided.
- Original all-files gate remains FAIL_ACCEPTED_NARROW_EXCEPTION for automatic
  regular untracked throughput logs only; never claim all-files-clean.
