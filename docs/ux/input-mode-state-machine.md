# Input Mode State Machine

Status: planning/spec-only, 2026-06-14.

This document defines the planned top-level state machine for UI and input modes.
It is not an implementation, binding map or runtime enum yet.

## 1. State Set

Top-level modes:

```text
ShipFlight
ShipNavigationComputer
ShipWeaponComputer
SystemMap
ShipBuilder
TestFlight
SurfaceFirstPerson
SurfaceInteractionTerminal
DroneCommand
InventoryCargo
DialogueOutpostService
DebugDiagnostics
```

Substates can exist inside each mode, but top-level input ownership should be
traceable to one of these modes.

## 2. State Ownership Shape

Each state should define:

```text
ModeDefinition
{
    modeId
    playerGoal
    cameraOwner
    mouseOwner
    keyboardOwner
    controllerProfile
    shipPhysicsInputPolicy
    playerBodyInputPolicy
    autopilotPolicy
    timePolicy
    allowedHudLayers
    blockedHudLayers
    escapeBehavior
    transitionRules
    debugPolicy
}
```

This shape is planning only, but later implementation should keep the same
questions visible.

## 3. Ownership Matrix

| Mode | Camera owner | Mouse owner | Keyboard owner | Ship input | Player body input | Autopilot |
| --- | --- | --- | --- | --- | --- | --- |
| ShipFlight | ship camera | flight/camera/HUD | flight unless focus captured | active | inactive | can run |
| ShipNavigationComputer | ship/planner | planner or flight camera | planner or flight | active unless modal focus | inactive | can run |
| ShipWeaponComputer | ship/combat | weapon panel or target select | weapon/flight | active unless modal focus | inactive | can run |
| SystemMap | map camera | map | map/search | blocked | inactive | can run if policy allows |
| ShipBuilder | builder camera | builder | builder/search | blocked | inactive | canceled/inactive |
| TestFlight | ship camera | flight/camera | flight/test return | active | inactive | explicit only |
| SurfaceFirstPerson | surface camera | look/aim/interact | surface | blocked | active | ship inactive; drones can run |
| SurfaceInteractionTerminal | terminal/modal | terminal UI | terminal/search | blocked | blocked | parent policy |
| DroneCommand | command/drone | command UI/drone camera | command/drone | selected drone only if remote | blocked or parent-held | can run |
| InventoryCargo | parent/modal | inventory UI | inventory/search | blocked while modal | blocked while modal | parent policy |
| DialogueOutpostService | service/modal | service UI | service/search | blocked | blocked | parent policy |
| DebugDiagnostics | underlying/debug | debug if focused | debug if focused | underlying or debug action | underlying or debug action | underlying/debug action |

## 4. Transition Rules

### General Rules

- Modal substates close before top-level mode exits.
- Text focus releases before shortcut keys are processed.
- Transition failure returns one actionable reason.
- Transitions should be logged/testable later.
- Debug transitions must be labeled and should not create player-only state.

### Valid Transition Examples

```text
ShipFlight -> ShipNavigationComputer -> ShipFlight
ShipFlight -> SystemMap -> ShipFlight
ShipFlight -> ShipWeaponComputer -> ShipFlight
ShipFlight -> ShipBuilder -> TestFlight -> ShipBuilder -> ShipFlight
ShipFlight -> SurfaceFirstPerson -> SurfaceInteractionTerminal -> SurfaceFirstPerson
SurfaceFirstPerson -> DroneCommand -> SurfaceFirstPerson
SurfaceFirstPerson -> InventoryCargo -> SurfaceFirstPerson
SurfaceInteractionTerminal -> DialogueOutpostService -> SurfaceInteractionTerminal
ShipFlight -> DebugDiagnostics -> ShipFlight
```

### Blocked Transition Examples

| Attempt | Block reason |
| --- | --- |
| `ShipFlight -> ShipBuilder` during combat | `Cannot build during combat.` |
| `ShipFlight -> ShipBuilder` while autopilot travel active | `Cancel autopilot before editing ship.` |
| `ShipBuilder -> TestFlight` with blocking validation errors | `Cannot test flight: <first error>.` |
| `SurfaceFirstPerson -> ShipFlight` when not at ship entry | `Return to ship hatch or cockpit access.` |
| `SystemMap -> ShipBuilder` | `Builder requires hangar or safe build entry.` |
| `InventoryCargo -> ShipFlight` with text search focused | first Escape clears search, second closes modal |

## 5. Text Focus Rule

When any text field is focused:

- movement, flight, builder one-key shortcuts, map shortcuts and debug hotkeys
  do not fire unless explicitly allowed,
- Escape first releases or clears text focus,
- Enter confirms the field only if the field owns Enter,
- F1 may still open context help if supported.

Affected fields:

- map search,
- builder palette search,
- blueprint/ship name,
- inventory/cargo search,
- transfer amount,
- terminal/service search,
- dialogue response text if ever added,
- debug console command line.

## 6. Manual Override Events

Manual override should be represented as an event with source and reason:

```text
ManualOverrideEvent
{
    sourceMode
    inputSource
    reason
    affectedAssist
    visibleMessage
}
```

Example reasons:

- manual throttle,
- manual attitude,
- manual translation,
- weapon/fire command,
- explicit cancel,
- mode transition,
- test flight return,
- builder entry.

Non-override actions:

- camera orbit,
- map pan/zoom,
- text entry,
- opening help,
- opening debug overlay,
- inspecting planner details.

## 7. Escape And Back Stack

Escape/Back should walk inward:

1. active text field,
2. tooltip/detail popup,
3. confirmation modal,
4. inventory/service/map/builder subpanel,
5. top-level modal mode,
6. pause/system menu or parent mode.

It should not skip directly from a nested modal to flight if that would lose data,
cancel autopilot unexpectedly or discard a dirty builder draft.

## 8. Time Policy

The state machine should expose time policy:

| Policy | Meaning |
| --- | --- |
| Live | Simulation continues. |
| Paused | Simulation paused in singleplayer. |
| Slow | Simulation slowed for tactical/UX reasons. |
| Parent | Modal inherits parent policy. |
| Explicit | Mode must display whether it is live or paused. |

Initial assumptions:

- ship flight and test flight are live,
- builder is paused/safe,
- map may be live or paused but must display policy,
- surface is live,
- terminals/services may pause in singleplayer,
- drone command may be live for missions but paused for planning,
- debug may pause/step explicitly.

## 9. Future Tests

Future tests should cover:

- every top-level transition,
- blocked transitions and reasons,
- text focus gating,
- map pan does not rotate ship/camera,
- builder placement does not throttle ship,
- surface movement does not trigger RCS,
- debug overlay does not change mode ownership,
- manual override event messages,
- escape/back stack ordering,
- context help mode matching.
