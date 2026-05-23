# player-hud-textmeshpro-readability-v1 Specification

## Capability: Player HUD Text Readability

### Requirement: Player HUD uses TextMeshPro UI text

The generated `PrototypePlayerHudCanvas` SHALL create TextMeshPro UI text components for player-facing HUD labels, values, help text, target labels, and button labels.

#### Scenarios

- GIVEN `PrototypePlayerHudRenderer` creates its HUD canvas
- WHEN the canvas hierarchy is inspected
- THEN the player-facing text objects are `TMPro.TextMeshProUGUI` / `TMPro.TMP_Text` components
- AND the canvas does not contain legacy `UnityEngine.UI.Text` components.

### Requirement: Debug IMGUI layer remains separate

The change SHALL NOT migrate or remove existing IMGUI debug windows, diagnostic overlays, or prototype consoles.

#### Scenarios

- GIVEN Basic Player HUD is active
- THEN the Player HUD uses TMP text
- AND existing debug windows remain controlled by their existing preset/toggle paths.

### Requirement: Readable minimum generated HUD sizes

The generated Player HUD SHALL avoid 9px player-facing text in interactive controls and target labels. The smallest compact generated Player HUD text SHOULD be 10px or larger unless hidden by responsive rules.

#### Scenarios

- GIVEN navigation or combat controls are visible
- THEN their button labels are readable and do not shrink below 10px.
- GIVEN target indicator labels are visible
- THEN their label font size is 10px or larger.

### Requirement: Responsive layout stays non-overlapping

The TextMeshPro migration SHALL preserve the existing responsive layout guarantees across ultrawide, 16:9, 4:3, portrait, and small screen test sizes.

#### Scenarios

- GIVEN the HUD is applied at 2560x1080, 1920x1080, 1280x720, 1024x768, 900x1600, and 640x480
- THEN major panels and active control rows do not overlap
- AND text/control rows stay inside their parent HUD panels.

### Requirement: Runtime evidence captures the actual GameView HUD

Verification SHALL include a Unity runtime GameView screenshot from the real prototype scene after the migration.

#### Scenarios

- GIVEN Play Mode is running in the prototype scene
- WHEN a GameView screenshot is captured
- THEN the screenshot is stored under this change's `tests/screenshots/` folder
- AND the test protocol records Unity console status and runtime HUD/TMP probe output.
