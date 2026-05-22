# Design

## Change
`player-facing-ui-concept-v0`

## Approach
The change keeps the existing prototype/debug UI available while adding a separate player HUD renderer and snapshot builder. Runtime-facing labels are translated from existing ship, navigation, combat, docking, and damage diagnostics so raw tuning internals stay out of the default player view.

## Evidence
The completed evidence lives in:

- `tests/test-protocol.md`
- `tests/screenshots/player-ui-final-verified.png`
- `design-decisions.md`

## Risks
- HUD layout must remain responsive at lower resolutions.
- Debug windows must not become visible by default through bootstrap or reload ordering.
- This remains a concept v0 and should not claim final UX completeness.
