# prototype-navigation-computer-obstacle-trajectory-v1

## Why
The prototype waypoint autopilot is currently a direct target and braking assistant. It does not model blocked corridors, avoidance waypoints, mass-scaled RCS trajectory correction, or a stable hold envelope at the destination. That makes it useful for happy-path waypoints but brittle for asteroid fields and heavy ship configurations.

## What
- Add navigation obstacle markers and a trajectory obstacle detector with collider SphereCast and geometric fallback paths.
- Add a trajectory planner that emits explicit phases, desired acceleration, main-throttle requests, RCS force requests, avoidance state, ETA, and failure reasons.
- Route the waypoint autopilot through the planner while keeping physical `FlightAssistRequest` output and avoiding direct Rigidbody motion writes.
- Make prototype asteroids detectable by navigation without turning them into unwanted hard gameplay blockers.
- Extend HUD, debug console, and minimap diagnostics so the Navigation Computer is visible and understandable.
- Add deterministic EditMode coverage for obstacle detection, planning, arrival/hold, fuel/authority failures, and no direct Rigidbody writes.

## Out of Scope
- Full orbital mechanics, pathfinding graph search, and multi-waypoint mission planning.
- Production UI Toolkit migration; the current IMGUI prototype surfaces are extended only where needed.
- Damage-aware or faction-aware obstacle semantics.

## Success Criteria
- Obstacles on the direct path are detected and labelled.
- A blocked direct path produces an Avoidance phase with an avoidance waypoint.
- Main thrust is not commanded into the blocked corridor.
- Clear line-of-sight returns the plan to normal target navigation.
- RCS correction requests are mass-scaled and clamped by available authority.
- Arrival is based on distance and full relative velocity, not a hard non-negative closing speed condition.
- Hold dampens residual velocity before completion.
- NoAuthority and FuelInsufficient are reported honestly and command no fake motion.
- HUD, debug console, and minimap expose compact but useful navigation diagnostics.
- Automated tests and evidence under `tests/` demonstrate the behavior.

