# ExecPlan: RD12 bounded Phase1 owning repair

## Goal
Repair the three HEAD-confirmed P2s and deliver an actual local repair commit
directly on `09ca699f1fab6bbe280556ddc660f56cbb383dba`, with fresh source-bound
CPU/type/build/boundary/postcommit evidence. This is not Phase1 acceptance or
native Phase2 authority. `productIntegrated: false` throughout.

## Context
HEAD proof `HEAD/rd12-phase1-head-09ca699f.json`, SHA-256
`e84ac212c19fda9bf9ac7c3f5df0ac816a8218456091590b00730e5c656cd165`.
Immutable START remains `303e6d651482338cc876696792acdd344603232e`; original
689 files, shared18, public429 and installed Babylon 9.29.0/API33 remain bound.
Read all Babylon callers, scenario replacement/reset, RD11 config admission,
Three camera point/direction transforms and Three root-owned light targets.

## Non-goals
Only lab-relative `src/experiments/babylon/**`, `tests/RD-12/**` and
`reports/RD-12/**` are writable. Sole writer, sequential CPU jobs. No agents,
DevToolbox, browser/server/port/GPU, root/shared/dependency/product writes,
push/PR/publication or deletion. Preserve the original candidate, v1 oracles,
sealed core/native specs, RED failures and all receipts. Automatic throughput
logs stay untouched; originalAllFilesGate remains the narrow exception.

## Architecture decision
1. New explicit qualification v2 reuses the unchanged v1 ROI/math/thresholds,
   but a deliberate fault must also fail the positive acceptance predicate.
   Native spec explicitly opts into v2; historical v1 remains byte-identical.
2. Admit a fresh native run root once. Keep a freeze/lease-bound admission
   record outside Playwright's disposable results subdirectory, validate it on
   worker reload, and reject foreign/stale existing roots. Exact future HEAD
   freeze/lease wiring remains authored only; CPU tests use synthetic identity.
3. Reuse Babylon root world matrix for camera/light points and its rotation
   for directions, with no custom normalization or fixture/schema changes.
   Private disabled candidates, whole adoption and light rollback remain owned.

## Implementation phases
1. Add deterministic owning regressions; preserve a fresh oracle seal and
   focused RED receipt before implementing the three repairs.
2. Apply minimum repairs; run unchanged focused regressions GREEN.
3. Review final scoped diff; fresh controlled suite, focused/root types,
   standalone optimized actual entry, 52-input boundary and lineage bindings.
4. Local repair commit, fresh postcommit boundary/bindings and exact SHA/tree/
   direct parent/delta/hashes handoff. Do not represent repair as direct303.

## Tests and evidence
Use the existing C-only `reports/RD-12/run.mjs` with fresh `repair-*` labels.
New checks cover identical +5/255 fault/candidate, rejected insensitive faults,
meaningful accepted restoration, config import/re-entry/foreign/stale rejection,
and translated+rotated geometry/camera/light agreement including replacement,
rollback, frame selection and reset. No native invocation or new screenshot.
New seals have distinct paths; old seals and candidate JSON are never replaced.

## Risks / rollback / safe stop
Stock rendering/readback/parity/performance remain unqualified. Pending future
HEAD config wiring must not be mistaken for a native lease. Preserve failed
attempts; no destructive rollback. Stop only on an exact blocker or unresolved
material contract/authority decision, not routine discoverable details.

## Progress log
- [x] Read current leaf, all camera/projection callers and mature adjacent code.
- [x] Same-test focused RED `repair-owning-red-03` (5 failed/1 passed, exit1,
  no timeout), then GREEN `repair-owning-green-02` (6 passed, exit0, no timeout).
  Both final typed test hashes match; distinct RED/GREEN seals are retained.
- [x] Fresh controlled suite `repair-admission-unit-01` (23 passed), focused
  types `repair-types-02`, root types `repair-admission-roottypes-01` and actual
  entry `repair-admission-build-01` pass with source-bound exit0/no timeout.
  Source binding `verify-repair-admission-bindings-01.json` independently
  rehashes original689/shared18/public429/API33 and preserved candidate09.
- [x] Minimum repairs and all affected callers self-reviewed. No independent
  or human repair review was run by this writer; HEAD acceptance is separate.
- Final delivery state is recorded externally in
  `candidate-repair-phase1-final-01.json` and `closeout-repair-phase1-final-01.json`
  under the run root, not asserted by this precommit plan. These postcommit
  artifacts bind the actual full SHA/tree/direct parent09, exact12 delta,
  final staged diff/check, post52 and immutable baseline checks without a
  recursive commit hash or a misleading direct303 claim.

## Preserved attempts / deviations
- Initial `repair-owning-red-01` included a fixture-import harness encoding
  error; `repair-owning-red-02` corrected it and reproduced all owning P2s.
- `repair-types-01` found three new harness-only typing errors. Type-only
  corrections were made, original09 behavior was temporarily restored via
  focused edits, and final typed tests were resealed/re-run RED03 then GREEN02.
- All earlier RED/GREEN/type-failure receipts and seals remain; none is
  overwritten or promoted into the final same-test proof.
- Build remains 474 files, 44 JS chunks / 1,831,262 JS bytes. The >500kB
  main-chunk warning is retained, not tuned away; no performance claim.

## Definition of Done
All three regressions fail against original behavior and pass after repair;
sealed historical bytes/thresholds/inputs remain unchanged; fresh controlled
suite/types/optimized actual entry/52 guard pass. Actual repair directly parents
09, with exact declared delta and postcommit proof. Native remains NOT_RUN;
HEAD independent acceptance/wiring/new freeze and later same-leaf grant remain.
