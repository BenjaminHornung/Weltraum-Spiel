# ExecPlan: Hestia FP06 W07

## Goal
Paid player placement creates exactly one native fixed Facility and one matching rendered installation, with original finite BOM held once in Resources. Ghost cancellation, stale/unknown support and failed native/render adoption leave no half-machine.

## Context
Own clean implementation parent d5502ae7fd5431d58eda51bea062c54691ebe3c2; W02/W05/W06 reviewed PASS, initial25-file Root grant; later exact27-file initialCargo supplement captured in inputs. Fully read FP02 sections6-10 and FP03 sections4-6,13, accepted start-site-v1 and actual integration map. Current Root control differs from inherited old W00 docs and is binding. Existing one HVP Renderer/NativeWorld/Terrain authority, W02 complete immutable MaterialView, reviewed W05 S0 source profiles.

## Non-goals
No W09 production, power/belt gameplay or W10 codec; no W12-29, normalCoast/Flight change, dependencies/lock/parser/limits changes, unapproved masks, free platform, wind Unknown->Air or owneracceptance. Legacy persistence remains closed for Factory.

## Architecture decision
One host-owned complete Materials/Construction snapshot. UI requests previews/build; source-frame integer250mm placement is separate from125mm terrain cells. Source-geometry-derived profiles bind unchanged catalog/source refs and concrete foot/body/sweep/service/port/collision facts. Native Facility family is private inside existing World; max16Owners and unchanged64Bodies/32dynamic/4096Collider budgets count hidden staging. Build acquires a bounded session lease, waits for real PauseACK, stages disabled native+hidden renderer, computes full unchanged-base material CAS candidate, commits native held, synchronously jointly publishes material/installation/native/render, then finalizes. Errors use retained original facts and exact members/handles; unprovable rollback is RecoveryHold, no refunds. No UI World handles.

## Implementation phases
- [ ] Collect real business RED with importable narrow scaffolds; distinguish fixture/import setup failures.
- [ ] Exact15mask70m2 Factory-only source profile and coherent vegetation/ground/spawn readers; sourcebytes/header rejection and unchanged normalCoast.
- [ ] Pure checked placement and paid installed Resources BOM; deterministic issue set and full snapshot binding.
- [ ] SameWorld native prepare/commit/publish/rollback/finalize membership proof and caps; old families/lifecycle/checkpoint guards.
- [ ] Host hidden renderer joint adoption; session pending/dispose/hold barriers.
- [ ] Real UI ghost/move/cancel/build and actual Chromium placement captures.
- [ ] Focused tests, affected regressions, build, CI inventory, bounded evidence/index/LFS/scope checks; independent review then actual permitted commit.

## Tests and evidence
T029:208kgCutter, originalC26 once,12kgProfile/10kgSheet paid. T030:ghost+Escape no mutation/reservation. T031:changedterrain/resources fail stale. T032:unknownsupport/nativefailure rejects orRecoveryHold with complete memberproof. Native actual Rapier tests, exact source maskdiff/headers and affected HVP bootstrap/physics/vegetation/Host regressions. Browser retains original30s/5s/start20s and serial CPU/GPU/5174 lease. Real run2026-10-11T122211.412749Z only; readable logs plus lossless raw.gz, actual screenshot/state provenance. Historical fixed writer outputs backed up/hashchecked and restored only exact known originals.

## Risks
Native held/adoption or projection error can expose half-facts; global budgets must include staged members. Terrain/source readers and vegetation/spawn can diverge. Cargo target capacity must remain bounded and original instances preserved. Busy/terminal hold disposal cannot be unreachable. Browser boot cost is charged once, no timeout inflation.

## Rollback / safe stop
No material publication before full native/render readiness. Native Rollback proves full old body/collider identities plus foreign-family membership unchanged. Projection and host facts restore original complete snapshots; failed proof enters visible terminalRecoveryHold. No blind retry/newID after ambiguous outcome. Root grants exactly27 paths after granted initialCargo supplement and new evidence run; any needed additional write is stopped and reported specifically.

## Progress log
2026-10-11T12:22UTC: exact grant/control/dependency checks PASS; ownrun created. Historical initial entry; subsequent actual phases recorded below. Short CPU loan DomainW08 during source/test preparation; no parallel HeavyCLI.

## Definition of Done
Actual native paid player build, genuine directed RED/GREENs and affected regressions/build/browser, unchanged limits/defaultprofiles, exact final product seal, independentSpec/Quality PASS, all reference artifacts tracked/LFS-bytebound and scopeclean; Root binds full actual package commit. W09/W10 gameplay/save claims remain NOT_RUN.

2026-10-11T13:39UTC: actual initial8 collected businessRED after fixture serialization correction; native11GREEN, SourceService/SourceReach/NativeOverlap directed REDs and16GREEN, affected8files125testsPASS before Cargo extension. Sourceorigin1RED→1GREEN/fullbuild. InitialCargo3RED→12GREEN; exactOpen1RED→19GREEN/fullbuild. Firstbrowser1PASS/1FAIL/4NOT_RUN (uppercase runtime ID guard), full traces archived. NativeDispose/member3RED plus extent/candidate2RED→24GREEN/fullbuild. InitialCargo external source preflight fully read/captured; SourceMaterializer/NativeSupport/LOS/immutableOwner/Open implemented, no browserWalkPASS yet. Current27product-file seal handed to Root for read-only preview; no final gate. Domain owns current short CPU testloan; ownonly Source/Reportwrites.

2026-10-11T13:47:51UTC documentation: actual second Browser1PASS/1FAIL/4NOT_RUN, innernpmExit1,34.2s; all second traces/report retained under browser-second. Genuine commonFrame projection error makes CargoOpen lose disposed physics; productWriteHold retained and narrow fix requested before edit. CPU/GPU/5174 explicitly released to Domain after actualCLI and ss empty.

2026-10-11T13:55:12.801875+00:00 documentation: four collected genuineREDs (3 assertion,1 commonFrame runtime cleanup failure); minimal frame/CargoID/disposed-first checkpoint fixes now30Native/Placement/Cargo/SourceUnits and1actualHostGhost-cycle PASS; fullTypeScript/ViteBuild PASS. New27file product seal handed to Root, next actual Browser remains gate pending.

2026-10-11T13:59:00.724339+00:00 documentation: thirdBrowser1PASS/1FAIL/4NOT_RUN Exit1/55.9s. SourceReady/CargoOpen/idempotence succeed; case30s budget expires before Play (normal Playbutton visible/enabled in actual screenshot). Ghost/Open/read calls exhaust combined budget; no PlayNative failure claimed. Unchanged trace retained, timingreceipt32 added. Runtime ProductHold; sequential normal-player harness split requested, no limits or perf claim. CPU/GPU/5174 released afteractualCLI +ss empty.

2026-10-11T14:18:25.352014+00:00 documentation: failed initialcatalog/material binding genuine2RED -> HostLifecycle19GREEN; typed material fixture corrected after TypeScript FAIL -> focused2GREEN and fullTypeScript PASS. Eleven separate original-budget Browser cases now same ordinary context/page/world/session; complete27-path product seal sent for readonly review, fourth browser gate pending. No runtime writes during browser/review.

2026-10-11T14:20:10UTC actual fourthBrowser4PASS/1FAIL/6NOT_RUN Exit1/82.15s. SourceReady/closedGhost/OpenReplay/normalPlay+DWalk succeed. Normal D/S holds while awaiting slow CDP/read cause actualplayerx−8.443,z2.225 instead source-target−6.25,8.875; NativeReach correctlyinaccessible. Trace-extractedactualposes+keyboardtimes preserved; no productRuntimefailure or performancePASS claimed. All27RuntimeHOLD and CPU/GPU/5174 released afteractualCLI/ss empty.
