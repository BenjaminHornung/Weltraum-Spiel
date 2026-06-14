# Tasks: Ship Builder Gameplay UX v1

This change is planning/spec-only. These tasks describe the future
implementation slices that should consume the design package.

## Phase 1 - Builder mode shell

- [ ] Add hangar terminal and debug/test entry points that open builder edit mode.
- [ ] Enforce build-allowed rules for docked/safe states, combat state, active
  assists, and current mode.
- [ ] Separate builder edit mode from test flight mode so editing never runs as
  in-flight live mutation.

## Phase 2 - Placement interaction

- [ ] Implement orbit, pan, zoom, and frame camera behavior around the build grid.
- [ ] Implement palette hover, part selection, placement ghost, valid/invalid
  preview state, and grid snap.
- [ ] Implement yaw rotation for MVP plus a data path for future pitch/roll.
- [ ] Implement mirror placement, move, delete, duplicate, undo, and redo.
- [ ] Keep multi-select and controller support out of MVP unless a later slice
  explicitly scopes them.

## Phase 3 - Palette and part metadata

- [ ] Present categories for cockpit, hull/frame, main thruster, RCS, fuel/power,
  cargo/storage, turret/weapon, and utility.
- [ ] Add search/filter behavior and part info cards with required sockets,
  stat preview, placement constraints, and future lock/cost display fields.
- [ ] Keep part gameplay stats sourced from metadata, not visual mesh details.

## Phase 4 - Validation UX

- [ ] Implement a persistent valid/warning/invalid status before test flight.
- [ ] Show player-facing messages for every blocking validation error.
- [ ] Show warnings for handling, visual, weapon, cargo, RCS, and mirror issues
  without blocking draft saves.
- [ ] Make validation rows select or frame affected modules when module-specific
  evidence exists.

## Phase 5 - Stats panel

- [ ] Expose dry mass, fuel mass, cargo capacity, loaded mass, thrust,
  acceleration, RCS authority, delta-v, burn time, turn rate, weapons, cargo
  volume, planned power/heat fields, COM/thrust offset, and validity.
- [ ] Display unavailable values as pending/unknown rather than inventing
  numbers when the draft lacks required systems.

## Phase 6 - Build, save, and test flow

- [ ] Support the loop: open builder, select cockpit/base, add modules, validate,
  save draft, test flight, return, save named variant, set active ship.
- [ ] Persist local drafts/variants through JSON or the existing blueprint path
  chosen by the implementation slice.
- [ ] Keep evidence/screenshot export as later scope.

## Phase 7 - Verification

- [ ] Verify the builder can be tested with primitive or existing blueprint
  visuals before final Blender art exists.
- [ ] Verify blocking validation errors disable test flight and explain the first
  player-actionable fix.
- [ ] Verify warnings remain visible but do not block valid test-flight entry.
