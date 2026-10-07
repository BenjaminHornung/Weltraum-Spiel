# Combined costs — measured control and bounded transform reuse

PRODUCT_INTEGRATED=false. This is source-bound local cost diagnosis, not product performance release or a global renderer winner. Profiling and clean timing are separate populations.

## Bound control

`control-02` is the ordinary ebb913d UI, built from 83 unchanged source/package files using Node 22.23.2 / Vite 8.1.5 / Three 0.185.1. `control-direction-02` uses the same sources, fixtures, .8 rain/history, populations, material/view/camera, budgets and work-plus-timer scheduler, with one separately SHA-bound validated gust input to actually change direction. It is an authored test input, not silently described as the original scenario. The first direction build failed its guarded input seam before output; a distinct successful pre-transform build and fresh run preserve that invocation failure.

Chromium 151.0.7922.34 / Playwright 1.61.1, one sequential browser/worker, 1400x1000 viewport, DPR1, requested Three drawing buffer 1280x720. GPU identity/resolution/color/exposure/native facts are retained in each raw report. A0 explicitly yielded exclusive windows 07:59:20–08:14:20 and 08:16:51–08:31:51 UTC after actual completion of its reference/functional probes. No parallel R&D/A0 native benchmark was run. The sampled desktop still has unrelated ordinary background work; these numbers do not constitute general target-device acceptance or VRAM qualification.

## Actual changing-direction control

Clean run `combined-control-direction-timing-02`; exact per-call rows and native draw/clear/event counters are in its report. Quantiles are nearest-rank. Transition setup calls remain raw, while the table isolates the stated target step.

| Population | n | p50 call ms | p95/max call ms |
|---|---:|---:|---:|
| First cold wetness at300 | 4 | 106.1 | 123.6 |
| Warm identical tick300 | 12 | 19.6 | 26.8 |
| Play, 24 distinct directions/ticks | 24 | 88.6 | 93.0 / 102.8 |
| Roof opening600 | 3 | 120.2 | 134.3 |
| Owner rotation960 | 3 | 122.8 | 124.2 |
| Backward seek120 | 3 | 2.7 | 2.9 |
| Reload1260 | 3 | 132.8 | 143.9 |

The 24 running ticks span about 2.535 s from first timer callback to last completed UI update: **9.4667 controlled steps per real second**, versus the 60-ticks/s simulation clock. The existing scheduler waits 1000/60 ms after update completion. This Play is not realtime 60-Hz simulation. Native renderer submissions, actual observed WebGL draws/clear passes and distinct changed-frame events are separate from simulation ticks; compositor presentation cadence, GPU duration and physical VRAM are not measured.

The original ordinary Play population in `combined-control-timing-01` has a constant rain direction and zero new wetness queries. Its initially authored label continuous-changing-direction is incorrect for that raw input and is preserved as an invocation/measurement-description correction, not treated as direction-changing proof. It provides a separate fixed-direction warm/UI observation (p50 20.7 ms/p95 25.1 ms, max27.7). No favorable cached cost replaces first refresh or continuous invalidation.

Conservative wetness/rain reservation counters remain conservative, not exact per-region iterations or milliseconds. Actual raw rows retain samples, coverage, source-copy/driver bytes, direction, source revision, native submitted frame and error state. The clean observer wraps existing handlers/timer and records end after final facts DOM write; it does not replace scheduling. WebGL counters are observational. Protocol waits and frame/layout scheduling are included in wall populations and distinct from call durations.

## Separate profiling and candidate

`combined-control-direction-profile-02` is a separate V8 1000-us sample run, never pooled with clean timing. It records 197,268 keyed cache gets, 45,248 hits and 27 observed clears (including source/disposal). Directions between actual running ticks are distinct; repeated identical-tick calls are a separate population. Corrected source-map self-sample attribution (`combined-control-direction-timing-02-analysis-v2.json`) records: source rain queries1724.268 ms, wetness566.323, diagnostics201.380, material-buffer commands65.053, wind9.970, rain particles20.918, GC128.819, render/layout/runtime1021.592 and idle247.304. These are sample-attributed CPU totals for that profile, not per-call wall quantiles or GPU upload durations. The initial fixed publish-line analysis missed the generated input import's line shift; it remains preserved separately, while v2 reads each map's own source content. No raw timing/profile or threshold was rewritten.

The only optimization reuses immutable ownerPose/Quaternion/Origin per owner within each evaluate call. It retains every input/coverage/replay/budget check, exact direction invalidation, surface count and source sample. No inter-frame pose cache or precision quantization. Fresh focused checks22/22 compare whole actual face populations and rain results against the hash-verified original across changed direction, opening, transformed owner and backward seek. Final focused-units-03 strengthens the binding to all83 baseline source/package files plus the pinned fixture test helper; the baseline is an owned regular copy, with no fixed external checkout import. Typecheck exits0 and final candidate-original-04 build passes. Initial focused-units-02 sandbox helper-spawn EPERM is a separate startup failure, not a test-case failure. Native combined comparison is byte-exact RGBA: actual1280x721 PNG, SHA e29f9c66b07dfdc38383b59a4083d9d82f52b9f646fabd8def77ff44b289a36d on both control/candidate; requested renderer1280x720 is separately retained. Source/camera/material/coverage/query/sample bindings are unchanged.

## Equal-quality A/B result and limits

Candidate `combined-candidate-direction-timing-02`, build `candidate-direction-02`, uses the identical declared input/helper SHA and populations. A0's third explicit window was09:32:39–09:47:39 UTC; all native work ended before expiry. These are separate ordered measurements, not a randomized repeated A/B/A or general performance release.

| Target population | Control p50/p95 ms | Candidate p50/p95 ms |
|---|---:|---:|
| Cold300 n4 | 106.1/123.6 | 101.4/107.6 |
| Warm300 n12 | 19.6/26.8 | 14.0/17.0 |
| 24 direction-changing ticks | 88.6/93.0 | 85.0/93.6 |
| Opening600 n3 | 120.2/134.3 | 131.9/141.2 |
| Rotation960 n3 | 122.8/124.2 | 114.3/135.2 |
| Backseek120 n3 | 2.7/2.9 | 2.1/2.4 |
| Reload1260 n3 | 132.8/143.9 | 120.7/136.8 |

Keep this bounded CPU allocation reduction for its supported warm-path benefit: median -28.6%, p95 -36.6%; raw warm means19.867→14.092 ms, ranges16.4–26.8 versus11.8–17.0. Other transition samples are small and mixed (opening worsens); do not claim a general transition or direction-changing speedup. Direction-changing p95 is effectively unchanged and throughput9.4667→9.5985 steps/s remains far below60. Source queries remain the dominant limitation. No native GPU-duration/VRAM/frame-budget/product gate is cleared. The simpler source-query control and its original hard caps remain selected; no architecture expansion is included.

Fresh combined views/short running capture: `runs/combined-candidate-captures-01`, eight observations, zero JS/shader/asset errors, owned logical cleanup0. The recorded video is technical evidence, not realtime or human ART qualification.
