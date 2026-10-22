# FP06 performance round 2 — 18 October 2026

## Goal

Direct user authority: `Dann weitermachen und optimieren`. This is a new bounded continuation after the previous three kernel candidates and its single profile closed. Their results and failures remain unchanged. Improve actual frame interval p95 to <=50ms and measured mean to >=30FPS on both the same standing scene and ordinary active production/input, while preserving paid production, common Save and actual browser-close continuation.

## Context

Actual Candidate E:/DEV/Weltraum-Spiel/FP06-Candidate, feature/hestia-fp06-review-continuation-2026-10-15, HEAD 7ee85b0e0e3dedc5a41c3ccf98b3fe92b64f846e plus all existing local work. Frozen functional baseline E:/DEV/Weltraum-Spiel/FP06-Ready-2026-10-18-v2 stays unchanged. Ordinary browser-local Save25 is Paused Native227986/Factory37997, eleven paid owners, 2984400000mg, P15121771B, content hash 15cd3e9d4b878b444ec9be84483183e8516bddfa2744a1884fc0baf9ced3ba82. Raw saves are not exported.

## Non-goals

No public serializer, saved schema, Clock policy, global timeout, caps, old Golden, collider, authority or resource changes. No main merge, commit/push, engine/content expansion, new package or general asset/architecture work. Lossless V2/V1 compatibility remains. No automatic Resume. Existing historical failures remain visible.

## Architecture decision

Root is the sole runtime integrator and does not implement product code under the active orchestrator role. Reuse existing agents only; no new children. Initially all agents are read-only; at most two disjoint product writers after an exact source-backed lease. New private representation/lifetime/accounting must be stated before implementation. All retained bytes stay charged within unchanged 16MiB wire/64MiB decode/256MiB CPU including Native96MiB. Arbitrary external input validation stays intact.

## Implementation phases

1. Fresh actual Chrome/ordinary Continue25 and confirm full slot unchanged Paused before Play. Record measured same-slot query reload separately. Same1280x720/profile/origin/headless Chrome/video; 5s warmup then30s standing unprofiled. Collect existing UserTimings, stop first Hold; at most one new10s MAIN profile only if the existing timings cannot attribute the current cause.
2. Independent read-only kernel and Host/publication investigations. Separate validation/transformation/encoding/hash/commit/test observations; mixed or unmeasured costs stay labeled. Select one measured bottleneck; grant exact paths and compact decision before any implementation.
3. Maximum three justified candidates in this new window. Focused regression RED/GREEN, relevant original suites, exact-source independent review, clean offline build and same-Save25 unprofiled measurements after each. No parallel tests during browser performance captures.
4. Verify ordinary active production/input and proportionate Save/actual browser-close Continue before Play on the final source. Export a new clean delivery only after behavior/performance evidence; frozen Ready-v2 and Save25 remain untouched during paired measurements.

## Tests and evidence

Existing Vitest/TypeScript/Vite commands; actual Playwright runtime tools and ordinary UI controls. Keep all source hashes, stage/admission metadata, mass/owners/jobs/energy, Clock Holds/delays and dropped samples. No tests-as-FPS or nested-time sum. game-dev CLI is unavailable; apply GDS bounded/comparable measurement rules using the existing telemetry, without a sealed GPU/power/thermal or causal attribution claim. New DeepSeek payload approval remains pending after automatic review rejection; no new external source/measurement transfer or Pi PASS is claimed.

## Risks / safe stop

Save headroom is narrow and real. No cache may hide retained memory or weaken public input validation. Stop on unexpected Hold, authority divergence, slot mutation, sample drops, cap failure or exhausted candidate budget. Keep the original safe Save25 and frozen delivery; close owned browsers without Save/Resume after a failed measurement. Revert only the newly isolated candidate through its writer if necessary, never reset newer work.

## Progress log

- [x] New authority, baseline and historical closed windows recorded. Two existing independent read-only reviewers completed the kernel/publication diagnosis; later independent C1 plan checks passed with explicit Accepted/lifetime/accounting guards.
- [x] R39 baseline/R40 one profile completed and preserved. After connection recovery, fresh R42 standing baseline27.5365FPS/p9565.2ms supersedes R39 for current pairing. Normal finite RAW8/Cargo/CUT reproduced first fresh Hold at231561/gap102.9ms; no Resume/Save, priorSafe25unchanged/realclose. Active30s includes post-Hold frames, not performance acceptance.
- [x] C1 exact projection reuse implemented, fixed1024B accounted. Final hash-bound native source/test reviews PASS. Failed aggregate96/99 remains; all three failed cases independently explained and rerun GREEN, unchanged backend16/16 and TypeScript PASS. Five-path lease released; all product writers quiescent.
- [x] Clean-r28 offline build and comparable R43 standing30.5794FPS/p9533.1ms PASS. R44 ordinary RAW8/Cargo/CUT completed30000ms without Hold/delay, original stop did not recur; active22.3116FPS/p9565.6ms remains MISS. Save25 whole payload unchanged, actual browsers closed. C2 discovery is read-only; two candidate slots remain, profile1/1 CLOSED.
- [x] Bounded performance window closed with active mean target MISS retained; final-source functional persistence/production gates pass in the later V6 continuation. Delivery seal is tracked there.

C2 lease19October: independent canonical/combined plan PASS and writer all-caller audit accepted RAF_PROJECTION_R01.md. After the documented W07 fixture limitation, only hvpBootstrap.ts is writable; all tests remain byte-exact C1. One existing writer. Tick-change-guarded S1 inner projection deferral; carrier/direct/unchanged-tick calls immediate. No persistentstate/additionalbytes/Clock/backend/publicformat. Unchanged full affected Bootstrap group/TSC, exact-source review, then newclean/offline and actual integrated S1/CUT/normalinput comparisons. No larger mock or helper solely for Boolean testing under user's80/20 policy. Finalnew-sourcefresh16/commonSave/realrestart remains required. No browser measurement overlaps checks.

C2 gate/actual completed: hash-boundSOURCEPASS and runtime-gatePASS; full58PASS/2SKIP due unchangedcoldhook10s timeout, bothcoldcases independentlyGREEN, TSC/diffPASS; failedaggregate retained. Clean-r29 874files/offline59/buildPASS. R45standing30.4852/p9533.2 PASS; R46normal8kgCUT30000ms/0Hold29.4179/p9533.2, meanMISS. AllSave25bytes unchanged and actualbrowsersclosed. C3 MATERIAL_ADOPTION_R01 is lastperformancecandidate3/3 after two independentplanchecks and writer audit; narrowtwofilelease, existingproof only, no new retainedrepresentation/cap/format/Clock changes. Separate R47 normalUI probe confirmed Pause-Play clipping from129pxscroll; its independent small UI plan is read-only until exactlease. Finalintegratedfresh16/commonSave/realrestart stillrequired.

Final selection19October: R48 C3 standing31.2084FPS/p9533.0 and actual Pause scroll replay PASS; R49 full normal8kgCUT noHold but27.7074FPS/p9564.7, no gain over C2R46. C3 rejected and only its two product/test hunks manually reversed. DryB08477179EE80590D2AFA8549A7CCE5C73689C99C9314F4468A1AEA924872C2B/TestEDC7906642C37DB8B280619C31C8169D35B9CDC17BB55B09A3DEC4F4996D4827 match frozen C2. Existing authority3/3, material15/15, TSC/whitespacePASS. C1/C2 plus independently verified UI fix selected for clean-r31. Profile1/1 and candidates3/3 CLOSED. Active mean target remains MISS; no fourth optimization or new profile. Next only integrated final-source paid NewGame/fresh16/commonSave/actualrestart and delivery.

## Definition of Done

Measured comparable performance targets pass with intact normal paid gameplay/Save/real restart, or the bounded window closes with exact remaining cause, measurements and no false completion claim. Functional baseline remains usable throughout.

21October functional follow-through: [FP06_V6_GAMEPLAY_ACCEPTANCE.json](../../../../../../FP06_V6_GAMEPLAY_ACCEPTANCE.json) records normal fresh paid16kg/tenowners, WIP actual Chrome restart and final inside-hull actual restart/Save19 parity. This closes the later functional gates, not the active FPS mean target or the unmeasured pure cost categories. No new profile/candidate was taken; physical/memory/Clock limits and old Goldens remain.
