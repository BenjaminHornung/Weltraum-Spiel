# Runtime HUD/Camera Bootstrap Regression Fix

## Problem

The default Play Mode view can enter a broken-looking state where the ship and authored gameplay objects are not framed correctly and the player-facing HUD reports missing runtime dependencies (`Fuel n/a`, `Assist n/a`, `Weapon n/a`, and no navigation target). Bootstrap diagnostics indicate that the imported functional ship is still spawned, so the failure is most likely a runtime binding/framing regression rather than a total spawn failure.

## Outcome

Starting Play Mode with the prototype scene must show the imported ship, arena targets, obstacle contacts, and bound HUD values. The player should see a selected navigation target for planning without the autopilot engaging automatically.

## Scope

- Harden bootstrap/HUD binding so stale or duplicate UI instances cannot present unbound data.
- Ensure the default waypoint target is selected for preview/planner display after bootstrap.
- Guard the dirty chase-camera flip-assist behavior so it cannot frame away from the ship during idle/cruise.
- Add targeted runtime regression tests and evidence for the default game start.

## Non-goals

- Do not revert the authoritative FlightPlan executor architecture.
- Do not redesign the HUD layout.
- Do not add new obstacle types or new gameplay systems.
