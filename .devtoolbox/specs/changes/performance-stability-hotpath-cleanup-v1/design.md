# Design: Performance Stability Hotpath Cleanup v1

## Autopilot Planning

`PrototypeWaypointAutopilot.FixedUpdate` keeps cheap diagnostics fresh, but navigation planning is gated:

- Runs when autopilot is engaged.
- Runs when navigation debug planning is explicitly active.
- Runs immediately on `ReplanNow`.
- Uses a configurable interval, clamped to at least 0.1 seconds, to avoid planning every physics tick.

## Obstacle Registry

`PrototypeNavigationObstacle` registers in `OnEnable` and deregisters in `OnDisable`.
`PrototypeObstacleDetector` uses a reusable list copied from the registry for colliderless fallback checks. The default colliderless fallback is disabled, and tests/debug code can opt in explicitly.

## RCS Allocator Scratch

The RCS allocator reuses:

- A persistent `List<RcsAllocation>` for per-nozzle allocation data.
- A persistent `float[]` throttle scratch buffer that grows only when nozzle capacity grows.

The allocator remains main-thread only because it calls `ShipPhysicsCore.ApplyForceAtPosition`.

## VisualSwitcher Safety

Only `PrototypeShipVisualSwitcher_Manager` may strip direct `Renderer`, `Collider`, or `Rigidbody` components. Runtime discovery migrates unsafe switchers to a new manager and disables the unsafe instance instead of mutating gameplay objects.

## Evidence

The change records:

- Source guards for removed hotpath APIs.
- Focused Unity EditMode tests.
- Full Unity EditMode run.
- PlayMode smoke/profiler evidence with visual switching and 30 seconds of runtime sampling.
- CLI build/test and OpenSpec validation.
