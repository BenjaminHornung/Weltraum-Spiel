# Unified UI Input Mode Architecture v1 Proposal

## Summary

Create a planning-only package for explicit UI and input mode ownership across
ship flight, navigation computer, weapon computer, system map, ship builder, test
flight, surface first-person play, terminals/outposts, drones, inventory/cargo
and debug diagnostics.

## Motivation

The prototype now has overlapping gameplay surfaces: ship flight, autopilot and
navigation planner, player HUD, weapon computer, ship builder planning, future
surface mode, drones, outposts, cargo/inventory, map concepts and debug panels.
Without a unified policy, keyboard and mouse controls will collide. Examples:
builder placement could change throttle, surface movement could trigger ship RCS,
map pan could rotate the camera, and debug function keys could accidentally
become required player controls.

## Scope

In scope:

- top-level UI/input modes,
- camera, mouse, keyboard, controller-later and input ownership policy,
- HUD layers and panel visibility rules,
- input conflict rules,
- autopilot/manual override visibility rules,
- player UI vs debug UI policy,
- transition examples,
- future test plan,
- formal DevToolbox requirements.

Out of scope:

- runtime code,
- tests,
- scenes,
- UI prefabs,
- assets,
- input bindings,
- autopilot/harness changes,
- ship-builder runtime changes.

## User / Developer Outcome

Future UI and input implementation can add map, builder, surface, drone,
inventory and outpost flows without stealing controls from flight or relying on
debug panels. Developers get a testable mode contract; players get readable
context, consistent help, and clear autopilot/manual override feedback.

## Non-Goals

- Do not implement a mode manager in this change.
- Do not define final keybinds or controller bindings.
- Do not design final visual UI style.
- Do not replace current HUD/debug runtime code.
- Do not add Unity assets, scenes, prefabs or tests.

## Success Criteria

- Four UX planning docs exist under `docs/ux`.
- DevToolbox proposal, design, tasks and spec exist under
  `unified-ui-input-mode-architecture-v1`.
- The spec requires explicit UI/input modes, ownership of camera/mouse/keyboard,
  debug/player separation, context help, deterministic transitions and visible
  autopilot/manual override behavior.
- `specs_validate unified-ui-input-mode-architecture-v1` passes.
- Only allowed Markdown/spec files are committed.
