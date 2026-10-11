# W07 adaptive normal gesture — scoped independent review

Reviewer `/root/w00_repo_audit`; READ ONLY source/seal/Git and existing evidence reads; no test/build/browser/Native/profile/verifier jobs or product edits. **SPEC_COMPLIANCE: PASS; CODE_QUALITY: PASS** for this E2E-only change. No concrete finding remains. This does not claim successful adaptive gestures, normal-browser PASS, W07 package PASS or Git admission.

## Candidate binding

Base/current HEAD `d5502ae7fd5431d58eda51bea062c54691ebe3c2`, integrator worktree. Receipt `fp06-w07-adaptive-normal-input-product-files.json`: SHA256 `f36718d5fb01a28b3bbb0654269bc7b022aeb2a90300363700bf4ed7fd4f2e1d`, 8588 bytes, timestamp `2026-10-11T17:13:55.109085+00:00`. Independently verified all **30** current SHA/length pairs, exact current grant set, **28** actual base-relative changed paths and scoped diffcheck exit0.

Full base patch: `d0ffea608460855527057e6bdc057a0ded1b82e27ba909fd29dde933a4780f88`, 241545 bytes. Prior-Preparing delta patch: `d290e399737be3bcd9fb46ed1d8570532c3581736ed7a6a38e3d039bcfd1ff02`, 3120 bytes. Both hashes/lengths match. Exactly one file changed versus b516b Preparing seal: `apps/weltraum-browser/tests/e2e/factory-placement.spec.ts`, SHA256 `a194175366d0ab8c553bfe1c325f4c0437e332ab98e5b5586db4816aed74dd9d`, 15259 bytes. Other **29** retain the prior reviewed bytes, including all runtime, Native input/Preparing fixes and unit oracles.

## Gesture and oracle assessment

At E2E lines37/48–63, two per-axis caps start at125ms. Hold duration is rounded distance/unchanged3m/s, limited by the current cap with25ms minimum. Crossing the target halves that axis cap125→63→32→25 and cannot go below25. This bounded state belongs only to the external test driver; it neither changes application input nor introduces an input latch or World authority.

Each trusted `page.keyboard.press` releases before projection reads. Existing helper bounds remain four taps per case, eight X/sixteen Z total, one initial released read plus at most three additional reads, and original30s per-test timeout/config. No unbounded loop/retry, route, evaluation-based mutation, tick/pose injection, queue/deadline change or filtered error list appears. Same Context/Page/World and normal UI actions remain intact.

The unchanged source windows match the three conservative boxes in Root's `reviews/w07-reachable-stand-region.md` (original bb709f…): X[-6.4,-6.1], with Z[8.75,9.15], [8.725,9.075] or [8.7,9] by actual X. Final checks still require actual ground, Y[2.38,2.44], Cargo accessibility and point distance≤4m, and both service distances≤3m. No source/float/reach bound was widened. Finite C26, complete material/container conservation, paid208kg native membership, Ghost retirement, specifically BOM_MISSING on the supported disjoint second site, unchanged failure state and final error/disposal assertions remain byte-identical. The adaptive helper can still fail those assertions; no success is manufactured by stopping retries.

## Recorded evidence and open runtime result

Existing raw gzip bytes matched command SHA/size and exits for81/82. Phase81 is the old gesture's actual selected11-case normal run: **5 PASS/1 FAIL/5 NOT_RUN**, exit1. Its eight recorded X movements span approximately0.85–1.15m, wider than the source's0.3m interval; this is observed old-harness motion, not a new runtime-bug proof. Phase82 full TypeScript/Vite PASS, exit0, raw SHA256 `0c7bf7fea149454a6532d866b517afc138bf5f52e95e2d64fc93d0e64356ef1a`. Build does not establish browser success. The new adaptive normal subset and full browser/package results remain NOT_RUN in this receipt.
