# browser-playable-ship-flight-v1 Design

## Current baseline

The browser mainline has target selection, route preview, stable locked route plans, telemetry serialization, and a TestBridge-gated E2E harness. The current renderer still represents the ship as a single cone mesh with a static camera. The current executor owns point-state motion and still contains shortcuts that are incompatible with playable flight: cancel/no-plan zeroing, waypoint velocity zeroing, and arrival position clamps.

## Design decisions

### Ship visual strategy

Discovery found `unity-legacy-final-2026-07:Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb`, which is browser-usable in principle. Because `unity-legacy-final-2026-07:Assets/**` is read-only and no Unity/export tooling may run, implementation should first verify whether copying this file into `apps/weltraum-browser/public/ships/` is safe and straightforward. If GLB loading or copied asset validation becomes a blocker, use a procedural low-poly ship descriptor in this v1 slice and document the GLB/parity follow-up.

The renderer must consume a descriptor/snapshot and own only visual objects. Domain truth remains in runtime/flight state.

### Flight state and controller

Extend browser-native `ShipState` instead of adding render-only ad hoc fields. Add a flight controller module that accepts a normalized command/request object and returns a new ship state plus actuator telemetry. This controller is the only path for manual controls and autopilot movement.

The browser model is intentionally approximate. It should be deterministic enough for tests, avoid Unity-specific Rigidbody or MonoBehaviour concepts, and preserve existing mass/fuel/authority owner snapshots.

### Manual input flow

Renderer/input code captures browser keyboard and mouse gestures and dispatches runtime commands/input-state updates. Runtime owns the input state and applies it in the fixed-step loop. HUD reads only telemetry.

### Camera flow

Use the Unity `SimpleFollowCamera` modes as intent only. Implement a browser camera rig in Three.js with `ChaseLocked` default, plus mode switching for `OrbitInspect`, `Side`, and `FreeInspect`. TestBridge render snapshots should expose camera mode and position/follow target for E2E assertions.

### Autopilot flow

Keep the locked `RoutePlan` and `planHash` semantics. Replace normal point-state executor shortcuts with autopilot requests into the flight controller:

- route following computes desired thrust/brake/attitude,
- controller applies acceleration/torque within simple limits,
- arrival is a predicate over actual distance/speed/envelope/hash, not a snap.

The executor may retain route invalidation/fuel/authority checks but must not call planners or replace plans during execution.

### Evidence strategy

Use unit tests for deterministic state transitions and Playwright for browser-visible movement/VFX/camera. If default Playwright Chromium fails with the known `spawn UNKNOWN` launcher issue, document the failure and the Chrome fallback pass.

## Reuse

- Reuse existing target/route/planHash/validation contracts.
- Reuse `FixedStepSimulationLoop`, but change its underlying executor/controller integration to allow drift and actuator-driven motion.
- Reuse HUD ViewModel pattern and TestBridge query gate.
- Reuse existing screenshot evidence conventions and scenario matrix where possible.

## Risks

- This is a broad cross-cutting browser change; keep implementation cohesive but review aggressively for invariant regressions.
- GLB loading can add asset and bundling risk; procedural fallback is acceptable for v1 if documented.
- Removing snap/zero shortcuts may require updating older tests that asserted exact final target equality; replacement assertions must use arrival envelope and terminal speed.
