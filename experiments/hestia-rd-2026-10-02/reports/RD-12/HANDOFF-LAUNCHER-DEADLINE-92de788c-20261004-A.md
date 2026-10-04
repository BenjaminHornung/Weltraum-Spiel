# RD12 CPU-only launcher deadline repair handoff

Owning busy-expiry bug reproduced and repaired with an inline latch. This is not
a native re-run or qualification upgrade. Programme NOT_READY; ALL core and final
planner-package completion remain outstanding. `productIntegrated=false`.

## Identity and authority

Repair START/direct parent required:
`92de788c5f96447330435579ffa20818c81b79d8`, tree
`c6d6344c3475138fb7c3a14ae80f8ffc15bae446`.
Historical executed source remains5e4c1b8fea9026bc38aa38f4258d9892f2b848b7.
HEAD native integrity proof SHA256:
`2c4adf93c3ed18d6963c0bf68b05971e0e7b1c76077648c0c60f74b5cfd9c165`.

Fresh CPU-only root:
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-12/launcher-deadline-repair-92de788c-20261004-a/`.
Actual commit SHA/tree/direct92/exact delta and final receipts are external:
`candidate-deadline-final-01.json`, `deadline-final-01/receipt.json` and
`closeout-deadline-final-01.json`. This precommit document alone is not their proof.

## Owning change

The one-shot always sets `expired`, even while busy. The control interval no
longer admits requests once expired. Existing owned work/receipt continues under
the unchanged one-hour job timeout; its `finally` clears control and sets exit1
after successful receipt or persisted catch/error receipt. Idle expiry stops
immediately; cooperative stop still clears interval/deadline with normal status.
No process kill was added. The entire prefix before the control footer, including
native admission, job spawn/timeout/receipt and original inventory, is unchanged.

Exactly five lab-relative paths:
- `reports/RD-12/phase2-launch.mjs` — existing inline expiry owner, only old file changed.
- `tests/RD-12/launcher-deadline.test.mjs` — one runnable four-case Node test of actual footer.
- `reports/RD-12/launcher-deadline-repair.mjs` — fresh CPU receipts/preservation/identity gate.
- `reports/RD-12/PLAN-LAUNCHER-DEADLINE-92de788c.md` — bounded ExecPlan/progress.
- `reports/RD-12/HANDOFF-LAUNCHER-DEADLINE-92de788c-20261004-A.md` — this delivery index.

## Actual RED/GREEN and checks

Node VM evaluates the footer bytes read from the actual launcher, not a mirrored
algorithm or full-module import. Mock timers, in-memory files, job/receipt deferred
promises and mock exit status prove only controlled CPU behavior. Four cases:
idle expiry, busy expiry through receipt/no further jobs, rejected job through
error receipt/finally, and cooperative stop through receipt/no extra jobs.

| Label | Actual result | Receipt SHA256 |
| --- | --- | --- |
| `deadline-red-01` | exit1, 2 failed/2 passed, no timeout | `8b714b7f89eb413b7b1399598053ff00ba89d5c0c71a2ab1471fc61dc8efd4a6` |
| `deadline-green-01` | exit0, 4 passed, no timeout | `0b75403058510b1dc9519ef081034e8e224c3c264938ea4a2eac035a64eecc38` |
| `deadline-types-01` | exit0, no timeout | `bef6c43ca570360f017ef11c9fab185fa4fd499b695fb13571adfa4b5c25c3a3` |
| `deadline-roottypes-01` | exit0, no timeout | `01781553933e004db9cb5ee2fed1ba51a89187a3c2e9c905c83130ab02536803` |
| `deadline-syntax-01` | exit0, no module execution/no timeout | `0bfa95ea75f1358b7eab74f50ca473aa992f19264fe973df821a5217c0b2b12e` |

RED source/oracle preserved before mutation:
`original-launcher-92.mjs` SHA256
`019f00ba6b24bd1b2ffd9bfc8a78b08faacf7e7f5d91f818fbe7aacc34965562`;
`deadline-test-seal.mjs` SHA256
`bc29da70db511402fb5c1218080ae18485aec381f0334feb7c2ce9336e750124`.
GREEN launcher SHA256:
`d06afc5c18971bb965588a8d65b21b77842c245e3dbf70f50657cbf656a863a5`.
Final gates read actual receipts/raw hashes/source bindings, same sealed tests,
full52 taskRD12/start92/baseb3 boundary, exact five paths and Git blob identities.
Old strict5e helpers are preserved; no old lineage gate was relaxed or invoked.

## Preserved native/media qualification

All713 frozen source, prior269 evidence except launcher, all253 slice files,
68 PNG/facts pairs, all84 local LFS objects/pointers, build509/public429/API33,
fixed lease/freeze/proofs and all historical receipts are rehashed unchanged.
Native original remains0/16 FAIL; diagnosis3/3; reader-v2 remains12/16 FAIL/PARTIAL,
mapped buffers UNSUPPORTED and F06 DEFER. No new PASS or native timing claim.

Unchanged native result SHA256s:
- Original: `0b25a34aa663885fd85b63b29c5bdd9fbbde0506ba8cba19768f7d8170a5ee7b`.
- Diagnosis: `e7156837c5e09333b27f07373e406dad5a51b4dd3ff7cd9c43dec9b28f675eed`.
- Functional-v2: `e7b346c5a0756795ac85665fc688e3f8645a686dcf61e9cfdc76ff5232d0a46e`.
- Slice manifest: `871b621994b4c93ebe0b568f365d2ff91f408285f7ea126008f6466f55200a26`.
- Original92 candidate: `cdd528a6be5082e4eb518169da0cd9a7314c71ad38b30547b49c16c37316eb5b`.
- Original92 closeout: `585a66675105be5f1f129b88017359d6594861f95b60d27b74cfdff9442ade3d`.

## Review, cleanup and boundaries

Self-review only for this repair; HEAD fresh CPU/independent repair review and
serial integration remain separate. No delegation/agent or native/browser/server/
port/GPU invocation, no runtime/root/shared/package/dependency/HEAD write, no
deletion/publication. CPU children exited; fresh receipts/caches retained. Port
and managed-native timing were deliberately NOT_RUN, not re-proved via forbidden
commands. Both automatic throughput logs stay untouched/uncommitted and the
all-files gate remains FAIL_ACCEPTED_NARROW_EXCEPTION, not exhaustive clean PASS.
