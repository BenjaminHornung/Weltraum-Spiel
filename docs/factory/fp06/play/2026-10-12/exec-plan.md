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
