# Add Autopilot Obstacle Avoidance v1

## Motivation

`PrototypeWaypointAutopilot` can currently align, burn, brake, approach, and hold a waypoint, but it does not reason about physical obstacles in the planned flight or braking corridor. A waypoint route that intersects an asteroid, test obstacle, or large scene collider can still command forward thrust toward the blockage. That breaks the prototype's physical honesty: the ship should either avoid locally using real thrust authority or report that avoidance is not possible.

## Outcome

The waypoint autopilot gains a local, reactive obstacle-avoidance mode that:

- detects blocking colliders in the current burn, brake, or final-approach corridor with bounded physics queries;
- avoids using existing `FlightAssistRequest`, RCS translation, attitude, and main-thruster paths;
- exposes diagnostics for HUD/debug/test evidence;
- returns to the previous navigation phase only after the corridor has remained clear long enough;
- fails or aborts clearly when the ship has no practical authority to avoid the obstacle.

## Scope

This change covers the prototype waypoint autopilot, prototype obstacle metadata, test-environment obstacle marking, EditMode tests, optional PlayMode/manual evidence, and README/dev docs for v1 behavior.

## Non-Goals

- No orbital planner, A* route finder, navmesh, or global path search.
- No hidden damping, teleporting, direct `Rigidbody.velocity`/`linearVelocity` correction, or Rigidbody state reset as navigation control.
- No expensive global object inventory in the autopilot hot path.
- No guarantee that every high-speed or low-authority situation can be saved; v1 must report limitations instead of faking arrival.
