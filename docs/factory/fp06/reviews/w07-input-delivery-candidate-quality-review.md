# W07 immediate Factory input — final scoped Code Quality review

Reviewer `/root/w00_repo_audit`; independent read-only source, unit, Git/seal and existing raw-evidence inspection. No tests/build/browser/Native/profile/verifier jobs, product edits or commits. **CODE_QUALITY: PASS.** No concrete remaining finding in the five-file input delta. Full W07 specification/browser/package/evidence/commit gates remain separate and OPEN; this is not package PASS.

## Exact candidate binding

Integrator worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, branch `codex/hestia-fp06-integrator-2026-10-11`; base/current HEAD `d5502ae7fd5431d58eda51bea062c54691ebe3c2`. WRITE HOLD receipt `fp06-w07-input-delivery-candidate-product-files.json`, timestamp `2026-10-11T16:50:12.656879+00:00`, SHA256 `0f9272a18f2f968a8b68fd6735a4c59300b84c07babdad0fa702af6912aa09b7`, 8536 bytes. Independently verified all **30** current SHA/length pairs, exact current grant set, actual **28** base-relative changed paths and `git diff --check` exit 0. Exactly five files differ from Ninth; other **25**, including Bootstrap/Ghost, input producer and normal E2E, retain Ninth bytes.

Full base patch: `d347852c0651fbd55ba8c509c2717bbefdcde49787911b8566fc62718a6be385`, 237566 bytes. Ninth delta patch: `e52212c7dd795207321acf4a97858990916150677ef6bf8393d68b56893d92ea`, 40156 bytes. All patch hashes/lengths matched independently.

| Delta file under apps/weltraum-browser | SHA256 | Bytes |
| --- | --- | --- |
| src/hestia-prototype/physics/client.ts | 4b8bfe5766be527c9c71a5312cc80068cb6ac5b157012e24f4349993c71cc0e6 | 34808 |
| src/hestia-prototype/physics/physicsWorker.ts | 776ec49c1c8e180eb02e11d9e5a828087d4b7efd57a65619989c3408276056cb | 16654 |
| src/hestia-prototype/physics/session.ts | a08c7d6e2c2efdebd87b22fb64a38b9ce41561203563a321eadbf5737ee8c4e6 | 37983 |
| src/hestia-prototype/player/locomotion.ts | 59957019db4330ff1160851ec10326ee21fa1b8b6c1f372bb895b3af1b3aa89e | 7545 |
| tests/unit/hvp-player-input.test.ts | e2fff479910437fdd3fb431dd2fb4b981b4090dc6495e53de786d999a49edf4f | 23107 |

## Contract assessment

Worker `physicsWorker.ts:78–86` handles typed `FactoryInput` before the generic snapshot/clock/timing reply path. It validates message identity and calls Native only when initialized, undisposed and outside asynchronous replacement. Its ACK carries only identity/rejection; it does not read World, flush timing arrays, alter restore state or reset `previous`. Factory Read at160 ignores even supplied input; Legacy retains its original Read input. The unchanged Native timer remains the sole clock driver.

Client `client.ts:182–186` branches on the pending request kind before any clock/timing/restore/public/held handling; even an input ACK carrying forbidden snapshot metadata cannot adopt it. Changed input and release dispatch independently of the one busy Read. Equality suppression preserves ordinary polling and avoids redundant intents; no dirty-drain/event queue remains. The producer still emits a single jump edge; Native owns its one pending jump, ordinary neutral release preserves it, explicit cancellation clears it.

Command depth at158/443–445 blocks input until command completion and orders neutral cancellation before the command. Restore mutation, body/terrain/facility holds, failure and closing guards prevent queued replay. The Worker restore guard remains effective across awaited replacement preparation. Dispose closes input before posting Dispose; subsequent events allocate nothing. Existing Factory Read withholding at191–193 protects public AND held staging views. No input ACK grants publication authority.

Session `session.ts:337–345` admits movement only for Factory, live Walking/Running character and idle native transactions; invalid active input uses unchanged Locomotion range/boolean validation. Neutral cancellation has a strict zero-input contract. Private `holdTick` at120–121 is used by terrain, branch, body-cut/residency, neighbor and coverage holds: it clears level/pending jump before the existing pause. Locomotion49–54 changes neither position, vertical velocity, jump count nor enabled state during cancellation. Existing hold/resume/rollback clock policy is preserved. Legacy neutralization is gated off.

Original pending cap **8** and deadline **20,000 ms** remain unchanged. A blocked input/release uses `catch(fail)` to terminate and reject pending requests rather than silently leave a moving owner alive. Native ownership, collision caps, walking speed, timestep and source support remain unchanged; no catchup, pose write or new input-owned timer exists.

## Actual evidence and limits

Read command/exit/raw gzip bytes from `evidence/factory/w07/2026-10-11T122211.412749Z`; six relevant raw SHA/size pairs and exits matched metadata. No reruns:

- 69: genuine untouched-runtime supported Native Down/Up RED, **2 FAIL/14 SKIP**; no movement and lost release were actual assertions.
- 70: genuine pre-fix hold/cancel/Legacy RED, **4 FAIL/16 SKIP**.
- 71: separately documented reconstructed unsafe report-only policy AFTER initial implementation, **1 FAIL/20 SKIP**. Its retrospective source reconstruction is not presented as original preimplementation evidence.
- 72: then **21 PASS**. 73: actual **1 FAIL/82 PASS**, clock-reference oracle captured before Prepare changed that reference; retained as a test-baseline error.
- 74: corrected final oracle, **83 PASS/5 files**, wrapper 5.126663 s; raw SHA `fca3509b1eb44665d0a5d22015a8cb37f25192c09ac77ab68c98192379d28e6a`.
- 75: full TS/Vite **PASS**, wrapper 4.150740 s; raw SHA `66f66677f67532c460e94a91fc89207e762b37d8a1cb5577e4407a0d255905e6`.

The harness uses real Rapier floor/coverage/owner and explicit Native advance, with synthetic transport/ACK control. It checks movement/release before ACK, unchanged pose/tick on dispatch, one jump/cancel, real hold/resume, forbidden late metadata, disposed events and overflow cleanup. It does not execute actual browser Worker scheduling or source-site walking. Actual Worker/async restore guards are statically reviewed, not claimed as newly executed worker tests. Normal browser and commit admission remain pending.
