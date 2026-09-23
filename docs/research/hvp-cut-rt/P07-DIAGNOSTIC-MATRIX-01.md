# P07 predeclared diagnostic matrix — 2026-09-22

Source: `feature/hvp-cut-rt-p00` base HEAD `9341fb906383515057e659a99e16a381632f2bea` plus the explicitly uncommitted local overlay bound in `R00-SOURCE-LEASE-GATE-2026-09-22.md`. The unchanged full unit rerun passed 206 files/2343 tests; production build and warm recut browser binding passed. The later GitHub branch snapshot does not retroactively change these source bindings.

Run `tests/performance/hvp-cut-rt.spec.ts` once in `diagnostic` mode: **14 planned attempts**, one per all seven predeclared variants (`quarry-box`, `quarry-sphere`, `rock-arm`, `body-box-moving`, `body-box-sleeping`, `body-sphere-moving`, `body-sphere-sleeping`) × Cold/Warm. Do not add retries, replace failed rows, run host-heavy jobs concurrently or select only successful commands. A one-attempt diagnostic cannot establish a formal p95. Preserve `not-run`, precondition failures, warm-ups, raw measurements and any test failure under the distinct output directory `p07-diagnostic-matrix-01`.

Device contract: installed Chrome, actual selected GPU/driver, Balanced power, headed foreground canvas1280×720/DPR1, production preview on task-owned port5173, one worker/retries0, no trace/screenshot/video/Golden recording. Each case's bound source/build/fixture/lock/browser hashes and actual process identity live in its own `plan.json`/`fixture.json`/`process.json` under [the published JSON evidence](../../../apps/weltraum-browser/evidence/hvp-cut-rt-v2/README.md); if a case cannot meet the precondition, retain the failure rather than simulate a cut. Original target remains p95 input→Applied≤250ms; body-hold absent stays `null`, not zero. No main merge, release or R00 Core work is implied by this diagnostic.

## Execution on the bound candidate

Managed process `bg_mud8ecm5_q`: **Exit0, 14/14 PASS**, one worker, zero retries/skips/flaky, Playwright JSON `p07-diagnostic-matrix-01/playwright-report.json`, 637.36 seconds. Each `*-1/report.json` has one complete Applied measurement, sourceUnchanged/buildUnchanged true. Captures include actual cold/warm checkpoint, GPU/power/foreground, raw input and render bindings; the owned port5173 has no listener after cleanup. Warm-up commands remain separately recorded, not combined into measured samples. The numbers below are **individual input→Applied / input→committed-render-submit durations in milliseconds**, never a formal p95 (each class has n=1):

| Variant | Cold | Warm |
|---|---:|---:|
| Quarry Box | 272.3 / 297.3 | 246.6 / 278.3 |
| Quarry Sphere | 313.4 / 354.7 | 231.3 / 271.5 |
| Rock arm | 1870.9 / 1894.6 | 2086.1 / 2098.3 |
| Body Box moving | 2924.6 / 2946.7 | 2628.9 / 2653.0 |
| Body Box sleeping | 2983.6 / 3009.1 | 3510.1 / 3547.4 |
| Body Sphere moving | 3658.7 / 3692.2 | 3358.1 / 3416.1 |
| Body Sphere sleeping | 3286.4 / 3313.3 | 3102.3 / 3135.4 |

Observed rock-arm Cold: command-bound `cutSupportAnalyzeMs` 1283.1 ms, `cutCompileMs` 177.9 ms, `cutNativePrepareMs` 242.5 ms, native terrain recipe 230.0 ms, true terrain hold 357.7 ms and timer gap 236.0 ms (`rock-arm-cold-1/attempt-1.json`). These spans may overlap and cannot be added to derive input latency. Body hold remains NOT_MEASURED; body-sphere-moving Cold snapshot reports a 1645.9-ms max timer gap, which is not a measured body-hold interval. P06's specified prerequisite of no recipe-caused timer gap above 20 ms is not established by these data; neither X01 native cooking nor a new physics/worker transport change is authorized by this diagnostic. The predeclared ≥100 valid attempts/class/temperature across ≥3 fresh sessions have **NOT RUN**. No 250-ms p95, render, hold or Visual Owner acceptance is claimed.
