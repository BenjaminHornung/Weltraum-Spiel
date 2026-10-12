# W09 receiver/capture fault follow-up — read-only

**Retained targeted evidence: PASS. Original hidden-stage C1, P1 projection restoration and C2 pre-allocation admission are demonstrated for the five selected cases. A concrete release-retirement source counterexample remains OPEN; no final Source/Quality/W09 gate.** No tests/build/browser/native executions or product/evidence edits.

## Actual evidence, not a rerun

Integrator WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, HEAD `aeb6680044eb455a10d0bba6e67979c153fd248f` plus WIP. Run `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z`.

All three actual command receipts match decompressed `.raw.log.gz` SHA/size and byte-identical retained `.log` originals. Observed results and cwd/argv agree:

| Phase | Actual outcome and UTC interval | Raw bytes / SHA256 |
|---|---|---|
| 82 | Exit1, **4 assertion failures + 1 fixture identity setup failure**, 37 skipped; 21:46:21.081718–21:47:01.014173 | 7189 / `69008d68da60bf6746fe19bcaa578730c41b6051285456cbf47f4b892f76f78d` |
| 83 | Exit1, corrected profile binding then genuine P1 assertion failure: zero visible old keys instead of five; 41 skipped; 21:47:15.484912–21:47:24.661394 | 1674 / `1f970dc971f461a5133e49f909d27fa5acce076b695b0bde762bced003893a7c` |
| 84 | Exit0, **5 PASS / 37 skipped**, not 42 PASS; 21:48:17.566295–21:48:59.143127 | 444 / `fd78acb9fb9983dc17e6d927ed3b32f49539608d35142efd580b6bcce5c9c2eb` |

Command-receipt SHAs respectively `69c69b7c638c7ebb9196bf46a3b30541ef4dde8e747a0abdde21221080b524ad`, `912c1b5c1d55722c6d87f47c6885ba4b7389a4e6eb1ab7c6e9f175d370a694ef`, `e0130676c92d83ecabc0efb7aa6dbe4aa56323659dbd58d82b7e88d49da1bf73`. Actual gzip 2180/733/321 B, SHAs `d1395ce00aa3adcf3300a755535f1db45f4a18feac14c6f3f54ca966a6b0b41b`, `60cb07d3a3041c8ed65d193eb5c9cac7cb9e0820fd0cf94790c2f3560d479e0a`, `eb7cd038df6c043b9f3345e8282f47f715ebf9f5e1e239c15378c3821cab8f45`.

Fixture `tests/unit/hvp-bootstrap.test.ts:232–297` uses real `ThreeRenderBackend`/receiver dispatch with a fake GPU renderer and injected rejected commands. Native replies are controlled port stubs. This proves receiver and Host sequencing; it is not actual Rapier membership/material/payment/browser evidence.

## Concrete closure and remaining fault

- **C1 hidden staging:** `hvpBootstrap.ts:2235` retains the staged scene in `carrierScene` when Remove rejects and throws explicit RecoveryHold. Drop cannot reach final cost/key retirement after a rejected Remove. Prepare preserves slot/capture costs on that error; `cargoHandling.ts:119` enters RecoveryHold even though prepare never returned. Test84 checks explicit hold, Native rollback call and an actually resident receiver artifact; scene/cost retention is additionally source-verified.
- **P1 consuming deposited carrier:** `publishNative:2250–2252` saves old scene, published flag, active keys and registration before hiding it. After successful Native rollback, `rollbackProjection:2259–2261` restores that exact projection state before refresh. The real receiver test proves the same five old keys are visible again after one rejected held publication.
- **C2 capture admission:** `prepare:2277–2283` admits a separate transaction-key cost `materialBinding.length*2 + collisionBytes*2 + (colliderCount+bodyCount)*2048` before calling Native prepare for pickup/deposit/release. Mesh cost remains separate. Finalize/rollback releases capture cost after awaited Native success; unknown RecoveryHold retains it. Actual three tests prove cap rejection prevents the Native prepare spy call. This is a conservative allowance, not measured heap usage or a cap-exceedance benchmark.

**R1 / still open, release Remove rejection:** `publish:2286` calls Native publish, deletes the carrier scene registration, then calls `dropFactoryScene`, whose failed Remove still throws a plain “Factory retire…” error. In `cargoHandling.ts:116`, `published=true` and `Finalizing` are set only after publish returns. Thus this error follows ordinary rollback (`:119–121`). Adapter rollback (`hvpBootstrap.ts:2287`) restores Native state but restores no release projection; it deletes capture cost and clears operation. A successful material rollback can report Ready despite unproven/partially retired render state. This is a source counterexample, **not an executed failure**. Preserve RecoveryHold for this retirement failure, or prove restoration of all old projection state. Test84's release case checks budget only. Reported directly to Root and Integrator; no new write/CPU grant made by reviewer.

## Source time binding and limits

Read start 21:50:37.817346 UTC, final hashes recorded below. Stable throughout their first-to-final reads: Bootstrap 173268 B / `c71708333598dc9536ca834370e35cfccff7c50ca184baa2d739a855852090c4`; Handling (first read 21:51:13.882512) 13892 B / `b5c4e663c2c0796d65b86e2af9c2bc4d403a710fd37d180f9403be10cb293018`; BuildStep 6540 B / `26d8e5feeeff9f2ee02c85b9fa4f9ac4e4e12b1664b06ba87184fbc1cd3b1e95`.

The test file also drifted after its first read: 80131 B / `d2350ffb8ef807184502ee9e6ada2ea4c332348900fc7dc4cf287780f9cb0af1` → 81202 B / `8c6f292fde6d6fea53c79970ff1c3ae96bc7c5ddcc0ccffe5ed3ce296a5b2aa8`. No claim that 84 tested newly added cases. Native file legitimately drifted during authorized production work: start 46164 B / `53a8b0be69c90069fd6538d5ec2da152ec44e78670d38e8e185e5bc171989194`; end is recorded below. No Native current seal or whole-file quality verdict inferred. Existing member capture stores maps/canonical primitive state and shape references; it does not re-encode full terrain geometry. Actual normal UI/visual/full gameplay, final manifest/Git and Owner Art acceptance remain outside this review.

End read UTC: 2026-10-11T21:53:50.260105+00:00

```json
{
  "apps/weltraum-browser/src/hvp/hvpBootstrap.ts": {
    "bytes": 173268,
    "sha256": "c71708333598dc9536ca834370e35cfccff7c50ca184baa2d739a855852090c4"
  },
  "apps/weltraum-browser/src/factory/session/cargoHandling.ts": {
    "bytes": 13892,
    "sha256": "b5c4e663c2c0796d65b86e2af9c2bc4d403a710fd37d180f9403be10cb293018"
  },
  "apps/weltraum-browser/src/factory/construction/buildStep.ts": {
    "bytes": 6540,
    "sha256": "26d8e5feeeff9f2ee02c85b9fa4f9ac4e4e12b1664b06ba87184fbc1cd3b1e95"
  },
  "apps/weltraum-browser/tests/unit/hvp-bootstrap.test.ts": {
    "bytes": 81202,
    "sha256": "8c6f292fde6d6fea53c79970ff1c3ae96bc7c5ddcc0ccffe5ed3ce296a5b2aa8"
  },
  "apps/weltraum-browser/src/hestia-prototype/physics/factoryFacilitySession.ts": {
    "bytes": 50050,
    "sha256": "6af0c75b0d039292a95d0c2bebbc36294f5a7a078bbb980b8aafa16c562f0127"
  }
}
```
