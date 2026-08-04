# Hestia Surface Play — Manual Rejection Analysis

Date: 2026-07-27  
Route: `/?surfacePlay=1`  
Disposition: failed manual acceptance; analysis evidence only  
Worktree HEAD inspected: `20c837d2e2f062fe5d63acf953dfb0f8a6e3cd6b`

The two user-supplied screenshots are failed evidence. They must not be reused
as successful acceptance evidence.

## Current-state evidence

- The protected root checkout has no lasting change. A mistakenly targeted new
  analysis path was removed immediately; the exact path is absent and Git
  reports no entry for it.
- The integration worktree remained intentionally dirty.
- DevToolbox change `browser-hestia-first-person-combat-slice-v1` remains at
  `0/46` completed tasks after the recovery revision (the rejected pre-revision
  inventory was `0/22`) and reuses execution
  `c757ca664e5a4060b90a5ca665380bb6`.
- PID `50820` was no longer running and port `5173` had no listener when this
  analysis resumed. No replacement server was started.
- `git diff --check` passed.
- `apps/weltraum-browser/src/surface-play/contracts/index.ts` remained
  unchanged from contract/base commit
  `fd379d7c160698214ab1471c4f240cbb82ef8620`.

## Root-cause and scope matrix

| Symptom | Classification | Evidence-backed cause | Owning module | Reusable pattern | Required change | Contract impact | Regression proof | Visual/manual acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dark, cyan/green, underwater-looking scene | P0 presentation/world-placement defect | The Environment installs real horizontal water geometry and a global dark background/fog (`environment/hestiaSurfaceEnvironment.ts:65-90,205-237,245-264`). Current tests pin the rejected dark hex values rather than perceived readability (`tests/unit/surfacePlayEnvironment.test.ts:55-92`). | World facts belong to Surface World/Runtime; lighting and materials belong to one Surface presentation owner | Hestia field sampling plus the documented Hestia visual target | Publish water/shore/atmosphere facts from Runtime snapshots; use one Surface light rig; remove dry-land underwater treatment | Internal world/presentation snapshots; no water-medium contract is needed for V1 | World-to-presentation ownership test; exact water/eye/terrain relation; one light-rig owner | Dry spawn has no full-screen water look; terrain, water and vegetation remain distinguishable in foreground, middle ground and background |
| Visible uphill water boundary | P0 world-placement defect | Water is not only fog: shore patches are placed at `seaLevel + 0.055 m` (`environment/hestiaSurfacePresentation.ts:218-254`). There is no inspected camera-medium state; fog is unconditional. | Surface World/Runtime placement | Hestia sea-level and field samples | Treat water as an immutable world fact and keep the playable spawn/traversal area dry; no swimming/underwater gameplay in this slice | Public contract changes only if a later real medium state is added; explicitly out of scope here | Snapshot test comparing `waterSurfaceY`, ground, capsule and eye height | Waterline is spatially readable and never intersects the dry player/camera or masks a dry slope |
| Tiny, steep terrain island and hard edge | P0 bounded-region configuration defect | The fixture contains exactly two resident `0.50 m` bricks with bounds `x=[0,2)`, `y=[-1,0)`, `z=[0,1)` (`surfacePlayConfig.ts:11-27`). Collision and rendering stop at those bounds (`surfacePlayCollision.ts:49-84,114-135`; `surfacePlayPresentation.ts:174-220`). | Surface World configuration and spawn admission | Documented Hestia default visual footprint `64 x 32 x 64 m @ 0.50 m`; world chunk/AABB derivation | Replace the two-brick origin fixture with a deterministic bounded 16-brick footprint around an admitted Hestia land anchor; require slope, clearance, shore and edge reserve | Existing region identity can remain; behavioral/spec change required | Footprint/residency/collision parity test and edge-reserve test | Normal spawn and traversal views show no region edge, void, cyan hard cut, underside or clipping |
| Terrain capped against sea level | P0 world-placement defect | The configured vertical brick band is below and ends at local `y=0`, while Hestia sea level is `0 m`; positive island height can therefore be excluded from resident materialization (`surfacePlayConfig.ts:18-27`; `world-generation/hestia/preset.ts:60-61`). | Surface frame/region selection | Existing SurfaceLocalFrame and Hestia generation | Select and record an explicit surface anchor and vertical band that contains the admitted dry surface, subsurface edit depth and capsule clearance | No required public contract change; identity metadata remains authoritative | Generator/materialization test proves the selected surface lies inside, not on, the resident vertical boundary | Spawn ground is above water with edit depth below it; horizon does not expose the resident vertical cap |
| Existing Terrain destruction must not regress | Preservation requirement; the user reported this as the only partly working behavior | An unobstructed Terrain hit currently becomes one quantized `SubtractSphere` intent, one authority transition, a revision-bound remesh plan and an updated Terrain presentation (`surfacePlayRuntime.ts:327-389`). The new Structural nearest-hit path could accidentally intercept or duplicate that flow. | Combat Core hit selection plus Terrain Voxel Authority | Existing accepted-hit, CAS edit, revision/hash, collision and remesh publication | Preserve the unobstructed Terrain branch unchanged in semantics while adding Structural candidates; never route a Tree miss or body hit into Terrain implicitly | Existing Terrain hit/edit contract remains unchanged | Unobstructed ray -> `TerrainHit` Combat event -> exactly one accepted Terrain CAS edit -> expected revision/hash -> collision and remesh consume the same revision; duplicate/stale paths remain no-effect | A local cut is visible and agrees with recorded revision/collision/remesh evidence; the crater alone is not proof |
| Player starts among near-black trees | Presentation/spawn-admission defect | Spawn is near `(8,8)` while the only vegetation exclusion corridor is around `abs(x) <= 2.25`; the player therefore starts outside the intended clearing (`surfacePlayBootstrap.ts:72-119`; `environment/hestiaSurfacePresentation.ts:31-36,179-182`). Tree colors are nearly black (`hestiaSurfaceEnvironment.ts:92-105`). | World population/spawn admission; Surface presentation | Hestia deterministic population and documented visible ground openings | Admit a spawn clearing and path from world facts; revise material separation and density without changing world truth in Three.js | Folded into the structural-tree contract expansion below | Spawn capsule/vegetation exclusion test; population deterministic for equal identity | No tree intersects the spawn capsule; a continuous ground path is visible; trunks/canopies do not form an opaque wall |
| Idle downhill sliding | P0 locomotion defect | Ground deceleration runs, then gravity is always reapplied (`player/locomotion.ts:198-233`). Contact resolution removes only the into-normal component, leaving gravity projected along the slope (`collision/capsuleResolver.ts:54-57,173-202`). | Locomotion support/contact state | Existing fixed tick, revision-bound collision and ground probe | Add explicit `Unsupported`, `SupportedMoving` and `SupportedResting` internal states. Support reaction/static adhesion captures only stable zero-input walkable contact; steep slopes, input, jump and external impulses remain physical | No required public contract change | 600-tick tests at flat, mid-slope, just below and just above the walkable threshold; input/jump/impulse regressions | Ten seconds without input produces no visible or measured drift on a walkable slope |
| Player and beam pass through visible trees | P0 world/collision parity defect | Trees are only Three.js instanced cylinders/spheres (`hestiaSurfaceEnvironment.ts:50-78,266-347`). Runtime collision is built only from terrain voxel authority (`surfacePlayRuntime.ts:260-267`). Combat resolves only Drone, Terrain or Miss (`combat/surfaceCombatRuntime.ts:225-237,347-443`). | Structural tree authority, collision adapter and Combat Core hit selection | Existing Combat proxy/tie ordering; Structural CAS edits/connectivity | Make Umbrella Trees authoritative structural voxel objects; add revision-bound player/tree collision and nearest Drone/Tree/Terrain beam resolution | Required public contract expansion for structural hits and snapshots | Player capsule blocked by trunk; nearest-hit tie ordering; stale structural revision rejection | Player cannot walk through a trunk; beam stops at the first occupied tree cell |
| Trees are not voxel-based or locally destructible | New functionality explicitly requested after rejection | Scatter facts contain only render placement; no structural object, occupancy, edit revision or support state (`environment/hestiaSurfacePresentation.ts:50-57,196-215`). | Adaptive/Structural voxel authority | Selective port of historical Hestia structural vegetation commit `897711024458062e3965c26cec05bd34c61d50db`; current Structural Core | Compile Umbrella Trees to current Adaptive Level 4/Structural occupancy; apply damage-authorized CAS edits; run root-anchor support analysis | Required structural-object/component/edit summaries | Equal seed gives equal tree graph/object IDs; local edit changes only hit cells; partial cut stays anchored; support loss detaches deterministically | Before/hit/detach frames show a local cut rather than removal of the whole render tree |
| Unsupported tree must physically fall | New bounded physics capability | No authoritative mass, COM, inertia, pose, velocities, contacts or lifecycle exists. Three.js rebuilds static scatter only (`hestiaSurfaceEnvironment.ts:266-369`). Existing Physics Spine has no rotating rigid body or terrain contacts. | New bounded Surface Rigid Body Core | Structural component mass/COM/inertia; fixed Surface tick; terrain collision authority | Publish detached components at tick N and start deterministic physics at tick N+1; lifecycle `Attached -> Falling -> Resting`; resting debris remains session-local and collision-authoritative until route cleanup | Required dynamic-body lifecycle/pose/velocity/source-revision snapshot | N-tick snapshot determinism; off-center rotation; terrain contact/no tunneling; stable contact ordering; deterministic rest tick | Fall is driven by snapshots, not render animation; rest pose and collider agree with runtime evidence |
| `NO ENERGY` and `0 / 54 J` are read as one value | HUD hierarchy defect | `54 J` is Heat capacity, not Energy. Energy is a separate Suit value (`ui/surfacePlayHud.ts:51-114,153-178`). Equal-weight corner panels and center-stacked status make the relationship unclear. | Combat-derived HUD ViewModel and player UI | Existing status HUD warning chips, center-safe edge/bottom layout and next-action copy | Project typed weapon readiness; clearly separate Energy and Heat; use one transient action zone and one warning/next-action zone; do not show raw rejection codes | Contract expansion for Combat-derived readiness/recovery; no UI-authored readiness | Readiness parity test at `< energyPerShot`; bounding-box overlap tests; status lifetime tests | No state can be read as “Energy 0/54”; warning gives reason and next action without covering target/reticle |
| Too little energy for combat/terrain/tree testing | Balance/acceptance defect | Current maximum is `120 J`, each shot costs `12 J`, and there is no recovery (`combat/surfacePulseCutter.ts:8-31`; `combat/fireControl.ts:82-120`). That permits ten accepted shots; the Drone consumes three. | Combat/weapon runtime | Existing fixed-tick weapon advancement and typed `EnergyInsufficient` | Adopt finite test profile: `240 J` maximum, `12 J` per shot, recovery after `3.0 s` without an accepted shot at `12 J/s`, capped at maximum; route/re-entry starts full | Required readiness/recovery fields and behavior in public surface combat/HUD contract | 20 accepted shots; 21st typed rejection; after delay plus one second exactly one shot recovers; cap/reload/re-entry tests | One charge supports 3 Drone, 6 Tree and 8 Terrain hits plus 3 reserve; typed block remains deliberately testable |
| HUD looks debug-like and overlaps gameplay | Player-UI defect | Three equal panels and three absolute center lines use fixed offsets/`nowrap`; action state does not expire and raw Core wording reaches the player (`ui/surfacePlayHud.ts:37-140`; `ui/surfacePlayUiStyles.ts:133-160`; `surfacePlayRuntime.ts:453-469`). | Player-facing HUD ViewModel/UI | Existing flight HUD edge/bottom zoning and `statusHud` severity/next-action chips | Keep center safe for reticle/target; consolidate persistent suit/weapon status at edges; move transient feedback to one bounded zone with explicit lifetime; map typed codes to player-safe copy | Existing snapshots plus typed readiness; no debug telemetry | Pixel/bounding-box tests, copy/lifetime tests, 200% zoom/focus/reduced-motion checks | Target, action and warning never overlap; no raw enum/path; mode, state, risk and next action remain readable |

## Proposed authoritative tree flow

```text
fixed-tick weapon recovery/cooling
-> Beam/Ray query
-> nearest authoritative Drone/Structural/Terrain hit
-> for Attached Structural: pure edit/support/mass/collider candidate
-> reserve the complete detached-body/collider batch
-> reject: FireRejected, no attempted-shot debit/heat or authority effect
   OR accept: Combat FireAccepted + HitEvent/DamagePacket
-> adopt exactly one Structural CAS transition and collision revision
-> atomically publish reserved dynamic bodies
-> physics begins on the next fixed tick
-> immutable presentation snapshot
```

Combat Core remains damage/event authority. Structural/Voxel Authority remains
edit, revision, connectivity and mass-property authority. The new bounded
Surface Rigid Body Core owns fall/rest transitions. Three.js and the HUD remain
projections.

## Defects versus approved scope expansion

Defects to correct:

- water/world placement, dark unreadable presentation and duplicate light rigs;
- tiny/capped region, invalid spawn admission and exposed region boundaries;
- zero-input slope drift;
- visible tree/collision and beam-hit parity;
- HUD overlap, hierarchy, raw copy and Energy/Heat ambiguity;
- finite energy testability.

New functionality requiring explicit approval:

- Umbrella Trees as structural voxel objects;
- local tree voxel damage and root-support failure;
- deterministic rotating falling bodies and resting collision;
- public structural hit/component/body/readiness/recovery contract additions.

Explicit non-goals remain:

- global planet streaming or an orbit-to-surface transition;
- swimming, underwater gameplay or a camera-medium/postprocessing state;
- procedural vegetation types beyond authoritative Umbrella Trees;
- external physics-engine adoption;
- persistence of fallen debris across reloads;
- infinite energy, debug cheats or `window.TestBridge`.

## 2026-07-28 live manual-play feedback (additive failed evidence)

The user reported the following additional defects while the approved V3.1
implementation was still in progress. These observations are additive and do
not interrupt or waive the existing recovery scope:

| Symptom | Classification | Investigation owner | Required regression / acceptance |
| --- | --- | --- | --- |
| `A` and `D` move in the opposite horizontal direction | P0 input/locomotion defect | Surface Play input mapping plus camera-local locomotion basis | Real pointer-lock browser input must prove `A` moves camera-local left and `D` camera-local right at at least two yaw angles; no test-only input global is permitted. |
| Any left click freezes the browser for roughly 10–30 seconds and then reports that the cut was not done because it would be unsafe | P0 responsiveness and action-validity defect | Combat ray selection, Structural edit/support preflight and bounded body reservation | Instrument one real browser click from input receipt through candidate/preflight/result; it must complete within one fixed-tick/action budget without blocking the main thread. Valid Terrain and Tree targets must accept locally; a genuinely unsafe cut must reject promptly with typed, target-specific evidence and no mutation. |
| Sky remains a flat or implausible green/blue field instead of the approved Hestia sky/atmosphere | P0 visual-presentation defect | Hestia world atmosphere facts and the single Surface presentation light/sky owner | Multi-viewport screenshots must show the approved Hestia sky, horizon separation and atmospheric depth; no dry-land frame may be filled by the former flat green/cyan background or underwater fog treatment. |
| Tree heights are inconsistent and some silhouettes are visibly malformed | P0 vegetation/world-presentation defect | Umbrella Tree graph/voxel compilation, scatter scale facts and Structural mesh projection | Equal seed must reproduce bounded, biome-valid height classes and connected non-degenerate voxel graphs. Spawn/midground screenshots must be reviewed for floating, inverted, needle-thin, over-tall or disconnected trunks/canopies. |
| Approaching the bounded playfield edge causes severe lag, stutter and slowdown; no further world is generated | P0 bounded-domain performance/collision defect; unbounded generation remains out of scope | Surface World domain admission, edge collision and any per-tick out-of-domain probing/materialization | The bounded test world may use an authoritative visually unobtrusive collision barrier. Repeated movement into every edge must remain inside the admitted domain with stable bounded tick/frame time and must not trigger generation, remesh, collision rebuild or allocation storms. |
| Walking into the large tree reports `Movement paused because the surface state changed` and leaves the game permanently frozen | P0 collision-revision/liveness defect | Surface Runtime adoption order, revision-bound Terrain/Structural collision snapshots, player movement pause/recovery and live-HMR bootstrap replacement | Reproduce both in a stable build and across one deliberate HMR. Tree contact must resolve without changing authority. A real revision change may pause at most until the matching immutable collision snapshot is adopted, then recover automatically on the next valid tick; no permanent input/simulation freeze is allowed. |
| After an accepted Terrain cut creates a crater, movement becomes extremely slow and spongy; the player sinks gradually and cannot normally enter, jump out of or walk out of the hole | P0 post-edit locomotion/collision/grounding defect | Terrain authority adoption, revision-bound collision replacement, capsule sweep/depenetration, support probing and step/jump transitions over newly empty concave cells | Reproduce with a safe accepted cut through real browser input. Authority, collision and presentation must adopt one matching revision atomically. The capsule must enter genuinely empty crater cells under normal movement/gravity, remain responsive at fixed tick, ground on the edited surface and leave by valid walk/slope/jump rules; no stale solid floor, slow sinking, sticky damping, repeated depenetration or permanent rejection is allowed. |
| Overall art direction and UI still do not resemble the user-provided UI-concept screenshot or the readable physical voxel style of `Teardown` | Deferred P2 visual/style parity; explicitly sequenced after Core correctness and performance | Surface visual language across sky, lighting, materials, voxel scale/readability, effects and player HUD composition | After P0 Core/performance gates pass, extract a bounded reference checklist from the local UI-concept evidence and user target. Capture matched camera/viewport comparisons for hierarchy, palette, material readability, destruction feedback, silhouette and depth; do not imitate copyrighted assets or let Presentation author gameplay truth. |
| Application startup has no visible loading progress/state | Deferred P2 startup UX request; additive and non-blocking for the active Core fixes | Route/bootstrap readiness and player-facing startup/failure presentation | From route entry until playable, expose an accessible loader with real phase labels. Show determinate progress only for finite measured work and otherwise an honest indeterminate state. Prove monotonic phase order, clean ready removal, typed-failure replacement, reload, reduced-motion and no blank/endless-loading state. |
| Ordinary clicks frequently show `The terrain cut would make this test area unsafe. Aim farther from the dry boundary.` even when no nearby Dry boundary is apparent | P0 action-validity/rejection-classification defect; attached screenshot is failed evidence | Nearest-hit selection, quantized Terrain candidate, Dry/traversal revalidation and rejection-to-copy mapping | Replay with real Pointer Lock at measured interior and true-boundary targets. Record hit owner/position/radius, distance to immutable Dry boundary, before/after authority and exact validator result. Interior valid cuts accept promptly; only real invariant violations reject promptly with this copy and no mutation or Energy/Heat debit. |
| A detached tree becomes immutable after it falls and cannot be cut further | User-required V3.2 feature expansion; explicitly contradicts approved V3.1 `DetachedBodyImmutable` behavior | Combat dynamic-body ray hit, body-local Structural authority, split/mass/inertia/collider rebuild and bounded rigid-body publication | After a separately approved contract plan, both Falling and Resting voxel bodies keep pose-correct hitboxes and accept local damage. Recompute/split atomically under budgets, preserve deterministic world pose/momentum, publish matching collision/visual snapshots and permit repeated responsive cuts without ghost cells or Terrain fall-through. |
| A Tree shot still takes several seconds before the voxel change becomes visible, then the detached body can stop all Surface physics with `MotionBudgetExceeded` | P0 responsiveness plus rigid-body/Terrain-contact defect; latest attached screenshot is failed evidence | The live immutable snapshot at tick `21156` records body `surface-tree-body:fnv1a64-v1:2b5ba34a10ab2d06` at `y=0.3437032617 m` with vertical speed `-14.3623448797 m/s`, after detachment at tick `20622`, followed by typed `physicsFailure.code=MotionBudgetExceeded`. This proves the pointer-release overlay is a consequence of the fail-closed simulation stop, not the initiating cause. The remaining click-to-visible latency is not disproved by faster isolated Structural/collision benchmarks. | Surface Tree hot path, Runtime publication and bounded rigid-body Terrain contact | Instrument a real Pointer-Lock shot from input receipt to the first authoritative visible edit, then trace the detached body through contact/rest. The edit must become visibly authoritative within the pinned latency budget; the body must contact Terrain, show intermediate Falling poses and rest without going below the surface, releasing Pointer Lock or stopping physics. Raising the motion cap alone is not an accepted fix. |

These reports are failed evidence until reproduced and resolved. They must be
included in the final real-browser play matrix and cannot be closed by unit
tests or DOM assertions alone.

The supplied unsafe-rejection screenshot is persisted as
`tests/screenshots/failed-live-frequent-terrain-boundary-rejection-2026-07-28.png`.
It is failed evidence only. The editable-fallen-body request is not authorized
by V3.1 and must not be silently implemented under the current
`DetachedBodyImmutable` contract.

The latest Tree latency/physics-stop screenshot is persisted as
`tests/screenshots/failed-live-tree-cut-latency-physics-stop-2026-07-28.png`
with SHA-256
`5D39A6E7D66958E603D7E633A927DEFBF26AC1586E69F51A6CE9AACD90AD5B84`.
It is failed evidence only. The visible `POINTER RELEASED`/resume overlay is
paired with the typed Runtime evidence above and must not be diagnosed as a
standalone input defect.

The separately blocked editable-body decision is now self-contained in
`docs/browser-mainline/hestia-first-person-combat-slice-v1-v3.2-editable-detached-bodies-execplan.md`.
It is a plan, not implemented behavior: V3.1 remains authoritative until the
user explicitly approves the named contract migration.

## 2026-07-28 Hestia concept-reference intake

The user added a binding visual-direction set under
`docs/Konzeptart/Hestia` in the protected root checkout. Read-only inventory
found `23` PNG files with `18` unique SHA-256 contents. Representative review
shows a bright, high-visibility Hestia direction with blue sky and water,
green/lush terrain, legible vegetation/material separation, atmospheric depth
and a futuristic coastal-city language. The complete unique set, not one
isolated frame, is the later visual-parity reference.

Scope decisions from the user:

- the current slice must move toward this visual language after the active
  Core-correctness and performance blockers are green;
- the different depicted biomes are future world-roadmap targets, not a
  requirement to add streaming or multi-biome generation to this recovery
  slice;
- the depicted city is explicitly deferred and will later be authored by the
  user and agents by hand; procedural city generation is not implied;
- these references do not turn the rejected current screenshots into
  acceptance evidence and do not weaken Runtime/world authority boundaries.

## Evidence limits

- The failed screenshots were user-provided and assessed as rejection evidence.
- The former managed Vite process was already stopped, so exact live camera,
  terrain and water Y values were not recaptured.
- A mesh underside in the failed frame was not proven; the hard bounded region
  edge and real water patches were proven statically.
- Screenshots cannot by themselves prove collision, deterministic physics,
  focus order or authority ownership. Those claims require paired runtime/tick,
  revision and lifecycle evidence.

## 2026-07-28 implementation-review addendum

The historical statements above describe the rejected pre-recovery state. The
worktree has since implemented the approved V3 contract and behavior delta;
those statements must not be read as a current contract-diff assertion.

| Symptom / review finding | Classification | Evidence-backed cause | Owner | Reusable pattern | Required V3.1 change | Contract impact | Regression proof | Visual/manual acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A later stump hit can duplicate the already detached crown/body | Approved-feature defect plus newly discovered contract gap | Current Tree Runtime keeps detached cells in the current Structural object and suppresses only the old revision-bound Component ID. A later edit changes object revision/hash, therefore changes Component/Fragment IDs, leaves transferred cells editable and cannot represent historic source plus current stump in the existing current-only Component list. | Structural Core owns transfer/revision/evidence; Surface Tree Runtime owns immutable body-source archive and atomic adoption; Presentation remains projection-only | Existing canonical Structural Fragments, immutable command evidence, pure command apply, bounded body reservation and Dynamic Body source bindings | Separate validated/hashed `TransferDetachedComponents` command: Damage source `r+1/e+1`, exact detached-Fragment transfer to current `r+2/e+2`, current Attached-only cells/collision, immutable historic source Object/Component/Fragment/mass/collider/mesh, cold resolver | Required nullable transition `authorityTransfer`; required presentation `bodySources`; no Dynamic Body, Combat event or rejection-union expansion | Hit 1/2 anchored; hit 3 exactly one source/body and lossless cell partition; hit 4 only stump revision advances; no ghost cell/collider or duplicate body; all historic IDs/hashes/artifacts byte-equal; empty-current, persistence/tamper/cap/budget/cold-resolver tests | Tree detaches/falls/rests once; later stump hit remains local; fallen body neither jumps/rebuilds nor disappears and still blocks/hits as immutable |
| Every Tree cut freezes the live browser for about five seconds; the falling body is visible only before and after the fall; another cut cannot be exercised afterward | P0 runtime-performance and testability defect observed in the 2026-07-28 live playtest | The authoritative transition reaches detach/rest, but current unit timing does not prove main-thread responsiveness, intermediate presentation frames or a repeatable post-detach target. Phase timing across hit/preflight, Structural edit/transfer, collider/mesh publication and rigid-body ticks is still missing. | Surface Tree Runtime and bounded Physics own work scheduling/state; Presentation consumes immutable per-tick snapshots | Existing fixed-tick order, identity caches, bounded body/collider budgets and real-input Browser health probes | Pin a real click-to-published-result latency gate, bound every synchronous phase, prove intermediate Falling poses reach animation frames, and keep a valid current Attached stump target after detach while the immutable body remains `DetachedBodyImmutable` | No new public contract is implied; existing transition/body/readiness facts must remain authoritative | Phase-level benchmark plus real-browser tick/frame trace; repeated Attached-stump cut succeeds or rejects for a specific typed reason, never because the slice became untestable | Each accepted cut remains responsive, the player sees multiple Falling frames, and the next valid stump cut can be performed without reload |
| A detached live Tree misses Terrain contact, falls below the local surface and terminates bounded physics as `MotionBudgetExceeded` | P0 deterministic physics/contact defect; fail-closed stop is correct only after an earlier invalid trajectory | Live snapshot: detach tick `20622`; failure tick `21156`; body position `y=0.3437032617 m`; vertical velocity `-14.3623448797 m/s`; one Falling body; `physicsFailure.bodyIds` contains the same body. The player remained grounded around the admitted surface near `y=11.72 m`. | Surface Rigid Body Core and Runtime-derived Terrain colliders own contact; Presentation and pointer-lock UI are consequences only | Existing bounded substeps, deterministic Terrain collider derivation and immutable dynamic-body snapshots | Fix the proven frame/contact/tunneling cause so the route-realistic body collides and rests; preserve the bounded motion guard and typed failure for genuine runaway state | No new public contract is expected unless diagnosis proves a frame field is missing; any such delta requires plan review | Route-realistic tree fixture must produce at least three distinct Falling poses, a deterministic Terrain contact tick and Resting state with no below-surface center/collider, `MotionBudgetExceeded` or simulation stop | The user sees a smooth fall and retains immediate control; no pointer-release/error overlay appears |
| After a real Terrain cut the live player still moves slowly and remains `AIRBORNE` in the crater even after the Shore-mask correction | P0 post-edit collision/support defect; the earlier synthetic regression is insufficient | Preserving the coast mask removed one internal boundary wall, but the real Pointer-Lock route still fails to acquire stable capsule/ground support on the edited concave surface. A center-only ground ray and incomplete capsule surface/overlap handling remain candidate causes until browser evidence isolates them. | Surface collision capsule sweep, ground probe and locomotion support state | Existing deterministic ring probes, revision-bound collision snapshots and fixed-tick support state machine | Reproduce the real aim/cut/entry path; compare frame/tick progress, terrain sweep contacts and center/ring support; implement only the smallest proven capsule/support correction with bounded probes and no velocity-zero workaround | No expected public contract change | Real-input crater test must enter, fall, acquire `GROUNDED`, jump and exit with stable authority/hash and no multi-frame stall; synthetic direct-state setup alone cannot pass | HUD changes from `AIRBORNE` to `GROUNDED` on the crater floor; movement is normal and responsive throughout |

Fresh independent evidence already obtained while V3.1 remains blocked:

- World-owned environment plus read-only Runtime-probe matrix: `37/37` focused
  tests passed.
- Structural budget/public-export regression matrix: `19/19` focused tests
  passed.
- Production build: `244` modules, passed.
- Real installed-Chrome route: the original four smoke/query/input tests passed;
  the new dry-spawn test passed `600` real fixed ticks with position drift and
  speed each at or below `1e-6`, no browser-health error, zero water patches in
  the admitted dry footprint, and a `1920x1080` screenshot plus bounded JSON.
- Fresh post-fix installed-Chrome diagnosis accepted six overlapping real
  Pointer-Lock Terrain cuts (`rev 0 -> 6`), kept the original Dry mask, crossed
  the deepest cut without slow samples, reacquired grounded support after a
  short real fall, and passed rest/jump/landing with no browser-health error.
  The prior user failure remains failed evidence until a refreshed manual
  replay agrees; this diagnostic result is not final acceptance.
- This evidence does not approve V3.1, the remaining browser matrix or manual
  acceptance.

## 2026-07-29 live manual-play checkpoint before host restart

The user reported that Terrain cutting now succeeds at every location they
reasonably expected to be editable. The former generic unsafe/dry-boundary
message did not recur in this replay. This is positive manual evidence for the
post-edit admission-policy correction, but it does not replace the pending
measured interior/true-boundary regression matrix.

The same replay still showed an unacceptable roughly one-second complete frame
freeze for each cut. The edit eventually becomes visible, but the action is not
instant or responsive. This independently confirms the remaining P0 hot-path
finding: synchronous authority, collision, Terrain-contact and mesh work must
be measured separately and the real input-to-acknowledgement and
input-to-authoritative-visible gates must pass without a long main-thread task.

The user also added an authoritative support requirement: Terrain destruction
under an Attached tree must invalidate and recompute the tree's actual ground
support. Remaining support footprint, center of mass, undercut side and contact
geometry must determine whether and in which direction the tree tips or falls.
The resulting state must use deterministic Rigid Body physics and matching
collision, hit and destruction authority; a Presentation-only falling animation
is explicitly insufficient. This behavior is not silently authorized by V3.1.
It must be added as an explicit plan/contract/test delta before implementation,
including undercut-with-partial-support, asymmetric undercut, complete support
loss, stable remaining support and post-fall editability scenarios.

The host was about to restart after this checkpoint. The previously managed
Vite PID `118908` and listener on port `5173` were already absent during final
read-only cleanup. On continuation, start exactly one managed Vite process,
open `/?surfacePlay=1`, reconnect Chrome DevTools and re-establish fresh runtime
evidence before resuming browser automation.

## 2026-07-29 post-restart real-browser performance checkpoint

The environment was restored with the exact pinned Node 22 binary, one Vite
listener on `127.0.0.1:5173` (PID `29352`) and the existing Chrome DevTools
session brought back to `/?surfacePlay=1`. The route reached `ready`, published
`GROUNDED`, `240 / 240 J`, no typed failure and no `window.TestBridge` property.

A new external Playwright harness then used real Pointer Lock, real mouse aim
and real clicks without mutating gameplay through a browser global. It records
click-to-published Structural revision latency, the Chromium Long Tasks API,
distinct immutable Dynamic Body poses, browser health and Falling/Resting
screenshots. Its first complete run produced RED evidence:

- two accepted Structural hits; detach occurred on the second hit;
- click-to-published latency was `450 ms` and `739 ms`;
- the main thread published Long Tasks of `392 ms` and `648 ms`;
- Energy moved `240 -> 228 -> 216 J` with no rejection;
- one body progressed through many distinct `Falling` snapshots and reached
  `Resting` without `physicsFailure`;
- console, page, request and HTTP health remained clean;
- `window.TestBridge` remained absent.

The bounded JSON and screenshots are under
`apps/weltraum-browser/evidence/playwright-output/hestia-tree-hotpath-20260729-r2/`.
They are failed performance/behavior evidence, not acceptance evidence. The
run failed the pinned `<=250 ms` click-to-published and `<=100 ms` Long Task
gates.

Static and measured RCA binds most of the remaining freeze to synchronous
Rigid-Terrain adoption: every edit rebuilds the complete `24 x 24` contact
patch through exactly `576` Authority Ground rays. The measured Terrain phase
alone took `593.2 ms` after an edit (`707.4 ms` fresh); current detached-body
physics additionally considers `55 x 576 = 31,680` Body/Terrain AABB pairs per
substep. A contract-neutral incremental patch and deterministic immutable XZ
broadphase are therefore active implementation slices. They must preserve the
current Terrain semantics and must not be represented as correct cave or
undercut physics.

The screenshots expose an additional failure hidden by lifecycle-only tests:
the detached tree begins with identity orientation and zero angular velocity,
drops mostly vertically, and reaches `Resting` with only a few degrees of
rotation. It remains visually upright instead of toppling. Multiple distinct
poses and `Falling -> Resting` are therefore necessary but insufficient
acceptance. The refreshed browser gate must also require a meaningful,
deterministic change of orientation and/or support-relative center-of-mass
displacement that visibly produces a physical fall, without a render-only
animation or arbitrary cosmetic impulse.

Independent support analysis classifies Terrain-under-tree destruction as a
separate V3.3 contract slice after the still-unapproved V3.2 editable-body
slice. Current Structural anchors are authored as permanent facts and Terrain
edits neither reclassify Attached support nor wake Resting bodies. Correct
support release requires revision-bound Terrain support evidence, pinned
Encounter placement, an atomic Terrain/Tree/Body transaction and new public
support snapshots/transitions. No such Contract behavior is authorized or
implemented by the current performance work.

## 2026-07-29 performance-debug overlay requirement

The user requested a developer-facing diagnostic overlay to make real browser
playtests and performance debugging materially easier. It must be toggled by a
documented keyboard chord and must remain completely absent from the normal
player HUD while disabled.

The proposed slice must show at least current FPS; current, rolling p50, p95
and maximum frame time; and a bounded scrolling frame-time graph. Useful
read-only correlated diagnostics include fixed simulation tick, authority/edit
revisions, Dynamic Body count and lifecycle, contact/substep counts, last
accepted/rejected action, click-to-authority/visible latency and Long Task
count/duration. Exact fields and the shortcut remain plan decisions rather than
silent implementation choices.

This overlay is test instrumentation and projection only. It must not own or
mutate gameplay, Combat, Voxel, Terrain, Structural or Physics truth; must not
change fixed-tick order; must not expose a gameplay command or browser-global
mutator; and must keep `window.TestBridge` absent. Its sampling buffers must be
strictly bounded and its own measured overhead must stay below an approved
budget. The requirement is queued behind the active P0 cut-freeze fixes and is
not acceptance evidence for those fixes.

## 2026-07-29 repeated Tree-cut physics-stop failure

The user produced another real manual-play P0 failure after repeatedly cutting
the large Structural tree. The accepted action toast still read `Tree cut
applied.`, but the route then entered the terminal warning `Surface physics
stopped safely. Re-enter Surface Play to clear fallen debris.` The screenshot
shows a heavily perforated still-upright trunk, separated crown/debris pieces
on the Terrain and a remaining crown at the top. This is failed evidence, not
user error and not an acceptable recovery experience.

The original screenshot is preserved byte-for-byte as
`tests/screenshots/failed-live-repeated-tree-cut-physics-stop-2026-07-29.png`
with SHA-256
`D6B88111299729C4C2B4A33F9793B87FAFE90A58FC6D73B6DE4A9C7708C41DA0`.

The typed failure snapshot could not be recovered from that exact stopped
runtime: an unrelated in-progress source edit triggered Vite HMR while the
diagnostic probe was being prepared and re-created Surface Play. The next
read-only snapshot was a clean new runtime at simulation tick `4`, with no body
source, Dynamic Body, transition or Physics failure and with `window.TestBridge`
still absent. That automatic reset is not a fix and must not be counted as
acceptance evidence.

The runtime emits this terminal message only after its authoritative
`SurfaceRigidBodyWorld.physicsFailure` becomes non-null. A controlled real-input
reproduction must therefore capture the exact failure code, failing tick, body
IDs, body pose/velocities, collider count, contact/substep work and final
Structural transition before any reload or HMR. The regression gate must keep
repeated valid Attached-tree cuts and the subsequent fall responsive, preserve
the typed bounded-Physics guard for genuine runaway states, and prove that no
accepted sequence strands the route in this terminal state.

## 2026-07-29 player trapped inside a Resting Tree body

The next live manual replay produced a separate P0 locomotion/collision failure:
the player became permanently trapped inside the fallen Tree geometry. This is
not automatically resolved by making detached bodies editable in V3.2. The
current body already has an authoritative voxel-derived source, a pose-bound
Dynamic Body and collider revision; V3.2 adds body-local edit authority rather
than repairing player collision response.

The original screenshot is preserved byte-for-byte as
`tests/screenshots/failed-live-player-trapped-in-resting-tree-velocity-runaway-2026-07-29.png`
with SHA-256
`AD32259F2D149237061D7BF324E6CC934B4CA492255E9EDE6C227F5E4F0D603A`.

Unlike the preceding HMR-reset failure, this runtime remained available for a
read-only probe. At simulation tick `17036` it published:

- player position `(64.8088771, 10.8383324, -39.6920815) m`;
- `AIRBORNE`, `Unsupported`, with no Runtime rejection;
- player velocity `(3.8937412, -967.4906532, -0.9599250) m/s` while the
  visible player position remained fixed;
- one `Resting` Dynamic Body at
  `(61.0427459, 10.6886834, -40.3952632) m`, collider revision `3`, zero
  linear/angular velocity and no `physicsFailure`;
- `window.TestBridge` absent.

A second non-mutating sample proved unbounded gravity accumulation without
resolved fall motion: between ticks `17707` and `17711`, player position stayed
byte-identical while vertical velocity changed from `-1099.2303199` to
`-1100.0156532 m/s`. The Resting body pose stayed unchanged and Physics still
reported no failure.

This evidence binds the defect to player Capsule collision/support/velocity
resolution against a pose-bound Resting body, not to missing Tree geometry.
The fix must preserve the real collider, prevent or deterministically resolve
Capsule overlap, project velocity against resolved contact/support rather than
blindly accumulating gravity behind a blocked sweep, and leave a responsive
escape path. A global velocity-zero workaround is forbidden. Regression proof
must cover a falling body approaching the player, a Resting body contact from
multiple faces, bounded finite velocity, stable tick progress, lateral escape
and re-acquired grounded/jump behavior without weakening collision authority.

## 2026-07-29 real-Chrome Tree hotpath and physical-fall gate r3

After the incremental Terrain adoption and bounded rigid-body broadphase work,
the focused external Playwright harness was rerun against the managed Vite
server with the pinned Node 22 binary and the installed Google Chrome. It used
real Pointer Lock, mouse aim and clicks and did not expose or mutate gameplay
through `window.TestBridge`.

The run remained RED:

- the first accepted anchored hit published in `257 ms`;
- the second accepted hit detached the Tree and published in `393 ms`;
- Chromium observed Long Tasks of `192 ms`, `171 ms` and `73 ms`;
- the Dynamic Body published `71` distinct poses and transitioned
  `Falling -> Resting`;
- the final rotation was only `0.0818539 rad` (about `4.69 degrees`);
- lateral center-of-mass displacement was only `0.0898519 m`;
- no `physicsFailure`, rejection, console/page/request error or health error
  occurred, and `window.TestBridge` remained absent.

The result therefore fails the pinned `<=250 ms` click-to-published,
`<=100 ms` Long Task, `>=45 degree` rotation and `>=0.5 m` lateral displacement
gates. Lifecycle progress alone is not evidence of a visibly physical fall.

Bounded evidence is stored under
`apps/weltraum-browser/evidence/playwright-output/hestia-tree-hotpath-20260729-r3/`.
The machine-readable attachment is
`attachments/real-input-tree-cut-and-fall-4d892fd9e785cffbe83b2a863e56d250fc3cec1f.json`
with SHA-256
`F9A900A880B9FD95C119D458BA21A6E4F5BA03236B77346B51A5B72908252EA2`.
All r3 artifacts remain failed evidence and must not be reused as acceptance
evidence.

### Structural preflight hit-2 profile

The bounded profile for the `133.59 ms` Node-22 hit-2 failure does not show a
single accidental duplicate call. Hit 2 repeats the complete Damage and
Connectivity derivation and additionally performs detachment, transfer and
Dynamic Body construction. The recorded phase split was:

| Phase | Hit 1 | Hit 2 |
| --- | ---: | ---: |
| Damage preview | `63.926 ms` | `74.596 ms` |
| Detached facts | n/a | `4.655 ms` |
| Body source and collider | n/a | `10.413 ms` |
| Transfer and final Authority | n/a | `35.890 ms` |
| Collision snapshot and hash | `21.650 ms` | `10.653 ms` |
| Total | `87.220 ms` | `136.207 ms` |

Connectivity classification accounts for about `43.378 ms` of hit 2 and
detached transfer for `30.829 ms`; hit 2 also contains about `14.855 ms` of GC.
The first bounded optimization candidate is therefore reuse of the six global
neighbor keys for identity-reused immutable occupied entries. This must retain
all Safe-Integer checks, lookup order, budgets, component/fragment IDs and
hashes. If that single semantically neutral attempt does not materially reduce
the real browser Long Task, additional small caches must not be stacked; the
next design boundary is a persistent/dynamic Connectivity index or prepared
Structural work outside the synchronous input frame.

The temporary Node profile is diagnostic only: it contains generated phase
instrumentation absent from the current TypeScript source and is neither a
stable CI time gate nor acceptance evidence. Deterministic work statistics
belong in Unit tests; the `<100 ms` Long Task gate remains a warm real-Chrome
measurement.

The bounded occupied-entry Neighbor-key cache experiment was then measured and
rejected. Baseline hit 1/hit 2 maxima were `58.113/94.373 ms`; the cache produced
`118.635/117.171 ms` in its first run and `65.625/105.446 ms` in a control run.
It was fully removed, leaving `connectivity.ts` byte-identical to its entry
state (SHA-256
`B52246AD064625CFF44BAB79E11E6F8ACE4084A2D3CFC30466D47C6690AF4872`).
No optimization claim is made from normal run variance. Hit 2 remains RED and
the next investigation must use the already declared persistent/dynamic index
or prepared-work boundary.

The same semantic run exposed one independently pre-existing dirty assertion:
the detached-transfer test expecting surviving Address object reference
identity is reproducibly RED in the restored baseline (`23/24` semantic tests
passed). It is tracked separately and must not be attributed to the rejected
cache.

## 2026-07-29 target-fire hang lost through an automatic HMR reload

During parallel source editing the user reported that the survey Target could
no longer be shot and the visible browser had hung. Vite automatically reloaded
the page before the exact runtime snapshot could be preserved. Chrome retained
one concrete error from that replaced document:

```text
Uncaught VoxelContractError: VoxelMeshProduct is invalid
```

The preserved console history also showed multiple Vite reconnects around the
error. Those reconnects explain why the failing document was lost; they do not
prove that HMR caused the invalid mesh. The exact error text is emitted by the
Surface Nets degenerate-geometry guard, so an edited Terrain/Voxel geometry is
also a live hypothesis. No Combat, Voxel, HMR or Physics code is assigned as
the exact root cause until a controlled reproduction captures the validation
issue path and triggering edit.

One subsequent Chrome-DevTools canvas click was unsuitable evidence because
that automation held the mouse input long enough to issue repeated commands.
Its resulting state was explicitly discarded and the visible page was cleanly
reloaded before the controlled gate below.

A dedicated external installed-Chrome test then used real Pointer Lock, aimed
from the immutable World snapshot at the Survey Drone and issued exactly one
short click. The coherent build passed:

- Target integrity `75 -> 45`, condition `Operational -> Damaged`;
- `Accepted` with hit kind `Target`;
- Energy `240 -> 228 J` and expected Heat/Cooldown publication;
- click-to-published latency `83 ms`;
- no Long Task, rejection, pointer release, console/page/request/HTTP error or
  `window.TestBridge`.

Evidence is under
`apps/weltraum-browser/evidence/playwright-output/hestia-target-shot-20260729-r1/`.
The JSON SHA-256 is
`FDC6B037040417A16F9BF491B8AD7DBA0E9C194D14E9A0F35F88E2AB0AA4F169`;
the `1920x1080` screenshot SHA-256 is
`2E773E863B8FBD53BBADB4DD367626EDF8C8699D11E943027E55601B216907E4`.

This proves the stable Target path for one shot; it does not erase the lost
invalid-mesh failure. Coherent multi-file source changes must be applied as
bounded units. The later post-World/Core regression pass must distinguish a
Terrain/Surface-Nets degeneracy from an incoherent HMR graph and prove that
neither leaves an invalid mesh product or frozen input/runtime.

## 2026-07-29 accepted Tree cut triggers MotionBudgetExceeded

At `2026-07-29T12:57:06+02:00` the user performed another real manual Tree
cut in the visible managed Chrome session. The cut was visibly accepted, but
Surface Physics immediately entered its fatal fail-closed state:

```text
Surface physics stopped safely. Re-enter Surface Play to clear fallen debris.
```

The user screenshot is preserved as
`tests/screenshots/user-manual-tree-motion-budget-exceeded-20260729-125706.png`
with SHA-256
`1D3136C31F2660E17C4AF5D1C404A87E567BE6899830BD36F4F350AD9087D4CA`.
It is failed evidence, not acceptance evidence.

Before any reload, the read-only active Runtime snapshot bound the failure to
the accepted command and first body tick:

- fire command `surface_command:58101c534300a053` was
  `Accepted/Structural` at simulation tick `20075`;
- the same command published `StructuralHit`, `StructuralDamaged` and
  `StructuralDetached`;
- the detached transfer contained only `1` transferred cell while the edit
  changed `78` cells;
- the new Falling body had linear velocity
  `(0, 0, 100.82461538461538) m/s`;
- its angular velocity was
  `(-13645.422998064734, 8977.134491267021, 0) rad/s`;
- Surface Physics failed on tick `20076` with
  `MotionBudgetExceeded`;
- the player itself remained finite, grounded and `SupportedResting`;
- Chrome also reported that the focused resume button was hidden below an
  `aria-hidden` pointer-lock ancestor; this is a separate P2 UI accessibility
  regression and not the physics failure cause;
- `window.TestBridge` remained absent.

This invalidates the current fixed `128 N*s` Tree-release candidate for the
real accepted-hit population. Unit fixtures that only detach a sufficiently
massive component do not cover a tiny detached fragment with correspondingly
small mass/inertia. The correction must derive a deterministic bounded release
from accepted hit, detached mass and inertia and must prove the entire admitted
fragment-size range cannot exceed motion budgets. It must not hide the defect
by raising the fail-closed physics guardrails.

The concurrent installed-Chrome automated r4 gate was also RED even in its
non-fatal fall fixture:

- maximum click-to-published latency was `442 ms` against `<=250 ms`;
- maximum Long Task was `237 ms` against `<=100 ms`;
- the test therefore failed despite reaching a Falling and Resting pose.

The r4 JSON and screenshots are stored under
`apps/weltraum-browser/evidence/playwright-output/hestia-tree-release-gate-20260729-r4/`.
The JSON SHA-256 is
`ADF1E08FB278F6A24DA6DA9CD9E5C5CD9148255B06637E56827264F9B8FD6650`;
the Falling screenshot SHA-256 is
`FB2C5A2858B590988CCFD888D3FB3EB1DE57ABA8F1ADBC9829E59C338279BE53`;
the Resting screenshot SHA-256 is
`FE50BB1E37A8B8F3B2188A8F72F9895AE4CA9603F75AC959F8A73C9117E3E475`.
No part of r4 is successful acceptance evidence.

## 2026-07-29 recurrent edited-brick Surface Nets failure

The managed Vite error log captured a second independent occurrence at
`2026-07-29T13:10:59+02:00`:

```text
VoxelContractError: VoxelMeshProduct is invalid
  at failGeometry (src/voxel/surfaceNets.ts:99)
  at emitGeometry (src/voxel/surfaceNets.ts:330)
  at createSurfaceNetsVoxelMeshProduct (src/voxel/surfaceNets.ts:609)
  at publishBrick (src/surface-play/surfacePlayPresentation.ts:234)
  at Object.present (src/surface-play/surfacePlayPresentation.ts:347)
  at publish (src/surface-play/surfacePlayBootstrap.ts:428)
  at frame (src/surface-play/surfacePlayBootstrap.ts:501)
```

There was no adjacent source-save/page-reload event at that timestamp: the
preceding Vite reload was at `13:00:31` and the next one at `13:46:02`.
Therefore incoherent HMR is not required to trigger this failure. The concrete
failing path is the Presentation remesh of an adopted Surface voxel brick.
This strengthens the edited-Terrain/Surface-Nets degeneracy hypothesis while
leaving the exact degenerate geometry predicate and triggering edit to the
explicitly deferred post-World/Core reproduction. It does not authorize a
Presentation fallback that hides an invalid authoritative mesh product.

The same managed log captured a third occurrence at
`2026-07-29T14:01:50+02:00` with the identical
`failGeometry -> emitGeometry -> createSurfaceNetsVoxelMeshProduct ->
publishBrick -> present -> publish -> frame` stack. The most recent source
reloads before it were the coherent Tree-release saves at `13:54:01`, almost
eight minutes earlier. This repeated delayed occurrence further rules out a
source-save event as a necessary trigger. It remains failed diagnostic
evidence, not acceptance, and stays deferred behind the explicitly ordered
Core, F1-debug and World/Biome slices.

## 2026-07-29 delayed multi-body MotionBudgetExceeded

At `2026-07-29T13:50:16+02:00` another accepted manual Structural cut entered
the same fatal fail-closed state. The screenshot is preserved as
`tests/screenshots/user-manual-tree-multibody-motion-budget-exceeded-20260729.png`
with SHA-256
`A7343BB951506855B0ACF7FE153A4B5B9F064A3AB3AC76692507402B82D16F3F`.
It is failed evidence.

The pre-reload Runtime snapshot differs materially from the earlier one-cell
first-tick failure:

- command `surface_command:d32c476d39b0181b` was `Accepted/Structural` at
  tick `1162`;
- the new detached transfer contained `318` cells after a `9`-cell edit;
- two Dynamic Bodies were still `Falling` at tick `1175`;
- body 1 velocity was `(-1.2102, -0.5380, -2.1287) m/s` and angular velocity
  `(-7.9032, 3.3392, 3.8801) rad/s`;
- body 2 velocity was `(0, -2.5523, 1.6487) m/s` and angular velocity
  `(-5.4935, 6.1860, 0.0179) rad/s`;
- tick `1176` failed with `MotionBudgetExceeded` and named both body IDs;
- the player remained finite, grounded and `SupportedResting`;
- `window.TestBridge` remained absent.

This failure occurred fourteen ticks after the accepted detach and can involve
subsequent Body/Body or Body/Terrain contact energy. It predates the bounded
release implementation but is not proven to be fixed by limiting initial
release alone. The bounded-release test/report must therefore distinguish the
already proven first-tick overspeed fix from this separate multi-body/contact
P0, preserve the exact snapshot and add a deterministic reproduction or leave
the overall Tree browser gate closed.

## 2026-07-29 async/unbounded-physics product direction and later manual findings

The following user decisions and failed manual observations are additive to
the earlier rejection and remain open until a fresh browser gate proves them:

- F1 diagnostics made Cutter-triggered main-thread spikes directly visible;
  one user capture showed `MAX 266.70 ms`. Structural preparation must not
  execute as one synchronous input task.
- A heavily edited attached Tree produced `This cut is too complex to
  simulate.` This is not an acceptable terminal gameplay state: the intended
  product permits continued local destruction of valid Structural material.
- Cutting branches again produced a fatal Surface-Physics stop. A later F1
  capture identified `MotionBudgetExceeded` at tick `12956` for one Falling
  body. The failure therefore remains live after the first contact-impulse
  correction.
- The user explicitly approved asynchronous/multithreaded preparation and
  deterministic continuations. Immediate click feedback may precede the
  authoritative result, provided stale results cannot be adopted and the
  authoritative change does not lag indefinitely.
- Fixed gameplay-count rejections are not an acceptable capacity model.
  Specifically, `Too many fallen pieces would be active` must be removed as a
  normal valid-cut outcome. Finite CPU/GPU resources may bound work per slice,
  queue occupancy, residency and representation detail, but must not silently
  delete, merge or make logical pieces immutable.
- Adaptive/coarser Physics representations are explicitly allowed when exact
  fine-voxel simulation would exceed a work slice. Structural/Voxel Authority
  remains exact; the approximation must be deterministic, conservative,
  revision-bound and replaceable by a finer representation without changing
  logical identity.
- The loading indicator must report real bounded preparation progress from
  left to right as an actual percentage. An indeterminate decorative animation
  is not sufficient.
- CPU workers and available GPU presentation capacity should be used
  purposefully. GPU compute must not become the authority for connectivity,
  hashes or deterministic Physics.
- No scratch or profile output may use `C:\tmp`; use
  `C:\IFI_SourceCode\Temp\WeltraumSpiel-AgentScratch`.
- After the current worker/unbounded-physics slice is coherent, the next major
  visible slice is the versioned Coast/Lush Hestia biome based on the concept
  references. The existing test surface must remain available until the new
  route is independently playable.

The currently open browser page still runs the synchronous Tree preflight and
the fixed-body `SurfaceRigidBodyWorld`. Worker protocol/codec/scheduler
foundation files alone do not make multithreading live. Until Runtime/Combat
adopts the worker result and the body registry/island scheduler replaces the
fixed-cap world, any `ASYNC UNAVAILABLE`, `BodyCapacityExceeded`,
`MotionBudgetExceeded`, or equivalent screenshot remains failed evidence.
