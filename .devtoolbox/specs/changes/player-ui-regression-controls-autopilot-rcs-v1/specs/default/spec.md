# default

## Requirements

### Requirement: Basic player view avoids legacy weapon UI

In Basic player view, function-key routing SHALL NOT open the legacy IMGUI `PrototypeWeaponComputerPanel`.

#### Scenario: Basic F7 is player HUD owned

- GIVEN `PrototypeUiLayoutManager.CurrentPreset` is `Basic`
- WHEN F7 is used
- THEN the legacy weapon computer window is not toggled
- AND the player HUD combat computer can present uGUI controls.

### Requirement: Player HUD exposes navigation and combat popups

The player HUD SHALL provide uGUI navigation and combat computer popups that reuse the existing autopilot and weapon computer APIs.

#### Scenario: Navigation planner controls target and autopilot

- GIVEN a selected waypoint target and an available autopilot
- WHEN the navigation planner is opened
- THEN it shows selected target, distance, route/preview/avoidance status
- AND its controls can select targets, engage/abort autopilot, replan, and toggle trajectory preview.

#### Scenario: Combat computer controls weapon targeting

- GIVEN weapon targets are available
- WHEN the combat computer is opened
- THEN it shows active target, health, range, fire status, autofire, and priority
- AND its controls can cycle targets, clear target, toggle autofire, and cycle priority.

### Requirement: Player HUD minimap renders live markers

The player HUD minimap SHALL visibly render player-facing grid, route, preview, and target marker cues in the real game HUD.

#### Scenario: Runtime minimap screenshot contains player markers

- GIVEN a selected navigation target and generated arena/test-environment targets
- WHEN the player HUD is captured at 1280x720
- THEN the radar panel is visible
- AND the minimap layer has active grid and marker elements
- AND the saved screenshot contains marker pixels inside the radar panel.

### Requirement: Kill Momentum is keyboard reachable

Kill Momentum SHALL be available through a player keybind in addition to the HUD button.

#### Scenario: Keybind invokes the same assist action

- GIVEN Momentum Assist is available
- WHEN the Kill Momentum keybind is pressed while idle
- THEN the assist activates through the same path as the HUD button.

### Requirement: Assist braking can use main thrust

Momentum Assist and waypoint autopilot SHALL be allowed to request main throttle while they own an external assist request, even when manual control mode would otherwise disable main thrust.

#### Scenario: Momentum Assist brakes in Translation mode

- GIVEN the ship is in Translation mode with velocity aligned for retrograde main braking
- WHEN Kill Momentum is active
- THEN the assist requests main brake throttle
- AND the ship controller accepts the assist-owned main throttle command.

### Requirement: RCS VFX exhaust points away from force direction

RCS exhaust visuals SHALL be behind each nozzle and oriented opposite the nozzle force direction.

#### Scenario: Imported and generated nozzles bind opposite exhaust

- GIVEN generated or imported RCS nozzle VFX is bound
- WHEN the VFX transform is inspected
- THEN its local position is behind the nozzle
- AND its forward direction is opposite the nozzle forward force direction.
