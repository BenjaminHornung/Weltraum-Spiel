# Prototype Legacy Boundary Audit

Stand: 2026-06-15

This audit defines the line between the current Prototype runtime and the future Clean Core product architecture. It is based on the current prototype state, the clean-core architecture docs, roadmap sequencing, the planning-consistency audit, and the current prototype proving-ground evidence (`docs/legacy-unity/current-prototype-state-2026-06-15.md:7-16, 48-64, 65-157`; `docs/legacy-unity/architecture/clean-core-refactor-overview.md:10-22, 43-55`; `docs/legacy-unity/architecture/clean-core-runtime-architecture.md:53-62, 63-121, 208-213`; `docs/legacy-unity/roadmap/milestones.md:25-43, 45-64, 85-103, 161-178`; `docs/legacy-unity/roadmap/spec-sorting-2026-06-15.md:21-84`; `docs/design-audits/2026-06-14-planning-consistency-audit.md:61-85, 137-220`).

## Boundary summary

- Prototype stays as legacy/reference, not the place where new product architecture grows.
- Clean Core may consume Prototype only through narrow snapshot/DTO/command seams.
- Scene wiring, IMGUI diagnostics, camera framing, and imported ship binding remain adapter/reference concerns until a dedicated product slice replaces them.
- The proving-ground tests are the current behavior authority for autopilot and adjacent flight semantics.

## Prototype system classification

| File/System | Purpose | Current state | Keep as reference? | Migrate? | Adapter needed? | Delete/archive later? | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PrototypeWaypointAutopilot.cs` / `PrototypeTrajectoryPlanner.cs` | Target selection, exact arrival, obstacle avoidance, route scoring, diagnostics. | Current playable autopilot authority; exact-arrival is resolved and backed by proving-ground PASS evidence. The system still lives in Prototype and uses runtime dependencies that Clean Core must not inherit directly (`docs/legacy-unity/current-prototype-state-2026-06-15.md:27-31, 99-110, 142-157`; `PrototypeWaypointAutopilot.cs:4-71, 118-150, 235-500`; `PrototypeTrajectoryPlanner.cs:5-41, 43-123, 125-450`). | Yes | Yes, semantics/tests to `Weltraum.Navigation` | Yes, via immutable route/fuel/authority snapshots and execution commands | Yes, after V2 pure core and test harness replace it | High |
| `PlayerShipController.cs` | Flight input, throttle, RCS/SAS, control modes, mass refresh, recoil stabilizer references. | Live flight controller for cruise/precision/translation behavior, including RCS and SAS routing (`docs/legacy-unity/current-prototype-state-2026-06-15.md:17-46`; `PlayerShipController.cs:4-31, 32-98, 100-176, 195-450`). | Yes | Yes, into `Weltraum.Flight` | Yes, via ship authority and control-state snapshots only | Yes, once Flight owns the control contract | Medium-High |
| `PrototypePlayerHud.cs` / `PrototypeFlightHud.cs` | Player HUD, navigation/combat panels, legacy navball/debug IMGUI. | uGUI Basic view is the default player surface; IMGUI remains diagnostic and developer-facing (`docs/legacy-unity/current-prototype-state-2026-06-15.md:9-10, 48-64`; `PrototypePlayerHud.cs:8-31, 667-909, 3867-4218`; `PrototypeFlightHud.cs:3-67, 82-120, 243-450`). | Yes | Yes, player-facing concepts to `Weltraum.UI`; IMGUI diagnostics only for reference | Yes, via ViewModels/Commands and presentation snapshots | Yes, after player HUD parity and debug replacement | High |
| `PrototypeMinimapOverlay.cs` | Legacy minimap/radar, route preview, predicted path, obstacle drawing. | Diagnostic IMGUI surface that draws route and trajectory context for the prototype (`docs/legacy-unity/current-prototype-state-2026-06-15.md:34-38, 48-64`; `PrototypeMinimapOverlay.cs:4-115, 177-243, 264-484`). | Yes | Yes, concepts to `Weltraum.Map` | Yes, via map/radar route snapshots | Yes, after map presenter parity exists | Medium-High |
| `SimpleFollowCamera.cs` | Chase/orbit/free camera modes, autopilot flip assist, framing/bounds behavior. | Prototype camera behavior remains scene-bound and is currently reconfigured by bootstrap wiring after rebuilds (`docs/legacy-unity/current-prototype-state-2026-06-15.md:13-16, 31-38`; `SimpleFollowCamera.cs:5-21, 35-120, 161-419`). | Yes | Partial semantics only; implementation should move to scene/presenter camera service, not Clean Core | Yes, via camera-state snapshots only | Yes, when product camera service replaces it | Medium |
| `PrototypeBootstrap.cs` / `PrototypeBootstrapHost.unity` | Runtime roots, HUD/debug/minimap/follow-camera wiring, empty-scene startup. | Scene composition and wiring entry point; the bootstrap can create runtime roots from an empty or nearly empty scene (`docs/legacy-unity/current-prototype-state-2026-06-15.md:11-16`; `PrototypeBootstrap.cs:6-300, 1177-1551`). | Yes, as wiring reference | No product logic migration here; only composition/manifest patterns | Yes, but only through scene composition and presenter setup | Yes, after product scenes/manifests replace bootstrap wiring | High |
| `PrototypeWeaponComputer.cs` | Target selection, priority, auto-fire gating, turret status. | Current combat targeting authority for the prototype ship and turret system (`docs/legacy-unity/current-prototype-state-2026-06-15.md:7-10, 29-31`; `PrototypeWeaponComputer.cs:4-90, 154-391`). | Yes | Yes, semantics to `Weltraum.Combat` | Yes, via combat target/status snapshots | Yes, after combat service and UI contract exist | Medium |
| `PrototypeFunctionalShipBinder.cs` / `PrototypeImportedShipBinder.cs` | Demo Scout/Cargo binding, socket proxies, VFX/weapon/hardpoint binding, imported ship setup. | Functional ship binding remains authoritative for the imported Blender demo ship and its required sockets/markers (`docs/legacy-unity/current-prototype-state-2026-06-15.md:7-8`; `PrototypeFunctionalShipBinder.cs:5-149, 172-500`; `PrototypeImportedShipBinder.cs:5-96, 98-421`). | Yes | Yes, socket/part semantics to ShipBuilder/Flight/Combat contracts | Yes, via socket alias tables and validation snapshots | Yes, after the importer/builder pipeline replaces the legacy binders | High |
| Proving ground tests and support fixtures | Autopilot, flight, UI, and runtime regression evidence. | Current authority for behavioral claims; these tests are the acceptance evidence basis referenced by the prototype state and roadmap (`Assets/Tests/PlayMode/PrototypeAutopilotProvingGroundPlayModeTests.cs`; `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`; `Assets/Tests/PlayMode/PrototypeFlightControlRegressionPlayModeTests.cs`; `Assets/Tests/PlayMode/PrototypeRuntimeHudCameraBootstrapPlayModeTests.cs`; `Assets/Tests/PlayMode/PrototypeFunctionalBlenderRuntimePlayModeTests.cs`; `Assets/Tests/PlayMode/PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.cs`; `Assets/Tests/PlayMode/PrototypeImportedBlenderJitterEvidencePlayModeTests.cs`; `Assets/Tests/PlayMode/PrototypeShipBuilderV0PlayModeTests.cs`; `Assets/Tests/Editor/PrototypeWaypointAutopilotValidationTests.cs`; `Assets/Tests/Editor/PrototypeWaypointAutopilotObstacleReplanStabilityTests.cs`; `Assets/Tests/Editor/PrototypeWaypointAutopilotArrivalTerminalCaptureTests.cs`; `Assets/Tests/Editor/PrototypeWeaponComputerTurretValidationTests.cs`; `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`; `Assets/Tests/Editor/PrototypeFlightHudValidationTests.cs`; `Assets/Tests/Editor/PrototypeSimpleFollowCameraValidationTests.cs`; `Assets/Tests/Editor/PrototypeBootstrapRuntimeGuardValidationTests.cs`; `Assets/Tests/Support/HeadlessSimulationRunner.cs`, `AutopilotDriver.cs`, `ShipDriver.cs`, `CombatDriver.cs`, `PrototypeScenarioBuilder.cs`, `SimulationSnapshots.cs`). | Yes | Yes, as baseline evidence and harness input | Yes, via snapshot/CSV/JSON/evidence adapters | No immediate deletion; archive only after a new harness fully supersedes them | Low |

## Boundary rules

### What Clean Core may read from Prototype

- Immutable snapshots of ship authority, fuel, mass, route diagnostics, combat target status, HUD view state, map/radar state, and camera state.
- Evidence outputs from proving-ground tests (CSV, JSON, screenshots, and validation summaries).
- Adapter-produced DTOs and commands that were intentionally shaped to avoid scene or MonoBehaviour coupling.

### What Clean Core must never reference

- Concrete Prototype MonoBehaviours as a domain dependency.
- Scene wiring as a business contract.
- Legacy IMGUI windows as the source of truth for player state.
- Bootstrap-only helper behavior such as dynamic scene root creation.
- Hardcoded fallbacks that silently map missing sockets, targets, or markers to zero/root defaults.

### Allowed adapter points

- Scene composition roots and manifest-driven wiring.
- Presenter/ViewModel mappers.
- Snapshot readers and command emitters.
- Test/evidence harnesses that extract authoritative behavior without owning the rules.

### Evidence required before any migration claim

- Relevant EditMode and PlayMode tests for the slice.
- Unity script validation or console verification after any script change.
- Solution build/test results from the project verification contract.
- Visual/simulation evidence where the slice affects HUD, map, camera, or route behavior.
- No task completion claims without evidence; no checkbox closure by assumption.

## Unambiguous next adapter / migration recommendation

Start with an **Autopilot + Flight snapshot adapter slice**.

Reason: flight authority, mass/fuel, and route execution are the data most likely to invalidate UI, map, and combat claims if they are migrated later without a shared contract. Do **not** start with bootstrap cleanup or camera polish; those should remain scene/presenter concerns until the authority-bearing snapshots are stable.

## Risks and watchouts

- If the adapter surface grows beyond snapshots/commands, Prototype internals will leak back into Clean Core.
- If UI or camera work starts first, the project may paper over authority mismatches.
- If ship binder semantics are not frozen, imported functional ship evidence can diverge from future builder contracts.
