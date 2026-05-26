# player-mission-reward-ui-v1 Design

## Approach

Reuse the existing Player HUD objective pipeline. The Objective panel already owns mission-like progress, and the concept explicitly warns against fake mission UI before real gameplay systems exist. This slice therefore adds a compact reward/completion line sourced from `PrototypePveArenaLoop` rather than a separate mission screen.

## Data Flow

- `PrototypePveArenaLoop` remains the Arena gameplay source.
- `PrototypePlayerHudSnapshotBuilder` reads Arena progress/reward state.
- `PrototypePlayerHudRenderer` renders the result in the existing Objective panel.

## UI Shape

- Keep the Objective panel compact.
- Keep Ship Systems limited to ship state.
- Show reward/completion only when the Arena loop is complete or explicitly reward-ready.
- Use plain player-facing wording; no fake currency or unlocks unless backed by data.

## Verification

- EditMode snapshot/render tests for active and completed Arena states.
- Existing responsive HUD layout tests should continue to pass.
- PlayMode GameView screenshot evidence for the Objective panel.
