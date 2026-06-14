# Player HUD, Map, Builder, Surface Flow

Status: planning/spec-only, 2026-06-14.

This document describes how the player should move between the main UI surfaces:
ship flight HUD, navigation/map, weapon context, ship builder, test flight,
surface first-person, terminals, drone command, and cargo/inventory.

## 1. Flow Principles

- The player should always know the active mode.
- The active mode should explain the next useful action.
- One primary context panel should be emphasized at a time.
- Modal panels should close before the top-level mode changes.
- Player-facing controls should appear in the hint/help layer, not only in docs.
- Debug panels should never be the only way to complete a player task.

## 2. Core Navigation Flow

### Flight Baseline

Default view:

- minimal flight status,
- fuel/throttle/RCS/SAS,
- warning chips,
- radar/markers,
- context panel,
- input hint bar,
- context-sensitive F1 help.

The context panel chooses a primary task:

- navigation if a route/target/autopilot state is active,
- combat if a weapon target is selected,
- cargo/service if docked/landed and cargo action is selected,
- warnings if a blocking condition requires action.

### Flight To Navigation

Flow:

1. Player selects a target with quick controls or opens navigation panel.
2. Navigation Computer shows target, distance, ETA, fuel/authority, obstacle
   state and engage/cancel action.
3. Player can replan, inspect route, open map or engage/cancel autopilot.
4. Back returns to flight with target status still visible.

Rule: route planning UI can own pointer and list focus, but basic camera movement
and flight input only remain active when the planner is non-modal.

### Flight To System Map

Flow:

1. Player opens map.
2. Map owns pan, zoom, marker selection, filters and search.
3. Flight controls are gated.
4. Player sets target or closes map.
5. Flight HUD shows selected target and next autopilot action.

Map should not become a hidden debug minimap. Basic map UI needs player labels,
legend, marker states, route preview and clear back behavior.

### Flight To Weapon Computer

Flow:

1. Player selects target or opens weapon context.
2. Weapon Computer shows active target, fire status, arc/range/cooldown and
   auto-fire state.
3. Fire remains a player action; debug tuning is not required.
4. Back returns to flight.

Combat context can temporarily replace navigation context, but navigation
warnings such as autopilot blocked or fuel insufficient should still surface as
chips.

## 3. Builder Flow

### Enter Builder

Normal entry is from a hangar, shipyard, safe parked state or explicit debug test
entry. Builder entry requires:

- no active combat,
- no active waypoint autopilot travel,
- no active test flight,
- safe/docked context unless debug entry.

Flight controls, ship physics input, weapon input and autopilot commands are
disabled in builder edit mode.

### Builder Edit

Builder screen:

- top bar with ship name, dirty state, save/test/exit actions,
- part palette with categories and search,
- builder viewport with grid and ghost/selection,
- validation list,
- stats panel,
- hint bar.

Builder owns camera, mouse and keyboard. Text fields own keyboard focus when
active. Shortcuts for rotate, mirror, delete, duplicate, undo, redo and save must
not leak to flight controls.

### Test Flight

Flow:

1. Player presses Test Flight.
2. Builder validates the draft.
3. If blocking errors exist, test flight is blocked with one actionable reason.
4. If valid or warnings only, a temporary flyable draft launches.
5. Normal flight HUD appears with a test-flight banner.
6. Return to Builder restores the draft and previous builder state.

Test flight is not a save operation. Set Active is a separate player decision.

## 4. Surface Flow

### Landed Ship To Surface

Flow:

1. Ship is landed, docked or parked at a valid exit point.
2. Player exits through hatch/ramp/airlock.
3. Mode changes to `SurfaceFirstPerson`.
4. Ship flight controls are gated.
5. Suit HUD appears with crosshair, scanner, warnings and ship beacon/status.

The surface view should not show flight throttle/RCS controls as if the player
were still piloting the ship.

### Surface Interaction

Surface interaction prompt:

- object name,
- distance,
- owner/faction if known,
- action,
- required tool,
- risk/legal status when relevant.

Examples:

```text
Iron-Silicate Vein
Action: Mine
Tool: Cutter Tier 1
Owner: unclaimed
Risk: dust, low
```

```text
Corporate Cargo Port
Action: Transfer Cargo
Access: licensed
Owner: Aurelian Extraction Combine
```

### Surface To Cargo Transfer

Flow:

1. Player looks at ship cargo port, drone, crate, node or outpost storage.
2. Cargo/inventory modal opens.
3. Modal shows source, target, mass, volume, ownership, legal status and danger.
4. Transfer action produces explicit accepted/rejected result.
5. Back returns to surface context.

Cargo transfer owns text/list input. Surface movement and ship controls do not
fire while the modal is focused.

### Surface To Terminal/Outpost Service

Flow:

1. Player interacts with terminal, kiosk, service desk or cargo port.
2. Terminal owns cursor and text/list focus.
3. Tabs expose buy/sell, refuel, repair, storage, missions or permits.
4. Services show owner, legality, price, fees and reputation effects.
5. Back returns to surface or ship context.

## 5. Drone Flow

### Status Command

The player can open drone command from ship, surface, terminal or map.

Status view:

- drone roster,
- mission,
- current step,
- ETA,
- fuel,
- cargo,
- damage,
- connection,
- risk/warning.

The player can issue recall, set mission, inspect route or open map planner.

### Remote Manual Command

Remote manual mode is explicit:

1. Player selects a drone and chooses manual remote.
2. Camera/input switches to drone.
3. Player body/ship inputs are gated.
4. HUD shows `Remote Drone` and return-to-body action.
5. Back returns to drone roster, then previous player context.

Manual remote must not accidentally move the player body or active ship.

## 6. Inventory And Cargo Flow

Inventory/cargo may open from:

- ship cargo,
- suit inventory,
- drone cargo,
- outpost storage,
- terminal/service,
- future builder cost view.

Required visible fields:

- source,
- target,
- resource display name,
- quantity,
- mass,
- volume,
- owner,
- legal state,
- capacity remaining,
- transfer result.

Search and amount fields own keyboard. Flight, surface and builder shortcuts are
blocked while those fields are active.

## 7. Help And Hint Flow

`F1` should be context-sensitive:

- `ShipFlight`: flight, autopilot, camera and combat basics.
- `ShipNavigationComputer`: target, plan, engage/cancel, route detail.
- `SystemMap`: pan, zoom, select, filter, set target, back.
- `ShipBuilder`: place, rotate, mirror, delete, undo, save, test.
- `TestFlight`: fly draft, return to builder, warning summary.
- `SurfaceFirstPerson`: move, scan, interact, tools, cargo, return to ship.
- `SurfaceInteraction/Terminal`: service tabs, transfer, buy/sell, back.
- `DroneCommand`: roster, mission, recall, remote control, return.
- `InventoryCargo`: source/target, capacity, transfer, legal warnings.
- `DebugDiagnostics`: may show developer help, but never replace player help.

## 8. Evidence Matrix Later

Future screenshot/evidence matrix:

| Mode | Required evidence state |
| --- | --- |
| ShipFlight | Basic HUD, no debug panels, target selected, warning chip |
| ShipNavigationComputer | route ready, executing, blocked/no authority |
| ShipWeaponComputer | selected target, out of arc/cooldown status |
| SystemMap | selected marker, route preview, filters visible |
| ShipBuilder | valid ghost, invalid ghost, validation errors, stats |
| TestFlight | flight HUD plus test-flight return action |
| SurfaceFirstPerson | scanner/interact prompt and no ship flight controls |
| Terminal/OutpostService | buy/sell/refuel/repair/cargo result |
| DroneCommand | roster, mission status, remote manual return indicator |
| InventoryCargo | transfer success and capacity rejection |
| DebugDiagnostics | raw data visible only in debug preset |

## 9. MVP Recommendation

The first implementation should focus on the mode shell, not every final screen:

1. explicit mode enum/state,
2. input gating for keyboard/mouse focus,
3. Basic HUD context selection,
4. context-sensitive F1 help,
5. debug/player separation checks,
6. screenshot evidence for the modes that already exist.
