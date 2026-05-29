# Runtime HUD/Camera Bootstrap

## Requirements

- Play Mode startup must bind the visible HUD to the active runtime ship dependencies: `ShipStats`, `PlayerShipController`, `PrototypeWaypointAutopilot`, `PrototypeMomentumAssist`, and `PrototypeWeaponComputer`.
- The HUD must not show normal flight status from a stale or unbound renderer when a valid runtime ship exists.
- Bootstrap must select a default navigation target for planner/preview display after waypoints are ensured, without engaging autopilot.
- The chase camera must frame the ship during idle/cruise and must not enter velocity/flip-derived framing at zero speed or outside real autopilot flip/brake phases.
- Existing generated/imported ship bootstrap behavior and authoritative FlightPlan execution defaults must remain intact.

## Scenarios

- Starting Play Mode shows ship status values, a navigation target, arena targets, and obstacle/radar contacts.
- A stale HUD renderer exists from scene/domain-reload state; bootstrap rebinds or disables it so the visible HUD uses live ship data.
- The imported ship visual exists and the camera remains framed on the ship while idle.
- Autopilot flip/brake camera assist remains available only during actual flip/brake autopilot phases.

## Constraints

- No direct Rigidbody position or velocity writes may be introduced.
- Do not touch unrelated dirty evidence files or `MAT_VFX_RCS.mat`.
- Keep changes scoped to prototype bootstrap, HUD, camera, and focused tests.
