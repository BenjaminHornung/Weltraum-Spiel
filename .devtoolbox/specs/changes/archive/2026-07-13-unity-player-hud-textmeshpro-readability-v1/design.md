# player-hud-textmeshpro-readability-v1 Design

## Existing Pattern

`PrototypePlayerHudRenderer` already owns one generated uGUI canvas and a small set of helper methods for creating panels, buttons, bars, and text. All player HUD text is currently created through `CreateText(...)`, which makes this a contained migration point.

Unity's installed `com.unity.ugui` package already includes the TextMeshPro runtime namespace and `TextMeshProUGUI`, so this change can use TMP without adding package or asset imports. The HUD should rely on TMP's runtime default font behavior rather than creating a new font asset on disk.

## Chosen Approach

- Replace Player HUD field/component types from `UnityEngine.UI.Text` to `TMPro.TMP_Text` where they refer to generated HUD labels.
- Keep `UnityEngine.UI` for `Button`, `Image`, `CanvasScaler`, and raycast infrastructure.
- Keep `CreateText(...)` as the single factory, but make it create `TextMeshProUGUI` and map the existing `TextAnchor` inputs to TMP alignment options.
- Update button-label lookup to `TMP_Text`.
- Update editor tests to find `TMP_Text` instead of legacy `Text` for Player HUD assertions.
- Add a dedicated test that the generated Player HUD canvas contains TMP text and zero legacy `UnityEngine.UI.Text` components.

## Reuse vs New Code

No new rendering system is introduced. This reuses the existing Player HUD renderer, responsive layout code, context-panel logic, and tests. The only new code should be the small TMP alignment/font-style helper needed to preserve current layout semantics.

## Risks

- Existing tests refer to `UnityEngine.UI.Text`; they must move to `TMP_Text` without weakening assertions.
- TMP line wrapping differs from legacy Text, so existing non-overlap tests remain important after migration.
- If TMP default resources are missing, runtime font fallback could log warnings. Runtime evidence must check the Unity console after GameView capture.
