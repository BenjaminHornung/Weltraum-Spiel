# Autopilot Authoritative Flight Plan Specification

## Capability

Player waypoint autopilot must plan, display, and execute a single authoritative maneuver route.

## Requirements

### Requirement: Single Source of Truth Route

The system SHALL create a precomputed flight plan for a selected navigation target before normal autopilot route execution begins.

The system SHALL use the same flight plan for HUD route preview and runtime execution.

The system SHALL NOT let normal accelerate, coast, flip, brake, final approach, or hold sequencing be independently selected by live runtime gates when an executable flight plan is active.

### Requirement: Real Ship Data Planning Snapshot

The planning snapshot SHALL include current rigidbody pose, velocity, angular velocity, mass, center of mass, inertia, fuel, main-thrust data, RCS authority, imported functional socket mode, and environment force settings when available.

For imported Blender/GLB functional ships, the planning snapshot SHALL include imported mass descriptor and socket/nozzle-derived authority evidence when those components are present.

### Requirement: Maneuver Segment Details

Each planned maneuver segment SHALL include phase/type, absolute start time, duration, end time, command mode, burn or attitude direction, throttle or RCS force request, expected start/end state, expected delta-v, expected fuel, and tolerances.

The flight plan SHALL expose total ETA, total planned fuel, expected remaining fuel, active segment index, and executable/non-executable status.

### Requirement: Transparent GUI Debug Preview

The Navigation Planner UI SHALL show the active flight plan revision, executable status, total ETA, total planned fuel, expected remaining fuel, active maneuver, active progress, and a maneuver row list.

The route and preview lines shown in the HUD SHALL derive from the active flight plan predicted samples or route points, not from a separate heuristic preview.

### Requirement: Bounded Safety Replan/Abort

The runtime SHALL still evaluate live safety conditions: manual override, missing components, non-finite state, new obstacle/collision risk, target movement, position/velocity/attitude/fuel divergence, actuator limit, fuel starvation, and plan expiry.

When safety logic changes the route, the system SHALL expose an explicit replan or abort reason and create a new plan revision or enter safe abort damping.

### Requirement: Imported Functional Ship Regression

The test suite SHALL include a PlayMode or Unity MCP scenario that exercises the imported-functional ship path with real binder/socket/mass behavior enough to detect early flip/brake relative to the planned maneuver schedule.

## Scenarios

- Given a selected target and an executable plan, when autopilot engages, then the HUD displays maneuver rows and the executor follows the active segment.
- Given a planned prograde/coast segment, when the old live brake gate would normally trigger early, then the runtime does not enter flip/brake unless the active plan segment allows it or a visible safety replan/abort reason exists.
- Given an imported-functional ship with non-trivial mass and socket layout, when a plan is generated, then the plan records real mass/fuel/thrust/RCS evidence and predicted segment timings.
- Given a new obstacle on the planned path, when safety monitoring detects it, then the UI shows a replan/abort reason instead of silently executing a different maneuver.
