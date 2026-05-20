# Proposal: prototype-test-environment-ui-pass

## Motivation

The current prototype scene is still hard to read spatially and the IMGUI debugging surfaces can obscure the view. PrototypeBootstrap creates the player ship and a single target dummy, which is enough for first weapon and hit feedback checks but not enough for navigation, RCS translation, camera depth, target selection, approach practice, or future waypoint/autopilot work.

This change improves the prototype before waypoint-autopilot, ship-blueprint, builder, and combat slices by adding reusable orientation landmarks, a simple radar/minimap, and movable compact UI windows.

## Outcome

At runtime the prototype shall show a primitive but useful test range: origin beacon, axes, range rings, multiple targets, navigation beacons, approach gates, a station placeholder, and a visual obstacle field. The player shall be able to orient without relying only on debug text. The HUD, diagnostics, console, keybind help, and minimap shall be draggable, toggleable, and readable.

## Scope

- Prototype-only runtime helpers and generated primitive geometry.
- No external asset packs, no final art direction, and no mission/waypoint/autopilot implementation.
- Reuse existing prototype controllers, target dummy behavior, debug/HUD code, generated materials, and the existing uncommitted/shared UI window helper work where applicable.
- Add documentation and verification evidence under this change.

## Non-Goals

- No RenderTexture minimap camera.
- No final navigation map or route planner.
- No docking mechanics.
- No damage or gameplay behavior for obstacles.
- No ship builder architecture changes.
