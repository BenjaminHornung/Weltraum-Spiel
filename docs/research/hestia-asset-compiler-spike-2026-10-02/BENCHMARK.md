# Bounded diagnostic benchmarks — immutable C7 and current C8, no qualification

Gate/package/path date **2026-10-02**, execution/closure2026-10-03. Original C7 measurements retain parent `1b652cf5b215259ba666db448de39132444b36fb`; separate C8 run at freeze `c8e451a3e52fc8da743df011debae682f93c89a3` follows below. META accepts **SPIKE_ACCEPTED_WITH_NOTES** after all3 scoped endreviews PASS_WITH_NOTES/no open findings; exact closeout commit authorized, writer STOPS after commit. `PRODUCT_INTEGRATED = NO`.

## Actual runner and qualification

`python -m tools.hestia_asset_compiler benchmark` invokes the ACTUAL unchanged report-bound `compile_core`, with reversible stdlib timing wrappers, all geometry/thin/topology/byte verification and unchanged caps. One actual SMALL workload was measured per profile AFTER correctness: 84 separate 0.5-m boxes, **84 genuine mesh/accessor copies / 1008 input triangles / 1008 expanded triangles / 672 actual POSITION vertices**. This is not 12 source triangles instanced 84 times and labelled 1k input.

Every current measurement is **CONTAMINATED_DIAGNOSTIC**: exclusive CPU time/freedom from parallel HVP/renderer work was NOT proven. No foreign session/process was inspected broadly or stopped. These are no speedup, adoption, capacity, memory or cross-machine claims. There is no performance optimization in this patch, hence no fabricated before/after comparison. Memory is **UNSUPPORTED**.

Environment recorded without private hostname/paths/time: Python 3.12.13, win32, OS 10.0.26200, AMD64. Wall uses `perf_counter_ns`, CPU uses `process_time_ns`; durations are diagnostic evidence OUTSIDE asset content. Actual observed 0-ms CPU for a fast nested phase is clock resolution, not an invented unavailable-phase zero. Unreached phases explicitly say UNAVAILABLE; optional GWN is NOT_RUN.

Native command: explicit Ctree Python `-B -X utf8 -m tools.hestia_asset_compiler benchmark --population small --output <new invocation-owned Ctree TEMP generation>`, **exit 0**. Actual published `benchmark-run.json` matched stdout; the checked bytes are retained as [C7_BENCHMARK_SMOKE.json](C7_BENCHMARK_SMOKE.json). 8,468 bytes / SHA-256 `81d58223018d026d86b24fecb3f9377d4a73846a3119f73da9a06c851c03c964`. No benchmark rerun/loop was used to select nicer numbers.

## Measured workload/counts and frozen-budget admission

Input GLB 69,796 bytes, report 23,648 bytes. Owned cell counts independently checked as 84 × 216 micro / 84 × 64 standard; complete proof/serialization still ran.

| Metric | micro 0.125 m | standard 0.25 m |
| --- | ---: | ---: |
| Input / expanded triangles | 1008 / 1008 | 1008 / 1008 |
| Unique input / decoded vertices | 672 / 672 | 672 / 672 |
| Owned occupied cells | 18,144 | 5,376 |
| Actual owned bricks | 504 | 420 |
| Actual total package bytes | 2,407,633 | 2,036,443 |
| Total wall ms | 9407.7520 | 4848.0623 |
| Total CPU ms | 9265.625 | 4750.000 |
| Combined thin/potential-classification candidate work | 9,424,296 | 4,237,128 |
| Combined grid cells | 90,552 | 40,824 |
| Combined flood cells | 215,040 | 90,720 |
| Classified ray/triangle work | 4,346,496 | 1,959,552 |
| Topology witness work | 4,515,840 | 1,905,120 |
| Common refinement cells | 43,008 | 18,144 |
| Source arrangement cells | 2,268 | 2,268 |

The prior micro ~9.4M work estimate was UNVERIFIED preparation; actual preflight now admitted 9,424,296 under the **10,000,000** unchanged limit (575,704 remaining). It is not universal asset throughput. `spike-budgets-v1` remains unchanged: expanded triangles 20,000; aggregate topology pairs 2,000,000; grid/flood 2,000,000 each; work 10,000,000; owned bricks 8192; serialized output 64 MiB. Per-Part quadratic exact topology validation remains part of the cost; this workload distributes 12 triangles across each of 84 genuine Parts.

## Honest nested/combined phase measurements

Milliseconds below are actual saved diagnostics, rounded for display only. **DO NOT SUM these phases**: parents include their children; total includes instrumentation overhead. No stand-alone transforms/fill/material phase has been fabricated where the current API combines it.

| Actual phase / scope | micro wall / CPU | standard wall / CPU |
| --- | ---: | ---: |
| inputHash — inclusive in-memory hash/parse/semantics; FILE I/O NOT MEASURED | 14.5692 / 15.625 | 10.5535 / 15.625 |
| glbParse — nested actual bounded reader | 8.4203 / 15.625 | 6.0153 / 15.625 |
| transformsNormalize — COMBINED baking + geometry validation | 814.1286 / 765.625 | 639.8253 / 609.375 |
| geometryValidation — nested per-Part topology, 84 calls | 785.5622 / 750.000 | 619.1540 / 593.750 |
| thinMeasurementAdmission — inclusive measurement/preflight/bindings | 488.6714 / 484.375 | 398.7666 / 390.625 |
| surfaceCoverage — nested actual SAT raster coverage | 5997.3157 / 5953.125 | 2546.8726 / 2468.750 |
| classificationFill — COMBINED preflight/coverage/fill/parity/topology | 7483.8649 / 7421.875 | 3312.0793 / 3234.375 |
| materialResolution — PARTIAL explicit binding checks, maps/slots combined elsewhere | 0.6469 / 0.000 | 0.3682 / 0.000 |
| brickPacking — actual address/slot/hash packing | 45.7061 / 46.875 | 15.3737 / 15.625 |
| hashingSerialization — PARTIAL package JSON/SHA calls, including verifier recalls | 348.7877 / 359.375 | 324.9831 / 312.500 |
| outputVerification — inclusive actual byte/format verification | 290.9777 / 250.000 | 224.9949 / 234.375 |
| optionalGwn | NOT_RUN | NOT_RUN |

Hashing in other owning methods remains in their combined phase, not falsely counted as a fully isolated hash total. Fixture generation and research-directory publication are outside the measured in-memory compile total. No timestamps, host identities or these durations enter deterministic package manifests/hashes. The focused instrumentation test confirms every generated package file byte equals an uninstrumented core compile.

## Medium/Large and research decision

Native `benchmark --population medium` and `benchmark --population large` each exited **0**, returning both-profile **NOT_RUN_BUDGET_EXCLUDED**, not a successful compile or timing zero. Medium requested 25k–50k source triangles; Large 100k–250k. Even one instance exceeds the frozen 20k expanded-triangle cap. Input builder/core are not invoked; allocation-spy tests verify this. No validation disabled, larger cap, disguised population or invented measured counts.

Review correction at `bc83267745906c956c69815e91db64766ea5d676`: `measure_compile` retains the detailed BLOCKED/status/diagnostic API record. The CLI detects a BLOCKED run BEFORE research publication and routes its stable compiler diagnostic through the existing error handler: **exit 1, REJECTED stderr, empty stdout, no output publication**. Explicit Medium/Large exclusions still exit 0. Regression uses actual hash-paired G24 bytes/REAL core, mocked small builder and synthetic zero clocks, with and without `--output`; it is an error-contract test, NOT a benchmark run or measurement. Existing successful small-cube numerical/instrumentation checks remain. No 1008-triangle workload was rerun, and saved timing/Smoke bytes are unchanged.

**GWN_NO_ADOPTION / REASONED_NOT_IMPLEMENTED**: signed winding 2 in the equal-outward hollow cavity conflicts with accepted even/odd Air, with no substitute thin/topology proof. No GWN code experiment, timing sample, candidate adoption or general rotated-fill support is claimed. Reference/core bytes remain unchanged.

Isolated performance qualification, reliable memory measurement and GWN experiment remain NOT RUN. Final scoped independent reviews and META acceptance are complete as externally relayed in REVIEW. Measurements remain diagnostic only; TRS/rod/layer limits stay in GOLDEN_CORPUS.

## C8 actual post-correctness diagnostic — one Small/profile

After fresh 134 compiler / 58 host / owned compileall checks AND the complete native ten-repeat corpus passed, `verify_c8.py benchmark` invoked the actual native CLI once for Small BOTH profiles, then once each for Medium/Large policy reports. **Exit 0**, actual published benchmark bytes equal stdout, own generation removed. No rerun/loop, no foreign session stopped or exclusive CPU assumption. C7 Smoke bytes remain unchanged.

Immutable `C8_BENCHMARK.json`: **11,343 bytes**, SHA-256 `70bf1eff5020c856af12a2c8b7bbc05a02060417aa1926ac0d0034de8e089cca`. Code freeze c8e451..., environment Python3.12.13/win32/10.0.26200/AMD64. ALL CONTAMINATED_DIAGNOSTIC/memory UNSUPPORTED; captured PENDING_END_REVIEW describes original PRE-COMMIT evidence, NOT current META acceptance. Raw bytes/measurements were not rewritten or rerun. Same source69796/report23648 bytes,84 true copies/1008 input=expanded/672 actual vertices; no source/producer/cap/algorithm changes.

| Current metric | micro 0.125 m | standard 0.25 m |
| --- | ---: | ---: |
| Owned cells / bricks | 18,144 / 504 | 5,376 / 420 |
| Actual total output bytes | 2,407,633 | 2,036,443 |
| Total wall ms / CPU ms | 10474.151 / 10093.750 | 5267.0417 / 5062.500 |
| Actual combined candidate work / unchanged limit | 9,424,296 / 10,000,000 | 4,237,128 / 10,000,000 |
| Grid / flood / source / refinement cells | 90,552 / 215,040 / 2,268 / 43,008 | 40,824 / 90,720 / 2,268 / 18,144 |

Below are saved C8 phase durations rounded only for display, **DO NOT SUM** nested parents/children. Same inclusive/combined/partial scopes as above. File I/O, fixture generation and output-directory publication are NOT measured in this in-memory total; 0 CPU for fast executed phases is clock resolution, not a synthetic unavailable measurement.

| Current actual phase | micro wall / CPU ms | standard wall / CPU ms |
| --- | ---: | ---: |
| inputHash — inclusive admission/hash/parse | 11.3134 / 15.625 | 11.9665 / 15.625 |
| glbParse — nested reader | 6.9437 / 0.000 | 7.1794 / 15.625 |
| transformsNormalize — combined with validation | 742.3086 / 718.750 | 802.4003 / 781.250 |
| geometryValidation — nested, 84 actual calls | 716.8067 / 703.125 | 769.5437 / 765.625 |
| thinMeasurementAdmission — inclusive preflight | 454.8726 / 453.125 | 554.3143 / 515.625 |
| surfaceCoverage — nested SAT | 6687.9537 / 6390.625 | 2658.1978 / 2578.125 |
| classificationFill — combined fill/parity/topology | 8531.7802 / 8203.125 | 3413.8671 / 3281.250 |
| materialResolution — partial explicit bindings | 0.5015 / 0.000 | 0.7288 / 0.000 |
| brickPacking — address/slot/hash | 70.5600 / 46.875 | 15.6242 / 15.625 |
| hashingSerialization — partial package calls | 404.3160 / 421.875 | 320.5599 / 328.125 |
| outputVerification — inclusive actual byte verification | 360.2071 / 343.750 | 234.5425 / 234.375 |
| optionalGwn | NOT_RUN | NOT_RUN |

Actual classification workload statistics are unchanged: micro ray4,346,496/witness4,515,840; standard ray1,959,552/witness1,905,120. Quadratic exact topology validation/aggregate2M pair limit remain enforced. C7 and C8 times are separate unqualified diagnostics, NOT a valid speed comparison or an adoption/capacity claim.

The immutable artifact retains Medium25k–50k/Large100k–250k: BOTH profiles NOT_RUN_BUDGET_EXCLUDED, Exit0 BEFORE builder/core under frozen20k expanded cap, no invented timing/count zero. GWN REASONED_NOT_IMPLEMENTED, not timed; qualified performance NOT RUN. External endreviews/META accept the scoped spike with these notes. Only exact final commit is authorized here; dedicated push remains META-owned.
