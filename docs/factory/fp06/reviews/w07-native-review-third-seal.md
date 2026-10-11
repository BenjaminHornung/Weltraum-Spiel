# W07 independent native followup — third-browser seal

Reviewed package base: `d5502ae7fd5431d58eda51bea062c54691ebe3c2`.
Historical candidate timestamp: `2026-10-11T13:55:12.801875+00:00`.
Reviewer: `/root/w00_repo_audit`; read-only code/artifact inspection. No tests, build, browser, profiler, or verifier CLI were run by this reviewer. No product, test, or foreign evidence files were changed.

## Scoped verdict

- **NATIVE_SPEC_COMPLIANCE: PASS for the historical third-browser seal and the native contracts reviewed here.** The prior Cargo owner identity finding R1, disposed-checkpoint finding R2, and common publisher frame correction are closed.
- **NATIVE_CODE_QUALITY: PASS for that historical seal.** No remaining finding was identified within this narrow native followup; earlier unchanged native membership, rollback, caps, source, and lifecycle boundaries retain their previously reviewed scope.
- **CURRENT_FULL_BYTE_ADMISSION: PENDING.** A subsequent, explicitly authorized mount-recovery change affects two different paths. The third seal is historical and does not seal those new bytes.
- **FINAL_W07_PACKAGE_GATE: PENDING / NOT_RUN by this reviewer.** The third browser command exited 1; completed native walking, paid placement, later browser cases, final manifest, and final Git/LFS binding are not admitted by this report. This is not a package-wide gameplay PASS.

## Candidate binding and authorized later changes

The reviewed external patch is `/workspace/.cloud-setup/fp06-w07-before-third-browser.patch`, SHA256 `d1e463f86c9cb6dd2fe8d27eb187532a9c27333963bf2cdc14a3d28ec728f6b4`, 169868 bytes. Its file receipt is `/workspace/.cloud-setup/fp06-w07-before-third-browser-files.json`, SHA256 `e39a62e82420bc3b767b4b6b4c02d10b646c4ddbda4821af6ae35645d524591e`. At the initial read all 27 granted product file hashes and sizes matched that receipt; the 27-file grant and receipt sets matched. The patch's 24 existing-file headers were within that grant. The complete file receipt binds unchanged new files as well.

Since the previous second-browser seal, the four changed runtime paths were `construction/placement.ts`, `physics/factoryFacilitySession.ts`, `physics/session.ts`, and `hvpBootstrap.ts`; the corresponding three changed unit files were `placement.test.ts`, `facilitySession.test.ts`, and `hvp-bootstrap.test.ts`. The closed fix bytes include:

| Runtime path suffix | SHA256 | Bytes |
| --- | --- | ---: |
| `src/factory/construction/placement.ts` | `89194437192f2788e4ea7458af06f760583f8250ccce494a89e0cc225debd09e` | 11255 |
| `src/hestia-prototype/physics/factoryFacilitySession.ts` | `620a60b3d7d1e5edfef558fe07fac9af78cd9fc13385f9c45ad5fde1279d2eee` | 18339 |
| `src/hestia-prototype/physics/session.ts` | `e21fd44869c96350212f62ad33c11066029de646760fd74caa1ad2752b6797fd` | 37128 |
| `src/hvpBootstrap.ts` | `4de5d525722ee6bcf18c94a091d6f8d33f0b937708465188fd1b65c52d528b55` | 164186 |

An end read detected later changes in `src/factory/session/factorySession.ts` and `tests/unit/factory/hostLifecycle.test.ts`, alongside the separately allowed browser harness split. They are **authorized later changes**, not an unauthorized write finding. Root identified control commit `98fe5e6ea02e31549cbb0027df3a47615174388b`; independently read current `source-lock.packageScopes.W07.narrowMountRecoveryFollowup` records authorization at `2026-10-11T14:04:24.667053+00:00`, exactly those two paths, and the purpose: failed initial Cargo catalog/material initialization must release mounted-host reservation before a valid retry on the same host, without changing World/source APIs. The receipt describes business RED then minimal fix and a fresh seal/review. Its authorization-time text `not yet executed` is not a claim about later execution. Those moving bytes and their future seal are **PENDING**, not covered by this historical PASS.

## Closed findings and retained boundaries

**R1 (previous P1), closed.** `src/factory/construction/placement.ts:58` rejects an instance ID equal to `view.cargoAccess.ownerId` as `DUPLICATE_OR_CAPACITY` before profile preparation or material candidate creation. `src/hestia-prototype/physics/factoryFacilitySession.ts:129` rejects an owner ID equal to the actual initial Cargo owner as `InvalidOrDuplicateIdentity` before native allocation. The valid lowercase/underscore Cargo ID is the concrete trigger; a hyphenated `hvp-drop` example is not accepted by the ID grammar and is not evidence for this finding. New pure and native counterexamples check rejection and unchanged material/handle/count state. The initial source owner and sole original Resources container remain protected from replacement by the staged facility registry/projection keys.

**R2 (previous P2), closed.** `src/hestia-prototype/physics/session.ts:235` checks `disposed` before invoking the added Cargo/facility legacy-checkpoint guard. Dispose followed by checkpoint now raises `World checkpoint requires a confirmed paused generation`, rather than querying a freed World. The actual native counterexample disposes a session with initial Cargo and checks the exact error and disposed zero-count read. Existing closed legacy persistence decoders remain unchanged; W10 combined checkpoint/recovery is not asserted here.

**Common frame correction, closed.** `src/hvpBootstrap.ts:2200` derives the mesh artifact with the common Host `frameId` for both ghost and installed facility projection. Ghost material ranges are applied within the same derived artifact. This preserves original W05 source/local vertex coordinates, regenerates the derived content hash, and retains the shared +90-degree Y pose transform. The actual Bootstrap ghost create/move/rotate/cancel unit uses the strict publisher/backend lifecycle and verifies every facility upload shares the Host frame. Its transport physics fixture is explicit; it is not proof of live native player movement. Native Cargo facts are exercised separately in actual native session fixtures.

Unchanged code was rechecked where these fixes touch contracts: the sole private native World, initial Cargo source/profile binding and natural support/air/LOS/reach query, complete body/collider/shape/friction/extent/pose membership comparisons, candidate identity and phase checks, staged allocation before publish, rollback/finalize disposition, and exhaustive membership including initial Cargo remain as in the prior native review. Initial Cargo counts toward the 16 fixed-owner cap; dormant candidates still count toward unchanged global body/collider caps, and conservative staged CPU copies remain admitted before allocation. No terrain-to-build-grid alias, source rewrite, second Resources authority, generic UI/Worker World authority, broadened legacy decoder, or raised timeout/global cap was found in this narrow delta. Native checkpoint capture after Dispose is corrected without claiming W10 functionality.

## Actual evidence, not rerun

All paths below are relative to `apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z` in the integrator worktree. Existing command metadata, exit receipts, readable logs, and gzip raw logs were read. For phases 28–32, decompressed raw SHA/size matched command receipts. Readable and raw logs matched after ANSI removal and per-line trailing whitespace/newline normalization; build raw output is 1904 bytes and readable output 1903 bytes, so literal byte equality is not claimed.

| Phase/readable log | Actual recorded result | Readable SHA256 |
| --- | --- | --- |
| `28-red-frame-cargo-owner-dispose-checkpoint.log` | exit 1; **4 FAIL /54 SKIP**, 3 files, 9.85 s; all four actual frame/identity/disposed counterexamples fail before correction | `b4119c8bcb5a32230a0636df7cb5160844fbf04d3410c5c2ef326645f189ec08` |
| `29-green-native-placement-cargo.log` | exit 0; **30 PASS**, 4 files, 7.54 s | `43f89a346f7f25ad02e7fe3f13a49ac0670208ce0af58b850ea9705a712e758f` |
| `30-green-actual-host-frame-cycle.log` | exit 0; **1 PASS /34 SKIP**, 7.99 s | `7f48e9fe7284e6962692fddc010e1d5e1c7e84401ccef6a33b2880d343c075ca` |
| `31-build-after-frame-owner-checkpoint.log` | exit 0; actual full TypeScript/Vite build | `0e98e569370274273e46207cb2445ce1a569ae92bbaabea40d393ead71ddbac5` |
| `32-real-browser-third.log` | exit 1; **1 PASS /1 FAIL /4 NOT_RUN**, 55.9 s | `b7c119792394438b420809e93e264f5e2f28e25846fae3c1f875637edadfe99e` |

Raw gzip SHA256 values, respectively: `eb89e0c472728abe31fc4f391e1cb6e7a16b236ae9c7088b19b2d5512b25e5f3`, `aecfea601071e16d5529ebf6aec0aec271058f7ec6f33431db356248849444b4`, `6fececc08951430e373ce48605c083506c9c0e02fe2c2e139b50d066ae5947ac`, `e9fec69f21a2d08a0de0603d55504e79564a51daa3f4ab7f9c5a4a1dd1e4b33f`, `9e1a6480c3445ca927dacffc77956b836bc8f2f0bb8eb6e4fddee1480b355f47`.

The browser trace ZIP `browser-third/playwright-output/factory-placement-W07-real-efee5-source-access-to-the-Cutter-chromium/trace.zip` was independently read: 8645206 bytes, SHA256 `e2c1b8f4e162ce95c7bab3ca155d2508549e374c2327b7d45b108b1f5fef5a6a`. Its actual trace events record case start near 20661.067 ms; successful preview at 24118.666–30495.279, Cargo Open at 34322.076–40451.262, repeated Open at 43611.399–49468.770, and Play click starting at 52801.259 with no completed after event. Play begins approximately **32.14 s after case start**, already beyond the unchanged 30 s case budget. A later target-closed error and locator wait are not evidence that Play itself was disabled or that native walking failed. The new trace shows successful initial and repeated Cargo Open without the old frame fatal error. It does **not** complete the walking assertion or remaining four cases. The same Context/Page harness split is separately authorized; no larger timeout is admitted or needed by this report.

## Preserved history and followup scope

`/workspace/.cloud-setup/fp06-w07-native-review-prebrowser.md` remains unchanged at SHA256 `10fb606a86a7eb2ddeb68623c95a173aa9fc5b7ec2ee3a3bb731727b31734730`; its old findings and old second-browser seal are preserved, not overwritten by closure. The intake and initial native checklist are also untouched. Later authorized Mount recovery runtime/tests, the browser harness result, final candidate seal, manifest/artifact admission, and Git/LFS commit binding await a separate explicit followup. No future tests or owner decisions are recorded as passed here.

Root delivery copy: only Markdown trailing spaces/final blank lines normalized. Independent original SHA256 `266f07dc333bab4c2f6ec30637e034e090c87c8322690e40c959b6ece4ea8947`, 10392 bytes; original remains `/workspace/.cloud-setup/fp06-w07-native-review-third-seal.md`. Scope, evidence and verdict unchanged.
