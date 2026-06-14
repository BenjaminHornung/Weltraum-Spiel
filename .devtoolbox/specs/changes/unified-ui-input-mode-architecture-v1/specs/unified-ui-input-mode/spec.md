# Capability: Unified UI Input Mode

## Purpose

Define a future unified UI/input mode architecture so ship flight, navigation
computer, weapon computer, system map, ship builder, test flight, surface
first-person mode, terminals/outposts, drones, inventory/cargo and debug
diagnostics do not conflict over camera, mouse, keyboard, controller, HUD or
ship/player input ownership.

This capability is planning-only in this change.

## Requirements

### Requirement: Explicit UI/Input Modes

The game shall have explicit UI/input modes for the major gameplay surfaces.

The planned top-level modes shall include:

- `ShipFlight`
- `ShipNavigationComputer`
- `ShipWeaponComputer`
- `SystemMap`
- `ShipBuilder`
- `TestFlight`
- `SurfaceFirstPerson`
- `SurfaceInteraction/Terminal`
- `DroneCommand`
- `InventoryCargo`
- `Dialogue/OutpostService`
- `DebugDiagnostics`

#### Scenario: Active mode is visible

- Given the player opens a major gameplay surface
- When the surface owns input
- Then the active mode shall be identifiable by HUD, help or state data

### Requirement: Input Ownership Per Mode

Each mode shall define ownership of camera, mouse, keyboard, controller-later
assumptions and ship/player input.

Each mode shall define:

- player goal,
- camera behavior,
- mouse behavior,
- keyboard behavior,
- controller later assumptions,
- allowed HUD panels,
- blocked HUD panels,
- whether ship physics input is active,
- whether autopilot can keep running,
- whether time can pause or slow later,
- escape/back behavior,
- transition rules,
- debug-only controls,
- screenshot/evidence expectations later.

#### Scenario: Map pan does not rotate ship

- Given `SystemMap` is active
- When the player pans or zooms the map
- Then ship camera orbit and ship physics input shall not consume that input

#### Scenario: Builder placement does not change throttle

- Given `ShipBuilder` is active
- When the player places, rotates, mirrors or searches parts
- Then ship throttle, RCS, SAS and fire controls shall not react

#### Scenario: Surface movement does not send ship RCS

- Given `SurfaceFirstPerson` is active
- When the player moves, jumps, scans or interacts
- Then the player's ship shall not receive flight/RCS input

### Requirement: Text And Modal Focus Gating

Flight, builder, surface, map and debug shortcuts shall not fire while typing or
searching in focused UI fields unless a field explicitly permits the shortcut.

#### Scenario: Cargo search owns keyboard

- Given `InventoryCargo` is open
- And the cargo search field is focused
- When the player types a key that is also a flight or builder shortcut
- Then the text field shall receive the key
- And the gameplay shortcut shall not fire

### Requirement: Player UI Does Not Require Debug Keys

Player-facing UI shall not require debug/prototype function keys for normal
gameplay actions.

`F1` shall be context-sensitive player help. `F2` through `F6` may remain
developer/prototype controls, but normal player actions shall have player-facing
equivalents when implemented.

#### Scenario: Basic player help omits debug-only controls

- Given Basic player UI is active
- When the player opens help
- Then the help shall show actions relevant to the active mode
- And it shall not require F2-F6 debug actions to complete normal tasks

### Requirement: Debug UI Is Separable

Debug UI shall be separable from player UI.

Player UI shall use readable names and actionable status. Debug UI may show raw
IDs, revisions, sample indices, vectors, internal state and prototype controls
only in diagnostic contexts.

#### Scenario: Basic mode hides debug diagnostics

- Given Basic player UI is active
- When no debug preset is enabled
- Then raw diagnostic panels, test scenario controls and internal IDs shall not
  be required for player workflow

### Requirement: HUD Layers

The UI architecture shall define HUD layers for:

- always-visible minimal status,
- context panel,
- modal panels,
- debug overlays,
- notification/toast messages,
- warning chips,
- input hint bar,
- crosshair/markers,
- map overlays,
- builder overlays,
- inventory/cargo overlays.

Modes shall declare which layers are allowed or blocked.

#### Scenario: Builder mode uses builder overlays

- Given `ShipBuilder` is active
- When the player edits a draft ship
- Then builder grid, ghost, validation and stats overlays may be visible
- And flight throttle controls and navigation planner panels shall be blocked

### Requirement: Deterministic Mode Transitions

Mode transitions shall be deterministic and testable.

Blocked transitions shall return one actionable reason.

#### Scenario: Builder entry blocked during autopilot travel

- Given the ship is in `ShipFlight`
- And waypoint autopilot travel is active
- When the player attempts to enter `ShipBuilder`
- Then the transition shall be blocked
- And the reason shall tell the player to cancel or finish autopilot before editing

#### Scenario: Escape closes nested focus first

- Given a modal panel contains a focused text field
- When the player presses Escape or Back
- Then the text field or nested panel shall close first
- And the top-level mode shall not be exited until nested focus is released

### Requirement: Autopilot And Manual Override Visibility

Autopilot engage/cancel and manual override behavior shall be visible and
consistent across relevant modes.

Camera orbit, map pan, text entry and help shall not cancel autopilot. Manual
throttle, attitude, translation, explicit cancel or incompatible mode entry may
cancel or change autopilot according to explicit mode policy.

#### Scenario: Manual throttle cancels visible autopilot

- Given autopilot is engaged in `ShipFlight`
- When the player gives manual throttle input that policy treats as override
- Then autopilot shall cancel or hand back authority deterministically
- And the HUD shall show a visible reason such as `Autopilot canceled: manual throttle`

#### Scenario: Map inspection does not cancel autopilot

- Given autopilot is engaged
- When the player opens `SystemMap` and pans or zooms
- Then autopilot shall not cancel solely because of map inspection
- And the UI shall show whether autopilot is still running

### Requirement: Planning-Only Boundary

This change shall not implement runtime code, tests, scenes, UI prefabs, assets,
input bindings, autopilot/harness changes or ship-builder runtime changes.

#### Scenario: Spec package validates

- Given the planning docs and DevToolbox spec files exist
- When `specs_validate unified-ui-input-mode-architecture-v1` runs
- Then the change shall validate without Unity tests or dotnet build
