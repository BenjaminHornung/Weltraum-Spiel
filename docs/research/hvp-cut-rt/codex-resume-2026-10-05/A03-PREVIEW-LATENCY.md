# A03 – Preview Cut latency evidence

Status: INCOMPLETE. B1/A03 is not accepted; the 250 ms gate is still failing. The user clarified that actual Cut latency in the open preview is the immediate issue.

All rows are real headful normal mouse/F-input Body384→352 cuts in task-owned tab 1, 1280×720, reported DPR 1.0000000149011612. Parent source digest `fnv1a64-v1:70d85a5593bd44c9`; removed32/mass135.9375; child digest `fnv1a64-v1:c05b830d110a061f`; Root generation1. Measurements use the existing opt-in PerformanceObserver trace and actual committed-render identity. These single-cut diagnostics are not the formal 42-before-1400 population.

| Bound build | Owner plan ms | Input→Applied ms | Input→committed render ms | Meaning |
| --- | ---: | ---: | ---: | --- |
| R42 phase timing | 1884.7 | 2011.6 | 2029.4 | Original measured productive route |
| R43 owner aggregate | 1569.7 | 1675.9 | 1691.6 | 1,056,302 plan steps, ownerIngest930,057 |
| R44 full-owned hash128 | 1119.2 | 1228.9 | 1251.4 | Standalone cursor defaults remain1 |
| R45 nested128/1ms | 797.0 | 955.4 | 979.7 | 61,546 outer steps; max observed2.2ms |
| R46 owner Structural hash128 | 776.2 | 850.2 | 870.5 | 48,538 outer steps; max observed2.3ms |
| R47 one-component mass reuse | 584.3 | 716.2 | 736.5 | Full classified mass reused only for the sole complete component |
| R48 classification hash128 | 617.3 | 787.5 | 822.3 | Full bytes retained; one noisy run does not prove an isolated speed gain |
| R49 compact step diagnostics | 515.8 | 648.9 | 664.5 | All counts and maxima retained; bounded timing objects |
| R50 immutable channel retention | 538.3 | 642.3 | 684.4 | Frozen plain arrays only, full value/hash checks and -0 fallback |
| R51 witnessed immutable shape | 570.5 | 712.2 | 737.7 | Full bytes/children still checked; 31,722 steps, max observed1.5ms |
| R53 single immutable descriptor pass | 398.3 | 522.9 | 547.6 | Same descriptor-error/credit/hole precedence; max observed1.7ms |
| R54 borrowed recipe quantum | 515.4 | 678.3 | 700.7 | Outer steps3057; same full recipe, no isolated time win |
| R55 witnessed repeated dense visit | 342.7 | 477.2 | 509.3 | Same full value/hash checks; max observed2.3ms |
| R56 render/release phase timing | 341.4 | 408.0 | 428.9 | Staging5.8ms, release acknowledgement5.6ms; preparation remains dominant |
| R58 witnessed value read | 342.6 | 443.9 | 468.4 | Exact immutable witness only; full bytes and default route retained |
| R59 required HUD/route fixes | 336.3 | 429.7 | 444.6 | Required mature deltas recovered; ownerIngest134.5ms and ownerRecipe86.7ms |
| R60 recipe measurement quantum | 417.0 | 512.8 | 531.0 | Inner work unchanged; timing now per bounded quantum |
| R62 one authority retention | 434.2 | — | 571.7 | Final complete issuer retention remains |
| R63 ingest labels | 427.1 | 564.3 | 585.6 | Phase observation only; max2.0ms |
| R64-r03 produced reuse | 433.6 | 579.7 | 600.4 | Corrected binary reserve scope; full108 controls pass |
| R65 bounded native freeze | 250.6 | 340.5 | 358.2002 | Full109 controls pass; max1.9ms; stillFAIL250 |
| R67 rejected hash-generator candidate | 320.7 | 425.2 | 458.7998 | NO_ADOPTION after unstable same-process comparison; source restored |
| R68 bounded result hash | 291.0 | 407.4001 | 423.1001 | Final160 controls/type/build/reviews pass; fresh impulse evidence retained |
| R70 witnessed numeric emission | 290.6 | 450.19995 | 469.69995 | Full17 files139/139/type/build/review PASS; stillFAIL250, no isolated game speedup |

CPU sampling of an actual R45 Cut succeeded via the exact current task-owned Physics-Worker target. The profile is explicitly perturbed and is not latency acceptance. A preceding attach attempt caused SimulationHold and no Cut; that attempt is retained as non-causal. All profiler sessions were detached, with game workers retained. The profile substantiates generator/hash/freeze/clock work; it does not establish unsupported physical heap figures.

R42: full type/build and five whole files107/107 PASS. R44 first candidate9/11 failed an original cursor boundary plus one5000ms timeout; corrected default1 scope11/11 PASS. R45 direct review-requested stalled128/elapsed1ms/cancellation/Error-null-undefined/cleanup controls plus six original whole files17/17 PASS. R46 immutable own data hashUnits1|128, accessor/mutable guards, original hash credits/normalization/cleanup, exact byte checks: first18/19 with original owned-ingest5000ms timeout retained; fresh same binding19/19 PASS. Fulltype/build PASS. Every quoted accepted runner has exact scoped process-release evidence within60 seconds; initial R44 build NOT_PROVEN remains retained with a separate20.43s exact-identity observation PASS.

R47 whole files21/21, R48 whole files40/40, R50 whole files41/41 and R51 ten whole files43/43 passed with original test deadlines. Their full type/build checks passed. R48's late84.81s release observation remains FAIL_LATE_OBSERVATION; its absent tree does not change that outcome. R49's exact unchanged OriginalOwner65 population reached the preserved180s cap and remains UNKNOWN_NATIVE_TIMEOUT_STOP, not a passing population. R52 reruns that exact population with a SHA-bound progress-only reporter and the same180s cap to identify progress; default/json reporters remain authoritative.

R52 completed with UNKNOWN_NATIVE_TIMEOUT_STOP at the unchanged180s cap. It emitted43 passed case-progress events and had begun Case44 at178.286s; these are not authoritative population counts. Native0/Outer1 at terminal and exact PID/creation absence at0.790s prove scoped release. No stalled wait chain is established; full current Owner65 remains unproved. Its unchanged test SHA matches the accepted A02 population (65/65, native160.652s); source/performance cause remains under investigation.

R53 direct descriptor/error/credit/cancel controls RED2/3 then GREEN3/3, full ten whole files44/44, type/buildPASS. Initial automatic release observed NOT_PROVEN; retained separately, the same original terminal SHA and exact identities show release at27.294s (OBSERVATION_ONLY_NOT_A_NEW_NATIVE_RUN). Full value, normalization, proof and byte hashing remain; no isolated all-population speedup is asserted. R54 uses the existing128-unit/1ms helper for only the borrowed recipe iterator. Its full recipe parity control failed before integration (Box1296/Sphere1076 outer steps versus bound1024), and current type passes. Broader five-file checks and actual preview measurements remain pending.

R54 five whole files37/37/type/build/source reviewPASS; real outer steps fall30938→3057 while observed wall time remains noisy. R55 repeated exact immutable shape visit RED2/3→GREEN3/3, full ten files45/45/type/build/reviewPASS, exact tree release1.871s. R56 existing root timing wrappers full moving-consumer26/26 then full consumer/trace/admission110/110/type/build/reviewPASS; release1.948s. One R56 extra-file launch failed source-binding admission before Native; retained separately, the corrected441-file binding is fresh and complete. R57 whole original Reporter/Bootstrap population is running on this frozen source with its previously admitted finite1200s command window and unchanged individual deadlines.

R54 profiling attempts did not produce a valid Cut and remain excluded. The successful R56 page-scoped profiler includes normal Terrain detach and an actual Body384 Applied cut, but perturbs timing (Body owner547.4/render712.8ms); it is CPU diagnostic evidence only. Its aggregated deepFreeze samples cannot be attributed to the Body plan without separating the Terrain window/call chains. Page-scoped autoattachments and profiler sessions were removed and the absent profiler handle verified. No raw CDP profile, browser URL metadata or process arguments are exported.

The user's original preview was upgraded separately to R54 after normal Save revision3, normal reload and new-session ColdLoad. The exact64+96 fragment identities/digests/cell counts/masses/colliders and player position match before/after (user-preview-revision3-upgrade-r54.DATA.json). This is real preservation evidence; it is not the required Body384→352 Save/recut acceptance. No diagnostic tab writes the user's save slot.

R57 completed the fresh full original Reporter/Bootstrap population117/117 in531.291s, wrapper532.038s, release2.086s, unchanged individual deadlines. R58 full ten files45/45/type/build/reviewPASS. R59 full HUD/route/moving controls45/45/type/buildPASS; review found the lazy-import rejection bypasses the existing failure boundary, which is being corrected before route acceptance. The original Owner65 population remains UNKNOWN at its unchanged180s native cap.

User tab0 and saved revision3 remain retained. Diagnostic Save testing uses an explicitly proved separate localhost origin; user preview uses127.0.0.1. No caps, original per-test deadlines, schemas, lockfiles, dependencies, generic public hash or issuer functions have been loosened or replaced. R45–R58 source reviews accepted their bounded scope; single observed quantum maxima do not establish the all-shape8ms ceiling. Every preview row still fails the250ms gate. No isolated improvement is claimed from individual noisy runs.

Next: finish measured owner work, then full OriginalOwner65/Bootstrap checks, actual moving-parent Save/new-session/cold-load/recut, atomic faults/lifecycle, B2/B3/P01–P06, formal42FIRST then1400, 50 actual cleanup cycles, final review and checked Planner ZIP. No total completion claim.

R60 full5 files38/38/type/build/review PASS. R61 lightweight route keeps the existing failure boundary around deferred loading: full46 controls/type/build/review PASS; actual loader-abort DOM shows Error/alert and zero workers, followed by normal Ready/HUD and one worker after removal. R62 full7 files42/42 PASS; R63 full19/type/build/source review PASS. R64 initial quoted-mesh failure is retained as FAILED_CUT with unchanged parent and no Applied result; corrected r03 full15 files108/108/type/build/review PASS. R65 full15 files109/109/type/build/review PASS. Exact release evidence accompanies these scoped checks. Current Owner65 stillUNKNOWN180; R66 read-only exact NativeJob CPU totals diagnose the same whole population without changing deadlines, reporter, order or assertions. No diagnostic sample qualifies42 or proves isolated speedup.

R70 actual normal Body352 Save1/new-session ColdLoad preserves source/native/player/moving values by deep Object.is. Subsequent genuine Recut seq2 creates192+128 cells and removes32, conserving1586.71875kg; the initially returned old receipt is retained as INVALID_PREMATURE_OLD_RECEIPT_DRAIN and excluded from timing. Cold fixed drop/inertia artifacts showed an AO-policy mismatch1392B/8triangles, minimally corrected R72 by exact initial IDs with generic child AO retained; full final tests and actual restored-render checks are pending. User preview readonly state at R72 still Loaded revision3/Paused/tick39425 with original64+96 fragments. No formal42/1400 acceptance has begun.

