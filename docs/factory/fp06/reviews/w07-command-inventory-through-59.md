# W07 command / retained raw-gzip inventory through phase 59

Independent read-only inventory, 2026-10-11T15:41:25.292428+00:00. Scope: only top-level phases 01–59 in `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z`. Phases 60+ are excluded even if present. No product/evidence edits, tests, build, browser, native or profiler job; lightweight local file/JSON/gzip/SHA inspection only. This external report is the sole write.

**Result: 32/32 complete command-receipt bindings MATCH; retained gzip integrity 57/57 PASS; historical receipt coverage INCOMPLETE. No contradictory declared raw SHA/size/exit found. Final manifest/package/Git/LFS acceptance is PENDING writer seal and is not granted here.**

There are 59 logs and 59 corresponding `.exit.txt` files; 57 retained raw gzip files; 34 command receipts. Gzip decompression verified stream integrity/CRC/ISIZE for every retained archive. All 32 complete receipts (28–59) declare `exitCode`, `rawBytes` and `rawSha256`; these match the actual sibling exit file and decompressed bytes exactly. All 34 existing command receipts retain the same actual Integrator application cwd. The eight normal browser executions are phases 22/27/32/39/41/43/51/58, all exit 1; phase 52 is explicitly diagnostic-only and is not a normal-gameplay gate.

The two early browser receipts, `22-browser-command.json` and `27-browser-command.json`, retain cwd/argv/env/config SHA but **omit exitCode/rawBytes/rawSha256**. Their actual sibling raw-gzip files are present/readable and actual exit files both contain 1; the raw hashes below were computed now, not fabricated as contemporaneous receipt fields. Phases **01–21 and 23–26 (25 phases)** have no per-command receipt. Phases **01/02** also have no retained raw-gzip file; only readable `.log` and `.exit.txt` survive. No absent original evidence is reconstructed or promoted to contemporaneous proof.

Plain readable `.log` byte counts sometimes differ from retained raw stdout (newline/Unicode/text conversion). The raw-gzip bytes are the binding subject whenever available; no byte identity with readable logs is claimed. Empty successful TypeScript stdout is legitimate: several gzip streams decode to zero bytes, whose SHA is the standard empty-content hash and matches their receipts.

## Every existing command receipt, independently bound

All file names below are relative to the run root. Each exit file is the corresponding log stem plus `.exit.txt`. `MATCH 3/3` means receipt exit/raw byte count/raw SHA all match the actual retained exit and gzip payload. `fields ABSENT` reports missing historical metadata and is not a receipt hash PASS. Compressed files were also read and integrity-checked. Full raw SHA256 values are shown.

| Phase | Actual command receipt | Actual retained gzip | Exit | Raw bytes | Raw SHA256 | Receipt binding |
| --- | --- | --- | ---: | ---: | --- | --- |
| 22 | `22-browser-command.json` | `22-real-browser-first.raw.log.gz` | 1 | 6343 | `1b1ef9b98c5770df651b1cfecd774a721633401f5b8d37f2ace45506c5bf31a5` | fields ABSENT |
| 27 | `27-browser-command.json` | `27-real-browser-second.raw.log.gz` | 1 | 7215 | `6bd78a51b223f83ae63386cacbacc7d6002c684bf8e442e033fde81d3ab6e883` | fields ABSENT |
| 28 | `28-red-frame-cargo-owner-dispose-checkpoint-command.json` | `28-red-frame-cargo-owner-dispose-checkpoint.raw.log.gz` | 1 | 4601 | `b4119c8bcb5a32230a0636df7cb5160844fbf04d3410c5c2ef326645f189ec08` | MATCH 3/3 |
| 29 | `29-green-native-placement-cargo-command.json` | `29-green-native-placement-cargo.raw.log.gz` | 0 | 471 | `43f89a346f7f25ad02e7fe3f13a49ac0670208ce0af58b850ea9705a712e758f` | MATCH 3/3 |
| 30 | `30-green-actual-host-frame-cycle-command.json` | `30-green-actual-host-frame-cycle.raw.log.gz` | 0 | 387 | `7f48e9fe7284e6962692fddc010e1d5e1c7e84401ccef6a33b2880d343c075ca` | MATCH 3/3 |
| 31 | `31-build-after-frame-owner-checkpoint-command.json` | `31-build-after-frame-owner-checkpoint.raw.log.gz` | 0 | 1904 | `7c8ec8f24f7b650d0a5d8289fcd75df29de66d96ee93830be8f461c916d12c5f` | MATCH 3/3 |
| 32 | `32-real-browser-third-command.json` | `32-real-browser-third.raw.log.gz` | 1 | 6387 | `69c2196f935ae10ecc60e1753d40fa02ea55bf5e4f0e88c0d228bf1d15ad4479` | MATCH 3/3 |
| 33 | `33-red-failed-initial-binding-retry-command.json` | `33-red-failed-initial-binding-retry.raw.log.gz` | 1 | 2031 | `56161ce03ecda2d517c10c4c8b5d0412e7113c474c07d1a9a86da279b6f4f894` | MATCH 3/3 |
| 34 | `34-green-host-lifecycle-command.json` | `34-green-host-lifecycle.raw.log.gz` | 0 | 358 | `3d3a796931dd22eb0fafeff3f3e3b5d8332249a6cd7121c34b94ca8dd2365bb2` | MATCH 3/3 |
| 35 | `35-typescript-after-lifecycle-harness-command.json` | `35-typescript-after-lifecycle-harness.raw.log.gz` | 1 | 832 | `fdadd621c1b8f431cd8a9e3b6a5c6ccbf0361e571030aef7f714a92dd54db087` | MATCH 3/3 |
| 36 | `36-green-typed-initial-bindings-command.json` | `36-green-typed-initial-bindings.raw.log.gz` | 0 | 391 | `78bfda950a02e66615c85920b8de937fb04a66ad1393d34c0295d8273bbe7964` | MATCH 3/3 |
| 37 | `37-typescript-final-lifecycle-harness-command.json` | `37-typescript-final-lifecycle-harness.raw.log.gz` | 0 | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | MATCH 3/3 |
| 38 | `38-typescript-final-eleven-browser-cases-command.json` | `38-typescript-final-eleven-browser-cases.raw.log.gz` | 0 | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | MATCH 3/3 |
| 39 | `39-real-browser-fourth-command.json` | `39-real-browser-fourth.raw.log.gz` | 1 | 7621 | `17c17452c7c6d9f93efed0f2bec76c73321bce3cb78a91d2999d46e5af35a444` | MATCH 3/3 |
| 40 | `40-typescript-real-keyboard-tap-harness-command.json` | `40-typescript-real-keyboard-tap-harness.raw.log.gz` | 0 | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | MATCH 3/3 |
| 41 | `41-real-browser-fifth-command.json` | `41-real-browser-fifth.raw.log.gz` | 1 | 7993 | `c14835169831db71a194097d4adfe007115e1dc0e6786202b5d5ae8f0f499ef8` | MATCH 3/3 |
| 42 | `42-typescript-bounded-short-held-presses-command.json` | `42-typescript-bounded-short-held-presses.raw.log.gz` | 0 | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | MATCH 3/3 |
| 43 | `43-real-browser-sixth-command.json` | `43-real-browser-sixth.raw.log.gz` | 1 | 7993 | `fefb6be6b790144b34d8af07027a29204add6779fb38639d8212b78cc603416a` | MATCH 3/3 |
| 44 | `44-red-no-raf-event-intent-and-native-transport-command.json` | `44-red-no-raf-event-intent-and-native-transport.raw.log.gz` | 1 | 10680 | `d294cfd67400afc6dbcd2e49ecbbf621218b217d5a4afa7c6b1194f22729dd44` | MATCH 3/3 |
| 45 | `45-green-event-input-and-native-read-coalescing-command.json` | `45-green-event-input-and-native-read-coalescing.raw.log.gz` | 1 | 1528 | `ae75431bb0672c8c1dedee088ded89d985be5437d2b0f352421b2b3f3b47247a` | MATCH 3/3 |
| 46 | `46-green-factory-neutral-input-and-host-frame-command.json` | `46-green-factory-neutral-input-and-host-frame.raw.log.gz` | 0 | 437 | `cd7109fd93d1d9b7850bcc355c7e11e1d055a04df005a3c16d774c4910da47db` | MATCH 3/3 |
| 47 | `47-green-all-input-contracts-command.json` | `47-green-all-input-contracts.raw.log.gz` | 0 | 353 | `82e6efd62c4a7f37f1dc68b501c0b4e317d7d4000eb6b534247e4195cc5b8eb4` | MATCH 3/3 |
| 48 | `48-final-full-build-after-mount-and-input-command.json` | `48-final-full-build-after-mount-and-input.raw.log.gz` | 1 | 948 | `c9050df9bb2c2b53edc13068fd31a2f728fd5e346db36b77f9bb4cd0a5b1e7fa` | MATCH 3/3 |
| 49 | `49-green-typed-native-event-message-command.json` | `49-green-typed-native-event-message.raw.log.gz` | 0 | 353 | `0f2deef329bd350d96d7d2aaf94328fcba97dfdd845ca20227ba71f68d317da7` | MATCH 3/3 |
| 50 | `50-final-full-build-typed-input-command.json` | `50-final-full-build-typed-input.raw.log.gz` | 0 | 1904 | `046f4eccf32adecad5b0f9d9d970242f1c757fbeafa4577c8685941008da95fd` | MATCH 3/3 |
| 51 | `51-real-browser-seventh-command.json` | `51-real-browser-seventh.raw.log.gz` | 1 | 8159 | `fab33ecf9ec0ab44851933532a2baded0c3d3e9c7b096b61790c2e405f66d6c4` | MATCH 3/3 |
| 52 | `52-diagnostic-only-input-worker-observation-command.json` | `52-diagnostic-only-input-worker-observation.raw.log.gz` | 0 | 1384 | `2941a05a1e6cfef38706b4ef98da7d6d0f0256107ccfe96aa3d5de1d65d07651` | MATCH 3/3 |
| 53 | `53-typescript-normal-released-250-350ms-harness-command.json` | `53-typescript-normal-released-250-350ms-harness.raw.log.gz` | 0 | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | MATCH 3/3 |
| 54 | `54-typescript-source-bound-stand-window-command.json` | `54-typescript-source-bound-stand-window.raw.log.gz` | 0 | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | MATCH 3/3 |
| 55 | `55-red-unchanged-already-sent-level-extra-read-command.json` | `55-red-unchanged-already-sent-level-extra-read.raw.log.gz` | 1 | 1907 | `318ecc250c495e44bdc7abd2183ea40835d88d0eb4b8b75599f66145d043eb23` | MATCH 3/3 |
| 56 | `56-green-fourteen-input-and-noop-contracts-command.json` | `56-green-fourteen-input-and-noop-contracts.raw.log.gz` | 0 | 353 | `ae8c61e8372174b8e4c9b8140158062ff01d959476cf04bb4d5f72fc7a2a8b82` | MATCH 3/3 |
| 57 | `57-final-full-build-factory-input-noop-command.json` | `57-final-full-build-factory-input-noop.raw.log.gz` | 0 | 1904 | `12553d60f42ff95b49c5f89ae02034c6cd2616218d632703d5d5ab426e7a6659` | MATCH 3/3 |
| 58 | `58-real-browser-eighth-command.json` | `58-real-browser-eighth.raw.log.gz` | 1 | 10638 | `65f8c804021a4f75f0087eb2041df8825e98771a62befc97f2b680b52325d090` | MATCH 3/3 |
| 59 | `59-red-actual-render-receiver-ghost-lifecycle-command.json` | `59-red-actual-render-receiver-ghost-lifecycle.raw.log.gz` | 1 | 1687 | `909ba35099060387672bc8318c484fc897cb9de5cf468d6178ed546809c85b95` | MATCH 3/3 |

## Actual phase declarations and results

File names identify intention; the actual stdout/exit determine the result. The following distinctions prevent setup/type failures from being counted as newly collected business assertions, or a failed intermediate candidate from being relabelled GREEN.

| Phase | Actual retained outcome / classification |
| --- | --- |
| 01 `initial-business-red` | 8 failures: 5 explicit `FactoryFacilityNotImplemented` / `FactoryInstallationNotImplemented` / `FactoryStartSiteNotImplemented` stubs plus 3 `CanonicalSerializationError` setup failures. This is not eight collected business assertion failures. No raw gzip / command receipt. |
| 02 `corrected-collected-business-red` | 8 failures: same 5 NotImplemented stubs plus 3 actual placement assertions. Do not claim eight assertion REDs. No raw gzip / command receipt. |
| 03 `initial-minimal-green` | Exit 1; 2 failed / 6 passed. Native facility failures include canonical serialization setup; filename GREEN does not mean actual GREEN. |
| 04 `native-hold-business-red` | Exit 1; 1 failed / 8 passed, `TypeError: factory.prepareFactoryFacility is not a function`. Missing API/interface failure, not a collected assertion proving the complete hold contract. |
| 06 / 08 / 09 / 13 / 16 / 19 | Actual assertion counterexamples respectively 1 / 1 / 2 / 1 / 3 / 1 failures (vegetation, native overlap, service+source reach, source origin, real Cargo ownership/open state, Cargo idempotence). Retained gzip present; no per-command receipt. |
| 07 / 18 | Exit 1 TypeScript integration failures; compile failures, not business RED. |
| 23 / 24 | Actual 3 / 2 native source/member/candidate assertion counterexamples, preserved with retained raw gzip; no per-command receipt. |
| 28 | Exit 1; 4 failed / 54 skipped. One real Host projection-frame runtime exception and three native identity/disposal/placement assertions. A real mixed runtime/contract counterexample, not four clean AssertionError outputs. |
| 33 | Exit 1; 2 actual Host retry assertions failed / 17 skipped. |
| 35 | Exit 1 TS2345 in lifecycle test typing, then later corrected; no business RED. |
| 44 | Exit 1; 10 actual input/transport assertion failures / 2 passed. |
| 45 `green-event-input-and-native-read-coalescing` | Exit 1; 1 failed / 11 passed. Actual remaining assertion distinguishes `-0` from `+0`; subsequent correction/47 GREEN is a different phase. No phase45 GREEN claim. |
| 48 `final-full-build-after-mount-and-input` | Exit 1 TS2352 in test message typing. Phase50 build is later successful output; phase48 itself remains FAIL. |
| 55 | Exit 1; 2 actual unchanged-input/no-op assertions failed / 12 skipped. |
| 59 | Exit 1; 1 actual assertion failure / 34 skipped. Actual ThreeRenderBackend command ledger (GPU driver stub only) rejects Ghost lifecycle with `RepresentationRemovedAtRevision`. This is a genuine receiver-path RED, separate from phase28's earlier receiver implementation and earlier bytes. |

Successful unit/compile/build results in other phases remain historical facts for their own byte phase. For example 05=11 PASS, 12=125 PASS, 25=24 PASS, 29=30 PASS, 34=19 PASS, 47/49=12 PASS, 56=14 PASS; partial focused selections retain their explicit skipped counts. Command metadata alone does not bind all product hashes or prove that a previous test passed the subsequently changed runtime. No aggregation of historical green cases is used as current coverage.

## Actual browser results and diagnostic separation

| Phase | Actual outcome | Limitation / failure |
| --- | --- | --- |
| 22 first | 1 PASS / 1 FAIL / 4 NOT_RUN | Actual locator Ready-text expectation times out at 5 s. Retains early command but no raw receipt fields. |
| 27 second | 1 PASS / 1 FAIL / 4 NOT_RUN | Actual HVP projection-frame rejection; Ready predicate times out at 5 s. Early command omits raw receipt fields. |
| 32 third | 1 PASS / 1 FAIL / 4 NOT_RUN | Actual locator target/page/context closed; failed run, not normal success. |
| 39 fourth | 4 PASS / 1 FAIL / 6 NOT_RUN | Actual native walk predicate false. |
| 41 fifth | 5 PASS / 1 FAIL / 9 NOT_RUN | Actual normal walk x=-5.5 fails expected x≤-6.125. |
| 43 sixth | 5 PASS / 1 FAIL / 9 NOT_RUN | Same actual bounded walk failure; distinct run retained. |
| 51 seventh | 5 PASS / 1 FAIL / 11 NOT_RUN | Actual normal walk x=-5.5 fails expected x≤-6.125. |
| 52 diagnostic | 4 PASS, exit 0 | Receipt explicitly `diagnosticOnly:true`, `normalGameplayGate:NOT_RUN`, command selects `DIAGNOSTIC_ONLY`. It provides diagnostic observations; cannot replace normal gameplay. |
| 58 eighth | 12 PASS / 1 FAIL / 4 NOT_RUN | Actual paid Cutter was captured before the final `errors=[]` assertion failed on two earlier Ghost `RepresentationRemovedAtRevision` exceptions. Paid evidence is separately scoped; normal browser remains FAIL. |

Earlier test cases used different code/harness phases and smaller selections (6/11/15/17 current cases). Their pass counts do not show all later cases ran or that current renderer movement is accepted. No timeout/queue policy change or final normal clean-page claim is inferred from this inventory.

## Unreceipted historical files and closure limits

Below are the actual unreceipted phase stems with actual exit and retained raw-payload facts. The log/exit files exist for all 25. `UNAVAILABLE` means no retained raw gzip; it is not zero-byte stdout. Other hashes are computed retained-payload hashes, not absent original-receipt values.

| Phase / log stem | Actual exit | Retained raw bytes | Computed retained raw SHA256 |
| --- | ---: | ---: | --- |
| `01-initial-business-red` | 1 | UNAVAILABLE | UNAVAILABLE |
| `02-corrected-collected-business-red` | 1 | UNAVAILABLE | UNAVAILABLE |
| `03-initial-minimal-green` | 1 | 2236 | `2bcd9c53948f49b3745907a7a6fe3e507826deeda52d85e6fa55e6ce7da78550` |
| `04-native-hold-business-red` | 1 | 1463 | `e0ef46d200c480ebbbdf125802ad00b74d2d4a86027b6001014aec06d1f07f1f` |
| `05-native-session-initial-green` | 0 | 434 | `0fc8f019396c472312bd9fbef1655d30ce13194944b29c9c6cf55da5f070e3ac` |
| `06-coherent-vegetation-business-red` | 1 | 1755 | `1dd1d3931b1fc2030620883440fad248c32688873aa83e82c8d9851339e7fcff` |
| `07-host-integration-typecheck` | 1 | 7001 | `c559ced67a1bee05cfd6ebdac2df070c6503e593faa1b4ce9efaecd262e60750` |
| `08-actual-site-and-native-overlap-red` | 1 | 1519 | `9a23f0530148dee6e906d00167fa7b715a3546a15cc6fa0a73d7a41b24f1acb6` |
| `09-service-gap-and-source-reach-red` | 1 | 1903 | `9d32fec409976ab7b0b68db0b7bf353f10126621e566005f0d2da2da119a9109` |
| `10-site-native-source-guards-green` | 0 | 493 | `64b8588bbc87ee90a9607461ee64d50834c9dfdb9948614eb88edd9ef9390497` |
| `11-host-integration-typecheck` | 0 | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `12-first-focused-affected-regressions` | 0 | 615 | `a49b5f8a9e469df2b7216f05d9c2f3663d0d144b41f41ec58895aedf589d93f4` |
| `13-source-origin-business-red` | 1 | 1395 | `e40a58b00b59e98e3b542e71430504aabd8b40dd13ffb61bb9ba556ea4c47f2f` |
| `14-source-origin-green` | 0 | 383 | `6987ae77cbbf9546d16fb50f0ca4f500f6621e31ff20aef2297089527aa3927f` |
| `15-integration-build` | 0 | 1806 | `fc0539f795cd0a9b3a953807d4f91b5f28b500bb06b944143c740ae8525cf4e3` |
| `16-initial-cargo-business-red` | 1 | 2995 | `4c57e591bbbf80b7543a5f382a90af7800a0765757426fd21846aff4c4c52ce8` |
| `17-initial-cargo-minimal-green` | 0 | 391 | `d170870eb4b942853636a67cf0004950f8ce88d04a8f67609763661276c50db9` |
| `18-cargo-host-typecheck` | 1 | 869 | `a69fa788462145a6a01523eb4dcbb94a62ac8e59cc04fc48f8826f4525706649` |
| `19-native-cargo-idempotent-business-red` | 1 | 1096 | `75874fba0e0faf2c07199f2e592c398e28d3c0956511e21e7658ff9d667f1c06` |
| `20-native-cargo-and-placement-green` | 0 | 434 | `0d77052f360ece3e977828e28d6f5e5f602c5e6f8e79b2788d83d2388e940804` |
| `21-cargo-integration-build` | 0 | 1904 | `55db61a3c88549ec1d75052c6db358b7055345c6a497cb5efe9c72f8c1c74e2c` |
| `23-native-source-disposal-member-business-red` | 1 | 2564 | `31948805735910dd0950bd205b0ef0348e9b79d0fb8d3f425a71199479a1a50e` |
| `24-native-extent-candidate-business-red` | 1 | 1847 | `4634e57fc09c27a5fbb4ef795747f9009ba8ea08c79987fc2916269d99973db0` |
| `25-native-source-member-focused-green` | 0 | 434 | `e71e4b32efae01f62f55d97d2168db2c58a30b2c0a8519f21d87f04aab07e3ec` |
| `26-integrity-build` | 0 | 1904 | `ce09f9d5cab6fa8719242ba6880552458a85b86d21a22d143234d2f79342ac28` |

Checked gzip total: **57** actual archives, **41,237 compressed bytes**, **132,203 decompressed bytes**. No missing gzip for any phase with an existing command receipt; no duplicate phase command receipt or gzip subject was found. No declared raw SHA/size/exit contradiction was found. Missing metadata is a concrete historical limitation, not an invented requirement to rerun, rewrite old receipts, or fabricate missing proof.

The writer's final source/evidence seal, complete manifest/ref closure, staged/committed Git binding and own LFS object check remain separate pending work. This report gives no final package, final product-byte test, Git or overall W07 gate PASS. Previous external paid-visual review remains immutable and limited to the eighth run.
