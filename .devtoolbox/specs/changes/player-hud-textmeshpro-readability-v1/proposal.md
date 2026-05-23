# player-hud-textmeshpro-readability-v1

## Motivation

The Player HUD has moved most player-facing flight, objective, radar, target, navigation, and combat information into a single uGUI canvas. The remaining readability issue is that the HUD still creates legacy `UnityEngine.UI.Text` elements with builtin bitmap/runtime fonts, which makes the GameView text look soft and prototype-like, especially at small sizes and after aspect-ratio scaling.

## User Outcome

The Basic Player HUD should read like a game HUD rather than a debug overlay: sharper text, fewer tiny labels, stable scaling, and no new panel overlap when the resolution or aspect ratio changes.

## Scope

- Migrate the generated Player HUD canvas text components from legacy `UnityEngine.UI.Text` to TextMeshPro UI components.
- Reuse the existing uGUI Player HUD layout, panels, colors, controls, and data flow.
- Keep the old IMGUI debug windows and their `GUIStyle` text untouched.
- Raise the smallest player-facing HUD labels/buttons to readable sizes where the current generated UI uses 9px text.
- Add tests that prove the Player HUD generates TMP text, does not create legacy text components in the Player HUD canvas, and preserves the existing responsive/non-overlap layout guarantees.
- Capture fresh Unity runtime GameView screenshot evidence.

## Non-Goals

- No redesign of HUD information architecture.
- No new Navigation/Combat/Docking/Objective behavior.
- No UI Toolkit rewrite.
- No debug IMGUI migration.
- No imported font/art asset dependency unless the project already provides one.
