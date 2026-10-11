# W07 Preparing input — final scoped quality closure

Reviewer `/root/w00_repo_audit`; read-only source, unit, seal/Git and existing log inspection. No tests/build/browser/Native/profile/verifier jobs or product edits. **CODE_QUALITY: PASS; Preparing P1 CLOSED.** No remaining concrete finding in the authorized two-file delta. Normal browser, whole W07 package and final commit admission remain OPEN. Earlier e34b quality report and a7d1 supplement remain unchanged historical receipts.

## Final candidate

Base/current HEAD `d5502ae7fd5431d58eda51bea062c54691ebe3c2`, integrator worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`. Final receipt `fp06-w07-input-delivery-preparing-final-product-files.json`: SHA256 `b516b07c5502fe559ea89d530d912c76e3d2d69b0a840e5a466fe06cbab850b2`, 9097 bytes, timestamp `2026-10-11T17:02:33.072722+00:00`. All **30** current SHA/length pairs matched independently; actual **28** base-relative changes match the receipt and scoped diffcheck exits 0.

Full base patch: `2bf5e1f0dcf225085c1f6d41b05760b4c643eab87a87e9a9faa42b3fe4964a4b`, 241228 bytes. Prior-candidate delta: `602b8ac9d50f57afe485127f21efaf6591fd88030c0259d66ba7021c49e9ace4`, 8217 bytes. Both match actual patch bytes. Exactly two changed files versus 0f927 candidate; other **28** stay identical:

- `src/hestia-prototype/physics/session.ts`: SHA256 `3bd432ac5618a6b30b1b5248c9ae0711bd7e722fd6b079189ae623f62c6973a4`, 38047 bytes.
- `tests/unit/hvp-player-input.test.ts`: SHA256 `fbc9380f96223d9c6345fae2df1c11a5f278c9bc6a6704e2f948162594cbd931`, 26308 bytes.

Paths are relative to apps/weltraum-browser. Client, Worker, Locomotion, producer, Bootstrap, normal E2E and admission caps retain their reviewed bytes.

## Intrinsic contract closure

`session.ts:353–356` first obtains the successful `moving.begin` preparation, then calls existing Factory-only `neutralizeFactoryInput` synchronously before returning it. A rejected begin does not neutralize ordinary gameplay. A successful begin clears admitted levels and pending native jump before another native timer callback can run, regardless of UI/producer presence. Preparing remains Running with `moving.busy=true/holdsWorld=false`; no pause, catchup or simulated tick is added.

The helper at120 and unchanged Locomotion cancellation alter only stored input/jump. They do not alter pose, vertical velocity, enabled state, clock, geometry/membership, hit/preparation binding or moving-parent motion. Factory=false makes the helper a no-op. Stage/other Native hold neutralization remains unchanged; ordinary movement admission stays rejected during Preparing, while explicit cancellation remains allowed. Reviewed input ACK isolation, asynchronous restore/dispose barriers and original cap8/deadline20s are unchanged. The existing normal Bootstrap consumer/producer stop barrier remains intact; correctness no longer relies on it for this Preparing entry.

## Actual oracle and provenance

Read existing command/exit/decompressed raw hash+size receipts from `evidence/factory/w07/2026-10-11T122211.412749Z`; no reruns:

- 76: preserved contact-fixture failure, not counted as the business RED.
- 77: before runtime fix, **2 FAIL/22 SKIP** across direct Native and Client APIs; four actual soft assertions observe +0.3 m and one unwanted jump while six real Native ticks continue. Raw SHA `2146587e1b601fc41d400048b20bfe03a2a9cb7277e7009cc38d6615fe5698f5`.
- 78: same focused cases **2 PASS/22 SKIP**, exit0.
- 79: final affected **89 PASS/6 files**, including Input24 and original moving-session4; raw SHA `d9a1d187d7ac186502a1409ad34f556d38df463bbc3a2e914babfe49342a6b97`.
- 80: full TypeScript/Vite PASS; raw SHA `b513948a07670fe8498c06d767cf17629ca351150897baf9d183be1fe55c6a0f`.

The new test uses real Rapier floor/coverage plus a mechanical stone-fragment fixture admitted through existing Native terrain transactions; transport is synthetic. It checks true Preparing/preparation bindings, unchanged dispatch pose/ticks, six advancing ticks without retained movement/jump, and actual rollback to Idle. It does not claim source-site/browser proof. Velocity/enabled preservation is static from the minimal helper, not an invented additional assertion.
