# Required retained HUD and route fixes

Status: source slice checked; P01–P06 and overall goal INCOMPLETE.

Recovered exact source commits7e608d4f1e909dbc6576cde821b595a5bc41927b andd8fa02867e538dab3363819f10394fd059bda321 from the configured origin's verified perf/hvp-hud-frame-hotpath-2026-10-02 andperf/hvp-route-bundle-isolation-2026-10-02 refs. Fetch only admitted these refs; no reset, checkout, cherry-pick, source commit or push. Before adoption both product files equalled the respective commit parents, confirming the required deltas were missing.

R59 applies exact mature HUD setter/read/cache/disposal changes and lazy bootstrap import; unit files preserved, both independent visible-coast E2E hunks consciously merged exactly73 additions/zero deletions. Baseline full two files19 controls:15PASS/4FAIL. Candidate full HUD/route/moving files45/45, type/buildPASS. HUD reads remain fresh and Save cache uses scalars. No FPS gain claim. Actual Body384 cut render444.6ms stillFAIL250.

Independent review found lazy-import rejection outside the bootstrap's failure boundary. R61 moves the exact existing presentHvpFailure/startHvpRoute bodies to lightweight hvpRoute.ts, imports only the bootstrap handle type and reexports the existing functions at their old path. main.ts now enters the existing boundary before invoking deferred import. SurfaceLab priority, initialization rejection, Error dataset, accessible alert and duplicate-mount behavior remain. Added direct loader-rejection control. Full three files46/46, type/buildPASS; exact native release1.993s for tests/1.790s for build, independent reviewACCEPT. Deferred-module production graph assertion passes. Fresh native browser rejection/normal route and final fullBootstrap population still required.

R60 reserved recipe source slice is independent and accepted; its real531ms Cut is not a performance gain. Fresh unchanged fullOriginalOwner65 is running under the original180s native cap with only original default/JSON reporters, no filtering, progress hook or deadline changes. A03/B1 remains open.
