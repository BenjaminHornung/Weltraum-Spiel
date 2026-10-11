# W07 public Chromium keyboard — final scoped review

Reviewer `/root/w00_repo_audit`; source/seal/Git and existing evidence reads only. No tests/build/browser/Native/profile/verifier jobs or product edits. **SPEC_COMPLIANCE: PASS; CODE_QUALITY: PASS** for this one-file E2E driver. No concrete finding remains. Browser/W07-package/Git admission remain NOT_RUN/open; source plausibility is not observed DOM timing or successful movement.

## Exact held candidate

Base/current HEAD `d5502ae7fd5431d58eda51bea062c54691ebe3c2`, integrator worktree. Receipt `fp06-w07-cdp-trusted-driver-product-files.json`: SHA256 `201394fb8346e8b12c93b0bb5d52c34d180d966a80c884697813b9d224c511d4`,8773 bytes. Actual all30 SHA/length pairs, exact grant,28 base-relative changed paths and diffcheck exit0 match; no observed changed/untracked paths outside granted product/own W07 run.

Full base patch: `8cc84f0fc56c32bc661fb25626da04d78288d2dc24a0706a290a52d1f9a7e936`,243267 bytes. Driver85 delta: `ea614b220f30ada06c5468e1725245e8e9ed9eaae6532eadefd5d7b1a3dd8870`,3937 bytes. Hashes/lengths match. Exactly E2E changed, other29 held bytes unchanged. `apps/weltraum-browser/tests/e2e/factory-placement.spec.ts`: `030fc301147af6a45da6412847368e6c7d5243b70811018e53883b83210ef605`,16961 bytes.

## Source and closure assessment

`factory-placement.spec.ts:17` attaches one public CDPSession to the existing Page; only `Input.dispatchKeyEvent` is sent. Lines50–58 use the source-preflight's exact unmodified RawKeyboard payload: a/KeyA/65,d/KeyD/68,s/KeyS/83,w/KeyW/87, modifiers0, ordinary text/code/location, nonrepeat keyDown and matching keyUp. Unknown keys reject. This is browser input, not DOMdispatch, application/Native API, pose/tick or evaluation authority mutation. Remaining Page.keyboard operations are Escape/ghost arrows/r after the walking gesture has fully released; no concurrently held Page.keyboard WASD is mixed.

Independent preflight c0f03549… was read: public CDP targets the same Page and avoids Page input-snapshot instrumentation while general trace remains active. No trace setting is altered. Actual DOM-trust/event timing and the cause of prior zero movement remain unobserved.

Finite25…125ms Node-timed Up, immediate allSettled, fresh final Up including success, all original failure objects/cleanup aggregation and failed-release Context-close/abort are unchanged. Reads/next taps occur only after final ACK. Context teardown releases the protocol session. Driver telemetry remains explicitly runner-only.

All source/Float/ground/Cargo4m/service3m/material/Native/error/disposal oracles, four taps/case/8X16Z, four released readbacks and30s remain unchanged. Native60Hz/cap8/deadline20s are held runtime bytes. No hooks, route, input latch, queue/timeout expansion or outside product leak appears.

## Existing evidence only

Raw command/size/SHA/exit bindings were read:87 preserved TS2345 failure (861 bytes),87b full original TS/Vite PASS (1904 bytes;SHA256 `5f30c4de8bc2968473b5da7ffefbb2f821f5e38bdbf40105de9b94cb72561993`) after only the keyUp literal-type correction. Existing86 remains FAIL; its immutable `browser-trusted-normal-full-86/browser-native-walk-taps.json` (SHA256 `269bb6f38872a3ba0cee283b04c52e953a5b9d2a38209d6ad69b786ca8349578`) contains eight gestures: seven zero moves and one approximately−0.9m move. The restored fixed output was not used for this motion receipt. These do not prove DOM causal timing. No fresh CDP-driver browser or package success is claimed. Earlier review reports remain untouched.
