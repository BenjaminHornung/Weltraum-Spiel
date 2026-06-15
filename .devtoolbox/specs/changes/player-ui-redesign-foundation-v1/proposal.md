# Proposal: Player UI Redesign Foundation v1

## Problem

Weltraum-Spiel needs player-facing UI foundations that separate flight,
navigation, map, surface, builder and debug concerns. If UI continues to grow as
debug-heavy panels, player tasks become harder to read and future autopilot or
map behavior will leak implementation details directly onto the HUD.

## Outcome

This change plans the UI foundation for visible input modes, HUD ViewModels,
navigation status, debug/player separation and screenshot evidence.

## Scope

In scope for future implementation:

- input mode state model
- HUD ViewModels
- navigation status panel states
- debug-vs-player policy
- screenshot evidence matrix

Out of scope for this setup task:

- Runtime UI code
- uGUI replacement
- full art pass
- settings menu
- autopilot logic changes
- scene, prefab or asset edits

## Success Criteria

- The DevToolbox scaffold exists and points future agents at the UI foundation
  behavior.
- Open implementation tasks remain unchecked.
- No UI runtime, scene, prefab or asset files are changed by this setup slice.
