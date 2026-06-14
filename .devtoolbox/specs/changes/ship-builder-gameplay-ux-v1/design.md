# Design: Ship Builder Gameplay UX v1

## Change

`ship-builder-gameplay-ux-v1`

This is a planning/spec-only change. It defines player flow, UX behavior,
validation language, stats presentation, and MVP boundaries for a later Ship
Builder implementation.

## Existing foundations to reuse

- The `prototype-ship-blueprint-v0` package already identifies the reusable
  data path: blueprint definitions and instances, validation, stats aggregation,
  and conversion into flyable prototype variants.
- The current prototype state documents generated blueprint samples and a
  fallback primitive visualization path. The Ship Builder MVP must remain
  testable through that path and must not depend on final Blender art.
- The modular-parts art pipeline defines the part grammar: `+Z` forward, `+Y`
  up, `+X` right, `0.5 m` snap alignment, functional `SOCKET_` markers,
  collider proxies, and no root or zero-vector fallback.
- The player HUD is already the default gameplay UI surface; the builder should
  behave like a separate hangar/editor mode rather than another debug overlay.

## Key UX decisions

### Entry and mode separation

The MVP should expose a normal player entry through a hangar terminal and a
debug/test entry for development. Later outpost and shipyard entries reuse the
same builder mode but add location, faction, cost, or unlock rules.

Builder edit mode edits a draft blueprint with physics and flight input disabled.
Test flight mode builds a flyable ship from the current draft, starts normal
flight controls, and keeps the builder draft available for return and iteration.

### Snap and placement model

The player-facing MVP uses a `0.5 m` snap grid so placement matches the modular
parts catalog and Blender MCP authoring rules. If existing prototype code keeps a
finer internal grid for compatibility, the builder should still present `0.5 m`
as the default visible snap and treat finer offsets as legacy/future support.

Rotation should be yaw-only in the first MVP unless a part explicitly permits
pitch or roll. This keeps connector normals, turret arcs, main-thrust direction,
and RCS authority readable. The UX docs still define pitch/roll as later scope
so future parts are not boxed in.

### Validation model

Validation has three visible states:

- `Valid`: no blocking errors; test flight is enabled.
- `Warning`: the ship can fly but the builder explains likely handling, visual,
  cargo, or weapon problems.
- `Invalid`: one or more blocking errors prevent test flight until fixed.

Every blocking error must be shown in player-facing language. Error rows should
select or frame the affected module where possible. Warnings should remain
visible but must not block saving drafts or test flight unless a later gameplay
rule explicitly promotes them to errors.

### Stats and gameplay data

Gameplay stats come from blueprint/module metadata, not from visual mesh details.
Meshes, marker empties, VFX helpers, and final art are allowed to improve
presentation but may not become hidden sources of mass, thrust, cargo, weapons,
or fuel. This keeps the MVP testable with primitives and avoids art-dependent
gameplay behavior.

### Save and variant model

The MVP distinguishes:

- `Draft`: current editable blueprint, may be invalid and unsaved.
- `Saved variant`: named local blueprint persisted through JSON or the existing
  blueprint path selected by the implementation slice.
- `Active ship`: saved valid variant selected for normal gameplay spawn.
- `Test flight instance`: temporary spawned ship built from the draft for
  handling checks.

Saving a draft should be allowed even when invalid. Setting as active ship and
starting test flight require a valid builder state.

## Interaction design summary

- Camera: orbit around build bounds, pan, zoom, frame selection/all.
- Placement: palette click creates ghost, ghost snaps to grid, valid/invalid
  color communicates placement state before commit.
- Editing: select, move, rotate, delete, duplicate, mirror placement, undo,
  redo, cancel ghost.
- Palette: categories for cockpit, hull/frame, main thruster, RCS, fuel/power,
  cargo/storage, turret/weapon, and utility; search/filter; part cards with
  requirements and stat preview.
- Stats: mass, thrust, acceleration, RCS authority, fuel, delta-v, cargo, weapon,
  power/heat planning fields, COM/thrust offset, and builder validity.
- Test flow: open builder, build draft, validate, save draft, test fly, return,
  save named variant, set active ship.

## MVP boundaries

The MVP is local, single-player, snap-based, metadata-driven, and testable without
final art. It does not require economy, multiplayer, faction licenses, production
time, damage/repair, internal rooms, crew, power/heat networks, landing gear,
drone bays, or aerodynamic/planetary constraints.

## Risks and mitigations

- Risk: future implementation may rely on mesh bounds or final Blender markers
  for gameplay stats. Mitigation: spec requires gameplay stats to come from
  metadata and stay primitive-testable.
- Risk: validation becomes cryptic or debug-only. Mitigation: spec requires
  player-facing messages for every blocking validation error.
- Risk: builder entry becomes a debug UI only. Mitigation: design separates
  hangar terminal entry from debug/test entry.
- Risk: existing blueprint v0 grid assumptions conflict with modular part
  planning. Mitigation: use `0.5 m` as player-facing canonical snap and call out
  legacy finer snap as compatibility only.
- Risk: too many future systems creep into MVP. Mitigation: docs keep an explicit
  MVP vs future split.
