# Capability: autopilot-obstacle-detection

## Requirements

- The waypoint autopilot must detect blocking colliders in the planned burn, brake, and final-approach corridors before submitting normal thrust commands.
- Detection must use bounded non-alloc physics queries such as `Physics.SphereCastNonAlloc` or `Physics.CapsuleCastNonAlloc` with a reusable hit buffer.
- Detection must not use `SphereCastAll`, `FindObjectsByType`, scene-wide object lists, or per-frame allocations in the hot path.
- The query direction must reflect the active phase:
  - accelerate/long-range burn uses target or burn direction;
  - brake uses current velocity or brake direction;
  - final approach uses a narrower target corridor.
- Cast length must scale with speed, stopping distance, ship radius, and safety margin, then clamp to a configured maximum.
- Cast radius must account for ship radius plus configured clearance and optional obstacle clearance metadata.
- The autopilot must ignore its own colliders, projectiles, triggers, waypoint markers, UI/HUD/minimap/visual-only objects, and layers outside the obstacle mask.

## Scenarios

- Given an obstacle collider inside the forward corridor, detection reports a blocking obstacle with distance, label/name, clearance, and hit reference.
- Given an obstacle just outside the corridor radius, detection remains clear.
- Given a trigger, projectile, or own-ship child collider in the query path, detection ignores it and continues evaluating other hits.
- Given several hits, detection chooses the nearest valid obstacle.
