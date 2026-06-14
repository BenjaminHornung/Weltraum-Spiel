# Debug Vs Player UI Policy

Status: planning/spec-only, 2026-06-14.

This policy separates player-facing UI from prototype diagnostics so debug
surfaces can stay useful without becoming the player contract by accident.

## 1. Goal

Player UI should help the player act. Debug UI should help developers inspect
and manipulate internal state. The same project can have both, but they must be
separable, labeled and testable.

## 2. Player UI Rules

Player UI must:

- use readable names,
- show actionable status,
- explain blocked actions with player-facing reasons,
- avoid raw IDs and internal state names in Basic mode,
- provide context-sensitive help,
- expose normal actions without F2-F6 debug keys,
- use consistent labels for engage, cancel, back, save, test, transfer and
  return actions,
- make autopilot/manual override state visible.

Good player-facing examples:

```text
Autopilot canceled: manual throttle
Cannot test flight: missing RCS
Transfer blocked: ship cargo is full
Landing unsafe: slope too steep
Weapon aligning: target out of turret arc
```

Avoid in player UI:

```text
PlanRev 42
SampleIndex 128/512
DesiredAccel NaN
RcsthrSolver branch 3
SocketPath /ImportedShipVisual/...
```

## 3. Debug UI Rules

Debug UI may show:

- raw IDs,
- plan revisions,
- sample indices,
- vectors,
- candidate scores,
- internal state enums,
- raw transform paths,
- solver values,
- test scenario controls,
- reset/refuel/spawn/tuning buttons.

Debug UI must:

- be labeled as debug, prototype or diagnostic,
- be hidden in Basic player view unless explicitly enabled,
- not be required to complete player workflows,
- avoid silently changing gameplay rules without visible debug labeling,
- preserve current player mode when it only overlays diagnostics.

## 4. Function Key Policy

Current prototype convention:

| Key | Policy |
| --- | --- |
| `F1` | Player-facing context help in Basic. |
| `F2` | Developer diagnostics overlay. |
| `F3` | Developer debug console. |
| `F4` | Legacy HUD/Navball diagnostic surface. |
| `F5` | Legacy minimap/test-environment diagnostic surface. |
| `F6` | Prototype visual/debug display mode. |

Future player actions should not require `F2` through `F6`. If a debug action
becomes useful for normal play, it needs a player-facing equivalent in the
relevant mode.

## 5. Basic Mode Contract

Basic is the player contract for the prototype.

Basic mode should include:

- minimal status,
- current context panel,
- warnings,
- input hints,
- map/radar/markers appropriate to mode,
- context-sensitive F1 help.

Basic mode should not include:

- raw debug console,
- legacy IMGUI diagnostic windows,
- raw IDs and traces,
- prototype reset/refuel controls,
- hidden scenario spawners,
- internal tuning sliders.

## 6. Diagnostic Promotion Rule

Every debug-only control should be classified:

| Classification | Meaning |
| --- | --- |
| Player equivalent later | Debug action proves a future player action, such as refuel at depot or return to builder. |
| Diagnostic only | Action remains for testing, such as raw vector overlay or solver branch display. |
| Remove later | Prototype convenience that should disappear before polish. |

Examples:

| Debug control | Classification |
| --- | --- |
| Debug refuel | Player equivalent later: outpost/refuel service. |
| Spawn target dummy | Diagnostic only. |
| Raw route sample index | Diagnostic only. |
| F6 visual mode cycling | Diagnostic only or remove later. |
| Return to builder from test flight | Player equivalent later. |
| Reset camera framing | Player equivalent later if exposed as camera recenter. |

## 7. Debug Overlay Layering

Debug overlays should sit in a separate layer:

- may be visible over flight, builder, map or surface,
- should not steal input unless an interactive debug window is focused,
- should show a visible debug/preset label,
- should be disabled for Basic screenshot evidence unless the test is about
  diagnostics.

## 8. Documentation Policy

When documenting controls:

- README may list prototype/dev controls, but mark them as developer-only.
- Player help must omit debug-only controls unless the active mode is
  `DebugDiagnostics`.
- Tasks/specs should call out when a debug control needs a player-facing
  replacement.

## 9. Future Tests

Future implementation should test:

- Basic mode does not show debug-only windows,
- F1 help changes with active mode,
- F2-F6 do not gate normal player workflows,
- debug overlay can be toggled without changing physics/input ownership,
- debug-only controls are labeled,
- player-facing equivalent exists or is planned for promoted debug controls.
