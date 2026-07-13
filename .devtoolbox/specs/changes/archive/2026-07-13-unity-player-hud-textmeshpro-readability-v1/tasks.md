# Tasks

- [ ] Migrate generated Player HUD text fields and `CreateText` factory from legacy `UnityEngine.UI.Text` to `TMPro.TextMeshProUGUI` / `TMP_Text`.
- [ ] Keep HUD buttons, labels, and target indicators readable by removing generated 9px player-facing labels and preserving wrapping/truncation behavior.
- [ ] Update Player HUD editor tests to assert TMP text usage, no legacy text inside `PrototypePlayerHudCanvas`, and unchanged responsive non-overlap behavior.
- [ ] Run Unity MCP script validation, focused HUD tests, and explicit local solution build.
- [ ] Capture runtime GameView screenshot/probe evidence and record `tests/test-protocol.md` plus `tests/testfindings.md`.
- [ ] Run DevToolbox validation/preflight as far as the workspace verifier permits, then commit and push the scoped readability slice.
