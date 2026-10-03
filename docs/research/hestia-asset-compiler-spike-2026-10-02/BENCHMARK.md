# C7 bounded diagnostic benchmark — no qualified performance claim

Gate/package/path date **2026-10-02**, execution 2026-10-03. Parent `1b652cf5b215259ba666db448de39132444b36fb`; **STOP before C8**. `PRODUCT_INTEGRATED = NO`.

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

**GWN_NO_ADOPTION / REASONED_NOT_IMPLEMENTED**: signed winding 2 in the equal-outward hollow cavity conflicts with accepted even/odd Air, with no substitute thin/topology proof. No GWN code experiment, timing sample, candidate adoption or general rotated-fill support is claimed. Reference/core bytes remain unchanged.

Future isolated performance qualification, reliable memory measurement, any newly authorized bounded GWN experiment and final C8 acceptance are NOT RUN. Current measurements are diagnostic only; normal TRS/rod/layer proof limitations are detailed in [GOLDEN_CORPUS.md](GOLDEN_CORPUS.md).
