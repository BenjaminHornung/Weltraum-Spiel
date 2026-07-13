# Proposal: Ship Builder Gameplay UX v1

## Change

`ship-builder-gameplay-ux-v1`

## Problem

Weltraum Spiel already has early ship-building foundations: `PrototypeShipBlueprint`
defines data-driven module definitions and instances, the current prototype can build
flyable generated blueprint variants, and the modular-parts planning package defines
the part catalog, sockets, marker naming, and Blender MCP authoring path.

The missing piece is the player-facing design contract for the Ship Builder MVP. The
project needs one clear planning package that explains how a player enters builder
mode, selects parts, places and edits modules, understands blocking validation
errors, reviews ship statistics, saves variants, and starts a test flight.

Without that UX contract, future implementation can drift into parallel builder
models, unclear validation language, art-dependent behavior, or test-flight flows
that bypass the existing blueprint path.

## Outcome

This change creates a planning/spec-only package that defines:

- Ship Builder entry points through hangar terminal, debug/test entry, and later
  outpost or shipyard entry.
- The difference between builder edit mode and test flight mode.
- Builder camera and placement interactions, including orbit, pan, zoom, hover,
  selection, ghost preview, snap, rotation, mirror mode, delete, duplicate, move,
  undo, and redo.
- Part palette categories, search/filter behavior, part info cards, required
  sockets, stats preview, and future lock/cost concepts.
- Player-facing validation errors and warnings for required systems, connection,
  overlap, turret, RCS, thrust, cargo, camera, docking, and mirror placement issues.
- Stats panel contents for mass, thrust, acceleration, RCS authority, fuel,
  delta-v, cargo, weapons, COM/thrust offset, and validity.
- The exact MVP loop from open builder to draft save, test flight, return, named
  variant save, active ship selection, and future evidence export.
- MVP and future boundaries so economy, multiplayer, final art, damage, crew,
  power/heat networks, and production time stay out of the first implementation
  slice.

## Scope

In scope:

- `docs/spielkonzept/ship-builder-gameplay-ux.md`
- `docs/spielkonzept/ship-builder-mvp-flow.md`
- This DevToolbox change package under
  `.devtoolbox/specs/changes/ship-builder-gameplay-ux-v1/`
- Formal requirements for gameplay/UX behavior and testability.

Out of scope:

- Runtime code, tests, scenes, prefabs, assets, Blender files, FBX files, UI
  implementation, imported art, or build-system changes.
- Changes to the existing ship builder runtime code.
- Any autopilot or harness files.
- Economy, unlock, repair, crew, multiplayer, final art, and production systems.

## References

- `docs/spielkonzept/ship-builder-modular-parts.md`
- `docs/art/blender-modular-ship-parts-guidelines.md`
- `docs/art/blender-mcp-part-generation-prompts.md`
- `docs/legacy-unity/current-prototype-state-2026-06-15.md`
- `README.md`
- `.devtoolbox/specs/changes/prototype-ship-blueprint-v0/`
- `.devtoolbox/specs/changes/prototype-ship-builder-modular-parts-art-pipeline-v1/`
