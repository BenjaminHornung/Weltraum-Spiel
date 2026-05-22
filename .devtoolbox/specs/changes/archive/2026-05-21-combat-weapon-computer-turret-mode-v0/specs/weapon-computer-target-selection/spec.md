# Weapon Computer Target Selection

## ADDED Requirements

### Requirement: Selectable prototype targets

The Weapon Computer SHALL discover and represent weapon targets by component or transform references, not by object names alone.

#### Scenario: Target dummy fallback target is listed

- GIVEN a scene contains a `PrototypeTargetDummy`
- WHEN the Weapon Computer refreshes available targets
- THEN the dummy appears as a selectable target
- AND its health label indicates that no health source is available
- AND it receives a stable neutral fallback health value for sorting.

#### Scenario: Damage state health is used

- GIVEN a target has one or more `PrototypeModuleDamageState` components
- WHEN the Weapon Computer builds its target adapter
- THEN current and maximum integrity are aggregated into current and maximum health
- AND the health label identifies the damage-state source.

#### Scenario: Ship-like targets remain component based

- GIVEN a target has a Rigidbody, `ShipStats`, or child module damage states
- WHEN the Weapon Computer builds its target adapter
- THEN the target remains selectable through the component hierarchy
- AND no hardcoded transform path or display name is required.

### Requirement: Multiple target selection

The Weapon Computer SHALL allow multiple available targets to be selected or deselected independently.

#### Scenario: Manual selection set updates active candidate pool

- GIVEN three available targets
- WHEN the operator selects two targets
- THEN only the selected targets are considered for active-target selection
- AND deselecting one target removes it from the active candidate pool.

#### Scenario: No selected targets is reported

- GIVEN no targets are selected
- WHEN the Weapon Computer updates status
- THEN active target is empty
- AND turret status includes `no selected target`.

### Requirement: Priority modes

The Weapon Computer SHALL support `ManualOrder`, `Nearest`, `HighestHealth`, and `LowestHealth` priority modes.

#### Scenario: Manual order preserves operator intent

- GIVEN selected targets A then B
- WHEN priority mode is `ManualOrder`
- THEN A is the active target while it remains valid.

#### Scenario: Nearest chooses closest selected target

- GIVEN two selected targets at different ranges from the ship
- WHEN priority mode is `Nearest`
- THEN the closer selected target is active.

#### Scenario: Highest health chooses highest health selected target

- GIVEN two selected targets with different adapted health values
- WHEN priority mode is `HighestHealth`
- THEN the target with the highest current health is active.

#### Scenario: Lowest health chooses lowest health selected target

- GIVEN two selected targets with different adapted health values
- WHEN priority mode is `LowestHealth`
- THEN the target with the lowest current health is active.

### Requirement: Separate Weapon Computer panel

The prototype SHALL expose Weapon Computer controls through a camera-bound IMGUI panel separate from `PrototypeFlightHud`.

#### Scenario: Panel is camera-bound by bootstrap

- GIVEN `PrototypeBootstrap.SetupMainCamera` builds the prototype camera stack
- WHEN a player ship exists
- THEN a `PrototypeWeaponComputerPanel` is attached or bound to the main camera
- AND it can show targets, selected state, priority mode, auto fire, active target, turret status, and debug weapon values without null reference errors.
