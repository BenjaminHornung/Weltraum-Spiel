# Hestia FP06 playable candidate implementation plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` with the real existing agents. Each task uses a failing business test, minimal implementation, focused verification and independent review. The user's explicit maximum of two implementation writers takes precedence over generic skill defaults.

**Goal:** Finish the existing small Factory slice as a normally playable, visually readable, saveable browser candidate, with a complete finite 16-kg production flow and a tested portable delivery.

**Architecture:** Continue the local Integrator `96cced23cd285b57f8a557d01ac9ed8a158c927f`. Keep one authoritative native world and existing HVP, Material, Power, Production and Conveyor owners. UI, map, GLB and animation consume confirmed read views and submit existing commands. The exact Startsite-V2 may be tested in an isolated candidate branch; its final initial-terrain acceptance remains `OWNER_REVIEW_PENDING`.

**Tech Stack:** Existing Three.js/TypeScript/Vite/Vitest/Playwright versions; installed Node 22.23.3/npm 10.9.8; installed Blender 4.3.2. No dependency migration.

**Spec:** Explicit user follow-up of 2026-10-12 and the fully extracted `/workspace/hestia-followup-2026-10-12/HESTIA_FP06_SPIELBARER_PROTOTYP_REVIEW_FOLGEAUFTRAG_2026-10-12.md` and matching startprompt. ZIP SHA256 `ecf6008dda77d54fd585bcacef06fca9acfcff2486031fdfb15018b8b7af1a75`; all ten SHA256SUMS entries verified. Original FP01/FP02/FP06 reference hashes match the existing accepted handoff. Archive status is historical evidence, not a fresh test result.

## Global constraints

- At most two concurrent implementation writers, Art included. Exactly one Integrator owns Host/Physics/Save/contracts. Root owns control documents; reviewers only read/play.
- Each writer has a separate branch/worktree and an exact grant. Historical W09 grants are closed; the new user instruction authorizes reopening only after a documented path/conflict check.
- Finite C01–C28, unchanged quantities/recipes/BOM/ports, 1-mg quantities, integer packaging mm³ and component counts. No free material, duplicated cargo, artificial ores or restored ship flight.
- 0.25-m building grid and 0.125-m HVP cells remain separate. Native budgets, collider geometry, movement admission and all validation guards remain intact.
- Real UI and ordinary keyboard/mouse movement for browser flow; no TestBridge, teleport, pose injection, collision bypass, production-time jump or prefilled replacement lots.
- Preserve all15V1 masks/Coast/V1/V2 behavior. Owner approved exact additional3-range V3 candidate after2492-slot/+5.9375m² census; named versioned profile only. Other geometry stays separate exact proposal, not implied by V3.
- Original 5000-ms composition test limit stays. New diagnosis must name the same source/scenario/toolchain and produce bounded measurements; no blanket timeout/queue/receipt/physics/power increases.
- W09 technical gate precedes W10 implementation; W10 precedes W11 acceptance. Read-only preparations and independent assets/UI may run before those gates.
- No W12–W29, engine change, dependency upgrade, main merge, push, force-push, PR, publishing or external upload.
- Human terrain, Art, usability and general target-hardware decisions stay `OWNER_REVIEW_PENDING`; scoped automated tests are never promoted to those decisions.

## Review focus

1. Heavy load reaches depot through real clearance, then the player actually exits the future Former hull before installation.
2. Full output and power loss preserve material custody, reservations, WIP and paid work; the UI explains the actual blocked state.
3. A modal panel releases pointer lock and clears held movement/build inputs; closing it causes no accidental motion or construction.
4. Restore activates a complete generation with matching native owners, source profile, materials, power, belts and clock. Unknown transactions and corruption never report a successful save/load.
5. Render assets and animated parts remain bound to canonical definition/part identities; reload and removed parts cannot recreate gameplay material or authority.

## Context and responsibilities

Root control worktree: `/workspace/Weltraum-Spiel/.worktrees/fp06-w00-2026-10-11`. Existing Integrator worktree: `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`. Existing W05 work and all accepted UI copies are already in the Integrator and must be inspected before replacement.

Agent `/root/fp06_integrator` owned the initial implementation/CPU slot. After its actual model-capacity failure, `/root/play_integrator` is the sole active Integrator on the same candidate worktree/branch, preserving the authorized draft. `/root/fp06_domain` performed the initial asset inventory; after two actual capacity failures, the real `/root/play_art` agent owns the exact Art grant in its separate worktree. `/root/w00_repo_audit` checks paths/branch/LFS boundaries; `/root/w00_architecture` prepares the bounded performance investigation. No product write is granted by this plan alone. New grant files bind base SHA, branch, worktree, exact paths and evidence location.

Existing original cards: FP06 W05, W09, W10 and W11. Existing source/readiness reports: `../../reviews/package-status-current.md`, `../../reviews/w05-package-report.md`, `../../reviews/w09-package-report.md`, `../../proposals/heavy-route-start-site-v2.md`, and current Root source/write locks. Existing grants under `/workspace/.cloud-setup/fp06-task-briefs/` are provenance only until replaced by a new grant.

## Implementation phases

### PLAY-00: actual before state

Files: this plan and a new `current-state-and-gaps.md`/`asset-inventory.md`; new captures and exact CLI receipts under `/workspace/.cloud-setup/fp06-play-2026-10-12/PLAY-00/`. No product changes.

- [x] Extract all follow-up archive entries safely and verify all ten checksums.
- [x] Read the new Review and Startprompt; retain original source precedence and current local baseline.
- [x] Resolve reported commits, verify worktree/grant conflicts and targeted asset payloads.
- [x] Start the unchanged production build at normal `/factory.html`; finalize before video and inspect screenshot pixels.
- [x] Exercise actual cargo/construction/transport until first blockage; distinguish observed behavior from source analysis.
- [x] Inventory native definitions, runtime imports, part/port dimensions and actual animation for each required object.
- [x] Open an exact new Integrator/Art grant after the conflict check and append the real PLAY-00 receipt.

### PLAY-01: isolated V2 transport candidate

Expected exact source scope, subject to the new grant: `apps/weltraum-browser/src/factory/fixtures/startSite.ts`, `src/hvp/hvpCoastSource.ts`, `src/factory/fixtures/cargoSite.ts`, source profile seams in `src/factory/session/hostPort.ts`, `src/hvp/hvpBootstrap.ts`, `src/factory/factoryEntry.ts`, corresponding Startsite/Cargo/Coast/Bootstrap tests and normal-route E2E. Paths hereafter are relative to `apps/weltraum-browser` unless otherwise specified.

- [ ] Add and execute business REDs for the closed V2 version/digest, unchanged V1/Coast and exact three-mask census.
- [ ] Add the closed candidate source constructor/profile; compare actual V1/V2 slot bytes and assert 380 extra columns, 2890 changed slots, 264 Air→Solid, 2626 Solid→Air and zero inventory credit.
- [ ] Pass focused source/profile regressions and original build before native/browser tests.
- [ ] Normal pickup of 341 kg, route with stop/reverse, depot, actual player exit and paid Former installation; battery/socket/reach/LOS and three finite cable jobs in the same build.
- [ ] Independently inspect the candidate geometry, actual flow evidence and exact diff. Final terrain remains pending even if technical tests pass. If the route is not usable, propose one exact separate geometry change and continue independent work.

### PLAY-02: source-bound Blender assets

Exact Art paths are determined by PLAY-00 inventory before mutation. Art never writes shared factoryAssets/Bootstrap/Physics/Save paths; Integrator admits the reviewed delivery.

- [ ] Retain useful existing S0 parts and accepted palette. Identify actual visual/runtime gaps from the before capture.
- [ ] Run Blender on source-bound dimensions/parts, save `.blend`, reopen, validate parts/pivots/ports and produce the required runtime derivative.
- [ ] Include generator/provenance/license/hash receipts and real native/GLB payloads, not pointer-only files.
- [ ] Bind runtime loading and poses to existing canonical assets and confirmed process work. Validate WAIT/RecoveryHold/removed-part behavior.
- [ ] Capture the integrated normal build at player height. Human Art review stays pending.

### PLAY-03/04: UI and complete material loop

Reuse the existing Cargo/Machine/Power/Technology panels and BuildTool. A later exact UI grant covers isolated new shell/help/map/onboarding modules and their tests; only Integrator changes Entry/Host seams.

- [ ] Add meaningful REDs for modal input, missing actual actions and map frame consistency.
- [ ] Supply Start/Continue, readable HUD, current action/objective, cargo/build/machine/power/technology flows, pause/help and minimal local map.
- [ ] Derive map from known start coverage and confirmed own installations; no world scan each frame or movement authority. Unknown coverage stays unknown.
- [ ] Play two CUT batches and one PROFILE plus one SHEET batch in real time, then deliver fresh 4-kg profiles + 2-kg sheets to the local paid bench.
- [ ] Install the resulting 5.8-kg brace. Verify `16 = 5.8 + 3 + 5 + 2.2 kg` and full 2984.4-kg custody accounting; trigger/resolve actual power loss and full output.
- [ ] Focused tests, affected regressions/build, ordinary UI/browser evidence, independent package review and full-SHA commit before W09-PASS.

### PLAY-06: composition diagnosis and actual browser measurement

- [x] Issue one concrete measured investigation grant from the readonly preflight. Reproduce original scenario and 5000-ms failure with the unchanged Node22 toolchain and isolated CPU lease.
- [ ] Measure the demonstrated bottleneck, implement only the granted minimal candidate with RED/GREEN guard coverage and repeat identical inputs. Preserve every FAIL.
- [ ] Measure the production browser with actual loaded assets, named CPU/browser/software-GPU backend, resolution/DPR/settings and recording overhead declared separately.
- [ ] Separate composition outcome from browser frame distribution/input stalls and general hardware acceptance. No synthetic FPS claim.

### PLAY-05: W10 combined save/recovery

Original exact targets: `src/factory/persistence/factoryCheckpoint.ts`, `factorySaveStore.ts`, `restoreFactorySession.ts`, `src/hestia-prototype/persistence/factoryWorldParts.ts`, unit persistence tests and normal `factory-save.spec.ts`; shared native/Bootstrap/Host seams remain Integrator-only and require a later grant.

- [ ] After W09-PASS, implement business REDs for halfway paid WIP, belt packet, SOC, heavy custody/depot, installed brace and full-output waits.
- [ ] Encode one complete authoritative generation with strict decode limits, exact source/asset/catalog/tick/epoch bindings and atomic IndexedDB repository CAS.
- [ ] Prepare a hidden complete native/render/domain generation before activation. Preserve Legacy HVP saves and reject incompatible V1/V2 profiles.
- [ ] Exercise quota/CAS/corruption/unknown confirmation without false success or loss of prior valid save.
- [ ] Actually restart browser, Continue, verify identical business state and perform a subsequent ordinary action; independent review and full commit before W10-PASS.

### PLAY-07: W11 and portable delivery

- [ ] Independently exercise PLAY-T01–T12 with normal input and native world; report Functional/UI/Save/Visual/Gameplay/Performance/KnownGaps separately.
- [ ] Complete full uncut real-time flowvideo, or two recordings bound to the same exact save across browser restart. Finalize the context and inspect captured pixels.
- [ ] Capture the eight specified in-game views with source/asset/build bindings; do not substitute Blender orthos.
- [ ] Write `README_PLAY.md` using commands, controls and save behavior actually tested.
- [ ] Build a local complete Git/source/LFS/runtime package; verify bundle and payload checksums, extract cleanly, install/start using README and actually play the normal entry.
- [ ] No publication. Return the startable candidate, real flowvideo and in-game total view first; report any missing delivery explicitly.

## Tests and evidence

Use actual repository npm scripts. Preserve raw logs with argv/cwd/timestamps/exit/hash and a coherent new per-milestone manifest. Keep business RED separate from fixture/import/type failures. Original evidence is immutable. Use existing per-run verification limits unchanged; do not aggregate unrelated old runs into a fake final PASS. Record exact changed paths and independent spec/quality verdicts for each implementation milestone.

## Risks and safe stop

Stop only dependent changes when exact source/owner policy is missing, native clearance fails, atomicity cannot be proved, or the scoped performance budget is exhausted. Independent Art/UI may continue within their grants. Hold an unconfirmed world transaction instead of retrying or refunding material. No Root product fixes outside the Integrator/review loop.

## Progress log

- 2026-10-12: Explicit new user instruction received; archive extracted and ten hashes passed. Existing local `96cced23…` is the requested implementation basis. Real Integrator PLAY-00, readonly repository audit, readonly Art inventory and readonly performance preflight dispatched; no new product grants yet.

- PLAY-00 closure: real normal cargo/pickup/341-kg CarrierOverlap recorded, five screenshots and finalized24.56-s video; Root inspected first/last capture and preserved setup failures. Readonly audit/inventory/performancepreflight copied with exact hashes. Exact13-sourcepath candidate grant released; separate real Artwriter on clean96cc worktree has only new artifacts/tests. Inventory equality misstatement explicitly corrected in Rootwitness, not silently rewritten.

- Integrator takeover: prior agent failed with model-capacity error after Source RED and eight authorized candidate drafts; interrupted in errored state. Root transferred the exact13-path grant and zero-write attribution grant to real `/root/play_integrator`, preserving branch/HEAD/drafts and historical receipts. `/root/play_art` returned the final CPU slot after22 actual Blender exports,25/25 focused/presentation tests and original tsc PASS; artifacts still await independent review/runtime adoption.

- Current technical progress: V2 digest `ec8ba9b1`/2890 changed slots/0mg; native normal341kg route, depot, player exit and paid Former proven in run17. Normal idle run16 raised a NativeSimulationHold and remains an open functional failure; no fast-retry waiver. Actual new composition baseline5649ms and profile5847ms failed original5000ms; one bounded W08 candidate grant issued. Independently reviewed Art commit `e752cc7fce43a50b4bcb4800d9d27584b44b6a0e` is held with explicit remaining gaps. New `/root/play_ui` is the second actual writer in a separate96cc worktree, exact seven-file grant; Integrator alone owns shared files.

## Definition of done

A clean-copy normal entry is playable and saveable; full fresh-material flow and browser-restart continuation are recorded; actual assets load; ordinary UI actions and known local map work; original invariants and bounded performance gates hold; source/LFS payloads and tested README are supplied. Human initial-terrain, Art, usability and hardware reviews remain separately `OWNER_REVIEW_PENDING` until actually accepted.


- Follow-up progress at Rootcontrol2337ffff: actual Sourcepartial393670f, UIsource3cc40cc imported3e4acef, immutableArt162 imported0dd5cdb, correctedsource C1d76e5fa committed after independent25Conveyor/build/originalpairPASS. Two cacheP1s were fixed before acceptance; oldFAILs remain. SourceV3/normalinput readiness/full16kg remainopen. ArtR2/R6/R3technicalreviewPASS awaits own12-pathcommit. UI+Art HOLD; secondimplementationwriter /root/play_cell_bridge owns only factoryPartCells.ts+itsUnitfile, Integrator retains sharedNative/Host/work/controller and originalS1grant effective9paths. BAL-00–04 artifacts docs/factory/balance committed2337ffff,26rationalChecksPASS, V2balanceinactive/legacyrecipes unchanged.

- Current readiness: V3 source/cargo13PASS, Bootstrap2PASS/44skip and original buildPASS; first normal V3run085310 failed before planned margin reach and remains classified as an input/control failure with no terrain conclusion. Exact two-path input activation grant binds genuine Native ACK/cancel to user activation;11 business assertions RED before minimal implementation. Partcells44focusedPASS+originaltscPASS await independent review; current-package portable delivery preflight is read-only, not a new snapshot or gameplay acceptance.

- Immutable handoffs: Art correction1314e813b39ba460bdc6c470c37416b65498fbac (12 paths, two real LFS payloads) and partcells214ff98a07ea76dce50e5382f842decd2ce9a6a0 (2 paths,44focusedPASS/tscPASS) independently reviewed and clean. Root fresh destination/source/hash checks passed; exact admission grants issued. Art/UI/partcells HOLD; sole active implementation writer is Integrator until a new isolated grant. Runtime/S1/Owner gates remain open.

- Input/Host focused regression81/81PASS reported with preserved genuine11assertionRED; minimal readonly client lifecycle extension granted for actual sent/bound ACK RPC IDs and buffered intent. These observations cannot publish Native state or claim applied movement; original bareACK and withheld-read guards remain.

- Actual admission complete9a2c9397af8efcb56d2e18bc578b2c30eab6875d: Art12+Compiler2+five own evidencefiles, all current runtime/input/source drafts preserved. Second writer receives only two new pure model-loader files in clean9a2worktree; same paths removed from Integrator direct runtime write set until reviewed immutable admission.23 runtime GLBs hydrated and content-filter-matched to HEAD; after initial index stat-only M reports, exact-path index refresh produced zero staged diff and clean status. Source code/World unaffected.

- Owner explicitly approved exact V4 connector candidate: three newmasks/7m²/1164slots/0mgcredit, original15/V1/V2/V3/Coast preserved. Root grants exact13Integratorpaths, Source/Native/browser gate pending; finalterrain stillOWNER_REVIEW_PENDING. Sourcecensus1.5807s and fullsparsediff captured; independentreview found5µm inner-sample approximation, all200points same125mmgridadresses, labels corrected without rewritingoriginalreceipts or changingNative. NormalnewShell/InputBrowser28PASS with8captures, NativeRPC127/ACK127/noPending/zeroIntent and unchanged2984.4kg; nofullS1/Map/W09/Save claim.

- Owner explicitly rejects current UI appearance as notgame/slopgrid after intermediate screenshots. RecordOWNER_UI_REJECTED, retaintechnical120/nativeInputScopePASS only. Readonlygamefeel diagnosis + boundednewUIcandidate before ownervisualreview; integratorcontinuesactualV4route/Source and soleNative/Host/Save. Final pureLoader1b635619c2ca13bdcf8d4078ac491a32578feefa fixes RootfoundmutableDTO P2 (4trueRED→66focusedPASS/typecheck/indepreview); exacttwoabsentblobadmissiongranted, writerHOLD.

- UIquality correction starts in separate clean9a2branch /root/play_ui, exacteightpureUIpaths and existingPortcontracts preserved. Root freshlyverifiedsixexistingbytes/twoabsentdestinations, noSourcePower/sharedpathconflicts. WorldHUD/context/inspector redesign isreversiblecandidate fromexplicitOwnerrejection+originalgameUItask; no genericSkill-stage permission overridesauthorizedwork, newhumanvisualacceptance stillpending. ExistingSource/Native/S1/Save remainIntegrator; atmosttwoactualwriters.

- Owner UI correction: actual displayed Start/Cargo/Walking appearance explicitly rejected. Two readonly reviewers inspected those three existing normal-game captures, separated structural visual failures from Native Input technical PASS, and finished concrete candidate A briefs. Root8c1e476 isolated a new clean eight-path pure UI writer; old 3cc source remains historical/HOLD, new direction OWNER_REVIEW_PENDING. No engine/World/power/recipe change authorized by the visual correction.
- V4 narrow Source gate: final actual closed header/runtime digest 913c0c46; Source/Cargo04 16/16 PASS, Bootstrap/profile/habitat/Host05 4 PASS/44 skipped and original build06 PASS. Root checked compressed raw byte counts/hashes against all four real receipts. Normal-route07 FAIL before pickup; key exposure automation diagnosis and one bounded ordinary-input retry pending. No new terrain clearance/battery/cable/full16kg PASS.

- PLAY-06 new NativeRead issue: actual V4 route10 reached341kg/depot/playerexit/paidNativeFormer, then NativeSimulationHold on return, before Battery/Cables. Static Source shows two Facility.read calls per public Session.read and duplicate full production proofs within each. Measured handlers29.6/34.5/44.4/67.5ms preserved. Root freshly pinned exact three existing files and granted one synchronous-snapshot-only candidate, never a crossRead cache or hold-limit change. Original composition C1 budget stays closed. Independent attribution and genuine Rapier TDD required; runtime closure remains NOT_RUN.

- PLAY-02 runtime readonly preflight finished and Root fully read. Exact B09-only readonly inspection addendum granted on five already S1-owned paths: current Native integrity/local source access rather than nonexistent B09 production row. No third cell compiler/physical definition/door state. B06/B07 actual part membership/localpose/sensor and PreparedHeld-hidden vs published-presence boundary remain required. Cargo GLB ground1.25m must use native bounds rather than old S0 cube center2m. All runtime/native/visual acceptance pending.

- NativeRead candidate independently reviewed boundedPASS (f51234ea…), committed4ba4728f29cd27c00ff0d64ba9b21c9aa8d9f26d with exact3productfiles. 5focused/95regression/tsc/build PASS. Actual post-fixV4 normal route07 ran222.2957s/CLI0, raw142894B SHA4a445fbc…; 341kg heavy/depot/playerexit/paidB07 plus50kg Battery/V4eastconnector/depot/exit/paidNativeBattery PASS, same2984.4kg/source913c0c46/TestBridgefalse/finalNativePaused/nonHold. Root checked rawgzip/receipt and actual confirmedNative+Material owner refs. This closes that bounded route hold, not global idle/FPS/fullW09/cables/Save. UI42 tests/tsc passed but independent Source P1 Start/Helpclose and P2 inheritedkeys need closure before one layoutprobe/actualnormal UI admission.

- Newgamefeel pureUI finalized6b2e53eb0f1fd3b42a5d16ebe244fe7d0bc57199, exactly8files, cleanHOLD. Genuine initial8assertionRED +2Rootbugs +9independentStart/fallbackRED +3CargoIntentRED; final54focused/tsc and independentSource92bd154cPASS. Exactlyone static7PNGprobe Exit1unknown404 showed structuralHUD/navigation/material gains but2pixelP2s; finalIntent/CSSSourcefix reviewed without a secondprobe. Root freshly checked sixTargetbefore/twoAbsent and all8committedblobs, grantedimmutableIntegratoradmission. All native/shared drafts retained; actualpost-fix normalgamepixel/Native/Owner checks next, notpromotedfromstaticscreenshot.

- UI8 exactblobs admittedf29501516afa2afd0802aa00dd2e43ebda7ba7fe; Nativepart observation foundation sealed69a804fd53988334c6cbfc056951ed1c79b454f9 (2productpaths,82historicalregression+16finalfocused/tsc/build receipts, actual runtime pending). Independent pureS1helperreview found3P2 (unconfirmedpose, staleNative/currentSnapshot, missingactivepaidJob), kepthistoricalmissing2filebindings honest. Integrator explicitly requestedexact2file transfer; Root createdactual isolatedNative69a WT, exactunchanged2HOLD seeds and2SHAverifiedruntimeGLBs +lockedexistingdependencylinks. Cellnow secondwriter foronly2purehelperfiles; differentreadonlyclosureReview required. All Sharedfiles remainsoleIntegrator; actualNativeUIcaptureexclusiveCPU.

- Actualpostfix UI browser37.544387824s/CLI0 at69a verifiedbyRoot: eleven1280/800x720/1920x1080captures, actualNativeACK/ordinaryWASD/modalpause/repeatneutral/freshpress, source913c0c46/TestBridgefalse/finalconfirmedPaused/2984.4kg. GenericConsole404withoutURL preserved; noHTTPerror in capturedresponse list, causeunknown. Rootsharedthreeactualimages; S0 grayCargo remainsuntilnewGLBwiring, Ownerstylepending. RealCellpurecontrollerretryactive afterinitialmodelcapacityfailure; threebusinessREDspreparing in own69a WT. Freshlineage17083B readonlyreport fullyRootread, cumulativeadoptedreceipts sufficient; noProgressjournalneeded. W09fullflow/W10/W11 remainopen.

- Differentactorreports closed: actualUI independent0b8bcf04 scopeStart/Cargo/Walk/actionreach/NativeinputPASS, PausefalseerrorP2+unexplainedcanvasbackdrop and800x600actualNOT_RUN; sealedNativepartFoundation independentd41c933c boundedPASS0newP1/P2. Both fullRootread andexactbytescopiedto currentwindowreviews. Actual15.499sPauseRED failsfalseactionstatus aftercorrectNativeACK; DOMcensus hasno matchinglargeOverlayelement, darkpixelsCanvasnotprovenLegacyCSS. MinimalEntrypausefix+actualCargo/CarrierGLBs built4.807s, actualpostfixcapturepending. Purecontroller58focused/tsc0frozenawaitdifferentActorclosure.

- S1purecontroller572c247bd96757d194e12524548a3ea538caab90 exact2files/cleanHOLD/differentactor520559boundedPASS3P2closed,58focused/tsc0. Rootfreshoriginal2targetseeds +committedSourcehashes checked; exactimmutableadmissiongranted. SoleIntegrator nowonlywriter. MinimalreadonlyNative solidPorts four-pathaddendum foractualB09→B06offering/admission: production[]B09stillomitted, actualMember/Parts/support/service/LOS/frameproof reusewithinRead, noWorld/sourcegeometry/materialchanges. ActualAvatarcausecomparison15greenaftergenuine12RED; early11hypothesisnonrepro retained. ExistingShareddrafts preserved.

- PureS1immutable2blobs admittedf85d1379c3458488d225105156adfb66837799ce. NewisolatedactualWT atf85d createdcleanwith53existinglockeddependencylinks/noinstall/noGLB hydration. SecondwriterCell receivesexact2newpurefreshLineageProjectorpaths andfrozenAPI (requiredactualretainedinitialMaterial Sourcebaseline); SharedNative/B09/Host/Session/Entry/S1runtime remainsoleIntegrator. Actualpartial2CUTfacts/receiptgenealogy/paidBrace/currentNativerevisionguard withoutjournal/clock/Worldauthority; independentreview required. W09fullflow stillopen; W10implementationnotgranted.

## Owner-Steuerung: UI- und Gameplayqualität

Die vollständig vom Owner eingefügten Skills [game-ui-quality](skills/game-ui-quality.md) und [gameplay-flow](skills/gameplay-flow.md) gelten ab jetzt für den laufenden UI-/Gameplayumfang. Ihre konkrete Anwendung ist in [application.md](skills/application.md) festgehalten. Reale Eingaben und gerenderte Vorher/Nachherzustände bleiben Gate; kein Spaß-/Nutzbarkeitsclaim aus Build oder Screenshot. Vorherige Grants, maximalzweiWriter und W09→W10→W11-Abhängigkeiten bleiben verbindlich.


### Root serial continuation, 2026-10-12 20:47 UTC

Preserved existing Integrator4ca and26 drafts; Rootsolewriter. Delivered complete78-image reviewpackage with actualBlender previews/nativepayloads. Source/Cargo/UI76tests PASS. Dry37tests36PASS1unchanged5000msFAIL; two scoped encoderattemptsFAILEDandreverted byte-identically. No further speculative candidate; actual read-only reviewer `/root/blocked_band_readonly_review`. Separate currentprivate-stage read-only review `/root/current_native_closure_review`; noCPU/implementationleases granted. Native/Host/Input affectedsuite running withfiveSourcecaseTimeouts observed, outcome pending. Continue independent UI/NativeSource gates and currentbuild/browser inputs; W10/W11 gates blocked until realW09complete.


### Root continuation 21:16 UTC

ActualNative/Sourcecellfive5000msGates repaired only by equivalent full-cell assertion batching; actualfivePASS3.74s. Dryproxyboundary2realRED→20GREEN and independentreview; fullpairedperformance pending. Empty-machine Goal no-work shortcut42GREEN with actualretainedbaselineunchanged, no globalcache; alone didnotresolvecoldstartup. NativecoldfiniteCargo initializationnowPaused beforeWorkerTimer,3actualNative/default testsGREEN plus76affectedNative/Physics/WorldSaveGREEN; originalbuildPASS. SamevisibleV5browserflowPASS39.7567s,0→173actualNative ticks,2984.4kg unchanged,4capturedPNGs. CurrentrealheavyV5route input-onlydriverrunning; no otherheavyCPUjobs. Preserveall earlierFAIL/setupFAIL/receipts. W09full16kg/blackout/fulloutput/remainingdry+Hosttimeouts stillgate, W10/W11 blocked.


### Root continuation 22:24 UTC

RealNoOp materialadoption businessRED5extravalidations→28focusedGREEN/differentactorSourcePASS; completeDry/Host98PASS/1unchanged5000msDryFAIL (all59HostPASS), originalbuildPASS. Actualsamebrowserprofile showsadoptinclusive1.092389→0.001129sampledseconds butstillHoldtick345 andworseP95/frameinterval; diagnosticExit0 isnotPerformancePASS. Singlelocalbrowseraffinity3vCPU/Mesa1 hypothesis nowtested withsameACK-driver/V5heavyactions; host5vCPU/4CPUquota, noglobalruntime/tick/timeout/queue/budget/sourcechange. Fouractualnormalbrowserpictures shippedinseparatereviewupdateZIP. W09fullfresh16kg/W10/W11remainopen.

## Externer Reviewcheckpoint — 14.10.2026

Owner fordert ausdrücklich Commit und Push der eigenen aktuellen Branches. Implementierungscode bleibt bei `9ebd8cad469651edb1d47023c8d58041d4f32672`; archivierte historische Evidence und Revieweinstieg sind in `7ee85b0e0e3dedc5a41c3ccf98b3fe92b64f846e` gesichert. Kontrollmetadaten, zuvor lokaleGrants/Reviews und spätere Checkpoints werden separat committed. Source bleibt unverändert; keine Tests/CPU-Profile erneut ausgeführt, keine Rezept-/Save-/Terrain-/Physics-/Limitänderung. Originale PerformanceFAILs und W09/W10/W11-Blockaden bleiben sichtbar. Nach normalem Push werden beideRemote-SHAs und tatsächliche LFS-Payload-Verfügbarkeit geprüft. KeinMainmerge/Force-Push.

### Pushtransport 2026-10-14T13:44:35.065258+02:00

Atomarer normalerPush scheitert nachLFS97%(1090/1118,399MB) mitHTTP503. Kommando-lokal reduzierterUploadparallelismus2 konnte nichtbeginnen, weilauchGitHTTPS undanschließendeRead-only-Prüfung (nach20s) amCloudEnvoy/Cloudflare-Tunnel mit503fehlschlagen. Netzwerkpolicy ist enforced/Hosterlaubt; keinefehlendeAuth ausunsetVariablen abgeleitet. KeineTLS-/LFS-Hook-Umgehung, keinForce-Push. EigeneCommits/alle676Bytebindings/aktuelleLFS-Payloads lokalgesichert. ExterneBereitstellung bleibtBLOCKED; tatsächlicheRemoteSHA-/freshLFS-PrüfungNICHTdurchgeführt. KonkreterTransportbeleg: `docs/factory/fp06/external-review/2026-10-14/PUSH_STATUS.json`.

### Erfolgreiche Reviewbereitstellung 2026-10-14T17:22:33.394561+02:00

Erneuter, ausdrücklichangeforderterPushPASS: beideReviewbranches atomar erstellt;1118/1118LFS-Objekte bestätigt, keine503imRun. RemoteIntegrator `7ee85b0e0e3dedc5a41c3ccf98b3fe92b64f846e`, ControlvorSuccessreceipt `8da869eb9a073c6ee3461d46b1461c9a921536c4`; Mainunverändert`e40592c113b72a8dc93725187f92cf948e07f44d`. FrischeHTTPS-CloneohneCheckout/Alternates und tatsächlicherOriginLFS-FetchPASS:33ausgewählteAsset-/Evidence-Dateien,26Payloads,24.376.093Bytes,alleSHA/Größen exakt. KeineBuild-/Gameplay-/Visual-/Performanceabnahme darausabgeleitet. DiesesSuccessreceipt wirdseparat normalcommittedundgepusht.
