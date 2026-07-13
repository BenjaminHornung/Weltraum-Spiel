# Prompt: UI Redesign Agent

Goal:
Create the first player-facing UI redesign foundation using ViewModels and
clear input modes. Do not perform broad visual polish in the same task.

Context:
- Read AGENTS.md.
- Read docs/ux/unified-ui-input-mode-architecture.md.
- Read docs/ux/player-hud-map-builder-surface-flow.md.
- Read 04_ui_ux_design_system.md.
- Inspect existing `PrototypePlayerHudRenderer` and navigation planner UI.

Constraints:
- Player UI and debug UI must remain separate.
- One visible UI change per implementation task.
- UI must not own gameplay truth.
- Autopilot state comes through ViewModel/Telemetry.
- Produce screenshot evidence.

Tasks:
1. Define HUD ViewModel contracts for ShipFlight and Navigation.
2. Add InputMode enum/state model if not present.
3. Add compact Navigation status panel state: no target, plan ready, executing,
   invalidated, complete, failed.
4. Add screenshot/evidence tests for 1280x720 and at least one non-16:9 aspect.
5. Keep legacy debug windows hidden in Basic player preset.

Done when:
- Player sees active mode and next useful action.
- No debug function key is required for player task.
- Screenshot evidence shows no overlap.
