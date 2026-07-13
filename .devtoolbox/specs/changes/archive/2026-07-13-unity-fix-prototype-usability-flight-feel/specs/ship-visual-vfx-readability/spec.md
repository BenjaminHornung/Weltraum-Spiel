# Capability: Ship Visual VFX Readability

## Requirements

### Requirement: Module palette remains primitive-only but higher contrast

Generated prototype modules SHALL remain primitive-only while making module roles easier to distinguish.

#### Scenario: Core module roles are visually distinct

- GIVEN the generated prototype ship is visible
- WHEN the player inspects the ship in normal lighting
- THEN hull modules use a neutral or darker gray
- AND cockpit/front modules are clearly visible in red/orange
- AND fuel tanks are green and include a stripe, label, or other simple role cue when practical
- AND main thrusters use blue/orange contrast with a visible nozzle ring
- AND RCS blocks use cyan/green and are larger or more prominent
- AND gun modules use yellow/red
- AND cargo/utility modules use violet or another distinct tone
- AND damaged modules, where present, render darker and red-tinted

### Requirement: Optional module labels do not create clutter

Small module labels MAY be used for readability but SHALL not obscure the ship by default.

#### Scenario: Training/debug labels are bounded

- GIVEN module labels are enabled in Training or Full Debug mode
- WHEN the ship is visible
- THEN small labels such as COCKPIT, FUEL, MAIN, RCS, and GUN may be shown
- AND labels do not cover the whole ship or dominate the view

#### Scenario: Default labels can stay off

- GIVEN the default display mode is Minimal or Training
- WHEN module labels would hurt readability
- THEN labels may default off or only appear in Training/Debug mode

### Requirement: RCS VFX readability

RCS VFX SHALL make active nozzles visible without showing inactive thrusters.

#### Scenario: Active nozzles are visible

- GIVEN an RCS command selects nozzles
- WHEN RCS VFX is enabled
- THEN active nozzle VFX is larger or brighter enough to see in the prototype scene
- AND inactive nozzle VFX remains hidden
- AND VFX placement remains aligned with the nozzle exhaust direction

### Requirement: Main engine VFX readability

Main engine VFX SHALL clearly show commanded main thrust without remaining on when thrust is zero.

#### Scenario: Main engine flame is readable

- GIVEN main thrust is commanded
- WHEN the ship is visible
- THEN main engine VFX shows a clear orange/blue flame or plume
- AND the nozzle area is visually distinct from the hull

#### Scenario: Main engine VFX is off with no main thrust

- GIVEN Precision or Translation mode is active or main thrust is otherwise zero
- WHEN the ship is visible
- THEN main engine VFX is off or reduced to an unambiguous idle state

### Requirement: Debug vectors do not compete with engine VFX by default

Debug vectors SHALL be disabled by default or visually separated from engine/RCS VFX.

#### Scenario: Default view is not confused by debug vectors

- GIVEN the default display mode is active
- WHEN ship VFX are visible
- THEN debug vectors are off by default
- AND if vectors are enabled in diagnostics, their colors are distinct from engine and RCS VFX

### Requirement: Environment and lighting preserve readability

The ship SHALL remain readable against the generated space test environment without external assets.

#### Scenario: Materials remain visible in URP

- GIVEN the generated ship is visible under prototype lighting
- WHEN modules and VFX are inspected
- THEN module colors remain visible on the dark background
- AND lighting does not wash out the ship or hide role colors
- AND no external asset import is required

## Acceptance

- Screenshot readability identifies cockpit, fuel tank, main thruster, RCS, and gun.
- Active RCS nozzles are visible.
- Main engine VFX is visible when thrusting and off when not thrusting.
- Debug vectors are not confusing by default.
- No final art assets or external imports are introduced.
