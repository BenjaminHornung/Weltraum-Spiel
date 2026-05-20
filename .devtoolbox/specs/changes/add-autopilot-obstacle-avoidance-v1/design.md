# Design: Autopilot Obstacle Avoidance v1

## Obstacle Definition

An obstacle is any non-trigger collider that can physically block or endanger the ship inside the currently planned burn, brake, or approach corridor and is included by the autopilot obstacle `LayerMask`. A collider may also carry `PrototypeNavigationObstacle` metadata for an explicit label, clearance radius, and danger radius.

Ignored objects:

- the player ship root and child colliders;
- active projectiles and projectile-owned colliders;
- trigger-only colliders;
- waypoint markers, minimap/HUD/UI/visual-only objects, and layers outside the obstacle mask;
- any collider explicitly marked as a non-obstacle through existing ownership/root filtering or by layer exclusion.

## Layers and Marking

The default v1 mask is configurable on `PrototypeWaypointAutopilot`. Because the current project only has the Unity built-in layers plus UI, v1 must work without requiring a new layer by using the mask plus local filtering. Test-environment asteroid/obstacle objects should receive real colliders and `PrototypeNavigationObstacle` metadata when they are meant to participate in avoidance. Visual-only asteroid markers remain ignored unless explicitly marked.

## Corridor Model

The autopilot computes a local corridor from the ship position, ship radius, speed, stopping distance, safety margin, and active navigation phase:

- `Accelerate`/`LongRangeBurn`: cast along the desired burn or target direction.
- `Brake`: cast along current velocity first, falling back to brake/target direction when speed is very low.
- `FinalApproach`: cast toward the target with a narrower radius and capped length.

The cast radius is ship-radius plus configurable clearance. The cast length grows with speed and stopping distance, but is clamped to avoid long, expensive queries.

## Physics Query Strategy

Use one reusable `RaycastHit[]` buffer and `Physics.SphereCastNonAlloc` or equivalent bounded non-alloc query. Do not use `SphereCastAll`, `FindObjectsByType`, or global obstacle lists in the FixedUpdate hot path. Sensor cadence is configurable and cached; high speed may shorten the interval, but v1 should normally scan around every 0.05-0.1 seconds.

## Avoidance Control

When a blocking hit is detected, the autopilot enters `ObstacleAvoidance` and records the phase it will return to. Main throttle is reduced or disabled while the corridor is unsafe. A lateral escape vector is computed from the planned corridor direction and the hit normal/geometry. The request uses existing physical paths only:

- RCS translation force through `FlightAssistRequest.forceWorld` when translation authority is available.
- attitude torque through the existing `ComputeAttitudeCommand` flow;
- short diagonal/side main-thrust assist only when the ship can align away from the obstacle and the resulting burn vector is not directed through the blocked corridor.

Avoidance never writes Rigidbody velocity or position directly and never burns straight into the obstacle to reach the waypoint.

## Brake and Final Approach Integration

Avoidance runs before normal burn/brake/final-approach commands are submitted. The previous state/phase is retained for return. During braking, the corridor uses current velocity and stopping-distance pressure so the autopilot can avoid an obstacle in the braking path instead of only checking the waypoint line. During final approach, the corridor is narrower and commands are gentler; if the target path is blocked too close to resolve, v1 must hold/abort/fail instead of forcing arrival.

## Hysteresis

Avoidance has a minimum active time and requires multiple clear frames or clear time before returning to the previous phase. The selected avoidance vector is retained briefly so that one-frame sensor flicker does not cause oscillation.

## Failure and Limitations

If the ship has no meaningful lateral authority, the obstacle remains inside danger range for too long, or the required steering direction cannot be achieved without burning into the obstacle, v1 sets a clear failure/limitation reason such as `ObstacleBlocked` or `NoAvoidanceAuthority` and transitions to `Failed`/`Aborted` according to existing autopilot semantics.

V1 is a local reactive avoidance system. It does not guarantee route completion around concave geometry, obstacle fields that require global planning, orbital transfers, or impossible high-speed intercepts. Success remains bounded by fuel, RCS authority, main-thruster authority, and ship momentum.

## Reuse Strategy

The implementation reuses `PrototypeWaypointAutopilot`, `FlightAssistRequest`, `PlayerShipController.SetExternalFlightAssistRequest`, existing RCS/main-thruster execution, and existing autopilot validation helpers. New code is limited to obstacle metadata, bounded sensor/control helpers, test-environment marking, and focused tests. No parallel flight-control pipeline is introduced.
