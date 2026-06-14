# Spec: Ship Builder Gameplay UX

## Summary

This spec defines the player-facing Ship Builder MVP behavior for entry,
placement, validation, stats, saving, and test flight. It is planning/spec-only
and does not create runtime code, tests, scenes, UI, assets, prefabs, Blender
files, FBX files, or runtime systems.

## Scope

In scope:

- Ship Builder gameplay and UX behavior.
- MVP interaction flow and future boundaries.
- Formal requirements for validation language, stats, placement, save/test flow,
  and art-independent testability.

Out of scope:

- Runtime implementation.
- Unity tests, dotnet builds, scenes, assets, prefabs, `.unity`, `.prefab`,
  `.asset`, `.blend`, or `.fbx` files.
- Autopilot/harness changes.
- Existing ship builder runtime code changes.

## Requirements

### R1: Entry points and build eligibility

The builder shall provide a normal player entry point through a hangar terminal.
The builder shall provide a debug/test entry point for prototype iteration. The
builder shall define later outpost and shipyard entry as future scope.

The builder shall only allow editing when the ship is in an allowed build state,
such as docked, parked, safely stationary, or entered from a debug/test setup.
The builder shall not allow normal editing during combat, active autopilot travel,
active test flight, or other unsafe flight states unless a debug override is used.

### R2: Edit mode and test flight mode separation

The builder shall distinguish edit mode from test flight mode.

Edit mode shall edit a draft ship configuration with flight physics and flight
controls disabled. Test flight mode shall spawn or build a temporary flyable ship
from the current draft after validation. Test flight shall not mutate the saved
variant unless the player explicitly saves after returning to the builder.

### R3: Camera and viewport interaction

The builder shall provide an orbit camera around the build grid or ship bounds.
The camera shall support pan, zoom, and frame-selection/all behavior.

The builder shall provide part hover, selection, move, delete, duplicate, undo,
and redo interactions. The builder shall support an MVP placement flow with snap,
rotate, delete, duplicate, and undo.

The builder shall show a placement preview before commit. The preview shall show
a valid ghost state and an invalid ghost state before placement.

### R4: Snap, rotation, and mirror behavior

The builder shall use a simple visible snap grid for MVP. The player-facing
canonical snap size shall be `0.5 m` to match modular part authoring rules.

The MVP shall support yaw rotation. Pitch and roll rotation may be future scope
unless a part explicitly supports those rotations. The builder shall define
mirror mode for symmetric placement and shall explain invalid mirror placement.

Multi-select and controller support shall be future scope unless a later change
explicitly includes them.

### R5: Part palette

The builder shall present a part palette with these categories:

- cockpit
- hull/frame
- main thruster
- RCS
- fuel/power
- cargo/storage
- turret/weapon
- utility

The palette shall support search and filter behavior. The palette shall expose a
part info card with required sockets, placement constraints, and stats preview.
Locked/unlocked state and missing resource/cost state shall be planned as future
concepts, not MVP blockers.

### R6: Validation state before test flight

The builder shall present a clear valid/invalid state before test flight.

The builder shall treat blocking validation errors as test-flight blockers. The
builder shall allow draft saving even when the draft is invalid. The builder shall
show warnings separately from blocking errors.

### R7: Player-facing validation language

The builder shall explain every blocking validation error in player-facing
language. The builder shall provide clear error or warning messages for:

- missing cockpit
- missing main thruster
- missing fuel/power
- missing RCS
- disconnected/floating part
- hard overlap
- soft overlap
- blocked turret arc
- no muzzle marker
- no RCS authority in axis
- thrust vector too far from center of mass
- insufficient cargo support
- mass too high for installed thrust
- no valid camera anchor
- missing connector/docking socket
- invalid symmetry/mirror placement

When a validation issue references a specific module, selecting the validation
row should identify or frame that module where possible.

### R8: Stats panel

The builder shall expose mass, thrust, RCS, fuel, delta-v, cargo, and weapon
stats. The stats panel shall include:

- dry mass
- fuel mass
- cargo mass capacity
- total loaded mass
- main thrust
- thrust-to-mass or acceleration
- RCS translation authority by axis
- RCS torque authority by axis
- delta-v estimate
- fuel burn time
- turn rate estimate
- weapon count
- cargo volume
- power draw if planned
- heat risk if planned
- center-of-mass vs thrust-axis offset
- builder validity status

When a value cannot be known because a required system is missing, the builder
shall show an unavailable/pending state rather than a misleading numeric value.

### R9: Gameplay stats and visual details

The builder shall keep gameplay stats separate from visual-only mesh details.
Mass, thrust, fuel, cargo, weapon, RCS, power, and heat values shall come from
gameplay metadata or blueprint data. Visual mesh details, final Blender art,
helper objects, VFX markers, and decorative geometry shall not be required to
compute MVP gameplay stats.

### R10: MVP flow

The builder shall support this MVP loop:

1. Open builder.
2. Select a base or cockpit.
3. Add modules.
4. Validate.
5. Save draft.
6. Start test flight.
7. Return to builder.
8. Save named variant.
9. Set as active ship.

Evidence or screenshot export shall be documented as later scope.

### R11: MVP constraints

The MVP shall be local builder only. It shall use simple grid snap, simple module
categories, local draft/variant save/load through JSON or the existing blueprint
path selected by implementation, and test-flight spawn.

The MVP shall not require economy, multiplayer, final art, faction licenses,
resource costs, damage/repair, internal rooms, crew, power/heat networks,
aerodynamic or planetary constraints, landing gear, drone bays, or production
time.

### R12: Art-independent testability

The builder shall be testable without relying on final Blender art. Primitive
visuals, existing prototype blueprint data, or metadata-only test modules shall
be sufficient to validate the MVP flow, validation messages, stats panel, and
test-flight eligibility.

## Acceptance scenarios

### Scenario: invalid draft blocks test flight

Given the player opens the builder and removes required systems, when the draft
has no cockpit, main thruster, fuel/power, or RCS, then the builder shows blocking
errors in player-facing language and disables test flight.

### Scenario: warnings stay actionable

Given a draft has valid required systems but has soft overlap, weak RCS authority,
or a thrust-axis offset, when the player opens the validation panel, then the
builder shows warnings and still allows saving and test flight.

### Scenario: placement preview communicates validity

Given the player selects a part from the palette, when the cursor moves over a
valid snapped position, then the ghost preview appears valid. When the cursor
moves over a blocked or invalid snapped position, then the ghost preview appears
invalid and explains the reason.

### Scenario: test flight keeps the draft editable

Given a player starts a test flight from a valid unsaved draft, when the player
returns to the builder, then the same draft is available for further edits and is
not automatically promoted to a saved active ship.

### Scenario: final art is not required

Given no final Blender art has been imported for a part, when metadata and
primitive preview data exist, then the builder can still show the part, validate
required systems, compute stats, and start a test flight for valid drafts.
