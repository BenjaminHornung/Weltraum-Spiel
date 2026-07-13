# player-ui-concept-runtime-audit-v1

## Why

The Player-facing UI concept document is now implemented through several HUD slices, but the active acceptance goal is broader than individual green tests: the full document must be checked against current code and the real Unity runtime. The next risk is claiming completion from partial slice evidence while missing a document requirement, a runtime overlay regression, or an aspect-ratio overlap.

## What Changes

- Build a requirement-by-requirement audit for `docs/legacy-unity/ux/player-facing-ui-concept-v0.md` sections 3-8 and the v0 proposed slices.
- Link each requirement to current code, focused tests, runtime probe data, or screenshot evidence.
- Capture a Runtime GameView screenshot/probe matrix for the major player-facing states: cruise/objective, navigation/autopilot, combat, docking, warnings/low-resource, help overlay, and at least one non-16:9 layout probe.
- Record remaining gaps separately from proven-complete items.
- Do not change gameplay behavior unless the runtime audit reveals a concrete player-facing defect.

## Scope

- DevToolbox evidence under this change.
- Unity MCP script/test/probe/screenshot validation.
- Current `PrototypePlayerHudRenderer` and related tests as the implementation under audit.

## Non-Goals

- No new player UI features unless a verified gap blocks the concept acceptance.
- No package manifest cleanup or Unity package changes.
- No toggling unrelated in-progress spec tasks.
- No staging unrelated dirty/untracked files.
