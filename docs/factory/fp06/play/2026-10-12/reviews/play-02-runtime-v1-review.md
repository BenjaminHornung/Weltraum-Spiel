# PLAY-02 runtime V1: independent bounded source review

Reviewer `/root/play_art_review`. **Verdict: CHANGES REQUIRED / P1.** The frozen version rejects valid hidden B06/B07/B09 stages because it reads the published physics snapshot instead of the private PrepareHeld receipt. The existing regression/typecheck/build receipts are genuine, but do not close that integration defect or establish installed-model/W09/S1 in-game acceptance.

This was read-only source and existing-evidence inspection. No implementation, tests, typecheck, build, browser, capture, profiler, broad Native/cost run or delegation was performed. Only this report is written. Later V5/Power work and the subsequent fix are outside this review.

## Immutable review basis

All source lines below refer to `/workspace/.cloud-setup/fp06-play-2026-10-12/PLAY-02/runtime-source-review-v1/root-frozen/`, not the moving Integrator worktree. `root-frozen-bindings.json` SHA256 is `5322edb5f14f75bc22eb16a1f163ca0d1d423698729d1ff114150e38b863c1cf`; freeze time `2026-10-12T14:00:36.388387+00:00`, observed HEAD `f85d1379c3458488d225105156adfb66837799ce`. All ten sizes/hashes were checked before and after source review and remain unchanged. The original measured manifest's eight entries match the first eight frozen files.

| Path under `apps/weltraum-browser/` | Bytes | Frozen SHA256 |
| --- | ---: | --- |
| `src/hvp/hvpBootstrap.ts` | 191297 | `723f266458245735bd4283f91a6bf6c8d45cb9276dc0c44321b3cbeead74890e` |
| `tests/unit/hvp-bootstrap.test.ts` | 100474 | `e6288fe4ce5f6f5375ad2fa314e07cf6adcd7b87be319aeea3167f29a7780c7b` |
| `src/factory/session/factorySession.ts` | 70289 | `4b6b461f3c514c6bf3d35e5b117f6ce2e6ba6c28385eab551cd1b4df36169400` |
| `src/hestia-prototype/physics/factoryFacilitySession.ts` | 62998 | `704ea0aa636cb20babe83309dcc5f5592bf97a6dfaa5a4d2b40a70d710e6697b` |
| `tests/unit/factory/facilitySession.test.ts` | 53598 | `50b7bf46b50816744246c95ab2bf68def7449c51c860c3394fc3af16d351f589` |
| `tests/unit/factory/hostLifecycle.test.ts` | 70328 | `ce9b9bef3389988995a3c2c609fa7172fd0cb932cb4d17cbbe28dd959d429448` |
| `src/factory/presentation/factoryAssets.ts` | 16222 | `8b027d2a9eb30cdc65a30fd7fd7792dfd6ddb6c2a06233f89f75e1b78b42be8f` |
| `src/factory/session/hostPort.ts` | 12091 | `6bb753d7bb8b30523df034b4aa7c51de5650c5081d644d9881691eab7b38ead9` |
| `tests/unit/factory/presentation.test.ts` — ancillary | 17307 | `3b5be6ab3edb7d66b4ffd5cc619cb4eb76ec65d3e823bce971b3a8655f7d021b` |
| `src/factory/factoryEntry.ts` — ancillary | 17326 | `7db2d8a3ea36066a355fccbb1dc28cf203874ebc70af0aa2900b75dc7734f4ac` |

The narrowly needed Client reference was separately checked at 41,700 bytes / SHA `fd5ca0b6edc34275bf40684ac407c7e79335d441a32f8c281935c55bc2ede901`, matching the original receipts. Historical Native 69a and pure-controller 572c reviews remain historical prerequisites; they do not accept this runtime version.

## P1: the hidden-stage proof is read from the wrong snapshot

In frozen `hvpBootstrap.ts:2415`, `prepareNative` receives the actual return value of `physics.prepareFactoryFacility(request)`. It returns that receipt but stores only `{request,...loaded}` in `factoryStages`. Frozen `stageProjection` at lines **2424–2425** then obtains `preparedPartObservation` from `physics.read().factoryFacilities`.

The bound Client at `src/hestia-prototype/physics/client.ts:302–308` sends Prepare with public adoption disabled, obtains `readHeldSnapshot().value.factoryFacilities`, verifies the private transaction/PreparedHeld/instance/definition receipt and returns it. `read()` at line 246 intentionally returns the published snapshot. Keeping the candidate private is an authority/barrier requirement, not a missing native geometry proof.

**Minimum failing condition:** a valid current B06, B07 or B09 request returns a confirmed, complete private PrepareHeld receipt while the published snapshot correctly has no `preparedPartObservation`. `stageProjection` reads undefined and throws **“Factory hidden Native geometry unconfirmed.”** Thus a valid paid build cannot proceed to its hidden GLB stage/publication. The same wrong location affects all three checked definitions. It fails closed and should preserve rollback/material safety; it still blocks the prototype's required installed-model path.

The minimal correction is to retain the validated private PrepareHeld receipt in the owning transaction stage and validate its candidate observation against that exact request/plan, including current transaction, instance, definition/source/profile and private candidate status. Do not expose or promote the held snapshot through public `physics.read()` merely to satisfy the stage. A meaningful regression must keep the published snapshot unchanged while returning the genuine private proof; stale/foreign/incomplete private proofs must remain rejected. Root has already assigned that narrow test-first fix to the Integrator. No later fix or new receipt is accepted by this V1 report.

## Other bounded source findings

**S1 paid-domain/native/part/root join: present in source, execution still blocked by the P1.** Entry line 134 exposes `session.readPresentation` through the private Host handle. Session lines 446–467 derive machine data from actual adopted `domain.machines`, `job.start.jobId`, job recipe and committed `workMilliJoule / process.powerWatts`; menu recipe selection does not become paid work. Header/session/epoch/native tick, logical installation and current Native owner confirmation are joined. Hold retains the committed work number while dropping confirmation; it does not grant catch-up work.

Bootstrap lines 2366–2399 capture the actual synchronous physics object and matching private Host/domain read without an await, pass its raw current observation to the reviewed pure helper, and apply current Native presence/semantic-parent filtering. A same-job safe pose can preserve a last safe visual state on Hold; a missing part/parent remains filtered. Binding exceptions suppress poses and record modelError. `factoryAssets.ts:40–52` rotates the local part offset exactly once with the current owner's quarter-turn and adds the Native root in meters; it does not add a box/bounds center again. The actual loaded GLB part artifacts are re-framed for the existing Host frame and use unit scale. These are positive bounded source checks, not proof of actual paid RUNNING/WAIT/removal animation in a browser.

**B09 readonly solid ports and paid connection admission: bounded source/evidence checks pass.** `factoryAssets.ts:72` supplies the two existing logical storage port frames. Native `factoryFacilitySession.ts:221–238` derives positions/normals from the actual owner, checks the catalog's axis mapping and current geometry/support/service/sweep proof, then computes distance/LOS accessibility. Proof caches at lines 349–357 belong to one synchronous read, so later same-revision member/coverage/ground/LOS changes are observed. B09 deliberately has no production job row.

Session `nativeSolidEndpoint` at lines 166–180 requires the actually paid logical installation, current physical owner/pose, published complete part observation, source/profile/definition/installation/revision/digest and exact catalog port frame. Both offered links and submitted connect-belt commands use that endpoint. Lines 361–369 retain the exact opposing 4-m route and verify the paid original source lots before construction adoption. The frozen Native tests at lines 487–505 use actual Rapier membership/coverage/ground/LOS changes; Host tests at lines 120–131 use declared transport fixtures and verify wrong frame/stale owner/part proofs reject before material changes. No new port/BOM/material authority or successful physical belt route is inferred from these checks.

**Cargo/Carrier GLB load and lifetime: safety mechanisms are present, with bounded verification limits.** Cargo imports both explicit visual variants under pre-import reservations, binds Native owner/container/bounds, and derives ground origin from current bounds (`factoryAssets.ts:57–61`; Bootstrap 2298–2311). Carrier chooses the closed profile-sized visual asset, verifies profile digest/mass, keeps the Native ground-root/yaw convention and updates from current Native position (2313–2336). Installed models are definition-bound and abort/current-lifetime checked after async imports (2341–2347). Those routines create visuals, not quantities, colliders or ownership.

Managed keys are hidden before Upsert; publication, consumed-depot restoration and final retirement follow the existing transaction stages. `dropFactoryScene` at lines 2266–2272 removes each artifact with exact revisions/content hash, releases its lease only after accepted removal, records retired keys, and retains the unproven remainder under RecoveryHold on failure. Carrier release/finalize/rollback at 2418–2432 and 2452–2460 do not claim a successful ordinary rollback after a published retirement fails. The targeted tests explicitly leave receiver-resident remnants during the fault and clean them through later teardown; they are not evidence that faulted renderer state is already fully retired or visually pristine.

**Load/mesh/capture peak accounting: source checks are conservative, hardware/performance not accepted.** Bootstrap lines 2247–2257 reserve the closed GLB file/vertex/index/range census, parsing/copy overhead and module-retained cell definitions. Lines 2349–2364 charge an upper-bound exposed-cell-face meshing peak before S1 loading/staging; 2412–2416 include actual loaded products and Native capture cost. Carrier pickup/deposit/release reserve request/Native collision/member capture costs before allocations (2446–2454). Existing caps are used; no increase or skipped collider/movement guard was found in this scope. These are source formulas and selected budget-admission assertions, not a measured aggregate GPU/target-hardware result or a broad independent cost audit.

No additional independently demonstrated P1/P2 product defect was found in the remaining bounded paths. This does not expand acceptance beyond the reviewed source and available tests.

## Existing raw receipts and limits

Original run directory: `apps/weltraum-browser/evidence/factory/play/2026-10-12/PLAY-02/20261012T133800Z-installed-models/` in the Integrator worktree. The following raw gzip payloads were independently decompressed and checked against receipt SHA/argv/timing/exit fields:

| Record | Existing result | Raw SHA256 |
| --- | --- | --- |
| 01 carrier “business-red” | Exit 1, **infrastructure failure**: unknown `--minWorkers`; no business RED credit | `d0013ecd49284fd3b707c4316a9c664d4c1f4ec7ff4d558d47449e49b233ce42` |
| 02 carrier business RED | Exit 1; one genuine assertion failure, one pass, 46 skipped | `99404575d04ac36d609c6da7b37458697e1e0531d6830b0d553a65bbe45d4a15` |
| 03 targeted carrier GREEN | Six passes, 42 skipped; actual receiver/retirement and capture-budget fixture cases | `f983dc4025427c8b7a15b2433c46acd88ae23176425a6dcf97df557ef63ad662` |
| 05 Native/Host/presentation/S1 | 167 passes across four files; UTC 13:55:23.179868–13:56:36.081028, exit 0 | `50d6566be4ec5bff5041930850628b643b018332daee6667bc3d9593f00694ed` |
| 06 typecheck | `node node_modules/typescript/bin/tsc -p tsconfig.json`; 13:57:08.263980–13:57:10.956280, exit 0, empty log | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 07 original build | `npm run build`; 13:57:11.126577–13:57:16.281671, exit 0 | `e2f42636a7567b70f6f680a52b4c9c2e91f90a41ece90ba5d7a5362055a1b680` |
| 08 original normal model route | Exit 1; actual route stops at a 5-second wait timeout | `81d82710563ff2923acf0bd733a28b008b6ffa2f990eb4fecdf1686c7e4c9f20` |

Records 05/06/07 bind **all ten frozen files** exactly. Record 03's Bootstrap hash differs from this final frozen Bootstrap, although its test and other inspected path hashes match. Therefore its six passes are predecessor evidence, not a test execution of the complete frozen Bootstrap. The 167-test argv lists facilitySession, hostLifecycle, presentation and factoryS1Assets; it does **not** include hvp-bootstrap.test. Typecheck/build prove compilation of the final frozen version, not correctness of its private PrepareHeld lookup.

Native facility tests contain real Rapier negative observations; Host transport and Bootstrap receiver cases contain explicitly declared fixtures; pure S1 cases use synthetic current Native/domain records beside real pinned GLB/cell data. These evidence classes are not interchangeable with normal in-game acceptance. The original model route's FAIL is retained; no full Model/W09 pass or recording-causality conclusion follows. Root separately reported a later no-recording transport/depot/player-exit success followed by the exact B07 hidden-stage error; this report confirms its source failure condition but does not promote that later failed route to acceptance.

**Handoff:** frozen runtime V1 requires the private PrepareHeld fix and separately bound closure before hidden-stage acceptance. Subsequent V5/Power changes need their own evidence. Actual installed-model/root/animation/WAIT/removal, completed factory flow, Save/reload and final human terrain/Art/UI/gameplay/target-hardware decisions remain unaccepted; **OWNER_REVIEW_PENDING** stays in force. No broad World or structural S1 PASS is claimed from 167 unit passes or a successful build.
