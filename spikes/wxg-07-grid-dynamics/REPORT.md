# WXG-07 report

Implementation COMPLETE for the bounded local transport experiment. Functional code/oracles PASS. Execution LOCAL_WINDOWS_ISOLATED; hardware qualification NOT_RUN; product integration NO; recommendation RESEARCH_ONLY. The candidate answers conservative transport and replay, not atmospheric dynamics or a product weather default.

## Evidence

`../../.devtoolbox/specs/changes/wxg-07-2026-10-09/tests/local-functional-r04/summary.json` records eight real commands, each exit 0, including full producer index/staged/unstaged/dirty-membership verification, strict build/typecheck, historic+focused tests and finite runtime matrix. Tests: 23/23 PASS. Matrix: 9/9 PASS, exact canonical FullReplay = Checkpoint+Tail = finite Pending/pump result with reordered chunks, on all three resolutions and offline gaps. The earlier r03 run remains intact. Final review and later checks are recorded separately in `receipt.json`.

Historic control: 8/8 PASS, exit 0; first new topology oracle: missing module, exit 1, preserved in `tests/initial-missing-oracle.log`. Review P2 exposed finite-density sink-budget overflow; the added regression first failed (exit1, `tests/overflow-initial-r01.log`), then passed after a one-line final budget validation. Original upstream assertions and preliminary/r02 profiles are retained; r03 profiles bind the corrected candidate. The finite matrix uses the actual frozen HestiaAuthoring profile/validator, analytic read control, climate sampler and PLT RNG/LE codec. Initial densities and constant 100 m/s maximum flow are explicit synthetic assumptions, without Earth gas defaults or fixture adoption.

| Resolution | Cells | Minimum CFL/stability bound (s) | Selected dt (s) | Analytic tracer weighted L1 after 24h |
|---|---:|---:|---:|---:|
|32²/face|6144|876.997|600|0.00730843|
|48²/face|13824|577.481|300|0.00506948|
|64²/face|24576|430.455|300|0.00373882|

The geometry oracle compares each cell to independent spherical triangles, closes 4πR², checks right-handed bases at all 12 face seams/eight corners, pairs edge orientations and verifies divergence. Independent Simpson quadrature checks actual solid-rotation fluxes across selected seam/corner edges. Constant field and positive impulses remain valid; upwind diffusion is measurable and declines with refinement. The largest source/sink relative balance residual across the nine r03 cases is approximately 1.90e-13, against the predeclared 5e-10 bound. 30/60 min at 100 m/s are rejected. A 10 min request is stable only where the actual declared bounds allow it.

Checkpoint tests include checksum, length/header, model/profile mismatch, NaN, Infinity, negative/signed-zero density, invalid cursor, noncanonical bytes and unaligned time. Numerical tests reject invalid source/sink policies, unstable dt, invalid/duplicate/reordered events and unsupported grid resolution. Replay uses fixed ordered +,-,*,/ state arithmetic, no transcendental or GPU state evolution. Geometry/analytic fixture compilation uses approximate math but is frozen and use-time byte-checked; cross-engine/device geometry generation is not proven.

## Costs and limits

r04 diagnostic seven-day tail: 32² 401 ms, 48² 1805 ms, 64² 4477 ms. These are single concurrent CPU runs, without warmup/acceptance populations or an unloaded window. They are not qualified hardware results, a speed comparison, or an HVP budget. FullReplay also contains the one-hour prefix and therefore is not the same workload as the tail. Checkpoint acceleration removes the prefix; catch-up remains linear in the offline gap. Memory measurements are process observations, not isolated model-residency evidence. System CPU-load sensor is unsupported; GPU timer value is null and ActualAdapter is NOT_APPLICABLE for CPU-only execution.

96²/128² scaling is NOT_RUN_BUDGET_BOUND. No browser/GPU/native/HVP pilots, 42/1400 series, product build, Unity or product dependency installation. There are no new shader/WASM binaries in the transport authority. No atmosphere feedback, condensates or physical species exchange is implemented. Sources/sinks and journals belong only to this finite laboratory model.

## DevToolbox boundary

The required MCP workflow was used on this own change. Initial `verify_run` exit 1 found a missing capability spec (then supplied, fresh scoped specs_validate PASS) and attempted the baseline product typecheck, which fails because the isolated read-only product has no `node_modules/typescript/bin/tsc` (`MODULE_NOT_FOUND`). The complete error is preserved in `tests/devtoolbox-initial-verification.json`. The spike's actual strict TypeScript build passes independently. No global verification preset or product package was repaired. Completion preflight is advisory degraded with canProceed=true and explicitly permits deciding whether focused/manual evidence suffices. Local tasks close against the reviewed r04 evidence; the inherited verification history remains FAIL and is never renamed PASS. Product checks remain separate.
