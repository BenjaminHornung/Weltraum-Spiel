# W09 Native depot snap — narrow independent closure

**Scoped Native source/retained Rapier regression evidence: PASS.** No further concrete correction found in the admitted snap/custody/sweep/rollback seams. Initial RED report `fp06-w09-native-depot-snap-source-review.md` SHA256 `d29bf636e4102755179fe6b242ca730ee888dd7d42934112386c165c6a0ed380` remains unchanged. No reviewer test/build/browser/native/profiling execution or product/evidence edit.

## Actual subject and preserved evidence

WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, ownrun `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z`. Follow-up start **2026-10-11 23:18:01.187563 UTC**, independently measured HEAD `aa2e5d7c335453fc555a98ccd35e9f564c596e93` plus WIP. Snapshot `native-depot-snap-closure-158/source.json`: **687 B / SHA256 `2aebcd2c5591d53ac16f0b78e312efb732e878331237bed3d607b19f2fe406de`**; both listed product files match actual source bytes. This is not a final 25-path package seal.

| Phase | Actual result / UTC interval | Raw bytes / SHA256 |
|---|---|---|
| 150 | Three genuine assertion FAIL, 25 skipped / 23:09:58.694307–23:10:01.909489 | 2152 / `743d1e6d0580f26e63f76889f09728668a1302e9961f381e096131ae1185eaf5` |
| 158 | Exit0, **28/28 actual Rapier Facilitytests PASS**, 7.958264s / 23:17:03.955255–23:17:11.913161 | 360 / `8c8a0cfa8d540582b81f83ad0c82a6a730d0e0ed3d8f3a23af4b6326c324e5cf` |
| 159 | Exit0, original `tsc -p tsconfig.json && vite build`, 4.734589s / 23:17:24.287022–23:17:29.021197 | 1904 / `ece0fc38fff521f9b7bd4a76ab83f6b678e31429f4a27fde6d54ffabf37e67eb` |

158 command receipt 478 B / `097a20dd755a44a5fcf1b876db26d449fbe2890b5ec65ac202ef2b455d9f55d2`; gzip 265 B / `9bc2ab46e510da22e6ef25b29f1171f2fbd6621827c3286e63c8b9e4e8ce32c0`. 159 command receipt 420 B / `f3139581563620556a3ff37a314aa01ba1fb4f4afa45a3a9a7faad803aee6e21`; gzip 870 B / `754e4518b3ed0edd3eb7d2c7af67795c3082078bc9c809dd33716bc77498059f`. Both gzip→retained-original byte comparisons and receipt raw SHA/size PASS. Original build retains the chunk-size warning. Unrelated 151–153 alias phases are not represented as Native GREEN.

## Concrete source closure

- `carrierPose:178–195` uses Native actor/carry-offset values; deposition alone rounds X/Z to the nearest 250-mm grid. The distance guard is 125.001 mm per axis (1µm floating tolerance). Current pose must still match current actor-derived carrying pose within 2 mm. Target ground and all sampled feet are read again; full hull coverage is checked. Target ground differs from saved actual carrying Y by at most 2 mm. No UI pose command or source-terrain write is added.
- `prepareCarrierDeposit:317–340` rejects a foreign `sourceContainerId` before body disable by equality to the carrier's actual custody container. Owner/profile/action IDs, completed-ID exclusion, current facility/terrain revisions, paused/idle state and pending-work guards remain. It saves immutable actual `previousPose` and the admitted `depositPose`.
- Before any disable, all **five actual q1 payload/support cuboids** sweep continuously from saved pose to target with Native `castShape` and existing self/obstacle filtering. The narrow diagonal obstacle outside both endpoints is rejected; endpoint-only admission is no longer used. This uses the existing 0.5-mm query shrink, not changed source geometry/collider budgets.
- Commit sets the same body's fixed type/admitted target translation and refreshes held body/collider fingerprints. There is no extra body/shape allocation. Rollback restores carrying type, saved translation and next kinematic translation, reenables the same colliders and proves original complete membership/bytes before restoring revision/clearing work. Failed proof takes RecoveryHold rather than guessing restoration/refund. Publish/finalize continue to require held identity/phase and increment revision once.

The actual new tests verify the off-grid center becomes x=−5.75,z=10.75 with unchanged Y and actual 300-kg mass; rollback restores exact original pose/type/counts; retry produces the same fixed body. Foreign custody leaves pose/enabling/phase/counts intact; diagonal sweep leaves carrying phase/counts intact. Older regression independently retains same collider handles and actual 300-kg mass. Its unrelated hard-coded `carrier_c27` ID is correctly replaced with `original.containerId`; the explicit foreign-ID rejection oracle remains, so this corrects fixture identity rather than weakening custody admission.

## Start/end binding and limits

All three follow-up source hashes are unchanged between start and end:

| Application-relative source | Bytes | SHA256 |
|---|---:|---|
| `src/hestia-prototype/physics/factoryFacilitySession.ts` | 53631 | `d6b78d8f21b3c726752f72310c20e851c21dfe9589969823630830bb5ca98311` |
| `tests/unit/factory/facilitySession.test.ts` | 34774 | `08a8d961b6290c9e4e5617132c5138695916e98f4440bb90773b28a5f6b2d6b3` |
| `src/factory/session/cargoHandling.ts` | 13892 | `b5c4e663c2c0796d65b86e2af9c2bc4d403a710fd37d180f9403be10cb293018` |

End **2026-10-11T23:21:19.780372+00:00**, independently measured HEAD **`aa2e5d7c335453fc555a98ccd35e9f564c596e93`**. Other WIP remains mutable; no broader source or Git/manifest/LFS seal is implied.

Accepted authority remains Root native-handling proposal/actual decision73. The test uses a **synthetic Rapier floor and C27-PACK 300-kg chassis**, declared custody strings; it does not prove 341-kg Former BOM Resources payment, whole-World material conservation/save, D07 terrain/coverage, ordinary browser route or human Owner Art acceptance. D07/source-five terrain is not modified by the reviewed two-file fix and is **not certified by these unit tests**. No final W09/package or performance PASS.
