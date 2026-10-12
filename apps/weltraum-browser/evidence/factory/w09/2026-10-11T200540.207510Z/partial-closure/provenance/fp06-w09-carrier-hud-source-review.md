# W09 Carrier HUD — narrow independent source/evidence review

**Scoped HUD source/contract/retained regression evidence: PASS.** No concrete additional fix found in the new reader/text-projection seams. No reviewer tests/build/browser/native/profiling execution or product/evidence edits. No final W09/package/visual gate.

## Actual bound subject

WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`. Start **2026-10-11 23:35:13.590531 UTC**, actual measured HEAD `aa2e5d7c335453fc555a98ccd35e9f564c596e93` plus WIP. Ownrun `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z`.

`carrier-context-hud-closure-174/source.json`: **835 B / SHA256 `92ac66aac25f9122c33e1ba6579ddec919c97b49bfda06ceca6d7ecc58d8cf4f`**. All three listed actual files match and remained unchanged between start/end:

| Application-relative source | Bytes | SHA256 |
|---|---:|---|
| `src/hvp/hvpHud.ts` | 23052 | `67b223c31d76002f22097e6b9175ac6d4dab7aad583a4413ae9a2c05ce0a6910` |
| `src/hvp/hvpBootstrap.ts` | 175076 | `66ec6f330dc7d6cf7c25851fc20b3ae17bb0daf8faad8827efe6d45dff81198d` |
| `tests/unit/hvp-bootstrap.test.ts` | 83663 | `1af43b680ce07f6799f0f59a846abd9538a59f97d851868df24a12dd6d3cef51` |

Actual HEAD HUD base independently read: 22610 B / `2e89c73b3749ec7d539ff3656cc233cc22eb774947f4bc19ab67d0e85ef3f699`. This is a bounded three-file HUD snapshot, not the complete 26-path W09 seal.

## Actual retained command evidence

All four gzip decompressions equal actual retained original `.log` bytes and match command-receipt raw SHA/size, cwd and argv. No reruns by reviewer.

| Phase | Result and UTC interval | Raw bytes / SHA256 |
|---|---|---|
| 171 | Exit1; genuine assertion RED, **1 fail / 43 skipped**; expected Transport341kg, received generic “Kein Treffer”; 23:31:33.335160–23:31:42.659399 | 1160 / `8646c63197a6ea5557069601a6b74f40041ff835ea10dcb9ae8ad4fc2f2d42ad` |
| 172 | Exit0; **1 PASS / 43 skipped**, 9.903992s; 23:32:25.892798–23:32:35.796328 | 394 / `ef9ee152cbf0ec8886211a1a429300139fa5072864e3707b84bbdc797d9ad948` |
| 173 | Exit0; **7 PASS / 37 skipped**, 54.265497s; same HUD + six receiver/budget fault cases; 23:33:01.260471–23:33:55.525590 | 500 / `1a7c619cabe270edeeccb35bcca2e002aca50a0de3b01b88f97388232b55be50` |
| 174 | Exit0; original `tsc -p tsconfig.json && vite build`, 4.248900s; 23:34:09.838260–23:34:14.086550 | 1904 / `f4eb39b93c4d78b68b0c5e50a7aaa0590ba5ae8b02125876a512a161a378ec11` |

Receipt SHAs 171–174: `59943cb3bf9d4b132a78948c1a9bf9779d244e97e04e55cf8f7bdc68ff70457f`, `639a72e0e88b22cac539449441c64183a22e0f1af8de8006a8785d07da7273fa`, `17320f30a46a263901db8967d25018e8247dc172bb026ee24a3e1095c37e299b`, `70124bcd333829dfc9ac2430067040b4fa44aa5b3f25e0dc67413ce56703d36d`. Actual gzip 576/287/357/871 B, SHAs respectively `f12c0a12cd6b8af639121a6f1c04f16918da14a22b1ac82018e3e644f760870e`, `244ab56a3e7a3053249b7bbe72313c9a9abb98f901528d68622c43906d4950f7`, `3ee7d5488fe07caebf0375a9b2ac866c73477469a7bea6339bf875a3c261fb84`, `d9927e1d093a457ca310595049ddc709c891a176c15bd5f63804c7eeb7151e60`. Original build preserves its chunk-size warning.

## Contract, defaults and lifetime

`hvpHud.ts:50` adds an optional read-only context reader. `hvpBootstrap.ts:2112–2121` returns undefined immediately without Factory extension or Native carrier. Otherwise it projects Native `massMg`, phase, accessible depot and movement-veto reasons; held/RecoveryHold phases say the transition is unconfirmed and custody remains bound. Known obstacle/support/coverage/ground reasons have German guidance; unknown reasons remain “Transportweg nicht bestätigt”, not a new admission claim.

`hvpHud.ts:260–270` uses this value for the existing target/feedback/cut/key text nodes and restores the original impulse/cut/key texts when absent. No new nodes, listeners, timers, clocks, controllers, quantities, command dispatch or renderer inventory. The callback invokes only `physics.read()`; actual client source :241 returns its cached snapshot, with no Worker post. This introduces no per-frame IPC call from that callback; no performance measurement follows.

The normal Bootstrap frame is guarded by disposed and cancelled on teardown; existing HUD Dispose removes listeners/root/goal/interaction/reticle. HUD's legacy `updatePhysics` method itself retains its existing lifetime model; no new independent post-dispose callback is scheduled. Actual test finally disposes, but does not directly execute a new post-dispose-reader oracle.

The real Bootstrap/HUD test uses declared Native transport replies and fake GPU: before carrier generic texts, Carry341kg + WASD/ablage guidance, obstacle veto, Deposit341kg, then restored generic impulse/voxel keys after clearing carrier. It compares Host readback unchanged across the HUD update. Held-label logic is source-reviewed, not separately text-asserted by this test. Native facility bytes independently still match earlier d6b78… snapshot; no new Native admission is claimed.

End **2026-10-11T23:39:37.258239+00:00**, independently measured HEAD **`aa2e5d7c335453fc555a98ccd35e9f564c596e93`**. Other WIP may drift; no global current-source binding. No actual Resources payment/conservation, Native solver state, ordinary browser screenshot/gesture, visual/Owner Art, GPU or FPS/performance acceptance is inferred from this Source/fixture proof.
