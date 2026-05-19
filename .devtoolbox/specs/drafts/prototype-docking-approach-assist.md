# Draft Spec: prototype-docking-approach-assist

Status: draft only. Promote after waypoint autopilot and navigation UI are usable.

## Purpose

Create the first precision-navigation slice for stations, hangars, and future landing/docking locations. This is not full docking yet; it is an approach assist that brings the ship to a small target volume with controlled orientation and low relative velocity.

## In Scope

- Docking/approach target primitive with position and forward/up orientation.
- Approach corridor or final approach vector.
- Autopilot mode that targets a pre-docking hold point first, then final approach point.
- Velocity limit near the docking target.
- Orientation alignment toward docking frame.
- RCS-assisted lateral correction.
- Clear success condition: inside position tolerance, below velocity tolerance, and roughly aligned.

## Out of Scope

- No actual docking clamp.
- No hangar interior.
- No landing gear.
- No station services.
- No collision-safe path planner.
- No gravity or atmosphere.

## Acceptance Criteria

- Bootstrap or a manager creates at least one docking approach target.
- Player can select the docking target.
- Approach assist moves to a hold point and then final approach.
- Ship arrives within a tighter tolerance than normal waypoint autopilot.
- Ship relative speed is low at success.
- Ship orientation roughly matches docking target orientation.
- If fuel is insufficient, approach assist warns or refuses high-speed approach.
- Debug overlay explains phase, distance, relative speed, and alignment error.

## Risks

Precision approach is sensitive to RCS and camera feel. Do not attempt final docking mechanics until this small assist is stable.
