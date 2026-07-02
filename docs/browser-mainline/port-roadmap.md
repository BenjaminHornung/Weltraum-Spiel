# Browser Mainline Port Roadmap

This roadmap orders browser-mainline work by evidence and contract risk. It intentionally starts with deterministic seams and feature intent, not broad game rewrites.

## M0: Decision And Documentation Baseline

Status: historical M0 baseline, now completed by the current v1 transition with browser app source, copied source evidence, tests and reports.

- Accept browser/Three.js as the new product mainline.
- Keep Unity as legacy/reference/evidence.
- Create ADR, architecture, feature-intent index, bug traps, roadmap and testing/evidence docs.
- Historical M0 constraint only: app/source/tests/spec copy targets were not modified during the baseline. The current v1 transition intentionally adds the browser app, tests, copied source evidence and reports.

## M1: Feature Intent Mining Gate

- Keep feature-intent cards current before implementation.
- Mine Unity and archived specs for behavior, terms, edge cases and evidence structures.
- Resolve contradictions into browser acceptance rules.
- Maintain known bug traps as blockers for new slices.

Gate: every feature slice has a feature-intent card, source paths, non-goals and test/evidence hints.

## M2: Browser Proving-Ground Matrix

Source paths:

- `docs/architecture/autopilot-v2-test-harness.md`
- `analysis/threejs-mainline/source-evidence/threejs-spike-test-summary.md`
- `analysis/threejs-mainline/source-evidence/threejs-spike-decision-report.md`

Required first matrix:

1. direct local arrival,
2. obstacle avoidance route,
3. insufficient fuel,
4. no authority,
5. no main thrusters,
6. brake reserve insufficient,
7. off-route divergence,
8. locked plan hash preservation,
9. explicit replan-required signal.

Gate: each scenario emits JSON, Markdown summary and screenshot/visual evidence where rendering is relevant.

Proving-ground v2 follow-up: the browser app now adds an additive course catalog with 11 local courses and controlled `Safe`/`Balanced`/`Fast` speed profiles. The v2 harness records profile, ticks-to-arrival, peak speed, terminal speed, obstacle clearance, fuel used, arrival phase, plan hashes, replan signal and classification. `KnownStress` courses are kept as honest current-planner limit evidence for multi-obstacle/corridor pressure, while `ExpectedFail` courses cover low-fuel and off-route disturbance contracts.

Long-range testfield v1 follow-up: the browser catalog is expanded to 35 courses with 500m/1000m/2500m direct tiers, long single-obstacle routes, multi-obstacle/corridor `KnownStress` rows, explicit fuel/authority/brake/off-route `ExpectedFail` rows, and evidence-only `Safe`/`Balanced`/`Fast` comparison rows. Browser evidence is produced by `apps/weltraum-browser/tests/e2e/autopilot-proving-ground-v2.spec.ts` into `apps/weltraum-browser/evidence/browser-autopilot-long-range-testfield-v1.md`, `autopilot-long-range-summary.json`, `autopilot-long-range-speed-profile-summary.json`, and representative screenshots for direct 1000m, direct 2500m, obstacle, and KnownStress courses. This remains a local-space planner testfield: it documents the current one-blocking-obstacle planner limit and preserves no-snap, no velocity-zero shortcut, no silent replan, stable `planHash`, TestBridge query gating, and GLBLoaded evidence gates.

## M3: Flight Authority / Fuel / Braking

Status: v1 implemented in the browser mainline app. `ShipMass`, `FuelState`, `AuthorityState`, `BrakingReserve` and `FlightSnapshot` are explicit TypeScript contracts consumed by executor, telemetry, HUD, TestBridge and scenario evidence. Cargo mass remains a stubbed field only.

Source paths:

- `Assets/Scripts/Prototype/PlayerShipController.cs`
- `Assets/Scripts/Prototype/MainThrusterBank.cs`
- `Assets/Scripts/Prototype/RcsThrusterController.cs`
- `docs/design-audits/2026-06-14-planning-consistency-audit.md`
- `analysis/threejs-mainline/source-evidence/unity-to-threejs-port-map.json`

Intent:

- Replace spike scalar stubs only when contracts/tests justify richer modeling.
- Model mass, fuel, thrust, RCS/SAS and brake reserve explicitly.
- Feed navigation estimates and HUD warnings from the same authority snapshot.

Gate: insufficient fuel, no authority and brake-reserve cases fail closed with visible reasons.

Open M3 follow-up points:

- richer thrust/engine curves beyond the current deterministic first approximation,
- real cargo/resource data contract instead of the stubbed `cargoMass`,
- route-validator scoring and player route-mode choices (belongs to M4, not this v1),
- frame descriptors for future non-local-space flight boundaries.

## M4: Navigation / Autopilot V2

Status: v1 contract slice implemented in the browser mainline app. `TargetDescriptor` now distinguishes executable `Waypoint` and `Point` targets, stores `ArrivalEnvelope`, and reserves future kind names only as deferred type vocabulary. Planners expose structured `RoutePlanningResult` rejection, `RouteValidationResult`, deterministic `RouteCandidate`/`RouteScore` metadata, and still produce immutable `RoutePlan` objects with stable `planHash`. The executor remains locked to one plan and reports invalidation instead of replanning.

Source paths:

- `docs/architecture/autopilot-v2-design.md`
- `docs/architecture/autopilot-v2-test-harness.md`
- `Assets/_Weltraum/Runtime/Navigation/AutopilotContracts.cs`

Intent:

- Expand planner candidate scoring.
- Add validator gates for clearance, fuel reserve, brake reserve, authority and unsafe targets.
- Preserve immutable `RoutePlan` and no executor-side replan.
- Add route modes: fastest, fuel saver, balanced and safe debug.

Implemented in this v1 slice:

- target kind/envelope contracts for waypoint and point execution targets,
- invalid/unsupported/unsafe/impossible target rejection reasons,
- null-safe target validation and finite obstacle radius/padding rejection,
- planner terminal-segment alignment with the visible target position,
- deterministic candidate scoring skeleton and validation metadata in scenario evidence,
- locked-target arrival-envelope capture so the browser ship reaches the visible green target marker instead of overshooting into divergence, without snapping tangential swings outside the envelope,
- default browser proving-ground navigation targets (`nav-alpha`, `nav-beta`) now use stop/capture envelopes (`StopWithinEnvelope`, terminal speed 0.5 m/s), with executor terminal phases `TerminalBrake`, `Capture`, and `Holding` exposed in telemetry,
- terminal capture and holding are applied through the shared FlightController/actuator path using desired acceleration; completed routes now move the finished route hash to `completedPlanHash`, clear the active route lock, and continue station-keeping separately so a new target/route can be selected without pressing Cancel,
- active `Executing`/`TerminalCapture` routes remain fail-closed for target selection and Engage; only completed/holding station-keeping sets `canAcceptNewPlan` and `canSelectNewTarget`,
- no-silent-replan/locked-plan-hash tests remain green.

Deferred M4 follow-up points:

- player-facing route-mode UI (the browser proving-ground has internal `Safe`/`Balanced`/`Fast` profiles for evidence, but no player UI selector yet),
- richer multi-candidate selection beyond the current deterministic skeleton,
- planner support for globally solving multi-obstacle/corridor long-range routes beyond the current documented one-blocking-obstacle `KnownStress` limit,
- landing/docking/cargo/orbit runtime behavior,
- full frame-aware target descriptors for non-local-space routes.

Gate: plan determinism and no-silent-replan tests remain green while richer planning is added.

## M5: HUD / Input / Telemetry Foundation

Status: v1 browser foundation implemented. The Basic HUD now consumes a `StatusHudViewModel` derived from telemetry/owner snapshots, exposes explicit runtime commands for autopilot engage/cancel actions, renders target/distance/route/replan/fuel/authority/warning state, and keeps TestBridge query-gated for E2E only.

Flight UI foundation v1 follow-up: the browser HUD is now screenshot-informed by `docs/browser-mainline/ui-screenshot-audit.md` and the 38 tracked `docs/UI-Screenshots/*.png` references. The player HUD uses edge-only regions (`#hud-top-strip`, `#hud-left-panel`, `#hud-right-panel`, `#hud-bottom-strip`) inside `#flight-hud`, preserves `data-testid="basic-hud"`, and declares `.hud-center-safe-area` so ship/target/route visuals remain unobstructed. Player status, navigation, warning, route action, and concise ship-visual source are grouped as ViewModels; diagnostic/help/control-effect details stay separate in hidden `#debug-hud`, and TestBridge remains evidence-only behind `?testBridge=1`.

Source paths:

- `docs/ux/player-facing-status-authority-v1.md`
- `docs/ux/player-hud-map-builder-surface-flow.md`
- `docs/ux/unified-ui-input-mode-architecture.md`
- `docs/ux/debug-vs-player-ui-policy.md`

Intent:

- Implement explicit input modes.
- Render route/fuel/authority warning chips from owner snapshots.
- Keep TestBridge/debug panels separate from player UI.
- Add route timeline and target context only as ViewModels/snapshots.

Gate: browser evidence covers Basic HUD, selected target, autopilot active, warning state and debug hidden.

Deferred M5 UI follow-up points:

- full system map/navigation planner screen,
- combat/weapon HUD beyond shared warning chrome,
- station/outpost/economy/cargo/surface/builder screens,
- richer autopilot lifecycle fields beyond current executor status/planHash-derived Ready/Hold/Cancel labels.

## M6: Low-Poly Open-World Runtime Foundation

Status: v1 foundation implemented in the browser mainline app. Explicit frame descriptors now separate absolute world coordinates from local render/physics projections. Floating-origin helpers reproject data without changing absolute position or velocity. Simulation bubble membership is deterministic over absolute coordinates. The debug Three.js scene consumes render-only asteroid instance descriptors via `InstancedMesh`; meshes do not own simulation truth.

Source paths:

- `docs/architecture/coordinate-spaces-and-floating-origin.md`
- `docs/architecture/real-scale-world-architecture.md`
- `docs/architecture/surface-local-frame-architecture.md`
- historical external package input "docs/open-world-low-poly-browser-plan.md" (not a live repo path in this worktree)

Intent:

- Add explicit frame descriptors and conversion tests.
- Add floating-origin projection shift invariants.
- Add simulation bubble membership.
- Add chunk/LOD/instancing smoke tests for low-poly fields.

Implemented in this v1 slice:

- `FrameDescriptor`, `WorldCoordinate`, `LocalCoordinate` and `FramedVelocity` contracts under `apps/weltraum-browser/src/world`.
- absolute-to-local, local-to-absolute and velocity frame conversion helpers with identity orientation only.
- floating-origin projection shift evidence that preserves absolute state, absolute velocity and relative local distance.
- deterministic `Full` / `Snapshot` / `Dormant` simulation-bubble membership, including boundary behavior.
- render-only low-poly asteroid instance batches with an explicit max-instance budget and TestBridge render snapshot evidence.

Deferred M6 follow-up points:

- chunk registry and LOD streaming beyond the current fixed asteroid-field smoke,
- non-identity frame orientation, planet-centered/surface conversion math and orbital mechanics,
- terrain generation, surface runtime, save/load and full world streaming.

Gate: absolute state and velocity remain unchanged by local projection shifts.

## M7: Browser Vertical Slice

Status: v1 browser vertical slice implemented. Runtime owns the selected proving-ground target, route preview, explicit engage/cancel/select commands, and fail-closed command messages. The player HUD renders selected target, preview/locked route state, autopilot status, warnings and compact radar-style route contact from telemetry/ViewModels only. Three.js renders selected target and route descriptors from runtime snapshots, while TestBridge remains gated behind `?testBridge=1`.

Intent:

- Ship starts in local space.
- Player selects a target.
- Route preview appears.
- Autopilot executes or explains failure.
- HUD/radar show current status from snapshots.
- Playwright records telemetry and screenshot evidence.

Gate: proving-ground matrix plus player-facing HUD evidence pass in browser gates.

Implemented in this v1 slice:

- selectable existing proving-ground targets (`arrival-near`, `nav-alpha`, `nav-beta`) without invalid-target fallback,
- route preview snapshot state that is separate from the executor's locked plan until explicit engage,
- engage fail-closed behavior that does not silently replace an already locked plan,
- compact HUD/radar readout and player-facing status/warning labels without raw TestBridge/debug JSON or internal failure-code leakage,
- gated Playwright evidence for default TestBridge absence, target selection, route preview, autopilot arrival, off-route failure explanation and negative fuel/authority cases.
- lifecycle smoothing follow-up evidence confirms a completed/holding route accepts a new target and new route while active routes still block replacement; `completedPlanHash` keeps the finished hash visible after `planHash` returns to active-route-only semantics.

Deferred M7 follow-up points:

- full radar/minimap/map UI,
- richer player route-mode selection beyond the current obstacle-avoidance engage action,
- terrain/orbit/surface/cargo/economy/ship-builder runtime features.

## browser-playable-ship-flight-v1: Playable Ship Flight v1

Status: implemented as the first browser-playable flight slice after M7. This is a playable browser runtime milestone, not a full Unity parity claim.

Intent:

- Replace the cone-only ship marker with a browser ship visual that has render/test descriptors.
- Add Flight State V2 and route manual controls and autopilot through the shared `applyFlightControllerStep` actuator layer.
- Make `ChaseLocked` the default moving-ship camera, with `OrbitInspect`, `Side`, and `FreeInspect` as switchable inspection modes.
- Drive main thruster and RCS/SAS VFX from actuator telemetry, not raw input state.
- Remove normal-runtime autopilot snap/zero shortcuts while keeping arrival tied to the locked envelope, terminal-speed requirements, stable `planHash`, and no replan replacement.

Implemented in this v1 slice:

- procedural low-poly ship fallback with hull/body, cockpit/front, main engine, RCS marker, muzzle-placeholder and camera-anchor descriptors,
- manual controls for pitch/yaw/roll, throttle ramp/cut/full, RCS/SAS toggles, control-mode cycling, translation vertical, camera cycling, RMB orbit/look and wheel zoom,
- HUD readouts for control mode, camera mode, throttle, velocity/speed, RCS/SAS actuator state and keybind help alongside the existing autopilot/target/warning state,
- VFX from `mainThrustActive`, `rcsTranslationActive`, `rcsRotationActive` and `sasCorrectionActive`,
- no normal-runtime target/waypoint position snap, waypoint velocity zero, terminal velocity clamp/zero shortcut, or idle/cancel velocity zero,
- screenshot evidence for manual ChaseLocked flight, RCS translation, autopilot thruster burn and autopilot arrival.
- fixed-step presentation interpolation now exposes cloned previous/current/rendered ship snapshots; Three.js uses the interpolated pose only for ship visual and camera, while HUD, route, target, VFX and TestBridge truth continue to read owner telemetry. Chase camera damping uses `1 - exp(-lambda * dt)` with tighter ChaseLocked damping than inspection modes.

Asset decision:

- `Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb` was verified read-only as a valid GLB asset with size `127108` and a `glTF` binary header.
- The GLB was not copied or used in this bounded slice because async loader/bundling risk was deferred. No `Assets/**` mutation was made.

Polish v1 follow-up:

- The procedural ship snapshot now exposes explicit visual-source states while preserving the procedural fallback as runtime source of truth: `Loading`, `GLBLoaded`, `GLBFailedFallback`, and `ProceduralFallback`.
- Marker/socket descriptor validation now fails if hull/body identity, cockpit/front, main engine, four-or-more RCS markers, muzzle placeholder or camera anchor coverage disappears.
- The default HUD shows scalar speed only, while full velocity vectors remain in telemetry/TestBridge evidence.
- Manual flight in this browser slice is desktop keyboard/mouse only; mobile remains target selection/autopilot-only until a separate touch/manual-flight feature is specified.
- Main-thruster VFX scales from acceleration magnitude, so off-axis acceleration still has visible burn scale.

Demo Scout GLB visual parity v1 follow-up:

- `Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb` is copied read-only into the browser public asset path as `apps/weltraum-browser/public/ships/demo_scout_mk1.glb` when this slice is present; source and browser copy both report size `127108`, GLB magic `glTF`, version `2`, declared length `127108`.
- The browser render adapter now attempts `/ships/demo_scout_mk1.glb`, reports deterministic visual states (`Loading`, `GLBLoaded`, `GLBFailedFallback`, `ProceduralFallback`), keeps procedural geometry visible while loading or failed, and keeps all axis/scale correction render-only.
- Demo Scout GLB marker resolution prefers named GLB nodes for cockpit/front, main engine, RCS hardpoints, and muzzle, then uses manifest fallback positions; the ChaseLocked camera anchor remains a manifest visual anchor when the GLB has no authored camera node.
- HUD and TestBridge expose the same concise visual-source result (`Ship visual: Demo Scout GLB` or `Ship visual: Procedural fallback`) while detailed paths, axis correction, marker binding sources, and fallback reason remain in render snapshots/evidence.

Browser flight feel control modes v1 follow-up:

- Cruise, Precision and Translation now have an explicit browser-native `ControlModeEffectSnapshot` in actuator telemetry, so HUD/tests read owner mode authority instead of recomputing rules.
- Cruise is the only mode that converts throttle commands into active main thrust. Precision/Translation ignore and clear throttle commands outside Cruise; Precision mode-blocks main thrust and applies a finer RCS attitude response. Translation mode-blocks main thrust, maps W/S/A/D/H/N to RCS translation, and keeps Q/E as separately observable RCS roll authority.
- The player HUD adds a compact control-effect line (`main thrust enabled`, `RCS attitude / main thrust blocked`, `RCS translation / main thrust blocked`) plus readable active/blocked labels for main thrust, RCS translation, RCS rotation and SAS.
- Evidence screenshots cover Cruise main burn, Precision RCS rotation with main VFX off, and Translation RCS puffs while preserving Demo Scout GLB marker/VFX parity and TestBridge gating.

Deferred playable-flight follow-up points:

- richer production ship asset pipeline beyond this Demo Scout GLB adapter,
- richer Unity-style flight physics, per-nozzle RCS allocation, gimbal/SAS behavior and engine/particle effects,
- broader camera polish and input rebinding/accessibility beyond the current key/mouse contract,
- full radar/minimap/map integration and non-local-space/orbital/surface flight behavior.

## Deferred Until Separate Feature Intent / Specs

- Ship Builder runtime and broad catalog.
- Surface-FPS runtime.
- Economy, missions, factions, drones.
- Real production asset migration.
- Full planet generation, terrain streaming, orbital mechanics and gravity-assist gameplay.

## Ordering Warnings

- Do not build surface landing/pickup before target taxonomy and exact target handoff are specified.
- Do not build cargo/mining loops before cargo mass/authority integration exists.
- Do not build ship-builder economy before resource/cargo and part metadata contracts are frozen.
- Do not claim world scale before frame/floating-origin invariants are covered by tests.
