# W07 trusted-key error provenance — final scoped closure

Reviewer `/root/w00_repo_audit`; READ ONLY source/seal/Git and recorded-build inspection. No tests/build/browser/Native/profile/verifier jobs or product edits. **SPEC_COMPLIANCE: PASS; CODE_QUALITY: PASS; F1/P2 CLOSED.** No remaining concrete finding in this one-file delta. This is source-only closure, not Browser/full17/W07-package/Git PASS.

## Exact candidate

Base/current HEAD `d5502ae7fd5431d58eda51bea062c54691ebe3c2`, integrator worktree. Receipt `fp06-w07-trusted-key-errors-final-product-files.json`: SHA256 `b1ae0d339edefdcc06d387eb9581b85bb8530cac7980e99e3a43549b87303a89`,8632 bytes; timestamp `2026-10-11T17:38:58.776983+00:00`. Independently bound all **30** actual SHA/length pairs, exact grant set, actual **28** base-changed paths and diffcheck exit0. No observed changed/untracked paths outside granted product and its own W07 run.

Full patch: `7a2a35cebc06ca99ef7f143a1c52066a3402507e5462d41baf26cba1f6cef563`,242594 bytes. Prior-driver delta patch: `b13d3d8888ceb9772f3855e4e90f234997765d89e75d522e7013cf7be877e428`,1756 bytes. Actual hashes/lengths match. Exactly one file changed versus dbb1: `apps/weltraum-browser/tests/e2e/factory-placement.spec.ts`,SHA256 `561beee4c9c444deca9e3ccf49cf907dc55f9a3f3676790d61b507151e5cd33e`,16292 bytes. Other **29** files retain their reviewed bytes.

## Closure reasoning

E2E:56–67 now gathers **every** rejected original Down/timed-Up reason from allSettled. The finally block sends and awaits a fresh Up, including success. A final-Up rejection appends its actual error, attempts Context.close, and appends any close error without replacing prior causes. After cleanup, one failure throws its original object; multiple failures throw AggregateError containing all original reason objects. No error path reaches a Native read or another gesture. Both initially issued requests settle before the fresh release, so late Down cannot survive an already-finished old Up through this ordering.

This directly closes the accepted preflight/authorization requirement to preserve gathered original failures. Prior FAIL report `fp06-w07-trusted-key-driver-review.md` remains unchanged at SHA256 `9ae2cf4b5d054172f4d81a890436c848b725248379fbd963156ee3db82ca9716`. Failure-branch execution is NOT_RUN by this reviewer; the closure is independently read source, not an invented runtime RED/GREEN.

The only delta is reason collection/aggregation. Ordinary public Keyboard methods, Node25…125ms timing, bounded adaptive caps, max8X16Z, four released readbacks, original30s, one Page/World and source/Float/reach/material/native/disposal/error oracles are unchanged. No input retry, new authority, hooks, source/runtime write, tick/pose injection, latch, queue or deadline expansion exists. Runner telemetry remains explicitly distinct from DOM/native event time.

Existing phase85 full TS/Vite build exits0; command/exit and1904 decompressed raw bytes independently match SHA256 `5f30c4de8bc2968473b5da7ffefbb2f821f5e38bdbf40105de9b94cb72561993`. No browser job was started by this reviewer. New-driver browser/package/commit results remain open.
