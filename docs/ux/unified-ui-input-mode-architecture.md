# Unified UI And Input Mode Architecture

Status: planning/spec-only, 2026-06-14.

This document defines a future unified UI and input mode architecture for ship
flight, navigation computer, map, weapon computer, ship builder, test flight,
surface first-person play, drones, outposts, inventory/cargo, and debug
diagnostics.

It does not implement code, tests, scenes, UI prefabs, assets, runtime systems,
or input bindings.

## 1. Goal

Weltraum now has enough gameplay surfaces that implicit controls will collide:
flight input, map pan, builder placement, first-person movement, drone command,
inventory search, terminal text fields, weapon control, and debug panels all want
keyboard and mouse ownership.

The goal is one explicit mode policy:

- every active gameplay surface declares who owns camera, mouse, keyboard, and
  ship/player input,
- player UI does not require debug function keys,
- debug UI is separable from player UI,
- autopilot and manual override behavior is visible and consistent,
- mode transitions are deterministic and later testable.

## 2. Source Context

Current prototype facts that shape this plan:

- Basic uGUI HUD is the default player-facing surface.
- Legacy IMGUI windows remain diagnostics, not default player UI.
- `F1` is player-facing help in Basic mode.
- `F2` through `F6` are prototype/developer controls.
- Current ship flight has Cruise, Precision, and Translation control behavior.
- Navigation Computer and Weapon Computer already expose player-facing compact
  status plus deeper debug details.
- Ship Builder planning expects edit mode to disable flight, autopilot, combat,
  and active assists.
- Surface first-person planning says surface controls must not reuse ship
  controls blindly.
- Drone planning says drones may be manually remote-controlled, assisted, or
  autonomous while the player remains elsewhere.
- Outpost planning treats terminals as service interfaces for trade, storage,
  repair, refuel, cargo and missions.

## 3. Mode Ownership Rule

At any moment one top-level UI/input mode owns primary input. A top-level mode
may contain submodes, but only the active owner can consume raw gameplay input.

Mode ownership covers:

- camera behavior,
- mouse behavior,
- keyboard behavior,
- text focus behavior,
- controller focus later,
- ship physics input,
- player body input,
- autopilot command policy,
- HUD panel visibility,
- Escape/Back behavior.

When a modal panel is active, it can temporarily own mouse and keyboard while the
parent mode remains the gameplay context. Example: `ShipFlight` remains the
context, but `InventoryCargo` owns keyboard while a cargo search field is active.

## 4. Top-Level Modes

### ShipFlight

Player goal: fly, maneuver, fight lightly, track status, and decide the next
action.

Camera behavior:

- chase/orbit/side/free inspection camera around the active ship,
- camera does not become map or builder camera,
- right mouse and wheel control look/zoom when no modal owns pointer.

Mouse behavior:

- camera look/orbit and targeting hover where supported,
- no UI text typing unless a panel captures focus.

Keyboard behavior:

- flight, throttle, RCS, SAS, target cycling, fire, camera, autopilot action,
  and Basic help,
- one-key gameplay controls are blocked when a text field or modal owns focus.

Controller later:

- sticks/triggers/buttons map to flight, camera, fire, RCS/SAS, help and mode
  entry,
- modal focus must suspend flight axes.

Allowed HUD panels:

- always-visible minimal flight status,
- warning chips,
- navigation compact context,
- weapon compact context,
- radar/markers,
- input hint bar,
- notifications.

Blocked HUD panels:

- builder palette and grid,
- full system map interaction,
- surface helmet-only panels,
- terminal/shop modal unless explicitly opened,
- debug diagnostics unless debug mode/preset is active.

Ship physics input active: yes.

Autopilot can keep running: yes, unless manual override cancels it.

Time pause/slow later: no by default.

Escape/Back:

- closes modal panels first,
- otherwise opens pause/system menu later,
- does not silently cancel autopilot unless the visible action says so.

Mode transitions:

- to `ShipNavigationComputer` through nav panel/map/planner command,
- to `ShipWeaponComputer` through combat panel/weapon command,
- to `SystemMap` through map command,
- to `ShipBuilder` only when docked/parked/safe or via debug entry,
- to `SurfaceFirstPerson` only after landed/docked exit flow,
- to `DebugDiagnostics` through debug-only controls.

Debug-only controls:

- raw overlays, debug console, generated ship visual cycling, refuel/reset.

Screenshot/evidence later:

- Basic HUD, no target, target selected, autopilot active, warning state,
  combat target selected, debug overlay hidden.

### ShipNavigationComputer

Player goal: inspect route, choose target, plan/replan, engage/cancel autopilot,
and understand arrival/fuel/obstacle state.

Camera behavior:

- may use ship camera with planner panel or a focused route preview layer,
- does not take full map pan unless transitioning to `SystemMap`.

Mouse behavior:

- clicks planner controls, target rows, route details, timeline and tooltips,
- right mouse camera orbit only when not over interactive planner UI.

Keyboard behavior:

- planner hotkeys can select target, replan, engage/cancel, close,
- flight axes are gated while planner text/search/list focus is active.

Controller later:

- d-pad/shoulders navigate targets and planner sections,
- confirm engages/cancels only through focused action.

Allowed HUD panels:

- minimal ship status,
- navigation planner,
- route timeline,
- compact map/radar route preview,
- warnings and input hints.

Blocked HUD panels:

- builder tools,
- surface interaction prompts,
- terminal service UI,
- debug-only raw plan fields in Basic.

Ship physics input active:

- yes when planner is non-modal,
- no for modal route target search or confirmation overlays.

Autopilot can keep running: yes.

Time pause/slow later:

- optional slow/pause for full planner modal, but not required.

Escape/Back:

- closes detail panes first,
- returns to `ShipFlight`.

Mode transitions:

- from `ShipFlight`,
- to `SystemMap` for full target selection,
- back to `ShipFlight` after engage/cancel/close.

Debug-only controls:

- plan revision, sample indices, vector diagnostics, candidate scores and raw
  replan reasons in debug presets.

Screenshot/evidence later:

- no target, route ready, executing, replanning, obstacle warning, insufficient
  fuel/no authority.

### ShipWeaponComputer

Player goal: select targets, inspect weapon status, understand turret authority,
and manage auto fire without hidden debug UI.

Camera behavior:

- remains ship/combat camera,
- may add target focus marker or soft target framing later.

Mouse behavior:

- select target rows or world markers,
- does not rotate ship while pointer is over the weapon panel.

Keyboard behavior:

- fire, target cycle, auto-fire toggle, close,
- blocked while typing/filtering target list.

Controller later:

- cycle targets, confirm priority, fire, cancel.

Allowed HUD panels:

- combat context panel,
- target marker/crosshair,
- ammo/heat/weapon status,
- warning chips,
- minimal navigation status.

Blocked HUD panels:

- builder palette/grid,
- surface terminal UI,
- raw weapon debug tuning in Basic.

Ship physics input active: yes unless a modal list/filter captures input.

Autopilot can keep running:

- yes if allowed by combat policy,
- manual flight/fire may trigger manual override if defined by the active assist.

Time pause/slow later: no by default.

Escape/Back: close weapon panel or return to `ShipFlight`.

Mode transitions:

- from `ShipFlight`,
- can coexist as context panel while flight remains active,
- returns to `ShipFlight`.

Debug-only controls:

- recoil tuning, hit chance internals, raw muzzle/arc diagnostics.

Screenshot/evidence later:

- no target, selected target, out of arc, cooldown, no muzzle/no authority,
  auto fire active.

### SystemMap

Player goal: inspect the system/local map, pan/zoom, choose targets, review
routes, discover outposts, and set navigation goals.

Camera behavior:

- map camera owns view,
- ship camera and right-mouse orbit are suspended.

Mouse behavior:

- pan, zoom, select markers, drag map, inspect routes, choose destination.

Keyboard behavior:

- map shortcuts, search, filters, back,
- flight controls are blocked.

Controller later:

- map cursor, zoom, marker focus, filter tabs, confirm/back.

Allowed HUD panels:

- map overlays,
- route details,
- legend/filter panels,
- target details,
- input hint bar,
- minimal ship status strip.

Blocked HUD panels:

- ship flight context panels except compact status,
- builder palette,
- first-person crosshair,
- debug overlays in Basic.

Ship physics input active: no direct manual input.

Autopilot can keep running:

- yes if the map is non-paused and safe,
- route changes require explicit confirmation.

Time pause/slow later:

- may pause/slow in singleplayer for strategic view,
- must not hide whether autopilot keeps simulating.

Escape/Back:

- closes selected marker/search/filter first,
- then returns to previous mode, usually `ShipFlight`.

Mode transitions:

- `Flight -> Map -> Set target -> Flight`,
- map may launch navigation planner,
- future outpost marker can open service preview after docking/landing.

Debug-only controls:

- raw object IDs, prediction sample indices, nav mesh/trajectory internals.

Screenshot/evidence later:

- marker selection, route preview, filter state, off-screen target, no debug
  overlays in Basic.

### ShipBuilder

Player goal: edit a draft ship, place parts, validate, inspect stats, save, and
start test flight.

Camera behavior:

- dedicated builder orbit/pan/zoom camera around build bounds or selected part,
- not chase camera.

Mouse behavior:

- palette selection, ghost placement, selection, drag, rotate, pan, zoom,
  tooltips.

Keyboard behavior:

- builder shortcuts for placement, rotate, mirror, delete, duplicate, undo,
  redo, save, test, search,
- ship throttle, RCS, SAS, fire and autopilot shortcuts are blocked.

Controller later:

- palette focus, orbit, place, rotate, mirror, undo, validation focus.

Allowed HUD panels:

- builder top bar,
- part palette,
- viewport grid,
- ghost/selection,
- validation list,
- stats panel,
- input hint bar.

Blocked HUD panels:

- flight throttle/RCS controls except optional ship summary,
- navigation planner,
- weapon computer,
- surface prompts,
- debug panels unless debug builder entry is active.

Ship physics input active: no.

Autopilot can keep running: no. Builder entry requires safe/docked state or debug.

Time pause/slow later: yes, builder should be paused/safe.

Escape/Back:

- cancel ghost first,
- close modal or search focus,
- ask to save/discard when leaving dirty draft,
- return to hangar/previous safe mode.

Mode transitions:

- `Flight -> ShipBuilder` only when eligible,
- `ShipBuilder -> TestFlight`,
- `TestFlight -> ShipBuilder`,
- `ShipBuilder -> Flight` after save/exit.

Debug-only controls:

- spawn debug starter draft, validation stress data, raw socket/metadata display.

Screenshot/evidence later:

- empty starter, valid ghost, invalid ghost, validation errors, stats, test
  flight launch prompt.

### TestFlight

Player goal: fly a temporary draft ship to feel handling, then return to builder
or save.

Camera behavior:

- normal ship flight camera on temporary draft.

Mouse behavior:

- same as `ShipFlight`.

Keyboard behavior:

- same as `ShipFlight` plus visible return-to-builder action,
- builder shortcuts blocked until returning.

Controller later:

- same as flight plus return action.

Allowed HUD panels:

- flight status,
- test-flight banner,
- draft warnings summary,
- return/save prompts,
- warning chips.

Blocked HUD panels:

- builder grid/palette while flying,
- normal story/economy mission UI unless explicitly testing.

Ship physics input active: yes.

Autopilot can keep running:

- only if test flight explicitly supports it,
- default MVP can keep it off or require manual action.

Time pause/slow later: no by default.

Escape/Back:

- open return/save/cancel menu, not immediate delete.

Mode transitions:

- from `ShipBuilder`,
- back to `ShipBuilder`,
- to `ShipFlight` only after saving/selecting active variant.

Debug-only controls:

- reset draft ship, spawn stress obstacles, show raw mass/COM/RCS stats.

Screenshot/evidence later:

- temporary ship in flight, return prompt, warning summary, Basic HUD.

### SurfaceFirstPerson

Player goal: walk, scan, mine, fight, interact, transfer cargo, and return to
ship/outpost.

Camera behavior:

- first-person body/suit camera,
- ship chase/orbit camera suspended.

Mouse behavior:

- look/aim/interact,
- cursor captured until a terminal, inventory, map or modal is open.

Keyboard behavior:

- movement, sprint/crouch/jump, interact, scanner, tool/weapon slots, cargo
  action, beacon/return command,
- ship throttle/RCS/SAS/fire controls blocked.

Controller later:

- standard first-person movement/look, interact, scanner, tool select.

Allowed HUD panels:

- suit minimal status,
- crosshair/interaction prompt,
- scanner overlay,
- warning chips,
- input hint bar,
- compact ship beacon/status,
- surface markers.

Blocked HUD panels:

- ship flight throttle panel,
- builder grid,
- debug flight overlays,
- full map unless map mode is opened.

Ship physics input active: no direct ship input.

Autopilot can keep running:

- parked/landed ship autopilot normally inactive,
- drones/autonomous missions may continue,
- ship recall/autopilot later must be explicit and visible.

Time pause/slow later:

- no by default during real-time surface play,
- terminals/dialogue may pause in singleplayer.

Escape/Back:

- closes modal first,
- otherwise opens pause/suit menu.

Mode transitions:

- from landed/docked ship,
- to `SurfaceInteraction/Terminal`,
- to `DroneCommand`,
- to `InventoryCargo`,
- back to ship/cockpit/flight through safe entry.

Debug-only controls:

- surface debug overlay, spawn node, teleport, hazard toggles.

Screenshot/evidence later:

- scanner prompt, mining/cargo prompt, outpost approach, warning, no flight UI.

### SurfaceInteraction/Terminal

Player goal: operate terminals, outpost services, cargo ports, repair/refuel,
mission boards, doors, data cores and service screens.

Camera behavior:

- can keep first-person view blurred/locked or switch to terminal UI camera,
- surface look is suspended while terminal owns cursor.

Mouse behavior:

- UI pointer for buttons, lists, search, trade, cargo transfer.

Keyboard behavior:

- text/search/list navigation,
- surface movement and ship controls blocked.

Controller later:

- focus navigation, confirm/back, tabs.

Allowed HUD panels:

- terminal modal,
- service tabs,
- cargo/inventory overlay,
- minimal safety/status strip,
- warnings and ownership/legal status.

Blocked HUD panels:

- flight controls,
- builder tools,
- combat target panels unless terminal is weapon station later,
- debug raw IDs in Basic.

Ship physics input active: no.

Autopilot can keep running:

- surface/drones may continue unless terminal is modal pause in singleplayer,
- visible status must say whether time is paused.

Time pause/slow later:

- may pause for dialogue/service in singleplayer.

Escape/Back:

- backs out of tab/detail/search,
- then returns to `SurfaceFirstPerson` or `ShipFlight` depending entry.

Mode transitions:

- `SurfaceFirstPerson -> Terminal -> SurfaceFirstPerson`,
- `Flight/Landed -> Terminal -> Flight`,
- can open `InventoryCargo`.

Debug-only controls:

- raw service IDs, force transaction, stock refill, faction state override.

Screenshot/evidence later:

- buy/sell/refuel/repair/cargo transfer with player names and no raw debug IDs.

### DroneCommand

Player goal: monitor drones, issue missions, remote-control a drone, recall,
inspect risk and cargo, and return to the previous body/ship context.

Camera behavior:

- status-only command can keep current camera,
- remote manual command can switch to drone camera,
- previous camera is restored on exit.

Mouse behavior:

- UI selection and mission map,
- drone camera look if manually remote-controlling.

Keyboard behavior:

- command list/mission controls,
- remote manual drone controls only when `DroneCommand` explicitly owns input,
- player/ship body movement blocked or reduced while remote manual control is
  active.

Controller later:

- list focus, mission confirm/back, manual drone flight profile.

Allowed HUD panels:

- drone roster,
- mission queue,
- drone status,
- risk warnings,
- cargo/fuel/damage,
- map/route preview,
- return-to-body indicator.

Blocked HUD panels:

- normal ship flight inputs when remote drone owns control,
- builder tools,
- terminal trade unless drone is at a service terminal.

Ship physics input active:

- player ship no, unless command is status-only overlay,
- selected drone yes only for manual remote mode.

Autopilot can keep running:

- yes for player ship or drones, but manual remote control rules must be visible.

Time pause/slow later:

- command UI may pause if only local planning,
- drone missions continue if explicitly unpaused.

Escape/Back:

- exits remote control to command roster,
- then returns to previous context.

Mode transitions:

- `SurfaceFirstPerson -> DroneCommand -> SurfaceFirstPerson`,
- `ShipFlight -> DroneCommand -> ShipFlight`,
- can open `SystemMap` mission planner.

Debug-only controls:

- raw mission step IDs, warp factor internals, risk policy overrides.

Screenshot/evidence later:

- roster, mission queued, remote manual, warning/needs attention.

### InventoryCargo

Player goal: inspect and transfer suit, ship, drone, outpost, mission and cargo
module contents.

Camera behavior:

- modal overlay over parent context,
- no camera movement while inventory owns pointer/text focus.

Mouse behavior:

- select stacks, drag/drop or transfer actions, filters, search.

Keyboard behavior:

- text search and list controls,
- parent movement/flight/builder shortcuts blocked while focused.

Controller later:

- list focus, transfer amount, tabs, confirm/back.

Allowed HUD panels:

- inventory/cargo modal,
- source/target containers,
- mass/volume/ownership/legal status,
- warnings,
- input hint bar.

Blocked HUD panels:

- debug raw item IDs in Basic,
- unrelated flight/builder/surface commands while modal owns input.

Ship physics input active:

- parent mode decides simulation,
- direct ship input blocked during modal.

Autopilot can keep running:

- yes if parent mode allows it,
- transfer actions that affect mass/fuel should publish visible updates later.

Time pause/slow later:

- may pause in singleplayer inventory,
- must be explicit for autopilot/drone simulation.

Escape/Back:

- search -> detail -> modal -> parent context.

Mode transitions:

- opened from ship, surface, terminal, drone command or builder stats later.

Debug-only controls:

- raw stack IDs, resource IDs, migration/version data.

Screenshot/evidence later:

- suit-to-ship transfer, ship-to-outpost transfer, capacity rejection, mission
  cargo restriction.

### Dialogue/OutpostService

Player goal: accept missions, buy/sell, repair/refuel, access permits, storage
and faction services.

Camera behavior:

- modal over terminal/surface/ship context,
- optional dialogue framing later.

Mouse behavior:

- UI pointer and list selection.

Keyboard behavior:

- text/list focus,
- gameplay controls blocked.

Controller later:

- focus navigation, confirm/back.

Allowed HUD panels:

- service screen,
- faction/owner status,
- price and legality,
- cargo/inventory overlay,
- mission details.

Blocked HUD panels:

- debug diagnostics in Basic,
- flight/builder/surface controls while modal is focused.

Ship physics input active: no.

Autopilot can keep running:

- depends on parent and time policy,
- service should display if time is paused or live.

Time pause/slow later:

- likely pause in singleplayer service menus.

Escape/Back:

- backs out of service tabs and returns to terminal/surface/ship.

Mode transitions:

- from `SurfaceInteraction/Terminal` or landed/docked ship service.

Debug-only controls:

- force reputation, force stock, bypass license, raw faction IDs.

Screenshot/evidence later:

- service overview, buy/sell, refuel/repair, mission accept, legal rejection.

### DebugDiagnostics

Player goal: none. Developer goal: inspect and manipulate prototype state.

Camera behavior:

- may overlay current mode or use diagnostic camera only when explicitly chosen.

Mouse behavior:

- debug windows, sliders, toggles and raw controls.

Keyboard behavior:

- debug function keys and console shortcuts,
- should not be required for normal player actions.

Controller later:

- not required.

Allowed HUD panels:

- raw diagnostics,
- vectors,
- IDs,
- sample indices,
- traces,
- debug-only spawn/reset/refuel/tuning controls.

Blocked HUD panels:

- none by debug need, but debug must not appear in Basic unless explicitly
  enabled.

Ship physics input active:

- depends on active underlying mode and debug action,
- debug assist must be visibly labeled.

Autopilot can keep running:

- yes unless debug action changes state.

Time pause/slow later:

- debug may pause/step simulation explicitly.

Escape/Back:

- closes debug windows before exiting underlying mode.

Mode transitions:

- entered through developer controls or debug preset,
- exits back to underlying player mode.

Debug-only controls:

- all controls in this mode are diagnostic unless later promoted to player UI.

Screenshot/evidence later:

- diagnostics evidence can include raw internals, but Basic screenshots must not
  depend on it.

## 5. Input Conflict Policy

The input mode layer must enforce these rules:

- Flight controls must not fire while typing/searching in UI.
- Builder placement must not adjust ship throttle.
- Surface movement must not send ship RCS commands.
- Map pan/zoom must not rotate camera or ship.
- Drone remote control must not also move the player's body or ship unless a
  split-control mode is explicitly designed.
- Debug function keys must not be required for normal player actions.
- `F1` help should be context-sensitive for the active mode.
- Autopilot engage/cancel should be visible and consistent in flight, planner,
  map and relevant command panels.
- Manual override rules must be explicit, visible, and deterministic.
- Text input owns keyboard until it releases focus.
- Modal panels close from inside out before changing top-level mode.

## 6. Manual Override Policy

Manual override is any player input that intentionally takes authority away from
an assist or autopilot.

Default rules:

- ship attitude, throttle, translation, weapon fire, target command or explicit
  cancel can override ship autopilot depending on assist state,
- minor camera movement must not cancel autopilot,
- map pan/zoom must not cancel autopilot,
- UI text typing must not cancel autopilot,
- builder entry requires autopilot inactive or explicitly canceled,
- surface/docked actions should not accidentally send override to the ship,
- override must produce a visible status such as `Autopilot canceled: manual
  throttle`.

Autopilot status should expose:

- inactive,
- planning,
- ready,
- engaged,
- holding,
- blocked,
- canceled by manual override,
- canceled by player action,
- no target,
- no authority,
- fuel insufficient,
- obstacle/avoidance.

## 7. HUD Layer Model

The future HUD should treat UI as layers, not one pile of panels.

| Layer | Purpose | Notes |
| --- | --- | --- |
| Always-visible minimal status | Current life/ship/suit state. | Small, mode-specific, never raw debug. |
| Context panel | Current task: nav, combat, cargo, terminal, builder validation. | One primary context at a time. |
| Modal panels | Map, inventory, terminal, dialogue, confirmations. | Own input until closed. |
| Debug overlays | Raw diagnostics and prototype tools. | Separate from Basic player UI. |
| Notifications/toasts | Short results, warnings, completed actions. | Non-blocking unless promoted to modal. |
| Warning chips | Immediate actionable risks. | Fuel, authority, legality, damage, oxygen, blocked action. |
| Input hint bar | Context-sensitive controls. | Uses player-facing labels only. |
| Crosshair/markers | Aim, scan, interact, target and route markers. | Mode-specific. |
| Map overlays | Routes, markers, filters, zones. | Active in `SystemMap` and compact nav. |
| Builder overlays | Grid, sockets, ghosts, validation, COM/thrust gizmos. | Active only in builder. |
| Inventory/cargo overlays | Containers, transfers, mass/volume, ownership. | Modal or terminal context. |

## 8. Debug Vs Player UI Policy

Player UI:

- uses readable names and actionable status,
- says what happened and what the player can do,
- hides raw vectors, sample indices, plan revisions and internal IDs unless
  useful in a polished inspection view,
- never requires F2-F6,
- should work in Basic mode.

Debug UI:

- may show raw IDs, revisions, samples, vectors, tuning and internal states,
- may expose prototype reset/refuel/spawn controls,
- must be labeled as developer/prototype/diagnostic,
- should not define the player contract by accident.

Every debug-only control must later either:

- get a player-facing equivalent,
- remain explicitly diagnostic,
- or be removed when the prototype path is retired.

## 9. Transition Examples

### Flight -> Map -> Set Target -> Flight

1. Player opens `SystemMap`.
2. Map owns pan/zoom/select; flight input is blocked.
3. Player selects a target.
4. Map shows route/action confirmation.
5. Confirm stores selected navigation target.
6. Back returns to `ShipFlight`.
7. HUD shows new target and engage/cancel action.

### Flight -> Autopilot Active -> Manual Override -> Flight

1. Player engages autopilot from HUD/planner/map.
2. Autopilot status is visible.
3. Player gives a configured manual override input.
4. Autopilot cancels or downgrades according to mode policy.
5. HUD shows reason and returns authority to `ShipFlight`.

### Flight -> ShipBuilder -> TestFlight -> Builder -> Save -> Flight

1. Player enters builder from safe hangar/docked state.
2. Builder owns camera, mouse and keyboard; ship input blocked.
3. Player validates and launches test flight.
4. Test flight uses normal flight controls on temporary draft.
5. Return action restores builder draft.
6. Save/set active transitions to normal ship flow.

### Flight -> Landed -> SurfaceFirstPerson -> Cargo Transfer -> Flight

1. Ship lands or docks.
2. Player exits to `SurfaceFirstPerson`.
3. Surface mode owns movement/look; ship controls blocked.
4. Player opens cargo transfer as `InventoryCargo` or terminal modal.
5. Transfer result updates cargo status.
6. Player re-enters ship and returns to `ShipFlight` or cockpit state.

### SurfaceFirstPerson -> DroneCommand -> SurfaceFirstPerson

1. Player opens drone command from suit/outpost/ship.
2. Drone roster owns UI.
3. Optional remote manual drone control switches camera/input to drone.
4. Back exits remote control, then command mode.
5. Player body returns to previous surface state.

### Outpost Terminal -> Buy/Sell/Refuel/Repair -> Back To Surface/Ship

1. Player interacts with a terminal.
2. Terminal owns cursor and text/list focus.
3. Service tabs show owner, legal and price status.
4. Buy/sell/refuel/repair actions produce visible result.
5. Back returns to surface or ship context.

## 10. Future Test Plan

Later implementation slices should add:

- mode transition unit tests,
- input gating tests,
- HUD context tests,
- no debug UI in Basic mode tests,
- context-sensitive F1 help tests,
- autopilot/manual override visibility tests,
- map pan/zoom does not rotate camera/ship tests,
- builder placement does not change throttle tests,
- surface movement does not send ship RCS tests,
- inventory text focus blocks gameplay shortcuts tests,
- screenshot matrix across modes,
- accessibility/readability pass.

## 11. Implementation Slice Boundaries

Recommended future order:

1. mode enum/state model,
2. input gating,
3. player HUD/context integration,
4. map/navigation flow,
5. builder mode integration,
6. surface first-person mode,
7. drone command mode,
8. debug/player UI separation tests.

Each slice should be testable without requiring final art or final economy.
