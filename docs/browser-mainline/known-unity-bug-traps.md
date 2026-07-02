# Known Unity Bug Traps For Browser Mainline

These are traps to preserve as design warnings. They are not instructions to port Unity implementation structure.

Sources:

- `docs/current-prototype-state.md`
- `docs/design-audits/2026-06-14-planning-consistency-audit.md`
- `docs/architecture/prototype-legacy-boundary-audit-2026-06-15.md`
- `docs/architecture/autopilot-v2-design.md`
- `docs/architecture/autopilot-v2-test-harness.md`
- `docs/architecture/coordinate-spaces-and-floating-origin.md`
- `docs/architecture/real-scale-world-architecture.md`
- `docs/architecture/surface-local-frame-architecture.md`
- `docs/ux/player-facing-status-authority-v1.md`
- `docs/ux/debug-vs-player-ui-policy.md`
- `analysis/threejs-mainline/source-evidence/current-core-inventory.md`
- `analysis/threejs-mainline/source-evidence/unity-to-threejs-port-map.json`
- `analysis/threejs-mainline/source-evidence/threejs-spike-decision-report.md`
- `analysis/threejs-mainline/source-evidence/threejs-spike-test-summary.md`

## Trap Matrix

| Trap | Why it is dangerous | Browser rule | Evidence hint |
| --- | --- | --- | --- |
| Silent replan | It hides route divergence and can make an executor look correct while replacing the player's plan. | Executor consumes one locked `RoutePlan`; invalidation produces visible status/reason and `replanRequired`, never automatic replacement. | Force off-route divergence and assert `planHash` stays stable while `replanRequired === true`. |
| Authority/fuel split-brain | HUD, planner and ship controller can disagree about mass, fuel, brake reserve or RCS authority. | Flight/navigation own authority and fuel snapshots. UI reads them; it does not recompute. | Scenario JSON includes mass/fuel/authority/brake inputs and displayed warning owner. |
| Browser authority/fuel split-brain | A browser HUD or TestBridge can accidentally recompute fuel, authority, ETA, route validity or brake reserve from raw ship fields and drift from executor truth. | `FlightSnapshot` is the central owner contract; HUD/TestBridge/evidence consume that snapshot and display `failureReasonCodes` verbatim. | Unit tests deliberately mismatch raw ship values and owner snapshot values and assert HUD renders the snapshot values. |
| Brake-reserve optimistic route | A route can look executable because fuel is nonzero while available delta-v cannot stop the ship at the target. | Navigation/executor gates movement on `BrakingReserve.canBrake`; `BrakeReserveInsufficient`, missing main thrusters, missing autopilot and insufficient fuel fail closed before movement. | Scenario matrix includes `brake-reserve-insufficient` and `no-main-thrusters` with stable `planHash` and visible failure reasons. |
| Route divergence hidden by fallback | Legacy fallback or safety paths can make an unsafe/invalid route look successful. | Supervisor may abort or flag invalidation; fallback routes require explicit player-visible replan. | Test unexpected obstacle/off-route state and assert no plan replacement. |
| Target taxonomy ambiguity | `waypoint`, `target point`, `landing zone`, `site` and `pickup point` can be treated as the same thing. | Broad markers/zones resolve to exact `TargetDescriptor` + `ArrivalEnvelope` before execution. | Telemetry records target kind, frame, point and envelope. |
| Hidden target fallback | Missing or malformed target data can silently become origin/root/default and make plan hashes look deterministic for the wrong route. | Planner validates descriptor id, kind, finite position and arrival envelope; invalid descriptors return structured rejection reasons, not a fallback plan. | Unit tests pass missing, null and malformed targets and assert structured `InvalidTarget`/`ImpossibleArrivalEnvelope` rejection. |
| Planner/executor split-brain | Planner may create a replacement or reinterpret target legality after the executor has already locked a route. | Planner validation/scoring happen before lock; executor owns only the locked `RoutePlan` and emits invalidation telemetry without calling planners. | Force divergence and assert `planHash` remains stable while route validation/scoring metadata stays attached to the original plan. |
| Terminal target overshoot | Fixed-step autopilot can step across the visible target marker and then flag divergence instead of arrival, or accept arrival while still too fast. | Terminal arrival uses the locked target `ArrivalEnvelope`; default navigation targets are stop/capture goals (`StopWithinEnvelope`, terminal speed 0.5 m/s). `Arrived` is only accepted inside the radius at or below the terminal speed limit; overspeed states remain TerminalBrake/Capture and continue through the FlightController. | Unit tests cover 8 m/s stop-target rejection, inside-envelope capture, true terminal crossing, `NoStopRequired` velocity, and outside-radius tangential swing; E2E records TerminalBrake/Capture/Holding telemetry and screenshots. |
| Speed profile weakens terminal capture | A fast/debug profile can accidentally raise acceleration, reduce terminal braking, or allow arrival above the stop envelope. | Browser proving-ground profiles may only change desired route speeds and non-terminal brake-margin metadata; executor `maxAcceleration`, `StopWithinEnvelope`, `terminalSpeed`, no-snap, no-zero and no-silent-replan gates remain invariant. | Compare `Safe` and `Balanced` on `direct-long`: Balanced must arrive in fewer ticks while final speed stays `<= terminalSpeed` and `planHash` remains locked. |
| Multi-obstacle stress hidden as success | A simple local planner can appear production-ready if multi-obstacle corridors are reported as generic passes. | Courses that exceed the current one-blocking-obstacle planner are classified as `KnownStress`, not hidden pass/fail noise. | v2 matrix includes `s-curve-obstacles` and `narrow-corridor` with notes documenting the current planner limit. |
| Normal-runtime snap or idle-zero shortcut | Setting `position = target.position`, `position = segment.end`, waypoint `velocity = vec3()`, terminal velocity clamp/zero, or idle/cancel velocity zero can make tests pass while hiding impossible flight. | Normal runtime progresses by actual envelope entry/crossing and terminal-speed gates without mutating position or velocity. Arrived/Holding with a locked plan still calls `applyFlightControllerStep()` for station-keeping; idle/cancel preserve drift unless a future explicit brake/kill-momentum command is specified. | No-snap/no-zero unit tests cover waypoint progression, terminal arrival, holding integration, cancel and idle drift; browser evidence shows autopilot terminal brake/capture/hold through actuation. |
| Loose surface arrival | Surface landing/pickup can regress to "inside broad zone" after exact arrival is fixed. | `LandingZone` is area metadata; `LandingTargetPoint`/`PickupTargetPoint` are execution targets. | Landing/pickup tests fail unless final target point and relative speed/hold gates pass. |
| Floating-origin mutates truth | Moving local render/physics projections can accidentally alter absolute position, velocity, route math or camera state. | Floating origin is a projection correction only; absolute state and absolute velocity do not change. | Before/after shift evidence records absolute state unchanged, relative motion unchanged, local projection corrected. |
| Velocity frame loss | Position conversion without velocity frame creates docking, landing and route bugs. | Positions and velocities carry frame descriptors/reference bodies. | Conversion tests cover absolute, planet-relative, surface-relative and local physics velocities. |
| Camera/local transform as domain truth | Camera or local scene position is easy to read from Three.js/Unity and accidentally save as gameplay truth. | Renderer/camera consume snapshots only; save/map/nav use core frame state. | Evidence contains core state and render projection separately. |
| Camera mode treated as gameplay truth | Chase/side/orbit/free camera rigs can accidentally become the source of ship position, facing, route state or arrival truth. | `ChaseLocked`, `OrbitInspect`, `Side` and `FreeInspect` are render/player-view modes only; core ship state, target state and autopilot state remain owner snapshot data. | Camera-cycle tests assert render camera mode changes while ship/navigation telemetry remains authoritative. |
| Instanced mesh as world truth | Repeated low-poly fields can tempt runtime code to read or mutate `InstancedMesh` matrices as gameplay state. | Instanced meshes consume render-only descriptors derived from world data; source entity state remains outside Three.js. | Render snapshot records batch id, frame id, count, max instances and `rendererOwnsWorldTruth === false`. |
| UI status recomputation | UI can display a different ETA/fuel/risk/arrival state than the owner. | Status has one authority owner; views translate codes into player text and next action only. | HUD tests compare displayed chips/status against telemetry owner fields. |
| Flight HUD blocks the viewport | Prototype/debug panels can grow into the center of the screen and hide the ship, target marker, route, docking approach, or warnings. | Browser player HUD must stay in top/edge/bottom regions and keep `.hud-center-safe-area` clear; large map/builder/combat/cargo/surface screens require separate specs. | E2E measures `#hud-top-strip`, `#hud-left-panel`, `#hud-right-panel`, and `#hud-bottom-strip` bounding boxes against a center rectangle and records responsive screenshots. |
| Control-mode label alias | Cruise, Precision and Translation can become labels over the same input/thrust behavior, hiding blocked main thrust or RCS authority loss from the player. | `applyFlightControllerStep` owns a `ControlModeEffectSnapshot`: only Cruise may store/activate main throttle, Precision uses finer RCS attitude, Translation uses RCS linear movement plus Q/E roll, SAS damping requires RCS rotation authority, and HUD consumes the owner effect instead of recalculating rules. | Unit tests compare Cruise vs Precision response, assert Precision/Translation throttle blocking, Translation roll-only rotation, SAS no-rotation-authority blocking, and RCS-disabled blocked reasons; E2E screenshots cover Cruise main burn, Precision no-main VFX with RCS rotation and Translation RCS puffs. |
| VFX from input state | Thruster flames or RCS puffs driven directly by keydown make manual input look correct while autopilot, SAS or control saturation state is wrong. | VFX consume actuator telemetry only: main flame from `mainThrustActive` with acceleration-magnitude scale, RCS puffs from `rcsTranslationActive`, `rcsRotationActive` and `sasCorrectionActive`. | E2E/unit snapshots assert VFX state during manual translation, off-axis acceleration and autopilot burn from render snapshots/telemetry, not raw input state. |
| Debug UI becomes player contract | Prototype F2-F6/IMGUI controls can become the only way to do player tasks. | Player actions must be available in player modes; debug/test controls are labeled and separable. | Screenshot matrix includes Basic/player view with debug hidden. |
| Scene/runtime assumptions leak | Bootstrap-created roots, one active camera, dynamic binder defaults and scene hierarchy can become hidden architecture. | Browser app uses explicit composition and manifests; domain does not depend on scene hierarchy. | Startup test asserts explicit runtime services and no scene-object-owned gameplay truth. |
| Missing sockets/targets default to root/zero | Fallbacks make visuals appear to work while gameplay binds to wrong points. Procedural browser ship descriptors can also hide future GLB marker/socket mismatches. | Missing/ambiguous markers or targets fail closed with visible diagnostics. Browser ship visual descriptor validation covers hull/body, cockpit/front, main engine, at least four RCS markers, muzzle placeholder and camera anchor. Demo Scout GLB visual parity now reports whether each cockpit/engine/RCS/muzzle binding came from a GLB node or manifest fallback, and keeps procedural fallback explicit instead of treating fallback as GLB success. | Unit/render snapshot tests fail if required descriptors disappear; E2E waits for `visualSource.state !== "Loading"`, expects `GLBLoaded` for the copied Demo Scout asset, checks GLB node marker bindings for VFX, and records fallback reason if loading fails. |
| Evidence drift | README/current-state/tests can disagree about exact arrival and acceptance gates. | Browser feature docs cite current evidence and each scenario emits machine-readable JSON plus summary. | Evidence index stores command, status, scenario ID and artifact paths. |
| WebGL screenshot false negative | Canvas readback may look blank even when rendered. | Browser evidence should sample Playwright-rendered screenshots and record nonblank checks. | Screenshot metadata records dimensions, bytes, sampled pixels and unique/non-dark colors. |

## Mandatory Autopilot Trap Rules

1. No executor-side replanning.
2. No plan hash replacement during execution.
3. Divergence must be explicit telemetry.
4. Fuel/authority/brake failures must be player-visible reason codes.
5. No future autopilot tuning is complete without proving-ground evidence.
6. Speed profiles must not weaken terminal capture or introduce executor-side replans.

## Mandatory Frame Trap Rules

1. Never pass naked position vectors across system boundaries without a frame descriptor.
2. Never use renderer object position as durable world truth.
3. Floating-origin shifts must preserve absolute position, absolute velocity and relative local motion.
4. Ship-local axes and surface-local axes are different frames even if both use `+Y` as local up.
5. Route previews, target markers, camera rigs and HUD projections shift together with local projection.
6. Instanced render batches are projection consumers, not sources of gameplay or save/load truth.

## Mandatory UI Trap Rules

1. UI is not an authority owner for route validity, ETA, fuel, risk, legality or containment.
2. Basic/player UI must not expose raw IDs or internal solver state as required player language.
3. Debug/TestBridge controls must not be required for normal play.
4. Blocked actions need one visible player-facing reason.
5. Flight HUD panels must remain edge-aligned and respect the center-safe-area contract unless a separate full-screen map/planner mode is specified.
