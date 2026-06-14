# Ship Builder MVP Interaction Flow

Status: planning/spec-only, 2026-06-14.

This document defines the exact MVP loop for opening the Ship Builder, building a
draft, validating it, saving it, starting a test flight, returning to edit, and
promoting a named variant to the active ship.

## 1. MVP loop overview

The MVP loop is:

1. Open builder.
2. Select base or cockpit.
3. Add modules.
4. Validate.
5. Save draft.
6. Test flight.
7. Return to builder.
8. Save named variant.
9. Set as active ship.
10. Export evidence or screenshot later.

The loop is intentionally local and fast. It should let the player try a design,
feel the handling, return, adjust mass/thrust/RCS, and try again.

## 2. State model

| State | Purpose | Player can do |
| --- | --- | --- |
| Flight | Normal playable ship state | Fly, fight, navigate, dock |
| Hangar entry | Safe transition into builder | Open last draft, create copy, cancel |
| Builder edit | Build and validate draft | Place, move, rotate, mirror, delete, save |
| Test flight | Temporary flight spawned from draft | Fly the draft, then return |
| Variant management | Save/select local ships | Save named variant, set active ship |

Builder edit is not in-flight editing. Test flight is not a save operation.

## 3. Open builder

### Hangar terminal flow

1. Player approaches or selects the hangar terminal.
2. Terminal checks build eligibility:
   - ship is docked/parked or in a safe hangar context
   - no active combat state
   - no active autopilot travel
   - no active test flight
3. If allowed, the game opens builder edit mode.
4. If blocked, the terminal shows one actionable reason, such as:
   - `Cannot build during combat.`
   - `Dock or stop the ship before editing.`
   - `Finish the current test flight first.`

### Debug/test flow

1. Developer uses a debug key, console command, or bootstrap test entry.
2. Builder opens without hangar fiction requirements.
3. The same builder session, validation, stats, and test-flight path are used.
4. Debug entry should be labeled as debug/test so it does not become the player
   contract by accident.

### Later outpost/shipyard flow

Future outpost and shipyard entry should follow the hangar flow and add:

- available services
- part inventory
- resource costs
- licenses
- repair/refit limits
- production queue

These are not MVP requirements.

## 4. Initial builder state

When the builder opens, it should choose the draft source in this order:

1. last unsaved draft from the current session
2. last saved player variant
3. starter copy of a built-in scout/cockpit blueprint
4. empty draft with required-system checklist

The MVP should prefer a starter cockpit/base over a completely blank screen for
normal player entry. Debug entry may open an empty draft for validation testing.

## 5. Select base or cockpit

The first meaningful player action is selecting a cockpit or base/hull module.

Expected UI behavior:

- Palette defaults to a useful starter category, such as cockpit or hull/frame.
- Required-system checklist shows missing cockpit, main thruster, fuel/power,
  and RCS until those categories are present.
- Selecting a cockpit starts ghost placement.
- Placing the cockpit creates the first module and centers the build camera.

If the player starts with hull/frame instead, validation remains invalid until a
cockpit is added.

## 6. Add modules

Module placement loop:

1. Player selects a part card from the palette.
2. Builder shows a ghost preview at the snapped cursor position.
3. Ghost shows valid, warning, or invalid placement.
4. Player rotates or toggles mirror if needed.
5. Player clicks to place.
6. Builder updates validation and stats.
7. Ghost remains active for repeated placement, or cancels based on the chosen
   UX implementation.

Editing loop:

1. Player selects a placed module.
2. Player moves, rotates, duplicates, or deletes it.
3. Builder writes an undo step.
4. Validation and stats refresh.

The MVP must include snap, rotate, delete, duplicate, and undo. Redo is strongly
recommended because builder experimentation naturally includes repeated undo.

## 7. Validate

Validation is always visible. It should run after every edit and before test
flight.

Blocking errors:

- missing cockpit
- missing main thruster
- missing fuel/power
- missing RCS
- hard overlap
- invalid mirror placement
- missing required functional marker that makes a placed role unusable, such as
  a weapon without a muzzle marker
- disconnected/floating part when the implementation requires connected modules
  for spawning

Warnings:

- soft overlap
- blocked turret arc
- no RCS authority in one axis
- thrust vector too far from center of mass
- insufficient cargo support
- mass too high for installed thrust
- no valid camera anchor
- missing connector/docking socket
- disconnected/floating decorative or future-only part when the ship can still
  spawn safely

Warnings do not block Save Draft or Test Flight in the MVP unless a later slice
changes the severity for a specific game mode.

## 8. Save draft

Save Draft preserves the current work, including invalid ships.

Draft rules:

- Saving does not require a valid ship.
- Save should store enough data to restore module list, positions, rotations,
  mirror-created modules, name, and metadata version.
- MVP persistence can use JSON or the existing blueprint path chosen by the
  implementation slice.
- Built-in blueprints should be copied before editing.
- The UI should show dirty/unsaved state until saved.

Recommended labels:

- `Save Draft`: save unfinished work.
- `Save Variant`: save a named ship candidate.
- `Set Active`: make a saved valid variant the normal player ship.

## 9. Test flight

Test Flight is the fast handling check.

Preflight:

1. Player presses Test Flight.
2. Builder runs validation.
3. If blocking errors exist, Test Flight stays disabled or refuses with the first
   actionable error.
4. If only warnings exist, Test Flight starts and keeps warnings visible for the
   return-to-builder summary.

Launch:

1. Builder converts the draft into the current blueprint/variant path.
2. Prototype ship spawns in the test area or hangar launch lane.
3. Ship starts with safe velocity and normal flight controls.
4. Normal HUD appears.
5. Builder camera, grid, and palette hide.

During test flight:

- The player flies the temporary design.
- The ship can be reset or returned to builder through a visible action.
- Test flight should not change the saved variant automatically.

## 10. Return to builder

Return flow:

1. Player chooses Return to Builder from test flight.
2. Temporary test ship is removed, parked, or ignored based on implementation.
3. Builder edit mode reopens with the same draft.
4. Stats and validation reflect the draft, not damage or temporary flight state,
   unless a later repair/damage loop is explicitly added.
5. The player can adjust parts and test again.

The MVP does not need to preserve damage, fuel spent, or cargo state from test
flight.

## 11. Save named variant

A named variant is a player-recognizable saved ship design.

Rules:

- The player can save a named variant from the current draft.
- Invalid variants may be saved as drafts, but only valid variants can be set as
  active ship.
- Names should be player-facing and separate from sanitized file IDs.
- If a name already exists, the UI should offer overwrite or save copy.
- The variant should store its metadata version for future migration.

## 12. Set as active ship

Set Active promotes a valid saved variant to the player's normal ship.

Rules:

- Requires no blocking validation errors.
- Should show the stats summary before confirmation.
- Should not require a test flight, though test flight is recommended.
- Should update the normal spawn/load path used outside builder mode.

If the current draft has unsaved changes, Set Active should ask the player to save
or explicitly use the last saved variant.

## 13. Evidence and screenshot export later

Evidence export is future scope. The builder design should leave room for:

- screenshot from builder viewport
- screenshot from test flight
- JSON export of stats and validation
- compact test protocol for DevToolbox evidence

The MVP does not need an export button.

## 14. Screen structure

The MVP screen should contain:

- Top bar: builder title, ship name, dirty state, save/test/exit actions.
- Part palette: categories, search/filter, part cards.
- Viewport: grid, parts, ghost, selection, COM and thrust-axis gizmos.
- Stats panel: ship stats and validity status.
- Validation list: errors and warnings with actionable text.
- Hint bar: current controls and placement reason.

The screen should not rely on debug-only IMGUI windows.

## 15. MVP vs future boundary

### MVP

- local builder only
- simple grid snap
- simple module categories
- save/load JSON or existing blueprint path later
- test flight spawn
- no economy requirement
- no multiplayer
- no final art requirement
- primitive or metadata-only visual path acceptable

### Future

- resource costs
- faction licenses
- part unlocks
- damage/repair
- internal rooms
- crew
- power/heat network
- aerodynamic/planetary constraints
- landing gear
- drone bays
- production time
- controller-first workflows
- multi-select and group editing
- screenshot/evidence export

## 16. Done state for implementation

A later implementation slice is ready for MVP review when:

- the player can enter builder edit mode from hangar or debug/test entry
- part placement supports snap, yaw rotate, delete, duplicate, mirror, undo, and
  redo
- validation clearly blocks invalid test flight and explains every blocker
- stats expose mass, thrust, fuel, RCS, delta-v, cargo, weapons, and COM/thrust
  offset
- a valid draft can start test flight and return to builder
- a named valid variant can be saved and set active
- the flow works with primitive/existing blueprint visuals before final Blender
  art
