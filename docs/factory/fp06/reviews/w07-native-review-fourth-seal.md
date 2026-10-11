> Quelle: `/workspace/.cloud-setup/fp06-w07-native-review-fourth-seal.md`; originale SHA256 `d49a6ae4dcce9f281674974bfed6224c020d51890a38ef2da8e1d6d3160f3a94` (9800 Bytes). Kopie am 2026-10-11T14:45:54.477304+00:00; ausschließlich Markdown-Zeilenenden/Leerzeichen normalisiert. Historisches Review des vierten 27-Pfad-Seals; die späteren Inputkorrekturen sind hier nicht geprüft.

# W07 independent native/quality followup — fourth-browser seal

Reviewer `/root/w00_repo_audit`; readonly static and existing-artifact inspection only. No tests/build/browser/profiling/verifier commands, product changes, commits, or subagents.

## Verdict and exact candidate

- **NATIVE_SPEC_COMPLIANCE: PASS** for the sealed 27-file candidate below, retaining the historical third-seal native findings/closures.
- **NATIVE_CODE_QUALITY: PASS** for the authorized mount-recovery delta and unchanged reviewed native runtime. No new native implementation finding was identified.
- **BYTE/SCOPE_BINDING: PASS** at both initial and end checks: actual 27/27 files matched all sealed SHA256/size pairs; receipt paths exactly equal the 27-path W07 grant. Current HEAD remained base `d5502ae7fd5431d58eda51bea062c54691ebe3c2`; no W07 commit admission is implied.
- **BROWSER_EXIT_GATE: FAIL**, actual fourth browser exit 1; **4 PASS /1 FAIL /6 NOT_RUN**. Paid placement, finite second-Cutter rejection, and native browser disposal are NOT_RUN. Final package/manifest/Git/LFS gates remain PENDING.

The external patch `/workspace/.cloud-setup/fp06-w07-before-fourth-browser.patch` is 175137 bytes, SHA256 `56c900dae3f1a4c5db34d97f1b0e8e1f06c8a6097c167509b2e8d9f249d38e89`. File receipt `/workspace/.cloud-setup/fp06-w07-before-fourth-browser-files.json` is 5538 bytes, SHA256 `09e4d89eb745e281e9f36b0cdc19d8596393841e8da88869f18287c9bf567643`; timestamp `2026-10-11T14:18:25.352014+00:00`. The existing-file patch headers stay within the exact grant; new and unchanged grant files are also bound by the full receipt. No scope drift was present at the end check.

## Authorized mount recovery closure

The sole runtime delta since third seal is `apps/weltraum-browser/src/factory/session/factorySession.ts`, SHA256 `7f1e342aecac3525bcc1b0a0f6ea579a1db2172af6f98d00d7289b7087a3a00f`, 5378 bytes. At lines 28–36, closed Cargo fixture/catalog/Resources/material/construction initialization now completes synchronously **before** `mountedHosts.add(host)`. Failed initialization has not reserved the host, subscribed to ticks, invoked native commands, or disposed its native adapter. The existing subscriber-failure catch still deletes the reservation; successful live duplicate mounts remain rejected, and normal disposal deletes it. There is no await/reentrant native publication introduced between the duplicate check and synchronous reservation. Native World, source, memberships, caps, rollback, and Host APIs are unchanged by this fix.

This is the exact two-path followup authorized before writes by control commit `98fe5e6ea02e31549cbb0027df3a47615174388b`, current `source-lock.packageScopes.W07.narrowMountRecoveryFollowup` receipt `2026-10-11T14:04:24.667053+00:00`. The second path `tests/unit/factory/hostLifecycle.test.ts` is SHA256 `fd55eb45af1166c49b8302d925cb9bf14bc189665f2dbd11f3a661f0330018b5`, 14119 bytes. Its new two-case test at line 36 uses the **same actual Host object** after separate invalid catalog and invalid material initialization, then verifies a valid retry, one subscriber, no native commands, and exactly one normal native dispose. An initial test-fixture type error was corrected with a valid empty ResourceCatalog object; it was not a runtime change or a new business RED.

The previously closed initial-Cargo ID protection (pure and native), disposed-before-checkpoint guard, and both projection paths' common Host frame remain byte-identical to the reviewed third seal. All other runtime files remain byte-identical. The sole private World, complete actual body/collider/shape/friction/extent/pose and candidate membership checks, staging rollback/finalize, initial Cargo source/native access/sole Resources authority, unchanged global caps including initial owner and dormant candidates, conservative staged CPU admission, +90-degree shared transform, and closed legacy decoder/Save guard retain the earlier review scope. No W10 combined-save proof or broader gameplay PASS is asserted.

## Existing mount and TypeScript evidence

Evidence root is `apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z`. Commandmetadata, raw gzip logs, readable logs, and exits were independently read; for phases 33–39 actual decompressed raw SHA/size matches the command receipt. Readable/raw text matches after ANSI/trailing whitespace/newline normalization. Empty raw tsc output in phase 37 is correctly distinct from its readable one-newline file; no literal-byte equality is claimed for that pair.

| Phase | Actual recorded result | Raw SHA256 |
| --- | --- | --- |
| `33-red-failed-initial-binding-retry` | exit 1, **2 FAIL /17 SKIP**, both valid same-host retries reject as already mounted; before fix | `56161ce03ecda2d517c10c4c8b5d0412e7113c474c07d1a9a86da279b6f4f894` |
| `34-green-host-lifecycle` | exit 0, **19 PASS**, after runtime fix, 1.12 s Vitest | `3d3a796931dd22eb0fafeff3f3e3b5d8332249a6cd7121c34b94ca8dd2365bb2` |
| `35-typescript-after-lifecycle-harness` | exit 1; test-fixture `resources: never[]` is not ResourceCatalog; preserved type failure | `fdadd621c1b8f431cd8a9e3b6a5c6ccbf0361e571030aef7f714a92dd54db087` |
| `36-green-typed-initial-bindings` | exit 0, **2 PASS /17 SKIP**, after fixture type correction, 514 ms Vitest | `78bfda950a02e66615c85920b8de937fb04a66ad1393d34c0295d8273bbe7964` |
| `37-typescript-final-lifecycle-harness` | exit 0; full `tsc -p tsconfig.json`, 14:09:52–14:09:55 UTC | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `38-typescript-final-eleven-browser-cases` | exit 0; full tsc at final eleven-case harness, 14:18:02–14:18:05 UTC | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

The earlier full TypeScript/Vite phase 31 precedes the mount delta; the later two full TypeScript results above cover the actual narrow final runtime/fixture/harness. No new Vite run after the mount change is invented here.

## Eleven-case harness and actual fourth-browser blocker

Only the separately authorized `tests/e2e/factory-placement.spec.ts` changes beyond the two mount paths; SHA256 `18315c49db16d9fa24c28ca536f8ad5543a3eecbcbe204ea087932eb5e264829`, 11673 bytes. Lines 13–18 preserve one serial suite, one browser Context/Page, and the same initial native World between all eleven cases. Normal UI/keys and native/Resources reads are used; there is no TestBridge. No timeout or queue limit change is introduced. The split preserves the original 30 s case limit. Subsequent ledger checks explicitly require unchanged total mass 2984400000 mg, one paid 208000000 mg Cutter, C26 source provenance, consumed finite chassis, and unchanged native Cargo handle. The second site is moved to exact `[-9750,1500,5000]`, quarter-turn 1; it asserts `BOM_MISSING`, not generic rejection or overlap. Pure planner ordering at `placement.ts:65–96` checks reach, facility/player overlap, support, body/service/sweep air **before** BOM depletion, so a completed `BOM_MISSING` assertion would not stand in for an earlier blocked-site result. These latter browser cases have not completed in the actual run.

**Concrete browser finding, gate blocking for this harness (P2):** `tests/e2e/factory-placement.spec.ts:36–43` holds movement keys until asynchronous native-read polling resolves; actual read/key-up delays let the player overshoot the intended reachable construction position. The fourth run fails the exact `cargo.accessible === true` assertion at line 43, column 528. This is a reproducible current-run assertion failure; a native authority/reach defect is not established by it.

Existing `39-real-browser-fourth-command.json` and exits record 14:18:48.376718–14:20:10.528377 UTC, exit 1, 7621 raw bytes, raw SHA256 `17c17452c7c6d9f93efed0f2bec76c73321bce3cb78a91d2999d46e5af35a444`, gzip SHA256 `83ede125456a4bb4ea7795f12236494eb2fbca1d60528e1f3c3636b3e8a4291e`. Readable `39-real-browser-fourth.log` is 7619 bytes, SHA256 `24a9364e62f67bf6a3e6e431a20f5b28d2006a6c67ddc9138508e3a3ac658614`. Actual results are Ready/finite Cargo PASS, closed Cargo/ghost retirement PASS, repeated Open PASS, normal Play/D walking PASS, S-walk reach assertion FAIL, remaining six NOT_RUN.

Actual failure trace `browser-fourth/playwright-output/factory-placement-W07-real-c7a2e-aterial-and-Cargo-unchanged-chromium/trace.zip` is 5114330 bytes, SHA256 `d7087a54603424c0a601dcc02b0c359764222ea8e9caa810cb258ec3bbcdc684`; archive events were read, independently of the extracted `39-browser-fourth-native-walk-trace.json` receipt. Native `call@89` has grounded true, Running position x=-8.4434662, z=11.8750153, Cargo accessible true. `call@93` already has x=-8.4434595, z=7.8250198, accessible false. Final `call@105` has Paused, grounded true, x=-8.4434595, z=2.2250071, Cargo accessible false, initial Cargo still opened and unchanged. The final player lies well beyond the unchanged 4 m actual Cargo reach. This fourth failure is an actual reach assertion failure, not the third run's exhausted 30 s pre-Play case. It must remain recorded until a separately authorized corrected harness completes real bounded movement and the remaining gates; widening source reach or assuming later paid-build success is unsupported.

## Preserved phases and next receipt

Third-seal report remains SHA256 `266f07dc333bab4c2f6ec30637e034e090c87c8322690e40c959b6ece4ea8947`; original prebrowser report remains `10fb606a86a7eb2ddeb68623c95a173aa9fc5b7ec2ee3a3bb731727b31734730`. Both were independently rehashed unchanged. This report closes authorized Mount runtime recovery and binds the fourth-seal native code; it preserves the actual browser FAIL and awaits a separate corrected harness/evidence receipt and final commit admission. No product-owner waiver or future test PASS is inferred.
