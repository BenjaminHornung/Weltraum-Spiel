# W09 R1 Release retirement — narrow independent closure

**Scoped source/retained receiver evidence: PASS; R1 ordinary-Ready/refund counterexample CLOSED for this release path.** This supersedes only R1 in `fp06-w09-receiver-fault-followup-review.md` (SHA256 `f82ef76b32edd6bce59b1c6c18f315f7b3489de7354cdf296847f930219a88dc`). No tests/build/browser/native execution or product/evidence change by reviewer.

## Actual evidence

Integrator WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`. Historical/pre-copy known HEAD: `aeb6680044eb455a10d0bba6e67979c153fd248f`; **actual HEAD during the 22:15–22:16 source review was NOT_OBSERVED**. A subsequent independent read-only `git rev-parse HEAD` at **2026-10-11T22:18:01.369211+00:00** reports **`aa2e5d7c335453fc555a98ccd35e9f564c596e93`**. This later Git measurement does not retroactively measure the review-time HEAD. The three source-byte/time bindings below are unchanged. Ownrun `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z`.

- **87:** `87-real-carrier-release-retirement-red.command.json`, 518 B, SHA256 `732a72075d44d3fa2cbf70084f9dad015de80c7bbf559998de98dc01b0f89362`. Actual 21:53:39.038238–21:53:48.238441 UTC, Exit1, **one assertion failure / 42 skipped**. Expected RecoveryHold; received plain `Factory retire failed: FaultRetire`. Raw 1143 B / `b8239534073ac36d215bfdec44021986c6dfea2287f9cb98dbd31acaf06192ca`; gzip 543 B / `312afc005fb247bb318366c33f9b05a3305b06612302c1a497b80f9fa2fbde2f`.
- **88:** `88-real-carrier-release-retirement-green.command.json`, 517 B, SHA256 `706fdcb9ef5eb1a7ea2c71cc1ac7b9e887d49fb94c3610ad428a56e5f0cfa4e2`. Actual 21:54:44.193820–21:54:53.822543 UTC, Exit0, **one PASS / 42 skipped**. Raw 397 B / `701968d6f0589669471eac01fa9ba8621d1e78f6205b58c17579961ba4406163`; gzip 290 B / `07d00b8ccb24976568bfd22be8e6f3c7946dd0c8a0c4e63037374c8ac696516f`.

Both gzip decompressions are byte-identical to actual retained `.log` originals and command-receipt raw SHA/size. Cwd/argv select the stated Integrator application and the single `W09 release enters RecoveryHold` test. No setup/import failure or 43-test PASS inferred.

## Why the old counterexample is closed

`hvpBootstrap.ts:2286–2287` now catches any failure while removing the published release projection and throws `RecoveryHold: Published carrier retirement unproven`. In unchanged `session/cargoHandling.ts:119`, that marker takes the terminal RecoveryHold branch before ordinary rollback/refund (`:120`) and before Ready (`:117`). Thus the failed-retirement path retains adopted candidate material and does not call Native rollback, material refund or finalize as an automatic recovery guess.

`dropFactoryScene:2203–2204` releases each accepted artifact's material lease in order, but a rejected Remove throws before final managed-key/cost deletion. `carrierScene=undefined` is after complete successful drop, so the scene record survives this fault. The slot cost and transaction capture cost also remain: finalize/rollback cost deletion is not reached. This intentionally preserves an incomplete retirement for RecoveryHold; it does **not** restore or claim all five meshes visible.

The actual new test (`tests/unit/hvp-bootstrap.test.ts:293–299`) permits one real receiver removal and rejects the next. GREEN checks RecoveryHold, **four actually resident remaining keys**, and no Native rollback call. It uses actual `ThreeRenderBackend` dispatch with fake GPU rendering and controlled Native replies. Full material-refund/cost retention is established by the caller/source branches above, not a newly executed integrated Handling/material test.

Normal successful release still completes drop/refresh, then caller enters Finalizing and awaits Native finalize before capture cost release. Unknown post-publication outcomes remain held through the existing caller guard. No additional concrete normal-release defect found in this narrow review.

## Source binding and limitations

Start **2026-10-11 22:15:48.320573 UTC**, end **22:16:29.549425 UTC**; all three actual files unchanged between reads:

| Source | Bytes | SHA256 |
|---|---:|---|
| `src/hvp/hvpBootstrap.ts` | 173383 | `30055d33d9cf2ee877144ebc1e7a39ea30d7dbb78953fba07572992f43585556` |
| `src/factory/session/cargoHandling.ts` | 13892 | `b5c4e663c2c0796d65b86e2af9c2bc4d403a710fd37d180f9403be10cb293018` |
| `tests/unit/hvp-bootstrap.test.ts` | 81202 | `8c6f292fde6d6fea53c79970ff1c3ae96bc7c5ddcc0ccffe5ed3ce296a5b2aa8` |

Working tree remains mutable outside these reads. No whole Native/Production-file seal inspected; the historical command receipts do not alone bind all current WIP bytes. This is receiver/source closure, **not** actual GPU, Native membership, paid normal UI, full W09, manifest/Git/package or human Owner Art acceptance. No new permission/write/CPU admission implied.
