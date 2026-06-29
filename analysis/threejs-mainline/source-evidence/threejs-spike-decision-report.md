# Three.js Core Port Spike Decision Report

Date: 2026-06-29

Analyzed commit: `e416eb880ff4b42fdf35a93c1b567dfbfa186bbb`

Branch: `spike/threejs-core-port-v1`

## Recommendation

Decision: **Three.js parallel**.

Do not make Three.js the main path yet, and do not rewrite the game. Continue Unity for the current game/editor/asset-heavy prototype while pursuing a browser TypeScript core in parallel for deterministic navigation, plan execution, telemetry, and proving-ground style evidence.

Recommendation remains: Three.js parallel, not a main-path rewrite.

## Why

The spike proves that the most important navigation contract can be isolated from Unity:

- Planner creates a deterministic `RoutePlan`.
- `RoutePlan.planHash` provides stable identity for tests, HUD/debug output, and executor locking.
- `AutopilotExecutor` consumes the locked plan.
- Divergence is explicit telemetry: `status = Diverged`, `replanRequired = true`, `invalidationReasons = [OffLockedRoute]`.
- The executor does not silently replace the plan.
- The browser scene can expose telemetry and screenshot evidence without Unity.
- Browser simulation now routes `TestBridge.advance` through the fixed-step loop so timing behavior is testable and deterministic.

This is enough evidence to continue the browser core track. It is not enough evidence to replace Unity because major gameplay and production systems remain Unity-bound.

## Unity Systems Read

Static analysis covered:

- Flight/control:
  - `Assets/Scripts/Prototype/PlayerShipController.cs`
  - `Assets/Scripts/Prototype/MainThrusterBank.cs`
  - `Assets/Scripts/Prototype/RcsThrusterController.cs`
- Navigation/autopilot:
  - `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`
  - `Assets/Scripts/Prototype/PrototypeFlightPlan.cs`
  - `Assets/Scripts/Prototype/PrototypeTrajectoryPlanner.cs`
  - `Assets/_Weltraum/Runtime/Navigation/AutopilotContracts.cs`
- Route/waypoint/targeting:
  - `Assets/Scripts/Prototype/PrototypeWaypointManager.cs`
  - `Assets/Scripts/Prototype/PrototypeNavigationTarget.cs`
  - `Assets/Scripts/Prototype/PrototypeWeaponTargetRegistry.cs`
  - `Assets/Scripts/Prototype/PrototypeWeaponTarget.cs`
- HUD/telemetry:
  - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`
  - `Assets/Scripts/Prototype/PrototypeFlightHud.cs`
  - `Assets/Scripts/Prototype/PrototypeTrajectoryPreviewNavMap.cs`
  - `Assets/Scripts/Prototype/PrototypeRuntimeDataSnapshots.cs`
  - `Assets/_Weltraum/Runtime/UI/StatusAuthorityContracts.cs`
  - `Assets/_Weltraum/Runtime/UI/StatusSnapshots.cs`
- Proving ground/evidence:
  - `Assets/Tests/PlayMode/PrototypeAutopilotProvingGroundPlayModeTests.cs`
  - `docs/current-prototype-state.md`
  - `README.md`

Unity editor was not used.

## Ported Features

Implemented in `spikes/threejs-core-port-v1`:

- Vite/TypeScript app shell
- fixed-step simulation loop
- ship state: position, velocity, fuel, authority
- `TargetDescriptor`
- `RoutePlan`, `RouteSegment`, deterministic `planHash`
- `DirectLocalPlanner`
- `ObstacleAvoidanceLocalPlanner`
- `AutopilotExecutor` with locked plan
- no silent replan in executor
- telemetry serialization API
- `window.TestBridge` for browser tests
- low-poly Three.js debug scene with route, ship, target, obstacle, and HUD readout
- Vitest core tests
- Playwright desktop/mobile E2E
- screenshot and JSON telemetry evidence

## Stubbed or Simplified

- RCS allocation is represented as scalar authority rather than per-nozzle force/torque allocation.
- Fuel burn is deterministic and proportional to acceleration demand.
- Obstacles are spherical clearance blockers.
- Planner candidate scoring is limited to direct vs. first-blocking-obstacle avoidance.
- HUD is a debug DOM overlay rather than full Unity HUD parity.
- Proving-ground coverage is a small browser acceptance slice, not the full Unity scenario matrix.

## Excluded by Design

- Ship Builder
- Surface-FPS
- missions
- economy
- drones
- production Unity assets
- Unity physics engine behavior
- automatic legacy fallback
- automatic executor-side replanning

## Browser Evidence

Final Playwright evidence:

- `evidence/debug-scene.png`: desktop screenshot, 1280 x 720, 71,534 bytes, 2,304 sampled pixels, 157 non-dark pixels, 30 unique sampled colors.
- `evidence/debug-scene-mobile.png`: mobile screenshot, 393 x 851, 34,782 bytes, 860 sampled pixels, 77 non-dark pixels, 31 unique sampled colors.
- `evidence/telemetry.json`: locked obstacle-avoidance route with `planHash = 4f3a1050`; forced divergence reports `replanRequired = true`, `invalidationReasons = ['OffLockedRoute']`, `activeSegmentId = avoid-rock-a-0`, `tick = 110` while retaining the locked plan hash.

## Performance First Read

- Pure core tests are very fast: 6 tests in 304 ms.
- Production build is fast: Vite build in 251 ms.
- E2E is fast enough for spike CI: 2 browser tests in 4.8 s.
- The only immediate performance warning is bundle size: Three.js pushes the minified app chunk to 537.71 kB, 135.84 kB gzip. This is fine for a spike, but a product path should split debug rendering from pure core and consider dynamic import/code splitting for Three.js.

## Risks

- Existing Unity behavior is still heavily MonoBehaviour/Rigidbody/asset oriented.
- README, current prototype state docs, and Proving Ground tests show some drift around exact point-arrival status.
- The browser core currently has a simplified acceleration/braking model and needs more parity scenarios before it can claim gameplay equivalence.
- Browser rendering tests need policy-aware launch config on this machine because bundled Playwright headless shell can be blocked.

## Next Task

Build a parity proving-ground matrix that runs the same small scenario set in TypeScript and, when Unity is available elsewhere, in Unity PlayMode:

- direct local arrival
- obstacle avoidance route
- insufficient fuel
- no authority
- off-route divergence
- locked plan hash preservation
- explicit replan-required signal

Only after that matrix is stable should the TypeScript core expand into braking envelopes, richer candidate scoring, and HUD timeline parity.
