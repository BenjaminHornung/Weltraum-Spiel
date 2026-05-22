# Proposal

## Change
`player-facing-ui-concept-v0`

## Problem
The prototype had several debug/prototype UI windows but lacked a stable player-facing HUD surface for ordinary flight, navigation, combat, docking, and ship-status awareness.

## Goal
Provide a first player-facing HUD concept that exposes useful status while keeping debug internals hidden by default, then preserve focused verification evidence for layout, runtime binding, and tests.

## Scope
- Flight, navigation, combat, docking, ship-status, and keybind/help presentation.
- Debug UI separation through default UI layout settings.
- Focused editor/runtime verification and screenshot evidence.

## Non-Goals
- Full final HUD art direction.
- Economy, cargo, mission reward, or ship-builder UI.
- Replacing all debug tooling.
