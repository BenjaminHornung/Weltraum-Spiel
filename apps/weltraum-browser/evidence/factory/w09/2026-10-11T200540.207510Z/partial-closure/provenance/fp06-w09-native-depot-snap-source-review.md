# W09 Native depot snap — independent RED/source/oracle review

**Current guarded Native-source verdict: FAIL / correction OPEN. Retained 150 RED evidence is verified. No Native GREEN or final W09/package PASS.** No product/evidence edits or tests/build/browser/native/profiling executions by reviewer. Integrator confirmed the Native fix is not yet written; 151–153 are unrelated alias phases, not Native GREEN. Their detailed evidence is outside this report.

## Contract and measured source

WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`. Actual HEAD measured at start **2026-10-11 23:12:19.240940 UTC** and end **23:16:33.132994 UTC**: `aa2e5d7c335453fc555a98ccd35e9f564c596e93`, plus mutable WIP. All three inspected bytes stayed unchanged:

| Application-relative source | Bytes | Start = end SHA256 |
|---|---:|---|
| `src/hestia-prototype/physics/factoryFacilitySession.ts` | 52116 | `1d2222586f92dd7c71530cf8a26c171348ba5edeaf4427cbe8a68ff168ca81ba` |
| `tests/unit/factory/facilitySession.test.ts` | 34767 | `20b76a041e7d03154e3404cfeb6e0c57e0453cabe2ac92bf86ebad0964202a0c` |
| `src/factory/session/cargoHandling.ts` | 13892 | `b5c4e663c2c0796d65b86e2af9c2bc4d403a710fd37d180f9403be10cb293018` |

Accepted transport source: Root `docs/factory/fp06/proposals/native-handling-v1.md`, SHA256 `c1aa59de0a2159e7ec2c81af5bd64f5c7d867751e0af274736e737fc26803a6c`, §§7–11. Its historical PROPOSED heading is superseded by the actual acceptance in Root `decisions.md:73` (file SHA256 `32bc8ee16c4e229856565a350f07280d4a6fef219daac22d556d8d691ef8acdd`). One same-World carrier, ≤5 colliders, fixed local depot, finite custody, full sweeps/support and unchanged 16/64/32/4096 caps. This review additionally applies Root's bounded technical depot criterion: fixed q1, nearest 250-mm XZ grid, ≤125 mm per axis, full snap sweep, same ground within ±2 mm. No extra Owner-policy gate or terrain mask is proposed.

## Actual 150 evidence

Ownrun `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z`; `150-native-depot-snap-custody-red.command.json`, **530 B / SHA256 `3831dccbfa2ab100a34c01e37ce7145901c0daea7a709738e202dda36133f1cf`**. Cwd/argv target this application and `actual Native closed depot frame`. Actual 23:09:58.694307–23:10:01.909489 UTC, Exit1: **3 assertion FAIL / 25 skipped** (28 collected), no setup failure.

Raw **2152 B / `743d1e6d0580f26e63f76889f09728668a1302e9961f381e096131ae1185eaf5`**; gzip **730 B / `48414c02c6ab92a2a69639369eca6cbe0acb0e8fb73c558038497005efa4c1ce`**. Gzip decompresses byte-identically to retained `.log` and matches receipt raw SHA/size. This verifies retained results, not a rerun.

## Three concrete failures and oracles

1. **No depot snap.** Off-grid actor x=−5.72,z=11.83 gives carrying center approximately [−5.72,1.25,10.83]. Target is [−5.75,sameY,10.75]: ΔX≈−30 mm, ΔZ≈−80 mm, within both 125-mm bounds. Actual RED receives x=−5.71999979019165 instead of −5.75. Current `prepareCarrierDeposit:315–330` preserves actor-derived unsnapped pose; `commitCarrier:385–391` only changes body type/enabling. Oracle additionally requires 300-kg actual Rapier mass, exact original-pose rollback, same handles/counts and eventual same-body fixed depot. Those later assertions are **not PASS from this failing run**.
2. **Foreign custody accepted.** `sourceContainerId:"foreign_custody"` passes current source-ID/save-safe/profile checks at :319, which omit equality to the actual carrier custody container. RED expected rejection and receives none. A fix must reject before disabling/moving the body or changing phase, counts, revision or finite-custody identity.
3. **Diagonal interior collision missed.** C27 fixed-q1 payload extends ±0.75 m in X, ±0.5 m in Z. Obstacle center is original+[0.735,0.75,−0.54] m with half-extents [0.003,0.1,0.003]. Both endpoints are clear, while the interior overlaps around sweep parameter **t≈0.47–0.58** using the existing 0.5-mm query shrink. Current deposit has no snap sweep. Oracle uses actual Rapier and requires CarrierSnapSweep rejection while preserving original carrying phase/counts. This tests the entire diagonal, not merely endpoint clearance.

## Required narrow follow-up

Await the actual numbered Native fix/GREEN receipts. Inspect target-pose storage before disable, full five-shape sweep with self exclusion and known coverage/support, same-height tolerance, fixed q1 and preserved mass/shape/handles. Commit must use that admitted pose; rollback must restore original transform/type/enablement/revision and prove original membership. Existing action-ID/completed, safe-pause, stale revision and pending-work guards remain mandatory. Failed/unknown restoration must hold, not refund or silently accept a changed pose. No current source change admitted by this reviewer.

Fixture explicitly declares a synthetic Rapier floor and a 300-kg **C27-PACK chassis**, not the 341-kg Former BOM. Custody bindings are declared unit strings; no actual Resources payment/conservation, D07 coverage/terrain, ordinary carrier browser route, whole-World save, visual/Art or performance acceptance follows. The actual 150 source remains uncorrected; no source-five terrain changes inspected or requested.
