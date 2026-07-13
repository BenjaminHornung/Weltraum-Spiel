# Proposal: Stabilize Autopilot Obstacle Replan Chatter v1

## Problem

`PrototypeBootstrapHost` currently forwards obstacle risk signals from `ObstacleDetected` / `CollisionPredicted` too aggressively during launch-corridor navigation, producing repeated `SafetyReplan` cycles when obstacle signals flicker across frames.

The immediate replan path is correct for real new or near-collision risks, but not for short-lived, repeated corridor edge flicker. This introduces navigation noise and unstable behavior during approach setup.

## Outcome

Reduce `SafetyReplan` churn by introducing a small debounce and state-stability gate around launch-corridor obstacle risk transitions, while preserving immediate replans for genuine risk changes and near-collision urgencies.

## Scope

- `PrototypeBootstrapHost` obstacle risk ingestion and replan trigger path.
- New stability/debounce rule set for repeated `ObstacleDetected` / `CollisionPredicted` events.
- EditMode + PlayMode verification plan for chatter suppression and preserved emergency semantics.
- Test evidence placeholders under `.devtoolbox/specs/changes/stabilize-autopilot-obstacle-replan-chatter-v1/tests`.

## Non-Goals

- Arrival terminal overshoot behavior.
- Phase-7 executor extraction.
- Global removal of immediate `ObstacleDetected` / `CollisionPredicted` semantics.

## Target Outcome

- Fewer redundant `SafetyReplan` events during narrow obstacle flicker windows.
- Immediate replans remain for new/near-collision risk events.
- Evidence package includes baseline and after-fix CSV logs for comparison.

## Constraints

- No production code changes in this step.
- Keep file scope to this change scaffold only.
