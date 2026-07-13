# Browser Mainline Feature Intent Index

This index converts Unity/reference behavior into browser-native feature intent. It is not an implementation checklist for copying Unity classes.

Card fields:

- **Source paths**: files/docs/specs used as intent evidence.
- **Browser-native intent**: target behavior for the TypeScript / Three.js mainline.
- **Non-goals**: what this transition must not implement or port.
- **Tests / evidence hints**: first useful acceptance evidence.
- **Known Unity bug traps**: traps to preserve as warnings, not architecture.

## 1. Flight / Control

| Field | Content |
| --- | --- |
| Source paths | `unity-legacy-final-2026-07:Assets/Scripts/Prototype/PlayerShipController.cs`; `unity-legacy-final-2026-07:Assets/Scripts/Prototype/MainThrusterBank.cs`; `unity-legacy-final-2026-07:Assets/Scripts/Prototype/RcsThrusterController.cs`; `docs/legacy-unity/current-prototype-state-2026-06-15.md`; `docs/legacy-unity/architecture/prototype-legacy-boundary-audit-2026-06-15.md`; `docs/legacy-unity/source-evidence/current-core-inventory.md`; `docs/legacy-unity/source-evidence/unity-to-threejs-port-map.json` |
| Browser-native intent | Deterministic ship state now carries explicit `ShipMass`, `FuelState`, `AuthorityState`, `BrakingReserve` and owner `FlightSnapshot` contracts under `apps/weltraum-browser`. Playable flight v1 adds Flight State V2 with orientation, angular velocity, throttle, control mode, RCS/SAS state, command vectors and actuator telemetry. Flight-feel control modes v1 adds `ControlModeEffectSnapshot` telemetry so Cruise, Precision and Translation are explicit behavior contracts: Cruise allows main thrust, Precision is fine RCS attitude with main thrust blocked, and Translation is RCS linear movement with Q/E roll retained. Desktop keyboard/mouse manual controls and autopilot share `applyFlightControllerStep`, while `ChaseLocked` follows the moving ship with dt-corrected exponential camera damping and VFX/HUD read actuator telemetry. Fixed-step simulation exposes presentation-only interpolation snapshots for render/camera smoothing without making renderer state gameplay truth. Demo Scout GLB visual parity v1 adds a browser render adapter that loads `/ships/demo_scout_mk1.glb` when available, reports deterministic visual-source states, and preserves procedural fallback without making renderer state gameplay truth. Mobile is target selection/autopilot-only in this slice. Cargo mass remains a stubbed numeric flight field; the separate [resource/cargo core](./resource-cargo-inventory-core-v1.md) has no flight integration. |
| Non-goals | No Unity Rigidbody parity claim, no MonoBehaviour input lifecycle, no per-nozzle RCS allocator copy, no throttle spool/inertia in this control-mode task, no full HoldAttitude/gimbal/SAS solver port, no cargo/resource/economy runtime behavior in flight, and no general production GLB asset pipeline parity beyond the bounded Demo Scout browser adapter. |
| Tests / evidence hints | Unit tests cover deterministic fuel burn, mass-sensitive acceleration/braking reserve, no fuel, no autopilot authority, no main thrusters, brake-reserve insufficiency, HUD owner-snapshot consumption, visual-source HUD line, plan-hash preservation, manual control mode/throttle/RCS/SAS behavior, Cruise main thrust, Precision/Translation main-thrust blocking, finer Precision rotation, Translation translation-vs-roll separation, RCS-disabled authority blocking, shared actuator telemetry, acceleration-magnitude VFX scale, marker/socket descriptor validation and no idle/cancel drift zero. Screenshot evidence covers Demo Scout GLB loaded, Cruise main burn, Precision RCS rotation with main VFX off, Translation RCS puffs, ChaseLocked/manual flight, autopilot thruster burn and autopilot arrival. |
| Known Unity bug traps | Authority/fuel/brake split-brain between controller, HUD and planner; residual RCS/translation drift; treating Unity physics output as deterministic truth; hidden root defaults when functional ship sockets are missing. |

## 2. Navigation / Autopilot

| Field | Content |
| --- | --- |
| Source paths | `unity-legacy-final-2026-07:Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`; `unity-legacy-final-2026-07:Assets/Scripts/Prototype/PrototypeFlightPlan.cs`; `unity-legacy-final-2026-07:Assets/Scripts/Prototype/PrototypeTrajectoryPlanner.cs`; `unity-legacy-final-2026-07:Assets/_Weltraum/Runtime/Navigation/AutopilotContracts.cs`; `docs/architecture/autopilot-v2-design.md`; `docs/legacy-unity/architecture/autopilot-v2-test-harness.md`; `docs/legacy-unity/source-evidence/threejs-spike-decision-report.md`; `docs/legacy-unity/source-evidence/threejs-spike-test-summary.md` |
| Browser-native intent | Split target resolution, planner, validator, immutable `RoutePlan`, executor, supervisor and telemetry. The browser v1 slice now has explicit `TargetDescriptor.kind`, `ArrivalEnvelope`, `RouteValidationResult`, deterministic `RouteScore`/`RouteCandidate` metadata, `RoutePlanningResult` structured rejection contracts, and runtime-owned selected-target/route-preview state for existing proving-ground targets. Planner produces deterministic `planHash`; executor executes exactly that locked plan through the shared actuator layer; invalidation surfaces as visible status/reason/replan-required telemetry. Completed terminal capture stores the finished route as `completedPlanHash`, clears the active lock for new target selection/engage, and keeps station-keeping separate from `lockedPlan`; active Executing/TerminalCapture routes still block replacement. Playable flight v1 removes normal-runtime target/waypoint snap and waypoint/idle velocity-zero shortcuts. Proving-ground v2 adds internal `Safe`/`Balanced`/`Fast` speed profiles for evidence-only local-course measurements; profiles change desired route speeds/non-terminal brake margins, never terminal capture gates. |
| Non-goals | No executor-side silent replan, no legacy fallback policy, no automatic plan replacement, no gravity/orbit/slingshot blending into local-space arrival, and no runtime route modes/landing/docking/cargo/orbit behavior in this v1 slice. |
| Tests / evidence hints | Direct local arrival through actual envelope entry, obstacle avoidance, off-route divergence, locked hash preservation, explicit `replanRequired`, target-selection fail-closed behavior before completion and allowed selection after completed Holding, plan serialization/hash determinism, waypoint/point target taxonomy, arrival-envelope evidence, no normal-runtime snap/zero regression tests, autopilot actuator-request tests, structured planner rejection, invalid obstacle rejection, deterministic candidate scoring tests, profile determinism, Balanced-vs-Safe speed comparison and terminal-speed preservation. |
| Known Unity bug traps | Silent or safety replans hiding divergence; terminal capture flapping back to accelerate/reacquire; route plan labels diverging from executor truth; target fallback to root/zero; docs/test drift around exact point arrival status. |

## 3. Route / Waypoint / Targeting

| Field | Content |
| --- | --- |
| Source paths | `unity-legacy-final-2026-07:Assets/Scripts/Prototype/PrototypeWaypointManager.cs`; `unity-legacy-final-2026-07:Assets/Scripts/Prototype/PrototypeNavigationTarget.cs`; `unity-legacy-final-2026-07:Assets/Scripts/Prototype/PrototypeWeaponTargetRegistry.cs`; `unity-legacy-final-2026-07:Assets/Scripts/Prototype/PrototypeWeaponTarget.cs`; `docs/design-audits/2026-06-14-planning-consistency-audit.md`; `docs/architecture/surface-local-frame-architecture.md`; `docs/legacy-unity/source-evidence/current-core-inventory.md`; `docs/legacy-unity/source-evidence/unity-to-threejs-port-map.json` |
| Browser-native intent | Use explicit `TargetDescriptor` data: target kind, exact position and `ArrivalEnvelope`. Waypoints are player/map markers that resolve to executable target descriptors. `Waypoint` and `Point` are executable now; future landing/docking/cargo/orbit descriptors remain type-reserved/deferred until separate runtime specs define exact handoffs. Broad sites/zones must resolve to exact target points before autopilot execution. |
| Non-goals | No Unity transform hierarchy scan, no weapon target filtering as navigation truth, no broad-zone completion, no hidden target/root fallback, and no landing/docking/cargo/orbit runtime in this v1 slice. |
| Tests / evidence hints | Target tests distinguish waypoint and point; rejection tests cover missing/null/invalid descriptors, unsupported future target kind, unsafe/inside-obstacle target and invalid obstacle fields; scenario evidence shows exact target kind/envelope, validation/scoring metadata, final position and target position. |
| Known Unity bug traps | Ambiguous taxonomy: `target point`, `landing zone`, `pickup point`, `site`, `waypoint`; unsupported future target kinds accidentally executing; broad landing zones reintroducing loose arrival; weapon target registry concepts leaking into navigation targets. |

## 4. HUD / Telemetry

| Field | Content |
| --- | --- |
| Source paths | `unity-legacy-final-2026-07:Assets/Scripts/Prototype/PrototypePlayerHud.cs`; `unity-legacy-final-2026-07:Assets/Scripts/Prototype/PrototypeFlightHud.cs`; `unity-legacy-final-2026-07:Assets/Scripts/Prototype/PrototypeTrajectoryPreviewNavMap.cs`; `unity-legacy-final-2026-07:Assets/Scripts/Prototype/PrototypeRuntimeDataSnapshots.cs`; `unity-legacy-final-2026-07:Assets/_Weltraum/Runtime/UI/StatusAuthorityContracts.cs`; `unity-legacy-final-2026-07:Assets/_Weltraum/Runtime/UI/StatusSnapshots.cs`; `docs/ux/player-facing-status-authority-v1.md`; `docs/ux/player-hud-map-builder-surface-flow.md`; `docs/ux/unified-ui-input-mode-architecture.md`; `docs/ux/debug-vs-player-ui-policy.md` |
| Browser-native intent | HUD renders read-only snapshots and player-facing ViewModels: grouped flight status, navigation, warnings, route action, and separate diagnostics. The screenshot-informed flight foundation uses `#flight-hud` with top/left/right/bottom edge regions and `.hud-center-safe-area` so the center remains available for ship/target/route visuals. Player UI shows mode, autopilot, selected target, route preview/locked-route state, compact radar-style route contact, warning chips, scalar speed, fuel/throttle/RCS/SAS, route action state and concise ship visual source. Raw velocity component vectors remain telemetry/TestBridge data rather than default player HUD text. Debug/TestBridge surfaces stay hidden/labeled and separate from player UI. |
| Non-goals | No HUD recomputation of ETA/fuel/risk/authority, no planner internals in player layer, no Unity IMGUI carryover, no F2-F6 dependency for player actions, no full map/planner/builder/combat/cargo/surface/station/outpost/economy UI in this foundation slice. |
| Tests / evidence hints | Browser E2E checks that HUD reflects telemetry after fixed-step advances, warning chips show owner/reason, raw velocity triples are absent from default HUD, TestBridge is absent by default, target selection and route preview align with render snapshots, no large HUD panels overlap the center-safe rectangle, and screenshots cover selected target/autopilot active/warning/responsive states. |
| Known Unity bug traps | UI status recomputation; debug/player surface contamination; raw plan/debug IDs in Basic mode; HUD claiming a route/fuel state different from Navigation Computer or Autopilot Supervisor. |

## 5. Proving-Ground / Evidence

| Field | Content |
| --- | --- |
| Source paths | `unity-legacy-final-2026-07:Assets/Tests/PlayMode/PrototypeAutopilotProvingGroundPlayModeTests.cs`; `unity-legacy-final-2026-07:Assets/Tests/Support/HeadlessSimulationRunner.cs`; `docs/legacy-unity/current-prototype-state-2026-06-15.md`; `docs/legacy-unity/architecture/autopilot-v2-test-harness.md`; `docs/legacy-unity/source-evidence/current-core-inventory.md`; `docs/legacy-unity/source-evidence/threejs-spike-test-summary.md`; `docs/legacy-unity/source-evidence/threejs-spike-decision-report.md` |
| Browser-native intent | Every mainline claim has deterministic tests and recorded evidence. The browser proving ground emits scenario JSON, Markdown summary and screenshots through the same core/TestBridge APIs used by runtime. The v2 course catalog classifies results as `Pass`, `KnownStress`, `ExpectedFail` or `Fail` so current planner limits are explicit. Long-range testfield v1 expands the browser catalog to 35 courses across 500m/1000m/2500m direct tiers, speed-profile comparison rows, long obstacle rows, documented `KnownStress` multi-obstacle/corridor limits and explicit `ExpectedFail` fuel/authority/brake/off-route cases; evidence is written under `apps/weltraum-browser/evidence/browser-autopilot-long-range-testfield-v1.md`, `autopilot-long-range-summary.json`, `autopilot-long-range-speed-profile-summary.json`, and representative screenshot files. |
| Non-goals | No manual-only acceptance, no Unity editor gate for browser features, no feature completion without at least a core test plus evidence scenario. |
| Tests / evidence hints | Matrix: direct local arrival, obstacle avoidance route, insufficient fuel, no authority, no main thrusters, brake reserve insufficient, off-route divergence, locked plan hash preservation, explicit replan-required signal. V2 catalog: direct-long, obstacle/corridor/near-target/high-speed/lateral/low-authority/low-fuel/disturbance courses with profile, ticks-to-arrival, peak speed, final distance/speed, minimum obstacle clearance, fuel used, arrival phase, initial/final plan hash, replan flag, classification and notes. Long-range evidence must include catalog/tested course counts, `Pass`/`KnownStress`/`ExpectedFail`/`Fail` counts, longest tested distance, `Safe`/`Balanced`/`Fast` comparison, fastest/slowest successful courses, fuel and clearance ranges, current planner-limit notes, GLBLoaded/TestBridge gating, and explicit no-snap/no-zero/no-silent-replan/stable-planHash confirmation. |
| Known Unity bug traps | Evidence drift between README/current-state/tests; acceptance gates passing/failing without matching docs; screenshot/canvas false negatives; scenario CSV/JSON becoming detached from actual runtime state; long-range KnownStress rows being overclaimed as solved multi-obstacle navigation. |

## 6. Open-World / World-Scale / Floating-Origin

| Field | Content |
| --- | --- |
| Source paths | `docs/architecture/coordinate-spaces-and-floating-origin.md`; `docs/architecture/real-scale-world-architecture.md`; `docs/architecture/surface-local-frame-architecture.md`; `apps/weltraum-browser/src/world/chunkRegistry.ts`; `apps/weltraum-browser/src/world/worldStreaming.ts`; `apps/weltraum-browser/src/world/worldStreamingScenario.ts`; `apps/weltraum-browser/tests/e2e/world-chunk-streaming.spec.ts`; `apps/weltraum-browser/tests/unit/chunkRegistry.test.ts`; `apps/weltraum-browser/tests/unit/worldStreaming.test.ts`; historical external package input "docs/open-world-low-poly-browser-plan.md" (not a live repo path in this worktree) |
| Browser-native intent | Model absolute simulation truth separately from projection output. Add deterministic `chunkRegistry` and `worldStreaming` contracts that keep `Full`/`Snapshot`/`Dormant` simulation residency independent from render `Near`/`Medium`/`Far`/`Culled` LOD. Planner input/output is signature-based and deterministic across `observerAbsolutePosition`, policy radii, budgets, and transition history. Streaming uses deadband hysteresis and fixed ordered transition/rejection reporting. |
| Non-goals | No live chunk IO, async asset loader, terrain pipeline, orbital mechanics, non-identity frame conversion, surface runtime, save/load, or production chunk persistence in this slice. No naked `Vector3` across frame boundaries. |
| Tests / evidence hints | Unit tests for canonical IDs (`chunk:x:y:z`), duplicate/conflict validation, ordered registry listings, bounded radius/bounds queries, and deterministic world streaming plans. E2E scenario checks include deterministic `initial`/`boundary`/`farther` observer steps, policy radii and budgets, ordered transitions and rejections, signed canonical snapshot strings, floating-origin invariance, and `TestBridge` availability only at `?testBridge=1`. Evidence files: `browser-world-chunk-registry-streaming-v1.md`, `browser-world-chunk-registry-streaming-v1-summary.json`. |
| Known Unity bug traps | Floating-origin shifts changing residency/LOD/signatures; local projections leaking into gameplay state; simulation/render budget coupling; state churn from final-state-based transitions; query-gated scenario accidentally visible on default `/` route. |

## 7. Ship Builder (Domain + Compatibility/Mass Cores Implemented; UI Later)

| Field | Content |
| --- | --- |
| Source paths | `docs/spielkonzept/ship-builder-acceptance-scenarios.md`; `docs/spielkonzept/ship-builder-data-model.md`; `docs/spielkonzept/ship-builder-gameplay-ux.md`; `docs/spielkonzept/ship-builder-modular-parts.md`; `docs/spielkonzept/ship-builder-mvp-flow.md`; `docs/spielkonzept/ship-builder-stat-formulas.md`; `docs/spielkonzept/ship-builder-testflight-validation.md`; `docs/spielkonzept/ship-builder-validation-rules.md`; `apps/weltraum-browser/src/ship-builder/`; `docs/browser-mainline/ship-builder-domain-catalog-v1.md`; `docs/browser-mainline/ship-builder-compatibility-mass-core-v1.md` |
| Browser-native intent | The browser now has a JSON-safe Ship Builder domain/catalog/blueprint/serialization foundation plus explicit immutable connection policy, deterministic structure reports, enabled-only dry mass, grid/meter COM, and yaw-aware footprint bounds. Stable IDs, schema errors, canonical hashes, the sixteen-part starter catalog, and fixture layout signatures remain unchanged. A later Builder owns player placement/edit/save/test-flight flow and runtime authority through commands and snapshots; analysis does not infer truth from meshes, aliases, or category labels. |
| Non-goals | No Builder UI, runtime/test-flight/active-ship integration, renderer or production-art binding, thrust/authority/full stat engine, cargo/fuel/ammo/crew/resource mass, economy unlocks/final costs, or the remaining sixteen planned catalog variants. Categories remain metadata and do not grant capability. |
| Tests / evidence hints | `shipBuilderCatalog`, `shipBuilderBlueprint`, `shipBuilderSerialization`, `shipBuilderCompatibility`, `shipBuilderValidation`, and `shipBuilderMassProperties` cover schema/domain separation, policy, graph, Required/Occupancy, COM/bounds, overflow, canonicalization, and immutability. Both normal-route Ship Builder E2Es keep `TestBridge` absent, dynamically import the Vite barrel, and write deterministic JSON/Markdown evidence without screenshots. Later: Builder edit/test-flight/return screenshots and runtime authority evidence. |
| Known Unity bug traps | Gameplay stats derived from visual helpers instead of metadata; aliases treated as compatibility; same endpoint silently reused under Exclusive policy; disabled connections occupying sockets; hidden replans/graph edges from incompatible links; armor/fuel/cargo leaking into dry mass; test flight mutating active ship; Builder input leaking into flight/autopilot controls. |

## 8. Surface-FPS (Later Intent Only)

| Field | Content |
| --- | --- |
| Source paths | `docs/spielkonzept/on-planet-first-person-mode.md`; `docs/architecture/surface-local-frame-architecture.md`; `docs/architecture/real-scale-world-architecture.md`; `docs/ux/player-hud-map-builder-surface-flow.md`; `docs/ux/unified-ui-input-mode-architecture.md`; `docs/design-audits/2026-06-14-planning-consistency-audit.md` |
| Browser-native intent | Future surface mode uses `SurfaceLocalFrame`, suit/player mode ownership, ship beacon/status, scanner, local hazards and exact target handoffs for landing/pickup/cargo points. It remains anchored to absolute world state. |
| Non-goals | Not implemented in this transition step. No first-person controller, planet terrain, mining loop, outpost, cargo transfer, drones or surface combat implementation. |
| Tests / evidence hints | Later: frame handoff tests, landed ship exit/return flow, suit HUD warning evidence, exact pickup/landing target descriptor evidence. |
| Known Unity bug traps | Treating a surface site as just terrain; broad zone completion instead of exact target points; surface controls reusing ship controls blindly; local surface position saved without absolute/frame anchor. |

## 9. Resource / Cargo Contract Core

| Field | Content |
| --- | --- |
| Source paths | `apps/weltraum-browser/src/resources/**`; `apps/weltraum-browser/tests/unit/resource{Catalog,Containers,Transfer}.test.ts`; `apps/weltraum-browser/tests/e2e/resource-cargo-core.spec.ts`; [resource/cargo core contract](./resource-cargo-inventory-core-v1.md) |
| Browser-native intent | Provide one standalone, validated, immutable catalog/container/transfer contract for eight provisional resources and eight container kinds. Normal-page evidence dynamically imports the public module and proves deterministic full, partial, mission-locked, and sealed-split behavior without exposing TestBridge. |
| Non-goals | No player inventory UI, runtime/flight/render/sim wiring, economy consequences, mining gameplay, or Ship Builder integration. `ResourceRequirement` is only a neutral future seam. |
| Tests / evidence hints | Resource unit coverage plus deterministic task-owned JSON/Markdown evidence with status/code, revision, metadata, signature, and rejected-snapshot assertions. |
| Known Unity bug traps | Per-system cargo shapes, hidden mutable registries, random/clock-derived stack IDs, atomic rejection mutation, and treating a provisional data contract as implemented economy or gameplay. |

## Coverage Checklist

- [x] Flight / Control
- [x] Navigation / Autopilot
- [x] Route / Waypoint / Targeting
- [x] HUD / Telemetry
- [x] Proving-Ground / Evidence
- [x] Open-World / World-Scale / Floating-Origin
- [x] Ship Builder domain/catalog plus compatibility, structure, and dry-mass foundations (Builder UI/runtime deferred)
- [x] Surface-FPS later intent only
- [x] Resource / Cargo Contract Core
