> Quelle: `/workspace/.cloud-setup/fp06-w07-input-native-final-review.md`; original SHA256 `c82166de56421b720eef55a08e72e4f8c9b8317b5e739032eccc2d041291269f` (12085 Bytes); nur Markdown-Leerzeichen/Zeilenenden normalisiert. Spec/quality PASS for seventh-seal held runtime; actualBrowser7 FAIL; diagnostic/newE2E excluded.

# W07 independent Input/Native final code review — seventh-browser seal

Reviewer `/root/w00_repo_audit`; code and existing evidence read only. No tests, builds, browsers, profiler, verifier CLI, product/test edits, commits, or subagents were run/created by this reviewer. This is a scoped code/contract receipt, not a W07 package or Git-admission PASS.

## Verdict

- **INPUT_NATIVE_SPEC_COMPLIANCE: PASS** for the explicitly bounded event-intent/transport contract implemented in the candidate below, and the previously reviewed unchanged native boundaries. The opt-in delivers intent independently of RAF; native tick/pose authority remains unchanged. It does not promise displacement for every tap coalesced before delivery or before a native tick.
- **INPUT_NATIVE_CODE_QUALITY: PASS** for this sealed implementation. No additional code finding was identified within the requested jump, cancellation, latest-state coalescing, Read/Prepare publication, disposal, or default-Legacy boundaries.
- **BYTE_AND_SCOPE_BINDING: PASS**: initial and end reads match all 29 granted file SHA256/size pairs; exactly 27 paths actually differ from base. Existing granted `hvp-physics.test.ts` and `hvp-coast-source.test.ts` remain byte-identical to base. Static `git diff --check -- <29 granted paths>` exits 0.
- **ACTUAL_PLAYER_BROWSER_GATE: FAIL**, seventh run actually ended during this review: **5 PASS /1 FAIL /11 NOT_RUN**, exit 1. The failed x-position oracle received the initial x=-5.5 after short released taps. Paid build, second-Cutter depletion, and final disposal did not run. Actual movement and final package/manifest/commit admission remain open; the code verdict is not evidence those gameplay gates passed.

## Exact sealed bytes and scope

Base and current Git HEAD: `d5502ae7fd5431d58eda51bea062c54691ebe3c2`. Sole admitted actor is `/root/fp06_integrator` on `codex/hestia-fp06-integrator-2026-10-11`, worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`. The external current grant contains exactly 29 paths, including the input producer and new unit file authorized by Root control commit `1c20ad6a0b605e2d9e86dba74fcbe5eda1383a94`.

`/workspace/.cloud-setup/fp06-w07-before-seventh-browser-product.patch`: 202766 bytes, SHA256 `ce0007d04fc4833953acef94d78d1091b2848b410112028026179ad1b58eece4`.
`/workspace/.cloud-setup/fp06-w07-before-seventh-browser-product-files.json`: 7835 bytes, SHA256 `4ea869a05fd9f2d9fd941a00b289c375cd18ef2e27e88c74a2bea1bc4f3053d1`, timestamp `2026-10-11T14:53:42.859064+00:00`. Its full 29-file set equals the grant; its exact 27 `actuallyChangedProductPaths` independently equals actual bytes versus base. No patch header falls outside the grant.

Since the fourth native/mount seal, only these five file bytes changed/appeared:

| Path under `apps/weltraum-browser` | SHA256 | Bytes |
| --- | --- | ---: |
| `src/hestia-prototype/player/input.ts` | `322821a12db4b59fd5c448c578f0adafce86222b674d25a850b976b6de3c63b9` | 11833 |
| `src/hestia-prototype/physics/client.ts` | `234fe15a6b2f6f2b9c6a68bec60816536c96e4c26439bf6321ba84fb05948b42` | 33865 |
| `src/hvp/hvpBootstrap.ts` | `e744746124298f359f18efed2b6eeaa83e434177fe8dd509bf2519669d6174e3` | 164229 |
| `tests/unit/hvp-player-input.test.ts` | `8186eb1a3aa560d8de2782e4a733849fd73caed82987d4712b4762910f2bc427` | 11383 |
| `tests/e2e/factory-placement.spec.ts` | `488439fa85e682a90e28a9781581d4d419d3c691bd37d3ed675c53fcad36bc9e` | 13482 |

All prior native membership/cap/source/rollback fixes and mount runtime/test bytes are unchanged. Worker Read protocol/timer, native session/locomotion profiles, fixed/global caps, resource quantities, source reach, terrain, and Save contracts were not changed by the input delta.

## Code/contract assessment

**Producer and jump ownership.** `player/input.ts:10` defaults Factory event delivery off. `levelIntent():52–59` reuses the existing normalized yaw-relative movement/sprint formula; signed-zero normalization applies only to Factory. `publishEventIntent():61–69` requires active, undisposed, completed activation and pointer lock, checks blocked/native status and transaction state, stages intent immediately, then clears the producer jump edge. Space repeat cannot stage a new edge; an event followed by RAF therefore cannot replay the same producer jump. Stop at lines 42–45 clears local keys/jump and passes explicit Factory jump cancellation. Escape, blur, hidden/pointer-lock loss and the existing pause control path retain neutralization. Neither the producer nor the new test fixture writes a player pose or invents native ticks.

**Bounded latest-state transport.** `client.ts:202–214` uses the existing shared `busy` Read slot, one dirty boolean and one latest level state. `setPlayerInput():369–372` merges at most one unsent jump, distinguishes explicit cancellation, clears denied input, and attempts immediate existing `Read(input)`. Capturing the outgoing input clears its jump; a busy arrival updates one replaceable pending state, and `finally` drains it once only after admission is rechecked. No event list/timer/second Read slot is added. Queue/backpressure cap 8 and response deadline 20000 ms are unchanged. Ordinary key-up preserves an unsent jump; explicit stop and Pause/Inspect/Play reset it. Mouse/key repeats can update the latest intent but cannot allocate an unbounded queue. This coalescing intentionally permits a Down/Up pair to collapse to the latest zero while a prior Read is busy; no minimum-displacement semantics or automatic native step was introduced.

**Dispatch and transaction guards.** `canDispatchFactoryInput():203–206` requires an undisposed, failure-free, nonclosing, nonmutating client, no bodyPending, native Running, idle terrain/neighbor/body-residency/structural/moving/facility state. The producer's active/pointer-lock/activation guards retain gameplay admission; the native locomotion owner still rejects disabled/disposed input and applies motion only on its existing timer steps. The client does not independently enable/Play a player. `readInput` also suppresses dispatch under local mutating/bodyPending/closing guards. Paused/held/denied pending dirty motion is cleared before any event drain. Bootstrap line 1365 admits producer opt-in from the same Factory source context already passed to the native client; default Legacy takes the prior buffered/RAF path.

**Read versus held candidate ownership.** Pending metadata records the existing request kind, without adding an IPC kind. `client.ts:185–187` withholds a Factory Read reply during mutating/bodyPending/closing and writes it to neither public `snapshot` nor `heldSnapshot`. Legitimate transaction replies retain their existing prepare/commit/publish/rollback/finalize handling. The real-client transport counterexample deliberately replies to an earlier Read after actual native facility Prepare, checks the public snapshot remains the exact previous one, then commits/publishes using the preserved exact Prepare receipt and rolls back. This closes the previously identified stale Read publication/held receipt overwrite mechanism. Native membership/candidate checks are otherwise byte-identical to their prior accepted review.

**No late-dispose delivery.** `client.ts:456–464` marks Factory input closing and clears its pending level/jump before requesting native Dispose. Future setters/updates and late Read drains cannot allocate another Read or publish that Read snapshot. The actual native disposal receipt and existing worker teardown stay required. Default Legacy's disposal path remains unchanged.

**Default Legacy.** Opt-in defaults false; common axis calculations retain original signed-zero behavior outside Factory. Default producer events return without staging, the client stores input until update, request publication guards are conditional on Factory, and Worker/native defaults are unchanged. Both dedicated Legacy producer and client controls passed in the initial RED run and final run. No claim is made that this pair replaces every unrelated Legacy browser regression.

## Existing RED/GREEN/build evidence and its limits

Own evidence root: `apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z`. Commands, actual exits, readable logs and raw gzip artifacts were read. For phases 44/45/48/49/50, decompressed raw byte sizes and SHA256 match command receipts; readable/raw logs match after ANSI/trailing whitespace/newline normalization. No test was rerun by this reviewer.

| Phase | Actual result | Decompressed raw SHA256 |
| --- | --- | --- |
| `44-red-no-raf-event-intent-and-native-transport` | exit 1; **10 assertion FAIL /2 Legacy PASS**, 12 collected tests; actual no-RAF/jump/cancel/coalescing/Read-Prepare/disposal counterexamples, not an import error | `d294cfd67400afc6dbcd2e49ecbbf621218b217d5a4afa7c6b1194f22729dd44` |
| `45-green-event-input-and-native-read-coalescing` | exit 1; **11 PASS /1 FAIL**, preserved signed-zero oracle failure (+0 expected, -0 received) | `ae75431bb0672c8c1dedee088ded89d985be5437d2b0f352421b2b3f3b47247a` |
| `48-final-full-build-after-mount-and-input` | exit 1; preserved test-fixture MessageEvent type error, not a new runtime failure | `c9050df9bb2c2b53edc13068fd31a2f728fd5e346db36b77f9bb4cd0a5b1e7fa` |
| `49-green-typed-native-event-message` | exit 0; final **12 PASS**, wrapper 1.818597799 s; corrected actual MessageEvent fixture | `0f2deef329bd350d96d7d2aaf94328fcba97dfdd845ca20227ba71f68d317da7` |
| `50-final-full-build-typed-input` | exit 0; final full TypeScript/Vite build, wrapper 4.047475587 s | `046f4eccf32adecad5b0f9d9d970242f1c757fbeafa4577c8685941008da95fd` |

The new unit's transport fixtures explicitly mock the Worker/empty-source WorkerPool but create real Rapier sessions and snapshots. They do not run the native timer, assert no added ticks, and do not prove trusted browser input moves the actor. Fixture synthetic DOM events are unit-only. Read/Prepare membership and rollback are actual native session facts; fixture source/support/real-player displacement claims are not inferred.

## Actual seventh browser result, separately open gameplay gate

The new E2E suite preserves a single Context/Page/native session, uses real Playwright keyboard presses released **before** projection reads, and separates 17 serial cases under the original 30 s limit. It retains exact finite cargo/208 kg payment, C26 source identity, source-specific `BOM_MISSING` and unchanged ledger/native membership oracles. The latter cases remain NOT_RUN in the actual result.

Existing phase `51-real-browser-seventh` ended at `2026-10-11T14:55:26.833099+00:00`, started `14:54:06.706961+00:00`, exit 1, 8159 raw bytes, SHA256 `fab33ecf9ec0ab44851933532a2baded0c3d3e9c7b096b61790c2e405f66d6c4`, independently matched to its command receipt. Recorded outcome: **5 PASS /1 FAIL /11 NOT_RUN**. The west-stand confirmation `tests/e2e/factory-placement.spec.ts:54` expects x between -6.4 and -6.125; actual x is **-5.5**. The initial short-tap helper case has no final-position assertion; its PASS is not proof of movement. This is an actual gameplay/browser gate failure, not a timeout-only reinterpretation, not a paid-build success, and not proof of a new native solver defect. Code/fixture delivery invariants above cannot replace the failed actual movement oracle. Further cause/trace review and any correction require a distinct sealed followup; no scope expansion or reach/tick/pose change is approved by this report.

## Preserved history

Prior independent artifacts remain unchanged at end rehash: third seal `266f07dc333bab4c2f6ec30637e034e090c87c8322690e40c959b6ece4ea8947`; fourth native/mount seal `d49a6ae4dcce9f281674974bfed6224c020d51890a38ef2da8e1d6d3160f3a94`; input preflight `a7f715c5b0d2abc1ff12e09dbdf9fd9ecaa982f7ecb8f4382dc2fdeee9d0e7f7`. Their historical failures and later closures are not overwritten. This receipt admits only the exact seventh-seal code and existing evidence described; final browser/package/manifest/HEAD/LFS admission is still pending.
