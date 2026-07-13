# default

## Requirements

### Requirement: Navigation Planner popup is route-first

The player HUD Navigation Planner popup SHALL show the planned/direct route and trajectory/deceleration preview more prominently than generic contacts.

#### Scenario: Planner map prioritizes route over clutter

- GIVEN a selected navigation target and mixed radar contacts
- WHEN the Navigation Planner popup is visible
- THEN the planner map uses the shared minimap range mode
- AND generic planner contacts are capped below the compact radar budget
- AND selected navigation, selected combat, and objective contacts remain visible above lower-priority contacts.

#### Scenario: Planner popup remains readable at tested aspect ratios

- GIVEN 1280x720 and tall portrait-style viewports
- WHEN the Navigation Planner popup is laid out
- THEN map, label, range buttons, body text, and footer controls do not overlap.

### Requirement: Waypoint autopilot performs closed-loop retrograde braking

The waypoint autopilot SHALL rotate toward the retrograde brake vector and use the main thruster for deceleration after alignment without tests or runtime helpers manually setting ship rotation.

#### Scenario: Closed-loop brake uses RCS attitude and main thrust

- GIVEN an engaged waypoint autopilot on a fast approach
- WHEN autopilot, ship controller, and physics are stepped without harness rotation
- THEN the ship turns toward retrograde under actual RCS torque
- AND the main thruster is commanded only after near-retrograde alignment
- AND the applied main force opposes the current velocity.
