# player-mission-reward-ui-v1 Proposal

## Problem

The Player HUD now separates ship systems, objective progress, combat, docking, navigation, help, and radar well enough for ordinary play. The remaining player-facing UI gap from `docs/player-facing-ui-concept-v0.md` is mission/reward architecture: the concept explicitly says not to fake a mission UI before real gameplay systems exist, but the HUD should reserve a clean place for genuine objective/reward data when a gameplay loop provides it.

The current Arena loop has objective progress and reward-stub data, but the Player HUD only presents the objective text. Completion/reward state is not yet surfaced as a compact, player-facing mission/reward line.

## Outcome

Add a small mission/reward extension to the existing Objective panel. It should show real Arena completion/reward data when available, stay hidden or neutral while incomplete, and avoid inventing a standalone fake mission screen.

## Scope

- Reuse `PrototypePveArenaLoop` and `PrototypePlayerHud` snapshot/rendering patterns.
- Add player-facing mission/reward fields to the Objective snapshot or a closely related HUD data structure.
- Keep Arena objective progress outside Ship Systems.
- Show completion/reward wording only when the objective is actually complete or the gameplay loop reports an eligible reward state.
- Add focused EditMode tests for incomplete and completed states.
- Capture Unity MCP evidence and at least one real GameView screenshot.

## Non-goals

- No economy, currency inventory, unlock database, shop, mission selection screen, or claim flow.
- No fake mission UI without backing data.
- No new large modal/card surface.
- No changes to combat, navigation, docking, or ship physics.
