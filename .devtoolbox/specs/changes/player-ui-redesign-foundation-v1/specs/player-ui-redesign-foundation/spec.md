# Capability: Player UI Redesign Foundation

## Summary

The project shall define player-facing UI foundations for flight, navigation,
map, surface, builder and debug separation.

This spec is planning-only for the current setup task and does not authorize UI
runtime, scene, prefab or asset edits by itself.

## ADDED Requirements

### Requirement: Active mode is visible

The player UI shall make the active player mode visible.

#### Scenario: Player changes context

- GIVEN the player changes between ship flight, navigation, map, surface,
  builder or debug contexts
- WHEN the player-facing UI updates
- THEN the active mode is visible
- AND the UI does not rely on a debug-only panel to communicate it.

### Requirement: Next player action is visible

The UI shall expose a clear next action for the current context.

#### Scenario: Navigation is active

- GIVEN the player is in a navigation context
- WHEN a route or target is available
- THEN the UI presents the next useful navigation action
- AND avoids exposing planner internals as the primary player instruction.

### Requirement: UI uses ViewModels and Commands

Player UI shall communicate through ViewModels and Commands rather than direct
access to planner internals.

#### Scenario: Autopilot status is displayed

- GIVEN autopilot or navigation status changes
- WHEN the player UI displays that status
- THEN the UI consumes a presentation contract
- AND does not couple directly to core planner state.

### Requirement: Debug UI is separable

Debug-only UI shall be separable from player-facing UI.

#### Scenario: Debug overlay is hidden

- GIVEN debug UI is disabled
- WHEN the player performs a normal ship flight or navigation task
- THEN the required player task information remains available.

### Requirement: Visible UI changes require evidence

Future visible UI implementation slices shall include screenshot evidence for
common aspect ratios or documented target views.

#### Scenario: UI implementation lands later

- GIVEN a future task changes visible player UI
- WHEN the task claims completion
- THEN screenshot evidence is stored under the relevant DevToolbox change
- AND any known visual limitations are documented.
