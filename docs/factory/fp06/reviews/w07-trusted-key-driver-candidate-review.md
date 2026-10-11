# W07 public Keyboard driver — scoped independent review

Reviewer `/root/w00_repo_audit`; source/seal/Git and recorded-evidence reads only. No tests/build/browser/Native/profile/verifier jobs, product edits or commits. **SPEC_COMPLIANCE: FAIL; CODE_QUALITY: FAIL — F1/P2 error-provenance requirement.** No authority, release-order or Native runtime defect is alleged. Browser/full17/W07 package/commit remain NOT_RUN/open.

## Exact held candidate

Base/current HEAD `d5502ae7fd5431d58eda51bea062c54691ebe3c2`, integrator worktree. Receipt `fp06-w07-trusted-key-driver-product-files.json`: SHA256 `dbb1aa27af7f05a262a3f56f9e1eba7e8c6e0723d7b935b0905ba5b836fd3ec0`, 8638 bytes. Full base patch: `50a4eb00d32163146a79dcaf0f8505c5d1024cee4a15f8b4c3b51ce10a594274`, 242568 bytes; adaptive delta: `4851a8171e9d5b56e3c38cece4dce266e91aa1e72573c1fddc2b1017ba54c03b`, 3473 bytes. Actual hashes/lengths match.

All30 current SHA/length pairs match; exact current grant,28 actual base-changed paths and diffcheck exit0. Exactly one E2E delta versus f36718 adaptive receipt;29 other files retain their reviewed bytes. E2E `apps/weltraum-browser/tests/e2e/factory-placement.spec.ts`: SHA256 `0d4ac4c8de0f9ce3830c7052a9400d5b27d23e673450732a3ada55efa5aec659`,16267 bytes. Observed changed/untracked paths outside granted product and own W07 run: none.

## F1 — gathered original errors are discarded

E2E:66 uses `results.find`: if both original Down and timed Up reject, only the first reason propagates. More decisively, at61–63, a fresh closing-Up rejection replaces both already settled original causes; the AggregateError includes only closing-release and optional context-close failure. The driver aborts safely, but loses actual original error evidence.

This violates the accepted source preflight `fp06-w07-trusted-keyboard-scheduling-preflight.md`: **“Gesammelte Fehler anschließend unverändert weiterwerfen”** and current `trustedKeyboardDriverAuthorization` **“originalfailures propagate … preservingfailure.”** Thus this is a concrete contract-compliance issue, not an additional optional logging preference or invented runtime RED.

Smallest correction: collect every rejected Down/Up reason after allSettled, append any closing-Up/context-close errors, preserve those original reason objects, and throw them together after cleanup (or the original reason when singular). Always abort after a failed closing release; no additional gesture/Read. No runtime/source/cap or test-timeout change is needed. No execution of this failure branch is claimed by the reviewer.

## Otherwise supported boundary

Lines52–60 issue ordinary public Down and Node-timed25…125ms Up without awaiting Down ACK, bind both immediately with allSettled, then send a genuinely fresh Up in finally including success. Reads/next taps occur only after that final ACK. Closing failure closes Context and throws. Runner issue/ACK telemetry is explicitly not DOM/native event timing. Source preflight ordering caveats remain honest.

Adaptive caps, max4 taps/case/8X16Z, four released readbacks, original30s, same Page/World, source/Float/reach/material/native/disposal/error oracles are unchanged. No hook, route, DOM dispatch, authority evaluation, pose/tick injection, input latch or queue/deadline modification appears.

Existing raw command hashes/sizes bind83's actual **9PASS/1FAIL/1NOT_RUN** and84's full TS/Vite PASS (`815293b8137b1d391ec753c17bea067a1fe43906c18b6f955410abbf82e4d1b6`,1904 raw bytes). Neither establishes the new driver's browser success. F1 needs a narrow correction/new byte seal/review before this scoped contract gate can pass.
