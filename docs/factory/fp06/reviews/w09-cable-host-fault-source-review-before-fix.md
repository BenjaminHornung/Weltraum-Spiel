# W09 Cable Host faults — independent checkpoint193 review

**Retained 191–193 evidence: PASS. New-intent RecoveryHold authority guard: FAIL / R1 OPEN at the reviewed runtime bytes.** Existing correct-oracle GREEN is not recast as fabricated RED. No reviewer tests/build/browser/native/profiling execution or product/evidence edit. Root has now admitted an exact Session/Host-test RED→minimal-fix follow-up; this report preserves the pre-fix subject.

## Actual subject and checkpoint binding

Integrator WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`. Start **2026-10-11 23:59:56.182573 UTC**, actual measured HEAD `aa2e5d7c335453fc555a98ccd35e9f564c596e93` plus WIP. Ownrun `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z`.

`partial-source-checkpoint-193/source.json`: **7896 B / SHA256 `6f85f73dd1c454c98d16710afb9e262d9abd09be4b125c90b3155d1f0e6a1887`**, created 23:59:17.750286 UTC, explicitly **PARTIAL_SOURCE_CHECKPOINT / package BLOCKED**. Independently verified all **26 captured product copies / 830960 B** against all declared hashes/sizes. No final Git/package/source-quality PASS implied.

Main reviewed runtime `src/factory/session/factorySession.ts`: 66113 B / `2999c2846cdf2249733ad57fd7e9362a53b8d9aa01de843cc2857ba61c6d0bc3`; original Host test 61246 B / `6c3e0cb83436e5622b1c22ed7f2cbe22b7dae9076cbda0ab34d657462a3410a6`; handling 13892 B / `b5c4e663c2c0796d65b86e2af9c2bc4d403a710fd37d180f9403be10cb293018`.

At **2026-10-12 00:03:47.733755 UTC**, actual HEAD still aa2e5d7c…: current runtime25/26 files match historical checkpoint. Only Host-test source has authorized new-RED drift: 62333 B / `20f4480c965480cf097e1c4541a31868c02595ea4dbaae4445718b6a315917cc`. Immutable checkpoint copies remain valid. No claim that 191/192 tested these newly added bytes.

## Actual retained evidence

All three actual gzip decompressions match retained original `.log` bytes and command-receipt raw SHA/size; cwd/argv select this application and the stated Host oracles.

| Phase | Actual outcome and UTC interval | Raw bytes / SHA256 |
|---|---|---|
| 191 `cable-rollback-publication-history-oracles` | Exit0; **4 PASS / 38 skipped**, 6.493767s; 23:57:20.685519–23:57:27.178884 | 393 / `48755cd8c39af0979dce1e189db2f778a69e380376fbaa4d028c27cbf0f555a0` |
| 192 `cable-whole40-native-negative-guards` | Exit0; **2 PASS / 42 skipped**, 3.645777s; 23:58:10.915843–23:58:14.561253 | 398 / `357e7ea90580c686ca0e21d9841537c22dc6f6f0afd1c5c68651081746df6618` |
| 193 `cable-fault-typed-original-build` | Exit0; original tsc/Vite, 4.268770s; 23:58:14.594530–23:58:18.862839 | 1904 / `b12236b22ee90c3c348b8b6700d9d93becad697e54f4a605bb77688c348a76eb` |

Receipt SHAs: `5cbacb060231d80a5231b7efcaca56b2547054574d811a21a573e93528dbc97d`, `b19416def1fab2e4c3d00d76fb8c8a38d48ab4250e3d5d4556bbb67b6b9d4eba`, `dd1af97c54bae28d3747ba166eed7e60abf6281697edf5aa455a095bff0c8d80`. Actual gzip 291/291/875 B; SHAs `d9d912c3d066574dc4cd2b2cc3da4e2a5e8f7db01d691d75788d0749d44d0d3c`, `6e1012a4f28be446099a41622de8f0c68fa2759ddedc339e8ce9a3e49eb3d62e`, `597b90fc442d6056647a71f59f54b22374752afd06df2a82f66648358ec65190`. Build retains the chunk-size warning.

## What the existing cable oracles establish

Fresh port/profile/source/terrain/facility/access admission and exact reachable cable length are checked after pause, before authoritative mutation. Native CABLE40 custody cannot partially fund 6500 mm: closed deposited profile, exact single whole stack and profile digest are required. The 192 negatives leave material, carrier and graph revision unchanged.

Material transfer/reconciled graph are initially pure candidates. For deposited custody, Native release Prepare+Commit precede Material CAS; then material/domain/link publication occurs without await. `published=true` is set **before** calling Native Publish. Unknown Publish/Finalize retains adopted empty custody, paid 1625000-mg installed cable, graph/netRevision1 and RecoveryHold; no refund. A prepublication Commit rejection followed by successful rollback preserves full6500-mm custody/material/graph and Ready. Unknown rollback instead holds the original material/graph. Tests execute these four declared Native-reply outcomes, conserved 2984400000-mg Host totals and historical same-command replay.

## R1: concrete source authority gap

`FactorySession.ui.submit:327` checks busy/current bindings/Host confirmation but **does not check session `view.state===RecoveryHold`**. Cable catch :386/:388 sets that session view only; `createFactoryHandling` can still be Ready. With the declared 191 fixture's confirmed Host/Idle Native replies, a **new ID with fresh binding** can enter :331 and perform a local Cargo→input transfer after unknown rollback. UI disabled capabilities do not supply Host authority. `history.replay` at :320 correctly handles the old ID; 191 checks that replay, not a new intent after hold.

This is a timed source counterexample at runtime SHA2999c284…, **not a reviewer-executed failure**. Reported promptly to Root/Integrator. Required narrow closure: reject all new mutating intents before Handling/graph/SOC/material actions whenever Session RecoveryHold, while preserving historical receipt replay first. Actual new RED/GREEN/checkpoint must be reviewed separately; no source fix assumed here.

Native observations/support/release acknowledgements in these Host tests are explicitly transport/fault replies, not Rapier rollback proof. No real browser, SourceV1/V2 terrain route, whole-World conservation/save, performance, visual/Owner Art or full W09/package certification. Existing checkpoint open gates remain open.
