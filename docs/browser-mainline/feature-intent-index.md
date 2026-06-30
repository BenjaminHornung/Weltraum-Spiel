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
| Source paths | `Assets/Scripts/Prototype/PlayerShipController.cs`; `Assets/Scripts/Prototype/MainThrusterBank.cs`; `Assets/Scripts/Prototype/RcsThrusterController.cs`; `docs/current-prototype-state.md`; `docs/architecture/prototype-legacy-boundary-audit-2026-06-15.md`; `analysis/threejs-mainline/source-evidence/current-core-inventory.md`; `analysis/threejs-mainline/source-evidence/unity-to-threejs-port-map.json` |
| Browser-native intent | Deterministic ship state now carries explicit `ShipMass`, `FuelState`, `AuthorityState`, `BrakingReserve` and owner `FlightSnapshot` contracts under `apps/weltraum-browser`. Playable flight v1 adds Flight State V2 with orientation, angular velocity, throttle, control mode, RCS/SAS state, command vectors and actuator telemetry. Desktop keyboard/mouse manual controls and autopilot share `applyFlightControllerStep`, while `ChaseLocked` follows the moving ship and VFX/HUD read actuator telemetry. Demo Scout GLB visual parity v1 adds a browser render adapter that loads `/ships/demo_scout_mk1.glb` when available, reports deterministic visual-source states, and preserves procedural fallback without making renderer state gameplay truth. Mobile is target selection/autopilot-only in this slice. Cargo mass is a stubbed numeric field only; richer cargo/resource contracts remain deferred. |
| Non-goals | No Unity Rigidbody parity claim, no MonoBehaviour input lifecycle, no per-nozzle RCS allocator copy, no gimbal/SAS solver port, no cargo/resource/economy behavior, and no general production GLB asset pipeline parity beyond the bounded Demo Scout browser adapter. |
| Tests / evidence hints | Unit tests cover deterministic fuel burn, mass-sensitive acceleration/braking reserve, no fuel, no autopilot authority, no main thrusters, brake-reserve insufficiency, HUD owner-snapshot consumption, visual-source HUD line, plan-hash preservation, manual control mode/throttle/RCS/SAS behavior, shared actuator telemetry, acceleration-magnitude VFX scale, marker/socket descriptor validation and no idle/cancel drift zero. Screenshot evidence covers Demo Scout GLB loaded, ChaseLocked/manual flight, RCS translation/puffs, autopilot thruster burn and autopilot arrival. |
| Known Unity bug traps | Authority/fuel/brake split-brain between controller, HUD and planner; residual RCS/translation drift; treating Unity physics output as deterministic truth; hidden root defaults when functional ship sockets are missing. |

## 2. Navigation / Autopilot

| Field | Content |
| --- | --- |
| Source paths | `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`; `Assets/Scripts/Prototype/PrototypeFlightPlan.cs`; `Assets/Scripts/Prototype/PrototypeTrajectoryPlanner.cs`; `Assets/_Weltraum/Runtime/Navigation/AutopilotContracts.cs`; `docs/architecture/autopilot-v2-design.md`; `docs/architecture/autopilot-v2-test-harness.md`; `analysis/threejs-mainline/source-evidence/threejs-spike-decision-report.md`; `analysis/threejs-mainline/source-evidence/threejs-spike-test-summary.md` |
| Browser-native intent | Split target resolution, planner, validator, immutable `RoutePlan`, executor, supervisor and telemetry. The browser v1 slice now has explicit `TargetDescriptor.kind`, `ArrivalEnvelope`, `RouteValidationResult`, deterministic `RouteScore`/`RouteCandidate` metadata, `RoutePlanningResult` structured rejection contracts, and runtime-owned selected-target/route-preview state for existing proving-ground targets. Planner produces deterministic `planHash`; executor executes exactly that locked plan through the shared actuator layer; invalidation surfaces as visible status/reason/replan-required telemetry. Playable flight v1 removes normal-runtime target/waypoint snap and waypoint/idle velocity-zero shortcuts. |
| Non-goals | No executor-side silent replan, no legacy fallback policy, no automatic plan replacement, no gravity/orbit/slingshot blending into local-space arrival, and no runtime route modes/landing/docking/cargo/orbit behavior in this v1 slice. |
| Tests / evidence hints | Direct local arrival through actual envelope entry, obstacle avoidance, off-route divergence, locked hash preservation, explicit `replanRequired`, target-selection fail-closed behavior, plan serialization/hash determinism, waypoint/point target taxonomy, arrival-envelope evidence, no normal-runtime snap/zero regression tests, autopilot actuator-request tests, structured planner rejection, invalid obstacle rejection and deterministic candidate scoring tests. |
| Known Unity bug traps | Silent or safety replans hiding divergence; terminal capture flapping back to accelerate/reacquire; route plan labels diverging from executor truth; target fallback to root/zero; docs/test drift around exact point arrival status. |

## 3. Route / Waypoint / Targeting

| Field | Content |
| --- | --- |
| Source paths | `Assets/Scripts/Prototype/PrototypeWaypointManager.cs`; `Assets/Scripts/Prototype/PrototypeNavigationTarget.cs`; `Assets/Scripts/Prototype/PrototypeWeaponTargetRegistry.cs`; `Assets/Scripts/Prototype/PrototypeWeaponTarget.cs`; `docs/design-audits/2026-06-14-planning-consistency-audit.md`; `docs/architecture/surface-local-frame-architecture.md`; `analysis/threejs-mainline/source-evidence/current-core-inventory.md`; `analysis/threejs-mainline/source-evidence/unity-to-threejs-port-map.json` |
| Browser-native intent | Use explicit `TargetDescriptor` data: target kind, exact position and `ArrivalEnvelope`. Waypoints are player/map markers that resolve to executable target descriptors. `Waypoint` and `Point` are executable now; future landing/docking/cargo/orbit descriptors remain type-reserved/deferred until separate runtime specs define exact handoffs. Broad sites/zones must resolve to exact target points before autopilot execution. |
| Non-goals | No Unity transform hierarchy scan, no weapon target filtering as navigation truth, no broad-zone completion, no hidden target/root fallback, and no landing/docking/cargo/orbit runtime in this v1 slice. |
| Tests / evidence hints | Target tests distinguish waypoint and point; rejection tests cover missing/null/invalid descriptors, unsupported future target kind, unsafe/inside-obstacle target and invalid obstacle fields; scenario evidence shows exact target kind/envelope, validation/scoring metadata, final position and target position. |
| Known Unity bug traps | Ambiguous taxonomy: `target point`, `landing zone`, `pickup point`, `site`, `waypoint`; unsupported future target kinds accidentally executing; broad landing zones reintroducing loose arrival; weapon target registry concepts leaking into navigation targets. |

## 4. HUD / Telemetry

| Field | Content |
| --- | --- |
| Source paths | `Assets/Scripts/Prototype/PrototypePlayerHud.cs`; `Assets/Scripts/Prototype/PrototypeFlightHud.cs`; `Assets/Scripts/Prototype/PrototypeTrajectoryPreviewNavMap.cs`; `Assets/Scripts/Prototype/PrototypeRuntimeDataSnapshots.cs`; `Assets/_Weltraum/Runtime/UI/StatusAuthorityContracts.cs`; `Assets/_Weltraum/Runtime/UI/StatusSnapshots.cs`; `docs/ux/player-facing-status-authority-v1.md`; `docs/ux/player-hud-map-builder-surface-flow.md`; `docs/ux/unified-ui-input-mode-architecture.md`; `docs/ux/debug-vs-player-ui-policy.md` |
| Browser-native intent | HUD renders read-only snapshots and player-facing ViewModels: control mode, camera mode, fuel/throttle/RCS/SAS, scalar speed, selected target, route preview/locked-route state, compact radar-style route contact, warnings, target state, desktop keyboard/mouse keybind help, mobile target/autopilot-only limitation and next action. Raw velocity component vectors remain telemetry/TestBridge data rather than default player HUD text. Debug/TestBridge surfaces stay labeled and separate from player UI. |
| Non-goals | No HUD recomputation of ETA/fuel/risk/authority, no planner internals in player layer, no Unity IMGUI carryover, no F2-F6 dependency for player actions. |
| Tests / evidence hints | Browser E2E checks that HUD reflects telemetry after fixed-step advances, warning chips show owner/reason, raw velocity triples are absent from default HUD, TestBridge is absent by default, target selection and route preview align with render snapshots, and screenshots cover selected target/autopilot active/warning/mobile states. |
| Known Unity bug traps | UI status recomputation; debug/player surface contamination; raw plan/debug IDs in Basic mode; HUD claiming a route/fuel state different from Navigation Computer or Autopilot Supervisor. |

## 5. Proving-Ground / Evidence

| Field | Content |
| --- | --- |
| Source paths | `Assets/Tests/PlayMode/PrototypeAutopilotProvingGroundPlayModeTests.cs`; `Assets/Tests/Support/HeadlessSimulationRunner.cs`; `docs/current-prototype-state.md`; `docs/architecture/autopilot-v2-test-harness.md`; `analysis/threejs-mainline/source-evidence/current-core-inventory.md`; `analysis/threejs-mainline/source-evidence/threejs-spike-test-summary.md`; `analysis/threejs-mainline/source-evidence/threejs-spike-decision-report.md` |
| Browser-native intent | Every mainline claim has deterministic tests and recorded evidence. The browser proving ground should emit scenario JSON, Markdown summary and screenshots through the same core/TestBridge APIs used by runtime. |
| Non-goals | No manual-only acceptance, no Unity editor gate for browser features, no feature completion without at least a core test plus evidence scenario. |
| Tests / evidence hints | Matrix: direct local arrival, obstacle avoidance route, insufficient fuel, no authority, no main thrusters, brake reserve insufficient, off-route divergence, locked plan hash preservation, explicit replan-required signal. Preserve telemetry fields: status, ticks, final distance/speed, final position, target position, initial/final mass, fuel used, authority, braking reserve, failure reasons, initial/final plan hash, replan flag and reasons. |
| Known Unity bug traps | Evidence drift between README/current-state/tests; acceptance gates passing/failing without matching docs; screenshot/canvas false negatives; scenario CSV/JSON becoming detached from actual runtime state. |

## 6. Open-World / World-Scale / Floating-Origin

| Field | Content |
| --- | --- |
| Source paths | `docs/architecture/coordinate-spaces-and-floating-origin.md`; `docs/architecture/real-scale-world-architecture.md`; `docs/architecture/surface-local-frame-architecture.md`; `docs/design-audits/2026-06-14-planning-consistency-audit.md`; historical external package input "docs/open-world-low-poly-browser-plan.md" (not a live repo path in this worktree) |
| Browser-native intent | Model absolute simulation state as durable truth and local/render/physics frames as projections. Positions and velocities crossing systems carry frame descriptors. Three.js renders local projections; floating-origin shifts do not change gameplay state. Use simulation bubbles, chunk registries, instancing and LOD bands before content scale. |
| Non-goals | No full planet generation, terrain streaming, orbital mechanics, surface runtime or save/load implementation in this step. No naked `Vector3` across frame boundaries. |
| Tests / evidence hints | M6 foundation now adds frame conversion unit tests, floating-origin shift invariant tests, velocity frame tests, simulation-bubble membership tests and a render-only asteroid `InstancedMesh` smoke exposed only through the gated TestBridge render snapshot. Evidence should record frame IDs, before/after absolute/local coordinates and instance budgets. |
| Known Unity bug traps | Floating-origin shifts altering velocity/camera/route math; camera or HUD using local transforms as durable truth; ship-local `+Y` vs surface-up confusion; route previews or target markers not shifted consistently. |

## 7. Ship Builder (Later Intent Only)

| Field | Content |
| --- | --- |
| Source paths | `docs/spielkonzept/ship-builder-acceptance-scenarios.md`; `docs/spielkonzept/ship-builder-data-model.md`; `docs/spielkonzept/ship-builder-gameplay-ux.md`; `docs/spielkonzept/ship-builder-modular-parts.md`; `docs/spielkonzept/ship-builder-mvp-flow.md`; `docs/spielkonzept/ship-builder-stat-formulas.md`; `docs/spielkonzept/ship-builder-testflight-validation.md`; `docs/spielkonzept/ship-builder-validation-rules.md`; `docs/ux/player-hud-map-builder-surface-flow.md`; `docs/architecture/coordinate-spaces-and-floating-origin.md` |
| Browser-native intent | Future browser builder owns ship-local part placement, validation, stats, draft save/test flight flow and part metadata. It should use ship-local coordinates (`+Z` forward, `+Y` up, `+X` right) and publish runtime authority/mass snapshots only through contracts. |
| Non-goals | Not implemented in this transition step. No broad catalog, economy unlocks, production art import or runtime builder port. |
| Tests / evidence hints | Later: validation unit tests, draft/test-flight handoff, stats snapshot tests, screenshot evidence for builder edit/test-flight/return. |
| Known Unity bug traps | Gameplay stats derived from visual helpers instead of metadata; socket alias ambiguity; test flight mutating active ship; builder input leaking into flight/autopilot controls. |

## 8. Surface-FPS (Later Intent Only)

| Field | Content |
| --- | --- |
| Source paths | `docs/spielkonzept/on-planet-first-person-mode.md`; `docs/architecture/surface-local-frame-architecture.md`; `docs/architecture/real-scale-world-architecture.md`; `docs/ux/player-hud-map-builder-surface-flow.md`; `docs/ux/unified-ui-input-mode-architecture.md`; `docs/design-audits/2026-06-14-planning-consistency-audit.md` |
| Browser-native intent | Future surface mode uses `SurfaceLocalFrame`, suit/player mode ownership, ship beacon/status, scanner, local hazards and exact target handoffs for landing/pickup/cargo points. It remains anchored to absolute world state. |
| Non-goals | Not implemented in this transition step. No first-person controller, planet terrain, mining loop, outpost, cargo transfer, drones or surface combat implementation. |
| Tests / evidence hints | Later: frame handoff tests, landed ship exit/return flow, suit HUD warning evidence, exact pickup/landing target descriptor evidence. |
| Known Unity bug traps | Treating a surface site as just terrain; broad zone completion instead of exact target points; surface controls reusing ship controls blindly; local surface position saved without absolute/frame anchor. |

## Coverage Checklist

- [x] Flight / Control
- [x] Navigation / Autopilot
- [x] Route / Waypoint / Targeting
- [x] HUD / Telemetry
- [x] Proving-Ground / Evidence
- [x] Open-World / World-Scale / Floating-Origin
- [x] Ship Builder later intent only
- [x] Surface-FPS later intent only
