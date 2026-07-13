# Draft Spec: prototype-gravity-well-navigation-research

Status: draft only. Promote only after waypoint autopilot, arrival tuning, and docking/approach assist are usable.

## Purpose

Research how planetary gravity wells and slingshot-style navigation could later fit into the existing inertial flight, fuel, RCS, SAS, and autopilot model.

This is intentionally a research/prototype slice, not the first planet implementation.

## In Scope

- One or two simple gravity bodies represented by visible primitive spheres.
- Configurable gravity radius and strength.
- Ship acceleration affected by gravity when inside gravity influence.
- Debug overlay for gravity source, gravity acceleration, predicted influence, and current orbit-like velocity.
- Autopilot limitation notes under gravity.
- Simple slingshot test: measure speed before and after close flyby.
- Compare no-gravity waypoint navigation with gravity-influenced trajectory behavior.

## Out of Scope

- No realistic full N-body simulation.
- No procedural planets.
- No terrain.
- No atmosphere.
- No city rendering.
- No orbital map.
- No stable orbit planner.
- No multi-body route planner.
- No landing gameplay.

## Design Notes

Start with patched-conic or single-dominant-body thinking, not all bodies pulling equally at all times. For gameplay, an understandable gravity influence zone may be better than full simulation.

A future navigation planner should not be required for this slice. This spec should mainly answer whether gravity and slingshot behavior can be debugged and whether it breaks current flight/autopilot assumptions.

## Acceptance Criteria

- A gravity body can be spawned in the prototype scene.
- Ship velocity changes due to gravity when inside the configured influence.
- Gravity can be disabled to compare baseline behavior.
- Debug overlay shows current gravity acceleration and source.
- A close flyby can visibly bend the trajectory.
- A simple speed-before/speed-after slingshot diagnostic is available.
- Existing no-gravity autopilot limitations under gravity are documented.
- The implementation does not attempt full planet or orbital gameplay.

## Risks

Gravity can quickly destabilize navigation. Keep this isolated and optional so the normal prototype remains playable.
