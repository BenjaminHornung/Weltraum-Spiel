# PLAY-06 C1 independent review

Reviewer: `/root/play_c1_review`. Read-only product/source/evidence review; this reviewer and its evidence-audit subagent ran no tests, builds, browser sessions, profiles or benchmarks and made no product writes. The only review write is this report. The exact Root candidate grant, AGENTS.md, README, current-mainline-state, performance preflight, the actual two-file diff, W02/Resources validators, W08 ports/power/commit/replay code, prior attribution and saved C1 receipts were read.

**Final verdict: bounded CompositionPASS for the final C1 code, eleven focused guards, 25 conveyor regressions, original build and the explicitly granted corrected-source original paid pair. Both identified P1s are corrected; no remaining P1/P2 was found in this bounded diff.** Receipt 15 binds the corrected current C1 bytes and passes both original cases. Prior receipt 05 remains a pre-safety measurement. No speedup number or browser/hardware PASS is claimed. Final source/hash and raw-result verification was completed after the receipt existed, at approximately 08:52 UTC.

## Source binding and scope

Initial recorded HEAD: `96cced23cd285b57f8a557d01ac9ed8a158c927f`, branch `codex/hestia-fp06-play-candidate-2026-10-12`, worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`. During review Source9 was committed as `393670fccd4789b562d31b721f15d02457420935`; it remains a separate PLAY-01 change, with no C1 performance claim.

Receipt 15 records HEAD `3e4acefc18a543e27fbfd97378d6a6929f194b8f`; the final readonly observation sees HEAD `0dd5cdb6400aac5df3f0fe7937a6d612d8a76bd6`. These intervening independent integrations do not change the reviewed C1 runtime/test bytes or any of the nine safety-final source bindings. The final verdict is bound to those exact hashes, not a claim that earlier receipts ran on the latest whole-product HEAD. Other Source9/UI/Art changes and their own grants remain separate.

The C1 source/test diff is restricted to the two granted paths. W02, W03, W04, Resource serialization, packages, configuration, queues and timeout limits are unchanged. All nine preflight source bindings match the corresponding saved final-pair bytes; only the permitted W08 runtime path differs from prior attribution. Grant before-byte hashes and the attribution-report hash match.

| Revision | beltReference.ts | conveyor.test.ts |
| --- | --- | --- |
| Original C1 final pair / full regression / build | 22,630 B; `d48015f53b5c9e991e3c6e792e35b8ca238eb56006c79c01e1780125236fdcf9` | 25,383 B; `0442dcee0c70e973aad43d685c06556930abea6487b0cb15b4a29b6045bbef3c` |
| MaterialView getter fix, observed 08:36:15 UTC, receipt 08 | 22,676 B; `c66f0e3fb21758c372c0371a63cff2787884e52c351c511b913b9f7f1a4b711b` | 26,379 B; `ff787139642856e700f556720550d5ac5c5494ffbaf871375fc8a4e83a5d308e` |
| Final getter/Proxy admission fix, receipt 12 | 23,568 B; `2e8a33d97553567d5e17092151d75a4c0e0d98abbaf73c5450cfc4a28500dae7` | 29,664 B; `4a2fa15da9dd29a76fdddb85566956d29081663d63115c78754f93ed352bfb67` |

## Findings

### P1-A, corrected: a different pair could enter the cache than W02 validated

Original helper at `beltReference.ts:91–97` separately read `material.catalog` and `material.containers` for lookup, validation, immutable proof and insertion. After priming the legitimate catalog map, a public `MaterialView.containers` getter could return counterfeit immutable list B for the miss, valid list A for W02, then B for proof and insertion. A subsequent ordinary material view with B skipped W02. Changing only a snapshot signature suffices; ports and empty-band validation do not check that signature.

Saved receipt 07 confirms the actual warm-catalog business RED: the later B read failed to throw `InvalidResourceSnapshot`. Receipt 06 was a nonprimed PASS because optional lookup had no existing catalog map and did not read the getter; this initial ineffective probe is preserved honestly. The current helper captures `const { catalog, containers } = material` once and uses that exact pair throughout. The corrected code closes this C1-induced identity mismatch. Receipt 08 checks all seven C1 guards on the corrected bytes.

### P1-B, corrected: descriptor proof and W02 iteration could validate different Proxy projections

The earlier `isImmutableSnapshotData` proof accepted frozen dense arrays with exact `Array.prototype`, only frozen own data descriptors, and no own method/symbol properties. That did not exclude a Proxy around such an array. A Proxy may return a custom inherited `Symbol.iterator` from its `get` trap without adding an own symbol descriptor or violating frozen target invariants.

`assertMaterialSnapshots` (`resourcesAdapter.ts:48`) uses `for ... of`, while the immutable proof walks the own index descriptor values. A frozen Proxy can therefore expose valid snapshots A during the cold W02 iteration but contain counterfeit snapshots B in its own frozen indices. The proof sees B as immutable and admits the exact original Proxy pair. Later inherited iteration can change to B, yet the warm cache skips the full public W02 validator. Native `.find` reads B; unchanged ports and an empty band do not reject a forged top-level snapshot signature.

This was initially a static execution-path finding; the Integrator subsequently confirmed genuine REDs in saved receipts 09 (root Proxy and hidden facts), 10 (nested contents Proxy), and 11 (clone admission unavailable). This reviewer executed no reproducer. Root authorized a narrow local correction, which this reviewer read in the actual final diff.

Final admission (`beltReference.ts:72–115`) first proves frozen/plain/own-data/dense graphs and additionally declines nonenumerable own values except array length. Thus no hidden nested Proxy can be omitted by the standard clone operation. `isCloneableSnapshotData` invokes the standard `globalThis.structuredClone` once per admitted immutable root, discards its result, and retains only successful original roots in a WeakSet. Standard clone rejects root and nested Proxies. A thrown clone or unavailable API leaves the pair uncached on the full original W02 path. No copied projection becomes authority. Only after successful W02 validation, immutable proof and cloneability proof does the exact captured original pair enter `validatedSnapshotSets`. Receipt 12 verifies all eleven C1 guards on exactly these final source/test hashes. Both P1s are closed within this bounded diff.

## Verified ordinary-data behavior and limits

For actual ordinary own-data graphs, the recursive proof checks every object/array is frozen, rejects mutable descendants, accessors, custom prototypes, own array methods, symbol keys, nonfinite values, functions, cycles and nonenumerable values, and requires dense own numeric array indices. Undefined is accepted for the existing optional non-mining depletion projection. Standard cloneability excludes Proxy graphs. The exact catalog/list pair is the only admitted cache key; a frozen forged list does not pass W02 before admission, and failed W02 calls add no pair entry.

Shared immutable FP02 source-data aliases remain existing data. Reusing the immutable-proof WeakSet does not reuse snapshot validation across different catalog/list pairs: an ordinary new pair still reaches W02. No new SourceData alias or authority bypass was introduced in catalog/Resources code. Clone output is never used in canonical bytes, business validation, custody or material authority.

`inputBytes` and `proposalBytes` are unchanged and are computed fresh. Complete line, binding, installation/ports, source quantity, receiver definition/capacity, material receipts/reservations, full power receipt, ticks and actor/source request remain bound. `powered` still checks full canonical receipt bytes/digest and consumer/device/job/port/tick bindings. Ports, custody, packet quantity/lineage, stale input, canonical proposal comparison and replay revalidation remain outside the cache.

The new byte-equality oracle covers cold/warm and JSON-restored/copied proposals in the WAIT_POWER case. Existing regression tests separately cover full receiver hold/release, blackout without material/progress loss, restored credit/position, explicit quantities, forged/stale proposals, complete power receipts and exact replay. New focused oracles exercise root/nested Proxy fallback, hidden facts, and absent clone admission. There is no new C1-specific sparse-snapshot-list executable test; dense-index proof and the unchanged canonical sparse rejection were inspected statically. No all-outcome cross-revision canonical byte matrix is present. This review assumes untampered standard realm builtins; arbitrary replacement of `structuredClone` or mutation of global prototypes is not a supported data-input trust proof. The clone check does not harden all preexisting arbitrary getter/Proxy behavior outside C1 admission; it preserves the full validator path for those inputs.

## Saved OwnRun evidence, independently read and hashed

Prior attribution: `apps/weltraum-browser/evidence/factory/play/2026-10-12/PLAY-06/20261012T072849Z`. C1: corresponding `20261012T082437Z`. The evidence subagent decoded the saved raw gzip payloads and recomputed their byte counts/hashes, command UTC/elapsed consistency and both stored profile attributions; no checks were rerun.

| Saved receipt | Outcome | Wrapper seconds | Scope |
| --- | --- | ---: | --- |
| Prior baseline | Exit 1; 1 passed, 1 timeout, 32 skipped; output case 5649 ms | 9.452156234 | Preserved FAIL |
| Prior V8 profile | Exit 1; 1 passed, 1 timeout, 32 skipped; output case 5847 ms | 9.811332641 | Attribution, not performance PASS |
| 01 C1 business RED | Exit 1; 1 failed, 5 passed, 14 skipped | 0.846116867 | Validation called 4 versus expected 1 |
| 02 C1 focused green | Exit 0; 6 passed, 14 skipped | 0.846858289 | Earlier runtime: 22,683 B / `dc2fecb8…` |
| 03 C1 conveyor regression | Exit 0; 20 passed | 13.120924176 | Original C1 final bytes; includes six C1 guards |
| 04 original build | Exit 0; TypeScript/Vite completed | 4.431962864 | Original C1 final bytes; chunk-size warning |
| 05 final original paid pair | Exit 0; 2 passed, 32 skipped | 8.686633676 | Original C1 final bytes only |
| 06 nonprimed getter probe | Exit 0; 1 passed, 20 skipped | 0.710587277 | Ineffective initial RED probe, preserved |
| 07 warm-catalog getter business RED | Exit 1; 1 failed, 20 skipped | 0.764552586 | Actual P1-A reproduction |
| 08 getter guards green | Exit 0; 7 passed, 14 skipped | 0.792259692 | MaterialView capture fix bytes |
| 09 root Proxy / hidden facts business RED | Exit 1; 2 failed, 7 passed, 14 skipped | 0.781784162 | Earlier `c66f0e…` runtime |
| 10 nested contents Proxy business RED | Exit 1; 1 failed, 23 skipped | 0.722850208 | Earlier `c66f0e…` runtime |
| 11 clone admission unavailable business RED | Exit 1; 1 failed, 24 skipped | 0.741960903 | Earlier `c66f0e…` runtime |
| 12 all security guards green | Exit 0; 11 passed, 14 skipped | 0.806925234 | Final `2e8a33…` / `4a2fa1…` source/test bytes |
| 13 final conveyor regressions | Exit 0; 25 passed | 12.801427181 | Final `2e8a33…` / `4a2fa1…` source/test bytes |
| 14 final original build | Exit 0; TypeScript/Vite completed | 4.434817984 | Final `2e8a33…` / `4a2fa1…` source/test bytes; chunk-size warning |
| 15 safety-final original paid pair | Exit 0; 2 passed, 32 skipped | 7.744819137 | Final `2e8a33…` / `4a2fa1…` bytes and all nine safety-final bindings |

Receipt 05 is exactly `npm run test -- tests/unit/factory/dryFactorySlice.test.ts -t paid-band`, with no profiling arguments. It ran 08:26:30.831062–08:26:39.517717 UTC. Decoded raw payload: 385 B, SHA `0a24d17bec383a040c272c4ab77bc71a0a3fd9fc8408dbfc827e2b819d822d85`. **Individual green-case milliseconds: NOT_REPORTED.** It consumed the original candidate grant's one paid pair. It remains preserved and cannot establish current corrected-source acceptance. Receipt 15 separately consumes the explicit safety-final grant's one additional pair. The complete C1 receipt directory contains exactly these two paid-band commands and zero profile commands/files; no ungranted third pair was found.

Receipts 09–12 use `node node_modules/vitest/vitest.mjs run tests/unit/factory/conveyor.test.ts --maxWorkers 1 -t <filter>`; no paid-band case or profile is added. Receipt 12 filter is `PLAY06 C1`, UTC 08:42:09.316267–08:42:10.123211. Raw payload 284 B, SHA `6ab437d2dd880fae3952294b0637d740e18a71fe165685477033de79e8005c53`. The decoded 09/10/11 raw hashes are respectively `fbcd19d223a0121b2fa217dc33377d0ac613b023533ff1d38b50075d50e1d020`, `c76d2c4728d1a0ab9e1a6197aa4362913a5749f2ae88730096cb69ded2277966`, `4df17802355241f027fdbb26aab53aa9bebf86e6dfc67e1b5558f406ed1e29f5`. All lengths/hashes and UTC/monotonic spans match saved metadata. Receipts report Node v22.23.3/npm 10.9.8 and HEAD `393670f…`.

Receipt 13 is the complete unchanged conveyor suite command `node node_modules/vitest/vitest.mjs run tests/unit/factory/conveyor.test.ts --maxWorkers 1`, UTC 08:42:59.181904–08:43:11.983352. Raw payload 274 B, SHA `7d3a328cc2b10c139ca3270aa66634ccf4452a978279261f3367f914eeb8d30b`; 25/25 tests pass, zero skipped. Receipt 14 is exactly `npm run build`, UTC 08:43:28.811375–08:43:33.246212. Raw payload 1904 B, SHA `a1ae247aae06b2d89fc936847bcd1ddc5b4718d4a0c2d67c21eb946c7a33ee74`; `tsc -p tsconfig.json && vite build` completed. Both receipts have exit 0, HEAD `393670f…`, Node v22.23.3/npm 10.9.8, and source/test bindings that match current files byte-for-byte. Decoded raw lengths/hashes and UTC/monotonic spans were independently verified by this reviewer. They were not included in the earlier evidence-reader window; the statement that current regression/build were missing is now superseded by these actual receipts.

Receipt 15 is exactly `npm run test -- tests/unit/factory/dryFactorySlice.test.ts -t paid-band`, unprofiled, in the original app workdir, Node v22.23.3/npm 10.9.8. It ran 08:49:11.577550–08:49:19.322387 UTC, wrapper 7.744819137 s, exit 0. Decoded raw payload: 385 B, SHA `b1a86ef819ae50f86332cbbc4d27cb1c3b6354b71c76a4e3257ffc9f39d9596a`; command receipt SHA `8ef651303928a74ab727b68a998db5042647fe2467895d7af3accbe58feed744`. Actual runner result is one test file passed, **2 tests passed / 32 skipped / 34 total**. The two original case names/order and assertions remain in the unchanged block; both execute in this same process and no case filter other than the original `paid-band` selection is added. **Individual green-case milliseconds remain NOT_REPORTED.** Aggregate runner tests 6.80 s / duration 7.33 s are not individual case timings or a speedup measurement.

`safety-final-preflight.json`, observed 08:49:11.524146 UTC before receipt 15, binds the exact Root grant SHA `4abcfe905fa7b824e2a11ddcdad7104a5801c1f22b7859b02803199ad33a504b`, all nine identical source bindings, unchanged scenario block/order/57 adoptions, and the coordinated exclusive CPU lease. All nine bindings were independently matched both against the grant/preflight and against current files after the run. Source/test hashes in receipt 15 match current files exactly. Original config still has `maxWorkers: 1` with no timeout override; the test block has no custom timeout. The original 5000 ms limit remains intact. No source refactor, profile, limit change or reviewer rerun accompanied this final measurement.

The original paid-band block is byte-identical to HEAD/prior: 6,563 B at offset 22431; SHA `ce1fb626500b8b05fcbd255f574f4a0597d1ebd864dab82d74a98dbd64951cd1`. Both cases retain their original source order and original 5000 ms limit. The output case still performs 55 + 1 + 1 = 57 adoptions.

Both prior profile payload hashes, weighted self/inclusive/nearest-caller values and disjoint buckets match recomputation. Parent PID 12428 is 92.6721% idle and is not added to worker PID 12453. The attribution supports the selected repeated W08 validation cost; it proves neither cache safety nor a numeric speedup.

Technical composition evidence, current functional guard evidence, Source9, normal browser behavior, target hardware and owner decisions remain distinct. Browser/hardware performance, full W09 acceptance and owner acceptance are unverified here. No timeout change, new profile or new paid-pair run was performed by this review.

Root grant `play-06-c1-safety-final.json`, authorized 08:45:35.551780 UTC after independent security closure, explicitly permits exactly one additional original paid pair, zero profiles, zero new optimization candidates, and no product writes. Receipt 15 is that completed, independently verified run. All nine grant source bindings and the original 6,563-byte scenario block match current files. Existing order, 57 output-case adoptions and original 5000 ms are preserved. Prior receipt 05 and every historical FAIL remain separate and unchanged.

**C1 independent closure is complete for the exact reviewed source/test/evidence scope; Root may close the bounded C1 gate and proceed to its commit review.** This is pure composition-test acceptance at the fixed original limit. It is not browser FPS, frame/GPU performance, target-hardware acceptance, whole-product current-HEAD validation, full W09 acceptance, or owner acceptance. No further benchmark/profile/optimization is requested by this report.
