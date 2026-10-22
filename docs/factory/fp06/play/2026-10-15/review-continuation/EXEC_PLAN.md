# ExecPlan: FP06 review continuation, 15 October 2026

## Goal

Continue the actual FP06 candidate until a clean copy starts, the normal fresh
16 kg production loop works, and a combined Native/Factory save survives a real
browser restart. Functional, UI, Save, Visual, Gameplay and Performance results
remain separate; human acceptance is OWNER_REVIEW_PENDING.

## Context

The direct user request opens a NEW bounded diagnosis window described in the
attached 02_AGENT_FORTSETZUNG.md. The independent review is evidence to verify,
not an independent authority grant. The exhausted October 14 trial and M5 STOP
are historical and unchanged.

Fresh remote candidate: 7ee85b0e0e3dedc5a41c3ccf98b3fe92b64f846e.
Fresh remote control: 67a860016aae808c3244e243396282f7f7f2632d.
Checkout: E:/DEV/Weltraum-Spiel/FP06-Candidate.
Branch: feature/hestia-fp06-review-continuation-2026-10-15.
Existing local repositories were preserved. A Pi read-only scout checks for
newer local FP06 work before product mutation; external uncommitted work is
UNKNOWN unless directly observed.

Read sources: attached 01_REVIEW.md, 02_AGENT_FORTSETZUNG.md, SOURCES.json;
external-review/2026-10-14/README.md; composition-closure/RESULT.md and
FINAL_CHECKPOINT.json; native-continuation/REPORT.md; control branch
play/2026-10-12/current-package-status.md; AGENTS.md and .agent/PLANS.md.

## Non-goals

No main merge/push/publication, engine/dependency change, W12-W29, asset pack,
teleport, free resources, collider shrink, auto-resume, global timeout increase,
silent Golden rewrite, old evidence overwrite, or terrain/wreck authority change.
Wind/PV remain explicitly unsupported unless an authoritative observation path
is separately justified; no nominal-to-actual power substitution.

## Architecture decision

/root owns integration and acceptance. At most one Pi executor writes shared
Clock/Physics/Factory/Save paths at a time; no second writer is dispatched yet.
The current Pi discovery child is read-only. The task uses the configured Pi
launcher and opencode-go/gemini-4-argon-contributor, high thinking. A task-local
adapter in E:/DEV/Weltraum-Spiel/FP06-Pi registers Pi's existing Google API;
global providers, credentials, caches and package installations are unmodified.

Clock policy and public canonical contracts stay unchanged during baseline.
Any needed Clock policy or internal representation change requires a compact,
versioned decision BEFORE its patch, preserving confirmed ticks, material,
energy, bounded CPU, explicit pause/focus/resume, and hard-error stops.

## Implementation phases

1. V00: establish HEAD, local preservation, ownership, tooling, LFS and entry.
2. V01: reproduce ordinary start/walk/pickup/walk unloaded and loaded, separating
   cold/warm runs; run the unchanged original paid-band pair. Measure actual
   callback gap/backlog/steps, KCC, Rapier, queries, readback/IPC and main-thread
   domains separately. Baseline plus one short profile per proven bottleneck.
3. V02: at most THREE justified candidates per cause; repeat the SAME unprofiled
   checks after each. Separate validation, transformation, serialization,
   canonical hashing, commit recomputation and test-oracle cost. No blind cache.
4. V03-V05: ordinary connected build and fresh legacy 16 kg loop, power loss,
   output blockage and resumption; then combined save/restart and small confirmed
   UI/energy/asset gaps. Preserve ownership/quality for partial stacks.
5. V06: fresh clean-copy install/build/start with real LFS, README_PLAY, real
   input recording/screenshots and separate honest result dimensions.

## Tests and evidence

App working directory: apps/weltraum-browser.
Original test: npm run test -- tests/unit/factory/dryFactorySlice.test.ts -t 'W09 paid-band'.
Original limits/inputs/assertions stay unchanged; duration is not an FPS claim.
Fresh build: npm run build. Browser: npm run dev -- --host 127.0.0.1 --port 5195 --strictPort,
then /factory.html, no TestBridge or state/pose injection. Use existing native
read-only diagnostic datasets and configured Playwright runtime tools.
Evidence goes only to evidence/factory/play/2026-10-15/review-continuation/.
Do not run CPU profiles concurrently with acceptance measurements.

Hardware: AMD Ryzen 9 7950X3D (16 cores/32 logical), Radeon RX 7900 XTX;
Windows also reports AMD integrated graphics and Remote Display Adapter.
Node v24.19.0, npm 11.17.0; previous cloud Node22 results remain historical.
Actual browser renderer must be read before claiming hardware performance.

## Risks

Permanent holds can amplify transient scheduling gaps. Domain composition may
consume the Factory step budget. Existing public fail-closed checks, custody,
canonical bytes, finite energy and IDs cannot be weakened for speed. Missing
normal play/save evidence cannot be replaced by tests, files or prior results.

## Rollback / safe stop

Preserve each failed candidate's diff/results before an exact manual reversal
of only our changes. Stop product mutation after three failed candidates in a
cause area; return the cause/contract decision, never attempt a fourth blind fix.
Do not reset, clean, delete, merge or overwrite another writer's work.

## Progress log

- [x] Current remote candidate/control read and cloned separately from old main.
- [x] Real LFS pull and locked npm ci completed; tracked checkout clean.
- [x] Requested Pi model works after task-local adapter; bounded local scout finished.
- [x] Newer-local-work search received; V00 source/lock preflight accepted.
- [x] V01 ordinary reproduction and unchanged pair measured; R03 Hold14034 reproduced and measured, later continuous R20 passed without a new Hold.
- [x] V02 fifth-build memory cause corrected/replayed; bounded composition investigation closed with modest C02 exact-byte reuse.
- [x] V03 normal fresh 16 kg loop and interruptions pass (R16/R17, exact16kg balance).
- [x] V04 combined save and actual browser restart pass (R17 WIP+packet, R20 ten owners, R24/R25 final-run Save15 and restart, R26 current-source complete before-Play Save18 parity).
- [x] V05 functional integration gaps closed: actual R25 M/Map/Close/explicitPlay, R26 available-vs-loaded; V06 clean-r20 install/build/start/newChromeContinue/fullSaveparity passed. Smooth-frame performance and human art/fun review remain explicit open limits.

### Resume, 17 October 2026

HEAD and all product/original-test sources remain unchanged. The original pair
passed (2 PASS, 39 filtered SKIP, 5.94 seconds tests) on 15 October. Actual
341 kg pickup/transport/depot and later paid native Former/Cutter installation
retain 2,984,400,000 mg. No native hold reproduced so far on this hardware.
The direct-spawn pickup rejects CarrierSupport; walking to the existing
supported stand succeeds. No terrain/clock change follows from that result.

The old browser process ended during interruption; its unsaved state was lost.
This is not a combined-save test or PASS. Live headed replay drift and a startup
pointer-lock rejection are preserved as harness/environment limitations; the
fresh isolated headless browser now uses normal UI/keyboard input with video.
Chrome 155.0.8059.82 reports ANGLE Direct3D11 on AMD Radeon RX 7900 XTX.
The headed browser has been navigated to about:blank to remove its runtime load.

Pi cost-harness writer: cb02928e-3c25-4b8d-8ee7-c41e5cce90f2, diagnostics ONLY.
Pi independent plan/code reviewer: 249f1ec3-0919-4b3c-8523-8feb97407c05, read-only.
No product implementation writer has begun. The strictly opt-in cost harness
passed independent Pi review after adding explicit activation and exclusive
evidence creation. TypeScript passed. One instrumented/profile-requested run of
the original pair passed (1.959 / 4.063 seconds, original 5 second limits).
No V8 CPU dump was emitted; this is function-level attribution, not a CPU
sampling profile. Preserve that limitation and the attempted run. No second
profile is authorized by silence or by the missing dump.

Preparation p50 was 46.69 / 49.13 ms (p95 56.52 / 67.55 ms; maximum
284.16 / 277.95 ms); commit p50 was 2.18 / 2.34 ms. Supply p50 was
3.45 / 3.49 ms. Per-test canonicalJson exclusive time was 703 / 1410 ms,
canonicalSignature exclusive time 331 / 583 ms, and hashing 92 / 207 ms.
The private dry evaluator residual includes unwrapped validation/clone work;
it cannot be labelled pure transformation. Test wall minus wrapped root time
was 10.75 / 8.89 ms, an upper bound, not an isolated assertion measurement.
Final proposal state bindings are approximately 4.78 million UTF-16 units.

The isolated normal playthrough installed paid Former and Cutter with unchanged
mass. At tick 3719 the subsequent 50 kg battery transport is blocked by an
identified Cutter collider (CarrierSweep); a westward detour is also rejected
(CarrierOverlap). No terrain/collider/clock modification follows automatically.
The browser was closed before domain timing; its unsaved session was not a
save/restart acceptance test. Product performance candidates used: 0 of 3.

17 October delegation boundary: automatic approval review rejected a new Pi
planning request because it could transmit source and diagnostics to Gemini's
external endpoint. A specific user approval question is pending. No equivalent
external delegation is attempted until authorization is resolved; local
inspection and planning continue.

The user subsequently explicitly approved the affected source/measurement
transmission to Gemini Argon at https://opencode.ai/inference/go/v1 for this
FP06 task; credentials remain excluded. Existing Pi writer/reviewer resumed
bounded read-only plans for composition cost and the fifth-build budget stop.

### Additional ordinary build result, 17 October

The independent power-first diagnostic installed a paid 50 kg battery, a paid
25 kg distributor, the 341 kg Former and the 40 kg workbench, all in one session.
The distributor's original default overlaps the battery (FACILITY_OVERLAP).
Normal build arrows admitted [-4750,1500,2500], q1, inside existing terrain;
both paid power objects coexist. This is a diagnostic placement, not an approved
replacement default: its 2500 mm cable demand lacks a selectable closed cable
package. The simultaneous normal wiring problem remains OPEN.

The fifth build, paid Cutter, then failed before adoption:
`HVP scene BudgetExceeded: 268626378 CPU bytes exceed 268435456`.
The installation list remains at four, construction Ready, Native Idle, the
208 kg kit remains deposited, and total material remains 2,984,400,000 mg.
Tick 6448, 1074 confirmed Factory steps, no SimulationHold. The workbench route
needed z=6.25 to stay inside the existing ground edge; z=6.515 was physically
blocked. No support/collider edits or position injection were used.

Local source inspection identifies a concrete accounting hypothesis:
`admitFactory` in hvpBootstrap.ts adds the new import peak to a scene ledger that
still includes initial mesher scratch (149,622,408 bytes). The adjacent mature
`estimateHvpStageCpuBytes` explicitly removes expired mesher scratch and includes
the preparation reserve for later transactions. Reuse must be checked against
actual allocation lifetimes, Native coexistence, rollback and true-over-budget
rejection before implementation. The resource cap must remain unchanged.
No patch has been made and no memory candidate has been consumed.

Evidence: power-first-budget-2026-10-17.json (180 real UI/key events) and
07-fifth-facility-budget-exceeded-1792236665757.png. Current session is explicitly Paused;
no combined Save exists and browser-restart success is NOT RUN.

### Memory-R01 accepted; next implementation route pending

One-line Pi product patch in hvpBootstrap.ts reuses estimateHvpStageCpuBytes;
23 added test lines cover real admission rejection/retry and unchanged limits.
Fresh TypeScript PASS; targeted Factory/resource tests 6 PASS / 47 filtered SKIP;
unchanged original paid-band pair 2 PASS / 39 filtered SKIP (6.14 s tests).
Fresh normal paid five-facility reproduction now PASS, tick 5027, full mass
retained, Native Idle, no carrier, Former13/Cutter12 visible parts, no modelError
or SimulationHold. Read-only native exact-diff review: no blocking findings.
See MEMORY_R01.md and memory-r01-normal-build-2026-10-17.json. Memory candidate
1 of3 accepted; composition candidates remain 0 of3. No cap/Clock/Golden change.

Pi provider stopped after writing this patch with GoUsageLimitError, limitName
`5 hour`. No alternate provider was started. A user question asks whether local
Codex implementation may continue; existing permitted verification completed
while that route choice remains pending. The broader task is NOT complete.

Next composition plan considered two-phase private canonical capture without
freezing serialization-only clones, keeping exported frozen canonicalization,
all validations and public bytes. Direct fused streaming was rejected in plan
review because it changes getter/encoding timing. No serializer patch exists.
Any adopted private-capture policy must be explicit before its candidate patch.

The user now explicitly authorizes local Codex continuation. COMPOSITION_C01.md
adopts the bounded private-capture policy; native implementation/review lanes
continue with one writer and /root as sole shared-runtime integrator.

### Current verified continuation, 17 October (appended; earlier attempts remain historical)

Local Codex continuation was explicitly approved after the Pi Gemini five-hour quota. MEMORY-R01 remains accepted. COMPOSITION-C01 was rejected/reverted with its patch retained; C02 retains an owned immutable state's already known canonical bytes and passes unchanged external tamper/replay guards. The original unchanged paid-band pair measured 5.91 s tests / 6.36 s total versus 6.14 / 6.77 before; one observed comparison, not a statistical/FPS result. Composition candidates 2 of 3 used; no further profile of that cause.

The first actual SimulationHold is R03 tick 14034 carrying paid BELT4 after six facilities/two paid links. Callback gap 98.2 ms, prior Read handler 34.2 ms, advance 1.9 ms. One sealed 15-second held Worker profile attributed repeated immutable Factory profile reconstruction inside Read (overlapping inclusive groups, not proof of the entire external scheduling gap). NATIVE_READ_R01 reuses the existing immutable profile cache and per-Read current-part proof, retaining live support/membership/LOS checks. The complete facility suite and focused UI projection passed, then R04 normal play reached tick 28461 with no Hold/Resume, unchanged 2984400000 mg. Same-six-installation phase Read median observed 10.2 ms before / 3.1 ms after; max R04 callback gap 54.8 ms. Manual pauses mean this is not continuous 15-minute acceptance.

R04's next stop is physical CarrierOverlap on 50-mm steering near the Cutter's 1-m hull passage. NORMAL_LAYOUT_R01 and ProductStorage R02 remain accepted. R03 Distributor east-shift was source-tested/reviewed but actual R05 preview rejected SUPPORT_MISSING; its source patch is archived/reverted. An unimplemented west-axis alternative also lacks the Former support mask and is not granted. CARRIER_MOTION_R01 is the bounded contact-prefix candidate with unchanged paired guard, full colliders and no Clock/tolerance policy change; two independent read-only source plan checks supplied required exception/coverage/vertical-state corrections before its four-path writer grant.

COMBINED_SAVE_V1 Unit1 pure validation/codec/store has 11 fresh passing tests (28.55 s tests / 30.04 s total; paid fixture setup 7541 ms) and TypeScript PASS. Earlier source errors/test failures remain in separate logs; the long new paid test was split with one shared setup, all assertions preserved, no timeout increase. Final exact source review is pending. Native capture/hydration, Factory owner restoration, Save UI, cold Continue and actual browser restart are NOT IMPLEMENTED/NOT RUN. No fresh 16-kg production or clean-copy acceptance is claimed.

### Contact passage accepted; real belt admission failure isolated

Unit1 pure codec/store is now separately accepted after the identity repair and paid5/5 affected-group recheck (earlier full11/11 plus TypeScript retained). MotionR01 passed27 locomotion and61 full facility cases, TypeScript/build and independent final source review. Fresh R06 actual six-facility/two-link play transported full26kg BELT4 through the original west Cutter stop and deposited it [-6250,1500,1500]. Tick21501, unchanged2984400000mg, no Hold/Resume/TestBridge. Max callback44.9ms at passage; global maxAdvance10.6ms remained unchanged from startup, only an upper bound. No second Read CPU profile.

R06 then found a real integration bug: both current solid ports/parts/Host and the normal button are admitted, yet clicking the paid connection rejects NativeBeltEndpointUnavailable. Public confirmation depends on session.isQuiescent; the command sets its own commandBusy then invalidates its next helper header read. BELT_ADMISSION_R01 captures the genuinely confirmed admission header before its own synchronous barrier; no await/public confirmation override or Native-proof reduction. Realistic self-busy Host RED1fail4pass, same focused call GREEN5pass67skip, independent exact diff accepted. Actual fresh browser connection is still open. R06 is closed with full437-event report, screenshot14 and video; no unsaved scene was hot-patched.

Native Save Unit2 writer1 now owns its exact five Native source paths and focused tests; writer2 completed the disjoint two-file belt fix. No third writer; root sole common-runtime integrator. Unit3 owner capture/restore is being planned read-only. Clean-copy export helper is syntax-checked only; actual export/install/start and combined persistent restart remain NOT RUN. All caps stay16MiB transport/64MiB decode/256MiB CPU; a shorthand12MiB in a plan handoff was explicitly corrected before any source grant or cap change.

## Definition of Done

### Save integration verification, 17 October 20:17 local

Native Unit2 capture/hydration and Unit3 Factory owner restoration are implemented; complete runtime acceptance remains open. Fresh targeted same-world restore now passes: Native tick342, Factory Ready tick342, zero remainder and57 total steps after exactly four new ticks. The earlier W09 fixture battery obstructed the Former output sweep; only this newly added fixture was moved to the already accepted V5 battery point and its actual cable length remains paid. Historical failures remain separate.

The integrated initial run had84 PASS/5 FAIL. Three Bootstrap failures were corrected at their source/assertion boundary and the focused three-case recheck passed; the restore mount/cleanup and remainder tests now pass on actual restored Physics sessions with real terrain support. TypeScript passed after the two reported type fixes. Codec/owner admission changes made later still require their focused checks; this is not final integration acceptance.

The existing normal-route IndexedDB browser test passed1/1 (2.8s test,4.9s total), proving deferred exactly-once commit guard, abort preserving prior bytes/revision, matching/stale CAS, reload, checksum corruption detection and isolated write-result bytes. Original fixed-name summary files were copied before the test wrote its new results. Sandbox-local Vite announced ready but localhost timed out; the stopped attempts changed no product source. Running the same local test outside that sandbox succeeded. Combined Factory Save/Continue, actual browser-process restart, the fresh16kg balance, continuous15-minute play and final clean-copy startup remain NOT RUN.

Real clean-copy start, a continuous normal flow targeting 15 minutes without an
unplanned permanent hold, the paid fresh 16 kg legacy balance, power/blockage
recovery and a combined save resumed after the browser actually closes/reopens.
No success claim until fresh execution proves each required dimension.

### Actual clean-copy R07, 17 October 21:10 local — NOT COMPLETE

The materialized current candidate exported860 files with SHA256 checks into `E:/DEV/Weltraum-Spiel/FP06-Clean-Acceptance-2026-10-17-r01`. Offline locked `npm ci` installed59 packages; `npm run build` passed, including TypeScript. The built `/factory.html?hvpMeasure=1` started through Vite preview5197 in a dedicated persistent Chrome profile. No TestBridge or state injection. The four focused Bootstrap cases now pass (three together, then the new Save case alone); historical fixture/parse/expectation failures are retained. The new Save test intentionally breaks a witness and correctly expects RecoveryHold, rather than ordinary rejection recovery.

Normal real UI/key input paid for Battery, Distributor, Former341kg, ProductStorage and Workbench, plus Battery–Former8.5m and Battery–Distributor5.25m cables. Workbench's initial normal west path stopped at the north terrain-pad edge; moving0.20m south cleared it and the default bench installed without a layout/collider change. Mass remained2984400000mg, Native tick10169, no SimulationHold or Resume. The visible Power note explicitly marks the battery-only prototype.

A preliminary combined Save with four facilities and carried Bench40kg completed Native capture (774.3ms, paused) but rejected its CPU/decode budget before the full admission metric. A subsequent Save rejected the Native client's generic idle/neutral pre-RPC gate; the pending-Read hypothesis is source-plausible but NOT PROVEN. No slot was written. Cutter208kg pickup after five facilities then reproducibly rejected its stage CPU admission: R120989816 + T19774932 + U133184 + K51767038 + Native96MiB100663296 =293328266B, versus268435456B. The earlier four-facility raw Save sample was R114300530/T11078480/U121200/K26615918/early total253627824B. These are logical allocation charges, not heap measurements.

One bounded diagnostic refinement is authorized: split existing K into its already-held cache families without populating or evicting them; surface complete Save D/P/counts before either existing cap rejection; attach failed Native pre-RPC gate terms to opt-in diagnostics without changing the visible error or guards. This changes no Clock, representation, format, cap or timeout. A same-workload clean replay will determine whether a proven alias or unnecessary retained cache can be removed. Do not assume the aggregate K jump belongs to C02 or waive any count. R07's403-event failure report and rendered captures are preserved. Full16kg production, WIP/belt Save/restart and15-minute continuous acceptance remain NOT RUN.

### R08 diagnosis and bounded corrections, 17 October 21:40 local

Clean r02 repeated the normal five-facility/two-paid-link route, reaching Native tick9723 with unchanged2984400000mg, no Hold/Resume/TestBridge and max Running timer gap26.9ms. Both paused tick8779 Save attempts had every idle/neutral/ack guard true except one pending Read and its busy flag. This proves the pre-RPC race. No slot was written. The five-facility Cutter pickup rejected at293323106B logical CPU charge; K51766998B consisted mainly of39541624B cached canonical descendants and9887568B retained state bytes, plus2337806B smaller owners. The captured state bytes matched Root lastStep, but string equality alone is not an ownership proof.

MEMORY_R02.md explicitly uses composition candidate3of3 / memory candidate2of3: do not memoize canonical strings above1MiB UTF16, and omit a duplicate private state-cache charge only for an exact committed owner marked when both references receive the same produced string. Public canonical bytes, validation, Root lastStep, cold equal-string charges and all caps remain. Fresh complete Dry suite44/44 passes; original same paid-band pair2/2 passes at6.73s tests/7.15s total versus6.23/6.65 before (one observation; CPU tradeoff, not FPS). Independent source gate accepts this policy. Actual postpatch K and full Save are pending.

R08 also proved repeated identical Save rejection could leave only the deduplicated UI confirmation dataset stale. Capture release now invalidates the observed Host header before its normal notification; three selected real-session tests pass, independent source gate accepts. No simulation/authority changes.

SAVE_READ_DRAIN_R01.md reserves the existing mutation barrier, drains only the exact already-pending harmless Read under its unchanged20s deadline, and rechecks every admission guard. Native input suite47/47 and candidate/clean-r03 TSC/build pass. Final source review found an additional post-Checkpoint-ACK input/dispose race; the same writer is adding a final guard and two delayed-ACK tests before runtime acceptance. Clean-r03/R09 reached New game paused tick0 only. No successful combined Save, saved browser restart, complete16kg or continuous15min claim is made.

### R09 real Save and process restart, then six-facility limits

The post-ACK guard is accepted by independent source review; full Native input suite49/49 passes (3.52s tests/4.72s total). Clean-r04 exported860 current materialized files, locked offline npmci installed59 packages and TSC/build passed. R09 loaded this production copy normally, without TestBridge, pose/resource injection or source hot-patch.

Three paid installations (Battery/Distributor/Former341kg) and two paid links8.5m/5.25m reached tick5001. Actual UI Save succeeded revision1: P1077297B, early CPU210890794B, full CPU233552764B, R107026772/T2423174/U2674320/K2044962/D39322048. A preceding actual3-facility Stage sample had K2286232B with canonical-descendant cache3466/state-cache0, consistent with the accepted retention correction; this is not the same workload as the older5-facility sample. Paused Native capture771.2ms produced a779.5ms timer gap with advance0; this is not a Running SimulationHold.

The persistent Chrome context/browser actually closed and emitted disconnected=true. Reopening the same profile/origin and using actual Continue restored Paused5001 with Factory833steps and identical player position/mass/energy/IDs. Before Play, explicit Save produced revision2. Full NativeCore JSON has0 differing leaves; NativeFactory/profiles/Host and Factory domain/material/installations/links/commandReceipts/lastReceipt/lastPower/selections/waitingStarts are exact. Only expected publicationRevision2677to2680 differs. No offline work or automatic Resume.

Explicit Play continued normal paid ProductStorage, Workbench and Cutter208kg construction to6installations. AtPaused10335/Factory1722, mass2984400000mg, the next RawStorage60kg pickup reproducibly rejects269255030B CPU versus268435456B. Six-installation Save independently rejects its transport budget; prior revision2 survives. No full P is reported: normal Continue navigation dropped the opt-in measure query, and the bounded preflight rejects before full metrics. No invented measurement or extra CPU profile. R09's435-event report and rendered stop remain preserved; live R09 stays paused.

MEMORY_R03.md is the final bounded memory candidate: independently proven stale per-installation full-world transaction-capture charges outlive their owners; separate temporary lifetime as the mature carrier path already does, preserving real resident/import/Native reserves and uncertain capture charges. Writer1 owns only Bootstrap and focused tests, Root sole integrator. The independent transport problem requires the explicit lossless compact-receipt/checkpoint-V2 proposal in COMPACT_RECEIPT_V2_DECISION.md; schema approval is pending user, no V2 product writer grant or slot migration. Full16kg, WIP+packet Save/restart and continuous15min remain NOT RUN.

### MemoryR03 executed acceptance, 17 October local

Independent source/test gate accepts the exact Bootstrap lifetime correction. First focused3 tests had2PASS/1FAIL because the newly added W07 expectation incorrectly included still-resident material bytes among retired capture bytes; only this new expectation was corrected. The same3 then PASS (21.82s tests/23.62s total). First clean-r05 TSC correctly rejected two new Ghost fixture literals missing required transactionId; those two test literals were fixed in Candidate only. Candidate TSC/build and new untouched clean-r06 offline npmci/TSC/build PASS. Clean-r05 remains the historical failed copy. No old Golden or timeout change.

Fresh R10 normal New game used clean-r06 and a new profile, retaining opt-in measurements throughout. Normal paid five-facility/two-link Cutter pickup now admits R98951520/T19770166/U132816/K2341280/Native100663296=221859078B. Comparable R08 was293323106B with T19770180/K51766998/R120989816. Thus this observed same-route phase is71464028B lower; the optional cached text and expired capture reservations explain the changed charged terms, not extra resources or raised caps. Cache descendants now3474B and private state alias0; full historical strings still remain in raw T.

The original next six-facility RawStorage60kg pickup now succeeds at233412210B (R100904972/T29300930/U148880/K2394132/Native100663296), versus R09's269255030B rejection. Normal carrier route direct south atX−5.89 met the actual floor shoulder; northZ12.175 then westX−7.25 before south succeeded. BIN actually deposited[-7250,1499.99988,9750], normal east exit and RawStorage default build succeeded. Seven paid installations, Native17963/Factory2993, mass2984400000mg, noHold/Resume/TestBridge. No asset model errors in the actual7scene census.

Further normal play acquired full26kgBELT4 from the grounded south cargo stand near[-6.219,9.993] and set it down at actual[-7000,1499.99988,8500]. The macro's axis timing overshot the east floor edge while exiting, leaving the real player grounded below the shoulder. A prior normalSpace jump had successfully restored the player from that shoulder; no pose injection. App-versus-automation input-delay cause is NOT ATTRIBUTED. No layout/collider/Clock change was made. R10 remains PAUSED24439 with7installations and the paid Belt depot; no extra Source candidate or profile. The first509event report and52event continuation remain separate. R09's actual saved three-facility slot revision2 remains intact in its own profile and its second context closed/disconnected with finalized video.

Scope remains NOT COMPLETE. New compact stored schema approval is pending the user; no V2 product write or automatic slot migration. RawBelt connection, MidBelt, remaining power, fresh16kg/power/output-blockage sequence, WIP+packet Save/restart and continuous15min remain open. All writers are quiescent; Root owns the paused runtime and next integration decision.

### V2 directly approved; bounded implementation active

The user explicitly replied `V2 mit V1-Kompatibilität freigeben (empfohlen)`. COMPACT_RECEIPT_V2_DECISION.md is APPROVED and V2_IMPLEMENTATION_CONTRACT.md fixes the exact representation, V1 compatibility, issued-owner and unchanged-budget boundaries. Two disjoint product writer leases are active; Root remains the sole shared-runtime integrator. No fourth composition/memory cache candidate, additional CPU profile, automatic migration or limit change is granted.

R10's ordinary D+Space input recovered the player from the terrain shoulder to grounded[-7.125128,2.400038,9.595070], Paused24595/Factory4099, seven paid facilities and full26kg BELT4 deposited[-7000,1499.99988,8500]. Passive input timing observed348ms D-down acknowledgement and429ms D-up acknowledgement; DOM D held729.2ms. This does not attribute delay solely to the game; the normal action also contained Space and automation acknowledgements. No pose/collider/Clock modification. The final567-event report has no page errors; the real R10 persistent context closed with disconnected=true and finalized video. Its unsaved scene is not claimed as a restart success. R09's distinct V1 revision2 slot remains intact for later compatibility acceptance.

Next gate: quiescent V2 source review and focused tests against clean-r06, then a fresh clean-copy normal replay. Full16kg, WIP+packet Save/restart, final UI evidence and15-minute continuous play remain NOT RUN.

### V2 integration verified, 18 October; actual acceptance next

The current candidate still has HEAD7ee85b0 and all newer local work. Two disjoint writers are quiescent. Independent final source gates accepted Codec/Store/Bootstrap and Dry Owner after correcting M1 replay, immutable F/Owner issuance, mandatory import/materialize admission, strict legacy bytes/decoders and full preallocation/retained-generation accounting. The remaining Session integration gate found an unissued checkpoint Getter read before its assertion; the shared pre-read was removed, keeping the old error/listener test and adding GetterCalls0.

Fresh Root results: TypeScript r03 PASS and final npm build PASS; complete Dry55/55 PASS (12.06s tests/13.04s total), complete Checkpoint/Store17/17 PASS (41.02/42.68s), OwnerRestore first1FAIL then unchanged original plus new Getter regression2/2 PASS (0.041/1.90s), complete Host79/79 PASS (46.55/47.97s), selected Bootstrap24PASS/33filteredSKIP (146.11/147.81s). The exact unchanged original paid-band command separately passed2/2 with53filterSKIP,6.20s tests/6.66s total; no FPS or100ms claim from test wall. TSCr01/r02 failures remain in their own logs; fixes preserve public V1 defaults rather than casting old tests. Build has the existing large-chunk advisory; no timeout/cap/Golden change.

Direct user now requests additional Pi advisory/review using OpenCode-Go DeepSeek v4.1 Flash. Exact model was discovered through configured Pi/Paseo, the unchanged existing local daemon started, and read-only advisor eb04a70c-fd51-4110-b1e4-480d5c08d8ab ran with pi/opencode-go/deepseek-v4.1-flash/high. No writer/runtime grant. Its initial nested-F concern was withdrawn after a concrete V1/V2 differential check: the described property is shared, not a new V2 regression. Claims that only Git commits can bind the source are not adopted: the immutable clean copies and complete per-file SHA256 manifests bind actual local work without resetting/staging it. No extra CPU profile.

Normal route order is now explicit: first six facilities and initial paid power, then carry/connect the MidBelt through R06's actual west passage before RawStorage and RawBelt. Later RawStorage's real body blocks that entry, so the existing machine/transport hint now explains the order without hidden coordinates. This is source/previous-input evidence; the full new route is not yet claimed.

Next: materialize a NEW current clean copy, locked offline npmci/build/start, fresh normal R11 UI/key replay. Complete16kg with power/output interruptions, actual WIP+packet Save/closed-browser Continue comparison,15-minute continuous runtime and final rendered acceptance remain OPEN/NOT RUN. Root freezes product source and owns that runtime window; no heavy tests/profiles alongside Running gameplay.

### R11 real V2 acceptance and paid power receipt diagnosis, 18 October

Clean-r07 materialized860 source/asset files with individual SHA256 verification; locked offline npmci, TypeScript and build passed. Normal keyboard/UI play built six paid installations and two paid cables without SimulationHold, free resources or TestBridge. Same-phase Cutter pickup logical charge fell from R10's221859078B to211150064B (10709014B lower); this is the admission ledger, not measured heap or FPS. Existing Clock source remains unchanged.

Actual V2 Save1 at Native5042/Factory840, three installations/two cables, succeeded with1077353 wire bytes and220495532 logicalCPU bytes. IndexedDB readback confirms lastPower=null and lastStep=null, with two full eleven-field paid outer links. The later six-installation Save passed gates at10395119 wire bytes and239845080 logicalCPU bytes, then rejected `Saved power link malformed`. Previous revision1/hash remained intact. Full event/admission report, failure screenshot and actual closed/disconnected browser/video are retained; unsaved progress is not called a restart success.

The owned preview server session30866 ended with exit1/no diagnostic output; the first MidBelt pickup failed with `Failed to fetch`, subsequent asset request proved ECONNREFUSED. Same clean-r07 server restarted as owned tty session11609 and asset200 was confirmed. No gameplay Hold attribution follows. Deliberate paused Save/read stalls are separately recorded and are not Running SimulationHolds.

Independent read-only native and requested Pi/opencode-go/deepseek-v4.1-flash checks agree: normal paid link objects have eleven keys, while lastPower decoding accepts only five; the prior test fixture projected away paid metadata. PAID_POWER_RECEIPT_R01 grants one writer only checkpoint.ts/direct test: fully validate outer paid links first, allow exact eleven-key nested entries only canonical-equal to the corresponding validated paid link, keep legacy five-key acceptance and raw canonical bytes unchanged. No caps, schema, Clock, Golden, historical resource authority or topology changes. Root is sole integrator/runtime owner.

The old R09 V1 revision2 slot was actually opened with the new clean-r07 V2 loader: Paused5001/Factory833, three owners, same mass/SOC/neutral input, no errors/TestBridge. Complete stored record before/afterContinue was unchanged; browser closed/disconnected and video finalized. This verifies compatibility at that real checkpoint, not production/WIP acceptance.

Next: targeted RED/GREEN, unchanged full checkpoint/TSC/build and exact diff review; new clean-r08. Continue from the retained legitimate Save1 on its original profile, rebuild paid remaining setup normally, carry MidBelt before RawStorage, finish fresh16kg with interruption/WIP+packet restart and15-minute runtime. All those final acceptance gates remain open.

PAID_POWER_RECEIPT_R01 source gate: exact old guard RED reproduced; earlier EPERM/fixture re-signing error and first test5s timeout are retained. Tests were split with shared costly setup, no timeout raised. Focused6PASS/16filtered; Root fresh full22/22PASS (51.74s tests/53.09s total) and TypeScript PASS. Both independent native actual-diff review and requested Pi DeepSeek actual-diff review PASS. Pi withdrew its inaccurate claim that the old decoder projected links: it already returned raw objects, which remain unchanged. Root does not adopt an extra test enshrining forged legacy data; legitimate five-field admission remains covered and unchanged. Writer lease released. New clean-r08 exports860 files with full SHA256 checks; offline locked install59packages passed. Runtime acceptance still pending; no source-test wall-time improvement claim from these checks.

### R12 actual paid receipt fix and next render-admission blocker

Clean-r08 build PASS. Actual browser Continue from R11's retained V2Save1 restored Paused5042/Factory840, same three owners/mass/SOC, unchanged complete stored record. A diagnostic-query reload before any Play was initially cancelled by the normal unload guard; the observational navigation was terminated, state stayed Paused, then the existing dialog was accepted explicitly and the SAME saved slot reloaded with hvpMeasure=1. No offline work, state import or Resume shortcut.

Normal explicit Play generated the previously failing non-null eleven-field paid power receipt. Save2 succeeded (P4518269B), then normal paid rebuild of ProductStorage/Workbench/Cutter and confirmed Factory step produced actual six-owner Save3 PASS: P10394611B, totalCPU248961800B, two full eleven-key supply links, hash550a61bf5893840eb59e48db5e84548dd28375b01e06af2e02ad29f6ca6b8ab0. R11's old same-phase failure was239845080B; R12 began from a restored world with higher retained R, so these totals are not claimed as a size/performance regression or improvement.

Full26kg MidBelt normal west transport reached contactX-8.750287, southZ2.45, deposited[-6250,1500,1500], then actual enabled CutterOutput→FormerInput4m button committed seven paid owners. This closes the actual BeltAdmissionR01 retest. Rendered Machines evidence distinguishes material and power: CutterOutput=true/Power=false; FormerInput=true/Power=true. Power panel actually renders battery-only/no wind/solar feed guidance. Existing full colliders/support/custody held, no pageerrors/TestBridge/SimulationHold.

RawStorage60kg kit was normally transported and deposited[-7250,1500,9750]; normal eastX-6.2413 then southZ9.9993 exit stayed grounded. Default RawStorage previewPrepared, but confirm held with `HVP scene BudgetExceeded:312 draw calls exceed300`. Seven owners/material/depot unchanged. This312 is conservative render-import admission including the retained peak, not measured GPU draw calls or FPS. No cap change granted.

Cancelled the uncommitted preview normally, then actual Save4 PASS with seven owners+depositedBIN: P10957316B, totalCPU252980486B, hash9f6c3fa1e9cad6feb4c50cbf9dcc009624825ec0f9acdbf14db406a8c2d8b923. R12 closed/disconnected and video finalized.277events/no pageerrors/48admission samples/drop0 retained. Next bounded discovery is existing per-semantic-part opaque vertexcolor batching, preserving GLBs/partIDs/Native motion/positions/normals/indices/bounds and300cap. Full9+brace+ghost/variants must pass the actual admission model before a source grant. GameDev CLI/sealed-run workflow remains unavailable; no tool installation, GPU timing or extra CPU profile claimed.

### R14 normal nine-owner build passed; production command confirmation blocker

OPAQUE_VERTEX_COLOR_R01 passed Root full Loader/S1 100 tests, relevant Bootstrap25 tests (33 filtered), TypeScript/build and independent native plus requested Pi final source reviews. New clean-r09 copies860 current files with individual SHA256 verification; offline locked install59 packages and build passed. Same saved seven-owner scene had exact scenesDebug equality and unchanged saved hash before Play. Factory draw admission119->59, mesh427680->617760B, CPU16602604->16968940B, triangles3960 unchanged. These are conservative accounting values, not GPU/FPS measurements; same-camera screenshots were inspected. Ordinary RawStorage and RawBelt builds now commit, completing all nine paid owners. The actual real-GLB composed peak test is298<=300 with caps unchanged.

R14 ordinary cable transport paid both remaining belt power links: five paid cables total29500mm,10500mm remain. Explicit Play completed the MidBelt restart, both belts allocate100W. Actual Save6 with all nine owners and non-null complete paid power receipt passed: P11759007B/totalCPU257365944B, Native20018/Factory3336. First RAW8 was normally picked up, set down, transferred whole into RawStorage, split2kg back to accessible Wreck and returned2kg, merging to the same8kg lot/ID. A partial2kg transfer out of a deposited Native carrier was correctly rejected PartialCarrierTransferUnsupported with no material change; the existing whole-payload custody contract was preserved. Ordinary belt delivered the exact8kg into Cutter Input.

At grounded player[-5.903154,2.400075,5.479422], Cutter inspect shows Ready and enabled Start; click actually rejects ProductionMachineUnavailable. Independent source diagnosis finds submit captures a confirmed header, then sets commandBusy=true; factsFor rereads host whose confirmation includes session.isQuiescent(), now false because of this command itself. Native support/service/reach are valid. A separate actual enabled Cutter-disable click likewise rejects NativeDeviceControlUnavailable, Cutter remains enabled: set-enabled rereads self-unconfirmed Host after its awaited pause. These are command-admission bugs, not Running SimulationHolds or missing resources. No material/WIP changes occurred.

Actual Save7 retained the delivered8kg input and complete nine-owner/power state: Native23410/Factory3901, P11880783B/totalCPU257632982B, sha256:aa9410a133bfb63751552442b6bf966d729d1402c43589e09d2ab3dd0c391c61. R14 actual browser process closed/disconnected; profile and video retained. No page/network errors. r14-nine-paid-owners-raw8-production-stop.json and r14-real-browser-close-production-stop.json preserve events and both rejected actions. Paused checkpoint stalls up to745.5ms with advance0 remain distinct from Running holds. Clock remains unchanged.

Next bounded source plan is private per-command confirmed-header use for synchronous production preflight and separately fresh post-pause validation for set-enabled. Genuine unconfirmed/support/service/busy/pause-drift rejection must remain. Root sole runtime integrator; no schema/cap/Clock/Golden changes, no extra CPU profiles. Fresh16kg production, power/output interruptions, WIP+packet actual browser restart and15-minute continuous runtime remain OPEN/NOT RUN.

### Production-command R01 passed source and real control reproduction; distinct Belt cursor hold

One private Host-header correction in factorySession.ts plus existing hostLifecycle tests: synchronous start preflight uses its already confirmed admittedHeader; the set-enabled path keeps busy across awaitpause, opens the private flag only for one pure synchronous host.read with immediate finally restoration, then retains all fresh confirmation/current/Paused/binding/Native checks. Existing Bootstrap hostPort2675 binds that exact pure local read. No public confirmation/Clock change. Writer RED2 failures and focused GREEN8/74filtered are retained in its tool history (no separate RED/GREEN log files were created). Root full82/82PASS,47.76s tests/48.99s total; TSC and clean-r10 offline59-package install/build PASS. Exact native review and requested Pi final source review PASS; Pi withdrew its erroneous test-only finding after following unconditional finish->uiBinding. Final sourceSHA256 fa80a39f4a4829207377efa4c39918c35dc80fc3a9606e1e102a5035bc7e4aff. New clean-r10 hashes860 actual files.

R15 actual Continue from unchanged Save7, followed by an explicitly recorded same-slot measurement-query reload before any Play, restored nine owners,8kg CutterInput, Native23410/Factory3901, unchanged SOC/mass/full stored record. Ready-state sampling distinguishes transient startup publication from fully mounted Native/confirmed Paused. Actual Cutter disable then enable BOTH Committed: the original real switch blocker is fixed. Actual Start queues, explicit Play follows; the first joint interval instead raises Factory RecoveryHold Error: InvalidBeltStepCursor. Factory stays3901, input8kg/WIP0 unchanged; Native pauses23441. Max timer gap34.1ms and advance11.2ms, no delayed callbacks: this is a validation failure, not a Clock SimulationHold. Save7 bytes/hash remain unchanged; actual browser closed/disconnected,15events, screenshot/video/report retained in r15-real-control-fix-first-interval-belt-cursor-hold.json. No autoResume/state injection.

Independent native plus requested Pi diagnosis: setDryFactoryEnabledCore clears ALL Belt.lastStep while retaining positive revision/tick/credit/packet; the unchanged strict Belt validator correctly rejects the resulting invalid cursor. Minimal BELT_CONTROL_CURSOR_R01 reuses adjacent reconcile mapping to preserve the historical Belt receipt, only removing lastStep:null in that one Belt-map. Machine and Root replay invalidation remain unchanged, no synthetic receipt/cursor reset/validator relaxation. One disjoint exact writer lease; Root alone integrates. After focused RED/GREEN and Root checks a new clean copy will repeat normal Continue from valid unchanged Save7. Fresh16kg/power/output/WIP+packet restart/15min remain open.

### R16/R17 real production, interruptions and WIP+packet browser restart passed

Belt R01 Root fullDry57/57PASS12.78s/13.19s, relevantHost8PASS/74filtered7.89s/9.02s, TSC and clean-r11 locked59-package install/build PASS. Exact native and additional Pi final source review PASS, all writers quiescent. Clean-r11 hashes860 actual current files; dryFactorySlice SHA256579e9e026338780204ffd59948ca878f7ec077258b2ae7dd3197dafe2ade77ed. No Clock/schema/cap/Golden changes.

Actual R16 same valid Save7 Continue Paused, full old stored record unchanged. Corrected disable/enable commit; immediate post-toggle Save8 succeeds, P2222466B/CPU241650304B. Actual CUT8 starts and advances. Battery disable at work26300ms leaves same job and8kg WIP;37 confirmed Factory intervals in blackout leave work and SOC unchanged with NET_DISCONNECTED. Explicit enable/Play observes WAIT_RESTART, unchanged work/SOC over13 intervals; after the required restart window real1200W resumes and CUT1 finishes. Both normal paid belts subsequently carry real first semi and second RAW8. Second CUT8 plus PROFILE start normally from a common proven reachable service stand; no Physics/Native modification.

Actual Save9 at Native31157/Factory5192 includes active PROFILE29500/40000ms and real MidBelt packet2 at1125mm with4000000mg credit; RawBelt credit10000000mg. P12299962B/CPU258693318B under16MiB/256MiB, five paid links,9owners and all receipts/IDs. Chrome process actually closed/disconnected and video finalized. r16-normal-two-cuts-wip-packet-save9-real-close.json records151events/noerrors.

NEW Chrome process R17 same origin/profile, actual Continue ready Paused before any Play. Full stored Save9 bytes/hash remain unchanged. A recorded same-slot measurement-query reload is also Paused before any Play. Explicit Save10 from the hydrated runtime proves Native world/view/terrain/plants/neighbor/profiles/progress/receipts byteexact; NativeFactory and profiles exact; Host epoch/session/tick/remainder/Factory5192 exact; Factory material/domain/links/installations/lastPower/lastReceipt/history/selections/waitingStarts exact. ONLY publicationRevision6484->6487 and its combined signature differ; record metadata reflects the explicit new Save. No ULP tolerance or offline work was needed. P remains12299962B/CPU256732306B. Comparison JSON and same-state rendered screenshot retained.

Only then explicit Play resumes: the restored PROFILE completes once at40000ms, packet2 arrives once into Former Input, and products remain exact after22 additional idle intervals. Real state: fresh7kg profiles +7.5kg semi +1.5kg offcut. Normal second recipe produces fresh7kg sheet and another0.5kg offcut. Before SHEET, two physical6kg old MONTAGE trips filled output to19/21kg. Actual Start holds WAIT_OUTPUT with7.5kg input untouched/WIP0/no new job/work. Only old8kg profiles+4kg sheet are moved through ordinary local UI into CutterInput, fresh7kg profiles remain; explicit normal Start retries and finishes SHEET. Final fresh preassembly mass is7profiles+7sheet+2offcuts=16kg. Actual MONTAGE pickup from Former Products takes fresh4+2, leaving3profiles+5sheet. Existing full carrier contact limits are respected.

### R17 fresh16 and paid brace installation completed, final Save11

Fresh6kg was set down and wholly delivered to nearby CutterInput using the ordinary local-delivery UI. The temporary old12kg blocker material was returned through FormerInput to ProductStorage/Storage7 using ordinary transfers; fresh3profiles+5sheet remain in FormerOutput. Unloaded player crossed the actual MidBelt using normal Space+D and returned to the shared Cutter/Workbench service stand. Fresh4profile+2sheet transferred normally to BenchInput. Actual Start, Assemble by hand and Finish assembly each ran on a confirmed later Factory interval: LAID_OUT->ASSEMBLED->COMPLETED, 0W, WIP6kg->0, brace5.8kg and0.2kg new offcut.

New brace was normally picked up/deposited[-8750,1500,4750], player stepped clear. Default preview[-8750,1500,5500]q1 and normal q2 rejected FACILITY_OVERLAP with material retained. One actual Rotate and eight ArrowDown inputs admitted q2[-8750,1500,7500]; actual Confirm committed ten coexisting owners. No new layoutdefault, altered collider, hidden pose or free material. Final exact fresh equation16=5.8installed+3profiles+5sheet+2.2offcuts; total material2984400000mg.

Actual final Save11 at Native48038/Factory8006 succeeds: P13535070B, full logicalCPU262444768B, hash01d41d286e21f463e536d2d3e61e24a0ad200f0204f4e2f48c12ef45a3e4576a. Caps16MiB/256MiB unchanged. Native/Factory Paused, neutral, no recovery. Browser actually closed/disconnected, video finalized; r17-complete-fresh16-brace-installed-save11-real-close.json preserves281events/no pageerrors. Its passive windows include long Paused intervals/capped samples, expressly not a full FPS population. One evidence-export-only dynamic import callback error happened after the real browser close; report was recovered unchanged from the existing controller object with normal file tooling, no game/runtime mutation.

Remaining confirmed UI defect: restored initialMaterial was incorrectly used as Goal origin, so completed fresh workflow still showed Cut16; COMPLETED machine label also missing. RESTORE_GOAL_BASELINE_R01 approved bounded3file plan passed independent native+Pi plan checks. Writer only Candidate source; Root sole integrator, current clean-r11 stays immutable. Preserve decoder-issued live material/WIP/history identity, charge original finite revision0 origin accurately. After source/test review, build new clean copy, actual Continue from Save11 before Play, inspect rendered final Goal/Completed and run continuous15min. These final gates remain NOT RUN.

### R20 ten-owner cold restart and continuous runtime passed; publication timing open

Goal baseline/Completed source: full Checkpoint/UI46/46 and TypeScript PASS, native and requested Pi source PASS. First final-ten-owner Save11 cold failed270168482>268435456B; clean-r13 and old clean-r11 same exact failure before Physics, stored slot unchanged. COLD_PLANT_SOURCE_R01 accounts exact decoded-to-live plant identity5227968B once across early/residual gates, retaining distinct Base copies, full aggregate scratch, Native96 and unchanged caps. Root Bootstrap60/60 and TSC PASS; clean-r14 locked offline install/build PASS,860 SHA256-verified files. Native and Pi exactsource PASS.

R20 actual new Chrome Continue is confirmed Paused48038/8006, same ten owners/material/SOC/entire Save11 record. Explicit hydrated Save12 before any Play proves Native/world/terrain/plants/neighbor/profiles/history, NativeFactory and Host exact; Factory exact except publicationRevision8376->8379. Actual Goal First structural brace installed and Workbench Completed captured and inspected. Explicit Play starts continuous run UTC13:14:21.728, original deadline13:29:21.728 retained across compaction. End900.243s,54012Native ticks/9002Factory steps, Running throughout, ten owners/mass2984400000mg, no new delayed callbacks/Hold/Recovery/Resume. Full frame samples5996 p50149.5/p95201.2ms, main147.1/197.7ms; retained solver53615 p50.1/p95.2ms with428 dropped during compaction drain gap, no complete solver-population claim. Pause and explicit Save13 P13572178B/CPU262559464B PASS, actual Chrome disconnected, video finalized, no page/network errors. Report r20-fifteen-minute-baseline-save13-real-close.json preserves raw samples and separate Paused Save delays.

Frame performance is not accepted merely because liveness passed. Bounded existing opt-in UserTiming R01, no CPU profile, new clean-r15/current source hashes. R21 actual same Save13 Continue and measured-query reload before explicit Play retained the whole stored record.49.35s/395frames reveal Main108.1/178.1ms, three Goal reads perframe20.6/27.1ms (17.9% summed main), Publishinclusive98.3/164.6ms, Publishresidual77.1/141ms, mixed FrameState3.3/4ms. This disproves dominant-Goal attribution; Goal memo was not implemented under that timing-only lease. Browser closed without replacing Save13. R02 only adds guarded per-listener/carrier/installed/readUi subspans to attribute the remaining cost; source finds24 handling profiles recomputed per each of52containers.

### R22-R24 bounded UI repetition corrections, source frozen for final runtime

R22 same Save13 confirms readUi21/28ms with52containers and1248 full profile constructions. READ_UI_PROFILE_HOIST_R01 resolves24 immutable profiles once per read; sourceLots/capabilities remain fresh. RED/GREEN, fullHost83/83, TSC, independent native and requested Pi exact-source PASS. R23 sameSave readUi5.8/8.1ms and Main89.3/124.6ms confirms benefit; the remaining three Goal replays20.8/26.8ms perframe justify the separately described GOAL_FACTS_REUSE_R01 decision. Kernel Advance per-positive-requested-step47.5/61.9ms includes reconcile and is not exclusive transformation.

GOAL_FACTS_REUSE_R01 retains one private material-identity WeakMap entry with fixed original origin, complete installation/receipt-element/Native proof witnesses and frozen primitive facts including null. Fresh confirmation/Idle/no-transaction gates always apply; mismatches and malformed/oversized keys run the unchanged strict projector. All retained wrappers and strings are conservatively in K, max1MiB; replacement/disposal clears the old entry. No current Material/Native graph is retained. Internal diagnostics and opt-in lifecycle reporting only, no stored format/public projector/Kernel/Reconcile/Clock/cap/Golden change. RED repeat replay2vs1, focused GREEN, fullHost+Checkpoint107/107 in100.38s, TypeScript and diff check PASS; independent native and requested Pi exact-source PASS. All product writer leases closed; Root sole runtime integrator.

Immutable clean-r18:863 actual source/assets/docs files SHA256-verified, locked offline59package install/fullTSC+Vite build PASS. Actual new Chrome Continue Save13 Paused before any Play; full stored record unchanged. Explicit hydrated Save14 Native/NativeFactory/profiles/Host exact, Factory exact except publicationRevision14546->14550. P13572178B/fullSave262572808B. Live retained memo448840B with no decline; Save busy clears it so that Save K excludes it, separately conservative Save-plus-live263021648B. Cold scene265001348 plus actual memo265450188B below256MiB with full scratch/Native96. Same-save paired30.439s/488frames: Main74.7/94.5ms, Goal perframe.2/.4ms, readUi6.7/9.6ms, solver.1/.2ms, no metric drops. Around16FPS remains a known limitation, no smooth-performance acceptance or reopened closed kernel window.

Final core source continuous run started14:41:12.056UTC with the immutable deadline14:56:12.056UTC. Actual end14:56:31.265UTC,919.209s,55154Native ticks/9192Factory steps, ten owners/mass2984400000mg and all30windows Running. Zero new delayedcallbacks/Hold/Recovery/Resume, zero metric drops/page/network errors. Frame16093 p5070.8/p9595.8ms, Main68.7/90.8ms, solver.1/.2ms; meanFPS17.511 from16093/919.0031s. This mixed walking/idle workload is distinct from the short paired standing sample. Root-owned passive telemetry was drained every30s through a one-way callback, no gameplay/authority writes; firstfivewindows lack perwindowtick/count fields, subsequentwindows and exactstart/end/movementrecords carry them. No heavy tests/builds/profiles or product source changes during the run. ActualPause/explicitSave15 P13572168/fullCPU263008304, actualChromeclosed/disconnected, video finalized. PausedSave719ms gap/advance0 remains separate from Running liveness. Fullrawreport r24-final-goal-919s-save15-real-close.json preserved. FinalnewprocessContinue fromSave15 awaits the separate smallUI correction below.

### Confirmed M-key pause-acknowledgement UI gap, separate from ongoing runtime gate

Actual R24 M key from Running showed Pause instead of the promised full map. Read-only writer traced factoryShell render: intentional map opens and requests Native Pause; playing->paused acknowledgement unconditionally replaces it with Pause. Full map remains accessible through Open workshop->Views->Map. Root accepts the bounded two-file plan only AFTER the continuous run is saved/closed: preserve an already-open workshop surface for ordinary paused acknowledgement; Hold always forces Pause, no-surface Esc/Pause remains Pause, start/help/settings retain prior handling. Existing shell tests must cover M+pausedACK, Close without Play, explicit Play only, Esc/Pause and Hold over Map. No new API/timer/cache/schema/Clock/style. Root inspected the exact existing handlers; requested Pi plan check agrees, with explicit unconditional Hold retained. No product source was changed during the ongoing R24 run.

After actual R24 Save15/close, the one-condition correction and existing-shell regressions are implemented. RED visibleMap failed, focusedGREEN4/4/fullShell19/19 and TypeScript/diff check PASS. Unit ACK is synchronous-reentrant inside setSurface, not a real Native asynchronous proof. Independent native exact2file sourcegate PASS; ShellSHA2569B561A0BCFE013B1FD9599131B3D899F453CE45E77562C445FF9F383E41FB16D, test8F95DA8C105372699FADBFA51D31517671E943E84433DD6688929DD9409B05DD. Root verified exactdiff/hashes; GoalSession5D106B10... and hostPort2B042745... unchanged from R24. All writers quiescent. New immutable clean-r19 build/coldContinue and actual M/Close/Play are the remaining concrete gate; no15min result is attributed to a UI binary that was not run for15min.

### R25 actual new-process Continue, full hydrated Save parity and Map input passed

Clean-r19:863SHA256-verifiedfiles, locked offline59packages/fullTSC+Vite build and actualpreviewstartup PASS. Initial2Continue clicks failed only because Root had omitted a Playwright confirmation handler; the default dialog dismissal kept the menu and old slot unchanged, captured as automationfailure. After accepting the exact ordinary Continue confirmation, newChromeactuallyrestoredSave15 Paused160992/26832, all10owners/material/SOC/fullstoredslot exact. A recorded same-slot measuredqueryreload before anyPlay also stayedPaused. Explicit hydratedSave16 fullNative/NativeFactory/profiles/Host exact; FactoryonlypublicationRevision31164->31168, P13572168/CPU262572808. NormalPlay+M showsfullMapafterrealPausedACK, screenshotinspected. Close leavesPaused/ticksunchanged500ms; only explicitPlay allowsnormalWwalk. ActualPause/finalSave17 Paused161064/26844 P13572167/fullCPU263008304/hashbe1c8b88854dcd42bd94d2fe336e08e9db9eb7448f63061cd6b1b409e3f4ef19; actualChromeclose/disconnect/video/noerrors PASS. Detailedreport r25-save15-real-continue-save16-exact-map-save17-real-close.json includes the initial automationfailure and correction.

Distinct real UI bug found during that menu check: a merely availableSavedslot was labeledloaded by the late startupstatus rewrite. TRUTHFUL_SAVE_STATUS_R01 changes onlythatguard to stablecoldRestore&&Saved; the originalfactoryRestore object is intentionally retired earlier. Existingcold/sourceidentitytestcases nowassertavailableSaved/noStore.loadwithoutquery andloadedafteractualcoldquery. ExactREDcommand `npm test -- tests/unit/hvp-bootstrap.test.ts -t 'charges the exact adopted Factory plant generation once through scene and residual admission|does not credit a fresh equal-content plant generation to a Factory checkpoint'`: exit1/1FAIL1PASS58filtered. SameGREEN exit0/2PASS58filtered23.39s, TSC/diff check PASS; independentnativeexactsourcegate PASS. Bootstrap96CA4808C9A4D6B10A39F519CD4A9C68ACC7C6F533CC0F8CE4608F106370CDEF; test220E9D6B10E011706DD65BA80C59DEC1D1F58B8A3BF7128977285F56AB342891. Full300s Bootstrap suite was not rerun for a message-onlyguard; this is stated explicitly. Rootsoleintegrator; allwritersquiescent, finalcleanbuild/available-vs-loaded coldsmoke next.

Shell regression commands: RED `npm test -- tests/unit/factory/factoryShell.test.ts -t 'M-opened map|opens Pause for|published hold'` exit1/1FAIL3PASS; sameGREEN exit0/4PASS15filtered. Whole `npm test -- tests/unit/factory/factoryShell.test.ts` exit0/19PASS. `npm exec -- tsc -p tsconfig.json --noEmit` exit0. No timeout/oldGolden change or newtest framework.

### R26 final current-source clean startup/coldContinue and full before-Play Save parity passed

Clean-r20 contains863SHA256-verified source/assets/docs files. Locked offline npmci59packages and `npm run build` (TSC+Vite8.1.5) PASS, actuallocalpreview5197 started. A genuinely new Chrome process in the same owned profile first shows NativePaused0/0owners with checkpoint available. ExactordinaryContinue confirmation accepted: actualSave17 coldloadsPaused161064/26844,10owners/sameposition/SOC/mass2984400000mg/fullstoredrecord unchanged, correctloadedmessage. After500ms stillsamePausedtick, noPlay/offline work. ExplicitSave18 BEFOREanyPlay: fullNative/NativeFactory/profiles/Host exact; FactoryonlypublicationRevision31196->31199; P13572167/hash9a418bf7dbfadf8b9c358c670c4049d408db7e7b2d64a5fd928849c14d0b7d00. ActualChromeclose/disconnected/videofinalized/noerrors PASS. Newsource differs from R24's919.209s core byonlytwoindependentlyreviewedUI/statusguards; no new15min attributedtoitsbinary. R26record r26-final-clean-available-vs-loaded-save17-continue-save18-exact-real-close.json. CurrentfunctionalV03-V06 gates PASS; smooth-frameperformance/partlyunmeasuredcomposition/humanartfun remainexplicitOPEN/NOTMEASURED/OWNER_REVIEW_PENDING. Allwritersquiescent; Rootsoleintegrator. FinalsourcePiDeepSeek and nativeexacthashgatesPASS; no mainmerge/commit/push.

Finalhandoff Ready2026-10-18:863source/assets/docs SHA256-rechecked, offline59packages/freshTSC+Vite build PASS, all201builtfiles exactSHA256 matches to clean-r20. Only3documentationrecords differ; laststaleV04pendingphrasecorrected inCandidate/Ready, initialmanifestpreserved and currentmanifestrehashesall863 beforeR27. ActualnewChromeR27 from Readypreview5197 ordinaryContinueaccepted, Save18 Paused161064/26844/10owners/samemass/SOC/position, fullstoredrecord unchanged, noPlay/offlineprogress. After500mssamePausedtick, actualChromeclose/disconnected/videofinalized/no page/network errors. r27-ready-actual-new-chrome-save18-continue-unchanged-real-close.json. No productchanges afterfinalacceptance, only sourceCandidate results documentation appended. Readyserver remainsavailable; README_PLAY has ordinarylaunch and retainedprofilecommands. Independentread-only completiongate PASSforboundedfunctionalacceptancewithexplicitremainingFPS/exclusivecost/humanlimits; itcorrectlywithholds unqualifiedoverallcompletion.
