# Capability: player-hud-context-priority

## Requirement
The player HUD SHALL present the most relevant player-facing context without letting an automatically created docking target permanently override combat, navigation, or mission objective information.

## Scenarios
- When the bootstrap scene creates a prototype docking approach target but the player has not selected docking and docking assist is not routed, the docking snapshot is not visible and no docking warning chip is emitted.
- When a combat target is active, the context panel shows combat before docking, navigation, or objective context.
- When docking is explicitly selected or the docking assist is routed, the context panel shows docking before navigation/objective context.
- When navigation is active and docking is not active, the context panel shows navigation before objective context.
- When arena/objective state is visible but no higher-priority context is active, the context panel shows the objective.
- Ship systems only show ship state: fuel, main engine, RCS, SAS, weapon, and modules. Arena/mission text is shown in a separate objective panel.

## Constraints
- Existing prototype/debug windows must remain available outside the Basic player HUD preset.
- The generated player HUD must not create overlapping panels across tested desktop, ultrawide, narrow, and portrait aspect ratios.
- This change must stay scoped to context priority and objective separation; minimap blips, TextMeshPro, world markers, and weapon controls are handled separately.
