# Proposal: Docking Approach Assist v1

## Motivation

DockingPort already calculates relative docking diagnostics and can build bounded physical soft-capture requests, but the prototype does not yet expose that as a usable player-facing docking approach assist. Players need a selectable docking target, clear approach guidance, and a physical assist path that helps with final alignment without teleporting, faking a hard lock, or claiming completed docking before stable constraints exist.

## Outcome

Turn existing DockingPort diagnostics into a small player-facing approach assist: create/select at least one docking target, show distance/speed/alignment/lateral guidance, apply a bounded physical soft-capture assist through the existing FlightAssistRequest/RCS path when eligible, and keep hard lock as an explicit placeholder unless tests prove a stable real constraint.

## Scope

- Runtime docking target selection/binding for a source port and at least one target port.
- Guidance UI built on the existing docking HUD snapshot/director.
- Bounded physical soft-capture assist routed through existing flight assist infrastructure.
- Deterministic tests for eligibility, guidance, assist activation, no teleport/velocity write assumptions, and hard-lock placeholder behavior.
- Documentation and DevToolbox test evidence.

## Non-Goals

- No teleporting or direct position/velocity snapping.
- No fake hard lock or completed docking claim.
- No hangar interior, station services, collision-safe path planner, landing gear, economy, or full station gameplay.
- No rewrite of waypoint autopilot or general target selection beyond the minimal docking v1 bridge.
