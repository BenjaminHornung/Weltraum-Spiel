# Proposal

## Change
`fix-player-hud-context-priority-v2`

## Problem
The player HUD still treats the bootstrap docking target as a permanent player context. `PrototypeBootstrap` passes the auto-created docking port directly to the HUD, and `PrototypePlayerHudSnapshotBuilder.BuildDocking()` marks docking visible whenever source and target ports exist. The right context panel therefore shows docking even while arena, combat, or navigation information is more relevant. Arena progress is also appended to the ship systems panel, which mixes mission state with ship health.

## Goal
- Gate the player-facing docking context so bootstrap-created ports do not dominate the HUD unless docking is intentionally selected or the assist is actually routed.
- Reorder context priority to favor critical warnings, combat, active docking, navigation, objective, then nominal fallback.
- Move arena/objective progress out of the ship systems panel and into a separate objective panel.
- Extend HUD layout regression checks so the new objective panel does not overlap other windows across aspect ratios.

## Non-Goals
- No full minimap/radar redesign.
- No TextMeshPro migration.
- No screen-space world target indicator implementation.
- No player weapon-computer control surface changes.
