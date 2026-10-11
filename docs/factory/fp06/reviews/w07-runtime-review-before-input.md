> Quelle: `/workspace/.cloud-setup/fp06-w07-final-spec-review.md`; originale SHA256 `76992b8eb6d5db9f8b3b4483a7952722aae658e078babcf048c41427690e2173` (22071 Bytes). Kopie am 2026-10-11T14:45:54.477304+00:00; ausschließlich Markdown-Zeilenenden/Leerzeichen normalisiert. Historischer Runtime-PASS vor dem neuen Inputdelta; kein W07-Paketgate und kein Browser-PASS.

# W07 final independent Spec and Code Quality review

Reviewer: `/root/w00_architecture`. Read-only inspection of product source, sealed patches, prior independent reports, and already recorded logs/receipts. No tests, builds, browser, native session, profiling, verifier CLI, product writes, or subagents were started. Report is external to both product worktrees.

## Scoped verdict

- **RUNTIME_SPEC_COMPLIANCE: PASS** for the 26 runtime/unit/configuration files in the fourth seal, unchanged in the fifth seal. All five findings in the historical second-seal review are closed at code/source level.
- **RUNTIME_CODE_QUALITY: PASS** within this W07 scope. No remaining concrete runtime blocking finding was found.
- **FIFTH_E2E_DELTA_SPEC / CODE_QUALITY: PASS for static contract review** of the one authorized harness-file delta. This does not say the taps achieve the target or that a browser passed.
- **ACTUAL_BROWSER_GATE: PENDING.** The fourth and fifth runs are actual FAILs, not relabeled PASS. The later sixth harness refinement/browser is outside this phase; no future gameplay outcome is admitted by this report.
- **FINAL_PACKAGE / EVIDENCE / GIT-LFS GATE: PENDING.** W07 has no final accepted commit in this report. W09 integration, W10 combined save/recovery, and W11 complete gameplay/performance are not evaluated as completed here.

## Exact candidate and phase binding

Integrator worktree: `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`. Package base: `d5502ae7fd5431d58eda51bea062c54691ebe3c2`. Current root Source-Lock and explicit W07 grant control the scope; attachments do not substitute for owner acceptance.

| Phase | File receipt SHA256 | Patch SHA256 | Patch bytes |
| --- | --- | --- | ---: |
| fourth, captured 2026-10-11T14:18:25.352014+00:00 | `09e4d89eb745e281e9f36b0cdc19d8596393841e8da88869f18287c9bf567643` | `56c900dae3f1a4c5db34d97f1b0e8e1f06c8a6097c167509b2e8d9f249d38e89` | 175137 |
| fifth, captured 2026-10-11T14:24:01.951912+00:00 | `a5e992f1540803742eb61c0475c33758596e5e5c5f388ffa78733b3435aadf64` | `011ac1353029be83afa1e516374a01806942befbdec92042ff5bf0cfa7c6b8c9` | 176593 |

Receipts are respectively `/workspace/.cloud-setup/fp06-w07-before-fourth-browser-files.json` and `fp06-w07-before-fifth-browser-files.json`, with corresponding `.patch` files. At 2026-10-11T14:21:39.133424+00:00, all 27 fourth-seal files matched actual worktree bytes and the 27-path grant. Root Source-Lock then had SHA256 `ef48a70bd3a5c842e98fc294ac89e15cf31fbc770ac69733f0d0ef78efc30305`.

At the end recheck, **2026-10-11T14:26:40.996479+00:00**, all 27 fifth-seal files matched their actual SHA256/size, with zero mismatches; both preserved patch/receipt digests still matched. Comparison of the complete two receipt sets proves the only changed file is `tests/e2e/factory-placement.spec.ts`: fourth SHA256 `18315c49db16d9fa24c28ca536f8ad5543a3eecbcbe204ea087932eb5e264829`,11673 bytes; fifth SHA256 `a94d9f746bec1fe4fb34bf3b5f1c8a94cd6305fff3e63cdbb9f952655c36ee0d`,13113 bytes. This is the expressly authorized harness followup, not unexplained runtime drift. All 26 other paths remained byte-identical. No CPU/runtime fix or source/reach/physics-speed change was admitted through this delta.

Full current fifth-seal byte binding, paths relative to `apps/weltraum-browser`:

| Path | SHA256 | Bytes |
| --- | --- | ---: |
| `src/factory/construction/placement.ts` | `89194437192f2788e4ea7458af06f760583f8250ccce494a89e0cc225debd09e` | 11255 |
| `src/factory/construction/buildStep.ts` | `4e5db5b1bb70921a8ee4cfbd91da48c66f4e5686b2228805b5b0ab6ae2f8ea17` | 5734 |
| `src/factory/ui/buildTool.ts` | `6e5e3250a3211b45f10521f750ccf2239d536e3d4fa4ca1e1cadd22af0860f75` | 1630 |
| `tests/unit/factory/placement.test.ts` | `9fe9bde4a0cd6cd0385caaf1e63b15856ec46ca324242c782a3779a720b78909` | 11200 |
| `tests/e2e/factory-placement.spec.ts` | `a94d9f746bec1fe4fb34bf3b5f1c8a94cd6305fff3e63cdbb9f952655c36ee0d` | 13113 |
| `src/hestia-prototype/physics/factoryFacilitySession.ts` | `620a60b3d7d1e5edfef558fe07fac9af78cd9fc13385f9c45ad5fde1279d2eee` | 18339 |
| `src/hestia-prototype/physics/client.ts` | `b95cc8da27241962e8f3114efb797c38d4fdabbce435d9efe9c4afda75d929ee` | 32403 |
| `src/hestia-prototype/physics/physicsWorker.ts` | `1809dc32d0107d96bdb55a13e09bd386a58094c45c350c3a10bef7b42ab4f5fa` | 15865 |
| `src/hestia-prototype/physics/session.ts` | `e21fd44869c96350212f62ad33c11066029de646760fd74caa1ad2752b6797fd` | 37128 |
| `package.json` | `f3193e4ab6e1eeef81304adeb75812f8933b2d73863317d1a1632c453cc37b89` | 2570 |
| `src/hvp/hvpBootstrap.ts` | `4de5d525722ee6bcf18c94a091d6f8d33f0b937708465188fd1b65c52d528b55` | 164186 |
| `src/factory/session/hostPort.ts` | `8db32270b8a9fdadf70a6a838838bedfe02a09b1451516fb41a25fe75cd25118` | 2518 |
| `src/factory/session/factorySession.ts` | `7f1e342aecac3525bcc1b0a0f6ea579a1db2172af6f98d00d7289b7087a3a00f` | 5378 |
| `src/factory/factoryEntry.ts` | `ad7f1bb598f26db5ba873abe762fc39a1798c8bf18a65f971409efd7b3f87202` | 9253 |
| `src/hvp/hvpCoastSource.ts` | `13128d7ad3151da644ae909af0dbb0e2df0e91066c01f55ee566f7eedc1fdaca` | 38423 |
| `src/factory/fixtures/startSite.ts` | `53725bbf06af6be92ac1b3b3e250ee6548e37bb6abf8500b4cd50e09b1ec1a29` | 2121 |
| `src/factory/construction/installationProfile.ts` | `64df3962d652649301e1a7f411516829e6e7fd915d5fa48f566f18090c32832f` | 5733 |
| `src/hestia-prototype/presentation/vegetation.ts` | `a6c6996706591f5fd77f31ea9a445fa421f6e1e02ee7162904a58834b5008dd3` | 22422 |
| `tests/unit/hvp-bootstrap.test.ts` | `1ec2800737b0b6aeeefce7bab4ce39a89c054938eb5944260176bd5f236b0b5a` | 63087 |
| `tests/unit/hvp-physics.test.ts` | `cbab1e3815dd4483c517c3ab1520d3b8d832cd36d1095f38d0ba3e8377aa2004` | 9736 |
| `tests/unit/factory/hostLifecycle.test.ts` | `fd55eb45af1166c49b8302d925cb9bf14bc189665f2dbd11f3a661f0330018b5` | 14119 |
| `tests/unit/hvp-coast-source.test.ts` | `ee3a980d39a5b13fe17547c8b12fc51f066a76ea003576ee6cfc2f63ba739909` | 25321 |
| `tests/unit/hvp-vegetation.test.ts` | `05dd0282c751167c03490d71a83e4f04d1859ef8c8ac11528f662a3a8ceeffb8` | 15971 |
| `tests/unit/factory/startSite.test.ts` | `6cc02b9d07b7f3180ce515cc39f093a0d89d8c2487ddfe4bdccd68c99d097b9f` | 2143 |
| `tests/unit/factory/facilitySession.test.ts` | `8efd8c5bc62184ff1fb1ea77dbc141a1ab9e665e8af787627c77cf9d10a282a8` | 8284 |
| `src/factory/fixtures/cargoSite.ts` | `83fa38b62b88c8f0c7f9351a1d30617b2704d4c04a21bb64fcc5084e8739ef0c` | 4071 |
| `tests/unit/factory/cargoSite.test.ts` | `abe6b53b1e5927b4756823b133e2b704a417a533bb520d94eb1c4a5df5fab86f` | 2746 |

## Closure of the historical five findings

Historical report `/workspace/.cloud-setup/fp06-w07-spec-review-prebrowser.md` remains preserved at SHA256 `9309bc8917ad4855e56b1e2f9174a539298ae0db8eb6153f9f37c8e064d36b0f`. It was a FAIL for old patch `bc0986f9b508751644e6f392073caa8da293919b3d689dd96fe8df50c47909c1`; its verdict is not rewritten.

| Historical finding | Actual closure and trigger boundary |
| --- | --- |
| F01 foreign mesh frame breaks ghost/Cargo interaction and disposal | `src/hvp/hvpBootstrap.ts:2192` stages the existing W05 source projection; `:2201` derives a new mesh artifact with the shared Host frame for BOTH ghost and installed Facility. Local source vertices, paid source profile, and +Y quarter-turn transform remain preserved. Derived content hashes are recomputed by the existing artifact constructor; original W05 assets/source bytes are unchanged. Hidden keys are registered before the first Upsert at `:2197`; only joint publication adds active keys at `:2231`. Actual strict-publisher ghost move/rotate/cancel RED and GREEN were recorded, so this is more than a permissive renderer mock. |
| F02 valid initial Cargo ID can replace its owner/projection | `construction/placement.ts:58` rejects an instance ID equal to actual `cargoAccess.ownerId` before paid candidate creation. `physics/factoryFacilitySession.ts:129` independently rejects the same native owner-ID collision before allocation. The valid grammar trigger `fp02_wreck_owner` is covered in pure and actual native counterexamples; an invalid hyphenated ID would not prove closure. Original Cargo remains a distinct native owner and original Resources container. |
| F03 checkpoint after Dispose queries a freed World | `physics/session.ts:235` checks disposed before `:236` queries Cargo/facility state. The real native counterexample checks the exact safe rejection and zero-count disposed read. This closes disposal ordering; it does not introduce combined Factory capture/export. |
| F04 second Cutter failure can be overlap rather than finite C26 depletion | Fifth E2E `:89` moves the ordinary ghost to exact `[-9750,1500,5000]` mm/q1 and expects specifically `BOM_MISSING` at `:92`, again at failed confirmation `:95`. Source proof gives disjoint fully supported body/service/sweep placement; generic overlap refusal is no longer the accepted oracle. First build checks actual C26 count1 before and absence after,208kg installed provenance, actual native owner/member presence, unchanged global mass at `:71`–`:81`. Failed second confirmation checks complete containers/installations/owner handles/body and collider counts at `:94`–`:99`. Actual browser completion remains pending. |
| F05 failed initial material/catalog mount leaks same-Host reservation | `session/factorySession.ts:29`–`:34` performs all fallible synchronous initial Cargo catalog/material preparation before `mountedHosts.add(host)` at `:36`. No await occurs before the add, so the exclusive same-Host check has no async gap. Subscription failure still deletes the reservation at `:69`; normal disposal deletes it at `:81`. `tests/unit/factory/hostLifecycle.test.ts:36`–`:48` separately rejects wrong canonical catalog bytes and a typed empty ResourceCatalog, checks zero subscriptions/native commands/disposals, retries the SAME Host successfully, and checks exactly one final disposal. Actual2RED then GREEN receipts exist. |

The historical independent native followup `fp06-w07-native-review-third-seal.md` (SHA256 `266f07dc333bab4c2f6ec30637e034e090c87c8322690e40c959b6ece4ea8947`) separately admitted unchanged native fix bytes only. Its later-mount pending verdict is closed here by inspecting the actual new FactorySession and HostLifecycle bytes, not by extrapolating its earlier PASS.

## Source, material, and publication contract

`src/factory/construction/placement.ts:33`–`:36` binds complete canonical catalog bytes, all actual native Resources container definition/state bytes, material revision, reservations and receipts, installed owners, actor and physical Cargo access, session/epoch, source/base digests, terrain revision, and facility revision. `buildStep.ts:35`–`:37` validates this full before-state and independently regenerates and compares the full candidate/profile/installation. Every asynchronous pause/native-prepare/hidden-render-stage/native-commit boundary rechecks the complete current state (`:41`,`:45`–`:47`). Native command material binding contains the admitted complete post-install material bytes (`:43`–`:44`).

`buildStep.ts:48`–`:50` publishes actual material, logical installation, held native snapshot and renderer projection in one synchronous turn without an await. Native/renderer staged resources remain hidden until this point. A proven prepublication rollback restores exact old material/installation state; unknown finalization or unproved rollback remains RecoveryHold and never guesses a refund (`:54`–`:59`). Resources remain sole stack quantity authority; this path transfers source-bound BOM stacks into the installed container, not a new paid device mass. B06's source profile is208kg, including finite C26. The global2,984,400,000mg baseline is preserved through installation, with provenance retained by the native Resources operations. No new Cargo stock catalog or UI-owned quantity map appears.

The250mm request-center rule is explicit at `placement.ts:56`, while actual terrain cells must be125mm at `:57`. All foot columns sample the source-backed125mm cells immediately below and above the exact support plane (`:73`–`:78`); body, service and sweep volumes undergo bounded terrain-air queries (`:45`–`:51`,`:80`–`:81`). Unknown cells, source gaps, out-of-range coverage, overlap and player intersection fail before BOM consumption. +90° transforms remain coherent with renderer and native closed technical geometry. No global support=true plane or free paid platform was introduced.

The Factory-only source initializer `fixtures/startSite.ts:4`–`:8` is the exact15 approved masks, not their bounding rectangle. `:19`–`:29` checks parent digest `b8fde6b0`, writes4480 authoritative125mm columns at source top1.5m/limestone, and records70m²/materialCreditMg0. Normal coast source and normal vegetation remain separate. `factoryEntry.ts:81` selects this source only through the existing startHvp host/source pipeline and versioned factory source profile. Physical initial Cargo is outside those masks on its validated natural source support; its Cargo-site fragment does not own or regenerate C01–C28 quantities.

The actual host `hvpBootstrap.ts:2216` opens Cargo only through its native capability with current terrain/facility/profile binding and confirmed Host guard. `:2217`–`:2222` supplies the current actual native actor position and Cargo read facts, not camera/ghost positions. Planner `placement.ts:61`–`:68` requires Cargo owner/container/open/source binding, actual accessible flag, local3m service and4m Cargo access reach. Native layer additionally validates full fixed members, actual actor/LOS/support/coverage and its own4m point criterion. The stronger native criterion is not bypassed by the planner.

Independent second-site proof `reviews/w07-second-cutter-site-preflight.md` originated at SHA256 `bfd82113829ba58f1421a88b3fa35cb7a67753e4338087fd7f7f59864c695366`. It proves all64 complete125mm foot columns at top1.5m (32 approved mask,32 unchanged natural source);384 body columns and192 service columns remain within coverage, all sweeps clear. The second service ends x=-7.75m, leaving0.5m before first body begins x=-7.25m. Recommended actor[-6.25,2.42,8.875]m has3.828041m native Cargo point distance and2.809026m service distance. Those are source-projected facts, **not actual native movement/LOS receipts**. Current fifth harness checks actual x[-6.4,-6.125],z[8.75,9],grounded and Cargo accessible before allowing the paid build sequence; later `BOM_MISSING` specifically proves remaining planner guards, including current actor reach, succeeded. No geometry/reach widening is implied.

## Host lifecycle and native boundary

`factorySession.ts:46`–`:65` retains six NEW confirmed native60Hz ticks per100ms Factory step, no browser-time/offline-time authority. WaitingForHost grants zero tick credit until actual native confirmation; same-tick confirmation may safely return Ready. Native/epoch/backward-tick terminal recovery cannot return Ready automatically. Host read/publisher `hvpBootstrap.ts:2165`–`:2177` emits unconfirmed snapshots too, so actual holds are visible. Construction reads may ignore its own narrow busy lease while joint installation is underway; normal Host Resume/Drop/Play remain guarded by the same actual Factory confirmed/quiescent guard (`:2111`–`:2119`), avoiding a self-created clock deadlock. Terminal recovery can end through the existing `canEndSession` capability; a still-pending joint publication cannot be torn down (`factorySession.ts:74`–`:81`).

Ghost move/rotate/cancel (`factoryEntry.ts:34`,`:40`–`:44`) updates a projection only; it never creates native bodies or consumes BOM. All fallible hidden render stages use existing presentation commands and materials leases. Disposal removes listeners/projections and later native World via the one existing Host. Legacy persistence remains intentionally closed for Factory; `physics/session.ts:236` rejects native legacy capture even with initial Cargo only. A read projection containing Cargo/owners is not a Factory checkpoint DTO; this absence is an explicit W10 dependency, not a W07 save claim.

The native closed facility API remains scoped to one private Rapier World, full owner/member handles and geometry/profile/source binding. Cargo counts toward the maximum16 fixed owners (thus at most15 additional facilities with Cargo), and staged/dormant candidates still count against unchanged64 total bodies/32 dynamics/4096 colliders and existing CPU/render budgets. This review adds no allowance for a second World visible to UI, counts-only member validation, changed budget/timeout, generic World/createBody exposure, or silently extended terrain coverage.

## Actual evidence read; no rerun

Own run: `apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z`. Existing command JSONs, logs, and gzip raw receipts were read. For phases33–40, decompressed raw SHA256/byte size matches each actual command receipt. Commands used the actual Integrator app cwd. Historical RED/FAIL logs were retained, including the typed-test-fixture TypeScript failure.

| Phase | Actual command and result | Timing / raw digest |
| --- | --- | --- |
|28–31 prior source/frame/native fix | Actual4AssertionRED/54SKIP; then30native+placement+Cargo+source PASS; strict actualBootstrap1PASS/34SKIP; full TypeScript/Vite build PASS. These are unchanged runtime/native bytes, described with raw bindings in native-third-seal review. | Native GREEN7.54s;Bootstrap7.99s; no fresh whole-suite or browser success inferred. |
|33 failed initial binding retry RED | `npm run test -- tests/unit/factory/hostLifecycle.test.ts -t "W07 failed initial"`;exit1,2FAIL/17SKIP | Vitest0.511s;wrapper0.875040s;raw2031B/`56161ce03ecda2d517c10c4c8b5d0412e7113c474c07d1a9a86da279b6f4f894` |
|34 lifecycle GREEN | `npm run test -- tests/unit/factory/hostLifecycle.test.ts`;exit0,19PASS | Vitest1.12s;wrapper1.480718s;raw358B/`3d3a796931dd22eb0fafeff3f3e3b5d8332249a6cd7121c34b94ca8dd2365bb2` |
|35 typed fixture compile FAIL | `npm exec -- tsc -p tsconfig.json`;exit1,wrong ResourceCatalog test-fixture shape | wrapper2.629465s;raw832B/`fdadd621c1b8f431cd8a9e3b6a5c6ccbf0361e571030aef7f714a92dd54db087` |
|36 final typed fixture affected GREEN | same targeted two mount tests;exit0,2PASS/17SKIP; runtime FactorySession unchanged | Vitest0.514s;wrapper0.876851s;raw391B/`78bfda950a02e66615c85920b8de937fb04a66ad1393d34c0295d8273bbe7964` |
|37 final mount TypeScript | `npm exec -- tsc -p tsconfig.json`;exit0 | wrapper2.730541s;raw0B/emptySHA256 |
|38 fourth harness TypeScript | same actual full project TypeScript command;exit0 | wrapper2.452960s;raw0B/emptySHA256 |
|39 fourth real browser | actual ordinary Chromium,1worker,11serial cases;exit1,**4PASS/1FAIL/6NOT_RUN** | wrapper82.152345s;raw7621B/`17c17452c7c6d9f93efed0f2bec76c73321bce3cb78a91d2999d46e5af35a444` |
|40 fifth harness TypeScript | `npm exec -- tsc -p tsconfig.json`;exit0 | wrapper2.471197s;raw0B/emptySHA256 |
|41 fifth actual browser | actual ordinary Chromium,1worker,15serial cases;exit1,**5PASS/1FAIL/9NOT_RUN** | wrapper78.563202s;raw7993B/`c14835169831db71a194097d4adfe007115e1dc0e6786202b5d5ae8f0f499ef8` |

The fourth failure is the actual Cargo-accessible assertion after real movement. Existing paused/grounded readback recorded x=-8.4434595,z=2.2250071m/Cargo inaccessible after held D/S during slow native/CDP polls. It is not a30s timeout, and it does not prove a native reach bug. The failure does prove the earlier harness failed to stop at its source-checked target. Its paid Cutter, depletion and disposal cases did not run.

## Narrow fifth harness delta

`tests/e2e/factory-placement.spec.ts:37`–`:47` makes only bounded ordinary `page.keyboard.press` calls, fully releases the key before reading the actual native DOM projection, and records before/after actor/tick facts. Four taps per existing30s case and two cases per axis cap each axis at8 ordinary inputs. Closed-loop direction is based on current actual coordinate, with no teleport/state injection/worker mutation/clock jump or physics/reach change. `:53` and `:55` keep exact actual x/z window, grounded and native Cargo-accessible assertions; taps have no guaranteed success claim. The serial describe still owns one normal Context/Page and one continuous native session, and later cases preserve all actual finite-C26/paid208kg/member/disposal oracles. No runtime path changed; no testTimeout/global queue or cap increased. Static contract compliance/quality of this phase is PASS; actual gameplay is FAIL/NOT_RUN as above.

The fifth result and eight actual tap receipts were subsequently read, not rerun. All eight default zero-delay D presses left actual player x=-5.5m while confirmed native ticks advanced; the second west-stand case failed its preserved x≤-6.125m assertion. `src/hestia-prototype/player/input.ts:59`–`:74` stores keydown/up intent in a Set; `:150`–`:155` samples that Set only in `update()`, called from the Host frame loop at `hvpBootstrap.ts:2286`. A down/up occurring between frame samples can therefore produce no native movement. The observed result is consistent with that unchanged intent-sampling contract and is not evidence for a new native physics bug. Root's later permission for ordinary short press delays25–100ms/≤8axis taps/release-before-read is a further one-file harness phase; it is **not reviewed or admitted by this fourth/fifth report**. The sixth actual gate remains open.

## Remaining gate items

Root must evaluate actual final normal-browser results, complete independent native final closure, complete affected verification/evidence manifest/artifact path+bytes, and final Git/LFS commit binding before recording W07 package PASS. A later byte delta must obtain its own narrow review. This report is a runtime/static-spec/code-quality admission, not successful live construction, final gameplay performance, completed saving, or authorization for any unapproved product policy.
