# W09 Cable RecoveryHold guard — independent narrow closure

**R1 new-intent Host authority gap: CLOSED; scoped source/retained regression evidence PASS.** The original FAIL report `fp06-w09-cable-host-fault-closure-review.md`, SHA256 `e71a0391809c7ade8766f0301bc27c6c078500f6e54016984331595d8edb1358`, remains unchanged. No reviewer tests/build/browser/native/profiling execution or product/evidence edits. No whole-W09/package PASS.

## Subject and exact delta

WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`; ownrun `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z`. Start **2026-10-12 00:07:03.491408 UTC**, end **00:09:09.175864 UTC**. Actual HEAD independently measured at both ends: `aa2e5d7c335453fc555a98ccd35e9f564c596e93`, plus WIP.

`partial-source-checkpoint-197/source.json`: **11220 B / SHA256 `968f2e348f34a4986656c33e1639a535e06f610f756c1f1c7e1f0ea86cc78e05`**, created 00:05:48.701329 UTC. All **26 copies / 832142 B** independently match declared SHA/size; all26 current actual files match at the end check. Same path set as checkpoint193; exactly two byte changes, all other24 files identical. Snapshot metadata SHA is unchanged between reads; no continuous live-file monitoring is claimed.

- `src/factory/session/factorySession.ts`: **66208 B / `ea8d8cdee5ea1826a9b00f0dd7d2d7cbfc4408cdeb7cb2e3f880893ea86a448a`**. Actual diff adds one95-byte guard line.
- `tests/unit/factory/hostLifecycle.test.ts`: **62333 B / `20f4480c965480cf097e1c4541a31868c02595ea4dbaae4445718b6a315917cc`**. Actual diff adds nine lines/1087 B to the existing unknown-outcome oracles.

This is immutable partial-source checkpoint binding, not final Git/LFS/evidence-manifest/package closure.

## Actual command evidence

All four actual gzip decompressions equal retained original `.log` bytes and receipt raw SHA/size. Cwd/argv match the declared application/test/build; no reruns by reviewer.

| Phase | Actual outcome and UTC interval | Raw bytes / SHA256 |
|---|---|---|
| 194 | Exit1; **3 genuine assertion FAIL / 1 PASS / 40 skipped**; 00:03:26.288867–00:03:33.519923 | 2814 / `4307eb93409e72d1aa70a9e4557900a4974cd60ac5a0aff32d7b83838d18cc79` |
| 195 | Exit0; **6 PASS / 38 skipped**, 9.043318s; 00:04:04.906019–00:04:13.948966 | 429 / `874e2213c4f291a2423ecd371815e46441754e15409b420af5d25ca385b6c882` |
| 196 | Exit0; **59/59 complete Host+UI tests**, 26.728585s; 00:04:23.452052–00:04:50.180303 | 394 / `6aa1e8e0e804899f2c8e6ab1629cd7e12ff8c0ae98faf5526d611ccc417ab3da` |
| 197 | Exit0; original tsc/Vite, 4.303717s; 00:05:10.964418–00:05:15.267364 | 1904 / `be736ce8d1d970c22e00797dd96e434a9168a53b911b74f8e9fbe6e51139d214` |

Receipt SHAs respectively `fe1dd6a5ddb6e19ce6d3f33cec962ab29e527cba644a332265e582ed4a2e0070`, `a01f0a061e77a28529c2f565bf2f22bce565877f6c72b6f16ac9bd130eb2511a`, `7623f3b0ecd6c7455e7bfb40a0a5617ada88a191dec82fe7f80994fad43a43ce`, `7db338508822233f04c70e17543bf014babe6380f2686f03e9777ea05a2d780d`. Gzip 733/313/277/872 B, SHAs `e208b822caeaef12d86041c51c06bea100f39ddfa8a960dd105b2f1c0e5dde38`, `a137a4685d7799d22656bc14e57779f6081d673f13dfaf45108c08cc3fbd92ee`, `1a40b9de0825509160c2f4ebf1f1a5611e6df73263cd8d89ce4ab6bca39757fb`, `80b211a71c8de50ab111e0f9d54601afb54aeb0590287c98cc4f5df045f91c73`. Original chunk-size warning remains retained.

194 proves the new transfer entered the wrong post-hold path: publication case returned the Native publication error, finalize case its finalize error, rollback-unknown case actually Committed. These are observed failed assertions; 191's prior correct-oracle GREEN remains correctly classified as GREEN.

## Why the fix closes R1

After canonical cloning, old command receipts are still replayed first at `factorySession.ts:320`; identical pending receipts retain their original promise. After command/session identity checks and before busy admission or any action dispatch, the new guard returns **RecoveryHold / FactorySessionRecoveryHold** whenever session `view.state` is held. It therefore blocks new IDs before Handling, cable graph, power/SOC and material actions even if the Native fixture remains confirmed. The fix neither refunds unknown publication nor clears the held state.

The new oracles provide an otherwise valid fresh1-kg Cargo→input transfer after each unknown Publish/Finalize/Rollback outcome. They require the Host guard reason, unchanged inventory/binding/Host/handling readbacks and unchanged replay of the old cable receipt. The proven Commit-reject→successful-rollback case continues to preserve Ready/full custody. Source inspection confirms the existing cable joint sequence—Native Prepare/Commit, paired Material+graph adoption, publication latch set before Native Publish, unknown finalization/rollback hold—was not modified.

The early guard introduces no Native player-input/pulse reset, clock update or Worker dispatch. Native/client pulse code is among the unchanged24 files; no new pulse-latch behavior or Native timing verification is claimed. Historical command replay returns before the guard without executing another mutation. No further concrete defect found within this exact delta.

The tests use actual Host/Resources/CAS/history with declared Native replies/faults; they do **not** certify Rapier rollback, ordinary browser gestures, terrain routes, whole-World material/save, GPU/performance or human Owner Art. Checkpoint package/open gates remain separate. Root alone admits any subsequent scoped seal/manifest/stage/commit; this review supplies no full W09 completion claim.
