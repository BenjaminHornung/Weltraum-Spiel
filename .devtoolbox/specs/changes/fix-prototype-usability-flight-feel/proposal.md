# Proposal: Fix Prototype Usability and Flight Feel

## Problem

The current spaceflight prototype is hard to read and harder to learn than it should be. Environment labels, gate rings, minimap labels, debug vectors, and long keybind text compete with the ship and flight HUD. Autopilot exists but is not discoverable without reading documentation. Precision controls blur several concepts together: main throttle, gimbal, RCS, rotation, translation, and fine control all overlap in ways that make the ship feel nervous and surprising.

This change is prioritized before Builder, Combat, Ship Blueprint, and other gameplay features because those systems depend on a testable, readable, and comfortable baseline flight loop.

## Outcome

Players and testers should be able to start the prototype, see a calm default scene, find the autopilot from the HUD or debug console, switch between explicit Normal, Precision, and Translation control modes, stop ship momentum through physical actuators, and identify ship modules and active VFX in screenshots.

## Scope

- Declutter the runtime UI, world labels, minimap, and generated test environment defaults.
- Make the keybind overlay scrollable, screen-clamped, and complete.
- Surface navigation, target selection, autopilot, Normal/Precision/Translation modes, SAS, and Kill Momentum in HUD/debug UI.
- Replace the current Precision/Left-Alt modifier model with explicit Normal, Precision, and Translation modes while preserving Normal cruise behavior.
- Keep W/S/A/D from being rotation and translation at the same time: Precision is RCS attitude control, Translation is RCS linear movement.
- Reduce default gimbal authority and keep stronger gimbal experiments available through diagnostics.
- Add a physical Kill Momentum assist that commands existing main/RCS/SAS/assist paths instead of directly zeroing Rigidbody velocity.
- Improve primitive ship module contrast, optional labels, and engine/RCS VFX readability without importing external assets.
- Update README and `docs/physics-flight-model.md` where controls, assist semantics, and verification expectations change.

## Non-Goals

- No final art assets or external asset imports.
- No full settings menu or input rebinding system.
- No new Builder, Combat, Ship Blueprint, docking UI, mission UI, or map UI feature work.
- No removal of existing debug reset buttons, as long as the new Kill Momentum feature is not implemented as a reset.
- No rewrite of the physics core or RCS allocator unless a small extension is required to route explicit assist requests.

## Success

- Default scene readability is calm enough for manual flight testing.
- Keybinds are fully reachable in-game and match README.
- Autopilot is discoverable and controllable without README.
- Normal mode remains useful for long-range flight and autopilot, while Precision and Translation provide clear close-range attitude and movement control.
- Kill Momentum brakes physically through available actuators and reports useful state/failure diagnostics.
- Ship modules and active VFX are visually distinguishable in a screenshot.
- Unity MCP validation, Unity compile/console checks, EditMode tests, and a test protocol are recorded under this change.
