# W07 independent Spec / Quality review — historical pre-second-browser seal

Reviewer: `/root/w00_architecture`. Product writer: `/root/fp06_integrator`, branch `codex/hestia-fp06-integrator-2026-10-11`. This report reviews only the historical snapshot captured at `2026-10-11T13:40:10.530075+00:00`, not the mutable replacement. Parent explicitly lifted the old WRITE HOLD for narrowly authorized frame / identity / disposed-checkpoint fixes during the review. No test, build, browser, profiling job, product modification or agent delegation was performed by this reviewer.

## Verdicts

| Boundary | Verdict | Exact meaning |
|---|---|---|
| Spec, historical bc0986f9 snapshot | FAIL | A normal Ghost / Cargo flow breaks the shared HVP publisher; the real browser never reaches paid construction. The native Cargo identity collision also violates separate owner identity. |
| Quality, historical bc0986f9 snapshot | FAIL | Shared-frame publication and the native owner / disposed lifecycle boundaries need fixes. F04 and F05 are narrower evidence / initialization findings. |
| Independent reviewer runtime execution | NOT_RUN | Read-only review, as granted. |
| Existing second browser evidence | FAIL | Exit 1; 1 PASS, 1 FAIL, 4 NOT_RUN; 34.2 s. This is inspected writer evidence, not a reviewer execution. |
| Replacement snapshot / final W07 gate | PENDING | No replacement seal, fix completion, fresh final regression or final browser PASS is adopted here. |
| Save / W09 loop / renewable-power / performance acceptance | NOT_RUN | Outside this W07 code-review result. Legacy persistence remains deliberately closed. |

## Byte and authorization boundary

Base and observed integrator HEAD: `d5502ae7fd5431d58eda51bea062c54691ebe3c2`. Historical patch: `/workspace/.cloud-setup/fp06-w07-before-second-browser.patch`, **164001 bytes**, SHA256 **`bc0986f9b508751644e6f392073caa8da293919b3d689dd96fe8df50c47909c1`**. Companion `fp06-w07-before-second-browser-files.json` SHA256 `a8e60ebe89686ed491f4d021b55d80fedeef5afb63c90e0727aec91efb675d95`.

Final byte check at `2026-10-11T13:57:48.927476+00:00` reconstructed all 27 sealed product files in memory from BASE plus the historical unified patch. Every reconstructed byte count and SHA256 matches the seal: **0 mismatches**. The patch actually changes **23 paths**; the sealed set additionally contains four unchanged relevant unit files. Earlier WT reads matched the seal. At this final check seven current WT files differ due to the subsequently authorized fix phase; those bytes are listed below and are excluded from this verdict. Parent was notified immediately.

The read boundary is the full W07 card and its FP02 §§6–10 / FP03 §§4–6,13 requirements, prior source-grounded preflight, current root Source-Lock / approval receipts / W07 exact 27-path grant, approved `start-site-v1`, technical service-zone admission, actual W01/W02/W05/W06 contracts, sealed construction/entry/host/source/render bindings, and native boundary code. The parallel native auditor owns the full private-World / member-identity / global-cap / rollback audit; this review independently checks the joining host and material boundaries and does not claim to replace that audit.

All line citations below refer to **historical reconstructed sealed bytes** under `apps/weltraum-browser`, even where the live WT has changed.

## Findings

**F01 — HIGH, real browser blocker: W05 artifact frame is published into the common HVP frame unchanged.**  
Trigger: enter `/factory.html`, choose the ordinary Cutter preview, cancel it, then use ordinary Cargo Open. `src/hvp/hvpBootstrap.ts:2194–2201` stages `createFactoryAssetProjection` artifacts without rebinding their frame. W05 `src/factory/presentation/factoryAssets.ts:94` fixes those artifacts to `fp02_east_north_height_xyz_v1`; the shared host publisher at `hvpBootstrap.ts:438–440` requires every representation frame to equal the active HVP projection frame. Both the ghost branch at :2200 and the installed branch retain the foreign frame. The failure can also make `dropFactoryScene` (:2190) throw during fatal disposal, leaving subsequent UI callbacks aimed at a freed host.

Observed evidence: own W07 run `apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z/27-real-browser-second.log` explicitly reports `HVP representations must share one projection frame`, including the disposal stack through `factorySession.ts:79`; normal Cargo Open at E2E :28 fails its unchanged 5000-ms expectation. `27-browser-command.json` binds exact cwd/command/env/config digest; `27-real-browser-second.exit.txt` is 1; `27-browser-second-artifact-receipt.json` records 1 PASS / 1 FAIL / 4 NOT_RUN and the artifact bytes. Expected: the derived ghost and facility artifact geometry must join the shared host frame, while the immutable W05 source itself remains unchanged. A fresh actual-host Ghost Move/Rotate/Cancel → Cargo Open → Dispose proof is required. Fix work is authorized separately and is not judged by this report.

**F02 — HIGH, valid installation ID collides with immutable initial Cargo owner.**  
Trigger: a syntactically valid request uses `instanceId = "fp02_wreck_owner"` with a valid distinct build position and complete paid BOM. `construction/placement.ts:54–58` rejects IDs matching installed facilities, but initial Cargo is not an installation. Native `physics/factoryFacilitySession.ts:129` checks existing `owners` and `ownerId === instanceId`, but does not exclude `initialCargo.ownerId`. Thus the new installed owner can share the Cargo's authoritative identity. On publication, `hvpBootstrap.ts:2211` already stores the Cargo projection under that exact ID; :2231 writes the new facility into the same `factoryScenes` map entry. This replaces the logical Cargo projection owner even though its native Cargo body remains a separate body, and prevents clean owner accounting / retirement. Expected: reject a Cargo-owner ID collision before admission in both public placement and native boundary. This agrees with the parallel native auditor's finding; no new native test is claimed here.

**F03 — MEDIUM, disposed checkpoint reaches the freed World before its disposed guard.**  
Trigger: native Factory session contains initial physical Cargo; dispose it, then call `checkpoint()`. `physics/session.ts:234–235` invokes `facilities.read()` before :236 checks `disposed`. `factoryFacilitySession.ts:118` calls `readCargo()`, which reaches its actual native body/collider getters. The World has been freed at `session.ts:450`. Expected: the disposed rejection executes before any facility or World inspection. The general `read()` is already guarded at :199–201; the checkpoint path lacks the corresponding order. This is a concrete lifecycle path, not a claim that the UI reopens the closed legacy save gate.

**F04 — MEDIUM, the claimed second-C26 browser oracle is masked by overlap.**  
`tests/e2e/factory-placement.spec.ts:58–61` selects the second Cutter using the same default position already occupied by the first, asserts only “Bau nicht möglich” / “Bau angehalten”, then checks unchanged state. `placement.ts:69–81` rejects geometric overlap before :92–96 checks the paid BOM. Consequently `FACILITY_OVERLAP` satisfies this test even if C26 admission were broken. The inspected first-build assertions :52–55 do independently show C26 absent from cargo and its C26 provenance in the paid installed container, and the pure T029 checks the same transfer; do not discard those valid oracles. For the claimed **second** C26 proof, use an actually valid disjoint placement and assert the missing C26/BOM reason plus unchanged complete material/native state. Existing browser-second never executed this case, so it is not a hidden PASS. Parent received this evidence finding during review.

**F05 — LOW, failed mount initialization leaves the host marked mounted.**  
`factory/session/factorySession.ts:28` adds the host to `mountedHosts` before :31–34 finishes the Cargo catalog/material construction. A rejected catalog binding at :32 throws without returning a disposable session. A subsequent valid mount on the same host fails :23 (“Factory already mounted”). Cleanup at :67–68 covers only subscription failure. Expected: release the mount reservation if any initialization step fails, or acquire it after the fallible preparation succeeds. The concrete trigger is a rejected catalog binding followed by a valid retry; this is a static read-only finding with **no executed RED/FAIL test claimed**. Ordinary closed factory entry uses the correct frozen catalog, so this is lower priority than F01–F03.

## Source / architecture findings which do match the intended boundary

**Paid 208-kg adoption and finite Resources custody.**  
`placement.ts:33–35` binds the full native Resources catalog/revision, container definitions/states, reservations and receipts rather than a shadow quantity summary. The placement profile (:59; `installationProfile.ts:30–45`) derives B06 BOM and mass from the frozen catalog/source. Admission :82–103 creates one hidden installed-material container, selects available lots only from the opened native-accessible Cargo owned by the actual actor, rejects missing pieces, and uses existing W02 prepare/commit to transfer the exact source quantities into that candidate. Existing WIP/foreign/installed containers are not free BOM sources. The 186-kg C26 tool/chassis item plus 12-kg profiles and 10-kg sheet totals 208 kg; inspected T029 verifies total mass unchanged, source profiles 80→68 kg and sheet 60→50 kg, C26 removed exactly once, and one paid installed container. Original view is retained until adoption. The UI/renderer has no amount setter or independent Cargo inventory.

**Joint CAS / hidden prepare / publication boundary.**  
`buildStep.ts:31–38` requires current Ready state, compares the complete before binding, reprepares the candidate and verifies all hooks before touching native state. :41–47 checks the same original view after pause ACK, native prepare, hidden renderer staging and native commit ACK. Binding includes actual session/epoch, terrain source/base digest and revision, native facility revision, actual player pose/reach, Cargo access and complete material. :49–50 adopts material, logical installation, held native snapshot and projection synchronously, with no `await` between those assignments; finalize follows at :51–52. :56 retains admitted custody under RecoveryHold when finalization cannot be proved. :57 refunds nothing speculatively: only proved native/projection rollback returns the old view. F01 currently prevents the renderer part from joining this intended boundary, and F02 spoils uniqueness; the otherwise explicit transaction shape is sound. Full native member / rollback acceptance remains the parallel auditor's separate gate.

**Geometry, source support and 250 ≠ 125.**  
Placement centers are exact integer multiples of **250 mm**, quarter-turns 0–3 (:54–58). Terrain queries remain **125-mm** cells from the actual host source (:39–51, :69–81), and out-of-coverage / undefined cells reject. `installationProfile.ts:19–27` consistently uses +90° Y rotation `[x,y,z]→[z,y,-x]`; both renderer quaternion (:2198) and native Y*local-Z collider pose use that convention. Body AABB, explicit source foot patches, service and sweep zones derive from the same closed source/profile. B06's source-authoring service bounds remain recorded; its versioned admitted normative one-meter edge service binding (:47–49) is explicit, not silently accepted new source data.

For default Cutter center **[-6250,1500,5000] mm**, q1, the actual source body covers X [-7250,-5250], Z [3500,6500]; the admitted service lies X [-5250,-4250], Z [3500,6500]. Four 500×500-mm source feet occupy X [-7250,-6750] or [-5750,-5250] crossed with Z [3500,4000] or [6000,6500]. These map to the approved Cutter mask East [6,9), North [5,7), and its service mask East [6,9), North [7,8), rather than the full 22×12-m layout rectangle. In source-cell indices, the feet cross X 70–73 or 82–85 with Z 156–159 or 176–179; initialized top cells are Y=75 (1.375–1.5 m), above cells Y=76 air. Source foot boundaries for Cutter/Former, battery/distribution and PV are all 125-mm aligned under the 250-mm centers, so the finite patch sampling does not hide a half-cell edge for these admitted source profiles. `startSite.ts:4–29` contains exactly the accepted 15 masks, 4480 columns/70 m², pinned parent digest b8fde6b0, zero material credit and unchanged 125-mm dimensions/bounds. It does not flatten the bounding rectangle or mint a platform. The versioned source header/digest, actual source-column reader, vegetation source owner adjustment and spawn are factory-only; normal profile defaults remain intact. No 10-m wind coverage beyond terrain Y[-8,8) is invented. Actual source/Native support proof is mandatory in the runtime gate; a pure flat unit fixture alone would not replace it.

**Physical initial Cargo and actual individual reach.**  
`cargoSite.ts:13–36` fixes the source-versioned Cargo access witness to body X[-6.25,-4.75], Y[1.25,2.75], Z[12.625,13.625] m: it is outside the layout's Z≤12.5 edge, supported by existing natural source cells, with zero extra flattened columns. Its service/access area and actual player spawn are explicitly checked against source air. This is a source access fragment, not a full new ship or a free paid platform; no resources or flight ability are added. Host :1143/1145 initializes the real native player and the same private World with this fixture. Native `readCargo/openCargo` uses actual native identity, fixed pose/support, four-meter distance to the actual access point, clearance and LOS; no DOM position authorizes access. Public placement additionally requires Cargo Open, correct native source/profile binding, actor ownership, service reach and Cargo reach (:60–68). Material provenance alone cannot bypass these checks. All code takes native player pose from `physics.read()` (:2216–2220). The second browser's initial Ready evidence confirms the fixture starts; its normal Open/WASD walking case fails under F01 before proving usable travel. A real walk/Open/individual build-reach browser PASS remains open; remote pickup/walk/local deposit is W09 work.

**Clock, input and lifecycle.**  
`factorySession.ts:46–64` keeps WaitingForHost quiescent with no credits and restores Ready only on actual native-confirmed read; construction Preparing/Finalizing is non-quiescent. Host `confirmed(true)` (:1834, :2220) ignores only this own construction busy flag while retaining actual session/terrain/native holds, enabling same-plan CAS progress while paid publication is held. Thus a Preparing→WaitingForHost status does not by itself deadlock native finalize; once construction returns Ready, quiescence allows the next real read to restore Ready. Six confirmed host ticks still produce one 100-ms factory step; no elapsed/browser clock credit appears. Ordinary preview selection pauses through actual Native ACK; Escape modifies only ghost state; resume uses the common actual-read guard and normal entry/profile behavior. Actual rAF publishes changed held/unconfirmed statuses and paused reads, so stale Running labels are not restored. W07 deliberately denies old closed legacy Save/Load when a Factory is attached (:1995), retains safe terminal session end, and adds no combined-save success claim. F01/F03/F05 are the outstanding concrete lifecycle findings above.

## Existing evidence inspected and remaining gates

Historical browser-second command was run by the writer from `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser`:

`npm run test:e2e -- --config=/workspace/.cloud-setup/fp06-w07.playwright.config.mts tests/e2e/factory-placement.spec.ts`

Actual command receipt binds `FP06_E2E_RUN_DIR=…/browser-second`, `WELTRAUM_FACTORY_EVIDENCE_RUN=2026-10-11T122211.412749Z`, `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium`, and config SHA256 `53a55a48da97d43a02e317fb8edc844d57a9b5687f356a7ebf4f5b470efcf900`. Log: initial Ready PASS 19.3 s; Cargo Open / walking FAIL 12.7 s; Ghost / paid build / second C26 / actual disposal NOT_RUN; total 34.2 s, exit1. The failed browser does not establish W07 performance, material-conserving play, or save/recovery.

Parent-authorized new fixes have subsequent RED/GREEN/evidence activity, but this report does not evaluate unsealed new products or adopt those results as final. Final acceptance needs the new complete immutable seal; independent fix followup (including actual native auditor result); actual ghost/Open/walk/paid-construction/disposal browser PASS at existing timeouts; current affected regression/build results; correctly attributed own-run evidence manifest / bounded artifacts; and final commit/evidence receipts. No missing gate is waived by the read-only architectural positives.

## Final immutable product hashes

Paths are relative to `apps/weltraum-browser`. Every value below was independently reconstructed and rechecked against the historical seal at the end of review.

| Path | Bytes | Historical SHA256 | vs BASE |
|---|---:|---|---|
| `src/factory/construction/placement.ts` | 11205 | `1785825559707d617615722ac2fea7126d9101a6e1e854742ab4ff4b861310db` | changed |
| `src/factory/construction/buildStep.ts` | 5734 | `4e5db5b1bb70921a8ee4cfbd91da48c66f4e5686b2228805b5b0ab6ae2f8ea17` | changed |
| `src/factory/ui/buildTool.ts` | 1630 | `6e5e3250a3211b45f10521f750ccf2239d536e3d4fa4ca1e1cadd22af0860f75` | changed |
| `tests/unit/factory/placement.test.ts` | 10826 | `d4768f539e7dff6491cfc5e7da7fc36c3f9b3a0f0a31cad3a561c41e621317bc` | changed |
| `tests/e2e/factory-placement.spec.ts` | 9491 | `ebbdfc660242d19e27e643d2d50ffa74810e3bd8819c300559d5bbce57892c69` | changed |
| `src/hestia-prototype/physics/factoryFacilitySession.ts` | 18296 | `ccc709933a0ec60d5b7f49a7749f99cf437b2dad45b76e533302bd279206b533` | changed |
| `src/hestia-prototype/physics/client.ts` | 32403 | `b95cc8da27241962e8f3114efb797c38d4fdabbce435d9efe9c4afda75d929ee` | changed |
| `src/hestia-prototype/physics/physicsWorker.ts` | 15865 | `1809dc32d0107d96bdb55a13e09bd386a58094c45c350c3a10bef7b42ab4f5fa` | changed |
| `src/hestia-prototype/physics/session.ts` | 37040 | `a8845134761530e2cbf1d52bf048b847e947fb7f868f480ff22fada7b4b608b9` | changed |
| `package.json` | 2570 | `f3193e4ab6e1eeef81304adeb75812f8933b2d73863317d1a1632c453cc37b89` | changed |
| `src/hvp/hvpBootstrap.ts` | 164067 | `0b49ff47c4810323011555c036edfe4cd14990b8c62118afbb4fa9c4643cb95e` | changed |
| `src/factory/session/hostPort.ts` | 2518 | `8db32270b8a9fdadf70a6a838838bedfe02a09b1451516fb41a25fe75cd25118` | changed |
| `src/factory/session/factorySession.ts` | 5289 | `27fd3d8d192f6eacc16540ffecac904a677466c89cbc613328b1901f77cf3aa2` | changed |
| `src/factory/factoryEntry.ts` | 9253 | `ad7f1bb598f26db5ba873abe762fc39a1798c8bf18a65f971409efd7b3f87202` | changed |
| `src/hvp/hvpCoastSource.ts` | 38423 | `13128d7ad3151da644ae909af0dbb0e2df0e91066c01f55ee566f7eedc1fdaca` | changed |
| `src/factory/fixtures/startSite.ts` | 2121 | `53725bbf06af6be92ac1b3b3e250ee6548e37bb6abf8500b4cd50e09b1ec1a29` | changed |
| `src/factory/construction/installationProfile.ts` | 5733 | `64df3962d652649301e1a7f411516829e6e7fd915d5fa48f566f18090c32832f` | changed |
| `src/hestia-prototype/presentation/vegetation.ts` | 22422 | `a6c6996706591f5fd77f31ea9a445fa421f6e1e02ee7162904a58834b5008dd3` | changed |
| `tests/unit/hvp-bootstrap.test.ts` | 60280 | `60ed8b7bd29cc85c1f0e1bf2a890023386d0fabe922543b86936b3241dd85b41` | unchanged |
| `tests/unit/hvp-physics.test.ts` | 9736 | `cbab1e3815dd4483c517c3ab1520d3b8d832cd36d1095f38d0ba3e8377aa2004` | unchanged |
| `tests/unit/factory/hostLifecycle.test.ts` | 12274 | `2de4f571b2113884826a2d6da60aa71720c040d5aace972d012c8f41e7fe089c` | unchanged |
| `tests/unit/hvp-coast-source.test.ts` | 25321 | `ee3a980d39a5b13fe17547c8b12fc51f066a76ea003576ee6cfc2f63ba739909` | unchanged |
| `tests/unit/hvp-vegetation.test.ts` | 15971 | `05dd0282c751167c03490d71a83e4f04d1859ef8c8ac11528f662a3a8ceeffb8` | changed |
| `tests/unit/factory/startSite.test.ts` | 2143 | `6cc02b9d07b7f3180ce515cc39f093a0d89d8c2487ddfe4bdccd68c99d097b9f` | changed |
| `tests/unit/factory/facilitySession.test.ts` | 6866 | `5f86f8dd2220abb1b3c1999004d7b0e5c83635ef3ef90bf755cd69b4fba9c370` | changed |
| `src/factory/fixtures/cargoSite.ts` | 4071 | `83fa38b62b88c8f0c7f9351a1d30617b2704d4c04a21bb64fcc5084e8739ef0c` | changed |
| `tests/unit/factory/cargoSite.test.ts` | 2746 | `abe6b53b1e5927b4756823b133e2b704a417a533bb520d94eb1c4a5df5fab86f` | changed |

## Mutable worktree drift excluded from this report

Authorized fix phase current bytes at `2026-10-11T13:57:48.927476+00:00`; these are **not** reviewed replacement results:

- `src/factory/construction/placement.ts`: 11255 bytes; SHA256 `89194437192f2788e4ea7458af06f760583f8250ccce494a89e0cc225debd09e`.
- `tests/unit/factory/placement.test.ts`: 11200 bytes; SHA256 `9fe9bde4a0cd6cd0385caaf1e63b15856ec46ca324242c782a3779a720b78909`.
- `src/hestia-prototype/physics/factoryFacilitySession.ts`: 18339 bytes; SHA256 `620a60b3d7d1e5edfef558fe07fac9af78cd9fc13385f9c45ad5fde1279d2eee`.
- `src/hestia-prototype/physics/session.ts`: 37128 bytes; SHA256 `e21fd44869c96350212f62ad33c11066029de646760fd74caa1ad2752b6797fd`.
- `src/hvp/hvpBootstrap.ts`: 164186 bytes; SHA256 `4de5d525722ee6bcf18c94a091d6f8d33f0b937708465188fd1b65c52d528b55`.
- `tests/unit/hvp-bootstrap.test.ts`: 63087 bytes; SHA256 `1ec2800737b0b6aeeefce7bab4ce39a89c054938eb5944260176bd5f236b0b5a`.
- `tests/unit/factory/facilitySession.test.ts`: 8284 bytes; SHA256 `8efd8c5bc62184ff1fb1ea77dbc141a1ab9e665e8af787627c77cf9d10a282a8`.

Historical patch and companion seal are intact. No final W07 commit exists in this report; observed HEAD equals BASE.

