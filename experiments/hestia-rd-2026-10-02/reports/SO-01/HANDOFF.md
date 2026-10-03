# SO-01 handoff: references, canonical fixtures and functional runner

As of 2026-10-03, **RD01 and RD02 are accepted; RD03 is accepted as a functional optimized runner only**. The completed independent static reviews have no remaining confirmed findings. This fulfills the input/control-runner handoff in the [original SO-01 card](../../docs/coordination/input-package/orchestrators/SO-01.md), not renderer selection, art, performance or product acceptance. **ProductIntegrated=false; budget is not proven.**

Report input: HEAD `510faffbb8c78d40933c8a8987c816e0cdf805c0`, tree `7bc05ba187dc1539edec0a30a031d86990a8b448`. Immutable product read base: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`, tree `cdf8a92b17eecd764bac4588054167bd566485f1`. RD00 was accepted earlier; no new RD00 or product execution is claimed here.

## Source and acceptance bindings

| Package | Original source candidate | Accepted repair / final candidate | HEAD integration | Accepted tree |
| --- | --- | --- | --- | --- |
| RD01 | `3298565993c01ad0c27d101674f25b1b581791b2` | `af86949eb098709e9de1ab3a3ef5ce1ffb38b5fb` | Code `1ea898d1f95c7dbb28768712c755007910b9c728`; repair `3c010043704fe1503821dc3b9b1241f172ee44ad` | `59f77b16915d522100ec3482ed9eed7f9093c87c` |
| RD02 | `e6d41867f0fd3257428132c6463ff7d1f80f91af` | `48cb977560ae195157266c168ee08d63dae07a72` | Code `37cc3a476591cbb55334b3a0fbecbf0c40aa6fb6`; repair `89b55315fa7800a7a417c49e5e5a272f17410b4b` | `cec8bddf28b3b4f7aafc716d64e20d3e9e0a0681` |
| RD03 phase 1 | `0857c4ce1232c66d7e7b4f4dbad20f6249d2e677` | Receipt child `e4f52161e75400f10c9bc3cf0d95f455219fba2a`; capture repair `1edbcdc9f9ef54ba49997b4326bf6b6ed587e5ec` | Code `28fafcccdec7e77e61e6f1a69dac415cc50ef32f`; receipt `40f72eb44c9dff912be4d311f31b959b7f35f348`; repair `1cd8205bb5977e5029ee363ccc0b1ec96aef2c7a` | `93e1218a3bec6849b278c968038304f41d3fb925` |
| RD03 phase 2 | START `32a0a6b12361c62a60aa31dc7bd24694f352d16c` | `2fe3aa5e6a8a99173958d6eed63aadeab230b999` | `510faffbb8c78d40933c8a8987c816e0cdf805c0` | `7bc05ba187dc1539edec0a30a031d86990a8b448` |

Original task STARTs: RD01 `89b55315fa7800a7a417c49e5e5a272f17410b4b`; RD02 `63e52eea0f2afbde03ab83b8d66f62941097b314`; RD03 phase 1 `16faf55a9782fb12d2f30df4547a619957792089`. Source/integration trees match as recorded by HEAD. Earlier handoffs and pending statuses remain creation-time evidence; the latest `acceptedRD03` record and RD03 integration receipt define current acceptance.

| Current input / immutable evidence | SHA256 |
| --- | --- |
| [Catalog index](../../reference-cards/index.json), 46,512 bytes | `b7804d1a80aa4b23d9ad7ced016a51d78c571a88b23ce93488d09edd8ef281a1` |
| [Current fixture inventory](../../fixtures/inventory.json) | `26bf86bba1cbd1955d069ab2eac8d491b6cade59d16a004f1d094cc117ebc9c6` |
| [Current lock](../../package-lock.json) | `9dc112529df87daa8a3d92a913932d2b0bad131055d8d684d86736bd4409b60c` |
| [HEAD immutable freeze 510](file:///C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/freezes/510faffbb8c78d40933c8a8987c816e0cdf805c0.json), actual 18 shared-file bindings | `8aaf23133af4b3c5e4e63dd24508f5e78068179ac0e5cc1ba2f25499fc19e619` |
| [RD01 producer repair receipt](file:///C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-01/repair-receipt-32985659.json) | `250e13beb0ed9dd064f1279cdc88619bb161cdb8ffb4793cbc14055686e2e657` |
| [RD01 fresh HEAD verification](file:///C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/rd01-head-repair-verification-af86949e.json) | `e051a6592bc8601115ce25fe1e3cfd4d58a1395da12c03b28f060e6992217408` |
| [RD01 independent static review](file:///C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/reviews/SO-01-af86949e-static.md) | `53c6458ab78455c52e12e437dba2b6f2d371d561d1256e3e266fc3c93c1bac8a` |
| [RD02 producer repair receipt](file:///C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/repair-dangling-v1/repair-receipt.json) | `082ec0511b0e494a9fb91f4541d47a7e7372900a0c69d5e8528d33830f7ed34f` |
| [RD02 fresh HEAD verification](file:///C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/rd02-head-verification-48cb9775.json) | `1e3efc52d459a6519913b17bfb2ca24b9046c9d097e7763dd6095ec3a532d744` |
| [RD02 independent repair static review](file:///C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/reviews/SO-01-48cb9775-static.md) | `12b3b6552b72d94276b1e9310041a72b3924045b82b4c4851350dd48edc2f113` |
| [RD03 producer phase-two terminal receipt](file:///C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-03/checks/phase2-20261003-a/TERMINAL-RECEIPT.json) | `8427a7cec21e07504e7faafcb7214d5cca83371ade16dd9f7cdfad0c2f4698a1` |
| [RD03 producer phase-two evidence index](file:///C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-03/checks/phase2-20261003-a/evidence-index-phase2.json) | `126f7359ebfbf88e9352da5ddbab2d48a6bc9e1b4649f4e17964dc0a7b3899be` |
| [RD03 fresh HEAD verification](file:///C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/rd03-phase2-head-2fe3aa5e.json) | `c86418be99e305be09ad3fb176f0fa60b59bd059a9c7750a864e32e992c1d89e` |
| [RD03 independent phase-two static review](file:///C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/reviews/SO-01-2fe3aa5e-phase2-static.md) | `4904b44d297df221b585452a65cab50d95aac1ab55b214923462f20cba8f9932` |
| [RD03 acceptance / integration receipt](file:///C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/RD03-INTEGRATION.json) | `b7685130bf14c331319aa7a85f1ea1ae1ae2173574094a90d9c46f4a51cd43d0` |

The RD02 repair inventory `cc802f0d9044f7d7ee3c3a251870c6ae2fce926ad5785fc0bb82ab93be54723f` is historical, not the current loader digest. HEAD's explicit current-freeze exporter adaptation/rebinding changed only generator annotations and inventory recipe hashes; the **412 canonical manifest/payload/scenario files remain unchanged**. Old receipts were not rewritten. Current reproduction must select the actual accepted input freeze; retained RD02 leaf48 reproduction still uses its original START63.

## Package results and execution ownership

| Package | Accepted functional evidence, executed by HEAD | SO-01 evidence / limits |
| --- | --- | --- |
| RD01 | Retained case-variant counterexample GREEN; 5/5 unit tests; lab and focused types; source/byte audit; normal/reverse/current 46,512-byte catalog equality; lab build and scoped boundary. | Independent original/repair static review, actual source/receipt/Git bindings; known P1 fixed, no additional finding. File-symlink probes remain EPERM/NOT_RUN; actual native junction cases passed. Browser NOT APPLICABLE for this data-only slice. |
| RD02 | Original dangling-junction counterexample GREEN; 10/10 tests; both typechecks; actual native normal/reverse exports; 429 fixture-file byte comparisons, 412 unchanged canonical files, native source bindings; build and scoped guard. HEAD separately accepted the current-freeze continuation before RD03. | Independent original/repair static review, including prior 445 candidate-byte and 15 b3 source bindings, independent face oracle, unknown/air coverage, material slots, owners/support, revisions/removal/rotation/reload and roundtrip logic. Native regeneration/tests were not reviewer executions. |
| RD03 | Fresh optimized 5/5 browser tests, 31 F00/F01/F04/F05 replay states, 20 mount/dispose cycles, 13 CPU tests, types/build; 429 public-byte checks; five candidate Git bindings and 135 producer-index byte bindings; all 18 shared bindings; integrated guard. | Independent phase-one/capture-repair/phase-two static reviews. Phase two: five delta files, scenario/frame/payload/owner bindings, image hashes/headers, fault/status evidence and actual parent wiring; zero confirmed findings. CPU owner-root assertions are real Three projections; browser snapshots are not direct scene-object inspection. |

SO-01 did **not** execute tests, exporter/CLI, installs, builds, browser, GPU or art checks during those static reviews or this report handoff. HEAD/producer execution evidence is cited, not relabeled as reviewer execution. No new full review or implementation was performed for this report.

### RD01: usable catalog, unavailable media

All seven RR-01..RR-07 slots are real source-bound reference cards. The leaf's seven original-permalink HTTP200 responses on 2026-10-02 were **JS_CHALLENGE**, not readable posts. Current author text is UNAVAILABLE, authors/licenses UNKNOWN, developer sources NOT_DISCOVERABLE, media **NOT_VIEWED**, and `observedIntervals=[]`; no challenge bypass or replacement URLs. Historical title/FPS/hardware claims stay explicitly as-reported, not current observations or measured lab performance.

At b3, six `target-01..06` concept basenames are missing and five `hvp13-candidate05` PNG blobs are 131/132-byte **LFS pointers**, not image payloads. No LFS payload retrieval or art comparison occurred. See [source audit](../RD-01/source-audit.json), [current access evidence](../RD-01/sources-current.json), [concept bindings](../../reference-cards/concepts.json) and the [five bounded visual questions](../RD-01/OPEN-VISUAL-QUESTIONS.md). These missing-media gates do not block synthetic control fixtures.

### RD02: canonical inputs, not native gameplay replay

F00 CONTROL and F02 ROOT-GROVE / F03 SHELTER / F04 DETACH / F05 CUTOUT / F06 MATERIAL / F07 SCALE are declared **synthetic**. F01 HVP-COAST is **product-derived at b3**: actual native source/material/vegetation bindings, a bounded 0.125 m crop, unknown coverage outside it, no analytic ghost/join or invented native mutation. Sixteen snapshots and eight scenarios are indexed; detach, rotation, removal/reload and openings are presentation-replay snapshots, not runtime Cut/World commands.

| Unchanged canonical binding | SHA256 |
| --- | --- |
| [F00 manifest](../../fixtures/F00-CONTROL/manifest.json) | `378513d00d5f2a11f569ff0748d4e42ac1832674104febd052070f0fd258b81d` |
| [F00 scenario](../../fixtures/F00-CONTROL/scenario.json) | `24de3e02b3c7d2cf38f0f1dbf0b5f82a5107bc2507118726b5c081b3d05bf878` |
| [F01 manifest](../../fixtures/F01-HVP-COAST/manifest.json) | `688fda7d61d4d4a68a9917841ba8b7cb2722e04ddd6c4d9ce53039314d0b5b08` |
| [F01 scenario](../../fixtures/F01-HVP-COAST/scenario.json) | `e41d4965131f17ad47ec7a7ce6db4a841d60a550abb86cd51206fa973c500bd9` |

Load static bytes through `importFixture`, then `importScenario` with the digest-to-imported-fixture map; use `copyFixturePayload` for private projections. Never import the exporter into the browser. `sampleScenario` selects the fixture/frame; await replacement before `setFrame`. `resetTick` invalidates projection caches, not source truth; backward seek selects earlier snapshots. F05's exact canonical Float64 1.8 m positions remain unchanged, with a separate Float32 GPU projection and predeclared `1e-5` m tolerance.

### RD03: actual Three host and material seams

Actual [`threeHost.ts`](../../src/runner/threeHost.ts) imports `WebGLRenderer`, `Scene`, `PerspectiveCamera`, lights, fog and tone mapping from `three`. [`three-control/index.ts`](../../src/experiments/three-control/index.ts) imports real `BufferGeometry`, `BufferAttribute`, `Group`, `Mesh` and `MeshLambertMaterial`; these are not placeholder or mocked runtime renders. `createThreeControlExperiment` uses `createThreeLabHost` with `mountThreeEffect`. Effects borrow the host's current `fixture`, `frame`, `resetTick`, `signal`, capabilities and `ownerPose(ownerId)` through an owned detached root: **one renderer/scene/camera/canvas/loop**, no competing engine or loop.

Materials consume canonical submesh/material IDs, owner transforms and linear-sRGB vertex colors/AO. F01's bound readable-coast-v6 lighting/fog, sRGB output and ACES exposure 1.05 are projected; this is not full native-look parity. PCF shadows, native sky/water shaders and material shader hooks are explicitly unsupported. No speculative wetness/occlusion API, shader-plugin chain, Rapier import/init or physics authority was added; type transitives do not authorize them.

HEAD's final shared wiring is exactly **three paths**: [`package.json`](../../package.json) CLI aliases, [`src/registration.ts`](../../src/registration.ts) actual RD03 factory registration, and [`vite.config.ts`](../../vite.config.ts) native Vite 8 `build.rolldownOptions.input` dual HTML entries. Standalone optimized URL: `/src/runner/index.html`; public inputs: `/inventory.json` and root `/Fxx-…/…` because `publicDir='fixtures'`. No `/rd03` alias or `/fixtures/` URL prefix. The root page remains the separate RD00 Canvas2D diagnostic. **No remaining RD03 HEAD wiring delta.**

Functional profile: optimized headless WebGL2, 1280x720 drawing buffer, DPR 1; 1248x703 enclosing element captures. HEAD's 32 positive browser captures bind 31 replay states plus RUN03; producer evidence additionally contains six positive CLI captures. SO-01 checked recorded hashes/headers/state, not viewed reference media or human art. The 20 cycles release reported host/loop/listener/geometry/texture/program resources; UI listeners return to their original baseline. Native GPU allocation bytes remain unknown, not zero.

Producer CLI fault evidence stays separate: native context loss is expected FAILED (2 attempted / 1 failed), with a retained fault image and generic 15 s timeout, not positive evidence or a dedicated loss-reason claim. Abort probes use `process.emit('SIGINT')`, not OS Ctrl-C. Bench is honestly NOT_RUN (120 planned / 120 skipped); timer availability and the retained 549.55 kB chunk warning do not prove timing, memory, quality or budget.

## Known corrections and retained scope limits

- RD02's `existsSync`-before-`lstat` dangling-junction P1 was repaired at the shared output boundary with permanent FX10; old RED and original receipt remain intact.
- RD01's case-variant linked output P1 was repaired with unconditional native `lstat` admission and REF05; no follow-write exploit or atomic TOCTOU hardening is claimed.
- HEAD fixed shared linked/dangling run-root admission before RD03; capture repair rejects existing screenshot destinations (including empty directories), links/reparse points and foreign paths. Only new owned paths are admitted; reused-image callback count is zero.
- Phase-two screenshot assertions now follow pinned Playwright 1.61.1 document-edge enclosing rounding (702 CSS height yields 703 PNG pixels). Genuine RED/GREEN and test-typing failures were retained; resolution and projection tolerance were not lowered.

The historical RD03 broad-unit **artifact-scope FAIL remains FAIL**: ten additive oracle directories crossed RD00/RD01/RD02 run roots. HEAD's bounded metadata/retention disposition is **safe retention**, not retroactive PASS, exhaustive historical mutation-freedom proof or permission to delete foreign data. The phase-two [handoff](../RD-03/PHASE2-HANDOFF-20261003-A.md) and existing external index/receipts preserve that exception and selected old-byte/ledger proofs; this report does not expand them into an exhaustive audit.

Only two automatic untracked root throughput logs are accepted as `FAIL_ACCEPTED_NARROW_EXCEPTION`, not an all-files clean PASS. They are not authored, ignored, copied, staged, committed or published by SO-01. Original inputs, contracts, source b3, shared configuration, .devtoolbox, global tools/plugins and foreign work remain untouched by this report.

## Next owner and remaining gates

HEAD has finished/soft-archived the implementation leaves with branches, worktrees and evidence retained; actual starts were HEAD-owned, not invented SO-01 children. HEAD's owned preview `bg_mus63fi7_3v` was stopped and its fresh 5280 port guard passed, per acceptance receipt; SO-01 did not execute cleanup or a new live port check.

1. **HEAD:** review/integrate only this report, then supply the next actual START/freeze, workspace, task-owned run root and writer/heavy/GPU leases as applicable. Freeze510 is the current accepted input snapshot, not an invented future START or new lease. No shared-code change is requested by SO-01.
2. **Downstream owners:** capability profiles, renderer/effect experiments and tools remain OPEN. Reuse the actual host/current-owner APIs and canonical catalog/fixtures; fail explicitly on unavailable capabilities and keep unsupported parity visible. RD14 owns solids/water, RD21/22 decor, RD31/33 particles; RD15/RD32 channels require RD14's concrete owner contract and HEAD's narrow freeze, not a speculative shared abstraction.
3. **RD40:** import the catalog as static Vite data (`../../../reference-cards/index.json?raw` from a matching nested module), never the Node CLI; keep UNAVAILABLE/NOT_VIEWED/NOT_RUN visible. Corresponding renderer/effect owners select the next bounded fixture experiment, not this report.

**NOT_RUN:** qualified measurement profile, empty/active overhead comparison, GPU timing/native GPU bytes, target-device/performance/budget qualification, human art/reference-media acceptance and product integration. **NOT APPLICABLE:** deployment, publication, schema/data changes or another runtime implementation in this report task. No resource/GPU lease, install/build/browser/test execution, new session, delegation, deletion or copied evidence is granted or performed here.

## Report-only closeout

Report-only checks **PASS**: 30 existing links, 19 actual SHA256 bindings, 25 full Git objects, four repair/final source-to-integration tree pairs and 18 unchanged shared-file bindings; scoped whitespace and Git diff self-review. Pinned C-Node `./scripts/verify-boundary.mjs --task SO-01 --start 510faffbb8c78d40933c8a8987c816e0cdf805c0 --base b3c6523a94cd050f5a9a22dc27f4777fcc03363e` passed (exit 0, 52 original input hashes, no violations), with the two automatic-log exception retained. Only this Markdown is authorized. Final report commit SHA/tree and post-commit checks belong in the terminal handoff, avoiding a circular self-commit claim. Runtime tests/build/browser/GPU are NOT_RUN for this documentation-only task; no cleanup is needed.
