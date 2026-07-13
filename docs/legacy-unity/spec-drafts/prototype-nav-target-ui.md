# Draft Spec: prototype-nav-target-ui

Status: draft only. Promote after waypoint autopilot behavior is stable enough to expose to the player.

## Purpose

Add simple HUD/readout support for selected navigation targets. A realistic inertial flight model needs readable relative navigation data so the player understands what the autopilot and ship are doing.

## In Scope

- Selected target marker on screen.
- Distance to selected target.
- Relative velocity and closing speed.
- Autopilot state display.
- Fuel feasibility warning display.
- Arrival radius indicator or textual tolerance.
- Off-screen target arrow if simple.
- Minimal UI only; IMGUI is acceptable if consistent with current debug style.

## Out of Scope

- No full map.
- No orbital map.
- No route planning UI.
- No polished cockpit HUD.
- No minimap.
- No mission UI.

## Acceptance Criteria

- Player can identify the selected waypoint without using the hierarchy.
- HUD shows distance and relative speed.
- HUD shows autopilot enabled/disabled and current phase.
- HUD shows insufficient-fuel or unsafe-arrival warning when the autopilot exposes one.
- UI does not obscure core debug values.
- Existing manual flight and weapon controls remain usable.

## Risks

UI polish can expand quickly. Keep this as a navigation readability slice, not a final HUD system.
