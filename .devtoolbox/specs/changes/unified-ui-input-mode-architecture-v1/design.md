# Unified UI Input Mode Architecture v1 Design

## Context

Current gameplay and planning surfaces already compete for input:

- ship flight uses keyboard for attitude, throttle, RCS, SAS, target cycling,
  fire, camera and autopilot;
- navigation planner and map need target selection, route inspection, pan/zoom
  and search;
- weapon computer needs target list, fire status and auto-fire controls;
- ship builder needs orbit camera, placement, rotate, mirror, search, save and
  test flight;
- surface first-person needs movement, look, scanner, tool/weapon and cargo
  interaction;
- terminals and outposts need text/list focus and service actions;
- drone command needs roster, mission planning and optional remote manual control;
- inventory/cargo needs source/target, amount entry and search;
- debug diagnostics need raw overlays and prototype actions.

The chosen approach is not a binding list. It is a mode ownership contract that
later code can implement and test.

## Proposed Design

### Mode Registry

Future implementation should define a registry of top-level modes:

- `ShipFlight`
- `ShipNavigationComputer`
- `ShipWeaponComputer`
- `SystemMap`
- `ShipBuilder`
- `TestFlight`
- `SurfaceFirstPerson`
- `SurfaceInteractionTerminal`
- `DroneCommand`
- `InventoryCargo`
- `DialogueOutpostService`
- `DebugDiagnostics`

Each mode defines:

- player goal,
- camera owner,
- mouse owner,
- keyboard owner,
- controller-later assumptions,
- allowed HUD layers,
- blocked HUD layers,
- ship physics input policy,
- player body input policy,
- autopilot policy,
- time policy,
- escape/back behavior,
- transition rules,
- debug-only controls and evidence expectations.

### Input Gating

Inputs should be routed by active mode and focus:

1. text focus,
2. focused modal,
3. active top-level mode,
4. underlying debug overlay only if focused,
5. ignored or blocked.

This avoids accidental cross-mode actions.

### HUD Layers

HUD should be layered:

- always-visible minimal status,
- context panel,
- modal panels,
- debug overlays,
- notifications/toasts,
- warning chips,
- input hint bar,
- crosshair/markers,
- map overlays,
- builder overlays,
- inventory/cargo overlays.

Modes declare allowed and blocked layers so Basic player UI can be verified
without depending on debug windows.

### Debug Separation

Debug diagnostics remain valuable but separate:

- `F1` is context-sensitive player help,
- `F2` through `F6` remain developer/prototype controls unless promoted later,
- debug UI may show raw IDs/vectors/revisions/sample indices,
- Basic player UI should show readable names and actionable state.

### Autopilot And Manual Override

Autopilot state and manual override must be visible in modes that can affect
flight:

- flight,
- navigation computer,
- system map,
- weapon computer when combat can override,
- test flight when autopilot is enabled,
- debug diagnostics when it manipulates assist state.

Manual override should be deterministic. Camera orbit, map pan, typing and help
do not cancel autopilot. Manual throttle, attitude, translation, explicit cancel
or mode transitions that cannot support autopilot can cancel with a visible
reason.

## Alternatives Considered

### Let Each Panel Consume Input Locally

Rejected because local panel ownership will create hidden conflicts between map,
builder, flight, surface and debug controls.

### Pause Everything For Every Modal

Rejected as a universal rule because autopilot, drones and surface hazards may
need live simulation. The design records time policy per mode instead.

### Treat Debug UI As Player UI Until Polish

Rejected because the current prototype already distinguishes Basic/player HUD
from F2-F6 diagnostics. Losing that boundary would make future UX tests
ambiguous.

## Integration Notes

- Existing Cruise/Precision/Translation flight behavior can remain a submode of
  `ShipFlight`.
- Existing Basic/Flight Test/RCS Test/Full Diagnostics presets can map to HUD
  layer policy.
- Ship Builder edit/test flow should use `ShipBuilder` and `TestFlight` rather
  than editing in `ShipFlight`.
- Surface terminal, inventory and outpost service screens should use modal
  ownership and block body/ship controls.
- Drone command needs an explicit remote-control submode when the drone owns
  camera and movement.

## Risks

| Risk | Mitigation |
| --- | --- |
| Too many modes become hard to reason about. | Keep one top-level owner and use nested modal stack rules. |
| Debug controls leak into player help. | Test Basic mode and F1 help per active mode. |
| Autopilot cancellation feels random. | Emit visible manual override reasons. |
| Builder/map/surface controls collide with flight. | Gate input by mode and text focus before dispatch. |
| Future controller support diverges from keyboard/mouse. | Require controller-later assumptions per mode. |

## Verification Strategy

This change is planning/spec-only:

- run `specs_validate unified-ui-input-mode-architecture-v1`,
- check the staged file list contains only allowed docs/spec files,
- no Unity tests,
- no dotnet build.
