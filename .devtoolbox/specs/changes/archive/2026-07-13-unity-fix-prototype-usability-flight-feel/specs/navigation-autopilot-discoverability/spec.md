# Capability: Navigation Autopilot Discoverability

## Requirements

### Requirement: Debug console navigation section

The runtime debug console SHALL expose a `Navigation / Autopilot` section that makes existing waypoint and autopilot behavior discoverable.

#### Scenario: Navigation buttons are available

- GIVEN the debug console is visible
- WHEN the user opens the Navigation / Autopilot section
- THEN buttons are available for Previous Target, Next Target, Toggle Autopilot, and Abort Autopilot
- AND optional buttons may select nearest target, station, or gate when those targets exist

#### Scenario: Navigation diagnostics are visible

- GIVEN a target or autopilot state exists
- WHEN the Navigation / Autopilot section is visible
- THEN it shows selected target, autopilot engaged yes/no, state, distance, closing speed, lateral speed, stopping distance, fuel available, fuel required, and arrival status
- AND it shows a clear hint if fuel is insufficient
- AND it shows a clear hint when manual override aborted autopilot

### Requirement: HUD/Navball quick actions

The flight HUD SHALL expose a compact quick-action row near or under the navball.

#### Scenario: Quick actions are available without dominating the view

- GIVEN the HUD/Navball is visible
- WHEN quick actions are drawn
- THEN small buttons are available for Prev Target, Next Target, Autopilot On/Off, Kill Momentum, Control Mode cycle, and SAS On/Off
- AND the buttons fit near or under the navball without covering central flight view

#### Scenario: HUD quick actions call existing behavior

- GIVEN waypoint targets and ship controls exist
- WHEN the user presses Prev Target or Next Target
- THEN the selected target changes through the existing waypoint/autopilot target path
- WHEN the user presses Autopilot On/Off
- THEN existing autopilot toggle behavior is invoked
- WHEN the user presses Kill Momentum, Control Mode, or SAS
- THEN those controls update their existing or newly specified runtime state

#### Scenario: Control mode state is visible near quick actions

- GIVEN the HUD/Navball quick actions are visible
- WHEN the HUD/Navball quick actions are visible
- THEN the HUD shows whether the active mode is Normal, Precision, or Translation
- AND the mode label stays compact enough to avoid dominating the view

### Requirement: Compact flight diagnostics hint

The HUD or compact diagnostics line SHALL show key next actions and current navigation state.

#### Scenario: Compact hint is visible

- GIVEN the player is flying in the prototype
- WHEN compact diagnostics are visible
- THEN the UI includes `G Autopilot | Tab/B Target | Caps Mode`
- AND it shows the current target name when one is selected
- AND it shows the current autopilot state
- AND it shows the active control mode without an `Alt Translation` dependency

### Requirement: Transient status feedback

The prototype SHOULD provide short status feedback for mode and navigation changes when practical.

#### Scenario: Status feedback on key actions

- GIVEN the player presses G, Tab, B, Caps Lock, or a matching quick action
- WHEN the action changes state
- THEN a short status message such as `Autopilot engaged`, `Autopilot aborted: manual override`, `Target: Waypoint 2`, `Mode: Precision`, or `Mode: Translation` is shown briefly
- AND the absence of this optional toast does not block the feature if the persistent HUD/debug state clearly updates

### Requirement: Manual override remains documented and visible

Autopilot SHALL remain abortable by manual flight input, and the UI SHALL explain that behavior.

#### Scenario: Manual override aborts autopilot

- GIVEN autopilot is engaged
- WHEN the player applies manual throttle, attitude, or translation input
- THEN autopilot abort behavior remains active
- AND debug/HUD diagnostics report the aborted/manual override state

### Requirement: README runtime UI parity

README documentation SHALL match runtime controls and UI affordances.

#### Scenario: README documents discoverability controls

- GIVEN implementation is complete
- WHEN README is reviewed
- THEN it documents G autopilot toggle, Tab/B target cycling, the debug console Navigation / Autopilot section, HUD quick actions, control mode labeling, Kill Momentum entry point, and manual override behavior

## Acceptance

- Autopilot is discoverable without README.
- Autopilot can be tested by button and by G.
- Target selection can be tested by button and by Tab/B.
- HUD shows what to press next, which target/autopilot state is active, and which control mode is active.
- Manual override abort behavior remains documented and visible.
