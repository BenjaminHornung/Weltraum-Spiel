# Ship Builder Gameplay and UX

Status: planning/spec-only, 2026-06-14.

This document defines the player-facing Ship Builder MVP for Weltraum Spiel. It
connects the current blueprint prototype, the modular parts catalog, and the
future hangar flow without requiring runtime code, scenes, UI implementation, or
final Blender art in this planning slice.

## 1. Player promise

The Ship Builder should feel like a practical hangar workbench: the player can
open a local build space, pick a ship part, see exactly where it will attach,
understand why a ship can or cannot fly, inspect the handling tradeoffs, save a
variant, and immediately test it.

The MVP is not a final economy or factory system. It is the first usable loop for
turning module choices into a flyable prototype ship.

## 2. Entry points

### Hangar terminal

The normal player entry is a hangar terminal. The terminal opens builder edit
mode for the currently docked or parked ship. It should be the first polished
entry point because it gives the builder a clear fiction: the ship is in a safe
work area, not being edited mid-flight.

Expected behavior:

- The player interacts with a hangar terminal or hangar UI action.
- The current ship is parked, hidden, or represented as the editable draft.
- Flight controls, autopilot, combat, and active assists are disabled in builder
  edit mode.
- The builder opens the last edited draft when available, otherwise a starter
  cockpit/base template.
- Leaving the builder returns to the hangar or starts a test flight, depending on
  the player action.

### Debug/test entry

The debug/test entry exists for development and verification. It may be bound to
a prototype key, debug console action, or bootstrap option. It should bypass
story location requirements but still use the same builder session, validation,
stats, and test-flight path as the hangar terminal.

The debug entry is allowed to create a starter draft directly from built-in
blueprint data or metadata-only test parts. It is not a separate builder.

### Later outpost/shipyard entry

Outposts and shipyards are future entry points. They should reuse the same
builder UX while adding local rules:

- available part inventory
- faction licenses
- resource costs
- production time
- repair and refit services
- storage limits

These rules are not required for the MVP.

### Rules for when building is allowed

Building is allowed when one of these conditions is true:

- the ship is docked at a hangar or shipyard
- the ship is parked in a safe local build area
- the player enters through a debug/test path
- the current scene starts directly in a builder test setup

Building is blocked during:

- active combat
- active waypoint autopilot travel
- active test flight
- unsafe relative speed or uncontrolled movement
- modal gameplay states that own the ship, such as docking lock, scripted travel,
  or mission-critical cutscenes

The MVP can use a conservative rule: allow hangar/debug entry only when the ship
is stationary enough or explicitly spawned for builder testing.

### Edit mode vs test flight mode

Edit mode:

- edits a draft blueprint or builder document
- uses an orbit builder camera
- disables normal flight input and ship physics control
- shows grid, palette, validation, and stats
- allows saving even when the draft is invalid
- never silently changes the active ship

Test flight mode:

- validates the current draft before launch
- builds a temporary flyable ship from the draft
- uses normal flight controls and the normal flight HUD
- lets the player return to the builder with the draft preserved
- does not promote the draft to the active ship until the player saves and
  selects it

## 3. Builder camera and interaction

### Camera

The builder uses a dedicated orbit camera around the ship bounds or build grid
center. It should not reuse the normal chase camera.

MVP controls:

| Input | Builder action |
| --- | --- |
| RMB drag | Orbit around build bounds |
| MMB drag | Pan the build view |
| Mouse wheel | Zoom in/out |
| F | Frame selected part, or frame all parts when nothing is selected |
| LMB hover | Highlight hovered part or socket candidate |
| LMB click part | Select part |
| LMB empty grid | Clear selection unless a ghost is active |

Camera constraints:

- orbit target defaults to the ship bounds center
- selected part becomes the temporary frame target
- zoom should keep the full build readable from small cockpit drafts to cargo
  haulers
- helper/VFX objects should not inflate the camera bounds

### Placement preview

Selecting a part from the palette starts ghost placement. The ghost follows the
cursor on the active build plane and snaps to grid.

Ghost states:

- Valid ghost: placement can be committed.
- Invalid ghost: placement is blocked and the reason is visible in the hint or
  validation preview.
- Warning ghost: placement is allowed but may create a non-blocking warning, such
  as soft overlap or weak RCS coverage.

Use color concepts from the UI style rather than hardcoded values:

- valid: OK/green concept
- warning: amber concept
- invalid: error/red concept
- selected: accent concept

### Snap grid

The player-facing MVP snap grid is `0.5 m`, matching the modular part catalog and
Blender MCP authoring rules. Part origins, connector positions, and socket
markers should be authored on this grid.

If the existing prototype blueprint path keeps a finer internal grid for
compatibility, the player-facing builder should still default to `0.5 m` and
only expose finer movement as a later precision option.

### Rotation

MVP rotation is yaw-only in 90 degree steps. This is enough for most cockpit,
hull, cargo, main-thruster, and turret placement while keeping connector normals
and force directions understandable.

Future scope:

- pitch rotation for vertical or underside mounting
- roll rotation for asymmetric utility parts
- part-specific allowed rotation sets
- socket-normal-driven rotation suggestions

### Mirror mode

Mirror mode mirrors placement across the local X axis. It is primarily for RCS,
side tanks, armor plates, cargo racks, and utility modules.

Rules:

- mirrored placement previews both parts before commit
- invalid mirrored placement blocks the pair and explains which side failed
- if the original is on the centerline, mirror mode places only one part and
  shows a neutral note
- mirrored instances should remain independent after placement unless a future
  linked-edit mode is added

### Selection and editing

MVP editing commands:

| Action | Behavior |
| --- | --- |
| Select | Click a placed module to show outline and info |
| Move | Drag selected module on the active snap plane |
| Delete | Remove selected module |
| Duplicate | Create a ghost copy from the selected module |
| Rotate | Rotate ghost or selected module by yaw step |
| Undo | Revert last placement/edit operation |
| Redo | Reapply an undone operation |
| Cancel | Cancel ghost placement without changing the draft |

Multi-select is future scope. The MVP should avoid group transforms until single
part validation, warnings, and undo are stable.

### Keyboard and mouse controls

| Input | MVP action |
| --- | --- |
| LMB on palette card | Start ghost placement |
| LMB on grid with ghost | Place part |
| LMB on placed part | Select part |
| LMB drag selected part | Move part |
| RMB or Esc with ghost | Cancel ghost |
| Delete | Delete selected part |
| Ctrl+D | Duplicate selected part as ghost |
| R | Yaw rotate ghost or selection |
| Q/E | Move active build plane down/up when vertical levels are supported |
| M | Toggle mirror mode |
| Ctrl+Z | Undo |
| Ctrl+Y or Ctrl+Shift+Z | Redo |
| Ctrl+S | Save draft |
| F | Frame selection/all |

Text input fields own keyboard focus. When the blueprint name or search field is
focused, one-key shortcuts should not fire.

Controller support is later scope. The first controller pass should provide
palette navigation, camera orbit, part placement, rotation, and validation focus
without changing the mouse/keyboard MVP.

## 4. Part palette

The palette is the player's part inventory and build vocabulary.

### Categories

The MVP categories are:

| Category | Purpose |
| --- | --- |
| Cockpit | Required command/control module |
| Hull/frame | Structural body, connectors, armor frames |
| Main thruster | Primary forward propulsion |
| RCS | Translation and torque authority |
| Fuel/power | Fuel storage and planned power modules |
| Cargo/storage | Cargo volume, cargo mass support, storage |
| Turret/weapon | Fixed or turreted weapons |
| Utility | docking, sensors, armor plates, maintenance parts |

Category labels may be shortened in UI, but the underlying categories should stay
clear and stable.

### Search and filters

The palette should support:

- text search by part name and role
- category filter
- required-only filter for missing required ship systems
- compatible-with-selection filter as future scope
- locked/unlocked filter as future scope

### Part card

Each part card should show:

- display name
- category
- compact silhouette or primitive preview
- mass
- primary stat, such as thrust, fuel, cargo, or weapon count
- required sockets or required placement role
- warning icon when the part is missing metadata required for its role
- lock/cost placeholders only when future systems need them

### Part info panel

Selecting or hovering a part should show a detailed info card:

- description
- size and snap footprint
- allowed mount sides
- required sockets
- gameplay stats preview
- power draw if planned
- heat risk if planned
- cargo volume or cargo support if relevant
- weapon arc/muzzle requirements if relevant
- whether the part can be mirrored

The info card should make it clear when a value is planned metadata rather than
active gameplay in the MVP.

## 5. Validation UX

Validation must be visible before test flight. The player should never press
Test Flight and then discover a hidden technical error.

Validation states:

- Valid: no blocking errors.
- Warning: non-blocking issues exist; test flight remains available.
- Invalid: one or more errors block test flight.

Blocking errors disable Test Flight. Draft Save remains available so the player
can keep unfinished work.

### User-facing messages

| Issue | Severity | Player-facing message | Player action |
| --- | --- | --- | --- |
| Missing cockpit | Error | `Missing cockpit: add one cockpit so the ship can be controlled.` | Add a cockpit part |
| Missing main thruster | Error | `Missing main thruster: add at least one main engine for forward flight.` | Add a main thruster |
| Missing fuel/power | Error | `Missing fuel or power: add a fuel/power module before test flight.` | Add fuel/power |
| Missing RCS | Error | `Missing RCS: add RCS so the ship can turn and translate.` | Add RCS |
| Disconnected/floating part | Error or warning | `Floating part: <part> is not connected to the ship.` | Move or attach the part |
| Hard overlap | Error | `Parts overlap too much: <A> and <B> occupy the same space.` | Move/delete one part |
| Soft overlap | Warning | `Parts slightly intersect: <A> clips <B>. It can fly, but may look wrong.` | Adjust if desired |
| Blocked turret arc | Warning | `Blocked turret arc: <weapon> cannot aim through part of the ship.` | Move weapon or blocker |
| No muzzle marker | Error | `Weapon missing muzzle: <weapon> has no valid firing point.` | Use/fix a weapon part |
| No RCS authority in axis | Warning | `Weak RCS authority: no useful control on <axis>.` | Add or mirror RCS |
| Thrust vector too far from COM | Warning | `Off-center thrust: main engines will make the ship rotate while burning.` | Move thrusters or mass |
| Insufficient cargo support | Warning | `Cargo support low: installed cargo may exceed the ship's support rating.` | Add support/hull/cargo modules |
| Mass too high for thrust | Warning | `Low acceleration: installed thrust is weak for the loaded mass.` | Add thrust or reduce mass |
| No valid camera anchor | Warning | `No camera anchor: flight camera may frame this ship poorly.` | Add cockpit/anchor-capable part |
| Missing connector/docking socket | Warning | `Missing docking connector: this ship cannot use docking actions yet.` | Add utility connector |
| Invalid mirror placement | Error | `Mirror placement failed: mirrored <part> would overlap or disconnect.` | Move cursor or disable mirror |

Severity can be tightened by later gameplay rules. For MVP, required flight
systems, hard overlaps, invalid mirror placement, and missing functional weapon
markers are blocking errors. Handling quality, camera framing, cargo support,
turret blockage, and authority weaknesses are warnings unless they make the ship
unspawnable.

### Validation row behavior

Validation rows should be actionable:

- Click a row with module references to select/frame the affected module.
- Show the first blocking error near the disabled Test Flight button.
- Keep warnings visible after test flight so the player can iterate after flying.
- Do not expose internal exception text to the player.

## 6. Stats panel

The stats panel explains the ship's tradeoffs. It should update after edits and
show unavailable values clearly when required systems are missing.

### Required stats

| Stat | Display intent |
| --- | --- |
| Dry mass | Ship mass without fuel/cargo load |
| Fuel mass | Installed fuel capacity or current planned fuel |
| Cargo mass capacity | How much cargo mass the ship can carry |
| Total loaded mass | Dry mass + fuel + planned cargo load |
| Main thrust | Sum of installed main thrust |
| Thrust-to-mass / acceleration | Expected acceleration at loaded and dry mass |
| RCS translation authority by axis | +/-X, +/-Y, +/-Z translation strength |
| RCS torque authority by axis | Pitch, yaw, roll authority estimate |
| Delta-v estimate | Rough endurance based on fuel and thrust model |
| Fuel burn time | Full-throttle burn time estimate |
| Turn rate estimate | Handling estimate from torque authority and mass |
| Weapon count | Installed weapon/turret count and ready/blocked count |
| Cargo volume | Installed cargo volume or slots |
| Power draw if planned | Planned power demand/production summary |
| Heat risk if planned | Planned heat warning or risk band |
| COM vs thrust-axis offset | Lateral offset between center of mass and main thrust axis |
| Builder validity status | Valid, warnings, or invalid |

### Data source rule

Stats must come from gameplay metadata or blueprint data. Visual-only mesh
details, final art, decorative helper objects, VFX nodes, and marker aesthetics
must not determine gameplay stats.

The builder can use visual bounds for camera framing and selection outlines, but
not for mass, thrust, cargo, weapon damage, fuel, or RCS authority.

### Unavailable values

When the draft lacks required systems, show `--`, `missing`, or `not available`
instead of fake numbers. Examples:

- no main thruster: acceleration and delta-v unavailable
- no fuel/power: burn time unavailable
- no RCS: RCS authority unavailable
- no weapon: weapon count `0`, not an error unless weapons are required by the
  selected game mode

## 7. MVP vs future scope

### MVP

- local builder only
- simple grid snap
- simple module categories
- metadata-driven stats
- valid/invalid state before test flight
- local draft and variant save/load through JSON or the existing blueprint path
  chosen by implementation
- test flight spawn from current draft
- no economy requirement
- no multiplayer
- no final art requirement
- primitive or existing blueprint visuals allowed for verification

### Future

- resource costs
- faction licenses
- part unlocks
- damage and repair
- internal rooms
- crew
- power and heat network
- aerodynamic or planetary constraints
- landing gear
- drone bays
- production time
- controller-first builder UX
- multi-select and group transforms
- export evidence/screenshot button

## 8. Design constraints for implementation

- The builder should reuse existing blueprint and prototype variant paths where
  possible instead of creating a parallel ship format.
- Part metadata should stay additive and compatible with the modular parts
  catalog.
- Validation should be deterministic and testable without scene-only state.
- Test flight should use the same path as normal prototype ship spawning once a
  draft is valid.
- Draft save should not require validity, but active ship selection should.
- The player should always know whether a problem blocks test flight or merely
  warns about quality.
