# RD12 Phase1 owning repair handoff

Three HEAD-confirmed P2s repaired in the same leaf. This is a local repair
candidate, not HEAD acceptance, product integration or native Phase2 completion.
`productIntegrated: false`. No browser/server/port/GPU/agent/delegation,
root/shared/dependency/product write, push/PR/publication or deletion occurred.

## Identity and final proof

Branch: `feature/hestia-rd-rd12-2026-10-04`.
Immutable START: `303e6d651482338cc876696792acdd344603232e`.
Required direct repair parent: `09ca699f1fab6bbe280556ddc660f56cbb383dba`,
tree `1749306fd35cd525aeff3c0e36d43e8f711e4845` (parent303).
Read-only product base: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.

Run root:
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-12/phase1-303e6d65-20261004-a/`.
Actual final repair SHA/tree/direct parent/delta and final proof SHA-256s are
external postcommit evidence, not recursively embedded in this committed file:

- `candidate-repair-phase1-final-01.json`: actual repair identity, exact12 delta,
  all24 owned files, original689/shared18/public429/API33, math3, all preserved
  receipts/seals, latest source-bound checks and optimized asset hashes.
- `closeout-repair-phase1-final-01.json`: independently rehashed candidate,
  actual Git identity/delta/unchanged scope, final receipts/source bindings,
  23-test result, post52 boundary and preserved immutable candidate09/freeze.
- `commands/repair-local-candidate-01/`: actual scoped local repair commit.
- `commands/repair-postcommit-guard-01/`: actual postcommit52 guard.
- `commands/repair-phase1-final-01/`: actual candidate gate exit/log/receipt.

This document alone is not evidence that those postcommit gates ran. The final
delivery requires the actual artifacts above, successful exits and their hashes.
Original candidate `candidate-phase1-final-01.json` remains byte-identical,
SHA-256 `20560983d84e8b9bd3b4d135ded003dc20896630266dd2ba22291f540d5c0ad1`.
HEAD disposition proof `HEAD/rd12-phase1-head-09ca699f.json` remains
`e84ac212c19fda9bf9ac7c3f5df0ac816a8218456091590b00730e5c656cd165`.

## Owning repairs

1. `qualification-v2.ts` explicitly reuses byte-identical v1 ROI/math/numeric
   thresholds and additionally rejects any deliberate fault that still passes
   positive MAE acceptance. Native callers explicitly use v2. Historical v1
   still demonstrates the +5/255 overlap; it is neither edited nor relabelled.
   Identical faulted/restored images fail; insensitive controls fail/defer;
   +1 RGB restoration with +10 RGB fault passes the unchanged numeric gates.
2. Native output freshness is admitted once, with an immutable freeze + native
   lease + run + executable + URL + output identity and a hash-bound admission
   record outside Playwright's disposable `results/`. Worker reload validates
   all identity/record bytes; env root alone never admits an existing sink.
   Foreign/stale roots reject. CPU import tests use synthetic immutable identity
   and fresh retained files, never execute the stand-in binary or acquire a real
   lease. Exact future HEAD snapshot/lease wiring remains authored, NOT native.
3. Camera position/target and key/fill light positions use the existing Babylon
   root world matrix point transform. Camera up, ambient and directional light
   directions use its rotation without translation (`TransformNormal`). No
   normalize helper/schema/fixture mutation. Private candidates stay disabled;
   failed replacement restores old lights/camera, successful replacement and
   frame selection/reset use the adopted root. Identity-root behavior is intact.
   The CPU check uses translation `[7,-3,11]` AND Z90 rotation, distinguishes
   points/directions, and rehashes canonical fixture digests before/after.

## Exact declared repair delta

All paths below are relative to `experiments/hestia-rd-2026-10-02/`:

- `src/experiments/babylon/index.ts` — root-aware camera; initialize after private projection.
- `src/experiments/babylon/projection.ts` — root-aware light points/directions.
- `tests/RD-12/browser.spec.ts` — explicit v2 gate caller; authored/compiled only.
- `tests/RD-12/repair.unit.test.ts` — deterministic parity/root/caller regressions.
- `tests/RD-12/native-config.unit.test.ts` — CPU fresh/reload/foreign/stale admission checks.
- `reports/RD-12/qualification-v2.ts` — versioned negative-control qualification.
- `reports/RD-12/playwright.config.ts` — once-only freeze/lease-bound admission.
- `reports/RD-12/vitest.config.ts` — explicit owning CPU suite membership.
- `reports/RD-12/run.mjs` — focused checks, explicit CPU/native scope, scoped repair commit.
- `reports/RD-12/bindings.mjs` — honest direct09 repair lineage/new seals; immutable303 retained.
- `reports/RD-12/PLAN-REPAIR-09ca699f.md` — bounded plan/progress/deviations.
- `reports/RD-12/HANDOFF-REPAIR-09ca699f-20261004-A.md` — this delivery index/limits.

Original `oracle.ts`, unit/ownership tests, prior PLAN/HANDOFF/inventory, original
native spec seal, fixtures/profiles/package/lock/shared/root files are preserved.

## Focused RED/GREEN and fresh controlled verification

All receipts are under `commands/<label>/receipt.json`, bind actual source hashes,
have actual exits/timeouts and `nativeExecution: NOT_RUN_PHASE1_CPU_ONLY`.

| Check | Actual result | Receipt SHA-256 |
| --- | --- | --- |
| `repair-owning-red-03` | exit1, 5 failed/1 passed, no timeout | `4cff7ee148d721e9b1128a24b1fbe56e268b36e2f13079f8c6d9ce29cc7b7890` |
| `repair-owning-green-02` | exit0, 6 passed, no timeout | `41033e3faa84a93ae693da254e7a452ced138271b896448c6f18f3fc7e6d08e3` |
| `repair-admission-unit-01` | exit0, 23 passed, no timeout | `6dcd8841aebdc701fbefa45b5d1dddd91c8b3e2af5cbd600f17f206295946b10` |
| `repair-types-02` | exit0, no timeout | `cf74705983928f2e622aaf6195fcd2905c8fca7e342832f7a8a1695729c57c9a` |
| `repair-admission-roottypes-01` | exit0, no timeout | `a0bff735186c86811f5aaf4be1412ffb2f2df6169c2add3e66492e70bf421b14` |
| `repair-admission-build-01` | exit0, build only, no timeout | `af31a86de3d67b113b58b1b0ed2b977c4c01bd35668cb80a64f1cc3701cbe3ab` |

Final typed repair tests have identical RED/GREEN SHA-256s:
`repair.unit.test.ts`: `2a0f40e7f1a328eb627749bc080f58ba4d416582cb35f861c08f254132f9b6a2`;
`native-config.unit.test.ts`: `57cdffae5423db15575e8ecb83a44e942e62680ec135fc46678f666340764278`.
Fresh distinct seals: `oracles/repair-oracle-red-seal-03/` and
`oracles/repair-oracle-green-seal-01/`; no historical seal replaced.
New gate SHA-256: `8b398348b53f6d76c6bbbe1854e14b5dae4fb07ae4044636e8ca9294c3fab1ee`;
explicit native v2 caller: `caf4fea3947013663142abe6ba7323fffd270d2154fb5d71ae5abef6e9640222`.
Original v1 oracle: `2c8077771caa3d2b6708946ee375da7053498323fdc47a1592f420c3daa6685b`;
original native seal: `4d8f848b1df588e2f88a2c19a1e49f817b311d4dfb70c8c299d1c657caed9537`.
Earlier harness RED/type failures and all Phase1 history are retained separately;
they are not substituted for the final same-test RED03/GREEN02 proof.

Optimized actual entry: 474 files = public429 + 44 JS chunks + HTML;
1,831,262 JS bytes. Main `assets/rd12-C55uOXX_.js`: 1,219,417 bytes,
SHA-256 `30964d4e9dd33fe62443756f1846f2b5d4f697c085a8463ac7bdc6eab7d40d5d`.
HTML SHA-256 `ed8053116ef0b8ca6b3e19a8deba8eb5de079a054edd8b6f9538c722930cc12d`.
The >500kB warning remains; this is no GPU/performance measurement.

## Review, cleanup and remaining authority

Self-review only for this repair; HEAD's independent owning repair review and
acceptance remain separate. No independent/human repair review claimed here.
Two automatic `.opencode/throughput.jsonl` and `.opencode/throughput.md` logs
remain untouched/uncommitted; `originalAllFilesGate` stays
`FAIL_ACCEPTED_NARROW_EXCEPTION`, never exhaustive clean PASS.
All CPU verification children exited; builds/cache/node_modules/test dirs retained.
No task-owned native processes/leases/ports exist and no cleanup deletion occurred.

Native browser/screenshots/lifecycle/fault/parity/performance/art: NOT_RUN.
Native allocation unsupported; mapped buffers unqualified (stock buffers lack
COPY_SRC); shader/BRDF/shadow/AO/water/weather/sample/alpha parity unqualified.
Historical RD11/RD40 failures and missing art/LFS evidence remain untouched.
Next authority is HEAD independent owning repair review, integration of the actual
accepted repair, actual C3/C4 registration/root Vite wiring, new locked freeze and
explicit same-leaf native Phase2 grant. No current config artifact grants that.
