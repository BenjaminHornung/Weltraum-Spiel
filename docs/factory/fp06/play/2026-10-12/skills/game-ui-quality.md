---
name: game-ui-quality
description: Design or review game HUDs, menus, inventory and interaction screens for visual hierarchy, readability and reliable input. Use for a concrete GUI-quality task; asset production and renderer performance use their own workflows.
metadata:
  sources: omer-metin/skills-for-antigravity ui-design and game-ui-design
---

# Game UI quality

Apply the mandatory output and implementation skills. Respect project instructions and the assigned scope. Do not invent a shipped-game background, install a UI framework or replace an established component system.

## Establish the target

Identify the player action, essential information, current screen/state and supported input/display targets. Inspect the actual existing UI or supplied reference before proposing a redesign. Record the few concrete problems to solve; do not treat the task as a collection of attractive unrelated panels.

Use the project's visual language or a coherent chosen direction: type hierarchy, spacing rhythm, semantic colors, surfaces, icons and purposeful motion. Separate primary action, secondary information and transient feedback. Keep decoration subordinate to comprehension. Use realistic labels and worst-case content rather than perfect placeholder data.

## Implement the interaction, not only the screenshot

Trace the complete path into and out of the screen. Preserve game state and handle empty, busy, disabled, failed and successful states where the flow needs them. Input must produce immediate understandable feedback and a visible resulting state.

Check keyboard/controller focus, back/cancel, modal capture, restoring focus and conflict with gameplay input for the actual supported devices. Controller-first is appropriate only when it is a real project target. Provide readable text, suitable contrast, non-color cues and reachable targets; evaluate actual rendered sizes instead of regex claims about rem/px. Respect reduced motion and resizing/safe areas when applicable.

## Verify before acceptance

Capture and inspect the rendered result at representative target viewports and meaningful states. Compare reference and result in the same state/viewport. Check typography, spacing, grouping, contrast, clipping, overlays and content density; test the primary action and exit path with real input. A successful build or attractive still image does not prove interaction quality.

Use available browser/app captures for UI evidence; use Game Development Studio only when its asset, sealed-render or performance workflows apply. GPU/project execution and paid-provider permissions remain separate. Missing tools or evidence are NOT RUN, not visual acceptance. Report concrete drift, tested paths and unresolved player-facing issues. Ask for human judgement where visual preference cannot be resolved by the brief or evidence.
