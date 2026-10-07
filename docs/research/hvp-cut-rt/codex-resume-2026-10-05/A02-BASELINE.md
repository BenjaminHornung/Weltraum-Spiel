# A02 unchanged-source baseline

Source: anchor `0bfd1e67117d0dd6184e592e9a2a1b8b9f58241a` plus independently reviewed privacy exact3 only. Product kernels and original affected test assertions/timeouts unchanged. Complete bound inventory: 399 app-relative source/reference/test/config files, SHA-256 `fa0be704227c238d2b4ef39be4c74f9d05a456df492709154b7933800ad0247e`.

All evidence below lives in `.devtoolbox/specs/changes/hestia-cut-rt-v3-resume-2026-10-05/tests/`. Retain historical results separately; no retries, bail, skipped tests or cap relaxation.

| Run | Actual result | Time / release | Meaning |
| --- | --- | --- | --- |
| `A02-structural-isolated-r01` | 1 PASS / exit 0 | assertion 2812.8113 ms | Diagnosis only |
| `A02-terrain-isolated-r01` | 1 PASS / exit 0 | assertion 2506.1679 ms | Diagnosis only |
| `A02-structural-whole-r01` | 53 PASS / 1 FAIL, all 54 / exit 1 | wrapper 94.2367073 s; tree PASS; cleanup60 PASS at 44.891839 s | Original 5000-ms own-case timeout reproduced at 5084.0786 ms |
| `A02-terrain-whole-r01` | 4 PASS / exit 0 | wrapper 6.6287989 s; tree PASS; late observation 93.52564 s | Functional whole population PASS; cleanup observation FAIL_LATE_OBSERVATION stays |
| `A02-owner65-whole-r01` | UNKNOWN_NATIVE_TIMEOUT_STOP, no final JSON/counts | native 178.6688936 s; including wrapper 180.026926 s; tree PASS; late observation 92.768142 s | Full Owner65 not completed; no inferred count or acceptance |
| `A02-reporter-bootstrap-whole-r01` | UNKNOWN_NATIVE_TIMEOUT_STOP, no final JSON/counts | native 179.2641269 s; including wrapper 180.046732 s; tree PASS; late observation 109.44718 s | Combined population not accepted |
| `A02-structural-diagnostic-r01` | 53 PASS / 1 FAIL, all 54 | Structural own PASS 3575.069 ms; Materialization FAIL 5614.3523 ms; tree PASS; late observation 76.894022 s | Trace-only diagnosis; changing slow test proves neither deadlock nor acceptance |
| `A02-owner65-diagnostic-r01` | 64 PASS / 1 FAIL, all 65 / exit 1 | native 169.0444559 s; wrapper 169.778857 s; cap PASS; tree PASS; late observation 63.470728 s | Restore old-Begin rejection test FAIL 5161.687 ms at original 5000; no clean acceptance |
| `A02-bootstrap-diagnostic-r01` | UNKNOWN_NATIVE_TIMEOUT_STOP, no final JSON/counts | native 179.6011879 s; including wrapper 180.062057 s; tree PASS; cleanup60 PASS 51.117395 s | Real progress markers locate watchdog in C2B startup reserve test; no complete Bootstrap result |

The existing native receipt helper was copied exactly (original SHA `5f85ed0194f26f33e878fc40a998c2d051a88299eedff32de7203ebb32eaf8ce`); only its APP constant was rebound to the new worktree. Its actual adapted SHA is `d0fb2488e4b51f2636fb87037446fa5d8d11a389d6dd68d3d3d3fa76aff1bdc2`. One fresh hidden supervisor per native invocation prevents charging a multiple-command orchestrator lifetime against Owner65's native 180 seconds. Existing Windows Job ownership and stdout/stderr/exit/source checks remain. Late parent observations are not rehabilitated.

Read-only debugger D01 confirmed that Vitest checks elapsed timeout after a synchronous callback resolves; the Structural final evidence line therefore can coexist with a real 5000-ms failure. It is a completed-but-too-slow test body, not proof of a stuck cursor. All six isolated/whole drains retain the same 215938 units and bounds. Scheduler teardown overlap/contention remains a hypothesis. The legal dense P01-T03 has an original explicit 120000-ms timeout at checkpoint; its 43318.3193-ms PASS does not change any timeout.

Owner last stdout is an earlier trace emitted when a plan finishes, not the current test at watchdog. Native progress markers and real hrtime/CPU probes are needed before attributing the Owner stop; `performance.now` is mocked in some original Owner controls. Existing complete owned Terrain cursor is inactive; current sync ingest calls explain recorded long contiguous source steps, but not the full native timeout cause.

## Clean generation after diagnosis and runner corrections

All temporary test markers/profile hooks and the rejected freeze candidate were removed; original four affected test files and product validation.ts match the anchor byte-for-byte. The clean400-file binding SHA256 is `36313d8dfe13606e530402888b77898afcaf5df7afa6f19156f59b7df36ec3cb`. A01 reviewed privacy exact3 and two new semantic controls are the only app deltas.

| Run | Complete original population | Actual native / wrapper / tree |
| --- | --- | --- |
| `A02-structural-clean-r02` | 54/54 PASS, exit0 | 67.9429384 /68.48081 s; original own3004.1795 ms and Materialization3201.8916 ms; native0/outer1; releasePASS56.348821 s |
| `A02-terrain-clean-r02` | 4/4 PASS, exit0 | 6.6097568 /7.068237 s; native0/outer1; later releasePASS; observer271.743819 s remains FAIL_LATE_OBSERVATION |
| `A02-owner65-clean-r02` | 65/65 PASS, exit0 | 160.6523954 /161.09019 s, original180 PASS; finalR05 helper; native0/outer1; later releasePASS; observer190.275592 s remains FAIL_LATE_OBSERVATION |
| `A02-reporter-bootstrap-clean-r02` | 117/117 PASS (54 Reporter +63 Bootstrap), exit0 | 424.6436825 /425.103447 s in justified1200 commandwindow; outer1; releasePASS34.534603 s; original test deadlines unchanged |
| `A02-clean-type-r02` | Full tsc noEmit PASS, exit0, empty outputs | 2.9977628 /3.824545 s, original60 PASS; native0/outer1; later releasePASS; observer77.609707 s remains FAIL_LATE_OBSERVATION |

Historical FAIL/UNKNOWN runs above stay unchanged and do not count as passed. Population overlaps are not counted again as a larger unique test total. Current technical A02 controls pass; later B1 changes need their own fresh acceptance.

Final Runner R05 source SHA `cdc626aa977435ca22741dc0967c1ec263bc7733a489838d7531f86e9226d488`: independent R05 found no new scoped findings after R03/R04 corrections. Owner filenames are normalized and bound; Owner180/Type60 hard checked. Both unnamed jobs have kill-on-close; native-only job termination preserves wrapper receipt emission and first timeout cause. Deliberate watchdog `A02-native-tree-watchdog-negative-r03` observed actual worker descendants (native active2/total5) then native0/outer1, expected UNKNOWN/exit91, not functional PASS. UppercaseOwner1200 control rejects at180 guard before any native/folder. Superseded admin observations remain visible but do not manufacture new acceptance blocks. Runtime startup rejection was not separately fault-injected; its cleanup source uses the documented native outer-job kill-on-close boundary.

Next: complete tracker preflight, then implement the existing B1 owner-first/memory/admission chain. B1/B2/B3/gameplay/save/browser/42/1400 remain unproved.
