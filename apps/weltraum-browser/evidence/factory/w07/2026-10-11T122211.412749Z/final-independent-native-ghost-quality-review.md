# W07 Ghost namespace and resident lifecycle — final scoped review

Reviewer `/root/w00_repo_audit`; independent read-only source, unit, Git, seal and existing recorded-log inspection. No test, build, browser, Native/profile or verifier jobs; no product/evidence writes or commits.

**SPEC_COMPLIANCE: PASS (scoped Ghost followup). CODE_QUALITY: PASS (scoped Ghost followup).** The previous P1 identity collision is closed by the actual receiver counterexample and the disjoint derived Ghost namespace. This receipt does not declare W07 package, normal browser, Native installation or Git-commit admission PASS; those gates remain separate.

## Candidate and byte binding

Base/current integrator HEAD: `d5502ae7fd5431d58eda51bea062c54691ebe3c2`; worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, branch `codex/hestia-fp06-integrator-2026-10-11`. Ninth seal timestamp `2026-10-11T15:55:12.557402+00:00`:

- Full receipt `/workspace/.cloud-setup/fp06-w07-before-ninth-browser-product-files.json`: SHA256 `5f0588a7a969d185424780bd298fc16c45260874311ef9415cc4da49aa580c12`, 8144 bytes.
- Patch `/workspace/.cloud-setup/fp06-w07-before-ninth-browser-product.patch`: SHA256 `d7040eba7f26090783c69372b7ae64f077338de060f0abaaaa2387d510bd9184`, 214847 bytes.
- Exactly 29 granted files; all 29 current SHA256/length pairs match the sealed receipt, including the end reread. Actual 27 changed paths match the declared base-relative change set; two granted files retain baseline bytes. Scoped `git diff --check` returned exit 0.
- Delta from the eighth seal is exactly Bootstrap and its unit; other 27 files, including the normal E2E, remain byte-identical. Bootstrap: `ab5ec227a525684802affde9236ba1484d1842275b04f80024e41aed59bb9f88`, 165644 bytes. Unit: `012bb4f13bbd0d31fb79b5a8e8b00604da3b0674ef0ba2079862faf2966b5b84`, 70821 bytes.

The earlier external report was SHA256 `6da21a74c7d4c8d875b50bf8fe59d27ca4c87e9edb8d8739d39947568ab4db95`, 6999 bytes. Root preserves its historical P1 FAIL at `docs/factory/fp06/reviews/w07-ghost-preliminary-quality-review.md`. That archive normalizes only EOF/trailing whitespace: current copied SHA256 `4b89200784455362b33dd2a2b19055ada0da6424a6b3c906d3d9deab0468153e`; the source-lock records both original and copied hashes and the normalization rule. This final report replaces only the authorized external report path.

## P1 closure and contract quality

`apps/weltraum-browser/src/hvp/hvpBootstrap.ts:2188` now derives six closed definition slots as `ghost:slot_0` through `ghost:slot_5`. The native/resource ID grammar at `src/factory/resources/ids.ts:48` rejects colons. Paid `ghost_slot_0` remains a valid, unchanged native instance ID. With `src/factory/presentation/factoryAssets.ts:92`, paid representation keys are `factory:ghost_slot_0:<part>` and Ghost keys are `factory:ghost:slot_0:<part>`; their cost-map IDs, managed keys and active keys are likewise disjoint. Cancelling or rolling back a preview therefore cannot remove a paid scene's resident keys or admission cost through this former alias.

The small namespace correction leaves paid IDs, source/frame revision, native membership, material authority, quantities and admission caps unchanged. Preview does not call native prepare or consume Resources. The actual receiver test proves the formerly rejected legal paid owner can now commit while the Ghost is resident; native prepare receives that original paid ID once, and cancellation retains paid meshes with zero rejected/stale artifacts.

Same-definition pose changes at Bootstrap's resident Ghost branch update only transforms: no Upsert/Remove, lease churn or geometry/material allocation/disposal. The six source slots bound identity storage independently of request IDs. Repreview/switch increments a safe-integer derived artifact revision before staging; it does not change source-local geometry or source revision. Overflow and pose validation occur before retiring the old scene. Accepted partial-stage artifacts are captured, retired and their plain leases released; managed keys and cost are removed on failure. The next attempt uses a higher revision. The now-disjoint namespace closes the shared bookkeeping risk in this cleanup. Teardown covers installed, staged and resident Ghost scenes without changing existing global limits or World authority.

No additional finding remains in this narrow delta. Direct injected partial-stage failure and switch counterexample tests were NOT_RUN by this reviewer; their cleanup assessment is static, not a fabricated unit PASS.

## Actual oracles and evidence provenance

The unit at `tests/unit/hvp-bootstrap.test.ts:543` uses the real `ThreeRenderBackend` receiver/ledger with its WebGL driver stubbed. It verifies same-definition pose, unchanged allocation/disposal counters, bounded repeated slot identities, artifact revisions `[1,2,3,4,5]`, unchanged source revision/content hash, no Native/Open calls during preview, zero stale/rejected artifacts and disposed renderer/zero RAF callbacks.

The added legal paid-owner case at `tests/unit/hvp-bootstrap.test.ts:608` uses that actual receiver and the actual mounted FactorySession/finite Resources fixture. Before commit, preview leaves the authoritative material object unchanged and native prepare count zero. Commit returns `Committed/INSTALLED`, native prepare count is one and the paid ID remains `ghost_slot_0`; paid/Ghost keys are nonempty and disjoint, and Ghost cancellation preserves paid residents. Its Native/Cargo transport and actor pose are explicit fixtures. It does not prove real native installation, LOS/walking or normal browser success, and does not explicitly assert exact post-commit mass. Unchanged domain authority and its existing affected placement guards remain separately bound below.

Evidence root: `apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z`. Existing command metadata, exit receipts, decompressed raw bytes and normalized readable logs were independently read and matched; no commands were rerun.

| Phase | Actual result | Raw SHA256 / bytes |
| --- | --- | --- |
| 63 legal paid-owner collision RED | exit 1, **1 assertion FAIL /35 SKIP**; expected Committed, actual Rejected with `RevisionContentConflict` before namespace fix | `878e0bb6f50785e41f0da4fa9289afde32b910ba582617031219e1d0f55d7a54` / 1678 |
| 64 receiver lifecycle + paid namespace | exit 0, **2 PASS /34 SKIP**, wrapper 18.211612132 s | `6f9178dbdcdc1af0e9cf1bdc8a62ea963e06261cfadd8533138fc3cb6fdd6f69` / 402 |
| 65 affected guards | exit 0, **56 PASS /4 files**, wrapper 5.771231348 s; hostLifecycle, hvp-player-input, placement, facilitySession | `66792fc133e2651ca80a382c5f0eed28b149afa2f33db78e92c7510c2a94e577` / 474 |
| 66 final full build | exit 0, full TypeScript/Vite, wrapper 4.153197671 s | `a387975781c34795dcfdbb9f3b05ec836eb07e57d670fee4f34562fe31b69dd3` / 1904 |

Phase 61's 91 PASS preceded the namespace change and is retained as historical evidence only. There is no fresh final 91-test claim. Ninth normal-browser result, full W07 gate and commit binding are OPEN/NOT_RUN in this receipt.
