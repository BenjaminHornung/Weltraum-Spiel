# W07 independent final input Spec / Code Quality review

Reviewer: `/root/w00_architecture`. Read-only source, sealed-byte, and already recorded evidence inspection. No test, build, browser/native session, profiling/verifier job, product write, branch/commit, or subagent was started. Only this external report was written.

## Scoped verdict

- **INPUT_SPEC_COMPLIANCE: PASS** for actual seventh-seal bytes and the exact Root input contract.
- **INPUT_CODE_QUALITY: PASS** in this narrow delta. No remaining concrete blocking source/code finding was identified.
- **W07_RUNTIME_SPEC / CODE_QUALITY: PASS** for the seventh-seal Runtime composition, carrying forward the unchanged earlier paid-install/source/native/lifecycle review and independently admitting this new Input/Client/Bootstrap delta.
- **ACTUAL_BROWSER / FINAL_PACKAGE_GATE: PENDING.** No outcome of the current17-case seventh browser is assumed or admitted. Historical browser failures remain historical FAILs. Final source/evidence manifest, Git/LFS binding and actual normal player construction are still required.
- **CURRENT_E2E_BYTE_ADMISSION: PENDING after end-of-review drift.** A later check at15:01:01 found only the E2E file changed from this sealed phase; the other28 paths remained exact. Later E2E bytes are excluded, not silently covered by this PASS. Root was immediately notified.
- **Performance / full W09 / W10 / W11: NOT_RUN by this reviewer.** Event dispatch and bounded coalescing do not establish a frame/latency/gameplay performance PASS. No new owner policy or write grant is created.

## Exact phase and scope

Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`; Integrator `/root/fp06_integrator`, branch `codex/hestia-fp06-integrator-2026-10-11`; product base `d5502ae7fd5431d58eda51bea062c54691ebe3c2`. Root records input grant control commit `1c20ad6a0b605e2d9e86dba74fcbe5eda1383a94`.

Actual exact grant `/workspace/.cloud-setup/fp06-task-briefs/w07-grant.json` SHA256 `e71887970ae95becd8f71edc05db8ced3b4b4d318281b2e1ed19381d4ac781d1`:29 paths, with two additions `player/input.ts` and `tests/unit/hvp-player-input.test.ts`, authorized2026-10-11T14:37:52.124736+00:00. Its narrow contract is Factory-only event-driven level intent/prompt neutralization via existing bounded Read(input), default Legacy retained, one latest coalesced intent/one jump edge, actual dispatch guards, stale input suppression and protected held/public snapshots; no new IPC/timer/queue/dependency/timeout/tempo/nativeTick/pose/authority/reach/terrain. Ordinary0ms tap motion is expressly not promised.

Seventh patch `/workspace/.cloud-setup/fp06-w07-before-seventh-browser-product.patch`: **202766 bytes / SHA256 `ce0007d04fc4833953acef94d78d1091b2848b410112028026179ad1b58eece4`**. File receipt `fp06-w07-before-seventh-browser-product-files.json`: SHA256 `4ea869a05fd9f2d9fd941a00b289c375cd18ef2e27e88c74a2bea1bc4f3053d1`, captured2026-10-11T14:53:42.859064+00:00.

Initial check 2026-10-11T14:54:39.532084+00:00: all29 granted path hashes/sizes matched actual bytes, exact grant/receipt set equality. End check 2026-10-11T14:58:45.745467+00:00: all29 still matched, zero mismatches, preserved patch/receipt digest and byte count unchanged. Reading each bounded base Git blob independently proved **27 actual changed product paths**, exactly the receipt's declared set. Unchanged relative to base are `tests/unit/hvp-physics.test.ts` and `tests/unit/hvp-coast-source.test.ts`; “29 granted” is not incorrectly reported as29 actual changed.

Comparison with the previous fifth seal (`011ac1353029be83afa1e516374a01806942befbdec92042ff5bf0cfa7c6b8c9`) gives exactly five differing paths: existing E2E, native Client, Bootstrap, input producer and newly added input unit. **24 earlier product paths remain byte-identical**, including private native Session, Worker, FacilitySession, source mask/source/cargo/vegetation/catalog boundaries, all paid-construction code and Host lifecycle. Bootstrap unit fixture is unchanged at `1ec2800737b0b6aeeefce7bab4ce39a89c054938eb5944260176bd5f236b0b5a`; its actual affected selected run is still recorded. Current input unit contains the minimal typed MessageEvent-constructor fix after actual TS2352 failure.

Full final byte binding relative to `apps/weltraum-browser`:

| Path | SHA256 | Bytes |
| --- | --- | ---: |
| `src/factory/construction/placement.ts` | `89194437192f2788e4ea7458af06f760583f8250ccce494a89e0cc225debd09e` | 11255 |
| `src/factory/construction/buildStep.ts` | `4e5db5b1bb70921a8ee4cfbd91da48c66f4e5686b2228805b5b0ab6ae2f8ea17` | 5734 |
| `src/factory/ui/buildTool.ts` | `6e5e3250a3211b45f10521f750ccf2239d536e3d4fa4ca1e1cadd22af0860f75` | 1630 |
| `tests/unit/factory/placement.test.ts` | `9fe9bde4a0cd6cd0385caaf1e63b15856ec46ca324242c782a3779a720b78909` | 11200 |
| `tests/e2e/factory-placement.spec.ts` | `488439fa85e682a90e28a9781581d4d419d3c691bd37d3ed675c53fcad36bc9e` | 13482 |
| `src/hestia-prototype/physics/factoryFacilitySession.ts` | `620a60b3d7d1e5edfef558fe07fac9af78cd9fc13385f9c45ad5fde1279d2eee` | 18339 |
| `src/hestia-prototype/physics/client.ts` | `234fe15a6b2f6f2b9c6a68bec60816536c96e4c26439bf6321ba84fb05948b42` | 33865 |
| `src/hestia-prototype/physics/physicsWorker.ts` | `1809dc32d0107d96bdb55a13e09bd386a58094c45c350c3a10bef7b42ab4f5fa` | 15865 |
| `src/hestia-prototype/physics/session.ts` | `e21fd44869c96350212f62ad33c11066029de646760fd74caa1ad2752b6797fd` | 37128 |
| `package.json` | `f3193e4ab6e1eeef81304adeb75812f8933b2d73863317d1a1632c453cc37b89` | 2570 |
| `src/hvp/hvpBootstrap.ts` | `e744746124298f359f18efed2b6eeaa83e434177fe8dd509bf2519669d6174e3` | 164229 |
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
| `src/hestia-prototype/player/input.ts` | `322821a12db4b59fd5c448c578f0adafce86222b674d25a850b976b6de3c63b9` | 11833 |
| `tests/unit/hvp-player-input.test.ts` | `8186eb1a3aa560d8de2782e4a733849fd73caed82987d4712b4762910f2bc427` | 11383 |

Earlier report `fp06-w07-final-spec-review.md`, SHA256 `76992b8eb6d5db9f8b3b4483a7952722aae658e078babcf048c41427690e2173`, remains a historical fourth/fifth26-runtime PASS with actual failed browsers. This report explicitly admits the new bytes; it does not reinterpret that historical phase.

## Source/code assessment

### Factory opt-in, level intent and jump edge

`src/hestia-prototype/player/input.ts:10` adds a false-by-default `factoryEventIntent` opt-in. Bootstrap `:1365` sets it only for its explicitly bound Factory source profile; the source/profile gate at `:1028`–`:1029` still requires actual Factory extension/version. Normal profile passes false and retains existing deferred RAF producer/Client behavior.

Factory events `input.ts:61`–`:69` require active, fully activated, undisposed input, real pointer lock and current Host blocker, then the actual native public Running/Idle terrain/neighbor/residency/structural/moving read. Keydown/up and mouse yaw change stage level intent immediately (`:78`–`:100`) without waiting for another renderer frame. That intent contains axis/sprint/jump only, no position/tick. Existing world-space yaw/normalized diagonal semantics remain unchanged (`:52`–`:59`); Factory-only signed-zero normalization does not alter speed or Legacy values.

Space rises only on fresh nonrepeat keydown (`:91`). Producer resets its local jump immediately after staging (`:67`–`:69`), so repeat/ordinary release/next RAF cannot restage the same edge. Client `physics/client.ts:371` retains one UNSENT jump via OR unless explicit cancelPendingJump. Ordinary keyUp stages jumpfalse and preserves that unsent edge; stop `input.ts:44`–`:45` explicitly cancels it for Factory. Dispatch copies the one latest intent and clears its pending jump before the Read (`client.ts:209`–`:211`), so the next release/RAF does not send it twice.

Stop/Escape/blur/visibility/pointer-lock loss/dispose clear key/producer edge and stage neutral immediately (`input.ts:42`–`:50`,`:81`,`:102`,`:117`–`:123`,`:196`–`:200`). Host/native Hold causes event stop at `:63`–`:66`; the existing frame blocker also stops input at157. Pause/Inspect/Play clears Client's current intent and pending dirty flag (`client.ts:426`–`:429`); closing disposes with cancellation at456–464. Source callback activation retains legal pre-ACK pressed keys/edge and stages them only after successful Play ACK (`input.ts:76`); failed activation stops and cancels.

No promise is made that a press/release completed before any native tick must move the player. Latest level coalescing may correctly yield net zero; it is not a synthetic tap impulse.

### One bounded existing Read; dispatch and reply barriers

Factory-only `client.ts:202`–`:214`,`:369`–`:373` uses one current input and dirty boolean, not an accumulating key-event queue. The existing busy flag permits at most one Read request at a time. While busy, repeated20-event input changes replace the latest value and retain at most one jump; after its reply, exactly one latest intent can dispatch. Every dispatch rechecks actual disposed/failure/closing/mutating/bodyPending and Running/Idle terrain/neighbor/residency/structural/moving/Facility state. A pending value encountered during unavailable/held/paused state is cleared rather than replayed after Play. Existing pending-command cap8 and20,000ms deadline are untouched (`:194`–`:200`); existing preparation WorkerPool count≤2/queue32 and collision budget are untouched. No new interval, worker, message kind or queue limit exists.

Reply metadata now records actual message kind (`:169`,`:199`). At `:185`–`:187`, an in-flight Factory Read received during mutating/bodyPending/closing is withheld from BOTH public snapshot and heldSnapshot. Its clock/timing readback remains diagnostic. Actual Prepare/Commit/Finalize replies remain admitted by their existing phase/identity guards; Read cannot replace the prepared receipt or expose held native body/member state publicly. Existing newer-ID public snapshot ordering remains in force for older post-phase replies (`:186`).

The new no-RAF input can therefore use the same bounded private native transport without granting renderer/keyboard authority to adopt NativePrepared state. It changes intent delivery only; paid installation still has full MaterialView CAS, hidden projection, native same-World member proof, synchronous joint publish, rollback/finalize/RecoveryHold. All old native Session/Worker/Facility bytes are unchanged and separately hash-bound.

### Actual unchanged native seam

`physicsWorker.ts:143`–`:148` applies Read input to existing native session without manufacturing a tick. Session `:334` delegates only to actual character `setInput`; native Locomotion `:49`–`:53` validates axis/booleans and retains one jump, `:55`–`:66` advances only at fixed native DT with unchanged source walk speed/gravity/coverage. Pause `session.ts:326` disables/neutralizes native character and pauses; Play328–331 enables and resumes only outside true held/recovery transactions. Existing Worker timer/tick/held control, profile budgets and native ownership remain unchanged. Input/renderer never writes avatar pose, confirms Factory ticks or controls BOM quantities.

The source-proven old between-frame loss is addressed by staging on real events; overshoot due a held key during slow CDP polls is addressed by ordinary test release before read. These are distinct effects. Neither change widens Cargo4m/service3m reach or changes source support/air.

### New tests, honest mock boundary

The135-line input unit was read completely. Its first harness has real Rapier session snapshots, explicit EventTargets and a recording intent adapter. It does not advance a simulated pose/tick or claim live browser movement. Native transport harness `:65`–`:90` intercepts worker transport and holds only actual native Read replies; its initialize/create/play/pause/facility commands operate real Rapier session state. Empty collision sources explicitly bypass unrelated pool jobs. It is a deliberate controlled transport fixture, not the actual browser Worker interval.

Twelve counterexamples cover noRAF Down/Up/unchanged ticks, one Space edge, stop/Escape/blur/Hold, Legacy producer default, one coalesced latest Read, unsent jump, Pause-before-Play stale-edge suppression, Legacy Client default, late Read during actual paused Facility preparation, and dispose. Late Read oracle at `:121`–`:130` is particularly meaningful: a real native facility candidate exists in the fixture, public snapshot must remain exact old state, exact prepared receipt still allows commit/publish, then rollback. It was an actual collected assertion failure before reply withholding. It is not a boolean mock of Prepared state. Full real Cargo/support/player walking stays a separate browser/native package gate.

## E2E delta and W07 effect

E2E `:13`–`:18` owns one normal browser Context/Page/native session through all17serial cases, with normal/fresh route,1canvas/1HUD, finite2,984,400,000mg/uninstalled/closed source Cargo, actual native body handle,97source plants and no TestBridge at19–25. Reads of DOM datasets are read-only observations, not state injection.

Ordinary trusted presses `:37`–`:48` have actual25–100ms hold capped from distance/3m/s and release BEFORE each native read. Current harness has at most8D/A taps and16S/W taps, four per unchanged30s case (`:53`–`:58`), with at least original exact x[-6.4,-6.125]/z[8.75,9]/grounded/nativeCargo-accessible assertions. The sixteen S/W bound is stated explicitly: it differs from the earlier eight-axis harness phase, while current Root input grant permits adaptations of actual ordinary user inputs. These are additional bounded player actions/cases, not faster physics or a larger timeout. Success of these movement assertions is not assumed.

All old concrete oracles remain: actual closedCargo refusal/Open idempotence; Escape same-session pause and unchanged material/Cargo; actual move/quarter-turn/Ghostcancel; first208kg paidB06 with actual C26 count1 before/absent after, Resources mass/profile/installed provenance and native body/owner; disjoint supported secondCutter `[-9750,1500,5000]`/q1 specifically `BOM_MISSING`, unchanged whole material/installation/native members; legacySaveRejected and actual ended/disposed Worker cleanup. No source profile/mask/Cargo geometry/support/reach/battery/quantity/nativeMember budget changes occur in input delta.

This admits Runtime/contract composition, not W07 actual player construction until the current real browser completes and Root evaluates its raw results, artifact binding and Git/LFS gate. Older fourth/fifth/sixth failures are not overwritten.

## Actual recorded verification; reviewer did not rerun

Own run `apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z`, actual cwd Integrator app. All command JSONs/logs for44–50 and decompressed raw gzip bytes were read. Raw size/digest matched every receipt. Commands were actual already performed jobs, not suggested future checks.

| Phase / actual command | Actual result | Raw / wrapper timing |
| --- | --- | --- |
|44 `npm run test -- tests/unit/hvp-player-input.test.ts` | exit1;12collected,**10AssertionFAIL/2LegacyPASS**, no import/setup error. Includes actual public NativePrepared member exposure failure. | Vitest1.44s;wrapper1.841328s;10680B/`d294cfd67400afc6dbcd2e49ecbbf621218b217d5a4afa7c6b1194f22729dd44` |
|45 same full input command | exit1;**11PASS/1FAIL**: Factory neutral `z:-0` versus expected canonical+0. Historical attempt remains FAIL. | Vitest1.40s;wrapper1.802302s;1528B/`ae75431bb0672c8c1dedee088ded89d985be5437d2b0f352421b2b3f3b47247a` |
|46 `npm run test -- tests/unit/hvp-player-input.test.ts tests/unit/hvp-bootstrap.test.ts -t "Factory|Legacy|actual Host Ghost"` | exit0;**12PASS/35SKIP**,2files; selected affected Host frame/input checks, not all47 tests. | Vitest23.56s;wrapper23.972623s;437B/`cd7109fd93d1d9b7850bcc355c7e11e1d055a04df005a3c16d774c4910da47db` |
|47 full input command | exit0;**12PASS** | Vitest1.30s;wrapper1.684630s;353B/`82e6efd62c4a7f37f1dc68b501c0b4e317d7d4000eb6b534247e4195cc5b8eb4` |
|48 `npm run build` | exit1; actual test-fixture TS2352 cast error; original preserved, not a runtime test pass | wrapper2.167388s;948B/`c9050df9bb2c2b53edc13068fd31a2f728fd5e346db36b77f9bb4cd0a5b1e7fa` |
|49 full input command after typed MessageEvent constructor only | exit0;**12PASS** on final unit bytes; runtime unchanged | Vitest1.40s;wrapper1.818598s;353B/`0f2deef329bd350d96d7d2aaf94328fcba97dfdd845ca20227ba71f68d317da7` |
|50 `npm run build` (TypeScript + Vite) | exit0; full final project build,292modules; ordinary preexisting chunk-size diagnostic retained | Vite1.48s;wrapper4.047476s;1904B/`046f4eccf32adecad5b0f9d9d970242f1c757fbeafa4577c8685941008da95fd` |
|51 current17-case browser | **PENDING; no actual verdict admitted here** | Actual native walking/construction evidence remains separate. |

No new focused test was written or run by this reviewer; no broad whole-suite or performance result was invented from the selected12/35skipped check. Existing paid/native/source regressions remain bound to their unchanged product bytes and prior reviewed phases.

After the bound14:58:45 end check and report creation, an extra15:01:01.431500+00:00 byte check observed only `tests/e2e/factory-placement.spec.ts` changed. Actual subsequent observation was16996bytes/SHA256 `744e30b5a5f56be125448d738fb7805a1c3af78b160cbb70dabdae217cdcd1e4`, versus this phase13482bytes/`488439fa85e682a90e28a9781581d4d419d3c691bd37d3ed675c53fcad36bc9e`. All28 other granted paths still match. Root was immediately informed; the later harness authorization/seal/result must be recorded separately. This is an honest phase distinction, not an assertion of unauthorized writes, and the later harness is not reviewed here.

## Remaining final gate items

Root must obtain/evaluate the actual current normal browser result and all key material/member/screenshots/disposal witnesses, independent native final contract closure, complete fresh manifest/evidence paths/digests, and exact final Git/LFS commit contents. Save/recovery is still the later W10 combined adapter, not introduced by this input correction. Any subsequent byte delta requires its own review. No remaining source/code blocker was found in this sealed input delta; the open items are actual package evidence gates.
