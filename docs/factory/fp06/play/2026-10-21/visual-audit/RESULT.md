# V6 in-game asset audit — 21 October 2026

**Audit complete: concrete visual defects remain; no blanket visual PASS.** No product code, assets, saved state, Native geometry or safety contract was changed. Root inspected actual headed Chrome pixels in23 preserved captures, using ordinary Play/WASD/mouse/E/Views/V. These are browser captures, not sealed game-dev offscreen bundles. Previous performance window remains closed; no profile/FPS experiment was performed.

Current HEAD7ee85b0e0e3dedc5a41c3ccf98b3fe92b64f846e, dirty newer Candidate preserved. Served immutable Ready21-v4/factory-D3ew0Sm8.js; actual Chrome155,1249×1221/DPR1, additional UI1280×720. No TestBridge, state-setter, teleport, free resources or auto Resume. Existing two native read-only reviewers and the existing authorized Pi/opencode-go/deepseek-v4.1-flash advisor were reused; no implementation writer lease or new agents.

## Ranked findings

|Priority|Actual finding|Evidence and boundary|
|---|---|---|
|P2|Distributor front has coplanar panels/markers and visible striping.|Frames14–17, especially15_CUTTER_DISTRIBUTOR_OVERVIEW.png. Actual object is **Distributor**, not the Cutter suggested by the exploratory frame14 filename. play_distribution_v1 is anchored[-4.75,1.5,5.25],q1. Builder art/factory/play-2026-10-12/build_assets.py343–349 places shellfront, serviceplate and markers at localZ0.5; positive overlap X[-.7,-.02],Y[1.04,1.58]. Statuspanel351–358 repeats it. q1 maps it to worldX≈-4.25, visible from camera15 atX≈-1. Source and pixels independently reviewed. This is a real co-facing geometry overlap; a separate shadow contribution was not isolated. Earlier commentary called it a shadow stripe before source localization; that causal claim is superseded.|
|P2|Factory vegetation uses the wrong local ground; violet tips emerge from apron and flora visually intrudes around the installed line.|Frames05/07 show violet cubes and flat pink remnants by ramp;16/22 show dense flora around/through the machine presentation. vegetation.ts83–84 positions plants on Factory-profile ground, but173 calls groundAt without profile when building local cells. Violet blossoms are explicitly authored at278; Hullpalette has no violet. Exact owner of each pink pixel remains unbound. IMPORTANT: localGround also defines tree woodroots/anchors consumed as Native collision sources (hvpBootstrap.ts1338), not only decor. plantCheckpoint.ts16 persists materialized wood/decor/digests; cold restore uses those sources instead of regeneration. A global one-line profile change would therefore not be a harmless visual-only patch. Existing saved plants were neither moved nor regenerated. Existing W07 test hvp-vegetation.test.ts383 checks plantpositions but not actual generated Factory cellground.|
|P3|Power consumer names expose package IDs.|18_POWER_UI.png visibly shows fp02_cargo_c23_unit_2 and fp02_cargo_c23_unit_1 instead of understandable belt names. Native demand/allocation remains200W in the idle saved state; this is a presentation/label issue, not resource or power-truth failure. Some disabled-action reasons additionally appear in German inside the otherwise English panel.|
|P3 quality|Hull interior and machine frames lose detail in near-black regions.|01_HULL_INSIDE.png,20_CUTTER_SERVICE_OBLIQUE.png,21_FORMER_SERVICE_OBLIQUE.png and22_FORMER_THIRD_PERSON.png. Floor/gaps and dark frames merge; visual orientation/readability is poor. Palette versus illumination has not been isolated, so this is an observed quality deficit, not a proved lighting-engine defect. Coarse voxel steps, six-color hull palette and static turrets are intended current style/limits.|
|Integration gap|Existing material/cable inspection models are not instantiated in the current game presentation.|Native source inventory found cable/endpieces, steel/semi/profile/sheet/offcut and open-storage inspection GLBs only in loader census (playAssetLoader.ts75), with no instantiation in current src. No separate visible belt goods/payload presentation exists. This is a confirmed source integration omission, not evidence of missing resources. Current saved machines are completed/idle; live production animation was not exercised in this audit.|

## What was actually verified

Rumpf is the real hestia_crashsite_walkable_v1, not the Cargo access box: eight published parts at[6.5,1.5,7.5], GLBSHA91d27929383cf3d3edfee3a2e44ab6d722de026837336e5dd6313c51bca7a2ed. Interior01/02 and external ramp04/05/wide07 inspected. Rampe, frame, feet, cockpit and both turrets form a coherent visible model. No specific duplicate Hull model or screen-fixed visor rectangle was found in those views.

All12 actual presentation scenes (10 paid installations + Hull + opened Cargo) were published with modelError:null, expected parts and no reported asset request failures or pageerrors. Cutter/Former use V2 models with S1 loaded; other installed models use existing PlayGLBs. Models inspected in their current saved idle state; presence of S1 is not active-animation acceptance.

Opened Cargo09 has no visible repeat of the historical interior striping in the checked view. Normal E at actual reach opened Cargo10 and released pointer capture into Paused. Pick up Material container was enabled; no pickup/material operation was executed. Cargo1280×720 frame11 kept Views,Close and primary pickup control inside viewport; smaller content scrolls. Close left Paused. Power18/19 remains scrollable and legible, including the raw-name defect above. Ordinary V after confirmed activation yielded ThirdPerson22 and returned FirstPerson; no camera injection.

## Independent-review adjudication

Native reviewers independently bind Distributor geometry and vegetation safety scope. Pi's source-only report is preserved at PI_VISUAL_REVIEW.json; three proposed findings were rejected after local exact-source review:

1. Hull bottom/apron bothY1.5 is intended contact; outward bottomfaces + FrontSide material do not prove visible same-facing overlap. No Hull Z-fighting claim follows merely from the equality.
2. CargoGLB originY1.25 is correct: localheight[0,1.5] givesworld[1.25,2.75], Native center2.0. It is not750mm sunken (factoryAssets.ts55–61).
3. Hull casting is enabled by HVP visualEffects.ts119–128; base backend absence of flags does not override that wrapper. Actual07 has Hull groundshadows. Cargo intentionally casts but does not receive shadows, preserving the already reviewed Cargo fix.

Reviewer initially called the striped object Cutter; worldpose/asset binding corrected it to Distributor. No unverified advisor assertion was promoted to a confirmed bug or code change.

## Preserved attempts and limits

Frames03–06 and13 include exploratory terrain/shore positions. Those are not safe-route or whole-asset acceptance: walking pastZ13.75 left the raised apron and an eastward detour entered lower terrain. Root used ordinary original Save19 loading, then the accepted normal route: hullcenterX6.55→Z13.35→X-1.5→Z11.9→CargoX-5.5; no teleport or geometry change. A normal Space jump was used once during another exploratory move to regain the apron. All observations remain preserved.

The first V immediately after Play was sent while activation was pending and was ignored; its30s view wait timed out. Fresh readback showed Running/FirstPerson with no application error. V after actual activation worked. No global timeout increase, repeated hidden Resume or implementation workaround followed.

Temporal flicker sequence, GPU semantic attachments, all unusedGLBs, full active production/S1 animation and all lighting conditions are NOT RUN. No unit/build tests were rerun because no product/test/asset changes were made. This audit does not renew the closed performance window or change previous functional acceptance.

## Final saved state

After audit, ordinary Load restored Save19 and Root waited for all12 scenes to publish. Final Paused Native48547/Factory8091,10owners/2984400000mg, actor[6.582930088043213,3.525001287460327,8.5822114944458], source360b00fa/V6. Same13199495B payload, wholeSHA256a2eccec1b71b982b45f069fbfde282c04aa8533d060191bc133672dc8121ecc0 before/after. No Save button/IndexedDB write/profilecopy or saved format change. ACTUAL_VISUAL_AUDIT.json binds camera/player/input state and timestamps to all23 captures. Browser is paused ready for explicit Play.

Final source parity independently hashes692 manifest-covered source/test/config entries against immutable Ready21-v4: zero changed/missing. FINAL_SOURCE_PARITY.json records the readback. Next repair priority is the Distributor's visible surface overlap, followed by a decorative-vegetation fix planned around its existing Native/saved-source boundary. Audit is complete; these repairs were not performed under this inspection request.
