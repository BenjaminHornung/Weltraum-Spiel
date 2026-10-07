# Gate B: keep experimental mechanism, latency acceptance open

Historical pre-review decision only. The final owned-graph and transport corrections were remeasured in B-final-native-r01: 238.50 -> 222.25 ms median (6.8%), candidate p95 233.90 ms, 10/10 <=250 ms. REPORT.md and RESULTS.json supersede the numbers and pending checks below.

Ten balanced direct-v1 / owned-moving-v2 pairs completed from B-r02 built bytes. Pairs 0-5 use B-native-r02, pairs 6-9 use unchanged B-native-r03-continuation. The preserved earlier pair-6 candidate attempt failed before any Cut at pointer-lock; its results array is empty. The earlier unpaired successful direct pair-6 is retained but not selected. No fastest-run selection.

Moving Input-to-Render median: 244.9999 -> 212.0 ms (13.47%); nearest-rank sample p95: 257.3000 -> 261.5 ms; <=250 ms: 6/10 -> 9/10. This is a promising complete-flow median gain, not the p95 acceptance target. Owner source-ingest work-wall median: 17.75 -> 3.30 ms. Save/ColdLoad and the next native Recut pass in both variants. Source/build bindings remain identical before/after all attempts. Four contract tests and 21 Source/Recipe regression tests pass.

Keep the owned-subset experiment and proceed to the separately authorized Terrain gate C. Additional real Moving cancel/late-result/worker-exit checks remain part of final gate verification. No product adoption or 42/1400 run is authorized by this pilot result.
